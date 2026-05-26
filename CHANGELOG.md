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
- Per-tab extension badge count when snippets run on the current page.
- Workspace with searchable snippet rail, CodeMirror editing, match-rule
  authoring, snippet CRUD, import/export, and trust status.
- Tampr application mark and Chrome extension icons.
- Field help tooltips for snippet editor controls.
- Lightweight, persistent, collapsible folder grouping for workspace snippets.
- Folder rename and delete-to-General management from the workspace rail.
- Auto-save when moving saved snippets between folders.
- Runtime status copy that avoids exposing raw registration counts.
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
