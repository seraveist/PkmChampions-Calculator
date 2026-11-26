import { partyPresetAttackingMoves } from '../js/04-02-party-presets-integration.js';
import { bind0420Matchup, matchupCoverageMoves, matchupSetSlotPokemon, matchupSlots,
  renderMatchupCoverageInputs, renderMatchupModeTabs, renderMatchupSlots, renderMatchupTable } from '../js/04-20-matchup.js';

function applyParty(members) {
  members.forEach((member, slot) => {
    matchupSetSlotPokemon(slot, member.pokemon, { abilityId: member.ability, itemId: member.item });
    matchupCoverageMoves[slot] = matchupSlots[slot] ? partyPresetAttackingMoves(member) : [null, null, null, null];
  });
  renderMatchupSlots();
  renderMatchupCoverageInputs();
  renderMatchupTable();
}

export const api = { applyParty, renderMatchupCoverageInputs, renderMatchupModeTabs, renderMatchupSlots, renderMatchupTable };
export const initialize = bind0420Matchup;
