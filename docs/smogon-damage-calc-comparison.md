# Smogon Damage Calc 비교 리스트

비교 대상:

- Reference: https://github.com/Casper1123/pokemon-showdown-damage-calc
- Current: PkmChampions-Calculator

비교 목적:

- Pokemon Champions 계산기에 필요한 계산 책임을 정확히 분류한다.
- Smogon damage-calc 구조에서 참고할 부분과, Champions 룰 때문에 의도적으로 다르게 둘 부분을 구분한다.
- 이후 리팩토링 체크리스트와 골든 테스트 확장 기준으로 사용한다.

상태 표기:

- `동등`: 구조 또는 동작이 현재 목적에 맞게 대응된다.
- `부분`: 핵심은 있으나 범위, 옵션, 예외 처리가 Reference보다 좁다.
- `의도적 제외`: Champions 계산기의 목적상 지금은 제외한다.
- `예정`: 현재 룰상 비활성이지만 추후 추가 가능성이 있다.
- `검토 필요`: Champions에 필요한지 확인 후 구현 여부를 결정한다.

## 1. 아키텍처 비교

| 항목 | Reference | Current | 상태 | 메모 |
| --- | --- | --- | --- | --- |
| 계산 엔트리 | `calc/src/calc.ts`의 `calculate(gen, attacker, defender, move, field)` | `src/js/02-engine.js`의 `calculateDamage(atkSide, defSide, move, field)` | 부분 | Reference는 세대별 dispatcher, Current는 Champions 단일 룰 엔진이다. |
| 계산 입력 복제 | `attacker.clone()`, `defender.clone()`, `move.clone()`, `field.clone()` 후 계산 | `makeCalcState()`, `cloneSideForCalc()`, `cloneFieldForCalc()`로 UI 원본과 계산 상태 분리 | 동등 | Current의 자동 진입 효과 처리 방향은 Reference보다 안전하다. |
| 세대별 mechanics | `gen12`, `gen3`, `gen4`, `gen56`, `gen789`, `ndc` 분리 | Champions/Gen9 유사 단일 파일 | 의도적 제외 | Champions 전용 tool이므로 다세대 dispatcher는 필요하지 않다. |
| 계산 단계 분리 | `calculateBasePower`, `calculateAttack`, `calculateDefense`, `calculateFinalMods` 등으로 분리 | 한 파일 안에서 STAGE 1~5 주석과 블록으로 분리 | 부분 | 다음 리팩토링에서 stage별 함수 분리가 유효하다. |
| Result 모델 | `Result` class가 `range`, `fullDesc`, `moveDesc`, `recoil`, `recovery`, `kochance` 제공 | plain object + `hkoLabel`, UI 렌더링 | 부분 | 현재 간단 표시는 충분하지만, 역계산/세부조정 재개 시 Result 표준화가 유리하다. |
| 데이터 계층 | `calc/data` + `Generation` 인터페이스 | Showdown TS sync + PokeAPI KO + manual override + build-time JSON 주입 | 동등 | Current는 한국어/Champions 필터링 때문에 자체 build 계층이 필요하다. |

## 2. UI 입력 비교

| 항목 | Reference UI | Current UI | 상태 | 메모 |
| --- | --- | --- | --- | --- |
| 포켓몬 선택 | set selector + blank/custom/random set | 포켓몬 combobox | 동등 | Current 목적에는 세트보다 개별 설정 중심이 맞다. |
| 기술 선택 | 전체 move selector | 공격측 포켓몬 learnset 기반 move selector | 동등 | Champions 공식 tool 목적에는 learnset 제한이 더 적합하다. |
| 기술 위력 수동 입력 | `move-bp` input | `moveBpOverrides` + per-slot `위력` input | 동등 | 최근 반영 완료. 원본 move data는 변경하지 않는다. |
| 기술 타입 수동 입력 | `move-type` select | 없음 | 검토 필요 | Weather Ball/Terrain Pulse 등은 자동 처리. 사용자가 임의 타입을 실험할 필요가 있으면 추가 후보. |
| 기술 분류 수동 입력 | `move-cat` select | 없음 | 검토 필요 | Shell Side Arm/Photon Geyser류 예외가 늘면 필요할 수 있다. |
| 기술별 급소 | 각 move row의 crit checkbox | 전역 급소 checkbox | 부분 | Champions UX상 전역으로 충분할지 확인 필요. |
| 다단히트 수동 선택 | `move-hits` select | 자동 처리 중심 | 부분 | Skill Link/Loaded Dice/기술 데이터 기반 처리는 있으나, 사용자 수동 hit 수는 없다. |
| Metronome 연속 사용 수 | `move-times`, `metronome` select | 없음 | 검토 필요 | 메트로놈 도구를 공식 도구로 쓸 경우 필요하다. |
| 양방향 계산 | P1 -> P2, P2 -> P1 모두 계산 | 공격측 -> 방어측만 계산 | 의도적 제외 | 사용자의 명시 목표가 "공격측 결정력이 방어측에 가하는 대미지"이다. |
| 선공/후공 추천 | 최고 대미지/속도 기반 선택 | 속도 표시만 존재 | 의도적 제외 | 기술 우선도/행동 순서 판정은 메인 목표가 아니다. 단, 일부 가변 위력 플래그는 현재 speed 기반 보조값을 쓴다. |

## 3. 계산 입력 모델 비교

| 모델 | Reference 필드 | Current 필드 | 상태 | 메모 |
| --- | --- | --- | --- | --- |
| Pokemon | species, type, weight, level, ability, abilityOn, item, teraType, nature, ivs, evs, boosts, rawStats, stats, curHP, status, toxicCounter, moves | pokemonIdx, EV point, nature, ranks, status, ability, item, tera/teraType, pinch, fullHP, moves | 부분 | Current는 Champions 레벨 50/IV 31/EV point 체계로 단순화되어 있다. |
| Move | bp, type, category, flags, secondaries, target, recoil, drain, priority, hits, timesUsed, overrides, Z/Max/Stellar | move data + manual BP override + flags/sec/tgt/mh/recoil 등 build data | 부분 | Z/Max는 제외. hits/timesUsed 쪽은 추가 검토 가능. |
| Field | gameType, weather, terrain, rooms, gravity, aura, ruin, attackerSide, defenderSide | weather, terrain, gameType, critical, trick room, gravity, reflect/light screen, helping hand, protect, ruin, hazards | 부분 | Magic Room/Wonder Room/Aurora Veil/Friend Guard/Battery/Power Spot 등은 coverage matrix에서 명시 보류로 추적한다. |
| Side | hazards, screens, protect, seeded, foresight, tailwind, flower gift, friend guard, battery, power spot, switching 등 | 대부분 field 단일 플래그 또는 미지원 | 부분 | 1:1 공격 계산 목적이라 side 모델을 단순화했다. |
| Result | damage shape(number/array/multihit), range, fullDesc, moveDesc, recoil, recovery, kochance | damages/rawDamages/multihitCount/minPct/maxPct/effectiveness/moveType/category/bp/atk/def/defHP/mods | 부분 | Current 결과 모델은 UI 표시에 충분. 향후 역계산까지 고려하면 표준화 후보. |

## 4. 계산 단계별 비교

| 단계 | Reference 흐름 | Current 흐름 | 상태 | 보완 후보 |
| --- | --- | --- | --- | --- |
| Initial effects | Air Lock, Forecast, Magic Room, Wonder Room, Seed, Intimidate, Download, Intrepid Sword, Dauntless Shield, Embody, Infiltrator 등 | 자동 진입 효과에서 날씨/필드/랭크/재앙 처리. Air Lock/Cloud Nine, Neutralizing Gas, Mold Breaker 일부 처리 | 부분 | Magic/Wonder Room은 보류 추적. Seed, Forecast, Embody Aspect는 필요 여부 확인. |
| Move prelude | Weather Ball, Judgment, Techno Blast, Multi-Attack, Natural Gift, Terrain Pulse, Revelation Dance, Tera Blast, Photon Geyser 등 타입/분류 결정 | Weather Ball, Terrain Pulse, Liquid Voice, -ate, Tera Blast, Tera Starstorm, Photon Geyser 처리 | 부분 | Judgment/Techno Blast/Multi-Attack/Natural Gift/Revelation Dance/Raging Bull/Ivy Cudgel 확인. |
| Immunity/effectiveness | 타입 상성 + ability/item immunity + Ring Target + Thousand Arrows + Tera Shell 등 | Freeze-Dry, Flying Press, immunity abilities, Air Balloon, Scrappy/Mind's Eye, Tera Shell 등 | 부분 | Ring Target, Thousand Arrows, Psychic Terrain priority 차단 등은 목적에 따라 제외/검토. |
| Fixed damage | Seismic Toss, Night Shade, Dragon Rage, Sonic Boom, Final Gambit, Guardian of Alola, Nature's Madness 등 | Seismic Toss, Night Shade, Dragon Rage, Sonic Boom, Super Fang, Nature's Madness, Final Gambit, Endeavor, OHKO moves | 부분 | Guardian of Alola/Z 관련은 제외 가능. |
| Base Power | 많은 가변 위력 + ability/item/field BP mods | 명시 가변 BP 목록 + ability/item/field BP mods | 부분 | 가변 위력 누락을 golden test로 확장 필요. |
| Attack | boost, crit ignore, Unaware, Body Press/Foul Play류, ability/item atMods | rank, crit ignore, Unaware, Body Press, Foul Play, 주요 ability/item atMods, ruin | 부분 | Power Trick/Stakeout/Plus/Minus 등은 Champions 범위와 UI 조건 필요 여부 확인. |
| Defense | boost, crit ignore, Psyshock류, Unaware, weather defense, ability/item dfMods, ruin | Psyshock류, rank, crit ignore, Unaware, sand/snow defense, 주요 ability/item dfMods, ruin | 부분 | Wonder Room은 보류 추적. Flower Gift side effect 등 확인. |
| Base damage | level formula, spread, weather, crit | level 50 formula, spread, weather, crit | 동등 | Champions 레벨 고정이면 현재 방향 유지. |
| Final mods | screens, Multiscale, Fluffy, Punk Rock, Filter류, Neuroforce, Sniper, Tinted Lens, Life Orb, Expert Belt, resist berries, Protect | 대부분 주요 final mods 구현. screens/Protect는 `field-mechanics.json` 기반 | 부분 | Friend Guard/Aurora Veil은 보류 추적. Metronome, Parental Bond edge, multi-hit after-effect 확인. |
| Roll output | damage 배열/다단히트/고정 대미지 shape | 16-roll 배열 + multihit raw/summed | 동등 | Result 모델만 정리하면 좋다. |
| KO chance | Result.kochance | hkoLabel 자체 계산 | 부분 | 현재 UI 목적에는 충분. 역계산/세부조정에서 재사용성 검토. |

## 5. Current 엔진의 명시 구현 목록

### 5.1 가변 위력 기술

현재 `computeVariableBp`에서 명시 처리:

- Gyro Ball
- Electro Ball
- Heat Crash
- Heavy Slam
- Low Kick
- Grass Knot
- Eruption
- Water Spout
- Flail
- Reversal
- Hard Press
- Hex
- Infernal Parade
- Barb Barrage
- Venoshock
- Facade
- Knock Off
- Bolt Beak
- Fishious Rend
- Payback
- Avalanche
- Assurance
- Rising Voltage
- Expanding Force
- Misty Explosion
- Grav Apple
- Solar Beam
- Solar Blade
- Weather Ball
- Terrain Pulse
- Stored Power
- Power Trip
- Last Respects
- Temper Flare
- Stomping Tantrum
- Acrobatics
- Poltergeist
- Steel Roller
- Triple Axel
- Beat Up

Reference 대비 상태: `부분`.

보완 후보:

- Champions에 존재하는 공격 기술 전체를 기준으로 "가변 위력인데 위 목록에 없는 기술"을 자동 검출하는 스크립트가 필요하다.
- 수동 위력 override가 들어간 경우에는 현재처럼 가변 위력 계산을 우회하는 것이 UX상 맞다.

### 5.2 타입/상성 특수 처리

현재 명시 처리:

- Freeze-Dry
- Flying Press
- Levitate
- Water Absorb / Dry Skin / Storm Drain
- Volt Absorb / Lightning Rod / Motor Drive
- Flash Fire / Well-Baked Body
- Sap Sipper
- Earth Eater
- Soundproof
- Bulletproof
- Air Balloon
- Scrappy / Mind's Eye
- Tera Shell
- Mold Breaker / Teravolt / Turboblaze 일부 ability ignore
- Neutralizing Gas 일부 ability suppression

Reference 대비 상태: `부분`.

보완 후보:

- Ring Target
- Thousand Arrows
- Gravity와 Flying/Ground edge case 정합성
- Queenly Majesty/Dazzling/Armor Tail, Psychic Terrain의 priority 차단은 사용자가 "선공/우선도 불필요"라고 했으므로 `의도적 제외`에 가깝다.

### 5.3 자동 진입 효과

현재 명시 처리:

- 날씨: Drought, Orichalcum Pulse, Drizzle, Sand Stream, Sand Spit, Snow Warning, Desolate Land, Primordial Sea
- 필드: Electric Surge, Hadron Engine, Grassy Surge, Psychic Surge, Misty Surge
- 랭크: Intimidate, Dauntless Shield, Intrepid Sword, Download
- 재앙: Beads of Ruin, Tablets of Ruin, Sword of Ruin, Vessel of Ruin
- 수동 override: 날씨/필드/재앙 수동 변경 시 자동값보다 우선
- 계산 상태 분리: 원본 state를 직접 오염시키지 않음

Reference 대비 상태: `동등 이상` for Current UX.

보완 후보:

- Seed item boost
- Wind Rider + Tailwind
- Embody Aspect
- Forecast
- Teraform Zero는 Terastallization 도입 시 함께 검토

### 5.4 공격/BP 보정 능력

현재 명시 처리:

- Technician
- Tough Claws
- Iron Fist
- Strong Jaw
- Mega Launcher
- Sharpness
- Reckless
- Punk Rock
- Steelworker
- Steely Spirit
- Dragon's Maw
- Transistor
- Rocky Payload
- Sheer Force
- Flare Boost
- Toxic Boost
- Sand Force
- Normalize
- Aerilate / Refrigerate / Pixilate / Galvanize / Dragonize
- Analytic
- Dark Aura / Fairy Aura / Aura Break
- Supreme Overlord
- Huge Power / Pure Power
- Guts
- Water Bubble
- Purifying Salt
- Solar Power
- Flower Gift
- Orichalcum Pulse
- Hadron Engine
- Protosynthesis
- Quark Drive
- Blaze / Torrent / Overgrow / Swarm
- Defeatist
- Flash Fire active flag
- Hustle
- Gorilla Tactics

Reference 대비 상태: `부분`.

보완 후보:

- Stakeout
- Plus / Minus
- Battery / Power Spot / side Steely Spirit. Battery와 Power Spot은 더블 아군 위치 컨텍스트가 필요해 보류 추적
- Rivalry
- Flash Fire active flag의 UI 노출 여부
- Sheer Force secondary 판정의 데이터 정합성

### 5.5 방어/final 보정 능력

현재 명시 처리:

- Disguise
- Ice Face
- Battle Armor / Shell Armor
- Unaware
- Marvel Scale
- Grass Pelt
- Fur Coat
- Ice Scales
- Multiscale / Shadow Shield
- Fluffy
- Punk Rock
- Thick Fat
- Heatproof
- Dry Skin
- Filter / Prism Armor / Solid Rock
- Neuroforce
- Sniper
- Tinted Lens
- Purifying Salt
- Water Bubble
- Tera Shell
- Sturdy in fixed/OHKO handling and HKO label

Reference 대비 상태: `부분`.

보완 후보:

- Friend Guard. 더블 아군 위치 컨텍스트가 필요해 보류 추적
- Aurora Veil. 별도 사이드 스크린 상태가 필요해 보류 추적
- Wonder Guard
- Infiltrator는 screens 쪽에서 처리됨. 다른 side effect까지 필요한지 확인.
- Full HP 판정이 hazards와 함께 적용되는 edge case

### 5.6 도구 보정

현재 명시 처리:

- 타입 강화 도구류
- Plates
- Muscle Band
- Wise Glasses
- Punching Glove
- Red Orb / Blue Orb
- Adamant Orb
- Lustrous Orb
- Griseous Orb
- Choice Band
- Choice Specs
- Thick Club
- Light Ball
- Deep Sea Tooth
- Eviolite
- Assault Vest
- Metal Powder
- Deep Sea Scale
- Life Orb
- Expert Belt
- Resist berries
- Sitrus Berry / Leftovers / Poison Heal in HKO label
- Focus Sash / Sturdy in HKO label
- Loaded Dice
- Iron Ball / Choice Scarf and speed items in speed calc
- Utility Umbrella in weather damage modifier

Reference 대비 상태: `부분`.

보완 후보:

- Metronome item
- Ability Shield
- Ring Target
- Float Stone
- Clear Amulet
- Booster Energy의 소비/활성 상태는 `auto`/`active`/`inactive`로 분리 완료. Seed류 소비 모델은 후순위

## 6. 의도적 제외 또는 후순위

| 항목 | 판단 | 이유 |
| --- | --- | --- |
| 기술 우선도 기반 선공/후공 판단 | 의도적 제외 | 사용자가 공격측 결정력 계산이 목적이라고 명시했다. |
| P2 -> P1 동시 계산 | 의도적 제외 | 현재 기획은 공격측에서 방어측으로 가하는 대미지 중심이다. |
| Z-Move / Dynamax / Max Move | 의도적 제외 | Champions 공식 룰 목적과 다르다. |
| Terastallization | 예정 | 현재 Champions 룰에서는 비활성, 추후 추가 예정. |
| 세대별 계산 dispatcher | 의도적 제외 | Champions 단일 룰 계산기이므로 필요성이 낮다. |
| 자세한 계산 문장 출력 | 후순위 | 현재처럼 간단한 근거 표시만 유지한다는 방향이 정해졌다. |

## 7. 리팩토링 권장 순서

1. `CalcPokemon`, `CalcMove`, `CalcField`, `CalcResult`에 해당하는 내부 입력/출력 모델을 먼저 문서화한다.
2. `calculateDamage`를 `prelude`, `basePower`, `attack`, `defense`, `baseDamage`, `finalDamage` 함수로 나눈다.
3. Champions에 존재하는 move/ability/item만 대상으로 coverage matrix를 자동 생성한다.
4. `부분` 또는 `검토 필요` 항목을 golden test로 하나씩 고정한다.
5. UI는 계산 입력 어댑터 역할로 좁힌다. 특히 수동 위력, 자동 진입 효과, 수동 override 같은 사용자 의도는 원본 상태와 계산 상태를 계속 분리한다.
