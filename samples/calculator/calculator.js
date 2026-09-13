/* Standalone UI sample. All battle arithmetic stays in the production engine. */
const sampleStats = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
const sampleStatNames = { hp:'HP', atk:'공격', def:'방어', spa:'특공', spd:'특방', spe:'속도' };
const sampleCategoryNames = { Physical:'물리', Special:'특수', Status:'변화' };
const sampleEscape = value => escapeHTML(String(value ?? ''));
const sampleEl = id => document.getElementById(id);
let samplePicker = null;
let sampleMoveSlot = 0;
let sampleStatusTimer;

function sampleType(type) {
  const key = type.toLowerCase();
  return `<span class="ui-tag type-chip type-${key}">${sampleEscape(TYPE_KO[type] || type)}</span>`;
}

function sampleSetPokemon(sideKey, id, initial = false) {
  if (!PokemonById[id]) return;
  const side = makeSideState(id);
  side.item = defaultPokemonItemId(PokemonById[id]);
  const preferred = id === 'garchomp' ? ['earthquake','dragonclaw','rockslide','firefang']
    : id === 'dragonite' ? ['extremespeed','earthquake','icepunch','outrage'] : [];
  const available = PokemonById[id].ls || [];
  side.moves = initial ? preferred.filter(move => available.includes(move) && MoveById[move]) : [];
  state[sideKey] = side;
  applyEntryFieldsFromSide(sideKey);
}

function sampleSideMarkup(key) {
  const side = state[key];
  const p = PokemonById[side.pokemonIdx];
  const role = key === 'atk' ? '공격' : '방어';
  const picker = (kind,label,value,content,variant) => SampleUI.trigger(content, {'data-pick':kind,'data-side':key,title:value,'aria-haspopup':'dialog','aria-controls':'picker','aria-label':`${role} ${label}: ${value}`}, variant);
  const attribute = (kind, label, value) => picker(kind,label,value,`<small class="ui-select-label">${label}</small><strong class="ui-select-value">${sampleEscape(value)}</strong>`,'attribute ui-select-trigger--compact');
  return `<div class="side-top"><span class="side-label">${role.toUpperCase()} <span aria-hidden="true">/ ${key === 'atk' ? 'ATTACK' : 'DEFENSE'}</span></span><span class="budget">노력치 <strong data-budget="${key}"></strong> / 66</span></div>
    ${picker('pokemon','포켓몬',pkName(p),`${pokemonSpriteSlot(p)}<span class="pokemon-heading"><span class="pokemon-name">${sampleEscape(pkName(p))}</span><span class="type-list">${side.types.map(sampleType).join('')}</span></span>`,'pokemon-select')}
    <div class="attributes">${attribute('ability','특성',abName(AbilityById[side.ability]))}${attribute('item','도구',itName(ItemById[side.item]))}${attribute('nature','성격',NATURE_BY_ID[side.nature]?.ko || '노력')}</div>
    <table class="stat-table" aria-label="${role} 능력치"><colgroup><col>${sampleStats.map(() => '<col>').join('')}</colgroup>
      <thead><tr><th scope="col"><span class="sr-only">구분</span></th>${sampleStats.map(s => `<th scope="col">${sampleStatNames[s]}</th>`).join('')}</tr></thead>
      <tbody><tr><th scope="row">노력치</th>${sampleStats.map(s => `<td>${SampleUI.number({min:0,max:32,'data-side':key,'data-ev':s,value:side.evs[s],'aria-label':`${role} ${sampleStatNames[s]} 노력치`})}</td>`).join('')}</tr>
      <tr><th scope="row">랭크</th>${sampleStats.map(s => s === 'hp' ? '<td aria-label="HP 랭크 없음">—</td>' : `<td>${SampleUI.select(Array.from({length:13},(_,i) => [i-6,i>6 ? `+${i-6}` : i-6]),side.ranks[s],{'data-side':key,'data-rank':s,'aria-label':`${role} ${sampleStatNames[s]} 랭크`},'ui-select--rank')}</td>`).join('')}</tr>
      <tr><th scope="row">실수치</th>${sampleStats.map(s => `<td data-stat-value="${s}"></td>`).join('')}</tr></tbody>
    </table>
    <div class="hp-row"><label for="hp-${key}">HP</label>${SampleUI.number({id:`hp-${key}`,min:0.1,max:100,step:0.1,inputmode:'decimal',value:hpPercentInputValue(side),'data-hp':key,'aria-label':`${role} 현재 HP 퍼센트`})}<span>%</span><span class="ui-meter hp-track" aria-hidden="true"><span class="ui-meter-fill" data-hp-bar="${key}"></span></span><span class="hp-value" data-hp-value="${key}"></span>
      ${SampleUI.select(CALC_STATUS_OPTIONS.map(o => [o.id,o.id === 'none' ? '정상' : o.label]),side.status,{'data-side':key,'data-status':true,'aria-label':`${role} 상태이상`},'ui-select--compact status-select')}
    </div>`;
}

function sampleRenderSides() {
  for (const key of ['atk','def']) sampleEl(`side-${key}`).innerHTML = sampleSideMarkup(key);
}

function sampleUpdateStats(calc) {
  for (const key of ['atk','def']) {
    const side = state[key];
    const stats = calcStats(calc[key]);
    const nature = NATURE_BY_ID[side.nature];
    sampleEl(`side-${key}`).querySelector('[data-budget]').textContent = Object.values(side.evs).reduce((a,b) => a+b,0);
    sampleStats.forEach(stat => {
      const cell = sampleEl(`side-${key}`).querySelector(`[data-stat-value="${stat}"]`);
      cell.textContent = stat === 'hp' ? stats.hp : applyBoost(stats[stat],calc[key].ranks[stat]);
      cell.className = nature?.up === stat ? 'up' : nature?.down === stat ? 'down' : '';
    });
    document.querySelector(`[data-hp-bar="${key}"]`).style.width = `${side.hpPct * 100}%`;
    document.querySelector(`[data-hp-value="${key}"]`).textContent = `${sideCurrentHp(stats.hp,side)} / ${stats.hp}`;
  }
}

function sampleFieldMarkup() {
  const select = (key,label,options) => SampleUI.field(label,SampleUI.select(options,state.field[key],{'data-field':key}));
  const check = (key,label,side = '') => SampleUI.check(label,{...(side ? {'data-side':side,'data-flag':key} : {'data-field':key}),checked:!!(side ? state[side][key] : state.field[key])});
  return select('weather','날씨',CALC_WEATHER_OPTIONS.map(o => [o.id,o.label]))
    + select('terrain','필드',CALC_TERRAIN_OPTIONS.map(o => [o.id,o.label]))
    + select('gameType','배틀', [['Singles','싱글'],['Doubles','더블']])
    + `<div class="field-checks">${SampleUI.check('등장 특성',{id:'auto-entry',checked:!!autoEntryEffects})}${check('defReflect','리플렉터')}${check('defLightScreen','빛의장막')}${check('isGravity','중력')}${check('trickRoom','트릭룸')}${check('tailwind','내 순풍','atk')}${check('tailwind','상대 순풍','def')}${check('atkHelpingHand','도우미')}</div>`;
}

function sampleUpdateField() {
  const f = state.field;
  const labels = [(f.gameType === 'Singles' ? '싱글' : '더블')];
  if (f.weather !== 'none') labels.push(CALC_WEATHER_OPTIONS.find(o => o.id === f.weather)?.label);
  if (f.terrain !== 'none') labels.push(CALC_TERRAIN_OPTIONS.find(o => o.id === f.terrain)?.label);
  for (const [key,label] of [['defReflect','리플렉터'],['defLightScreen','빛의장막'],['isGravity','중력'],['trickRoom','트릭룸'],['atkHelpingHand','도우미']]) if(f[key]) labels.push(label);
  if (state.atk.tailwind) labels.push('내 순풍');
  if (state.def.tailwind) labels.push('상대 순풍');
  if (autoEntryEffects) labels.push('등장 특성');
  sampleEl('field-summary').textContent = labels.filter(Boolean).join(' · ');
  sampleEl('field-summary').title = sampleEl('field-summary').textContent;
}

function sampleCalculateSlot(slot, calc = makeCalcState()) {
  const base = MoveById[calc.atk.moves[slot]];
  if (!base || base.cat === 'Status') return { base, calc };
  const move = calcMoveWithConditions(base,calc.atk,slot);
  const field = {...powerMoveField(calc.atk,calc.def,move,calc.field), isCritical:!!calc.atk.moveCriticalOverrides[slot]};
  const result = calculatePowerDamage(calc.atk,calc.def,move,field);
  if (!result) return { base,move,calc,issue:calcMoveConditionIssue(move,calc.atk,calc.def,field) };
  const ko = hkoLabel(result.damages,result.defHP,calc.def,calc.field,result.koContext,result.hitProfile);
  return { base,move,result,ko,calc };
}

// Compact presentation only; the engine's damage and KO metadata stay intact.
function sampleResultNote(note) {
  const text = String(note).trim();
  if (/^현재 HP \d+ 기준$/.test(text) || text === '타격별 피해·열매 소비 반영') return '';
  if (text === '노말주얼 첫 기술에만 적용 · 이후 소비 상태') return '노말주얼 1회';
  if (text.startsWith('이번 턴 마지막으로 받은 HP 피해량')) return '마지막 피격량 필요';
  if (text.startsWith('받은 공격의 물리·특수 분류')) return '피격 분류 필요';
  if (text.startsWith('던질 수 있는 도구를 선택')) return '내던지기 도구 필요';
  if (text.startsWith('비축 횟수를 1~3회')) return '비축 1–3회 필요';
  return text
    .replace(/^.+? 타입: (.+ 무효)$/, '$1')
    .replace(/^(.+?): .+ 무효$/, '$1 무효')
    .replace(': 첫 공격 차단', ' 차단')
    .replace(': 생존 효과', ' 생존')
    .replace(' 회복 반영', ' 회복')
    .replace('이후 회복 없음', '회복 없음')
    .replace(/^(\d+)타 이내 확정$/, '최대 $1타')
    .replace('타격별 반영', '매 타격')
    .replace('타격별 공격 상승', '매 타격 공격↑')
    .replace('공격랭크', '공격')
    .replace('방어랭크', '방어')
    .replace(/^(물리|특수) 공격을 받은 조건에서만 사용할 수 있습니다\.$/, '$1 피격 필요')
    .replace('상대가 도구를 지녀야 사용할 수 있습니다.', '상대 도구 필요')
    .replace('필드가 있어야 사용할 수 있습니다.', '필드 필요')
    .replace('직접 입력한 위력이 0입니다.', '위력 0')
    .replace('현재 조건에서는 피해를 계산할 수 없습니다.', '계산 불가')
    .replace('대검돌격 이후 받는 피해', '대검돌격 후 피해')
    .replace(/\(쓰러진 아군 (\d+)\)/, '(기절 $1)')
    .replace(/\s*×\s*/g, ' ×')
    .trim();
}

function sampleMoveMarkup(slot, calc) {
  const {base,move,result,ko,issue} = sampleCalculateSlot(slot,calc);
  const moveButton = SampleUI.trigger(`<span class="move-name">${sampleEscape(base ? mvName(base) : '기술 선택')}</span>${base ? `<span class="move-meta">${sampleType(result?.moveType || move?.type || base.type)}<span>${sampleCategoryNames[base.cat]}</span><span>${result?.bp ? `위력 ${result.bp}` : base.cat === 'Status' ? '' : base.bp ? `위력 ${base.bp}` : '조건부'}</span></span>` : ''}`,{'data-pick':'move','data-side':'atk','data-slot':slot,'aria-haspopup':'dialog','aria-controls':'picker',title:base ? mvName(base) : '기술 선택','aria-label':`기술 ${slot+1}: ${base ? mvName(base) : '선택'}`},'move-select');
  let damage = `<span class="empty-damage">${base?.cat === 'Status' ? '변화기' : issue ? '조건 입력 필요' : '—'}</span>`;
  const notes = [];
  const addNote = (text, effect = false) => {
    const label = sampleResultNote(text);
    if (label) notes.push(`<span class="ui-tag${effect ? ' effect-note' : ''}">${sampleEscape(label)}</span>`);
  };
  if (result) {
    const min = Math.min(...result.damages), max = Math.max(...result.damages);
    damage = `<span class="damage-amount">${result.minPct.toFixed(1)}–${result.maxPct.toFixed(1)}<small>%</small></span><span class="damage-raw">${min}–${max} HP</span><div class="ui-meter damage-bar" aria-hidden="true"><span class="ui-meter-fill range" data-damage-width="${Math.min(100,result.maxPct)}"></span><span class="ui-meter-fill" data-damage-width="${Math.min(100,result.minPct)}"></span></div>`;
    for (const note of [...(result.immunityNotes || []),...(result.survivalNotes || [])]) addNote(note,true);
    if (!isFixedPowerMove(move)) {
      const ability = result.koContext?.atkAbility || '';
      const stab = getStabMod(calc.atk,result.moveType,ability);
      if (stab > 4096) {
        const data = AbilityById[ability];
        const source = data?.volatileStab || data?.stabBoost ? `${abName(data)} ` : '';
        addNote(`${source}자속${formatCalcMultiplier(stab)}`);
      }
    }
    if (state.atk.moveCriticalOverrides[slot] && !result.mods?.some(mod => mod.includes('급소'))) addNote('급소');
    for (const mod of result.mods || []) if (!['테라 매칭 STAB×2','다능 STAB×2.25'].includes(mod)) addNote(mod);
    if (ko.sub) for (const note of ko.sub.split(' · ')) addNote(note);
  } else if (issue) addNote(issue);
  const koMarkup = ko ? `<strong>${sampleEscape(`${ko.label} ${ko.turns}`)}</strong>${ko.pct ? ` <span class="ko-probability">${sampleEscape(ko.pct)} 확률</span>` : ''}` : '';
  return `<article class="move-row" data-move-row="${slot}"><span class="move-number" aria-hidden="true">0${slot+1}</span>${moveButton}<div class="damage-summary">${damage}</div><div class="ko${ko?.label === '난수' ? ' ko--random' : ''}">${koMarkup}</div><button type="button" class="ui-button icon-button move-settings-button" data-move-settings="${slot}" aria-haspopup="dialog" aria-controls="move-settings" aria-label="기술 ${slot+1} 조건 설정" ${base && base.cat !== 'Status' ? '' : 'disabled'}>${SampleUI.icon('settings')}</button><div class="move-notes">${[...new Set(notes)].join('')}</div></article>`;
}

function sampleRefresh({ fields = false, announce = false } = {}) {
  const focused = document.activeElement;
  const fieldFocusIndex = fields ? [...sampleEl('field-controls').querySelectorAll('input,select')].indexOf(focused) : -1;
  const calc = makeCalcState();
  lastAutoEntry = calc.entryMeta;
  sampleUpdateStats(calc);
  if (fields) sampleEl('field-controls').innerHTML = sampleFieldMarkup();
  sampleUpdateField();
  const targetName = pkName(PokemonById[calc.def.pokemonIdx]);
  const targetHp = sideCurrentHp(calcStats(calc.def).hp,calc.def);
  sampleEl('target-hp').innerHTML = `<span class="target-name" title="${sampleEscape(targetName)}">${sampleEscape(targetName)}</span> <span class="target-health"><span>HP</span> <strong>${targetHp}</strong></span>`;
  sampleEl('entry-effects').innerHTML = calc.entryMeta.logs.map(log => `<span class="ui-tag">${sampleEscape(log)}</span>`).join('');
  const focusSlot = focused?.dataset.moveSettings;
  const focusPickSlot = focused?.dataset.pick === 'move' ? focused.dataset.slot : null;
  sampleEl('move-rows').innerHTML = [0,1,2,3].map(slot => sampleMoveMarkup(slot,calc)).join('');
  sampleEl('move-rows').querySelectorAll('[data-damage-width]').forEach(bar => { bar.style.width = `${bar.dataset.damageWidth}%`; });
  if (focusSlot != null) document.querySelector(`[data-move-settings="${focusSlot}"]`)?.focus({preventScroll:true});
  if (focusPickSlot != null) document.querySelector(`[data-pick="move"][data-slot="${focusPickSlot}"]`)?.focus({preventScroll:true});
  if (fieldFocusIndex >= 0) sampleEl('field-controls').querySelectorAll('input,select')[fieldFocusIndex]?.focus({preventScroll:true});
  if (announce) {
    clearTimeout(sampleStatusTimer);
    sampleEl('calculation-status').textContent = '';
    sampleStatusTimer = setTimeout(() => { sampleEl('calculation-status').textContent = '피해 계산을 갱신했습니다.'; },250);
  }
}

function samplePickerData() {
  if (!samplePicker) return [];
  const {type,side} = samplePicker;
  if (type === 'nature') return NATURES.map(n => ({id:n.id,label:n.ko,meta:n.up ? `${sampleStatNames[n.up]} 상승 · ${sampleStatNames[n.down]} 하락` : '보정 없음',nature:n}));
  if (type === 'item') return [{id:'',label:'없음'},...calcDatasetForCombobox(side,'item').map(x => ({id:x.id,label:itName(x),description:x.desc || x.descLong || ''}))];
  if (type === 'ability') return calcDatasetForCombobox(side,'ability').map(x => ({id:x.id,label:abName(x),description:x.desc || x.descLong || ''}));
  if (type === 'move') return [{id:'',label:'기술 비우기'},...calcDatasetForCombobox(side,'move').filter(m => !samplePicker.category || m.cat === samplePicker.category).map(m => ({id:m.id,label:mvName(m),meta:`${TYPE_KO[m.type]} · 위력 ${m.bp || '—'} · ${sampleCategoryNames[m.cat]}`,description:m.desc || m.descLong || '',move:m}))];
  return calcDatasetForCombobox(side,'pokemon').map(p => ({id:p.id,label:pkName(p),meta:p.types.map(t => TYPE_KO[t]).join(' · '),pokemon:p}));
}

function sampleSizePickerList() {
  const list = sampleEl('picker-options');
  list.style.maxHeight = '';
  if (!sampleEl('picker').open) return;
  const row = list.querySelector('.picker-option');
  const headerHeight = list.querySelector('.picker-stats-head')?.getBoundingClientRect().height || 0;
  list.style.setProperty('--picker-header-height', `${headerHeight}px`);
  if (!row) return;
  // Keep complete rows between the sticky heading and the horizontal scrollbar.
  const rowHeight = row.getBoundingClientRect().height;
  const scrollbarHeight = list.offsetHeight - list.clientHeight;
  const visibleRows = Math.max(1, Math.floor((list.clientHeight - headerHeight + .5) / rowHeight));
  list.style.maxHeight = `${headerHeight + visibleRows * rowHeight + scrollbarHeight}px`;
}

function sampleFocusPickerOption(button) {
  if (!button) return;
  button.focus({preventScroll:true});
  const list = sampleEl('picker-options');
  const bounds = list.getBoundingClientRect();
  const headerHeight = list.querySelector('.picker-stats-head')?.getBoundingClientRect().height || 0;
  const row = button.getBoundingClientRect();
  const top = bounds.top + headerHeight;
  const bottom = bounds.bottom - (list.offsetHeight - list.clientHeight);
  if (row.top < top) list.scrollTop += row.top - top;
  else if (row.bottom > bottom) list.scrollTop += row.bottom - bottom;
}

function sampleFilterPicker() {
  const query = calcSearchText(sampleEl('picker-search').value);
  const matches = samplePickerData().filter(x => calcSearchText(`${x.label} ${x.id}`).includes(query));
  const side = state[samplePicker.side];
  const current = samplePicker.type === 'pokemon' ? side.pokemonIdx : samplePicker.type === 'move' ? side.moves[samplePicker.slot] || '' : side[samplePicker.type];
  const selectedAttr = id => id === current ? ' aria-current="true"' : '';
  const header = samplePicker.type === 'pokemon' && matches.length ? `<div class="picker-stats-head" aria-hidden="true"><span>종족값</span>${sampleStats.map(s => `<span>${sampleStatNames[s]}</span>`).join('')}<span>합계</span></div>` : '';
  sampleEl('picker-options').innerHTML = header + (matches.map(x => {
    if (x.pokemon) {
      const p = x.pokemon;
      return `<button type="button" class="ui-button ui-button--option picker-option pokemon-option" data-choice="${sampleEscape(x.id)}"${selectedAttr(x.id)} title="${sampleEscape(`${x.label} · ${x.meta}`)}"><span class="picker-pokemon-name">${pokemonSpriteSlot(p)}<strong>${sampleEscape(x.label)}</strong><span class="picker-pokemon-types">${p.types.map(sampleType).join('')}</span></span>${sampleStats.map(s => `<span class="picker-stat"><span class="sr-only">${sampleStatNames[s]} </span>${p.bs[s]}</span>`).join('')}<span class="picker-stat stat-total"><span class="sr-only">합계 </span>${calcPokemonBst(p)}</span></button>`;
    }
    if (x.nature) {
      const effect = (stat,direction) => `<span class="ui-tag nature-effect nature-effect--${direction}"><span>${sampleEscape(sampleStatNames[stat])}</span><span aria-hidden="true">${direction === 'up' ? '↑' : '↓'}</span><span class="sr-only"> ${direction === 'up' ? '상승' : '하락'}</span></span>`;
      return `<button type="button" class="ui-button ui-button--option picker-option nature-option" data-choice="${sampleEscape(x.id)}"${selectedAttr(x.id)} title="${sampleEscape(`${x.label} · ${x.meta}`)}"><strong class="picker-name">${sampleEscape(x.label)}</strong>${x.nature.up ? effect(x.nature.up,'up') + effect(x.nature.down,'down') : '<span class="nature-neutral">보정 없음</span>'}</button>`;
    }
    const detail = [x.meta,x.description].filter(Boolean).join(' · ');
    if (x.move) {
      return `<button type="button" class="ui-button ui-button--option picker-option move-option" data-choice="${sampleEscape(x.id)}"${selectedAttr(x.id)} title="${sampleEscape(`${x.label} · ${detail}`)}"><strong class="picker-name">${sampleEscape(x.label)}</strong><span class="picker-detail picker-move-detail">${sampleType(x.move.type)}<b class="picker-move-power"><span class="sr-only">위력 </span>${sampleEscape(x.move.bp || '—')}</b><span class="picker-move-category">${sampleEscape(sampleCategoryNames[x.move.cat])}</span><span class="picker-description">${sampleEscape(x.description)}</span></span></button>`;
    }
    return `<button type="button" class="ui-button ui-button--option picker-option" data-choice="${sampleEscape(x.id)}"${selectedAttr(x.id)} title="${sampleEscape([x.label,detail].filter(Boolean).join(' · '))}"><strong class="picker-name">${sampleEscape(x.label)}</strong><span class="picker-detail">${x.meta ? `<span class="picker-meta">${sampleEscape(x.meta)}</span>` : ''}${x.description ? `<span class="picker-description">${sampleEscape(x.description)}</span>` : ''}</span></button>`;
  }).join('') || '<p class="no-options">검색 결과 없음</p>');
  const list = sampleEl('picker-options');
  list.scrollTop = 0;
  list.scrollLeft = 0;
  sampleSizePickerList();
}

function sampleOpenPicker(button) {
  const {pick:type,side,slot} = button.dataset;
  samplePicker = {type,side,slot:Number(slot || 0),category:''};
  sampleEl('picker').dataset.kind = type;
  sampleEl('picker-title').textContent = `${{pokemon:'포켓몬',move:'기술',item:'도구',ability:'특성',nature:'성격'}[type]} 선택`;
  sampleEl('picker-search').value = '';
  sampleEl('picker-filters').innerHTML = type === 'move' ? [['','전체'],['Physical','물리'],['Special','특수'],['Status','변화']].map(([value,label]) => `<button type="button" class="ui-button ui-button--filter" data-category="${value}" aria-pressed="${value === ''}">${label}</button>`).join('') : '';
  sampleFilterPicker();
  sampleEl('picker').showModal();
  sampleSizePickerList();
  sampleEl('picker-search').focus({preventScroll:true});
}

function sampleChoose(id) {
  const {type,side:key,slot} = samplePicker;
  const side = state[key];
  if (type === 'pokemon') sampleSetPokemon(key,id);
  else if (type === 'move') {
    side.moves[slot] = id;
    for (const prop of ['moveBpOverrides','moveTypeOverrides','moveHitCounts']) side[prop][slot] = null;
    side.moveCriticalOverrides[slot] = false;
  } else {
    side[type] = id;
    if (type === 'ability') applyEntryFieldsFromSide(key);
  }
  sampleEl('picker').close();
  if (type !== 'move') sampleRenderSides();
  sampleRefresh({fields:true,announce:true});
  document.querySelector(`[data-pick="${type}"][data-side="${key}"]${type === 'move' ? `[data-slot="${slot}"]` : ''}`)?.focus({preventScroll:true});
}

function sampleOpenMoveSettings(slot) {
  sampleMoveSlot = slot;
  const s = state.atk;
  const m = MoveById[s.moves[slot]];
  if (!m || m.cat === 'Status') return;
  sampleEl('move-settings-title').textContent = `${mvName(m)} · 조건`;
  const select = (key,label,opts,value,scope='condition') => SampleUI.field(label,SampleUI.select(opts,value,{[`data-${scope}`]:key}));
  const number = (key,label,value,min,max,scope='condition') => SampleUI.field(label,SampleUI.number({min,max,[`data-${scope}`]:key,value:value ?? '',placeholder:scope === 'slot' ? '자동' : '입력'}));
  const flag = (key,label,scope='condition',value=s[key]) => SampleUI.check(label,{[`data-${scope}`]:key,checked:!!value});
  let primary = canEditMovePower(m) ? number('moveBpOverrides','위력',s.moveBpOverrides[slot],0,999,'slot') : '';
  primary += select('moveTypeOverrides','타입',[['','자동'],...BATTLE_TYPES.map(t => [t,TYPE_KO[t]])],s.moveTypeOverrides[slot] || '','slot');
  primary += flag('moveCriticalOverrides','급소','slot',s.moveCriticalOverrides[slot]);
  let html = '';
  if (m.mh) {
    const max = Array.isArray(m.mh) ? m.mh[1] : m.mh;
    const min = Array.isArray(m.mh) ? m.mh[0] : m.variableBpKind === 'tripleAxelAverage' ? 1 : max;
    html += select('moveHitCounts','적중 횟수',[['','자동'],...Array.from({length:max-min+1},(_,i) => [min+i,`${min+i}회`])],s.moveHitCounts[slot] || '','slot');
  }
  if (m.fixedDamageKind === 'receivedDamage') html += number('receivedDamage','마지막 타격의 받은 피해',s.receivedDamage,0,calcStats(s).hp-1) + select('receivedDamageCategory','받은 공격',[['Physical','물리'],['Special','특수']],s.receivedDamageCategory);
  if (m.variableBpKind === 'stockpile') html += select('stockpileCount','비축',[0,1,2,3].map(n => [n,`${n}회`]),s.stockpileCount);
  if (m.variableBpKind === 'fickleBeam') html += select('fickleBeamMode','강화',[['auto','확률 반영'],['normal','일반'],['boosted','강화']],s.fickleBeamMode);
  if (m.variableBpKind === 'fallenAllies' || AbilityById[s.ability]?.supremeOverlord) html += number('fallenAllies','쓰러진 아군',s.fallenAllies,0,battleMaxFallenAllies(state.field));
  if (['userMovesFirstDouble','userMovesSecondDouble'].includes(m.variableBpKind) || AbilityById[s.ability]?.bpBoosts?.some(rule => rule.movesSecond)) html += select('moveOrder','행동 순서',[['auto','자동'],['first','선공'],['second','후공']],s.moveOrder);
  if (m.variableBpKind === 'userWasHitDouble') html += flag('wasHit','이번 턴 먼저 피해를 받음');
  if (m.variableBpKind === 'targetWasHitDouble') html += flag('wasHit','상대가 이미 피해를 받음','def-condition',state.def.wasHit);
  if (m.variableBpKind === 'lastMoveFailedDouble') html += flag('lastMoveFailed','직전 기술 실패');
  if (m.variableBpKind === 'beatUpApprox') for (let i=0;i<battleMaxFallenAllies(state.field);i++) html += select(String(i),`참여 동료 ${i+1}`,[['','없음'],...POKEMON.filter(p => !p.mega).map(p => [p.id,pkName(p)])],s.beatUpParty[i] || '','member');
  sampleEl('move-settings-body').innerHTML = `<div class="move-settings-primary">${primary}</div>${html ? `<div class="move-settings-extra">${html}</div>` : ''}`;
  sampleEl('move-settings').showModal();
}

function sampleApplyInput(target) {
  const d = target.dataset;
  if (d.ev) {
    const side = state[d.side];
    const other = Object.entries(side.evs).reduce((sum,[stat,value]) => sum+(stat === d.ev ? 0 : value),0);
    const value = Math.max(0,Math.min(32,66-other,Math.trunc(Number(target.value) || 0)));
    side.evs[d.ev] = value;
    target.value = value;
  } else if (d.rank) state[d.side].ranks[d.rank] = Number(target.value);
  else if (d.hp) {
    const value = Math.max(0.1,Math.min(100,Number(target.value) || 0.1));
    state[d.hp].hpPct = value/100;
    target.value = value;
  } else if ('status' in d) state[d.side].status = target.value;
  else if (d.flag) state[d.side][d.flag] = target.checked;
  else if (target.id === 'auto-entry') setAutoEntryEffectsEnabled(target.checked);
  else if (d.field) {
    const value = target.type === 'checkbox' ? target.checked : target.value;
    if (['weather','terrain'].includes(d.field)) setManualCalcField(d.field,value);
    else state.field[d.field] = value;
  } else if (d.slot) {
    state.atk[d.slot][sampleMoveSlot] = target.type === 'checkbox' ? target.checked : target.value === '' ? null : d.slot === 'moveTypeOverrides' ? target.value : Math.max(0,Math.min(Number(target.max) || 999,Number(target.value)));
    if (target.type === 'number') target.value = state.atk[d.slot][sampleMoveSlot] ?? '';
  } else if (d.condition || d.defCondition) {
    const key = d.condition || d.defCondition;
    const side = d.defCondition ? state.def : state.atk;
    side[key] = target.type === 'checkbox' ? target.checked : ['receivedDamage','fallenAllies','stockpileCount'].includes(key) ? target.value === '' ? null : Math.max(0,Math.min(Number(target.max) || 999,Number(target.value))) : target.value;
    if (target.type === 'number') target.value = side[key] ?? '';
  } else if ('member' in d) state.atk.beatUpParty[Number(d.member)] = target.value;
  else return;
  sampleRefresh({fields:target.id === 'auto-entry',announce:true});
}

function sampleTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem('rotom-sample-theme',theme); } catch (_) {}
  sampleEl('theme-toggle').setAttribute('aria-label',theme === 'dark' ? '라이트 테마로 전환' : '다크 테마로 전환');
  sampleEl('theme-toggle').innerHTML = SampleUI.icon(theme === 'dark' ? 'sun' : 'moon');
}

document.addEventListener('click',event => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.pick) sampleOpenPicker(button);
  else if ('choice' in button.dataset) sampleChoose(button.dataset.choice);
  else if ('closeDialog' in button.dataset) button.closest('dialog').close();
  else if ('moveSettings' in button.dataset) sampleOpenMoveSettings(Number(button.dataset.moveSettings));
  else if ('category' in button.dataset) {
    samplePicker.category = button.dataset.category;
    sampleEl('picker-filters').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed',String(b === button)));
    sampleFilterPicker();
  } else if (button.id === 'swap-sides') {
    [state.atk,state.def] = [state.def,state.atk];
    swapAutoEntryFieldOwners();
    sampleRenderSides();
    sampleRefresh({fields:true,announce:true});
  } else if (button.id === 'theme-toggle') sampleTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
});
document.addEventListener('change',event => sampleApplyInput(event.target));
sampleEl('picker-search').addEventListener('input',sampleFilterPicker);
sampleEl('picker-search').addEventListener('keydown',event => {
  if (event.isComposing || event.keyCode === 229) return;
  if (event.key === 'ArrowDown') { event.preventDefault(); sampleFocusPickerOption(sampleEl('picker-options').querySelector('button')); }
  if (event.key === 'Enter') { event.preventDefault(); sampleEl('picker-options').querySelector('button')?.click(); }
});
sampleEl('picker-options').addEventListener('keydown',event => {
  if (!['ArrowDown','ArrowUp','Home','End'].includes(event.key)) return;
  event.preventDefault();
  const buttons = [...sampleEl('picker-options').querySelectorAll('button')];
  const index = buttons.indexOf(document.activeElement);
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length-1 : Math.max(0,Math.min(buttons.length-1,index+(event.key === 'ArrowDown' ? 1 : -1)));
  sampleFocusPickerOption(buttons[next]);
});
window.addEventListener('resize',sampleSizePickerList);
sampleEl('move-settings').addEventListener('close',() => document.querySelector(`[data-move-settings="${sampleMoveSlot}"]`)?.focus({preventScroll:true}));
sampleSetPokemon('atk','garchomp',true);
sampleSetPokemon('def','dragonite',true);
state.atk.evs = {hp:2,atk:32,def:0,spa:0,spd:0,spe:32};
state.atk.nature = 'jolly';
state.atk.item = 'lifeorb';
state.def.evs = {hp:32,atk:32,def:0,spa:0,spd:2,spe:0};
state.def.nature = 'adamant';
state.def.ability = 'multiscale';
sampleRenderSides();
sampleRefresh({fields:true});
let initialTheme = 'light';
try { initialTheme = localStorage.getItem('rotom-sample-theme') || 'light'; } catch (_) {}
sampleTheme(initialTheme === 'dark' ? 'dark' : 'light');
window.calculatorSampleReady = true;
