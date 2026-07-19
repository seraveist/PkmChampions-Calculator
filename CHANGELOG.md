# Changelog

## [2.0.0] - 2026-07-20

### Added

- 형태 역계산, 세부조정, 파티 상성 진단, 도감과 파티 프리셋 워크플로
- 공개 빌드의 페이지 기능 지연 로딩과 역계산 Worker
- 라이트/다크 테마, 320px 반응형 검증, axe 접근성 브라우저 검사
- UI 구조 감사, CSS/JavaScript 소유권 검사와 실패 시 브라우저 스크린샷 CI 산출물

### Changed

- 공통 UI를 의미 토큰, 컴포넌트, 레이아웃과 페이지 계층으로 재구성
- 모든 UI 폰트를 Noto Sans KR로 통일
- 타입 카드·도감 필터·파티 이미지 출력의 색상 팔레트를 단일 토큰 소스로 통합
- 계산기 급소·결정력 열과 모든 주요 드롭다운 열 정렬 개선
- 세부조정·역계산 능력치 화면을 모바일 비스크롤 카드형으로 개편
- 계산기와 도감 대형 CSS를 책임별 모듈로 분리
- 직접 `innerHTML` 쓰기를 공통 렌더 경계로 통합

### Removed

- 레거시 `04-ui-foundation.css`
- CSS `!important` 의존과 중복된 동일 파일 media query
- `insertAdjacentHTML` 기반 오류 UI 삽입

### Security

- HTML 이스케이프에 큰따옴표와 작은따옴표 처리를 추가
- 파티 프리셋 JSON 이름의 HTML 속성 삽입 회귀 테스트 추가

### Known limitations

- Protect/Detect는 명시적 미지원
- coverage matrix의 보류 항목은 향후 계산 규칙 작업에서 개별 처리
- 자동 브라우저 검증은 현재 Chromium 계열을 기준으로 수행
