import assert from 'node:assert/strict';
import { championsRoster } from './champions-roster.mjs';

const species = (name, num, extra) => ({ name, num, ...extra });
const pokemon = {
  anchor: species('Anchor', 1),
  newform: species('Anchor-New', 1, { baseSpecies: 'Anchor' }),
  cosmetic: { name: 'Anchor-Cosmetic', baseSpecies: 'Anchor', isCosmeticForme: true },
  futuremega: species('Anchor-Mega', 1, { baseSpecies: 'Anchor' }),
  battleform: species('Anchor-Battle', 1, { battleOnly: 'Anchor' }),
  battleunavailable: species('Anchor-Unavailable', 1, { battleOnly: 'Anchor' }),
  natdexonly: species('Anchor-NatDex', 1, { baseSpecies: 'Anchor' }),
  onlydoubles: species('Anchor-Doubles', 1, { baseSpecies: 'Anchor' }),
  unrelated: species('Unrelated', 2),
  cap: species('CAP', -1),
  custom: species('Custom', 3),
  placeholder: species('Placeholder', 4, { placeholderFor: 'Anchor' }),
  mightrelease: species('Might Release', 5),
  inactivebase: species('Inactive Base', 6),
  inactiveforme: species('Inactive Base-Forme', 6, { baseSpecies: 'Inactive Base' }),
};
const oldFormats = {
  anchor: { tier: 'OU' },
  newform: {},
  futuremega: { tier: 'Illegal', isNonstandard: 'Future' },
  battleunavailable: { tier: 'Illegal' },
  natdexonly: { natDexTier: 'OU' },
  onlydoubles: { doublesTier: 'DOU' },
  cap: { tier: 'OU' },
  custom: { tier: 'OU', isNonstandard: 'Custom' },
  placeholder: { tier: 'OU' },
  mightrelease: { tier: 'Unreleased' },
  inactivebase: { tier: 'Illegal' },
};
assert.deepEqual([...championsRoster(pokemon, oldFormats)], [
  ['anchor', 'OU'], ['newform', 'OU'], ['cosmetic', 'OU'], ['battleform', 'OU'],
]);
const newFormats = {
  ...oldFormats,
  futuremega: { tier: 'Uber' },
  unrelated: { tier: 'NU' },
  inactivebase: { tier: 'RU' },
};
assert.deepEqual([...championsRoster(pokemon, newFormats)], [
  ['anchor', 'OU'], ['newform', 'OU'], ['cosmetic', 'OU'], ['futuremega', 'Uber'], ['battleform', 'OU'],
  ['unrelated', 'NU'], ['inactivebase', 'RU'], ['inactiveforme', 'RU'],
]);
assert(!championsRoster(pokemon, { ...newFormats, anchor: { tier: 'Illegal' } }).has('battleform'));
assert.deepEqual(oldFormats.futuremega, { tier: 'Illegal', isNonstandard: 'Future' });
console.log('[PASS] Champions roster follows upstream release/removal, excludes unofficial and NatDex-only entries, and respects explicit form legality');
