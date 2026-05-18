# Source Cleanup 2026-05-17

이 문서는 2026-05-17 UI 공통화, 파티 프리셋, learnset 보정 작업을 기준으로 한 최신 소스 정리 기록이다.

## Added Structure

### JavaScript

- `src/js/01-20-html-structure.js`
  - HTML attribute escaping
  - 기본 `type="button"`을 보장하는 `uiButton`
  - tab/panel active + ARIA 상태를 함께 맞추는 `syncUiTabs`, `syncUiPanels`
  - 탭 키보드 동작과 메인 hash navigation을 담당하는 `bindUiTabKeyboard`, `bindMainNavigation`
- `src/js/04-00-party-presets.js`
  - 파티 프리셋 localStorage 상태
  - JSON import/export
  - Showdown text import/export
  - 각 메뉴별 불러오기 adapter
  - 파티/슬롯 접힘 상태
  - 브라우저 로컬 저장소 백업 안내

### CSS

- `src/styles/04-ui-foundation.css`
  - 공통 app shell
  - navigation
  - input/control/combobox
  - modal
  - party preset
- `src/styles/05-calc-sample-layout.css`
  - 대미지 계산기 light UI 레이아웃
- `src/styles/06-dex-redesign.css`
  - 도감 목록/상세/모달 UI
- `src/styles/07-tools-redesign.css`
  - 상성표, 세부조정, 형태 역계산 UI

## Cleanup Notes

- `src/calc-template.html`의 page DOM 순서를 main nav와 같은 순서로 정리했다.
- 앱 본문은 단일 `main#appContent` landmark를 쓰고, 각 page는 `section.page.page-frame` tab panel로 둔다.
- 정적 frame은 `page-frame` → `ui-frame` → `ui-frame-head/body` 계층으로 맞췄다.
- 동적 renderer의 반복 입력 블록은 `ui-control-frame`, `ui-control-row`, `ui-control-grid`를 붙여 CSS 리모델링 기준을 만들었다.
- 모든 literal `<button>`에 `type="button"`을 명시했다.
- nav tab, 도감 tab, 상성표 mode tab은 `.active`와 `aria-selected`를 함께 갱신한다.
- nav tab, 도감 tab, 상성표 mode tab은 Arrow/Home/End 키보드 이동을 공유한다.
- 파티/슬롯 접힘은 `hidden` 속성과 CSS가 섞이지 않게 `.collapsed` CSS 기준으로 정리했다.
- 기존 네비게이션 포인트라인을 제거하고 tab형 outline 기준으로 통일했다.
- 대미지 계산기와 다른 메뉴의 숫자 입력/선택 입력 높이를 `36px` 계열로 맞췄다.
- 대미지 계산기, 세부조정, 형태 역계산의 포켓몬 입력 row는 같은 라벨/입력 기본 규격을 공유한다.
- 로토무 폼과 메가플라엣테 learnset 보정은 빌드 단계에서 처리한다.
- `scripts/dex-ui-smoke.mjs`는 전체 CSS 파일을 읽도록 확장했다.

## CSS Structure Remodel Notes

- `src/styles/04-ui-foundation.css` now owns the structural CSS contract for `page-frame`, `ui-frame-*`, `ui-control-*`, `ui-action-row`, `ui-stat-grid`, and `ui-metric-row`.
- Page-specific frame selectors in calculator, dex, and tool pages now target `ui-frame-head/body` instead of legacy `panel-head/body` selectors.
- Tool-page repeated blocks share one structural subframe selector for border and radius ownership.
- `scripts/css-structure-check.mjs` was added and wired into `npm.cmd test`.
- See `docs/css-structure-remodel-2026-05-17.md` for the full CSS structure contract.

## Static Hosting Notes

- The generated app remains a single static SPA artifact: `pokemon-champions-calculator-v3.html`.
- Page-specific HTML splitting is deferred because calculator, dex, fine-tune, reverse calculator, matchup, and party presets share runtime state.
- `scripts/spa-hosting-check.mjs` verifies the generated HTML has no unresolved placeholders or local-only URLs, parses embedded JSON data, and keeps the main tab/page wiring.
- `npm.cmd test` now includes the hosting contract check.
- `scripts/prepare-public.mjs` prepares `dist/index.html` from the generated artifact.
- `npm.cmd run build:public` rebuilds the app and writes the ignored deploy output under `dist/`.
- See `docs/single-html-spa-hosting-2026-05-17.md` for the hosting decision.

## Public Readiness Notes

- `src/calc-template.html` now includes description, app name, theme color, robots, Open Graph, Twitter summary, and inline favicon metadata.
- A skip link and `noscript` notice were added.
- Party preset users now see a compact JSON backup note because saved parties live in browser-local storage.
- Main pages support `#calc`, `#revcalc`, `#finetune`, `#matchup`, and `#dex` hash entry.
- `scripts/public-readiness-check.mjs` was added and wired into `npm.cmd test`.
- See `docs/public-readiness-2026-05-17.md` for the public-page contract.

## Regression Coverage Added

- `scripts/html-structure-check.mjs`
  - 정적 template/generated HTML button type 확인
  - 단일 main landmark와 skip link 확인
  - page/nav ARIA 연결 확인
  - page DOM 순서 확인
  - 구조 class 존재 확인
- 파티 프리셋 open button
- 파티 프리셋 JSON helper
- 파티 프리셋 Showdown text parser
- 대미지 계산기 공격측/방어측 불러오기 target
- 세부조정 불러오기 target
- 형태 역계산 불러오기 target
- 상성표 파티 불러오기 target
- 파티/슬롯 접힘 CSS
- 로토무 폼 learnset 상속
- 메가플라엣테 `lightofruin`

## Verification

```powershell
npm.cmd test
```

위 전체 테스트를 통과했다.
