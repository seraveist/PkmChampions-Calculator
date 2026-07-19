/* Party presets: state and persistence. */
const PARTY_PRESET_STORAGE_KEY = 'pkmChampions.partyPresets.v1';
const PARTY_PRESET_MAX_PARTIES = 10;
const PARTY_PRESET_MAX_MEMBERS = 6;
const PARTY_PRESET_STAT_LABEL = { hp: 'H', atk: 'A', def: 'B', spa: 'C', spd: 'D', spe: 'S' };
const PARTY_PRESET_SHOWDOWN_STAT_LABEL = { hp: 'HP', atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe' };
const PARTY_PRESET_MAX_NAME_LENGTH = 32;
const PARTY_PRESET_IMAGE_WIDTH = 1200;
const PARTY_PRESET_IMAGE_HEIGHT = 800;
const PARTY_PRESET_IMAGE_OUTPUT_SCALE = 2;
const PARTY_PRESET_IMAGE_CARD_COLUMNS = 3;
const PARTY_PRESET_IMAGE_CARD_ROWS = 2;
const PARTY_PRESET_LABELS = {
  party: '\uD30C\uD2F0',
  ability: '\uD2B9\uC131',
  item: '\uB3C4\uAD6C',
  nature: '\uC131\uACA9',
  evs: '\uB178\uB825\uCE58',
  empty: '\uC5C6\uC74C',
  emptySlot: '\uBE44\uC5B4 \uC788\uC74C',
  imageExport: '\uC774\uBBF8\uC9C0 \uCD9C\uB825',
};
const PARTY_PRESET_TYPE_PALETTE_CACHE = new Map();

function partyPresetMoveTypePalette(type, fallback = {}) {
  const key = String(type || '').trim().toLowerCase();
  if (!key || typeof getComputedStyle !== 'function') return fallback;
  if (PARTY_PRESET_TYPE_PALETTE_CACHE.has(key)) return PARTY_PRESET_TYPE_PALETTE_CACHE.get(key);

  const styles = getComputedStyle(document.documentElement);
  const value = suffix => styles.getPropertyValue(`--type-${key}-${suffix}`).trim();
  const palette = {
    bg: value('bg') || fallback.bg,
    fg: value('fg') || fallback.fg,
  };
  PARTY_PRESET_TYPE_PALETTE_CACHE.set(key, palette);
  return palette;
}
const PARTY_PRESET_SHOWDOWN_STAT_ALIAS = {
  hp: 'hp', h: 'hp',
  atk: 'atk', attack: 'atk', a: 'atk',
  def: 'def', defense: 'def', b: 'def',
  spa: 'spa', spatk: 'spa', spattack: 'spa', specialattack: 'spa', c: 'spa',
  spd: 'spd', spdef: 'spd', spdefense: 'spd', specialdefense: 'spd', d: 'spd',
  spe: 'spe', speed: 'spe', s: 'spe',
};

let partyPresetData = loadPartyPresetData();
let partyPresetModalReady = false;
let partyPresetTextState = { partyIndex: 0, mode: 'import' };
let partyPresetPickerTarget = '';
let partyPresetModalReturnFocus = null;
let partyPresetPickerReturnFocus = null;
let partyPresetTextReturnFocus = null;
const partyPresetCollapsedParties = new Set(Array.from({ length: PARTY_PRESET_MAX_PARTIES }, (_, index) => index));
const partyPresetExpandedSlots = new Set();

function partyPresetSlotCollapseKey(partyIndex, slotIndex) {
  return `${partyIndex}:${slotIndex}`;
}

function partyPresetFocusableElements(container) {
  if (!container) return [];
  const selector = [
    'button:not([disabled])',
    'a[href]',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',');
  return [...container.querySelectorAll(selector)].filter(element => element.getAttribute('aria-hidden') !== 'true');
}

function partyPresetFocusLayer(container, preferred = null) {
  requestAnimationFrame(() => {
    const target = preferred || partyPresetFocusableElements(container)[0];
    target?.focus?.();
  });
}

function partyPresetRestoreFocus(target) {
  if (!target || typeof target.focus !== 'function' || target.isConnected === false) return;
  requestAnimationFrame(() => target.focus());
}

function partyPresetTrapFocus(event, container) {
  if (event.key !== 'Tab' || !container) return;
  const focusable = partyPresetFocusableElements(container);
  if (!focusable.length) {
    event.preventDefault();
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;
  if (event.shiftKey && (active === first || !container.contains(active))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (active === last || !container.contains(active))) {
    event.preventDefault();
    first.focus();
  }
}

function partyPresetDefaultName(partyIndex) {
  return `${PARTY_PRESET_LABELS.party} ${partyIndex + 1}`;
}

function normalizePartyPresetName(name, partyIndex) {
  const text = String(name || '').trim().slice(0, PARTY_PRESET_MAX_NAME_LENGTH);
  return text || partyPresetDefaultName(partyIndex);
}

function blankPartyPresetMember() {
  return {
    pokemon: '',
    ability: '',
    item: '',
    nature: 'hardy',
    evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    moves: ['', '', '', ''],
  };
}

function blankPartyPresetData() {
  return {
    version: 1,
    parties: Array.from({ length: PARTY_PRESET_MAX_PARTIES }, (_, index) => ({
      name: partyPresetDefaultName(index),
      members: Array.from({ length: PARTY_PRESET_MAX_MEMBERS }, blankPartyPresetMember),
    })),
  };
}

function normalizePartyPresetEvs(source = {}) {
  let remaining = 66;
  return Object.fromEntries(STATS.map(stat => {
    const numeric = Number(source?.[stat] ?? 0);
    const requested = Number.isFinite(numeric) ? Math.trunc(numeric) : 0;
    const value = Math.min(remaining, Math.max(0, Math.min(32, requested)));
    remaining -= value;
    return [stat, value];
  }));
}

function normalizePartyPresetMember(member = {}) {
  const evs = normalizePartyPresetEvs(member.evs);
  const moves = Array.from({ length: 4 }, (_, index) => member.moves?.[index] || '');
  return {
    pokemon: PokemonById[member.pokemon] ? member.pokemon : '',
    ability: member.ability && AbilityById[member.ability] ? member.ability : '',
    item: member.item && ItemById[member.item] ? member.item : '',
    nature: NATURE_BY_ID[member.nature] ? member.nature : 'hardy',
    evs,
    moves,
  };
}

function normalizePartyPresetData(data) {
  const fallback = blankPartyPresetData();
  const parties = Array.from({ length: PARTY_PRESET_MAX_PARTIES }, (_, partyIndex) => {
    const party = data?.parties?.[partyIndex] || {};
    return {
      name: normalizePartyPresetName(party.name, partyIndex),
      members: Array.from({ length: PARTY_PRESET_MAX_MEMBERS }, (_, slotIndex) => (
        normalizePartyPresetMember(party.members?.[slotIndex] || fallback.parties[partyIndex].members[slotIndex])
      )),
    };
  });
  return { version: 1, parties };
}

function loadPartyPresetData() {
  try {
    const raw = localStorage.getItem(PARTY_PRESET_STORAGE_KEY);
    if (!raw) return blankPartyPresetData();
    return normalizePartyPresetData(JSON.parse(raw));
  } catch {
    return blankPartyPresetData();
  }
}

function savePartyPresetData() {
  try {
    localStorage.setItem(PARTY_PRESET_STORAGE_KEY, JSON.stringify(partyPresetData));
  } catch {
    // localStorage unavailable: keep the in-memory data for the current session.
  }
}

function setPartyPresetStatus(message = '', tone = '') {
  const status = document.getElementById('partyPresetStatus');
  if (!status) return;
  status.textContent = message;
  status.dataset.tone = tone || '';
}

function partyPresetExportPayload() {
  const normalized = normalizePartyPresetData(partyPresetData);
  return {
    format: 'pokechamps-lab-party-presets',
    version: 1,
    exportedAt: new Date().toISOString(),
    parties: normalized.parties,
  };
}

function partyPresetDownloadText(text, filename, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type: mime });
  partyPresetDownloadBlob(blob, filename);
}

function partyPresetDownloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}

function exportPartyPresetJson() {
  const payload = partyPresetExportPayload();
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  partyPresetDownloadText(
    JSON.stringify(payload, null, 2),
    `pokechamps-party-presets-${date}.json`,
    'application/json;charset=utf-8'
  );
  setPartyPresetStatus('JSON 내보내기 완료', 'success');
}

async function importPartyPresetJsonFile(file) {
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    const data = parsed?.data?.parties ? parsed.data : parsed;
    if (!Array.isArray(data?.parties)) throw new Error('Invalid party preset JSON');
    partyPresetData = normalizePartyPresetData(data);
    savePartyPresetData();
    renderPartyPresetModal();
    setPartyPresetStatus('JSON 가져오기 완료', 'success');
  } catch {
    setPartyPresetStatus('JSON 형식을 확인해 주세요', 'error');
  }
}

async function partyPresetCopyOrDownload(text, filename) {
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(text);
    setPartyPresetStatus('Showdown 텍스트 복사 완료', 'success');
  } catch {
    partyPresetDownloadText(text, filename);
    setPartyPresetStatus('Showdown 텍스트 파일 저장 완료', 'success');
  }
}

function partyPresetMember(partyIndex, slotIndex) {
  return partyPresetData.parties?.[partyIndex]?.members?.[slotIndex] || blankPartyPresetMember();
}

function partyPresetMemberClone(member) {
  return normalizePartyPresetMember(member || blankPartyPresetMember());
}

function partyPresetFilledMembers(party) {
  return (party?.members || [])
    .map((member, slotIndex) => ({ member: partyPresetMemberClone(member), slotIndex }))
    .filter(entry => entry.member.pokemon && PokemonById[entry.member.pokemon]);
}

function partyPresetFilenamePart(text, fallback = 'party') {
  const safe = String(text || fallback)
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .slice(0, 48);
  return safe || fallback;
}
