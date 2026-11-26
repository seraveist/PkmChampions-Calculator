import { AbilityById, ItemById, abName, battleAbilityContext, calcMaxHp, effectiveBattleItem, effectiveTypes, effectiveWeather, isGrounded, itName, sideHpPct } from './01-core.js';
import { attackerBlocksBerries, canRemovePowerItem, koRecoveryOptions, recoverPowerHit } from './02-engine.js';

function withBattleHp(side, hp) {
  const max = calcMaxHp(side);
  const current = Math.max(0, Math.min(max, Math.floor(hp)));
  return { ...side, hpPct: current / max, fullHP: current === max, pinch: current <= Math.floor(max / 3) };
}

function battleHp(side) {
  const fraction = sideHpPct(side);
  return fraction > 0 ? Math.max(1, Math.floor(calcMaxHp(side) * fraction + 1e-9)) : 0;
}

function recordHitEvent(side, text) {
  side.stateEvents = [...(side.stateEvents || []), text];
}

function applyHitRank(side, stat, amount, source, ability = side.ability) {
  const multiplier = ability === 'contrary' ? -1 : ability === 'simple' ? 2 : 1;
  const before = side.ranks[stat] || 0;
  side.ranks[stat] = Math.max(-6, Math.min(6, before + amount * multiplier));
  const delta = side.ranks[stat] - before;
  if (delta) recordHitEvent(side, `${source} · ${{atk:'공격',def:'방어',spa:'특공',spd:'특방',spe:'스피드'}[stat]} ${delta > 0 ? '+' : ''}${delta}`);
}

const seedStats = {
  Electric: ['electricseed','def'], Grassy: ['grassyseed','def'],
  Misty: ['mistyseed','spd'], Psychic: ['psychicseed','spd'],
};

function activateTerrainSeed(side, other, field) {
  const seed = seedStats[field.terrain];
  if (!seed || side.item !== seed[0]) return side;
  const ability = battleAbilityContext(side,other).atkAb;
  if (!effectiveBattleItem(side,ability) || battleHp(side) <= 0) return side;
  const next = { ...side, ranks: { ...side.ranks }, item: '' };
  applyHitRank(next,seed[1],1,itName(ItemById[side.item]),ability);
  if (ability === 'unburden') next.unburdenActive = true;
  return next;
}

const curedStatus = {rawstberry:'Burn', cheriberry:'Paralysis', pechaberry:'Poison', chestoberry:'Sleep', aspearberry:'Freeze'};

function rememberBerry(side, id, ability) {
  side.ateBerry = true;
  if (ability === 'cudchew') { side.cudBerry = id; side.cudTurns = 2; }
  if (ability === 'unburden') side.unburdenActive = true;
}

function prepareDamageSide(side, other, field) {
  const seeded = activateTerrainSeed(side,other,field);
  const {atkAb,defAb} = battleAbilityContext(seeded,other);
  if (!ItemById[seeded.item]?.isBerry) return seeded;
  const next = {...seeded};
  const hp = updateHeldBerry(next,battleHp(next),atkAb,defAb);
  return next.item === seeded.item ? seeded : withBattleHp(next,hp);
}

function berryCures(id, status) {
  return status && status !== 'none' && (id === 'lumberry' || curedStatus[id] === (status === 'Toxic' ? 'Poison' : status));
}

function updateHeldBerry(side, hp, ability, otherAbility) {
  const id = effectiveBattleItem(side,ability);
  if (!ItemById[id]?.isBerry || hp <= 0 || attackerBlocksBerries(otherAbility)) return hp;
  const max = calcMaxHp(side);
  if (berryCures(id,side.status)) {
    side.status = 'none';
    if (ability === 'cheekpouch' && !side.healBlock) hp = Math.min(max, hp + Math.floor(max/3));
  } else {
    if (side.healBlock) return hp;
    const options = koRecoveryOptions({defItem:id, defAbility:ability, atkAbility:otherAbility});
    const berry = recoverPowerHit(hp,max,false,options,0);
    if (!berry.used) return hp;
    hp = berry.hp;
  }
  rememberBerry(side,id,ability);
  side.item = '';
  recordHitEvent(side,itName(ItemById[id])+' · 소모');
  return hp;
}

function eligibleContact(move, hit) {
  const contact = move.id === 'shellsidearm' ? hit.category === 'Physical' : move.flags?.contact;
  return contact && hit.atkAbility !== 'longreach' && hit.atkItem !== 'protectivepads' &&
    !(hit.atkItem === 'punchingglove' && move.flags?.punch);
}

function suppressedSecondary(move, hit) {
  return !!(move?.sec && hit.atkAbility === 'sheerforce');
}

function targetSecondaryAllowed(move, hit) {
  return !suppressedSecondary(move, hit) && hit.defAbility !== 'shielddust' && hit.defItem !== 'covertcloak';
}

function applyTargetDrop(side, stat, amount, name, ability, item) {
  if (amount < 0 && (['clearbody','whitesmoke','fullmetalbody'].includes(ability) || item === 'clearamulet' ||
      (stat === 'atk' && ability === 'hypercutter') || (stat === 'def' && ability === 'bigpecks'))) return;
  const previous = side.ranks[stat] || 0;
  applyHitRank(side,stat,amount,name,ability);
  if (side.ranks[stat] < previous && ['competitive','defiant'].includes(ability))
    applyHitRank(side,ability === 'competitive' ? 'spa' : 'atk',2,abName(AbilityById[ability]),ability);
}

function applyCertainStatus(side, code, field, ability, otherAbility) {
  if (!code || (side.status && side.status !== 'none') || battleHp(side) <= 0 ||
      ['purifyingsalt','comatose'].includes(ability) || (field.terrain === 'Misty' && isGrounded(side,field,ability)) ||
      (ability === 'leafguard' && ['Sun','Harsh Sunshine'].includes(effectiveWeather(field,ability,otherAbility)))) return;
  const types = effectiveTypes(side);
  if (code === 'brn' && !types.includes('Fire') && !['waterveil','waterbubble','thermalexchange'].includes(ability)) side.status = 'Burn';
  if (code === 'par' && !types.includes('Electric') && ability !== 'limber') side.status = 'Paralysis';
  if (['psn','tox'].includes(code) && (otherAbility === 'corrosion' || !types.some(t=>['Steel','Poison'].includes(t))) &&
      !['immunity','pastelveil'].includes(ability)) side.status = code === 'tox' ? 'Toxic' : 'Poison';
}

function sourceMoveFailure(move, a) {
  if (move.id === 'belch' && !a.ateBerry) return '열매를 먹은 조건 필요';
  if (['snore','sleeptalk'].includes(move.id) && a.status !== 'Sleep' && a.ability !== 'comatose') return '잠듦 필요';
  if (move.id === 'doubleshock' && !(a.types || effectiveTypes(a)).includes('Electric')) return '공격자 전기 타입 필요';
  if (move.id === 'burnup' && !(a.types || effectiveTypes(a)).includes('Fire')) return '공격자 불꽃 타입 필요';
  return '';
}

function transferHitItem(from, to) {
  if (!from.item || to.item || !canRemovePowerItem(from) || (from.ability === 'stickyhold' && battleHp(from)>0)) return;
  const moved = from.item;
  from.item = '';
  to.item = moved;
  if (from.ability === 'unburden') from.unburdenActive = true;
  to.unburdenActive = false;
  recordHitEvent(to,itName(ItemById[moved])+' · 획득');
}

export { sourceMoveFailure, withBattleHp, battleHp, recordHitEvent, applyHitRank, activateTerrainSeed, rememberBerry, prepareDamageSide, berryCures, updateHeldBerry, eligibleContact, suppressedSecondary, targetSecondaryAllowed, applyTargetDrop, applyCertainStatus, transferHitItem };
