# 클라이언트 데이터 및 결과 갱신 최적화

## 범위

계산식, 정적 배포 방식, 화면 디자인과 오프라인 단일 HTML을 유지하는 1차 리팩터링이다.
`src/js/02-engine.js`와 역계산 후보 탐색·점수·예측 알고리즘은 변경하지 않는다.

## 데이터 경로

공개 빌드는 `data.<hash>.js`에서 `PKM_DATA`라는 plain object를 제공한다.
`01-core.js`가 이 객체를 직접 읽고 기존 배열·ID별 조회 객체를 구성한다.
공개 HTML에는 `data-pokemon` 등의 게임 데이터 태그가 없으며 DOM 주입도 하지 않는다.
`connect-src 'none'`을 유지하며 `fetch()`나 외부 서비스는 추가하지 않는다.

단일 HTML은 기존 JSON script를 읽는 어댑터를 유지한다. Worker에는 동일한 `GAME_DATA`를 전달하고,
가짜 `document` 및 데이터의 stringify/parse 왕복을 제거했다. Worker 메시지의 초기 데이터 키는
`data`이며, 실행 파일과 데이터는 동일 빌드의 해시 자산을 사용해야 한다.
공개 데이터의 브라우저 추출을 막는 기능은 아니다.

공개 빌드가 단일 HTML에서 CSS/JS를 추출하는 과정은 이번 범위에서 유지한다.
공통 데이터 생성 단계 추출과 전체 ESM 전환은 별도 단계로 분리한다.

## 런타임 변경

- 특성·도구의 배지 이름 정렬과 도구·성격 표시 목록을 최초 사용 시 한 번 생성한다.
  현재 배포 데이터/언어는 페이지 수명 동안 고정이다. 향후 런타임 데이터 교체를 지원하면 캐시 무효화를 추가해야 한다.
- 기술 행, 선택 버튼, 설정 버튼과 선택창 소유 DOM을 유지한다.
  변경된 선택 라벨, 결정력/피해, KO, 배지만 HTML 렌더 경계를 통해 교체한다.
- 결과 모델은 한 슬롯당 한 번 계산하며, 기존 결정력과 피해 계산 정책을 합치지 않는다.
- 노력치 `change`는 빈 값 등을 정규화하되 이미 `input`에서 적용한 값이면 다시 계산하지 않는다.
- 선택창 필터는 포켓몬/폼 변경 시 목록을 갱신하고, 같은 포켓몬 검색에서는 정렬된 목록을 재사용한다.
  이름·기술 설명 검색, 키보드 포커스, 열린 선택창을 유지한다.

## 검증

```sh
npm test
npm run calculator:browser -- --require-browser --disable-browser-sandbox
node scripts/calculator-remodel-browser.mjs --require-browser --disable-browser-sandbox
npm run reverse:browser -- --require-browser --disable-browser-sandbox
```

`--disable-browser-sandbox`는 격리된 CI 환경에서만 사용한다. 일반 개발 환경에서는 생략할 수 있다.

추가된 `client:golden`은 DOM 없는 코어/Worker 초기화, 오프라인 데이터 일치, 목록 캐시,
포켓몬 변경, 중복 계산 방지와 입력 정규화를 검사한다.
공개 준비 검사는 7종 전체 데이터가 단일 HTML과 일치하는지 확인한다.
실제 브라우저 검사는 20회의 노력치 `input`/`change`에 대해 다음을 요구한다.

- refresh 20회, 슬롯 계산 80회.
- 결과 그리드 전체 교체 0회, 해당 선택창 이벤트 재연결 0회.
- 행·버튼·포커스 유지, 실제 결과 변화, 새로운 포켓몬의 기술 목록 반영.
- 무효/변화기/조건부/비운 슬롯을 포함해 부분 갱신 결과가 새로 렌더한 결과와 일치.

이 호출 횟수는 특정 테스트의 구조적 기준이며 전체 사이트 속도 향상률을 의미하지 않는다.
