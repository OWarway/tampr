# Tampr

Tampr is the lightweight, local-first Chrome extension for writing clear,
personal CSS and JavaScript browser mods.

The project is in its foundation phase. The product and engineering direction is
captured in [the build spec](./docs/tampr-v2-build-spec.md).

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
