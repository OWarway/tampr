# Tampr

Tampr is the lightweight, local-first Chrome extension for writing clear,
personal CSS and JavaScript browser mods.

The project is in active v2 development. The product and engineering direction
is captured in [the build spec](./docs/tampr-v2-build-spec.md).

## Development

Install dependencies and run the local quality gates:

```sh
npm install
npm run check
```

Build the unpacked Chrome extension:

```sh
npm run build
```

Load the generated `dist` directory from Chrome's extension developer mode. See
[the development guide](./docs/development.md) for the current workflow.

Tampr stores snippets locally and can export them as versioned JSON from the
workspace header. Imports are validated before they touch storage and merge by
stable snippet ID.

The current permission and runtime model is documented in
[Privacy And Security](./docs/privacy-security.md).
