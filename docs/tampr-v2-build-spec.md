# Tampr v2 Build Spec

Status: working agreement for the first open-source release.

## Product North Star

Tampr is the lightweight, local-first Chrome extension for writing clear,
personal CSS and JavaScript browser mods. It should make site customization feel
fast for experienced users without making the runtime, permissions, or data model
mysterious.

The first release should feel like a polished developer tool:

- Fast enough to use during normal browsing.
- Lightweight in install size, runtime footprint, and mental overhead.
- Calm and precise enough for code editing.
- Transparent about what runs, where it runs, and which permissions it needs.
- Easy to inspect, test, and contribute to as an open-source project.

## V1 Scope

V1 includes:

- A Manifest V3 Chrome extension built in strict TypeScript.
- A compact popup for the current page and active snippets.
- A full workspace for snippet creation and editing.
- User-authored CSS and JavaScript snippets.
- Match and exclude rules for deciding where snippets run.
- Enable, disable, duplicate, rename, delete, and search flows.
- Clear runtime and permission state, including User Scripts availability.
- Local storage, import, and export through a native Tampr payload format.
- A constrained `Tampr.download()` API for user-script world snippets to save
  generated text files or fetch http/https URLs through the browser downloads
  API.
- Automated tests, CI, docs, and release hygiene from the beginning.

V1 does not include:

- Accounts, cloud sync, or a hosted backend.
- A public snippet gallery or remote code execution.
- Cross-browser parity before the Chrome implementation is dependable.
- A visual no-code page builder.
- Large macro automation workflows that turn Tampr into a browser agent.

## Market Positioning

Tampr should not compete by becoming a smaller clone of every script and style
manager around it.

Its lane is:

- More transparent than a quick CSS or JavaScript injector.
- Lighter and calmer than a full userscript ecosystem manager.
- More code-native than a visual site-style editor.
- More polished and trustworthy than a hobby snippet popup.

That positioning makes runtime clarity part of the product. Tampr should make it
easy to answer:

- What is running on this page?
- Which rule made it match?
- Which permission or browser capability does it depend on?
- When does it run?
- Did Tampr accept the rule and register the snippet as intended?

V1 should stand out through a focused current-page workflow, excellent rule
authoring, measured runtime weight, and open-source trust. It should avoid
chasing marketplaces, remote snippet installation, broad compatibility layers,
visual no-code editing, and cloud product features before its local editing and
execution model is superb.

## Product Principles

1. Local-first is a product feature, not a placeholder.
2. A snippet should be easy to understand from its editor screen alone.
3. Runtime truth should be explicit and recoverable after extension restarts or
   updates.
4. Permission requests should be narrow, explainable, and tied to user intent.
5. Power-user features should not make the common current-page workflow clumsy.
6. Open-source contributors should see clear boundaries and tests around risky
   behavior.
7. Lightweight is a selling point: dependencies, permissions, background work,
   and UI surfaces must earn their place.

## Lightweight Promise

Lightweight does not mean fragile or bare. It means Tampr stays focused:

- The popup opens quickly and answers the current-page question immediately.
- The runtime does no idle background churn beyond what the extension needs.
- The dependency graph stays reviewable and the shipped bundle stays visible.
- Features avoid turning local snippet editing into a cloud product by accident.
- The UI feels capable without carrying decorative or workflow weight users did
  not ask for.

## Engineering Quality Bar

These are project constraints:

- TypeScript is used for extension code.
- TypeScript runs in strict mode.
- Chrome API usage is kept behind typed boundaries where that improves tests and
  clarity.
- Stored data, imports, and migrations are runtime-validated.
- UI and service-worker messages have typed contracts.
- Each phase ends with passing tests, a buildable extension, and updated docs.
- New dependencies and runtime work are reviewed for shipped weight and product
  value.
- Version-control history stays readable through intentional, reviewable commits.
- Architecture stays as small as it can while remaining easy to evolve.

Lead-level quality here means dependable runtime behavior, honest tradeoffs,
clean ownership boundaries, useful tests, strong failure states, and a UI that
looks designed rather than accumulated.

## Version Control Discipline

The Git history should be part of the project's craft.

- Prefer small, coherent commits that tell the story of the work.
- Keep mechanical setup, product changes, tests, and docs grouped in ways that
  are easy to review.
- Use a linted commit-message convention from Phase 1 so contributors get fast
  feedback before history drifts.
- Keep AI attribution, AI trailers, and AI-specific commit wording out of commit
  messages for now.
- Do not hide risky work inside broad cleanup commits.

## Technical Direction

### Stack

Initial stack:

- TypeScript
- React for popup and workspace UI
- Vite for build tooling
- Vitest for unit and integration tests
- Playwright for browser and extension smoke tests
- ESLint and Prettier
- Zod or an equivalent schema layer for stored and imported data
- CodeMirror 6 for CSS and JavaScript editing

The service worker should stay direct and framework-light. React belongs in UI
surfaces, not in runtime orchestration. Stack choices should be checked against
bundle output as the product grows; a polished editor is worth weight that the
runtime and popup are not.

### Extension Runtime

Tampr v2 should be built around Chrome's current extension model:

- Manifest V3.
- A service worker for extension runtime events.
- `chrome.userScripts` for user-authored JavaScript.
- A separate CSS injection path for user styles.
- Rebuildable registration state derived from stored snippets.
- Permission and capability detection presented to the UI as explicit state.

The prototype proved the feature set, but v2 should not preserve its injection
model as the core runtime. The runtime layer should own snippet registration,
update, unregister, and recovery behavior.

### Suggested Source Layout

```text
src/
  background/
  chrome/
  domain/
  popup/
  runtime/
  shared/
  storage/
  workspace/
tests/
  e2e/
  integration/
  unit/
docs/
```

Responsibilities:

- `domain/` owns snippet models, match rules, import/export rules, and pure logic.
- `storage/` owns persistence and migrations.
- `runtime/` turns enabled snippets and capabilities into Chrome registrations
  and CSS runtime behavior.
- `chrome/` owns thin typed adapters around browser APIs where they remove test
  pain or API leakage.
- `popup/` and `workspace/` own UI surfaces.
- `shared/` holds UI-independent contracts shared across those boundaries.

## Data Model

Names are labels. IDs are identity.

The initial snippet model should support:

```ts
type Snippet = {
  id: string;
  name: string;
  enabled: boolean;
  matches: string[];
  excludeMatches: string[];
  css: string;
  js: string;
  runAt: 'document_start' | 'document_idle';
  world: 'USER_SCRIPT' | 'MAIN';
  createdAt: number;
  updatedAt: number;
};
```

Design notes:

- Store stable IDs so rename does not become delete-and-recreate behavior.
- Prefer arrays of match rules so one useful snippet can target several routes.
- Keep CSS and JavaScript optional in product behavior even if storage uses empty
  strings initially.
- Default JavaScript to the user-script world.
- Treat main-world execution as an advanced choice with clear consequences.
- Version exported data and persisted schemas before migrations become urgent.

## Permissions And Trust

Tampr modifies pages. That deserves a plain permission story.

Initial permission decisions:

- Use the narrowest required permission set for implemented features.
- Include `downloads` only because V1 supports workspace export and a
  user-script-world `Tampr.download()` API for generated text and validated
  http/https URLs.
- Prefer runtime host permission flows where they keep the product usable.
- Explain access state in onboarding, popup, docs, and store copy.
- Do not add future-facing permissions just because later features might need
  them.
- Keep remote code and hosted snippet execution out of V1.

Permission-denied and capability-disabled states must be designed. They are not
console-only errors.

## UX Direction

### Popup

The popup is a fast control surface for the current page.

It should contain:

- Current site and access state.
- Active snippets on this page.
- The matching rule or reason behind active snippet status.
- Fast enable and disable controls.
- Create/open actions that lead to the workspace.
- Clear unsupported, denied, disabled, loading, empty, and error states.

It should not be the main code editor.

### Workspace

The workspace is the primary product surface.

It should provide:

- A searchable snippet rail.
- A focused editor region with CodeMirror.
- CSS and JavaScript modes that make the current editing context obvious.
- Match and exclude rule editing with validation and preview.
- Simple rule presets for this page, this path, and this site.
- Run settings, execution-world controls, and enabled state.
- Import/export and data-management flows.
- Unsaved state, destructive-action confirmation, and useful errors.

The visual language should be restrained, high-signal, and unmistakably tool-like:
good typography, careful density, stable layout dimensions, polished interactive
states, fast surfaces, and no marketing-page filler inside the app.

## Testing Strategy

### Unit Tests

Cover pure behavior:

- Snippet validation and defaults.
- Match and exclude rule parsing.
- Import/export schemas.
- Storage migrations.
- Runtime registration plans.
- Badge and current-page status derivation.

### Integration Tests

Cover boundaries:

- Storage repositories.
- Typed message handlers.
- Runtime sync on create, edit, disable, enable, and delete.
- Permission and capability-state translation.
- Recovery from persisted data after service-worker restart assumptions.

### UI Tests

Cover product behavior:

- Popup active-page states.
- Workspace create, edit, search, rename, duplicate, and delete flows.
- Editor and match-rule validation behavior.
- Import/export surfaces.
- Empty, loading, denied, unsupported, and error states.

### Browser Smoke Tests

Use a test page and a loaded extension to prove:

- A matching CSS snippet changes the page.
- A matching JavaScript snippet runs through the supported user-script path.
- Disabled snippets stop affecting future loads.
- Edited rules update future behavior.
- Fresh-install onboarding reaches a useful state.

### Manual Release Matrix

Before release, exercise:

- Fresh install.
- Upgrade and migration.
- User Scripts disabled and enabled.
- Host access denied and granted.
- Normal browsing and incognito behavior when supported.
- Import/export round trip.
- Packaged release build.

## Build Phases

### Phase 0: Product And Engineering Spec

Deliverables:

- V1 product boundary.
- Architecture direction.
- Permission posture.
- Data model starting point.
- Testing bar.
- UI direction.

Exit gate:

- We can scaffold without arguing with ourselves about the product shape.

### Phase 1: Foundation

Deliverables:

- Extension scaffold with TypeScript, React, and Vite.
- Strict compiler, lint, formatting, test, and build commands.
- Commit-message linting and local commit hooks with contributor-friendly
  failure messages.
- CI gates for typecheck, lint, tests, and build.
- Manifest V3 skeleton.
- Folder boundaries and typed domain skeleton.
- Developer docs for loading the unpacked extension.

Exit gate:

- The empty extension builds, loads, and passes CI locally.

### Phase 2: Runtime Proof

Deliverables:

- Versioned snippet schemas.
- Storage repository.
- Snippet CRUD behavior at the domain layer.
- Match-rule validation.
- User Scripts availability and registration spike.
- CSS runtime spike.
- Permission-state model.
- Registration recovery path.
- Focused unit and integration tests around runtime sync.

Exit gate:

- One snippet reliably changes a matching test page through the intended v2
  runtime.

### Phase 3: Core Product UX

Deliverables:

- Polished popup.
- Polished workspace.
- CodeMirror integration.
- Create, search, edit, rename, duplicate, toggle, and delete flows.
- Match and exclude rule UI with feedback.
- Typed UI-to-runtime message layer.
- UI tests and extension smoke coverage for the core workflow.

Exit gate:

- Tampr is pleasant for daily local snippet work.

### Phase 4: Data And Trust

Deliverables:

- Import/export with versioned payloads.
- Native Tampr import/export only; prototype migration is out of scope.
- A validated script download API that accepts generated text or an http/https
  URL through `chrome.downloads.download`.
- Automatic backups explicitly deferred; manual export is the V1 backup path.
- Permission explanations and onboarding refinement.
- Privacy, security, and data-handling docs.
- User-facing error surfaces for common runtime failures.

Exit gate:

- Users can understand what Tampr stores, what it runs, and how to keep their
  snippets portable.

### Phase 5: Open-Source Release

Deliverables:

- README with screenshots, architecture summary, and development flow.
- License, contribution guide, security policy, and issue templates.
- Commit convention and contribution guidance that match the repository checks.
- Versioning and changelog workflow.
- Release packaging, store checklist, and manual trust checks.
- Release smoke run and known-limitations note.

Exit gate:

- A stranger can install, trust, inspect, and contribute to the project.

## Per-Phase Definition Of Done

For each phase:

- The intended deliverables exist.
- Relevant tests pass.
- Typecheck, lint, and build pass.
- Commits remain coherent and pass repository commit-message checks where the
  phase creates history.
- New dependencies, permissions, and runtime work still fit the lightweight
  promise.
- Error and empty states touched by the phase are represented.
- Docs reflect decisions made during the phase.
- Follow-up work is tracked instead of hidden in vague TODOs.

## Risks To Keep Visible

- Browser extension permissions can make a good runtime feel untrustworthy if the
  product does not explain them.
- User-script support and Chrome capability gates shape onboarding.
- Editing code in a popup will degrade the product quickly.
- Snippet matching, migrations, and runtime registration will become fragile if
  they are not kept typed and testable.
- A beautiful workspace does not compensate for a runtime users cannot predict.

## Initial Build Decision

Start with Phase 1 only after this spec is accepted. The first implementation
milestone is a clean extension skeleton with quality gates, not a rushed feature
port from the prototype.
