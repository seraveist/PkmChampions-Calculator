import fs from 'fs';
import path from 'path';
import { Dex } from '@pkmn/dex';

const GITHUB_RAW = 'https://raw.githubusercontent.com/smogon/pokemon-showdown/master';
const FILES = {
  pokedex: `${GITHUB_RAW}/data/pokedex.ts`,
  formats: `${GITHUB_RAW}/data/mods/champions/formats-data.ts`,
  moves: `${GITHUB_RAW}/data/mods/champions/moves.ts`,
  abilities: `${GITHUB_RAW}/data/mods/champions/abilities.ts`,
  items: `${GITHUB_RAW}/data/mods/champions/items.ts`,
  learnsets: `${GITHUB_RAW}/data/mods/champions/learnsets.ts`
};

async function fetchRaw(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}`);
  return await res.text();
}

async function build() {
  console.log('🚀 포켓몬스터 챔피언스 V2 자동화 빌드 시작...');

  // 1. @pkmn/dex 에서 본가 9세대 기본 데이터 추출
  console.log('📦 본가(Gen 9) 기본 데이터 추출 중...');
  const basePokemon = [], baseMoves = [], baseAbilities = [], baseItems = [];
  
  for (const s of Dex.species.all()) {
    if (s.num > 0) basePokemon.push({ id: s.id, name: s.name, baseSpecies: s.baseSpecies, forme: s.forme, types: s.types, baseStats: s.baseStats, abilities: s.abilities, nfe: s.nfe, isMega: /^Mega/.test(s.forme), isPrimal: /^Primal/.test(s.forme) });
  }
  for (const m of Dex.moves.all()) {
    if (m.num > 0 && !m.isZ && !m.isMax) baseMoves.push({ id: m.id, name: m.name, type: m.type, category: m.category, basePower: m.basePower, accuracy: m.accuracy === true ? 0 : m.accuracy, priority: m.priority, flags: m.flags || {}, multihit: m.multihit, shortDesc: m.shortDesc });
  }
  for (const a of Dex.abilities.all()) {
    if (a.num > 0) baseAbilities.push({ id: a.id, name: a.name, shortDesc: a.shortDesc });
  }
  for (const i of Dex.items.all()) {
    if (i.num > 0) baseItems.push({ id: i.id, name: i.name, shortDesc: i.shortDesc, megaStone: i.megaStone });
  }

  // 2. 쇼다운 챔피언스 서버 데이터 가져오기
  console.log('📡 쇼다운 서버에서 챔피언스 패치 데이터를 가져오는 중...');
  const [pokedexTs, formatsTs, movesTs, abilitiesTs, itemsTs, learnsetsTs] = await Promise.all([
    fetchRaw(FILES.pokedex), fetchRaw(FILES.formats), fetchRaw(FILES.moves),
    fetchRaw(FILES.abilities), fetchRaw(FILES.items), fetchRaw(FILES.learnsets)
  ]);

  // 3. TypeScript 데이터 파싱 (정규식)
  console.log('🔍 TypeScript 패치 노트 파싱 중...');
  const allowedPokemon = [], bannedPokemon = [];
  const formatBlocks = formatsTs.split(/\n\t([a-z0-9]+):\s*\{/);
  for (let i = 1; i < formatBlocks.length; i += 2) {
    if (formatBlocks[i+1].includes('tier: "Illegal"')) bannedPokemon.push(formatBlocks[i]);
    else allowedPokemon.push(formatBlocks[i]);
  }

  const dexOverrides = {};
  const dexBlocks = pokedexTs.split(/\n\t([a-z0-9]+):\s*\{/);
  for (let i = 1; i < dexBlocks.length; i += 2) {
    const block = dexBlocks[i+1];
    const statsMatch = block.match(/baseStats:\s*\{\s*hp:\s*(\d+),\s*atk:\s*(\d+),\s*def:\s*(\d+),\s*spa:\s*(\d+),\s*spd:\s*(\d+),\s*spe:\s*(\d+)\s*\}/);
    const typesMatch = block.match(/types:\s*\[([^\]]+)\]/);
    const abMatch = block.match(/abilities:\s*\{([^}]+)\}/);
    
    if (statsMatch || typesMatch || abMatch) {
      const override = { baseStats: statsMatch ? { hp: +statsMatch[1], atk: +statsMatch[2], def: +statsMatch[3], spa: +statsMatch[4], spd: +statsMatch[5], spe: +statsMatch[6] } : null };
      if (typesMatch) override.types = typesMatch[1].replace(/"/g, '').split(',').map(s=>s.trim());
      if (abMatch) {
        override.abilities = {};
        abMatch[1].split(',').forEach(p => {
          const [k, v] = p.split(':').map(s=>s.trim().replace(/"/g, ''));
          if (k && v) override.abilities[k] = v;
        });
      }
      dexOverrides[dexBlocks[i]] = override;
    }
  }

  const learnsets = {};
  const lsBlocks = learnsetsTs.split(/\n\t([a-z0-9]+):\s*\{/);
  for (let i = 1; i < lsBlocks.length; i += 2) {
    const match = lsBlocks[i+1].match(/learnset:\s*\{([^}]+)\}/);
    if (match) {
      learnsets[lsBlocks[i]] = Array.from(match[1].matchAll(/([a-z0-9]+):\s*\[/g)).map(m => m[1]);
    }
  }

  const moveOverrides = {};
  const moveBlocks = movesTs.split(/\n\t([a-z0-9]+):\s*\{/);
  for (let i = 1; i < moveBlocks.length; i += 2) {
    const block = moveBlocks[i+1];
    const bpMatch = block.match(/basePower:\s*(\d+)/);
    const override = {};
    if (bpMatch) override.basePower = +bpMatch[1];
    if (block.includes('slicing: 1')) override.slicing = true;
    if (Object.keys(override).length > 0) moveOverrides[moveBlocks[i]] = override;
  }

  const bannedItems = [];
  const itemBlocks = itemsTs.split(/\n\t([a-z0-9]+):\s*\{/);
  for (let i = 1; i < itemBlocks.length; i += 2) {
    if (itemBlocks[i+1].includes('isNonstandard: "Past"')) bannedItems.push(itemBlocks[i]);
  }

  // 4. 챔피언스 전용 필터링 및 병합
  console.log('⚙️ 챔피언스 환경(Reg.A) 데이터 병합 중...');
  
  // 챔피언스 전용 고유 메가진화를 basePokemon에 미리 추가 (pokedex.ts에서 읽어옴)
  for (const [id, data] of Object.entries(dexOverrides)) {
    if (id.includes('mega') && !basePokemon.find(p => p.id === id)) {
      basePokemon.push({
        id, name: id, baseSpecies: id.replace('mega', ''), forme: 'Mega',
        types: data.types || ['Normal'], baseStats: data.baseStats || {hp:100,atk:100,def:100,spa:100,spd:100,spe:100},
        abilities: data.abilities || {'0':'Illuminate'}, isMega: true
      });
    }
  }

  const finalPokemon = basePokemon
    .filter(p => allowedPokemon.includes(p.id) || p.isMega || p.isPrimal)
    .filter(p => !bannedPokemon.includes(p.id))
    .map(p => {
      const patch = dexOverrides[p.id];
      if (patch) {
        if (patch.baseStats) p.baseStats = patch.baseStats;
        if (patch.types) p.types = patch.types;
        if (patch.abilities) p.abilities = patch.abilities;
      }
      const ls = learnsets[p.id] || learnsets[(p.baseSpecies||'').toLowerCase().replace(/[^a-z0-9]/g, '')] || [];
      return {
        id: p.id, name: p.name, koName: p.name, base: p.baseSpecies,
        types: p.types, bs: p.baseStats, bst: Object.values(p.baseStats).reduce((a,b)=>a+b,0),
        ab: p.abilities, mega: p.isMega || undefined, ls: ls.length > 0 ? ls : undefined
      };
    });

  const finalMoves = baseMoves
    .filter(m => m.category === 'Status' || m.basePower > 0)
    .map(m => {
      const patch = moveOverrides[m.id];
      if (patch) {
        if (patch.basePower) m.basePower = patch.basePower;
        if (patch.slicing) m.flags.slicing = 1;
      }
      return {
        id: m.id, name: m.name, koName: m.name, type: m.type, cat: m.category,
        bp: m.basePower, acc: m.accuracy, pri: m.priority, flags: m.flags, mh: m.multihit || undefined, desc: m.shortDesc
      };
    });

  const finalItems = baseItems
    .filter(i => !bannedItems.includes(i.id) && !i.name.includes('TR') && !i.name.includes('TM'))
    .map(i => ({ id: i.id, name: i.name, koName: i.name, ms: i.megaStone || undefined, desc: i.shortDesc }));

  const finalAbilities = baseAbilities.map(a => ({
    id: a.id, name: a.name, koName: a.name, desc: a.shortDesc
  }));

  // 5. HTML에 주입
  console.log('🏗️ 최종 HTML 파일 생성 중...');
  const templatePath = path.join('src', 'calc-template.html');
  if (!fs.existsSync(templatePath)) throw new Error(`Template not found at ${templatePath}`);
  
  const template = fs.readFileSync(templatePath, 'utf8');
  const outHTML = template
    .replace('__POKEMON_DATA__', JSON.stringify(finalPokemon))
    .replace('__MOVES_DATA__', JSON.stringify(finalMoves))
    .replace('__ABILITIES_DATA__', JSON.stringify(finalAbilities))
    .replace('__ITEMS_DATA__', JSON.stringify(finalItems));

  fs.writeFileSync('./pokemon-champions-calculator-v3.html', outHTML);
  console.log('🎉 빌드 성공! (pokemon-champions-calculator-v3.html 생성 완료)');
}

build().catch(err => console.error('❌ 빌드 에러:', err));