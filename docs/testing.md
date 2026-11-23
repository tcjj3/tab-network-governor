# Testing

TNG uses both automated checks and manual browser smoke tests.

## Automated checks

Run:

```bash
bash scripts/validate.sh
```

The validation suite currently checks:

- JavaScript syntax for Full, Lite, Portable, and experiments;
- Chromium manifest JSON parsing;
- Site Pattern parser/matcher behavior;
- absence of site-specific branding in production code.

## Manual smoke-test matrix for v0.3.3

The following behaviors were exercised in a real multi-tab Chromium workflow before the v0.3.3 open-source baseline was frozen.

| Edition | Hidden-tab behavior | Resume behavior | Extension/runtime errors | Result |
|---|---|---|---|---|
| Full | Background traffic became effectively quiet, with DNR as fallback | Returned to foreground without observed red/blocked resume requests | `Extension context invalidated` reload/update issue fixed and retested | PASS |
| Lite | DNR background blocking behaved as intended | Foreground communication returned normally | No background extension errors observed in smoke testing | PASS |
| Portable | Page-layer background requests were soft-frozen in the tested workload | Foreground communication resumed without observed red requests | No browser-extension context involved | PASS |

## Recommended regression procedure

For Full Edition:

1. Enable a test site pattern.
2. Open DevTools Network and let the page settle in the foreground.
3. Move the tab to the background for at least one polling interval.
4. Confirm the background interval is quiet except for traffic outside TNG's coverage model.
5. Return to the tab.
6. Confirm queued traffic resumes without an initial burst of DNR-blocked requests.
7. Reload/update the unpacked extension while a managed page exists.
8. Exercise `hidden → visible`, `pagehide`, reload, and tab close.
9. Confirm the extension error page does not accumulate `Extension context invalidated` from the new document/context.

For Lite Edition, repeat the visibility transitions and confirm DNR blocking/unblocking, understanding that the page itself may observe blocked requests while hidden.

For Portable Edition, confirm the userscript is active only on matching site patterns and that hidden `fetch`/XHR waits rather than producing a retry storm in the tested page.

## Site Pattern regression cases

At minimum test:

```text
example.com
https://example.com
http://example.com
*.example.com
https://*.example.com
example.com:8080
http://example.com:8080
```

The semantics are defined in `docs/site-patterns.md` and are covered by `tests/site-patterns.test.js`.
