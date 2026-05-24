# Changelog

All notable changes to Tampr will be documented here.

This project follows Conventional Commits in Git history. Public releases should
group changes under the headings below.

## Unreleased

### Added

- Manifest V3 Chrome extension scaffold with strict TypeScript, React, Vite,
  Vitest, Playwright, ESLint, Prettier, Husky, and commitlint.
- Local-first snippet model with versioned storage, native Tampr export/import,
  and runtime validation.
- Chrome User Scripts runtime sync with host-access and capability states.
- Popup current-page status with enable and disable controls.
- Workspace with searchable snippet rail, CodeMirror editing, match-rule
  authoring, snippet CRUD, import/export, and trust status.
- Lightweight folder grouping for workspace snippets.
- Auto-save when moving saved snippets between folders.
- Browser downloads support for workspace exports.
- Constrained `Tampr.download()` runtime API for user-script world snippets,
  supporting generated text and validated http/https URL downloads.
- README screenshots and release-readiness documentation.
- Privacy, development, trust-check, and release documentation.

### Deferred

- Automatic backups.
- Accounts, cloud sync, telemetry, hosted snippet gallery, and remote snippet
  execution.
- Cross-browser support.
- Incognito-only snippet settings.
