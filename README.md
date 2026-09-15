# Pokémon Champions Calculator

Pokémon Champions 규칙과 데이터에 맞춘 대미지 계산·형태 역계산·세부조정·파티 상성·도감 도구 모음이다. 제품 버전은 `package.json`의 `2.0.0`을 기준으로 한다.

## Features

- 공격측·방어측 상태, 필드, 급소, 가변 위력과 다타 기술을 반영한 대미지 계산
- 한 턴 관측으로 형태를 추정하고 다음 턴 상태·선후공·대미지를 비교하는 [형태 역계산](docs/reverse-rebuild.md)
- 배치·조건을 보존하며 스피드 목표, HP 조정 효과와 배분 전후를 비교하는 [세부조정](docs/fine-tune-improvements.md)
- 파티의 방어 배율·약점/반감/무효 마릿수와 공격 기술 타입 분포를 보여 주는 [상성표](docs/matchup-improvements.md)
- Pokémon Champions 포켓몬·기술·특성·도구 도감
- JSON·Showdown 텍스트 가져오기/내보내기와 파티 이미지 출력
- 라이트/다크 테마, 320px 이상 반응형 UI, 키보드 조작과 접근성 상태

## Local build

```powershell
npm ci
npm run build
```

독립 실행 결과는 루트의 `pokemon-champions-calculator-v3.html`이다. 이 파일명의 `v3`는 기존 배포 링크와 오프라인 산출물 호환을 위해 유지하는 레거시 식별자이며, 현재 제품 버전은 v2.0.0이다.

Cloudflare Pages용 광고 없는 공개 산출물은 다음 명령으로 `dist/`에 생성한다.

```powershell
npm run build:pages
npm run pages:ready
```

Cloudflare Pages의 Production branch는 `main`, Build command는 `npm run build:pages`, Build output directory는 `dist`, Node.js 버전은 20 이상을 사용한다. 이 산출물은 검색 노출을 허용하지만 광고 레일은 포함하지 않으며, 존재하지 않는 경로는 `404.html`로 응답한다.

광고 레일을 포함한 공개 후보본은 `npm run build:public`, 검색 노출과 광고를 모두 끈 비공개 미리보기는 `npm run build:preview`로 별도 생성할 수 있다. 오프라인 단일 HTML 산출물은 계속 `npm run build:standalone`으로 만든다.

## Validation

결정력 수치와 HP바·N타의 적용 범위, 타입 무효·회복·파동의방호 처리 기준은 [결정력 계산 정책](docs/move-power-policy.md)을 따른다.

전 메뉴에 확정 계산기 샘플의 공통 UI를 적용했다. 메뉴별 개선, HTML 참조·CSS 소유권, 320~1440px 반응형·키보드 검사 결과는 [UI 리모델링 최종 검토](docs/ui-remodel-final-review.md)에 정리했다.

현재 데이터는 M-C(2026-09-09)를 반영한다. [반영 내역과 수동 보완 방법](docs/regulation-mc-update.md)을 참고한다.

도감의 학습 기술 분류 필터·PP·계산기 적용·현재 수록 범위 개선은 [도감 개선](docs/dex-improvements.md)을 참고한다. 전용 검사는 `npm run dex:smoke`, 실제 화면 검사는 `npm run dex:browser`로 실행한다. 거다이맥스 기술은 다이맥스 룰 도입 전까지 현재 출력에서 제외한다.

```powershell
npm test
npm run ui:audit
npm run ui:browser -- --require-browser
npm run ui:browser:public -- --require-browser
npm run ui:browser:pages -- --require-browser
```

`npm test`는 소스·HTML·CSS·JavaScript 구조, 데이터 무결성, 공개 배포 준비, 대미지·역계산 golden test와 상태 회귀를 검사한다. 브라우저 smoke test는 레이아웃, 지연 로딩, 키보드 계약, 접근성, 다크 테마와 320px 모바일 화면을 실제 Chromium 계열 브라우저에서 검증한다.

## Architecture

- CSS cascade: reset → tokens → base → components → layouts → pages → utilities → themes → responsive
- 공통 선택창·입력·능력치 표는 같은 렌더러와 부품 CSS를 사용하며, 메뉴 CSS는 배치를 담당한다. 반응형 규칙은 해당 부품·메뉴 파일에 둔다.
- 동적 HTML은 `renderTrustedHTML()` 경계를 사용하며 데이터·사용자 문자열은 `escapeHTML()`로 이스케이프한다.
- 도감·상성표·세부조정·역계산 코드는 공개 빌드에서 페이지 진입 시 지연 로딩한다.
- 역계산 후보 탐색은 Worker에서 실행해 메인 스레드 응답성을 유지한다.
- 공개 빌드의 게임 데이터는 별도 JS 객체로 제공하며 HTML에 재주입하지 않는다. 단일 HTML만 오프라인용 JSON 어댑터를 사용한다.
- 계산 결과의 기술 행·선택 버튼은 재사용하고 달라진 결과 영역만 갱신한다. 동일 노력치의 `input`/`change`는 중복 계산하지 않는다.
- 데이터·입력 갱신 계약은 `npm run client:golden`, 실제 DOM·선택창 계약은 `npm run calculator:browser -- --require-browser`로 검증한다. [변경 범위](docs/client-data-performance.md)를 참고한다.

세부 기준은 다음 문서를 참고한다.

- [UI/CSS/HTML 전수조사](docs/ui-css-html-audit-2026-07-19.md)
- [UI breakpoint 정책](docs/ui-breakpoints.md)
- [CSS architecture contract](docs/CSS-ARCHITECTURE.md)
- [대미지 계산 지원 범위](docs/damage-calculator-coverage-matrix.md)
- [v2 출시 준비도 검토](docs/v2-readiness-review-2026-07-20.md)

## Known scope

- Protect/Detect는 단발 피해 계산 범위 밖의 명시적 미지원 상태다.
- Aurora Veil, 아군 위치 기반 더블 보정, Room 계열 일부와 이전 피해량 의존 기술은 상태 모델 확장이 필요해 보류돼 있다.
- 정확한 목록과 근거는 coverage matrix가 단일 기준이다.

## License

저장소의 [LICENSE](LICENSE)를 따른다.

## Module build and slot-level updates

공개용은 `src/main.js`의 ES 모듈과 정규화 데이터에서 직접 빌드하며, 단일 HTML을 중간 산출물로 사용하지 않는다. 기능별 `import()` 지연 로딩과 오프라인 단일 HTML은 함께 유지한다. 계산기 결과는 슬롯별 입력 키로 재사용한다. [구조와 검증 방법](docs/module-build-optimization.md)을 참고한다.
