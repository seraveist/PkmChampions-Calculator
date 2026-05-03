/**
 * 최종 데이터 빌드: 챔피언스 환경용 경량화 + 한국어 수동 매핑
 * 출력: dist/champions-data.js (window에 할당)
 */
import fs from 'fs';
import path from 'path';

const DATA = './data';
const OUT = './dist';
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const pokemon = JSON.parse(fs.readFileSync(path.join(DATA, 'pokemon.json')));
const moves = JSON.parse(fs.readFileSync(path.join(DATA, 'moves.json')));
const abilities = JSON.parse(fs.readFileSync(path.join(DATA, 'abilities.json')));
const items = JSON.parse(fs.readFileSync(path.join(DATA, 'items.json')));

// ─────────────────────────────────────────────────
// 기술 한국어 수동 매핑 (주요 기술 위주)
// ─────────────────────────────────────────────────
const MOVE_KO = {
  // 불꽃
  'flamethrower': '화염방사', 'fireblast': '대문자불꽃', 'overheat': '오버히트',
  'flareblitz': '플레어드라이브', 'heatwave': '열풍', 'eruption': '분화',
  'sacredfire': '신성한불꽃', 'firepunch': '불꽃펀치', 'willowisp': '도깨비불',
  'sunnyday': '쾌청', 'lavaplume': '분연', 'fusionflare': '크로스플레임',
  'fierydance': '불춤', 'blueflare': '푸른불꽃', 'mysticalfire': '마법의불꽃',
  'pyroball': '파이어볼', 'torchsong': '토치카송가',
  // 물
  'hydropump': '하이드로펌프', 'surf': '파도타기', 'waterfall': '폭포오르기',
  'aquatail': '아쿠아테일', 'waterpulse': '물의파동', 'watershuriken': '물수리검',
  'scald': '열탕', 'liquidation': '아쿠아브레이크', 'aquajet': '아쿠아제트',
  'originpulse': '오리진파동', 'hydrosteam': '수증기포', 'wavecrash': '웨이브태클',
  // 풀
  'energyball': '에너지볼', 'leafblade': '잎날가르기', 'leafstorm': '리프스톰',
  'seedbomb': '씨폭탄', 'gigadrain': '기가드레인', 'solarbeam': '솔라빔',
  'powerwhip': '파워휩', 'woodhammer': '우드해머', 'grassknot': '풀묶기',
  'polenpowder': '꽃가루', 'ivycudgel': '덩굴박치기', 'appleacid': '애플산',
  // 전기
  'thunderbolt': '10만볼트', 'thunder': '번개', 'voltswitch': '볼트체인지',
  'wildcharge': '와일드볼트', 'volttackle': '볼트태클', 'thunderwave': '전자파',
  'thunderpunch': '번개펀치', 'discharge': '방전', 'electroball': '일렉트릭볼',
  'risingvoltage': '라이징볼트', 'electroshot': '일렉트릭스파이크',
  // 얼음
  'icebeam': '냉동빔', 'blizzard': '눈보라', 'icehammer': '아이스해머',
  'iciclecrash': '고드름떨구기', 'iciclespear': '고드름침', 'freezedry': '프리즈드라이',
  'avalanche': '눈사태', 'tripleaxel': '트리플악셀', 'glaciallance': '빙창',
  // 격투
  'closecombat': '인파이트', 'focusblast': '기합구슬', 'drainpunch': '드레인펀치',
  'aurasphere': '오라구체', 'machpunch': '마하펀치', 'bodypress': '보디프레스',
  'dynamicpunch': '폭발펀치', 'ragingfury': '격노의불꽃', 'collisioncourse': '러닝크래쉬',
  // 독
  'sludgebomb': '오물폭탄', 'poisonjab': '독찌르기', 'crosspoison': '크로스포이즌',
  'sludgewave': '오물폭풍', 'gunkshot': '독가스', 'toxic': '맹독',
  // 땅
  'earthquake': '지진', 'earthpower': '대지의힘', 'drillrun': '지옥찌르기',
  'highhorsepower': '10만마력', 'precipiceblades': '단애의칼', 'headlongrush': '필사의돌진',
  'stompingtantrum': '발구르기', 'bulldoze': '땅고르기',
  // 비행
  'bravebird': '브레이브버드', 'airslash': '에어슬래시', 'hurricane': '폭풍',
  'fly': '공중날기', 'dualwingbeat': '더블윙', 'acrobatics': '아크로바트',
  'bleakwindstorm': '한풍폭풍', 'wildboltstorm': '뇌전폭풍',
  // 에스퍼
  'psychic': '사이코키네시스', 'psyshock': '사이코쇼크', 'psystrike': '사이코브레이크',
  'expandingforce': '확장의힘', 'psychicfangs': '사이코엄니', 'storedpower': '어시스트파워',
  // 벌레
  'buginizer': '벌레먹기', 'megahorn': '메가혼', 'xscissor': '시저크로스',
  'firstimpression': '퍼스트임프레션', 'bugbuzz': '벌레의야단법석', 'attackorder': '명령박치기',
  // 바위
  'stoneedge': '스톤에지', 'powergem': '파워젬', 'rockslide': '스톤샤워',
  'stealthrock': '스텔스록', 'ancientpower': '원시의힘', 'diamondstorm': '다이아몬드스톰',
  // 고스트
  'shadowball': '섀도볼', 'shadowclaw': '섀도크루', 'shadowsneak': '그림자몰래숨기',
  'polterigist': '폴터가이스트', 'hex': '짓밟기', 'phantomforce': '섀도다이브',
  // 드래곤
  'dracometeor': '용성군', 'outrage': '역린', 'dragonclaw': '드래곤클로',
  'dragonpulse': '용의파동', 'dragondance': '용의춤', 'clangingscales': '역린바수기',
  'dragondarts': '드래곤애로우', 'roaroftime': '시간의포효',
  // 악
  'darkpulse': '악의파동', 'crunch': '깨물어부수기', 'knockoff': '탁쳐서떨구기',
  'suckerpunch': '기습', 'nastyplot': '나쁜음모', 'throatchop': '목소리깨기',
  'foulplay': '치사량', 'lashout': '공격', 'fiendishpact': '악의약속',
  // 강철
  'flashcannon': '러스터캐논', 'ironhead': '아이언헤드', 'meteormash': '코멧펀치',
  'gyroball': '자이로볼', 'makeitrain': '러시골드', 'steelbeam': '강철빔',
  'sunsteelstrike': '선스틸스트라이크',
  // 페어리
  'moonblast': '문블라스트', 'playrough': '치근박치기', 'drainingkiss': '드레인키스',
  'dazzlinggleam': '매지컬샤인', 'spiritbreak': '영혼깨기', 'fleurcannon': '플뢰르캐논',
  // 노말
  'hyperbeam': '파괴광선', 'gigaimpact': '기가임팩트', 'extremespeed': '신속',
  'quickattack': '전광석화', 'facade': '치근박치기', 'doubleedge': '이판사판돌진',
  'bodyslam': '누르기', 'boomburst': '폭음파', 'hypervoice': '하이퍼보이스',
  'ragefist': '분노의주먹', 'populationbomb': '네즈미산', 'scaleshot': '스케일샷',
  // 상태기
  'swordsdance': '칼춤', 'calmmind': '명상', 'bulkup': '벌크업',
  'substitute': '대타출동', 'protect': '방어', 'detect': '판별',
  'recover': '자기재생', 'roost': '날개쉬기', 'rest': '잠자기',
  'wish': '희망사항', 'trickroom': '트릭룸', 'tailwind': '순풍',
  'lightscreen': '빛의장막', 'reflect': '리플렉터', 'auroraveil': '오로라베일',
  'stealthrock': '스텔스록', 'spikes': '압정뿌리기', 'toxicspikes': '독압정',
  'defog': '안개제거', 'rapidspin': '고속스핀', 'helpinghand': '도우미',
  'fakeout': '속이기', 'followme': '이리와', 'taunt': '도발',
  'encore': '앙코르', 'willowisp': '도깨비불', 'thunderwave': '전자파',
  'spore': '버섯포자', 'sleeppowder': '수면가루', 'stunspore': '마비가루',
  'terablast': '테라버스트', 'terastarstorm': '테라스타스톰',

  // ─── 추가 기술 매핑 (실전 위주) ───
  // 자폭/대폭발
  'explosion': '대폭발', 'selfdestruct': '자폭', 'mindblown': '폭발머리',
  'mistyexplosion': '미스트폭발',
  // 1턴 충전/2턴 기술
  'solarbeam': '솔라빔', 'solarblade': '솔라블레이드', 'meteorbeam': '메테오빔',
  'electroshot': '일렉트릭스파이크', 'phantomforce': '섀도다이브',
  'shadowforce': '섀도다이브', 'skyattack': '하늘의공격',
  'skullbash': '돌머리', 'freezeshock': '프리즈쇼크', 'iceburn': '아이스번',
  'futuresight': '미래예지', 'doomdesire': '파멸의소원',
  // 노말 필살기
  'hyperbeam': '파괴광선', 'gigaimpact': '기가임팩트', 'frenzyplant': '하드플랜트',
  'blastburn': '블러스트번', 'hydrocannon': '하이드로캐논',
  'eternabeam': '이터널빔', 'prismaticlaser': '프리즘레이저',
  'meteorassault': '메테오어설트', 'lightofruin': '파멸의빛',
  'lastresort': '최후의수단', 'gigatonhammer': '기간토해머',
  'rockwrecker': '록블래스트', 'doubleedge': '이판사판돌진',
  'thrash': '난동부리기', 'petaldance': '꽃잎댄스', 'outrage': '역린',
  'headsmash': '머리뽀개기', 'headcharge': '갈기머리태클',
  'highhorsepower': '10만마력', 'superpower': '근거리전법',
  'closecombat': '인파이트', 'highjumpkick': '무릎차기',
  'jumpkick': '점프킥', 'megakick': '메가킥', 'megapunch': '메가펀치',
  'crosschop': '크로스촙', 'dynamicpunch': '폭발펀치',
  'focuspunch': '기합펀치', 'hammerarm': '암해머',
  // 스텔라/특수 공격
  'photongeyser': '포톤가이저', 'astralbarrage': '아스트럴비트',
  'moongeistbeam': '문포스레이', 'sunsteelstrike': '선스틸스트라이크',
  'plasmafists': '플라스마피스트', 'fusionbolt': '크로스썬더',
  'fusionflare': '크로스플레임', 'boltstrike': '볼트스트라이크',
  'glaciatte': '빙류파', 'electrodrift': '일렉트릭드리프트',
  'collisioncourse': '러닝크래쉬',
  'malignantchain': '독사슬',
  // 풀
  'leafstorm': '리프스톰', 'frenzyplant': '하드플랜트',
  'seedflare': '시드플레어', 'chloroblast': '엽록폭탄',
  'dragonenergy': '드래곤에너지', 'eruption': '분화',
  'waterspout': '바다분수', 'bloodmoon': '블러드문',
  // 기타 강한 기술
  'aeroblast': '에어로블래스트', 'precipiceblades': '단애의칼',
  'sacredfire': '신성한불꽃', 'magmastorm': '마그마스톰',
  'inferno': '맹화', 'overheat': '오버히트', 'fireblast': '대문자불꽃',
  'searingshot': '버닝샷', 'dragonpulse': '용의파동',
  'dracometeor': '용성군', 'roaroftime': '시간의포효',
  'spacialrend': '공간절단', 'shadowball': '섀도볼',
  'darkpulse': '악의파동', 'icebeam': '냉동빔', 'blizzard': '눈보라',
  'thunderbolt': '10만볼트', 'thunder': '번개', 'discharge': '방전',
  'flashcannon': '러스터캐논', 'steelbeam': '강철빔',
  'mirrorshot': '미러샷', 'metalclaw': '메탈클로',
  'irontail': '아이언테일', 'ironhead': '아이언헤드',
  'meteormash': '코멧펀치', 'meteorbeam': '메테오빔',
  'gyroball': '자이로볼', 'autocannon': '오토캐논',
  'behemothblade': '거대한칼', 'behemothbash': '거대한방패',
  'sacredsword': '성검', 'secretsword': '비검',
  'leafblade': '잎날가르기', 'sacredfire': '신성한불꽃',
  'aquatail': '아쿠아테일', 'aquajet': '아쿠아제트',
  'firepunch': '불꽃펀치', 'icepunch': '냉동펀치',
  'thunderpunch': '번개펀치', 'machpunch': '마하펀치',
  'bulletpunch': '총알펀치', 'shadowpunch': '섀도펀치',
  'comet punch': '연속펀치', 'cometpunch': '연속펀치',
  // 변화기
  'spikes': '압정뿌리기', 'toxicspikes': '독압정',
  'stickyweb': '끈적끈적네트', 'stealthrock': '스텔스록',
  'rapidspin': '고속스핀', 'defog': '안개제거',
  'tailwind': '순풍', 'reflect': '리플렉터',
  'lightscreen': '빛의장막', 'auroraveil': '오로라베일',
  'safeguard': '신비의부적', 'mistyterrain': '미스트필드',
  'electricterrain': '일렉트릭필드', 'grassyterrain': '그래스필드',
  'psychicterrain': '사이코필드',
  'sunnyday': '쾌청', 'raindance': '비바라기', 'sandstorm': '모래바람',
  'snowscape': '눈보라치기', 'chillyreception': '냉랭한인사',
  'bellydrum': '배북', 'shellsmash': '껍질깨기', 'tailglow': '꼬리흔들기',
  'cosmicpower': '코즈믹파워', 'shiftgear': '기어체인지',
  'irondefense': '철벽', 'amnesia': '망각술',
  'agility': '고속이동', 'rockpolish': '바위갈기',
  'taunt': '도발', 'encore': '앙코르', 'disable': '사슬묶기',
  'imprison': '봉인', 'torment': '트집', 'roar': '울부짖기',
  'whirlwind': '회오리바람', 'dragontail': '드래곤테일',
  'circlethrow': '원반던지기', 'hex': '짓밟기',
  'painsplit': '아픔나누기', 'destinybond': '길동무',
  'magiccoat': '매직코트', 'snatch': '가로채기',
  'allyswitch': '사이드체인지', 'transform': '변신',
  'batonpass': '배턴터치', 'protect': '방어', 'detect': '판별',
  'wideguard': '넓은방어', 'quickguard': '빠른방어',
  'matblock': '매트블록', 'spikyshield': '니들가드',
  'kingsshield': '킹실드', 'banefulbunker': '독엄니',
  'obstruct': '블로킹', 'silktrap': '실고치트랩',
  'burningbulwark': '버닝벌워크',
  'recover': '자기재생', 'roost': '날개쉬기', 'rest': '잠자기',
  'slackoff': '게으름피우기', 'softboiled': '알낳기',
  'milkdrink': '우유마시기', 'wish': '희망사항',
  'moonlight': '월광', 'morningsun': '아침햇살', 'synthesis': '광합성',
  'strengthsap': '힘흡수', 'junglehealing': '정글치유',
  'lifedew': '생명의이슬', 'healorder': '치료명령',
  'leechseed': '씨뿌리기', 'leechlife': '기생충',
  'gigadrain': '기가드레인', 'drainpunch': '드레인펀치',
  'drainingkiss': '드레인키스', 'paraboliccharge': '파라볼라차지',
  'oblivionwing': '데스윙', 'hornleech': '뿔드릴',
  'hyperdrill': '하이퍼드릴', 'drillpeck': '드릴부리',
  'drillrun': '드릴라이너', 'fireblast': '대문자불꽃',
  'helpinghand': '도우미', 'fakeout': '속이기', 'followme': '이리와',
  'ragepowder': '분노의가루', 'taunt': '도발',
  'willowisp': '도깨비불', 'thunderwave': '전자파',
  'spore': '버섯포자', 'sleeppowder': '수면가루',
  'stunspore': '마비가루', 'poisonpowder': '독가루',
  'glare': '째려보기', 'hypnosis': '최면술',
  'darkvoid': '어둠의손짓', 'lovelykiss': '러블리키스',
  'sing': '노래하다', 'grasswhistle': '풀피리',
  'yawn': '하품', 'toxic': '맹독',
  // 다단 히트
  'iciclespear': '고드름침', 'rockblast': '록블래스트',
  'tailslap': '꼬리치기', 'pinmissile': '바늘미사일',
  'bulletseed': '씨기관총', 'doubleslap': '연속뺨치기',
  'cometpunch': '연속펀치', 'furyattack': '마구찌르기',
  'furyswipes': '연속할퀴기', 'armthrust': '연속찌르기',
  'spikecannon': '바늘대포',
  'doublehit': '더블어택', 'twineedle': '더블니들',
  'bonemerang': '본부메랑', 'bonerush': '본러쉬',
  'doublekick': '두번차기', 'gearup': '기어업',
  'tripleaxel': '트리플악셀', 'triplekick': '트리플킥',
  'triplearrow': '트리플애로우',
  'populationbomb': '네즈미산', 'scaleshot': '스케일샷',
  'dragondarts': '드래곤애로우', 'watershuriken': '물수리검',
  // 고스트
  'shadowclaw': '섀도크루', 'shadowsneak': '그림자몰래숨기',
  'shadowpunch': '섀도펀치', 'phantomforce': '섀도다이브',
  'lickedlick': '핥아맞히기', 'astonish': '놀래키기',
  'curse': '저주', 'nightshade': '나이트헤드',
  'shadowbone': '그림자뼈', 'spiritshackle': '그림자묶기',
  'spectralthief': '스펙터스틸',
  'poltergeist': '폴터가이스트', 'lastrespects': '묘참배',
  'rageusinghacker': '격분의주먹', 'ragefist': '분노의주먹',
  // 복합/특수
  'photongeyser': '포톤가이저', 'lightthatburnsthesky': '하늘을태우는불꽃',
  'searingsunrazesmash': '버닝선더라이즈',
  'sunsteelstrike': '선스틸스트라이크',
  'moongeistbeam': '문포스레이',
  'menacingmoonrazemaelstrom': '문라이즈',
  'roaroftime': '시간의포효', 'spacialrend': '공간절단',
  'oblivionwing': '데스윙', 'judgment': '심판',
  'hyperspacehole': '아공간돌진', 'hyperspacefury': '아공간격투',
  'shadowstrike': '그림자공격', 'fierywrath': '불타는분노',
  'springtidestorm': '봄바람폭풍', 'sandsearstorm': '사주폭풍',
  'bleakwindstorm': '한풍폭풍', 'wildboltstorm': '뇌전폭풍',
  'snowscape': '눈보라치기', 'chillyreception': '냉랭한인사',
  'icicleshower': '얼음폭포', 'glaciallance': '빙창',
  'subzeroslammer': '제로슬래머', 'iciclecrash': '고드름떨구기',
  // 우선도
  'extremespeed': '신속', 'firstimpression': '퍼스트임프레션',
  'fakeout': '속이기', 'feint': '페인트',
  'aquajet': '아쿠아제트', 'machpunch': '마하펀치',
  'bulletpunch': '총알펀치', 'iceshard': '얼음뭉치',
  'shadowsneak': '그림자몰래숨기', 'suckerpunch': '기습',
  'vacuumwave': '진공파', 'accelerock': '액셀록',
  'jetpunch': '제트펀치', 'thunderclap': '번개분노',
  'upperhand': '윗손뼉치기', 'grassyglide': '그래스슬라이더',
  // 60BP 이하 자주 쓰는 기술
  'aerialace': '제비반환', 'absorb': '흡수', 'acid': '에시드',
  'acidspray': '에시드봄', 'aircutter': '에어커터',
  'alluringvoice': '매혹의목소리', 'aquaring': '아쿠아링',
  'attract': '헤롱헤롱', 'aurawheel': '오라휠',
  'aurorabeam': '오로라빔', 'avalanche': '눈사태',
  'barbbarrage': '바브배러지', 'beakblast': '빅비크',
  'belch': '트림', 'bide': '인내', 'bind': '졸라매기',
  'bite': '물기', 'bitterblade': '비터블레이드',
  'bittermalice': '비통한짖음', 'blazekick': '블레이즈킥',
  'boltbeak': '볼트빅', 'boneclub': '뼈다귀치기',
  'bounce': '바운스', 'branchpoke': '나뭇가지로찌르기',
  'breakingswipe': '파괴의일격', 'brickbreak': '깨트리기',
  'brine': '염수',  'bubblebeam': '버블광선',
  'bugbite': '벌레먹기', 'bulldoze': '땅고르기',
  'icehammer': '아이스해머', 'wavecrash': '웨이브태클',
  'liquidation': '아쿠아브레이크', 'surgingstrikes': '수류연타',
  'scald': '열탕', 'steameruption': '증기폭발',
  'hydrosteam': '수증기포', 'aquastep': '물의춤',
  'aquacutter': '아쿠아커터', 'crabhammer': '크래비해머',
  'krabhammer': '크래비해머', 'razorshell': '셸러브레이드',
  'snipeshot': '저격', 'flipturn': '유턴태클',
  'uturn': 'U턴', 'voltswitch': '볼트체인지', 'partingshot': '울며헤어지기',
  'teleport': '순간이동',
  'pursuit': '추적', 'darkestlariat': 'DD래리어트',
  'bruteswing': '브루트스윙',  'icefang': '얼음엄니',
  'firefang': '불꽃엄니', 'thunderfang': '번개엄니',
  'psychicfangs': '사이코엄니', 'poisonfang': '독엄니',
  'jawlock': '꽉문다',  'firstimpression': '퍼스트임프레션',
  'savagespinout': '와일드토네이도',  // 일부는 Z기지만 호환성

  // ─── 2차 정확성 패치 (공식 한국어명 보정) ───
  'grassyglide': '그래스슬라이더', 'thunderclap': '번개분노',
  'upperhand': '윗손뼉치기', 'moonblast': '문블라스트',
  'stickyweb': '끈적끈적네트', 'bellydrum': '배북',
  'allyswitch': '사이드체인지', 'flipturn': '유턴태클',
  'strengthsap': '힘흡수', 'junglehealing': '정글치유',
  'lastrespects': '묘참배', 'springtidestorm': '봄바람폭풍',
  'astralbarrage': '아스트럴비트', 'brickbreak': '깨트리기',
  'pursuit': '추적', 'darkestlariat': 'DD래리어트',
  'fierywrath': '불타는분노', 'aerialace': '제비반환',
  'crosschop': '크로스촙', 'surgingstrikes': '수류연타',
  'aquacutter': '아쿠아커터', 'crabhammer': '크래비해머',
  'leechlife': '기생충', 'bodypress': '보디프레스',
  'aurasphere': '파동탄', 'rockslide': '록슬라이드',
  'foulplay': '이판사판', 'hex': '짓밟기',
  'heavydutyboots': '두꺼운장화', 'covertcloak': '투명망토',
  'utilityumbrella': '만능우산', 'leftovers': '먹다남은음식',
};

// ─────────────────────────────────────────────────
// 특성 한국어 수동 매핑 (주요 특성)
// ─────────────────────────────────────────────────
const ABILITY_KO = {
  // 공격 특성
  'intimidate': '위협', 'hugepower': '순수한힘', 'purepower': '순정',
  'adaptability': '다능', 'guts': '의기양양', 'toughclaws': '단단한발톱',
  'technician': '테크니션', 'sheerforce': '우격다짐', 'solarpower': '선파워',
  'blaze': '맹화', 'torrent': '격류', 'overgrow': '심록', 'swarm': '벌레의알림',
  'sandforce': '모래의힘', 'refrigerate': '프리즈스킨', 'aerilate': '에어레이트',
  'pixilate': '페어리스킨', 'galvanize': '일렉트릭스킨',
  'strongjaw': '강한턱', 'megalauncher': '메가런처', 'ironfist': '철주먹',
  'punkrock': '펑크록', 'steelworker': '강철술사', 'dragonsmaw': '용의턱',
  'transistor': '트랜지스터', 'protean': '프로텍션',
  'libero': '리베로', 'hustle': '근성', 'moxie': '자기과신',
  'reckless': '이판사판', 'tintedlens': '색안경', 'analytic': '애널라이즈',
  'neuroforce': '뇌장', 'supremeoverlord': '총대장',
  
  // 방어 특성
  'thickfat': '두꺼운지방', 'furcoat': '털가죽', 'marvelscale': '이상한비늘',
  'filter': '필터', 'prismarmor': '프리즘아머', 'solidrock': '단단한바위',
  'multiscale': '멀티스케일', 'shadowshield': '섀도실드',
  'levitate': '부유', 'waterabsorb': '저수', 'voltabsorb': '축전',
  'lightningrod': '피뢰침', 'storm drain': '마중물', 'stormdrain': '마중물',
  'flashfire': '불꽃몸', 'sapsipper': '초식', 'motordrive': '전동',
  'earthen eater': '흙먹기', 'earth eater': '흙먹기', 'earthenEater': '흙먹기',
  'wellbakedbody': '굿바디', 'icescales': '얼음비늘',
  'dryskin': '건조피부', 'fluffy': '플러피',
  'whitesmoke': '하얀연기', 'clearbody': '클리어바디', 'fullmetalbody': '풀메탈바디',
  'unaware': '천진', 'magicguard': '매직가드',
  'regenerator': '재생력', 'naturalcure': '자연회복', 'poisonheal': '포이즌힐',
  
  // 날씨/필드 특성
  'drought': '가뭄', 'drizzle': '잔비', 'sandstream': '모래날림', 'snowwarning': '눈퍼붓기',
  'electricsurge': '일렉트릭메이커', 'grassysurge': '그래스메이커',
  'psychicsurge': '사이코메이커', 'mistysurge': '미스트메이커',
  'orichalcumpulse': '진홍빛고동', 'hadronengine': '하드론엔진',
  
  // 메가 전용 / 레거시
  'parentalbond': '부자유친', 'toughclaws': '단단한발톱',
  'aerilate': '에어레이트',
  'shadowtag': '그림자밟기', 'unburden': '짐풀기',
  'soulheart': '소울하트', 'speedboost': '가속',
  'libero': '리베로', 'protean': '변환자재', 'sharpness': '예리함',
  'orichalcumpulse': '진홍빛고동', 'hadronengine': '하드론엔진',
  'protosynthesis': '고대활성', 'quarkdrive': '쿼크차지',
  'serenegrace': '하늘의은총', 'rockhead': '돌머리',
  'magicguard': '매직가드', 'regenerator': '재생력',
  'queenlymajesty': '여왕의위엄', 'dazzling': '댐피티', 'armortail': '아머테일',
  'psychicsurge': '사이코메이커', 'electricsurge': '일렉트릭메이커',
  'grassysurge': '그래스메이커', 'mistysurge': '미스트메이커',
  'flamebody': '불꽃몸', 'static': '정전기', 'poisontouch': '독수',
  'mirrorarmor': '미러아머', 'cottondown': '솜털', 'gooey': '미끈미끈',
  'tanglinghair': '엉킨머리카락', 'beadsofruin': '재앙의구슬',
  'tabletsofruin': '재앙의목간', 'swordofruin': '재앙의검',
  'vesselofruin': '재앙의그릇', 'cudchew': '되새김질',
  'wellbakedbody': '굿바디', 'angerpoint': '분노의경혈',
  'guarddog': '경비견', 'thermalexchange': '열교환',

  // 중요 미매핑 추가
  'intimidate': '위협', 'sturdy': '옹골참',
  'rivalry': '투쟁심', 'pickup': '픽업', 'truant': '게으름',
  'clearbody': '클리어바디', 'fullmetalbody': '풀메탈바디',
  'whitesmoke': '흰연기', 'mypace': '마이페이스',
  'noguard': '노가드', 'compoundeyes': '복안',
  'tintedlens': '색안경', 'levitate': '부유',
  'effectspore': '포자', 'pressure': '프레셔',
  'shielddust': '방진', 'innerfocus': '정신력',
  'magicbounce': '매직미러', 'soundproof': '방음',
  'unburden': '짐풀기', 'aerilate': '에어레이트',
  'pixilate': '페어리스킨', 'galvanize': '일렉트릭스킨',
  'refrigerate': '프리즈스킨', 'normalize': '노말스킨',
  'gluttony': '먹보', 'klutz': '서투름',
  'multitype': '멀티타입', 'rkssystem': 'RKS시스템',
  'stallness': '여유부리기',  'stall': '여유부리기',
  'truant': '게으름', 'slowstart': '슬로스타트',
  'ironbarbs': '철가시', 'roughskin': '까칠한피부',
  'cursedbody': '저주받은바디', 'gooey': '미끈미끈',
  'tanglinghair': '엉킨머리카락', 'aftermath': '유폭',
  'innardsout': '내용물분출', 'liquidooze': '오물액',
  'ballfetch': '볼줍기', 'sweetveil': '스위트베일',
  'overcoat': '방진', 'oblivious': '둔감',
  'limber': '유연', 'illuminate': '발광', 'noability': '없음',
  'electromorphosis': '전자변환', 'windrider': '바람타기',
  'goodasgold': '황금몸', 'lingeringaroma': '잔향',
  'opportunist': '편승', 'toxicchain': '독사슬',
  'embodyaspectteal': '벽록의화신',
  'embodyaspectwellspring': '우물의화신',
  'embodyaspecthearthflame': '화덕의화신',
  'embodyaspectcornerstone': '초석의화신',
  'mindseye': '심안', 'commander': '지휘관',
  'gorillatactics': '고릴라전법', 'steelyspirit': '강철의의지',
  'rockypayload': '바위적재', 'darkaura': '다크오라',
  'fairyaura': '페어리오라', 'aurabreak': '오라브레이크',
  'asoneglastrier': '혼연일체(블리자포스)',
  'asonespectrier': '혼연일체(레이스포스)',

  // ─── 추가 특성 매핑 ───
  'airlock': '에어록', 'cloudnine': '노웨더',
  'angershell': '분노의껍질', 'anticipation': '위험예지',
  'arenatrap': '개미지옥', 'aromaveil': '아로마베일',
  'baddreams': '나이트메어', 'battery': '배터리',
  'battlearmor': '배틀아머', 'battlebond': '유대변화',
  'beastboost': '비스트부스트', 'berserk': '시작이반',
  'bigpecks': '가슴노출', 'bulletproof': '방탄',
  'cheekpouch': '볼주머니', 'chillingneigh': '백의울음소리',
  'colorchange': '컬러체인지', 'commander': '지휘관',
  'competitive': '승기', 'cottondown': '솜털',
  'curiousmedicine': '비약', 'cutecharm': '헤롱헤롱바디',
  'dancer': '리시버', 'darkaura': '다크오라',
  'fairyaura': '페어리오라', 'aurabreak': '오라브레이크',
  'defiant': '오기', 'deltastream': '델타스트림',
  'desolateland': '시작의태양', 'primordialsea': '시작의바다',
  'disguise': '비장의모습', 'earlybird': '빠른수면',
  'eartheater': '흙먹기', 'emergencyexit': '위기회피',
  'fairyaura': '페어리오라', 'fillet': '구원자',
  'fluffy': '플러피', 'forewarn': '예지력',
  'friendguard': '프렌드가드', 'frisk': '프리스크',
  'galewings': '질풍날개', 'gluttony': '먹보',
  'goodasgold': '황금몸', 'gorillatactics': '고릴라전법',
  'grimneigh': '흑의울음소리', 'gulpmissile': '미사일꺽지',
  'guts': '의기양양', 'harvest': '수확',
  'healer': '치유의마음', 'hugepower': '순수한힘',
  'icebody': '아이스바디', 'illusion': '일루전',
  'immunity': '면역', 'imposter': '체인지',
  'infiltrator': '틈새찌르기', 'innardsout': '내용물분출',
  'innerfocus': '정신력', 'insomnia': '불면',
  'intimidate': '위협', 'intrepidsword': '불요의검',
  'ironbarbs': '철가시', 'justified': '정의의마음',
  'keeneye': '날카로운눈', 'lightmetal': '라이트메탈',
  'liquidooze': '오물액', 'liquidvoice': '리퀴드보이스',
  'longreach': '원격', 'magnetpull': '마그넷풀',
  'megalauncher': '메가런처', 'merciless': '뱅글뱅글',
  'mimicry': '의태', 'minus': '마이너스',
  'mirrorarmor': '미러아머', 'mistysurge': '미스트메이커',
  'moldbreaker': '틀깨기', 'mountaineer': '산나물',
  'mummy': '미라', 'naturalcure': '자연회복',
  'neutralizinggas': '화학변화가스', 'normalize': '노말스킨',
  'oblivious': '둔감', 'opportunist': '편승',
  'overcoat': '방진', 'overgrow': '심록',
  'owntempo': '마이페이스', 'parentalbond': '부자유친',
  'pastelveil': '파스텔베일', 'perishbody': '운명바디',
  'pickpocket': '주머니털기', 'pickup': '픽업',
  'pixilate': '페어리스킨', 'plus': '플러스',
  'poisonheal': '포이즌힐', 'poisontouch': '독수',
  'powerconstruct': '스웜체인지', 'powerofalchemy': '연금술',
  'powerspot': '파워스폿', 'prankster': '짓궂은마음',
  'pressure': '프레셔', 'prismarmor': '프리즘아머',
  'protean': '변환자재', 'psychicsurge': '사이코메이커',
  'punkrock': '펑크록', 'purifyingsalt': '청정의소금',
  'queenlymajesty': '여왕의위엄', 'quickdraw': '퀵드로',
  'quickfeet': '쾌속', 'rainwitness': '빗자국',
  'rattled': '주눅', 'receiver': '리시버',
  'reckless': '이판사판', 'refrigerate': '프리즈스킨',
  'ripen': '숙성', 'rivalry': '투쟁심',
  'rkssystem': 'RKS시스템', 'rockhead': '돌머리',
  'roughskin': '까칠한피부', 'runaway': '도주',
  'sandforce': '모래의힘', 'sandrush': '모래헤치기',
  'sandspit': '모래뿌리기', 'sandstream': '모래날림',
  'sandveil': '모래숨기', 'sapsipper': '초식',
  'schooling': '어군',  'scrappy': '배짱',
  'screencleaner': '스크린클리너', 'seedSower': '씨뿌리기',
  'serenegrace': '하늘의은총', 'shadowshield': '섀도실드',
  'shadowtag': '그림자밟기', 'sharpness': '예리함',
  'shedskin': '탈피', 'sheerforce': '우격다짐',
  'shielddust': '방진가루', 'shieldsdown': '리미트실드',
  'simple': '단순', 'skilllink': '스킬링크',
  'slowstart': '슬로스타트', 'slushrush': '눈치우기',
  'sniper': '스나이퍼', 'snowcloak': '눈숨기',
  'snowwarning': '눈퍼붓기', 'solarpower': '선파워',
  'solidrock': '단단한바위', 'soulheart': '소울하트',
  'soundproof': '방음', 'speedboost': '가속',
  'stakeout': '잠복', 'stamina': '지구력',
  'stalwart': '저격수', 'stancechange': '배틀스위치',
  'static': '정전기', 'steadfast': '불굴의마음',
  'steamengine': '스팀엔진', 'steelworker': '강철술사',
  'steelyspirit': '강철의의지', 'stench': '악취',
  'stickyhold': '점착', 'stormdrain': '마중물',
  'strongjaw': '강한턱', 'sturdy': '옹골참',
  'suctioncups': '흡반', 'superluck': '대운',
  'supremeoverlord': '총대장', 'surgesurfer': '서핑테일',
  'swarm': '벌레의알림', 'sweetveil': '스위트베일',
  'swiftswim': '쓱쓱', 'symbiosis': '공생',
  'synchronize': '싱크로', 'tangledfeet': '갈지자걸음',
  'tanglinghair': '엉킨머리카락', 'technician': '테크니션',
  'telepathy': '텔레파시', 'teravolt': '테라볼트',
  'thermalexchange': '열교환', 'thickfat': '두꺼운지방',
  'tintedlens': '색안경', 'torrent': '격류',
  'toughclaws': '단단한발톱', 'toxicboost': '독부스트',
  'toxicchain': '독사슬', 'toxicdebris': '독박살',
  'trace': '트레이스', 'transistor': '트랜지스터',
  'triage': '응급', 'truant': '게으름',
  'turboblaze': '터보블레이즈', 'unaware': '천진',
  'unburden': '짐풀기', 'unnerve': '긴장감',
  'unseenfist': '연격의태세', 'victorystar': '승리의별',
  'vitalspirit': '의기양양', 'voltabsorb': '축전',
  'wanderingspirit': '떠도는영혼', 'waterabsorb': '저수',
  'waterbubble': '수포', 'watercompaction': '수경화',
  'waterveil': '수의베일', 'weakarmor': '깨진갑옷',
  'whitesmoke': '흰연기', 'wimpout': '도주준비',
  'windpower': '풍력발전', 'windrider': '바람타기',
  'wonderguard': '불가사의부적', 'wondersink': '깜짝상자',
  'wonderskin': '깜짝상자', 'zenmode': '달마모드',
  'zerotohero': '마이티체인지',
  
  // 특수
  'stakeout': '잠복',
  'moldbreaker': '틀깨기', 'teravolt': '테라볼트', 'turboblaze': '터보블레이즈',
  'scrappy': '배짱', 'overcoat': '방진',
  'contrary': '심술꾸러기', 'simple': '단순',
  'serene grace': '하늘의은총', 'serenegrace': '하늘의은총',
  'trace': '트레이스', 'download': '다운로드',
  'imposter': '가바가바', 'wonderguard': '불가사의부적',
  'stamina': '지구력', 'intrepidsword': '불요의검', 'dauntlessshield': '불굴의방패',
  'asone': '혼연일체', 'asoneglastrier': '혼연일체(블리자포스)', 'asonespectrier': '혼연일체(레이스포스)'
};

// ─────────────────────────────────────────────────
// 아이템 한국어 수동 매핑 (주요)
// ─────────────────────────────────────────────────
const ITEM_KO = {
  'lifeorb': '생명의구슬', 'choiceband': '구애머리띠', 'choicespecs': '구애안경',
  'choicescarf': '구애스카프', 'assaultvest': '돌격조끼', 'eviolite': '진화의휘석',
  'expertbelt': '달인의띠', 'focussash': '기합의띠', 'focusband': '기합의머리띠',
  'leftovers': '먹다남은음식', 'sitrusberry': '자뭉열매', 'blackglasses': '검은안경',
  'rockyhelmet': '울퉁불퉁멧', 'heavydutyboots': '두꺼운장화', 'roseli berry': '로세리열매',
  'covertcloak': '바트굿즈', 'clearamulet': '맑은부적', 'boosterenergy': '부스트에너지',
  'airballoon': '풍선', 'blacksludge': '까만진흙', 'toxicorb': '맹독구슬',
  'flameorb': '화염구슬', 'loadeddice': '그런주사위', 'punchingglove': '펀칭글러브',
  'throatspray': '목캔디', 'mirrorherb': '모사허브',
  'safetygoggles': '방진고글', 'weaknesspolicy': '약점보험',
  'luminousmoss': '빛나는이끼', 'cellbattery': '충전지',
  'widelens': '광각렌즈', 'zoomlens': '줌렌즈', 'scopelens': '스코프렌즈',
  'quickclaw': '빠른발톱', 'brightpowder': '반짝이가루',
  'powerherb': '파워허브', 'whiteherb': '하양허브',
  'mentalherb': '멘탈허브', 'redcard': '레드카드',
  'lightclay': '빛의점토', 'terrorb': '테라스탈오브',
  // 타입 강화
  'charcoal': '숯', 'mysticwater': '신비의물방울', 'miracleseed': '기적의씨',
  'magnet': '자석', 'neverMeltIce': '녹지않는얼음', 'nevermeltice': '녹지않는얼음',
  'blackbelt': '검은띠', 'poisonbarb': '독바늘', 'softsand': '부드러운모래',
  'sharpbeak': '예리한부리', 'twistedspoon': '트위스트스푼', 'silverpowder': '은색가루',
  'hardstone': '딱딱한돌', 'spelltag': '저주의부적', 'dragonfang': '용의송곳니',
  'metalcoat': '메탈코트', 'fairyfeather': '요정의깃털', 'silkscarf': '실크스카프',
  // 메가스톤
  'charizarditex': '리자드나이트X', 'charizarditey': '리자드나이트Y',
  'gyaradosite': '갸라도스나이트', 'tyranitarite': '마기라스나이트',
  'salamencite': '보만다나이트', 'garchompite': '한카리아스나이트',
  'metagrossite': '메타그로스나이트', 'gardevoirite': '가디안나이트',
  'kangaskhanite': '캥카나이트', 'mewtwonitex': '뮤츠나이트X', 'mewtwonitey': '뮤츠나이트Y',
  'gengarite': '팬텀나이트', 'togekissite': '토게키스나이트',
  'pidgeotite': '피죤투나이트', 'medichamite': '요가램나이트',
  'lucarionite': '루카리오나이트', 'abomasite': '눈설왕나이트',
  'absolite': '앱솔나이트', 'aerodactylite': '프테라나이트', 'aggronite': '보스로라나이트',
  'alakazite': '후딘나이트', 'ampharosite': '전룡나이트', 'audinite': '다부니나이트',
  'banettite': '다크펫나이트', 'beedrillite': '독침붕나이트', 'blastoisinite': '거북왕나이트',
  'blazikenite': '번치코나이트', 'cameruptite': '폭타나이트', 'diancite': '디안시나이트',
  'galladite': '엘레이드나이트', 'glalitite': '얼음귀신나이트', 'heracronite': '헤라크로스나이트',
  'houndoominite': '헬가나이트', 'latiasite': '라티아스나이트', 'latiosite': '라티오스나이트',
  'lopunnite': '이어롭나이트', 'manectite': '썬더볼트나이트', 'mawilite': '입치트나이트',
  'pinsirite': '쁘사이저나이트', 'sableite': '검은눈나이트', 'sceptilite': '나무킹나이트',
  'scizorite': '핫삼나이트', 'sharpedonite': '샤크니아나이트', 'slowbronite': '야도란나이트',
  'steelixite': '강철톤나이트', 'swampertite': '대짱이나이트', 'venusaurite': '이상해꽃나이트',
  'redorb': '붉은구슬', 'blueorb': '푸른구슬',

  // ─── 추가 아이템 매핑 ───
  // 진화 관련
  'oranberry': '오랭열매', 'lumberry': '리샘열매',
  'pechaberry': '복슝열매', 'rawstberry': '나로코열매',
  'cheriberry': '체리열매', 'chestoberry': '쟈본열매',
  'aspearberry': '카리열매', 'persimberry': '브리바열매',
  'leppaberry': '레첸열매', 'salacberry': '슈캐열매',
  'liechiberry': '치이라열매', 'petayaberry': '캠라열매',
  'apicotberry': '카토레열매', 'ganlonberry': '랑사열매',
  'starfberry': '스타미열매', 'enigmaberry': '미라클열매',
  'micleberry': '미크르열매', 'custapberry': '데자루열매',
  'jabocaberry': '쟈포카열매', 'rowapberry': '로파파열매',
  'kebiaberry': '키이의열매', 'shucaberry': '슈카열매',
  'cobaberry': '코바열매', 'payapaberry': '파야파열매',
  'tangaberry': '방가열매', 'chartiberry': '챠리열매',
  'kasibberry': '카시브열매', 'habanberry': '하반열매',
  'colburberry': '코르번열매', 'babiriberry': '바브지열매',
  'chilanberry': '치란열매', 'occaberry': '오카열매',
  'passhoberry': '파시오열매', 'wacanberry': '와카열매',
  'rindoberry': '린드열매', 'yacheberry': '얌어열매',
  'roseliberry': '로세리열매', 'mago berry': '마트마열매',
  'magoberry': '마트마열매', 'iapapaberry': '이아파파열매',
  'wikiberry': '위키열매', 'aguavberry': '얼시열매',
  'figyberry': '망마열매', 'maranga berry': '마랑가열매',
  // 메가스톤 추가 (BST 식별용)
  'meganiumite': '메가니움나이트', 'feraligatrite': '장크로다일나이트',
  'excadrillite': '몰드비스트나이트', 'scovillainite': '스코빌레인나이트',
  'banettite': '다크펫나이트', 'beedrillite': '독침붕나이트',
  // 화석/도구
  'shed shell': '탈출버튼',  'shedshell': '탈출버튼',
  'gripclaw': '구속의갈고리', 'bigroot': '큰뿌리',
  'lightclay': '빛의점토', 'absorbbulb': '흡수의구체',
  'cellbattery': '충전지', 'snowball': '눈공',
  'luminousmoss': '빛나는이끼', 'protectivepads': '프로텍트패드',
  'terrainextender': '필드확장기', 'utilityumbrella': '만능우산',
  'roomservice': '룸서비스', 'ejectpack': '탈출팩',
  'ejectbutton': '탈출버튼', 'shedshell': '탈출버튼',
  'redcard': '레드카드', 'whitherb': '하양허브',
  'mentalherb': '멘탈허브', 'powerherb': '파워허브',
  'absorbbulb': '흡수의구체', 'safetygoggles': '방진고글',
  'covertcloak': '투명망토', 'clearamulet': '맑은부적',
  'mirrorherb': '모사허브', 'punchingglove': '펀칭글러브',
  'loadeddice': '그런주사위', 'boosterenergy': '부스트에너지',
  'abilityshield': '특성가드', 'fairyfeather': '요정의깃털',
  // Treasure of Ruin 토템
  'mysteriousjar': '신비의항아리',
  // 진화 도구 (NFE 보유 시 효과)
  'eviolite': '진화의휘석',
  // 기타
  'leek': '대파', 'stick': '대파',
  'thickclub': '굵은뼈', 'lightball': '전기구슬',
  'luckypunch': '럭키펀치', 'metalpowder': '메탈파우더',
  'quickpowder': '퀵파우더', 'soulddew': '소울듀',
  'souldew': '소울듀', 'griseousorb': '깨어진구슬',
  'griseouscore': '깨어진코어', 'rustedsword': '녹슨검',
  'rustedshield': '녹슨방패', 'reinsofunity': '백신혹/흑신혹',
  'auspiciousarmor': '복귀의갑옷', 'maliciousarmor': '저주받은갑옷',
  'adamantorb': '아다만트구슬', 'lustrousorb': '하얀구슬',
  // 라티@스 전용
  'soulldew': '소울듀',
};

// ─────────────────────────────────────────────────
// 포켓몬 필터링: 챔피언스 환경에 맞게 경량화
// 기준:
//   - Gen 1~9 정규 포켓몬
//   - 진화 완료(NFE 아닌 것) 또는 BST >= 450
//   - 모든 메가진화
//   - Paldea Form 전부 (신규)
// ─────────────────────────────────────────────────
const filteredPokemon = pokemon.filter(p => {
  if (p.isMega) return true;  // 메가 전부
  if (p.isPrimal) return true;  // 원시회귀
  // 미니멀 모드: NFE가 아니면 포함, NFE여도 BST 400+ 이면 포함
  if (!p.nfe) return true;
  if (p.bst >= 400) return true;
  return false;
});

// koName이 null인 포켓몬은 영문 이름 fallback
filteredPokemon.forEach(p => {
  if (!p.koName) p.koName = p.name;
});

// ─────────────────────────────────────────────────
// 기술 필터링: 공격기 + 주요 상태기
// ─────────────────────────────────────────────────
const filteredMoves = moves.filter(m => {
  // Z기/Max기는 이미 제외됨
  if (m.category !== 'Status' && m.basePower > 0) return true;
  // 주요 상태기 (셋업 등)
  const importantStatus = [
    'swordsdance', 'calmmind', 'bulkup', 'dragondance', 'nastyplot', 'irondefense',
    'cosmicpower', 'shiftgear', 'shellsmash', 'tailglow', 'quiverdance',
    'substitute', 'protect', 'detect', 'wideguard', 'quickguard', 'matblock',
    'recover', 'roost', 'rest', 'slackoff', 'softboiled', 'wish', 'moonlight',
    'morningsun', 'synthesis', 'strengthsap', 'painsplit', 'junglehealing',
    'trickroom', 'tailwind', 'lightscreen', 'reflect', 'auroraveil',
    'stealthrock', 'spikes', 'toxicspikes', 'stickyweb',
    'defog', 'rapidspin', 'coursingbreath',
    'willowisp', 'thunderwave', 'toxic', 'spore', 'sleeppowder',
    'helpinghand', 'fakeout', 'followme', 'ragepowder', 'allyswitch',
    'taunt', 'encore', 'disable', 'imprison', 'torment',
    'transform', 'batonpass', 'magiccoat', 'destinybond',
    'sunnyday', 'raindance', 'sandstorm', 'snowscape', 'chillyreception',
    'electricterrain', 'grassyterrain', 'psychicterrain', 'mistyterrain',
    'terablast', 'terastarstorm', 'whirlwind', 'roar', 'dragontail',
    'bellydrum', 'stockpile'
  ];
  if (importantStatus.includes(m.id)) return true;
  return false;
});

// koName 보강
filteredMoves.forEach(m => {
  if (!m.koName) {
    m.koName = MOVE_KO[m.id] || m.name;
  }
});

// ─────────────────────────────────────────────────
// 특성 필터링: 실전 특성만
// 완전한 리스트는 @pkmn/dex의 모든 특성 (310개) 중 실제 영향 있는 것
// 간단히 모두 포함
// ─────────────────────────────────────────────────
const filteredAbilities = abilities.filter(a => a.num > 0);
filteredAbilities.forEach(a => {
  if (!a.koName) {
    a.koName = ABILITY_KO[a.id] || a.name;
  }
});

// ─────────────────────────────────────────────────
// 아이템 필터링: 전투용만
// ─────────────────────────────────────────────────
const filteredItems = items.filter(i => {
  // Z크리스탈, 원시구슬, 메가스톤, 나무열매, 기본 배틀 아이템만
  if (i.megaStone) return true;
  if (i.id.endsWith('berry') && i.shortDesc.length > 0) return true;
  // 주요 배틀 아이템
  const battleItems = [
    'lifeorb', 'choiceband', 'choicespecs', 'choicescarf',
    'assaultvest', 'eviolite', 'expertbelt', 'focussash', 'focusband',
    'leftovers', 'blackglasses', 'rockyhelmet', 'heavydutyboots',
    'covertcloak', 'clearamulet', 'boosterenergy', 'airballoon',
    'blacksludge', 'toxicorb', 'flameorb', 'loadeddice', 'punchingglove',
    'throatspray', 'mirrorherb', 'safetygoggles', 'weaknesspolicy',
    'luminousmoss', 'cellbattery', 'widelens', 'zoomlens', 'scopelens',
    'quickclaw', 'brightpowder', 'powerherb', 'whiteherb',
    'mentalherb', 'redcard', 'lightclay', 'bigroot',
    'metronome', 'muscleband', 'wiseglasses', 'bindingband',
    'flameplate', 'splashplate', 'zapplate', 'meadowplate',
    'icicleplate', 'fistplate', 'toxicplate', 'earthplate',
    'skyplate', 'mindplate', 'insectplate', 'stoneplate',
    'spookyplate', 'dracoplate', 'dreadplate', 'ironplate', 'pixieplate',
    // 타입 강화
    'charcoal', 'mysticwater', 'miracleseed', 'magnet', 'nevermeltice',
    'blackbelt', 'poisonbarb', 'softsand', 'sharpbeak', 'twistedspoon',
    'silverpowder', 'hardstone', 'spelltag', 'dragonfang', 'metalcoat',
    'fairyfeather', 'silkscarf', 'redorb', 'blueorb',
    // 스탯 증가 아이템
    'thickclub', 'lightball', 'luckypunch', 'stick', 'soulddew', 'souldew',
    'deepseatooth', 'deepseascale', 'metalpowder', 'quickpowder', 'griseousorb',
    // 특성 변경
    'utilityumbrella', 'abilityshield', 'punchingglove'
  ];
  if (battleItems.includes(i.id)) return true;
  return false;
});

filteredItems.forEach(i => {
  if (!i.koName) {
    i.koName = ITEM_KO[i.id] || i.name;
  }
});

// ─────────────────────────────────────────────────
// 데이터 축소: 필요한 필드만 유지 (HTML 크기 최적화)
// ─────────────────────────────────────────────────
const minPokemon = filteredPokemon.map(p => ({
  id: p.id,
  name: p.name,
  koName: p.koName,
  base: p.baseSpecies,
  forme: p.forme,
  types: p.types,
  bs: p.baseStats,
  bst: p.bst,
  ab: p.abilities,
  wt: p.weightkg,
  mega: p.isMega || undefined,
  primal: p.isPrimal || undefined,
  req: p.requiredItem || undefined,
  nfe: p.nfe || undefined
}));

const minMoves = filteredMoves.map(m => ({
  id: m.id,
  name: m.name,
  koName: m.koName,
  type: m.type,
  cat: m.category,
  bp: m.basePower,
  acc: m.accuracy,
  pri: m.priority,
  pp: m.pp,
  tgt: m.target,
  flags: m.flags,
  mh: m.multihit || undefined,
  drain: m.drain || undefined,
  recoil: m.recoil || undefined,
  cr: m.critRatio !== 1 ? m.critRatio : undefined,
  sec: m.secondary || undefined,
  desc: m.shortDesc
}));

const minAbilities = filteredAbilities.map(a => ({
  id: a.id,
  name: a.name,
  koName: a.koName,
  desc: a.shortDesc
}));

const minItems = filteredItems.map(i => ({
  id: i.id,
  name: i.name,
  koName: i.koName,
  ms: i.megaStone || undefined,
  iu: i.itemUser || undefined,
  desc: i.shortDesc
}));

// ─────────────────────────────────────────────────
// 출력: 4개 JSON 파일 + 통합 JS
// ─────────────────────────────────────────────────
fs.writeFileSync(path.join(OUT, 'pokemon.json'), JSON.stringify(minPokemon));
fs.writeFileSync(path.join(OUT, 'moves.json'), JSON.stringify(minMoves));
fs.writeFileSync(path.join(OUT, 'abilities.json'), JSON.stringify(minAbilities));
fs.writeFileSync(path.join(OUT, 'items.json'), JSON.stringify(minItems));

console.log('✓ 필터링 완료 (minified)');
console.log(`  포켓몬: ${minPokemon.length}종 (메가 ${minPokemon.filter(p => p.mega).length}종)`);
console.log(`  기술:   ${minMoves.length}개`);
console.log(`  특성:   ${minAbilities.length}개`);
console.log(`  아이템: ${minItems.length}개`);
console.log();

// 파일 크기
for (const f of ['pokemon.json', 'moves.json', 'abilities.json', 'items.json']) {
  const size = (fs.statSync(path.join(OUT, f)).size / 1024).toFixed(1);
  console.log(`  ${f}: ${size} KB`);
}
const total = ['pokemon.json','moves.json','abilities.json','items.json']
  .reduce((s, f) => s + fs.statSync(path.join(OUT, f)).size, 0);
console.log(`  총합: ${(total/1024).toFixed(1)} KB`);

// 한국어 매핑 통계
const pKo = minPokemon.filter(p => p.koName && /[가-힣]/.test(p.koName)).length;
const mKo = minMoves.filter(m => m.koName && /[가-힣]/.test(m.koName)).length;
const aKo = minAbilities.filter(a => a.koName && /[가-힣]/.test(a.koName)).length;
const iKo = minItems.filter(i => i.koName && /[가-힣]/.test(i.koName)).length;
console.log();
console.log('한국어 매핑 비율:');
console.log(`  포켓몬: ${pKo}/${minPokemon.length} (${(pKo/minPokemon.length*100).toFixed(0)}%)`);
console.log(`  기술:   ${mKo}/${minMoves.length} (${(mKo/minMoves.length*100).toFixed(0)}%)`);
console.log(`  특성:   ${aKo}/${minAbilities.length} (${(aKo/minAbilities.length*100).toFixed(0)}%)`);
console.log(`  아이템: ${iKo}/${minItems.length} (${(iKo/minItems.length*100).toFixed(0)}%)`);
