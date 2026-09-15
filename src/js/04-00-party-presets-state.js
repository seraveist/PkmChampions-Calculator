import { AbilityById, ItemById, MoveById, NATURE_BY_ID, PokemonById, STATS } from './01-core.js';
import { confirmPartyPresetReplacement, renderPartyPresetModal } from './04-03-party-presets-ui.js';

/* Party presets: state and persistence. */
const PARTY_PRESET_STORAGE_KEY = 'pkmChampions.partyPresets.v1';
const PARTY_PRESET_BACKUP_FORMAT = 'pokechamps-lab-party-presets';
const PARTY_PRESET_BACKUP_MAX_BYTES = 1024 * 1024;
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

// Keep the warning separate from transient import/export status messages.
let partyPresetStorageWarning = '';
let partyPresetStorageReadBlocked = false;
let partyPresetPreviousImport = null;
let partyPresetImportBusy = false;
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

function partyPresetIsRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// Validate before normalizing: malformed backups must never become blank data.
// v1 exports, legacy {parties} records and legacy {data:{parties}} wrappers work.
function parsePartyPresetBackup(payload, { checkIds = true } = {}) {
  const fail = message => { throw new Error(message); };
  const metadata = value => {
    if (!partyPresetIsRecord(value)) fail('파티 백업의 형식을 확인해 주세요.');
    if (value.format !== undefined && value.format !== PARTY_PRESET_BACKUP_FORMAT) {
      fail('이 사이트의 파티 백업 파일이 아닙니다.');
    }
    if (value.version !== undefined && value.version !== 1) {
      fail('지원하지 않는 파티 백업 버전입니다. 기존 파티는 변경하지 않았습니다.');
    }
  };
  metadata(payload);
  const data = payload.data !== undefined ? payload.data : payload;
  metadata(data);
  if (!Array.isArray(data.parties) || !data.parties.length || data.parties.length > PARTY_PRESET_MAX_PARTIES) {
    fail('파티 목록은 1~10개여야 합니다. 빈 배열이나 잘못된 백업은 가져오지 않습니다.');
  }
  const checkId = (value, table, label) => {
    if (typeof value !== 'string') fail(`${label} 항목의 형식을 확인해 주세요.`);
    if (checkIds && value && !Object.hasOwn(table, value)) {
      fail(`현재 데이터에 없는 ${label} 항목이 있습니다. 백업을 확인해 주세요.`);
    }
  };
  for (const party of data.parties) {
    if (!partyPresetIsRecord(party) || !Array.isArray(party.members) || party.members.length > PARTY_PRESET_MAX_MEMBERS) {
      fail('파티별 포켓몬 목록의 형식을 확인해 주세요.');
    }
    if (party.name !== undefined && typeof party.name !== 'string') fail('파티 이름은 문자열이어야 합니다.');
    for (const member of party.members) {
      if (!partyPresetIsRecord(member) || typeof member.pokemon !== 'string') fail('포켓몬 항목의 형식을 확인해 주세요.');
      checkId(member.pokemon, PokemonById, '포켓몬');
      for (const [field, table, label] of [['ability', AbilityById, '특성'], ['item', ItemById, '도구'], ['nature', NATURE_BY_ID, '성격']]) {
        if (member[field] !== undefined) checkId(member[field], table, label);
      }
      if (member.moves !== undefined) {
        if (!Array.isArray(member.moves) || member.moves.length > 4) fail('기술 목록은 최대 4개여야 합니다.');
        member.moves.forEach(id => checkId(id, MoveById, '기술'));
      }
      if (member.evs !== undefined) {
        if (!partyPresetIsRecord(member.evs)) fail('노력치 항목의 형식을 확인해 주세요.');
        for (const stat of STATS) {
          const value = member.evs[stat];
          if (value === undefined) continue;
          if ((typeof value !== 'number' && typeof value !== 'string') || value === '' || !Number.isFinite(Number(value))) {
            fail('노력치는 유효한 숫자여야 합니다.');
          }
        }
      }
    }
  }
  // Preserve the existing bounded EV normalization and default values.
  return normalizePartyPresetData(data);
}

function loadPartyPresetData() {
  let raw;
  try {
    raw = localStorage.getItem(PARTY_PRESET_STORAGE_KEY);
  } catch {
    partyPresetStorageReadBlocked = true;
    partyPresetStorageWarning = '브라우저 저장소를 읽지 못했습니다. 현재 탭의 변경은 자동 저장되지 않습니다. JSON으로 백업해 주세요.';
    return blankPartyPresetData();
  }
  if (!raw) return blankPartyPresetData();
  try {
    const stored = JSON.parse(raw);
    // Stored records from earlier versions still use the existing ID normalization.
    const data = parsePartyPresetBackup(stored, { checkIds: false });
    if (stored.previousImport) {
      try { partyPresetPreviousImport = parsePartyPresetBackup(stored.previousImport, { checkIds: false }); }
      catch { partyPresetPreviousImport = null; }
    }
    return data;
  } catch {
    // Never silently overwrite a corrupt/newer record with the blank fallback.
    partyPresetStorageReadBlocked = true;
    partyPresetStorageWarning = '저장된 파티를 읽지 못해 원본을 보존하고 자동 저장을 중지했습니다. 현재 탭의 파티를 JSON으로 백업하거나 정상 백업을 가져와 복원해 주세요.';
    return blankPartyPresetData();
  }
}

function updatePartyPresetBackupControls() {
  if (typeof document === 'undefined') return;
  const warning = document.getElementById('partyPresetStorageWarning');
  if (warning) {
    warning.hidden = !partyPresetStorageWarning;
    if (warning.textContent !== partyPresetStorageWarning) warning.textContent = partyPresetStorageWarning;
  }
  const undo = document.getElementById('partyPresetUndoImport');
  if (undo) undo.disabled = partyPresetImportBusy || !partyPresetPreviousImport;
  const input = document.getElementById('partyPresetImport');
  if (input) input.disabled = partyPresetImportBusy;
}

function savePartyPresetData({ allowOverwrite = false } = {}) {
  if (partyPresetStorageReadBlocked && !allowOverwrite) {
    updatePartyPresetBackupControls();
    return false;
  }
  try {
    // One atomic storage write contains the current parties and one undo snapshot.
    // No second key can fail halfway through replacing the active record.
    const stored = { ...partyPresetData };
    if (partyPresetPreviousImport) stored.previousImport = partyPresetPreviousImport;
    localStorage.setItem(PARTY_PRESET_STORAGE_KEY, JSON.stringify(stored));
    partyPresetStorageReadBlocked = false;
    partyPresetStorageWarning = '';
    updatePartyPresetBackupControls();
    return true;
  } catch {
    partyPresetStorageWarning = '이 브라우저에 저장하지 못했습니다. 변경은 현재 탭에만 유지됩니다. JSON으로 백업해 주세요.';
    updatePartyPresetBackupControls();
    return false;
  }
}

// Shared by JSON restore and single-party Showdown imports. File reading and
// confirmation hold one lock, preventing stale reads or duplicate confirmation.
async function runPartyPresetImport(prepare) {
  if (partyPresetImportBusy) return false;
  partyPresetImportBusy = true;
  updatePartyPresetBackupControls();
  try {
    const { data, summary, success } = await prepare();
    if (!partyPresetStorageReadBlocked && JSON.stringify(data) === JSON.stringify(normalizePartyPresetData(partyPresetData))) {
      setPartyPresetStatus('현재 파티와 같은 내용입니다. 변경하지 않았습니다.');
      return false;
    }
    const blockedNote = partyPresetStorageReadBlocked ? ' 읽지 못한 기존 저장 기록도 교체되며, 해당 원본은 되돌리기에 포함되지 않습니다.' : '';
    if (!await confirmPartyPresetReplacement({
      title: '파티 가져오기 확인',
      message: `${summary}${blockedNote} 교체 직전의 파티는 한 단계 되돌릴 수 있습니다. 계속할까요?`,
      actionLabel: '교체하기',
    })) {
      setPartyPresetStatus('가져오기를 취소했습니다. 기존 파티는 유지됩니다.');
      return false;
    }
    partyPresetPreviousImport = normalizePartyPresetData(partyPresetData);
    partyPresetData = data;
    const saved = savePartyPresetData({ allowOverwrite: true });
    renderPartyPresetModal();
    setPartyPresetStatus(saved ? success : '가져온 파티는 현재 탭에만 적용되었습니다. JSON으로 백업해 주세요.', saved ? 'success' : 'warning');
    return true;
  } catch (error) {
    setPartyPresetStatus(error instanceof SyntaxError ? 'JSON 형식을 확인해 주세요. 기존 파티는 변경하지 않았습니다.' : error.message || '파티를 가져오지 못했습니다.', 'error');
    return false;
  } finally {
    partyPresetImportBusy = false;
    updatePartyPresetBackupControls();
  }
}

async function undoPartyPresetImport() {
  if (partyPresetImportBusy || !partyPresetPreviousImport) return false;
  partyPresetImportBusy = true;
  updatePartyPresetBackupControls();
  try {
    if (!await confirmPartyPresetReplacement({
      title: '가져오기 되돌리기',
      message: '모든 파티를 직전 가져오기 이전으로 되돌립니다. 가져온 뒤 수정한 내용도 교체됩니다. 계속할까요?',
      actionLabel: '되돌리기',
    })) return false;
    partyPresetData = normalizePartyPresetData(partyPresetPreviousImport);
    partyPresetPreviousImport = null;
    const saved = savePartyPresetData({ allowOverwrite: true });
    renderPartyPresetModal();
    setPartyPresetStatus(saved ? '직전 가져오기를 되돌렸습니다.' : '현재 탭에서 되돌렸지만 저장하지 못했습니다. JSON으로 백업해 주세요.', saved ? 'success' : 'warning');
    return true;
  } catch {
    setPartyPresetStatus('되돌리기를 완료하지 못했습니다.', 'error');
    return false;
  } finally {
    partyPresetImportBusy = false;
    updatePartyPresetBackupControls();
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
    format: PARTY_PRESET_BACKUP_FORMAT,
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
  if (!file) return false;
  return runPartyPresetImport(async () => {
    if (file.size > PARTY_PRESET_BACKUP_MAX_BYTES) throw new Error('파티 백업은 1 MiB 이하의 JSON 파일만 가져올 수 있습니다.');
    let text;
    try { text = await file.text(); }
    catch { throw new Error('파일을 읽지 못했습니다. 다른 파일을 선택해 주세요.'); }
    if (text.length > PARTY_PRESET_BACKUP_MAX_BYTES) throw new Error('파티 백업 파일이 너무 큽니다.');
    const data = parsePartyPresetBackup(JSON.parse(text.replace(/^\uFEFF/, '')));
    const count = data.parties.reduce((sum, party) => sum + party.members.filter(member => member.pokemon).length, 0);
    const description = count ? `포켓몬 ${count}마리가 포함된 백업입니다.` : '포켓몬이 없는 빈 백업입니다.';
    return { data, summary: `${description} 현재 저장된 전체 파티 목록을 교체합니다.`, success: 'JSON 가져오기 및 저장 완료' };
  });
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

// Assignment stays in the module that owns the live binding.
function setPartyPresetData(value) { partyPresetData = value; return value; }

// Assignment stays in the module that owns the live binding.
function setPartyPresetModalReturnFocus(value) { partyPresetModalReturnFocus = value; return value; }

// Assignment stays in the module that owns the live binding.
function setPartyPresetPickerReturnFocus(value) { partyPresetPickerReturnFocus = value; return value; }

// Assignment stays in the module that owns the live binding.
function setPartyPresetPickerTarget(value) { partyPresetPickerTarget = value; return value; }

// Assignment stays in the module that owns the live binding.
function setPartyPresetTextReturnFocus(value) { partyPresetTextReturnFocus = value; return value; }

// Assignment stays in the module that owns the live binding.
function setPartyPresetTextState(value) { partyPresetTextState = value; return value; }

// Assignment stays in the module that owns the live binding.
function setPartyPresetModalReady(value) { partyPresetModalReady = value; return value; }

export { PARTY_PRESET_BACKUP_FORMAT, PARTY_PRESET_BACKUP_MAX_BYTES, parsePartyPresetBackup, updatePartyPresetBackupControls, runPartyPresetImport, undoPartyPresetImport, PARTY_PRESET_STORAGE_KEY, PARTY_PRESET_MAX_PARTIES, PARTY_PRESET_MAX_MEMBERS, PARTY_PRESET_STAT_LABEL, PARTY_PRESET_SHOWDOWN_STAT_LABEL, PARTY_PRESET_MAX_NAME_LENGTH, PARTY_PRESET_IMAGE_WIDTH, PARTY_PRESET_IMAGE_HEIGHT, PARTY_PRESET_IMAGE_OUTPUT_SCALE, PARTY_PRESET_IMAGE_CARD_COLUMNS, PARTY_PRESET_IMAGE_CARD_ROWS, PARTY_PRESET_LABELS, PARTY_PRESET_TYPE_PALETTE_CACHE, partyPresetMoveTypePalette, PARTY_PRESET_SHOWDOWN_STAT_ALIAS, partyPresetData, partyPresetModalReady, partyPresetTextState, partyPresetPickerTarget, partyPresetModalReturnFocus, partyPresetPickerReturnFocus, partyPresetTextReturnFocus, partyPresetCollapsedParties, partyPresetExpandedSlots, partyPresetSlotCollapseKey, partyPresetFocusableElements, partyPresetFocusLayer, partyPresetRestoreFocus, partyPresetTrapFocus, partyPresetDefaultName, normalizePartyPresetName, blankPartyPresetMember, blankPartyPresetData, normalizePartyPresetEvs, normalizePartyPresetMember, normalizePartyPresetData, loadPartyPresetData, savePartyPresetData, setPartyPresetStatus, partyPresetExportPayload, partyPresetDownloadText, partyPresetDownloadBlob, exportPartyPresetJson, importPartyPresetJsonFile, partyPresetCopyOrDownload, partyPresetMember, partyPresetMemberClone, partyPresetFilledMembers, partyPresetFilenamePart, setPartyPresetData, setPartyPresetModalReturnFocus, setPartyPresetPickerReturnFocus, setPartyPresetPickerTarget, setPartyPresetTextReturnFocus, setPartyPresetTextState, setPartyPresetModalReady };
