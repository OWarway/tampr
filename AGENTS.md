# Agent Guide

This is the canonical guide for automated coding agents working on Tampr. Keep
it public-safe, practical, and aligned with the tracked docs. Do not copy private
planning notes into this file.

## Product North Star

Tampr is a lightweight, local-first Chrome extension for personal CSS and
JavaScript browser mods.

- Keep user data local by default.
- Do not add accounts, cloud sync, telemetry, hosted snippet feeds, or remote
  snippet execution without an explicit public proposal.
- Treat lightweight as a product feature: avoid background churn, broad
  permissions, hidden network behavior, and dependencies that do not earn their
  bundle weight.
- Prefer plain, inspectable output. Generated Blueprint snippets should become
  normal editable snippets.

## Read First

Before changing behavior, read the smallest relevant set:

- `README.md` for product scope and architecture.
- `CONTRIBUTING.md` for contributor rules and quality gates.
- `docs/development.md` for runtime, Blueprint, export/import, and command
  workflow.
- `docs/privacy-security.md` before changing permissions, storage, messaging,
  downloads, script execution, or host access.
- `docs/trust-checks.md` before changing runtime behavior or release packaging.
- Existing source and tests in the area being touched.

Some local planning docs may exist in `docs/` and be excluded by
`.git/info/exclude`. Do not stage or push locally excluded planning notes.

## Engineering Rules

- Work in focused phases and keep commits coherent.
- Preserve strict TypeScript. Avoid `any`; model contracts with explicit types or
  schemas.
- Put pure behavior in `src/domain` where possible, with unit tests.
- Keep Chrome API usage behind small typed adapters or controllers when that
  improves testing.
- Keep the service worker direct and framework-light.
- Prefer existing patterns over new abstractions. Add an abstraction only when it
  removes real complexity or matches local structure.
- Do not widen manifest permissions casually. Every new permission needs a clear
  product reason, tests where practical, and docs in `docs/privacy-security.md`
  plus `docs/trust-checks.md`.
- Do not introduce remote code execution, remote snippet installation, telemetry,
  or surprise network calls.
- Keep import/export native to Tampr unless a deliberate migration plan is
  accepted.

## Architecture Map

```text
src/
  background/  service-worker orchestration and controllers
  blueprint/   temporary page picker behavior
  chrome/      thin typed adapters around Chrome APIs
  domain/      pure snippet, match-rule, import/export, and blueprint logic
  popup/       current-page control surface
  runtime/     Chrome User Scripts registration and injected helper behavior
  shared/      cross-surface message and data contracts
  storage/     versioned local persistence
  workspace/   full snippet editor UI
tests/
  e2e/
  integration/
  unit/
```

## UI Rules

- Build the usable product surface, not a marketing page.
- Keep the visual language calm, utilitarian, and dense enough for repeated use.
- Use React for popup and workspace UI.
- Feature components live in their own folders with source, SCSS module, and
  focused tests.
- Use SCSS modules for component styles. Author dimensions in `px`; PostCSS
  converts shipped CSS to `rem`.
- Avoid nested cards and decorative UI that does not help the workflow.
- Keep controls predictable: buttons for commands, select menus for option sets,
  toggles or checkboxes for binary settings, and tooltips for unclear fields.
- Ensure text fits across popup and workspace sizes.
- Refresh screenshots when visible public UI changes.

## Runtime And Permission Boundaries

- Saved snippets are the source of truth. Runtime registrations are rebuilt from
  local storage after create, edit, enable, disable, delete, import, install, and
  startup.
- User-authored snippets run through Chrome User Scripts.
- Host access is requested for saved match rules, not granted broadly up front.
- `activeTab` is for user-invoked active page context.
- `scripting` is for the temporary user-invoked Blueprint picker only.
- `downloads` is for user-triggered workspace exports and the constrained
  `Tampr.download()` API.
- The Blueprint picker is not persistent page monitoring. It should return only
  the chosen action and selector metadata needed to create a local snippet.

## Testing Rules

- Add or update tests with the behavior change.
- Use unit tests for pure domain logic and small adapters.
- Use integration tests for service-worker controllers and message flows.
- Use component tests for popup and workspace interactions.
- Run `npm run check` before committing.
- Run `npm run test:e2e` when manifest, extension packaging, popup, workspace, or
  runtime behavior changes.

## Documentation Rules

- Update public docs when behavior, permissions, trust boundaries, or workflows
  change.
- Keep `README.md` user-facing and concise.
- Keep `docs/development.md` useful for local development and architecture
  decisions.
- Keep `docs/privacy-security.md` honest about storage, permissions, downloads,
  host access, and runtime risks.
- Keep `docs/trust-checks.md` aligned with manual release checks.

## Commit Rules

- Use Conventional Commits.
- Keep commits small enough to review.
- Do not include generated attribution trailers or tool-specific wording in
  commit messages.
- Do not rewrite unrelated user changes.
- Never stage ignored local planning docs.

## Definition Of Done

A change is done when:

- It fits the local-first, lightweight product boundary.
- The behavior is typed and covered by focused tests.
- Permission and privacy implications are documented.
- Public UI screenshots are refreshed when relevant.
- `npm run check` passes.
- `npm run test:e2e` passes when extension behavior or visible surfaces changed.
