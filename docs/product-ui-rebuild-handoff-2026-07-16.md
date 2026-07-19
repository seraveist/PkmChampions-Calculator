# 제품 UI 재구축 핸드오프 - 2026-07-16

## 목적

이 문서는 현재 PC에서 진행한 계산 로직 안정화, 데이터 동기화 강화, 역계산 Worker 도입,
반응형 UI 보완을 다른 PC에서 그대로 이어가기 위한 인수인계 문서다.

- 저장소: `https://github.com/seraveist/PkmChampions-Calculator.git`
- 작업 브랜치: `codex-product-ui-handoff-20260716`
- 기준 main 커밋: `da89d1f` (`chore: sync PS data 2026-07-12`)
- 목표: 현재 계산 동작과 골든 테스트를 보존하면서 HTML/CSS 구조를 제품 수준으로 재구축

이 브랜치의 첫 커밋은 기준 main 이후의 모든 로컬 안정화 변경과 이 문서를 함께 포함한다.

## 다른 PC에서 시작하기

```bash
git clone https://github.com/seraveist/PkmChampions-Calculator.git
cd PkmChampions-Calculator
git fetch origin
git switch codex-product-ui-handoff-20260716
npm ci
npm test
npm run ui:browser
```

빌드 결과는 루트의 `pokemon-champions-calculator-v3.html`이다. 별도 서버 없이 파일을 브라우저에서
열 수 있다. 소스 변경 후에는 반드시 `npm run build`로 생성물을 갱신한다.

## 현재 구현 상태

### 계산 엔진과 골든 테스트

- 자이로볼과 일렉트로볼이 원시 스피드가 아닌 도구, 랭크 등을 반영한 유효 스피드를 사용한다.
- 자이로볼의 표준 `+1` 위력 계산 단계를 반영한다.
- 대미지 계산에서 해결된 방어측 특성/도구 문맥을 KO 판정으로 전달한다.
- 연속기에서 기합의띠 소모, 자뭉열매의 타격 사이 회복, 부자유친 두 번째 타격을 타격별로 처리한다.
- 가변 타격 수 기술의 1회 사용 KO 확률과 반복 사용 누적 분포를 계산한다.
- 관련 회귀 사례가 `scripts/damage-golden.mjs`에 추가되어 있다.

### 역계산

- 형태 역계산의 무거운 후보 탐색을 Blob 기반 Web Worker로 옮겼다.
- Worker 생성이 불가능한 환경에서는 기존 메인 스레드 계산으로 폴백한다.
- 동일 상태 재분석을 위한 캐시와 실행 취소 처리가 포함되어 있다.
- 분석 중 진행 상태 UI가 표시된다.
- 브라우저 스모크 테스트가 Worker 결과와 메인 스레드 heartbeat를 함께 검사한다.

### 대미지 계산기 UI

- 모바일에서는 공격측/방어측 상세 능력치를 기본 접고 6개 최종 능력치 요약을 표시한다.
- 각 진영의 `상세` 버튼으로 능력치와 기술 편집 영역을 펼칠 수 있다.
- 계산 후 모바일 하단에 추천 기술, 대미지 범위, KO 요약을 표시한다.
- 추천 기술 정렬은 KO 가능성, 타수, 확률, 최대/최소 대미지 순서를 고려한다.
- 포켓몬과 기타 콤보박스는 모바일 및 좁은 데스크톱에서 뷰포트 안에 배치된다.
- 네이티브 제목 요소, 스킵 링크, 탭 ARIA와 주요 컨트롤의 의미 구조를 보강했다.

### 데이터 동기화와 검증

- Pokemon Showdown 동기화는 실행 시점의 단일 upstream 커밋 SHA를 먼저 고정한다.
- 동기화한 SHA는 `data/upstream.json`에 기록한다.
- GitHub Actions에서는 `GITHUB_TOKEN`으로 API 호출 제한을 완화한다.
- coverage matrix는 `--check` 모드로 생성 문서의 최신 상태를 검사한다.
- 자동 동기화 커밋에 coverage matrix와 생성 HTML이 포함된다.

## 주요 변경 파일

- `src/js/02-engine.js`: 유효 스피드 기반 위력, KO 문맥, 연속기 분포
- `src/js/03-30-calc-side-render.js`: 모바일 상세 토글과 능력치 요약
- `src/js/03-50-calc-results.js`: 모바일 추천 결과와 기술 우선순위
- `src/js/04-42-revcalc-candidates.js`: 역계산 캐시 및 Worker 수명주기
- `src/js/04-43-revcalc-render.js`: 분석 진행 상태
- `build.mjs`: CSS compact 및 역계산 Worker source 삽입
- `src/styles/responsive.css`: 반응형 밀도와 모바일 상호작용의 명시적 최종 레이어
- `scripts/browser-layout-smoke.mjs`: Chrome/Edge CDP 기반 화면 및 Worker 검사
- `scripts/damage-golden.mjs`: 속도 기반 위력과 연속기 KO 골든 테스트
- `scripts/sync-ps-data.mjs`: upstream commit 고정 동기화

루트의 `pokemon-champions-calculator-v3.html`은 생성물이지만 저장소 정책상 함께 커밋한다.

## 기존 문서의 의미

- `docs/frontend-dropdown-stabilization-2026-06-22.md`: 드롭다운 안정화 이력
- `docs/damage-calculator-entry-critical-refactor-handoff-2026-07-03.md`: 자동 진입 효과와 급소 처리의 설계 기록
- `docs/damage-calculator-coverage-matrix.md`: 현재 데이터/엔진 지원 범위

7월 3일 문서의 핵심 구현은 `89ae6e6`에서 이미 main에 반영되었다. 따라서 이 문서는 신규 작업 목록이
아니라 설계 근거와 회귀 테스트 사례로 참고한다.

## 프론트엔드 감사 결과

현재 화면은 기능성 베타로는 안정적이지만, 제품 배포 전에는 CSS/HTML 소유권을 재구축할 필요가 있다.

- CSS 9개, 약 326 KB, 13,700줄
- `!important` 69개, `@media` 35개
- 서로 다른 16개 breakpoint 조건
- `@layer`와 `@container` 미사용
- 계산기 스타일이 `03`, `05`, `08`, `09` 파일에서 반복적으로 덮어써짐
- `04-ui-foundation.css`가 약 106 KB로 foundation과 페이지 구현을 동시에 소유
- 생성 HTML은 약 1.87 MB이며 CSS, JS, 데이터, Worker source가 모두 inline
- 도감 포켓몬 탭은 315행과 약 6,300개의 DOM 노드를 한 번에 렌더링
- 모바일 상성표는 620px 내부 테이블의 가로 스크롤에 의존

초기 `scripts/css-structure-check.mjs` 예산은 `!important 70`, media query 36이었다. 재구축 브랜치에서는
임시 `08-theme-bridge.css`, `09-product-polish.css`를 제거하고 각각 `themes.css`, `responsive.css`로
소유권을 확정했으며 예산도 현재 실사용 상한인 `!important 47`, media query 35로 낮췄다.

## 목표 프론트엔드 구조

```text
src/styles/
  00-tokens.css
  01-reset.css
  02-base.css
  components/
    buttons.css
    fields.css
    combobox.css
    panels.css
    stat-editor.css
    result.css
  layouts/
    app-shell.css
    tool-layout.css
  pages/
    calculator.css
    reverse-calculator.css
    finetune.css
    matchup.css
    dex.css
  themes.css
  utilities.css
```

권장 cascade 순서는 다음과 같다.

```css
@layer reset, tokens, base, components, layouts, pages, utilities, themes;
```

- 한 컴포넌트의 기본 스타일은 한 파일에서만 소유한다.
- 페이지 ID를 이용한 특이도 경쟁 대신 `data-page`, `data-side`, `data-state`, ARIA 상태를 사용한다.
- 공통 입력, 패널, 통계 편집기, 결과 카드의 DOM 생성 함수를 별도 UI 모듈로 분리한다.
- viewport query는 4개 안팎의 표준 구간으로 줄이고, 패널 내부는 container query로 반응시킨다.
- 라이트/다크 테마는 페이지별 재정의 없이 semantic token만 교체한다.

## 페이지별 다음 작업

### 1. 대미지 계산기

- 가장 먼저 새 HTML/CSS 구조로 이전한다.
- 포켓몬, 기술, 결과를 최우선 흐름으로 두고 능력치와 필드 설정은 점진적으로 공개한다.
- 넓은 화면에서는 결과를 sticky 보조 열에 배치하는 구조를 검토한다.
- 모바일은 공격/방어 기본 선택과 결과를 첫 동선에 유지하고 상세 편집을 접는다.

### 2. 역계산과 세부조정

- 포켓몬 선택 전 큰 빈 패널이 공간을 차지하지 않도록 한다.
- 역계산은 `참가 포켓몬 -> 관측 데이터 -> 결과` 단계로 재구성한다.
- 세부조정의 HP 패널은 결과가 있을 때만 표시한다.
- 두 페이지가 사용하는 포켓몬 선택기, 능력치 편집기, 설정 필드를 공통 컴포넌트로 통합한다.

### 3. 상성표

- 모바일 파티 슬롯을 현재의 큰 2행 카드에서 한 줄 중심의 조밀한 편집 행으로 바꾼다.
- 결과 테이블의 내부 가로 스크롤에는 명시적인 스크롤 힌트 또는 모바일 전용 행렬을 제공한다.

### 4. 도감

- 데스크톱 테이블은 유지한다.
- 50행 단위 페이지 처리 또는 가상화를 적용한다.
- 모바일은 이름, 타입, 핵심 능력치 중심의 전용 목록을 렌더링하고 나머지는 상세 화면에서 제공한다.
- 검색/필터 바를 sticky로 만들고 타입 필터는 모바일 전용 sheet 또는 접이식 영역으로 정리한다.

## 배포 구조 권장안

계산은 계속 클라이언트에서 수행할 수 있으므로 백엔드 도입은 필요 없다.

- 공개 배포: Vite 또는 동등한 ESM 정적 빌드로 HTML, CSS, JS, Worker, 데이터를 분리
- 오프라인 배포: 기존 단일 HTML 생성을 `build:standalone`으로 유지
- 공개 빌드는 hashed asset과 브라우저 캐시를 사용
- inline script/style을 제거해 `unsafe-inline` 없는 CSP를 목표로 함
- 포켓몬 이미지는 외부 raw GitHub URL 대신 관리 가능한 정적 자산/CDN으로 이전 검토

프레임워크 전환은 필수가 아니다. 먼저 vanilla JS 상태/계산 로직을 유지하고 UI 렌더 모듈과 빌드 구조를
정리하는 편이 회귀 위험이 낮다.

## 작업 순서

1. 이 브랜치와 테스트 결과를 기준선으로 고정한다.
2. token, cascade layer, app shell, 공통 컴포넌트를 만든다.
3. 대미지 계산기를 첫 번째 페이지로 이전하고 기존 골든 테스트와 브라우저 스모크를 통과시킨다.
4. 역계산/세부조정을 공통 컴포넌트로 이전한다.
5. 상성표/도감의 모바일 전용 정보 구조를 적용한다.
6. 공개 정적 빌드와 standalone 빌드를 분리한다.
7. 구형 bridge/polish CSS를 제거하고 구조 검사 예산을 강화한다.

한 번에 모든 페이지를 교체하지 않는다. 각 페이지 이전이 끝날 때마다 기존 CSS 소유권을 제거하고
데스크톱/모바일 스크린샷과 전체 테스트를 남긴다.

## 검증 기준

필수 명령:

```bash
npm test
npm run ui:browser
```

이 브랜치 생성 시점의 검증 결과:

- `npm test`: PASS, 2026-07-16, 약 93.9초
- `npm run ui:browser`: PASS, 2026-07-16, 약 14초
- `git diff --check`: PASS
- 브라우저 검사: 1440px/375px 가로 넘침 없음, 모바일 상세 토글과 드롭다운 정상
- 역계산 검사: Worker 후보 결과 반환 및 메인 스레드 heartbeat 유지

Windows에서는 브라우저 검사 종료 직후 Chrome 임시 프로필 삭제가 잠시 잠겨 정리 경고가 나올 수 있다.
검사 결과와 저장소 파일에는 영향을 주지 않는다.

제품 UI 재구축 과정에서 추가할 검사:

- 375, 430, 768, 1024, 1440px 전 페이지 시각 회귀
- 모든 페이지의 body horizontal overflow 0
- 모바일 주요 조작의 44px 터치 영역
- Axe 기반 critical/serious 접근성 오류 0
- 도감 초기 DOM 노드 수 감소
- 문서화되지 않은 `!important` 0을 목표로 한 CSS 예산
- `unsafe-inline` 없는 공개 배포 CSP

## 주의사항

- `src/js/02-engine.js`의 계산 로직은 UI 재구축과 섞어 리팩터링하지 않는다.
- `data/`는 Showdown 원본과 Champions override가 결합되는 구조를 유지한다.
- 생성 HTML을 직접 수정하지 않고 `src/`, `build.mjs`, 데이터 원본을 수정한 후 빌드한다.
- 다른 PC에서 작업을 시작할 때 먼저 `npm test`로 브랜치 기준선을 재확인한다.
- UI 구조 변경 중에도 기존 element ID와 event contract는 페이지 단위 이전이 끝날 때까지 호환한다.
