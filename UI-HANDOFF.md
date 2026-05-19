# UI Panel / Subframe Handoff

이 문서는 다른 PC에서 `codex-ui-panel-subframe-handoff-20260519` 브랜치를 이어서 작업하기 위한 단일 handoff 문서다. 현재 작업의 목표는 계산기, 형태 역계산, 세부조정, 상성표의 panel/subframe 구조와 기본 UI 값을 공통 class로 정리하는 것이다. 도감은 마지막에 별도 정리할 예정이므로 이번 공통화 범위에서는 제외한다.

## 현재 브랜치

- 작업 브랜치: `codex-ui-panel-subframe-handoff-20260519`
- 원격 브랜치: `origin/codex-ui-panel-subframe-handoff-20260519`
- 기준 방향: 대미지 계산기의 포켓몬 선택, 포켓몬 설정, panel/subframe 규격을 base로 삼아 다른 메뉴에 확산한다.

## 현재 상태 요약

- 모든 주요 메뉴의 최외곽 panel은 `ui-panel` 계열 공통 class를 받도록 정리했다.
- panel header는 높이 `50px` 기준으로 통일했다.
- panel header 안의 title, actions, 버튼, ATK/DEF badge는 공통 규격을 타도록 정리했다.
- panel border, radius, point line, overflow 등 frame 관련 개별 override를 제거하고 색상 variant만 개별로 남기는 방향으로 정리했다.
- panel body는 `ui-subframe-stack`을 통해 내부 subframe 간격을 공통 관리한다.
- `margin`, `gap` 계열 layout 값은 가능한 한 menu-specific selector에서 제거하고 공통 layout/grid class로 올렸다.
- 도감(`dex-*`)은 아직 별도 정리 대상이라 검사/정리 대상에서 제외한다.

## 공통 구조 원칙

기본 계층은 아래 순서로 본다.

```text
page layout
> ui-panel
  > ui-panel-head
  > ui-panel-body.ui-subframe-stack
    > ui-subframe
      > common element classes
```

### Panel

최외곽 frame은 아래 구조를 기준으로 한다.

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

- `panel`, `panel-head`, `panel-title`, `panel-body`는 기존 호환 class로 남을 수 있다.
- 실제 공통 frame 값은 `ui-panel`, `ui-panel-head`, `ui-panel-title`, `ui-panel-body`에서 관리한다.
- 메뉴별 class는 기능/색상 variant를 위한 보조 class로만 남기는 방향이다.

### Subframe

panel 내부의 기능 묶음은 아래 구조를 기준으로 한다.

```html
<div class="... ui-control-frame ui-subframe ...">
  ...
</div>
```

- subframe 자체의 padding, border, radius, background는 `ui-subframe`/`ui-control-frame` 공통값을 우선한다.
- subframe 제목은 `ui-section-head`, `ui-section-title` 또는 해당 기능의 `tool-*-title` class를 통해 공통 label token을 받는다.
- panel body 바로 아래에는 가능한 한 subframe만 배치한다.

### Element

반복되는 입력/버튼/라벨은 공통 class를 먼저 적용한다.

- 버튼: `ui-btn`, `ui-label-action`, `ui-field-action`, `ui-popover-trigger`
- field/label: `ui-field`, `ui-field-label`, `ui-control-label`
- row/grid: `ui-control-grid`, `ui-control-row`, `ui-action-row`
- card/chip: `ui-card`, `ui-card-grid`, `ui-metric-chip`, `ui-status-badge`
- stat/stepper: `ui-stat-readout`, `ui-stepper`, `tool-stat-*`
- 포켓몬 선택: `tool-pokemon-*`
- 포켓몬 설정: `tool-settings-*`
- 기술배치: `tool-move-*`

## 완료된 주요 작업

### 포켓몬 선택 subframe

- 대미지 계산기의 포켓몬 선택 UI를 기준으로 `tool-pokemon-*` 계열을 정리했다.
- 계산기, 형태 역계산, 세부조정의 포켓몬 선택칸은 같은 class 체계를 받도록 맞췄다.
- 포켓몬 이름 input, 불러오기 버튼, 타입 배지, 보조 action row를 공통 구조로 정리했다.

### 특성 / 도구 / 성격 / 상태 / HP%

- `tool-settings-*` 계열 공통 class를 추가했다.
- 특성, 성격, 도구는 같은 선택칸 class를 공유하고 dropdown 데이터만 개별 처리한다.
- 상태와 HP%는 같은 condition group 계열로 묶었다.
- HP% input의 focus는 개별 focus style 대신 공통 focus token을 사용하도록 정리했다.
- 폰트, 높이, radius, border, dark mode debug color가 같은 경로를 타도록 정리했다.
- dropdown이 열린 상태에서 다른 dropdown을 열 때 둘 다 닫히거나 초기화되는 문제를 combobox active state 처리 쪽에서 정리했다.

### Panel 공통화

- 계산기, 형태 역계산, 세부조정, 상성표의 주요 panel이 `ui-panel` 공통 frame을 받도록 정리했다.
- panel header 높이를 50px 기준으로 맞췄다.
- header 버튼 높이와 수직 정렬을 공통화했다.
- 공격측/방어측 badge도 header action 규격에 맞췄다.
- point line 위치는 수학적 정렬을 유지하는 방향으로 정리했고, round 경계 문제 때문에 최종적으로 공통 panel frame 안에서 처리하도록 맞췄다.
- 결과 panel의 `overflow: visible` 등 불필요한 개별 frame override를 제거했다.
- 세부조정 `ft-hp-panel`에 남아 있던 1px 개별 border도 제거해 공통 panel 값을 받게 했다.

### Panel 내부 layout 정리

- page/panel layout에서 중복된 `margin`, `gap` 값을 제거하고 공통 class로 이관했다.
- `ui-frame-row`, `.page-frame` sibling spacing, `ui-control-grid`, `ui-control-row`, `ui-subframe-stack`이 기본 간격을 관리한다.
- 메뉴별 layout class는 column 구성이나 반응형 배치처럼 실제 구조 차이가 있는 경우에만 남긴다.

### 계산기 필드 / 결과 panel

- 필드 panel은 선택 영역과 부가 효과 영역을 각각 subframe으로 분리했다.
- 필드 panel의 자동진입효과 토글은 예외 케이스로 header 우측에 유지했다.
- 결과 panel은 조건 안내, 속도 비교, 기술 결과 카드 영역을 각각 subframe으로 정리했다.
- 결과 카드 영역은 `ui-card-grid`/`ui-card` 계열과 함께 공통 frame을 받는다.

### 형태 역계산

- 상대 포켓몬 능력치 영역을 subframe 공통 구조로 정리했다.
- 관측 panel 안의 데이터 row 묶음에 subframe 계층을 적용했다.
- 내 행동, 상대 행동, 선후공/필드 상태, 도구 후보 등 주요 block이 `ui-subframe` 계열을 받도록 정리했다.

### 세부조정

- 상대/스피드 panel 내부를 subframe 계층으로 나눴다.
- 상대 포켓몬 선택에 2중 subframe이 들어가던 문제는 바깥 subframe을 제거했다.
- 상대/스피드 내부 stat/speed block이 panel body stack과 subframe 공통 구조를 받도록 정리했다.

### 상성표

- 방어 상성/타점 체크 toggle과 불러오기를 하나의 subframe으로 묶었다.
- 포켓몬 6마리 선택 영역을 하나의 subframe으로 묶었다.
- 타점 체크일 때 출력되는 6마리 기술배치 영역을 하나의 subframe으로 묶었다.

### 능력포인트 / 기술배치

- 계산기 능력포인트 subframe에 `tool-stat-*` 공통 class를 추가했다.
- 계산기 기술배치 subframe에 `tool-move-*` 공통 class를 추가했다.
- 능력포인트 라벨과 기술배치 라벨은 다른 subframe 라벨과 같은 공통 label token을 받도록 `04-ui-foundation.css`로 올렸다.
- 세부조정/형태 역계산에 남아 있던 능력포인트 라벨 개별 override를 제거했다.

## 현재 의도적으로 남아 있는 디버그 색상

공통 class가 실제로 어디까지 전파되는지 확인하기 위해 debug 색상을 아직 제거하지 않았다.

- `--ui-debug-panel-bg`
- `--ui-debug-subframe-bg`
- `--ui-debug-pokemon-select-bg`
- `--ui-debug-settings-select-bg`

다음 작업자가 실제 시각 정리 단계에 들어갈 때 제거하거나 neutral token으로 되돌리면 된다.

## 주요 파일

- `src/styles/04-ui-foundation.css`
  - `ui-*`, `tool-*` 공통 token과 frame/label/control class의 중심 파일.
- `src/styles/05-calc-sample-layout.css`
  - 계산기 전용 배치. 공통 가능한 값은 foundation으로 이동 중이다.
- `src/styles/07-tools-redesign.css`
  - 형태 역계산, 세부조정, 상성표 쪽 전용 배치와 variant.
- `src/styles/08-theme-bridge.css`
  - dark mode 및 legacy selector bridge.
- `src/calc-template.html`
  - SPA shell과 정적 panel/subframe 구조.
- `src/js/03-20-calc-combobox.js`
  - dropdown/combobox interaction.
- `src/js/03-30-calc-side-render.js`
  - 계산기 공격측/방어측 내부 subframe render.
- `src/js/04-20-matchup.js`
  - 상성표 구조.
- `src/js/04-30-finetune.js`
  - 세부조정 구조.
- `src/js/04-43-revcalc-render.js`
  - 형태 역계산 render 구조.
- `scripts/html-structure-check.mjs`
  - HTML 구조 class 검사.
- `scripts/css-structure-check.mjs`
  - CSS 공통화/override 검사.

## 검사 상태

마지막 작업 기준으로 아래 명령은 통과했다.

```bash
npm.cmd run build
npm.cmd run css:structure
npm.cmd run html:structure
```

다른 PC에서 이어받은 뒤에는 최소한 아래를 다시 실행한다.

```bash
npm test
npm run build:pages
```

## 다음 작업 추천 순서

1. 계산기의 능력포인트 subframe 내부 row/grid 세부 요소를 계속 정리한다.
2. 능력포인트의 point input, rank stepper, final stat readout이 `tool-stat-*` 공통 class만으로 충분한지 확인한다.
3. 세부조정/형태 역계산의 능력치 조정 UI와 계산기 능력포인트 UI 사이에서 더 공유할 수 있는 token/class를 추린다.
4. 기술배치 subframe 내부 row, 기술 선택 dropdown, 타입 override, 위력 override, 결정력 readout을 `tool-move-*` 중심으로 맞춘다.
5. debug 색상 제거 전, 계산기/형태 역계산/세부조정/상성표에서 panel/subframe 적용 범위를 한 번 더 눈으로 확인한다.
6. 도감은 마지막 단계에서 별도 기준을 잡아 정리한다.

## 다른 PC에서 시작하는 방법

```bash
git fetch origin
git switch codex-ui-panel-subframe-handoff-20260519
npm install
npm test
npm run build:pages
```

Cloudflare Pages 설정은 기존과 동일하다.

```text
Build command: npm run build:pages
Build output directory: /dist
```
