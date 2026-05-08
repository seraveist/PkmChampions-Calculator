# Damage Calculator Coverage Matrix

이 문서는 `npm run coverage:matrix`로 생성된다. 직접 수정하지 말고 스크립트의 후보 목록이나 계산 엔진을 수정한 뒤 다시 생성한다.

범위는 현재 빌드된 Champions 데이터 기준이다.

| 범위 | 개수 |
| --- | ---: |
| 챔피언스 포켓몬 | 272 |
| 챔피언스 learnset 기술 | 490 |
| 챔피언스 포켓몬이 보유한 특성 | 192 |
| 챔피언스 도구 데이터 | 118 |
| 추적 후보 기술 | 58 |
| 추적 후보 특성 | 66 |
| 추적 후보 도구 | 40 |

## 점검 필요 요약

| 종류 | 그룹 | 항목 | 판정 | 비고 |
| --- | --- | --- | --- | --- |
| ability | 공격/BP/방어 보정 | 애널라이즈 (analytic) | 코드 감지 실패 |  |
| ability | 공격/BP/방어 보정 | 맹화 (blaze) | 코드 감지 실패 |  |
| ability | 공격/BP/방어 보정 | 퍼코트 (furcoat) | 코드 감지 실패 |  |
| ability | 공격/BP/방어 보정 | 근성 (guts) | 코드 감지 실패 |  |
| ability | 공격/BP/방어 보정 | 천하장사 (hugepower) | 코드 감지 실패 |  |
| ability | 공격/BP/방어 보정 | 의욕 (hustle) | 코드 감지 실패 |  |
| ability | 공격/BP/방어 보정 | 철주먹 (ironfist) | 코드 감지 실패 |  |
| ability | 공격/BP/방어 보정 | 이상한비늘 (marvelscale) | 코드 감지 실패 |  |
| ability | 공격/BP/방어 보정 | 메가런처 (megalauncher) | 코드 감지 실패 |  |
| ability | 공격/BP/방어 보정 | 심록 (overgrow) | 코드 감지 실패 |  |
| ability | 공격/BP/방어 보정 | 순수한힘 (purepower) | 코드 감지 실패 |  |
| ability | 공격/BP/방어 보정 | 이판사판 (reckless) | 코드 감지 실패 |  |
| ability | 공격/BP/방어 보정 | 모래의힘 (sandforce) | 코드 감지 실패 |  |
| ability | 공격/BP/방어 보정 | 예리함 (sharpness) | 코드 감지 실패 |  |
| ability | 공격/BP/방어 보정 | 우격다짐 (sheerforce) | 코드 감지 실패 |  |
| ability | 공격/BP/방어 보정 | 선파워 (solarpower) | 코드 감지 실패 |  |
| ability | 공격/BP/방어 보정 | 옹골찬턱 (strongjaw) | 코드 감지 실패 |  |
| ability | 공격/BP/방어 보정 | 총대장 (supremeoverlord) | 코드 감지 실패 |  |
| ability | 공격/BP/방어 보정 | 벌레의알림 (swarm) | 코드 감지 실패 |  |
| ability | 공격/BP/방어 보정 | 테크니션 (technician) | 코드 감지 실패 |  |
| ability | 공격/BP/방어 보정 | 급류 (torrent) | 코드 감지 실패 |  |
| ability | 공격/BP/방어 보정 | 단단한발톱 (toughclaws) | 코드 감지 실패 |  |
| ability | 공격/BP/방어 보정 | 천진 (unaware) | 코드 감지 실패 |  |
| ability | 날씨/특성 통제 | 날씨부정 (cloudnine) | 코드 감지 실패 |  |
| ability | 날씨/특성 통제 | 틀깨기 (moldbreaker) | 코드 감지 실패 |  |
| ability | 대미지 보정 | 페어리오라 (fairyaura) | 코드 감지 실패 |  |
| ability | 대미지 보정 | 필터 (filter) | 코드 감지 실패 |  |
| ability | 대미지 보정 | 내열 (heatproof) | 코드 감지 실패 |  |
| ability | 대미지 보정 | 멀티스케일 (multiscale) | 코드 감지 실패 |  |
| ability | 대미지 보정 | 정화의소금 (purifyingsalt) | 코드 감지 실패 |  |
| ability | 대미지 보정 | 스나이퍼 (sniper) | 코드 감지 실패 |  |
| ability | 대미지 보정 | 하드록 (solidrock) | 코드 감지 실패 |  |
| ability | 대미지 보정 | 두꺼운지방 (thickfat) | 코드 감지 실패 |  |
| ability | 대미지 보정 | 수포 (waterbubble) | 코드 감지 실패 |  |
| ability | 면역/상성 | 방탄 (bulletproof) | 코드 감지 실패 |  |
| ability | 면역/상성 | 건조피부 (dryskin) | 코드 감지 실패 |  |
| ability | 면역/상성 | 흙먹기 (eartheater) | 코드 감지 실패 |  |
| ability | 면역/상성 | 타오르는불꽃 (flashfire) | 코드 감지 실패 |  |
| ability | 면역/상성 | 부유 (levitate) | 코드 감지 실패 |  |
| ability | 면역/상성 | 피뢰침 (lightningrod) | 코드 감지 실패 |  |
| ability | 면역/상성 | 전기엔진 (motordrive) | 코드 감지 실패 |  |
| ability | 면역/상성 | 초식 (sapsipper) | 코드 감지 실패 |  |
| ability | 면역/상성 | 방음 (soundproof) | 코드 감지 실패 |  |
| ability | 면역/상성 | 축전 (voltabsorb) | 코드 감지 실패 |  |
| ability | 면역/상성 | 저수 (waterabsorb) | 코드 감지 실패 |  |
| ability | 방어 예외/아이템 상호작용 | 탈 (disguise) | 코드 감지 실패 |  |
| ability | 방어 예외/아이템 상호작용 | 헤비메탈 (heavymetal) | 코드 감지 실패 |  |
| ability | 방어 예외/아이템 상호작용 | 서투름 (klutz) | 코드 감지 실패 |  |
| ability | 방어 예외/아이템 상호작용 | 라이트메탈 (lightmetal) | 코드 감지 실패 |  |
| ability | 방어 예외/아이템 상호작용 | 숙성 (ripen) | 코드 감지 실패 |  |
| ability | 방어 예외/아이템 상호작용 | 조가비갑옷 (shellarmor) | 코드 감지 실패 |  |
| ability | 방어 예외/아이템 상호작용 | 점착 (stickyhold) | 코드 감지 실패 |  |
| ability | 방어 예외/아이템 상호작용 | 옹골참 (sturdy) | 코드 감지 실패 |  |
| item | 공격/방어 실수치 보정 | 전기구슬 (lightball) | 코드 감지 실패 |  |
| item | 반감 열매 | 바리비열매 (babiriberry) | 코드 감지 실패 | Unnerve/As One/Ripen 반영 |
| item | 반감 열매 | 루미열매 (chartiberry) | 코드 감지 실패 | Unnerve/As One/Ripen 반영 |
| item | 반감 열매 | 카리열매 (chilanberry) | 코드 감지 실패 | Unnerve/As One/Ripen 반영 |
| item | 반감 열매 | 로플열매 (chopleberry) | 코드 감지 실패 | Unnerve/As One/Ripen 반영 |
| item | 반감 열매 | 바코열매 (cobaberry) | 코드 감지 실패 | Unnerve/As One/Ripen 반영 |
| item | 반감 열매 | 마코열매 (colburberry) | 코드 감지 실패 | Unnerve/As One/Ripen 반영 |
| item | 반감 열매 | 하반열매 (habanberry) | 코드 감지 실패 | Unnerve/As One/Ripen 반영 |
| item | 반감 열매 | 수불열매 (kasibberry) | 코드 감지 실패 | Unnerve/As One/Ripen 반영 |
| item | 반감 열매 | 으름열매 (kebiaberry) | 코드 감지 실패 | Unnerve/As One/Ripen 반영 |
| item | 반감 열매 | 오카열매 (occaberry) | 코드 감지 실패 | Unnerve/As One/Ripen 반영 |
| item | 반감 열매 | 꼬시개열매 (passhoberry) | 코드 감지 실패 | Unnerve/As One/Ripen 반영 |
| item | 반감 열매 | 야파열매 (payapaberry) | 코드 감지 실패 | Unnerve/As One/Ripen 반영 |
| item | 반감 열매 | 린드열매 (rindoberry) | 코드 감지 실패 | Unnerve/As One/Ripen 반영 |
| item | 반감 열매 | 로셀열매 (roseliberry) | 코드 감지 실패 | Unnerve/As One/Ripen 반영 |
| item | 반감 열매 | 슈캐열매 (shucaberry) | 코드 감지 실패 | Unnerve/As One/Ripen 반영 |
| item | 반감 열매 | 리체열매 (tangaberry) | 코드 감지 실패 | Unnerve/As One/Ripen 반영 |
| item | 반감 열매 | 초나열매 (wacanberry) | 코드 감지 실패 | Unnerve/As One/Ripen 반영 |
| item | 반감 열매 | 플카열매 (yacheberry) | 코드 감지 실패 | Unnerve/As One/Ripen 반영 |
| item | 타입 위력 보정 | 검은띠 (blackbelt) | 코드 감지 실패 |  |
| item | 타입 위력 보정 | 검은안경 (blackglasses) | 코드 감지 실패 |  |
| item | 타입 위력 보정 | 목탄 (charcoal) | 코드 감지 실패 |  |
| item | 타입 위력 보정 | 용의이빨 (dragonfang) | 코드 감지 실패 |  |
| item | 타입 위력 보정 | 요정의깃털 (fairyfeather) | 코드 감지 실패 |  |
| item | 타입 위력 보정 | 딱딱한돌 (hardstone) | 코드 감지 실패 |  |
| item | 타입 위력 보정 | 자석 (magnet) | 코드 감지 실패 |  |
| item | 타입 위력 보정 | 금속코트 (metalcoat) | 코드 감지 실패 |  |
| item | 타입 위력 보정 | 기적의씨 (miracleseed) | 코드 감지 실패 |  |
| item | 타입 위력 보정 | 신비의물방울 (mysticwater) | 코드 감지 실패 |  |
| item | 타입 위력 보정 | 녹지않는얼음 (nevermeltice) | 코드 감지 실패 |  |
| item | 타입 위력 보정 | 독바늘 (poisonbarb) | 코드 감지 실패 |  |
| item | 타입 위력 보정 | 예리한부리 (sharpbeak) | 코드 감지 실패 |  |
| item | 타입 위력 보정 | 실크스카프 (silkscarf) | 코드 감지 실패 |  |
| item | 타입 위력 보정 | 은빛가루 (silverpowder) | 코드 감지 실패 |  |
| item | 타입 위력 보정 | 부드러운모래 (softsand) | 코드 감지 실패 |  |
| item | 타입 위력 보정 | 저주의부적 (spelltag) | 코드 감지 실패 |  |
| item | 타입 위력 보정 | 휘어진스푼 (twistedspoon) | 코드 감지 실패 |  |
| item | KO 추정 | 기합의띠 (focussash) | 코드 감지 실패 | hkoLabel()/simulateKO()에서 처리 |
| item | KO 추정 | 먹다남은음식 (leftovers) | 코드 감지 실패 | hkoLabel()/simulateKO()에서 처리 |
| item | KO 추정 | 자뭉열매 (sitrusberry) | 코드 감지 실패 | hkoLabel()/simulateKO()에서 처리 |
| move | 가변 위력 | 애크러뱃 (acrobatics) | 코드 감지 실패 | computeVariableBp()에서 처리 |
| move | 가변 위력 | 승부굳히기 (assurance) | 코드 감지 실패 | computeVariableBp()에서 처리 |
| move | 가변 위력 | 눈사태 (avalanche) | 코드 감지 실패 | computeVariableBp()에서 처리 |
| move | 가변 위력 | 집단구타 (beatup) | 코드 감지 실패 | computeVariableBp()에서 처리 |
| move | 가변 위력 | 일렉트릭볼 (electroball) | 코드 감지 실패 | computeVariableBp()에서 처리 |
| move | 가변 위력 | 분화 (eruption) | 코드 감지 실패 | computeVariableBp()에서 처리 |
| move | 가변 위력 | 와이드포스 (expandingforce) | 코드 감지 실패 | computeVariableBp()에서 처리 |
| move | 가변 위력 | 객기 (facade) | 코드 감지 실패 | computeVariableBp()에서 처리 |
| move | 가변 위력 | 바둥바둥 (flail) | 코드 감지 실패 | computeVariableBp()에서 처리 |
| move | 가변 위력 | 풀묶기 (grassknot) | 코드 감지 실패 | computeVariableBp()에서 처리 |
| move | 가변 위력 | G의힘 (gravapple) | 코드 감지 실패 | computeVariableBp()에서 처리 |
| move | 가변 위력 | 자이로볼 (gyroball) | 코드 감지 실패 | computeVariableBp()에서 처리 |
| move | 가변 위력 | 하드프레스 (hardpress) | 코드 감지 실패 | computeVariableBp()에서 처리 |
| move | 가변 위력 | 히트스탬프 (heatcrash) | 코드 감지 실패 | computeVariableBp()에서 처리 |
| move | 가변 위력 | 헤비봄버 (heavyslam) | 코드 감지 실패 | computeVariableBp()에서 처리 |
| move | 가변 위력 | 병상첨병 (hex) | 코드 감지 실패 | computeVariableBp()에서 처리 |
| move | 가변 위력 | 백귀야행 (infernalparade) | 코드 감지 실패 | computeVariableBp()에서 처리 |
| move | 가변 위력 | 성묘 (lastrespects) | 코드 감지 실패 | computeVariableBp()에서 처리 |
| move | 가변 위력 | 안다리걸기 (lowkick) | 코드 감지 실패 | computeVariableBp()에서 처리 |
| move | 가변 위력 | 미스트버스트 (mistyexplosion) | 코드 감지 실패 | computeVariableBp()에서 처리 |
| move | 가변 위력 | 보복 (payback) | 코드 감지 실패 | computeVariableBp()에서 처리 |
| move | 가변 위력 | 폴터가이스트 (poltergeist) | 코드 감지 실패 | computeVariableBp()에서 처리 |
| move | 가변 위력 | 기어오르기 (powertrip) | 코드 감지 실패 | computeVariableBp()에서 처리 |
| move | 가변 위력 | 기사회생 (reversal) | 코드 감지 실패 | computeVariableBp()에서 처리 |
| move | 가변 위력 | 라이징볼트 (risingvoltage) | 코드 감지 실패 | computeVariableBp()에서 처리 |
| move | 가변 위력 | 솔라빔 (solarbeam) | 코드 감지 실패 | computeVariableBp()에서 처리 |
| move | 가변 위력 | 솔라블레이드 (solarblade) | 코드 감지 실패 | computeVariableBp()에서 처리 |
| move | 가변 위력 | 아이언롤러 (steelroller) | 코드 감지 실패 | computeVariableBp()에서 처리 |
| move | 가변 위력 | 분함의발구르기 (stompingtantrum) | 코드 감지 실패 | computeVariableBp()에서 처리 |
| move | 가변 위력 | 어시스트파워 (storedpower) | 코드 감지 실패 | computeVariableBp()에서 처리 |
| move | 가변 위력 | 열불내기 (temperflare) | 코드 감지 실패 | computeVariableBp()에서 처리 |
| move | 가변 위력 | 대지의파동 (terrainpulse) | 코드 감지 실패 | computeVariableBp()에서 처리 |
| move | 가변 위력 | 트리플악셀 (tripleaxel) | 코드 감지 실패 | computeVariableBp()에서 처리 |
| move | 가변 위력 | 베놈쇼크 (venoshock) | 코드 감지 실패 | computeVariableBp()에서 처리 |
| move | 가변 위력 | 해수스파우팅 (waterspout) | 코드 감지 실패 | computeVariableBp()에서 처리 |
| move | 가변 위력 | 웨더볼 (weatherball) | 코드 감지 실패 | computeVariableBp()에서 처리 |
| move | 고정/비표준 대미지 | 죽기살기 (endeavor) | 코드 감지 실패 | fixedDamageAmount()에서 처리 |
| move | 고정/비표준 대미지 | 목숨걸기 (finalgambit) | 코드 감지 실패 | fixedDamageAmount()에서 처리 |
| move | 고정/비표준 대미지 | 땅가르기 (fissure) | 코드 감지 실패 | fixedDamageAmount()에서 처리 |
| move | 고정/비표준 대미지 | 가위자르기 (guillotine) | 코드 감지 실패 | fixedDamageAmount()에서 처리 |
| move | 고정/비표준 대미지 | 뿔드릴 (horndrill) | 코드 감지 실패 | fixedDamageAmount()에서 처리 |
| move | 고정/비표준 대미지 | 나이트헤드 (nightshade) | 코드 감지 실패 | fixedDamageAmount()에서 처리 |
| move | 고정/비표준 대미지 | 지구던지기 (seismictoss) | 코드 감지 실패 | fixedDamageAmount()에서 처리 |
| move | 고정/비표준 대미지 | 절대영도 (sheercold) | 코드 감지 실패 | fixedDamageAmount()에서 처리 |
| move | 고정/비표준 대미지 | 분노의앞니 (superfang) | 코드 감지 실패 | fixedDamageAmount()에서 처리 |
| move | 공격/방어 스탯 예외 | 바디프레스 (bodypress) | 코드 감지 실패 | 방어측 방어, 대상 공격, 또는 공격측 방어를 사용 |
| move | 공격/방어 스탯 예외 | 속임수 (foulplay) | 코드 감지 실패 | 방어측 방어, 대상 공격, 또는 공격측 방어를 사용 |
| move | 공격/방어 스탯 예외 | 사이코쇼크 (psyshock) | 코드 감지 실패 | 방어측 방어, 대상 공격, 또는 공격측 방어를 사용 |
| move | 상성 예외 | 플라잉프레스 (flyingpress) | 코드 감지 실패 | getMoveEffectiveness()에서 처리 |
| move | 상성 예외 | 프리즈드라이 (freezedry) | 코드 감지 실패 | getMoveEffectiveness()에서 처리 |
| move | 타입/분류 변경 | 대지의파동 (terrainpulse) | 코드 감지 실패 | prelude stage에서 타입 또는 분류 결정 |
| move | 타입/분류 변경 | 웨더볼 (weatherball) | 코드 감지 실패 | prelude stage에서 타입 또는 분류 결정 |

## 보류 요약

| 종류 | 그룹 | 항목 | 비고 |
| --- | --- | --- | --- |
| move | 보류 | 앙갚음 (comeuppance) | 이전 피해량 컨텍스트가 필요 |
| move | 보류 | 카운터 (counter) | 이전 피해량 컨텍스트가 필요 |
| move | 보류 | 변덕레이저 (ficklebeam) | 랜덤 강화 분기 표현이 필요 |
| move | 보류 | 메탈버스트 (metalburst) | 이전 피해량 컨텍스트가 필요 |
| move | 보류 | 미러코트 (mirrorcoat) | 이전 피해량 컨텍스트가 필요 |

## 기술 매트릭스

| 그룹 | 항목 | 판정 | 코드 감지 | 비고 |
| --- | --- | --- | --- | --- |
| 가변 위력 | 애크러뱃 (acrobatics) | 코드 감지 실패 | N | computeVariableBp()에서 처리 |
| 가변 위력 | 승부굳히기 (assurance) | 코드 감지 실패 | N | computeVariableBp()에서 처리 |
| 가변 위력 | 눈사태 (avalanche) | 코드 감지 실패 | N | computeVariableBp()에서 처리 |
| 가변 위력 | 집단구타 (beatup) | 코드 감지 실패 | N | computeVariableBp()에서 처리 |
| 가변 위력 | 일렉트릭볼 (electroball) | 코드 감지 실패 | N | computeVariableBp()에서 처리 |
| 가변 위력 | 분화 (eruption) | 코드 감지 실패 | N | computeVariableBp()에서 처리 |
| 가변 위력 | 와이드포스 (expandingforce) | 코드 감지 실패 | N | computeVariableBp()에서 처리 |
| 가변 위력 | 객기 (facade) | 코드 감지 실패 | N | computeVariableBp()에서 처리 |
| 가변 위력 | 바둥바둥 (flail) | 코드 감지 실패 | N | computeVariableBp()에서 처리 |
| 가변 위력 | 풀묶기 (grassknot) | 코드 감지 실패 | N | computeVariableBp()에서 처리 |
| 가변 위력 | G의힘 (gravapple) | 코드 감지 실패 | N | computeVariableBp()에서 처리 |
| 가변 위력 | 자이로볼 (gyroball) | 코드 감지 실패 | N | computeVariableBp()에서 처리 |
| 가변 위력 | 하드프레스 (hardpress) | 코드 감지 실패 | N | computeVariableBp()에서 처리 |
| 가변 위력 | 히트스탬프 (heatcrash) | 코드 감지 실패 | N | computeVariableBp()에서 처리 |
| 가변 위력 | 헤비봄버 (heavyslam) | 코드 감지 실패 | N | computeVariableBp()에서 처리 |
| 가변 위력 | 병상첨병 (hex) | 코드 감지 실패 | N | computeVariableBp()에서 처리 |
| 가변 위력 | 백귀야행 (infernalparade) | 코드 감지 실패 | N | computeVariableBp()에서 처리 |
| 가변 위력 | 탁쳐서떨구기 (knockoff) | 지원 감지 | Y | computeVariableBp()에서 처리 |
| 가변 위력 | 성묘 (lastrespects) | 코드 감지 실패 | N | computeVariableBp()에서 처리 |
| 가변 위력 | 안다리걸기 (lowkick) | 코드 감지 실패 | N | computeVariableBp()에서 처리 |
| 가변 위력 | 미스트버스트 (mistyexplosion) | 코드 감지 실패 | N | computeVariableBp()에서 처리 |
| 가변 위력 | 보복 (payback) | 코드 감지 실패 | N | computeVariableBp()에서 처리 |
| 가변 위력 | 폴터가이스트 (poltergeist) | 코드 감지 실패 | N | computeVariableBp()에서 처리 |
| 가변 위력 | 기어오르기 (powertrip) | 코드 감지 실패 | N | computeVariableBp()에서 처리 |
| 가변 위력 | 기사회생 (reversal) | 코드 감지 실패 | N | computeVariableBp()에서 처리 |
| 가변 위력 | 라이징볼트 (risingvoltage) | 코드 감지 실패 | N | computeVariableBp()에서 처리 |
| 가변 위력 | 솔라빔 (solarbeam) | 코드 감지 실패 | N | computeVariableBp()에서 처리 |
| 가변 위력 | 솔라블레이드 (solarblade) | 코드 감지 실패 | N | computeVariableBp()에서 처리 |
| 가변 위력 | 아이언롤러 (steelroller) | 코드 감지 실패 | N | computeVariableBp()에서 처리 |
| 가변 위력 | 분함의발구르기 (stompingtantrum) | 코드 감지 실패 | N | computeVariableBp()에서 처리 |
| 가변 위력 | 어시스트파워 (storedpower) | 코드 감지 실패 | N | computeVariableBp()에서 처리 |
| 가변 위력 | 열불내기 (temperflare) | 코드 감지 실패 | N | computeVariableBp()에서 처리 |
| 가변 위력 | 대지의파동 (terrainpulse) | 코드 감지 실패 | N | computeVariableBp()에서 처리 |
| 가변 위력 | 트리플악셀 (tripleaxel) | 코드 감지 실패 | N | computeVariableBp()에서 처리 |
| 가변 위력 | 베놈쇼크 (venoshock) | 코드 감지 실패 | N | computeVariableBp()에서 처리 |
| 가변 위력 | 해수스파우팅 (waterspout) | 코드 감지 실패 | N | computeVariableBp()에서 처리 |
| 가변 위력 | 웨더볼 (weatherball) | 코드 감지 실패 | N | computeVariableBp()에서 처리 |
| 고정/비표준 대미지 | 죽기살기 (endeavor) | 코드 감지 실패 | N | fixedDamageAmount()에서 처리 |
| 고정/비표준 대미지 | 목숨걸기 (finalgambit) | 코드 감지 실패 | N | fixedDamageAmount()에서 처리 |
| 고정/비표준 대미지 | 땅가르기 (fissure) | 코드 감지 실패 | N | fixedDamageAmount()에서 처리 |
| 고정/비표준 대미지 | 가위자르기 (guillotine) | 코드 감지 실패 | N | fixedDamageAmount()에서 처리 |
| 고정/비표준 대미지 | 뿔드릴 (horndrill) | 코드 감지 실패 | N | fixedDamageAmount()에서 처리 |
| 고정/비표준 대미지 | 나이트헤드 (nightshade) | 코드 감지 실패 | N | fixedDamageAmount()에서 처리 |
| 고정/비표준 대미지 | 지구던지기 (seismictoss) | 코드 감지 실패 | N | fixedDamageAmount()에서 처리 |
| 고정/비표준 대미지 | 절대영도 (sheercold) | 코드 감지 실패 | N | fixedDamageAmount()에서 처리 |
| 고정/비표준 대미지 | 분노의앞니 (superfang) | 코드 감지 실패 | N | fixedDamageAmount()에서 처리 |
| 공격/방어 스탯 예외 | 바디프레스 (bodypress) | 코드 감지 실패 | N | 방어측 방어, 대상 공격, 또는 공격측 방어를 사용 |
| 공격/방어 스탯 예외 | 속임수 (foulplay) | 코드 감지 실패 | N | 방어측 방어, 대상 공격, 또는 공격측 방어를 사용 |
| 공격/방어 스탯 예외 | 사이코쇼크 (psyshock) | 코드 감지 실패 | N | 방어측 방어, 대상 공격, 또는 공격측 방어를 사용 |
| 보류 | 앙갚음 (comeuppance) | 보류 | N | 이전 피해량 컨텍스트가 필요 |
| 보류 | 카운터 (counter) | 보류 | N | 이전 피해량 컨텍스트가 필요 |
| 보류 | 변덕레이저 (ficklebeam) | 보류 | N | 랜덤 강화 분기 표현이 필요 |
| 보류 | 메탈버스트 (metalburst) | 보류 | N | 이전 피해량 컨텍스트가 필요 |
| 보류 | 미러코트 (mirrorcoat) | 보류 | N | 이전 피해량 컨텍스트가 필요 |
| 상성 예외 | 플라잉프레스 (flyingpress) | 코드 감지 실패 | N | getMoveEffectiveness()에서 처리 |
| 상성 예외 | 프리즈드라이 (freezedry) | 코드 감지 실패 | N | getMoveEffectiveness()에서 처리 |
| 타입/분류 변경 | 대지의파동 (terrainpulse) | 코드 감지 실패 | N | prelude stage에서 타입 또는 분류 결정 |
| 타입/분류 변경 | 웨더볼 (weatherball) | 코드 감지 실패 | N | prelude stage에서 타입 또는 분류 결정 |

## 특성 매트릭스

| 그룹 | 항목 | 판정 | 코드 감지 | 비고 |
| --- | --- | --- | --- | --- |
| 공격/BP/방어 보정 | 애널라이즈 (analytic) | 코드 감지 실패 | N |  |
| 공격/BP/방어 보정 | 맹화 (blaze) | 코드 감지 실패 | N |  |
| 공격/BP/방어 보정 | 퍼코트 (furcoat) | 코드 감지 실패 | N |  |
| 공격/BP/방어 보정 | 근성 (guts) | 코드 감지 실패 | N |  |
| 공격/BP/방어 보정 | 천하장사 (hugepower) | 코드 감지 실패 | N |  |
| 공격/BP/방어 보정 | 의욕 (hustle) | 코드 감지 실패 | N |  |
| 공격/BP/방어 보정 | 철주먹 (ironfist) | 코드 감지 실패 | N |  |
| 공격/BP/방어 보정 | 이상한비늘 (marvelscale) | 코드 감지 실패 | N |  |
| 공격/BP/방어 보정 | 메가런처 (megalauncher) | 코드 감지 실패 | N |  |
| 공격/BP/방어 보정 | 심록 (overgrow) | 코드 감지 실패 | N |  |
| 공격/BP/방어 보정 | 순수한힘 (purepower) | 코드 감지 실패 | N |  |
| 공격/BP/방어 보정 | 이판사판 (reckless) | 코드 감지 실패 | N |  |
| 공격/BP/방어 보정 | 모래의힘 (sandforce) | 코드 감지 실패 | N |  |
| 공격/BP/방어 보정 | 예리함 (sharpness) | 코드 감지 실패 | N |  |
| 공격/BP/방어 보정 | 우격다짐 (sheerforce) | 코드 감지 실패 | N |  |
| 공격/BP/방어 보정 | 선파워 (solarpower) | 코드 감지 실패 | N |  |
| 공격/BP/방어 보정 | 옹골찬턱 (strongjaw) | 코드 감지 실패 | N |  |
| 공격/BP/방어 보정 | 총대장 (supremeoverlord) | 코드 감지 실패 | N |  |
| 공격/BP/방어 보정 | 벌레의알림 (swarm) | 코드 감지 실패 | N |  |
| 공격/BP/방어 보정 | 테크니션 (technician) | 코드 감지 실패 | N |  |
| 공격/BP/방어 보정 | 급류 (torrent) | 코드 감지 실패 | N |  |
| 공격/BP/방어 보정 | 단단한발톱 (toughclaws) | 코드 감지 실패 | N |  |
| 공격/BP/방어 보정 | 천진 (unaware) | 코드 감지 실패 | N |  |
| 날씨/특성 통제 | 날씨부정 (cloudnine) | 코드 감지 실패 | N |  |
| 날씨/특성 통제 | 틀깨기 (moldbreaker) | 코드 감지 실패 | N |  |
| 대미지 보정 | 페어리오라 (fairyaura) | 코드 감지 실패 | N |  |
| 대미지 보정 | 필터 (filter) | 코드 감지 실패 | N |  |
| 대미지 보정 | 내열 (heatproof) | 코드 감지 실패 | N |  |
| 대미지 보정 | 멀티스케일 (multiscale) | 코드 감지 실패 | N |  |
| 대미지 보정 | 정화의소금 (purifyingsalt) | 코드 감지 실패 | N |  |
| 대미지 보정 | 스나이퍼 (sniper) | 코드 감지 실패 | N |  |
| 대미지 보정 | 하드록 (solidrock) | 코드 감지 실패 | N |  |
| 대미지 보정 | 두꺼운지방 (thickfat) | 코드 감지 실패 | N |  |
| 대미지 보정 | 수포 (waterbubble) | 코드 감지 실패 | N |  |
| 면역/상성 | 방탄 (bulletproof) | 코드 감지 실패 | N |  |
| 면역/상성 | 건조피부 (dryskin) | 코드 감지 실패 | N |  |
| 면역/상성 | 흙먹기 (eartheater) | 코드 감지 실패 | N |  |
| 면역/상성 | 타오르는불꽃 (flashfire) | 코드 감지 실패 | N |  |
| 면역/상성 | 부유 (levitate) | 코드 감지 실패 | N |  |
| 면역/상성 | 피뢰침 (lightningrod) | 코드 감지 실패 | N |  |
| 면역/상성 | 전기엔진 (motordrive) | 코드 감지 실패 | N |  |
| 면역/상성 | 초식 (sapsipper) | 코드 감지 실패 | N |  |
| 면역/상성 | 배짱 (scrappy) | 지원 감지 | Y |  |
| 면역/상성 | 방음 (soundproof) | 코드 감지 실패 | N |  |
| 면역/상성 | 축전 (voltabsorb) | 코드 감지 실패 | N |  |
| 면역/상성 | 저수 (waterabsorb) | 코드 감지 실패 | N |  |
| 방어 예외/아이템 상호작용 | 탈 (disguise) | 코드 감지 실패 | N |  |
| 방어 예외/아이템 상호작용 | 헤비메탈 (heavymetal) | 코드 감지 실패 | N |  |
| 방어 예외/아이템 상호작용 | 서투름 (klutz) | 코드 감지 실패 | N |  |
| 방어 예외/아이템 상호작용 | 라이트메탈 (lightmetal) | 코드 감지 실패 | N |  |
| 방어 예외/아이템 상호작용 | 숙성 (ripen) | 코드 감지 실패 | N |  |
| 방어 예외/아이템 상호작용 | 조가비갑옷 (shellarmor) | 코드 감지 실패 | N |  |
| 방어 예외/아이템 상호작용 | 점착 (stickyhold) | 코드 감지 실패 | N |  |
| 방어 예외/아이템 상호작용 | 옹골참 (sturdy) | 코드 감지 실패 | N |  |
| 방어 예외/아이템 상호작용 | 긴장감 (unnerve) | 지원 감지 | Y |  |
| 위협 차단 | 클리어바디 (clearbody) | 지원 감지 | Y | ENTRY_EFFECTS의 위협 적용 전 차단 |
| 위협 차단 | 정신력 (innerfocus) | 지원 감지 | Y | ENTRY_EFFECTS의 위협 적용 전 차단 |
| 위협 차단 | 둔감 (oblivious) | 지원 감지 | Y | ENTRY_EFFECTS의 위협 적용 전 차단 |
| 위협 차단 | 마이페이스 (owntempo) | 지원 감지 | Y | ENTRY_EFFECTS의 위협 적용 전 차단 |
| 위협 차단 | 하얀연기 (whitesmoke) | 지원 감지 | Y | ENTRY_EFFECTS의 위협 적용 전 차단 |
| 자동 진입 효과 | 잔비 (drizzle) | 지원 감지 | Y | makeCalcState()에서 source state를 복제해 적용 |
| 자동 진입 효과 | 가뭄 (drought) | 지원 감지 | Y | makeCalcState()에서 source state를 복제해 적용 |
| 자동 진입 효과 | 위협 (intimidate) | 지원 감지 | Y | makeCalcState()에서 source state를 복제해 적용 |
| 자동 진입 효과 | 모래뿜기 (sandspit) | 지원 감지 | Y | makeCalcState()에서 source state를 복제해 적용 |
| 자동 진입 효과 | 모래날림 (sandstream) | 지원 감지 | Y | makeCalcState()에서 source state를 복제해 적용 |
| 자동 진입 효과 | 눈퍼뜨리기 (snowwarning) | 지원 감지 | Y | makeCalcState()에서 source state를 복제해 적용 |

## 도구 매트릭스

| 그룹 | 항목 | 판정 | 코드 감지 | 비고 |
| --- | --- | --- | --- | --- |
| 공격/방어 실수치 보정 | 전기구슬 (lightball) | 코드 감지 실패 | N |  |
| 반감 열매 | 바리비열매 (babiriberry) | 코드 감지 실패 | N | Unnerve/As One/Ripen 반영 |
| 반감 열매 | 루미열매 (chartiberry) | 코드 감지 실패 | N | Unnerve/As One/Ripen 반영 |
| 반감 열매 | 카리열매 (chilanberry) | 코드 감지 실패 | N | Unnerve/As One/Ripen 반영 |
| 반감 열매 | 로플열매 (chopleberry) | 코드 감지 실패 | N | Unnerve/As One/Ripen 반영 |
| 반감 열매 | 바코열매 (cobaberry) | 코드 감지 실패 | N | Unnerve/As One/Ripen 반영 |
| 반감 열매 | 마코열매 (colburberry) | 코드 감지 실패 | N | Unnerve/As One/Ripen 반영 |
| 반감 열매 | 하반열매 (habanberry) | 코드 감지 실패 | N | Unnerve/As One/Ripen 반영 |
| 반감 열매 | 수불열매 (kasibberry) | 코드 감지 실패 | N | Unnerve/As One/Ripen 반영 |
| 반감 열매 | 으름열매 (kebiaberry) | 코드 감지 실패 | N | Unnerve/As One/Ripen 반영 |
| 반감 열매 | 오카열매 (occaberry) | 코드 감지 실패 | N | Unnerve/As One/Ripen 반영 |
| 반감 열매 | 꼬시개열매 (passhoberry) | 코드 감지 실패 | N | Unnerve/As One/Ripen 반영 |
| 반감 열매 | 야파열매 (payapaberry) | 코드 감지 실패 | N | Unnerve/As One/Ripen 반영 |
| 반감 열매 | 린드열매 (rindoberry) | 코드 감지 실패 | N | Unnerve/As One/Ripen 반영 |
| 반감 열매 | 로셀열매 (roseliberry) | 코드 감지 실패 | N | Unnerve/As One/Ripen 반영 |
| 반감 열매 | 슈캐열매 (shucaberry) | 코드 감지 실패 | N | Unnerve/As One/Ripen 반영 |
| 반감 열매 | 리체열매 (tangaberry) | 코드 감지 실패 | N | Unnerve/As One/Ripen 반영 |
| 반감 열매 | 초나열매 (wacanberry) | 코드 감지 실패 | N | Unnerve/As One/Ripen 반영 |
| 반감 열매 | 플카열매 (yacheberry) | 코드 감지 실패 | N | Unnerve/As One/Ripen 반영 |
| 타입 위력 보정 | 검은띠 (blackbelt) | 코드 감지 실패 | N |  |
| 타입 위력 보정 | 검은안경 (blackglasses) | 코드 감지 실패 | N |  |
| 타입 위력 보정 | 목탄 (charcoal) | 코드 감지 실패 | N |  |
| 타입 위력 보정 | 용의이빨 (dragonfang) | 코드 감지 실패 | N |  |
| 타입 위력 보정 | 요정의깃털 (fairyfeather) | 코드 감지 실패 | N |  |
| 타입 위력 보정 | 딱딱한돌 (hardstone) | 코드 감지 실패 | N |  |
| 타입 위력 보정 | 자석 (magnet) | 코드 감지 실패 | N |  |
| 타입 위력 보정 | 금속코트 (metalcoat) | 코드 감지 실패 | N |  |
| 타입 위력 보정 | 기적의씨 (miracleseed) | 코드 감지 실패 | N |  |
| 타입 위력 보정 | 신비의물방울 (mysticwater) | 코드 감지 실패 | N |  |
| 타입 위력 보정 | 녹지않는얼음 (nevermeltice) | 코드 감지 실패 | N |  |
| 타입 위력 보정 | 독바늘 (poisonbarb) | 코드 감지 실패 | N |  |
| 타입 위력 보정 | 예리한부리 (sharpbeak) | 코드 감지 실패 | N |  |
| 타입 위력 보정 | 실크스카프 (silkscarf) | 코드 감지 실패 | N |  |
| 타입 위력 보정 | 은빛가루 (silverpowder) | 코드 감지 실패 | N |  |
| 타입 위력 보정 | 부드러운모래 (softsand) | 코드 감지 실패 | N |  |
| 타입 위력 보정 | 저주의부적 (spelltag) | 코드 감지 실패 | N |  |
| 타입 위력 보정 | 휘어진스푼 (twistedspoon) | 코드 감지 실패 | N |  |
| KO 추정 | 기합의띠 (focussash) | 코드 감지 실패 | N | hkoLabel()/simulateKO()에서 처리 |
| KO 추정 | 먹다남은음식 (leftovers) | 코드 감지 실패 | N | hkoLabel()/simulateKO()에서 처리 |
| KO 추정 | 자뭉열매 (sitrusberry) | 코드 감지 실패 | N | hkoLabel()/simulateKO()에서 처리 |
