import * as m0 from '../js/04-40-revcalc-state.js';
import * as m1 from '../js/04-41-revcalc-scoring.js';
import * as m2 from '../js/04-42-revcalc-candidates.js';
import * as m3 from '../js/04-42-revcalc-exchange.js';
import * as m4 from '../js/04-42-revcalc-forecast.js';
import * as m5 from '../js/04-43-revcalc-render.js';
import * as m6 from '../js/04-44-revcalc-events.js';
import * as m7 from '../js/04-45-revcalc-actions.js';

export const api = { get loadSideToRevCalc() { return m7.loadSideToRevCalc; }, get rcApplyMyPokemonSelection() { return m6.rcApplyMyPokemonSelection; }, get renderRevCalcAll() { return m5.renderRevCalcAll; }, get revCalcState() { return m0.revCalcState; } };
export function initialize() {
  m7.bind0445RevcalcActions();
}
