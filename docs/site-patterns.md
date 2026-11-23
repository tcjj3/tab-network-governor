# Site pattern semantics

TNG treats site configuration as user-authored **site patterns**, not as origins that must always include a scheme.

| Input | Meaning |
|---|---|
| `example.com` | exact host, HTTP + HTTPS |
| `https://example.com` | exact host, HTTPS only |
| `http://example.com` | exact host, HTTP only |
| `*.example.com` | subdomains only, HTTP + HTTPS |
| `https://*.example.com` | subdomains only, HTTPS only |
| `example.com:8080` | exact host + port 8080, HTTP + HTTPS |
| `http://example.com:8080` | exact host + port 8080, HTTP only |

The parser does **not** add a missing scheme, remove an explicit scheme, expand an exact hostname into subdomains, or silently strip a path/query/fragment.

## Port permissions

Chrome extension host permissions and ordinary extension match patterns are host/scheme patterns rather than port-scoped permissions. For a port-specific TNG rule, the extension therefore requests the corresponding host permission and then enforces the configured port in TNG's own runtime matcher.

This means a rule such as `example.com:8080` is semantically port-specific inside TNG even though Chrome's permission prompt may describe broader access to that host.

## Wildcard subdomains

TNG defines `*.example.com` as **subdomains only**. The apex `example.com` is not included unless another rule explicitly includes it.

This is stricter than Chrome's own `*.example.com` match-pattern behavior, so TNG applies an additional runtime check (and uses exclusions where possible).

## Migration from v0.3.1

The old `tngSites` storage key contained explicit origins such as `https://example.com`. On upgrade, TNG migrates those values to `tngSitePatterns` without removing their scheme, so the old matching scope is preserved rather than broadened.
