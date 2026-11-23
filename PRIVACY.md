# Privacy

Tab Network Governor (TNG) is designed to operate locally in the browser.

## Data collection

TNG does **not** collect, sell, upload, or transmit browsing history, page content, prompts, form data, cookies, authorization headers, credentials, or response bodies to the project author or to any TNG-operated service.

TNG does not include analytics or telemetry of its own.

## Local data

The browser extensions store only the user-authored site patterns required to decide where TNG should operate. The Portable Userscript stores the same kind of site-pattern configuration through the userscript manager's local storage API.

## Network behavior

TNG changes whether managed hidden tabs may initiate runtime network traffic. It does not proxy traffic through a TNG server and does not provide a remote backend.

## Permissions

The Full and Lite extensions request site access only when the user enables a site pattern. Some browser permission prompts may describe a broader host scope than a port-specific TNG rule because ordinary Chromium host permissions are not port-scoped; TNG still enforces the configured port in its own runtime matcher.

See `docs/permissions.md` for the rationale behind each browser permission.
