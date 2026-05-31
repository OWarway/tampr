# Development

## Requirements

- Node.js 24 or newer
- npm 11 or newer
- Chrome with extension developer mode available

## Local Setup

Install dependencies:

```sh
npm install
```

Run the local quality gates:

```sh
npm run check
```

## Load In Chrome

Create the unpacked extension output:

```sh
npm run build
```

Then in Chrome:

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Choose Load unpacked.
4. Select this repository's generated `dist` directory.

Use the extension watch build during local development:

```sh
npm run dev:extension
```

Load or reload `dist` once after that first development build. Development builds
include a small reload watcher: keep the workspace open while you work and Tampr
will reload itself when Vite writes the next build. Popup and awake service
worker contexts watch the same marker too.

Reload the target web page after extension reloads when you need to rerun a
changed snippet on that page. Reload Tampr manually from `chrome://extensions`
after changing manifest permissions if Chrome does not pick the change up from
the development reload.

Install the Playwright browser once before local extension smoke tests:

```sh
npx playwright install chromium
```

## Runtime Proof

The workspace runtime proof can register a local snippet against a page you grant
access to.

1. Build and reload the unpacked extension after manifest changes.
2. Open the Tampr workspace from the popup or extension details page.
3. Save the prefilled `*://example.com/*` snippet and approve host access.
4. Open or reload `https://example.com`.
5. Confirm the page receives the Tampr outline.

Chrome 138 and newer may also require the Tampr extension detail page's Allow
User Scripts toggle before `chrome.userScripts` is available.

Opening the workspace from the popup carries sanitized active-page context for
match-rule presets. Tampr uses Chrome's temporary `activeTab` access for that
user-invoked handoff rather than broad tab access.

## Blueprint Creator

The popup Blueprint action uses `activeTab` plus `scripting` to run a temporary
element picker on the current http or https page. The picker returns only the
chosen action, selector metadata, and optional draft flow to the service worker.
The page-side builder can append several selected-element actions before saving,
select draft steps, move them up or down, remove them, run a temporary preview
against the current page, edit set-value, extract, and custom-code step
settings, and return a draft Blueprint flow. The service worker creates a normal
local snippet in the Blueprints folder, syncs runtime registrations, and opens
the new snippet in the workspace.

Selector metadata is assessed in the Blueprint domain as a confidence score,
quality label, detail, and recommendation. The injected page picker mirrors the
same rules locally because Chrome serializes the picker function into the page.
Keep those two assessment paths aligned until selector generation moves out of
the injected function.

Source-page selector tests may also return repair suggestions when a selector is
too broad. Suggestions are generated from visible matches using stable IDs,
data/ARIA/name/title attributes, unique class combinations, and finally a
clearly-labelled positional path fallback. The workspace can apply a suggestion
only while generated Blueprint code is still in sync.

Blueprint output is deliberately plain CSS. Current actions can hide, highlight,
remove an overlay, make an element sticky, widen a content container, or hide an
element only for print. Keep new Blueprint actions CSS-first until the selector
and review workflow are proven. The workspace builder can add, remove, reorder,
relabel, switch, enable, and disable nodes while the generated CSS still matches
the recipe; once users hand-edit CSS, code-changing builder controls lock instead
of overwriting their work. Workspaces opened from a source page carry a sanitized
source URL and source tab ID so a node can re-pick or test its selector in the
same tab without granting broad tab access. Selector tests read match and visible
counts through a temporary `scripting.executeScript` call and do not activate the
source tab.

Automation Blueprint nodes are domain-supported before they are fully exposed in
the workspace builder. Recipes can model wait-for-element, click, set-value,
extract-text, download-json, and custom-code steps. The JavaScript compiler emits
a readable local runner with timeouts, visible-element checks, protected-field
refusal, risky-click refusal, visible custom code execution, and
`Tampr.download()` JSON output. Keep automation generated code visible in the
normal snippet editor; do not move execution into a hidden interpreter.

The workspace builder can add automation nodes to the same straight-line flow as
CSS nodes and edits their core settings in the inspector. Blueprint changes
regenerate both CSS and JavaScript while the generated code is still in sync; if
either editor is hand-edited, code-changing Blueprint controls lock until the
user reconciles the generated source.

The saved Blueprint builder renders the recipe as a lightweight flow diagram
using the graph layout stored in the recipe. The first canvas remains a
straight-line success path with a start marker, directional connectors, selectable
node cards, the existing node library, and the existing inspector. Keep the
canvas custom and dependency-light until branching, drag positioning, or
multi-port connections are proven necessary.

The workspace flow preview runs the existing safe source-page checks in order
for every enabled node. CSS nodes use selector tests; automation nodes use
automation node tests. This preview is intentionally non-mutating: it must not
click, type into fields, submit forms, execute custom code, or start downloads.
Preview results are shown in the report panel and reflected back onto the flow
canvas node cards. Keep full flow execution separate from this preview until
step-by-step confirmation and cancellation are explicit.

Automation safety checks live in the Blueprint domain and are shown in the
workspace inspector. Keep this signal conservative: warn on selectors that drift,
clicks that look like submit/buy/send/delete controls, hidden click targets,
sensitive form-field selectors, empty set-value payloads, flaky timeouts, and
non-JSON download filenames. Run and recording features should reuse this same
assessment instead of adding separate UI-only rules.

Automation node tests use a temporary `scripting.executeScript` call against the
source tab to preflight one node at a time. They read selector matches,
visibility, field compatibility, preview text, and download configuration only;
they must not click, type into fields, submit forms, extract saved data, or start
downloads. Keep this non-mutating test path separate from any future manual run
or recording path.

Manual automation node runs also use temporary `scripting.executeScript` against
the source tab. The first supported run actions are intentionally low-risk:
wait-for-element and extract-text. Click runs require explicit inspector
confirmation and are still refused inside the injected runner when the target
looks like submit, buy, send, delete, publish, or payment behavior. Set-value and
download-json steps must remain refused by the manual runner until their
confirmation, blocking, and result-reporting UX is explicit.

Click execution resolves the selected element to the closest interactive ancestor
before safety checks and dispatch. This keeps child selections inside buttons or
links usable while still reviewing the actual control that will receive the
click. Both manual click runs and compiled Blueprint snippets use the same
pointerdown, mousedown, pointerup, mouseup, and click sequence. These synthetic
events are still not trusted browser events, so sites that require
`isTrusted === true` may ignore them.

## Script Download API

Snippets that run in the default `USER_SCRIPT` world receive a small global
Tampr API with two payload shapes: generated text or a remote URL.

```js
await Tampr.download({
  filename: 'report.json',
  mimeType: 'application/json;charset=utf-8',
  text: JSON.stringify({ ok: true }, null, 2),
});

await Tampr.download({
  filename: 'Tampr/videos/clip.mp4',
  url: 'https://cdn.example.com/videos/clip.mp4',
});
```

The promise resolves with `{ downloadId }` when Chrome accepts the download.
Tampr routes the request through `runtime.onUserScriptMessage`, validates it in
the service worker, and then calls `chrome.downloads.download`.

Filenames may include forward-slash subpaths (Chrome creates them under the user's
Downloads folder). The validator still rejects absolute paths, parent segments
(`..`), reserved filename characters, control characters, oversized text payloads,
and multiline or comma-containing MIME types. URL payloads must use `http` or
`https` and stay under 2,000 characters; the snippet's host permission grant is
not consulted, so a snippet authorized for one site can download from any HTTP
origin. Main-world snippets do not receive this API because page scripts can
observe that execution world.

## Data Portability

The workspace exports snippets as Tampr version 1 JSON with this envelope:

```json
{
  "format": "tampr",
  "version": 1,
  "exportedAt": 1748000000000,
  "data": {
    "snippets": []
  }
}
```

The export contains local snippet records, including folder labels and optional
Blueprint recipe metadata, only. It does not include accounts, remote URLs, or
browser permission grants.

Imports are runtime-validated before storage changes. Valid imports merge by
stable snippet ID: matching IDs are replaced by the imported snippet, unrelated
local snippets stay in place, and new imported snippets are appended. Unsupported
formats fail with a user-facing error instead of partially writing data.

Prototype exports are intentionally not imported. Tampr is a new app and the
import path should stay small, native, and easy to trust.

Automatic backups are deferred for V1. Manual workspace export is the supported
backup path. Tampr declares `downloads` because workspace export and
`Tampr.download()` (text and URL payloads) both need a dependable browser
download path. Workspace export
still falls back to the in-page download path when the browser downloads API is
unavailable. See [Trust Checks](./trust-checks.md) for the manual data, runtime,
and permission checks to run before release.

## Commands

| Command                 | Purpose                                                    |
| ----------------------- | ---------------------------------------------------------- |
| `npm run build`         | Typecheck and build the extension into `dist`.             |
| `npm run check`         | Run formatting, linting, typecheck, unit tests, and build. |
| `npm run dev`           | Preview popup and workspace HTML through Vite.             |
| `npm run dev:extension` | Rebuild unpacked output and trigger dev extension reloads. |
| `npm run format`        | Format tracked source and docs.                            |
| `npm run lint`          | Lint TypeScript and config files.                          |
| `npm test`              | Run unit tests.                                            |
| `npm run test:e2e`      | Build and run Playwright extension smoke tests.            |
| `npm run typecheck`     | Run strict TypeScript checking.                            |

## Pre-Releases

GitHub pre-releases are created from version tags. The release workflow runs the
same quality gates as CI, installs Chromium for the extension smoke test, builds
`dist`, and uploads a zip of the unpacked extension.

```sh
git tag v0.1.0-alpha.1
git push origin v0.1.0-alpha.1
```

Use a new tag for each pre-release; do not move published tags unless a release
was created by mistake and has already been deleted.

## Component Conventions

Feature components live in their own folders with their source, SCSS module, and
focused render or interaction tests together. Keep workspace-specific components
under `src/workspace/components`; move UI primitives into a shared UI folder only
after popup and workspace genuinely share them.

Author extension UI styles in `px` inside SCSS modules and global SCSS entry
styles. The PostCSS build step converts extension CSS to `rem` with a `16px`
root so the source stays easy to read while shipped UI sizing respects root font
scaling.

The workspace code editor uses CodeMirror packages directly. Keep editor
extensions intentional so code editing earns its bundle weight without turning
Tampr into a broad IDE surface.

## Commit Messages

Commit messages follow Conventional Commits and are linted by the local
`commit-msg` hook.

Examples:

```text
docs: document local development
chore: scaffold the extension foundation
test: cover snippet defaults
```

Keep commits coherent and reviewable. Do not add generated attribution trailers
or tool-specific wording to commit messages for now.
