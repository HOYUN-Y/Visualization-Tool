/* insight Analytics — safe per-row formula parser + evaluator (window.FormulaEval)

   Replaces the `new Function("row","Math", ...)` used by Clean-mode Formula Columns, which is an
   arbitrary-code-execution vector the moment a project JSON / share link (P10) is opened from an
   untrusted source (FOLLOWUP §5 A1). This is a hand-written recursive-descent parser + tree-walking
   evaluator: no eval, no new Function. Only `row.<col>` / `row["col"]` reads, `Math.*` (whitelisted),
   numeric/string/boolean/null literals, and standard operators are permitted — anything else throws.

   Grammar (precedence low→high):
     expr    := ternary
     ternary := logicOr ('?' expr ':' ternary)?
     logicOr := logicAnd ('||' logicAnd)*
     logicAnd:= equality ('&&' equality)*
     equality:= relational (('=='|'!='|'==='|'!==') relational)*
     relational := additive (('<'|'>'|'<='|'>=') additive)*
     additive:= multiplicative (('+'|'-') multiplicative)*
     multiplicative := unary (('*'|'/'|'%') unary)*
     unary   := ('-'|'+'|'!') unary | power
     power   := primary ('**' unary)?
     primary := number | string | 'true' | 'false' | 'null' | 'NaN' | 'Infinity'
              | '(' expr ')' | rowRef | mathRef
     rowRef  := 'row' ('.' id | '[' expr ']')?
     mathRef := 'Math' '.' id ('(' args? ')')?
     args    := expr (',' expr)*
*/
(function () {
  "use strict";

  // Whitelisted Math members (constants + functions). Nothing else on Math is reachable.
  //
  // `random` is deliberately NOT here (PLAN §12 F6). It isn't a security question — the sandbox holds
  // either way — it's determinism. A formula column is stored as a cleaning STEP and replayed by
  // applySteps() on every load, undo, redo and step-scrub, so `Math.random()` would produce different
  // numbers each replay: the same saved project, and the same shared #p= link, would show different
  // values on every open, and any analysis run on that column would be unreproducible. Every other
  // engine in js/ holds this line (crossVal seeds its own PRNG rather than reach for Math.random);
  // this whitelist was the one hole. Removing it turns a formula that used it into a clear parse
  // error ("Math.random is not allowed") instead of silent non-reproducibility.
  const MATH_FNS = new Set([
    "abs", "ceil", "floor", "round", "trunc", "sign", "sqrt", "cbrt", "exp", "expm1",
    "log", "log2", "log10", "log1p", "pow", "min", "max", "hypot",
    "sin", "cos", "tan", "asin", "acos", "atan", "atan2", "sinh", "cosh", "tanh",
  ]);
  const MATH_CONSTS = new Set(["PI", "E", "LN2", "LN10", "LOG2E", "LOG10E", "SQRT2", "SQRT1_2"]);

  // ── tokenizer ──────────────────────────────────────────────────────
  function tokenize(input) {
    const src = String(input == null ? "" : input);
    const tokens = [];
    // order matters: multi-char operators before their single-char prefixes.
    const re = new RegExp(
      "\\s+" +
      "|(\\d+\\.\\d+(?:[eE][+-]?\\d+)?|\\d+(?:[eE][+-]?\\d+)?|\\.\\d+(?:[eE][+-]?\\d+)?)" +  // 1: number
      "|('(?:[^'\\\\]|\\\\.)*'|\"(?:[^\"\\\\]|\\\\.)*\")" +                                   // 2: string
      "|(\\*\\*|===|!==|==|!=|<=|>=|&&|\\|\\|)" +                                             // 3: multi-char op
      "|([+\\-*/%<>!?:.,()\\[\\]])" +                                                          // 4: single-char op/punct
      "|([\\p{L}_$][\\p{L}\\p{N}_$]*)",                                                        // 5: identifier
      "gu"
    );
    let last = 0, m;
    while ((m = re.exec(src)) !== null) {
      if (m.index !== last) throw new Error(`Unexpected character at ${last}: "${src.slice(last, m.index)}"`);
      last = re.lastIndex;
      if (m[1] != null) tokens.push({ t: "num", v: Number(m[1]) });
      else if (m[2] != null) tokens.push({ t: "str", v: parseStringLiteral(m[2]) });
      else if (m[3] != null) tokens.push({ t: m[3] });
      else if (m[4] != null) tokens.push({ t: m[4] });
      else if (m[5] != null) tokens.push({ t: "id", v: m[5] });
      // else: pure whitespace match → skip
    }
    if (last !== src.length) throw new Error(`Unexpected character at ${last}: "${src.slice(last)}"`);
    return tokens;
  }

  function parseStringLiteral(raw) {
    const body = raw.slice(1, -1);
    return body.replace(/\\(.)/g, (_, c) => {
      if (c === "n") return "\n";
      if (c === "t") return "\t";
      if (c === "r") return "\r";
      return c; // \\, \', \", etc.
    });
  }

  // ── parser ─────────────────────────────────────────────────────────
  function parse(input) {
    const toks = tokenize(input);
    let i = 0;
    const peek = () => toks[i];
    const next = () => toks[i++];
    const expect = (t) => { const k = next(); if (!k || k.t !== t) throw new Error(`Expected "${t}"`); return k; };

    function parseExpr() { return parseTernary(); }

    function parseTernary() {
      const cond = parseLogicOr();
      if (peek() && peek().t === "?") {
        next();
        const then = parseExpr();
        expect(":");
        const els = parseTernary();
        return { type: "cond", cond, then, els };
      }
      return cond;
    }
    function parseLogicOr() {
      let node = parseLogicAnd();
      while (peek() && peek().t === "||") { next(); node = { type: "logic", op: "||", left: node, right: parseLogicAnd() }; }
      return node;
    }
    function parseLogicAnd() {
      let node = parseEquality();
      while (peek() && peek().t === "&&") { next(); node = { type: "logic", op: "&&", left: node, right: parseEquality() }; }
      return node;
    }
    function parseEquality() {
      let node = parseRelational();
      while (peek() && ["==", "!=", "===", "!=="].includes(peek().t)) { const op = next().t; node = { type: "binop", op, left: node, right: parseRelational() }; }
      return node;
    }
    function parseRelational() {
      let node = parseAdditive();
      while (peek() && ["<", ">", "<=", ">="].includes(peek().t)) { const op = next().t; node = { type: "binop", op, left: node, right: parseAdditive() }; }
      return node;
    }
    function parseAdditive() {
      let node = parseMultiplicative();
      while (peek() && (peek().t === "+" || peek().t === "-")) { const op = next().t; node = { type: "binop", op, left: node, right: parseMultiplicative() }; }
      return node;
    }
    function parseMultiplicative() {
      let node = parseUnary();
      while (peek() && ["*", "/", "%"].includes(peek().t)) { const op = next().t; node = { type: "binop", op, left: node, right: parseUnary() }; }
      return node;
    }
    function parseUnary() {
      const k = peek();
      if (k && (k.t === "-" || k.t === "+" || k.t === "!")) { next(); return { type: "unary", op: k.t, operand: parseUnary() }; }
      return parsePower();
    }
    function parsePower() {
      const base = parsePrimary();
      if (peek() && peek().t === "**") { next(); return { type: "binop", op: "**", left: base, right: parseUnary() }; }
      return base;
    }
    function parsePrimary() {
      const k = peek();
      if (!k) throw new Error("Unexpected end of expression");
      if (k.t === "num") { next(); return { type: "num", value: k.v }; }
      if (k.t === "str") { next(); return { type: "str", value: k.v }; }
      if (k.t === "(") { next(); const e = parseExpr(); expect(")"); return e; }
      if (k.t === "id") {
        const name = k.v;
        if (name === "true") { next(); return { type: "lit", value: true }; }
        if (name === "false") { next(); return { type: "lit", value: false }; }
        if (name === "null") { next(); return { type: "lit", value: null }; }
        if (name === "NaN") { next(); return { type: "num", value: NaN }; }
        if (name === "Infinity") { next(); return { type: "num", value: Infinity }; }
        if (name === "row") {
          next();
          if (peek() && peek().t === ".") { next(); const f = expect("id"); return { type: "row", key: { type: "str", value: f.v } }; }
          if (peek() && peek().t === "[") { next(); const e = parseExpr(); expect("]"); return { type: "row", key: e }; }
          return { type: "rowObj" }; // bare `row`
        }
        if (name === "Math") {
          next(); expect("."); const f = expect("id");
          if (peek() && peek().t === "(") {
            next();
            const args = [];
            if (peek() && peek().t !== ")") { args.push(parseExpr()); while (peek() && peek().t === ",") { next(); args.push(parseExpr()); } }
            expect(")");
            if (!MATH_FNS.has(f.v)) throw new Error(`Math.${f.v} is not allowed`);
            return { type: "mathCall", fn: f.v, args };
          }
          if (!MATH_CONSTS.has(f.v)) throw new Error(`Math.${f.v} is not allowed`);
          return { type: "mathConst", name: f.v };
        }
        throw new Error(`Unknown identifier "${name}" (only row.* and Math.* are allowed)`);
      }
      throw new Error(`Unexpected token "${k.t}"`);
    }

    const ast = parseExpr();
    if (i !== toks.length) throw new Error("Unexpected trailing tokens");
    return ast;
  }

  // ── evaluator ──────────────────────────────────────────────────────
  function evaluate(ast, row) {
    switch (ast.type) {
      case "num": return ast.value;
      case "str": return ast.value;
      case "lit": return ast.value;
      case "rowObj": return row;
      case "row": {
        const key = evaluate(ast.key, row);
        if (row == null) return undefined;
        // Security (A1): never walk the prototype chain — `row.constructor` is the classic
        // `constructor.constructor("…")()` code-exec escape. Only own enumerable data props resolve;
        // anything inherited (constructor, __proto__, toString, …) returns undefined.
        const k = String(key);
        if (k === "__proto__" || k === "constructor" || k === "prototype") return undefined;
        return Object.prototype.hasOwnProperty.call(row, k) ? row[k] : undefined;
      }
      case "mathConst": return Math[ast.name];
      case "mathCall": return Math[ast.fn].apply(Math, ast.args.map((a) => evaluate(a, row)));
      case "unary": {
        const v = evaluate(ast.operand, row);
        if (ast.op === "-") return -v;
        if (ast.op === "+") return +v;
        if (ast.op === "!") return !v;
        throw new Error(`Unknown unary ${ast.op}`);
      }
      case "logic": {
        const l = evaluate(ast.left, row);
        if (ast.op === "&&") return l && evaluate(ast.right, row);
        if (ast.op === "||") return l || evaluate(ast.right, row);
        throw new Error(`Unknown logic ${ast.op}`);
      }
      case "cond": return evaluate(ast.cond, row) ? evaluate(ast.then, row) : evaluate(ast.els, row);
      case "binop": {
        const l = evaluate(ast.left, row), r = evaluate(ast.right, row);
        switch (ast.op) {
          case "+": return l + r;
          case "-": return l - r;
          case "*": return l * r;
          case "/": return l / r;
          case "%": return l % r;
          case "**": return Math.pow(l, r);
          case "<": return l < r;
          case ">": return l > r;
          case "<=": return l <= r;
          case ">=": return l >= r;
          case "==": return l == r;   // eslint-disable-line eqeqeq — mirror JS formula semantics
          case "!=": return l != r;   // eslint-disable-line eqeqeq
          case "===": return l === r;
          case "!==": return l !== r;
          default: throw new Error(`Unknown operator ${ast.op}`);
        }
      }
      default: throw new Error(`Invalid AST node ${ast.type}`);
    }
  }

  // Compile once, run per row. `compile(expr)` throws on a syntax error (so the UI can reject a bad
  // formula up front); the returned fn never throws — a runtime error on a given row yields null,
  // matching the old per-cell try/catch behavior.
  function compile(expr) {
    const ast = parse(expr);
    return function (row) {
      try { const v = evaluate(ast, row); return v === undefined ? null : v; }
      catch (e) { return null; }
    };
  }

  // Convenience: parse+eval a single row, never throws → { value, error }.
  function compute(expr, row) {
    try { return { value: compile(expr)(row), error: null }; }
    catch (e) { return { value: null, error: e.message || String(e) }; }
  }

  const api = { parse, evaluate, compile, compute, MATH_FNS, MATH_CONSTS };
  if (typeof window !== "undefined") window.FormulaEval = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
