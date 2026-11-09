# Cloudflare deploy

`tweb-rizz` is the client (`dist/`, built with `VITE_OPENROUTER_BASE_URL=/api/openrouter`) plus `worker.js`, which
proxies the Rizz Coach's OpenRouter calls and holds the key as the `OPENROUTER_API_KEY` secret.

Workers Builds runs:

- build: `pnpm install --frozen-lockfile && pnpm exec vite build && find dist -name '*.map' -delete`
- deploy: `npx wrangler deploy -c deploy/cloudflare/wrangler.jsonc`

with the build variable `VITE_OPENROUTER_BASE_URL=/api/openrouter`. Never give the build `OPENROUTER_API_KEY`: Vite would inline it into the page.
Set the key once: `npx wrangler secret put OPENROUTER_API_KEY -c deploy/cloudflare/wrangler.jsonc`.
