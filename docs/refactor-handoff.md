# Refactor Handoff

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
- 선공/후공 자동 판정과 기술 우선도 계산은 제외한다.
- 행동 순서가 필요한 기술은 수동 조건으로 처리한다.
- 테라스탈은 현재 Champions 룰상 비활성이다.
- 자동 진입 효과는 유지한다.
- 자동 효과는 source state를 직접 변경하지 않고 derived state에만 적용한다.
- 수동 변경값은 자동값보다 우선한다.
- 계산 근거 표시는 현재처럼 간단하게 유지한다.
- Showdown 데이터가 기본값이고, PokeAPI 한글명 이후 manual override가 마지막에 적용된다.

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
- `src/js/03-calc-ui.js`

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

`docs/damage-calculator-coverage-matrix.md` 기준 현재 명확한 다음 구현 항목:

- `bodypress`

요구:

- 공격측 방어 실수치와 방어 랭크를 공격값으로 사용한다.
- 골든 테스트를 추가한다.
- 구현 후 `npm run coverage:matrix`를 다시 실행한다.

현재 보류:

- `counter`
- `mirrorcoat`
- `metalburst`
- `comeuppance`
- `ficklebeam`

보류 이유:

- 이전 피해량 또는 랜덤 강화 분기처럼 단발 대미지 계산기 외부 컨텍스트가 필요하다.

## 추천 다음 작업

1. `bodypress` 계산 로직 구현
2. `bodypress` 골든 테스트 추가
3. `npm test` 실행
4. `npm run coverage:matrix` 실행
5. HP% 입력 UI 설계 및 구현
6. 조건부 기술 UI 정리

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
