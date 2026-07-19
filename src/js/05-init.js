/* ════════════════════════════════════════════════════════════
 * 05-init.js — 페이지 로드 시 초기 렌더 호출
 * (build.mjs 가 src/js/*.js 를 알파벳순 concat 후 calc-template.html 에 주입)
 * ════════════════════════════════════════════════════════════ */
const initializedMainPages = new Set();

function ensureMainPageInitialized(pageKey) {
  if (initializedMainPages.has(pageKey)) return;
  const initializers = {
    calc() {
      initCalcDetailToggles();
      renderSide('atk');
      renderSide('def');
      triggerCalc();
    },
    revcalc() {
      renderRevCalcAll();
    },
    finetune() {
      renderFineTuneAll();
    },
    matchup() {
      renderMatchupModeTabs();
      renderMatchupSlots();
      renderMatchupCoverageInputs();
      renderMatchupTable();
    },
    dex() {
      renderTypeFilter();
      renderDexContent('');
    },
  };
  const initialize = initializers[pageKey];
  if (!initialize) return;
  try {
    initialize();
    initializedMainPages.add(pageKey);
  } catch (error) {
    initializedMainPages.delete(pageKey);
    console.error(`[page-init:${pageKey}]`, error);
    const page = document.getElementById(`page-${pageKey}`);
    if (page && !page.querySelector('.page-init-error')) {
      const alert = document.createElement('div');
      alert.className = 'page-init-error ui-control-frame ui-subframe';
      alert.setAttribute('role', 'alert');
      alert.textContent = '화면을 불러오지 못했습니다. 메뉴를 다시 선택해 재시도해 주세요.';
      page.prepend(alert);
    }
  }
}

initThemeToggle();
initPartyPresets();
bindMainNavigation();
