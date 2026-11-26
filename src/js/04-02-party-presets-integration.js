import { replaceCalcMoves } from './03-09-move-slots.js';
import { featureApis } from '../runtime/features.js';
import { ABILITIES, AbilityById, ITEMS, ItemById, MOVES, MoveById, NATURES, NATURE_BY_ID, POKEMON, PokemonById, STATS, toId } from './01-core.js';
import { resetMoveHistory, applyPokemonToCalcSide, defaultPokemonAbilityId, defaultPokemonItemId, defaultPokemonTypes, makeSideState, setSideDamageBlockActive, state } from './03-10-calc-state.js';
import { renderSide } from './03-30-calc-side-render.js';
import { applyEntryFieldsFromSide, syncFieldControls } from './03-40-calc-entry-effects.js';
import { triggerCalc } from './03-50-calc-results.js';
import { PARTY_PRESET_MAX_MEMBERS, PARTY_PRESET_SHOWDOWN_STAT_ALIAS, PARTY_PRESET_SHOWDOWN_STAT_LABEL, blankPartyPresetMember, normalizePartyPresetData, normalizePartyPresetEvs, normalizePartyPresetMember, partyPresetData, partyPresetMemberClone, runPartyPresetImport, savePartyPresetData } from './04-00-party-presets-state.js';

/* Party presets: tool integration and Showdown format. */
async function saveCalcMemberToParty(sideKey, partyIndex, slotIndex, confirm) {
  const side = state[sideKey];
  const party = () => partyPresetData.parties[partyIndex];
  const slot = party()?.members[slotIndex];
  if (!side?.pokemonIdx || !slot) return 'cancelled';
  const member = normalizePartyPresetMember({ ...side, pokemon: side.pokemonIdx });
  const original = JSON.stringify(slot);
  if (slot.pokemon && !await confirm({
    title: '파티 슬롯 교체',
    message: `${partyIndex + 1}번 파티의 ${slotIndex + 1}번 슬롯을 교체할까요?`,
    actionLabel: '교체하기',
  })) return 'cancelled';
  if (original !== JSON.stringify(party()?.members[slotIndex])) return 'changed';
  party().members[slotIndex] = member;
  return await savePartyPresetData() ? 'saved' : 'failed';
}

function partyPresetMemberMoves(member) {
  return Array.from({ length: 4 }, (_, index) => {
    const moveId = member?.moves?.[index] || '';
    return MoveById[moveId] ? moveId : '';
  });
}

function partyPresetAttackingMoves(member) {
  return partyPresetMemberMoves(member).map(moveId => {
    const move = MoveById[moveId];
    return move && move.cat !== 'Status' ? moveId : null;
  });
}

function partyPresetApplyMemberToSideState(side, member) {
  const data = partyPresetMemberClone(member);
  const pokemon = PokemonById[data.pokemon];
  if (!side || !pokemon) return false;
  const tailwind = side.tailwind;
  Object.assign(side, makeSideState(data.pokemon), { tailwind: !!tailwind });
  side.ability = data.ability || defaultPokemonAbilityId(pokemon);
  side.item = data.item || '';
  side.nature = data.nature || 'hardy';
  side.evs = { ...side.evs, ...data.evs };
  side.types = defaultPokemonTypes(pokemon);
  side.teraType = side.types?.[0] || 'Normal';
  side.tera = false;
  replaceCalcMoves(side, partyPresetMemberMoves(data));
  resetMoveHistory(side);
  setSideDamageBlockActive?.(side, false);
  return true;
}

function partyPresetApplyMemberToCalc(sideKey, member) {
  const side = state?.[sideKey];
  const pokemonId = member?.pokemon;
  if (!side || !PokemonById[pokemonId]) return false;
  const result = applyPokemonToCalcSide(sideKey, pokemonId, {
    forceDefaults: true,
    deferEntryEffects: true,
  });
  partyPresetApplyMemberToSideState(side, member);
  result.resetAutoFields = applyEntryFieldsFromSide(sideKey) || result.resetAutoFields;
  renderSide(sideKey);
  if (result?.resetAutoFields) syncFieldControls?.();
  triggerCalc?.();
  return true;
}

function partyPresetApplyPartyToMatchup(partyIndex) {
  const party = partyPresetData.parties?.[partyIndex];
  if (!party) return false;
  featureApis.matchup.applyParty(party.members);
  return true;
}

function partyPresetApplyPickerMember(target, member) {
  if (target === 'calc:atk') return partyPresetApplyMemberToCalc('atk', member);
  if (target === 'calc:def') return partyPresetApplyMemberToCalc('def', member);
  if (target === 'finetune:my') return featureApis.finetune.applyPartyMember(member);
  if (target === 'revcalc:my') return featureApis.revcalc.applyPartyMember(member);
  return false;
}

function partyPresetDefaultAbility(pokemonId) {
  const pokemon = PokemonById[pokemonId];
  const first = Object.values(pokemon?.ab || {})[0];
  return first ? toId(first) : '';
}

function partyPresetDefaultItem(pokemonId) {
  return defaultPokemonItemId(PokemonById[pokemonId]);
}

function partyPresetLookupByText(collection, byId, text) {
  const name = String(text || '').trim();
  const key = toId(name);
  if (key && Object.hasOwn(byId, key)) return byId[key];
  return name ? collection.find(entry => entry.koName === name || (key && toId(entry.name) === key)) || null : null;
}

function partyPresetPokemonFromShowdownName(text) {
  const name = String(text || '').trim().replace(/\s+\((?:M|F)\)$/i, '').trim();
  return partyPresetLookupByText(POKEMON, PokemonById, name) ||
    partyPresetLookupByText(POKEMON, PokemonById, name.match(/\(([^()]+)\)$/)?.[1]);
}

function partyPresetNatureFromText(text) {
  const key = toId(text);
  return (key && Object.hasOwn(NATURE_BY_ID, key) && NATURE_BY_ID[key]) || NATURES.find(n => n.ko === text) || null;
}

function partyPresetParseShowdownEvs(text, warn = () => {}) {
  const evs = blankPartyPresetMember().evs;
  for (const part of text.split('/')) {
    const match = part.trim().match(/^(\d+)\s+(.+)$/);
    const key = match && toId(match[2]);
    const stat = Object.hasOwn(PARTY_PRESET_SHOWDOWN_STAT_ALIAS, key) && PARTY_PRESET_SHOWDOWN_STAT_ALIAS[key];
    if (stat) evs[stat] = Number(match[1]);
    else warn(part.trim(), '포인트 해석 불가');
  }
  const bounded = normalizePartyPresetEvs(evs);
  for (const stat of STATS) {
    if (evs[stat] !== bounded[stat]) warn(stat.toUpperCase() + ' ' + evs[stat], bounded[stat] + '포인트로 조정');
  }
  return bounded;
}

function partyPresetParseShowdownSet(block, warn = () => {}) {
  const lines = block.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (!lines.length) return null;
  const [pokemonText, itemText] = lines[0].split(/\s+@\s+/, 2);
  const pokemon = partyPresetPokemonFromShowdownName(pokemonText);
  if (!pokemon) { warn(pokemonText, '포켓몬 미인식'); return null; }
  const member = blankPartyPresetMember();
  member.pokemon = pokemon.id;
  member.ability = partyPresetDefaultAbility(pokemon.id);
  member.item = partyPresetDefaultItem(pokemon.id);
  if (itemText) {
    const item = partyPresetLookupByText(ITEMS, ItemById, itemText);
    if (item) member.item = item.id;
    else warn(itemText, '도구 미인식');
  }
  let moveCount = 0;
  for (const line of lines.slice(1)) {
    if (/^Ability:/i.test(line)) {
      const ability = partyPresetLookupByText(ABILITIES, AbilityById, line.slice(8));
      if (ability) member.ability = ability.id;
      else warn(line, '특성 미인식');
    } else if (/^EVs:/i.test(line)) {
      member.evs = partyPresetParseShowdownEvs(line.slice(4), warn);
    } else if (/\sNature$/i.test(line)) {
      const nature = partyPresetNatureFromText(line.replace(/\s+Nature$/i, ''));
      if (nature) member.nature = nature.id;
      else warn(line, '성격 미인식');
    } else if (line.startsWith('-')) {
      const move = partyPresetLookupByText(MOVES, MoveById, line.slice(1));
      if (moveCount >= 4) warn(line, '기술 4칸 초과');
      else if (move) member.moves[moveCount] = move.id;
      else warn(line, '기술 미인식');
      moveCount++;
    } else warn(line, '샘플 저장 대상에서 제외');
  }
  return normalizePartyPresetMember(member);
}

function partyPresetParseShowdownParty(text, warnings = []) {
  const members = [];
  const blocks = String(text || '').split(/\n\s*\n/).map(block => block.trim()).filter(Boolean);
  blocks.forEach((block, index) => {
    const warn = (value, reason) => warnings.push((index + 1) + '번째 포켓몬 · ' + value + ' — ' + reason);
    if (members.length >= PARTY_PRESET_MAX_MEMBERS) { warn(block.split(/\r?\n/)[0], '6슬롯 초과'); return; }
    const member = partyPresetParseShowdownSet(block, warn);
    if (member) members.push(member);
  });
  return members;
}

function partyPresetNatureShowdownName(natureId) {
  const nature = NATURE_BY_ID[natureId];
  const raw = nature?.name || nature?.id || 'hardy';
  return String(raw).charAt(0).toUpperCase() + String(raw).slice(1);
}

function partyPresetExportShowdownSet(member) {
  const pokemon = PokemonById[member?.pokemon];
  if (!pokemon) return '';

  const item = member.item ? ItemById[member.item] : null;
  const ability = member.ability ? AbilityById[member.ability] : null;
  const lines = [`${pokemon.name}${item ? ` @ ${item.name}` : ''}`];
  if (ability) lines.push(`Ability: ${ability.name}`);

  const evParts = STATS
    .filter(stat => Number(member.evs?.[stat] || 0) > 0)
    .map(stat => `${member.evs[stat]} ${PARTY_PRESET_SHOWDOWN_STAT_LABEL[stat]}`);
  if (evParts.length) lines.push(`EVs: ${evParts.join(' / ')}`);

  lines.push(`${partyPresetNatureShowdownName(member.nature)} Nature`);
  (member.moves || []).slice(0, 4).forEach(moveId => {
    const move = MoveById[moveId];
    if (move) lines.push(`- ${move.name}`);
  });
  return lines.join('\n');
}

function partyPresetExportShowdownParty(partyIndex) {
  const party = partyPresetData.parties?.[partyIndex];
  if (!party) return '';
  return party.members
    .map(partyPresetExportShowdownSet)
    .filter(Boolean)
    .join('\n\n');
}

async function importPartyPresetShowdownText(partyIndex, text) {
  return runPartyPresetImport(() => {
    const warnings = [];
    const members = partyPresetParseShowdownParty(text, warnings);
    if (!members.length) throw new Error(['Showdown 텍스트에서 포켓몬을 찾지 못했습니다.', ...warnings].join('\n'));
    if (!Number.isInteger(partyIndex) || !partyPresetData.parties[partyIndex]) throw new Error('대상 파티를 확인해 주세요.');
    const data = normalizePartyPresetData(partyPresetData);
    data.parties[partyIndex].members = Array.from({ length: PARTY_PRESET_MAX_MEMBERS }, (_, index) => (
      members[index] || blankPartyPresetMember()
    ));
    const details = warnings.length ? '\n' + warnings.join('\n') + '\n' : '';
    return { data, partyIndex, warnings, summary: details + `파티 ${partyIndex + 1}의 포켓몬 목록을 ${members.length}마리로 교체합니다. 다른 파티는 유지됩니다.`, success: `파티 ${partyIndex + 1} Showdown 텍스트 가져오기 및 저장 완료` };
  });
}

export { saveCalcMemberToParty, partyPresetMemberMoves, partyPresetAttackingMoves, partyPresetApplyMemberToSideState, partyPresetApplyMemberToCalc, partyPresetApplyPartyToMatchup, partyPresetApplyPickerMember, partyPresetDefaultAbility, partyPresetDefaultItem, partyPresetLookupByText, partyPresetPokemonFromShowdownName, partyPresetNatureFromText, partyPresetParseShowdownEvs, partyPresetParseShowdownSet, partyPresetParseShowdownParty, partyPresetNatureShowdownName, partyPresetExportShowdownSet, partyPresetExportShowdownParty, importPartyPresetShowdownText };
