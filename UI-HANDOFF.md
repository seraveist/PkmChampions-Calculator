# UI Handoff: Calculator And Reverse Calculator Complete

> 이 문서는 이전 UI 작업의 이력 보존용이다. 현재 구조와 검증 기준은 `README.md`, `docs/ui-css-html-audit-2026-07-19.md`, `docs/ui-breakpoints.md`를 우선한다.

이 문서는 다른 PC에서 UI 정리 작업을 이어받기 위한 기준 문서다. 2026-05-20 현재
대미지 계산기와 내구 역계산은 완성 기준으로 본다. 다음 작업은 세부조정 메뉴를 이
구조에 맞춰 따라오는 것이다.

## 현재 상태

- 작업 브랜치: `codex-ui-panel-subframe-handoff-20260519`
- 완료 기준 메뉴: `#page-calc`, `#page-revcalc`
- 핵심 방향: 메뉴별 layout은 고유하게 두고, 안쪽 frame/subframe/element는 공통 계층을 공유한다.
- 역계산의 분석 결과 영역은 계산 결과의 의미가 독자적이므로 `rc-*` 고유 클래스를 허용한다.

## 기본 계층

모든 도구 메뉴는 아래 계층을 기준으로 정리한다.

```text
MENU LAYOUT
> UI-PANEL
  > SUBFRAME
    > ELEMENT
```

- `MENU LAYOUT`: 메뉴별 큰 배치다. 예: 계산기 좌우 공격/방어, 역계산 내/상대/관측/결과.
- `UI-PANEL`: 화면의 큰 패널이다. 공통 `ui-frame`, `ui-panel`을 사용한다.
- `SUBFRAME`: 패널 안의 기능 단위다. 공통 `ui-control-frame`, `ui-subframe`을 사용한다.
- `ELEMENT`: 라벨, 입력칸, 버튼, 배지, 카드, 체크박스 등 반복 UI다.

## 이름 규칙

- `ui-*`: 메뉴와 무관한 공통 구조와 시각 토큰.
- `tool-*`: 계산기, 역계산, 세부조정이 공유하는 도구형 컴포넌트.
- `calc-*`: 대미지 계산기 전용 기능이나 배치.
- `rc-*`: 내구 역계산 전용 상태, 데이터 바인딩, 분석 결과.
- `ft-*`: 세부조정 전용. 계산기/역계산에는 새로 섞지 않는다.

계산기와 역계산 안에서는 예전 호환 클래스인 `panel`, `panel-head`, `panel-body`,
`field`, `field-label`, `ft-controls-row`, `rc-input-divider` 같은 구조용 잔재를 다시
넣지 않는다.

## 공통 Panel

패널은 최외곽 영역이다.

```html
<section class="ui-frame ui-panel ...">
  <div class="ui-frame-head ui-panel-head">
    <div class="ui-panel-title">...</div>
    <div class="ui-action-row ui-panel-actions">...</div>
  </div>
  <div class="ui-frame-body ui-panel-body ui-subframe-stack">
    ...
  </div>
</section>
```

주요 공통 클래스:

- `ui-frame`
- `ui-panel`
- `ui-frame-head`
- `ui-panel-head`
- `ui-panel-title`
- `ui-panel-tag`
- `ui-action-row`
- `ui-panel-actions`
- `ui-frame-body`
- `ui-panel-body`
- `ui-subframe-stack`

## 공통 Subframe

패널 안의 기능 묶음은 subframe으로 둔다.

```html
<div class="ui-control-frame ui-subframe ...">
  ...
</div>
```

주요 공통 클래스:

- `ui-control-frame`
- `ui-subframe`
- `ui-subframe-stack`
- `ui-control-grid`
- `ui-control-row`
- `ui-control-cell`
- `ui-section-head`
- `ui-section-title`

## 공통 Element

- 라벨/필드: `ui-field`, `ui-field-label`, `ui-control-label`
- 버튼: `ui-btn`, `ui-label-action`, `ui-field-action`, `ui-popover-trigger`
- 선택/입력: `cb-input`, `cb-trigger`, `ui-choice-field`, `ui-choice-combobox`, `ui-choice-surface`
- 체크박스: `ui-check`
- 배지/칩: `ui-chip-row`, `ui-metric-chip`, `ui-status-badge`, `ui-count-badge`
- 카드: `ui-card-grid`, `ui-card`, `ui-card-head`, `ui-card-body`, `ui-result-card`
- 능력치: `ui-stat-table`, `ui-stat-grid`, `ui-stat-readout`, `ui-stat-button`, `ui-stat-value`

## 공통 도구 컴포넌트

### Pokemon Select

공통 렌더러: `renderToolPokemonSelectSubframe()`

```text
.tool-pokemon-subframe.ui-control-frame.ui-subframe
> .tool-pokemon-field.ui-field
  > .tool-pokemon-head.ui-section-head
    > .tool-pokemon-label-actions
      > .ui-field-label.ui-section-title: 포켓몬
      > .party-load-button.ui-label-action.ui-field-action: 불러오기
    > .tool-pokemon-nav-actions or meta actions
  > .tool-pokemon-combobox
    > .tool-pokemon-input
  > .tool-pokemon-toolbar-row
    > 타입 배지
    > 폼 선택
    > 초기화 or 메뉴별 액션
```

적용 메뉴:

- 대미지 계산기: 공격측/방어측 모두 사용.
- 내구 역계산: 내 포켓몬/상대 포켓몬 모두 사용.
- 세부조정: 이미 같은 방향으로 맞춰져 있으며 다음 정리 기준으로 유지.

### Settings

설정 선택은 `tool-settings-*` 계층을 공유한다.

```text
.tool-settings-subframe.ui-control-frame.ui-subframe.ui-field
> .tool-settings-grid.ui-control-grid
  > .tool-settings-cell.ui-control-cell.ui-field
    > .tool-settings-label.ui-field-label.ui-control-label
    > .tool-settings-combobox
      > .tool-settings-choice-surface
```

적용 항목:

- 특성
- 도구
- 성격
- 상태
- HP%

계산기와 역계산의 포켓몬 선택/설정 선택은 같은 계열로 정리되어 있다.

### Stat

능력치 계열은 `tool-stat-*`를 공유한다.

공통 렌더러와 유틸:

- `renderToolStatHead()`
- `renderToolStatRows()`
- `renderToolStatPointControl()`
- `renderToolStatRankControl()`
- `renderToolStatNatureMark()`
- `toolStatApplyPointValue()`
- `toolStatApplyRankDelta()`

공통 구조:

```text
.tool-stat-panel.ui-control-frame.ui-subframe.ui-subframe-stack.ui-field
> .tool-stat-panel-head.ui-section-head
  > .tool-stat-panel-title.ui-section-title
  > .tool-stat-total.ui-metric-chip
> .tool-stat-panel-body
  > .tool-stat-table-frame.ui-control-frame
    > .tool-stat-grid.ui-stat-grid.ui-stat-table
      > .tool-stat-head-row
      > .tool-stat-row
```

계산기, 역계산 모두 능력치 입력, 0/32 버튼, 노력치 입력, 랭크 -/+ 버튼, 종족값,
실수치 readout이 이 계열을 사용한다. 세부조정의 매직넘버 열은 다음 작업에서
`tool-stat-*` 위의 선택 열로 취급하면 된다.

### Move

기술배치는 `tool-move-*` 계층을 공유한다.

```text
.tool-move-panel.ui-control-frame.ui-subframe.ui-subframe-stack.ui-field
> .tool-move-panel-head.ui-section-head
  > .tool-move-panel-title.ui-section-title
> .tool-move-panel-body
  > .tool-move-list-frame.ui-control-frame
    > .tool-move-list.ui-control-grid
      > .tool-move-row or compact move slots
```

계산기는 기술명, 타입, 위력, 결정력을 모두 보여준다. 역계산은 기술명만 필요한
compact 형태로 사용한다.

## 대미지 계산기 최종 계층

```text
#page-calc.page-frame
> .battle-grid.ui-frame-row
  > .ui-frame.atk.ui-panel
    > .ui-frame-head.ui-panel-head
      > .ui-panel-title: 공격측
      > .ui-panel-tag: ATK
    > #atk-body.calc-side-body.ui-frame-body.ui-panel-body.ui-subframe-stack
      > Pokemon Select Subframe
      > Settings Subframe
      > Stat Subframe
      > Move Subframe
  > #btnSwapSides.calc-side-swap-button
  > .ui-frame.def.ui-panel
    > .ui-frame-head.ui-panel-head
      > .ui-panel-title: 방어측
      > .ui-panel-tag: DEF
    > #def-body.calc-side-body.ui-frame-body.ui-panel-body.ui-subframe-stack
      > Pokemon Select Subframe
      > Settings Subframe
      > Stat Subframe
      > Move Subframe
> .calc-field-row.ui-frame-row
  > #calc-field-panel.ui-frame.ui-panel.collapsible
    > #calc-field-head.ui-frame-head.ui-panel-head
    > .ui-frame-body.ui-panel-body.ui-subframe-stack
      > .battle-field-select-frame.ui-control-frame.ui-subframe.ui-control-grid
      > .calc-field-effects-frame.ui-control-frame.ui-subframe.ui-control-row
> .calc-results-panel.ui-frame.ui-panel
  > .calc-results-head.ui-frame-head.ui-panel-head
  > #calc-results-body.calc-results-body.ui-frame-body.ui-panel-body.ui-subframe-stack
    > .calc-mold-breaker-info.ui-control-frame.ui-subframe.ui-meta-row
    > .calc-speed-row.ui-control-frame.ui-subframe.ui-summary-row
    > .calc-result-grid.ui-control-frame.ui-subframe.ui-card-grid
      > .calc-result-card.ui-card.ui-result-card
```

### 계산기 고유 요소

- `calc-side-body`
- `calc-side-swap-button`
- `calc-page-jump-button`
- `calc-settings-field`
- `calc-stat-*`
- `calc-field-*`
- `calc-results-*`
- `calc-result-*`
- `calc-move-*`
- `calc-damage-*`
- `calc-mold-breaker-info`
- `calc-speed-row`

날씨와 필드 선택은 역계산에서도 사용하므로 `battle-weather-field`,
`battle-terrain-field` 이름을 유지한다. 룰과 부가효과 체크들은 계산기 전용이다.

### 계산기 결과 배지

조건부로 출력되는 결과 배지도 현재 공통 UI를 받는다.

- 분류: `cat-badge calc-move-cat-badge`
- 타입: `type-pill calc-move-type-badge`
- 자속: `calc-stab-badge`
- 상성: `calc-effectiveness-badge`
- 조건부 위력: `calc-timing-power-badge ui-status-badge`
- 보정: `calc-mod-badge ui-status-badge`
- 반동/흡수: `calc-side-effect-badge ui-status-badge`
- KO 정보: `calc-ko-badge`

## 내구 역계산 최종 계층

```text
#page-revcalc.page-frame.tool-page
> .rc-grid.ui-frame-row
  > .rc-my.ui-frame.ui-panel
    > .ui-frame-head.ui-panel-head
      > .ui-panel-title: 내 포켓몬
    > #rc-my-body.ui-frame-body.ui-panel-body.ui-subframe-stack
      > .rc-setup-grid.tool-settings-layout.ui-control-grid
        > Pokemon Select Subframe
        > Settings Subframe
      > .rc-my-build-row.ui-control-row
        > .tool-stat-panel.tool-stat-set--revcalc
        > .rc-my-moves-panel.tool-move-panel.tool-move-no-type.tool-move-no-power.tool-move-no-readout
  > .rc-opp.ui-frame.ui-panel
    > .ui-frame-head.ui-panel-head
      > .ui-panel-title: 상대 포켓몬
    > #rc-opp-body.ui-frame-body.ui-panel-body.ui-subframe-stack
      > .rc-setup-grid.rc-opp-setup.tool-settings-layout.ui-control-grid
        > Pokemon Select Subframe
        > Opponent Status Settings Subframe
      > .rc-opp-stat-panel.tool-stat-panel.tool-stat-set--revcalc-opponent
> 관측 데이터 .ui-frame.ui-panel
  > .ui-frame-head.ui-panel-head
    > .ui-panel-title: 관측 데이터
  > #rc-input-body.ui-frame-body.ui-panel-body.ui-subframe-stack
    > .rc-input-grid.ui-control-grid
      > .rc-input-block.rc-action-block: 내 행동
      > .rc-input-block.rc-action-block: 상대 행동
      > .rc-input-block.rc-speed-block: 선후공 | 필드 상태
      > .rc-input-block.rc-item-candidates-block: 도구 후보
> 형태 분석 결과 .ui-frame.ui-panel
  > .ui-frame-head.ui-panel-head
    > .ui-panel-title: 형태 분석 결과
    > .ui-panel-actions
      > #rcAnalyze.rc-analyze-btn.ui-btn.ui-btn-primary
  > #rc-results-body.ui-frame-body.ui-panel-body.ui-subframe-stack
    > .rc-briefing.ui-control-frame.ui-subframe
    > .rc-next-rank-panel.ui-control-frame.ui-subframe
    > .rc-results-list
      > .rc-result-row.rc-form-result.ui-control-frame.ui-subframe
```

### 역계산 관측 데이터

관측 데이터는 구분자 요소 없이 subframe과 stack gap만으로 나뉜다.

```text
.rc-input-block.ui-control-frame.ui-subframe.ui-subframe-stack
> .rc-section-title.ui-section-title
> .rc-observed-subframe.ui-control-frame.ui-subframe
  > .ui-field
> .rc-side-condition-row.rc-observed-subframe.ui-control-frame.ui-subframe.ui-control-grid
  > .ui-check
```

남아 있으면 안 되는 클래스:

- `rc-input-divider`
- `rc-collapse-divider`
- `ft-controls-row`
- `field`
- `field-label`

### 역계산 결과 영역

결과 영역은 메뉴 고유 의미가 많아서 `rc-*`를 허용한다. 다만 외곽 frame은 공통
`ui-control-frame`, `ui-subframe`, `ui-field`, `ui-check`, `ui-count-badge`를 같이 쓴다.

고유로 남는 것이 맞는 영역:

- `rc-briefing`
- `rc-next-rank-*`
- `rc-result-*`
- `rc-followup-*`
- `rc-prediction-*`
- `rc-item-candidates-*`
- `rc-item-chk`

## 계산기와 역계산 공통화 비교

| 영역 | 대미지 계산기 | 내구 역계산 | 공통화 상태 |
| --- | --- | --- | --- |
| 최외곽 패널 | `ui-frame ui-panel` | `ui-frame ui-panel` | 완료 |
| 패널 헤더 | `ui-frame-head ui-panel-head` | `ui-frame-head ui-panel-head` | 완료 |
| 패널 본문 | `ui-frame-body ui-panel-body ui-subframe-stack` | `ui-frame-body ui-panel-body ui-subframe-stack` | 완료 |
| 포켓몬 선택 | `tool-pokemon-*` | `tool-pokemon-*` | 완료 |
| 불러오기 버튼 | `party-load-button ui-label-action ui-field-action` | 동일 | 완료 |
| 폼 선택 | `tool-form-combobox` | 동일 | 완료 |
| 타입 배지 | `tool-pokemon-type-strip`, `type-pill` | 동일 | 완료 |
| 설정 선택 | `tool-settings-*` | `tool-settings-*` | 완료 |
| 능력치 섹션 | `tool-stat-*` + `calc-stat-*` | `tool-stat-*` + `rc-*` 데이터 hook | 완료 |
| 노력치 입력/0/32 | `tool-stat-*` | `tool-stat-*` | 완료 |
| 랭크 -/+ | `tool-stat-*` | `tool-stat-*` | 완료 |
| 기술배치 | `tool-move-*` full | `tool-move-*` compact | 완료 |
| 드롭다운 option | 공통 `combobox-option ui-option` | 공통 `combobox-option ui-option` | 완료 |
| 체크박스 | `ui-check` | `ui-check` | 완료 |
| 결과 카드 | `calc-result-*` + `ui-card` | `rc-result-*` + `ui-subframe` | 메뉴별 고유 |

## 제거 완료한 구버전 잔재

계산기와 역계산 완성 범위에서는 아래 클래스/패턴을 사용하지 않는다.

```text
panel
panel-head
panel-body
panel-title
panel-tag
panel-head-actions
field
field-label
ft-controls-row
rc-input-divider
rc-collapse-divider
rc-opp-rank-*
rc-result-stats
rc-practical-*
rc-hint
rc-turn-order-option
rc-opp-stat-head-cell
battle-conditions
condition-auto
```

주의: `ft-*`는 세부조정 파일 안에 남아 있을 수 있다. 세부조정은 다음 정리 대상이므로
이번 문서의 금지 기준은 `#page-calc`, `#page-revcalc`에 우선 적용한다.

## 다음 작업 기준

세부조정을 정리할 때는 다음 순서가 좋다.

1. 포켓몬 선택 subframe은 현재 `tool-pokemon-*` 구조를 유지한다.
2. 특성/도구/성격/상태/상대 포켓몬 선택은 `tool-settings-*` 구조를 우선 적용한다.
3. 능력치 섹션은 계산기/역계산에서 정리된 `tool-stat-*` 구조를 기준으로 삼는다.
4. 세부조정의 매직넘버 열은 `tool-stat-*` 테이블 위의 세부조정 전용 선택 열로 둔다.
5. 결과/분석 영역은 메뉴별 의미가 강하므로 `ft-*` 고유 클래스를 허용하되, 외곽 frame은 `ui-*`를 쓴다.

## 주요 파일

- `src/calc-template.html`: 정적 panel 구조.
- `src/js/01-20-html-structure.js`: 공통 HTML 렌더 헬퍼. `tool-stat-*`, `tool-move-*` 기준.
- `src/js/03-10-calc-state.js`: 계산기 상태와 포켓몬 선택 공통 subframe 렌더러.
- `src/js/03-20-calc-combobox.js`: 공통 combobox option/portal 렌더링.
- `src/js/03-30-calc-side-render.js`: 계산기 공격/방어 subframe 렌더링.
- `src/js/03-50-calc-results.js`: 계산기 결과 패널 렌더링.
- `src/js/04-40-revcalc-state.js`: 역계산 상태, compact move/item 후보 로직.
- `src/js/04-41-revcalc-scoring.js`: 역계산 분석/랭크 결과 렌더링.
- `src/js/04-43-revcalc-render.js`: 역계산 화면 렌더링.
- `src/js/04-44-revcalc-events.js`: 역계산 이벤트와 combobox wiring.
- `src/styles/04-ui-foundation.css`: 공통 `ui-*`, `tool-*` 기본 스타일.
- `src/styles/pages/00-tool-pages.css`: 도구 메뉴별 layout과 남은 메뉴 고유 스타일.
- `src/styles/themes.css`: 다크모드와 페이지별 semantic token mapping.
- `src/styles/responsive.css`: 모바일 밀도, touch target, compact view.
- `scripts/css-structure-check.mjs`: CSS 구조 검사.
- `scripts/html-structure-check.mjs`: HTML 구조 검사.

## 검증 명령

완성 기준 확인에 사용한 명령:

```bash
npm.cmd run build
npm.cmd run css:structure
npm.cmd run html:structure
npm.cmd run damage:golden
npm.cmd run reverse:golden
git diff --check
```

잔재 검색 기준:

```bash
rg -n "rc-input-divider|rc-collapse-divider|rc-opp-rank|rc-result-stats|rc-practical|rc-hint|field-label|class=\"field|panel-head|panel-body|panel-title|panel-tag|panel-head-actions|ft-controls-row" src/js/04-43-revcalc-render.js src/calc-template.html src/styles/pages/00-tool-pages.css src/styles/04-ui-foundation.css src/styles/themes.css pokemon-champions-calculator-v3.html
```
