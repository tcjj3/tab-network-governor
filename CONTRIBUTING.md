# Contributing

Thanks for helping improve Tab Network Governor.

## Before opening a change

Please keep the project's core behavior predictable:

- foreground tabs should fail open;
- hidden-tab governance must be explicitly enabled by the user;
- configuration must preserve the user's stated scope rather than inventing protocol, subdomain, port, path, or other constraints;
- Full Edition must not release soft-frozen requests until the browser-network DNR unblock has been acknowledged;
- Lite Edition should remain small and DNR-only;
- Portable Edition should remain useful where normal extensions are unavailable, without pretending to provide browser-network coverage it cannot guarantee.

## Development

Requirements:

- Node.js (for syntax checks and tests)
- Python 3 (for manifest validation)
- `zip` (for release packages)

Run:

```bash
bash scripts/validate.sh
bash scripts/build.sh
```

## Pull requests

A useful pull request should include:

1. what problem is being solved;
2. which edition(s) are affected;
3. whether foreground/hidden/resume behavior changes;
4. tests or a reproducible manual test procedure;
5. documentation updates when configuration or permissions change.

Avoid unrelated refactors in bug-fix pull requests. Network-lifecycle races are easier to review when the behavioral delta stays small.

## Bug reports

Please sanitize screenshots and logs. Do not post authorization headers, cookies, private request URLs, account identifiers, private conversation/document URLs, or other credentials.
