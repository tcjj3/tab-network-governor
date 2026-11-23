(() => {
    'use strict';

    const STORAGE_KEY = 'tngSitePatterns';
    const LEGACY_STORAGE_KEY = 'tngSites';
    const EDITION = 'Lite Edition';
    const SP = globalThis.TNGSitePatterns;
    const $ = id => document.getElementById(id);

    let currentUrl = null;
    let matchingPatterns = [];

    async function readPatterns() {
        const data = await chrome.storage.local.get([
            STORAGE_KEY,
            LEGACY_STORAGE_KEY
        ]);
        const raw = Array.isArray(data[STORAGE_KEY])
            ? data[STORAGE_KEY]
            : (Array.isArray(data[LEGACY_STORAGE_KEY]) ? data[LEGACY_STORAGE_KEY] : []);
        return SP.normalizeList(raw);
    }

    async function writePatterns(patterns) {
        const values = SP.normalizeList(
            patterns.map(pattern => pattern.canonical ?? pattern)
        ).map(pattern => pattern.canonical);

        await chrome.storage.local.set({ [STORAGE_KEY]: values });
        await chrome.storage.local.remove(LEGACY_STORAGE_KEY).catch(() => {});
        await chrome.runtime.sendMessage({ type: 'TNG_REFRESH_CONFIG' }).catch(() => {});
    }

    async function removeUnusedPermissions(before, after) {
        const needed = new Set(SP.uniqueChromeMatches(after));
        const unused = SP.uniqueChromeMatches(before)
            .filter(match => !needed.has(match));
        if (unused.length) {
            await chrome.permissions.remove({ origins: unused }).catch(() => false);
        }
    }

    async function init() {
        $('edition').textContent = EDITION;
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        currentUrl = tab?.url || null;
        const exact = SP.exactForUrl(currentUrl || '');

        if (!exact) {
            $('origin').textContent = 'Unsupported page';
            $('status').textContent = 'Only HTTP(S) pages can be managed.';
            $('toggle').textContent = 'Unavailable';
            return;
        }

        $('origin').textContent = exact;

        const patterns = await readPatterns();
        matchingPatterns = patterns.filter(pattern =>
            SP.matchesUrl(pattern, currentUrl)
        );

        if (matchingPatterns.length) {
            $('status').textContent = `Governed by: ${matchingPatterns.map(p => p.canonical).join(', ')}`;
            $('toggle').textContent = matchingPatterns.length === 1
                ? 'Remove matching rule'
                : `Remove ${matchingPatterns.length} matching rules`;
        } else {
            $('status').textContent = 'Not governed by any site pattern.';
            $('toggle').textContent = 'Enable exact current site';
        }

        $('toggle').disabled = false;
    }

    $('toggle').addEventListener('click', async () => {
        if (!currentUrl) {
            return;
        }

        $('toggle').disabled = true;

        try {
            const before = await readPatterns();

            if (matchingPatterns.length) {
                const remove = new Set(matchingPatterns.map(p => p.canonical));
                const after = before.filter(pattern => !remove.has(pattern.canonical));
                await writePatterns(after);
                await removeUnusedPermissions(before, after);
                $('status').textContent = 'Matching rule(s) removed.';
            } else {
                const exactText = SP.exactForUrl(currentUrl);
                const pattern = SP.parse(exactText);
                const granted = await chrome.permissions.request({
                    origins: SP.chromeMatches(pattern)
                });

                if (!granted) {
                    $('status').textContent = 'Site permission was not granted.';
                    return;
                }

                before.push(pattern);
                await writePatterns(before);
                $('status').textContent = `Enabled ${pattern.canonical}`;
            }

            await init();
        } catch (error) {
            $('status').textContent = `Error: ${error?.message || error}`;
        } finally {
            $('toggle').disabled = false;
        }
    });

    $('options').addEventListener('click', () =>
        chrome.runtime.openOptionsPage()
    );

    init().catch(error => {
        $('status').textContent = String(error);
    });
})();
