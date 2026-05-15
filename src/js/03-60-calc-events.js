/* Damage calculator field controls and page-level events. */
document.getElementById('field-head').addEventListener('click', () => {
  document.getElementById('field-panel').classList.toggle('collapsed');
});

// 계산 버튼
document.getElementById('btnCalculate').addEventListener('click', () => {
  runCalc();
});

// 자동/수동 토글
document.getElementById('btnAutoCalc').addEventListener('click', e => {
  autoCalcMode = !autoCalcMode;
  e.target.textContent = `자동 계산: ${autoCalcMode ? 'ON' : 'OFF'}`;
  e.target.classList.toggle('active', autoCalcMode);
  if (autoCalcMode) runCalc();
});
// 초기 활성 표시
document.getElementById('btnAutoCalc').classList.add('active');
document.getElementById('btnResetManual').addEventListener('click', resetCalcManualValues);

/* ════════════════════════════════════════════════════════════
   필드 이벤트
   ════════════════════════════════════════════════════════════ */
function wireFieldComboboxes() {
  if (typeof document.querySelectorAll !== 'function') return;
  document.querySelectorAll('#field-panel .cb-input').forEach(input => {
    const cbType = input.dataset.cbType;
    const field = input.dataset.field;
    wireCalcCombobox(input, {
      filterFn: makeCombobox(null, cbType),
      onSelect(id) {
        if (field === 'weather') {
          markManualAutoFieldOverride('weather');
          state.field.weather = id || 'none';
          setComboboxValue('weather', state.field.weather, 'weather');
        } else if (field === 'terrain') {
          markManualAutoFieldOverride('terrain');
          state.field.terrain = id || 'none';
          setComboboxValue('terrain', state.field.terrain, 'terrain');
        } else if (field === 'gameType') {
          state.field.gameType = id || 'Singles';
          setComboboxValue('gameType', state.field.gameType, 'gameType');
          state.atk.fallenAllies = clampFallenAllies(state.atk.fallenAllies);
          renderSide('atk');
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

wireFieldComboboxes();
document.getElementById('critHit').addEventListener('change', e => { state.field.isCritical = e.target.checked; triggerCalc(); });
document.getElementById('defReflect').addEventListener('change', e => { state.field.defReflect = e.target.checked; triggerCalc(); });
document.getElementById('defLightScreen').addEventListener('change', e => { state.field.defLightScreen = e.target.checked; triggerCalc(); });
document.getElementById('atkHelpingHand').addEventListener('change', e => { state.field.atkHelpingHand = e.target.checked; triggerCalc(); });
document.getElementById('defProtect').addEventListener('change', e => { state.field.defProtect = e.target.checked; triggerCalc(); });
// 재앙 토글
document.getElementById('ruinSword').addEventListener('change', e => { markManualAutoFieldOverride('ruinSword'); state.field.ruinSword = e.target.checked; triggerCalc(); });
document.getElementById('ruinTablet').addEventListener('change', e => { markManualAutoFieldOverride('ruinTablet'); state.field.ruinTablet = e.target.checked; triggerCalc(); });
document.getElementById('ruinBeads').addEventListener('change', e => { markManualAutoFieldOverride('ruinBeads'); state.field.ruinBeads = e.target.checked; triggerCalc(); });
document.getElementById('ruinVessel').addEventListener('change', e => { markManualAutoFieldOverride('ruinVessel'); state.field.ruinVessel = e.target.checked; triggerCalc(); });
// 진입 위험 (스텔스록 / 압정뿌리기)
document.getElementById('defStealthRock').addEventListener('change', e => { state.field.defStealthRock = e.target.checked; triggerCalc(); });
document.getElementById('defSpikes').addEventListener('change', e => {
  const layerInput = document.getElementById('defSpikesLayers');
  const layers = parseInt(layerInput?.dataset.value || layerInput?.value, 10) || 1;
  state.field.defSpikesLayers = e.target.checked ? layers : 0;
  triggerCalc();
});
// 트릭룸 / 중력장
document.getElementById('trickRoom').addEventListener('change', e => { state.field.isTrickRoom = e.target.checked; triggerCalc(); });
document.getElementById('gravity').addEventListener('change', e => { state.field.isGravity = e.target.checked; triggerCalc(); });
// 자동 진입 효과 토글
document.getElementById('autoEntry').addEventListener('change', e => {
  autoEntryEffects = e.target.checked;
  lastAutoEntry = emptyEntryMeta();
  triggerCalc();
});

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
document.addEventListener('click', e => {
  const ftBtn = e.target.closest('.ft-jump-btn[data-ft-from-side]');
  if (ftBtn && typeof loadSideToFineTune === 'function') {
    loadSideToFineTune(ftBtn.dataset.ftFromSide);
    return;
  }
  const rcBtn = e.target.closest('.ft-jump-btn[data-rc-from-side]');
  if (rcBtn && typeof loadSideToRevCalc === 'function') {
    loadSideToRevCalc(rcBtn.dataset.rcFromSide);
    return;
  }
});

document.getElementById('btnSwapSides')?.addEventListener('click', () => {
  const tmp = state.atk;
  state.atk = state.def;
  state.def = tmp;
  lastAutoEntry = emptyEntryMeta();
  renderSide('atk');
  renderSide('def');
  triggerCalc();
});
/* ════════════════════════════════════════════════════════════
   ⬆️ 원본 로직 끝 ⬆️
   ════════════════════════════════════════════════════════════ */
