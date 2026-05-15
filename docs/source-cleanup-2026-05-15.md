# Source Cleanup 2026-05-15

UI/UX 전면 개편 전에 소스 구조를 먼저 정리한 작업 기록이다.

## 목적

- 거대 단일 파일을 메뉴/역할별로 나눠서 이후 UI 교체와 로직 보완의 충돌을 줄인다.
- 구버전 구현을 덮어쓰는 방식의 잔재를 제거한다.
- 테스트 스크립트가 특정 파일명에 고정되지 않고, 분리된 소스 그룹을 읽도록 만든다.

## JavaScript 구조

### Core

- `src/js/01-core.js`: 공통 데이터, 상태 계산, 타입/특성/도구 공통 헬퍼
- `src/js/02-engine.js`: 순수 대미지 계산 엔진

### Damage Calculator

기존 `src/js/03-calc-ui.js`를 다음 파일로 분리했다.

- `src/js/03-10-calc-state.js`: 계산기 상태, 기본값, 옵션, 공통 헬퍼
- `src/js/03-20-calc-combobox.js`: 결정력 추정, 계산기 combobox 공통 로직
- `src/js/03-30-calc-side-render.js`: 공격/방어 사이드 패널 렌더링과 사이드 이벤트
- `src/js/03-40-calc-entry-effects.js`: 자동 진입 효과와 파생 계산 상태
- `src/js/03-50-calc-results.js`: 계산 실행, 결과 패널 렌더링
- `src/js/03-60-calc-events.js`: 필드 컨트롤, 자동 계산, 스왑, 페이지 레벨 이벤트

### View Tabs

기존 `src/js/04-views.js`를 다음 메뉴별 파일로 분리했다.

- `src/js/04-10-dex.js`: 도감
- `src/js/04-20-matchup.js`: 상성표
- `src/js/04-30-finetune.js`: 세부조정
- `src/js/04-40-revcalc-state.js`: 역계산 상태, 필드, 기술/도구/특성/속도 헬퍼
- `src/js/04-41-revcalc-scoring.js`: 역계산 점수화, 그룹화, 형태 완성 추정, 후속 대미지 헬퍼
- `src/js/04-42-revcalc-candidates.js`: 역계산 후보 생성과 분석 orchestration
- `src/js/04-43-revcalc-render.js`: 역계산 렌더링
- `src/js/04-44-revcalc-events.js`: 역계산 DOM 동기화와 이벤트

## Test Loader

`scripts/source-utils.mjs`를 추가했다.

- `readCalcUiSource(root)`: `src/js/03-*.js`를 알파벳순으로 읽는다.
- `readViewSource(root)`: `src/js/04-*.js`를 알파벳순으로 읽는다.

이에 맞춰 다음 스크립트의 직접 파일 참조를 제거했다.

- `scripts/entry-effects-state.mjs`
- `scripts/fine-tune-state.mjs`
- `scripts/reverse-golden.mjs`
- `scripts/dex-ui-smoke.mjs`
- `scripts/coverage-matrix.mjs`

## Removed Legacy

- 세부조정 탭의 V1/V2/V3 함수 덮어쓰기 패턴을 제거했다.
- `src/js/04-views.js` shim을 제거했다.
- 한국어 보강/Reg.A 토글 관련 UI와 잔여 참조를 제거했다.

## Verification

다음 명령을 통과했다.

```powershell
npm.cmd run build
npm.cmd test
```

## Next Cleanup Candidates

- `src/styles/02-pages.css`는 아직 여러 메뉴 스타일이 한 파일에 남아 있다. UI/UX 재설계 시 메뉴별 CSS로 재분리하는 것이 좋다.
- `src/js/02-engine.js`는 계산 엔진 단일 파일로 유지 중이다. 계산 안정성이 중요하므로 UI 재설계와는 분리해서 별도 리팩토링하는 것이 안전하다.
