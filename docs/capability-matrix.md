# Capability matrix

| Capability | Full Extension | Lite Extension | Portable Userscript |
|---|---:|---:|---:|
| User-authored site patterns | Yes | Yes | Yes |
| Scheme wildcard by omission (`example.com`) | Yes | Yes | Yes |
| Explicit scheme (`https://example.com`) | Yes | Yes | Yes |
| Strict subdomain wildcard (`*.example.com`) | Yes | Yes | Yes |
| Runtime port matching | Yes | Yes | Yes |
| Hidden `fetch()` soft freeze | Yes | No | Yes |
| Hidden XHR soft freeze | Yes | No | Yes |
| Hidden `sendBeacon()` suppression | Yes | No | Yes |
| GET/HEAD deduplication while queued | Yes | No | Yes |
| Resume staggering | Yes | No | Yes |
| Browser-network DNR hard block | Yes | Yes | No |
| WebSocket/WebTransport/ping fallback block | Yes | Yes | No |
| DNR-unblock ACK before page-layer resume | Yes | No | No |
| Portable to userscript-only environments | No | No | Yes |

Port-specific extension rules are enforced by TNG's runtime URL matcher. Chrome's host-permission/match-pattern layer is broader because ordinary extension match patterns are not port-scoped.
