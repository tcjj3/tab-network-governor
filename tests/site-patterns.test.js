'use strict';

require('../extension/full/site-patterns.js');
const SP = globalThis.TNGSitePatterns;

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function parse(value) {
    const result = SP.parse(value);
    assert(result, `Expected valid pattern: ${value}`);
    return result;
}

const domain = parse('example.com');
assert(domain.canonical === 'example.com', 'canonical plain domain');
assert(SP.matchesUrl(domain, 'http://example.com/a'), 'plain domain http');
assert(SP.matchesUrl(domain, 'https://example.com/a'), 'plain domain https');
assert(!SP.matchesUrl(domain, 'https://sub.example.com/a'), 'plain domain must not include subdomains');

const https = parse('https://example.com');
assert(SP.matchesUrl(https, 'https://example.com/'), 'explicit https');
assert(!SP.matchesUrl(https, 'http://example.com/'), 'explicit https must reject http');

const subdomains = parse('*.example.com');
assert(SP.matchesUrl(subdomains, 'https://a.example.com/'), 'wildcard subdomain');
assert(SP.matchesUrl(subdomains, 'http://deep.a.example.com/'), 'deep wildcard subdomain');
assert(!SP.matchesUrl(subdomains, 'https://example.com/'), 'wildcard must not include apex');
assert(!SP.matchesUrl(subdomains, 'https://notexample.com/'), 'wildcard boundary');

const httpsSubs = parse('https://*.example.com');
assert(SP.matchesUrl(httpsSubs, 'https://a.example.com/'), 'https wildcard');
assert(!SP.matchesUrl(httpsSubs, 'http://a.example.com/'), 'https wildcard rejects http');

const port = parse('example.com:8080');
assert(SP.matchesUrl(port, 'http://example.com:8080/'), 'port http');
assert(SP.matchesUrl(port, 'https://example.com:8080/'), 'port https');
assert(!SP.matchesUrl(port, 'https://example.com:8443/'), 'port mismatch');

const defaultPort = parse('https://example.com:443');
assert(SP.matchesUrl(defaultPort, 'https://example.com/'), 'explicit default port matches effective port');

assert(SP.parse('https://example.com/path') === null, 'path must not be silently discarded');
assert(SP.parse('example.com?x=1') === null, 'query must not be silently discarded');
assert(SP.parse('ftp://example.com') === null, 'unsupported scheme');

const chromeMatches = SP.chromeMatches(domain);
assert(chromeMatches.includes('http://example.com/*'), 'plain domain http permission');
assert(chromeMatches.includes('https://example.com/*'), 'plain domain https permission');
assert(!chromeMatches.some(value => value.includes(':8080')), 'permission patterns do not encode ports');

console.log('Site-pattern tests OK');
