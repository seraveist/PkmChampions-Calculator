# Current Handoff 2026-05-14

이 문서는 `codex-refactor-handoff-20260508` 브랜치의 현재 작업 상태를 다른 PC에서 이어받기 위한 최신 인수인계 문서다.

## Branch

- Current branch: `codex-refactor-handoff-20260508`
- Main deliverable: `pokemon-champions-calculator-v3.html`
- Build command: `npm.cmd run build`
- Full local check: `npm.cmd test`
- Focused checks used during the latest work:
  - `npm.cmd run state:finetune`
  - `npm.cmd run dex:smoke`
  - `npm.cmd run damage:golden`

## Current Feature Status

### Damage Calculator

1차 정리 완료 상태로 본다.

- Pokemon Showdown / pokemon-showdown-damage-calc의 계산기형 로직을 기준으로, 전체 배틀 시뮬레이션보다 대미지 계산에 필요한 범위만 유지하는 방향으로 정리했다.
- 선공/후공 판정과 기술 우선도는 실제 행동 순서 계산이 아니라 대미지 조건에 필요한 경우에만 사용한다.
- 테라스탈은 현재 Champions 룰에서 비활성으로 유지하되, 구조상 나중에 추가할 여지를 남겼다.
- 자동 진입 효과는 source state를 직접 바꾸지 않고 derived state에서 적용한다.
- 유저가 수동으로 변경한 값은 자동값보다 우선한다.
- 포켓몬 변경 시 기존 자동 적용값은 기본값으로 돌아가고, 새 포켓몬이 자동 적용 대상이면 다시 적용된다.
- 기술 위력은 기술 선택 후 수동 수정 가능하다.
- 포켓몬, 기술, 도구, 특성, 성격, 상태 드롭다운 UI를 개선했다.
- 포켓몬 목록은 Champions 룰/format-data 기준으로 필터링된 전체 `POKEMON` 데이터가 표시된다.
- 기술 목록은 해당 포켓몬 learnset 기반이며 타입순, 한글명순으로 정렬된다.
- 특성에는 `(없음)`을 둘 수 있고, Disguise / Ice Face처럼 계산기에서 0 대미지 처리하면 곤란한 특성은 수동 토글 방식으로 다룬다.
- 타입도 포켓몬 기본 타입을 가져오되 수동 수정 가능하다.
- 결과 패널은 대미지 행에서 반동, 상대 특성 참고사항 등을 같이 읽을 수 있도록 정리했다.

### Dex

1차 정리 완료 상태로 본다.

- `pokemon.ts`와 `mods/champions/format-data.ts` 기반 필터링이 도감 목록과 계산기 데이터 양쪽에 맞게 반영된다.
- 킬가르도 / 킬가르도 블레이드 폼처럼 별도 forme가 있는 포켓몬이 목록에서 누락되지 않도록 정리했다.
- 포켓몬, 기술, 특성, 도구 상세 페이지와 모달 동작을 점검했다.
- 포켓몬 방어 상성은 4배, 2배, 1배, 1/2배, 1/4배, 무효를 색상으로 구분한다.
- 상세 페이지 상태에서 상단 타입 필터를 누르면 메인 목록으로 돌아오도록 정리했다.

### Fine Tune

세부조정 탭도 1차 정리 완료 상태로 본다.

- 내 포켓몬 세부조정, HP 브레이크포인트, 상대/스피드 패널을 3영역으로 재배치했다.
- EV 합계와 남은 포인트는 노력치 테이블 하단에 표시한다.
- HP와 속도 실수치 중복 표시는 제거했다.
- 내구력은 물리내구 / 특수내구만 별도 카드로 표시한다.
- HP 브레이크포인트는 항상 전체 기준점을 나열하고, 현재 충족된 항목만 하이라이트한다.
- 같은 HP 기준점을 공유하는 브레이크포인트는 한 행에서 설명을 합친다.
- 브레이크포인트 행에는 목표 HP 서브라인을 제거해 패널 높이를 줄였다.
- 매직넘버는 `이전 / 현재 / 다음` 도달 포인트를 표시한다.
- 상대/스피드 패널의 포켓몬 선택 드롭다운은 Champions 필터링 전체 포켓몬을 표시한다.
- 세부조정 포켓몬 드롭다운 정렬은 스피드 종족값 높은 순, 동률은 한글명 가나다순이다.
- 스피드 비교 테이블은 상대/스피드 패널 폭에 맞춰 확장했다.

## New / Updated Validation

- `scripts/fine-tune-state.mjs`
  - 포켓몬 변경 시 타입, 특성, 기술 초기화 확인
  - 날씨 기반 스피드 특성 토글 확인
  - EV 총합 66 제한 확인
  - HP 브레이크포인트 렌더링 확인
  - 중복 HP/속도 실수치 제거 확인
  - 세부조정 포켓몬 드롭다운 전체 표시 및 스피드 내림차순 정렬 확인
- `scripts/dex-ui-smoke.mjs`
  - 도감 UI 렌더링과 상세 동작 점검용 스모크 테스트
- `scripts/entry-effects-state.mjs`
  - 자동 진입 효과와 derived state 우선순위 점검

## Data / Override Policy

- Showdown TS 데이터는 기본 source of truth다.
- 한국어 텍스트는 PokeAPI 매칭 후 manual override가 마지막에 덮어쓴다.
- PokeAPI가 늦거나 누락된 데이터는 `data/ko/*.manual.json`으로 보정한다.
- Champions mod에 custom 표기가 있더라도 upstream 업데이트로 정리될 수 있으므로, 현재는 임의 삭제하지 않는다.
- 계산 로직과 관련된 예외는 가능한 한 `data/overrides/*-mechanics.json`으로 이동한다.

## Next Recommended Work

다음 작업은 상성표 고도화가 가장 자연스럽다.

1. `docs/team-synergy-table-plan.md` 기준으로 상성표 데이터 모델과 UI를 먼저 구현한다.
2. 메타 위협 JSON은 id 배열만 받는 단순 구조로 시작한다.
3. 방어 상성 모드와 공격 타점 모드를 토글 방식으로 분리한다.
4. 상성표가 1차 완료되면 `docs/reverse-calculation-plan.md`의 최신 메모 기준으로 내구 역계산을 다시 정리한다.

## Notes For Next Session

- `pokemon-champions-calculator-v3.html`은 빌드 산출물이다. 소스 수정 후 반드시 `npm.cmd run build`로 갱신한다.
- PowerShell에서는 `npm` 대신 `npm.cmd`를 사용한다.
- 기존 변경사항을 되돌리지 않는다. 이 브랜치에는 여러 기능의 누적 리팩토링이 들어 있다.
- 새 기능 구현 전에 `npm.cmd test`를 한 번 돌려 현재 기준선을 잡는 것이 좋다.
