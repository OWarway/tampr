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
- Workspace Blueprint flow diagram canvas with start marker, directional
  connectors, layout-aware node cards, and inspector selection.
- Workspace Blueprint flow preview that checks every step on the source page
  without clicking, typing, or downloading.
- Flow preview statuses are reflected directly on Blueprint canvas node cards.
- Guarded workspace Blueprint flow runs for supported wait, extract, confirmed
  set-value, and confirmed click steps, with CSS skips, unsupported-step
  blocking, and canvas run statuses.
- Workspace Blueprint flow runs can stop at the selected node, with
  confirmation scoped to only the steps that will actually run.
- Workspace Blueprint flow runs can be stopped while running, and automation
  nodes can pause for review before they run.
- Blueprint click UIs now surface that synthetic clicks run with
  `event.isTrusted === false`.
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
- Blueprint click runs resolve child selections to the closest interactive
  ancestor and dispatch pointer/mouse/click event sequences for SPA controls.
- Page-side Blueprint draft builder for chaining selected-element actions before
  saving, including run preview and custom-code steps.
- Page-side Blueprint drafts can resume after same-tab link navigation so the
  editor stays available on the next page.
- Page-side Blueprint draft step selection with move up, move down, and remove
  controls before saving.
- Page-side Blueprint draft step settings for editing set-value, extract, and
  custom-code nodes before preview or save.
- Source-page selector re-picking for Blueprint nodes opened from a page.
- Source-page selector testing for Blueprint nodes, including match and visible
  counts from the original tab.
- Blueprint selector confidence scoring with workspace and page-picker
  recommendations.
- Source-page selector repair suggestions with one-click workspace application
  when generated code is still in sync.
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

### Fixed

- Page-side Blueprint draft click runs now resolve child selections to
  interactive ancestors and avoid the picker intercepting their synthetic click
  events.

### Deferred

- Automatic backups.
- Accounts, cloud sync, telemetry, hosted snippet gallery, and remote snippet
  execution.
- Cross-browser support.
- Incognito-only snippet settings.
