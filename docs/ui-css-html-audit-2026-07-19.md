# UI/CSS/HTML 전수조사 및 개편 결과

- 최초 조사일: 2026-07-19
- 최종 갱신일: 2026-07-20
- 대상 브랜치: `codex-ui-foundation-rebuild-20260719`
- 범위: HTML 구조, CSS 계층/소유권/반응형, UI JavaScript 렌더 경계, 공개·오프라인 빌드, 접근성
- 제외 범위: 대미지 계산 예외 및 계산 규칙 변경

## 결론

UI 기반 개편은 완료됐다. 공통 토큰, 셸, 패널, 필드, 버튼, 콤보박스, 파티 프리셋, 능력치·기술 편집기가 소유권별 파일로 분리됐고 페이지 CSS의 교차 소유권은 없다. 레거시 foundation 파일과 `!important` 의존을 제거했으며 모든 페이지 스타일 파일을 32 KiB 이하로 제한했다.

문자열 렌더링은 67개의 직접 `innerHTML` 쓰기에서 단일 `renderTrustedHTML()` 경계로 통합했다. 데이터·사용자 문자열은 `escapeHTML()`을 거치며 따옴표가 포함된 HTML 속성값까지 보호한다. 파티 JSON 이름을 이용한 속성 삽입 회귀 검사를 단위 테스트와 실제 브라우저 테스트에 추가했다.

계산 엔진 `02-engine.js`는 이번 개편에서 수정하지 않았다. UI 기준점이 안정됐으므로 이후 계산 예외는 golden test와 coverage matrix를 기준으로 독립 변경해야 한다.

## 적용 결과

1. 모든 UI 폰트 역할을 Noto Sans KR로 통일했다.
2. 타입 팔레트를 의미 토큰 한 곳으로 통합하고 밝은 타입만 어두운 글자를 사용한다.
3. 기술 선택 열과 급소·결정력 열을 정렬하고 모바일 드롭다운 폭을 보장했다.
4. 세부조정·역계산 능력치 편집기를 가로 스크롤 없는 카드형 레이아웃으로 변경했다.
5. 역계산 입력과 결과를 잠금·준비·분석·완료 단계로 표현한다.
6. 공개 빌드의 도감, 상성표, 세부조정, 역계산 기능을 페이지 진입 시 지연 로딩한다.
7. 레거시 `04-ui-foundation.css`를 제거하고 토큰·기본·컴포넌트·레이아웃 파일로 분리했다.
8. 계산기 CSS를 6개, 도감 CSS를 5개 책임 파일로 분리했다.
9. `!important`를 47개에서 0개로 줄이고 미디어 쿼리를 41개로 제한했다.
10. breakpoint 목록을 `docs/ui-breakpoints.md`에 고정하고 구조 검사로 새 값 유입을 차단한다.
11. 직접 HTML 삽입 67개를 공통 렌더 경계 1개로 통합하고 `insertAdjacentHTML`을 제거했다.
12. 320px 다크 모드, 접근성, 모바일 넘침, 공개 지연 로딩, 역계산 Worker 응답성 검사를 CI에 포함했다.

## 정량 조사

### HTML

| 항목 | 결과 |
| --- | ---: |
| 템플릿 크기 | 27,244 bytes |
| 페이지 탭 패널 | 5개 |
| 정적 ID | 103개 |
| 중복 ID | 0개 |
| `type` 없는 버튼 | 0개 |
| 인라인 `style` | 0개 |
| 인라인 이벤트 속성 | 0개 |

### CSS

| 항목 | 결과 |
| --- | ---: |
| 소스 파일 | 34개 |
| 총 크기 | 345,062 bytes |
| 규칙 | 약 1,928개 |
| 미디어 쿼리 | 41개 |
| `!important` | 0개 |
| 32 KiB 초과 페이지 파일 | 0개 |
| 페이지 CSS 교차 소유권 | 0건 |

가장 큰 페이지 파일은 `pages/02-finetune.css` 29,183 bytes다. 계산기와 도감의 기존 40 KiB 초과 파일은 책임별 모듈로 분리됐다.

### UI JavaScript

| 항목 | 결과 |
| --- | ---: |
| 소스 파일 | 28개 |
| 총 크기 | 595,028 bytes |
| 명명 함수 | 731개 |
| 직접 `innerHTML` 쓰기 | 1회: 공통 렌더 경계 |
| `insertAdjacentHTML` | 0회 |
| 40 KiB 초과 파일 | `02-engine.js` 1개 |

UI 파일은 모두 40 KiB 이하이며, 남은 `02-engine.js` 63.9 KiB는 계산 로직 범위다.

### 공개 초기 로드

| 항목 | gzip |
| --- | ---: |
| 초기 계산기 진입 | 276,066 bytes |
| 전체 공개 자산 | 388,856 bytes |

도감, 상성표, 세부조정, 역계산 기능과 역계산 Worker는 초기 계산기 진입에서 요청하지 않는다.

## 구조 계약

- CSS cascade layer: reset → tokens → base → components → layouts → pages → utilities → themes → responsive
- 페이지 CSS 파일 최대 크기: 32 KiB
- `!important` 허용량: 0
- 미디어 쿼리 허용량: 최대 41개
- breakpoint: `docs/ui-breakpoints.md`에 정의된 값만 허용
- 사용자·데이터 문자열: HTML 템플릿 삽입 전에 `escapeHTML()` 적용
- 동적 HTML: `renderTrustedHTML()` 경계를 통해서만 반영
- 계산기 주요 모바일 경계: 680px
- 공통 도구 페이지 주요 모바일 경계: 760px

## 검증 기준

- `npm test`
- 독립 실행 HTML 브라우저 smoke test
- 공개 정적 빌드 브라우저 smoke test
- axe critical/serious/moderate 0건
- 320px 다크 모드 전 페이지 가로 넘침 0건
- 공개 초기 계산기 진입의 페이지 기능 번들 요청 0건
- 역계산 Worker 후보 반환과 메인 스레드 응답성
- 파티 프리셋 속성 삽입 방어
- damage/reverse golden test 및 상태 테스트

실측 수치는 `npm run ui:audit`로 다시 확인한다.
