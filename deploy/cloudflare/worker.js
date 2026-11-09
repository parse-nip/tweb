// Cloudflare Worker for the hosted build: serves the static client (the `ASSETS` binding) and forwards the Rizz Coach's
// requests to OpenRouter, so the API key lives here as the OPENROUTER_API_KEY secret and never reaches the browser.
// The client is built with VITE_OPENROUTER_BASE_URL=/api/openrouter.

const ALLOWED_PATHS = new Set(['v1/chat/completions', 'alpha/decisions']);
// the models the client uses (Jev for grading, a fast Gemini for suggestions and the simulator)
const ALLOWED_MODELS = /^~?(typesafe\/jev|google\/gemini-2\.5-flash)/;
const MAX_BODY = 40000;
const MAX_TOKENS = 3000;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if(!url.pathname.startsWith('/api/openrouter/')) return env.ASSETS.fetch(request);

    const path = url.pathname.slice('/api/openrouter/'.length);
    if(request.method !== 'POST' || !ALLOWED_PATHS.has(path)) return new Response('Not found', {status: 404});

    // only this site's own pages may spend the key
    const origin = request.headers.get('Origin');
    if(request.headers.get('Sec-Fetch-Site') === 'cross-site' || (origin && origin !== url.origin)) {
      return new Response('Forbidden', {status: 403});
    }

    const text = await request.text();
    if(text.length > MAX_BODY) return new Response('Too large', {status: 413});

    let body;
    try {
      body = JSON.parse(text);
    } catch(err) {
      return new Response('Bad request', {status: 400});
    }

    if(!ALLOWED_MODELS.test(String(body.model || ''))) return new Response('Model not allowed', {status: 400});
    if(body.max_tokens > MAX_TOKENS) body.max_tokens = MAX_TOKENS;

    return fetch('https://openrouter.ai/api/' + path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + env.OPENROUTER_API_KEY,
        'X-Title': 'tweb Rizz Coach'
      },
      body: JSON.stringify(body)
    });
  }
};
