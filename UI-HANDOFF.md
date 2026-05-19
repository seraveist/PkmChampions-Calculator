# UI Handoff: Calculator UI Complete

이 문서는 다른 PC에서 `codex-ui-panel-subframe-handoff-20260519` 브랜치를 이어받아 작업할 때 필요한 UI 구조 인수인계 문서다. 2026-05-19 기준 대미지 계산기 UI 구조 정리는 완료 상태이며, 다음 작업은 형태 역계산과 세부조정 메뉴를 같은 규칙으로 맞추는 것이다.

## 현재 브랜치

- 작업 브랜치: `codex-ui-panel-subframe-handoff-20260519`
- 원격 브랜치: `origin/codex-ui-panel-subframe-handoff-20260519`
- 커밋 기준 메모: `calculator ui complete`

## 기본 방향

전체 UI 계층은 아래 구조를 기준으로 둔다.

```text
메뉴별 LAYOUT
> UI-PANEL
  > SUBFRAME
    > ELEMENT
```

- 메뉴별 layout은 화면 배치가 다를 수 있으므로 각 메뉴 전용 클래스를 허용한다.
- 패널, 서브프레임, 라벨, 버튼, 입력칸, 뱃지, 스텝퍼는 가능한 공통 `ui-*`와 `tool-*` 클래스를 먼저 사용한다.
- 대미지 계산기에서만 필요한 기능/상태/배치는 `calc-*` 클래스로 분리한다.
- 이전 구조의 `panel`, `panel-head`, `field`, `field-label`, `ev-*`, `stat-*`, `durability-*`, `move-card`, `results-body` 같은 계산기 레거시 클래스는 `#page-calc` 안에서 제거했다.
- 구조와 시각 스타일이 섞이지 않도록 한다. 구조는 `ui-*`, 도구 공통 요소는 `tool-*`, 계산기 전용 요소는 `calc-*`로 읽히게 둔다.

## 공통 클래스 규칙

### Panel

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

### Subframe

패널 안의 기능 단위는 서브프레임으로 묶는다.

```html
<div class="ui-control-frame ui-subframe ...">
  ...
</div>
```

주요 공통 클래스:

- `ui-control-frame`
- `ui-subframe`
- `ui-control-grid`
- `ui-control-row`
- `ui-section-head`
- `ui-section-title`

### Element

반복되는 입력/버튼/뱃지/카드류는 아래 계층을 우선 사용한다.

- 라벨/필드: `ui-field`, `ui-field-label`, `ui-control-label`
- 버튼: `ui-btn`, `ui-label-action`, `ui-field-action`, `ui-popover-trigger`
- 입력/선택: `cb-input`, `cb-trigger`, `ui-choice-field`, `ui-choice-combobox`, `ui-choice-surface`
- 체크박스: `ui-check`
- 칩/뱃지: `ui-chip-row`, `ui-metric-chip`, `ui-status-badge`
- 카드: `ui-card-grid`, `ui-card`, `ui-card-head`, `ui-card-body`
- 수치/스텝퍼: `ui-stat-table`, `ui-stat-grid`, `ui-stat-readout`, `ui-stepper`

## 대미지 계산기 최종 계층

대미지 계산기의 `#page-calc` 안은 아래 기준으로 정리되어 있다.

```text
#page-calc.page-frame
├─ .battle-grid.ui-frame-row
│  ├─ .ui-frame.atk.ui-panel
│  │  ├─ .ui-frame-head.ui-panel-head
│  │  │  ├─ .ui-panel-title: 공격측
│  │  │  └─ .ui-panel-tag: ATK
│  │  └─ #atk-body.calc-side-body.ui-frame-body.ui-panel-body.ui-subframe-stack
│  │     ├─ Pokemon Select Subframe
│  │     ├─ Settings Subframe
│  │     ├─ Stat Subframe
│  │     └─ Move Subframe
│  ├─ #btnSwapSides.calc-side-swap-button
│  └─ .ui-frame.def.ui-panel
│     ├─ .ui-frame-head.ui-panel-head
│     │  ├─ .ui-panel-title: 방어측
│     │  └─ .ui-panel-tag: DEF
│     └─ #def-body.calc-side-body.ui-frame-body.ui-panel-body.ui-subframe-stack
│        ├─ Pokemon Select Subframe
│        ├─ Settings Subframe
│        ├─ Stat Subframe
│        └─ Move Subframe
├─ .calc-field-row.ui-frame-row
│  └─ #calc-field-panel.ui-frame.ui-panel.collapsible
│     ├─ #calc-field-head.ui-frame-head.ui-panel-head
│     └─ .ui-frame-body.ui-panel-body.ui-subframe-stack
│        ├─ .battle-field-select-frame
│        └─ .calc-field-effects-frame
└─ .calc-results-panel.ui-frame.ui-panel
   ├─ .calc-results-head.ui-frame-head.ui-panel-head
   └─ #calc-results-body.calc-results-body.ui-frame-body.ui-panel-body.ui-subframe-stack
      ├─ .calc-mold-breaker-info
      ├─ .calc-speed-row
      └─ .calc-result-grid
```

## 대미지 계산기 서브프레임 상세

### 1. 포켓몬 선택

공격측/방어측 모두 `renderToolPokemonSelectSubframe()`을 사용한다.

```text
.tool-pokemon-subframe.ui-control-frame.ui-subframe
└─ .tool-pokemon-field.ui-field
   ├─ .ui-field-head.tool-pokemon-head.tool-pokemon-row.tool-pokemon-head-row
   │  ├─ .tool-pokemon-label-actions
   │  │  ├─ .ui-field-label.ui-section-title: 포켓몬
   │  │  └─ .party-load-button.ui-label-action.ui-field-action: 불러오기
   │  └─ .tool-pokemon-nav-actions
   │     ├─ .calc-page-jump-button: 세부조정
   │     └─ .calc-page-jump-button: 역계산
   ├─ .tool-pokemon-combobox
   │  └─ .tool-pokemon-input
   └─ .tool-pokemon-toolbar-row
      ├─ 타입 선택 버튼
      ├─ 폼체인지 선택 박스
      └─ 초기화 버튼
```

현재 포켓몬 선택 subframe은 대미지 계산기, 형태 역계산, 세부조정이 같은 계열의 `tool-pokemon-*` 구조를 공유한다. 다음 메뉴 정리 때도 이 구조를 유지하면 된다.

### 2. 포켓몬 세팅

특성, 도구, 성격, 상태/HP%는 `tool-settings-*` 계층으로 정리되어 있다.

```text
.calc-settings-field.tool-settings-subframe.ui-control-frame.ui-subframe
└─ .calc-pair-grid.tool-settings-grid.ui-control-grid
   ├─ 특성: .tool-settings-select-cell
   ├─ 도구: .tool-settings-select-cell
   ├─ 성격: .tool-settings-select-cell
   └─ 상태/HP: .tool-settings-condition-cell
```

참고:

- 포켓몬 세팅 선택 UI는 역계산/세부조정과 기본 방향이 맞춰져 있다.
- 메뉴별로 데이터나 이벤트는 다를 수 있지만, 입력칸/라벨/드롭다운의 시각 계층은 `tool-settings-*`를 기준으로 가져가면 된다.
- 상태와 HP%처럼 복합 입력인 경우 `tool-settings-compound`, `tool-settings-hp-control`, `tool-settings-status-combobox`를 사용한다.

### 3. 능력 포인트 / 랭크

능력치 섹션은 공통 `tool-stat-*` 계층 위에 계산기 전용 `calc-stat-*`를 얹었다.

```text
.calc-stat-panel.tool-stat-panel.ui-control-frame.ui-subframe
├─ .calc-stat-panel-head.tool-stat-panel-head.ui-section-head
│  ├─ .tool-stat-panel-title.ui-section-title
│  │  └─ .calc-stat-preset-toggle.tool-stat-preset-button.ui-popover-trigger
│  └─ .calc-stat-total.tool-stat-total.ui-metric-chip
├─ .calc-stat-body.tool-stat-panel-body
│  └─ .tool-stat-table-frame.ui-control-frame
│     └─ .calc-stat-grid.tool-stat-grid.ui-stat-grid.ui-stat-table
│        ├─ .calc-stat-head-row.tool-stat-head-row
│        └─ .calc-stat-row.tool-stat-row
├─ .calc-stat-bulk-strip.tool-stat-bulk-strip
│  ├─ .calc-stat-bulk-card.calc-stat-bulk-phys
│  └─ .calc-stat-bulk-card.calc-stat-bulk-spec
└─ .calc-stat-preset-popover.tool-stat-preset-popover
```

공통으로 쓸 수 있는 함수/요소:

- `renderToolStatHead()`
- `renderToolStatRows()`
- `renderToolStatPointControl()`
- `renderToolStatRankControl()`
- `renderToolStatBulkStrip()`
- `toolStatApplyPointValue()`
- `toolStatApplyRankDelta()`

계산기 전용 요소:

- `calc-stat-preset-toggle`
- `calc-stat-preset-shell`
- `calc-stat-preset-popover`
- `calc-stat-preset-option`
- `calc-stat-reset-button`
- `calc-stat-total`
- `calc-stat-bulk-*`

다음 작업에서 형태 역계산/세부조정의 능력치 섹션도 이 구조를 그대로 따르게 하는 것이 좋다. 세부조정의 매직넘버 열은 세부조정 전용으로 남기되, 같은 `tool-stat-*` 테이블의 선택 열로 취급하면 된다.

### 4. 기술 배치

기술 배치는 `tool-move-*` 계층을 사용한다.

```text
.tool-move-panel.ui-control-frame.ui-subframe
├─ .tool-move-panel-head.ui-section-head
│  └─ .tool-move-panel-title.ui-section-title
└─ .tool-move-panel-body
   └─ .tool-move-list-frame.ui-control-frame
      └─ .tool-move-list
         ├─ .tool-move-head-row
         └─ .tool-move-row
            ├─ .tool-move-col-index
            ├─ .tool-move-combobox / .tool-move-input
            ├─ .tool-move-type-control / .tool-move-type-input
            ├─ .tool-move-power-control / .tool-move-power-input
            └─ .tool-move-power-readout
```

타입 배지와 결정력 readout은 공통화해 두었고, 메뉴별로 표시/숨김만 다르게 가져가면 된다.

### 5. 필드 / 부가 효과

필드 패널은 계산기 전용 패널이지만 내부 선택칸은 전투 공통으로 올릴 수 있게 정리했다.

```text
#calc-field-panel
├─ .battle-field-select-frame.ui-control-frame.ui-subframe.ui-control-grid
│  ├─ .battle-weather-field.ui-choice-field: 날씨
│  ├─ .battle-terrain-field.ui-choice-field: 필드
│  └─ .calc-rule-field.ui-choice-field: 룰
└─ .calc-field-effects-frame.ui-control-frame.ui-subframe.ui-control-row
   ├─ 급소
   ├─ 리플렉터
   ├─ 빛의장막
   ├─ 도우미
   ├─ 재앙 특성 체크들
   ├─ 스텔스록
   ├─ 압정뿌리기 + .calc-spikes-layer-combobox
   └─ 중력장
```

참고:

- 날씨/필드 선택은 역계산에서도 사용될 예정이라 `battle-weather-field`, `battle-terrain-field`로 공통 명명했다.
- 룰, 자동진입효과, 각종 부가효과 체크는 계산기 전용에 가깝기 때문에 `calc-*` 또는 현재 계산기 패널 안에 둔다.

### 6. 결과 패널

결과 패널은 모두 `calc-result-*`와 공통 카드/뱃지 계층을 사용한다.

```text
.calc-results-panel.ui-frame.ui-panel
└─ #calc-results-body.ui-frame-body.ui-panel-body.ui-subframe-stack
   ├─ .calc-mold-breaker-info.ui-control-frame.ui-subframe.ui-meta-row
   ├─ .calc-speed-row.ui-control-frame.ui-subframe.ui-summary-row
   └─ .calc-result-grid.ui-control-frame.ui-subframe.ui-card-grid
      └─ .calc-result-card.ui-card.ui-result-card
         ├─ .calc-result-card-head.ui-card-head
         │  ├─ .calc-result-title-row
         │  └─ .calc-move-badges.ui-chip-row
         ├─ .calc-damage-range.ui-meter
         ├─ .calc-damage-summary
         └─ .calc-damage-meta.ui-meta-row
```

조건부로 출력되는 배지들도 새 계층을 받는다.

- 분류: `cat-badge calc-move-cat-badge`
- 타입: `type-pill calc-move-type-badge`
- 자속: `calc-stab-badge`
- 상성: `calc-effectiveness-badge`
- 조건부 위력: `calc-timing-power-badge ui-status-badge`
- 보정: `calc-mod-badge ui-status-badge`
- 반동/흡수: `calc-side-effect-badge ui-status-badge`
- KO 정보: `calc-ko-badge`

## 오늘 정리된 레거시 제거 기준

`#page-calc` 실제 DOM 기준으로 아래 클래스들은 더 이상 나오지 않아야 한다.

```text
field
field-label
field-panel
field-head
field-inline-combobox
field-inline-input
ev-field
ev-preset-*
ev-total
stat-grid
stat-table-head
stat-name
stat-base
stat-final
durability-*
results
results-body
move-results
move-card
mold-breaker-info
speed-row
dmg-*
hp-remain
mods-trace
panel
panel-head
panel-body
panel-title
panel-tag
panel-head-actions
```

주의: 다른 메뉴에는 아직 기존 호환 클래스가 남아 있을 수 있다. 이번 완료 기준은 대미지 계산기 `#page-calc` 내부다.

## 다음 작업: 형태 역계산 / 세부조정 참고사항

다음 작업은 형태 역계산과 세부조정 메뉴를 대미지 계산기의 정리 기준으로 맞추면 된다.

추천 순서:

1. 포켓몬 선택 subframe 확인
   - 이미 세 메뉴가 `tool-pokemon-*` 계열을 공유하는 방향으로 맞춰져 있다.
   - 형태 역계산/세부조정의 포켓몬 선택은 현재 구조를 유지하되, 남은 메뉴 전용 레거시 클래스가 있으면 제거한다.

2. 포켓몬 세팅 subframe 확인
   - 특성/도구/성격/상태 계열은 `tool-settings-*`로 맞추는 것이 기준이다.
   - 대미지 계산기와 형태 역계산/세부조정의 세팅 선택 UI는 이미 거의 같은 개념으로 맞춰져 있으므로, 차이가 있다면 데이터 흐름이나 배치 목적 때문인지 먼저 확인한다.

3. 능력치 섹션 통합
   - 대미지 계산기 능력치 섹션의 `tool-stat-*` + `calc-stat-*` 구조를 기준으로 삼는다.
   - 형태 역계산/세부조정은 계산기 전용 `calc-*`가 아니라 메뉴 전용 접두사 또는 순수 `tool-stat-*`를 쓰는 쪽이 좋다.
   - 세부조정의 매직넘버 열은 세부조정 전용 열로 유지한다.
   - 노력치 입력, 0/32 버튼, 랭크 -/+ 버튼, 실수치/종족값 readout은 공통 `tool-stat-*`를 최대한 공유한다.

4. 기술/관측 입력 정리
   - 기술 선택, 타입 선택, 위력/결정력 readout이 필요하면 `tool-move-*`를 기준으로 가져간다.
   - 역계산은 관측 데이터, 행동 순서, 상대 다음 기술 등 계산기와 다른 도메인 입력이 있으므로 무리하게 계산기 전용 클래스를 쓰지 않는다.

5. 결과/요약 카드 정리
   - 반복 카드나 결과 목록은 `ui-card`, `ui-card-grid`, `ui-status-badge`, `ui-metric-chip`을 먼저 적용한다.
   - 메뉴 고유 의미는 `rc-*`, `ft-*` 같은 접두사로만 보조한다.

## 핵심 파일

- `src/calc-template.html`
  - SPA의 정적 panel 구조, 계산기 필드/결과 패널 구조.
- `src/js/01-20-html-structure.js`
  - 공통 HTML 렌더 헬퍼. `tool-stat-*`, `tool-move-*` 생성 기준이 들어 있다.
- `src/js/03-10-calc-state.js`
  - 계산기 상태와 포켓몬 선택 공통 subframe 헬퍼.
- `src/js/03-20-calc-combobox.js`
  - 계산기 드롭다운/portal 렌더링.
- `src/js/03-30-calc-side-render.js`
  - 계산기 공격측/방어측 내부 subframe 렌더링.
- `src/js/03-50-calc-results.js`
  - 계산기 결과 패널 렌더링.
- `src/js/03-60-calc-events.js`
  - 계산기 필드 패널, 프리셋, 공수교대 이벤트.
- `src/styles/04-ui-foundation.css`
  - 공통 `ui-*`, `tool-*` 스타일 기준.
- `src/styles/05-calc-sample-layout.css`
  - 대미지 계산기 전용 layout/variant.
- `src/styles/08-theme-bridge.css`
  - 다크모드 및 테마 브릿지.
- `scripts/css-structure-check.mjs`
  - CSS 구조 규칙 검사.
- `scripts/html-structure-check.mjs`
  - HTML 구조 규칙 검사.

## 검증 상태

마지막 확인 기준으로 아래 명령은 통과했다.

```bash
npm.cmd run build
npm.cmd run css:structure
npm.cmd run html:structure
npm.cmd run build:pages
```

브라우저 QA도 진행했다.

- `dist/index.html` 로컬 서버 로드
- 계산기 페이지 렌더 확인
- 필드 패널 펼침 상호작용 확인
- 다크모드 토글 확인
- 콘솔 warning/error 없음
- `#page-calc` 내부 old class 검사 결과: `[]`

Cloudflare Pages 설정은 기존과 동일하다.

```text
Build command: npm run build:pages
Build output directory: /dist
```

