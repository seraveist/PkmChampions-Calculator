/* ════════════════════════════════════════════════════════════
 * 05-init.js — 페이지 로드 시 초기 렌더 호출
 * (build.mjs 가 src/js/*.js 를 알파벳순 concat 후 calc-template.html 에 주입)
 * ════════════════════════════════════════════════════════════ */
/* ════════════════════════════════════════════════════════════
   초기 렌더링 — 페이지 로드 시 양측 패널, 결과 영역, 도감 첫 탭을
   즉시 채운다. (이전 버전엔 이 블록이 빠져 있어 사용자가 토글이나
   탭을 건드리기 전까지 화면이 비어있는 버그가 있었다.)
   ════════════════════════════════════════════════════════════ */
renderSide('atk');
renderSide('def');
updateFieldSummary();
triggerCalc();
renderTypeFilter();
renderDexContent('');
renderMatchupSlots();
renderMatchupTable();
renderFineTuneAll();