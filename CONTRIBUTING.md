# Contributing

Tampr is a lightweight, local-first Chrome extension for CSS and JavaScript
browser mods. Contributions should keep the runtime predictable, the permission
story narrow, and the UI calm enough for daily use.

## Setup

```sh
npm install
npm run check
```

Build the unpacked extension:

```sh
npm run build
```

Load `dist` from `chrome://extensions` with Developer mode enabled. For the
watch-build workflow, see [Development](./docs/development.md).

## Quality Gates

Run these before opening a pull request:

```sh
npm run check
npm run test:e2e
```

`npm run check` covers formatting, linting, typecheck, unit and integration
tests, and the production build. `npm run test:e2e` builds the extension and
loads it in Chromium for a smoke test.

## Project Boundaries

- Keep user data local unless a future public proposal explicitly changes that.
- Do not add broad permissions for hypothetical features.
- Keep Chrome API usage behind typed boundaries when that improves tests.
- Prefer pure domain logic for snippet, match-rule, import/export, and runtime
  planning behavior.
- Keep the service worker framework-light.
- Use the existing component-folder pattern for UI components.
- Author UI styles in `px`; PostCSS converts shipped CSS to `rem`.

## Commit Messages

Commits follow Conventional Commits and are checked by the local commit hook.

Examples:

```text
feat: add snippet import and export
fix: preserve editor state on failed save
docs: define trust checks
```

Keep commits coherent and reviewable. Do not include generated attribution
trailers or tool-specific wording in commit messages.

## Pull Request Checklist

- The change fits Tampr's local-first, lightweight product boundaries.
- Tests cover new domain, storage, message, runtime, or UI behavior.
- Permission, privacy, and runtime-trust implications are documented.
- `npm run check` passes.
- `npm run test:e2e` passes when extension behavior or UI surfaces change.
- New dependencies earn their bundle weight and product value.

## Automated Agents

Automated coding agents should read [AGENTS.md](./AGENTS.md) before making
changes. It captures Tampr's product boundaries, architecture rules, UI
conventions, testing expectations, permission policy, and commit rules in one
place.
