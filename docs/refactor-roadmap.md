# Refactor Roadmap

## 2026-05-08 진행 업데이트

완료:

- Body Press 구현 및 golden test 반영.
- move/item/ability 계산 메커니즘의 주요 하드코딩을 `data/overrides/*-mechanics.json`으로 이동.
- 특성 메타데이터 기반 처리 확대:
  - 면역/접지/날씨 억제/Mold Breaker/Neutralizing Gas 예외
  - STAB 보정, 타입 변경 특성, 멀티히트, 추가타, 치명타 차단, KO 생존, 잔반/회복류
  - Paradox 계열, Ripen, Infiltrator, Mega Sol
  - Klutz, Sticky Hold, Ruin 계열 자기 제외
- 아이템 메타데이터 기반 처리 확대:
  - Iron Ball 접지
  - Air Balloon 비접지 및 땅 무효
  - Utility Umbrella 날씨 대미지 보정 무시
- `scripts/damage-golden.mjs`에 새 메타데이터 회귀 검증 추가.
- `docs/damage-calculator-coverage-matrix.md` 재생성.
- HP% 기반 상태 모델 정리:
  - 공격측/방어측 현재 HP% 입력 추가
  - `fullHP`, `pinch`를 현재 HP%에서 파생
  - Eruption/Water Spout, Final Gambit, Multiscale, Sturdy/Focus Sash 계열이 HP%를 사용하도록 정리
- 조건부 기술/특성 UI 정리:
  - 실속도 기준 선공/후공 자동 판정 상태 표시
  - 직전 기술 실패, 공격측 피격, 방어측 피격, Flash Fire 활성 토글 추가
  - 쓰러진 아군 수를 싱글 0~2, 더블 0~3으로 제한
- 필드/상태 메커니즘 데이터화:
  - `data/overrides/field-mechanics.json` 추가
  - 날씨 대미지 보정, 지형 BP 보정, 스크린 보정, Protect 처리를 데이터 선언으로 이동
  - field mechanics 번들링 및 golden test 추가
- 범위 밖 필드/상태 보류 추적 정리:
  - `coverage:matrix`가 field/state 후보를 별도 범위로 추적
  - Magic Room, Wonder Room, Aurora Veil, Friend Guard, Battery, Power Spot을 명시 보류로 표시
- 결과 카드 `mods` 표시 정리:
  - 배율 라벨을 `×1.3`처럼 짧은 표기로 통일
  - `blocked`, `critical`, `fixed damage` 같은 영문 조각을 한국어로 정리
  - 결과 카드에는 중복 제거 후 최대 6개 라벨만 표시하고 전체 목록은 hover 제목에 보존
- Booster Energy 상태 분리:
  - `auto` / `active` / `inactive` 모드로 보유, 소모 후 활성, 비활성 비교를 분리
  - Protosynthesis/Quark Drive 공격측/방어측 부스트 모두 golden test 추가
- Showdown / showdown calculator 참조 케이스 추가:
  - Tera Shell 및 Mold Breaker 상호작용
  - Pixilate/Liquid Voice 타입 변경
  - Protosynthesis/Quark Drive 조건부 스탯 보정
  - OHKO, Sturdy, Mold Breaker 상호작용

다음 우선순위:

1. 노력치 세부조정 재개발을 위한 계산 상태 재사용 지점 정리
2. 내구 역계산 재개발을 위한 HP%/필드 조건 재사용 지점 정리

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

- `src/js/03-*.js`
- `scripts/entry-effects-state.mjs`

### 5. 기술 위력 수동 입력

- 기술 슬롯별 위력 입력칸 추가
- learnset 기반 기술 선택 유지
- 수동 위력은 계산용 move 복제 객체에만 적용
- `manualBp` 플래그로 가변 위력 callback 우회
- 골든 테스트 추가

관련 파일:

- `src/js/03-*.js`
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

### 8. Body Press 및 mechanics 데이터화

- `bodypress`는 공격측 방어 실수치와 방어 랭크를 공격값으로 사용하도록 구현 완료
- move/item/ability 계산 메커니즘을 `data/overrides/*-mechanics.json` 중심으로 이전
- 커버리지 매트릭스가 mechanics JSON과 빌드된 데이터 필드를 지원 근거로 인식하도록 수정
- damage calculator 전용 레퍼런스를 기준으로 구현/수동 조건/보류 범위를 재정리

관련 파일:

- `src/js/02-engine.js`
- `build.mjs`
- `data/overrides/move-mechanics.json`
- `data/overrides/ability-mechanics.json`
- `data/overrides/item-mechanics.json`
- `scripts/coverage-matrix.mjs`
- `scripts/damage-golden.mjs`

### 9. HP% 상태 모델

- 공격측/방어측 패널에 현재 HP% 입력 추가
- `pinch` 수동 체크박스를 제거하고 현재 HP% 1/3 이하에서 자동 파생
- `fullHP`는 현재 HP% 100%에서 자동 파생
- HKO 판정과 잔여 HP 표시가 방어측 현재 HP%를 기준으로 계산되도록 정리
- HP% 기반 회귀 테스트 추가

관련 파일:

- `src/js/03-*.js`
- `src/js/02-engine.js`
- `src/styles/01-base.css`
- `scripts/damage-golden.mjs`
- `scripts/entry-effects-state.mjs`

### 10. 조건부 기술/특성 UI

- 선택된 기술이나 공격측 특성이 필요로 할 때만 조건 영역 표시
- Bolt Beak/Fishious Rend/Payback/Analytic 계열은 실속도 기준 자동 판정 상태를 명시
- Temper Flare/Stomping Tantrum, Avalanche, Assurance, Flash Fire는 수동 토글로 입력
- Last Respects/Supreme Overlord는 쓰러진 아군 수 입력 사용
- 쓰러진 아군 수는 Champions 룰 기준으로 싱글 0~2, 더블 0~3 제한
- 조건부 계산 회귀 테스트 추가

관련 파일:

- `src/js/03-*.js`
- `src/js/02-engine.js`
- `src/styles/01-base.css`
- `scripts/damage-golden.mjs`
- `scripts/entry-effects-state.mjs`

### 11. 필드/상태 메커니즘 데이터화

- 계산 순서는 엔진에 유지하고, 필드 조건별 보정값은 `data/overrides/field-mechanics.json`으로 분리
- 날씨 대미지 보정, 지형 BP 보정, 리플렉터/빛의장막, 방어/막아내기 처리를 데이터 기반으로 적용
- 그래스필드 지진 약화, 리플렉터, Protect 차단 케이스를 golden test로 고정

관련 파일:

- `data/overrides/field-mechanics.json`
- `build.mjs`
- `src/js/02-engine.js`
- `scripts/damage-golden.mjs`

### 12. 참조 케이스 golden test 확장

- Tera Shell이 풀피 대상의 비면역 공격을 반감 처리하는지 고정
- Mold Breaker가 Tera Shell과 Sturdy/OHKO 차단을 무시하는지 고정
- Pixilate와 Liquid Voice의 타입 변경 및 BP 보정을 고정
- Protosynthesis와 Quark Drive가 조건 충족 시 최고 공격 스탯을 보정하는지 고정
- Sheer Cold OHKO, Sturdy 차단, Mold Breaker 예외를 고정

관련 파일:

- `scripts/damage-golden.mjs`

### 13. 범위 밖 필드/상태 보류 표시 정리

- `coverage:matrix`가 기술/특성/도구뿐 아니라 필드/상태 후보도 추적하도록 확장
- `weatherdamage`, `terrainbp`, `screens`, `protect`는 `field-mechanics.json` 기반 지원으로 표시
- Magic Room, Wonder Room은 도구/스탯 상태를 전역으로 뒤집는 효과라 현재 단발 계산기 상태 모델 밖으로 보류
- Aurora Veil은 리플렉터/빛의장막과 중첩되지 않는 별도 사이드 스크린 상태가 필요해 보류
- Friend Guard, Battery, Power Spot은 아군 위치와 더블 사이드 컨텍스트가 필요해 보류

관련 파일:

- `data/overrides/coverage-candidates.json`
- `scripts/coverage-matrix.mjs`
- `docs/damage-calculator-coverage-matrix.md`

### 14. 결과 카드 보정 라벨 정리

- 보정 배율 표시를 짧은 `×N` 형식으로 통일
- 차단/급소/고정 대미지 계열의 영문 라벨을 한국어로 정리
- `mods` 표시에서 중복 라벨을 제거
- 카드에는 앞 6개 라벨만 표시하고, 숨겨진 라벨 수는 `+N`으로 표시
- 전체 보정 라벨 목록은 `title`로 남겨 사용자가 필요할 때 확인할 수 있게 유지

관련 파일:

- `src/js/02-engine.js`
- `src/js/03-*.js`
- `src/styles/02-pages.css`

### 15. Booster Energy 상태 분리

- CalcPokemon source state에 `boosterEnergyState` 추가
- 값은 `auto`, `active`, `inactive` 세 가지로 관리
- `auto`는 기존처럼 도구 데이터의 `paradoxActivation`이 있으면 발동
- `active`는 도구를 이미 소모했거나 도구 슬롯과 별개로 Paradox 부스트가 켜진 상태
- `inactive`는 도구 보유와 별개로 Paradox 부스트를 꺼서 비교하는 상태
- 공격측과 방어측 모두 Protosynthesis/Quark Drive 조건 UI를 노출할 수 있게 정리
- 공격측 활성/비활성, 방어측 방어 부스트 golden test 추가

관련 파일:

- `src/js/02-engine.js`
- `src/js/03-*.js`
- `src/styles/01-base.css`
- `scripts/damage-golden.mjs`
- `scripts/entry-effects-state.mjs`

## 다음 작업 순서

### Step 1. 노력치 세부조정 재개발

대미지 계산기 탭의 상태 모델이 안정화된 뒤 진행한다.

방향:

- 현재 계산 엔진의 상태 모델 재사용
- 목표 실수치, 목표 생존/KO 조건 기반 탐색
- 추천 세부조정 후보 표시

### Step 2. 내구 역계산 재개발

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
- `magicroom`
- `wonderroom`
- `auroraveil`
- `friendguard`
- `battery`
- `powerspot`

이유:

- 이전 피해량, 랜덤 분기, 별도 사이드 상태, 아군 위치 같은 전투 이력/배치 컨텍스트가 필요하다.
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
