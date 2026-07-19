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
  ftApplyPokemonToFineTune(member.pokemon);
  partyPresetApplyMemberToSideState(fineTuneState.my, member);
  fineTuneState.weatherAbilityActive = false;
  renderFineTuneAll();
  return true;
}

function partyPresetApplyMemberToRevCalc(member) {
  if (!member?.pokemon || !PokemonById[member.pokemon]) return false;
  rcApplyMyPokemonSelection(member.pokemon);
  partyPresetApplyMemberToSideState(revCalcState.my, member);
  revCalcState.myMoveSet = partyPresetMemberMoves(member);
  revCalcState.myMove = revCalcState.myMoveSet.includes(revCalcState.myMove) ? revCalcState.myMove : '';
  revCalcState.myMoveBp = '';
  renderRevCalcAll();
  return true;
}

function partyPresetApplyPartyToMatchup(partyIndex) {
  const party = partyPresetData.parties?.[partyIndex];
  if (!party) return false;
  Array.from({ length: PARTY_PRESET_MAX_MEMBERS }).forEach((_, slotIndex) => {
    const member = partyPresetMemberClone(party.members?.[slotIndex]);
    matchupSlots[slotIndex] = member.pokemon && PokemonById[member.pokemon] ? member.pokemon : null;
    matchupCoverageMoves[slotIndex] = matchupSlots[slotIndex]
      ? partyPresetAttackingMoves(member)
      : [null, null, null, null];
  });
  renderMatchupSlots();
  renderMatchupCoverageInputs();
  renderMatchupTable();
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

function importPartyPresetShowdownText(partyIndex, text) {
  const members = partyPresetParseShowdownParty(text);
  if (!members.length) {
    setPartyPresetStatus('Showdown 텍스트에서 포켓몬을 찾지 못했습니다', 'error');
    return false;
  }
  const party = partyPresetData.parties?.[partyIndex];
  if (!party) return false;
  party.members = Array.from({ length: PARTY_PRESET_MAX_MEMBERS }, (_, index) => (
    members[index] || blankPartyPresetMember()
  ));
  partyPresetData = normalizePartyPresetData(partyPresetData);
  savePartyPresetData();
  renderPartyPresetModal();
  setPartyPresetStatus(`파티 ${partyIndex + 1} Showdown 텍스트 가져오기 완료`, 'success');
  return true;
}
