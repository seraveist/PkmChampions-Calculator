# UI 리팩토링 인수인계

이 문서는 다른 PC에서 현재 UI 구조 정리 작업을 그대로 이어가기 위한 단일 기준 문서다. 기존 MD 문서는 모두 정리했고, 이후 UI 구조 관련 결정과 진행 상황은 이 파일에만 업데이트한다.

## 현재 브랜치

- 작업 브랜치: `codex-ui-panel-subframe-handoff-20260519`
- 기준 브랜치: `codex-source-cleanup-ui-foundation-20260515`
- 목적: 다크모드와 향후 테마 작업을 쉽게 하기 위해 HTML/CSS 계층을 공통 구조로 정리한다.
- 작업 원칙: 기존 요소를 빼거나 새 기능을 추가하는 작업이 아니라, 같은 요소를 더 명확한 계층으로 리모델링한다.

## 전체 계층 규칙

모든 메뉴는 아래 계층을 기준으로 정리한다.

```text
메뉴별 LAYOUT
> UI-PANEL 여러 개
> ui-subframe-stack
> SUBFRAME
> ELEMENT 공통 또는 메뉴 고유
```

### 1. 메뉴별 LAYOUT

메뉴의 큰 배치만 담당한다. 여기서는 패널의 위치, 컬럼 수, 반응형 전환만 관리한다.

- 계산기: `battle-grid`, `field-row`
- 형태 역계산: `rc-grid`
- 세부조정: `ft-layout`, `finetune-grid`
- 상성표: 메뉴 내부 전용 layout
- 도감: `dex-*` layout

LAYOUT 레벨에는 개별 입력칸, 버튼, 배지의 스타일을 넣지 않는다.

### 2. UI-PANEL

최외곽 카드형 패널이다. 모든 메뉴의 큰 패널은 다음 공통 구조를 받는 것이 목표다.

```html
<section class="panel ui-frame ui-panel ...">
  <div class="panel-head ui-frame-head ui-panel-head">
    <div class="panel-title ui-panel-title">...</div>
    <div class="panel-head-actions ui-action-row ui-panel-actions">...</div>
  </div>
  <div class="panel-body ui-frame-body ui-panel-body ui-subframe-stack">
    ...
  </div>
</section>
```

`panel`, `panel-head`, `panel-title`, `panel-body`는 레거시 호환 훅으로 남아 있을 수 있지만, 공통 스타일의 소유자는 `ui-panel`, `ui-panel-head`, `ui-panel-title`, `ui-panel-body`가 되어야 한다.

### 3. ui-subframe-stack

패널 본문 바로 아래에 들어가는 공통 stack wrapper다. 패널 안에서 subframe들이 일정한 간격으로 쌓이게 만든다.

- 정의 위치: `src/styles/04-ui-foundation.css`
- 적용된 계산기 본문:
  - `#atk-body`
  - `#def-body`
  - `#field-panel > .ui-panel-body`
  - `#results-body`
- 검사 위치: `scripts/html-structure-check.mjs`, `scripts/css-structure-check.mjs`

앞으로 패널 본문 바로 아래에 `section-divider` 같은 독립 구분선을 끼우지 않는다. 구분은 subframe의 border, padding, gap으로 표현한다.

### 4. SUBFRAME

패널 내부의 기능 단위 묶음이다. 기본적으로 다음 조합을 사용한다.

```html
<div class="... ui-control-frame ui-subframe ...">
  ...
</div>
```

SUBFRAME 안의 제목 행은 보통 `ui-section-head`, 제목 텍스트는 `ui-section-title`을 사용한다.

### 5. ELEMENT

실제 조작 요소다. 가능한 한 공통 class를 먼저 사용하고, 메뉴별 차이가 필요할 때만 전용 class를 추가한다.

공통 element 예시:

- 버튼: `ui-btn`, `ui-label-action`, `ui-field-action`, `ui-popover-trigger`
- 필드: `ui-field`, `ui-field-label`
- 그리드/행: `ui-control-grid`, `ui-control-row`, `ui-action-row`
- 셀/라벨: `ui-control-cell`, `ui-control-label`
- 카드/칩: `ui-card`, `ui-card-grid`, `ui-metric-chip`, `ui-status-badge`
- 수치/스텝퍼: `ui-stat-readout`, `ui-stepper`
- 포켓몬 선택 공통: `tool-pokemon-*`
- 능력치 입력 공통: `tool-stat-*`

전용 class 접두사:

- 계산기 전용: `calc-*`
- 형태 역계산 전용: `rc-*`
- 세부조정 전용: `ft-*`
- 상성표 전용: `matchup-*`
- 도감 전용: `dex-*`

전용 class는 의미나 배치 차이를 드러내는 훅으로 사용하고, 공통 UI의 기본 색상/패딩/테두리/폰트는 `ui-*` 또는 `tool-*`에서 받는 방향을 유지한다.

## 대미지 계산기 현재 계층

대미지 계산기는 현재 가장 많이 정리된 기준 메뉴다. 다른 메뉴를 조정할 때 이 구조를 기준으로 삼는다.

```text
#page-calc.page-frame
> .battle-grid.ui-frame-row
  > 공격측 .panel.ui-frame.ui-panel.atk
    > .ui-panel-head
    > #atk-body.ui-panel-body.ui-subframe-stack
      > 포켓몬 선택 .tool-pokemon-subframe.ui-control-frame.ui-subframe
      > 특성/도구/성격/상태 .calc-settings-field.ui-control-frame.ui-subframe
      > 능력 포인트/랭크 .ev-field.ui-control-frame.ui-subframe
      > 기술 배치 .move-field.ui-control-frame.ui-subframe
  > .calc-side-swap-button
  > 방어측 .panel.ui-frame.ui-panel.def
    > .ui-panel-head
    > #def-body.ui-panel-body.ui-subframe-stack
      > 포켓몬 선택
      > 특성/도구/성격/상태
      > 능력 포인트/랭크
      > 기술 배치
> .field-row.ui-frame-row
  > #field-panel.panel.ui-frame.ui-panel.collapsible
    > .ui-panel-head
    > .ui-panel-body.ui-subframe-stack
      > .field-select-frame.ui-control-frame.ui-subframe
      > .field-effects-frame.ui-control-frame.ui-subframe
> .results.panel.ui-frame.ui-panel
  > .ui-panel-head
  > #results-body.ui-panel-body.ui-subframe-stack
    > .mold-breaker-info.ui-control-frame.ui-subframe 조건부
    > .speed-row.ui-control-frame.ui-subframe
    > .move-results.ui-control-frame.ui-subframe
```

### 공격측/방어측 패널

HTML 소스 위치:

- `src/calc-template.html`
- 공격측 본문: `#atk-body`
- 방어측 본문: `#def-body`
- 실제 내부 렌더링: `src/js/03-30-calc-side-render.js`

공격측과 방어측은 같은 renderer인 `renderSide(sideKey)`를 사용한다. 차이는 `sideKey`가 `atk`인지 `def`인지와 panel tone뿐이다.

### 포켓몬 선택 subframe

렌더링 함수:

- `src/js/03-10-calc-state.js`
- `renderToolPokemonSelectSubframe(...)`

대미지 계산기에서 호출하는 위치:

- `src/js/03-30-calc-side-render.js`
- 변수명: `pokemonPicker`

구조:

```text
.tool-pokemon-subframe.ui-control-frame.ui-subframe
> .tool-pokemon-field.ui-field
  > .tool-pokemon-head-row
    > label "포켓몬"
    > primary action "불러오기"
    > title actions "세부조정", "역계산"
  > .tool-pokemon-control-row
    > .tool-pokemon-combobox
      > .tool-pokemon-input
  > .tool-pokemon-toolbar-row
    > 타입 배지/초기화
    > 폼체인지 드롭다운
```

대미지 계산기 기준:

- 라벨 텍스트는 `포켓몬`으로 통일했다.
- `불러오기` 버튼은 라벨 오른쪽에 붙는다.
- `세부조정`, `역계산` 이동 버튼은 title actions로 우측 정렬된다.
- 폼체인지 박스는 세 메뉴가 같은 dropdown UI를 사용한다.
- 대미지 계산기에서는 폼체인지 박스가 toolbar row 우측에 정렬되고, 포켓몬 입력칸 우측 경계와 맞도록 구성한다.
- 타입 배지, 초기화 버튼, 폼체인지 박스의 기본 크기/폰트는 세부조정/역계산과 맞춘 값이 기준이다.

다른 메뉴에서 포켓몬 선택을 수정할 때는 직접 새 구조를 만들지 말고 `renderToolPokemonSelectSubframe`을 확장하거나 같은 class 체계를 받아야 한다.

### 특성/도구/성격/상태 subframe

렌더링 위치:

- `src/js/03-30-calc-side-render.js`
- class: `calc-settings-field ui-control-frame ui-subframe ui-field`

구조:

```text
.calc-settings-field.ui-control-frame.ui-subframe
> .calc-pair-grid.ui-control-grid
  > .calc-control-cell.ui-control-cell 특성
  > .calc-control-cell.ui-control-cell 도구
  > .calc-control-cell.ui-control-cell 성격
  > .calc-control-cell.ui-control-cell 상태 + HP%
```

이 subframe은 한때 별도 frame 없이 흩어져 있었고, 현재는 능력 포인트/기술 배치와 같은 계층으로 맞춰진 상태다.

### 능력 포인트/랭크 subframe

렌더링 위치:

- `src/js/03-30-calc-side-render.js`
- class: `ev-field ev-preset-shell ui-control-frame ui-subframe ui-field`

구조:

```text
.ev-field.ui-control-frame.ui-subframe
> .ev-field-head.ui-section-head
  > .ev-title-label.ui-section-title
    > "능력 포인트 · 랭크"
    > .calc-ev-preset-button.ui-popover-trigger "프리셋"
  > .ev-total.ui-metric-chip
> .ev-control-layout
  > .stat-grid.ui-stat-grid.ui-stat-table
    > stat header cells
    > stat name/base/point/final/rank rows
> .durability-grid.ui-metric-row.ui-chip-row
  > 물리 내구 .ui-metric-chip
  > 특수 내구 .ui-metric-chip
> .ev-preset-popover.ui-popover
```

중요한 element:

- 노력치 입력 스텝퍼: `calc-stat-point-stepper tool-stat-point-stepper ui-stepper`
- 노력치 버튼: `calc-stat-point-button tool-stat-point-button`
- 노력치 입력칸: `calc-stat-point-input tool-stat-point-input`
- 랭크 스텝퍼: `calc-stat-rank-stepper tool-stat-rank-stepper ui-stepper`
- 랭크 버튼: `calc-stat-rank-button tool-stat-rank-button`
- 랭크 값: `calc-stat-rank-value tool-stat-rank-value`

`tool-stat-*`는 세부조정/역계산에서도 공유하기 위한 공통 계층이다. 계산기 전용 조정이 필요하면 `calc-stat-*`에만 추가한다.

### 기술 배치 subframe

렌더링 위치:

- `src/js/03-30-calc-side-render.js`
- class: `move-field ui-control-frame ui-subframe ui-field`

구조:

```text
.move-field.ui-control-frame.ui-subframe
> .move-field-head.ui-section-head
  > "기술 배치"
> .move-control-layout.move-section
  > .moves-list.ui-control-grid
    > .move-list-header
    > .move-slot.ui-control-row x4
```

기술 slot element:

- 번호: `move-slot-num ui-index`
- 기술 선택: `move-select combobox`
- 타입 override: `move-type-control combobox type-pill-combobox`
- 위력 override: `move-bp-control ui-inline-number`
- 결정력 표시: `move-stat-info ui-stat-readout`

기술 배치의 `move-control-layout`은 subframe 안의 body layout이다. outer frame은 `move-field`, inner content layout은 `move-control-layout`으로 본다.

### 필드/부가 효과 패널

HTML 위치:

- `src/calc-template.html`

구조:

```text
#field-panel.ui-panel
> .ui-panel-head
  > "필드 · 부가 효과"
  > 자동진입효과 toggle
> .ui-panel-body.ui-subframe-stack
  > .field-select-frame.ui-control-frame.ui-subframe
    > 날씨
    > 필드
    > 룰
  > .field-effects-frame.ui-control-frame.ui-subframe
    > 급소
    > 리플렉터
    > 빛의장막
    > 도우미
    > 재앙 특성
    > 스텔스록
    > 압정뿌리기
    > 중력장
```

현재 조건 패널은 제거됐다. 선공/후공에 따른 위력 변화는 결과 카드 세부정보 배지로만 표시한다.

### 결과 패널

HTML 위치:

- `src/calc-template.html`

렌더링 위치:

- `src/js/03-50-calc-results.js`

구조:

```text
.results.ui-panel
> .ui-panel-head
  > "결과"
  > 공수교대, 계산 재실행, 기본값 복원
> #results-body.ui-panel-body.ui-subframe-stack
  > .mold-breaker-info.ui-control-frame.ui-subframe 조건부
  > .speed-row.ui-control-frame.ui-subframe.ui-summary-row
  > .move-results.ui-control-frame.ui-subframe.ui-card-grid
```

`mold-breaker-info`는 틀깨기류 특성이 있을 때만 렌더링된다.

`speed-row`는 속도 비교 subframe이다.

`move-results`는 결과 카드들을 담는 subframe이며, 내부 카드는 `move-card ui-card` 계열이다.

선공/후공 위력 조건:

- `userMovesFirstDouble`이 실제 적용되면 `선공 시 위력` 배지가 결과 카드 세부정보 라인에 표시된다.
- `userMovesSecondDouble` 또는 애널라이즈류 후공 위력 상승이 실제 적용되면 `후공 시 위력` 배지가 표시된다.
- 적용되지 않은 조건은 표시하지 않는다.

## 다크모드/테마 규칙

다크모드는 공통 class를 통해 최대한 자동 적용되게 만든다.

핵심 파일:

- `src/js/01-30-theme.js`: 테마 토글과 localStorage 처리
- `src/styles/04-ui-foundation.css`: 기본 토큰과 공통 UI class
- `src/styles/08-theme-bridge.css`: 다크모드 토큰과 legacy/custom bridge

원칙:

- 새 UI 요소는 먼저 `ui-*` 또는 `tool-*`를 받게 만든다.
- 다크모드가 빠진 요소는 대체로 개별 class만 있고 공통 class가 없거나, hardcoded background/border/color가 남아 있는 경우다.
- 메뉴별 특수 색상은 `calc-*`, `rc-*`, `ft-*` 등에 남기되, 기본 배경/테두리/폰트/간격은 공통 토큰으로 올린다.
- `:root[data-theme="dark"]` 아래에서 예외를 최소화한다.

## 주요 파일 역할

- `src/calc-template.html`
  - SPA shell과 정적 panel/layout 구조.
  - 최외곽 `ui-panel`, `ui-subframe-stack` 적용 지점.

- `src/js/03-10-calc-state.js`
  - 계산기 상태 helper.
  - `renderToolPokemonSelectSubframe`이 포켓몬 선택 공통 구조를 만든다.

- `src/js/03-30-calc-side-render.js`
  - 공격측/방어측 패널 내부 subframe 렌더링.
  - 포켓몬 선택, 설정, 능력 포인트, 기술 배치.

- `src/js/03-50-calc-results.js`
  - 결과 패널 내부 subframe 렌더링.
  - 틀깨기 안내, 속도 비교, 결과 카드.

- `src/styles/04-ui-foundation.css`
  - `ui-*`, `tool-*` 공통 토큰과 구조 class의 소유지.
  - 새 공통 class는 우선 여기에 추가한다.

- `src/styles/05-calc-sample-layout.css`
  - 대미지 계산기 레이아웃/반응형/세부 치수.
  - 공통화되지 않은 계산기 전용 배치만 남긴다.

- `src/styles/03-calc-redesign.css`
  - 대미지 계산기 시각 스타일과 결과 카드 스타일.
  - 장기적으로 공통화 가능한 값은 `04-ui-foundation.css`로 올린다.

- `src/styles/07-tools-redesign.css`
  - 역계산/세부조정/상성표 쪽 스타일.
  - 다음 작업 대상이다.

- `src/styles/08-theme-bridge.css`
  - 다크모드와 기존 개별 class 사이의 bridge.

- `scripts/html-structure-check.mjs`
  - 구조 class 존재와 계산기 stack 규칙 검사.

- `scripts/css-structure-check.mjs`
  - 공통 CSS 소유권과 legacy selector 사용 검사.

## 현재 완료된 UI 작업

- 다크모드 토글 추가.
- 타이틀 헤더 옆 파티 프리셋 버튼 정렬.
- 기존 우측 위치에 다크모드 버튼 배치.
- 포켓몬 선택 subframe 공통화.
- 대미지 계산기, 세부조정, 역계산의 폼체인지 드롭다운 UI 통일.
- 폼체인지 후보 텍스트는 폼 이름만 표시.
- 타입 배지/초기화/불러오기 버튼 크기와 폰트 기준 정리.
- 노력치 입력칸/랭크 버튼에 `tool-stat-*` 계층 추가.
- 공수교대 버튼은 `calc-side-swap-button`으로 계산기 전용화.
- 특성/도구/성격/상태 묶음을 계산기 subframe으로 승격.
- 필드 패널을 `field-select-frame`, `field-effects-frame` 2개 subframe으로 정리.
- 결과 패널을 `mold-breaker-info`, `speed-row`, `move-results` subframe으로 정리.
- 조건 패널 제거.
- 선공/후공 위력 조건은 결과 카드 세부정보 배지로 이동.
- 최외곽 패널을 `ui-panel` 중심으로 공통화.
- 계산기 패널 본문에 `ui-subframe-stack` 추가.
- 계산기 side renderer에서 `section-divider` 제거.
- 구조 검사에 `ui-subframe-stack` 규칙 추가.

## 다음 PC에서 이어갈 작업

1. 형태 역계산과 세부조정의 panel body에도 `ui-subframe-stack` 적용 여부를 검토한다.
2. `07-tools-redesign.css`에서 `rc-*`, `ft-*`가 직접 frame 역할을 하는 부분을 찾아 `ui-control-frame ui-subframe`으로 올린다.
3. 세부조정/역계산의 능력 포인트 패널이 계산기 `ev-field`와 같은 계층을 공유하는지 다시 점검한다.
4. 세부조정/역계산의 포켓몬 선택 subframe이 대미지 계산기와 같은 `tool-pokemon-*` 체계를 유지하는지 확인한다.
5. 상성표/도감은 기능별 layout은 고유하게 두되, 최외곽 panel과 내부 subframe은 가능한 공통 구조를 받게 한다.
6. 다크모드에서 빠지는 요소는 먼저 공통 class 누락을 의심하고, 개별 override보다 공통 class 추가를 우선한다.
7. 구조가 안정되면 `03-calc-redesign.css`, `05-calc-sample-layout.css`, `07-tools-redesign.css`에서 중복된 버튼/입력/칩 스타일을 foundation으로 올린다.

## 작업 시 금지/주의

- 현재 있는 요소를 삭제하거나 새 기능을 추가하지 않는다. UI 계층 리모델링이 목적이다.
- 페이지별 HTML 파일 분리는 하지 않는다. 현재 구조는 단일 HTML SPA 유지다.
- `section-divider`를 계산기 패널 내부에 다시 넣지 않는다.
- panel 본문 바로 아래에는 가능한 subframe만 둔다.
- 공통 스타일을 `calc-*`, `rc-*`, `ft-*`에 직접 복사하지 않는다.
- 특정 메뉴에서만 필요한 visual tone은 전용 class에 두되, base frame/label/button/input은 공통 class에서 받는다.
- generated file인 `pokemon-champions-calculator-v3.html`과 `dist/index.html`은 빌드 결과로 갱신한다.

## 검증 명령

작업 후 최소 검증:

```bash
npm run html:structure
npm run css:structure
npm run build:pages
```

전체 검증:

```bash
npm test
npm run build:pages
```

Cloudflare Pages 설정:

```text
Build command: npm run build:pages
Build output directory: /dist
```

현재 테스트는 `npm test`와 `npm run build:pages` 기준으로 통과한 상태에서 인수인계한다.

## 다른 PC에서 시작하는 방법

```bash
git fetch origin
git switch codex-ui-panel-subframe-handoff-20260519
npm test
npm run build:pages
```

브라우저 QA가 가능하면 계산기 메뉴에서 라이트/다크모드를 모두 확인한다. 특히 확인할 부분은 공격측/방어측 패널의 subframe 간격, 포켓몬 선택 toolbar, 폼체인지 드롭다운, 능력 포인트 입력칸, 기술 배치 frame, 필드 패널 2개 subframe, 결과 패널 3개 subframe이다.
