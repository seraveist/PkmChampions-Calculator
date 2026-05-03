#!/usr/bin/env node
/**
 * 전체 빌드 파이프라인 (오버라이드 포함)
 *
 * 순서:
 *   1) build-base-data.mjs   - @pkmn/dex 원본 추출
 *   2) build-ko-names.mjs    - 포켓몬 한국어 이름 매핑
 *   3) (선택) fetch-ko-from-pokeapi.mjs - PokéAPI에서 기술/특성/아이템 한국어
 *   4) merge-ko.mjs          - 한국어 병합
 *   5) build-final-data.mjs  - 챔피언스 환경 필터링 + 압축
 *   6) apply-overrides.mjs   - 챔피언스 한정 변경사항 적용
 *   7) inject-data.mjs       - 최종 HTML 빌드
 */
import { execSync } from 'child_process';
import fs from 'fs';

const steps = [
  ['1. 기본 데이터 추출', 'build-base-data.mjs'],
  ['2. 포켓몬 한국어 매핑', 'build-ko-names.mjs'],
  ['3. 기술/특성/아이템 한국어 (선택)', 'fetch-ko-from-pokeapi.mjs', true],
  ['4. 한국어 병합', 'merge-ko.mjs'],
  ['5. 챔피언스 환경 필터링', 'build-final-data.mjs'],
  ['6. 챔피언스 오버라이드 적용', 'apply-overrides.mjs'],
  ['7. 최종 HTML 빌드', 'inject-data.mjs']
];

console.log('━'.repeat(60));
console.log('포켓몬 챔피언스 계산기 빌드');
console.log('━'.repeat(60) + '\n');

for (const [name, file, optional] of steps) {
  console.log(`▶ ${name}`);
  try {
    execSync(`node ${file}`, { stdio: 'inherit' });
  } catch (e) {
    if (optional) console.log(`  (선택 단계 - 스킵)`);
    else throw e;
  }
  console.log();
}

console.log('━'.repeat(60));
console.log('✓ 빌드 완료: pokemon-champions-calculator-v3.html');
console.log('━'.repeat(60));
