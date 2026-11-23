## v0.3.2 → v0.3.3

v0.3.3 does not change site-pattern semantics. It hardens extension reload/update behavior: old content-script contexts retire quietly, and a newly injected visibility reporter can take over an existing MAIN-world soft-freeze without a sequence-number collision.

A tab that was already running v0.3.2 before upgrading can still contain the old v0.3.2 listener until that document is refreshed or replaced; this is a one-time legacy artifact because already-invalidated code cannot be rewritten retroactively. Newly loaded documents use the hardened reporter.

# Migration

## v0.3.1 → v0.3.2

v0.3.2 replaces origin-only configuration with **site patterns**.

Existing extension values from `tngSites` are migrated automatically to `tngSitePatterns`. Because old values already contain a scheme, their scope is preserved exactly:

```text
https://example.com  →  https://example.com
http://example.com   →  http://example.com
```

TNG does **not** convert an old HTTPS-only rule into the broader `example.com` rule.

Portable Userscript values from `tngPortableOrigins` are likewise migrated to `tngPortablePatterns` when first read.

## New rule syntax

```text
example.com             HTTP + HTTPS, exact host
https://example.com     HTTPS only, exact host
*.example.com           HTTP + HTTPS, subdomains only
https://*.example.com   HTTPS only, subdomains only
example.com:8080        HTTP + HTTPS, port 8080
```

See `docs/site-patterns.md` for the complete semantics.
