import { renderToolStatMagicCell, renderToolStatNatureMark, toolStatApplyPointValue } from './01-20-html-structure.js';
import { AbilityById, ItemById, NATURE_BY_ID, POKEMON, PokemonById, STATS, TYPE_KO, abName, battleAbilityContext, calcStats, effectiveBattleItem, effectiveTypes, escapeHTML, isGrounded, itName, pkName, renderTrustedHTML, typeEff } from './01-core.js';
import { effectiveSpeed, fractionValue } from './02-engine.js';
import { applyPokemonFormToSideState, calcFormOptionDataForPokemon, calcNatureLabel, calcPokemonFormLabel, cloneCalcValue, defaultPokemonItemId, deriveHpFlags, makeFieldState, makeSideState } from './03-10-calc-state.js';
import { uiWirePickerDialog } from './03-19-picker-dialog.js';
import { calcAbilityOptionDataForPokemon, calcItemOptionData, calcNatureOptionData } from './03-20-calc-combobox.js';
import { calcComboboxHeaderHtml, calcRenderComboboxOption } from './03-21-calc-combobox-options.js';
import { renderFineTuneAll } from './04-31-finetune-render.js';

/* Fine-tune EV planner.
 * Loaded before 05-init.js by build.mjs alphabetical concatenation.
 */
// Both complete builds and their shared field survive calculator round trips.
const fineTuneState = {
  my: makeSideState(),
  opp: makeSideState(),
  field: makeFieldState(),
  margin: 1,
  targetSpeed: '',
};

// Fine-tune helpers: keep this tab aligned with the calculator engine.
function ftStatKeys() {
  return typeof STATS !== 'undefined' ? STATS : ['hp','atk','def','spa','spd','spe'];
}

function ftClampInt(value, min, max) {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function ftClampEvValue(stat, requested, evs = fineTuneState.my.evs) {
  const wanted = ftClampInt(requested, 0, 32);
  const otherSum = ftStatKeys().reduce((a, key) => key === stat ? a : a + (evs[key] || 0), 0);
  return Math.min(wanted, Math.max(0, 66 - otherSum));
}

function ftSetEv(stat, requested) {
  if (!ftStatKeys().includes(stat)) return;
  if (typeof toolStatApplyPointValue === 'function') {
    toolStatApplyPointValue(fineTuneState.my, stat, requested, { stats: ftStatKeys(), maxTotal: 66 });
    return;
  }
  fineTuneState.my.evs[stat] = ftClampEvValue(stat, requested, fineTuneState.my.evs);
}

function ftDefaultField() {
  return cloneCalcValue(fineTuneState.field);
}

function ftSpeedFieldFor(side) {
  return ftDefaultField();
}

function ftSpeedSideFor(side) {
  const out = { ...makeSideState(side?.pokemonIdx), ...cloneCalcValue(side || {}) };
  if (!out.ranks) out.ranks = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  if (!out.evs) out.evs = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  if (typeof deriveHpFlags === 'function') deriveHpFlags(out);
  return out;
}

function ftMySpeed(my) {
  if (!PokemonById[my?.pokemonIdx]) return 0;
  return effectiveSpeed(ftSpeedSideFor(my), ftDefaultField(), ftSpeedSideFor(fineTuneState.opp));
}

function ftOpponentBaseSpeed(opp = fineTuneState.opp) {
  const pokemon = PokemonById[opp?.pokemonIdx];
  return Math.max(1, Math.min(255, pokemon?.bs?.spe || 1));
}

function ftNatureForSpeedCase(natureSpec) {
  if (typeof natureSpec === 'string') return natureSpec;
  return Number(natureSpec) > 1 ? 'jolly' : 'hardy';
}

function ftOppSpeedCase(opp, ev, natureSpec) {
  if (!PokemonById[opp?.pokemonIdx]) return 0;
  const side = ftSpeedSideFor(opp);
  if (ev !== null) {
    side.evs = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: ftClampInt(ev, 0, 32) };
    side.nature = ftNatureForSpeedCase(natureSpec);
  }
  return effectiveSpeed(side, ftDefaultField(), ftSpeedSideFor(fineTuneState.my));
}

function ftOppSpeedRefCases() {
  return [
    { label: '최속', ev: 32, nature: 'jolly' },
    { label: '준속', ev: 32, nature: 'hardy' },
    { label: '무보정', ev: 0, nature: 'hardy' },
  ];
}

function ftRenderOppSpeedChipsHtml(opp = fineTuneState.opp) {
  if (!PokemonById[opp?.pokemonIdx]) return '';
  return ftOppSpeedRefCases().map(c => `
    <span class="ft-speed-chip ${c.label === '최속' ? 'fastest' : c.label === '준속' ? 'neutral-fast' : ''}">
      <em>${c.label}</em>
      <b>${ftOppSpeedCase(opp, c.ev, c.nature)}</b>
    </span>
  `).join('');
}

function ftRefreshOppSpeedChips() {
  const el = document.querySelector?.('#ft-opp-body .ft-opp-speed-chips');
  if (el) renderTrustedHTML(el, ftRenderOppSpeedChipsHtml());
}

function ftFindMinSpeedEv(my, targetSpeed) {
  for (let ev = 0; ev <= 32; ev++) {
    const tmp = { ...my, evs: { ...my.evs, spe: ev } };
    if (ftMySpeed(tmp) >= targetSpeed) return ev;
  }
  return null;
}

function ftSpeedCases() {
  return [
    { label: '최속', sub: '상승 성격 · S32', kind:'fastest', ev: 32, nature: 'jolly' },
    { label: '준속', sub: '무보정 · S32', kind:'neutral-fast', ev: 32, nature: 'hardy' },
    { label: '무보정', sub: 'S0', kind:'neutral', ev: 0, nature: 'hardy' },
  ];
}

function ftBuildSpeedTable() {
  const my = fineTuneState.my;
  const opp = fineTuneState.opp;
  const margin = ftClampInt(fineTuneState.margin, 0, 999);
  const cases = PokemonById[opp.pokemonIdx] ? [...ftSpeedCases(), { label: '입력 배치', sub: '상대 배분·성격 유지', ev: null }] : [];
  const rows = cases.map(c => {
    const oppSpe = ftOppSpeedCase(opp, c.ev, c.nature);
    const target = oppSpe + margin;
    return { ...c, oppSpe, target, ...ftSpeedRequirement(my, target) };
  });
  if (String(fineTuneState.targetSpeed).trim() !== '') {
    const oppSpe = ftClampInt(fineTuneState.targetSpeed, 1, 10000);
    rows.push({ label: '직접 입력', sub: '보정 후 상대 실수치', oppSpe, target: oppSpe + margin, ...ftSpeedRequirement(my, oppSpe + margin) });
  }
  return rows;
}

function ftSpeedRequirement(my, target) {
  const need = ftFindMinSpeedEv(my, target);
  const other = ftStatKeys().reduce((sum, stat) => sum + (stat === 'spe' ? 0 : my.evs[stat] || 0), 0);
  const available = Math.max(0, Math.min(32, 66 - other));
  return { need, available, shortfall: need === null ? 0 : Math.max(0, need - available), achieved: ftMySpeed(my) >= target };
}

function ftAbilityOptionsForCurrentPokemon() {
  return calcAbilityOptionDataForPokemon(fineTuneState.my.pokemonIdx, fineTuneState.my.ability);
}

function sortPokemonForFineTuneSelect(pokemon) {
  return pokemon.slice().sort((a, b) => {
    const speedDiff = (b.bs?.spe || 0) - (a.bs?.spe || 0);
    if (speedDiff !== 0) return speedDiff;
    return pkName(a).localeCompare(pkName(b), 'ko', { numeric: true, sensitivity: 'base' });
  });
}

function ftComboData(target) {
  if (target === 'my' || target === 'opp') {
    return sortPokemonForFineTuneSelect(POKEMON).map(p => ({ id: p.id, label: pkName(p), sub: `SPE ${p.bs?.spe || 0} · ${p.types.join('/')} · BST ${p.bst}`, raw: p }));
  }
  if (target === 'myForm') return calcFormOptionDataForPokemon(fineTuneState.my.pokemonIdx);
  if (target === 'oppForm') return calcFormOptionDataForPokemon(fineTuneState.opp.pokemonIdx);
  if (target === 'item' || target === 'oppItem') {
    return calcItemOptionData();
  }
  if (target === 'nature' || target === 'oppNature') {
    return calcNatureOptionData();
  }
  if (target === 'ability') return ftAbilityOptionsForCurrentPokemon();
  if (target === 'oppAbility') return calcAbilityOptionDataForPokemon(fineTuneState.opp.pokemonIdx, fineTuneState.opp.ability);
  return [];
}

function ftComboLabel(target, id) {
  target = { oppAbility: 'ability', oppItem: 'item', oppNature: 'nature' }[target] || target;
  if (target === 'my' || target === 'opp') return pkName(PokemonById[id] || { name: '' });
  if (target === 'myForm' || target === 'oppForm') return PokemonById[id] ? calcPokemonFormLabel(PokemonById[id]) : '';
  if (target === 'item') return id ? itName(ItemById[id] || { name: id }) : '없음';
  if (target === 'nature') return calcNatureLabel(NATURE_BY_ID[id]) || id;
  if (target === 'ability') return id ? abName(AbilityById[id] || { name: id }) : '없음';
  return id || '';
}

function ftSearchMatches(query, option) {
  const q = String(query || '').toLowerCase();
  if (!q) return true;
  return [option.id, option.label, option.sub, option.raw?.name, option.raw?.koName]
    .some(value => String(value || '').toLowerCase().includes(q));
}

function ftRenderOpponentPokemonOption(option, currentId) {
  const pokemon = option?.raw || option || {};
  const id = option?.id || pokemon.id || '';
  const label = option?.label || pkName(pokemon);
  const types = pokemon.types || option?.types || [];
  const speed = pokemon.bs?.spe || option?.bs?.spe || 0;
  const typeBadges = types.map(type => (
    `<span class="type-pill pokemon-simple-type-pill ft-opp-pokemon-type-pill t-${escapeHTML(type)}">${escapeHTML(TYPE_KO[type] || type)}</span>`
  )).join('');
  const selected = String(id) === String(currentId);
  const optionClass = ['combobox-option', 'ui-option', 'pokemon-simple-option', 'ft-opp-pokemon-option', selected ? 'selected' : '']
    .filter(Boolean)
    .join(' ');
  return `
    <div class="${optionClass}" data-id="${escapeHTML(id)}" role="option" aria-selected="${selected ? 'true' : 'false'}">
      <b class="pokemon-simple-option-name ft-opp-pokemon-name">${escapeHTML(label)}</b>
      <small class="pokemon-simple-option-types ft-opp-pokemon-types">${typeBadges}</small>
      <span class="ft-opp-pokemon-speed" title="SPE ${escapeHTML(speed)}">${escapeHTML(speed)}</span>
    </div>
  `;
}

function ftApplyPokemonToFineTune(pokemonId) {
  const pokemon = PokemonById[pokemonId];
  if (!pokemon) return;
  const changed = fineTuneState.my.pokemonIdx !== pokemonId;
  if (changed) {
    fineTuneState.my = makeSideState(pokemonId);
    fineTuneState.my.item = defaultPokemonItemId(pokemon);
  }
}

function ftSelectCombo(target, id) {
  if (target === 'my') ftApplyPokemonToFineTune(id);
  if (target === 'myForm') {
    applyPokemonFormToSideState(fineTuneState.my, id);
  }
  if (target === 'opp' && PokemonById[id]) {
    fineTuneState.opp = makeSideState(id);
    fineTuneState.opp.item = defaultPokemonItemId(PokemonById[id]);
  }
  if (target === 'oppForm') {
    applyPokemonFormToSideState(fineTuneState.opp, id);
  }
  if (target === 'item') fineTuneState.my.item = id || '';
  if (target === 'nature') fineTuneState.my.nature = id || 'hardy';
  if (target === 'ability') {
    fineTuneState.my.ability = id || '';
  }
  if (target === 'oppAbility') fineTuneState.opp.ability = id || '';
  if (target === 'oppItem') fineTuneState.opp.item = id || '';
  if (target === 'oppNature') fineTuneState.opp.nature = id || 'hardy';
}

function ftCurrentComboId(target) {
  if (target === 'my') return fineTuneState.my.pokemonIdx || '';
  if (target === 'opp') return fineTuneState.opp.pokemonIdx || '';
  if (target === 'myForm') return fineTuneState.my.pokemonIdx || '';
  if (target === 'oppForm') return fineTuneState.opp.pokemonIdx || '';
  if (target === 'item') return fineTuneState.my.item || '';
  if (target === 'nature') return fineTuneState.my.nature || 'hardy';
  if (target === 'ability') return fineTuneState.my.ability || '';
  if (target === 'oppAbility') return fineTuneState.opp.ability || '';
  if (target === 'oppItem') return fineTuneState.opp.item || '';
  if (target === 'oppNature') return fineTuneState.opp.nature || 'hardy';
  return '';
}

function ftWireComboboxes(rootId) {
  document.getElementById(rootId)?.querySelectorAll('.ft-cb-input').forEach(input=>{
    if(input.dataset.ftWired==='1') return;
    input.dataset.ftWired='1';
    const target=input.dataset.ftPick;
    const kind=({my:'pokemon',opp:'pokemon',myForm:'form',oppForm:'form',oppItem:'item',oppAbility:'ability',oppNature:'nature'})[target] || target;
    input.dataset.cbType=kind;
    const list=input.closest('.combobox').querySelector('.combobox-options');
    uiWirePickerDialog(input,list,{
      showOptions:query=>{
        const matches=ftComboData(target).filter(option=>ftSearchMatches(query,option));
        renderTrustedHTML(list,calcComboboxHeaderHtml(kind)+(matches.length ? matches.map(option=>calcRenderComboboxOption(kind,option,ftCurrentComboId(target))).join('') : '<div class="combobox-option empty">검색 결과 없음</div>'));
      },
      onSelect:option=>{ftSelectCombo(target,option.dataset.id || '');renderFineTuneAll();}
    });
  });
}

function ftWireMyComboboxes() { ftWireComboboxes('ft-my-body'); }
function ftWireOppComboboxes() { ftWireComboboxes('ft-opp-body'); }

function ftHpAtEv(side, ev) {
  const tmp = { ...side, evs: { ...side.evs, hp: ev } };
  return calcStats(tmp).hp;
}

function ftMultiplierLabel(value) {
  if (value === 0) return '무효';
  if (value === 0.25) return '1/4배';
  if (value === 0.5) return '1/2배';
  return `${value}배`;
}

function ftHpBreakpointRules(side) {
  const opponent = fineTuneState.opp;
  const { atkAb: ability } = battleAbilityContext(side, opponent);
  const itemId = effectiveBattleItem(side, ability);
  const item = ItemById[itemId] || {};
  const guard = ability === 'magicguard';
  const rules = [];
  const add = (id, denom, remainder, desc, kind, relevant = true) => rules.push({
    id, rule: `${denom}n${remainder ? (remainder === denom - 1 ? '-1' : `+${remainder}`) : ''}`,
    desc, kind, fraction: 1 / denom, predicate: hp => hp % denom === remainder, relevant,
  });
  if (!guard) {
    add('dot-plus', 16, 1, '1/16 지속 피해', 'damage', false);
    add('dot-min', 16, 15, '1/16 지속 피해', 'damage', false);
    if (!effectiveTypes(side).includes('Grass')) {
      add('seed-plus', 8, 1, '씨뿌리기', 'damage', false);
      add('seed-min', 8, 7, '씨뿌리기', 'damage', false);
    }
  }
  rules.push({ id: 'sub', rule: '4n+1~3', desc: '대타출동', kind: 'sub', predicate: hp => hp % 4 !== 0, relevant: side.moves?.includes('substitute') });
  if (itemId === 'lifeorb' && !guard) add('lifeorb', 10, 9, '생명의구슬 반동', 'damage');
  if (item.residualRecovery?.kind === 'endTurn') {
    const denom = Math.round(1 / fractionValue(item.residualRecovery.fraction, 1 / 16));
    add(itemId, denom, 0, `${itName(item)} 회복`, 'heal');
  }
  if (item.hpRecovery) {
    const fraction = fractionValue(item.hpRecovery.fraction, 0);
    rules.push({ id: itemId, rule: fraction ? `${Math.round(1 / fraction)}n` : '2n',
      desc: `${itName(item)} 발동·회복`, kind: 'berry', recovery: item.hpRecovery,
      predicate: hp => hp % (fraction ? Math.round(1 / fraction) : 2) === 0, relevant: true });
  }
  const rockEff = typeEff('Rock', effectiveTypes(side));
  if (rockEff > 0 && !guard && itemId !== 'heavydutyboots') {
    const denom = Math.max(1, Math.round(8 / rockEff));
    rules.push({
      id: `sr-${denom}`,
      rule: `${denom}n+1`,
      desc: `스텔스록 ${ftMultiplierLabel(rockEff)}`,
      kind: 'damage', fraction: rockEff / 8,
      predicate: hp => hp % denom === 1,
      relevant: true,
    });
  }

  if (!guard && itemId !== 'heavydutyboots' && isGrounded(side, ftDefaultField(), ability, itemId)) {
    [
      { layer: 1, denom: 8 },
      { layer: 2, denom: 6 },
      { layer: 3, denom: 4 },
    ].forEach(({ layer, denom }) => {
      rules.push({
        id: `spikes-${layer}`,
        rule: `${denom}n+1`,
        desc: `압정 ${layer}중`,
        kind: 'damage', fraction: 1 / denom,
        predicate: hp => hp % denom === 1,
        relevant: true,
      });
    });
  }
  return rules;
}

function ftHpBreakpointDeltas(side, rule) {
  const curEv = side.evs?.hp || 0;
  const otherSum = ftStatKeys().reduce((a, key) => key === 'hp' ? a : a + (side.evs?.[key] || 0), 0);
  const maxEv = 32;
  const hits = [];
  for (let ev = 0; ev <= maxEv; ev++) {
    const hp = ftHpAtEv(side, ev);
    if (rule.predicate(hp)) hits.push({ ev, hp, shortfall: Math.max(0, otherSum + ev - 66) });
  }
  const current = hits.find(hit => hit.ev === curEv) || null;
  const prev = [...hits].reverse().find(hit => hit.ev < curEv) || null;
  const next = hits.find(hit => hit.ev > curEv) || null;
  return { rule, current, prev, next, currentHp: ftHpAtEv(side, curEv), maxEv };
}

function ftHpBreakpoints(side) {
  return ftHpBreakpointRules(side).map(rule => ftHpBreakpointDeltas(side, rule));
}

function ftMagicNumbers(side, stat) {
  if (stat === 'hp') return null;
  const nature = NATURE_BY_ID?.[side.nature];
  if (!nature || nature.up !== stat) return null;
  const p = PokemonById[side.pokemonIdx];
  if (!p) return null;
  const base = p.bs[stat];
  let firstMagic = (10 - (base + 20) % 10) % 10;
  if (firstMagic === 0) firstMagic = 10;
  const magicEvs = [];
  for (let m = firstMagic; m <= 32; m += 10) magicEvs.push(m);
  const cur = side.evs[stat] || 0;
  return {
    magicEvs,
    cur,
    current: magicEvs.includes(cur) ? cur : null,
    prev: [...magicEvs].reverse().find(m => m < cur) ?? null,
    next: magicEvs.find(m => m > cur) ?? null,
  };
}

function ftEvSummary(side) {
  const total = ftStatKeys().reduce((sum, stat) => sum + (side.evs?.[stat] || 0), 0);
  return {
    total,
    remaining: Math.max(0, 66 - total),
    over: total > 66,
  };
}

function ftNatureMark(stat, natureId) {
  return renderToolStatNatureMark(stat, natureId, {
    upClass: 'ft-nature-up',
    downClass: 'ft-nature-down',
    emptyClass: 'ft-nature-spacer',
  });
}

function ftRenderMagicCell(side, stat, ev) {
  const magic = ftMagicNumbers(side, stat);
  if (!magic) return renderToolStatMagicCell(null, { className: 'ft-magic', empty: true });
  return renderToolStatMagicCell({
    prev: magic.prev,
    prevLabel: magic.prev !== null ? `-${ev - magic.prev}` : null,
    prevTitle: magic.prev !== null ? `이전 매직 포인트: ${magic.prev}pt` : null,
    current: magic.current,
    currentLabel: magic.current !== null ? '현재' : null,
    currentTitle: magic.current !== null ? '현재 매직 포인트' : null,
    next: magic.next,
    nextLabel: magic.next !== null ? `+${magic.next - ev}` : null,
    nextTitle: magic.next !== null ? `다음 매직 포인트: ${magic.next}pt` : null,
  }, {
    className: 'ft-magic',
    prevClass: 'ft-magic-prev',
    currentClass: 'ft-magic-current',
    nextClass: 'ft-magic-next',
    currentSlotClass: 'ft-magic-current-slot',
  });
}

function ftBulkMetrics(side) {
  const stats = calcStats(side);
  return {
    stats,
    phys: Math.round(stats.hp * stats.def / 0.411),
    spec: Math.round(stats.hp * stats.spd / 0.411),
  };
}

function ftUniqueJoin(values, separator = ' · ') {
  return [...new Set(values.filter(Boolean))].join(separator);
}

function ftHpRulePriority(rule) {
  if (!rule.relevant) return 2;
  return /^(sr|spikes)-/.test(rule.id) ? 1 : 0;
}

function ftFormatBreakpointDescriptions(entries) {
  const labels = [...new Set(entries.filter(info => !info.rule.id.startsWith('spikes-')).map(info => info.rule.desc))];
  const layers = entries.filter(info => info.rule.id.startsWith('spikes-')).map(info => info.rule.id.split('-')[1]).sort();
  if (layers.length) labels.push('압정 ' + layers.join('·') + '중');
  return labels.join(' · ');
}

function ftBuildHpTargets(side) {
  const rows = ftHpBreakpoints(side), currentHp = calcStats(side).hp, currentEv = side.evs.hp || 0;
  const pointsByHp = new Map();
  for (let ev = 0; ev <= 32; ev++) {
    const hp = ftHpAtEv(side,ev);
    if (!pointsByHp.has(hp)) pointsByHp.set(hp,ev);
  }
  const others = ftStatKeys().reduce((total,key) => total + (key === 'hp' ? 0 : side.evs[key] || 0),0);
  const targets = new Map();
  const add = (hit,info) => {
    if (!hit) return;
    const ev = pointsByHp.get(hit.hp), delta = ev - currentEv;
    if (!delta || (delta > 0 && hit.hp <= currentHp)) return;
    if (!targets.has(hit.hp)) targets.set(hit.hp,{hp:hit.hp,ev,delta,shortfall:Math.max(0,others+ev-66),sources:[]});
    targets.get(hit.hp).sources.push(info);
  };
  rows.forEach(info => {
    // A fulfilled rule stays in the summary; only unmet rules propose more investment.
    if (!info.current) add(info.next,info);
    add(info.prev,info);
  });
  const byPriority = (a,b) => ftHpRulePriority(a.rule)-ftHpRulePriority(b.rule);
  const goals = [...targets.values()].map(target => {
    const priority = Math.min(...target.sources.map(info => ftHpRulePriority(info.rule)));
    const entries = rows.filter(info => info.rule.predicate(target.hp) && (priority === 2 || info.rule.relevant)).sort(byPriority);
    return {...target,priority,entries};
  }).sort((a,b) => Number(!!a.shortfall)-Number(!!b.shortfall) || a.priority-b.priority || Math.abs(a.delta)-Math.abs(b.delta) || a.hp-b.hp);
  return {
    currentHp,
    current:rows.filter(info => info.current && info.rule.relevant).sort(byPriority),
    referenceCurrent:rows.filter(info => info.current && !info.rule.relevant),
    investment:goals.filter(goal => goal.delta > 0 && goal.priority < 2),
    savings:goals.filter(goal => goal.delta < 0),
    reference:goals.filter(goal => goal.delta > 0 && goal.priority === 2),
  };
}

export { fineTuneState, ftStatKeys, ftClampInt, ftClampEvValue, ftSetEv, ftDefaultField, ftSpeedFieldFor, ftSpeedSideFor, ftMySpeed, ftOpponentBaseSpeed, ftNatureForSpeedCase, ftOppSpeedCase, ftOppSpeedRefCases, ftRenderOppSpeedChipsHtml, ftRefreshOppSpeedChips, ftFindMinSpeedEv, ftSpeedCases, ftBuildSpeedTable, ftSpeedRequirement, ftAbilityOptionsForCurrentPokemon, sortPokemonForFineTuneSelect, ftComboData, ftComboLabel, ftSearchMatches, ftRenderOpponentPokemonOption, ftApplyPokemonToFineTune, ftSelectCombo, ftCurrentComboId, ftWireComboboxes, ftWireMyComboboxes, ftWireOppComboboxes, ftHpAtEv, ftMultiplierLabel, ftHpBreakpointRules, ftHpBreakpointDeltas, ftHpBreakpoints, ftMagicNumbers, ftEvSummary, ftNatureMark, ftRenderMagicCell, ftBulkMetrics, ftUniqueJoin, ftHpRulePriority, ftFormatBreakpointDescriptions, ftBuildHpTargets };
