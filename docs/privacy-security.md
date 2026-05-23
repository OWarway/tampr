# Privacy And Security

Tampr is local-first by design. The extension stores snippets in Chrome local
extension storage and runs only CSS or JavaScript the user saves locally.

## What Tampr Stores

- Snippet names, match rules, exclude rules, enabled state, run settings, CSS,
  JavaScript, and timestamps.
- Exported backups as user-downloaded JSON when the workspace export action is
  used.

Tampr does not currently use accounts, cloud sync, telemetry, remote snippet
feeds, or a hosted backend.

## Permissions

Tampr declares the smallest permission set needed for the current product:

- `storage` stores local snippets.
- `userScripts` registers user-authored JavaScript and the CSS bridge through
  Chrome's User Scripts API.
- `activeTab` reads the active page URL only after the user opens the popup, so
  the workspace can offer useful match-rule presets.
- `optional_host_permissions` lets Tampr request access to the sites a saved
  snippet targets. Host access is requested at save time for the snippet's match
  rules instead of being granted broadly up front.

Chrome may require the extension details page's User Scripts toggle before
`chrome.userScripts` is available.

## Runtime Model

Saved snippets are the source of truth. On create, edit, enable, disable, delete,
import, extension install, and extension startup, Tampr rebuilds the runtime
registrations from local storage.

Tampr skips snippets that are disabled, have invalid match rules, have no CSS or
JavaScript, or target sites where Chrome host access has not been granted. The
popup and workspace surface these states so a runtime failure is visible rather
than hidden in developer tools.

## Risk Boundaries

Tampr is a code tool. User-authored JavaScript can change pages that match its
rules, and main-world execution can interact with page scripts more directly
than the default user-script world. Treat imported snippets like source code:
inspect them before enabling them on sensitive sites.

Tampr does not execute remote snippets or install code from a gallery in the V1
scope.
