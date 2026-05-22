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

Run the Phase 1 quality gates:

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

Use `npm run dev:extension` when you want Vite to keep rebuilding extension
output during local development. Reload the unpacked extension from Chrome after
each background or manifest change.

## Runtime Proof

The Phase 2 workspace can register a local snippet against a page you grant
access to.

1. Build and reload the unpacked extension after manifest changes.
2. Open the Tampr workspace from the popup or extension details page.
3. Save the prefilled `*://example.com/*` snippet and approve host access.
4. Open or reload `https://example.com`.
5. Confirm the page receives the Tampr outline.

Chrome 138 and newer may also require the Tampr extension detail page's Allow
User Scripts toggle before `chrome.userScripts` is available.

## Commands

| Command                 | Purpose                                                    |
| ----------------------- | ---------------------------------------------------------- |
| `npm run build`         | Typecheck and build the extension into `dist`.             |
| `npm run check`         | Run formatting, linting, typecheck, unit tests, and build. |
| `npm run dev`           | Preview popup and workspace HTML through Vite.             |
| `npm run dev:extension` | Rebuild unpacked extension output in watch mode.           |
| `npm run format`        | Format tracked source and docs.                            |
| `npm run lint`          | Lint TypeScript and config files.                          |
| `npm test`              | Run unit tests.                                            |
| `npm run test:e2e`      | Run Playwright tests once extension smoke tests exist.     |
| `npm run typecheck`     | Run strict TypeScript checking.                            |

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
