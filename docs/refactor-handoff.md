# Refactor Handoff

이 문서는 다른 PC에서 현재 리팩토링 작업을 이어받기 위한 인수인계 기록이다.

## 브랜치

- 작업 브랜치: `codex-refactor-handoff-20260508`
- 기준 원격: `origin` (`https://github.com/seraveist/PkmChampions-Calculator.git`)

다른 PC에서 이어받기:

```powershell
git clone https://github.com/seraveist/PkmChampions-Calculator.git
cd PkmChampions-Calculator
git fetch origin
git switch codex-refactor-handoff-20260508
npm install
npm test
```

## 프로젝트 목표

이 프로젝트는 `Pokemon Champions`용 계산 도구다.

핵심 기능:

- 공격측/방어측 포켓몬 세팅 기반 대미지 계산
- 포켓몬, 기술, 특성, 도구 도감
- 포켓몬 노력치 세부조정
- 실제 게임에서 한 턴의 공격/방어 후 남은 HP%를 기반으로 하는 내구 역계산

현재 리팩토링의 1차 목표는 대미지 계산기 탭의 상태 구조와 계산 로직을 먼저 안정화하는 것이다.

## 확정된 설계 방향

- 선공/후공 자동 판정과 기술 우선도 계산은 핵심 기능에서 제외한다.
- Bolt Beak, Fishious Rend, Payback처럼 행동 순서 조건이 필요한 기술은 수동 조건으로 다룬다.
- 테라스탈은 현재 Champions 룰상 비활성이다.
- 차후 테라스탈 추가 가능성을 고려해 입력/코드는 남겨두되 `RULES.teraDisabled`로 계산 비활성화한다.
- 자동 진입 효과는 필요하다. 사용자의 실수를 줄이고 조작 횟수를 줄이는 UX로 유지한다.
- 자동 효과는 source state를 직접 수정하지 않고, 계산 직전에 derived state로만 적용한다.
- 사용자가 날씨/필드/재앙 등을 수동 수정하면 그 값이 우선한다.
- 포켓몬을 바꾸면 이전 포켓몬에서 자동 적용됐던 값은 source state 기준으로 돌아간 뒤 새 포켓몬 기준으로 다시 적용된다.
- 계산 결과 카드의 근거 표시는 현재처럼 간단하게 유지한다. 자동 진입 효과는 상단 요약에서 보여준다.

## 데이터 정책

- 기본 데이터는 `smogon/pokemon-showdown` 쪽 데이터를 주기적으로 동기화한다.
- Showdown TS 데이터에는 한글 텍스트가 없으므로 PokeAPI에서 한글명을 매칭한다.
- PokeAPI 갱신이 늦거나 누락되는 데이터는 `data/overrides/`의 수동 override로 보정한다.
- override는 자동 데이터보다 항상 나중에 적용되어야 한다.
- Showdown Champions mod에 custom 표시 데이터가 있더라도, 추후 upstream 업데이트로 반영될 수 있으므로 현재는 삭제하지 않는다.

## 현재까지 반영된 주요 작업

### 데이터/빌드/검증

- Showdown/PokeAPI/override 병합 구조 점검
- 수동 override 우선 적용 구조 보강
- 데이터 정합성 검증 스크립트 추가: `scripts/validate-data.mjs`
- 기본 체크 스크립트 추가: `scripts/check.mjs`
- CI 워크플로 추가: `.github/workflows/ci.yml`
- README 및 `.gitattributes` 추가

### 대미지 계산 테스트

- 골든 테스트 추가: `scripts/damage-golden.mjs`
- 자동 진입 효과 상태 테스트 추가: `scripts/entry-effects-state.mjs`
- `npm test`가 다음 순서로 실행되도록 구성:

```powershell
npm run check
npm run build
npm run data:validate
npm run damage:golden
npm run state:entry
```

### 자동 진입 효과

- `makeCalcState()`에서 계산용 derived state 생성
- 가뭄/잔비/모래날림/눈퍼뜨리기 등 날씨 자동 적용
- 일렉트릭/그래스/사이코/미스트 필드 자동 적용
- 위협, 다운로드, 재앙 특성 자동 적용
- 수동 필드 수정값 우선
- 포켓몬 변경 시 자동 적용값 reset 후 새 포켓몬 기준 재적용
- source state와 derived state가 섞이지 않도록 테스트 추가

### 기술 위력 수동 입력

- 공격측 기술 슬롯별 위력 수동 입력 UI 추가
- 수동 입력값은 원본 move data를 수정하지 않고 계산용 복제 move에만 반영
- `manualBp`가 true일 때 `computeVariableBp()`의 가변 위력 로직을 우회
- 관련 골든 테스트 추가

### 계산 엔진 구조화

- 내부 모델 문서 추가: `docs/damage-calculator-internal-model.md`
- `calculateDamage()`를 단계 함수로 분리:
  - `makeDamageContext()`
  - `resolveDamagePreludeStage()`
  - `calculateBasePowerStage()`
  - `calculateAttackStage()`
  - `calculateDefenseStage()`
  - `calculateBaseDamageStage()`
  - `calculateFinalDamageStage()`
- 기존 골든 테스트 기준 결과값 변화 없음

### 커버리지 매트릭스

- 자동 생성 스크립트 추가: `scripts/coverage-matrix.mjs`
- 실행 명령:

```powershell
npm run coverage:matrix
```

- 생성 문서: `docs/damage-calculator-coverage-matrix.md`
- 현재 Champions 데이터 기준으로 계산 로직 추적 후보를 기술/특성/도구별로 정리한다.

## 현재 점검 필요 항목

`docs/damage-calculator-coverage-matrix.md` 기준:

- `bodypress`: 미구현. 공격측 방어 실수치/랭크를 공격값으로 사용해야 한다.

현재 보류 항목:

- `counter`
- `mirrorcoat`
- `metalburst`
- `comeuppance`
- `ficklebeam`

보류 이유:

- 이전 피해량이나 랜덤 강화 분기처럼 단발 대미지 계산기 외부의 전투 컨텍스트가 필요하다.

## 참고 문서

- `docs/damage-calculator-support-matrix.md`
- `docs/damage-calculator-internal-model.md`
- `docs/damage-calculator-coverage-matrix.md`
- `docs/smogon-damage-calc-comparison.md`

## 이어서 진행할 추천 순서

1. `bodypress` 계산 로직을 구현하고 골든 테스트를 추가한다.
2. HP% 입력 UI를 추가하고 `fullHP`, `pinch`, 현재 HP 기반 가변 위력 기술을 정리한다.
3. 조건부 기술 컨트롤을 선택 기술에 따라 노출한다.
4. Bolt Beak, Fishious Rend, Payback은 자동 속도 판정이 아니라 수동 순서 조건으로 정리한다.
5. 대미지 계산기 탭 안정화 후 세부조정과 내구 역계산을 다시 설계한다.

## 검증 명령

작업 후 기본 검증:

```powershell
npm test
```

커버리지 문서 재생성:

```powershell
npm run coverage:matrix
```

빌드 산출물:

- `pokemon-champions-calculator-v3.html`

이 파일은 `npm run build` 또는 `npm test` 중 build 단계에서 다시 생성된다.
