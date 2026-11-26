import { AbilityById, ItemById, PokemonById, abName, battleAbilityContext, calcMaxHp, effectiveBattleItem, effectiveWeather, isGrounded, itName, mvName, } from './01-core.js';
import { calculateDamage, damageBlockApplies, breaksDamageScreens, fractionValue, isPoisonStatus, koRecoveryOptions, koRollWeights, makePowerAttackModel, recoverFlungBerry, recoverPowerHit } from './02-engine.js';

import { sourceMoveFailure, withBattleHp, battleHp, recordHitEvent, applyHitRank, activateTerrainSeed, rememberBerry, prepareDamageSide, berryCures, updateHeldBerry, eligibleContact, suppressedSecondary, targetSecondaryAllowed, applyTargetDrop, applyCertainStatus, transferHitItem } from './02-damage-events.js';

function contactDamagePerHit(move, hit, maxHp, hasDefItem) {
  const { atkAbility, defAbility, atkItem, defItem } = hit.koContext;
  const contact = move.id === 'shellsidearm' ? hit.category === 'Physical' : move.flags?.contact;
  if (!contact || ['magicguard', 'longreach'].includes(atkAbility) || atkItem === 'protectivepads' ||
      (atkItem === 'punchingglove' && move.flags?.punch)) return 0;
  const skin = ['roughskin', 'ironbarbs'].includes(defAbility) ? Math.max(1, Math.floor(maxHp / 8)) : 0;
  const helmet = hasDefItem && defItem === 'rockyhelmet' ? Math.max(1, Math.floor(maxHp / 6)) : 0;
  return skin + helmet;
}

function actualHitOutcomes(a, d, move, field) {
  if (!move || move.cat === 'Status') return [{ hp: battleHp(d), broken: !!d.disguiseBroken, item: d.item, chance: 1, damage: 0, lastDamage: 0, hits: 0, category: '', moveType: '' }];
  const hitField = { ...field, damagePurpose: 'observed', resolveHitState: true, singleHitCalculation: true, powerHitIndex: 0 };
  const first = calculateDamage(a, d, move, hitField);
  if (!first) return [];
  const model = makePowerAttackModel(a, d, move, hitField, first);
  const tracksExit = AbilityById[first.koContext?.defAbility]?.switchAtHalfHp;
  const variants = model.variants;
  const weightTotal = variants.reduce((n, v) => n + v.weight, 0);
  const out = [];
  for (let vi = 0; vi < variants.length; vi++) {
    let states = [{ contactLoss: 0, hp: battleHp(d), broken: !!d.disguiseBroken, used: false, damage: 0, lastDamage: 0, chance: variants[vi].weight / weightTotal, hits: 0 }];
    for (let index = 0; index < (first.effectiveness === 0 ? 1 : variants[vi].hits); index++) {
      const next = new Map();
      const add = row => {
        const k = `${row.hp}|${row.broken}|${row.used}|${row.damage}|${row.lastDamage}|${row.hits}|${row.contactLoss}|${!!row.exitThresholdCrossed}|${!!row.berserk}`;
        if (next.has(k)) next.get(k).chance += row.chance;
        else next.set(k, row);
      };
      for (const current of states) {
        if (current.hp <= 0 || current.contactLoss >= battleHp(a)) { add(current); continue; }
        const hit = model.hit(current.hp, current.used, index, vi);
        const block = AbilityById[hit.koContext?.defAbility]?.damageBlock;
        const shield = !current.broken && damageBlockApplies(block, PokemonById[d.pokemonIdx],
          { ...d, damageBlockActive: true }, move, hit.category === 'Physical');
        const contact = contactDamagePerHit(move, hit, calcMaxHp(a), !current.used);
        const weights = koRollWeights(hit.damages || [0]);
        const total = [...weights.values()].reduce((n, w) => n + w, 0);
        for (const [raw, weight] of weights) {
          let damage = Math.min(current.hp, Math.max(0, raw));
          let used = current.used;
          const blocked = shield && damage > 0;
          const shieldLoss = blocked ? Math.floor(model.maxHp * fractionValue(block.consumedHpFraction, 0)) : 0;
          const contactLoss = current.contactLoss + (damage > 0 ? contact : 0);
          if (blocked) damage = 0;
          if (!blocked && raw >= current.hp && current.hp === model.maxHp && current.hp > 1 &&
              ((!used && first.koContext?.defItem === 'focussash') || first.koContext?.defAbility === 'sturdy')) {
            damage = current.hp - 1;
            if (first.koContext?.defItem === 'focussash') used = true;
          }
          const recovery = koRecoveryOptions(hit.koContext || first.koContext, hit.effectiveness, hit.moveType);
          const blocksHealing = d.healBlock || (move.hitVolatile === 'healblock' && hit.koContext.defAbility !== 'aromaveil' &&
            targetSecondaryAllowed(move, {atkAbility:hit.koContext.atkAbility,defAbility:hit.koContext.defAbility,defItem:hit.koContext.defItem}));
          if (blocksHealing || (!damage && !shieldLoss)) recovery.hpRecovery = null;
          if (blocksHealing) recovery.cheekPouch = false;
          const removed = model.removeItemOnHit && (blocked || damage > 0) && !(damage && recovery.consumeResistBerry);
          const before = model.flungItem ? recoverFlungBerry(model, current.hp - damage - shieldLoss, used, recovery, damage) : { hp: current.hp - damage - shieldLoss, used };
          const absorb = ['waterabsorb','voltabsorb','dryskin','eartheater'].includes(hit.blockingAbility);
          if (absorb && !d.healBlock) before.hp = Math.min(model.maxHp, before.hp + Math.floor(model.maxHp / 4));
          const band = damage > 0 && before.hp <= 0 && hit.koContext?.defItem === 'focusband';
          const probability = current.chance * weight / total;
          // Champions compares HP at the last damaging hit plus the whole move's
          // damage. A berry consumed between hits can raise the starting baseline.
          const exitThresholdCrossed = !!tracksExit && damage > 0 && current.hp + current.damage > model.maxHp / 2;
          if (band) add({ contactLoss, exitThresholdCrossed, hp:1, broken:current.broken, used:false, damage:current.damage + current.hp - 1,
            lastDamage:current.hp - 1, hits:current.hits + 1, chance:probability / 10 });
          const berserk = first.koContext.defAbility === 'berserk' && !suppressedSecondary(move,{atkAbility:first.koContext.atkAbility})
            && before.hp > 0 && before.hp <= model.maxHp/2 && before.hp + current.damage + damage > model.maxHp/2;
          const recovered = recoverPowerHit(before.hp, model.maxHp, before.used || removed, recovery, damage);
          add({ contactLoss, exitThresholdCrossed, berserk, hp: Math.max(0, recovered.hp), broken: current.broken || !!blocked, used: recovered.used, damage: current.damage + damage,
            lastDamage: damage, chance: probability * (band ? .9 : 1), hits: current.hits + (blocked || damage > 0 ? 1 : 0) });
        }
      }
      states = [...next.values()];
    }
    for (const row of states) out.push({ ...row, item: row.used ? '' : d.item, category: variants[vi].shellCategory || first.category,
      moveType: first.moveType, defAbility: first.koContext?.defAbility, atkAbility: first.koContext?.atkAbility,
      defItem: first.koContext?.defItem, atkItem: first.koContext?.atkItem, effectiveness: first.effectiveness,
      blockingAbility: first.blockingAbility, consumesAttackItem: model.consumesAttackItem });
  }
  return out;
}

function afterDamagingHit(attacker, defender, move, hit) {
  if (!hit.damage) return attacker;
  if (hit.defAbility === 'justified' && hit.moveType === 'Dark') applyHitRank(defender,'atk',hit.hits,'정의의마음');
  if (hit.berserk && hit.hp > 0) applyHitRank(defender,'spa',1,'발끈');
  if (eligibleContact(move,hit)) {
    if (hit.defAbility === 'gooey' || hit.defAbility === 'tanglinghair') applyTargetDrop(attacker,'spe',-hit.hits,abName(AbilityById[hit.defAbility]),hit.atkAbility,hit.atkItem);
    if (['mummy','lingeringaroma'].includes(hit.defAbility) && !AbilityById[hit.atkAbility]?.noOverwrite) attacker.ability = hit.defAbility;
    if (hit.defAbility === 'wanderingspirit' && !AbilityById[hit.atkAbility]?.noAbilitySwap) {
      attacker.ability = hit.defAbility; defender.ability = hit.atkAbility;
    }
  }
  if (!hit.hp && hit.atkAbility !== 'magicguard') {
    if (hit.defAbility === 'innardsout') attacker = withBattleHp(attacker,battleHp(attacker)-hit.damage);
    if (hit.defAbility === 'aftermath' && hit.atkAbility !== 'damp' && eligibleContact(move,hit))
      attacker = withBattleHp(attacker,battleHp(attacker)-Math.floor(calcMaxHp(attacker)/4));
  }
  if (hit.atkItem === 'shellbell' && !attacker.healBlock && !suppressedSecondary(move,hit) && battleHp(attacker)>0)
    attacker = withBattleHp(attacker,battleHp(attacker)+Math.max(1,Math.floor(hit.damage/8)));
  return attacker;
}

function advanceDamageMove(a, d, move, field, resolveHits = actualHitOutcomes) {
  if (battleHp(a) <= 0) return [];
  if (move && move.observedAction !== 'landed' && sourceMoveFailure(move,a))
    return [{a:{...a,lastMoveFailed:true},d,field,chance:1,damage:0,landed:false}];
  a = { ...a, glaiveRushExposed: false };
  return resolveHits(a, d, move, field).map(hit => {
    let defender = withBattleHp({ ...d, item: hit.item, disguiseBroken: !!hit.broken, ranks: { ...d.ranks }, wasHit: !!d.wasHit || hit.damage > 0,
      receivedDamage: hit.damage > 0 ? hit.lastDamage : d.receivedDamage, receivedDamageCategory: (hit.damage > 0 ? hit.category : d.receivedDamageCategory) || 'Physical' }, hit.hp);
    if (hit.blockingAbility && ['lightningrod','stormdrain','sapsipper','motordrive'].includes(hit.blockingAbility)) {
      const stat = {lightningrod:'spa',stormdrain:'spa',sapsipper:'atk',motordrive:'spe'}[hit.blockingAbility];
      applyHitRank(defender,stat,1,abName(AbilityById[hit.blockingAbility]));
    }
    if (hit.blockingAbility === 'flashfire' && !defender.flashFireActive) {
      defender.flashFireActive = true;
      recordHitEvent(defender, '타오르는불꽃 · 불꽃 기술 강화');
    }
    let attacker = { ...a, ranks: { ...a.ranks } };
    if (a.pokemonIdx === 'aegislash' && a.ability === 'stancechange' && move?.cat !== 'Status') attacker.pokemonIdx = 'aegislashblade';
    if (['meteorbeam','electroshot'].includes(move?.id)) applyHitRank(attacker,'spa',1,mvName(move));
    const nextField = { ...field };
    if (hit.effectiveness > 0 && breaksDamageScreens(move)) { nextField.defReflect = false; nextField.defLightScreen = false; }
    if (move?.id === 'steelbeam' || move?.id === 'chloroblast') attacker = withBattleHp(attacker, battleHp(attacker) - Math.ceil(calcMaxHp(attacker) / 2));
    if (hit.hits > 0 || hit.effectiveness === 0) attacker.lastMoveFailed = hit.hits === 0;
    if (hit.hits > 0) {
      const rank = (side, stat, amount, source = abName(AbilityById[side.ability] || { name: side.ability })) => applyHitRank(side, stat, amount, source);
      if (hit.defAbility === 'stamina') rank(defender, 'def', hit.hits);
      if (hit.defAbility === 'weakarmor' && hit.category === 'Physical') { rank(defender, 'def', -hit.hits); rank(defender, 'spe', 2 * hit.hits); }
      if (hit.defAbility === 'watercompaction' && hit.moveType === 'Water') rank(defender, 'def', 2 * hit.hits);
      if (hit.defAbility === 'seedsower') nextField.terrain = 'Grassy';
      if (hit.defAbility === 'sandspit') nextField.weather = 'Sand';
      if (hit.moveType === 'Fire' && hit.defAbility === 'thermalexchange') rank(defender, 'atk', 1);
      if (d.item && !defender.item && d.ability === 'unburden') defender.unburdenActive = true;
      if (move?.selfBoosts && !(move.selfSecondaryBoost && suppressedSecondary(move,hit))) for (const [stat, amount] of Object.entries(move.selfBoosts)) rank(attacker, stat, amount * (move.id === 'poweruppunch' ? hit.hits : 1), mvName(move));
      if (hit.defAbility === 'steamengine' && ['Fire', 'Water'].includes(hit.moveType)) rank(defender, 'spe', 6);
      if (hit.defAbility === 'rattled' && ['Bug', 'Ghost', 'Dark'].includes(hit.moveType)) rank(defender, 'spe', hit.hits);
      if (hit.damage > 0 && hit.defItem === 'weaknesspolicy' && hit.effectiveness > 1 && battleHp(defender) > 0) {
        rank(defender, 'atk', 2, '약점보험'); rank(defender, 'spa', 2, '약점보험'); defender.item = '';
      }
      if (hit.defItem === 'airballoon') { defender.item = ''; recordHitEvent(defender, '풍선 · 소모'); }
      if (d.item && !defender.item && d.item !== 'airballoon') recordHitEvent(defender, `${itName(ItemById[d.item] || { name: d.item })} · 소모`);
      let hp = battleHp(attacker);
      if (hit.damage > 0 && move?.drain) {
        const healing = Math.max(1, Math.round(hit.damage * fractionValue(move.drain, 0) * (hit.atkItem === 'bigroot' ? 1.3 : 1)));
        hp += hit.defAbility === 'liquidooze' ? -healing : healing;
      }
      if (hit.damage > 0 && move?.recoil && !['rockhead', 'magicguard'].includes(hit.atkAbility)) hp -= Math.max(1, Math.round(hit.damage * fractionValue(move.recoil, 0)));
      attacker = withBattleHp(attacker, hp);
      if (hit.consumesAttackItem) {
        attacker.item = '';
        recordHitEvent(attacker, '노말주얼 · 소모');
        if (hit.atkAbility === 'unburden') attacker.unburdenActive = true;
      }
      if (move?.variableBpKind === 'fling') attacker.item = '';
      if (move?.variableBpKind === 'stockpile') attacker.stockpileCount = 0;
    }
    if (hit.hits > 0 && hit.atkItem === 'lifeorb' &&
        hit.atkAbility !== 'magicguard' && !(hit.atkAbility === 'sheerforce' && move?.sec)) {
      attacker = withBattleHp(attacker, battleHp(attacker) - Math.max(1, Math.floor(calcMaxHp(a) / 10)));
    }
    if (hit.contactLoss) attacker = withBattleHp(attacker, battleHp(attacker) - hit.contactLoss);
    if (hit.hits > 0) {
      defender.timesAttacked = Math.min(6, Number(d.timesAttacked || 0) + hit.hits);
      if (['smackdown','thousandarrows'].includes(move?.id)) defender.forcedGrounded = true;
    }
    const secondaryAllowed = targetSecondaryAllowed(move,hit);
    if (hit.hits > 0 && secondaryAllowed && move?.targetHitBoosts &&
        !['clearbody','whitesmoke','fullmetalbody'].includes(hit.defAbility) && hit.defItem !== 'clearamulet') {
      for (const [stat, amount] of Object.entries(move.targetHitBoosts)) applyTargetDrop(defender, stat, amount, mvName(move),hit.defAbility,hit.defItem);
    }
    if (hit.hits && secondaryAllowed) {
      applyCertainStatus(defender,move.hitStatus,nextField,hit.defAbility,hit.atkAbility);
      if (move.hitVolatile === 'healblock' && !defender.healBlock && hit.defAbility !== 'aromaveil') defender.healBlock = 2;
      if (move.hitVolatile === 'syrupbomb' && !defender.syrupTurns) defender.syrupTurns = 3;
      if (move.id === 'throatchop' && !defender.soundBlockTurns) defender.soundBlockTurns = 2;
      if (move.hitVolatile === 'flinch' && hit.defAbility !== 'innerfocus') defender.flinched = true;
    }
    attacker = afterDamagingHit(attacker,defender,move,hit);
    if (hit.effectiveness === 0 && ['supercellslam','highjumpkick','jumpkick','axekick'].includes(move?.id) && hit.atkAbility !== 'magicguard')
      attacker = withBattleHp(attacker,battleHp(attacker)-Math.max(1,Math.floor(calcMaxHp(attacker)/2)));
    if (ItemById[d.item]?.isBerry && !hit.item && !['knockoff','incinerate'].includes(move?.id)) rememberBerry(defender,d.item,hit.defAbility);
    if (hit.hits && !suppressedSecondary(move,hit)) {
      if (hit.defAbility === 'pickpocket' && eligibleContact(move,hit) && hit.hp > 0) transferHitItem(attacker,defender);
      if (hit.atkAbility === 'magician' && move.id !== 'fling' && !hit.consumesAttackItem && battleHp(attacker)>0) transferHitItem(defender,attacker);
    }
    if (hit.damage > 0 && hit.defAbility === 'spicyspray' && (!a.status || a.status === 'none') && !(a.tera ? [a.teraType] : a.types || PokemonById[a.pokemonIdx]?.types || []).includes('Fire')
        && !['waterveil','waterbubble','thermalexchange'].includes(hit.atkAbility) && !(field.terrain === 'Misty' && isGrounded(a,field))) attacker.status = 'Burn';
    if (hit.defAbility === 'opportunist' && battleHp(defender)>0) {
      for (const stat of Object.keys(attacker.ranks)) {
        const delta = attacker.ranks[stat] - (a.ranks[stat] || 0);
        if (delta > 0) applyHitRank(defender,stat,delta,'편승');
      }
    }
    for (const side of [attacker, defender]) {
      if (effectiveBattleItem(side) === 'whiteherb' && Object.values(side.ranks).some(value => value < 0)) {
        for (const stat of Object.keys(side.ranks)) side.ranks[stat] = Math.max(0, side.ranks[stat]);
        side.item = '';
      }
    }
    if (hit.damage > 0 && move?.id === 'saltcure') defender.saltCure = true;

    if (hit.damage > 0 && move?.id === 'ironroller') nextField.terrain = 'none';
    if (attacker.item === 'metronome') attacker.metronomeUses = hit.damage > 0 ? Math.min(5,(a.metronomeUses || 0) + 1) : 0;
    if (hit.damage > 0 && move?.id === 'icespinner') nextField.terrain = 'none';
    if (move?.flags?.charge && a.item === 'powerherb') attacker.item = '';
    if (move?.cat === 'Status') {
      for (const [stat, amount] of Object.entries(move.statusBoosts || {})) applyHitRank(attacker, stat, amount, mvName(move));
      if (move.statusHeal && !attacker.healBlock && battleHp(attacker) > 0) {
        const before = battleHp(attacker);
        attacker = withBattleHp(attacker, before + Math.max(1, Math.round(calcMaxHp(attacker) * fractionValue(move.statusHeal, 0))));
        if (battleHp(attacker) > before) recordHitEvent(attacker, `${mvName(move)} · HP +${battleHp(attacker) - before}`);
      }
    }
    if ((hit.hits > 0 || move?.cat === 'Status') && move?.flags?.sound && effectiveBattleItem(attacker, hit.atkAbility || attacker.ability) === 'throatspray' && battleHp(attacker) > 0) {
      applyHitRank(attacker, 'spa', 1, '목스프레이'); attacker.item = ''; recordHitEvent(attacker, '목스프레이 · 소모');
    }
    if ((move?.selfdestruct && hit.effectiveness !== undefined && hit.defAbility !== 'damp' && hit.atkAbility !== 'damp') || (move?.id === 'finalgambit' && hit.damage > 0)) attacker = withBattleHp(attacker, 0);
    if (move?.id === 'glaiverush' && hit.damage > 0) {
      attacker.glaiveRushExposed = true;
      recordHitEvent(attacker, '대검돌격 · 다음 행동 전까지 받는 피해 ×2');
    }
    if (['burnup','doubleshock'].includes(move?.id) && hit.damage > 0) {
      const removedType = move.id === 'burnup' ? 'Fire' : 'Electric';
      attacker.types = (attacker.types || PokemonById[attacker.pokemonIdx].types).filter(type => type !== removedType);
      recordHitEvent(attacker, mvName(move)+' · 기존 타입 소실');
    }
    const active = battleAbilityContext(attacker,defender);
    if (battleHp(attacker) < battleHp(a) || attacker.status !== a.status || attacker.item !== a.item)
      attacker = withBattleHp(attacker,updateHeldBerry(attacker,battleHp(attacker),active.atkAb,active.defAb));
    if (defender.status !== d.status || (defender.item && defender.item !== d.item))
      defender = withBattleHp(defender,updateHeldBerry(defender,battleHp(defender),active.defAb,active.atkAb));
    if (nextField.terrain !== field.terrain) {
      attacker = activateTerrainSeed(attacker,defender,nextField);
      defender = activateTerrainSeed(defender,attacker,nextField);
    }
    return { a: attacker, d: defender, field: nextField, chance: hit.chance, damage: hit.damage, landed: hit.hits > 0, exitThresholdCrossed: !!hit.exitThresholdCrossed };
  }).flatMap(path => {
    if (!move?.bindsTarget || !path.landed || path.d.boundTurns || battleHp(path.d)<=0) return [path];
    const item = effectiveBattleItem(a,battleAbilityContext(a,d).atkAb);
    const durations = item === 'gripclaw' ? [8] : [5,6];
    return durations.map(turns => ({...path,d:{...path.d,boundTurns:turns,boundDivisor:item === 'bindingband' ? 6 : 8},chance:path.chance/durations.length}));
  });
}

function finishDamageTurn(side, opposingSide, field) {
  if (battleHp(side) <= 0) return side;
  side = { ...side, ranks: { ...side.ranks }, wasHit:false, receivedDamage:null, flinched:false };
  const max = calcMaxHp(side);
  let hp = battleHp(side);
  const { atkAb: ability, defAb: otherAbility } = battleAbilityContext(side, opposingSide);
  const itemId = effectiveBattleItem(side, ability), item = ItemById[itemId] || {};
  const weather = effectiveWeather(field, ability, otherAbility);
  const types = side.tera ? [side.teraType] : side.types || PokemonById[side.pokemonIdx]?.types || [];
  const heal = fraction => { if (hp > 0 && !side.healBlock) hp = Math.min(max, hp + Math.max(1, Math.floor(max * fraction))); };
  const hurt = fraction => {
    if (ability === 'magicguard') return;
    hp = Math.max(0, hp - Math.max(1, Math.floor(max * fraction)));
    hp = updateHeldBerry(side,hp,ability,otherAbility);
  };
  if (weather === 'Sand' && !types.some(t => ['Rock', 'Ground', 'Steel'].includes(t)) && !['overcoat', 'sandveil', 'sandrush', 'sandforce'].includes(ability) && itemId !== 'safetygoggles') hurt(1 / 16);
  if (ability === 'dryskin') { if (weather === 'Rain') heal(1 / 8); else if (weather === 'Sun') hurt(1 / 8); }
  if (ability === 'solarpower' && weather === 'Sun') hurt(1 / 8);
  if (ability === 'raindish' && weather === 'Rain') heal(1 / 16);
  if (ability === 'icebody' && ['Snow', 'Hail'].includes(weather)) heal(1 / 16);
  if (field.terrain === 'Grassy' && isGrounded(side, field, ability, itemId)) heal(1 / 16);
  if (item.residualRecovery?.kind === 'endTurn') heal(fractionValue(item.residualRecovery.fraction, 1 / 16));
  if (itemId === 'blacksludge') { if (types.includes('Poison')) heal(1 / 16); else hurt(1 / 8); }
  if (ability === 'poisonheal' && isPoisonStatus(side.status)) heal(1 / 8);
  else if (ability !== 'magicguard') {
    if (side.status === 'Burn') hurt(ability === 'heatproof' ? 1 / 32 : 1 / 16);
    if (isPoisonStatus(side.status)) hurt(side.status === 'Toxic' ? Math.min(15,(side.toxicTurns || 0) + 1) / 16 : 1 / 8);
  }
  if (side.status === 'Toxic') side.toxicTurns = (side.toxicTurns || 0) + 1;
  if (side.boundTurns && --side.boundTurns > 0 && battleHp(opposingSide)>0) hurt(1/side.boundDivisor);
  if (side.syrupTurns && battleHp(opposingSide)>0) {
    side.syrupTurns--;
    applyTargetDrop(side,'spe',-1,'시럽봄',ability,itemId);
  }
  if (side.cudTurns && ability === 'cudchew' && --side.cudTurns === 0 && hp > 0) {
    const berry = ItemById[side.cudBerry];
    if (berry?.hpRecovery && !side.healBlock) hp = Math.min(max,hp+(berry.hpRecovery.amount ?? Math.floor(max*fractionValue(berry.hpRecovery.fraction,1/4))));
    if (berryCures(side.cudBerry,side.status)) side.status='none';
    side.cudBerry='';
  }
  if (side.soundBlockTurns) side.soundBlockTurns--;
  if (side.saltCure) hurt(types.some(type => type === 'Steel' || type === 'Water') ? 1 / 8 : 1 / 16);
  if (side.healBlock && --side.healBlock === 0) hp = updateHeldBerry(side,hp,ability,otherAbility);
  if (ability === 'hungerswitch') side.hangry = !(side.hangry ?? (side.pokemonIdx === 'morpekohangry'));
  if (hp !== battleHp(side)) recordHitEvent(side, `턴 종료 HP ${hp > battleHp(side) ? '+' : ''}${hp - battleHp(side)}`);
  if (hp > 0 && ability === 'speedboost') applyHitRank(side, 'spe', 1, '가속');
  return withBattleHp(side, hp);
}

// Only mutable battle inputs belong in a projection's state key. A fixed
// participant's spread, chosen conditions and original form do not branch.
function hitStateKey(side) {
  return [battleHp(side), side.pokemonIdx, side.ability, side.item, side.status, side.types, side.ranks,
    !!side.disguiseBroken, !!side.flashFireActive, side.hangry, !!side.unburdenActive, !!side.saltCure, side.healBlock || 0,
    !!side.forcedGrounded, !!side.wasHit, side.timesAttacked || 0, side.toxicTurns || 0,
    side.boundTurns || 0,side.boundTurns ? side.boundDivisor : 0,side.syrupTurns || 0,side.cudTurns || 0,side.cudBerry || '',side.soundBlockTurns || 0,!!side.flinched,!!side.ateBerry,
    side.stockpileCount || 0, !!side.lastMoveFailed, !!side.glaiveRushExposed, side.metronomeUses || 0];
}

export { prepareDamageSide, activateTerrainSeed, hitStateKey, withBattleHp, battleHp, recordHitEvent, applyHitRank, actualHitOutcomes, advanceDamageMove, finishDamageTurn };
