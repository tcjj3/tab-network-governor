# Permission rationale

This document explains why the Chromium editions request each permission.

## Full Edition

| Permission | Why it is needed |
|---|---|
| `declarativeNetRequest` | Applies the browser-network hard firewall to managed hidden tabs. |
| `tabs` | Tracks tab activation/removal and identifies which managed tabs are foreground or hidden. |
| `scripting` | Dynamically registers/injects the visibility reporter and MAIN-world soft-freeze only on user-enabled sites. |
| `storage` | Stores user-authored site patterns locally. |
| optional `http://*/*`, `https://*/*` host access | Lets the user grant access only to sites they explicitly enable. No site is enabled by default. |

## Lite Edition

Lite uses the same permissions except that it does not inject MAIN-world soft-freeze logic. `scripting` is still used for the visibility reporter on user-enabled sites.

## Why optional host permissions are broad in the manifest

Chromium requires optional host permissions to be declared in advance. TNG declares HTTP(S) as *available* optional permissions, then requests only the host scope necessary for a user-authored rule.

A port-specific rule such as `example.com:8080` is enforced by TNG's runtime matcher because ordinary Chromium host permissions are not port-scoped. The browser permission UI may therefore describe a broader host permission than the TNG rule itself.
