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
  return (name || '').toString().toLowerCase().replace(/[\s'\-()]/g, '');
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

function entityName(kind, id) {
  const table = kind === 'move' ? moveById : kind === 'ability' ? abilityById : itemById;
  const row = table[id];
  if (!row) return id;
  const name = row.koName || row.name || id;
  return `${name} (${id})`;
}

function candidate(kind, group, ids, expectation, note = '') {
  return ids.map(id => ({ kind, group, id, expectation, note }));
}

const moveCandidates = [
  ...candidate('move', '가변 위력', [
    'gyroball', 'electroball', 'heatcrash', 'heavyslam', 'lowkick', 'grassknot',
    'eruption', 'waterspout', 'flail', 'reversal', 'hardpress', 'hex',
    'infernalparade', 'barbbarrage', 'venoshock', 'facade', 'knockoff',
    'boltbeak', 'fishiousrend', 'payback', 'avalanche', 'assurance',
    'risingvoltage', 'expandingforce', 'mistyexplosion', 'gravapple',
    'solarbeam', 'solarblade', 'weatherball', 'terrainpulse', 'storedpower',
    'powertrip', 'lastrespects', 'temperflare', 'stompingtantrum',
    'acrobatics', 'poltergeist', 'steelroller', 'tripleaxel', 'beatup',
  ], 'supported', 'computeVariableBp()에서 처리'),
  ...candidate('move', '타입/분류 변경', [
    'weatherball', 'terrainpulse', 'terablast', 'terastarstorm', 'photongeyser',
  ], 'supported', 'prelude stage에서 타입 또는 분류 결정'),
  ...candidate('move', '상성 예외', ['freezedry', 'flyingpress'], 'supported', 'getMoveEffectiveness()에서 처리'),
  ...candidate('move', '공격/방어 스탯 예외', ['psyshock', 'psystrike', 'secretsword', 'foulplay'], 'supported', '방어측 방어 또는 대상 공격을 사용'),
  ...candidate('move', '고정/비표준 대미지', [
    'seismictoss', 'nightshade', 'dragonrage', 'sonicboom', 'superfang',
    'naturesmadness', 'finalgambit', 'endeavor', 'fissure', 'guillotine',
    'horndrill', 'sheercold',
  ], 'supported', 'fixedDamageAmount()에서 처리'),
  ...candidate('move', '검토 필요', ['bodypress'], 'missing', '공격측 방어 실수치/랭크를 공격값으로 사용해야 함'),
  ...candidate('move', '보류', ['counter', 'mirrorcoat', 'metalburst', 'comeuppance'], 'deferred', '이전 피해량 컨텍스트가 필요'),
  ...candidate('move', '보류', ['ficklebeam'], 'deferred', '랜덤 강화 분기 표현이 필요'),
];

const abilityCandidates = [
  ...candidate('ability', '자동 진입 효과', [
    'drought', 'orichalcumpulse', 'drizzle', 'sandstream', 'sandspit',
    'snowwarning', 'desolateland', 'primordialsea', 'electricsurge',
    'hadronengine', 'grassysurge', 'psychicsurge', 'mistysurge',
    'intrepidsword', 'dauntlessshield', 'embodyaspectteal',
    'embodyaspectwellspring', 'embodyaspecthearthflame',
    'embodyaspectcornerstone', 'intimidate', 'download',
    'beadsofruin', 'tabletsofruin', 'swordofruin', 'vesselofruin',
  ], 'supported', 'makeCalcState()에서 source state를 복제한 뒤 적용'),
  ...candidate('ability', '날씨/특성 억제', [
    'airlock', 'cloudnine', 'neutralizinggas', 'moldbreaker', 'teravolt', 'turboblaze',
  ], 'supported'),
  ...candidate('ability', '면역/상성', [
    'levitate', 'waterabsorb', 'dryskin', 'stormdrain', 'voltabsorb',
    'lightningrod', 'motordrive', 'flashfire', 'wellbakedbody',
    'sapsipper', 'eartheater', 'earthenateatr', 'soundproof',
    'bulletproof', 'scrappy', 'mindseye', 'terashell',
  ], 'supported'),
  ...candidate('ability', '대미지 보정', [
    'darkaura', 'fairyaura', 'aurabreak', 'flareboost', 'toxicboost',
    'purifyingsalt', 'waterbubble', 'neuroforce', 'tintedlens', 'sniper',
    'filter', 'prismarmor', 'solidrock', 'multiscale', 'shadowshield',
    'fluffy', 'punkrock', 'thickfat', 'heatproof',
  ], 'supported'),
  ...candidate('ability', '공격/BP/방어 보정', [
    'technician', 'toughclaws', 'ironfist', 'strongjaw', 'megalauncher',
    'sharpness', 'reckless', 'steelworker', 'steelyspirit', 'dragonsmaw',
    'transistor', 'rockypayload', 'sheerforce', 'sandforce', 'normalize',
    'analytic', 'supremeoverlord', 'hugepower', 'purepower', 'guts',
    'solarpower', 'flowergift', 'protosynthesis', 'quarkdrive', 'blaze',
    'torrent', 'overgrow', 'swarm', 'defeatist', 'hustle', 'gorillatactics',
    'furcoat', 'icescales', 'marvelscale', 'grasspelt', 'unaware',
  ], 'supported'),
  ...candidate('ability', '방어 예외/아이템 상호작용', [
    'battlearmor', 'shellarmor', 'sturdy', 'disguise', 'iceface',
    'klutz', 'heavymetal', 'lightmetal', 'stickyhold', 'unnerve',
    'asoneglastrier', 'asonespectrier', 'ripen',
  ], 'supported'),
  ...candidate('ability', '위협 차단', [
    'innerfocus', 'oblivious', 'owntempo', 'clearbody', 'fullmetalbody',
    'whitesmoke', 'mypace', 'rattled', 'guarddog',
  ], 'supported', 'ENTRY_EFFECTS의 위협 적용 시 차단'),
];

const typeBoostItems = [
  'charcoal', 'mysticwater', 'miracleseed', 'magnet', 'nevermeltice',
  'blackbelt', 'poisonbarb', 'softsand', 'sharpbeak', 'twistedspoon',
  'silverpowder', 'hardstone', 'spelltag', 'dragonfang', 'blackglasses',
  'metalcoat', 'fairyfeather', 'silkscarf',
];
const plateItems = [
  'flameplate', 'splashplate', 'zapplate', 'meadowplate', 'icicleplate',
  'fistplate', 'toxicplate', 'earthplate', 'skyplate', 'mindplate',
  'insectplate', 'stoneplate', 'spookyplate', 'dracoplate', 'dreadplate',
  'ironplate', 'pixieplate',
];
const resistBerries = [
  'occaberry', 'passhoberry', 'wacanberry', 'rindoberry', 'yacheberry',
  'chopleberry', 'kebiaberry', 'shucaberry', 'cobaberry', 'payapaberry',
  'tangaberry', 'chartiberry', 'kasibberry', 'habanberry', 'colburberry',
  'baberiberry', 'chilanberry', 'roseliberry',
];

const itemCandidates = [
  ...candidate('item', '타입 위력 보정', [...typeBoostItems, ...plateItems], 'supported'),
  ...candidate('item', '공격/방어 실수치 보정', [
    'choiceband', 'choicespecs', 'assaultvest', 'eviolite', 'metalpowder',
    'deepseatooth', 'deepseascale', 'thickclub', 'lightball',
  ], 'supported'),
  ...candidate('item', '최종 대미지/BP 보정', [
    'lifeorb', 'expertbelt', 'muscleband', 'wiseglasses', 'punchingglove',
  ], 'supported'),
  ...candidate('item', '날씨/필드/특성 조건', ['utilityumbrella', 'boosterenergy'], 'supported'),
  ...candidate('item', 'KO 추정', ['focussash', 'sitrusberry', 'leftovers'], 'supported', 'hkoLabel()/simulateKO()에서 처리'),
  ...candidate('item', '반감 열매', resistBerries, 'supported', 'Unnerve/As One/Ripen 반영'),
  ...candidate('item', '가변 위력/접지 보조', ['ironball', 'airballoon', 'loadeddice'], 'supported'),
];

function scopeFor(kind) {
  if (kind === 'move') return legalMoveIds;
  if (kind === 'ability') return pokemonAbilityIds;
  return itemIds;
}

function statusFor(row) {
  const inScope = scopeFor(row.kind).has(row.id);
  if (!inScope) return null;
  if (row.expectation === 'deferred') return '보류';
  if (row.expectation === 'missing') return codeMentions(row.id) ? '검토 필요' : '미구현';
  return codeMentions(row.id) ? '지원 감지' : '코드 감지 실패';
}

function tableFor(title, rows) {
  const scoped = rows
    .map(row => ({ ...row, status: statusFor(row), mentioned: codeMentions(row.id) }))
    .filter(row => row.status)
    .sort((a, b) => a.group.localeCompare(b.group) || a.id.localeCompare(b.id));

  const lines = [
    `## ${title}`,
    '',
    '| 그룹 | 항목 | 판정 | 코드 감지 | 비고 |',
    '| --- | --- | --- | --- | --- |',
  ];

  for (const row of scoped) {
    lines.push(`| ${md(row.group)} | ${md(entityName(row.kind, row.id))} | ${row.status} | ${row.mentioned ? 'Y' : 'N'} | ${md(row.note)} |`);
  }
  lines.push('');
  return lines.join('\n');
}

function countBy(rows, kind, predicate) {
  return rows.filter(row => row.kind === kind && predicate(row)).length;
}

const allCandidates = [...moveCandidates, ...abilityCandidates, ...itemCandidates];
const scopedCandidates = allCandidates.filter(row => statusFor(row));
const missingRows = scopedCandidates
  .filter(row => ['미구현', '코드 감지 실패', '검토 필요'].includes(statusFor(row)))
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
  '| 범위 | 개수 |',
  '| --- | ---: |',
  `| 챔피언스 포켓몬 | ${pokemon.length} |`,
  `| 챔피언스 learnset 기술 | ${legalMoveIds.size} |`,
  `| 챔피언스 포켓몬이 보유한 특성 | ${pokemonAbilityIds.size} |`,
  `| 챔피언스 도구 데이터 | ${itemIds.size} |`,
  `| 추적 후보 기술 | ${countBy(scopedCandidates, 'move', () => true)} |`,
  `| 추적 후보 특성 | ${countBy(scopedCandidates, 'ability', () => true)} |`,
  `| 추적 후보 도구 | ${countBy(scopedCandidates, 'item', () => true)} |`,
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
].join('\n');

writeFileSync(OUTPUT_PATH, `${out.trim()}\n`, 'utf8');
console.log(`Wrote ${path.relative(ROOT, OUTPUT_PATH)}`);
