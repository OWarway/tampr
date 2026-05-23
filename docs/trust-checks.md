# Trust Checks

Use this checklist when changing storage, import/export, runtime registration,
permissions, or release packaging. It keeps Tampr's local-first promise visible
while the app is still moving quickly.

## Backup Decision

V1 uses manual JSON export only. Automatic backups are explicitly deferred.

That keeps Tampr lightweight because it avoids scheduled background work, extra
backup state, and quiet writes outside the user's immediate action. The
workspace export button is the supported backup path for now. Export can request
optional `downloads` access to use the browser downloads API, and falls back to
the in-page object URL download when access is denied or unavailable.

Revisit automatic backups only if users need it enough to justify:

- A clear opt-in setting.
- A permission explanation for browser downloads.
- A predictable backup filename and conflict strategy.
- Tests around backup timing and failure states.
- UI that shows when the last backup succeeded or failed.

## Manual Data Checks

Before release, exercise:

- Export an empty workspace and confirm the JSON envelope is `format: "tampr"`.
- Export with optional downloads access granted and confirm the browser download
  path succeeds.
- Export with optional downloads access denied and confirm the fallback download
  path succeeds.
- Export multiple snippets and confirm CSS, JavaScript, match rules, run timing,
  world, enabled state, and timestamps are present.
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
- Extension startup after Chrome restart.
- Create, edit, enable, disable, duplicate, and delete snippet flows.
- A matching CSS snippet on `https://example.com`.
- A matching JavaScript snippet in the default user-script world.
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
- Workspace export requests optional downloads access only from the export
  action.
- The workspace trust strip explains local data, runtime state, and host access.

## Known Limits For V1

- No accounts, cloud sync, telemetry, or hosted snippet gallery.
- No automatic backups.
- No cross-browser support before Chrome is dependable.
- No imported prototype data conversion.
- No incognito-only snippet setting yet.
