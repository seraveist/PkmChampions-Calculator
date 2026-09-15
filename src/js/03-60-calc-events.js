import { featureApis } from '../runtime/features.js';
import { activateMainPage } from './01-20-html-structure.js';
import { clampFallenAllies, resetCalcManualValues, setComboboxValue, state } from './03-10-calc-state.js';
import { makeCombobox } from './03-20-calc-combobox.js';
import { wireCalcCombobox } from './03-22-calc-combobox-events.js';
import { renderSide } from './03-30-calc-side-render.js';
import { powerUiRenderField } from './03-33-calc-ui-events.js';
import { emptyEntryMeta, markManualAutoFieldOverride, setAutoEntryEffectsEnabled, setLastAutoEntry, setManualCalcField, swapAutoEntryFieldOwners, syncFieldControls } from './03-40-calc-entry-effects.js';
import { runCalc, triggerCalc } from './03-50-calc-results.js';

/* Damage calculator field controls and page-level events. */





/* ════════════════════════════════════════════════════════════
   필드 이벤트
   ════════════════════════════════════════════════════════════ */
function wireFieldComboboxes() {
  if (typeof document.querySelectorAll !== 'function') return;
  document.querySelectorAll('#calc-field-panel .cb-input').forEach(input => {
    const cbType = input.dataset.cbType;
    const field = input.dataset.field;
    wireCalcCombobox(input, {
      filterFn: makeCombobox(null, cbType),
      onSelect(id) {
        if (field === 'weather') {
          setManualCalcField('weather', id || 'none');
          setComboboxValue('weather', state.field.weather, 'weather');
        } else if (field === 'terrain') {
          setManualCalcField('terrain', id || 'none');
          setComboboxValue('terrain', state.field.terrain, 'terrain');
        } else if (field === 'gameType') {
          state.field.gameType = id || 'Singles';
          setComboboxValue('gameType', state.field.gameType, 'gameType');
          for (const side of [state.atk, state.def]) side.fallenAllies = clampFallenAllies(side.fallenAllies);
          renderSide('atk');
          renderSide('def');
        } else if (field === 'defSpikesLayers') {
          const layers = Math.max(1, Math.min(3, parseInt(id, 10) || 1));
          setComboboxValue('defSpikesLayers', String(layers), 'spikesLayers');
          if (document.getElementById('defSpikes')?.checked) {
            state.field.defSpikesLayers = layers;
          }
        }
        triggerCalc();
      },
    });
  });
}





function syncSpikesLayerControl(enabled = false) {
  const input = document.getElementById('defSpikesLayers');
  const options = input?.closest('.combobox')?.querySelector('.combobox-options');
  if (!input) return;
  input.disabled = !enabled;
  if (!enabled) {
    input.setAttribute('aria-expanded', 'false');
    options?.classList.remove('open');
  }
}




// 재앙 토글




// 진입 위험 (스텔스록 / 압정뿌리기)


// 중력장

// 자동 진입 효과 토글



// 재앙 체크박스 동기화 (자동 진입 효과로 변경됐을 때)
function updateRuinCheckboxes(fieldState = null) {
  const f = fieldState || state.field;
  document.getElementById('ruinSword').checked = f.ruinSword;
  document.getElementById('ruinTablet').checked = f.ruinTablet;
  document.getElementById('ruinBeads').checked = f.ruinBeads;
  document.getElementById('ruinVessel').checked = f.ruinVessel;
}
// 공격측 ↔ 방어측 교대 (사이드 객체 전체를 통째로 교환)
// 사이드 패널 점프 버튼 위임 — fine-tune/reverse view modules의 sync 함수 호출


function swapCalcSides() {
  const tmp = state.atk;
  state.atk = state.def;
  state.def = tmp;
  swapAutoEntryFieldOwners();
  document.getElementById('page-calc')?.classList.toggle('sides-swapped');
  setLastAutoEntry(emptyEntryMeta());
  renderSide('atk');
  renderSide('def');
  triggerCalc();
}



/* ════════════════════════════════════════════════════════════
   ⬆️ 원본 로직 끝 ⬆️
   ════════════════════════════════════════════════════════════ */

let bind0360CalcEventsBound = false;
function bind0360CalcEvents() {
  if (bind0360CalcEventsBound) return;
  bind0360CalcEventsBound = true;
  powerUiRenderField();
  document.getElementById('btnCalculate')?.addEventListener('click', runCalc);
  document.getElementById('btnResetManual')?.addEventListener('click', resetCalcManualValues);
  wireFieldComboboxes();
  document.querySelectorAll('[data-power-field]').forEach(input => {
    input.addEventListener('change', () => {
      state.field[input.dataset.powerField] = input.checked;
      triggerCalc();
    });
  });
  document.querySelectorAll('[data-power-choice]').forEach(input => {
    input.addEventListener('change', () => {
      state.field[input.dataset.powerChoice] = input.value;
      triggerCalc();
    });
  });
  document.getElementById('defReflect').addEventListener('change', e => { state.field.defReflect = e.target.checked; triggerCalc(); });
  document.getElementById('defLightScreen').addEventListener('change', e => { state.field.defLightScreen = e.target.checked; triggerCalc(); });
  document.getElementById('atkHelpingHand').addEventListener('change', e => { state.field.atkHelpingHand = e.target.checked; triggerCalc(); });
  document.getElementById('ruinSword').addEventListener('change', e => { markManualAutoFieldOverride('ruinSword'); state.field.ruinSword = e.target.checked; triggerCalc(); });
  document.getElementById('ruinTablet').addEventListener('change', e => { markManualAutoFieldOverride('ruinTablet'); state.field.ruinTablet = e.target.checked; triggerCalc(); });
  document.getElementById('ruinBeads').addEventListener('change', e => { markManualAutoFieldOverride('ruinBeads'); state.field.ruinBeads = e.target.checked; triggerCalc(); });
  document.getElementById('ruinVessel').addEventListener('change', e => { markManualAutoFieldOverride('ruinVessel'); state.field.ruinVessel = e.target.checked; triggerCalc(); });
  document.getElementById('defStealthRock')?.addEventListener('change', e => { state.field.defStealthRock = e.target.checked; triggerCalc(); });
  document.getElementById('defSpikes')?.addEventListener('change', e => {
    const layerInput = document.getElementById('defSpikesLayers');
    const layers = parseInt(layerInput?.dataset.value || layerInput?.value, 10) || 1;
    syncSpikesLayerControl(e.target.checked);
    state.field.defSpikesLayers = e.target.checked ? layers : 0;
    triggerCalc();
  });
  document.getElementById('gravity').addEventListener('change', e => { state.field.isGravity = e.target.checked; triggerCalc(); });
  document.getElementById('autoEntry').addEventListener('change', e => {
    setAutoEntryEffectsEnabled(e.target.checked);
    syncFieldControls(state.field);
    triggerCalc();
  });
  syncSpikesLayerControl(document.getElementById('defSpikes')?.checked);
  document.addEventListener('click', async e => {
    const ftBtn = e.target.closest('.calc-page-jump-button[data-ft-from-side]');
    if (ftBtn) {
      if (await activateMainPage('finetune', { updateHash:true })) featureApis.finetune.loadSideToFineTune(ftBtn.dataset.ftFromSide);
      return;
    }
    const rcBtn = e.target.closest('.calc-page-jump-button[data-rc-from-side]');
    if (rcBtn) {
      if (await activateMainPage('revcalc', { updateHash:true })) featureApis.revcalc.loadSideToRevCalc(rcBtn.dataset.rcFromSide);
      return;
    }
  });
  document.getElementById('btnSwapSides')?.addEventListener('click', swapCalcSides);
  document.getElementById('btnSwapSidesResult')?.addEventListener('click', swapCalcSides);
}

export { wireFieldComboboxes, syncSpikesLayerControl, updateRuinCheckboxes, swapCalcSides, bind0360CalcEventsBound, bind0360CalcEvents };
