(() => {
    'use strict';

    const STORAGE_KEY = 'tngSitePatterns';
    const LEGACY_STORAGE_KEY = 'tngSites';
    const SP = globalThis.TNGSitePatterns;
    const $ = id => document.getElementById(id);

    async function readPatterns() {
        const data = await chrome.storage.local.get([
            STORAGE_KEY,
            LEGACY_STORAGE_KEY
        ]);

        let raw = data[STORAGE_KEY];

        if (!Array.isArray(raw) && Array.isArray(data[LEGACY_STORAGE_KEY])) {
            raw = data[LEGACY_STORAGE_KEY];
            const migrated = SP.normalizeList(raw)
                .map(pattern => pattern.canonical);
            await chrome.storage.local.set({ [STORAGE_KEY]: migrated });
            await chrome.storage.local.remove(LEGACY_STORAGE_KEY);
            raw = migrated;
        }

        return SP.normalizeList(raw || []);
    }

    async function writePatterns(patterns) {
        const canonical = SP.normalizeList(
            patterns.map(pattern => pattern.canonical ?? pattern)
        ).map(pattern => pattern.canonical);

        await chrome.storage.local.set({
            [STORAGE_KEY]: canonical
        });

        await chrome.runtime.sendMessage({
            type: 'TNG_REFRESH_CONFIG'
        }).catch(() => {});
    }

    async function removeUnusedPermissions(before, after) {
        const beforeMatches = new Set(SP.uniqueChromeMatches(before));
        const afterMatches = new Set(SP.uniqueChromeMatches(after));
        const unused = [...beforeMatches].filter(match => !afterMatches.has(match));

        if (unused.length) {
            await chrome.permissions.remove({ origins: unused })
                .catch(() => false);
        }
    }

    function describe(pattern) {
        const scheme = pattern.scheme
            ? pattern.scheme.toUpperCase()
            : 'HTTP + HTTPS';
        const host = pattern.subdomains
            ? 'subdomains only'
            : 'exact host';
        const port = pattern.port
            ? `port ${pattern.port}`
            : 'any port';

        return `${scheme} · ${host} · ${port}`;
    }

    async function render() {
        const patterns = await readPatterns();
        const root = $('sites');
        root.textContent = '';

        if (!patterns.length) {
            root.textContent = 'No site patterns enabled yet.';
            return;
        }

        for (const pattern of patterns) {
            const row = document.createElement('div');
            row.className = 'site';

            const text = document.createElement('div');
            text.className = 'site-text';

            const code = document.createElement('code');
            code.textContent = pattern.canonical;

            const detail = document.createElement('div');
            detail.className = 'muted';
            detail.textContent = describe(pattern);

            text.append(code, detail);

            const button = document.createElement('button');
            button.textContent = 'Remove';

            button.addEventListener('click', async () => {
                button.disabled = true;

                try {
                    const before = await readPatterns();
                    const after = before.filter(
                        item => item.canonical !== pattern.canonical
                    );

                    await writePatterns(after);
                    await removeUnusedPermissions(before, after);

                    $('message').textContent = `Removed ${pattern.canonical}`;
                    await render();
                } finally {
                    button.disabled = false;
                }
            });

            row.append(text, button);
            root.append(row);
        }
    }

    $('add-form').addEventListener('submit', async event => {
        event.preventDefault();

        const pattern = SP.parse($('site-input').value);

        if (!pattern) {
            $('message').textContent =
                'Invalid site pattern. Examples: example.com, https://example.com, *.example.com, https://*.example.com.';
            return;
        }

        const origins = SP.chromeMatches(pattern);
        const granted = await chrome.permissions.request({ origins });

        if (!granted) {
            $('message').textContent = 'Site permission was not granted.';
            return;
        }

        const patterns = await readPatterns();
        patterns.push(pattern);
        await writePatterns(patterns);

        $('site-input').value = '';
        $('message').textContent = `Enabled ${pattern.canonical}`;
        await render();
    });

    render().catch(error => {
        $('message').textContent = String(error);
    });
})();
