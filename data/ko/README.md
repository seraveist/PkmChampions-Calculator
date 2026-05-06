# 한국어 번역 캐시

build.mjs 가 빌드 시점에 읽어 koName / desc 에 적용하는 한국어 데이터.

## 파일 구조

각 카테고리(`pokemon`, `moves`, `abilities`, `items`, `desc-moves`, `desc-abilities`, `desc-items`) 마다 세 종류의 파일이 있다:

| 파일 | 누가 생성? | 용도 |
|---|---|---|
| `<카테고리>.json` | `scripts/fetch-ko.mjs` | PokéAPI 자동 캐시. 직접 수정하지 말 것. |
| `<카테고리>.manual.json` | **사용자 직접 편집** | PokéAPI 가 못 찾는 항목의 수동 번역. |
| `<카테고리>.missing.json` | `scripts/fetch-ko.mjs` | 진단용. 자동도 수동도 없는 항목 목록 (수동 입력 템플릿). |

## 우선순위

빌드 시 우선순위 (높음 → 낮음):

1. **자동 캐시** (`<카테고리>.json`) — PokéAPI 가 가지고 있다면 항상 이쪽이 적용됨
2. **수동 번역** (`<카테고리>.manual.json`) — PokéAPI 에 없을 때만 fallback
3. **영문 원본** — 자동·수동 둘 다 없으면 PS 데이터의 영문 그대로

PokéAPI 가 새 항목을 추가하면 자동 캐시에 들어가고, 같은 키의 수동 번역은 자동으로 덮어진다 (수동 파일은 그대로 두면 됨, 무해함).

## 수동 번역 추가 워크플로

1. `npm run fetch-ko` 를 실행하면 `<카테고리>.missing.json` 이 다음 형식으로 생성된다:
   ```json
   {
     "clefablemega": "",
     "victreebelmega": ""
   }
   ```
2. 그 항목을 `<카테고리>.manual.json` 으로 옮기고 한글값을 채운다:
   ```json
   {
     "clefablemega": "메가픽시",
     "victreebelmega": "메가우츠보트"
   }
   ```
3. `npm run build` 다음 빌드부터 표시된다.

## 메타 키

`manual.json` 안에서 `_` 로 시작하는 키 (예: `_README`, `_NOTE`) 는 빌드/카운트 모두에서 무시되므로 코멘트 용도로 자유롭게 사용 가능.

## 갱신 자동화

`.github/workflows/sync-ps-data.yml` 이 매주 PS 데이터 동기화와 함께 `fetch-ko.mjs` 를 실행한다. 자동 캐시는 매번 새로 쓰이고, missing 목록도 수동 번역을 반영해 갱신된다.
