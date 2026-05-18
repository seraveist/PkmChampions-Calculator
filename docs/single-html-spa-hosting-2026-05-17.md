# Single HTML SPA Hosting 2026-05-17

This project will keep the current single HTML static SPA structure.

The hosted artifact is:

```text
pokemon-champions-calculator-v3.html
```

For hosts that expect an entrypoint named `index.html`, run:

```powershell
npm.cmd run build:public
```

That command writes the deploy-ready entrypoint to:

```text
dist/index.html
```

## Decision

Keep one generated HTML document that contains:

- static app shell and page frames
- public page metadata and a single main landmark
- inline CSS
- inline JavaScript
- embedded JSON data scripts
- tabbed pages for calculator, reverse calculator, fine-tune, matchup, and dex

Do not split the app into page-specific HTML files at this stage.

## Why This Fits

The app is a tightly connected calculator workspace rather than a content site. The pages share state and actions:

- calculator sides can open fine-tune or reverse calculator flows
- fine-tune can apply a setup back to calculator attacker or defender
- dex detail actions can apply Pokemon, moves, and items to calculator fields
- party presets can feed calculator, fine-tune, reverse calculator, and matchup
- matchup uses the same Pokemon, move, and type data as the other tools

A single document keeps these cross-page workflows simple because the app shares one runtime, one data bundle, and one set of DOM targets.

## Hosting Contract

The generated HTML should remain deployable on any static host that can serve a plain `.html` file.

Required contract:

- `pokemon-champions-calculator-v3.html` is a complete HTML document.
- The file has no unresolved build placeholders.
- CSS and JavaScript are inlined by the build.
- JSON data scripts parse successfully.
- Main pages exist in the same document as tab panels:
  - `page-calc`
  - `page-revcalc`
  - `page-finetune`
  - `page-matchup`
  - `page-dex`
- Main navigation controls those pages through `aria-controls`.
- The generated static DOM has one `main#appContent` landmark; page frames are tab panel sections.
- `#calc`, `#revcalc`, `#finetune`, `#matchup`, and `#dex` open the corresponding page.
- `dist/index.html` can be prepared from the generated artifact for static hosts that need `index.html`.
- Global overlays remain in the same document:
  - `dexDetailModal`
  - party preset modal/picker rendered from JavaScript
- The generated file must not include local-only URLs such as `file://`, `localhost`, `127.0.0.1`, or local filesystem paths.

## What Not To Do Yet

Avoid page-specific HTML files for now:

- `calc.html`
- `dex.html`
- `matchup.html`
- `finetune.html`
- `revcalc.html`

That split would require a larger state and routing redesign. Each page would need isolated initialization, shared data loading, cross-page state transfer, and defensive checks for missing DOM targets.

## Better Next Optimizations

If hosting or performance needs improve later, prefer these before page-level HTML splitting:

1. Keep `index.html` or `pokemon-champions-calculator-v3.html` as the app shell.
2. Move CSS to an external hashed asset.
3. Move JavaScript to an external hashed asset.
4. Move large JSON data into cacheable data files.
5. Keep the same tabbed SPA runtime and page-frame structure.

This path improves caching and content security policy compatibility without breaking cross-tool workflows.

## Verification

Run:

```powershell
npm.cmd run spa:hosting
```

The check verifies:

- generated HTML exists and is complete
- CSS/JS/data have been injected
- data JSON scripts parse
- no build placeholders remain
- no local-only URLs are present
- main tab/page wiring exists
- shared workflow hooks remain in the generated app

The full test suite includes this check:

```powershell
npm.cmd test
```

Public-page metadata, landmark, skip link, and tab keyboard checks live in:

```powershell
npm.cmd run public:ready
```
