import * as m0 from '../js/04-10-dex.js';
import * as m1 from '../js/04-11-dex-detail.js';

export const api = { get renderDexContent() { return m0.renderDexContent; }, get renderTypeFilter() { return m0.renderTypeFilter; } };
export function initialize() {
  m0.bind0410Dex();
  m1.bind0411DexDetail();
}
