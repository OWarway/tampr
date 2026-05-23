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

The export contains local snippet records only; it does not include accounts,
remote URLs, or browser permission grants.

Imports are runtime-validated before storage changes. Valid imports merge by
stable snippet ID: matching IDs are replaced by the imported snippet, unrelated
local snippets stay in place, and new imported snippets are appended. Unsupported
formats fail with a user-facing error instead of partially writing data.

Prototype exports are intentionally not imported. Tampr is a new app and the
import path should stay small, native, and easy to trust.

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
docs: define the v2 build spec
chore: scaffold the extension foundation
test: cover snippet defaults
```

Keep commits coherent and reviewable. Do not add AI attribution trailers or
AI-specific wording to commit messages for now.
