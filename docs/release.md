# Release Checklist

Tampr is not ready for a public store release until this checklist passes. Keep
release work small and auditable.

## Versioning

1. Choose the next version.
2. Update `package.json`.
3. Update `public/manifest.json`.
4. Update `CHANGELOG.md`.
5. Commit with `chore: release vX.Y.Z`.
6. Tag the commit as `vX.Y.Z` after the final smoke run.

Use `0.x` versions while the data model, UI, and extension behavior are still
settling. Breaking changes before 1.0 must be called out in the changelog.

## Local Gates

Run:

```sh
npm ci
npm run check
npm run test:e2e
```

Then run the manual checks in [Trust Checks](./trust-checks.md).

## Phase 5 Preflight

Before a release commit, verify the five release-readiness areas:

1. Manual trust pass: complete the data, runtime, and permission checks in
   [Trust Checks](./trust-checks.md) on the packaged `dist` build.
2. README release polish: keep screenshots current, confirm install steps work,
   and make the lightweight/local-first value clear in the first screen.
3. Release workflow: update versions, changelog, package output, and tag only
   after the final smoke run.
4. Store and open-source confidence: keep permission wording, known limits,
   contribution docs, security policy, issue templates, and CI aligned with the
   shipped behavior.
5. UI sanity pass: inspect popup and workspace empty, loading, unsupported,
   denied, unsaved, import/export, and runtime-error states in Chrome.

## Package The Extension

1. Remove any local development artifacts.
2. Run `npm run build`.
3. Load `dist` unpacked in Chrome and complete a smoke pass.
4. Package the contents of `dist`, not the repository root.
5. Confirm `dist/manifest.json` contains the intended version and permissions.

## Store Listing Notes

The listing should make these points plainly:

- Tampr is local-first.
- Snippets are stored in Chrome local extension storage.
- Tampr does not use accounts, telemetry, cloud sync, or remote snippet feeds.
- Host access is requested for user-authored match rules.
- Downloads access is used for user-triggered exports and the constrained
  `Tampr.download()` API for generated text or validated http/https URLs.
- User Scripts may need to be enabled in Chrome extension details.
- Imported snippets should be reviewed like source code.

## Known Limits

Include the current V1 limits from [Trust Checks](./trust-checks.md) in release
notes until each limit is intentionally removed.
