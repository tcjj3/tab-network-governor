# Tab Network Governor

[简体中文](README.zh-CN.md)

**Tab Network Governor (TNG)** is a browser-side lifecycle/network governor for long-lived web-app tabs.

Modern SPAs and PWAs may continue polling, synchronizing, sending telemetry, retrying failed requests, or maintaining realtime channels while hidden. With many long-lived tabs, per-tab background work can multiply into API rate limits, unnecessary network traffic, CPU/RAM pressure, and noisy retry loops.

TNG changes the default policy from **"every tab is a fully active client"** to **"foreground tabs may communicate; hidden tabs are governed."**

> Unofficial, site-agnostic project. It is not affiliated with or endorsed by any web platform vendor.

## Editions

| Capability | Full Extension | Lite Extension | Portable Userscript |
|---|:---:|:---:|:---:|
| Opt-in by site pattern | ✅ | ✅ | ✅ |
| Freeze hidden `fetch()` | ✅ | — | ✅ |
| Freeze hidden XHR | ✅ | — | ✅ |
| Drop hidden `sendBeacon()` | ✅ | — | ✅ |
| Deduplicate queued GET/HEAD | ✅ | — | ✅ |
| Stagger requests on resume | ✅ | — | ✅ |
| Browser-network hard block | ✅ | ✅ | — |
| WebSocket/WebTransport/ping fallback block | ✅ | ✅ | — |
| DNR-unblock ACK before resume | ✅ | — | — |
| Works where external extensions are unavailable | — | — | ✅* |

`*` Requires a userscript manager that can run the script in the target browser/client.

### Full Extension — recommended

Two layers:

1. **Soft freeze in the page's MAIN world**: hidden-page `fetch`/XHR waits instead of failing, reducing retry storms.
2. **DNR hard firewall**: browser-level fallback blocks runtime traffic that bypasses page hooks.

When a tab becomes visible, queued requests resume only **after** the background service worker confirms that the DNR rule has actually been removed.

### Lite Extension

DNR-only. It is smaller and less invasive, but the web app may still locally retry blocked requests because it receives network failures.


### Site-pattern semantics

TNG does not invent missing constraints or remove explicit ones:

- `example.com` → exact host over HTTP + HTTPS;
- `https://example.com` → HTTPS only;
- `*.example.com` → subdomains only over HTTP + HTTPS;
- `https://*.example.com` → HTTPS subdomains only;
- `example.com:8080` → both schemes, port 8080 only.

Paths, queries, and fragments are not silently discarded. See `docs/site-patterns.md`.

### Portable Userscript

A fallback for environments where a normal browser extension cannot be installed. It provides page-layer soft freezing, but cannot provide browser-network DNR coverage.

## Quick start

### Full/Lite Chromium extension

1. Open `chrome://extensions` (or the equivalent extension page).
2. Enable **Developer mode**.
3. Load `extension/full` or `extension/lite` as an unpacked extension.
4. Open a site you want TNG to manage.
5. Click the TNG toolbar icon and choose **Enable on this site**.

Site access follows user-authored **site patterns**. TNG does not enable itself globally by default.

### Portable userscript

1. Install `userscript/tab-network-governor.user.js` in a compatible userscript manager.
2. Open the target web app.
3. Use the userscript manager menu: **TNG: enable exact current site**.
4. Reload that page once so the hook can run at `document-start`.

The userscript metadata matches HTTP(S) pages so it can be site-agnostic, but it returns immediately on pages not matched by an enabled site pattern.

## Behavior

For a managed site:

```text
visible tab
    └─ network works normally

hidden tab
    ├─ Full: soft-freeze fetch/XHR + drop beacon
    └─ Full/Lite: DNR fallback blocks runtime network traffic

hidden → visible (Full)
    ├─ remove tab from DNR firewall
    ├─ wait for browser-level ACK
    └─ release queued page requests gradually
```

Requests that were already started while the page was foreground are not force-aborted merely because the tab becomes hidden.

## Safety model

- **Opt-in by site pattern.** No site is governed until the user enables a matching rule.
- **Fail-open for ambiguous bootstrap state.** If TNG cannot determine an existing tab's visibility safely, it prefers not to block that tab.
- **Foreground fail-open.** Activating a tab removes it from the DNR hidden set as a second safety mechanism.
- **No credential collection.** TNG does not read or export cookies, authorization headers, page content, prompts, or response bodies.
- **No remote code.** All logic is packaged locally.

## Important limitations

TNG intentionally changes background behavior. Some apps genuinely require background connectivity for calls, alarms, realtime monitoring, uploads, media, or collaboration. Do not enable aggressive background blocking on a site unless you accept that hidden-tab realtime behavior may pause.

The Portable Userscript cannot guarantee interception of Worker traffic, pre-captured native APIs, WebSockets, or browser-level traffic. Use the Full Extension when available.

## Tested workload

The architecture originated from real multi-tab testing on a modern AI web application with dozens of long-lived tabs, where background synchronization amplified history/API traffic and produced rate limiting. That platform is a test case, not an architectural dependency.

## Repository layout

```text
extension/full/       Full extension (recommended)
extension/lite/       DNR-only extension
userscript/           Portable userscript
experiments/          Earlier/generic request-governor experiment
docs/                 Architecture and capability notes
scripts/              Validation/build helpers
dist/                 Generated packages (after build)
```

## Open-source project docs

- Privacy: [`PRIVACY.md`](PRIVACY.md)
- Permission rationale: [`docs/permissions.md`](docs/permissions.md)
- Test matrix: [`docs/testing.md`](docs/testing.md)
- Contributing: [`CONTRIBUTING.md`](CONTRIBUTING.md)
- Release checklist: [`docs/release-checklist.md`](docs/release-checklist.md)

TNG includes no project telemetry and does not upload browsing history, page content, cookies, authorization headers, credentials, or response bodies.

## Development

Run:

```bash
bash scripts/validate.sh
bash scripts/build.sh
```

## License

MIT. See [LICENSE](LICENSE).
