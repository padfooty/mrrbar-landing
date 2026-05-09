const ALLOWED_ORIGINS = ['https://mrr.bar', 'https://www.mrr.bar'];

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function optionsResponse(origin) {
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

async function handleSubscribe(request, env) {
  const origin = request.headers.get('Origin') || '';
  const headers = { 'Content-Type': 'application/json', ...corsHeaders(origin) };

  let email;
  try {
    const body = await request.json();
    email = (body.email || '').trim().toLowerCase();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers });
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response(JSON.stringify({ error: 'Invalid email address' }), { status: 400, headers });
  }

  const apiKey     = env.BREVO_API_KEY;
  const listId     = parseInt(env.BREVO_LIST_ID, 10);
  const templateId = parseInt(env.BREVO_DOI_TEMPLATE_ID, 10);

  if (!apiKey || !listId || !templateId) {
    return new Response(JSON.stringify({ error: 'Server configuration error' }), { status: 500, headers });
  }

  const res = await fetch('https://api.brevo.com/v3/contacts/doubleOptinConfirmation', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'content-type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify({
      email,
      includeListIds: [listId],
      templateId,
      redirectionUrl: 'https://mrr.bar/confirmed',
    }),
  });

  if (res.ok || res.status === 204) {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  const err = await res.json().catch(() => ({}));
  return new Response(JSON.stringify({ error: err.message || 'Brevo error' }), {
    status: res.status,
    headers,
  });
}

async function handleUnsubscribe(request, env) {
  const origin = request.headers.get('Origin') || '';
  const headers = { 'Content-Type': 'application/json', ...corsHeaders(origin) };

  let email;
  try {
    const body = await request.json();
    email = (body.email || '').trim().toLowerCase();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers });
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response(JSON.stringify({ error: 'Invalid email address' }), { status: 400, headers });
  }

  const apiKey = env.BREVO_API_KEY;
  const listId = parseInt(env.BREVO_LIST_ID, 10);

  if (!apiKey || !listId) {
    return new Response(JSON.stringify({ error: 'Server configuration error' }), { status: 500, headers });
  }

  const res = await fetch(`https://api.brevo.com/v3/contacts/lists/${listId}/contacts/remove`, {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'content-type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify({ emails: [email] }),
  });

  if (res.ok || res.status === 204) {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  const err = await res.json().catch(() => ({}));
  return new Response(JSON.stringify({ error: err.message || 'Brevo error' }), {
    status: res.status,
    headers,
  });
}

export default {
  async fetch(request, env) {
    const url    = new URL(request.url);
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      return optionsResponse(origin);
    }

    if (url.pathname === '/api/subscribe' && request.method === 'POST') {
      return handleSubscribe(request, env);
    }

    if (url.pathname === '/api/unsubscribe' && request.method === 'POST') {
      return handleUnsubscribe(request, env);
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });
  },
};
