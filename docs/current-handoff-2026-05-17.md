# Current Handoff 2026-05-17

이 문서는 `codex-source-cleanup-ui-foundation-20260515` 브랜치를 다른 PC에서 이어받기 위한 최신 인수인계 문서다.

## Branch

- Current branch: `codex-source-cleanup-ui-foundation-20260515`
- Main artifact: `pokemon-champions-calculator-v3.html`
- Build command: `npm.cmd run build`
- Full local check: `npm.cmd test`
- PowerShell에서는 `npm` 대신 `npm.cmd`를 사용한다.

## Latest Focus

이번 분기의 중심은 UI/UX 공통화, 파티 프리셋 기능 추가, HTML/CSS 구조 리모델링, 공개 페이지 기본 품질 정리다.

대미지 계산기, 도감, 상성표, 세부조정, 형태 역계산의 1차 UI 정리를 마친 뒤, 각 메뉴가 서로 다른 입력칸/패널/드롭다운 규격을 쓰던 부분을 공통 스타일로 끌어올렸다. 이후 공통 네비게이션에 `파티 프리셋` 모달을 추가하고, 저장된 파티를 각 메뉴로 불러오는 흐름까지 연결했다.

그 다음 단계로 `src/calc-template.html`과 주요 JS renderer의 HTML 계층을 리모델링했다. 기존 화면 요소와 이벤트 hook은 유지하면서 `page-frame`, `ui-frame-*`, `ui-control-*`, `ui-action-row` 기준의 구조 어휘를 추가했고, 탭/패널 ARIA 상태와 button type 규칙을 정리했다. 공개 배포를 위한 메타 태그, 단일 main landmark, skip link, 탭 키보드 동작, hash 기반 페이지 진입도 추가했다.

## Major Changes

### UI foundation

- `src/styles/04-ui-foundation.css`
  - 앱 헤더, 네비게이션 탭, 공통 패널, 라벨 row, 액션 버튼, 입력칸, 콤보박스, 모달, 파티 프리셋 스타일을 담당한다.
  - 기본 입력칸 높이는 `36px` 계열로 정리했다.
  - 메뉴 네비게이션은 배경/포인트라인 없이 tab처럼 보이는 구조로 변경했다.
  - 720px 이하에서는 메뉴 텍스트 크기를 줄이고 가로 스크롤이 생기지 않도록 정리했다.
- `src/styles/05-calc-sample-layout.css`
  - 대미지 계산기의 새 레이아웃과 결과 카드 스타일을 담당한다.
- `src/styles/06-dex-redesign.css`
  - 도감 목록, 상세 페이지, 상세 모달, 필터, 탭 스타일을 담당한다.
- `src/styles/07-tools-redesign.css`
  - 상성표, 세부조정, 형태 역계산의 도구형 화면 스타일을 담당한다.

### HTML structure remodel

- `src/calc-template.html`
  - 페이지 DOM 순서를 상단 네비게이션 순서(`calc`, `revcalc`, `finetune`, `matchup`, `dex`)에 맞췄다.
  - 앱 본문은 단일 `main#appContent.app-content` landmark를 기준으로 하고, 각 페이지는 `section.page.page-frame` tab panel을 사용한다.
  - 도감 테이블 markup을 긴 한 줄 구조에서 읽을 수 있는 table/head/body 구조로 펼쳤다.
  - 메인 nav, 도감 tab, 상성표 mode tab에 `role`, `aria-controls`, `aria-selected`, `aria-hidden` 상태를 정리했다.
- `src/js/01-20-html-structure.js`
  - `uiButton`, `syncUiTabs`, `syncUiPanels`, `bindUiTabKeyboard`, `bindMainNavigation` 등 구조 helper를 담당한다.
  - 반복 button markup은 가능한 한 이 helper를 사용한다.
  - 메인 페이지 hash 진입은 `#calc`, `#revcalc`, `#finetune`, `#matchup`, `#dex`를 지원한다.
- 주요 renderer
  - `src/js/03-30-calc-side-render.js`
  - `src/js/04-10-dex.js`
  - `src/js/04-20-matchup.js`
  - `src/js/04-30-finetune.js`
  - `src/js/04-43-revcalc-render.js`
  - 위 파일들은 기존 ID/data hook을 유지한 채 `ui-control-frame`, `ui-control-row`, `ui-control-grid`, `ui-stat-grid`, `ui-metric-row` 구조 class를 추가했다.
- `docs/html-structure-remodel-2026-05-17.md`
  - HTML 리모델링의 범위, 구조 어휘, button contract, 검증 방법을 기록한다.

### Party preset

- `src/js/04-00-party-presets.js` 추가.
- 공통 네비게이션 우측의 `파티 프리셋` 버튼으로 모달을 연다.
- localStorage key: `pkmChampions.partyPresets.v1`
- 최대 10개 파티, 파티당 6개 슬롯.
- 각 슬롯 저장 항목:
  - 포켓몬
  - 특성
  - 성격
  - 도구
  - 포인트 배분 `H/A/B/C/D/S`
  - 기술 4개
- 기술별 수동 위력/타입 override는 저장하지 않는다. 불러온 뒤 사용자가 현재 계산 화면에서 다시 조정하는 정책이다.
- 파티와 슬롯은 접이식이다.
  - 파티는 기본적으로 모두 접힌 상태다.
  - 포켓몬이 들어간 슬롯도 기본적으로 접힌 상태다.
  - 모달을 닫았다 다시 열어도 현재 페이지 세션 안에서는 사용자가 펼친 상태를 유지한다.
  - 새로고침 후에는 기본 접힘 상태로 돌아간다.
- JSON import/export를 지원한다.
- Showdown text import/export를 지원한다.
  - 예: `Charizard-Mega-X @ Charizardite X`
  - `Ability:`, `EVs:`, `Adamant Nature`, `- Move` 형식 매칭.
  - Champions 포인트는 Showdown EV 라인의 숫자를 그대로 `0~32` 포인트로 해석한다.

### Party import targets

- 대미지 계산기
  - 공격측 `calc:atk`
  - 방어측 `calc:def`
  - 포켓몬, 특성, 성격, 도구, 포인트, 기술 4개를 불러온다.
- 세부조정
  - 내 포켓몬 `finetune:my`
  - 포켓몬, 특성, 성격, 도구, 포인트, 기술 4개를 불러온다.
- 형태 역계산
  - 내 포켓몬 `revcalc:my`
  - 포켓몬, 특성, 성격, 도구, 포인트, 기술 4개를 불러온다.
- 상성표
  - `matchup`
  - 파티 단위로 6마리 포켓몬을 넣고, 공격 타점 모드의 기술 4개도 함께 채운다.

### Mega item defaults

메가 포켓몬을 선택하면 가능한 경우 대응 메가스톤을 자동으로 도구에 넣는다.

적용 대상:

- 대미지 계산기 공격측/방어측
- 세부조정 내 포켓몬
- 형태 역계산 내 포켓몬
- 형태 역계산 상대 행동의 상대 도구
- 파티 프리셋 슬롯

### Learnset fixes

- `build.mjs`
  - 메가플라엣테는 `floetteeternal` 계열 learnset을 이어받고 `lightofruin`을 유지한다.
  - 히트/워시/프로스트/스핀/커트 로토무는 각 폼의 전용기 1개를 유지하면서 기본 `rotom` learnset을 concat한다.
  - 로토무 폼 회귀 기준:
    - `rotomheat` keeps `overheat`
    - `rotomwash` keeps `hydropump`
    - `rotomfrost` keeps `blizzard`
    - `rotomfan` keeps `airslash`
    - `rotommow` keeps `leafstorm`
    - 모두 `thunderbolt`, `voltswitch`, `willowisp`를 상속해야 한다.

### Shared combobox behavior

검색형 입력은 PC/모바일을 모두 고려해 다음 정책으로 정리했다.

- 타이핑 중에는 후보를 필터링하고, 일치하는 후보에 focus를 둔다.
- Enter 또는 blur 시 정상 후보가 있으면 해당 값을 확정한다.
- 리스트에 없는 값이면 빈 값으로 정리한다.
- 포켓몬 검색은 한글 포켓몬명 중심으로 필터링한다.
- 선택형 타입/상태/필드 등은 자유 입력형이 아니라 선택형 컨트롤에 가깝게 정리했다.

## Verification

최신 검증:

```powershell
npm.cmd test
```

통과 항목:

- source check
- build
- html structure
- data validate
- dex smoke
- damage golden
- reverse golden
- entry effects state
- fine-tune state

`scripts/dex-ui-smoke.mjs`에는 이번 분기의 중요한 회귀 조건을 추가했다.

- 로토무 폼 learnset 상속
- 메가플라엣테 `lightofruin`
- 파티 프리셋 open button
- 파티 프리셋 JSON/Showdown helper
- 각 메뉴의 파티 불러오기 target
- 파티/슬롯 접힘 CSS
- HTML 구조 class와 button type contract

## Current Status

전체 메뉴는 1차 완성본으로 볼 수 있다.

- 대미지 계산기: UI/UX와 계산 로직 1차 안정화 완료.
- 도감: 목록/상세/모달/필터/적용 버튼 1차 정리 완료.
- 상성표: 방어 상성/타점 체크/메타 카드/파티 불러오기 1차 완료.
- 세부조정: 능력 포인트, HP 브레이크포인트, 상대 스피드 비교 1차 완료.
- 형태 역계산: 후보 압축, 다음 행동 판단, 결과 카드 1차 완료.
- 파티 프리셋: 저장/불러오기/JSON/Showdown text/접힘 UI 1차 완료.

## CSS Structure Remodel

The CSS remodel now follows the new HTML structure vocabulary.

- `src/styles/04-ui-foundation.css` owns `page-frame`, `ui-frame-*`, `ui-control-*`, `ui-action-row`, `ui-stat-grid`, and `ui-metric-row`.
- Calculator, dex, matchup, fine-tune, and reverse calculator styles now target `ui-frame-head/body` for frame structure instead of legacy `panel-head/body` selectors.
- Repeated subframes in tool pages share a central structural selector for border/radius ownership.
- `scripts/css-structure-check.mjs` verifies CSS ownership and is included in `npm.cmd test`.
- Full details live in `docs/css-structure-remodel-2026-05-17.md`.

## Hosting Structure Decision

The app will keep the single generated HTML static SPA structure for now.

- Hosted artifact remains `pokemon-champions-calculator-v3.html`.
- Page-specific HTML files are not planned in this pass.
- Cross-tool workflows continue to share one runtime and one data bundle.
- `scripts/spa-hosting-check.mjs` verifies the generated file is suitable for static hosting.
- `npm.cmd test` now includes `npm.cmd run spa:hosting`.
- `npm.cmd run build:public` rebuilds the app and prepares `dist/index.html` for static hosts.
- Full details live in `docs/single-html-spa-hosting-2026-05-17.md`.

## Public Readiness

- `src/calc-template.html` now has publishable page metadata, Open Graph/Twitter summary metadata, theme color, robots policy, and an inline SVG favicon.
- `main#appContent` is the only main landmark; page panels are `section.page.page-frame`.
- Main nav, dex tabs, and matchup mode tabs support arrow-key navigation through `bindUiTabKeyboard`.
- Main pages can be opened by hash: `#calc`, `#revcalc`, `#finetune`, `#matchup`, `#dex`.
- Party preset modal includes a browser-local storage backup note pointing users to JSON export before device/browser resets.
- `scripts/public-readiness-check.mjs` verifies the public-page contract and is included in `npm.cmd test`.
- Full details live in `docs/public-readiness-2026-05-17.md`.

## Recommended Next Work

1. 파티 프리셋을 실제 전술 샘플 2~3개로 입력해 보고, 각 메뉴 불러오기 UX를 손으로 점검한다.
2. Showdown text import에서 영어명 alias가 더 필요한 케이스를 발견하면 `partyPresetResolve*` 계열 helper에 추가한다.
3. CSS 공통화가 더 가능한 영역을 점검한다.
   - 공통 패널 header 높이
   - 타입 배지 위치
   - 섹션 구분자
   - 모달 header/footer
4. 공개 웹앱 배포 전에는 실제 배포 URL이 정해진 뒤 canonical/OG URL을 추가할지 결정한다.
5. CSS 정리는 `docs/html-structure-remodel-2026-05-17.md`의 `ui-frame-*`, `ui-control-*`, `ui-action-row` 기준으로 진행한다.
6. 현재 생성 HTML이 약 1.3MB이므로, 배포 단계에서 data chunking 또는 gzip/brotli 기준을 확인한다.
