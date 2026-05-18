# HTML Structure Remodel 2026-05-17

이 문서는 2026-05-17 기준 HTML 구조 리모델링의 의도와 유지 규칙을 정리한다. 이번 작업은 기능 추가/삭제가 아니라 기존 화면 요소를 같은 의미의 구조 계층으로 다시 정렬하는 작업이다.

## Scope

- 기존 사용자 기능, 버튼, 입력, 테이블, 모달, 데이터 placeholder를 유지한다.
- 기존 `id`, 주요 `class`, `data-*` hook은 이벤트와 테스트 호환을 위해 유지한다.
- CSS 시각 개편은 이 문서의 범위 밖이다. 다만 CSS가 나중에 기대고 쓸 수 있는 구조용 클래스를 정리한다.
- 생성 산출물은 계속 `pokemon-champions-calculator-v3.html` 하나다.

## Static Template Ownership

`src/calc-template.html`은 앱의 큰 골격만 소유한다.

- app shell: `app-header`, `site-shell`, `main#appContent.app-content`, 광고 rail
- page frame: `section.page.page-frame`
- page order: `calc`, `revcalc`, `finetune`, `matchup`, `dex`
- static frame: `panel.ui-frame`, `results.ui-frame`, `dex-modal.ui-frame`
- frame substructure: `ui-frame-head`, `ui-frame-body`, `ui-frame-row`
- static data injection placeholders: `__POKEMON_DATA__`, `__MOVES_DATA__`, `__ABILITIES_DATA__`, `__ITEMS_DATA__`, `__NATURES_DATA__`, `__TYPECHART_DATA__`, `__CHAMP_RULES__`, `__META_THREATS_DATA__`

정적 template는 페이지 간 배치와 큰 패널만 담당하고, 포켓몬/기술/후보/결과처럼 데이터에 따라 바뀌는 내부 목록은 JS renderer가 담당한다.

## Dynamic Renderer Ownership

JS renderer는 각 페이지의 반복 UI와 데이터 기반 HTML을 소유한다.

- 계산기: `src/js/03-30-calc-side-render.js`
- 도감: `src/js/04-10-dex.js`
- 상성표: `src/js/04-20-matchup.js`
- 세부조정: `src/js/04-30-finetune.js`
- 형태 역계산: `src/js/04-43-revcalc-render.js`

렌더러에서 새 구조를 만들 때는 다음 계층을 우선 사용한다.

- `ui-control-frame`: 입력/카드/블록 단위의 독립 구조
- `ui-control-row`: 같은 의미의 컨트롤이 가로로 묶이는 행
- `ui-control-grid`: 필드나 설정이 격자로 묶이는 영역
- `ui-action-row`: 명령 버튼 묶음
- `ui-stat-grid`: 능력치/포인트/랭크류 표 구조
- `ui-metric-row`: 내구/요약 수치 묶음

## Button Contract

모든 버튼은 `type="button"`을 명시한다. 정적 template, JS template literal, helper 출력 모두 같은 규칙을 따른다.

반복 버튼은 가능하면 `src/js/01-20-html-structure.js`의 `uiButton(label, attrs)`를 사용한다. `uiButton`은 속성 escaping과 기본 button type을 담당한다.

버튼 역할은 기존 CSS 클래스와 함께 구조를 표현한다.

- nav/tab: `.nav-tab`, `.dex-tab`, `.matchup-mode-btn`
- primary command: `.btn-calculate`, `.rc-analyze-btn`
- secondary command: `.btn-secondary`, `.ui-label-action`
- row/stat command: `.ui-stat-button`, `.ft-rank-btn`, `.ft-ev-quick`
- clear/dismiss: `.matchup-slot-clear`, `.matchup-move-clear`, `.dex-modal-close`

## Tab And Panel State

탭 전환 상태는 class만 바꾸지 않고 ARIA 상태도 함께 맞춘다.

- tab button: `.active` + `aria-selected`
- page/panel: `.active` + `aria-hidden` + `hidden` for tab panels
- helper: `syncUiTabs(buttons, activeButton)`, `syncUiPanels(panels, activePanel)`, `bindUiTabKeyboard(tablist)`

메인 nav와 도감 내부 tab은 이 helper를 사용한다. 상성표 모드 tab도 같은 helper로 상태를 동기화한다. 메인 페이지는 `#calc`, `#revcalc`, `#finetune`, `#matchup`, `#dex` hash로도 열 수 있다.

## Verification

구조 리모델링은 다음 스크립트로 검증한다.

```powershell
npm.cmd run html:structure
```

검사 항목:

- 정적 template와 생성 HTML의 static DOM 버튼이 모두 `type`을 가진다.
- template가 단일 `main#appContent` landmark와 skip link를 가진다.
- 페이지가 nav 순서대로 존재한다.
- nav tab이 대상 page를 `aria-controls`로 가리킨다.
- page가 nav tab을 `aria-labelledby`로 되가리킨다.
- 구조용 class가 template 또는 생성 HTML에 존재한다.
- JS renderer의 literal button markup에도 `type` 누락이 없다.

전체 회귀는 기존처럼 다음 명령으로 확인한다.

```powershell
npm.cmd test
```

## CSS Follow-Up

The first CSS structure pass is documented in `docs/css-structure-remodel-2026-05-17.md`. It gives the new HTML hierarchy CSS ownership and adds `npm.cmd run css:structure`.

## Hosting Decision

The app keeps the single generated HTML SPA structure. `docs/single-html-spa-hosting-2026-05-17.md` documents the decision and `npm.cmd run spa:hosting` verifies the generated artifact is suitable for static hosting.

## Public Readiness

The public-page hardening pass is documented in `docs/public-readiness-2026-05-17.md`. It adds metadata, a favicon, a skip link, one-main landmark structure, tab keyboard behavior, hash page activation, and `npm.cmd run public:ready`.

## Follow-Up Notes

- CSS 정리는 이 구조 계층을 기준으로 진행한다.
- 다음 단계에서 `panel`, `field`, `row`, `action` 계층의 중복 CSS를 `ui-frame-*`, `ui-control-*` 쪽으로 끌어올릴 수 있다.
- 브라우저 자동 확인은 현재 로컬 URL이 브라우저 정책/차단으로 열리지 않아 정적 구조 검사와 Node 기반 테스트로 대체했다.
