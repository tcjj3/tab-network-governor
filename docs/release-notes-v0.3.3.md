# Tab Network Governor v0.3.3 — first public prerelease baseline

v0.3.3 is the first version prepared as a public open-source baseline after multi-tab browser testing across all three editions.

## Editions

- **Full** — recommended: MAIN-world soft freeze + browser DNR hard firewall + unblock ACK before resume.
- **Lite** — DNR-only: smaller and less invasive, but hidden blocked requests can be visible to the web app as failures.
- **Portable** — userscript fallback: page-layer soft freeze for environments where a normal browser extension cannot be installed.

## Highlights

- Site-agnostic project structure and naming.
- User-authored Site Patterns instead of hard-coded domains.
- Scheme omission means HTTP + HTTPS; explicit schemes remain exact.
- Strict `*.` subdomain semantics and optional port matching.
- Coalesced DNR state updates for faster foreground release in multi-tab workloads.
- Full Edition waits for DNR-unblock ACK before releasing queued page requests.
- Hardened extension reload/update lifecycle to avoid `Extension context invalidated` noise in newly loaded v0.3.3 contexts.
- No project telemetry, remote code, or credential collection.

## Manual validation before baseline freeze

Full, Lite, and Portable editions each passed smoke testing in a real Chromium multi-tab workflow. Full resumed without observed red/blocked requests after a background interval; Lite operated without observed background extension errors; Portable resumed without observed red requests in the tested page-layer workload.

See `docs/testing.md` for the test matrix and limitations.

## Known limitations

- Aggressive hidden-tab governance can intentionally pause legitimate realtime behavior such as calls, alarms, monitoring, uploads, collaboration, or media control.
- Portable cannot guarantee Worker/WebSocket/browser-network coverage.
- Lite can expose blocked requests to the page, which may trigger local retries.
- A document that was already running a pre-v0.3.3 content-script context before an extension upgrade may retain that old invalidated listener until the document is refreshed/replaced; new v0.3.3 contexts use the hardened lifecycle logic.
