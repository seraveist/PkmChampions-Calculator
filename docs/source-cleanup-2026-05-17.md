# Source Cleanup 2026-05-17

이 문서는 2026-05-17 UI 공통화, 파티 프리셋, learnset 보정 작업을 기준으로 한 최신 소스 정리 기록이다.

## Added Structure

### JavaScript

- `src/js/04-00-party-presets.js`
  - 파티 프리셋 localStorage 상태
  - JSON import/export
  - Showdown text import/export
  - 각 메뉴별 불러오기 adapter
  - 파티/슬롯 접힘 상태

### CSS

- `src/styles/04-ui-foundation.css`
  - 공통 app shell
  - navigation
  - input/control/combobox
  - modal
  - party preset
- `src/styles/05-calc-sample-layout.css`
  - 대미지 계산기 light UI 레이아웃
- `src/styles/06-dex-redesign.css`
  - 도감 목록/상세/모달 UI
- `src/styles/07-tools-redesign.css`
  - 상성표, 세부조정, 형태 역계산 UI

## Cleanup Notes

- 파티/슬롯 접힘은 `hidden` 속성과 CSS가 섞이지 않게 `.collapsed` CSS 기준으로 정리했다.
- 기존 네비게이션 포인트라인을 제거하고 tab형 outline 기준으로 통일했다.
- 대미지 계산기와 다른 메뉴의 숫자 입력/선택 입력 높이를 `36px` 계열로 맞췄다.
- 대미지 계산기, 세부조정, 형태 역계산의 포켓몬 입력 row는 같은 라벨/입력 기본 규격을 공유한다.
- 로토무 폼과 메가플라엣테 learnset 보정은 빌드 단계에서 처리한다.
- `scripts/dex-ui-smoke.mjs`는 전체 CSS 파일을 읽도록 확장했다.

## Regression Coverage Added

- 파티 프리셋 open button
- 파티 프리셋 JSON helper
- 파티 프리셋 Showdown text parser
- 대미지 계산기 공격측/방어측 불러오기 target
- 세부조정 불러오기 target
- 형태 역계산 불러오기 target
- 상성표 파티 불러오기 target
- 파티/슬롯 접힘 CSS
- 로토무 폼 learnset 상속
- 메가플라엣테 `lightofruin`

## Verification

```powershell
npm.cmd test
```

위 전체 테스트를 통과했다.

