#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
bash scripts/validate.sh
VERSION="$(python3 - <<'PYVER'
import json
print(json.load(open('extension/full/manifest.json', encoding='utf-8'))['version'])
PYVER
)"
rm -rf dist
mkdir -p dist
(cd extension/full && zip -qr "../../dist/tab-network-governor-full-v${VERSION}.zip" .)
(cd extension/lite && zip -qr "../../dist/tab-network-governor-lite-v${VERSION}.zip" .)
cp userscript/tab-network-governor.user.js "dist/tab-network-governor-portable-v${VERSION}.user.js"
(
    cd dist
    sha256sum \
        "tab-network-governor-full-v${VERSION}.zip" \
        "tab-network-governor-lite-v${VERSION}.zip" \
        "tab-network-governor-portable-v${VERSION}.user.js" \
        > SHA256SUMS.txt
)
printf 'Built dist packages for v%s with SHA-256 checksums.\n' "$VERSION"
