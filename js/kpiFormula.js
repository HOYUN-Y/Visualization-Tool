/* insight Analytics — safe KPI aggregate formula parser + evaluator (window.KPIFormula)
   Grammar (no eval / no new Function):
     expr   := term (('+'|'-') term)*
     term   := unary (('*'|'/') unary)*
     unary  := '-' unary | primary
     primary:= number | '(' expr ')' | agg
     agg    := AGG '(' (field | '*') ')'
   AGG ∈ SUM AVG MEAN COUNT COUNTD MIN MAX MEDIAN.  '*' only valid for COUNT. */
(function () {
  "use strict";

  const AGGS = new Set(["SUM", "AVG", "MEAN", "COUNT", "COUNTD", "MIN", "MAX", "MEDIAN"]);

  // ── tokenizer ──────────────────────────────────────────────────────
  function tokenize(input) {
    const src = String(input == null ? "" : input);
    const tokens = [];
    const re = /\s+|(\d+(?:\.\d+)?)|([+\-*/(),])|([\p{L}_][\p{L}\p{N}_]*)/gu;
    let last = 0, m;
    while ((m = re.exec(src)) !== null) {
      if (m.index !== last) throw new Error(`Unexpected character at ${last}: "${src.slice(last, m.index)}"`);
      last = re.lastIndex;
      if (m[0].trim() === "" && !m[1] && !m[2] && !m[3]) continue;      // whitespace
      if (m[1] != null) tokens.push({ t: "num", v: Number(m[1]) });
      else if (m[2] != null) tokens.push({ t: m[2] });                  // operator/punct incl '*'
      else if (m[3] != null) tokens.push({ t: "id", v: m[3] });
    }
    if (last !== src.length) throw new Error(`Unexpected character at ${last}: "${src.slice(last)}"`);
    return tokens;
  }

  // ── parser ─────────────────────────────────────────────────────────
  function parse(input) {
    const toks = tokenize(input);
    let i = 0;
    const peek = () => toks[i];
    const next = () => toks[i++];
    const expect = (t) => { const k = next(); if (!k || k.t !== t) throw new Error(`Expected "${t}"`); return k; };

    function parseExpr() {
      let node = parseTerm();
      while (peek() && (peek().t === "+" || peek().t === "-")) { const op = next().t; node = { type: "binop", op, left: node, right: parseTerm() }; }
      return node;
    }
    function parseTerm() {
      let node = parseUnary();
      while (peek() && (peek().t === "*" || peek().t === "/")) { const op = next().t; node = { type: "binop", op, left: node, right: parseUnary() }; }
      return node;
    }
    function parseUnary() {
      if (peek() && peek().t === "-") { next(); return { type: "neg", operand: parseUnary() }; }
      return parsePrimary();
    }
    function parsePrimary() {
      const k = peek();
      if (!k) throw new Error("Unexpected end of expression");
      if (k.t === "num") { next(); return { type: "num", value: k.v }; }
      if (k.t === "(") { next(); const e = parseExpr(); expect(")"); return e; }
      if (k.t === "id") {
        const name = k.v.toUpperCase();
        if (!AGGS.has(name)) throw new Error(`Unknown function "${k.v}" (use SUM/AVG/COUNT/COUNTD/MIN/MAX/MEDIAN)`);
        next(); expect("(");
        let field;
        if (peek() && peek().t === "*") { next(); field = "*"; if (name !== "COUNT") throw new Error("* is only valid in COUNT(*)"); }
        else { const f = expect("id"); field = f.v; }
        expect(")");
        return { type: "agg", fn: name === "MEAN" ? "AVG" : name, field };
      }
      throw new Error(`Unexpected token "${k.t}"`);
    }

    const ast = parseExpr();
    if (i !== toks.length) throw new Error("Unexpected trailing tokens");
    return ast;
  }

  // ── aggregation over rows ──────────────────────────────────────────
  function toNums(arr) { const o = []; for (const v of arr) if (v != null && v !== "" && !isNaN(v)) o.push(Number(v)); return o; }
  function median(n) { if (!n.length) return null; const s = [...n].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }

  function aggValue(fn, field, rows, columns) {
    if (field !== "*" && !(columns || []).some((c) => c.key === field)) throw new Error(`Unknown field "${field}"`);
    if (fn === "COUNT") return field === "*" ? rows.length : rows.filter((r) => r[field] != null && r[field] !== "").length;
    if (fn === "COUNTD") return new Set(rows.map((r) => r[field]).filter((v) => v != null && v !== "")).size;
    const nums = toNums(rows.map((r) => r[field]));
    switch (fn) {
      case "SUM": return nums.reduce((a, b) => a + b, 0);
      case "AVG": return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
      case "MIN": return nums.length ? Math.min(...nums) : null;
      case "MAX": return nums.length ? Math.max(...nums) : null;
      case "MEDIAN": return median(nums);
      default: throw new Error(`Unknown aggregation ${fn}`);
    }
  }

  function evaluate(ast, rows, columns) {
    rows = rows || [];
    switch (ast.type) {
      case "num": return ast.value;
      case "neg": { const v = evaluate(ast.operand, rows, columns); return v == null ? null : -v; }
      case "agg": return aggValue(ast.fn, ast.field, rows, columns);
      case "binop": {
        const l = evaluate(ast.left, rows, columns), r = evaluate(ast.right, rows, columns);
        if (l == null || r == null) return null;
        if (ast.op === "+") return l + r;
        if (ast.op === "-") return l - r;
        if (ast.op === "*") return l * r;
        if (ast.op === "/") { if (r === 0) throw new Error("Division by zero"); return l / r; }
        throw new Error(`Unknown operator ${ast.op}`);
      }
      default: throw new Error("Invalid AST node");
    }
  }

  // Convenience: parse + evaluate, never throws — returns { value, error }.
  function compute(expr, rows, columns) {
    try {
      const ast = parse(expr);
      const value = evaluate(ast, rows, columns);
      return { value: (value == null || isNaN(value)) ? null : value, error: null };
    } catch (e) { return { value: null, error: e.message || String(e) }; }
  }

  const api = { parse, evaluate, compute };
  if (typeof window !== "undefined") window.KPIFormula = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
