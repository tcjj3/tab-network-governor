// ==UserScript==
// @name         Tab Network Governor — Portable
// @namespace    tab-network-governor
// @version      0.3.3
// @description  Soft-freezes runtime network calls while a page matched by an explicitly enabled site pattern is hidden.
// @match        http://*/*
// @match        https://*/*
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        unsafeWindow
// ==/UserScript==

(() => {
    'use strict';

    const STORAGE_KEY = 'tngPortablePatterns';
    const LEGACY_STORAGE_KEY = 'tngPortableOrigins';
    const RESUME_GAP_MS = 120;

    function splitAuthority(rawAuthority) {
        if (rawAuthority.startsWith('[')) {
            const end = rawAuthority.indexOf(']');
            if (end < 0) return null;
            const host = rawAuthority.slice(0, end + 1);
            const suffix = rawAuthority.slice(end + 1);
            if (!suffix) return { host, port: null };
            if (!/^:\d+$/.test(suffix)) return null;
            return { host, port: suffix.slice(1) };
        }

        const count = (rawAuthority.match(/:/g) || []).length;
        if (count === 0) return { host: rawAuthority, port: null };
        if (count !== 1) return null;
        const index = rawAuthority.lastIndexOf(':');
        const port = rawAuthority.slice(index + 1);
        if (!/^\d+$/.test(port)) return null;
        return { host: rawAuthority.slice(0, index), port };
    }

    function parsePattern(raw) {
        if (typeof raw !== 'string') return null;
        let value = raw.trim();
        if (!value) return null;

        let scheme = null;
        const schemeMatch = value.match(/^(https?):\/\/(.*)$/i);
        if (schemeMatch) {
            scheme = schemeMatch[1].toLowerCase();
            value = schemeMatch[2];
        } else if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
            return null;
        }

        if (/[/?#]/.test(value)) {
            if (value.endsWith('/') && !/[?#]/.test(value) && value.indexOf('/') === value.length - 1) {
                value = value.slice(0, -1);
            } else {
                return null;
            }
        }

        let subdomains = false;
        if (value.startsWith('*.')) {
            subdomains = true;
            value = value.slice(2);
        }

        const authority = splitAuthority(value);
        if (!authority?.host) return null;

        let url;
        try {
            url = new URL(`${scheme || 'http'}://${authority.host}${authority.port ? `:${authority.port}` : ''}/`);
        } catch {
            return null;
        }

        const hostname = url.hostname.toLowerCase();
        if (!hostname) return null;

        if (subdomains && (hostname.startsWith('[') || /^\d+(?:\.\d+){3}$/.test(hostname) || hostname === 'localhost')) {
            return null;
        }

        let port = authority.port;
        if (port !== null) {
            const number = Number(port);
            if (!Number.isInteger(number) || number < 1 || number > 65535) return null;
            port = String(number);
        }

        return {
            scheme,
            hostname,
            port,
            subdomains,
            canonical: `${scheme ? `${scheme}://` : ''}${subdomains ? '*.' : ''}${hostname}${port ? `:${port}` : ''}`
        };
    }

    function effectivePort(url) {
        if (url.port) return url.port;
        return url.protocol === 'http:' ? '80' : url.protocol === 'https:' ? '443' : '';
    }

    function matchesPattern(pattern, rawUrl) {
        let url;
        try { url = new URL(rawUrl); } catch { return false; }
        const scheme = url.protocol.slice(0, -1);
        if (scheme !== 'http' && scheme !== 'https') return false;
        if (pattern.scheme && pattern.scheme !== scheme) return false;

        const host = url.hostname.toLowerCase();
        if (pattern.subdomains) {
            if (host === pattern.hostname || !host.endsWith(`.${pattern.hostname}`)) return false;
        } else if (host !== pattern.hostname) {
            return false;
        }

        if (pattern.port && effectivePort(url) !== pattern.port) return false;
        return true;
    }

    function normalizeList(values) {
        const result = [];
        const seen = new Set();
        for (const value of Array.isArray(values) ? values : []) {
            const pattern = parsePattern(value);
            if (!pattern || seen.has(pattern.canonical)) continue;
            seen.add(pattern.canonical);
            result.push(pattern);
        }
        return result.sort((a, b) => a.canonical.localeCompare(b.canonical));
    }

    function getPatterns() {
        let raw = GM_getValue(STORAGE_KEY, null);

        if (!Array.isArray(raw)) {
            raw = GM_getValue(LEGACY_STORAGE_KEY, []);
            const migrated = normalizeList(raw).map(pattern => pattern.canonical);
            GM_setValue(STORAGE_KEY, migrated);
            raw = migrated;
        }

        return normalizeList(raw);
    }

    function setPatterns(patterns) {
        GM_setValue(
            STORAGE_KEY,
            normalizeList(patterns.map(pattern => pattern.canonical ?? pattern))
                .map(pattern => pattern.canonical)
        );
    }

    function exactCurrentPattern() {
        const url = new URL(location.href);
        return parsePattern(`${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ''}`);
    }

    const initialPatterns = getPatterns();
    const matchingPatterns = initialPatterns.filter(pattern =>
        matchesPattern(pattern, location.href)
    );
    const active = matchingPatterns.length > 0;

    GM_registerMenuCommand(
        active
            ? `TNG: remove ${matchingPatterns.length} matching rule${matchingPatterns.length === 1 ? '' : 's'}`
            : 'TNG: enable exact current site',
        () => {
            const patterns = getPatterns();

            if (active) {
                const remove = new Set(matchingPatterns.map(pattern => pattern.canonical));
                setPatterns(patterns.filter(pattern => !remove.has(pattern.canonical)));
            } else {
                patterns.push(exactCurrentPattern());
                setPatterns(patterns);
            }

            alert('TNG site-pattern settings updated. Reload this page once for document-start activation/deactivation.');
        }
    );

    GM_registerMenuCommand(
        'TNG: add site pattern…',
        () => {
            const raw = prompt(
                'Add a TNG site pattern.\n\nExamples:\nexample.com\nhttps://example.com\n*.example.com\nhttps://*.example.com\nexample.com:8080'
            );

            if (raw === null) return;
            const pattern = parsePattern(raw);
            if (!pattern) {
                alert('Invalid site pattern. Paths, queries, and fragments are not silently discarded.');
                return;
            }

            const patterns = getPatterns();
            patterns.push(pattern);
            setPatterns(patterns);
            alert(`Enabled ${pattern.canonical}. Reload matching pages once for document-start activation.`);
        }
    );

    GM_registerMenuCommand(
        'TNG: show enabled site patterns',
        () => {
            const patterns = getPatterns();
            alert(
                patterns.length
                    ? patterns.map(pattern => pattern.canonical).join('\n')
                    : 'No site patterns enabled.'
            );
        }
    );

    if (!active) {
        return;
    }

    const page = unsafeWindow;

    if (page.__TNG_PORTABLE_V1__) {
        return;
    }

    page.__TNG_PORTABLE_V1__ = true;

    const nativeFetch = page.fetch.bind(page);
    const XHR = page.XMLHttpRequest;
    const nativeXHROpen = XHR.prototype.open;
    const nativeXHRSend = XHR.prototype.send;
    const nativeXHRAbort = XHR.prototype.abort;
    const nativeBeacon = page.navigator.sendBeacon
        ? page.navigator.sendBeacon.bind(page.navigator)
        : null;

    const pendingReads = new Map();
    let resumeChain = Promise.resolve();

    function visible() {
        return document.visibilityState === 'visible';
    }

    function waitUntilVisible() {
        if (visible()) return Promise.resolve();

        return new Promise(resolve => {
            const handler = () => {
                if (!visible()) return;
                document.removeEventListener('visibilitychange', handler, true);
                resolve();
            };
            document.addEventListener('visibilitychange', handler, true);
        });
    }

    function reserveResumeSlot() {
        const slot = resumeChain;
        resumeChain = resumeChain
            .catch(() => {})
            .then(() => new Promise(resolve =>
                setTimeout(resolve, RESUME_GAP_MS)
            ));
        return slot;
    }

    function getRequestInfo(input, init) {
        const method = String(
            init?.method ||
            (typeof input !== 'string' ? input?.method : null) ||
            'GET'
        ).toUpperCase();

        let url;
        try {
            url = new URL(
                typeof input === 'string' ? input : input.url,
                location.href
            ).href;
        } catch {
            url = String(input);
        }

        return { method, key: `${method} ${url}` };
    }

    page.fetch = function(input, init) {
        if (visible()) return nativeFetch(input, init);

        const info = getRequestInfo(input, init);
        const isRead = info.method === 'GET' || info.method === 'HEAD';

        if (isRead && pendingReads.has(info.key)) {
            return pendingReads.get(info.key).then(response => response.clone());
        }

        const task = (async () => {
            await waitUntilVisible();

            const signal = init?.signal ||
                (typeof input !== 'string' ? input?.signal : null);

            if (signal?.aborted) {
                throw signal.reason || new DOMException(
                    'The operation was aborted.',
                    'AbortError'
                );
            }

            await reserveResumeSlot();
            await waitUntilVisible();
            return nativeFetch(input, init);
        })();

        if (!isRead) return task;

        pendingReads.set(info.key, task);
        task.finally(() => {
            if (pendingReads.get(info.key) === task) {
                pendingReads.delete(info.key);
            }
        });

        return task.then(response => response.clone());
    };

    XHR.prototype.open = function(method, url, ...args) {
        this.__tngPortable = { aborted: false };
        return nativeXHROpen.call(this, method, url, ...args);
    };

    XHR.prototype.send = function(body) {
        if (visible()) return nativeXHRSend.call(this, body);

        const xhr = this;
        (async () => {
            await waitUntilVisible();
            if (xhr.__tngPortable?.aborted) return;
            await reserveResumeSlot();
            await waitUntilVisible();
            if (xhr.__tngPortable?.aborted) return;
            try { nativeXHRSend.call(xhr, body); } catch {}
        })();
        return undefined;
    };

    XHR.prototype.abort = function() {
        if (this.__tngPortable) {
            this.__tngPortable.aborted = true;
        }
        return nativeXHRAbort.call(this);
    };

    if (nativeBeacon) {
        page.navigator.sendBeacon = function(url, data) {
            if (!visible()) return true;
            return nativeBeacon(url, data);
        };
    }
})();
