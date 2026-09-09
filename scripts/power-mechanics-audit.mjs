import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadTsModule,applyModOverrides} from './ts-loader.mjs';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const html=fs.readFileSync(path.join(root,'pokemon-champions-calculator-v3.html'),'utf8');
const data=kind=>JSON.parse(html.match(new RegExp(`<script id="data-${kind}" type="application/json">([\\s\\S]*?)<\\/script>`))[1]);
const allyFields={battery:'공격 아군 배터리',powerspot:'공격 아군 파워스폿',friendguard:'수비 아군 프렌드가드'};
const external={flowergift:'체리꼬 자신 보정; 다른 아군에 주는 보정은 별도 필드 입력 미지원',steelyspirit:'자신 강철 보정; 추가 아군 중첩 미지원',plus:'아군 조건 수동 입력',minus:'아군 조건 수동 입력',rivalry:'성별 조건 수동 입력',stakeout:'교체 조건 수동 입력',slowstart:'활성 기간 수동 입력'};
const runtimePolicies={damp:'자폭 계열 기술 차단은 카드 안내, 피해 산출 계속',armortail:'선제 기술 차단은 카드 안내, 피해 산출 계속',dazzling:'선제 기술 차단은 카드 안내, 피해 산출 계속',queenlymajesty:'선제 기술 차단은 카드 안내, 피해 산출 계속',cheekpouch:'회복·반감열매 섭취 때 최대 HP 1/3 추가 회복',stamina:'같은 기술의 후속 타격에 방어 상승 반영',weakarmor:'같은 물리 기술의 후속 타격에 방어 하락·스피드 상승 반영',watercompaction:'같은 물 기술의 후속 타격에 방어 상승 반영',mummy:'접촉 후 후속 타격의 공격측 특성 변경',lingeringaroma:'접촉 후 후속 타격의 공격측 특성 변경',wanderingspirit:'접촉 후 후속 타격의 특성 교환',sandspit:'후속 타격에 모래바람 반영',seedsower:'후속 타격에 그래스필드 반영',defiant:'위협 자동 적용에 공격 상승 반응 포함',competitive:'위협 자동 적용에 특공 상승 반응 포함',contrary:'위협·그로우펀치의 자동 랭크 변화 반전',simple:'위협·그로우펀치의 자동 랭크 변화 2배',rattled:'위협 반응 스피드 상승',guarddog:'위협 반응 공격 상승'};
const lines=['# 결정력 계산기 특성·도구 전수 분류','','현재 빌드에 포함된 모든 ID의 규칙과 원본 이벤트를 대조하는 목록이다. 규칙 존재는 모든 기술·환경 조합의 정확성 검증을 뜻하지 않는다. 정책과 검증 한계는 [수정 검토서](damage-purpose-review.md)를 참고한다.','','생성: `node scripts/power-mechanics-audit.mjs`'];
const rows={};
for(const [kind,name] of [['abilities','Abilities'],['items','Items']]){
 const upstream=applyModOverrides(loadTsModule(path.join(root,'data',kind+'.ts'))[name],loadTsModule(path.join(root,'data/mods/champions',kind+'.ts'))[name]);
 const fields=JSON.parse(fs.readFileSync(path.join(root,'data/overrides',kind==='abilities'?'ability-mechanics.json':'item-mechanics.json'),'utf8'));
 rows[kind]=data(kind).map(entry=>{
  const m=fields[entry.id]||{};const policy=[];
  if(m.immunities||m.groundImmunity||m.damageBlock||m.ohkoBlock||entry.id==='wonderguard')policy.push('무효·차단은 카드 안내, 피해 산출 계속');
  if(m.koSurvival||entry.id==='focusband')policy.push('생존은 카드 안내, KO 제한 제외');
  if(kind==='items'&&(m.hpRecovery||m.residualRecovery))policy.push('생존 후 회복; KO 확률에 반영');
  if(kind==='abilities'&&m.residualRecovery)policy.push('특성의 턴 종료 회복은 제외');
  if(m.resistBerryType)policy.push('직접 피해 감소, 첫 타격 후 1회 소비');
  if(allyFields[entry.id])policy.push('더블 필드 입력: '+allyFields[entry.id]);
  if(external[entry.id])policy.push(external[entry.id]);
  if(kind==='abilities'&&runtimePolicies[entry.id])policy.push(runtimePolicies[entry.id]);
  if(Object.keys(m).some(k=>/Boost|Mods|Mod$|typeChange|aura|weight|Critical|burnBypass|ruinExemption|supreme/.test(k)))policy.push('직접 보정은 입력 조건에 따라 적용');
  if(m.speedStatBoosts||m.speedStatBoost)policy.push('공통 실효 스피드 계산');
  if(!policy.length)policy.push(Object.keys(m).length?'특성 억제·접지·진입 등 보조 규칙':'상태·명중·추가 행동 등: 직접 피해 배율 규칙 없음');
  return {id:entry.id,name:entry.koName,policy:policy.join('; '),mechanicKeys:Object.keys(m),hooks:Object.keys(upstream[entry.id]||{}).filter(k=>typeof upstream[entry.id][k]==='function')};
 });
 lines.push('',`## ${kind==='abilities'?'특성':'도구'} ${rows[kind].length}개`,'','| ID | 이름 | 계산기 처리 | 구현 규칙 | 원본 이벤트 |','| --- | --- | --- | --- | --- |');
 for(const r of rows[kind])lines.push(`| ${r.id} | ${r.name} | ${r.policy} | ${r.mechanicKeys.join(', ')||'—'} | ${r.hooks.join(', ')||'—'} |`);
}
fs.writeFileSync(path.join(root,'docs/power-mechanics-audit.md'),lines.join('\n')+'\n');
fs.writeFileSync(path.join(root,'docs/power-mechanics-audit.json'),JSON.stringify(rows,null,2)+'\n');
console.log(`Classified ${rows.abilities.length} abilities and ${rows.items.length} items.`);
