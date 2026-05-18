# Reverse Calculation Plan

This document evaluates the proposed reverse-engineering prompt for the existing Pokemon Champions Calculator codebase.

## Current Status

The project already has a reverse calculation page and implementation in `src/js/04-4x-revcalc-*.js`.

Existing pieces:

- `revCalcState`: stores the user's Pokemon, target Pokemon, observed percentages, field, and candidate items.
- `rcMatchingRolls()`: counts matching 16 damage rolls.
- `rcStage1Defense()`: searches target HP plus Defense or Sp. Def investment from damage dealt to the target.
- `rcStage3OffenseRefine()`: combines defensive candidates with target Attack or Sp. Atk plus item candidates from damage received.
- `rcStage3OffenseOnly()`: searches offense candidates when only received damage is provided.
- `rcAnalyze()`: coordinates one-sided or two-sided reverse calculation.

The current feature is therefore not a blank slate. The proposed prompt should be treated as a product and algorithm spec for upgrading the existing reverse calculation page.

## Compatibility Assessment

### Good Fit

The following parts fit the current architecture well:

- Brute-force search over Champions investment points.
- Per-stat cap `0..32`.
- Total cap `sum <= 66`.
- 16-roll matching and hit count.
- Cross-validation between damage dealt and damage received.
- Candidate item inference.
- Template naming from remaining points.

### Required Corrections

The proposed stat formula should not be imported as-is.

Current project formula in `calcStats()`:

- HP: `floor((2 * base + 31 + point * 2) * 0.5) + 60`
- Other stats: `floor((2 * base + 31 + point * 2) * 0.5) + 5`, then nature modifier

The proposed formula:

- HP: `base + 75 + point`
- Other stats: `floor((base + 20 + point) * nature)`

These are close in spirit but not equivalent. The reverse calculator must reuse `calcStats()` and `calculateDamage()` instead of duplicating formulas.

The proposed damage formula is also simplified compared with the current staged engine. The project already handles:

- move base power metadata
- attack and defense stage overrides
- type-changing moves and abilities
- weather and terrain
- STAB, type effectiveness, screens, spread damage, critical hits
- item and ability modifiers
- fixed damage, OHKO, multihit

Reverse calculation should call `calculateDamage()` for every candidate rather than implementing a separate damage formula.

### Input Semantics To Clarify

Current `rcMatchingRolls()` matches observed remaining HP percent:

`floor((maxHp - damage) / maxHp * 100) === observedPct`

The proposed prompt says observed damage percent. These are different.

Planned UI should support an explicit mode:

- Remaining HP percent
- Damage percent

For damage percent, matching should be:

`floor(damage / maxHp * 100) === observedPct`

For remaining HP percent, keep the current behavior.

## Determinism Policy

The prompt asks for 100 percent logical inference. That is an excellent goal, but the implementation should be honest about ambiguity.

The calculator can be deterministic in the sense that:

- it exhaustively enumerates all legal candidates;
- it excludes all impossible candidates;
- it labels unique survivors as confirmed.

It should not claim a unique answer when multiple legal spreads remain. In those cases it should return all surviving groups, sorted by probability and plausibility.

## Proposed Algorithm

### Candidate Model

Use a normalized candidate object:

```js
{
  hpEv,
  defEv,
  spdEv,
  atkEv,
  spaEv,
  speRemaining,
  nature,
  ability,
  item,
  observedMatches: {
    dealt: 0,
    received: 0,
  },
  score,
  tags: []
}
```

### Roll Matching

For every candidate:

1. Build a side state with candidate EVs, nature, ability, and item.
2. Call `calculateDamage()`.
3. Compare all 16 rolls against the observed percent.
4. Store hit count.

Probability groups:

- strong: hit count `3..16`
- possible: hit count `1..2`
- impossible: hit count `0`

### Cross Validation

When both dealt and received observations exist:

1. Generate defensive candidates from dealt damage.
2. Generate offensive candidates from received damage.
3. Join candidates by target Pokemon, nature, item, and total EV legality.
4. Filter `hp + def/spd + atk/spa <= 66`.
5. Derive remaining points for speed or secondary bulk.

### H Priority

Use H-priority as a soft sort, not a hard filter:

- `hpEv >= defEv` or `hpEv >= spdEv`: add a plausibility bonus.
- If a non-H-priority spread is the only legal match, keep it.

### Template Mapping

Map candidates to template labels:

- `CS attacker`: high Sp. Atk plus likely Speed remainder.
- `AS attacker`: high Attack plus likely Speed remainder.
- `HB physical wall`: HP plus Defense focus.
- `HD special wall`: HP plus Sp. Def focus.
- `mixed bulk`: HP plus both defensive sides possible.
- `bulky attacker`: offense plus HP/bulk investment.
- `speed-flex`: remaining points strongly imply Speed investment.

Template mapping should be descriptive, not treated as proof unless only one legal allocation remains.

## Implementation Plan

### Phase 1. Refactor Existing Reverse Calc Core

- Keep reverse calculation helpers isolated in `src/js/04-4x-revcalc-*.js`; future cleanup should separate pure candidate generation from rendering inside that module.
- Keep UI rendering separate from candidate generation.
- Replace ad hoc result shape with a stable candidate model.
- Add `observedMode`: `remainingHpPct` or `damagePct`.

### Phase 2. Improve Search Completeness

- Search legal nature candidates more systematically.
- Search candidate abilities where relevant, not just the default ability.
- Expand item candidates from metadata:
  - no item
  - type boosters
  - stat boosters
  - damage boosters
  - defensive berries
  - Focus Sash and recovery items where useful
- Preserve Champions cap rules: per stat max 32, total max 66.

### Phase 3. Scoring And Grouping

- Add hit-count buckets.
- Add H-priority bonus.
- Add total-EV and practical-template sorting.
- Group identical visible conclusions, for example same item and same effective stat ranges.

### Phase 4. Output UX

Output sections should be:

- Data analysis summary
- Likely template judgment
- Strategic implications

For ambiguous results, show:

- unique confirmed fields;
- candidate ranges;
- remaining unknowns.

### Phase 5. Tests

Add a dedicated script:

```powershell
npm run reverse:golden
```

Test cases:

- one-sided defensive reverse calculation
- one-sided offensive reverse calculation
- full cross-validation
- ambiguous multi-candidate case
- impossible observation
- damage percent vs remaining HP percent
- item inference case
- total EV cap rejection

## Feasibility

This is feasible and aligns well with the project direction.

Recommended next step:

1. Keep the existing reverse calculation UI.
2. Refactor the reverse calculation algorithm to reuse the current dataized damage engine.
3. Add explicit observed percent mode.
4. Add deterministic candidate grouping and template labeling.
5. Add golden tests before expanding UI polish.

## 2026-05-15 Implementation Update

The reverse calculator has moved from the old layered prototype toward a more explicit cross-validation model.

Implemented:

- `observedMyPct` was renamed to `observedMyHp`.
- My HP observation is now treated as a raw remaining HP value.
- Opponent HP observation remains a remaining HP percent.
- Nature candidates are selected from the opponent's used move category.
- Defensive candidates and offensive candidates are generated separately, then joined.
- The old defensive/offensive fixed nature lists were removed.
- Candidate grouping now compresses near-identical random-roll results.
- Result rows now separate observed possible ranges from role-based 66-point completion estimates.
- `scripts/reverse-golden.mjs` was added and wired into `npm.cmd test`.

Current product rule:

- The observed range is the logically surviving range.
- The completed spread is an inferred representative spread, not a confirmed result.
- UI wording should continue to preserve that distinction.

Most recent manual simulations are documented in:

- `docs/current-handoff-2026-05-15.md`
- `docs/reverse-calculation-handoff-2026-05-15.md`

## 2026-05-14 Planning Update

The reverse calculator should be handled after the team synergy table pass.

Current product decisions:

- Keep the feature scoped to Pokemon Champions rules.
- Reuse `calcStats()` and `calculateDamage()`; do not introduce a second damage formula.
- Preserve the Champions point rules: per stat `0..32`, total `<= 66`.
- Treat "100 percent inference" as exhaustive logical filtering, not as a guarantee that the result is unique.
- If multiple legal spreads remain, group and rank them instead of hiding ambiguity.

Important UI decision:

- The observed value must explicitly say whether it is damage percent or remaining HP percent.
- Existing reverse calculation behavior is closer to remaining HP percent matching.
- Damage percent mode should use `Math.floor(damage / maxHp * 100)`.
- Remaining HP percent mode should use `Math.floor((maxHp - damage) / maxHp * 100)`.

Recommended implementation sequence:

1. Add a dedicated reverse calculation state/golden script before changing the UI.
2. Extract candidate generation helpers from the large views file when practical.
3. Normalize candidate objects around HP, defense side, offense side, item, nature, hit count, and tags.
4. Implement one-sided defensive inference first.
5. Implement one-sided offensive inference second.
6. Add cross-validation with `offense + HP + defense <= 66`.
7. Add H-priority as a soft scoring bonus.
8. Add grouped result summaries and template labels.

The next handoff document for current branch status is `docs/current-handoff-2026-05-14.md`.

## 2026-05-14 Implementation Status

The feature has now been renamed from `내구 역계산` to `형태 역계산`.

Current implementation direction:

- Opponent HP observation is entered as remaining HP percent.
- My HP observation is entered as remaining raw HP value.
- Speed observation is included through turn order, with scarf inference planned as part of the same candidate filter.
- Turn accumulation is intentionally excluded from the current scope.
- The implementation should infer a one-turn form candidate set from defense, offense, and speed constraints, then filter by the Champions `<= 66` total point rule.

Known blocking bug:

- The live UI currently reports zero candidates for the Primarina vs Archaludon validation scenario.
- The debug line reports `내구후보 0`, so the first defensive candidate stage is failing before cross-validation.
- A direct engine-style check can produce candidates for the same mathematical scenario, which points to DOM/state synchronization or stale legacy state rather than an impossible formula.

Detailed repro and TODO are recorded in `docs/form-reverse-handoff-2026-05-14.md`.
