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

## Scripts

| Command | Description |
| --- | --- |
| `npm run build` | Rebuilds the standalone calculator HTML. |
| `npm run check` | Runs `node --check` against build scripts and source JavaScript. |
| `npm test` | Runs syntax checks and a full build. |
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

## Validation

Before opening a pull request or pushing changes to `main`, run:

```bash
npm test
```

GitHub Actions also runs the same syntax check and build on pushes and pull requests.
