# Decision Log

## D017. Damage calculator 전용 레퍼런스를 구현 범위의 상한으로 둔다

결정:

- 계산 공식과 보정 순서는 Showdown 계열을 따른다.
- 구현 범위는 `pokemon-showdown` 전체 배틀 엔진이 아니라 `pokemon-showdown-damage-calc`처럼 단발 대미지 계산에 필요한 로직을 기준으로 잡는다.
- 전체 턴 진행, 우선도/스피드 자동 판정, 교체/락/PP/이전 피해량 같은 배틀 엔진 기능은 현재 계산기의 기본 범위에서 제외한다.

이유:

- 이 프로젝트의 핵심은 공격측 세팅이 방어측에게 주는 대미지 계산이다.
- 전체 배틀 엔진을 따라가면 정확도보다 상태 복잡도와 UI 부담이 먼저 커진다.
- damage calculator 전용 레퍼런스는 구현할 규칙과 덜어낼 규칙을 나누는 더 현실적인 기준이다.

영향:

- 한 번의 공격 대미지에 직접 영향을 주고 현재 상태 모델로 표현 가능한 규칙은 구현한다.
- 행동 순서, 직전 기술 실패, 대상 피격 여부, Flash Fire 활성, HP%, 쓰러진 아군 수처럼 자동 판정보다 사용자 지정이 안전한 조건은 수동 UI로 둔다.
- `counter`, `mirrorcoat`, `metalburst`, `comeuppance`, `ficklebeam`처럼 외부 전투 이력이나 랜덤 분기 표현이 필요한 기술은 보류한다.

## D018. 커버리지 판정은 코드 문자열이 아니라 mechanics 데이터까지 포함한다

결정:

- `coverage:matrix`는 소스 코드의 직접 분기뿐 아니라 `data/overrides/*-mechanics.json`과 빌드된 move/ability/item 메타데이터를 지원 근거로 본다.
- 문서에는 `code`, `mechanics`, `built-data`를 구분해 표시한다.

이유:

- 계산 메커니즘을 데이터화할수록 코드에 개별 이름이 남지 않는 것이 정상이다.
- 문자열 감지만으로 지원 여부를 판단하면 데이터화가 진행될수록 오탐이 늘어난다.

영향:

- `docs/damage-calculator-coverage-matrix.md`의 “지원 근거”는 구현 위치를 더 정확하게 보여준다.
- Body Press처럼 Showdown 원본 데이터 필드로 해결되는 항목도 “built-data” 근거로 추적할 수 있다.

## D019. HP 조건은 현재 HP%에서 파생한다

결정:

- 공격측/방어측 모두 현재 HP%를 입력한다.
- `fullHP`와 `pinch`는 별도 수동 플래그가 아니라 현재 HP%에서 파생한다.
- HKO 판정과 잔여 HP 표시는 방어측 현재 HP%를 시작 HP로 사용한다.

이유:

- Eruption, Water Spout, Final Gambit, Endeavor, Multiscale, Sturdy, Focus Sash처럼 HP 조건을 공유하는 규칙이 많다.
- `pinch` 체크박스와 `fullHP` 플래그를 따로 관리하면 같은 HP 상태를 여러 값으로 중복 입력하게 된다.
- 내구 역계산도 남은 HP%를 기반으로 설계될 예정이므로, 대미지 계산기부터 HP% 모델을 통일해야 한다.

영향:

- 공격측/방어측 패널에 현재 HP% 입력을 추가했다.
- 맹화/격류/심록/벌레의알림/무기력은 공격측 HP% 1/3 이하에서만 발동한다.
- 멀티스케일/스펙터가드/옹골참/기합의띠/탈/아이스페이스 계열은 방어측 HP% 100%에서만 풀피 조건을 만족한다.
- HP% 관련 회귀 테스트를 `scripts/damage-golden.mjs`와 `scripts/entry-effects-state.mjs`에 추가했다.

## D020. 조건 UI는 필요한 기술/특성에만 표시한다

결정:

- 조건 UI는 선택된 기술이나 공격측 특성이 필요로 할 때만 표시한다.
- Bolt Beak, Fishious Rend, Payback, Analytic처럼 행동 순서가 대미지에 영향을 주는 규칙은 현재 실속도 기준 자동 판정을 유지한다.
- 자동 판정은 숨기지 않고 조건 UI에 “실속도 기준 자동 적용”과 현재 선공/후공/동속 상태로 표시한다.
- 직전 기술 실패, 공격측 피격, 방어측 피격, Flash Fire 활성은 수동 토글로 둔다.
- 쓰러진 아군 수는 Champions 공식 룰 기준으로 싱글 0~2, 더블 0~3으로 제한한다.

이유:

- 현재 UI는 이미 실속도와 속도 판정을 보여주므로, 선공/후공 계열을 완전 수동으로 바꾸면 오히려 사용자가 같은 값을 두 번 판단해야 한다.
- 반면 직전 기술 실패나 Flash Fire 활성처럼 전투 이력이 필요한 값은 계산기가 자동으로 알 수 없으므로 사용자가 지정해야 한다.
- 조건 UI를 항상 노출하면 기본 계산 화면이 과하게 복잡해진다.

영향:

- 공격측 패널의 기술 아래에 조건 영역을 추가했다.
- Last Respects와 Supreme Overlord는 `gameType`에 따라 쓰러진 아군 수 입력 최대값을 바꾼다.
- 조건부 기술과 특성에 대한 golden test를 추가했다.

## D021. 필드/상태 보정은 field mechanics 데이터로 분리한다

결정:

- 날씨 대미지 보정, 지형 BP 보정, 스크린 보정, Protect 처리를 `data/overrides/field-mechanics.json`에 선언한다.
- 엔진은 계산 단계 순서만 유지하고, 조건별 배율과 사용자 표시 라벨은 field mechanics 데이터를 읽는다.
- Magic Room, Wonder Room, Aurora Veil처럼 현재 단발 대미지 계산기 상태 모델에 없는 규칙은 별도 보류/추가 검토 대상으로 둔다.

이유:

- 기술/특성/도구 메커니즘이 데이터화된 상태에서 필드 보정만 코드에 남으면 새 조건 추가 시 수정 위치가 다시 흩어진다.
- 필드 보정은 계산 단계상 적용 위치가 중요하므로 단계는 엔진에 남기되, 어떤 필드가 어떤 보정을 주는지는 데이터로 추적하는 편이 안전하다.

영향:

- `RULES.fieldMechanics`가 빌드 산출물에 포함된다.
- 그래스필드 지진 약화, 리플렉터, Protect 차단 케이스를 golden test로 고정했다.
- `field-mechanics.json`은 현재 단발 대미지에 직접 필요한 범위부터 담는다.

## D022. 참조 구현의 핵심 예외를 golden test로 고정한다

결정:

- Showdown damage calculator에서 중요한 계산 축은 구현 여부만 표시하지 않고 golden test로 고정한다.
- 우선 Tera Shell, Mold Breaker, 타입 변경 특성, Paradox 계열, OHKO/Sturdy 상호작용을 테스트한다.
- Champions 데이터에 없는 기술은 optional metadata 검증으로 두고, 현재 데이터에 있는 계산 경로부터 고정한다.

이유:

- 데이터화가 진행될수록 코드 구조는 바뀌기 쉬우므로 결과 회귀 테스트가 더 중요하다.
- Mold Breaker와 방어 특성, 타입 변경과 STAB/BP, OHKO와 생존 특성은 작은 순서 차이로 결과가 크게 달라진다.

영향:

- `scripts/damage-golden.mjs`에 Tera Shell, Mold Breaker, Pixilate, Liquid Voice, Protosynthesis, Quark Drive, Sheer Cold, Sturdy 케이스를 추가했다.
- 다음 계산 로직 리팩토링은 이 케이스들을 기준으로 결과 유지 여부를 확인한다.

## D023. 범위 밖 필드/상태도 coverage matrix에서 보류로 추적한다

결정:

- `coverage:matrix`는 기술/특성/도구뿐 아니라 필드/상태 후보도 추적한다.
- 날씨 대미지, 지형 BP, 스크린, Protect는 `field-mechanics.json` 기반 지원으로 표시한다.
- Magic Room, Wonder Room, Aurora Veil, Friend Guard, Battery, Power Spot은 명시 보류로 표시한다.

이유:

- 현재 단발 대미지 계산기 모델에 넣지 않는 규칙도 문서에서 사라지면 나중에 다시 같은 판단을 반복하게 된다.
- Magic Room/Wonder Room은 도구 또는 방어/특방 의미를 전역으로 바꾸는 상태라 현재 source/derived 계산 상태만으로 표현하기 어렵다.
- Aurora Veil은 리플렉터/빛의장막과 별개인 사이드 스크린 상태가 필요하다.
- Friend Guard/Battery/Power Spot은 더블의 아군 위치와 사이드 컨텍스트가 필요하다.

영향:

- `data/overrides/coverage-candidates.json`에 field 후보 범위를 추가했다.
- `scripts/coverage-matrix.mjs`는 field mechanics 지원 항목과 보류 항목을 같은 생성 문서에 표시한다.
- `docs/damage-calculator-coverage-matrix.md`의 보류 요약과 필드/상태 매트릭스에서 해당 항목을 확인할 수 있다.

## D024. 결과 카드 보정 라벨은 짧은 사용자용 표시로 제한한다

결정:

- 결과 카드의 `mods`는 상세 공식 로그가 아니라 사용자용 짧은 보정 라벨로 취급한다.
- 배율은 `×1.3`처럼 소수 둘째 자리 이내의 짧은 형식으로 표시한다.
- 차단, 급소, 고정 대미지 같은 공통 라벨은 한국어로 정리한다.
- 카드에는 중복 제거 후 최대 6개 라벨만 표시하고, 전체 목록은 hover 제목에 남긴다.

이유:

- 사용자는 결과 카드에서 계산 흐름 전체보다 핵심 보정 유무를 빠르게 확인하는 편이 중요하다.
- 모든 modifier를 그대로 노출하면 라벨이 길어져 모바일 카드와 결과 비교성이 나빠진다.
- 자동 진입 효과는 이미 상단 요약에 표시되므로 결과 카드가 같은 정보를 길게 반복할 필요가 없다.

영향:

- `src/js/02-engine.js`에 보정 배율/이름 포맷 헬퍼를 추가했다.
- `src/js/03-calc-ui.js`는 `mods`를 중복 제거하고 앞 6개만 렌더링한다.
- 전체 라벨 목록은 `title` 속성으로 유지한다.

## D025. Booster Energy는 도구 보유와 발동 상태를 분리한다

결정:

- CalcPokemon에 `boosterEnergyState`를 둔다.
- 값은 `auto`, `active`, `inactive` 세 가지다.
- `auto`는 기존 편의 동작을 유지해 도구 데이터에 `paradoxActivation`이 있으면 발동한다.
- `active`는 Booster Energy를 이미 소모했지만 Protosynthesis/Quark Drive 부스트가 남아 있는 상태를 표현한다.
- `inactive`는 도구 보유와 별개로 Paradox 부스트가 꺼진 상태를 비교한다.

이유:

- Booster Energy는 전투 중 소모되는 도구라 "현재 들고 있는 도구"와 "이미 발동한 효과"가 다를 수 있다.
- 대미지 계산기는 단발 계산 도구이므로 도구 소비 과정을 시뮬레이션하기보다 현재 발동 상태를 사용자가 지정하는 편이 안전하다.
- 기존 자동 효과 방향과 마찬가지로 기본값은 편의성을 유지하되, 수동 비교가 가능해야 한다.

영향:

- 공격측과 방어측 모두 조건 UI에서 Booster Energy 상태를 지정할 수 있다.
- `calculateDamage()`는 날씨/필드 발동과 별개로 `boosterEnergyState`를 확인한다.
- `scripts/damage-golden.mjs`에 공격측 활성/비활성, 방어측 방어 부스트 케이스를 추가했다.

## D012. 계산 메커니즘은 코드 분기보다 데이터 메타데이터를 우선한다

결정:

- 기술, 특성, 아이템의 계산 차이는 가능한 한 `data/overrides/*-mechanics.json`에 선언한다.
- 엔진은 개별 이름을 직접 비교하기보다 `AbilityById`, `ItemById`, `MoveById`에 병합된 메타데이터를 읽어 처리한다.
- Champions 사양이 Showdown과 다를 수 있으므로, 데이터 선언은 Champions 동작을 우선한다.

이유:

- Showdown / showdown calculator의 처리 방식을 참고하되, 프로젝트 내부에서는 새 기술/특성/아이템을 추가할 때 코드 수정량을 줄여야 한다.
- 이름 기반 분기가 늘어나면 누락, Mold Breaker/Neutralizing Gas 같은 예외 처리, UI 추정치와 엔진 계산의 불일치가 쉽게 생긴다.
- 데이터화하면 golden test와 coverage matrix가 계산 지원 범위를 더 명확히 추적할 수 있다.

적용된 예:

- `Klutz` → `suppressesItem`
- `Sticky Hold` → `blocksItemRemoval`
- `Iron Ball` / `Air Balloon` → `grounded`, `groundImmunity`
- `Utility Umbrella` → `ignoresWeatherDamageModifiers`
- Ruin 계열 → `ruinExemption`
- Mold Breaker 계열 → `ignoresTargetAbility`
- Tera Shell/Sturdy/Shell Armor/Skill Link/Parental Bond 등 → ability metadata
- 날씨/필드/스크린/Protect → `field-mechanics.json`

검증:

- `npm.cmd test`
- `npm.cmd run coverage:matrix`

이 문서는 리팩토링 과정에서 확정한 중요한 결정과 이유를 기록한다.

## D001. 대미지 계산기 탭을 최우선 리팩토링 대상으로 둔다

결정:

- 대미지 계산기 탭을 먼저 안정화한다.
- 도감, 노력치 세부조정, 내구 역계산은 이후 단계로 둔다.

이유:

- 프로젝트의 핵심 기능이 공격측/방어측 세팅 기반 대미지 계산이다.
- 세부조정과 내구 역계산도 결국 대미지 계산 상태와 엔진을 재사용해야 한다.
- 계산기 탭의 상태 구조가 불안정하면 다른 기능도 함께 흔들린다.

영향:

- 현재 리팩토링 문서와 테스트는 대미지 계산기를 중심으로 작성한다.

## D002. Showdown 기반 계산 로직을 유지한다

결정:

- 계산 로직은 `smogon/pokemon-showdown` 및 Showdown damage calc의 구조를 기준으로 한다.
- 단, Champions 룰에 맞는 차이는 별도로 반영한다.

이유:

- Showdown은 검증된 포켓몬 계산 로직의 사실상 표준이다.
- 직접 공식을 새로 만들면 회귀 위험이 커진다.

영향:

- `calculateDamage()`는 Gen 9 공식 흐름에 맞춰 단계화한다.
- 골든 테스트로 현재 결과를 보호한다.

## D003. 전체 행동 순서/우선도 계산은 제외한다

결정:

- 계산기는 공격측 포켓몬의 기술이 방어측에게 주는 대미지를 계산한다.
- 기술 우선도, 트릭룸, 차단 특성까지 포함하는 전체 행동 순서 판정은 핵심 기능으로 넣지 않는다.
- Bolt Beak, Fishious Rend, Payback처럼 현재 실속도 비교가 곧 대미지 조건이 되는 항목은 자동 판정하되 UI에 명시한다.

이유:

- 사용자는 특정 공격이 들어갔을 때의 대미지를 알고 싶다.
- 전체 선공/후공 판정은 스피드, 우선도, 필드, 특성, 아이템, 트릭룸 등 별도 시스템이 필요하다.
- 하지만 이미 계산기가 실속도와 속도 결과를 보여주므로, 단순 실속도 조건까지 수동 입력으로 돌리면 사용자가 같은 판단을 두 번 해야 한다.

영향:

- `boltbeak`, `fishiousrend`, `payback`은 실속도 기준 자동 판정 상태를 조건 UI에 표시한다.
- Queenly Majesty/Dazzling/Armor Tail, Psychic Terrain priority block처럼 우선도 차단 시스템은 현재 보류한다.

## D004. 테라스탈은 현재 비활성으로 유지한다

결정:

- 현재 Champions 룰에서는 테라스탈을 계산에 반영하지 않는다.
- 차후 추가 가능성을 고려해 필드와 함수 구조는 유지한다.

이유:

- 현재 룰과 맞지 않는 기능을 켜두면 사용자 계산이 틀릴 수 있다.
- 하지만 향후 추가 가능성이 높으므로 구조를 완전히 제거하면 다시 구현 비용이 커진다.

영향:

- `RULES.teraDisabled`가 true이면 `isTeraActive()`는 false 취급한다.
- 골든 테스트에서 테라 입력이 있어도 계산에 반영되지 않음을 확인한다.

## D005. 자동 진입 효과는 유지한다

결정:

- 가뭄, 위협, 다운로드, 재앙 등 자동 진입 효과는 유지한다.

이유:

- 사용자의 누락 실수를 줄인다.
- 포켓몬 선택 후 별도 필드 조작을 줄일 수 있다.
- 실전 계산 도구로서 사용성이 좋아진다.

영향:

- 자동 진입 효과 요약을 UI 상단에 표시한다.
- 자동 효과가 적용됐다는 사실을 결과 카드의 상세 공식 로그로 풀어 쓰지는 않는다.

## D006. 자동 효과는 source state를 직접 변경하지 않는다

결정:

- 자동 효과는 `makeCalcState()`에서 계산 직전에 derived state로만 적용한다.

이유:

- 자동 쾌청이 source weather를 바꾸면, 사용자가 다른 포켓몬으로 바꿨을 때 이전 자동값이 남을 수 있다.
- 사용자가 자동 효과가 꺼진 상황을 계산하고 싶을 때 수동 override와 충돌한다.

영향:

- source state는 사용자 입력만 가진다.
- derived state는 매 계산마다 새로 만든다.
- 상태 테스트로 source state 불변성을 검증한다.

## D007. 수동 입력은 자동 효과보다 우선한다

결정:

- 사용자가 날씨, 필드, 재앙 등을 수동 변경하면 수동 값이 우선한다.

이유:

- 자동 효과는 편의 기능이지 강제 기능이 아니다.
- 사용자는 쾌청이 꺼진 상황이나 재앙이 없는 상황도 비교해야 한다.

영향:

- 수동 override 추적 상태가 필요하다.
- 포켓몬 변경 시 자동 적용값은 source state 기준으로 reset한 뒤 새로 계산한다.

## D008. 계산 근거 표시는 간단하게 유지한다

결정:

- 결과 카드에는 현재처럼 간단한 보정 근거만 보여준다.
- 전체 공식이나 모든 modifier를 자세히 보여주는 UI는 만들지 않는다.

이유:

- 사용자는 빠르게 결과를 보고 싶다.
- 자동 진입 효과는 상단 요약으로 충분하다.
- 자세한 공식 패널은 UI 복잡도를 크게 올린다.

영향:

- `mods`는 디버그 trace가 아니라 사용자용 짧은 라벨 목록으로 취급한다.

## D009. 기술 위력 수동 입력을 지원한다

결정:

- 공격측 기술 슬롯마다 위력을 수동 입력할 수 있게 한다.

이유:

- 사용자가 특수 조건이나 패치 전후 위력을 직접 비교할 수 있다.
- 모든 조건부 위력을 UI로 만들기 전에도 임시 계산이 가능하다.

영향:

- move data 원본은 수정하지 않는다.
- 계산용 복제 move에 `manualBp`와 `bp`를 넣는다.
- `manualBp`가 true이면 `computeVariableBp()`의 가변 위력 계산을 우회한다.

## D010. manual override는 PokeAPI 자동 데이터보다 나중에 적용한다

결정:

- 한글명/설명 manual override는 항상 자동 데이터보다 우선한다.

이유:

- PokeAPI는 갱신이 느리고 누락 데이터가 존재한다.
- Champions 전용 또는 최신 데이터는 수동 보정이 필요하다.

영향:

- build 단계에서 자동 데이터 로드 후 manual override를 적용한다.
- 수동 override 누락이나 적용 순서를 검증 대상으로 둔다.

## D011. Showdown Champions custom 데이터는 현재 삭제하지 않는다

결정:

- 현재 custom으로 표시된 데이터는 임의 삭제하지 않는다.

이유:

- Showdown Champions mod가 나중에 업데이트되면 다시 반영될 수 있다.
- 지금 삭제하면 이후 동기화에서 다시 생겨 관리 비용이 커질 수 있다.

영향:

- 공식/비공식 필터링은 나중에 upstream 데이터 정책이 더 명확해진 뒤 검토한다.

## D012. 골든 테스트를 계산 엔진 변경의 안전장치로 둔다

결정:

- 계산 로직 수정 시 `scripts/damage-golden.mjs`를 확장한다.

이유:

- Showdown 기반 계산 로직은 작은 순서 차이로 결과가 바뀔 수 있다.
- 리팩토링 중 계산값이 바뀌었는지 즉시 확인해야 한다.

영향:

- 현재 주요 특성, 도구, 날씨, 필드, 가변 위력, 수동 위력 케이스가 골든 테스트에 들어 있다.

## D013. 계산 지원 범위는 자동 생성 문서로 추적한다

결정:

- Champions 데이터 기준 계산 지원 상태를 `coverage:matrix`로 생성한다.

이유:

- 데이터가 Showdown에서 갱신되면 지원해야 할 후보도 바뀔 수 있다.
- 수동 문서만으로는 누락 추적이 어렵다.

영향:

- `scripts/coverage-matrix.mjs`를 추가했다.
- `docs/damage-calculator-coverage-matrix.md`는 생성물로 취급한다.

## D014. Body Press는 단발 대미지 계산 범위에 포함한다

결정:

- `bodypress`는 현재 계산 로직 지원 범위에 포함한다.
- 구현은 Showdown 원본 move data의 `overrideOffensiveStat: "def"`를 읽어 처리한다.

이유:

- 현재 Champions learnset에 존재한다.
- 단발 대미지 계산기 범위에 자연스럽게 들어온다.
- 이전 피해량이나 랜덤 분기 같은 복잡한 외부 컨텍스트가 필요하지 않다.

영향:

- 공격측 방어 실수치와 방어 랭크를 공격값으로 사용한다.
- golden test로 회귀를 확인한다.

## D015. 이전 피해량 기반 기술은 보류한다

결정:

- `counter`, `mirrorcoat`, `metalburst`, `comeuppance`는 현재 보류한다.

이유:

- 정확한 계산에는 직전 피해량과 받은 공격 타입/분류 컨텍스트가 필요하다.
- 현재 대미지 계산기는 한 번의 공격을 계산하는 도구다.

영향:

- 내구 역계산이나 전투 이력 도구를 설계할 때 다시 검토한다.

## D016. Fickle Beam은 보류한다

결정:

- `ficklebeam`은 현재 보류한다.

이유:

- 랜덤 강화 분기를 UI와 결과 표시에서 어떻게 표현할지 별도 결정이 필요하다.

영향:

- 커버리지 매트릭스에는 보류 항목으로 남긴다.
