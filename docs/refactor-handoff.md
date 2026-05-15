# Refactor Handoff

## 2026-05-08 최신 분기점 요약

현재 이어받을 기준 브랜치는 `codex-refactor-handoff-20260508`이다.

이번 분기점에서 완료된 핵심 작업:

- `pokemon-showdown-damage-calc`를 구현 범위의 상한으로 삼아 구현/수동 조건/보류 기준을 정리했다.
- `coverage:matrix`가 코드 문자열뿐 아니라 `data/overrides/*-mechanics.json`과 빌드된 메타데이터를 지원 근거로 인식하도록 수정했다.
- `Body Press`는 공격측 방어 실수치/랭크를 공격값으로 사용하도록 구현 및 golden test가 완료된 상태다.
- 공격측/방어측 현재 HP% 입력을 추가했고, `fullHP`와 `pinch`는 HP%에서 파생하도록 정리했다.
- Eruption/Water Spout, Final Gambit/Endeavor, Multiscale/Shadow Shield, Sturdy/Focus Sash 계열은 현재 HP% 기반으로 계산된다.
- 조건부 기술/특성 UI를 추가했다. 실속도 기준 선공/후공은 자동 판정 상태를 표시하고, 직전 기술 실패/피격 여부/Flash Fire 활성/쓰러진 아군 수는 필요한 경우에만 입력한다.
- 쓰러진 아군 수는 Champions 룰 기준으로 싱글 0~2, 더블 0~3으로 제한한다.
- `data/overrides/field-mechanics.json`을 추가해 날씨 대미지 보정, 지형 BP 보정, 스크린 보정, Protect 처리를 데이터 선언으로 분리했다.
- 그래스필드 지진 약화, 리플렉터, Protect 차단은 golden test로 고정했다.
- `coverage:matrix`가 필드/상태 후보도 추적하도록 확장했고, Magic Room/Wonder Room/Aurora Veil/Friend Guard/Battery/Power Spot은 명시 보류로 표시한다.
- 결과 카드의 `mods` 라벨은 짧은 `×N` 배율과 한국어 라벨 중심으로 정리했고, 카드에는 중복 제거 후 앞 6개만 표시한다.
- Booster Energy는 `auto` / `active` / `inactive` 상태로 분리했다. Protosynthesis/Quark Drive는 날씨/필드 조건과 별개로 도구 소모 후 활성 상태를 계산할 수 있다.
- Showdown damage calculator 참조 축에 맞춰 Tera Shell, Mold Breaker, Pixilate/Liquid Voice, Protosynthesis/Quark Drive, OHKO/Sturdy 케이스를 golden test로 추가했다.
- 대미지 계산기의 남은 특성/아이템 하드코딩 일부를 데이터 메타데이터로 이동했다.
- `Klutz`는 `ability-mechanics.json`의 `suppressesItem`으로 처리한다.
- `Sticky Hold`는 `blocksItemRemoval`로 처리해 Knock Off 가변 위력 분기에서 직접 특성명을 비교하지 않는다.
- `Iron Ball`, `Air Balloon`, `Utility Umbrella`는 `item-mechanics.json`의 `grounded`, `groundImmunity`, `ignoresWeatherDamageModifiers`로 처리한다.
- Ruin 계열 자기 제외 로직은 `ruinExemption` 메타데이터로 처리한다.
- 이전 작업의 특성 메타데이터 확장도 포함되어 있다: Mold Breaker 계열, Neutralizing Gas 예외, 면역 특성, Sturdy, Shell Armor/Battle Armor, Tera Shell, Skill Link, Parental Bond, Poison Heal, Quick Feet, Adaptability/Protean/Libero, Heavy Metal/Light Metal, Protosynthesis/Quark Drive, Ripen, Infiltrator, Mega Sol.

검증 완료:

```powershell
npm.cmd test
npm.cmd run coverage:matrix
```

주의:

- 다른 PC에서 이어받을 때는 아래 빠른 시작 절차로 브랜치를 받은 뒤, 이 문서의 최신 분기점 요약을 먼저 확인한다.

이 문서는 다른 PC 또는 새 대화에서 현재 작업을 이어받기 위한 시작점이다.

## 빠른 시작

```powershell
git clone https://github.com/seraveist/PkmChampions-Calculator.git
cd PkmChampions-Calculator
git fetch origin
git switch codex-refactor-handoff-20260508
npm install
npm test
```

커버리지 문서 재생성:

```powershell
npm run coverage:matrix
```

빌드 산출물:

- `pokemon-champions-calculator-v3.html`

`npm run build` 또는 `npm test` 중 build 단계에서 다시 생성된다.

## 문서 읽는 순서

처음 이어받는 사람은 다음 순서로 읽으면 된다.

1. `docs/project-plan.md`
2. `docs/decision-log.md`
3. `docs/damage-calculator-plan.md`
4. `docs/refactor-roadmap.md`
5. `docs/refactor-handoff.md`

보조 문서:

- `docs/damage-calculator-internal-model.md`
- `docs/damage-calculator-support-matrix.md`
- `docs/damage-calculator-coverage-matrix.md`
- `docs/smogon-damage-calc-comparison.md`

## 현재 브랜치

- 브랜치: `codex-refactor-handoff-20260508`
- 원격: `origin`
- 저장소: `https://github.com/seraveist/PkmChampions-Calculator.git`

## 프로젝트 요약

이 프로젝트는 Pokemon Champions용 계산 도구다.

핵심 기능:

- 공격측/방어측 세팅 기반 대미지 계산
- 포켓몬, 기술, 특성, 도구 도감
- 포켓몬 노력치 세부조정
- 남은 HP% 기반 내구 역계산

현재 리팩토링은 대미지 계산기 탭을 우선 대상으로 한다. 대미지 계산기 상태 구조와 엔진이 안정화된 뒤, 세부조정과 내구 역계산을 다시 설계한다.

## 지금까지 확정된 핵심 방향

- 대미지 계산은 Showdown 기반 로직을 유지한다.
- 기술 우선도 계산은 제외한다.
- 행동 순서가 대미지에 필요한 기술은 현재 실속도 기준 자동 판정을 유지하되, 조건 UI에 자동 적용 상태를 명시한다.
- 테라스탈은 현재 Champions 룰상 비활성이다.
- 자동 진입 효과는 유지한다.
- 자동 효과는 source state를 직접 변경하지 않고 derived state에만 적용한다.
- 수동 변경값은 자동값보다 우선한다.
- 계산 근거 표시는 현재처럼 간단하게 유지한다.
- Showdown 데이터가 기본값이고, PokeAPI 한글명 이후 manual override가 마지막에 적용된다.
- `pokemon-showdown` 전체 배틀 엔진은 참고 대상이지만, 현재 구현 범위는 damage calculator 전용 로직을 기준으로 줄인다.
- 직전 기술 실패, 대상 피격 여부, Flash Fire 활성, 현재 HP%, 쓰러진 아군 수처럼 자동 판정보다 사용자 지정이 안전한 값은 조건 UI로 둔다.

자세한 이유는 `docs/decision-log.md`를 참조한다.

## 현재까지 반영된 주요 작업

### 데이터/빌드

- Showdown 데이터 동기화 흐름 점검
- PokeAPI 한글명 매칭 흐름 점검
- manual override 우선 적용 구조 보강
- 데이터 검증 스크립트 추가
- CI workflow 추가

### 테스트

- 기본 check 스크립트 추가
- 대미지 골든 테스트 추가
- 자동 진입 효과 state 테스트 추가

### 자동 진입 효과

- `makeCalcState()`에서 derived state 생성
- 날씨/필드/위협/다운로드/재앙 자동 적용
- 수동 override 우선
- source state 불변성 테스트 추가

### UI

- 공격측 기술 슬롯별 수동 위력 입력 추가
- learnset 기반 기술 선택 유지
- 수동 위력은 계산용 move 복제 객체에만 적용

### 계산 엔진

- `calculateDamage()` 단계 함수 분리
- 내부 모델 문서화
- 커버리지 매트릭스 자동 생성 추가

## 중요한 파일

계획/기록:

- `docs/project-plan.md`
- `docs/damage-calculator-plan.md`
- `docs/refactor-roadmap.md`
- `docs/decision-log.md`
- `docs/refactor-handoff.md`

계산 엔진:

- `src/js/02-engine.js`
- `src/js/01-core.js`
- `src/js/03-*.js`
- `data/overrides/move-mechanics.json`
- `data/overrides/ability-mechanics.json`
- `data/overrides/item-mechanics.json`
- `data/overrides/field-mechanics.json`

검증:

- `scripts/check.mjs`
- `scripts/damage-golden.mjs`
- `scripts/entry-effects-state.mjs`
- `scripts/validate-data.mjs`
- `scripts/coverage-matrix.mjs`

데이터/빌드:

- `build.mjs`
- `scripts/fetch-ko.mjs`
- `data/overrides/`

## 현재 점검 필요 항목

`docs/damage-calculator-coverage-matrix.md` 기준 현재 점검 필요 요약은 없음이다.

필드/상태 메커니즘 데이터화 1차 범위는 완료했다.

현재 보류:

- `counter`
- `mirrorcoat`
- `metalburst`
- `comeuppance`
- `ficklebeam`
- `magicroom`
- `wonderroom`
- `auroraveil`
- `friendguard`
- `battery`
- `powerspot`

보류 이유:

- 이전 피해량, 랜덤 강화 분기, 별도 사이드 상태, 아군 위치처럼 단발 대미지 계산기 외부 컨텍스트가 필요하다.

## 추천 다음 작업

1. 노력치 세부조정 재개발을 위한 계산 상태 재사용 지점 정리
2. 내구 역계산 재개발을 위한 HP%/필드 조건 재사용 지점 정리
3. `npm test`와 `npm run coverage:matrix` 실행

## 작업 전 주의

- 사용자가 만든 변경사항을 되돌리지 않는다.
- 계산 로직 변경 시 골든 테스트를 먼저 확인한다.
- 자동 효과 변경 시 source state가 직접 바뀌지 않는지 테스트한다.
- `docs/damage-calculator-coverage-matrix.md`는 생성 문서다. 직접 수정하기보다 `scripts/coverage-matrix.mjs`를 수정하고 재생성한다.
- `pokemon-champions-calculator-v3.html`은 build 산출물이다.

## 검증 명령

```powershell
npm test
```

개별 검증:

```powershell
npm run check
npm run build
npm run data:validate
npm run damage:golden
npm run state:entry
npm run coverage:matrix
```
