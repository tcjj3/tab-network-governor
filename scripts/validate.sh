#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

for f in extension/full/*.js extension/lite/*.js userscript/*.js experiments/*.js; do
    node --check "$f" >/dev/null
    echo "JS OK: $f"
done

node tests/site-patterns.test.js

python3 - <<'PYJSON'
import json, pathlib
for p in [pathlib.Path('extension/full/manifest.json'), pathlib.Path('extension/lite/manifest.json')]:
    json.loads(p.read_text(encoding='utf-8'))
    print('JSON OK:', p)
PYJSON

FULL_VERSION="$(python3 - <<'PY'
import json
print(json.load(open('extension/full/manifest.json', encoding='utf-8'))['version'])
PY
)"
LITE_VERSION="$(python3 - <<'PY'
import json
print(json.load(open('extension/lite/manifest.json', encoding='utf-8'))['version'])
PY
)"
PORTABLE_VERSION="$(sed -n 's#^// @version[[:space:]]*##p' userscript/tab-network-governor.user.js | head -n1)"

if [[ "$FULL_VERSION" != "$LITE_VERSION" || "$FULL_VERSION" != "$PORTABLE_VERSION" ]]; then
    echo "Version mismatch: full=$FULL_VERSION lite=$LITE_VERSION portable=$PORTABLE_VERSION" >&2
    exit 1
fi

echo "Version OK: $FULL_VERSION"

if grep -RniE 'chatgpt|cgpt' extension userscript experiments --exclude='*.md'; then
    echo 'Site-specific branding remains in production code.' >&2
    exit 1
fi

for f in README.md README.zh-CN.md PRIVACY.md SECURITY.md CONTRIBUTING.md docs/permissions.md docs/testing.md docs/site-patterns.md; do
    test -s "$f" || { echo "Missing/empty required project doc: $f" >&2; exit 1; }
done

echo 'Required project docs OK.'
