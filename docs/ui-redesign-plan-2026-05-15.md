# UI Redesign Plan 2026-05-15

공개 웹앱 운영과 광고 rail 배치를 고려한 UI/UX 전면 개편 계획이다.

## Direction

- 라이트 모드를 기본 테마로 둔다.
- 마케팅 랜딩이 아니라 계산/조회/분석 도구형 웹앱으로 설계한다.
- 정보 밀도는 유지하되, 패널과 입력 요소는 조용하고 명확하게 정렬한다.
- 좌우 `side-ad-rails` 공간은 데스크톱에서만 유지하고, 좁은 화면에서는 숨긴다.
- 기존 계산 로직과 DOM id는 최대한 유지하면서 CSS와 레이아웃을 단계적으로 교체한다.

## Stage 1. Foundation

적용 파일:

- `src/styles/04-ui-foundation.css`

포함 범위:

- 라이트 모드 디자인 토큰
- header/navigation
- app shell
- side advertisement rail
- panel/result/modal 기본 표면
- input/combobox/checkbox/button/table 기본 스타일

이 단계는 모든 메뉴에 공통으로 적용되는 시각 언어를 만드는 작업이다.

## Stage 2. Damage Calculator

가장 먼저 개편할 핵심 화면이다.

목표:

- 공격측/방어측 세팅을 더 넓고 안정적인 2-column 작업 화면으로 정리
- 포켓몬/타입/특성/도구/성격/상태 입력줄의 높이와 폭 통일
- EV 입력과 랭크 입력의 cell 크기 고정
- 기술 4칸과 결과 카드의 대응 관계 강화
- 필드/부가효과는 접힌 상태에서도 현재 조건을 스캔 가능하게 유지
- 결과 패널은 대미지 범위, 확정타, 반동, 참고 효과가 한 줄 흐름으로 읽히게 정리

## Stage 3. Dex

목표:

- 목록 테이블 가독성 개선
- 타입 필터와 검색창을 상단 작업줄로 통합
- 상세 페이지/모달의 표면, 버튼, 연관 링크 스타일 통일
- 도감에서 계산기로 보내는 액션 버튼을 명확하게 정리

## Stage 4. Fine Tune

목표:

- EV 조정표, HP breakpoint, 상대/스피드 패널의 폭과 높이를 안정화
- 숫자 셀과 badge가 내용 길이에 따라 흔들리지 않게 고정
- 대미지 계산기와 같은 input/combobox/token 스타일 사용

## Stage 5. Matchup

목표:

- 파티 슬롯 6개, 방어 상성, 공격 타점, 메타 위협 패널을 대시보드처럼 정리
- table cell 크기 고정
- 위험 타입과 타점 부재를 즉시 읽을 수 있게 색상 체계 정리

## Stage 6. Reverse Calculator

목표:

- 입력 영역과 결과 영역의 시선 흐름 분리
- 후보 카드의 확실성/불확실성 표현 강화
- 펼침 상세의 후속 대미지와 예상 형태 정보를 안정적인 grid로 정리

## Stage 7. CSS Split

UI가 안정되면 CSS를 다음 구조로 분리한다.

```text
src/styles/01-base.css
src/styles/02-layout.css
src/styles/03-components.css
src/styles/04-calc.css
src/styles/05-dex.css
src/styles/06-finetune.css
src/styles/07-matchup.css
src/styles/08-revcalc.css
```

현재는 기존 스타일과 충돌을 최소화하기 위해 `04-ui-foundation.css`를 후순위 override layer로 둔다.

## Verification

각 단계마다 다음을 실행한다.

```powershell
npm.cmd run build
npm.cmd test
```

## Component Reference - Damage Calculator

The local sample page at `C:\Users\JOON\Desktop\Untitled-1.html` is the first visual reference for the damage calculator pass.

- Light gray application background with white calculation panels.
- Red attacker header and blue defender header treatment.
- Central circular swap control.
- Compact form grids with consistent 40px controls.
- Stat rows with EV input, rank stepper, and final stat aligned on one line.
- Move rows with move, power, and derived attack information.
- Durability cards inside the defender panel.

## 2026-05-17 Update

UI/UX 재설계는 1차 완성본 단계로 진입했다. 현재 기준점은 대미지 계산기에서 확정한 light UI이며, 이후 도감, 상성표, 세부조정, 형태 역계산에 같은 입력/패널/모달 감각을 확장했다.

공통화된 방향:

- 입력칸 높이는 기본 `36px` 계열로 맞춘다.
- 라벨 row와 입력 row를 분리하고, 라벨 row에 붙는 버튼은 `ui-label-action` 계열로 통일한다.
- 포켓몬 선택 row에서 타입 배지는 각 메뉴 성격에 따라 하단 row 또는 라벨 row 우측에 둔다.
- 숫자 입력/stepper는 공통 control 스타일을 따르고, native spinner가 필요한 곳은 오른쪽 경계 안쪽에 고정한다.
- 대미지 계산기 결과 카드의 레이아웃을 기준으로 배지, 타입, 분류, KO 정보의 계층을 정리했다.
- 네비게이션은 tab처럼 보이도록 bg/포인트라인을 제거하고, 선택 탭만 outline으로 구분한다.
- `side-ad-rails` 공간은 유지하지만, 핵심 UI는 광고 영역 없이도 독립적으로 동작한다.

새로 추가된 공통 기능:

- `파티 프리셋` 모달.
- localStorage 기반 파티 10개 저장.
- JSON import/export.
- Showdown text import/export.
- 대미지 계산기/세부조정/형태 역계산 단일 포켓몬 불러오기.
- 상성표 파티 단위 불러오기.

현재 더 손볼 수 있는 후보:

- 일부 구형 문서의 인코딩 정리.
- CSS 파일 내 메뉴별 잔여 override 추가 다이어트.
- 파티 프리셋의 초소형 viewport 대응 강화.
- 공개 배포 시 localStorage 백업 안내 문구 추가 여부 결정.
