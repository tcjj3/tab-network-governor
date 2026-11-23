# Release checklist

Before publishing a release:

- [ ] `bash scripts/validate.sh` passes.
- [ ] `bash scripts/build.sh` succeeds.
- [ ] Full Edition manual smoke test passes.
- [ ] Lite Edition manual smoke test passes.
- [ ] Portable Edition manual smoke test passes.
- [ ] Site Pattern regression cases pass.
- [ ] `CHANGELOG.md` contains the release entry.
- [ ] Manifest/userscript versions match.
- [ ] README installation and limitations remain accurate.
- [ ] No screenshots/logs contain private URLs, tokens, cookies, account IDs, or user content.
- [ ] `dist/SHA256SUMS.txt` matches the release artifacts.
- [ ] Release notes clearly distinguish Full, Lite, and Portable capabilities.
