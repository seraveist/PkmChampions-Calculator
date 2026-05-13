import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const HTML_PATH = path.join(ROOT, 'pokemon-champions-calculator-v3.html');
const OUTPUT_PATH = path.join(ROOT, 'docs', 'damage-calculator-coverage-matrix.md');

function readJsonScript(html, id) {
  const re = new RegExp(`<script id="${id}" type="application/json">([\\s\\S]*?)<\\/script>`);
  const match = html.match(re);
  if (!match) throw new Error(`Missing JSON script: ${id}`);
  return JSON.parse(match[1]);
}

function normalizeId(name) {
  return (name || '').toString().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function byId(rows) {
  return Object.fromEntries(rows.map(row => [row.id, row]));
}

function md(text) {
  return (text ?? '').toString().replace(/\|/g, '\\|').replace(/\n/g, '<br>');
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

const html = readFileSync(HTML_PATH, 'utf8');
const pokemon = readJsonScript(html, 'data-pokemon');
const moves = readJsonScript(html, 'data-moves');
const abilities = readJsonScript(html, 'data-abilities');
const items = readJsonScript(html, 'data-items');

function readJsonFile(relativePath, fallback) {
  try {
    return JSON.parse(readFileSync(path.join(ROOT, relativePath), 'utf8'));
  } catch (err) {
    if (err?.code === 'ENOENT') return fallback;
    throw err;
  }
}

const moveMechanics = readJsonFile(path.join('data', 'overrides', 'move-mechanics.json'), {});
const abilityMechanics = readJsonFile(path.join('data', 'overrides', 'ability-mechanics.json'), {});
const itemMechanics = readJsonFile(path.join('data', 'overrides', 'item-mechanics.json'), {});
const fieldMechanics = readJsonFile(path.join('data', 'overrides', 'field-mechanics.json'), {});
const entryEffects = readJsonFile(path.join('data', 'overrides', 'entry-effects.json'), { effects: {}, blockers: {} });

const moveById = byId(moves);
const abilityById = byId(abilities);
const itemById = byId(items);

const legalMoveIds = new Set(uniqueSorted(pokemon.flatMap(p => p.ls || [])));
const pokemonAbilityIds = new Set(uniqueSorted(pokemon.flatMap(p => Object.values(p.ab || {}).map(normalizeId))));
const itemIds = new Set(items.map(item => item.id));

const codeFiles = [
  'src/js/01-core.js',
  'src/js/02-engine.js',
  'src/js/03-calc-ui.js',
].map(file => readFileSync(path.join(ROOT, file), 'utf8')).join('\n');

function codeMentions(id) {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`['"\`]${escaped}['"\`]`).test(codeFiles) ||
    new RegExp(`(?:^|[\\s,{])${escaped}\\s*:`, 'm').test(codeFiles);
}

const MOVE_MECHANIC_FIELDS = [
  'variableBpKind',
  'fixedDamageKind',
  'typeChangeKind',
  'categoryChangeKind',
  'effectivenessKind',
  'overrideOffensiveStat',
  'overrideDefensiveStat',
  'overrideOffensivePokemon',
  'overrideDefensivePokemon',
  'ignoreOffensive',
  'ignoreDefensive',
  'ignoreNegativeOffensive',
  'ignorePositiveDefensive',
  'weakenedByGrassyTerrain',
  'breaksProtect',
  'damage',
  'ohko',
];

const ABILITY_MECHANIC_FIELDS = [
  'gasExempt',
  'moldBreakerIgnored',
  'ignoresTargetAbility',
  'suppressesWeather',
  'suppressesItem',
  'grounded',
  'immunities',
  'blocksCritical',
  'criticalOnTargetStatus',
  'blocksBerries',
  'protectBypass',
  'extraHitModifier',
  'multiHitModifier',
  'residualRecovery',
  'resistBerryMod',
  'ignoresScreens',
  'paradoxBoost',
  'speedStatBoosts',
  'typeChange',
  'stabBoost',
  'volatileStab',
  'bpBoosts',
  'aura',
  'reversesAura',
  'supremeOverlord',
  'attackStatBoosts',
  'defensiveAttackMods',
  'defenseStatBoosts',
  'defensiveFinalMods',
  'ignoreOffensiveBoosts',
  'ignoreDefensiveBoosts',
  'weightModifier',
  'blocksItemRemoval',
  'ruinExemption',
];

const ITEM_MECHANIC_FIELDS = [
  'typeBoostType',
  'powerBoostKind',
  'powerBoostMod',
  'attackStatBoost',
  'defenseStatBoost',
  'finalDamageBoost',
  'paradoxActivation',
  'multiHitModifier',
  'koSurvival',
  'hpRecovery',
  'residualRecovery',
  'speedStatBoost',
  'grounded',
  'groundImmunity',
  'ignoresWeatherDamageModifiers',
  'speciesTypeBoost',
  'resistBerryType',
];

const FIELD_MECHANIC_KEYS = {
  weatherdamage: 'weatherDamageMods',
  terrainbp: 'bpMods',
  screens: 'screenFinalMods',
  protect: 'protect',
};

const FIELD_NAMES = {
  weatherdamage: '날씨 대미지 보정',
  terrainbp: '지형 BP 보정',
  screens: '스크린 보정',
  protect: 'Protect 처리',
  magicroom: 'Magic Room',
  wonderroom: 'Wonder Room',
  auroraveil: 'Aurora Veil',
  friendguard: 'Friend Guard',
  battery: 'Battery',
  powerspot: 'Power Spot',
};

function hasField(row, fields) {
  return fields.some(field => row && row[field] !== undefined && row[field] !== null && row[field] !== false);
}

function hasDeclaredMechanics(kind, id) {
  if (kind === 'move') return Object.keys(moveMechanics[id] || {}).length > 0;
  if (kind === 'ability') {
    return Object.keys(abilityMechanics[id] || {}).length > 0 ||
      !!entryEffects.effects?.[id] ||
      Object.values(entryEffects.blockers || {}).some(ids => Array.isArray(ids) && ids.includes(id));
  }
  if (kind === 'item') return Object.keys(itemMechanics[id] || {}).length > 0;
  if (kind === 'field') {
    const key = FIELD_MECHANIC_KEYS[id];
    if (!key) return false;
    const value = fieldMechanics[key];
    return Array.isArray(value) ? value.length > 0 : !!value;
  }
  return false;
}

function hasBuiltMechanics(kind, id) {
  if (kind === 'move') return hasField(moveById[id], MOVE_MECHANIC_FIELDS);
  if (kind === 'ability') return hasField(abilityById[id], ABILITY_MECHANIC_FIELDS);
  if (kind === 'item') return hasField(itemById[id], ITEM_MECHANIC_FIELDS);
  return false;
}

function supportEvidence(row) {
  const evidence = [];
  if (hasDeclaredMechanics(row.kind, row.id)) evidence.push('mechanics');
  if (hasBuiltMechanics(row.kind, row.id)) evidence.push('built-data');
  if (codeMentions(row.id)) evidence.push('code');
  return evidence;
}

function entityName(kind, id) {
  if (kind === 'field') return FIELD_NAMES[id] || id;
  const table = kind === 'move' ? moveById : kind === 'ability' ? abilityById : itemById;
  const row = table[id];
  if (!row) return id;
  const name = row.koName || row.name || id;
  return `${name} (${id})`;
}

function candidate(kind, group, ids, expectation, note = '') {
  return ids.map(id => ({ kind, group, id, expectation, note }));
}

function readCoverageCandidates() {
  const fp = path.join(ROOT, 'data', 'overrides', 'coverage-candidates.json');
  const raw = JSON.parse(readFileSync(fp, 'utf8'));
  const expandKind = kind => (raw[kind] || []).flatMap(group =>
    candidate(kind, group.group, group.ids || [], group.expectation, group.note || '')
  );
  return {
    moveCandidates: expandKind('move'),
    abilityCandidates: expandKind('ability'),
    itemCandidates: expandKind('item'),
    fieldCandidates: expandKind('field'),
  };
}

const { moveCandidates, abilityCandidates, itemCandidates, fieldCandidates } = readCoverageCandidates();

function scopeFor(kind) {
  if (kind === 'move') return legalMoveIds;
  if (kind === 'ability') return pokemonAbilityIds;
  if (kind === 'item') return itemIds;
  return new Set(fieldCandidates.map(row => row.id));
}

function statusFor(row) {
  const inScope = scopeFor(row.kind).has(row.id);
  if (!inScope) return null;
  if (row.expectation === 'deferred') return '보류';
  const detected = supportEvidence(row).length > 0;
  if (row.expectation === 'missing') return detected ? '검토 필요' : '미구현';
  return detected ? '지원 감지' : '지원 근거 없음';
}

function tableFor(title, rows) {
  const scoped = rows
    .map(row => ({ ...row, status: statusFor(row), evidence: supportEvidence(row) }))
    .filter(row => row.status)
    .sort((a, b) => a.group.localeCompare(b.group) || a.id.localeCompare(b.id));

  const lines = [
    `## ${title}`,
    '',
    '| 그룹 | 항목 | 판정 | 지원 근거 | 비고 |',
    '| --- | --- | --- | --- | --- |',
  ];

  for (const row of scoped) {
    lines.push(`| ${md(row.group)} | ${md(entityName(row.kind, row.id))} | ${row.status} | ${row.evidence.length ? row.evidence.join(', ') : '-'} | ${md(row.note)} |`);
  }
  lines.push('');
  return lines.join('\n');
}

function countBy(rows, kind, predicate) {
  return rows.filter(row => row.kind === kind && predicate(row)).length;
}

const allCandidates = [...moveCandidates, ...abilityCandidates, ...itemCandidates, ...fieldCandidates];
const scopedCandidates = allCandidates.filter(row => statusFor(row));
const missingRows = scopedCandidates
  .filter(row => ['미구현', '지원 근거 없음', '검토 필요'].includes(statusFor(row)))
  .sort((a, b) => a.kind.localeCompare(b.kind) || a.group.localeCompare(b.group) || a.id.localeCompare(b.id));
const deferredRows = scopedCandidates
  .filter(row => statusFor(row) === '보류')
  .sort((a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));

const out = [
  '# Damage Calculator Coverage Matrix',
  '',
  '이 문서는 `npm run coverage:matrix`로 생성된다. 직접 수정하지 말고 스크립트의 후보 목록이나 계산 엔진을 수정한 뒤 다시 생성한다.',
  '',
  '범위는 현재 빌드된 Champions 데이터 기준이다.',
  '',
  '지원 근거는 `code`, `mechanics`, `built-data`로 표시한다. 이 표는 구현 후보 추적용이며, 계산 결과 회귀 검증은 golden test가 담당한다.',
  '',
  '| 범위 | 개수 |',
  '| --- | ---: |',
  `| 챔피언스 포켓몬 | ${pokemon.length} |`,
  `| 챔피언스 learnset 기술 | ${legalMoveIds.size} |`,
  `| 챔피언스 포켓몬이 보유한 특성 | ${pokemonAbilityIds.size} |`,
  `| 챔피언스 도구 데이터 | ${itemIds.size} |`,
  `| 추적 후보 기술 | ${countBy(scopedCandidates, 'move', () => true)} |`,
  `| 추적 후보 특성 | ${countBy(scopedCandidates, 'ability', () => true)} |`,
  `| 추적 후보 도구 | ${countBy(scopedCandidates, 'item', () => true)} |`,
  `| 추적 후보 필드/상태 | ${countBy(scopedCandidates, 'field', () => true)} |`,
  '',
  '## 점검 필요 요약',
  '',
  '| 종류 | 그룹 | 항목 | 판정 | 비고 |',
  '| --- | --- | --- | --- | --- |',
  ...(missingRows.length ? missingRows.map(row => `| ${row.kind} | ${md(row.group)} | ${md(entityName(row.kind, row.id))} | ${statusFor(row)} | ${md(row.note)} |`) : ['| - | - | - | 없음 | - |']),
  '',
  '## 보류 요약',
  '',
  '| 종류 | 그룹 | 항목 | 비고 |',
  '| --- | --- | --- | --- |',
  ...(deferredRows.length ? deferredRows.map(row => `| ${row.kind} | ${md(row.group)} | ${md(entityName(row.kind, row.id))} | ${md(row.note)} |`) : ['| - | - | - | - |']),
  '',
  tableFor('기술 매트릭스', moveCandidates),
  tableFor('특성 매트릭스', abilityCandidates),
  tableFor('도구 매트릭스', itemCandidates),
  tableFor('필드/상태 매트릭스', fieldCandidates),
].join('\n');

writeFileSync(OUTPUT_PATH, `${out.trim()}\n`, 'utf8');
console.log(`Wrote ${path.relative(ROOT, OUTPUT_PATH)}`);
