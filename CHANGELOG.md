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
- Visual Blueprint creator for generating editable CSS snippets from a picked
  page element.
- Blueprint CSS action pack for overlay removal, sticky elements, wider content,
  and print cleanup.
- Blueprint recipe metadata stored with generated snippets for future flow
  editing.
- Workspace Blueprint preview for saved recipe nodes, selectors, and selector
  quality.
- Editable Blueprint node labels, action types, and generated-CSS enable toggles
  with code-sync protection.
- Blueprint node library for adding and removing CSS action nodes in a straight
  saved flow.
- Blueprint flow reordering for moving saved nodes up and down.
- Automation Blueprint recipe foundation with typed wait, click, set-value,
  extract-text, and JSON download nodes plus a readable JavaScript compiler.
- Workspace automation node library and inspector controls for adding and
  configuring wait, click, set-value, extract-text, and JSON download nodes.
- Blueprint automation safety assessment for risky clicks, sensitive fields,
  selector drift, flaky timeouts, and download filename issues.
- Source-page automation node testing for checking selectors, visibility, field
  compatibility, and download settings without clicking, typing, or downloading.
- Manual source-page runs for supported Blueprint automation nodes, starting
  with wait-for-element and extract-text steps.
- Guarded manual click runs with explicit confirmation and source-page refusal
  for risky submit, buy, send, delete, and similar targets.
- Page-side Blueprint draft builder for chaining selected-element actions before
  saving, including run preview and custom-code steps.
- Page-side Blueprint draft step selection with move up, move down, and remove
  controls before saving.
- Page-side Blueprint draft step settings for editing set-value, extract, and
  custom-code nodes before preview or save.
- Source-page selector re-picking for Blueprint nodes opened from a page.
- Source-page selector testing for Blueprint nodes, including match and visible
  counts from the original tab.
- User Scripts setup prompts that open Tampr's Chrome extension details page.
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
