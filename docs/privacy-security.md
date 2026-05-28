# Privacy And Security

Tampr is local-first by design. The extension stores snippets in Chrome local
extension storage and runs only CSS or JavaScript the user saves locally.

## What Tampr Stores

- Snippet names, folder labels, match rules, exclude rules, enabled state, run
  settings, CSS, JavaScript, and timestamps.
- Optional Blueprint recipe metadata for snippets created through Blueprint,
  including selectors, selector quality metadata, graph nodes, edges, and layout.
- Exported backups as user-downloaded JSON when the workspace export action is
  used.
- Generated text files, or files fetched from an http/https URL, when a
  user-authored `USER_SCRIPT` snippet calls `Tampr.download()`.

Tampr does not currently use accounts, cloud sync, telemetry, remote snippet
feeds, or a hosted backend.

Tampr does not perform automatic backups in V1. The user-triggered export action
is the backup path, so the extension does not schedule background downloads.
Browser downloads access is declared because manual exports and the
user-script-world `Tampr.download()` API both need reliable download creation.

## Permissions

Tampr declares the smallest permission set needed for the current product:

- `storage` stores local snippets.
- `userScripts` registers user-authored JavaScript and the CSS bridge through
  Chrome's User Scripts API.
- `activeTab` reads the active page URL only after the user opens the popup, so
  the workspace can offer useful match-rule presets and the Blueprint creator
  can work on the page the user invoked it from.
- `scripting` injects the temporary Blueprint picker only after the user starts
  it from the popup. The picker highlights elements, returns the selected
  selector, and is removed after Hide, Highlight, or Cancel.
- `downloads` lets user-triggered workspace exports and validated
  `Tampr.download()` calls save generated text or remote http/https URLs
  through the browser downloads API.
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

Registered snippets also include a small user-script-world heartbeat that tells
the service worker which snippet ran in a tab. Tampr uses that local message to
show the extension badge count; it does not include page URLs, snippet code, or
remote network calls, and it does not require the broad `tabs` permission.

The Blueprint picker is not a persistent content script. It runs only for the
active user-invoked page selection, creates a local snippet from the selected
element, and does not send page content outside the extension.

## Risk Boundaries

Tampr is a code tool. User-authored JavaScript can change pages that match its
rules, and main-world execution can interact with page scripts more directly
than the default user-script world. Treat imported snippets like source code:
inspect them before enabling them on sensitive sites.

Tampr does not execute remote snippets or install code from a gallery in the V1
scope.

Tampr's script download API accepts either generated text or an http/https URL.
Both shapes share a validated relative filename (subpaths allowed under
Downloads, no parent segments or absolute paths) and an optional `saveAs`
choice. URL downloads are not scoped to the snippet's granted hosts, so a
snippet that calls `Tampr.download({ url })` can fetch any http/https resource
the service worker can reach. Treat URL-mode calls in imported snippets
accordingly.

Tampr imports only the native Tampr export format. Prototype data is not
converted automatically, which keeps the import path smaller and avoids silent
changes to execution behavior.
