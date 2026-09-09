# 결정력 계산기 특성·도구 전수 분류

현재 빌드에 포함된 모든 ID의 규칙과 원본 이벤트를 대조하는 목록이다. 규칙 존재는 모든 기술·환경 조합의 정확성 검증을 뜻하지 않는다. 정책과 검증 한계는 [수정 검토서](damage-purpose-review.md)를 참고한다.

생성: `node scripts/power-mechanics-audit.mjs`

## 특성 316개

| ID | 이름 | 계산기 처리 | 구현 규칙 | 원본 이벤트 |
| --- | --- | --- | --- | --- |
| adaptability | 적응력 | 직접 보정은 입력 조건에 따라 적용 | stabBoost | onModifySTAB |
| aerilate | 스카이스킨 | 직접 보정은 입력 조건에 따라 적용 | typeChange | onModifyType, onBasePower |
| aftermath | 유폭 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onDamagingHit |
| airlock | 에어록 | 특성 억제·접지·진입 등 보조 규칙 | suppressesWeather | onSwitchIn, onStart, onEnd |
| analytic | 애널라이즈 | 직접 보정은 입력 조건에 따라 적용 | bpBoosts | onBasePower |
| angerpoint | 분노의경혈 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onHit |
| angershell | 분노의껍질 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onDamage, onTryEatItem, onAfterMoveSecondary |
| anticipation | 위험예지 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onStart |
| arenatrap | 개미지옥 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onFoeTrapPokemon, onFoeMaybeTrapPokemon |
| armortail | 테일아머 | 선제 기술 차단은 카드 안내, 피해 산출 계속 | — | onFoeTryMove |
| aromaveil | 아로마베일 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onAllyTryAddVolatile |
| asoneglastrier | 혼연일체 | 특성 억제·접지·진입 등 보조 규칙 | gasExempt, blocksBerries | onStart, onEnd, onFoeTryEatItem, onSourceAfterFaint |
| asonespectrier | 혼연일체 | 특성 억제·접지·진입 등 보조 규칙 | gasExempt, blocksBerries | onStart, onEnd, onFoeTryEatItem, onSourceAfterFaint |
| aurabreak | 오라브레이크 | 특성 억제·접지·진입 등 보조 규칙 | reversesAura | onStart, onAnyTryPrimaryHit |
| baddreams | 나이트메어 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onResidual |
| ballfetch | 볼줍기 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | — |
| battery | 배터리 | 더블 필드 입력: 공격 아군 배터리 | — | onAllyBasePower |
| battlearmor | 전투무장 | 직접 보정은 입력 조건에 따라 적용 | moldBreakerIgnored, blocksCritical | — |
| battlebond | 유대변화 | 특성 억제·접지·진입 등 보조 규칙 | gasExempt | onSourceAfterFaint, onModifyMove |
| beadsofruin | 재앙의구슬 | 직접 보정은 입력 조건에 따라 적용 | ruinExemption | onStart, onAnyModifySpD |
| beastboost | 비스트부스트 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onSourceAfterFaint |
| berserk | 발끈 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onDamage, onTryEatItem, onAfterMoveSecondary |
| bigpecks | 부풀린가슴 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTryBoost |
| blaze | 맹화 | 직접 보정은 입력 조건에 따라 적용 | attackStatBoosts | onModifyAtk, onModifySpA |
| bulletproof | 방탄 | 무효·차단은 카드 안내, 피해 산출 계속 | moldBreakerIgnored, immunities | onTryHit |
| cheekpouch | 볼주머니 | 회복·반감열매 섭취 때 최대 HP 1/3 추가 회복 | — | onEatItem |
| chillingneigh | 백의울음 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onSourceAfterFaint |
| chlorophyll | 엽록소 | 직접 보정은 입력 조건에 따라 적용; 공통 실효 스피드 계산 | speedStatBoosts | onModifySpe |
| clearbody | 클리어바디 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTryBoost |
| cloudnine | 날씨부정 | 특성 억제·접지·진입 등 보조 규칙 | suppressesWeather | onSwitchIn, onStart, onEnd |
| colorchange | 변색 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onAfterMoveSecondary |
| comatose | 절대안깸 | 특성 억제·접지·진입 등 보조 규칙 | gasExempt | onStart, onSetStatus |
| commander | 사령탑 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onAnySwitchIn, onStart, onUpdate |
| competitive | 승기 | 위협 자동 적용에 특공 상승 반응 포함 | — | onAfterEachBoost |
| compoundeyes | 복안 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onSourceModifyAccuracy |
| contrary | 심술꾸러기 | 위협·그로우펀치의 자동 랭크 변화 반전 | — | onChangeBoost |
| corrosion | 부식 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | — |
| costar | 협동 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onStart |
| cottondown | 솜털 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onDamagingHit |
| cudchew | 반추 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onEatItem, onResidual |
| curiousmedicine | 기묘한약 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onStart |
| cursedbody | 저주받은바디 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onDamagingHit |
| cutecharm | 헤롱헤롱바디 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onDamagingHit |
| damp | 습기 | 자폭 계열 기술 차단은 카드 안내, 피해 산출 계속 | — | onAnyTryMove, onAnyDamage |
| dancer | 무희 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | — |
| darkaura | 다크오라 | 직접 보정은 입력 조건에 따라 적용 | aura | onStart, onAnyBasePower |
| dauntlessshield | 불굴의방패 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onStart |
| dazzling | 비비드바디 | 선제 기술 차단은 카드 안내, 피해 산출 계속 | — | onFoeTryMove |
| defeatist | 무기력 | 직접 보정은 입력 조건에 따라 적용 | attackStatBoosts | onModifyAtk, onModifySpA |
| defiant | 오기 | 위협 자동 적용에 공격 상승 반응 포함 | — | onAfterEachBoost |
| deltastream | 델타스트림 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onStart, onAnySetWeather, onEnd |
| desolateland | 끝의대지 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onStart, onAnySetWeather, onEnd |
| disguise | 탈 | 무효·차단은 카드 안내, 피해 산출 계속 | gasExempt, damageBlock | onDamage, onCriticalHit, onEffectiveness, onUpdate |
| download | 다운로드 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onStart |
| dragonize | 드래곤스킨 | 직접 보정은 입력 조건에 따라 적용 | typeChange | onModifyType, onBasePower |
| dragonsmaw | 용의턱 | 직접 보정은 입력 조건에 따라 적용 | bpBoosts | onModifyAtk, onModifySpA |
| drizzle | 잔비 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onStart |
| drought | 가뭄 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onStart |
| dryskin | 건조피부 | 무효·차단은 카드 안내, 피해 산출 계속; 직접 보정은 입력 조건에 따라 적용 | moldBreakerIgnored, immunities, defensiveFinalMods | onTryHit, onSourceBasePower, onWeather |
| earlybird | 일찍기상 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | — |
| eartheater | 흙먹기 | 무효·차단은 카드 안내, 피해 산출 계속 | moldBreakerIgnored, immunities | onTryHit |
| eelevate | 천정부지 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onSourceAfterFaint |
| effectspore | 포자 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onDamagingHit |
| electricsurge | 일렉트릭메이커 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onStart |
| electromorphosis | 전기로바꾸기 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onDamagingHit |
| embodyaspectcornerstone | 초상투영 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onStart |
| embodyaspecthearthflame | 초상투영 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onStart |
| embodyaspectteal | 초상투영 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onStart |
| embodyaspectwellspring | 초상투영 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onStart |
| emergencyexit | 위기회피 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onEmergencyExit |
| fairyaura | 페어리오라 | 직접 보정은 입력 조건에 따라 적용 | aura | onStart, onAnyBasePower |
| filter | 필터 | 직접 보정은 입력 조건에 따라 적용 | moldBreakerIgnored, defensiveFinalMods | onSourceModifyDamage |
| firemane | 불꽃의갈기 | 직접 보정은 입력 조건에 따라 적용 | attackStatBoosts | onModifyAtk, onModifySpA |
| flamebody | 불꽃몸 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onDamagingHit |
| flareboost | 열폭주 | 직접 보정은 입력 조건에 따라 적용 | bpBoosts | onBasePower |
| flashfire | 타오르는불꽃 | 무효·차단은 카드 안내, 피해 산출 계속; 직접 보정은 입력 조건에 따라 적용 | moldBreakerIgnored, immunities, attackStatBoosts | onTryHit, onEnd |
| flowergift | 플라워기프트 | 체리꼬 자신 보정; 다른 아군에 주는 보정은 별도 필드 입력 미지원; 직접 보정은 입력 조건에 따라 적용 | attackStatBoosts, defenseStatBoosts | onStart, onWeatherChange, onAllyModifyAtk, onAllyModifySpD |
| flowerveil | 플라워베일 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onAllyTryBoost, onAllySetStatus, onAllyTryAddVolatile |
| fluffy | 복슬복슬 | 직접 보정은 입력 조건에 따라 적용 | moldBreakerIgnored, defensiveFinalMods | onSourceModifyDamage |
| forecast | 기분파 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onStart, onWeatherChange |
| forewarn | 예지몽 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onStart |
| friendguard | 프렌드가드 | 더블 필드 입력: 수비 아군 프렌드가드 | — | onAnyModifyDamage |
| frisk | 통찰 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onStart |
| fullmetalbody | 메탈프로텍트 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTryBoost |
| furcoat | 퍼코트 | 직접 보정은 입력 조건에 따라 적용 | moldBreakerIgnored, defenseStatBoosts | onModifyDef |
| galewings | 질풍날개 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onModifyPriority |
| galvanize | 일렉트릭스킨 | 직접 보정은 입력 조건에 따라 적용 | typeChange | onModifyType, onBasePower |
| gluttony | 먹보 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onStart, onDamage |
| goodasgold | 황금몸 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTryHit |
| gooey | 미끈미끈 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onDamagingHit |
| gorillatactics | 무아지경 | 직접 보정은 입력 조건에 따라 적용 | attackStatBoosts | onStart, onBeforeMove, onModifyMove, onModifyAtk, onDisableMove, onEnd |
| grasspelt | 풀모피 | 직접 보정은 입력 조건에 따라 적용 | moldBreakerIgnored, defenseStatBoosts | onModifyDef |
| grassysurge | 그래스메이커 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onStart |
| grimneigh | 흑의울음 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onSourceAfterFaint |
| guarddog | 파수견 | 위협 반응 공격 상승 | — | onDragOut, onTryBoost |
| gulpmissile | 그대로꿀꺽미사일 | 특성 억제·접지·진입 등 보조 규칙 | gasExempt | onDamagingHit, onSourceTryPrimaryHit |
| guts | 근성 | 직접 보정은 입력 조건에 따라 적용 | attackStatBoosts, burnBypass | onModifyAtk |
| hadronengine | 하드론엔진 | 직접 보정은 입력 조건에 따라 적용 | attackStatBoosts | onStart, onModifySpA |
| harvest | 수확 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onResidual |
| healer | 치유의마음 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onResidual |
| heatproof | 내열 | 직접 보정은 입력 조건에 따라 적용 | moldBreakerIgnored, defensiveFinalMods | onSourceModifyAtk, onSourceModifySpA, onDamage |
| heavymetal | 헤비메탈 | 직접 보정은 입력 조건에 따라 적용 | moldBreakerIgnored, weightModifier | onModifyWeight |
| honeygather | 꿀모으기 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | — |
| hospitality | 대접 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onStart |
| hugepower | 천하장사 | 직접 보정은 입력 조건에 따라 적용 | attackStatBoosts | onModifyAtk |
| hungerswitch | 꼬르륵스위치 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onResidual |
| hustle | 의욕 | 직접 보정은 입력 조건에 따라 적용 | attackStatBoosts | onModifyAtk, onSourceModifyAccuracy |
| hydration | 촉촉바디 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onResidual |
| hypercutter | 괴력집게 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTryBoost |
| icebody | 아이스바디 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onWeather, onImmunity |
| iceface | 아이스페이스 | 무효·차단은 카드 안내, 피해 산출 계속 | gasExempt, damageBlock | onStart, onDamage, onCriticalHit, onEffectiveness, onUpdate, onWeatherChange |
| icescales | 얼음인분 | 직접 보정은 입력 조건에 따라 적용 | moldBreakerIgnored, defensiveFinalMods | onSourceModifyDamage |
| illuminate | 발광 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTryBoost, onModifyMove |
| illusion | 일루전 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onBeforeSwitchIn, onDamagingHit, onEnd, onFaint |
| immunity | 면역 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onUpdate, onSetStatus |
| imposter | 괴짜 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onSwitchIn |
| infiltrator | 틈새포착 | 특성 억제·접지·진입 등 보조 규칙 | ignoresScreens | onModifyMove |
| innardsout | 내용물분출 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onDamagingHit |
| innerfocus | 정신력 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTryAddVolatile, onTryBoost |
| insomnia | 불면 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onUpdate, onSetStatus, onTryAddVolatile |
| intimidate | 위협 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onStart |
| intrepidsword | 불요의검 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onStart |
| ironbarbs | 철가시 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onDamagingHit |
| ironfist | 철주먹 | 직접 보정은 입력 조건에 따라 적용 | bpBoosts | onBasePower |
| justified | 정의의마음 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onDamagingHit |
| keeneye | 날카로운눈 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTryBoost, onModifyMove |
| klutz | 서투름 | 특성 억제·접지·진입 등 보조 규칙 | suppressesItem | onStart |
| leafguard | 리프가드 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onSetStatus, onTryAddVolatile |
| levitate | 부유 | 무효·차단은 카드 안내, 피해 산출 계속 | moldBreakerIgnored, grounded, immunities | — |
| libero | 리베로 | 특성 억제·접지·진입 등 보조 규칙 | volatileStab | onPrepareHit |
| lightmetal | 라이트메탈 | 직접 보정은 입력 조건에 따라 적용 | moldBreakerIgnored, weightModifier | onModifyWeight |
| lightningrod | 피뢰침 | 무효·차단은 카드 안내, 피해 산출 계속 | moldBreakerIgnored, immunities | onTryHit, onAnyRedirectTarget |
| limber | 유연 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onUpdate, onSetStatus |
| lingeringaroma | 배어든냄새 | 접촉 후 후속 타격의 공격측 특성 변경 | — | onDamagingHit |
| liquidooze | 해감액 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onSourceTryHeal |
| liquidvoice | 촉촉보이스 | 직접 보정은 입력 조건에 따라 적용 | typeChange | onModifyType |
| longreach | 원격 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onModifyMove |
| magicbounce | 매직미러 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTryHit, onAllyTryHitSide |
| magicguard | 매직가드 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onDamage |
| magician | 매지션 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onAfterMoveSecondarySelf |
| magmaarmor | 마그마의무장 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onUpdate, onImmunity |
| magnetpull | 자력 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onFoeTrapPokemon, onFoeMaybeTrapPokemon |
| marvelscale | 이상한비늘 | 직접 보정은 입력 조건에 따라 적용 | moldBreakerIgnored, defenseStatBoosts | onModifyDef |
| megalauncher | 메가런처 | 직접 보정은 입력 조건에 따라 적용 | bpBoosts | onBasePower |
| megasol | 메가솔라 | 특성 억제·접지·진입 등 보조 규칙 | weatherDamageOverride, ignoreWeatherDamagePenalty | onWeatherModifyDamage |
| merciless | 무도한행동 | 특성 억제·접지·진입 등 보조 규칙 | criticalOnTargetStatus | onModifyCritRatio |
| mimicry | 의태 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onStart, onTerrainChange |
| mindseye | 심안 | 특성 억제·접지·진입 등 보조 규칙 | ignoreGhostImmunity | onTryBoost, onModifyMove |
| minus | 마이너스 | 아군 조건 수동 입력; 직접 보정은 입력 조건에 따라 적용 | attackStatBoosts | onModifySpA |
| mirrorarmor | 미러아머 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTryBoost |
| mistysurge | 미스트메이커 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onStart |
| moldbreaker | 틀깨기 | 특성 억제·접지·진입 등 보조 규칙 | ignoresTargetAbility | onStart, onModifyMove |
| moody | 변덕쟁이 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onResidual |
| motordrive | 전기엔진 | 무효·차단은 카드 안내, 피해 산출 계속 | moldBreakerIgnored, immunities | onTryHit |
| moxie | 자기과신 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onSourceAfterFaint |
| multiscale | 멀티스케일 | 직접 보정은 입력 조건에 따라 적용 | moldBreakerIgnored, defensiveFinalMods | onSourceModifyDamage |
| multitype | 멀티타입 | 특성 억제·접지·진입 등 보조 규칙 | gasExempt | — |
| mummy | 미라 | 접촉 후 후속 타격의 공격측 특성 변경 | — | onDamagingHit |
| myceliummight | 균사의힘 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onFractionalPriority, onModifyMove |
| naturalcure | 자연회복 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onSwitchOut |
| neuroforce | 브레인포스 | 직접 보정은 입력 조건에 따라 적용 | finalDamageBoosts | onModifyDamage |
| neutralizinggas | 화학변화가스 | 특성 억제·접지·진입 등 보조 규칙 | gasExempt | onSwitchIn, onEnd |
| noguard | 노가드 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onAnyInvulnerability, onAnyAccuracy |
| normalize | 노말스킨 | 직접 보정은 입력 조건에 따라 적용 | typeChange, bpBoosts | onModifyType, onBasePower |
| oblivious | 둔감 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onUpdate, onImmunity, onTryHit, onTryBoost |
| opportunist | 편승 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onFoeAfterBoost, onAnySwitchIn, onAnyAfterMega, onAnyAfterTerastallization, onAnyAfterMove, onResidual, onEnd |
| orichalcumpulse | 진홍빛고동 | 직접 보정은 입력 조건에 따라 적용 | attackStatBoosts | onStart, onModifyAtk |
| overcoat | 방진 | 무효·차단은 카드 안내, 피해 산출 계속 | moldBreakerIgnored, immunities | onImmunity, onTryHit |
| overgrow | 심록 | 직접 보정은 입력 조건에 따라 적용 | attackStatBoosts | onModifyAtk, onModifySpA |
| owntempo | 마이페이스 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onUpdate, onTryAddVolatile, onHit, onTryBoost |
| parentalbond | 부자유친 | 특성 억제·접지·진입 등 보조 규칙 | extraHitModifier | onPrepareHit, onSourceModifySecondaries |
| pastelveil | 파스텔베일 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onStart, onUpdate, onAnySwitchIn, onSetStatus, onAllySetStatus |
| perishbody | 멸망의바디 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onDamagingHit |
| pickpocket | 나쁜손버릇 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onAfterMoveSecondary |
| pickup | 픽업 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onResidual |
| piercingdrill | 관통드릴 | 특성 억제·접지·진입 등 보조 규칙 | protectBypass | onHitProtect |
| pixilate | 페어리스킨 | 직접 보정은 입력 조건에 따라 적용 | typeChange | onModifyType, onBasePower |
| plus | 플러스 | 아군 조건 수동 입력; 직접 보정은 입력 조건에 따라 적용 | attackStatBoosts | onModifySpA |
| poisonheal | 포이즌힐 | 특성의 턴 종료 회복은 제외 | residualRecovery | onDamage |
| poisonpoint | 독가시 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onDamagingHit |
| poisonpuppeteer | 독조종 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onAnyAfterSetStatus |
| poisontouch | 독수 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onSourceDamagingHit |
| powerconstruct | 스웜체인지 | 특성 억제·접지·진입 등 보조 규칙 | gasExempt | onResidual |
| powerofalchemy | 과학의힘 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onAllyFaint |
| powerspot | 파워스폿 | 더블 필드 입력: 공격 아군 파워스폿 | — | onAllyBasePower |
| prankster | 짓궂은마음 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onModifyPriority |
| pressure | 프레셔 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onStart, onDeductPP |
| primordialsea | 시작의바다 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onStart, onAnySetWeather, onEnd |
| prismarmor | 프리즘아머 | 직접 보정은 입력 조건에 따라 적용 | moldBreakerIgnored, defensiveFinalMods | onSourceModifyDamage |
| propellertail | 스크루지느러미 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onModifyMove |
| protean | 변환자재 | 특성 억제·접지·진입 등 보조 규칙 | volatileStab | onPrepareHit |
| protosynthesis | 고대활성 | 직접 보정은 입력 조건에 따라 적용 | paradoxBoost | onStart, onWeatherChange, onEnd |
| psychicsurge | 사이코메이커 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onStart |
| punkrock | 펑크록 | 직접 보정은 입력 조건에 따라 적용 | bpBoosts, defensiveFinalMods | onBasePower, onSourceModifyDamage |
| purepower | 순수한힘 | 직접 보정은 입력 조건에 따라 적용 | attackStatBoosts | onModifyAtk |
| purifyingsalt | 정화의소금 | 직접 보정은 입력 조건에 따라 적용 | moldBreakerIgnored, defensiveAttackMods | onSetStatus, onTryAddVolatile, onSourceModifyAtk, onSourceModifySpA |
| quarkdrive | 쿼크차지 | 직접 보정은 입력 조건에 따라 적용 | paradoxBoost | onStart, onTerrainChange, onEnd |
| queenlymajesty | 여왕의위엄 | 선제 기술 차단은 카드 안내, 피해 산출 계속 | — | onFoeTryMove |
| quickdraw | 퀵드로 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onFractionalPriority |
| quickfeet | 속보 | 직접 보정은 입력 조건에 따라 적용; 공통 실효 스피드 계산 | speedStatBoosts, ignoresParalysisSpeedDrop | onModifySpe |
| raindish | 젖은접시 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onWeather |
| rattled | 주눅 | 위협 반응 스피드 상승 | — | onDamagingHit, onAfterBoost |
| receiver | 리시버 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onAllyFaint |
| reckless | 이판사판 | 직접 보정은 입력 조건에 따라 적용 | bpBoosts | onBasePower |
| refrigerate | 프리즈스킨 | 직접 보정은 입력 조건에 따라 적용 | typeChange | onModifyType, onBasePower |
| regenerator | 재생력 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onSwitchOut |
| ripen | 숙성 | 직접 보정은 입력 조건에 따라 적용 | resistBerryMod | onTryHeal, onChangeBoost, onSourceModifyDamage, onTryEatItem, onEatItem |
| rivalry | 투쟁심 | 성별 조건 수동 입력; 직접 보정은 입력 조건에 따라 적용 | bpBoosts | onBasePower |
| rkssystem | AR시스템 | 특성 억제·접지·진입 등 보조 규칙 | gasExempt | — |
| rockhead | 돌머리 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onDamage |
| rockypayload | 바위나르기 | 직접 보정은 입력 조건에 따라 적용 | bpBoosts | onModifyAtk, onModifySpA |
| roughskin | 까칠한피부 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onDamagingHit |
| runaway | 도주 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | — |
| sandforce | 모래의힘 | 직접 보정은 입력 조건에 따라 적용 | bpBoosts | onBasePower, onImmunity |
| sandrush | 모래헤치기 | 직접 보정은 입력 조건에 따라 적용; 공통 실효 스피드 계산 | speedStatBoosts | onModifySpe, onImmunity |
| sandspit | 모래뿜기 | 후속 타격에 모래바람 반영 | — | onDamagingHit |
| sandstream | 모래날림 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onStart |
| sandveil | 모래숨기 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onImmunity, onModifyAccuracy |
| sapsipper | 초식 | 무효·차단은 카드 안내, 피해 산출 계속 | moldBreakerIgnored, immunities | onTryHit, onAllyTryHitSide |
| schooling | 어군 | 특성 억제·접지·진입 등 보조 규칙 | gasExempt | onStart, onResidual |
| scrappy | 배짱 | 특성 억제·접지·진입 등 보조 규칙 | ignoreGhostImmunity | onModifyMove, onTryBoost |
| screencleaner | 배리어프리 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onStart |
| seedsower | 넘치는씨앗 | 후속 타격에 그래스필드 반영 | — | onDamagingHit |
| serenegrace | 하늘의은총 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onModifyMove |
| shadowshield | 스펙터가드 | 직접 보정은 입력 조건에 따라 적용 | defensiveFinalMods | onSourceModifyDamage |
| shadowtag | 그림자밟기 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onFoeTrapPokemon, onFoeMaybeTrapPokemon |
| sharpness | 예리함 | 직접 보정은 입력 조건에 따라 적용 | bpBoosts | onBasePower |
| shedskin | 탈피 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onResidual |
| sheerforce | 우격다짐 | 직접 보정은 입력 조건에 따라 적용 | bpBoosts | onModifyMove, onBasePower |
| shellarmor | 조가비갑옷 | 직접 보정은 입력 조건에 따라 적용 | moldBreakerIgnored, blocksCritical | — |
| shielddust | 인분 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onModifySecondaries |
| shieldsdown | 리밋실드 | 특성 억제·접지·진입 등 보조 규칙 | gasExempt | onStart, onResidual, onSetStatus, onTryAddVolatile |
| simple | 단순 | 위협·그로우펀치의 자동 랭크 변화 2배 | — | onChangeBoost |
| skilllink | 스킬링크 | 특성 억제·접지·진입 등 보조 규칙 | multiHitModifier | onModifyMove |
| slowstart | 슬로스타트 | 활성 기간 수동 입력; 직접 보정은 입력 조건에 따라 적용; 공통 실효 스피드 계산 | attackStatBoosts, speedStatBoosts | onStart, onResidual, onModifyAtk, onModifySpe, onEnd |
| slushrush | 눈치우기 | 직접 보정은 입력 조건에 따라 적용; 공통 실효 스피드 계산 | speedStatBoosts | onModifySpe |
| sniper | 스나이퍼 | 직접 보정은 입력 조건에 따라 적용 | finalDamageBoosts | onModifyDamage |
| snowcloak | 눈숨기 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onImmunity, onModifyAccuracy |
| snowwarning | 눈퍼뜨리기 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onStart |
| solarpower | 선파워 | 직접 보정은 입력 조건에 따라 적용 | attackStatBoosts | onModifySpA, onWeather |
| solidrock | 하드록 | 직접 보정은 입력 조건에 따라 적용 | moldBreakerIgnored, defensiveFinalMods | onSourceModifyDamage |
| soulheart | 소울하트 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onAnyFaint |
| soundproof | 방음 | 무효·차단은 카드 안내, 피해 산출 계속 | moldBreakerIgnored, immunities | onTryHit, onAllyTryHitSide |
| speedboost | 가속 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onResidual |
| spicyspray | 하바네로분출 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onDamagingHit |
| stakeout | 잠복 | 교체 조건 수동 입력; 직접 보정은 입력 조건에 따라 적용 | attackStatBoosts | onModifyAtk, onModifySpA |
| stall | 시간벌기 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | — |
| stalwart | 굳건한신념 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onModifyMove |
| stamina | 지구력 | 같은 기술의 후속 타격에 방어 상승 반영 | — | onDamagingHit |
| stancechange | 배틀스위치 | 특성 억제·접지·진입 등 보조 규칙 | gasExempt | onModifyMove |
| static | 정전기 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onDamagingHit |
| steadfast | 불굴의마음 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onFlinch |
| steamengine | 증기기관 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onDamagingHit |
| steelworker | 강철술사 | 직접 보정은 입력 조건에 따라 적용 | bpBoosts | onModifyAtk, onModifySpA |
| steelyspirit | 강철정신 | 자신 강철 보정; 추가 아군 중첩 미지원; 직접 보정은 입력 조건에 따라 적용 | bpBoosts | onAllyBasePower |
| stench | 악취 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onModifyMove |
| stickyhold | 점착 | 특성 억제·접지·진입 등 보조 규칙 | moldBreakerIgnored, blocksItemRemoval | onTakeItem |
| stormdrain | 마중물 | 무효·차단은 카드 안내, 피해 산출 계속 | moldBreakerIgnored, immunities | onTryHit, onAnyRedirectTarget |
| strongjaw | 옹골찬턱 | 직접 보정은 입력 조건에 따라 적용 | bpBoosts | onBasePower |
| sturdy | 옹골참 | 무효·차단은 카드 안내, 피해 산출 계속; 생존은 카드 안내, KO 제한 제외 | moldBreakerIgnored, ohkoBlock, koSurvival | onTryHit, onDamage |
| suctioncups | 흡반 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onDragOut |
| superluck | 대운 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onModifyCritRatio |
| supersweetsyrup | 감미로운꿀 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onStart |
| supremeoverlord | 총대장 | 직접 보정은 입력 조건에 따라 적용 | supremeOverlord | onStart, onEnd, onBasePower |
| surgesurfer | 서핑테일 | 직접 보정은 입력 조건에 따라 적용; 공통 실효 스피드 계산 | speedStatBoosts | onModifySpe |
| swarm | 벌레의알림 | 직접 보정은 입력 조건에 따라 적용 | attackStatBoosts | onModifyAtk, onModifySpA |
| sweetveil | 스위트베일 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onAllySetStatus, onAllyTryAddVolatile |
| swiftswim | 쓱쓱 | 직접 보정은 입력 조건에 따라 적용; 공통 실효 스피드 계산 | speedStatBoosts | onModifySpe |
| swordofruin | 재앙의검 | 직접 보정은 입력 조건에 따라 적용 | ruinExemption | onStart, onAnyModifyDef |
| symbiosis | 공생 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onAllyAfterUseItem |
| synchronize | 싱크로 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onAfterSetStatus |
| tabletsofruin | 재앙의목간 | 직접 보정은 입력 조건에 따라 적용 | ruinExemption | onStart, onAnyModifyAtk |
| tangledfeet | 갈지자걸음 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onModifyAccuracy |
| tanglinghair | 컬리헤어 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onDamagingHit |
| technician | 테크니션 | 직접 보정은 입력 조건에 따라 적용 | bpBoosts | onBasePower |
| telepathy | 텔레파시 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTryHit |
| teraformzero | 제로포밍 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onAfterTerastallization |
| terashell | 테라셸 | 특성 억제·접지·진입 등 보조 규칙 | moldBreakerIgnored, teraShell | — |
| terashift | 테라체인지 | 특성 억제·접지·진입 등 보조 규칙 | gasExempt | onSwitchIn |
| teravolt | 테라볼티지 | 특성 억제·접지·진입 등 보조 규칙 | ignoresTargetAbility | onStart, onModifyMove |
| thermalexchange | 열교환 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onDamagingHit, onUpdate, onSetStatus |
| thickfat | 두꺼운지방 | 직접 보정은 입력 조건에 따라 적용 | moldBreakerIgnored, defensiveFinalMods | onSourceModifyAtk, onSourceModifySpA |
| tintedlens | 색안경 | 직접 보정은 입력 조건에 따라 적용 | finalDamageBoosts | onModifyDamage |
| torrent | 급류 | 직접 보정은 입력 조건에 따라 적용 | attackStatBoosts | onModifyAtk, onModifySpA |
| toughclaws | 단단한발톱 | 직접 보정은 입력 조건에 따라 적용 | bpBoosts | onBasePower |
| toxicboost | 독폭주 | 직접 보정은 입력 조건에 따라 적용 | bpBoosts | onBasePower |
| toxicchain | 독사슬 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onSourceDamagingHit |
| toxicdebris | 독치장 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onDamagingHit |
| trace | 트레이스 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onStart, onUpdate |
| transistor | 트랜지스터 | 직접 보정은 입력 조건에 따라 적용 | bpBoosts | onModifyAtk, onModifySpA |
| triage | 힐링시프트 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onModifyPriority |
| truant | 게으름 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onStart, onBeforeMove |
| turboblaze | 터보블레이즈 | 특성 억제·접지·진입 등 보조 규칙 | ignoresTargetAbility | onStart, onModifyMove |
| unaware | 천진 | 직접 보정은 입력 조건에 따라 적용 | moldBreakerIgnored, ignoreOffensiveBoosts, ignoreDefensiveBoosts | onAnyModifyBoost |
| unburden | 곡예 | 직접 보정은 입력 조건에 따라 적용; 공통 실효 스피드 계산 | speedStatBoosts | onAfterUseItem, onTakeItem, onEnd |
| unnerve | 긴장감 | 특성 억제·접지·진입 등 보조 규칙 | blocksBerries | onStart, onEnd, onFoeTryEatItem |
| unseenfist | 보이지않는주먹 | 특성 억제·접지·진입 등 보조 규칙 | protectBypass | onHitProtect |
| vesselofruin | 재앙의그릇 | 직접 보정은 입력 조건에 따라 적용 | ruinExemption | onStart, onAnyModifySpA |
| victorystar | 승리의별 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onAnyModifyAccuracy |
| vitalspirit | 의기양양 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onUpdate, onSetStatus, onTryAddVolatile |
| voltabsorb | 축전 | 무효·차단은 카드 안내, 피해 산출 계속 | moldBreakerIgnored, immunities | onTryHit |
| wanderingspirit | 떠도는영혼 | 접촉 후 후속 타격의 특성 교환 | — | onDamagingHit |
| waterabsorb | 저수 | 무효·차단은 카드 안내, 피해 산출 계속 | moldBreakerIgnored, immunities | onTryHit |
| waterbubble | 수포 | 직접 보정은 입력 조건에 따라 적용 | moldBreakerIgnored, attackStatBoosts, defensiveAttackMods | onSourceModifyAtk, onSourceModifySpA, onModifyAtk, onModifySpA, onUpdate, onSetStatus |
| watercompaction | 꾸덕꾸덕굳기 | 같은 물 기술의 후속 타격에 방어 상승 반영 | — | onDamagingHit |
| waterveil | 수의베일 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onUpdate, onSetStatus |
| weakarmor | 깨어진갑옷 | 같은 물리 기술의 후속 타격에 방어 하락·스피드 상승 반영 | — | onDamagingHit |
| wellbakedbody | 노릇노릇몸 | 무효·차단은 카드 안내, 피해 산출 계속 | moldBreakerIgnored, immunities | onTryHit |
| whitesmoke | 하얀연기 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTryBoost |
| wimpout | 도망태세 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onEmergencyExit |
| windpower | 풍력발전 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onDamagingHit, onSideConditionStart |
| windrider | 바람타기 | 무효·차단은 카드 안내, 피해 산출 계속 | moldBreakerIgnored, immunities | onStart, onTryHit, onSideConditionStart |
| wonderguard | 불가사의부적 | 무효·차단은 카드 안내, 피해 산출 계속 | moldBreakerIgnored, superEffectiveOnly | onTryHit |
| wonderskin | 미라클스킨 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onModifyAccuracy |
| zenmode | 달마모드 | 특성 억제·접지·진입 등 보조 규칙 | gasExempt | onResidual, onEnd |
| zerotohero | 마이티체인지 | 특성 억제·접지·진입 등 보조 규칙 | gasExempt | onSwitchOut, onSwitchIn |

## 도구 149개

| ID | 이름 | 계산기 처리 | 구현 규칙 | 원본 이벤트 |
| --- | --- | --- | --- | --- |
| abomasite | 눈설왕나이트 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTakeItem |
| absolite | 앱솔나이트 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTakeItem |
| aerodactylite | 프테라나이트 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTakeItem |
| aggronite | 보스로라나이트 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTakeItem |
| alakazite | 후디나이트 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTakeItem |
| altarianite | 파비코리나이트 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTakeItem |
| ampharosite | 전룡나이트 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTakeItem |
| aspearberry | 배리열매 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onUpdate, onEat |
| audinite | 다부니나이트 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTakeItem |
| babiriberry | 바리비열매 | 직접 피해 감소, 첫 타격 후 1회 소비 | resistBerryType | onSourceModifyDamage, onEat |
| banettite | 다크펫나이트 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTakeItem |
| barbaracite | 거북손데스나이트 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTakeItem |
| beedrillite | 독침붕나이트 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTakeItem |
| bigroot | 큰뿌리 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTryHeal |
| blackbelt | 검은띠 | 직접 보정은 입력 조건에 따라 적용 | typeBoostType | onBasePower |
| blackglasses | 검은안경 | 직접 보정은 입력 조건에 따라 적용 | typeBoostType | onBasePower |
| blastoisinite | 거북왕나이트 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTakeItem |
| blazikenite | 번치코나이트 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTakeItem |
| brightpowder | 반짝가루 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onModifyAccuracy |
| cameruptite | 폭타나이트 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTakeItem |
| chandelurite | 샹델라나이트 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTakeItem |
| charcoal | 목탄 | 직접 보정은 입력 조건에 따라 적용 | typeBoostType | onBasePower |
| charizarditex | 리자몽나이트X | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTakeItem |
| charizarditey | 리자몽나이트Y | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTakeItem |
| chartiberry | 루미열매 | 직접 피해 감소, 첫 타격 후 1회 소비 | resistBerryType | onSourceModifyDamage, onEat |
| cheriberry | 버치열매 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onUpdate, onEat |
| cherishball | 프레셔스볼 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | — |
| chesnaughtite | 브리가론나이트 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTakeItem |
| chestoberry | 유루열매 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onUpdate, onEat |
| chilanberry | 카리열매 | 직접 피해 감소, 첫 타격 후 1회 소비 | resistBerryType, resistBerryRequiresWeakness | onSourceModifyDamage, onEat |
| chimechite | 치렁나이트 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTakeItem |
| choicescarf | 구애스카프 | 직접 보정은 입력 조건에 따라 적용; 공통 실효 스피드 계산 | speedStatBoost | onStart, onModifyMove, onModifySpe |
| chopleberry | 로플열매 | 직접 피해 감소, 첫 타격 후 1회 소비 | resistBerryType | onSourceModifyDamage, onEat |
| clefablite | 픽시나이트 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTakeItem |
| cobaberry | 바코열매 | 직접 피해 감소, 첫 타격 후 1회 소비 | resistBerryType | onSourceModifyDamage, onEat |
| colburberry | 마코열매 | 직접 피해 감소, 첫 타격 후 1회 소비 | resistBerryType | onSourceModifyDamage, onEat |
| crabominite | 모단단게나이트 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTakeItem |
| damprock | 축축한바위 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | — |
| delphoxite | 마폭시나이트 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTakeItem |
| dragalgite | 드래캄나이트 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTakeItem |
| dragonfang | 용의이빨 | 직접 보정은 입력 조건에 따라 적용 | typeBoostType | onBasePower |
| dragoninite | 망나뇽나이트 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTakeItem |
| drampanite | 할비롱나이트 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTakeItem |
| eelektrossite | 저리더프나이트 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTakeItem |
| emboarite | 염무왕나이트 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTakeItem |
| excadrite | 몰드류나이트 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTakeItem |
| expertbelt | 달인의띠 | 직접 보정은 입력 조건에 따라 적용 | finalDamageBoost | onModifyDamage |
| fairyfeather | 요정의깃털 | 직접 보정은 입력 조건에 따라 적용 | typeBoostType | onBasePower |
| falinksite | 대여르나이트 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTakeItem |
| feraligite | 장크로다일나이트 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTakeItem |
| floettite | 플라엣테나이트 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTakeItem |
| focusband | 기합의머리띠 | 생존은 카드 안내, KO 제한 제외 | — | onDamage |
| focussash | 기합의띠 | 생존은 카드 안내, KO 제한 제외 | koSurvival | onDamage |
| froslassite | 눈여아나이트 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTakeItem |
| galladite | 엘레이드나이트 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTakeItem |
| garchompite | 한카리아스나이트 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTakeItem |
| gardevoirite | 가디안나이트 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTakeItem |
| gengarite | 팬텀나이트 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTakeItem |
| glalitite | 얼음귀신나이트 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTakeItem |
| glimmoranite | 킬라플로르나이트 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTakeItem |
| golurkite | 골루그나이트 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTakeItem |
| greninjite | 개굴닌자나이트 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTakeItem |
| gyaradosite | 갸라도스나이트 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTakeItem |
| habanberry | 하반열매 | 직접 피해 감소, 첫 타격 후 1회 소비 | resistBerryType | onSourceModifyDamage, onEat |
| hardstone | 딱딱한돌 | 직접 보정은 입력 조건에 따라 적용 | typeBoostType | onBasePower |
| hawluchanite | 루차불나이트 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTakeItem |
| heatrock | 뜨거운바위 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | — |
| heracronite | 헤라크로스나이트 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTakeItem |
| houndoominite | 헬가나이트 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTakeItem |
| icyrock | 차가운바위 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | — |
| ironball | 검은철구 | 직접 보정은 입력 조건에 따라 적용; 공통 실효 스피드 계산 | speedStatBoost, grounded | onEffectiveness, onModifySpe |
| kangaskhanite | 캥카나이트 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTakeItem |
| kasibberry | 수불열매 | 직접 피해 감소, 첫 타격 후 1회 소비 | resistBerryType | onSourceModifyDamage, onEat |
| kebiaberry | 으름열매 | 직접 피해 감소, 첫 타격 후 1회 소비 | resistBerryType | onSourceModifyDamage, onEat |
| kingsrock | 왕의징표석 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onModifyMove |
| leftovers | 먹다남은음식 | 생존 후 회복; KO 확률에 반영 | residualRecovery | onResidual |
| leppaberry | 과사열매 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onUpdate, onEat |
| lifeorb | 생명의구슬 | 직접 보정은 입력 조건에 따라 적용 | finalDamageBoost | onModifyDamage, onAfterMoveSecondarySelf |
| lightball | 전기구슬 | 직접 보정은 입력 조건에 따라 적용 | attackStatBoost | onModifyAtk, onModifySpA |
| lightclay | 빛의점토 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | — |
| lopunnite | 이어롭나이트 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTakeItem |
| lucarionite | 루카리오나이트 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTakeItem |
| lumberry | 리샘열매 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onAfterSetStatus, onUpdate, onEat |
| magnet | 자석 | 직접 보정은 입력 조건에 따라 적용 | typeBoostType | onBasePower |
| malamarite | 칼라마네로나이트 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTakeItem |
| manectite | 썬더볼트나이트 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTakeItem |
| mawilite | 입치트나이트 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTakeItem |
| medichamite | 요가램나이트 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTakeItem |
| meganiumite | 메가니움나이트 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTakeItem |
| mentalherb | 멘탈허브 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onUpdate |
| meowsticite | 냐오닉스나이트 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTakeItem |
| metagrossite | 메타그로스나이트 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTakeItem |
| metalcoat | 금속코트 | 직접 보정은 입력 조건에 따라 적용 | typeBoostType | onBasePower |
| metronome | 메트로놈 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onStart |
| miracleseed | 기적의씨 | 직접 보정은 입력 조건에 따라 적용 | typeBoostType | onBasePower |
| muscleband | 힘의머리띠 | 직접 보정은 입력 조건에 따라 적용 | powerBoostKind, powerBoostMod | onBasePower |
| mysticwater | 신비의물방울 | 직접 보정은 입력 조건에 따라 적용 | typeBoostType | onBasePower |
| nevermeltice | 녹지않는얼음 | 직접 보정은 입력 조건에 따라 적용 | typeBoostType | onBasePower |
| occaberry | 오카열매 | 직접 피해 감소, 첫 타격 후 1회 소비 | resistBerryType | onSourceModifyDamage, onEat |
| oranberry | 오랭열매 | 생존 후 회복; KO 확률에 반영 | hpRecovery | onUpdate, onTryEatItem, onEat |
| passhoberry | 꼬시개열매 | 직접 피해 감소, 첫 타격 후 1회 소비 | resistBerryType | onSourceModifyDamage, onEat |
| payapaberry | 야파열매 | 직접 피해 감소, 첫 타격 후 1회 소비 | resistBerryType | onSourceModifyDamage, onEat |
| pechaberry | 복슝열매 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onUpdate, onEat |
| persimberry | 시몬열매 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onUpdate, onEat |
| pidgeotite | 피죤투나이트 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTakeItem |
| pinsirite | 쁘사이저나이트 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTakeItem |
| poisonbarb | 독바늘 | 직접 보정은 입력 조건에 따라 적용 | typeBoostType | onBasePower |
| pyroarite | 화염레오나이트 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTakeItem |
| quickclaw | 선제공격손톱 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onFractionalPriority |
| raichunitex | 라이츄나이트X | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTakeItem |
| raichunitey | 라이츄나이트Y | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTakeItem |
| rawstberry | 복분열매 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onUpdate, onEat |
| rindoberry | 린드열매 | 직접 피해 감소, 첫 타격 후 1회 소비 | resistBerryType | onSourceModifyDamage, onEat |
| roseliberry | 로셀열매 | 직접 피해 감소, 첫 타격 후 1회 소비 | resistBerryType | onSourceModifyDamage, onEat |
| sablenite | 깜까미나이트 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTakeItem |
| sceptilite | 나무킹나이트 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTakeItem |
| scizorite | 핫삼나이트 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTakeItem |
| scolipite | 펜드라나이트 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTakeItem |
| scopelens | 초점렌즈 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onModifyCritRatio |
| scovillainite | 스코빌런나이트 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTakeItem |
| scraftinite | 곤율거니나이트 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTakeItem |
| sharpbeak | 예리한부리 | 직접 보정은 입력 조건에 따라 적용 | typeBoostType | onBasePower |
| sharpedonite | 샤크니아나이트 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTakeItem |
| shedshell | 아름다운허물 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTrapPokemon, onMaybeTrapPokemon |
| shellbell | 조개껍질방울 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onAfterMoveSecondarySelf |
| shucaberry | 슈캐열매 | 직접 피해 감소, 첫 타격 후 1회 소비 | resistBerryType | onSourceModifyDamage, onEat |
| silkscarf | 실크스카프 | 직접 보정은 입력 조건에 따라 적용 | typeBoostType | onBasePower |
| silverpowder | 은빛가루 | 직접 보정은 입력 조건에 따라 적용 | typeBoostType | onBasePower |
| sitrusberry | 자뭉열매 | 생존 후 회복; KO 확률에 반영 | hpRecovery | onUpdate, onTryEatItem, onEat |
| skarmorite | 무장조나이트 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTakeItem |
| slowbronite | 야도란나이트 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTakeItem |
| smoothrock | 보송보송바위 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | — |
| softsand | 부드러운모래 | 직접 보정은 입력 조건에 따라 적용 | typeBoostType | onBasePower |
| spelltag | 저주의부적 | 직접 보정은 입력 조건에 따라 적용 | typeBoostType | onBasePower |
| staraptite | 찌르호크나이트 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTakeItem |
| starminite | 아쿠스타나이트 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTakeItem |
| steelixite | 강철톤나이트 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTakeItem |
| swampertite | 대짱이나이트 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTakeItem |
| tangaberry | 리체열매 | 직접 피해 감소, 첫 타격 후 1회 소비 | resistBerryType | onSourceModifyDamage, onEat |
| twistedspoon | 휘어진스푼 | 직접 보정은 입력 조건에 따라 적용 | typeBoostType | onBasePower |
| tyranitarite | 마기라스나이트 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTakeItem |
| venusaurite | 이상해꽃나이트 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTakeItem |
| victreebelite | 우츠보트나이트 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onTakeItem |
| wacanberry | 초나열매 | 직접 피해 감소, 첫 타격 후 1회 소비 | resistBerryType | onSourceModifyDamage, onEat |
| whiteherb | 하양허브 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onStart, onAnySwitchIn, onAnyAfterMega, onAnyAfterMove, onResidual, onUse, onWhiteHerb |
| widelens | 광각렌즈 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onSourceModifyAccuracy |
| wiseglasses | 박식안경 | 직접 보정은 입력 조건에 따라 적용 | powerBoostKind, powerBoostMod | onBasePower |
| yacheberry | 플카열매 | 직접 피해 감소, 첫 타격 후 1회 소비 | resistBerryType | onSourceModifyDamage, onEat |
| zoomlens | 포커스렌즈 | 상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음 | — | onSourceModifyAccuracy |
