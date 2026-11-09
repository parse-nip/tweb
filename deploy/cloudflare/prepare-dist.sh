#!/bin/bash
# Run after `vite build`, from the repo root: what the hosted build needs beside the bundle.
set -e

# the build copies no public dir: fonts, the icon font, theme patterns, stickers and sounds are the committed static
# files in public/assets (and the other non-bundle files next to them: wasm, manifests, changelogs). Old hashed
# bundles stay behind, and nothing the build wrote is overwritten.
(cd public && find . -type f ! -name '*.js' ! -name '*.css' ! -name '*.map' ! -name 'index.html' -exec cp --parents -n {} ../dist/ \;)

# the login-free Rizz Coach demo at /rizz-demo/
mkdir -p dist/rizz-demo/icons
cp deploy/cloudflare/demo/index.html dist/rizz-demo/index.html
cp src/components/rizz/icons/*.svg dist/rizz-demo/icons/

find dist -name '*.map' -delete
echo "dist: $(find dist -type f | wc -l) files, $(du -sh dist | cut -f1)"
