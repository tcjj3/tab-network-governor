# Changelog

## 0.3.3

- Hardened Full Edition against `Extension context invalidated` after extension reload/update.
- Replaced the Full reporter's raw `pagehide` `sendMessage()` with a context-safe runtime bridge that catches both synchronous throws and rejected promises.
- Added reporter generation metadata plus page-monotonic sequence seeds so a freshly injected reporter can safely take over a MAIN-world soft-freeze instance that survived an extension reload.
- Older reporter generations now retire quietly and cannot overwrite a newer reporter's network state.
- Lite Edition now also retires its reporter quietly when its extension context is invalidated.

## 0.3.2

- Replaced origin-only configuration with explicit site-pattern semantics.
- A hostname without a scheme matches both HTTP and HTTPS; an explicit scheme remains exact.
- Added strict `*.` subdomain rules and optional port matching.
- Added automatic migration from the v0.3.1 `tngSites` / Portable origin storage without broadening old rules.
- Added shared site-pattern parser/matcher for Full and Lite extensions.
- Added runtime filtering for port-specific rules because Chrome host permissions are not port-scoped.
- Added site-pattern unit tests and documentation.
- Updated popup/options UI to show matching rules instead of silently assuming an origin format.

## 0.3.1 — Faster foreground release + explicit HTTP UI

- Coalesced DNR firewall updates so many tab-state changes cannot build a long redundant update queue.
- Added `tabs.onHighlighted` as an additional foreground fail-open hint.
- Preserved ACK semantics: Full Edition resumes soft-frozen requests only after the coalesced DNR revision is applied.
- Made HTTP origin support explicit in the site manager; manual entries now require `http://` or `https://` instead of silently assuming HTTPS.
- Kept `http://*/*` and `https://*/*` as optional host permissions in both browser extensions.

## 0.3.0 — Generic refactor

- Renamed the project to **Tab Network Governor**.
- Removed site-specific naming and hard-coded site assumptions from production code.
- Added per-origin opt-in configuration using optional host permissions.
- Added Full Extension, Lite Extension, and Portable Userscript as first-class editions.
- Preserved the validated Full Edition architecture: MAIN-world soft freeze + DNR fallback + visibility ACK.
- Added popup/options UI for enabling and removing origins.
- Replaced wildcard `postMessage('*')` bridging with same-origin bridge validation.
- Default debug logging is disabled; request URLs are not printed by default.
- Added a generic endpoint request-governor experiment.
