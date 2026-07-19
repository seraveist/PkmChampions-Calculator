# CSS architecture contract

## Cascade layers

The build and audits share `scripts/css-layer-contract.mjs` as the single source
of truth for this order:

`reset -> tokens -> base -> components -> layouts -> pages -> utilities -> themes -> responsive`

Every file named `responsive.css` or ending in `-responsive.css` belongs to the
final `responsive` layer. Folder placement and alphabetical filename order must
not decide whether a breakpoint rule wins.

## Ownership rules

- `components/` owns reusable geometry, typography, and interaction states.
- `layouts/` owns the application shell, header, navigation, and global modal layout.
- `pages/` composes components inside one page scope.
- `themes.css` owns semantic variables and visual colors only. It must not set
  geometry, spacing, typography metrics, or raw form-control structure.
- `responsive` rules adapt an existing owner. They must not introduce a second
  desktop/base owner.
- Portaled dropdowns use their portal classes (`calc-page-options-portal`,
  `tool-move-options-portal`) because they are no longer descendants of a page root.

## Page roots

| Page | Root | Page stylesheet owner |
| --- | --- | --- |
| Damage calculator | `#page-calc` | `pages/calculator-*` |
| Reverse calculator | `#page-revcalc` | `pages/03-reverse.css` |
| Fine tune | `#page-finetune` | `pages/02-finetune.css` |
| Matchup | `#page-matchup` | `pages/01-matchup.css` |
| Dex | `.dex-surface` | `pages/dex-*` |

The Dex page, full-page detail, and dialog all declare `.dex-surface`. Dynamic
Dex detail classes must use the `dex-` prefix so they cannot collide with the
matchup page or other feature bundles.

## Required checks

`npm run css:cascade` fails when any of these are introduced:

- the same selector/property has multiple unconditional owners in one layer;
- a later base rule shadows an earlier responsive declaration in the same layer;
- `themes.css` declares structural properties;
- `themes.css` or `responsive.css` styles raw input/select/textarea elements.

`npm test` includes this audit. `npm run ui:browser` additionally verifies the
computed layout at desktop/mobile widths and in light/dark themes.
