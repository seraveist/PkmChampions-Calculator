// Pokemon Showdown 데이터 ts 파일을 vm으로 평가해서 export 객체를 가져오는 헬퍼.
// 의존성 없이 Node 표준 모듈만 사용 (fs, vm).

import fs from 'node:fs';
import vm from 'node:vm';

// TypeScript 타입 식별자에 매칭되는 부분 정규식.
// - 대문자로 시작하는 식별자 (PascalCase: Pokemon, BoostID, ...)
// - 또는 원시 타입 키워드 (string, number, boolean, void, any, never, unknown, object)
// 그 뒤로 제네릭/배열/유니언/리터럴이 이어질 수 있다.
const TYPE_BODY = String.raw`(?:[A-Z][\w]*|string|number|boolean|void|any|never|unknown|object)(?:\s*<[^<>]*>)?(?:\s*\[\s*\])*(?:\s*\|\s*(?:[A-Z][\w]*|string|number|boolean|void|any|never|unknown|object|'[^']*'|"[^"]*"|null|undefined|true|false|\d+)(?:\s*<[^<>]*>)?(?:\s*\[\s*\])*)*`;

// `const x: Type = ...` / `let x: Type;` 형태에서 `:` 다음 부분을 깊이 0의 `=`/`;`/`,` 까지 제거한다.
function stripVarDeclTypes(src) {
  const re = /\b(const|let|var)\s+(\w+)\s*:/g;
  let out = '';
  let lastEnd = 0;
  let match;
  while ((match = re.exec(src)) !== null) {
    const colonIdx = match.index + match[0].length - 1; // ':' 의 위치
    out += src.slice(lastEnd, colonIdx);
    // colonIdx 다음부터 깊이 0의 `=`/`;`/`,` 까지 스킵
    let pos = colonIdx + 1;
    let depth = 0;
    while (pos < src.length) {
      const c = src[pos];
      if (depth === 0 && (c === '=' || c === ';' || c === ',')) break;
      if (c === '{' || c === '(' || c === '[' || c === '<') depth++;
      else if (c === '}' || c === ')' || c === ']' || c === '>') depth--;
      pos++;
    }
    lastEnd = pos;
    re.lastIndex = pos; // 다음 탐색은 잘라낸 위치에서 시작
  }
  out += src.slice(lastEnd);
  return out;
}

function stripTypeScript(src) {
  // 1. type-only / 일반 import 제거 (data 파일은 외부 심볼을 실제로 참조하지 않음)
  src = src.replace(/^\s*import\s+type\b[^;]*;\s*$/gm, '');
  src = src.replace(/^\s*import\s+\{[^}]*\}\s+from\s+['"][^'"]+['"];\s*$/gm, '');
  src = src.replace(/^\s*import\s+\w+\s+from\s+['"][^'"]+['"];\s*$/gm, '');

  // 2. `export const X: import('...').TypeName = {...}` 의 타입 어노테이션 제거
  src = src.replace(/(export\s+const\s+\w+)\s*:\s*[^=]+(\s*=)/g, '$1$2');

  // 3. `as ( ... ) => ReturnType` 형태의 함수 타입 캐스팅 제거
  src = src.replace(/\s+as\s+\([^)]*\)\s*=>\s*[A-Za-z_][\w<>\[\].|\s,]*/g, '');

  // 4. 일반 `as Type` 캐스팅 제거 (`as any`, `as Pokemon[]`, `as 'foo' | 'bar'`, `as false | null` 등)
  // 첫 토큰은 PascalCase / 원시 키워드 / 리터럴(true/false/null/undefined/string-literal/number) 모두 허용.
  const AS_TYPE_FIRST = String.raw`(?:[A-Z][\w]*|string|number|boolean|void|any|never|unknown|object|null|undefined|true|false|'[^']*'|"[^"]*"|\d+)(?:\s*<[^<>]*>)?(?:\s*\[\s*\])*`;
  const AS_TYPE_FULL = `${AS_TYPE_FIRST}(?:\\s*\\|\\s*${AS_TYPE_FIRST})*`;
  src = src.replace(new RegExp(String.raw`\s+as\s+${AS_TYPE_FULL}`, 'g'), '');

  // 5. 변수 선언의 타입 어노테이션 제거.
  // const/let/var 선언은 `:` 다음에 타입이 와야 하므로 안전하게 제거 가능.
  // 중첩된 `{}`, `[]`, `()`, `<>` 를 추적하면서 다음 `=`/`;`/`,` 까지 잘라낸다.
  src = stripVarDeclTypes(src);

  // 6. 함수 매개변수 타입 어노테이션 제거: `(name: Type, name?: Type)`
  // 매개변수처럼 보이는 위치에서 TYPE_BODY 모양인 경우만 제거.
  // `, key: true` 같은 객체 리터럴 항목은 `true`가 PascalCase가 아니므로 매칭되지 않음.
  for (let i = 0; i < 4; i++) {
    src = src.replace(
      new RegExp(String.raw`([(,]\s*\.{0,3}\w+\??)\s*:\s*${TYPE_BODY}(?=\s*[,)=])`, 'g'),
      '$1'
    );
  }

  // 7. 화살표 함수 반환 타입 제거: `): ReturnType =>` → `) =>`
  src = src.replace(
    new RegExp(String.raw`\)\s*:\s*${TYPE_BODY}\s*=>`, 'g'),
    ') =>'
  );

  // 8. `function foo(): Type {` 함수 선언 반환 타입 제거
  src = src.replace(
    new RegExp(String.raw`(\bfunction\s+\w*\s*\([^)]*\))\s*:\s*${TYPE_BODY}\s*\{`, 'g'),
    '$1 {'
  );

  // 9. 메서드 반환 타입 제거: `methodName(args): Type {` → `methodName(args) {`
  src = src.replace(
    new RegExp(String.raw`(^|\n)(\s*\w+\s*\([^)]*\))\s*:\s*${TYPE_BODY}\s*\{`, 'g'),
    '$1$2 {'
  );

  // 10. non-null assertion `!` 제거 (`foo!.bar`, `arr[i]!`, `x!--`, `x!()` 등)
  src = src.replace(/(\w|\)|\])!(?=[.;,)\]\s\[+\-*/%<>=&|?])/g, '$1');

  return src;
}

export function loadTsModule(filePath) {
  let src = fs.readFileSync(filePath, 'utf8');
  src = stripTypeScript(src);
  // export const X = ... → module.exports.X = ...
  src = src.replace(/\bexport\s+const\s+(\w+)\s*=/g, 'module.exports.$1 =');

  const sandbox = {
    module: { exports: {} },
    exports: {},
    console,
    // 데이터 파일 메서드 안에 등장하는 전역 식별자 (실제로 호출되지 않는다)
    Pokemon: function () {},
    Side: function () {},
    Battle: function () {},
    Move: function () {},
  };
  sandbox.exports = sandbox.module.exports;
  try {
    vm.runInNewContext(src, sandbox, { filename: filePath, timeout: 10000 });
  } catch (err) {
    err.message = `[ts-loader] ${filePath}: ${err.message}`;
    throw err;
  }
  return sandbox.module.exports;
}

// champions 모드 파일은 base 항목을 `inherit: true`로 가리켜 일부 필드만 덮어쓴다.
// base 항목이 없으면 그대로 새 항목으로 추가된다.
//
// 중요: PS 컨벤션상 base 가 `isNonstandard: "Past"` 인 항목을 champions 가 명시적으로
// 오버라이드(inherit:true + 다른 필드 변경)했고 isNonstandard 를 다시 언급하지 않았다면
// "champions 에서 다시 활성화" 의미로 본다. 즉, 오버라이드에 isNonstandard 가 없으면
// base 의 isNonstandard 도 무효화한다.
export function applyModOverrides(baseTable, modTable) {
  const merged = { ...baseTable };
  for (const [id, modEntry] of Object.entries(modTable || {})) {
    if (!modEntry) continue;
    const { inherit, ...rest } = modEntry;
    const modHasNonstandard = Object.prototype.hasOwnProperty.call(rest, 'isNonstandard');
    if (inherit && merged[id]) {
      const combined = { ...merged[id], ...rest };
      // 오버라이드가 isNonstandard 를 명시하지 않았다면 base 의 값을 그대로 두지 않고 해제
      if (!modHasNonstandard && combined.isNonstandard) {
        delete combined.isNonstandard;
      }
      merged[id] = combined;
    } else {
      merged[id] = rest;
    }
  }
  return merged;
}
