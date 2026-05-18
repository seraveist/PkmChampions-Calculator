# Public Readiness 2026-05-17

This note records the public-page hardening pass for the single HTML SPA.

## Goal

Make the generated app feel safe to publish as a real static page, without changing the product scope or splitting the app into multiple HTML pages.

## Changes

- Added public-facing `<head>` metadata:
  - description
  - application name
  - theme color
  - color scheme
  - robots policy
  - Open Graph summary metadata
  - Twitter summary metadata
  - inline SVG favicon
- Kept a single app shell, but changed landmark structure:
  - `main#appContent.app-content` is the only main landmark.
  - Each page is now a `section.page.page-frame` tab panel.
- Added a skip link to `#appContent`.
- Added a `noscript` notice for non-JavaScript environments.
- Added Korean accessible labels for ad rails.
- Added `aria-labelledby` wiring to the dex detail dialog.
- Added a party preset backup note so users know browser-local data should be exported before device/browser resets.
- Added shared tab keyboard behavior:
  - Arrow keys move between tabs.
  - Home/End jump to the first/last tab.
  - Main page tabs, dex tabs, and matchup mode tabs share the same helper.
- Added hash activation for main pages:
  - `#calc`
  - `#revcalc`
  - `#finetune`
  - `#matchup`
  - `#dex`
- Added public deploy preparation:
  - `npm.cmd run build:public`
  - `dist/index.html`
  - `dist/deploy-manifest.json`

## Verification

Run:

```powershell
npm.cmd run public:ready
```

The check verifies:

- public metadata exists in the template and generated HTML
- the generated static DOM has one main landmark
- the skip link and target exist
- page panels remain wired to nav tabs
- tab keyboard/deep-link runtime helpers are bundled
- the party preset backup note is bundled
- ad rails and dex modal expose accessible labels/title wiring

The full suite includes this check through:

```powershell
npm.cmd test
```
