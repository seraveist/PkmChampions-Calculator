/* Damage calculator derived state and automatic entry effects. */
let lastAutoEntry = emptyEntryMeta();

const manualAutoFieldOverrides = {
  ruinSword: null,
  ruinTablet: null,
  ruinBeads: null,
  ruinVessel: null,
};

const AUTO_ENTRY_FIELD_KEYS = ['weather', 'terrain'];
const autoEntryFieldState = {
  weather: { owner: null, base: 'none' },
  terrain: { owner: null, base: 'none' },
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
  return deriveHpFlags({
    ...side,
    evs: { ...side.evs },
    ranks: { ...side.ranks },
    types: Array.isArray(side.types) ? [...side.types] : [],
    moves: Array.isArray(side.moves) ? [...side.moves] : [],
    moveBpOverrides: Array.isArray(side.moveBpOverrides) ? [...side.moveBpOverrides] : [null, null, null, null],
    moveTypeOverrides: Array.isArray(side.moveTypeOverrides) ? [...side.moveTypeOverrides] : [null, null, null, null],
    moveCriticalOverrides: Array.isArray(side.moveCriticalOverrides) ? [...side.moveCriticalOverrides] : [false, false, false, false],
  });
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

function otherCalcSideKey(sideKey) {
  return sideKey === 'atk' ? 'def' : 'atk';
}

function entryFieldEffectForSide(sideKey, fieldKey) {
  const side = state[sideKey];
  const effect = side ? ENTRY_EFFECTS[side.ability] : null;
  const value = effect?.[fieldKey];
  return value ? { sideKey, value, label: effect.label } : null;
}

function setAppliedEntryField(fieldKey, value) {
  if (state.field[fieldKey] === value) return false;
  state.field[fieldKey] = value;
  return true;
}

function applyEntryFieldsFromSide(sideKey) {
  let changed = false;
  for (const fieldKey of AUTO_ENTRY_FIELD_KEYS) {
    const tracked = autoEntryFieldState[fieldKey];
    const effect = entryFieldEffectForSide(sideKey, fieldKey);
    if (effect) {
      tracked.owner = sideKey;
      if (autoEntryEffects) changed = setAppliedEntryField(fieldKey, effect.value) || changed;
      continue;
    }
    if (tracked.owner !== sideKey) continue;

    const otherKey = otherCalcSideKey(sideKey);
    const fallback = entryFieldEffectForSide(otherKey, fieldKey);
    tracked.owner = fallback ? otherKey : null;
    if (autoEntryEffects) {
      changed = setAppliedEntryField(fieldKey, fallback?.value ?? tracked.base) || changed;
    }
  }
  return changed;
}

function setManualCalcField(fieldKey, value) {
  if (!AUTO_ENTRY_FIELD_KEYS.includes(fieldKey)) return false;
  const nextValue = value || 'none';
  const tracked = autoEntryFieldState[fieldKey];
  tracked.owner = null;
  tracked.base = nextValue;
  return setAppliedEntryField(fieldKey, nextValue);
}

function setAutoEntryEffectsEnabled(enabled) {
  const nextEnabled = !!enabled;
  let changed = autoEntryEffects !== nextEnabled;
  autoEntryEffects = nextEnabled;
  for (const fieldKey of AUTO_ENTRY_FIELD_KEYS) {
    const tracked = autoEntryFieldState[fieldKey];
    const effect = tracked.owner ? entryFieldEffectForSide(tracked.owner, fieldKey) : null;
    const nextValue = nextEnabled && effect ? effect.value : tracked.base;
    changed = setAppliedEntryField(fieldKey, nextValue) || changed;
  }
  lastAutoEntry = emptyEntryMeta();
  return changed;
}

function swapAutoEntryFieldOwners() {
  for (const fieldKey of AUTO_ENTRY_FIELD_KEYS) {
    const tracked = autoEntryFieldState[fieldKey];
    if (tracked.owner) tracked.owner = otherCalcSideKey(tracked.owner);
  }
}

function resetAutoEntryFieldState() {
  for (const fieldKey of AUTO_ENTRY_FIELD_KEYS) {
    autoEntryFieldState[fieldKey].owner = null;
    autoEntryFieldState[fieldKey].base = state.field[fieldKey] || 'none';
  }
  applyEntryFieldsFromSide('atk');
  applyEntryFieldsFromSide('def');
}

function appendActiveEntryFieldMeta(meta) {
  if (!autoEntryEffects) return;
  for (const fieldKey of AUTO_ENTRY_FIELD_KEYS) {
    const owner = autoEntryFieldState[fieldKey].owner;
    const effect = owner ? entryFieldEffectForSide(owner, fieldKey) : null;
    if (!effect || state.field[fieldKey] !== effect.value) continue;
    meta.fields[fieldKey] = effect;
    meta.logs.push(`${sideEntryLabel(owner)} 진입: ${effect.label}`);
  }
}

function applyDerivedEntryRankEffects(calcState, meta) {
  for (const sideKey of ['atk', 'def']) {
    const side = calcState[sideKey];
    const otherKey = otherCalcSideKey(sideKey);
    const other = calcState[otherKey];
    const effect = ENTRY_EFFECTS[side.ability];
    if (!effect) continue;

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
  }
}

function applyContinuousAbilityEffects(calcState, meta) {
  for (const sideKey of ['atk', 'def']) {
    const side = calcState[sideKey];
    const effect = ENTRY_EFFECTS[side.ability];
    if (!effect) continue;
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
}

function applyEntryEffectsToCalcState(calcState) {
  const meta = emptyEntryMeta();
  if (!autoEntryEffects) return meta;

  appendActiveEntryFieldMeta(meta);
  applyDerivedEntryRankEffects(calcState, meta);
  applyContinuousAbilityEffects(calcState, meta);
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
  setChecked('defReflect', f.defReflect);
  setChecked('defLightScreen', f.defLightScreen);
  setChecked('atkHelpingHand', f.atkHelpingHand);
  setChecked('defStealthRock', f.defStealthRock);
  setChecked('defSpikes', f.defSpikesLayers > 0);
  setComboboxValue('defSpikesLayers', String(Math.max(1, f.defSpikesLayers || 1)), 'spikesLayers');
  if (typeof syncSpikesLayerControl === 'function') syncSpikesLayerControl(f.defSpikesLayers > 0);
  setChecked('gravity', f.isGravity);
  if (typeof updateRuinCheckboxes === 'function') updateRuinCheckboxes(f);
}

function formatRankValue(value) {
  return value > 0 ? `+${value}` : `${value}`;
}

/* ════════════════════════════════════════════════════════════
   결과 렌더링
   ════════════════════════════════════════════════════════════ */
