(() => {
    'use strict';

    if (globalThis.TNGSitePatterns) {
        return;
    }

    const HTTP_SCHEMES = new Set(['http', 'https']);

    function splitAuthority(rawAuthority) {
        if (rawAuthority.startsWith('[')) {
            const end = rawAuthority.indexOf(']');
            if (end < 0) {
                return null;
            }

            const host = rawAuthority.slice(0, end + 1);
            const suffix = rawAuthority.slice(end + 1);

            if (!suffix) {
                return { host, port: null };
            }

            if (!/^:\d+$/.test(suffix)) {
                return null;
            }

            return {
                host,
                port: suffix.slice(1)
            };
        }

        const colonCount = (rawAuthority.match(/:/g) || []).length;

        if (colonCount === 0) {
            return { host: rawAuthority, port: null };
        }

        if (colonCount !== 1) {
            return null;
        }

        const index = rawAuthority.lastIndexOf(':');
        const port = rawAuthority.slice(index + 1);

        if (!/^\d+$/.test(port)) {
            return null;
        }

        return {
            host: rawAuthority.slice(0, index),
            port
        };
    }

    function parse(raw) {
        if (typeof raw !== 'string') {
            return null;
        }

        let value = raw.trim();
        if (!value) {
            return null;
        }

        let scheme = null;
        const schemeMatch = value.match(/^(https?):\/\/(.*)$/i);

        if (schemeMatch) {
            scheme = schemeMatch[1].toLowerCase();
            value = schemeMatch[2];
        } else if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
            return null;
        }

        // Site patterns are intentionally host-level. Do not silently strip
        // a path/query/fragment the user supplied.
        if (/[/?#]/.test(value)) {
            // A single trailing slash after an explicit scheme is accepted as
            // formatting noise; anything else is a different scope and must
            // be expressed by a future path-rule feature instead of guessed.
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
        if (!authority || !authority.host) {
            return null;
        }

        const candidate = `${scheme || 'http'}://${authority.host}${authority.port ? `:${authority.port}` : ''}/`;
        let url;

        try {
            url = new URL(candidate);
        } catch {
            return null;
        }

        if (!HTTP_SCHEMES.has(url.protocol.slice(0, -1))) {
            return null;
        }

        const hostname = url.hostname.toLowerCase();
        if (!hostname) {
            return null;
        }

        if (subdomains && (hostname.startsWith('[') || /^\d+(?:\.\d+){3}$/.test(hostname) || hostname === 'localhost')) {
            return null;
        }

        let port = authority.port;
        if (port !== null) {
            const number = Number(port);
            if (!Number.isInteger(number) || number < 1 || number > 65535) {
                return null;
            }
            port = String(number);
        }

        const hostText = `${subdomains ? '*.' : ''}${hostname}${port ? `:${port}` : ''}`;
        const canonical = `${scheme ? `${scheme}://` : ''}${hostText}`;

        return {
            canonical,
            scheme,
            hostname,
            port,
            subdomains
        };
    }

    function effectivePort(url) {
        if (url.port) {
            return url.port;
        }
        return url.protocol === 'http:' ? '80' : url.protocol === 'https:' ? '443' : '';
    }

    function matchesUrl(pattern, rawUrl) {
        let url;
        try {
            url = rawUrl instanceof URL ? rawUrl : new URL(rawUrl);
        } catch {
            return false;
        }

        const scheme = url.protocol.slice(0, -1);
        if (!HTTP_SCHEMES.has(scheme)) {
            return false;
        }

        if (pattern.scheme && pattern.scheme !== scheme) {
            return false;
        }

        const host = url.hostname.toLowerCase();
        if (pattern.subdomains) {
            if (host === pattern.hostname || !host.endsWith(`.${pattern.hostname}`)) {
                return false;
            }
        } else if (host !== pattern.hostname) {
            return false;
        }

        if (pattern.port && effectivePort(url) !== pattern.port) {
            return false;
        }

        return true;
    }

    function hostForChrome(pattern) {
        return `${pattern.subdomains ? '*.' : ''}${pattern.hostname}`;
    }

    // Chrome extension match patterns/host permissions do not scope by port.
    // Port specificity is enforced by matchesUrl() after the broad host match.
    function chromeMatches(pattern) {
        const host = hostForChrome(pattern);
        const schemes = pattern.scheme
            ? [pattern.scheme]
            : ['http', 'https'];

        return schemes.map(scheme => `${scheme}://${host}/*`);
    }

    function normalizeList(values) {
        const result = [];
        const seen = new Set();

        for (const value of Array.isArray(values) ? values : []) {
            const pattern = parse(value);
            if (!pattern || seen.has(pattern.canonical)) {
                continue;
            }
            seen.add(pattern.canonical);
            result.push(pattern);
        }

        return result.sort((a, b) => a.canonical.localeCompare(b.canonical));
    }

    function uniqueChromeMatches(patterns) {
        return [...new Set(patterns.flatMap(chromeMatches))].sort();
    }

    function exactForUrl(rawUrl) {
        try {
            const url = new URL(rawUrl);
            const scheme = url.protocol.slice(0, -1);
            if (!HTTP_SCHEMES.has(scheme)) {
                return null;
            }
            return `${scheme}://${url.hostname.toLowerCase()}${url.port ? `:${url.port}` : ''}`;
        } catch {
            return null;
        }
    }

    globalThis.TNGSitePatterns = Object.freeze({
        parse,
        matchesUrl,
        chromeMatches,
        normalizeList,
        uniqueChromeMatches,
        exactForUrl
    });
})();
