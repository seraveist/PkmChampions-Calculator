# Damage Calculator Plan

이 문서는 대미지 계산기 탭의 기획, UX, 상태 구조, 계산 로직 방향을 정리한다.

## 핵심 목표

대미지 계산기는 공격측 포켓몬의 결정력이 방어측 포켓몬에게 주는 대미지를 계산하는 도구다.

목표:

- 한 번의 공격 대미지를 빠르게 계산한다.
- Pokemon Champions 룰과 데이터를 따른다.
- Showdown 기반 계산 로직을 최대한 유지한다.
- 자동 진입 효과를 통해 사용자 실수를 줄인다.
- 수동 조정이 필요한 상황은 사용자가 직접 덮어쓸 수 있게 한다.

목표가 아닌 것:

- 기술 우선도 판정
- 트릭룸/우선도/차단 특성을 포함한 전체 행동 순서 시뮬레이션
- 전체 턴 진행 시뮬레이션
- 상대 AI 또는 행동 선택 예측

## 레퍼런스 범위 원칙

계산 공식과 보정 순서는 Showdown 계열을 따른다. 다만 구현 범위는 `pokemon-showdown`의 전체 배틀 엔진이 아니라, damage calculator 전용 구현을 상한선으로 둔다.

판단 기준:

- 한 번의 공격 대미지에 직접 영향을 주는 규칙은 구현한다.
- 현재 UI나 상태 모델에서 표현할 수 있는 조건은 계산 엔진에 연결한다.
- 직전 턴 결과나 특정 효과의 활성 여부처럼 배틀 엔진이 자동 판정해야 하는 값은 수동 조건으로 받는다.
- 현재 실속도 비교로 충분한 행동 순서 조건은 자동 판정하되 UI에 명시한다.
- 이전 피해량, 랜덤 분기, 턴 진행, 우선도 차단처럼 단발 대미지 계산기 바깥의 컨텍스트가 필요한 규칙은 보류한다.

예시:

- 구현: Body Press, Foul Play, Psyshock, fixed damage, OHKO, 타입/분류 변경, 특성/도구 대미지 보정
- 조건 UI: 속도 기준 선공/후공 자동 판정 표시, 직전 기술 실패, 대상이 이미 맞음, Flash Fire 활성, 쓰러진 아군 수, 현재 HP%
- 보류: Counter, Mirror Coat, Metal Burst, Comeuppance, Fickle Beam, 자동 스피드/우선도 판정, 전체 턴 진행 시스템

데이터와 코드의 역할도 분리한다.

- `data/overrides/*-mechanics.json`: 어떤 기술/특성/도구/필드 상태가 어떤 계산 규칙을 갖는지 선언한다.
- `data/overrides/field-mechanics.json`: 날씨 대미지, 지형 BP, 스크린, Protect처럼 단발 대미지에 직접 필요한 필드/상태 보정을 선언한다.
- `src/js/02-engine.js`: 선언된 규칙을 Showdown식 계산 단계 순서에 맞춰 적용한다.
- UI 상태: 자동 판정할 수 없는 배틀 컨텍스트를 사용자가 직접 지정하게 한다.

## 기본 사용자 흐름

1. 공격측 포켓몬을 선택한다.
2. 방어측 포켓몬을 선택한다.
3. 공격측 기술폭에서 기술을 선택한다.
4. 성격, 노력치, 랭크, 특성, 도구를 조정한다.
5. 날씨, 필드, 벽, 방어, 진입 위험 등 필드 조건을 조정한다.
6. 결과 카드에서 대미지 범위와 확정/난수 타수를 확인한다.

## 자동 진입 효과 UX

자동 진입 효과는 유지한다. 이유는 두 가지다.

- 사용자가 특성 효과를 빼먹는 실수를 줄인다.
- 포켓몬 선택과 필드 설정의 2회 조작을 1회로 줄인다.

확정된 동작:

1. 가뭄 포켓몬 선택 시 쾌청이 자동 적용된다.
2. 사용자가 날씨를 수동 변경하면 수동 값이 우선 적용된다.
3. 다른 포켓몬으로 변경하면 이전 포켓몬에서 자동 적용된 값은 source state 기준으로 돌아간다.
4. 새 포켓몬이 자동 적용 포켓몬이면 새 포켓몬 기준으로 다시 자동 적용된다.

예시:

- 공격측 코터스 선택: 쾌청 자동 적용
- 사용자가 날씨를 `none`으로 변경: 쾌청이 꺼진 계산 가능
- 공격측을 다른 포켓몬으로 변경: 코터스의 자동 쾌청은 해제
- 새 포켓몬이 가뭄이면 다시 쾌청 자동 적용

## Source State와 Derived State

대미지 계산기는 두 종류의 상태를 분리한다.

### Source State

사용자가 직접 입력한 원본 상태다.

- 선택 포켓몬
- 특성, 도구
- 성격, 노력치, 랭크
- 상태이상
- 선택 기술
- 수동 기술 위력
- 날씨, 필드, 벽, 방어, 진입 위험
- 수동으로 덮어쓴 자동 효과 값

자동 효과 때문에 source state를 직접 바꾸면 안 된다.

### Derived Calculation State

`makeCalcState()`에서 계산 직전에 source state를 복제하고 자동 효과를 적용한 상태다.

- 자동 날씨
- 자동 필드
- 위협 랭크 변화
- 다운로드 랭크 변화
- 재앙 특성 field toggle
- 계산용 복제 기술의 수동 위력

derived state는 매 계산마다 새로 생성된다.

## 자동 효과와 수동 입력 우선순위

우선순위:

1. 사용자가 명시적으로 수동 수정한 값
2. 현재 포켓몬/특성에서 파생된 자동 효과
3. 기본 source state 값

이 구조 덕분에 자동 효과는 편의 기능으로 유지되지만, 사용자가 자동 효과가 꺼진 상황도 계산할 수 있다.

## 현재 HP 조건

공격측과 방어측은 각각 현재 HP%를 입력한다.

파생 조건:

- `fullHP`: 현재 HP%가 100%일 때 true
- `pinch`: 현재 HP%가 1/3 이하일 때 true

이 값은 계산 직전에 파생되며, 별도 수동 체크박스로 관리하지 않는다.

영향을 받는 대표 규칙:

- 공격측 HP%: Eruption, Water Spout, Flail, Reversal, Final Gambit, Blaze/Torrent/Overgrow/Swarm, Defeatist
- 방어측 HP%: Hard Press, Endeavor, Multiscale, Shadow Shield, Sturdy, Focus Sash, Disguise, Ice Face, Tera Shell
- HKO 판정과 잔여 HP 표시: 방어측 현재 HP%를 시작 HP로 사용

## 기술 선택과 수동 위력

공격측 기술 슬롯은 해당 포켓몬의 `learnset.ts` 기반 목록에서 가져온다.

기술 선택 후:

- 기본 위력은 move data에서 가져온다.
- 각 기술 슬롯마다 위력을 수동 입력할 수 있다.
- 수동 입력은 원본 move data를 변경하지 않는다.
- 계산용 복제 move에 `manualBp` 플래그와 입력된 `bp`를 넣는다.
- `manualBp`가 true면 `computeVariableBp()`는 가변 위력 callback 대신 입력된 위력을 사용한다.

이 기능은 다음 상황에 필요하다.

- 사용자가 특수한 조건의 위력을 직접 비교하고 싶을 때
- 아직 엔진이 모든 조건부 위력을 지원하지 않을 때
- Champions 패치 전후 위력을 임시 비교하고 싶을 때

## 조건부 기술/특성

조건 UI는 선택된 기술이나 공격측 특성이 실제로 필요로 하는 값만 표시한다.

행동 순서가 대미지에 영향을 주는 기술:

- `boltbeak`
- `fishiousrend`
- `payback`

이 기술들은 현재 실속도 비교를 기준으로 자동 판정한다. 계산기는 이미 공격측/방어측 속도를 결과 영역에 표시하므로, 조건 UI에는 다음처럼 현재 적용 상태를 명시한다.

- 실속도 기준 자동 적용
- 현재 판정: 공격측 선공/후공/동속
- 관련 기술: 선공 시 위력 상승 또는 후공 시 위력 상승

그 외 전투 맥락은 사용자가 직접 지정한다.

- `lastMoveFailed`: Temper Flare, Stomping Tantrum
- `attackerWasHit`: Avalanche
- `targetWasHit`: Assurance
- `fallenAllies`: Last Respects, Supreme Overlord
- `flashFireActive`: Flash Fire 공격 boost
- `boosterEnergyState`: Protosynthesis/Quark Drive의 Booster Energy 발동 상태

쓰러진 아군 수는 Champions 공식 룰 기준으로 제한한다.

- 싱글 `63`: 6마리 중 3마리 선출이므로 0~2
- 더블 `64`: 6마리 중 4마리 선출이므로 0~3

Booster Energy는 도구 보유와 발동 상태를 분리한다.

- `auto`: 도구 데이터가 Booster Energy 발동을 갖고 있으면 자동 발동
- `active`: 도구를 이미 소모한 뒤에도 Paradox 부스트가 유지되는 상태
- `inactive`: 도구 보유와 별개로 Paradox 부스트를 끈 상태

이 조건은 공격측과 방어측 모두에 적용된다.

## 테라스탈

현재 Champions 룰에서는 테라스탈이 비활성이다.

정책:

- UI/데이터 구조에는 테라 관련 필드가 남아 있을 수 있다.
- 계산에서는 `RULES.teraDisabled`가 true이면 테라스탈을 적용하지 않는다.
- 차후 Champions 룰에 테라스탈이 추가되면 기존 구조를 확장한다.

현재 골든 테스트는 “테라 입력이 있어도 Champions 룰상 계산에 반영되지 않는다”를 확인한다.

## 계산 결과 표시

결과 카드는 간단하게 유지한다.

표시할 것:

- 대미지 최소/최대 퍼센트
- 16개 난수 롤
- 확정/난수 N타
- 자속, 효과 굉장/별로 등 핵심 정보
- 간단한 보정 근거

굳이 표시하지 않을 것:

- 전체 공식 단계 로그
- 모든 중간 modifier
- Showdown 내부 계산 trace 전체

자동 진입 효과는 결과 카드가 아니라 상단 요약 영역에서 보여준다.

현재 `mods` 표시는 사용자용 짧은 라벨로 취급한다.

- 배율은 `×1.3`처럼 짧게 표시한다.
- 차단/급소/고정 대미지 같은 핵심 라벨은 한국어로 표시한다.
- 중복 라벨은 한 번만 보여준다.
- 카드에는 최대 6개까지만 표시하고 전체 목록은 hover 제목으로 확인할 수 있게 둔다.

## 계산 엔진 단계

`calculateDamage()`는 다음 단계로 분리되어 있다.

1. `makeDamageContext()`
2. `resolveDamagePreludeStage()`
3. `calculateBasePowerStage()`
4. `calculateAttackStage()`
5. `calculateDefenseStage()`
6. `calculateBaseDamageStage()`
7. `calculateFinalDamageStage()`

이 구조의 목적:

- 조기 종료 분기와 실제 계산 단계를 구분한다.
- BP, 공격, 방어, base damage, final damage 수정 지점을 분명하게 만든다.
- 특정 기술/특성/도구 구현 시 영향 범위를 좁힌다.
- 골든 테스트로 결과 유지 여부를 확인하기 쉽게 만든다.

## 현재 지원 추적

현재 지원 범위는 `docs/damage-calculator-coverage-matrix.md`로 자동 생성한다.

생성 명령:

```powershell
npm run coverage:matrix
```

현재 점검 필요 요약은 생성 문서의 `점검 필요 요약` 섹션을 기준으로 본다.

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

## 다음 UI 개선 후보

대미지 계산기 안정화 후 추가할 후보:

1. 조건 UI 라벨/배치의 모바일 가독성 추가 점검
2. 세부조정/내구 역계산에서 재사용할 결과 모델 표준화

## 테스트 기준

대미지 계산기 관련 변경 후 기본 검증:

```powershell
npm test
```

특히 계산 로직을 수정했다면 `scripts/damage-golden.mjs`에 케이스를 추가한다.

자동 진입 효과나 source/derived state를 수정했다면 `scripts/entry-effects-state.mjs`에 케이스를 추가한다.
