import * as m0 from '../js/04-20-matchup.js';

export const api = { get matchupCoverageMoves() { return m0.matchupCoverageMoves; }, get matchupSetSlotPokemon() { return m0.matchupSetSlotPokemon; }, get matchupSlots() { return m0.matchupSlots; }, get renderMatchupCoverageInputs() { return m0.renderMatchupCoverageInputs; }, get renderMatchupModeTabs() { return m0.renderMatchupModeTabs; }, get renderMatchupSlots() { return m0.renderMatchupSlots; }, get renderMatchupTable() { return m0.renderMatchupTable; } };
export function initialize() {
  m0.bind0420Matchup();
}
