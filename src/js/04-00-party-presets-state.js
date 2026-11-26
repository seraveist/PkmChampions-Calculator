import { AbilityById, ItemById, MoveById, NATURE_BY_ID, PokemonById, STATS } from './01-core.js';


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
let partyPresetStoredRaw = null;
let partyPresetData = loadPartyPresetData();
let partyPresetBase = normalizePartyPresetData(partyPresetData);
let partyPresetSaveQueue = Promise.resolve();
let partyPresetLockDb;
let partyPresetDeferredWrite = null;
let partyPresetUi;
function configurePartyPresetUi(ui) { partyPresetUi = ui; }
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
  const target = preferred || partyPresetFocusableElements(container)[0];
  target?.focus?.({ preventScroll: true });
}

function partyPresetRestoreFocus(target) {
  if (!target || typeof target.focus !== 'function' || target.isConnected === false) return;
  target.focus({ preventScroll: true });
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
    partyPresetStoredRaw = raw;
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
      try { partyPresetPreviousImport = readPartyUndo(stored.previousImport); }
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

function readPartyUndo(value) {
  if (!value) return null;
  const snapshot = parsePartyPresetBackup(value, { checkIds: false });
  if (Number.isInteger(value.partyIndex) && snapshot.parties[value.partyIndex]) snapshot.partyIndex = value.partyIndex;
  if (typeof value.importId === 'string') snapshot.importId = value.importId;
  return snapshot;
}

function samePartyValue(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

// Serialize the read/merge/write across tabs, including restores and undo.
async function withPartyStorageLock(operation) {
  if (globalThis.navigator?.locks) return navigator.locks.request(PARTY_PRESET_STORAGE_KEY, operation);
  if (!globalThis.indexedDB) throw new Error('파티 저장 잠금을 사용할 수 없습니다.');
  if (!partyPresetLockDb) {
    partyPresetLockDb = new Promise((resolve, reject) => {
      const request = indexedDB.open(PARTY_PRESET_STORAGE_KEY + '.lock', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('writer');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => { db.close(); partyPresetLockDb = null; };
        resolve(db);
      };
    }).catch(error => { partyPresetLockDb = null; throw error; });
  }
  const db = await partyPresetLockDb;
  return new Promise((resolve, reject) => {
    const tx = db.transaction('writer', 'readwrite');
    let result;
    tx.oncomplete = () => resolve(result);
    tx.onabort = () => reject(tx.error || new Error('파티 저장 잠금 실패'));
    tx.objectStore('writer').get(0).onsuccess = () => {
      try { result = operation(); } catch (error) { tx.abort(); reject(error); }
    };
  });
}

function partyScope(data, scope) {
  if (scope.all) return data.parties;
  const party = data.parties[scope.party];
  if (scope.members) return party.members;
  return scope.slot === undefined ? party.name : party.members[scope.slot];
}

function setPartyScope(data, scope, value) {
  if (scope.all) data.parties = value;
  else if (scope.members) data.parties[scope.party].members = value;
  else if (scope.slot === undefined) data.parties[scope.party].name = value;
  else data.parties[scope.party].members[scope.slot] = value;
}

function partyEdits(before, after) {
  const scopes = [];
  after.parties.forEach((party, i) => {
    if (before.parties[i].name !== party.name) scopes.push({ party: i });
    party.members.forEach((member, j) => {
      if (!samePartyValue(before.parties[i].members[j], member)) scopes.push({ party: i, slot: j });
    });
  });
  return scopes;
}

// The confirmation is outside the storage lock. Recheck before applying it.
async function commitPartyChange(before, desired, scopes, action = 'edit', undo = null) {
  let accepted;
  try {
    for (;;) {
      const result = await withPartyStorageLock(() => {
        const raw = localStorage.getItem(PARTY_PRESET_STORAGE_KEY);
        let disk = blankPartyPresetData(), previous = null;
        if (raw) {
          try {
            const record = JSON.parse(raw);
            disk = parsePartyPresetBackup(record, { checkIds: false });
            try { previous = readPartyUndo(record.previousImport); } catch { previous = null; }
          } catch (error) {
            if (!(action === 'import' && scopes[0].all && partyPresetStorageReadBlocked && raw === partyPresetStoredRaw)) throw error;
          }
        }
        if (action === 'undo' && !samePartyValue(previous, undo)) return { stale: true, disk, previous };
        const values = scopes.map(scope => partyScope(disk, scope));
        const conflict = scopes.some((scope, i) => !samePartyValue(values[i], partyScope(before, scope)) &&
          (action !== 'edit' || !samePartyValue(values[i], partyScope(desired, scope))));
        if (conflict && !samePartyValue(values, accepted)) return { conflict: true, values, disk, previous };
        if (action === 'import') {
          previous = normalizePartyPresetData(disk);
          if (scopes[0].members) previous.partyIndex = scopes[0].party;
          previous.importId = globalThis.crypto?.randomUUID?.() || String(Date.now()) + Math.random();
        }
        if (action === 'undo') previous = null;
        for (const scope of scopes) setPartyScope(disk, scope, partyScope(desired, scope));
        const record = { ...disk };
        if (previous) record.previousImport = previous;
        const nextRaw = JSON.stringify(record);
        localStorage.setItem(PARTY_PRESET_STORAGE_KEY, nextRaw);
        partyPresetStoredRaw = nextRaw;
        return { saved: true, disk, previous };
      });
      if (result.conflict) {
        const ok = await partyPresetUi.confirm({
          title: '다른 탭의 파티 변경', message: '저장하려는 항목이 다른 탭에서 바뀌었습니다. 현재 편집으로 교체할까요?',
          actionLabel: '내 편집 적용',
        });
        if (ok) { accepted = result.values; continue; }
      }
      // Preserve edits typed while waiting for the lock or confirmation.
      partyPresetDeferredWrite = null;
      const pending = normalizePartyPresetData(partyPresetData);
      const changes = partyEdits(desired, pending);
      partyPresetBase = normalizePartyPresetData(result.disk);
      const merged = normalizePartyPresetData(result.disk);
      for (const scope of changes) setPartyScope(merged, scope, partyScope(pending, scope));
      const refreshed = !samePartyValue(merged, pending);
      partyPresetData = merged;
      partyPresetPreviousImport = result.previous;
      partyPresetStorageReadBlocked = false;
      partyPresetStorageWarning = result.stale ? '다른 탭에서 가져오기 기록이 변경되었습니다.' : '';
      if (refreshed) partyPresetUi.refresh();
      updatePartyPresetBackupControls();
      return result.saved === true;
    }
  } catch {
    if (action !== 'edit') {
      partyPresetDeferredWrite = { before, desired, scopes, action, undo };
      if (action === 'import') {
        partyPresetPreviousImport = normalizePartyPresetData(before);
        if (scopes[0].members) partyPresetPreviousImport.partyIndex = scopes[0].party;
      } else partyPresetPreviousImport = null;
    }
    partyPresetStorageWarning = '이 브라우저에 저장하지 못했습니다. 변경은 현재 탭에만 유지됩니다. JSON으로 백업해 주세요.';
    updatePartyPresetBackupControls();
    return false;
  }
}

function queuePartyWrite(run) {
  partyPresetSaveQueue = partyPresetSaveQueue.then(run, run);
  return partyPresetSaveQueue;
}

function savePartyPresetData() {
  if (partyPresetStorageReadBlocked) { updatePartyPresetBackupControls(); return false; }
  return queuePartyWrite(async () => {
    if (partyPresetDeferredWrite) {
      const { before, desired, scopes, action, undo } = partyPresetDeferredWrite;
      if (!await commitPartyChange(before, desired, scopes, action, undo)) return false;
    }
    const desired = normalizePartyPresetData(partyPresetData);
    const scopes = partyEdits(partyPresetBase, desired);
    return scopes.length ? commitPartyChange(partyPresetBase, desired, scopes) : true;
  });
}

function refreshPartyPresetFromDisk() {
  if (partyPresetImportBusy || partyPresetStorageWarning || partyEdits(partyPresetBase, normalizePartyPresetData(partyPresetData)).length) return;
  try {
    if (partyPresetStoredRaw === localStorage.getItem(PARTY_PRESET_STORAGE_KEY)) return;
    const priorUndo = partyPresetPreviousImport;
    partyPresetPreviousImport = null;
    const data = loadPartyPresetData();
    if (partyPresetStorageReadBlocked) {
      partyPresetPreviousImport = priorUndo;
      updatePartyPresetBackupControls();
      return;
    }
    partyPresetData = data;
    partyPresetBase = normalizePartyPresetData(partyPresetData);
    partyPresetUi.refresh();
  } catch { /* Explicit save handles unavailable storage. */ }
}

async function runPartyPresetImport(prepare) {
  if (partyPresetImportBusy) return false;
  partyPresetImportBusy = true;
  updatePartyPresetBackupControls();
  try {
    await partyPresetSaveQueue;
    const before = normalizePartyPresetData(partyPresetData);
    const { data, partyIndex, summary, success, warnings = [] } = await prepare();
    const scope = partyIndex === undefined ? { all: true } : { party: partyIndex, members: true };
    if (!partyPresetStorageReadBlocked && samePartyValue(partyScope(data, scope), partyScope(before, scope))) {
      setPartyPresetStatus(['현재 파티와 같은 내용입니다. 변경하지 않았습니다.', ...warnings].join('\n'), warnings.length ? 'warning' : '');
      return false;
    }
    const blockedNote = partyPresetStorageReadBlocked ? ' 읽지 못한 기존 저장 기록은 교체됩니다.' : '';
    if (!await partyPresetUi.confirm({
      title: '파티 가져오기 확인', message: summary + blockedNote + ' 직전 가져오기는 한 단계 되돌릴 수 있습니다. 계속할까요?', actionLabel: '교체하기',
    })) return false;
    await savePartyPresetData();
    const desired = normalizePartyPresetData(partyPresetData);
    setPartyScope(desired, scope, partyScope(data, scope));
    partyPresetData = normalizePartyPresetData(desired);
    const saved = await queuePartyWrite(() => commitPartyChange(before, desired, [scope], 'import'));
    partyPresetUi.render();
    setPartyPresetStatus(saved ? success : partyPresetStorageWarning || '가져오기를 취소했습니다.', saved ? 'success' : 'warning');
    return saved || !!partyPresetStorageWarning;
  } catch (error) {
    setPartyPresetStatus(error instanceof SyntaxError ? 'JSON 형식을 확인해 주세요.' : error.message || '파티를 가져오지 못했습니다.', 'error');
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
    await savePartyPresetData();
    const undo = partyPresetPreviousImport;
    if (!undo) return false;
    const before = normalizePartyPresetData(partyPresetData);
    const scope = undo.partyIndex === undefined ? { all: true } : { party: undo.partyIndex, members: true };
    const label = scope.all ? '모든 파티' : ('파티 ' + (scope.party + 1) + '의 멤버 목록');
    if (!await partyPresetUi.confirm({ title: '가져오기 되돌리기', message: label + '을 가져오기 이전으로 되돌립니다. 계속할까요?', actionLabel: '되돌리기' })) return false;
    const desired = normalizePartyPresetData(partyPresetData);
    setPartyScope(desired, scope, partyScope(undo, scope));
    partyPresetData = normalizePartyPresetData(desired);
    const saved = await queuePartyWrite(() => commitPartyChange(before, desired, [scope], 'undo', undo));
    partyPresetUi.render();
    setPartyPresetStatus(saved ? '가져오기를 되돌렸습니다.' : partyPresetStorageWarning || '되돌리기를 취소했습니다.', saved ? 'success' : 'warning');
    return saved;
  } finally {
    partyPresetImportBusy = false;
    updatePartyPresetBackupControls();
  }
}

function setPartyPresetStatus(message = '', tone = '') {
  for (const id of ['partyPresetStatus', 'partyPresetTextStatus']) {
    const status = document.getElementById(id);
    if (status) { status.textContent = message; status.dataset.tone = tone; }
  }
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

export { configurePartyPresetUi, refreshPartyPresetFromDisk, PARTY_PRESET_BACKUP_FORMAT, PARTY_PRESET_BACKUP_MAX_BYTES, parsePartyPresetBackup, updatePartyPresetBackupControls, runPartyPresetImport, undoPartyPresetImport, PARTY_PRESET_STORAGE_KEY, PARTY_PRESET_MAX_PARTIES, PARTY_PRESET_MAX_MEMBERS, PARTY_PRESET_STAT_LABEL, PARTY_PRESET_SHOWDOWN_STAT_LABEL, PARTY_PRESET_MAX_NAME_LENGTH, PARTY_PRESET_IMAGE_WIDTH, PARTY_PRESET_IMAGE_HEIGHT, PARTY_PRESET_IMAGE_OUTPUT_SCALE, PARTY_PRESET_IMAGE_CARD_COLUMNS, PARTY_PRESET_IMAGE_CARD_ROWS, PARTY_PRESET_LABELS, PARTY_PRESET_TYPE_PALETTE_CACHE, partyPresetMoveTypePalette, PARTY_PRESET_SHOWDOWN_STAT_ALIAS, partyPresetData, partyPresetModalReady, partyPresetTextState, partyPresetPickerTarget, partyPresetModalReturnFocus, partyPresetPickerReturnFocus, partyPresetTextReturnFocus, partyPresetCollapsedParties, partyPresetExpandedSlots, partyPresetSlotCollapseKey, partyPresetFocusableElements, partyPresetFocusLayer, partyPresetRestoreFocus, partyPresetTrapFocus, partyPresetDefaultName, normalizePartyPresetName, blankPartyPresetMember, blankPartyPresetData, normalizePartyPresetEvs, normalizePartyPresetMember, normalizePartyPresetData, loadPartyPresetData, savePartyPresetData, setPartyPresetStatus, partyPresetExportPayload, partyPresetDownloadText, partyPresetDownloadBlob, exportPartyPresetJson, importPartyPresetJsonFile, partyPresetCopyOrDownload, partyPresetMember, partyPresetMemberClone, partyPresetFilledMembers, partyPresetFilenamePart, setPartyPresetData, setPartyPresetModalReturnFocus, setPartyPresetPickerReturnFocus, setPartyPresetPickerTarget, setPartyPresetTextReturnFocus, setPartyPresetTextState, setPartyPresetModalReady };
