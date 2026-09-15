import { featureApis } from '../runtime/features.js';
import { ABILITIES, AbilityById, ITEMS, ItemById, MOVES, MoveById, NATURES, NATURE_BY_ID, POKEMON, PokemonById, STATS, toId } from './01-core.js';
import { applyPokemonToCalcSide, defaultPokemonAbilityId, defaultPokemonItemId, defaultPokemonTypes, makeSideState, setSideDamageBlockActive, state } from './03-10-calc-state.js';
import { renderSide } from './03-30-calc-side-render.js';
import { applyEntryFieldsFromSide, syncFieldControls } from './03-40-calc-entry-effects.js';
import { triggerCalc } from './03-50-calc-results.js';
import { PARTY_PRESET_MAX_MEMBERS, PARTY_PRESET_SHOWDOWN_STAT_ALIAS, PARTY_PRESET_SHOWDOWN_STAT_LABEL, blankPartyPresetMember, normalizePartyPresetData, normalizePartyPresetMember, partyPresetData, partyPresetMemberClone, runPartyPresetImport, savePartyPresetData, setPartyPresetData, setPartyPresetStatus } from './04-00-party-presets-state.js';
import { renderPartyPresetModal } from './04-03-party-presets-ui.js';

/* Party presets: tool integration and Showdown format. */
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
  side.pokemonIdx = data.pokemon;
  side.ability = data.ability || defaultPokemonAbilityId(pokemon);
  side.item = data.item || '';
  side.nature = data.nature || 'hardy';
  side.evs = { ...side.evs, ...data.evs };
  side.types = defaultPokemonTypes(pokemon);
  side.teraType = side.types?.[0] || 'Normal';
  side.tera = false;
  side.moves = partyPresetMemberMoves(data);
  side.moveBpOverrides = [null, null, null, null];
  side.moveTypeOverrides = [null, null, null, null];
  side.moveCriticalOverrides = [false, false, false, false];
  setSideDamageBlockActive?.(side, false);
  return true;
}

function partyPresetApplyMemberToCalc(sideKey, member) {
  const side = state?.[sideKey];
  const pokemonId = member?.pokemon;
  if (!side || !PokemonById[pokemonId]) return false;
  const result = applyPokemonToCalcSide(sideKey, pokemonId, {
    forceDefaults: true,
    resetMoves: false,
    deferEntryEffects: true,
  });
  partyPresetApplyMemberToSideState(side, member);
  result.resetAutoFields = applyEntryFieldsFromSide(sideKey) || result.resetAutoFields;
  renderSide(sideKey);
  if (result?.resetAutoFields) syncFieldControls?.();
  triggerCalc?.();
  return true;
}

function partyPresetApplyMemberToFineTune(member) {
  if (!member?.pokemon || !PokemonById[member.pokemon]) return false;
  featureApis.finetune.fineTuneState.my = makeSideState();
  featureApis.finetune.ftApplyPokemonToFineTune(member.pokemon);
  partyPresetApplyMemberToSideState(featureApis.finetune.fineTuneState.my, member);
  featureApis.finetune.renderFineTuneAll();
  return true;
}

function partyPresetApplyMemberToRevCalc(member) {
  if (!member?.pokemon || !PokemonById[member.pokemon]) return false;
  featureApis.revcalc.rcApplyMyPokemonSelection(member.pokemon);
  partyPresetApplyMemberToSideState(featureApis.revcalc.revCalcState.my, member);
  featureApis.revcalc.revCalcState.myMoveSet = partyPresetMemberMoves(member);
  featureApis.revcalc.revCalcState.myMove = featureApis.revcalc.revCalcState.myMoveSet.includes(featureApis.revcalc.revCalcState.myMove) ? featureApis.revcalc.revCalcState.myMove : '';
  featureApis.revcalc.revCalcState.myMoveBp = '';
  featureApis.revcalc.renderRevCalcAll();
  return true;
}

function partyPresetApplyPartyToMatchup(partyIndex) {
  const party = partyPresetData.parties?.[partyIndex];
  if (!party) return false;
  Array.from({ length: PARTY_PRESET_MAX_MEMBERS }).forEach((_, slotIndex) => {
    const member = partyPresetMemberClone(party.members?.[slotIndex]);
    featureApis.matchup.matchupSetSlotPokemon(slotIndex, member.pokemon, {
      abilityId: member.ability,
      itemId: member.item,
    });
    featureApis.matchup.matchupCoverageMoves[slotIndex] = featureApis.matchup.matchupSlots[slotIndex]
      ? partyPresetAttackingMoves(member)
      : [null, null, null, null];
  });
  featureApis.matchup.renderMatchupSlots();
  featureApis.matchup.renderMatchupCoverageInputs();
  featureApis.matchup.renderMatchupTable();
  return true;
}

function partyPresetApplyPickerMember(target, member) {
  if (target === 'calc:atk') return partyPresetApplyMemberToCalc('atk', member);
  if (target === 'calc:def') return partyPresetApplyMemberToCalc('def', member);
  if (target === 'finetune:my') return partyPresetApplyMemberToFineTune(member);
  if (target === 'revcalc:my') return partyPresetApplyMemberToRevCalc(member);
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
  const key = toId(text);
  if (!key) return null;
  if (byId[key]) return byId[key];
  return collection.find(entry => (
    toId(entry?.id) === key ||
    toId(entry?.name) === key ||
    toId(entry?.koName) === key
  )) || null;
}

function partyPresetPokemonFromShowdownName(text) {
  let name = String(text || '').trim();
  name = name.replace(/\s+\((?:M|F)\)$/i, '').trim();
  const nicknameMatch = name.match(/\(([^()]+)\)\s*$/);
  if (nicknameMatch && !/^(?:M|F)$/i.test(nicknameMatch[1])) {
    name = nicknameMatch[1].trim();
  }
  return partyPresetLookupByText(POKEMON, PokemonById, name);
}

function partyPresetNatureFromText(text) {
  const key = toId(text);
  if (!key) return null;
  return NATURE_BY_ID[key] || NATURES.find(nature => (
    toId(nature?.id) === key ||
    toId(nature?.name) === key ||
    toId(nature?.ko) === key
  )) || null;
}

function partyPresetParseShowdownEvs(text) {
  const evs = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  String(text || '').split('/').forEach(part => {
    const match = part.trim().match(/^(\d+)\s+(.+)$/);
    if (!match) return;
    const value = Math.max(0, Math.min(32, parseInt(match[1], 10) || 0));
    const stat = PARTY_PRESET_SHOWDOWN_STAT_ALIAS[toId(match[2])];
    if (stat) evs[stat] = value;
  });
  return evs;
}

function partyPresetParseShowdownSet(block) {
  const lines = String(block || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (!lines.length) return null;

  const member = blankPartyPresetMember();
  const firstLine = lines[0];
  const [pokemonText, itemText = ''] = firstLine.split(/\s+@\s+/, 2);
  const pokemon = partyPresetPokemonFromShowdownName(pokemonText);
  if (!pokemon) return null;

  member.pokemon = pokemon.id;
  member.ability = partyPresetDefaultAbility(pokemon.id);
  member.item = partyPresetDefaultItem(pokemon.id);

  const item = partyPresetLookupByText(ITEMS, ItemById, itemText);
  if (item) member.item = item.id;

  const moves = [];
  lines.slice(1).forEach(line => {
    const abilityMatch = line.match(/^Ability:\s*(.+)$/i);
    if (abilityMatch) {
      const ability = partyPresetLookupByText(ABILITIES, AbilityById, abilityMatch[1]);
      if (ability) member.ability = ability.id;
      return;
    }

    const evMatch = line.match(/^EVs:\s*(.+)$/i);
    if (evMatch) {
      member.evs = partyPresetParseShowdownEvs(evMatch[1]);
      return;
    }

    const natureMatch = line.match(/^(.+?)\s+Nature$/i);
    if (natureMatch) {
      const nature = partyPresetNatureFromText(natureMatch[1]);
      if (nature) member.nature = nature.id;
      return;
    }

    const moveMatch = line.match(/^-\s*(.+)$/);
    if (moveMatch && moves.length < 4) {
      const move = partyPresetLookupByText(MOVES, MoveById, moveMatch[1]);
      moves.push(move?.id || '');
    }
  });

  member.moves = Array.from({ length: 4 }, (_, index) => moves[index] || '');
  return normalizePartyPresetMember(member);
}

function partyPresetParseShowdownParty(text) {
  const blocks = String(text || '').split(/\n\s*\n/).map(block => block.trim()).filter(Boolean);
  return blocks
    .map(partyPresetParseShowdownSet)
    .filter(Boolean)
    .slice(0, PARTY_PRESET_MAX_MEMBERS);
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
    const members = partyPresetParseShowdownParty(text);
    if (!members.length) throw new Error('Showdown 텍스트에서 포켓몬을 찾지 못했습니다.');
    if (!Number.isInteger(partyIndex) || !partyPresetData.parties[partyIndex]) throw new Error('대상 파티를 확인해 주세요.');
    const data = normalizePartyPresetData(partyPresetData);
    data.parties[partyIndex].members = Array.from({ length: PARTY_PRESET_MAX_MEMBERS }, (_, index) => (
      members[index] || blankPartyPresetMember()
    ));
    return { data, summary: `파티 ${partyIndex + 1}의 포켓몬 목록을 ${members.length}마리로 교체합니다. 다른 파티는 유지됩니다.`, success: `파티 ${partyIndex + 1} Showdown 텍스트 가져오기 및 저장 완료` };
  });
}

export { partyPresetMemberMoves, partyPresetAttackingMoves, partyPresetApplyMemberToSideState, partyPresetApplyMemberToCalc, partyPresetApplyMemberToFineTune, partyPresetApplyMemberToRevCalc, partyPresetApplyPartyToMatchup, partyPresetApplyPickerMember, partyPresetDefaultAbility, partyPresetDefaultItem, partyPresetLookupByText, partyPresetPokemonFromShowdownName, partyPresetNatureFromText, partyPresetParseShowdownEvs, partyPresetParseShowdownSet, partyPresetParseShowdownParty, partyPresetNatureShowdownName, partyPresetExportShowdownSet, partyPresetExportShowdownParty, importPartyPresetShowdownText };
