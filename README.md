# Pokemon Champions Calculator

Pokemon Champions Reg.A rule set for damage calculation, matchup review, dex browsing, fine tuning, and reverse durability calculation.

The app is built as a single static HTML file, so it can be opened directly in a browser after running the build script. Core Pokemon data comes from local Pokemon Showdown-format files under `data/`, with Champions overrides in `data/mods/champions/` and Korean name/description caches in `data/ko/`.

## Quick Start

```bash
npm ci
npm run build
```

Open `pokemon-champions-calculator-v3.html` in a browser.

On Windows PowerShell, if `npm` is blocked by the local execution policy, run the same commands with `npm.cmd`:

```powershell
npm.cmd ci
npm.cmd run build
```

## Public Deploy

For a static host that expects an `index.html`, run:

```bash
npm run build:public
```

On Windows PowerShell:

```powershell
npm.cmd run build:public
```

This rebuilds the app and writes deploy-ready files to `dist/`:

| Path | Purpose |
| --- | --- |
| `dist/index.html` | Static app entrypoint for hosting. |
| `dist/deploy-manifest.json` | Build metadata for the deploy artifact. |

Upload the contents of `dist/` to the static host. The app is a single static HTML SPA and does not require server-side routing.

After the final public URL is known, add a canonical URL and `og:url`/`og:image` metadata if social sharing previews are needed.

## Scripts

| Command | Description |
| --- | --- |
| `npm run build` | Rebuilds the standalone calculator HTML. |
| `npm run build:public` | Rebuilds the app and prepares `dist/index.html` for static hosting. |
| `npm run prepare-public` | Copies the latest generated HTML to `dist/index.html`. |
| `npm run check` | Runs `node --check` against build scripts and source JavaScript. |
| `npm run html:structure` | Checks static HTML hierarchy, tab wiring, and button contracts. |
| `npm run css:structure` | Checks CSS ownership for shared structure classes. |
| `npm run spa:hosting` | Checks the generated single-file SPA hosting contract. |
| `npm run public:ready` | Checks public-page metadata, landmark, skip link, and accessibility shell contracts. |
| `npm test` | Runs syntax checks, build, structure checks, data validation, smoke checks, and golden tests. |
| `npm run sync-data` | Fetches the tracked Pokemon Showdown data files into `data/`. |
| `npm run sync-data:dry` | Checks upstream data changes without writing files. |
| `npm run fetch-ko` | Refreshes Korean name and description caches from PokeAPI CSV data. |

## Project Layout

| Path | Purpose |
| --- | --- |
| `src/calc-template.html` | Static HTML template used by the build. |
| `src/styles/` | CSS files concatenated into the final HTML. |
| `src/js/` | Browser JavaScript files concatenated into the final HTML. |
| `data/` | Base Pokemon Showdown data and generated Korean cache files. |
| `data/mods/champions/` | Champions-specific data overrides. |
| `scripts/` | Data sync, Korean cache refresh, and local validation scripts. |
| `dist/` | Ignored deploy output produced by `npm run build:public`. |

## Validation

Before opening a pull request or pushing changes to `main`, run:

```bash
npm test
```

GitHub Actions also runs the same syntax check and build on pushes and pull requests.
