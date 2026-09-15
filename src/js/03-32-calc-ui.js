import { RotomUI } from './01-10-rotom-ui.js';
import { AbilityById, ItemById, MoveById, PokemonById, abName, escapeHTML, getStabMod, mvName } from './01-core.js';
import { calculatePowerDamage, displayName, formatCalcMultiplier, hkoLabel, powerMoveField } from './02-engine.js';
import { calcMoveConditionIssue, calcMoveWithConditions, isFixedPowerMove, state } from './03-10-calc-state.js';
import { renderToolTypePills } from './03-11-calc-shared-render.js';
import { estimateMovePower } from './03-20-calc-combobox.js';
import { makeCalcState } from './03-40-calc-entry-effects.js';

/* Approved calculator composition, using the shared UI and production damage engine. */
const powerUiStats=['hp','atk','def','spa','spd','spe'];
const powerUiCategoryNames={Physical:'물리',Special:'특수',Status:'변화'};
const powerUiEscape=value=>escapeHTML(String(value ?? ''));
const powerUiType=type=>renderToolTypePills([type]);
let powerUiMoveSlot=0;
let powerUiStatusTimer;
let powerUiEffectNames = null;

function powerUiNamedEffects() {
  return powerUiEffectNames ||= [...Object.values(AbilityById), ...Object.values(ItemById)]
    .map(data => displayName(data)).filter(Boolean).sort((a,b) => b.length-a.length);
}

function powerUiCalculateSlot(slot, calc = makeCalcState()) {
  const base = MoveById[calc.atk.moves[slot]];
  const movePower = estimateMovePower(state.atk, base ? calcMoveWithConditions(base,state.atk,slot) : null, state.def,
    {...state.field, isCritical:!!state.atk.moveCriticalOverrides[slot]});
  if (!base || base.cat === 'Status' || !PokemonById[calc.atk.pokemonIdx] || !PokemonById[calc.def.pokemonIdx]) return { base, calc, movePower };
  const move = calcMoveWithConditions(base,calc.atk,slot);
  const field = {...powerMoveField(calc.atk,calc.def,move,calc.field), isCritical:!!calc.atk.moveCriticalOverrides[slot]};
  const result = calculatePowerDamage(calc.atk,calc.def,move,field);
  if (!result) return { base,move,calc,movePower,issue:calcMoveConditionIssue(move,calc.atk,calc.def,field) };
  const ko = hkoLabel(result.damages,result.defHP,calc.def,calc.field,result.koContext,result.hitProfile);
  return { base,move,result,ko,calc,movePower };
}

// Compact presentation only; the engine's damage and KO metadata stay intact.
function powerUiResultNote(note) {
  const text = String(note).trim();
  if (/^현재 HP \d+ 기준$/.test(text) || text === '타격별 피해·열매 소비 반영') return '';
  if (text === '이후 회복 없음' || text === '고정 대미지' || text === '효과 없음') return '';
  if (!text.includes('자속')) {
    const namedEffect = powerUiNamedEffects()
      .find(name => text === name || [':', '×', ' '].some(separator => text.startsWith(name+separator)));
    if (namedEffect) return namedEffect;
  }
  if (text.startsWith('이번 턴 마지막으로 받은 HP 피해량')) return '마지막 피격량 필요';
  if (text.startsWith('받은 공격의 물리·특수 분류')) return '피격 분류 필요';
  if (text.startsWith('던질 수 있는 도구를 선택')) return '내던지기 도구 필요';
  if (text.startsWith('비축 횟수를 1~3회')) return '비축 1–3회 필요';
  return text
    .replace(/^.+? 타입: (.+ 무효)$/, '$1')
    .replace(/^(.+?): .+ 무효$/, '$1 무효')
    .replace(': 첫 공격 차단', ' 차단')
    .replace(': 생존 효과', ' 생존')
    .replace(' 회복 반영', ' 회복')
    .replace('이후 회복 없음', '회복 없음')
    .replace(/^(\d+)타 이내 확정$/, '최대 $1타')
    .replace('타격별 반영', '매 타격')
    .replace('타격별 공격 상승', '매 타격 공격↑')
    .replace('공격랭크', '공격')
    .replace('방어랭크', '방어')
    .replace(/^(물리|특수) 공격을 받은 조건에서만 사용할 수 있습니다\.$/, '$1 피격 필요')
    .replace('상대가 도구를 지녀야 사용할 수 있습니다.', '상대 도구 필요')
    .replace('필드가 있어야 사용할 수 있습니다.', '필드 필요')
    .replace('직접 입력한 위력이 0입니다.', '위력 0')
    .replace('현재 조건에서는 피해를 계산할 수 없습니다.', '계산 불가')
    .replace('대검돌격 이후 받는 피해', '대검돌격 후 피해')
    .replace(/\(쓰러진 아군 (\d+)\)/, '(기절 $1)')
    .replace(/\s*×\s*/g, ' ×')
    .trim();
}

function powerUiMovePresentation(slot, calc, calculated = powerUiCalculateSlot(slot,calc)) {
  const {base,move,result,ko,issue,movePower} = calculated;
  const powerMarkup = `<div class="move-power"><span class="move-power-label">결정력</span><strong class="move-power-value">${typeof movePower.eff === 'number' ? movePower.eff.toLocaleString('ko-KR') : '—'}</strong></div>`;
  const pickerContent = `<span class="move-name picker-label">${powerUiEscape(base ? mvName(base) : '기술 선택')}</span>${base ? `<span class="move-meta">${powerUiType(result?.moveType || move?.type || base.type)}<span>${powerUiCategoryNames[base.cat]}</span><span>${result?.bp ? `위력 ${result.bp}` : base.cat === 'Status' ? '' : base.bp ? `위력 ${base.bp}` : '조건부'}</span></span>` : ''}`;

  let damage = `<span class="empty-damage">${base?.cat === 'Status' ? '변화기' : issue ? '조건 입력 필요' : '—'}</span>`;
  const notes = [];
  const addNote = (text, effect = false) => {
    const label = powerUiResultNote(text);
    if (label) notes.push(`<span class="ui-tag${effect ? ' effect-note' : ''}">${powerUiEscape(label)}</span>`);
  };
  if (result) {
    const min = Math.min(...result.damages), max = Math.max(...result.damages);
    damage = `<div class="damage-text"><span class="damage-amount">${result.minPct.toFixed(1)}–${result.maxPct.toFixed(1)}<small>%</small></span><span class="damage-raw">${min === max ? min : `${min}–${max}`} HP</span></div><div class="ui-meter damage-bar" aria-hidden="true"><span class="ui-meter-fill range" data-damage-width="${Math.min(100,result.maxPct)}"></span><span class="ui-meter-fill" data-damage-width="${Math.min(100,result.minPct)}"></span></div>`;
    for (const note of [...(result.immunityNotes || []),...(result.survivalNotes || [])]) addNote(note,true);
    if (result.hitCounts?.some(count=>count>1)) addNote(`${Math.min(...result.hitCounts)===Math.max(...result.hitCounts) ? result.hitCounts[0] : `${Math.min(...result.hitCounts)}–${Math.max(...result.hitCounts)}`}회 적중`);
    if (!isFixedPowerMove(move)) {
      const ability = result.koContext?.atkAbility || '';
      const stab = getStabMod(calc.atk,result.moveType,ability);
      if (stab > 4096) {
        const data = AbilityById[ability];
        const source = data?.volatileStab || data?.stabBoost ? `${abName(data)} ` : '';
        addNote(`${source}자속${formatCalcMultiplier(stab)}`);
      }
    }
    if (state.atk.moveCriticalOverrides[slot] && !result.mods?.some(mod => mod.includes('급소'))) addNote('급소');
    for (const mod of result.mods || []) if (!['테라 매칭 STAB×2','다능 STAB×2.25'].includes(mod)) addNote(mod);
    if (ko.sub) for (const note of ko.sub.split(' · ')) addNote(note);
  } else if (issue) addNote(issue);
  const koMarkup = ko ? `<strong>${powerUiEscape([ko.label,ko.turns].filter(Boolean).join(' '))}</strong>${ko.pct ? ` <span class="ko-probability">${powerUiEscape(ko.pct)} 확률</span>` : ''}` : '';
  return {
    powerMarkup,  pickerContent, damage, koMarkup,
    koRandom: ko?.label === '난수', notes: [...new Set(notes)].join(''),
    moveName: base ? mvName(base) : '',
    pickerDisabled: !PokemonById[state.atk.pokemonIdx],
    settingsDisabled: !base || base.cat === 'Status',
  };
}

function powerUiMoveMarkup(slot, calc, view = powerUiMovePresentation(slot, calc)) {
  // Structural controls are only constructed for a new row, never for a refresh.
  const moveButton = powerUiMovePickerMarkup(slot,view);
  return `<article class="move-row" data-move-row="${slot}"><span class="move-number" aria-hidden="true">0${slot+1}</span>${moveButton}<div class="move-comparison">${view.powerMarkup}<div class="damage-summary">${view.damage}</div></div><div class="ko${view.koRandom ? ' ko--random' : ''}">${view.koMarkup}</div><button type="button" class="ui-button icon-button move-settings-button" data-move-settings="${slot}" aria-haspopup="dialog" aria-controls="calc-move-settings" aria-label="기술 ${slot+1} 조건 설정" ${view.settingsDisabled ? 'disabled' : ''}>${RotomUI.icon('settings')}</button><div class="move-notes">${view.notes}</div></article>`;
}

function powerUiMovePickerMarkup(slot, view) {
  return `<div class="combobox result-move-picker">${RotomUI.trigger(view.pickerContent,{'data-cb-type':'move','data-side':'atk','data-field':`moves.${slot}`,value:view.moveName,title:view.moveName || '기술 선택','aria-label':`기술 ${slot+1}: ${view.moveName || '선택'}`,disabled:view.pickerDisabled},'cb-input cb-trigger move-select')}<div class="combobox-options" role="listbox"></div></div>`;
}

// Assignment stays in the module that owns the live binding.
function setPowerUiStatusTimer(value) { powerUiStatusTimer = value; return value; }

// Assignment stays in the module that owns the live binding.
function setPowerUiMoveSlot(value) { powerUiMoveSlot = value; return value; }

export { powerUiStats, powerUiCategoryNames, powerUiEscape, powerUiType, powerUiMoveSlot, powerUiStatusTimer, powerUiEffectNames, powerUiNamedEffects, powerUiCalculateSlot, powerUiResultNote, powerUiMovePresentation, powerUiMoveMarkup, powerUiMovePickerMarkup, setPowerUiStatusTimer, setPowerUiMoveSlot };
