# Refactor Roadmap

이 문서는 리팩토링 진행 순서와 현재 완료/대기/보류 항목을 정리한다.

## 전체 전략

리팩토링은 기능을 한 번에 갈아엎지 않고, 계산 결과를 유지한 채 내부 구조를 단계적으로 안정화한다.

우선순위:

1. 대미지 계산기 탭
2. 데이터 동기화와 override 검증
3. 계산 엔진 테스트와 커버리지 추적
4. 대미지 계산기 UI/상태 구조 정리
5. 노력치 세부조정 재설계
6. 내구 역계산 재설계
7. 도감 UX 정리

## 현재 브랜치 상태

- 브랜치: `codex-refactor-handoff-20260508`
- 목적: 현재까지의 분석, 기획, 테스트, 리팩토링 준비 작업을 다른 PC에서 이어받을 수 있게 저장
- 검증 명령: `npm test`
- 커버리지 문서 생성: `npm run coverage:matrix`

## 완료된 작업

### 1. 프로젝트 분석

- 프로젝트가 Pokemon Champions 대미지 계산 도구임을 정리
- 주요 기능을 대미지 계산기, 도감, 노력치 세부조정, 내구 역계산으로 분류
- 우선 리팩토링 대상은 대미지 계산기 탭으로 결정

### 2. 데이터 흐름 점검

- Showdown TS 데이터 동기화 구조 확인
- PokeAPI 한글명 매칭 구조 확인
- manual override 우선 적용 필요성 확인
- custom 표시 데이터는 현재 삭제하지 않는 것으로 결정
- 데이터 검증 스크립트 추가

관련 파일:

- `scripts/validate-data.mjs`
- `data/overrides/filters.json`
- `scripts/fetch-ko.mjs`
- `build.mjs`

### 3. 계산 로직 검증 기반 추가

- 대미지 골든 테스트 추가
- 자동 진입 효과 state 테스트 추가
- 기본 check 스크립트 추가
- CI workflow 추가

관련 파일:

- `scripts/check.mjs`
- `scripts/damage-golden.mjs`
- `scripts/entry-effects-state.mjs`
- `.github/workflows/ci.yml`

### 4. 자동 진입 효과 구조 정리

- 자동 효과는 사용자 편의 기능으로 유지
- source state를 직접 수정하지 않고 derived state에만 적용
- 수동 변경값이 자동값보다 우선
- 포켓몬 변경 시 자동 적용값 reset 후 새 포켓몬 기준 재적용
- 위협과 수동 랭크 입력이 함께 있을 때 derived rank에서 합산

확인된 예:

- 공격측이 이미 공격 +1을 수동 입력
- 방어측 위협이 자동 적용
- 계산용 derived 공격 랭크는 +1과 -1이 합산되어 0
- source state의 수동 +1은 유지

관련 파일:

- `src/js/03-calc-ui.js`
- `scripts/entry-effects-state.mjs`

### 5. 기술 위력 수동 입력

- 기술 슬롯별 위력 입력칸 추가
- learnset 기반 기술 선택 유지
- 수동 위력은 계산용 move 복제 객체에만 적용
- `manualBp` 플래그로 가변 위력 callback 우회
- 골든 테스트 추가

관련 파일:

- `src/js/03-calc-ui.js`
- `src/js/02-engine.js`
- `src/styles/01-base.css`
- `scripts/damage-golden.mjs`

### 6. 계산 엔진 단계 분리

- `calculateDamage()`를 단계 함수로 분리
- 계산 결과 유지 확인
- 내부 모델 문서 추가

단계:

- `makeDamageContext()`
- `resolveDamagePreludeStage()`
- `calculateBasePowerStage()`
- `calculateAttackStage()`
- `calculateDefenseStage()`
- `calculateBaseDamageStage()`
- `calculateFinalDamageStage()`

관련 파일:

- `src/js/02-engine.js`
- `docs/damage-calculator-internal-model.md`

### 7. 커버리지 매트릭스 자동 생성

- Champions 데이터 기준으로 기술/특성/도구 계산 지원 상태 추적
- 미구현/보류 항목을 문서로 확인 가능

관련 파일:

- `scripts/coverage-matrix.mjs`
- `docs/damage-calculator-coverage-matrix.md`

## 다음 작업 순서

### Step 1. Body Press 구현

현재 커버리지 매트릭스에서 가장 명확한 미구현 항목이다.

요구:

- `bodypress`는 공격측의 방어 실수치와 방어 랭크를 공격값으로 사용해야 한다.
- 공격측 방어 하락/상승, 급소, Unaware와의 관계를 확인해야 한다.
- 골든 테스트를 추가해야 한다.

예상 수정 위치:

- `src/js/02-engine.js`
- `scripts/damage-golden.mjs`

완료 기준:

- `bodypress`가 coverage matrix에서 미구현으로 남지 않음
- 관련 골든 테스트 통과
- `npm test` 통과

### Step 2. HP% 상태 정리

현재 HP 관련 조건은 일부 수동 플래그로 남아 있다.

대상:

- `hpPct`
- `fullHP`
- `pinch`
- `Final Gambit`
- `Endeavor`
- `Eruption`
- `Water Spout`
- `Flail`
- `Reversal`
- `Hard Press`
- `Multiscale`
- `Shadow Shield`
- `Sturdy`
- `Focus Sash`
- `Disguise`
- `Ice Face`

방향:

- 공격측/방어측 HP% 입력 추가
- `fullHP`는 `hpPct === 1`에서 파생
- `pinch`는 HP% 기준 파생 또는 수동 override 허용

### Step 3. 조건부 기술 UI

선택된 기술이나 특성이 필요로 할 때만 조건 UI를 보여준다.

대상:

- `lastMoveFailed`: Temper Flare, Stomping Tantrum
- `attackerWasHit`: Avalanche
- `targetWasHit`: Assurance
- `fallenAllies`: Last Respects, Supreme Overlord
- `attackerMovedFirst`: Bolt Beak, Fishious Rend
- `attackerMovedSecond`: Payback
- `flashFireActive`: Flash Fire 공격 boost

### Step 4. 계산 근거 표시 유지

현재 방향은 상세 공식 패널을 만들지 않는 것이다.

유지:

- 결과 카드에는 간단한 보정 근거만 표시
- 자동 진입 효과는 상단 요약에서 표시

검토:

- 너무 긴 `mods` 문구는 간결하게 정리
- 한글/영문 라벨 혼재는 나중에 정리

### Step 5. 노력치 세부조정 재개발

대미지 계산기 탭 안정화 후 진행한다.

방향:

- 현재 계산 엔진의 상태 모델 재사용
- 목표 실수치, 목표 생존/KO 조건 기반 탐색
- 추천 세부조정 후보 표시

### Step 6. 내구 역계산 재개발

대미지 계산기 탭 안정화 후 진행한다.

방향:

- 남은 HP% 기반 후보 역산
- 가능한 방어측 노력치/성격/도구/특성 후보 표시
- 대미지 계산기의 field/side 조건 재사용

## 보류 항목

현재 대미지 계산기 1차 리팩토링에서 보류한다.

- `counter`
- `mirrorcoat`
- `metalburst`
- `comeuppance`
- `ficklebeam`

이유:

- 이전 피해량 또는 랜덤 분기 같은 전투 이력 컨텍스트가 필요하다.
- 단발 공격 대미지 계산기 UI에 바로 넣으면 복잡도가 커진다.

## 매 작업 후 확인

기본:

```powershell
npm test
```

커버리지 문서가 관련된 작업:

```powershell
npm run coverage:matrix
```

계산 로직 수정:

- `scripts/damage-golden.mjs`에 케이스 추가
- 기존 골든 테스트 결과 변화 확인

상태/UI 자동 효과 수정:

- `scripts/entry-effects-state.mjs`에 케이스 추가
- source state가 변하지 않는지 확인
