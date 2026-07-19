# UI 기반 재구축 진행 기록 - 2026-07-19

## 기준선

- 작업 브랜치: `codex-ui-foundation-rebuild-20260719`
- 기준 커밋: `5d8d934` (`feat: stabilize calculations and responsive UI`)
- 목표: 현재 화면과 계산 동작을 유지하면서 CSS 소유권을 점진적으로 분리한다.

## 이번 단계에서 완료한 내용

- 빌드가 `src/styles/`의 하위 디렉터리를 재귀적으로 읽도록 변경했다.
- 생성 CSS에 명시적인 cascade layer 순서를 추가했다.
- 기존 스타일 파일은 현재 우선순위를 보존하는 전환용 layer에 배치했다.
- `src/styles/00-tokens.css`에 라이트/다크 semantic token을 만들었다.
- 기존 `--bg`, `--ui-*` 계열 토큰은 semantic token을 참조하는 호환 alias로 유지했다.
- CSS 구조 검사에 layer 순서, semantic token, 하위 디렉터리 탐색 검증을 추가했다.
- 브라우저 검사에 라이트/다크 token 전환과 기존 UI alias 해석 검증을 추가했다.
- 공통 패널/프레임 규칙을 `components/panels.css`로 이동하고 기존 규칙을 제거했다.
- 공통 버튼과 상태 규칙을 `components/buttons.css`로 이동하고 기존 규칙을 제거했다.
- 공통 입력 필드와 인라인 숫자 입력을 `components/fields.css`로 이동했다.
- 콤보박스 포털, 옵션, 선택 상태를 `components/combobox.css`로 이동했다.
- 구조 검사가 공통 컴포넌트의 단일 소유권을 확인하도록 강화했다.

## Cascade layer 순서

```css
@layer reset, tokens, base, legacy-pages, legacy-foundation,
  components, layouts, pages, utilities, themes, legacy-polish;
```

`legacy-pages`, `legacy-foundation`, `legacy-polish`는 이전 기간에만 사용한다. 기존 파일의 규칙을
새 컴포넌트 또는 페이지 파일로 옮긴 뒤 원래 규칙을 제거해야 하며, 같은 규칙을 두 위치에 장기간
유지하지 않는다.

## 새 파일 배치 규칙

```text
src/styles/
  00-tokens.css       -> tokens
  01-reset.css        -> reset
  02-base.css         -> base
  components/*.css    -> components
  layouts/*.css       -> layouts
  pages/*.css         -> pages
  utilities.css       -> utilities
  themes.css          -> themes
```

## 다음 이전 순서

1. 앱 셸과 도구 페이지 골격을 `layouts/`로 이동한다.
2. 대미지 계산기 규칙을 `pages/calculator.css`로 이동한다.
3. 이동한 규칙을 `03`, `04`, `05`, `09` 파일에서 제거한다.
4. 계산기 이전이 끝나면 `legacy-pages`와 `legacy-polish`의 계산기 소유권이 없는지 검사한다.
5. 같은 방식으로 역계산, 세부조정, 상성표, 도감을 순차 이전한다.

UI 이전 중에는 계산 엔진을 함께 리팩터링하지 않고 기존 element ID와 이벤트 계약을 유지한다.

## 검증 기준

```bash
npm test
npm run ui:browser
npm run build:pages
git diff --check
```

### Reset and app shell extraction

- Replaced the mixed `01-base.css` stylesheet with `01-reset.css` and `layouts/app-shell.css`.
- The reset layer now owns document defaults and typography helpers only.
- The layouts layer now owns header navigation, page visibility, the centered content grid, and ad rails.
- CSS structure checks prevent the legacy mixed stylesheet from returning and verify both new owners.

### Calculator page ownership

- Moved the calculator visual base to `pages/calculator-base.css`.
- Moved the calculator layout and responsive rules to `pages/calculator.css`.
- Removed the legacy `03-calc-redesign.css` and `05-calc-sample-layout.css` build mappings.
- Updated CSS ownership and mobile dropdown contracts to read the page-owned styles directly.

### Dex pagination and page ownership

- Moved the dex stylesheet to `pages/dex.css` and removed the legacy top-level mapping.
- Added 50-row pagination to Pokemon, move, ability, and item lists after filtering and sorting.
- Preserved each dex tab's query, filters, page, and scroll position while switching tabs or opening details.
- Extended browser smoke coverage to verify the 50-row DOM limit, next-page data, and mobile overflow.

### Staged reverse and fine-tune states

- Reverse observation controls now open only after both participating Pokemon are selected.
- The reverse analyze action stays disabled until the participant prerequisite is satisfied.
- Fine-tune HP breakpoints are hidden before Pokemon selection and no longer reserve an empty desktop column.
- Removed the mobile-only `:has(...:empty)` polish override in favor of explicit application state.

### Mobile matchup density and guidance

- Compressed mobile party slots into a single editing row with number, Pokemon, types, and clear action.
- Hid decorative slot sprites at the narrow breakpoint to preserve the Pokemon input width.
- Added a horizontal-scroll hint that appears only when the matchup table actually overflows.
- Added browser checks for row alignment, touch layout height, scroll guidance, and page overflow.

이번 단계에서는 위 검증이 모두 통과했다. 브라우저 검사는 데스크톱/모바일 가로 넘침, 계산 결과,
모바일 상세 토글과 드롭다운, 라이트/다크 semantic token, 역계산 Worker 응답성을 확인한다.

### 공개 배포와 standalone 빌드 분리

- `build:standalone`은 기존 오프라인용 단일 HTML 산출물을 그대로 생성한다.
- `build:public`은 HTML, CSS, 테마 초기화 코드, 데이터, 애플리케이션 코드를 분리된 정적 자산으로 생성한다.
- 공개 자산 파일명에 SHA-256 기반 content hash를 적용하고 `/assets/*`에 immutable cache 정책을 추가했다.
- `build:pages`는 같은 정적 빌더의 비공개 테스트 모드를 사용해 광고 rail을 제거하고 검색 색인을 차단한다.
- 공개 HTML의 inline script, inline style, inline event handler를 제거하고 CSP에서 `unsafe-inline`을 제거했다.
- 이미지 오류 처리는 inline `onerror` 대신 document-level error listener로 옮겼다.
- 결과 meter, 도감 stat bar, 상성표 colgroup의 동적 값은 CSP가 허용하는 DOM style property로 적용한다.
- `public:ready`와 `pages:ready`가 hashed asset, CSP, cache, robots, manifest 계약을 각각 검증한다.
- `ui:browser:public`은 로컬 HTTP 서버에서 실제 CSP 헤더를 적용하고 기존 전체 브라우저 회귀 시나리오를 재사용한다.

현재 배포 명령은 다음과 같다.

```bash
npm run build:standalone
npm run build:public
npm run build:pages
npm run public:ready
npm run pages:ready
npm run ui:browser:public
```
