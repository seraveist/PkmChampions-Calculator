# CSS architecture contract

## Cascade layers

`scripts/css-layer-contract.mjs` defines the build and audit order:

`reset -> tokens -> base -> components -> layouts -> pages -> utilities -> themes -> responsive`

The remodeled UI uses the first six layers. The last three remain reserved for build compatibility; there is no late `themes.css` or `responsive.css` override sheet. Each component or page owns responsive declarations in the same file as its base rules.

## Shared owners

| Owner | Responsibility |
| --- | --- |
| `00-tokens.css`, `tokens/` | Smart Rotom colors, light/dark variables, typography and geometry tokens |
| `components/00-controls.css` | Buttons, inputs, selects, icons, chevrons, search, focus, dialogs |
| `components/primitives.css` | Panels, headings, actions, common layout primitives and `ui-data-table` typography |
| `components/participants.css` | Pokémon identity, attributes, six-column stats, HP and field controls |
| `components/pickers.css` | Shared option rows and Pokémon/move/nature columns |
| `components/settings-dialogs.css` | Calculator condition-dialog layout |
| `components/party-presets.css` | Party editor layout |
| `layouts/shell.css` | Header, navigation, content width and advertising rails |

`RotomUI` and `uiStatTable()` produce shared markup. `uiWirePickerDialog()` owns searching, filtering, keyboard selection, IME handling, focus return and native dialog behavior. Menu code supplies data and state updates. It must not create an independent picker or redraw common controls with another style hierarchy.

Variants use component classes and custom properties. Page-specific sizing is allowed, but the same selector/property must not gain another unconditional owner within or across components, layouts and pages. The native `[hidden]` display invariant is the sole `!important` declaration.

## Page owners

| Page | Scope | Stylesheet |
| --- | --- | --- |
| Damage calculator | `#page-calc` and its named result/field components | `pages/calculator.css` |
| Reverse calculator | `#page-revcalc`, `rc-*` | `pages/reverse.css` |
| Fine tune | `#page-finetune`, `ft-*` | `pages/finetune.css` |
| Matchup | `#page-matchup`, `matchup-*` | `pages/matchup.css` |
| Dex | `.dex-surface`, `dex-*` | `pages/dex.css` |

Dex page, full-page detail and detail dialog share `.dex-surface`. The search picker uses one native dialog and does not depend on being a descendant of a menu root. Removed portal classes and old stat-editor selectors must not be reintroduced.

## Required checks

- `npm run css:structure`: canonical owners, compact page sheets, one media block per condition/file, centralized palette, CSS budget and absence of late override sheets.
- `npm run css:cascade`: duplicate unconditional selector/property ownership, responsive rules shadowed by later base owners, structural theme declarations and raw controls in final layers.
- `npm run html:structure` and `npm run ui:dropdowns`: semantic structure, static references and shared picker contracts.
- `npm run ui:browser:pages -- --require-browser`: actual shared control sizes, document overflow, references, keyboard behavior and light/dark accessibility across all five pages.

Static checks are part of `npm test`. These checks detect explicit duplicate ownership and exercised runtime defects; they do not replace visual review of changed states.
