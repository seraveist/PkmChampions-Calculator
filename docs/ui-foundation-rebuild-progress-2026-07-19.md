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

이번 단계에서는 위 검증이 모두 통과했다. 브라우저 검사는 데스크톱/모바일 가로 넘침, 계산 결과,
모바일 상세 토글과 드롭다운, 라이트/다크 semantic token, 역계산 Worker 응답성을 확인한다.
