# Security Policy

Tampr modifies web pages with user-authored CSS and JavaScript, so security
reports are taken seriously even while the project is pre-release.

## Supported Versions

Tampr is in active pre-1.0 development. Security fixes target `main` until the
first public release line exists.

## Reporting A Vulnerability

Do not open a public issue for a vulnerability.

Once the GitHub repository is public, use GitHub private vulnerability reporting
or security advisories for the repository. Until then, report privately to the
maintainer before public disclosure.

Helpful reports include:

- A clear description of the issue.
- Steps to reproduce.
- Affected Chrome version and operating system.
- Whether the issue requires a malicious snippet, a malicious web page, or only
  normal user actions.
- Any suggested mitigation.

## Security Boundaries

Expected behavior:

- User-authored snippets can modify pages that match their rules.
- Main-world snippets can interact with page scripts more directly than the
  default user-script world.
- Imported snippets should be treated like source code and reviewed before use.

Out of scope:

- Reports that require installing untrusted snippets and then observing those
  snippets behave as authored.
- Browser or Chrome extension platform vulnerabilities outside Tampr's control.

In scope:

- Tampr requesting broader permissions than intended.
- Tampr running snippets on pages that do not match their rules.
- Tampr importing malformed data that bypasses validation.
- Tampr leaking local snippet data outside extension storage or user-triggered
  export.
