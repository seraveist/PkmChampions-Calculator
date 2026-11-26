import { featureApis } from '../runtime/features.js';
import { mountRotomIcons } from './01-10-rotom-ui.js';
import { bindMainNavigation } from './01-20-html-structure.js';
import { initThemeToggle } from './01-30-theme.js';
import { renderSide } from './03-30-calc-side-render.js';
import { triggerCalc } from './03-50-calc-results.js';
import { initPartyPresets } from './04-03-party-presets-ui.js';

/* ════════════════════════════════════════════════════════════
 * 05-init.js — 페이지 로드 시 초기 렌더 호출
 * ES module; build entrypoints own composition and initialization.
 * ════════════════════════════════════════════════════════════ */
const initializedMainPages = new Set();

function ensureMainPageInitialized(pageKey, { refresh = false } = {}) {
  if (!refresh && initializedMainPages.has(pageKey)) return;
  const initializers = {
    calc() {
      renderSide('atk');
      renderSide('def');
      triggerCalc();
    },
    revcalc() {
      featureApis.revcalc.renderRevCalcAll();
    },
    finetune() {
      featureApis.finetune.renderFineTuneAll();
    },
    matchup() {
      featureApis.matchup.renderMatchupModeTabs();
      featureApis.matchup.renderMatchupSlots();
      featureApis.matchup.renderMatchupCoverageInputs();
      featureApis.matchup.renderMatchupTable();
    },
    dex() {
      featureApis.dex.renderTypeFilter();
      featureApis.dex.renderDexContent('');
    },
  };
  const initialize = initializers[pageKey];
  if (!initialize) return;
  initializedMainPages.delete(pageKey);
  initialize();
  initializedMainPages.add(pageKey);
}

let bind05InitBound = false;
function bind05Init() {
  if (bind05InitBound) return;
  bind05InitBound = true;
  mountRotomIcons();
  initThemeToggle();
  initPartyPresets();
  bindMainNavigation(ensureMainPageInitialized);
}

export { initializedMainPages, ensureMainPageInitialized, bind05InitBound, bind05Init };
