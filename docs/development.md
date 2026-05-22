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
