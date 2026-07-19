# Damage Calculator Coverage Matrix

이 문서는 `npm run coverage:matrix`로 생성된다. 직접 수정하지 말고 스크립트의 후보 목록이나 계산 엔진을 수정한 뒤 다시 생성한다.

범위는 현재 빌드된 Champions 데이터 기준이다.

지원 근거는 `code`, `mechanics`, `built-data`로 표시한다. 이 표는 구현 후보 추적용이며, 계산 결과 회귀 검증은 golden test가 담당한다.

| 범위 | 개수 |
| --- | ---: |
| 챔피언스 포켓몬 | 315 |
| 챔피언스 learnset 기술 | 496 |
| 챔피언스 포켓몬이 보유한 특성 | 201 |
| 챔피언스 도구 데이터 | 149 |
| 추적 후보 기술 | 59 |
| 추적 후보 특성 | 69 |
| 추적 후보 도구 | 45 |
| 추적 후보 필드/상태 | 10 |

## 점검 필요 요약

| 종류 | 그룹 | 항목 | 판정 | 비고 |
| --- | --- | --- | --- | --- |
| - | - | - | 없음 | - |

## 명시적 미지원 요약

| 종류 | 그룹 | 항목 | 비고 |
| --- | --- | --- | --- |
| field | 명시적 미지원 | Protect 처리 | 단발 피해 계산 범위 밖이며 보호 상태 UI와 엔진 처리를 제공하지 않음 |

## 보류 요약

| 종류 | 그룹 | 항목 | 비고 |
| --- | --- | --- | --- |
| field | 보류 | Aurora Veil | 리플렉터/빛의장막과 중첩되지 않는 별도 사이드 스크린 상태가 필요 |
| field | 보류 | Battery | 아군 위치/사이드 컨텍스트가 필요한 더블 보정 |
| field | 보류 | Friend Guard | 아군 위치/사이드 컨텍스트가 필요한 더블 보정 |
| field | 보류 | Magic Room | 도구/스탯/양쪽 방어 상태를 전역으로 뒤집는 효과라 단발 계산기 상태 모델 밖 |
| field | 보류 | Power Spot | 아군 위치/사이드 컨텍스트가 필요한 더블 보정 |
| field | 보류 | Wonder Room | 도구/스탯/양쪽 방어 상태를 전역으로 뒤집는 효과라 단발 계산기 상태 모델 밖 |
| move | 보류 | 앙갚음 (comeuppance) | 이전 피해량 컨텍스트가 필요 |
| move | 보류 | 카운터 (counter) | 이전 피해량 컨텍스트가 필요 |
| move | 보류 | 변덕레이저 (ficklebeam) | 랜덤 강화 분기 표현이 필요 |
| move | 보류 | 메탈버스트 (metalburst) | 이전 피해량 컨텍스트가 필요 |
| move | 보류 | 미러코트 (mirrorcoat) | 이전 피해량 컨텍스트가 필요 |

## 기술 매트릭스

| 그룹 | 항목 | 판정 | 지원 근거 | 비고 |
| --- | --- | --- | --- | --- |
| 가변 위력 | 애크러뱃 (acrobatics) | 지원 감지 | mechanics, built-data | computeVariableBp()에서 처리 |
| 가변 위력 | 승부굳히기 (assurance) | 지원 감지 | mechanics, built-data | computeVariableBp()에서 처리 |
| 가변 위력 | 눈사태 (avalanche) | 지원 감지 | mechanics, built-data | computeVariableBp()에서 처리 |
| 가변 위력 | 독침천발 (barbbarrage) | 지원 감지 | mechanics, built-data | computeVariableBp()에서 처리 |
| 가변 위력 | 집단구타 (beatup) | 지원 감지 | mechanics, built-data | computeVariableBp()에서 처리 |
| 가변 위력 | 일렉트릭볼 (electroball) | 지원 감지 | mechanics, built-data | computeVariableBp()에서 처리 |
| 가변 위력 | 분화 (eruption) | 지원 감지 | mechanics, built-data | computeVariableBp()에서 처리 |
| 가변 위력 | 와이드포스 (expandingforce) | 지원 감지 | mechanics, built-data | computeVariableBp()에서 처리 |
| 가변 위력 | 객기 (facade) | 지원 감지 | mechanics, built-data | computeVariableBp()에서 처리 |
| 가변 위력 | 바둥바둥 (flail) | 지원 감지 | mechanics, built-data | computeVariableBp()에서 처리 |
| 가변 위력 | 풀묶기 (grassknot) | 지원 감지 | mechanics, built-data | computeVariableBp()에서 처리 |
| 가변 위력 | G의힘 (gravapple) | 지원 감지 | mechanics, built-data | computeVariableBp()에서 처리 |
| 가변 위력 | 자이로볼 (gyroball) | 지원 감지 | mechanics, built-data | computeVariableBp()에서 처리 |
| 가변 위력 | 하드프레스 (hardpress) | 지원 감지 | mechanics, built-data | computeVariableBp()에서 처리 |
| 가변 위력 | 히트스탬프 (heatcrash) | 지원 감지 | mechanics, built-data | computeVariableBp()에서 처리 |
| 가변 위력 | 헤비봄버 (heavyslam) | 지원 감지 | mechanics, built-data | computeVariableBp()에서 처리 |
| 가변 위력 | 병상첨병 (hex) | 지원 감지 | mechanics, built-data | computeVariableBp()에서 처리 |
| 가변 위력 | 백귀야행 (infernalparade) | 지원 감지 | mechanics, built-data | computeVariableBp()에서 처리 |
| 가변 위력 | 탁쳐서떨구기 (knockoff) | 지원 감지 | mechanics, built-data | computeVariableBp()에서 처리 |
| 가변 위력 | 성묘 (lastrespects) | 지원 감지 | mechanics, built-data | computeVariableBp()에서 처리 |
| 가변 위력 | 안다리걸기 (lowkick) | 지원 감지 | mechanics, built-data | computeVariableBp()에서 처리 |
| 가변 위력 | 미스트버스트 (mistyexplosion) | 지원 감지 | mechanics, built-data | computeVariableBp()에서 처리 |
| 가변 위력 | 보복 (payback) | 지원 감지 | mechanics, built-data | computeVariableBp()에서 처리 |
| 가변 위력 | 폴터가이스트 (poltergeist) | 지원 감지 | mechanics, built-data | computeVariableBp()에서 처리 |
| 가변 위력 | 기어오르기 (powertrip) | 지원 감지 | mechanics, built-data | computeVariableBp()에서 처리 |
| 가변 위력 | 기사회생 (reversal) | 지원 감지 | mechanics, built-data | computeVariableBp()에서 처리 |
| 가변 위력 | 라이징볼트 (risingvoltage) | 지원 감지 | mechanics, built-data | computeVariableBp()에서 처리 |
| 가변 위력 | 솔라빔 (solarbeam) | 지원 감지 | mechanics, built-data | computeVariableBp()에서 처리 |
| 가변 위력 | 솔라블레이드 (solarblade) | 지원 감지 | mechanics, built-data | computeVariableBp()에서 처리 |
| 가변 위력 | 아이언롤러 (steelroller) | 지원 감지 | mechanics, built-data | computeVariableBp()에서 처리 |
| 가변 위력 | 분함의발구르기 (stompingtantrum) | 지원 감지 | mechanics, built-data | computeVariableBp()에서 처리 |
| 가변 위력 | 어시스트파워 (storedpower) | 지원 감지 | mechanics, built-data | computeVariableBp()에서 처리 |
| 가변 위력 | 열불내기 (temperflare) | 지원 감지 | mechanics, built-data | computeVariableBp()에서 처리 |
| 가변 위력 | 대지의파동 (terrainpulse) | 지원 감지 | mechanics, built-data | computeVariableBp()에서 처리 |
| 가변 위력 | 트리플악셀 (tripleaxel) | 지원 감지 | mechanics, built-data | computeVariableBp()에서 처리 |
| 가변 위력 | 베놈쇼크 (venoshock) | 지원 감지 | mechanics, built-data | computeVariableBp()에서 처리 |
| 가변 위력 | 해수스파우팅 (waterspout) | 지원 감지 | mechanics, built-data | computeVariableBp()에서 처리 |
| 가변 위력 | 웨더볼 (weatherball) | 지원 감지 | mechanics, built-data | computeVariableBp()에서 처리 |
| 고정/비표준 대미지 | 죽기살기 (endeavor) | 지원 감지 | mechanics, built-data | fixedDamageAmount()에서 처리 |
| 고정/비표준 대미지 | 목숨걸기 (finalgambit) | 지원 감지 | mechanics, built-data | fixedDamageAmount()에서 처리 |
| 고정/비표준 대미지 | 땅가르기 (fissure) | 지원 감지 | built-data | fixedDamageAmount()에서 처리 |
| 고정/비표준 대미지 | 가위자르기 (guillotine) | 지원 감지 | built-data | fixedDamageAmount()에서 처리 |
| 고정/비표준 대미지 | 뿔드릴 (horndrill) | 지원 감지 | built-data | fixedDamageAmount()에서 처리 |
| 고정/비표준 대미지 | 나이트헤드 (nightshade) | 지원 감지 | built-data | fixedDamageAmount()에서 처리 |
| 고정/비표준 대미지 | 지구던지기 (seismictoss) | 지원 감지 | built-data | fixedDamageAmount()에서 처리 |
| 고정/비표준 대미지 | 절대영도 (sheercold) | 지원 감지 | built-data | fixedDamageAmount()에서 처리 |
| 고정/비표준 대미지 | 분노의앞니 (superfang) | 지원 감지 | mechanics, built-data | fixedDamageAmount()에서 처리 |
| 공격/방어 스탯 예외 | 바디프레스 (bodypress) | 지원 감지 | built-data | 방어측 방어, 대상 공격, 또는 공격측 방어를 사용 |
| 공격/방어 스탯 예외 | 속임수 (foulplay) | 지원 감지 | built-data | 방어측 방어, 대상 공격, 또는 공격측 방어를 사용 |
| 공격/방어 스탯 예외 | 사이코쇼크 (psyshock) | 지원 감지 | built-data | 방어측 방어, 대상 공격, 또는 공격측 방어를 사용 |
| 보류 | 앙갚음 (comeuppance) | 보류 | - | 이전 피해량 컨텍스트가 필요 |
| 보류 | 카운터 (counter) | 보류 | - | 이전 피해량 컨텍스트가 필요 |
| 보류 | 변덕레이저 (ficklebeam) | 보류 | - | 랜덤 강화 분기 표현이 필요 |
| 보류 | 메탈버스트 (metalburst) | 보류 | - | 이전 피해량 컨텍스트가 필요 |
| 보류 | 미러코트 (mirrorcoat) | 보류 | - | 이전 피해량 컨텍스트가 필요 |
| 상성 예외 | 플라잉프레스 (flyingpress) | 지원 감지 | mechanics, built-data | getMoveEffectiveness()에서 처리 |
| 상성 예외 | 프리즈드라이 (freezedry) | 지원 감지 | mechanics, built-data | getMoveEffectiveness()에서 처리 |
| 타입/분류 변경 | 대지의파동 (terrainpulse) | 지원 감지 | mechanics, built-data | prelude stage에서 타입 또는 분류 결정 |
| 타입/분류 변경 | 웨더볼 (weatherball) | 지원 감지 | mechanics, built-data | prelude stage에서 타입 또는 분류 결정 |

## 특성 매트릭스

| 그룹 | 항목 | 판정 | 지원 근거 | 비고 |
| --- | --- | --- | --- | --- |
| 공격/BP/방어 보정 | 애널라이즈 (analytic) | 지원 감지 | mechanics, built-data |  |
| 공격/BP/방어 보정 | 맹화 (blaze) | 지원 감지 | mechanics, built-data |  |
| 공격/BP/방어 보정 | 퍼코트 (furcoat) | 지원 감지 | mechanics, built-data |  |
| 공격/BP/방어 보정 | 근성 (guts) | 지원 감지 | mechanics, built-data |  |
| 공격/BP/방어 보정 | 천하장사 (hugepower) | 지원 감지 | mechanics, built-data |  |
| 공격/BP/방어 보정 | 의욕 (hustle) | 지원 감지 | mechanics, built-data |  |
| 공격/BP/방어 보정 | 철주먹 (ironfist) | 지원 감지 | mechanics, built-data |  |
| 공격/BP/방어 보정 | 이상한비늘 (marvelscale) | 지원 감지 | mechanics, built-data |  |
| 공격/BP/방어 보정 | 메가런처 (megalauncher) | 지원 감지 | mechanics, built-data |  |
| 공격/BP/방어 보정 | 심록 (overgrow) | 지원 감지 | mechanics, built-data |  |
| 공격/BP/방어 보정 | 순수한힘 (purepower) | 지원 감지 | mechanics, built-data |  |
| 공격/BP/방어 보정 | 이판사판 (reckless) | 지원 감지 | mechanics, built-data |  |
| 공격/BP/방어 보정 | 모래의힘 (sandforce) | 지원 감지 | mechanics, built-data |  |
| 공격/BP/방어 보정 | 예리함 (sharpness) | 지원 감지 | mechanics, built-data |  |
| 공격/BP/방어 보정 | 우격다짐 (sheerforce) | 지원 감지 | mechanics, built-data |  |
| 공격/BP/방어 보정 | 선파워 (solarpower) | 지원 감지 | mechanics, built-data |  |
| 공격/BP/방어 보정 | 옹골찬턱 (strongjaw) | 지원 감지 | mechanics, built-data |  |
| 공격/BP/방어 보정 | 총대장 (supremeoverlord) | 지원 감지 | mechanics, built-data |  |
| 공격/BP/방어 보정 | 벌레의알림 (swarm) | 지원 감지 | mechanics, built-data |  |
| 공격/BP/방어 보정 | 테크니션 (technician) | 지원 감지 | mechanics, built-data |  |
| 공격/BP/방어 보정 | 급류 (torrent) | 지원 감지 | mechanics, built-data |  |
| 공격/BP/방어 보정 | 단단한발톱 (toughclaws) | 지원 감지 | mechanics, built-data |  |
| 공격/BP/방어 보정 | 천진 (unaware) | 지원 감지 | mechanics, built-data |  |
| 날씨/특성 통제 | 날씨부정 (cloudnine) | 지원 감지 | mechanics, built-data |  |
| 날씨/특성 통제 | 틀깨기 (moldbreaker) | 지원 감지 | mechanics, built-data |  |
| 대미지 보정 | 페어리오라 (fairyaura) | 지원 감지 | mechanics, built-data |  |
| 대미지 보정 | 필터 (filter) | 지원 감지 | mechanics, built-data |  |
| 대미지 보정 | 복슬복슬 (fluffy) | 지원 감지 | mechanics, built-data |  |
| 대미지 보정 | 내열 (heatproof) | 지원 감지 | mechanics, built-data |  |
| 대미지 보정 | 멀티스케일 (multiscale) | 지원 감지 | mechanics, built-data |  |
| 대미지 보정 | 정화의소금 (purifyingsalt) | 지원 감지 | mechanics, built-data |  |
| 대미지 보정 | 스나이퍼 (sniper) | 지원 감지 | mechanics |  |
| 대미지 보정 | 하드록 (solidrock) | 지원 감지 | mechanics, built-data |  |
| 대미지 보정 | 두꺼운지방 (thickfat) | 지원 감지 | mechanics, built-data |  |
| 대미지 보정 | 수포 (waterbubble) | 지원 감지 | mechanics, built-data |  |
| 면역/상성 | 방탄 (bulletproof) | 지원 감지 | mechanics, built-data |  |
| 면역/상성 | 건조피부 (dryskin) | 지원 감지 | mechanics, built-data |  |
| 면역/상성 | 흙먹기 (eartheater) | 지원 감지 | mechanics, built-data |  |
| 면역/상성 | 타오르는불꽃 (flashfire) | 지원 감지 | mechanics, built-data |  |
| 면역/상성 | 부유 (levitate) | 지원 감지 | mechanics, built-data |  |
| 면역/상성 | 피뢰침 (lightningrod) | 지원 감지 | mechanics, built-data |  |
| 면역/상성 | 전기엔진 (motordrive) | 지원 감지 | mechanics, built-data |  |
| 면역/상성 | 초식 (sapsipper) | 지원 감지 | mechanics, built-data |  |
| 면역/상성 | 배짱 (scrappy) | 지원 감지 | mechanics |  |
| 면역/상성 | 방음 (soundproof) | 지원 감지 | mechanics, built-data |  |
| 면역/상성 | 축전 (voltabsorb) | 지원 감지 | mechanics, built-data |  |
| 면역/상성 | 저수 (waterabsorb) | 지원 감지 | mechanics, built-data |  |
| 방어 예외/아이템 상호작용 | 전투무장 (battlearmor) | 지원 감지 | mechanics, built-data |  |
| 방어 예외/아이템 상호작용 | 탈 (disguise) | 지원 감지 | mechanics, built-data |  |
| 방어 예외/아이템 상호작용 | 헤비메탈 (heavymetal) | 지원 감지 | mechanics, built-data |  |
| 방어 예외/아이템 상호작용 | 서투름 (klutz) | 지원 감지 | mechanics, built-data |  |
| 방어 예외/아이템 상호작용 | 라이트메탈 (lightmetal) | 지원 감지 | mechanics, built-data |  |
| 방어 예외/아이템 상호작용 | 숙성 (ripen) | 지원 감지 | mechanics, built-data |  |
| 방어 예외/아이템 상호작용 | 조가비갑옷 (shellarmor) | 지원 감지 | mechanics, built-data |  |
| 방어 예외/아이템 상호작용 | 점착 (stickyhold) | 지원 감지 | mechanics, built-data |  |
| 방어 예외/아이템 상호작용 | 옹골참 (sturdy) | 지원 감지 | mechanics, built-data |  |
| 방어 예외/아이템 상호작용 | 긴장감 (unnerve) | 지원 감지 | mechanics, built-data, code |  |
| 위협 차단 | 클리어바디 (clearbody) | 지원 감지 | mechanics | entry-effects.json의 위협 차단 목록으로 적용 전 차단 |
| 위협 차단 | 정신력 (innerfocus) | 지원 감지 | mechanics | entry-effects.json의 위협 차단 목록으로 적용 전 차단 |
| 위협 차단 | 둔감 (oblivious) | 지원 감지 | mechanics | entry-effects.json의 위협 차단 목록으로 적용 전 차단 |
| 위협 차단 | 마이페이스 (owntempo) | 지원 감지 | mechanics | entry-effects.json의 위협 차단 목록으로 적용 전 차단 |
| 위협 차단 | 하얀연기 (whitesmoke) | 지원 감지 | mechanics | entry-effects.json의 위협 차단 목록으로 적용 전 차단 |
| 자동 진입 효과 | 잔비 (drizzle) | 지원 감지 | mechanics | entry-effects.json을 makeCalcState()에서 계산용 복사본에 적용 |
| 자동 진입 효과 | 가뭄 (drought) | 지원 감지 | mechanics | entry-effects.json을 makeCalcState()에서 계산용 복사본에 적용 |
| 자동 진입 효과 | 일렉트릭메이커 (electricsurge) | 지원 감지 | mechanics | entry-effects.json을 makeCalcState()에서 계산용 복사본에 적용 |
| 자동 진입 효과 | 위협 (intimidate) | 지원 감지 | mechanics | entry-effects.json을 makeCalcState()에서 계산용 복사본에 적용 |
| 자동 진입 효과 | 모래뿜기 (sandspit) | 지원 감지 | mechanics | entry-effects.json을 makeCalcState()에서 계산용 복사본에 적용 |
| 자동 진입 효과 | 모래날림 (sandstream) | 지원 감지 | mechanics | entry-effects.json을 makeCalcState()에서 계산용 복사본에 적용 |
| 자동 진입 효과 | 눈퍼뜨리기 (snowwarning) | 지원 감지 | mechanics | entry-effects.json을 makeCalcState()에서 계산용 복사본에 적용 |

## 도구 매트릭스

| 그룹 | 항목 | 판정 | 지원 근거 | 비고 |
| --- | --- | --- | --- | --- |
| KO 추정 | 기합의띠 (focussash) | 지원 감지 | mechanics, built-data | hkoLabel()/simulateKO()에서 처리 |
| KO 추정 | 먹다남은음식 (leftovers) | 지원 감지 | mechanics, built-data | hkoLabel()/simulateKO()에서 처리 |
| KO 추정 | 자뭉열매 (sitrusberry) | 지원 감지 | mechanics, built-data | hkoLabel()/simulateKO()에서 처리 |
| 가변 위력/접지 보조 | 검은철구 (ironball) | 지원 감지 | mechanics, built-data |  |
| 공격/방어 실수치 보정 | 전기구슬 (lightball) | 지원 감지 | mechanics, built-data |  |
| 반감 열매 | 바리비열매 (babiriberry) | 지원 감지 | mechanics, built-data | Unnerve/As One/Ripen 반영 |
| 반감 열매 | 루미열매 (chartiberry) | 지원 감지 | mechanics, built-data | Unnerve/As One/Ripen 반영 |
| 반감 열매 | 카리열매 (chilanberry) | 지원 감지 | mechanics, built-data | Unnerve/As One/Ripen 반영 |
| 반감 열매 | 로플열매 (chopleberry) | 지원 감지 | mechanics, built-data | Unnerve/As One/Ripen 반영 |
| 반감 열매 | 바코열매 (cobaberry) | 지원 감지 | mechanics, built-data | Unnerve/As One/Ripen 반영 |
| 반감 열매 | 마코열매 (colburberry) | 지원 감지 | mechanics, built-data | Unnerve/As One/Ripen 반영 |
| 반감 열매 | 하반열매 (habanberry) | 지원 감지 | mechanics, built-data | Unnerve/As One/Ripen 반영 |
| 반감 열매 | 수불열매 (kasibberry) | 지원 감지 | mechanics, built-data | Unnerve/As One/Ripen 반영 |
| 반감 열매 | 으름열매 (kebiaberry) | 지원 감지 | mechanics, built-data | Unnerve/As One/Ripen 반영 |
| 반감 열매 | 오카열매 (occaberry) | 지원 감지 | mechanics, built-data | Unnerve/As One/Ripen 반영 |
| 반감 열매 | 꼬시개열매 (passhoberry) | 지원 감지 | mechanics, built-data | Unnerve/As One/Ripen 반영 |
| 반감 열매 | 야파열매 (payapaberry) | 지원 감지 | mechanics, built-data | Unnerve/As One/Ripen 반영 |
| 반감 열매 | 린드열매 (rindoberry) | 지원 감지 | mechanics, built-data | Unnerve/As One/Ripen 반영 |
| 반감 열매 | 로셀열매 (roseliberry) | 지원 감지 | mechanics, built-data | Unnerve/As One/Ripen 반영 |
| 반감 열매 | 슈캐열매 (shucaberry) | 지원 감지 | mechanics, built-data | Unnerve/As One/Ripen 반영 |
| 반감 열매 | 리체열매 (tangaberry) | 지원 감지 | mechanics, built-data | Unnerve/As One/Ripen 반영 |
| 반감 열매 | 초나열매 (wacanberry) | 지원 감지 | mechanics, built-data | Unnerve/As One/Ripen 반영 |
| 반감 열매 | 플카열매 (yacheberry) | 지원 감지 | mechanics, built-data | Unnerve/As One/Ripen 반영 |
| 최종 대미지/BP 보정 | 달인의띠 (expertbelt) | 지원 감지 | mechanics, built-data |  |
| 최종 대미지/BP 보정 | 생명의구슬 (lifeorb) | 지원 감지 | mechanics, built-data |  |
| 최종 대미지/BP 보정 | 힘의머리띠 (muscleband) | 지원 감지 | mechanics, built-data |  |
| 최종 대미지/BP 보정 | 박식안경 (wiseglasses) | 지원 감지 | mechanics, built-data |  |
| 타입 위력 보정 | 검은띠 (blackbelt) | 지원 감지 | mechanics, built-data |  |
| 타입 위력 보정 | 검은안경 (blackglasses) | 지원 감지 | mechanics, built-data |  |
| 타입 위력 보정 | 목탄 (charcoal) | 지원 감지 | mechanics, built-data |  |
| 타입 위력 보정 | 용의이빨 (dragonfang) | 지원 감지 | mechanics, built-data |  |
| 타입 위력 보정 | 요정의깃털 (fairyfeather) | 지원 감지 | mechanics, built-data |  |
| 타입 위력 보정 | 딱딱한돌 (hardstone) | 지원 감지 | mechanics, built-data |  |
| 타입 위력 보정 | 자석 (magnet) | 지원 감지 | mechanics, built-data |  |
| 타입 위력 보정 | 금속코트 (metalcoat) | 지원 감지 | mechanics, built-data |  |
| 타입 위력 보정 | 기적의씨 (miracleseed) | 지원 감지 | mechanics, built-data |  |
| 타입 위력 보정 | 신비의물방울 (mysticwater) | 지원 감지 | mechanics, built-data |  |
| 타입 위력 보정 | 녹지않는얼음 (nevermeltice) | 지원 감지 | mechanics, built-data |  |
| 타입 위력 보정 | 독바늘 (poisonbarb) | 지원 감지 | mechanics, built-data |  |
| 타입 위력 보정 | 예리한부리 (sharpbeak) | 지원 감지 | mechanics, built-data |  |
| 타입 위력 보정 | 실크스카프 (silkscarf) | 지원 감지 | mechanics, built-data |  |
| 타입 위력 보정 | 은빛가루 (silverpowder) | 지원 감지 | mechanics, built-data |  |
| 타입 위력 보정 | 부드러운모래 (softsand) | 지원 감지 | mechanics, built-data |  |
| 타입 위력 보정 | 저주의부적 (spelltag) | 지원 감지 | mechanics, built-data |  |
| 타입 위력 보정 | 휘어진스푼 (twistedspoon) | 지원 감지 | mechanics, built-data |  |

## 필드/상태 매트릭스

| 그룹 | 항목 | 판정 | 지원 근거 | 비고 |
| --- | --- | --- | --- | --- |
| 명시적 미지원 | Protect 처리 | 미지원 | - | 단발 피해 계산 범위 밖이며 보호 상태 UI와 엔진 처리를 제공하지 않음 |
| 보류 | Aurora Veil | 보류 | - | 리플렉터/빛의장막과 중첩되지 않는 별도 사이드 스크린 상태가 필요 |
| 보류 | Battery | 보류 | - | 아군 위치/사이드 컨텍스트가 필요한 더블 보정 |
| 보류 | Friend Guard | 보류 | - | 아군 위치/사이드 컨텍스트가 필요한 더블 보정 |
| 보류 | Magic Room | 보류 | - | 도구/스탯/양쪽 방어 상태를 전역으로 뒤집는 효과라 단발 계산기 상태 모델 밖 |
| 보류 | Power Spot | 보류 | - | 아군 위치/사이드 컨텍스트가 필요한 더블 보정 |
| 보류 | Wonder Room | 보류 | - | 도구/스탯/양쪽 방어 상태를 전역으로 뒤집는 효과라 단발 계산기 상태 모델 밖 |
| 필드/상태 보정 | 스크린 보정 | 지원 감지 | mechanics | field-mechanics.json에서 처리 |
| 필드/상태 보정 | 지형 BP 보정 | 지원 감지 | mechanics | field-mechanics.json에서 처리 |
| 필드/상태 보정 | 날씨 대미지 보정 | 지원 감지 | mechanics | field-mechanics.json에서 처리 |
