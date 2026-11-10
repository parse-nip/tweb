#!/usr/bin/env bash
# Builds Rizzmate and deploys it to Cloudflare with the Rizz Coach's proxy (worker.js).
#   CLOUDFLARE_ACCOUNT_ID=… CLOUDFLARE_API_TOKEN=… bash deploy/cloudflare/deploy.sh
# The OpenRouter key never goes into the build: the client talks to /api/openrouter, and the Worker adds the key
# from its OPENROUTER_API_KEY secret. A build that holds a key anyway (a .env.local, an exported variable) is refused.
set -euo pipefail
cd "$(dirname "$0")/../.."
HERE=deploy/cloudflare

# no key in the build, whatever the environment or .env.local say
VITE_OPENROUTER_BASE_URL=/api/openrouter VITE_OPENROUTER_API_KEY= OPENROUTER_API_KEY= npx vite build

rm -rf "$HERE/.assets"
mkdir -p "$HERE/.assets"
cp -a public/. "$HERE/.assets/"
cp -a dist/. "$HERE/.assets/"
find "$HERE/.assets" -name '*.map' -delete

if grep -rlq 'sk-or-v1-' "$HERE/.assets"; then
  echo "Refusing to deploy: an OpenRouter key is in the build." >&2
  exit 1
fi

cd "$HERE"
npx -y wrangler@4 deploy
