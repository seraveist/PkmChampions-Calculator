# Public site finalization

This change closes the public-site review's party backup and storage issues. It
keeps the calculator's policies and layout, static hosting, module build and all
reverse-calculation algorithms unchanged. No explanatory text is added to the
power/damage results. A compact footer provides the data regulation/date, an
unofficial fan-tool notice and links to calculation policy, upstream data and
issue reporting.

## Party backups

- JSON imports accept the current `pokechamps-lab-party-presets` v1 format, the
  previous `{parties}` / `{version:1, parties}` records and `{data:{parties}}`
  wrappers. UTF-8 BOM files are supported.
- Unsupported format/version, empty top-level party arrays, malformed nested
  objects, oversized lists, invalid values and unknown current-data IDs are
  rejected before changing memory or storage. File input is limited to 1 MiB.
- A valid empty-party backup remains importable, with an explicit empty-data
  warning in the confirmation. Normal EV caps and default fields are preserved.
- JSON restore explicitly confirms replacement of **all** parties. Showdown
  import confirms replacement of the selected party; other parties are kept.
- Confirmation is a native modal with Cancel focused by default and Escape
  cancellation. File reading and confirmation use a single import lock.
- Before an accepted import, a normalized copy of the current parties is kept
  as one undo snapshot. It is not an unlimited history and is not exported in
  ordinary JSON backups. Undo also asks for confirmation because subsequent
  edits will be replaced.

## Storage and recovery

The existing localStorage key `pkmChampions.partyPresets.v1` remains unchanged.
The value still contains `version` and `parties`; optional `previousImport`
contains the preceding party snapshot. Both are stored in **one** `setItem`
operation, avoiding partial two-key saves. Earlier readers ignore the additional
field. The undo snapshot survives reload after a successful write.

Saving returns a boolean. Failure preserves the current in-memory edits, keeps
the previous durable record and displays a persistent warning advising JSON
backup. Transient success messages cannot hide this warning. A later successful
save clears it. Failed writes do not claim durable import success.

If storage cannot be read or the active record is malformed/uses an unsupported
version, automatic writes are blocked rather than replacing the original with
empty defaults. Confirmed import can replace that unreadable record; the prompt
explicitly warns that the unreadable raw record is not covered by undo. This is
single-browser storage, not account/cloud synchronization.

## Tests

`npm run party:safety` exercises malformed/legacy backups, confirmation cancel,
blank data, one-write persistence, reload/undo, quota and read failures, import
serialization, Showdown restore and malformed hash fallback. It is included in
`npm test` through `state:party`.

`modules-browser.mjs` additionally runs `party-storage-browser-checks.mjs` against
uninstrumented production and offline output: native confirmations, real reload,
file input, Escape cancellation, simulated quota errors, persistent warnings,
undo, Showdown confirmation and the footer at 320/1440px. The existing permanent
CI invokes these production/offline checks; no test-only runtime hooks are added.

The footer date is the repository's current M-C baseline, **2026-09-09**, not the
build date. Update it alongside the declared regulation in future data updates.
