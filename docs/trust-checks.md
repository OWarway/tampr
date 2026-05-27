# Trust Checks

Use this checklist when changing storage, import/export, runtime registration,
permissions, or release packaging. It keeps Tampr's local-first promise visible
while the app is still moving quickly.

## Backup Decision

V1 uses manual JSON export only. Automatic backups are explicitly deferred.

That keeps Tampr lightweight because it avoids scheduled background work, extra
backup state, and quiet writes outside the user's immediate action. The
workspace export button is the supported backup path for now. Tampr declares
`downloads` because workspace export and the user-script-world
`Tampr.download()` API both need dependable browser download creation. Workspace
export still falls back to the in-page object URL path when the browser downloads
API is unavailable.

Revisit automatic backups only if users need it enough to justify:

- A clear opt-in setting.
- A predictable backup filename and conflict strategy.
- Tests around backup timing and failure states.
- UI that shows when the last backup succeeded or failed.

## Manual Data Checks

Before release, exercise:

- Export an empty workspace and confirm the JSON envelope is `format: "tampr"`.
- Export from the workspace and confirm the browser download path succeeds.
- Export multiple snippets and confirm folder, CSS, JavaScript, match rules, run
  timing, world, enabled state, and timestamps are present.
- Import a valid Tampr export into an empty workspace.
- Import a valid Tampr export over existing snippets and confirm matching IDs are
  replaced while unrelated snippets remain.
- Import malformed JSON and confirm the workspace shows a user-facing error.
- Import non-Tampr JSON and confirm storage is unchanged.
- Confirm exports do not contain host permission grants, account identifiers, or
  browser state.

## Manual Runtime Checks

Before release, exercise:

- Fresh install with User Scripts enabled.
- Fresh install with User Scripts disabled.
- User Scripts disabled state shows setup actions in the popup and workspace,
  and opens Tampr's Chrome extension details page.
- Extension startup after Chrome restart.
- Create, edit, enable, disable, duplicate, and delete snippet flows.
- Create snippets in at least two folders and confirm the rail groups them into
  collapsible sections.
- Collapse a folder section, reopen the workspace, and confirm the collapsed
  state is retained.
- Rename a folder from the rail and confirm its snippets move under the new
  section without changing their code.
- Delete a non-General folder from the rail and confirm its snippets move back
  to General.
- Edit a saved snippet's folder and confirm it auto-saves and moves groups
  without saving unrelated unsaved code edits.
- A matching CSS snippet on `https://example.com`.
- A matching JavaScript snippet in the default user-script world.
- The extension badge shows the number of snippets that ran on a matching page
  and clears after navigating the tab away.
- A default user-script world snippet that calls
  `Tampr.download({ filename: 'tampr-test.txt', text: 'ok' })`.
- A default user-script world snippet that calls
  `Tampr.download({ filename: 'tampr-test.bin', url: 'https://...' })` against
  an http or https resource and confirms the file lands in Downloads.
- A `Tampr.download()` call with a relative subpath filename (e.g.
  `Tampr/test.txt`) and confirm Chrome creates the subfolder under Downloads.
- A `Tampr.download()` call with a `file://`, `data:`, or `chrome://` URL and
  confirm the script receives a validation error.
- A main-world JavaScript snippet after intentionally choosing `MAIN`.
- Host access granted after save.
- Host access denied after save.
- Invalid match rules in the workspace.
- A saved snippet with no CSS or JavaScript.

## Manual Permission Checks

Before release, verify:

- The popup opens on `https://` pages and shows current-page status.
- The popup treats `chrome://` pages as unsupported.
- Opening the workspace from the popup carries only the sanitized page origin and
  path context.
- Saving a snippet requests host access for its match rules.
- Denying host access leaves the snippet saved but not registered.
- The manifest `downloads` permission is explained by workspace export and the
  constrained `Tampr.download()` API, not by automatic background behavior.
- The workspace trust strip explains local data, runtime state, and host access.

## Known Limits For V1

- No accounts, cloud sync, telemetry, or hosted snippet gallery.
- No automatic backups.
- No cross-browser support before Chrome is dependable.
- No imported prototype data conversion.
- No incognito-only snippet setting yet.
