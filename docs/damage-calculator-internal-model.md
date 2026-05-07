# Damage Calculator Internal Model

이 문서는 대미지 계산기 리팩토링에서 유지해야 할 내부 모델 경계를 정리한다.

목표는 UI 상태, 자동 진입 효과, 계산 엔진 입력을 분리해서 사용자가 입력한 값과 계산 직전에 파생된 값을 섞지 않는 것이다.

## 상태 계층

### Source State

`state.atk`, `state.def`, `state.field`는 사용자가 직접 선택하거나 수정한 원본 상태다.

- 포켓몬, 특성, 도구, 성격, 노력치, 랭크, 상태이상
- 선택된 기술 슬롯
- 날씨, 필드, 벽, 방어, 진입 위험 등 필드 체크값
- 수동 위력 입력값처럼 사용자가 명시적으로 덮어쓴 값

Source state는 자동 효과 때문에 직접 변하면 안 된다. 예를 들어 가뭄 포켓몬을 선택해서 쾌청이 자동 적용되어도, 사용자가 직접 고른 날씨 상태 자체가 영구적으로 바뀌면 안 된다.

### Derived Calculation State

`makeCalcState()`가 계산 직전에 Source state를 복제하고 자동 효과를 적용한 상태다.

- 가뭄, 잔비, 모래날림, 눈퍼뜨리기 등 자동 날씨
- 일렉트릭메이커, 그래스메이커 등 자동 필드
- 위협처럼 진입 시 랭크를 바꾸는 효과
- 재앙 특성처럼 필드 토글로 표현되는 양쪽 특성 효과
- 수동 위력 입력이 반영된 복제 기술 객체

Derived state는 매 계산마다 새로 만들어진다. 사용자가 포켓몬을 바꾸면 이전 포켓몬에서 자동 적용된 값은 Source state에 남지 않고, 새 포켓몬 기준으로 다시 파생된다.

## CalcPokemon

`calculateDamage()`에 들어가는 공격측/방어측 포켓몬 상태다.

주요 필드:

- `pokemonIdx`: `PokemonById`를 조회하기 위한 포켓몬 id
- `ability`: 현재 계산에 사용할 특성 id
- `item`: 현재 계산에 사용할 도구 id
- `nature`: 성격 id
- `evs`: 챔피언스 능력 포인트
- `ranks`: 공격, 방어, 특공, 특방, 스피드 랭크
- `status`: 화상, 독 등 상태이상
- `tera`, `teraType`: 테라스탈 입력. 현재 챔피언스 룰에서는 `RULES.teraDisabled`로 비활성화된다.
- `pinch`, `fullHP`, `hpPct`: 저HP/풀피/현재 HP 조건. 현재 일부는 수동 플래그로 남아 있고, 향후 HP% UI로 정리할 수 있다.
- `lastMoveFailed`, `wasHit`, `fallenAllies`, `flashFireActive`: 조건부 기술/특성 계산용 전투 컨텍스트

계산 엔진은 이 객체를 읽어서 실수치, 실효 특성/도구, 실효 타입을 계산한다. 엔진 내부에서 원본 `CalcPokemon`을 변경하지 않는 것이 원칙이다.

## CalcMove

`MoveById`에서 읽어온 기술 데이터와 계산용 덮어쓰기 값을 합친 객체다.

주요 필드:

- `id`: 기술 id
- `type`: 기본 타입
- `cat`: `Physical`, `Special`, `Status`
- `bp`: 기본 위력 또는 사용자가 수동 입력한 위력
- `manualBp`: 사용자가 위력을 직접 입력했는지 나타내는 계산용 플래그
- `flags`: 접촉, 펀치, 소리, 베기 등 기술 태그
- `sec`, `recoil`, `mh`, `tgt`: 부가효과, 반동, 다단히트, 대상 범위

수동 위력은 원본 기술 데이터를 수정하지 않고, 계산 직전에 복제된 기술 객체에만 반영한다. `manualBp`가 true면 `computeVariableBp()`는 가변 위력 callback 대신 입력된 `bp`를 기준값으로 사용한다.

## CalcField

한 턴의 대미지 계산에 필요한 전장 상태다.

주요 필드:

- `weather`: 날씨
- `terrain`: 필드
- `gameType`: 싱글/더블
- `isCritical`, `isGravity`, `isTrickRoom`
- `defReflect`, `defLightScreen`, `defProtect`
- `atkHelpingHand`
- `defStealthRock`, `defSpikesLayers`
- `ruinSword`, `ruinTablet`, `ruinBeads`, `ruinVessel`
- `atkMovesFirst`, `atkMovesSecond`

선공/후공 자동 판정은 계산기의 핵심 목표가 아니므로, Bolt Beak, Fishious Rend, Payback처럼 순서 조건이 필요한 기술은 수동 조건값으로 취급한다.

## CalcResult

`calculateDamage()`의 반환값이다.

주요 필드:

- `damages`: 최종 16개 난수 롤. 다단히트 보정이 있으면 보정 후 값이다.
- `rawDamages`: 다단히트 보정 전 16개 난수 롤
- `multihitCount`: 기술 데이터의 다단히트 정보
- `minPct`, `maxPct`: 방어측 HP 대비 최소/최대 퍼센트
- `effectiveness`: 타입 상성 배율
- `moveType`: 최종 기술 타입
- `category`: 최종 물리/특수 분류
- `bp`: 최종 위력
- `atk`, `def`: 계산에 사용된 최종 공격/방어 실수치
- `defHP`: 방어측 HP
- `stab`: 자속 여부
- `mods`: 결과 카드에 간단히 보여줄 계산 근거 라벨

`mods`는 디버그용 전체 공식 로그가 아니라 사용자에게 보여줄 짧은 근거 목록이다. 자동 진입 효과는 UI 상단 요약에서 보여주고, 결과 카드에는 현재처럼 핵심 보정만 간단히 유지한다.

## 리팩토링 규칙

1. Source state는 사용자 입력만 가진다.
2. 자동 효과와 계산용 덮어쓰기는 `makeCalcState()`에서만 만든다.
3. `calculateDamage()`는 받은 계산 상태를 기준으로 결과를 만들고, 원본 UI 상태를 수정하지 않는다.
4. 기술, 특성, 도구 데이터는 Showdown 동기화 데이터가 기본값이며, 한글명과 보정은 override가 마지막에 적용된다.
5. 챔피언스 룰에서 비활성인 메커니즘은 입력은 남겨둘 수 있어도 계산에는 룰 플래그를 통해 반영하지 않는다.
