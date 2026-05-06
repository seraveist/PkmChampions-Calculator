/* ════════════════════════════════════════════════════════════
 * 03-calc-ui.js — 계산기 페이지 UI: state, ENTRY_EFFECTS, renderSide, runCalc, 필드 이벤트, swap, autoCalc
 * (build.mjs 가 src/js/*.js 를 알파벳순 concat 후 calc-template.html 에 주입)
 * ════════════════════════════════════════════════════════════ */
/* ════════════════════════════════════════════════════════════
   State
   ════════════════════════════════════════════════════════════ */
function makeSideState(defaultIdx) {
  const p = PokemonById[defaultIdx];
  return {
    pokemonIdx: defaultIdx,
    evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    nature: 'hardy',  // 25성격 중 하나 (기본값: 노력 - 보정 없음)
    ranks: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    status: "none",
    ability: p ? (p.ab['0'] || p.ab['H']).toLowerCase().replace(/[\s'\-()]/g, '') : "",
    item: "",
    tera: false,
    teraType: p ? p.types[0] : 'Normal',
    pinch: false,
    fullHP: true,
    moves: []
  };
}

const state = {
  atk: makeSideState('incineroar'),
  def: makeSideState('amoonguss'),  // 화뭉시
  field: {
    weather: "none", terrain: "none", gameType: "Singles",
    isCritical: false, isTrickRoom: false, isGravity: false,
    defReflect: false, defLightScreen: false,
    atkHelpingHand: false, defProtect: false,
    // 재앙 시리즈 (수동 토글, 진입 효과로도 자동 활성화 가능)
    ruinSword: false,    // 검의재앙 (방어측 방어 0.75×)
    ruinTablet: false,   // 목간의재앙 (방어측 공격 0.75×) ← 공격측 입장에선 자기 공격 0.75×
    ruinBeads: false,    // 구슬의재앙 (방어측 특방 0.75×)
    ruinVessel: false,   // 그릇의재앙 (방어측 특공 0.75×)
    // 진입 위험 (방어측이 교체 진입 시 받는 데미지). HKO 시뮬레이션의 시작 HP 에 반영.
    defStealthRock: false,
    defSpikesLayers: 0,  // 0~3
  }
};

// 기본 세팅
state.atk.evs = { hp: 0, atk: 32, def: 0, spa: 0, spd: 2, spe: 32 };
state.atk.nature = 'adamant';  // 고집 (atk↑/spa↓)
state.atk.moves = ['flareblitz','knockoff','uturn','earthquake'].filter(id => MoveById[id]);
state.def.evs = { hp: 32, atk: 0, def: 32, spa: 0, spd: 2, spe: 0 };
state.def.nature = 'bold';  // 대담 (def↑/atk↓)

// Amoonguss가 없으면 마릴리로 폴백
if (!PokemonById['amoonguss']) {
  state.def = makeSideState('azumarill');
  state.def.evs = { hp: 32, atk: 0, def: 32, spa: 0, spd: 2, spe: 0 };
  state.def.nature = 'bold';
}

/* ════════════════════════════════════════════════════════════
   렌더링
   ════════════════════════════════════════════════════════════ */

// 한국어 이름 헬퍼
function pkName(p) { return p.koName || p.name; }
function mvName(m) { return m.koName || m.name; }
function abName(a) { return a ? (a.koName || a.name) : '없음'; }
function itName(i) { return i ? (i.koName || i.name) : '없음'; }

// 챔피언스 모드 (사용 불가 도구 필터링)
let championsMode = true;

// 자동 진입 효과 ON/OFF
let autoEntryEffects = true;

/* ════════════════════════════════════════════════════════════
   특성별 진입 효과 정의
   - weather: 날씨 자동 세팅
   - terrain: 필드 자동 세팅
   - boost: 자기 능력 +n (검/방패 등)
   - opponentBoost: 상대 능력 변화 (위협 등)
   - download: 상대 D/SD 비교해서 자기 공/특공 +1
   - ruin: 재앙 효과 활성
   ════════════════════════════════════════════════════════════ */
const ENTRY_EFFECTS = {
  // 날씨 메이커
  'drought':       { weather: 'Sun', label: '진입 시 쾌청' },
  'orichalcumpulse': { weather: 'Sun', label: '진입 시 쾌청 + 공격 ×1.33' },
  'drizzle':       { weather: 'Rain', label: '진입 시 비' },
  'sandstream':    { weather: 'Sand', label: '진입 시 모래바람' },
  'sandspit':      { weather: 'Sand', label: '진입 시 모래바람' },
  'snowwarning':   { weather: 'Snow', label: '진입 시 눈' },
  'desolateland':  { weather: 'Harsh Sunshine', label: '진입 시 대쾌청' },
  'primordialsea': { weather: 'Heavy Rain', label: '진입 시 강한비' },

  // 필드 메이커
  'electricsurge': { terrain: 'Electric', label: '진입 시 일렉트릭필드' },
  'hadronengine':  { terrain: 'Electric', label: '진입 시 일렉트릭필드 + 특공 ×1.33' },
  'grassysurge':   { terrain: 'Grassy', label: '진입 시 그래스필드' },
  'psychicsurge':  { terrain: 'Psychic', label: '진입 시 사이코필드' },
  'mistysurge':    { terrain: 'Misty', label: '진입 시 미스트필드' },

  // 자기 능력치 부스트
  'intrepidsword':  { selfBoost: { atk: 1 }, label: '진입 시 자기 공격 +1' },
  'dauntlessshield': { selfBoost: { def: 1 }, label: '진입 시 자기 방어 +1' },
  'embodyaspectteal':       { selfBoost: { spe: 1 }, label: '진입 시 자기 속도 +1' },
  'embodyaspectwellspring': { selfBoost: { spd: 1 }, label: '진입 시 자기 특방 +1' },
  'embodyaspecthearthflame':{ selfBoost: { atk: 1 }, label: '진입 시 자기 공격 +1' },
  'embodyaspectcornerstone':{ selfBoost: { def: 1 }, label: '진입 시 자기 방어 +1' },

  // 상대 능력치 변화 (위협)
  'intimidate': { opponentBoost: { atk: -1 }, label: '진입 시 상대 공격 -1', blockable: true },

  // 다운로드: 자기 공/특공 +1 (상대 D/SD 보고 결정)
  'download': { download: true, label: '상대 D/SD 비교해서 자기 공/특공 +1' },

  // 재앙 (상대 4스탯 중 하나 0.75×)
  'beadsofruin':   { ruin: 'spd', label: '구슬의재앙: 상대 특방 ×0.75' },
  'tabletsofruin': { ruin: 'atk', label: '목간의재앙: 상대 공격 ×0.75' },
  'swordofruin':   { ruin: 'def', label: '검의재앙: 상대 방어 ×0.75' },
  'vesselofruin':  { ruin: 'spa', label: '그릇의재앙: 상대 특공 ×0.75' },
};

// 위협 무시 특성
const INTIMIDATE_BLOCKERS = [
  'innerfocus', 'oblivious', 'owntempo', 'scrappy',
  'clearbody', 'fullmetalbody', 'whitesmoke', 'mypace', 'rattled',  // rattled은 +속도
  'guarddog'  // 경비견 +1 공격 (역효과)
];

// 틀깨기에 무시되는 방어측 특성
const MOLD_BREAKER_IGNORED_ABILITIES = [
  'levitate', 'sturdy', 'multiscale', 'shadowshield',
  'waterabsorb', 'voltabsorb', 'flashfire', 'sapsipper',
  'lightningrod', 'stormdrain', 'motordrive',
  'wellbakedbody', 'eartheater', 'earthenateatr',
  'thickfat', 'heatproof', 'dryskin',
  'filter', 'prismarmor', 'solidrock',
  'furcoat', 'icescales', 'fluffy',
  'marvelscale', 'grasspelt',
  'unaware', 'magicguard',
  'soundproof', 'bulletproof',
  'queenlymajesty', 'dazzling', 'armortail',
  'goodasgold'
];

// 기술 위력 / 결정력 추정
// 결정력 = 공격(특공) 실수치 × 기술 위력 × STAB × 도구 × 특성 보정
//   ※ 타입 상성, 방어측 보정은 제외
//   예: 파이어로 고집 A32 + 구애머리띠 → 브레이브버드 = 146 × 120 × 1.5 × 1.5 = 39420
function estimateMovePower(side, move) {
  if (!move || move.cat === 'Status') return { bp: '—', eff: '—' };
  const types = effectiveTypes(side);
  const ab = side.ability;
  const item = side.item;
  const stats = calcStats(side);
  // 가변 위력 기술 위력은 자기 자신을 상대로 가정한 추정치로 보여준다 (estimate 용도)
  const defStats = calcStats(state.def);
  const variableBp = computeVariableBp(move, side, state.def, state.field, stats, defStats);

  let moveType = move.type;
  let bp = variableBp || move.bp;
  if (!bp) return { bp: '—', eff: '—' };

  // 타입 변환 특성 + BP 보정
  let typeMult = 1.0;
  if (moveType === 'Normal') {
    if (ab === 'aerilate')        { moveType = 'Flying';   typeMult = 1.2; }
    else if (ab === 'refrigerate'){ moveType = 'Ice';      typeMult = 1.2; }
    else if (ab === 'pixilate')   { moveType = 'Fairy';    typeMult = 1.2; }
    else if (ab === 'galvanize')  { moveType = 'Electric'; typeMult = 1.2; }
    else if (ab === 'dragonize')  { moveType = 'Dragon';   typeMult = 1.2; }
  }

  // Tera Blast Stellar: 100 BP 고정
  if (move.id === 'terablast' && side.tera && side.teraType === 'Stellar') bp = 100;

  // 카테고리 결정 (Tera Blast / Photon Geyser는 동적)
  let category = move.cat;
  if ((move.id === 'terablast' && side.tera) || move.id === 'photongeyser') {
    if (stats.atk > stats.spa) category = 'Physical';
    else category = 'Special';
  }
  const isPhysical = category === 'Physical';

  // 공격 실수치 (성격 보정 포함, calcStats가 이미 처리)
  const atkStat = isPhysical ? stats.atk : stats.spa;

  // STAB 계수
  let stabMod = 1.0;
  const isOriginal = types.includes(moveType);
  const isTera = side.tera && side.teraType === moveType;
  const isStellar = side.tera && side.teraType === 'Stellar';
  if (isStellar) {
    stabMod = isOriginal ? (ab === 'adaptability' ? 2.25 : 2.0) : 1.5;
  } else if (isTera && isOriginal) {
    stabMod = ab === 'adaptability' ? 2.25 : 2.0;
  } else if (isTera || isOriginal) {
    stabMod = (isOriginal && ab === 'adaptability') ? 2.0 : 1.5;
  } else if (ab === 'libero' || ab === 'protean') {
    stabMod = 1.5;
  }

  // 다단 히트 / 부자유친
  let hits = 1;
  if (move.mh) {
    if (Array.isArray(move.mh)) {
      if (item === 'loadeddice' && move.mh[1] === 5) hits = 4.5;
      else if (ab === 'skilllink') hits = move.mh[1];
      else if (move.mh[0] === 2 && move.mh[1] === 5) hits = 3.167;
      else hits = (move.mh[0] + move.mh[1]) / 2;
    } else {
      hits = move.mh;
    }
  }
  if (ab === 'parentalbond' && !move.mh && move.cat !== 'Status') {
    hits = 1.25;  // 1타 + 0.25타
  }

  // 특성 위력 보정 (BP 단계)
  let abilityMult = 1.0;
  if (ab === 'technician' && bp <= 60) abilityMult *= 1.5;
  if (ab === 'toughclaws' && move.flags?.contact) abilityMult *= 1.3;
  if (ab === 'ironfist' && move.flags?.punch) abilityMult *= 1.2;
  if (ab === 'strongjaw' && move.flags?.bite) abilityMult *= 1.5;
  if (ab === 'megalauncher' && move.flags?.pulse) abilityMult *= 1.5;
  if (ab === 'sharpness' && move.flags?.slicing) abilityMult *= 1.5;
  if (ab === 'punkrock' && move.flags?.sound) abilityMult *= 1.3;
  if (ab === 'steelworker' && moveType === 'Steel') abilityMult *= 1.5;
  if (ab === 'steelyspirit' && moveType === 'Steel') abilityMult *= 1.5;
  if (ab === 'dragonsmaw' && moveType === 'Dragon') abilityMult *= 1.5;
  if (ab === 'transistor' && moveType === 'Electric') abilityMult *= 1.3;
  if (ab === 'rockypayload' && moveType === 'Rock') abilityMult *= 1.5;
  if (ab === 'sheerforce' && move.sec) abilityMult *= 1.3;
  if (ab === 'reckless' && (move.recoil || move.id === 'jumpkick' || move.id === 'highjumpkick')) abilityMult *= 1.2;

  // 특성 공격 보정 (Atk 단계)
  let atkMult = 1.0;
  if ((ab === 'hugepower' || ab === 'purepower') && isPhysical) atkMult *= 2.0;
  if (ab === 'hustle' && isPhysical) atkMult *= 1.5;
  if (ab === 'gorillatactics' && isPhysical) atkMult *= 1.5;
  if (ab === 'orichalcumpulse' && isPhysical) atkMult *= 4/3;
  if (ab === 'hadronengine' && !isPhysical) atkMult *= 4/3;

  // 도구 보정
  let itemMult = 1.0;
  if (item === 'choiceband' && isPhysical) itemMult *= 1.5;
  if (item === 'choicespecs' && !isPhysical) itemMult *= 1.5;
  if (item === 'lifeorb') itemMult *= 1.3;
  // 타입 강화 도구 (×1.2)
  const typeBoosters = {
    'charcoal':'Fire','mysticwater':'Water','miracleseed':'Grass','magnet':'Electric',
    'nevermeltice':'Ice','blackbelt':'Fighting','poisonbarb':'Poison','softsand':'Ground',
    'sharpbeak':'Flying','twistedspoon':'Psychic','silverpowder':'Bug','hardstone':'Rock',
    'spelltag':'Ghost','dragonfang':'Dragon','blackglasses':'Dark','metalcoat':'Steel',
    'fairyfeather':'Fairy','silkscarf':'Normal'
  };
  if (typeBoosters[item] === moveType) itemMult *= 1.2;
  // Plate
  const plateMap = {
    'flameplate':'Fire','splashplate':'Water','zapplate':'Electric','meadowplate':'Grass',
    'icicleplate':'Ice','fistplate':'Fighting','toxicplate':'Poison','earthplate':'Ground',
    'skyplate':'Flying','mindplate':'Psychic','insectplate':'Bug','stoneplate':'Rock',
    'spookyplate':'Ghost','dracoplate':'Dragon','dreadplate':'Dark','ironplate':'Steel',
    'pixieplate':'Fairy'
  };
  if (plateMap[item] === moveType) itemMult *= 1.2;
  if (item === 'muscleband' && isPhysical) itemMult *= 1.1;
  if (item === 'wiseglasses' && !isPhysical) itemMult *= 1.1;
  if (item === 'punchingglove' && move.flags?.punch) itemMult *= 1.1;
  // 종족 전용
  const p = PokemonById[side.pokemonIdx];
  if (item === 'thickclub' && p && ['cubone','marowak','marowakalola'].includes(p.id) && isPhysical) itemMult *= 2.0;
  if (item === 'lightball' && p && p.base === 'Pikachu') itemMult *= 2.0;
  if (item === 'deepseatooth' && p && p.id === 'clamperl' && !isPhysical) itemMult *= 2.0;

  // 결정력 = 공격 실수치 × 위력 × STAB × 다단 × 특성BP × 특성Atk × 도구 × 타입변환
  const eff = Math.round(atkStat * bp * stabMod * hits * abilityMult * atkMult * itemMult * typeMult);

  return { bp, eff, atkStat };
}

function makeCombobox(sideKey, type, onSelect) {
  const dataset = type === 'pokemon' ? POKEMON : type === 'move' ? MOVES : type === 'ability' ? ABILITIES : ITEMS;
  // 필터링 함수
  return (searchText) => {
    const s = searchText.toLowerCase();
    return dataset.filter(d => {
      const ko = (d.koName || '').toLowerCase();
      const en = (d.name || '').toLowerCase();
      // 챔피언스 빌드는 build 단계에서 이미 Past 아이템을 걸러내므로 런타임 필터 불필요.
      return ko.includes(s) || en.includes(s);
    }).slice(0, 30);
  };
}

function renderSide(sideKey) {
  const side = state[sideKey];
  const container = document.getElementById(`${sideKey}-body`);
  const p = PokemonById[side.pokemonIdx];
  if (!p) { container.innerHTML = '<div class="empty-state">포켓몬 선택 필요</div>'; return; }
  
  const stats = calcStats(side);
  const totalEV = Object.values(side.evs).reduce((a,b) => a+b, 0);
  const overEV = totalEV > 66;
  const types = effectiveTypes(side);
  
  // 특성 옵션 (해당 포켓몬이 가진 특성만)
  const abOptions = Object.values(p.ab).map(abName => {
    const id = abName.toLowerCase().replace(/[\s'\-()]/g, '');
    const data = AbilityById[id];
    return data ? { id, label: `${data.koName || data.name}` } : { id, label: abName };
  });
  // 중복 제거
  const uniqueAbs = [...new Map(abOptions.map(o => [o.id, o])).values()];
  
  // 메가스톤 필터 (해당 포켓몬만)
  const megaStones = ITEMS.filter(i => {
    if (!i.ms) return false;
    const keys = Object.keys(i.ms);
    return keys.includes(p.base) || keys.includes(p.name);
  });
  
  container.innerHTML = `
    <!-- 포켓몬 선택 -->
    <div class="field combobox" data-cb="${sideKey}-poke">
      <div class="field-label">
        <span>포켓몬</span>
        <span class="hint mono">${p.bs.hp}/${p.bs.atk}/${p.bs.def}/${p.bs.spa}/${p.bs.spd}/${p.bs.spe}</span>
      </div>
      <input type="text" class="cb-input" value="${pkName(p)}" data-cb-type="pokemon" data-side="${sideKey}" data-field="pokemonIdx">
      <div class="combobox-options"></div>
      <div class="types-display">
        ${types.map(t => `<span class="type-pill t-${t}">${TYPE_KO[t] || t}</span>`).join('')}
        <button type="button" class="ft-jump-btn" data-ft-from-side="${sideKey}" title="이 포켓몬의 세팅을 세부조정 탭으로 가져가기">🔧 세부조정</button>
        <button type="button" class="ft-jump-btn" data-rc-from-side="${sideKey}" title="이 포켓몬의 세팅을 내구역계산 탭으로 가져가기">🔍 역계산</button>
        <!-- 테라스탈은 챔피언스 모드에서 비활성화됨 -->
      </div>
    </div>

    <div class="section-divider"></div>

    <!-- 특성 · 도구 -->
    <div class="field">
      <div class="field-label"><span>특성 · 도구</span></div>
      <div class="dual-grid">
        <select data-action="ability" data-side="${sideKey}">
          ${uniqueAbs.map(a => `<option value="${a.id}" ${side.ability === a.id ? 'selected' : ''}>${a.label}</option>`).join('')}
        </select>
        <div class="combobox" data-cb="${sideKey}-item">
          <input type="text" class="cb-input" value="${side.item ? (ItemById[side.item] ? itName(ItemById[side.item]) : '') : '없음'}" data-cb-type="item" data-side="${sideKey}" data-field="item" placeholder="도구 선택">
          <div class="combobox-options"></div>
        </div>
      </div>
    </div>

    <!-- 성격 + 상태 (가로 2열) -->
    <div class="field">
      <div class="field-label">
        <span>성격</span>
        <span class="hint" style="flex: 1; text-align: right; padding-right: 4px;">상태 및 조건</span>
      </div>
      <div class="dual-grid">
        <select data-action="nature" data-side="${sideKey}">
          ${NATURES.map(n => {
            const upTxt = n.up ? `↑${STAT_LABEL[n.up]}` : '';
            const downTxt = n.down ? ` ↓${STAT_LABEL[n.down]}` : '';
            const suffix = n.up ? ` (${upTxt}${downTxt})` : ' (보정 없음)';
            return `<option value="${n.id}" ${side.nature === n.id ? 'selected' : ''}>${n.ko}${suffix}</option>`;
          }).join('')}
        </select>
        <select data-action="status" data-side="${sideKey}">
          <option value="none">건강</option>
          <option value="Burn" ${side.status === 'Burn' ? 'selected' : ''}>화상</option>
          <option value="Paralysis" ${side.status === 'Paralysis' ? 'selected' : ''}>마비</option>
          <option value="Poison" ${side.status === 'Poison' ? 'selected' : ''}>독</option>
          <option value="Badly Poison" ${side.status === 'Badly Poison' ? 'selected' : ''}>맹독</option>
          <option value="Sleep" ${side.status === 'Sleep' ? 'selected' : ''}>잠듦</option>
          <option value="Freeze" ${side.status === 'Freeze' ? 'selected' : ''}>얼음</option>
        </select>
      </div>
    </div>

    <div class="section-divider"></div>

    <!-- 스탯 (능력포인트 + 랭크 + 실수치) -->
    <div class="field">
      <div class="field-label">
        <span>능력 포인트 · 랭크</span>
        <span class="hint">최대 32/스탯</span>
      </div>
      <div class="ev-total ${overEV ? 'over' : ''}" style="margin-top: 0; margin-bottom: 8px;">
        <span>투자 합계</span>
        <span><b>${totalEV}</b> / 66</span>
      </div>
      <div class="stat-grid">
        ${STATS.map(s => {
          const r = (side.ranks[s] || 0);
          const isRankable = s !== 'hp';
          const cls = r > 0 ? 'up' : r < 0 ? 'down' : '';
          return `
            <div class="stat-name">${STAT_LABEL[s]}</div>
            <div class="ev-input-group">
              <button class="ev-quick min" data-action="evQuick" data-side="${sideKey}" data-stat="${s}" data-val="0" title="0으로">최소</button>
              <input type="number" class="ev-input" data-action="ev" data-side="${sideKey}" data-stat="${s}" value="${side.evs[s]}" min="0" max="32">
              <button class="ev-quick max" data-action="evQuick" data-side="${sideKey}" data-stat="${s}" data-val="32" title="32로">최대</button>
            </div>
            ${isRankable ? `
              <div class="stat-rank-btns">
                <button data-action="rank" data-side="${sideKey}" data-stat="${s}" data-dir="-1">−</button>
                <span class="stat-rank-val ${cls}">${r > 0 ? '+' + r : r}</span>
                <button data-action="rank" data-side="${sideKey}" data-stat="${s}" data-dir="1">+</button>
              </div>
            ` : '<div></div>'}
            <div class="stat-final">${stats[s]}</div>
          `;
        }).join('')}
      </div>

      <div class="ev-presets">
        <div class="ev-presets-label">
          <span>${sideKey === 'atk' ? '공격형 프리셋' : '방어형 프리셋'}</span>
          <span class="reset-btn" data-action="evReset" data-side="${sideKey}">↺ 초기화</span>
        </div>
        <div class="ev-presets-row">
          ${sideKey === 'atk' ? `
            <button class="ev-preset-btn" data-action="evPreset" data-side="atk" data-preset="AS">AS</button>
            <button class="ev-preset-btn" data-action="evPreset" data-side="atk" data-preset="CS">CS</button>
            <button class="ev-preset-btn" data-action="evPreset" data-side="atk" data-preset="HA">HA</button>
            <button class="ev-preset-btn" data-action="evPreset" data-side="atk" data-preset="HC">HC</button>
          ` : `
            <button class="ev-preset-btn" data-action="evPreset" data-side="def" data-preset="HA">HA</button>
            <button class="ev-preset-btn" data-action="evPreset" data-side="def" data-preset="HB">HB</button>
            <button class="ev-preset-btn" data-action="evPreset" data-side="def" data-preset="HC">HC</button>
            <button class="ev-preset-btn" data-action="evPreset" data-side="def" data-preset="HD">HD</button>
          `}
        </div>
        <div class="ev-presets-label" style="margin-top: 8px;">
          <span>성격 프리셋</span>
        </div>
        <div class="ev-presets-row natures">
          ${sideKey === 'atk' ? `
            <button class="ev-preset-btn nature-btn ${side.nature === 'adamant' ? 'active' : ''}" data-action="naturePreset" data-side="atk" data-nature="adamant" title="공격↑ 특공↓">고집</button>
            <button class="ev-preset-btn nature-btn ${side.nature === 'jolly' ? 'active' : ''}"   data-action="naturePreset" data-side="atk" data-nature="jolly"   title="속도↑ 특공↓">명랑</button>
            <button class="ev-preset-btn nature-btn ${side.nature === 'modest' ? 'active' : ''}"  data-action="naturePreset" data-side="atk" data-nature="modest"  title="특공↑ 공격↓">조심</button>
            <button class="ev-preset-btn nature-btn ${side.nature === 'timid' ? 'active' : ''}"   data-action="naturePreset" data-side="atk" data-nature="timid"   title="속도↑ 공격↓">겁쟁이</button>
            <button class="ev-preset-btn nature-btn ${side.nature === 'hardy' ? 'active' : ''}"   data-action="naturePreset" data-side="atk" data-nature="hardy"   title="보정 없음">무보정</button>
          ` : `
            <button class="ev-preset-btn nature-btn ${side.nature === 'impish' ? 'active' : ''}"  data-action="naturePreset" data-side="def" data-nature="impish"  title="방어↑ 특공↓">장난꾸러기</button>
            <button class="ev-preset-btn nature-btn ${side.nature === 'bold' ? 'active' : ''}"    data-action="naturePreset" data-side="def" data-nature="bold"    title="방어↑ 공격↓">대담</button>
            <button class="ev-preset-btn nature-btn ${side.nature === 'careful' ? 'active' : ''}" data-action="naturePreset" data-side="def" data-nature="careful" title="특방↑ 특공↓">신중</button>
            <button class="ev-preset-btn nature-btn ${side.nature === 'calm' ? 'active' : ''}"    data-action="naturePreset" data-side="def" data-nature="calm"    title="특방↑ 공격↓">차분</button>
            <button class="ev-preset-btn nature-btn ${side.nature === 'hardy' ? 'active' : ''}"   data-action="naturePreset" data-side="def" data-nature="hardy"   title="보정 없음">무보정</button>
          `}
        </div>
      </div>
    </div>

    ${sideKey === 'atk' ? `
    <div class="section-divider"></div>

    <!-- 기술 -->
    <div class="field">
      <div class="field-label">
        <span>기술 배치</span>
        <label class="pinch-toggle">
          <input type="checkbox" data-action="pinch" data-side="atk" ${side.pinch ? 'checked' : ''}>
          핀치 (HP 1/3 이하, 맹화·격류 등)
        </label>
      </div>
      <div class="moves-list">
        ${[0,1,2,3].map(i => {
          const moveId = side.moves[i];
          const move = moveId ? MoveById[moveId] : null;
          const power = move ? estimateMovePower(side, move) : null;
          return `
            <div class="move-slot combobox" data-cb="${sideKey}-move-${i}">
              <span class="move-slot-num">${i+1}</span>
              <input type="text" class="cb-input" value="${move ? mvName(move) : ''}" data-cb-type="move" data-side="atk" data-field="moves.${i}" placeholder="기술 검색...">
              <div class="combobox-options"></div>
              ${move ? `<span class="move-stat-info">${power.bp || '—'}<span class="move-stat-sep">/</span><b>${typeof power.eff === 'number' ? power.eff.toLocaleString() : power.eff}</b></span>` : '<span class="move-stat-info empty">—</span>'}
            </div>
          `;
        }).join('')}
      </div>
    </div>
    ` : ''}

    ${sideKey === 'def' ? `
    <div class="section-divider"></div>

    <!-- 내구력 -->
    <div class="field">
      <div class="field-label"><span>내구력</span><span class="hint">HP × 방어/특방</span></div>
      <div class="durability-grid">
        ${(() => {
          const dStats = calcStats(side);
          const physBulk = Math.round(dStats.hp * dStats.def / 0.411);
          const specBulk = Math.round(dStats.hp * dStats.spd / 0.411);
          return `
            <div class="durability-card phys">
              <div class="durability-label">물리 내구</div>
              <div class="durability-value">${physBulk.toLocaleString()}</div>
              <div class="durability-sub">HP ${dStats.hp} × 방어 ${dStats.def}</div>
            </div>
            <div class="durability-card spec">
              <div class="durability-label">특수 내구</div>
              <div class="durability-value">${specBulk.toLocaleString()}</div>
              <div class="durability-sub">HP ${dStats.hp} × 특방 ${dStats.spd}</div>
            </div>
          `;
        })()}
      </div>
    </div>
    ` : ''}
  `;
  
  wireSide(sideKey);
}

/* ════════════════════════════════════════════════════════════
   이벤트 바인딩
   ════════════════════════════════════════════════════════════ */
function wireSide(sideKey) {
  const container = document.getElementById(`${sideKey}-body`);
  
  // Combobox 입력
  container.querySelectorAll('.cb-input').forEach(input => {
    const cbParent = input.closest('.combobox');
    const optsEl = cbParent.querySelector('.combobox-options');
    const cbType = input.dataset.cbType;
    const side = input.dataset.side;
    const field = input.dataset.field;
    const filterFn = makeCombobox(side, cbType);
    
    function showOptions(query) {
      const matches = filterFn(query);
      optsEl.innerHTML = matches.map(m => {
        const label = cbType === 'pokemon' ? pkName(m) : cbType === 'move' ? mvName(m) : cbType === 'ability' ? abName(m) : itName(m);
        const id = m.id;
        let sub = cbType === 'move' ? `${m.type} ${m.cat} ${m.bp}` :
                    cbType === 'pokemon' ? `BST ${m.bst}` :
                    cbType === 'item' ? (m.desc || '').slice(0, 40) : '';
        return `<div class="combobox-option" data-id="${id}"><b>${label}</b> <small>${sub}</small></div>`;
      }).join('');
      if (cbType === 'item') {
        optsEl.insertAdjacentHTML('afterbegin',
          `<div class="combobox-option" data-id=""><b>없음</b></div>`);
      }
      optsEl.classList.add('open');

      // 화면 우측 가장자리 감지 → right alignment로 전환
      requestAnimationFrame(() => {
        const rect = optsEl.getBoundingClientRect();
        const overflowRight = rect.right > window.innerWidth - 8;
        if (overflowRight) {
          optsEl.style.left = 'auto';
          optsEl.style.right = '0';
        } else {
          optsEl.style.left = '';
          optsEl.style.right = '';
        }
      });
    }
    
    input.addEventListener('focus', () => showOptions(''));
    input.addEventListener('input', () => showOptions(input.value));
    input.addEventListener('blur', () => {
      setTimeout(() => optsEl.classList.remove('open'), 200);
    });
    
    // 콤보박스 옵션 선택 핸들러 (모바일/데스크톱 모두 대응)
    function handleOptionSelect(e) {
      const opt = e.target.closest('.combobox-option');
      if (!opt) return;
      // 기본 동작 막기 (input blur 방지로 깜빡임 줄임)
      e.preventDefault();
      e.stopPropagation();
      const id = opt.dataset.id;

      if (field === 'pokemonIdx') {
        const oldIdx = state[side].pokemonIdx;
        state[side].pokemonIdx = id;
        // 포켓몬 변경 시: 특성/도구/테라타입 기본값 + 기술 초기화 (다른 종)
        const p = PokemonById[id];
        if (p && id !== oldIdx) {
          state[side].ability = (p.ab['0'] || p.ab['H']).toLowerCase().replace(/[\s'\-()]/g, '');
          state[side].teraType = p.types[0];
          state[side].tera = false;
          // 메가 폼 직접 선택 시 메가스톤 자동 매칭
          // (build 단계에서 Past 아이템은 이미 걸러졌으므로 존재만 확인)
          if (p.requiredItem) {
            const stoneId = p.requiredItem.toLowerCase().replace(/[\s'\-()]/g, '');
            if (ItemById[stoneId]) {
              state[side].item = stoneId;
            } else {
              state[side].item = '';
            }
          } else {
            state[side].item = '';
          }
          // 기술 초기화 (공격측만)
          if (side === 'atk') state[side].moves = [];
        }
      } else if (field === 'item') {
        state[side].item = id || '';
      } else if (field.startsWith('moves.')) {
        const idx = parseInt(field.split('.')[1]);
        state.atk.moves[idx] = id || '';
      }
      // 옵션 닫기 + 사이드 재렌더 (위력/결정력/내구력 등 모두 갱신)
      optsEl.classList.remove('open');
      renderSide(side);
      triggerCalc();
    }
    optsEl.addEventListener('mousedown', handleOptionSelect);
    optsEl.addEventListener('touchstart', handleOptionSelect, { passive: false });
  });
  
  // 일반 input/select
  container.querySelectorAll('[data-action]').forEach(el => {
    const action = el.dataset.action;
    const evt = el.tagName === 'BUTTON' ? 'click' : 'change';
    el.addEventListener(evt, () => {
      const side = state[el.dataset.side];
      if (action === 'ability') side.ability = el.value;
      else if (action === 'nature') side.nature = el.value;
      else if (action === 'status') side.status = el.value;
      else if (action === 'pinch') side.pinch = el.checked;
      else if (action === 'teraToggle') { side.tera = !side.tera; renderSide(el.dataset.side); return; }
      else if (action === 'teraType') side.teraType = el.value;
      else if (action === 'ev') {
        const stat = el.dataset.stat;
        const requested = Math.max(0, Math.min(32, parseInt(el.value) || 0));
        // 다른 스탯 합계
        const otherTotal = STATS.reduce((sum, s) => sum + (s === stat ? 0 : (side.evs[s] || 0)), 0);
        const remaining = Math.max(0, 66 - otherTotal);
        // 요청값과 잔여 한도 중 작은 값으로 클램프
        const finalVal = Math.min(requested, remaining);
        side.evs[stat] = finalVal;
        // 사용자가 입력한 값과 실제 적용된 값이 다르면 input.value도 업데이트
        if (finalVal !== requested) {
          el.value = finalVal;
        }
      }
      else if (action === 'evQuick') {
        const stat = el.dataset.stat;
        const requested = parseInt(el.dataset.val);
        const otherTotal = STATS.reduce((sum, s) => sum + (s === stat ? 0 : (side.evs[s] || 0)), 0);
        const remaining = Math.max(0, 66 - otherTotal);
        side.evs[stat] = Math.min(requested, remaining);
        renderSide(el.dataset.side);
        triggerCalc();
        return;
      }
      else if (action === 'rank') {
        const dir = parseInt(el.dataset.dir);
        const curr = side.ranks[el.dataset.stat] || 0;
        side.ranks[el.dataset.stat] = Math.max(-6, Math.min(6, curr + dir));
        // 재렌더링해서 표시 업데이트
        renderSide(el.dataset.side);
        triggerCalc();
        return;
      }
      else if (action === 'evPreset') {
        applyEvPreset(el.dataset.side, el.dataset.preset);
        renderSide(el.dataset.side);
        triggerCalc();
        return;
      }
      else if (action === 'naturePreset') {
        side.nature = el.dataset.nature;
        renderSide(el.dataset.side);
        triggerCalc();
        return;
      }
      else if (action === 'evReset') {
        side.evs = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
        renderSide(el.dataset.side);
        triggerCalc();
        return;
      }
      // 실수치 표시 갱신
      if (action === 'ev' || action === 'nature') {
        renderSide(el.dataset.side);
      }
      triggerCalc();
    });
  });
}

/* ════════════════════════════════════════════════════════════
   EV 프리셋 적용 (EV만 변경, 성격은 건드리지 않음)
   ════════════════════════════════════════════════════════════ */
function applyEvPreset(sideKey, preset) {
  const side = state[sideKey];
  const p = PokemonById[side.pokemonIdx];
  if (!p) return;

  // 모든 EV 0으로 리셋
  side.evs = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };

  // 프리셋별 두 스탯에 32 투자 (성격은 사용자가 별도로 선택)
  const presetMap = {
    AS: ['atk', 'spe'],
    CS: ['spa', 'spe'],
    HA: ['hp', 'atk'],
    HC: ['hp', 'spa'],
    HB: ['hp', 'def'],
    HD: ['hp', 'spd'],
  };
  const stats = presetMap[preset];
  if (!stats) return;
  stats.forEach(s => { side.evs[s] = 32; });
}

/* ════════════════════════════════════════════════════════════
   자동 진입 효과 적용
   - autoEntryEffects가 true일 때만 실행
   - 사용자가 수동으로 변경한 값은 자동으로 다시 덮어쓰지 않음 (lastAutoApplied 추적)
   ════════════════════════════════════════════════════════════ */

// 마지막으로 자동 적용된 진입 효과 추적 (해제용)
const lastAutoEntry = {
  atk: { weather: null, terrain: null, ranks: {}, ruin: null },
  def: { weather: null, terrain: null, ranks: {}, ruin: null }
};

function applyEntryEffects() {
  if (!autoEntryEffects) return [];
  const log = [];

  for (const sideKey of ['atk', 'def']) {
    const side = state[sideKey];
    const otherKey = sideKey === 'atk' ? 'def' : 'atk';
    const other = state[otherKey];
    const ab = side.ability;
    const effect = ENTRY_EFFECTS[ab];

    // 이전 자동 적용 해제 — 우리가 바꾼 값과 현재 값이 같을 때만 이전 값으로 복원.
    // (사용자가 그 사이 수동으로 다시 바꿨다면 그대로 둠)
    const last = lastAutoEntry[sideKey];
    if (last.weather && state.field.weather === last.weather.applied) {
      state.field.weather = last.weather.prev;
    }
    if (last.terrain && state.field.terrain === last.terrain.applied) {
      state.field.terrain = last.terrain.prev;
    }
    for (const r of Object.keys(last.ranks)) {
      side.ranks[r] = (side.ranks[r] || 0) - last.ranks[r];
    }
    for (const r of Object.keys(last.ranks).filter(k => k.startsWith('opp_'))) {
      const stat = r.replace('opp_', '');
      other.ranks[stat] = (other.ranks[stat] || 0) - last.ranks[r];
    }
    if (last.ruin) {
      // 우리가 켰던 재앙만 끈다 (사용자가 수동으로 켰던 경우는 last.ruin = null 이라 통과)
      state.field['ruin' + last.ruin.charAt(0).toUpperCase() + last.ruin.slice(1)] = false;
    }
    // reset
    lastAutoEntry[sideKey] = { weather: null, terrain: null, ranks: {}, ruin: null };

    if (!effect) continue;

    // 날씨 — 이미 같은 날씨면 변경/추적 안 함 (사용자 수동 설정 보존)
    if (effect.weather && state.field.weather !== effect.weather) {
      lastAutoEntry[sideKey].weather = { prev: state.field.weather, applied: effect.weather };
      state.field.weather = effect.weather;
      log.push(`${sideKey === 'atk' ? '공격측' : '방어측'} 진입: ${effect.label}`);
    }
    // 필드 — 동일 처리
    if (effect.terrain && state.field.terrain !== effect.terrain) {
      lastAutoEntry[sideKey].terrain = { prev: state.field.terrain, applied: effect.terrain };
      state.field.terrain = effect.terrain;
      if (!effect.weather) log.push(`${sideKey === 'atk' ? '공격측' : '방어측'} 진입: ${effect.label}`);
    }
    // 자기 능력치 +
    if (effect.selfBoost) {
      for (const [stat, n] of Object.entries(effect.selfBoost)) {
        side.ranks[stat] = Math.max(-6, Math.min(6, (side.ranks[stat] || 0) + n));
        lastAutoEntry[sideKey].ranks[stat] = n;
      }
      log.push(`${sideKey === 'atk' ? '공격측' : '방어측'} 진입: ${effect.label}`);
    }
    // 상대 능력치 변화 (위협)
    if (effect.opponentBoost) {
      // 위협 무시 특성 체크
      const otherAb = other.ability;
      if (effect.blockable && INTIMIDATE_BLOCKERS.includes(otherAb)) {
        log.push(`${sideKey === 'atk' ? '공격측' : '방어측'} 위협 → 무효 (${AbilityById[otherAb]?.koName || otherAb})`);
      } else {
        for (const [stat, n] of Object.entries(effect.opponentBoost)) {
          other.ranks[stat] = Math.max(-6, Math.min(6, (other.ranks[stat] || 0) + n));
          lastAutoEntry[sideKey].ranks['opp_' + stat] = n;
        }
        log.push(`${sideKey === 'atk' ? '공격측' : '방어측'} 진입: ${effect.label}`);
      }
    }
    // 다운로드: 상대 방어 < 특방이면 공격 +1, 아니면 특공 +1
    if (effect.download) {
      const otherStats = calcStats(other);
      const stat = otherStats.def < otherStats.spd ? 'atk' : 'spa';
      side.ranks[stat] = Math.max(-6, Math.min(6, (side.ranks[stat] || 0) + 1));
      lastAutoEntry[sideKey].ranks[stat] = 1;
      log.push(`${sideKey === 'atk' ? '공격측' : '방어측'} 다운로드: 자기 ${STAT_LABEL[stat]} +1`);
    }
    // 재앙 — 매핑: spd → ruinBeads, atk → ruinTablet, def → ruinSword, spa → ruinVessel
    if (effect.ruin) {
      const RUIN_MAP = { spd: 'ruinBeads', atk: 'ruinTablet', def: 'ruinSword', spa: 'ruinVessel' };
      const fieldKey = RUIN_MAP[effect.ruin];
      // 이미 켜져 있으면 (사용자 수동 또는 다른 자동 효과) 우리가 끄지 않도록 추적 안 함
      if (fieldKey && !state.field[fieldKey]) {
        state.field[fieldKey] = true;
        lastAutoEntry[sideKey].ruin = fieldKey.replace('ruin', '');
        log.push(`${sideKey === 'atk' ? '공격측' : '방어측'} 진입: ${effect.label}`);
      }
    }
  }

  return log;
}


/* ════════════════════════════════════════════════════════════
   결과 렌더링
   ════════════════════════════════════════════════════════════ */
function runCalc() {
  // 진입 효과 자동 적용 (활성화 시)
  const entryLog = applyEntryEffects();
  // 진입 효과로 필드/랭크가 바뀌면 사이드 패널 다시 그리기
  if (entryLog.length > 0) {
    renderSide('atk');
    renderSide('def');
    // 필드 select 갱신
    document.getElementById('weather').value = state.field.weather;
    document.getElementById('terrain').value = state.field.terrain;
    updateFieldSummary();
    updateRuinCheckboxes();
  }

  const atkP = PokemonById[state.atk.pokemonIdx];
  const defP = PokemonById[state.def.pokemonIdx];
  if (!atkP || !defP) return;
  
  const atkSpe = effectiveSpeed(state.atk, state.field);
  const defSpe = effectiveSpeed(state.def, state.field);

  // 가변 위력 기술이 참조하는 행동 순서 플래그를 필드에 복사 (priority 0 기준)
  // 우선도가 다른 기술은 기술별로 calculateDamage 가 firstMover 결과로 보정해야 정확하지만
  // 대부분의 가변 위력 기술 (boltbeak, fishiousrend, payback) 은 priority 0 이므로 단순화.
  state.field.atkMovesFirst = atkSpe > defSpe;
  state.field.atkMovesSecond = atkSpe < defSpe;

  // 각 기술 계산
  const moveResults = state.atk.moves.map((mvId, i) => {
    if (!mvId) return { empty: true, slot: i+1 };
    const move = MoveById[mvId];
    if (!move) return { empty: true, slot: i+1 };
    if (move.cat === 'Status') {
      return { empty: true, slot: i+1, move, statusMove: true };
    }
    const result = calculateDamage(state.atk, state.def, move, state.field);
    if (!result) return { empty: true, slot: i+1, move };
    const hko = hkoLabel(result.damages, result.defHP, state.def, state.field);
    const first = firstMover(move.pri, atkSpe, defSpe, state.field);
    return { ...result, hko, first, slot: i+1, move };
  });
  
  // 틀깨기 / 다능 등 공격측 특성으로 무시되는 방어측 특성 체크
  const atkAb = state.atk.ability;
  const defAb = state.def.ability;
  const moldBreakerActive = ['moldbreaker', 'teravolt', 'turboblaze'].includes(atkAb);
  const ignoredAb = moldBreakerActive && MOLD_BREAKER_IGNORED_ABILITIES.includes(defAb)
    ? AbilityById[defAb] : null;

  // 재앙 효과 정보
  const ruinActive = [];
  if (state.field.ruinSword)  ruinActive.push('검의재앙(방어 ×0.75)');
  if (state.field.ruinTablet) ruinActive.push('목간의재앙(공격 ×0.75)');
  if (state.field.ruinBeads)  ruinActive.push('구슬의재앙(특방 ×0.75)');
  if (state.field.ruinVessel) ruinActive.push('그릇의재앙(특공 ×0.75)');

  const body = document.getElementById('results-body');
  body.innerHTML = `
    ${entryLog.length > 0 ? `
    <div class="entry-effects">
      <div class="entry-effects-label">📋 진입 효과 자동 적용</div>
      ${entryLog.map(e => `<div class="entry-effect-item">${e}</div>`).join('')}
    </div>
    ` : ''}

    ${moldBreakerActive ? `
    <div class="mold-breaker-info">
      <span class="mold-breaker-tag">${AbilityById[atkAb]?.koName || atkAb}</span>
      ${ignoredAb ? `상대 <b>${ignoredAb.koName}</b> 특성을 무시합니다` : '방어측 일부 특성을 관통할 수 있습니다'}
    </div>
    ` : ''}

    ${ruinActive.length > 0 ? `
    <div class="ruin-info">
      <span class="ruin-tag">⚔️ 재앙 활성</span>
      ${ruinActive.join(' · ')}
    </div>
    ` : ''}

    <!-- 속도 대결 -->
    <div class="speed-row">
      <div class="speed-side atk">
        <div>
          <div class="mono" style="font-size:10px;color:var(--text-faint);letter-spacing:0.15em;">공격측 속도</div>
          <div class="speed-name">${pkName(atkP)}</div>
        </div>
        <div class="speed-value">${atkSpe}</div>
      </div>
      <div class="speed-vs">VS</div>
      <div class="speed-side def">
        <div class="speed-value">${defSpe}</div>
        <div style="text-align:right;">
          <div class="mono" style="font-size:10px;color:var(--text-faint);letter-spacing:0.15em;">방어측 속도</div>
          <div class="speed-name">${pkName(defP)}</div>
        </div>
      </div>
      <div class="speed-verdict">
        ${atkSpe > defSpe ? `공격측이 <b>${atkSpe - defSpe}</b> 더 빠름 ${state.field.isTrickRoom ? '→ 트릭룸: 방어측 선공' : '→ 동우선도시 공격측 선공'}` :
          atkSpe < defSpe ? `방어측이 <b>${defSpe - atkSpe}</b> 더 빠름 ${state.field.isTrickRoom ? '→ 트릭룸: 공격측 선공' : '→ 동우선도시 방어측 선공'}` :
          `속도 동일 (스피드 타이 50%)`}
      </div>
    </div>
    
    <!-- 기술별 결과 -->
    <div class="move-results">
      ${moveResults.map(r => renderMoveCard(r)).join('')}
    </div>
  `;
}

function renderMoveCard(r) {
  if (r.empty) {
    if (r.statusMove) {
      return `
        <div class="move-card none">
          <div class="move-card-main">
            <div class="move-card-head move-card-head-simple">
              <span class="move-slot-num mono">${r.slot}</span>
              <span class="move-name" style="color:var(--text-faint);">${mvName(r.move)} (변화기)</span>
              <span class="move-meta"><span class="cat-stat">STAT</span> · ${r.move.desc || ''}</span>
            </div>
          </div>
        </div>
      `;
    }
    return `
      <div class="move-card none">
        <div class="move-card-main">
          <div class="move-card-head move-card-head-simple">
            <span class="move-slot-num mono">${r.slot}</span>
            <span class="move-name" style="color:var(--text-faint);">기술 미설정</span>
          </div>
        </div>
      </div>
    `;
  }
  
  const pctMin = r.minPct.toFixed(1);
  const pctMax = r.maxPct.toFixed(1);
  const barMax = Math.min(100, r.maxPct);
  const barMin = Math.min(100, r.minPct);
  
  const eff = r.effectiveness;
  const effCls = eff === 0 ? 'eff-0' : eff === 0.25 ? 'eff-0-25' : eff === 0.5 ? 'eff-0-5' :
                 eff === 2 ? 'eff-2' : eff === 4 ? 'eff-4' : 'eff-1';
  const effText = eff === 0 ? '효과없음' : eff === 0.25 ? '¼배' : eff === 0.5 ? '½배' :
                  eff === 2 ? '2배' : eff === 4 ? '4배' : '1배';
  
  const cat = r.category === 'Physical' ? '물리' : '특수';
  const catCls = r.category === 'Physical' ? 'cat-phys' : 'cat-spec';
  
  const firstLabel = r.first === 'atk' ? '공격측 선공' : r.first === 'def' ? '방어측 선공' : '동속';
  const firstCls = r.first === 'atk' ? '' : r.first === 'def' ? 'def-first' : 'tie';
  
  const min = r.damages[0];
  const max = r.damages[15];
  const hpRemMin = Math.max(0, r.defHP - max);
  const hpRemMax = Math.max(0, r.defHP - min);
  
  const moveData = r.move;
  const typeChange = r.moveType !== moveData.type;
  // 타입 셀은 단일 컬럼: 변환 시 작은 원본 표시는 type-pill 안에 흡수
  const typeLabel = `<span class="type-pill t-${r.moveType}" ${typeChange ? `title="원래: ${TYPE_KO[moveData.type]}"` : ''}>${TYPE_KO[r.moveType] || r.moveType}${typeChange ? '*' : ''}</span>`;
  
  // 반동/회복 계산
  let sideEffect = '';
  if (moveData.recoil) {
    const [num, den] = moveData.recoil;
    const atkHP = calcStats(state.atk).hp;
    const recoilMin = Math.floor(min * num / den);
    const recoilMax = Math.floor(max * num / den);
    const recoilMinPct = (recoilMin / atkHP * 100).toFixed(1);
    const recoilMaxPct = (recoilMax / atkHP * 100).toFixed(1);
    sideEffect += `<div class="side-effect">반동: 공격측 HP <b>${recoilMin}~${recoilMax}</b> (${recoilMinPct}~${recoilMaxPct}%) 감소</div>`;
  }
  if (moveData.drain) {
    const [num, den] = moveData.drain;
    const atkHP = calcStats(state.atk).hp;
    const healMin = Math.floor(min * num / den);
    const healMax = Math.floor(max * num / den);
    const healMinPct = (healMin / atkHP * 100).toFixed(1);
    const healMaxPct = (healMax / atkHP * 100).toFixed(1);
    sideEffect += `<div class="side-effect">흡수: 공격측 HP <b>${healMin}~${healMax}</b> (${healMinPct}~${healMaxPct}%) 회복</div>`;
  }

  // 다단 히트 표시
  let multihitLabel = '';
  if (moveData.mh) {
    if (Array.isArray(moveData.mh)) {
      multihitLabel = `<span style="color:var(--warn)">· ${moveData.mh[0]}~${moveData.mh[1]}타</span>`;
    } else {
      multihitLabel = `<span style="color:var(--warn)">· ${moveData.mh}타 고정</span>`;
    }
  }
  // 부자유친 표시
  if (r.mods?.some(m => m.includes('부자유친'))) {
    multihitLabel = `<span style="color:var(--warn)">· 1타 + 0.25타</span>`;
  }
  
  return `
    <div class="move-card">
      <div class="move-card-main">
        <div class="move-card-head">
          <span class="move-slot-num mono">${r.slot}</span>
          ${typeLabel}
          <span class="cat-badge ${catCls}">${cat}</span>
          <span class="move-name">${mvName(moveData)}</span>
          <span class="stab-mark${r.stab ? '' : ' empty'}">${r.stab ? '자속' : ''}</span>
          <span class="eff-badge ${effCls}">${effText}</span>
          <span class="move-meta">
            ${moveData.pri !== 0 ? `<span>· 우선도 ${moveData.pri > 0 ? '+' : ''}${moveData.pri}</span>` : ''}
            ${multihitLabel}
          </span>
          <span class="first-indicator ${firstCls}">${firstLabel}</span>
        </div>
        <div class="dmg-bar">
          <div class="dmg-bar-fill" style="width: ${barMax}%"></div>
          <div class="dmg-bar-fill min" style="width: ${barMin}%"></div>
          <div class="dmg-bar-text">
            <span>${pctMin} ~ ${pctMax}%</span>
            <span class="hp-remain">잔여 ${hpRemMin}-${hpRemMax} / ${r.defHP}</span>
          </div>
        </div>
        <div class="dmg-info">
          <span>실제 대미지 <b>${min}–${max}</b></span>
        </div>
        ${r.mods.length ? `<div class="mods-trace">${r.mods.map(m => `<b>${m}</b>`).join('<span class="sep">·</span>')}</div>` : ''}
        ${sideEffect}
      </div>
      <div class="hko-badge">
        <div class="hko-main ${r.hko.cls}">
          <span class="hko-label">${r.hko.label}</span>
          <span class="hko-turns">${r.hko.turns}</span>
          <span class="hko-pct">${r.hko.pct || ''}</span>
        </div>
        ${r.hko.sub ? `<div class="hko-sub">${r.hko.sub}</div>` : ''}
      </div>
    </div>
  `;
}

/* ════════════════════════════════════════════════════════════
   필드 이벤트
   ════════════════════════════════════════════════════════════ */
/* ════════════════════════════════════════════════════════════
   자동/수동 계산 모드
   ════════════════════════════════════════════════════════════ */
let autoCalcMode = true;

function triggerCalc() {
  if (autoCalcMode) runCalc();
  updateFieldSummary();
}

function updateFieldSummary() {
  const f = state.field;
  const parts = [];
  if (f.weather && f.weather !== 'none') {
    const wMap = { Sun: '쾌청', Rain: '비', Sand: '모래바람', Snow: '눈', 'Harsh Sunshine': '대쾌청', 'Heavy Rain': '강한비' };
    parts.push(`<b>${wMap[f.weather] || f.weather}</b>`);
  }
  if (f.terrain && f.terrain !== 'none') {
    const tMap = { Electric: '일렉트릭', Grassy: '그래스', Psychic: '사이코', Misty: '미스트' };
    parts.push(`<b>${tMap[f.terrain] || f.terrain}필드</b>`);
  }
  if (f.gameType === 'Doubles') parts.push('더블');
  if (f.isCritical) parts.push('급소');
  if (f.defReflect) parts.push('리플렉터');
  if (f.defLightScreen) parts.push('빛의장막');
  if (f.atkHelpingHand) parts.push('도우미');
  if (f.defProtect) parts.push('방어');
  const ruins = [];
  if (f.ruinSword) ruins.push('검');
  if (f.ruinTablet) ruins.push('목간');
  if (f.ruinBeads) ruins.push('구슬');
  if (f.ruinVessel) ruins.push('그릇');
  if (ruins.length) parts.push(`<span style="color:var(--tera)">⚔️${ruins.join('/')}</span>`);
  document.getElementById('field-summary').innerHTML =
    parts.length ? parts.join(' · ') : '기본값';
}

// 접이식 패널
document.getElementById('field-head').addEventListener('click', () => {
  document.getElementById('field-panel').classList.toggle('collapsed');
});

// 계산 버튼
document.getElementById('btnCalculate').addEventListener('click', () => {
  runCalc();
});

// 자동/수동 토글
document.getElementById('btnAutoCalc').addEventListener('click', e => {
  autoCalcMode = !autoCalcMode;
  e.target.textContent = `자동 계산: ${autoCalcMode ? 'ON' : 'OFF'}`;
  e.target.classList.toggle('active', autoCalcMode);
  if (autoCalcMode) runCalc();
});
// 초기 활성 표시
document.getElementById('btnAutoCalc').classList.add('active');

/* ════════════════════════════════════════════════════════════
   필드 이벤트
   ════════════════════════════════════════════════════════════ */
document.getElementById('weather').addEventListener('change', e => { state.field.weather = e.target.value; triggerCalc(); });
document.getElementById('terrain').addEventListener('change', e => { state.field.terrain = e.target.value; triggerCalc(); });
document.getElementById('gameType').addEventListener('change', e => { state.field.gameType = e.target.value; triggerCalc(); });
document.getElementById('critHit').addEventListener('change', e => { state.field.isCritical = e.target.checked; triggerCalc(); });
document.getElementById('defReflect').addEventListener('change', e => { state.field.defReflect = e.target.checked; triggerCalc(); });
document.getElementById('defLightScreen').addEventListener('change', e => { state.field.defLightScreen = e.target.checked; triggerCalc(); });
document.getElementById('atkHelpingHand').addEventListener('change', e => { state.field.atkHelpingHand = e.target.checked; triggerCalc(); });
document.getElementById('defProtect').addEventListener('change', e => { state.field.defProtect = e.target.checked; triggerCalc(); });
// 재앙 토글
document.getElementById('ruinSword').addEventListener('change', e => { state.field.ruinSword = e.target.checked; triggerCalc(); });
document.getElementById('ruinTablet').addEventListener('change', e => { state.field.ruinTablet = e.target.checked; triggerCalc(); });
document.getElementById('ruinBeads').addEventListener('change', e => { state.field.ruinBeads = e.target.checked; triggerCalc(); });
document.getElementById('ruinVessel').addEventListener('change', e => { state.field.ruinVessel = e.target.checked; triggerCalc(); });
// 진입 위험 (스텔스록 / 압정뿌리기)
document.getElementById('defStealthRock').addEventListener('change', e => { state.field.defStealthRock = e.target.checked; triggerCalc(); });
document.getElementById('defSpikes').addEventListener('change', e => {
  state.field.defSpikesLayers = e.target.checked ? parseInt(document.getElementById('defSpikesLayers').value, 10) || 1 : 0;
  triggerCalc();
});
document.getElementById('defSpikesLayers').addEventListener('change', e => {
  if (document.getElementById('defSpikes').checked) {
    state.field.defSpikesLayers = parseInt(e.target.value, 10) || 1;
    triggerCalc();
  }
});
// 트릭룸 / 중력장
document.getElementById('trickRoom').addEventListener('change', e => { state.field.isTrickRoom = e.target.checked; triggerCalc(); });
document.getElementById('gravity').addEventListener('change', e => { state.field.isGravity = e.target.checked; triggerCalc(); });
// 자동 진입 효과 토글
document.getElementById('autoEntry').addEventListener('change', e => {
  autoEntryEffects = e.target.checked;
  // 토글 OFF 시 마지막 자동 적용 효과 해제 (applyEntryEffects 와 같은 의미론)
  if (!autoEntryEffects) {
    for (const sk of ['atk', 'def']) {
      const last = lastAutoEntry[sk];
      const other = state[sk === 'atk' ? 'def' : 'atk'];
      if (last.weather && state.field.weather === last.weather.applied) state.field.weather = last.weather.prev;
      if (last.terrain && state.field.terrain === last.terrain.applied) state.field.terrain = last.terrain.prev;
      for (const r of Object.keys(last.ranks)) {
        if (r.startsWith('opp_')) {
          other.ranks[r.replace('opp_','')] = (other.ranks[r.replace('opp_','')] || 0) - last.ranks[r];
        } else {
          state[sk].ranks[r] = (state[sk].ranks[r] || 0) - last.ranks[r];
        }
      }
      if (last.ruin) {
        const fieldKey = 'ruin' + last.ruin.charAt(0).toUpperCase() + last.ruin.slice(1);
        state.field[fieldKey] = false;
      }
      lastAutoEntry[sk] = { weather: null, terrain: null, ranks: {}, ruin: null };
    }
    document.getElementById('weather').value = state.field.weather;
    document.getElementById('terrain').value = state.field.terrain;
    updateRuinCheckboxes();
    renderSide('atk'); renderSide('def');
  }
  triggerCalc();
});

// 재앙 체크박스 동기화 (자동 진입 효과로 변경됐을 때)
function updateRuinCheckboxes() {
  document.getElementById('ruinSword').checked = state.field.ruinSword;
  document.getElementById('ruinTablet').checked = state.field.ruinTablet;
  document.getElementById('ruinBeads').checked = state.field.ruinBeads;
  document.getElementById('ruinVessel').checked = state.field.ruinVessel;
}
document.getElementById('championsMode').addEventListener('change', e => {
  championsMode = e.target.checked;
  renderSide('atk');
  renderSide('def');
  triggerCalc();
});

// 공격측 ↔ 방어측 교대 (사이드 객체 전체를 통째로 교환)
// 사이드 패널 점프 버튼 위임 — 04-views.js 의 loadSideToFineTune / loadSideToRevCalc 호출
document.addEventListener('click', e => {
  const ftBtn = e.target.closest('.ft-jump-btn[data-ft-from-side]');
  if (ftBtn && typeof loadSideToFineTune === 'function') {
    loadSideToFineTune(ftBtn.dataset.ftFromSide);
    return;
  }
  const rcBtn = e.target.closest('.ft-jump-btn[data-rc-from-side]');
  if (rcBtn && typeof loadSideToRevCalc === 'function') {
    loadSideToRevCalc(rcBtn.dataset.rcFromSide);
    return;
  }
});

document.getElementById('btnSwapSides')?.addEventListener('click', () => {
  const tmp = state.atk;
  state.atk = state.def;
  state.def = tmp;
  // 진입 효과로 적용된 last-applied 정보도 함께 교대 (잘못된 자동 해제 방지)
  if (typeof lastAutoEntry === 'object' && lastAutoEntry) {
    const tmp2 = lastAutoEntry.atk;
    lastAutoEntry.atk = lastAutoEntry.def;
    lastAutoEntry.def = tmp2;
  }
  renderSide('atk');
  renderSide('def');
  triggerCalc();
});
/* ════════════════════════════════════════════════════════════
   ⬆️ 원본 로직 끝 ⬆️
   ════════════════════════════════════════════════════════════ */

