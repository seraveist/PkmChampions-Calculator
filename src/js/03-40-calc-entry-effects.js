/* Damage calculator derived state and automatic entry effects. */
let lastAutoEntry = emptyEntryMeta();

const manualAutoFieldOverrides = {
  weather: null,
  terrain: null,
  ruinSword: null,
  ruinTablet: null,
  ruinBeads: null,
  ruinVessel: null,
};

function defaultAutoFieldValue(fieldKey) {
  return fieldKey === 'weather' || fieldKey === 'terrain' ? 'none' : false;
}

function emptyEntryMeta() {
  return {
    logs: [],
    fields: {},
    rankDeltas: { atk: {}, def: {} },
    blocked: [],
  };
}

function cloneSideForCalc(side) {
  return applyManualDamageBlockHpAdjustment(deriveHpFlags({
    ...side,
    evs: { ...side.evs },
    ranks: { ...side.ranks },
    types: Array.isArray(side.types) ? [...side.types] : [],
    moves: Array.isArray(side.moves) ? [...side.moves] : [],
    moveBpOverrides: Array.isArray(side.moveBpOverrides) ? [...side.moveBpOverrides] : [null, null, null, null],
  }));
}

function cloneFieldForCalc(field) {
  return { ...field };
}

function clampRank(value) {
  return Math.max(-6, Math.min(6, value));
}

function addRankDelta(meta, sideKey, stat, delta) {
  if (!delta) return;
  meta.rankDeltas[sideKey][stat] = (meta.rankDeltas[sideKey][stat] || 0) + delta;
}

function applyRankDelta(side, meta, sideKey, stat, delta) {
  const before = side.ranks[stat] || 0;
  const after = clampRank(before + delta);
  side.ranks[stat] = after;
  addRankDelta(meta, sideKey, stat, after - before);
  return after - before;
}

function sideEntryLabel(sideKey) {
  return sideKey === 'atk' ? '공격측' : '방어측';
}

function applyAutoField(calcState, meta, fieldKey, value, sideKey, label) {
  if (manualAutoFieldOverrides[fieldKey]) return false;
  if (calcState.field[fieldKey] === value) return false;
  calcState.field[fieldKey] = value;
  meta.fields[fieldKey] = { sideKey, value, label };
  meta.logs.push(`${sideEntryLabel(sideKey)} 진입: ${label}`);
  return true;
}

function applyEntryEffectsToCalcState(calcState) {
  const meta = emptyEntryMeta();
  if (!autoEntryEffects) return meta;

  for (const sideKey of ['atk', 'def']) {
    const side = calcState[sideKey];
    const otherKey = sideKey === 'atk' ? 'def' : 'atk';
    const other = calcState[otherKey];
    const effect = ENTRY_EFFECTS[side.ability];
    if (!effect) continue;

    if (effect.weather) applyAutoField(calcState, meta, 'weather', effect.weather, sideKey, effect.label);
    if (effect.terrain) applyAutoField(calcState, meta, 'terrain', effect.terrain, sideKey, effect.label);

    if (effect.selfBoost) {
      let changed = false;
      for (const [stat, n] of Object.entries(effect.selfBoost)) {
        changed = applyRankDelta(side, meta, sideKey, stat, n) !== 0 || changed;
      }
      if (changed) meta.logs.push(`${sideEntryLabel(sideKey)} 진입: ${effect.label}`);
    }

    if (effect.opponentBoost) {
      const otherAb = other.ability;
      if (effect.blockable && INTIMIDATE_BLOCKERS.includes(otherAb)) {
        const log = `${sideEntryLabel(sideKey)} 위협 무효 (${AbilityById[otherAb]?.koName || otherAb})`;
        meta.blocked.push(log);
        meta.logs.push(log);
      } else {
        let changed = false;
        for (const [stat, n] of Object.entries(effect.opponentBoost)) {
          changed = applyRankDelta(other, meta, otherKey, stat, n) !== 0 || changed;
        }
        if (changed) meta.logs.push(`${sideEntryLabel(sideKey)} 진입: ${effect.label}`);
      }
    }

    if (effect.download) {
      const otherStats = calcStats(other);
      const stat = otherStats.def < otherStats.spd ? 'atk' : 'spa';
      if (applyRankDelta(side, meta, sideKey, stat, 1) !== 0) {
        meta.logs.push(`${sideEntryLabel(sideKey)} 다운로드: 자기 ${STAT_LABEL[stat]} +1`);
      }
    }

    if (effect.ruin) {
      const RUIN_MAP = { spd: 'ruinBeads', atk: 'ruinTablet', def: 'ruinSword', spa: 'ruinVessel' };
      const fieldKey = RUIN_MAP[effect.ruin];
      if (fieldKey && !manualAutoFieldOverrides[fieldKey] && !calcState.field[fieldKey]) {
        calcState.field[fieldKey] = true;
        meta.fields[fieldKey] = { sideKey, value: true, label: effect.label };
        meta.logs.push(`${sideEntryLabel(sideKey)} 진입: ${effect.label}`);
      }
    }
  }

  return meta;
}

function makeCalcState() {
  const calcState = {
    atk: cloneSideForCalc(state.atk),
    def: cloneSideForCalc(state.def),
    field: cloneFieldForCalc(state.field),
  };
  calcState.atk.fallenAllies = clampFallenAllies(calcState.atk.fallenAllies, calcState.field.gameType);
  calcState.entryMeta = applyEntryEffectsToCalcState(calcState);
  return calcState;
}

function activeAutoFieldBase(fieldKey) {
  const prev = state.field[fieldKey] ?? defaultAutoFieldValue(fieldKey);
  if (lastAutoEntry.fields?.[fieldKey]) return { active: true, prev };
  return { active: false, prev };
}

function markManualAutoFieldOverride(fieldKey) {
  if (!(fieldKey in manualAutoFieldOverrides) || manualAutoFieldOverrides[fieldKey]) return;
  const auto = activeAutoFieldBase(fieldKey);
  if (auto.active) manualAutoFieldOverrides[fieldKey] = { prev: auto.prev };
}

function resetManualAutoFieldOverrides() {
  let changed = false;
  for (const fieldKey of Object.keys(manualAutoFieldOverrides)) {
    const override = manualAutoFieldOverrides[fieldKey];
    if (!override) continue;
    const nextValue = override.prev ?? defaultAutoFieldValue(fieldKey);
    if (state.field[fieldKey] !== nextValue) {
      state.field[fieldKey] = nextValue;
      changed = true;
    }
    manualAutoFieldOverrides[fieldKey] = null;
  }
  return changed;
}

function syncFieldControls(fieldState = null) {
  const f = fieldState || makeCalcState().field;
  const setChecked = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.checked = !!value;
  };
  setComboboxValue('weather', f.weather, 'weather');
  setComboboxValue('terrain', f.terrain, 'terrain');
  setComboboxValue('gameType', f.gameType || state.field.gameType, 'gameType');
  setChecked('critHit', f.isCritical);
  setChecked('defReflect', f.defReflect);
  setChecked('defLightScreen', f.defLightScreen);
  setChecked('atkHelpingHand', f.atkHelpingHand);
  setChecked('defProtect', f.defProtect);
  setChecked('defStealthRock', f.defStealthRock);
  setChecked('defSpikes', f.defSpikesLayers > 0);
  setComboboxValue('defSpikesLayers', String(Math.max(1, f.defSpikesLayers || 1)), 'spikesLayers');
  setChecked('trickRoom', f.isTrickRoom);
  setChecked('gravity', f.isGravity);
  if (typeof updateFieldSummary === 'function') updateFieldSummary(f, lastAutoEntry);
  if (typeof updateRuinCheckboxes === 'function') updateRuinCheckboxes(f);
}

function formatRankValue(value) {
  return value > 0 ? `+${value}` : `${value}`;
}

function renderEntryRankSummary(calcState) {
  const meta = calcState.entryMeta;
  const rows = [];
  for (const sideKey of ['atk', 'def']) {
    for (const stat of ['atk', 'def', 'spa', 'spd', 'spe']) {
      const delta = meta.rankDeltas?.[sideKey]?.[stat] || 0;
      if (!delta) continue;
      const base = state[sideKey].ranks[stat] || 0;
      const final = calcState[sideKey].ranks[stat] || 0;
      rows.push(`
        <div class="entry-rank-item ${sideKey}">
          <span>${sideEntryLabel(sideKey)} ${STAT_LABEL[stat]}</span>
          <b>${formatRankValue(base)}</b>
          <em>${formatRankValue(delta)}</em>
          <strong>${formatRankValue(final)}</strong>
        </div>
      `);
    }
  }
  if (!rows.length) return '';
  return `
    <div class="entry-rank-summary">
      <div class="entry-rank-label">계산 적용 랭크</div>
      <div class="entry-rank-list">${rows.join('')}</div>
    </div>
  `;
}


/* ════════════════════════════════════════════════════════════
   결과 렌더링
   ════════════════════════════════════════════════════════════ */
