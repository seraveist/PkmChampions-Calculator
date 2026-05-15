# Form Reverse Calculator Handoff 2026-05-14

This document is the latest handoff note for the current `codex-refactor-handoff-20260508` branch. It focuses on the matchup table work that is now usable, and the current WIP state of the renamed form reverse calculator.

## Branch And Commands

- Branch: `codex-refactor-handoff-20260508`
- Main artifact: `pokemon-champions-calculator-v3.html`
- Build: `npm.cmd run build`
- Full local check: `npm.cmd test`
- Last known test state: `npm.cmd test` passed before this handoff update.

## Completed In This Branch Segment

### Type Matchup Table

- Rebuilt the matchup table into separate defense and coverage layers.
- Added meta threat data in `data/overrides/meta-threats.json`.
- Defense mode now focuses on score and right-side threat cards instead of raw immune/weak count columns.
- Defense scoring was adjusted toward type consistency:
  - weaknesses increase pressure;
  - resistances and immunities reduce pressure;
  - an immunity can be treated as breaking an opposing type's consistency even when the raw average would look high.
- Coverage mode now uses a type-by-type coverage table plus right-side meta target cards.
- Coverage target grading now uses Pokemon-by-Pokemon move ownership:
  - one Pokemon carrying three same-type attacks is weaker coverage than three different Pokemon each carrying one relevant attack.
  - 4x weaknesses are checked first.
  - If the 4x weakness is covered, the target is safe.
  - If not covered, 2x alternative coverage count decides `위험 / 주의 / 견제 / 안전`.
- Coverage target cards were tightened so weakness chips wrap naturally while the hit count stays fixed on the right.
- Pokemon search rows were simplified so long names do not get cut off:
  - removed extra total-stat text from the result row;
  - type pills are aligned on the right.

### Form Reverse Calculator

- Menu name changed from `내구 역계산` to `형태 역계산`.
- Existing reverse page was heavily rebuilt around the new product direction:
  - my Pokemon / opponent Pokemon setup panels;
  - observed data panel;
  - opponent remaining HP percent input;
  - my remaining HP raw integer input;
  - turn order / speed module input;
  - item candidate selection;
  - result briefing cards and debug summary.
- Intended model:
  - defensive reverse module from damage dealt;
  - offensive reverse module from damage received;
  - speed / scarf module from first-move observation;
  - Champions 32-per-stat and 66-total point filtering.
- Turn accumulation is intentionally out of scope for now.

## Current Blocking Bug

The live UI still reports zero candidates for a scenario that should clearly produce legal candidates.

### Repro Scenario

- My Pokemon: `primarina`
- My nature: `modest`
- My points: `H32 C32 S2`
- My calculated stats in UI: `C195 S82`
- Opponent: `archaludon`
- My move: `moonblast`
- Opponent move: `thunderbolt`
- Field: `none`
- Opponent remaining HP: `30%`
- My remaining HP: `105`
- My max HP baseline: `187`
- Opponent moves first.

Expected practical reference:

- Primarina Moonblast into H32 B32 Bold Archaludon should deal about `62.4% ~ 73.6%`.
- Archaludon Thunderbolt into this Primarina should deal about `39.6% ~ 47.1%`, or `74 ~ 88` raw HP.
- If my HP goes from `187` to `105`, observed received damage is `82`, which is inside the expected Thunderbolt range.
- Therefore the candidate set should not be empty.

Actual UI debug output reported by the user:

```text
66포인트 룰과 관측값을 동시에 만족하는 형태가 없습니다.
내 primarina · 상대 archaludon · 내 성격 modest · 내 EV H32 C32 S2 · 내 실수치 C195 S82 · 기술 moonblast / thunderbolt · 필드 none · 도구후보 20개+없음 · 내구후보 0 · 정제대상 0 · 화력후보 0 · 속도제거 0 · 예산제거 0 · 후보 생성 0개 · 최종 생존 0개 · 규칙 제거 0개 · 내 HP 기준 187 · 내 속도 기준 82 · 상대 남은 HP 30% · 내 남은 HP 105
```

The most important symptom is `내구후보 0`. If the defensive stage has zero candidates, the later offense, speed, and budget filters never get a chance to work.

## Investigation Notes

The current evidence suggests a UI/state synchronization bug rather than a pure math impossibility.

- A direct VM-style engine check using the intended state produced candidates.
- In that direct check, candidate generation had nonzero output:
  - stage 1 defense candidates: `2421`
  - trimmed stage 1 candidates: `1200`
  - refined candidates: `57039`
  - sample damage ranges included Moonblast `109..129` and Thunderbolt `74..88`.
- This means `calcStats()` and `calculateDamage()` can represent the repro scenario.
- The remaining failure is likely in the actual page renderer / DOM-to-state path / stale legacy state path.

Partial fixes already attempted:

- Added default/analysis field separation so stale global field state should not leak into reverse analysis.
- Added visible field summary in the result debug line.
- Added DOM sync for nature, EVs, ability/status-like fields, moves, item candidates, field, and observation numbers.
- Added explicit no-item candidate handling.
- Reset reverse analysis field when loading a Pokemon into the form reverse page.

Despite those attempts, the real UI still reports `내구후보 0`.

## Recommended Next Work

1. Stop patching the legacy `revCalcState` flow and rebuild the form reverse calculator around an isolated state object, for example `formReverseState`.
2. Extract pure candidate-generation helpers from `src/js/04-4x-revcalc-*.js` before additional UI polish.
3. Add a golden regression script for the exact Primarina vs Archaludon scenario above.
4. Add a UI sync regression check that sets the same values through the page controls, then asserts that stage 1 candidates are nonzero.
5. Instrument the defensive stage zero-candidate path:
   - selected my move object and base power;
   - selected opponent object;
   - calculated my attacking stat;
   - candidate opponent HP / Sp. Def stats;
   - type effectiveness;
   - first few raw damage rolls;
   - observed remaining HP match check.
6. Keep the current input semantics:
   - opponent input is remaining HP percent;
   - my HP input is remaining raw HP value.
7. After the repro is fixed, improve ranking:
   - the direct engine can generate broad legal candidates;
   - special damage observations cannot infer physical Defense by themselves, so result wording should expose ambiguity honestly.

## Files Most Relevant To Continue

- `src/js/04-4x-revcalc-*.js`: current reverse calculator logic and matchup table rendering.
- `src/calc-template.html`: page layout and renamed menu.
- `src/styles/02-pages.css`: matchup and reverse calculator UI styles.
- `data/overrides/meta-threats.json`: current defense and coverage meta threat list.
- `pokemon-champions-calculator-v3.html`: generated build artifact.

