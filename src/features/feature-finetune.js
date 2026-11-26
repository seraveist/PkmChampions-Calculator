import { makeSideState } from '../js/03-10-calc-state.js';
import { partyPresetApplyMemberToSideState } from '../js/04-02-party-presets-integration.js';
import { fineTuneState, ftRefreshEntryFields } from '../js/04-30-finetune.js';
import { bind0431FinetuneRender, loadSideToFineTune, renderFineTuneAll } from '../js/04-31-finetune-render.js';

function applyPartyMember(member) {
  const side = makeSideState();
  if (!partyPresetApplyMemberToSideState(side, member)) return false;
  fineTuneState.my = side;
  ftRefreshEntryFields('my');
  renderFineTuneAll();
  return true;
}

export const api = { applyPartyMember, loadSideToFineTune, renderFineTuneAll };
export const initialize = bind0431FinetuneRender;
