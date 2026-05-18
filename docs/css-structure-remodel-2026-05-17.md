# CSS Structure Remodel 2026-05-17

This pass makes the CSS follow the HTML structure remodel without changing the feature surface. The intent is structural ownership, not a new visual design.

## Scope

- Preserve the current page layout, colors, controls, data hooks, and interactions.
- Give the new HTML hierarchy (`page-frame`, `ui-frame-*`, `ui-control-*`) stable CSS ownership.
- Move page-specific frame styling away from legacy structural selectors such as `.panel-head` and `.panel-body`.
- Keep semantic classes such as `.panel-title`, `.panel-tag`, `.dex-modal-title`, and page-specific component classes.

## Shared Structure

`src/styles/04-ui-foundation.css` now owns the shared structure vocabulary:

- `.page-frame`: page-level width and minimum sizing.
- `.ui-frame`: panel/modal/result shell contract.
- `.ui-frame-head`: frame header layout and radius.
- `.ui-frame-body`: frame body padding.
- `.ui-frame-row`: row-level structural wrapper.
- `.ui-control-frame`: repeated input/card/block unit.
- `.ui-control-grid`: grid control group.
- `.ui-control-row`: horizontal control group.
- `.ui-action-row`: command button group.
- `.ui-stat-grid`: stat table/grid boundary.
- `.ui-metric-row`: compact metric strip.

The shared frame tokens are:

- `--ui-frame-border`
- `--ui-frame-bg`
- `--ui-frame-radius`
- `--ui-frame-shadow`
- `--ui-frame-body-padding`
- `--ui-action-gap`
- `--ui-control-frame-gap`

## Page Ownership

Calculator styles now target `#page-calc .battle-grid > .ui-frame` and frame children through `> .ui-frame-head` / `> .ui-frame-body`.

Dex styles now target the control frame as `#page-dex .dex-control-panel.ui-frame`, and the detail modal frame through `.dex-modal .ui-frame-head` / `.dex-modal .ui-frame-body`.

Tool pages now use `.tool-page .ui-frame`, `.tool-page .ui-frame-head`, and `.tool-page .ui-frame-body` for the panel shell. Repeated subframes for matchup, fine-tune, and reverse calculator share a central selector:

```css
.tool-page :where(.matchup-slot, .matchup-coverage-card, .ft-table-section, .ft-analysis-section, .rc-my-moves-panel, .rc-table-section, .rc-input-block)
```

## Button Hierarchy

The visual hierarchy remains the same, but the foundation layer now treats small clear/dismiss controls as a consistent icon-sized button family:

- `.matchup-slot-clear`
- `.matchup-move-clear`
- `.dex-modal-close`

Existing command classes remain intact:

- primary: `.btn-calculate`, `.rc-analyze-btn`
- secondary: `.btn-secondary`, `.ui-label-action`
- tab/mode: `.nav-tab`, `.dex-tab`, `.matchup-mode-btn`
- stat controls: `.ui-stat-button`, `.ft-rank-btn`, `.ft-ev-quick`

## Verification

CSS structure is checked with:

```powershell
npm.cmd run css:structure
```

The script verifies:

- required structure selectors exist in CSS
- shared frame tokens exist
- calculator, dex, and tool pages target the new structure classes
- page CSS no longer uses legacy structural frame selectors (`.panel-head`, `.panel-body`, `.dex-modal-head`, `.dex-modal-body`)
- generated HTML still contains the key structure classes

The full test command includes this check:

```powershell
npm.cmd test
```
