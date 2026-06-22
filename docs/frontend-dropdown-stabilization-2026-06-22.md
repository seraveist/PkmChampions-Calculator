# Frontend Dropdown Stabilization - 2026-06-22

## Context

This note records the frontend dropdown fixes applied after the data/build
stabilization commit on `main`.

The focus was usability in the private-test frontend, especially calculator and
fine-tune comboboxes that were hard to use on mobile or cramped in narrow
containers.

## Changes

- Calculator dropdowns now support touch scrolling before option selection.
  - Replaced immediate `touchstart` selection with tap-vs-scroll handling.
  - Added vertical touch scrolling CSS for option lists.
- Calculator page comboboxes now use fixed portal positioning for constrained
  containers.
  - Covered Pokemon, move, move type, type override, nature, status, ability,
    item, form, weather, terrain, game type, and spikes layer controls.
  - Added top/bottom placement so low viewport space does not cut off lists.
  - Added per-type width contracts.
- Pokemon dropdown width was expanded for desktop/tablet layouts.
  - The Pokemon result table needs room for name, type, and six base stats.
  - The portal width still clamps to the viewport on small screens.
- Minimum-width nature dropdown behavior was tuned for very small windows.
  - The nature table should stay inside the viewport while keeping columns
    readable.
- Fine-tune opponent Pokemon dropdown now shows:
  - Pokemon
  - Type
  - Base Speed
- A dropdown contract test was added and wired into `npm test`.
  - `npm run ui:dropdowns`
  - `scripts/mobile-dropdown-contract.mjs`
- Fine-tune state tests now cover the opponent Pokemon speed column.

## Main Files

- `src/js/03-20-calc-combobox.js`
- `src/js/04-30-finetune.js`
- `src/styles/04-ui-foundation.css`
- `src/styles/05-calc-sample-layout.css`
- `src/styles/07-tools-redesign.css`
- `scripts/mobile-dropdown-contract.mjs`
- `scripts/fine-tune-state.mjs`
- `package.json`

Generated artifacts were refreshed:

- `pokemon-champions-calculator-v3.html`
- `dist/index.html` via `npm run build:pages`

## Validation

The following checks passed after the UI changes:

```text
npm.cmd run check
npm.cmd run build
npm.cmd run ui:dropdowns
npm.cmd run state:finetune
npm.cmd test
npm.cmd run build:pages
```

`npm.cmd test` includes:

- source syntax checks
- generated HTML structure checks
- CSS structure checks
- dropdown contract checks
- SPA/public readiness checks
- data validation
- dex smoke tests
- damage golden tests
- reverse golden tests
- entry-effect state tests
- fine-tune state tests

## Notes

- The simple Pokemon option renderer remains shared by matchup and reverse
  calculator views.
- Fine-tune opponent selection uses its own renderer so the new Speed column is
  scoped to the fine-tune opponent dropdown only.
- The browser-opened local file should be refreshed after build to pick up the
  generated HTML changes.
