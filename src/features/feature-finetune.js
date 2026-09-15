import * as m0 from '../js/04-30-finetune.js';
import * as m1 from '../js/04-31-finetune-render.js';
import * as m2 from '../js/04-32-finetune-planner.js';

export const api = { get fineTuneState() { return m0.fineTuneState; }, get ftApplyPokemonToFineTune() { return m0.ftApplyPokemonToFineTune; }, get loadSideToFineTune() { return m1.loadSideToFineTune; }, get renderFineTuneAll() { return m1.renderFineTuneAll; } };
export function initialize() {
  m1.bind0431FinetuneRender();
}
