// Standard Champions roster (not National Dex or a curated species list).
export function showdownSpecies(pokedex, id) {
  const form = pokedex[id];
  if (!form?.isCosmeticForme) return form;
  const base = pokedex[showdownId(form.baseSpecies)];
  if (!base || base.isCosmeticForme) throw new Error('Missing Showdown cosmetic base: ' + id);
  // Cosmetic records store only the fields that differ from their base.
  return { ...base, ...form };
}

export function showdownId(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function battleOnlyBaseIds(pokemon) {
  const bases = pokemon?.battleOnly;
  return (Array.isArray(bases) ? bases : [bases]).map(showdownId).filter(Boolean);
}

export function championsRoster(pokedex, formats) {
  const tiers = new Map();
  function tierFor(id, seen = new Set()) {
    if (tiers.has(id)) return tiers.get(id);
    if (seen.has(id)) throw new Error('Circular Showdown form relationship: ' + id);
    const pokemon = showdownSpecies(pokedex, id);
    const format = formats[id] || {};
    // CAP/custom entries and placeholders are not official species. All remaining
    // availability comes from Showdown, not a local include/exclude list.
    if (!pokemon?.name || !(pokemon.num > 0) || pokemon.placeholderFor ||
        (Object.hasOwn(format, 'isNonstandard') ? format.isNonstandard : pokemon.isNonstandard)) {
      tiers.set(id, null);
      return null;
    }
    let tier = format.tier || null;
    // Showdown inherits a form's tiers only if none are declared. A NatDex-only
    // entry must never become regular legal just because its base is available.
    if (!tier && !format.doublesTier && !format.natDexTier) {
      const parents = battleOnlyBaseIds(pokemon);
      if (!parents.length) parents.push(showdownId(pokemon.baseSpecies));
      for (const parent of parents) {
        if (!parent || parent === id) continue;
        tier = tierFor(parent, new Set([...seen, id]));
        if (tier) break;
      }
    }
    if (tier === 'Illegal' || tier === 'Unreleased') tier = null;
    tiers.set(id, tier);
    return tier;
  }
  return new Map(Object.keys(pokedex).flatMap(id => {
    const tier = tierFor(id);
    return tier ? [[id, tier]] : [];
  }));
}
