// Run with two same-origin production pages in a disposable browser profile.
export async function checkPartyTabs(first, second, { partyIndex = 9, indexedDBOnly = false } = {}) {
  const key = 'pkmChampions.partyPresets.v1';
  const storedMembers = () => JSON.parse(first.localStorage.getItem(key) || '{}').parties?.[partyIndex]?.members;
  const windows = [first, second];
  const get = (win, selector) => win.document.querySelector(selector);
  const until = async (read, message) => {
    const end = Date.now() + 45000;
    for (;;) {
      const value = read();
      if (value) return value;
      if (Date.now() >= end) throw new Error(message);
      await new Promise(resolve => setTimeout(resolve, 25));
    }
  };
  const hp = slot => `[data-party-index="${partyIndex}"][data-slot-index="${slot}"][data-preset-ev="hp"]`;
  const edit = (win, slot, value) => {
    get(win, `[data-party-toggle="${partyIndex}"][aria-expanded="false"]`)?.click();
    get(win, `[data-party-slot-toggle][data-party-index="${partyIndex}"][data-slot-index="${slot}"][aria-expanded="false"]`)?.click();
    const el = get(win, hp(slot));
    if (!el.getClientRects().length) throw new Error('Slot HP input is not visible');
    el.focus();
    el.value = value;
    el.dispatchEvent(new win.Event('change', { bubbles: true }));
  };
  const dialogs = () => windows.filter(win => get(win, '#partyPresetConfirm[open]'));
  const result = [];
  for (const win of windows) await until(() => get(win, '.move-row'), 'Calculator did not start');
  const record = JSON.parse(first.localStorage.getItem(key) || '{"version":1,"parties":[]}');
  if (storedMembers()?.some(member => member.pokemon)) throw new Error('Multi-tab test requires empty test party');
  while (record.parties.length <= partyIndex) record.parties.push({ name: 'QA ' + (record.parties.length + 1), members: [] });
  record.parties[partyIndex].members = [{pokemon:'garchomp',evs:{hp:0},moves:['dragonclaw']},{pokemon:'excadrill',evs:{hp:0},moves:['ironhead']}];
  first.localStorage.setItem(key, JSON.stringify(record));
  if (indexedDBOnly) for (const win of windows) Object.defineProperty(win.navigator, 'locks', { value: undefined, configurable: true });
  try {
    for (const win of windows) {
      if (get(win, '#partyPresetModal')?.open) get(win, '#partyPresetClose').click();
      get(win, '#partyPresetOpen').click();
      await until(() => get(win,hp(1)), 'Test slots did not load');
    }
    edit(first, 0, 8);
    edit(second, 1, 12);
    await until(() => storedMembers()[0].evs.hp === 8 && storedMembers()[1].evs.hp === 12, 'Disjoint slot edits lost');
    if (dialogs().length) throw new Error('Disjoint edits prompted for replacement');
    result.push('different slots merged');
    await until(() => Number(get(second,hp(0)).value) === 8, 'Peer did not refresh its edit baseline');
    edit(first, 0, 16);
    edit(second, 0, 24);
    const [conflict] = await until(() => dialogs().length === 1 && dialogs(), 'Missing conflict confirmation');
    const winner = storedMembers()[0].evs.hp;
    if (![16,24].includes(winner)) throw new Error('No first writer');
    get(conflict, '[data-party-confirm-cancel]').click();
    await until(() => windows.every(win => Number(get(win,hp(0)).value) === winner), 'Cancel did not refresh both tabs');
    if (storedMembers()[1].evs.hp !== 12) throw new Error('Conflict changed a different slot');
    result.push('same slot prompted; cancel retained first write');
    return result;
  } finally {
    if (indexedDBOnly) for (const win of windows) delete win.navigator.locks;
  }
}
