/**
 * calc-template.html에 dist/*.json 데이터를 주입해서
 * pokemon-champions-calculator-v3.html 생성
 */
import fs from 'fs';

const template = fs.readFileSync('./calc-template.html', 'utf8');
const pokemon   = fs.readFileSync('./dist/pokemon.json', 'utf8');
const moves     = fs.readFileSync('./dist/moves.json', 'utf8');
const abilities = fs.readFileSync('./dist/abilities.json', 'utf8');
const items     = fs.readFileSync('./dist/items.json', 'utf8');

const out = template
  .replace('__POKEMON_DATA__', pokemon)
  .replace('__MOVES_DATA__', moves)
  .replace('__ABILITIES_DATA__', abilities)
  .replace('__ITEMS_DATA__', items);

fs.writeFileSync('./pokemon-champions-calculator-v3.html', out);
const size = (fs.statSync('./pokemon-champions-calculator-v3.html').size / 1024).toFixed(1);
console.log(`✓ pokemon-champions-calculator-v3.html 생성 완료 (${size} KB)`);
