# ES modules, direct builds and slot-level updates

## Scope

This second refactor continues `client-data-performance.md`. It changes four things:

1. Cache the four calculator move presentations by their calculation inputs.
2. Separate initial move-picker markup from subsequent presentation updates.
3. Build public assets directly from normalized data and source modules.
4. Convert all 39 files in `src/js/` to explicit ES module imports/exports.

Damage/power policies and reverse inference, ranking, forecasting, result transport,
and cache behavior are not redesigned. Reverse modules receive only the imports,
exports and explicit DOM binding needed by the module migration.

## Runtime

`src/main.js` starts the shared calculator and party modules. DOM binding functions
run after module evaluation, rather than implicitly while concatenating files.
Cross-module mutable values are updated with owner-defined setters; imports remain
live, read-only bindings. There is no application-global compatibility namespace
in production.

`src/runtime/features.js` registers four dynamic `import()` entrypoints in
`src/features/`. Core modules use each feature's explicit API instead of importing
optional implementations eagerly. Each feature's DOM bindings initialize once.
Public output includes native ESM entry/feature/shared chunks; the shared chunks
must be deployed along with the HTML, data, stylesheet and Worker.

The same source graph is bundled as a single IIFE for offline HTML. Dynamic feature
imports are bundled into promises without separate local-file module requests.
The existing offline JSON data adapter and Blob Worker remain available.

## Slot cache and rendering

The cache stores at most four presentation objects, never an unbounded history.
Keys include both editable and derived state, automatic-entry policy/ownership,
and all field settings, because the power index and actual damage have different
input policies. Attacker move IDs, power/type overrides, critical flags and hit
counts are keyed per slot. Other inputs invalidate all slots conservatively.

A warm, unchanged request performs no slot calculation. A move/slot-only change
recalculates that slot. Shared attacker/defender/field changes invalidate all four.
No heuristic omissions of damage-relevant fields or rounding changes are used.

`powerUiMovePresentation()` no longer builds the complete move picker.
`powerUiMovePickerMarkup()` is called only by initial/full row construction.
Normal updates retain the existing row, picker, settings button and focus.

## Build

- `scripts/build-game-data.mjs`: unchanged base/Champions/manual/localization rules,
  now exposed as a normalized data producer with no HTML intermediary.
- `scripts/build-artifacts.mjs`: shared source template, stylesheet, application
  bundling and Worker generation.
- `build.mjs`: offline output CLI.
- `scripts/build-public.mjs`: direct public/Pages/preview output CLI and API.

`npm run build:pages` does not read or regenerate the root standalone HTML.
Only source-template placeholders are replaced. Public game data is a separate
ES module, not an embedded HTML data block. Existing CSP, immutable asset cache
headers, 404 handling and three deployment modes are preserved.

Esbuild and Acorn are pinned build/dev dependencies. The bundle is readable and
tree-shaken, not aggressively minified. Startup/total size reporting must include
shared chunks, not just the small entry file. This change is not data secrecy.

## Validation

```sh
npm ci
npm test
npm run modules:browser -- --disable-browser-sandbox
node scripts/modules-browser.mjs --disable-browser-sandbox
npm run calculator:browser -- --require-browser --disable-browser-sandbox
npm run reverse:browser -- --require-browser --disable-browser-sandbox
```

The sandbox flag is for isolated CI only. Omit it for normal desktop use.

`modules:golden` verifies module syntax/ownership, optional-feature boundaries,
production absence of test hooks, and direct public builds with the standalone
artifact temporarily absent. `client:golden` compares cached and fresh actual
presentations through slot/common changes and checks initial-markup isolation.

Existing focused Node VM tests use a test-only source adapter in `source-utils.mjs`
to preserve their explicit stub/override contracts. Existing white-box browser
tests build a disposable, instrumented ESM graph and register writable bindings
through CDP before navigation. Instrumentation never enters normal `dist` or the
committed offline artifact. `modules-browser.mjs` separately tests uninstrumented
production builds using real UI actions, lazy navigation and the Worker protocol.

Excluded follow-ups remain: on-demand reverse-card forecasting, Worker-owned
candidate summaries, and reverse internal cache/algorithm optimizations.

## Browser interaction stability

Pointer tests use real CDP mouse events with viewport coordinates sampled only
once the target has remained stable and hit-testable for three animation frames.
Scrolling is completed before the first click; repeat clicks do not scroll away
an open anchored menu. Each toggle is checked against the actual popover,
`aria-expanded` and focus state, not a fixed 60 ms delay. There is no click retry
or automatic reopening after a failed assertion. The cross-menu suite exercises
ten consecutive toggles at both desktop and narrow widths in each deployment mode.
Native dialog close/focus restoration is also awaited by its observable condition.
The application choice-menu behavior itself is unchanged by this test correction.

The permanent CI now includes uninstrumented production/offline browser checks
and slot-cache browser contracts in addition to the existing all-menu checks.
