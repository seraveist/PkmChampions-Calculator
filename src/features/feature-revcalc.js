import { PokemonById } from '../js/01-core.js';
import { partyPresetApplyMemberToSideState, partyPresetMemberMoves } from '../js/04-02-party-presets-integration.js';
import { revCalcState } from '../js/04-40-revcalc-state.js';
import { renderRevCalcAll } from '../js/04-43-revcalc-render.js';
import { rcApplyMyPokemonSelection } from '../js/04-44-revcalc-events.js';
import { bind0445RevcalcActions, loadSideToRevCalc } from '../js/04-45-revcalc-actions.js';

function applyPartyMember(member) {
  if (!PokemonById[member?.pokemon]) return false;
  rcApplyMyPokemonSelection(member.pokemon);
  partyPresetApplyMemberToSideState(revCalcState.my, member);
  revCalcState.myMoveSet = partyPresetMemberMoves(member);
  if (!revCalcState.myMoveSet.includes(revCalcState.myMove)) revCalcState.myMove = '';
  revCalcState.myMoveBp = '';
  renderRevCalcAll();
  return true;
}

export const api = { applyPartyMember, loadSideToRevCalc, renderRevCalcAll, revCalcState };
export const initialize = bind0445RevcalcActions;
