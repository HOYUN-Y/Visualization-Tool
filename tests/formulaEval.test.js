const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const FE = require(path.join(__dirname, "..", "js", "formulaEval.js"));

const row = { price: 100, area: 25, qty: 3, name: "A", flag: 1, zero: 0, nul: null };

// ── behavior parity with the old `new Function("row","Math", ...)` ────────────
test("basic arithmetic on row fields", () => {
  assert.ok(Math.abs(FE.compute("row.price * 1.1", row).value - 110) < 1e-9);
  assert.equal(FE.compute("row.area * row.price", row).value, 2500);
  assert.equal(FE.compute("row.price + row.area - row.qty", row).value, 122);
  assert.equal(FE.compute("(row.price + row.area) / 5", row).value, 25);
  assert.equal(FE.compute("row.price % row.qty", row).value, 1);
  assert.equal(FE.compute("row.qty ** 2", row).value, 9);
});

test("Math whitelist functions and constants", () => {
  assert.equal(FE.compute("Math.sqrt(row.price)", row).value, 10);
  assert.equal(FE.compute("Math.round(Math.log(row.price))", row).value, 5);
  assert.equal(FE.compute("Math.max(row.price, row.area)", row).value, 100);
  assert.equal(FE.compute("Math.min(row.price, row.area, row.qty)", row).value, 3);
  assert.equal(FE.compute("Math.abs(-row.price)", row).value, 100);
  assert.equal(FE.compute("Math.pow(row.qty, 3)", row).value, 27);
  assert.equal(Math.round(FE.compute("Math.PI * 2", row).value * 1000) / 1000, 6.283);
});

test("Math.random is rejected — formula columns must be reproducible (PLAN §12 F6)", () => {
  // Not a sandbox question (the whitelist holds either way) — a determinism one. A formula column is
  // stored as a cleaning STEP and replayed by applySteps() on every load/undo/redo/step-scrub, so
  // Math.random() would make the same saved project — and the same shared #p= link — show different
  // numbers on every open. Every other engine in js/ holds this line; this whitelist was the hole.
  assert.throws(() => FE.compile("Math.random()"), /random is not allowed/);
  assert.throws(() => FE.compile("Math.random() * row.price"), /random is not allowed/);
  // compute() surfaces it as an error rather than throwing, per its contract.
  assert.ok(FE.compute("Math.random()", row).error, "compute must report an error, not a value");

  // The rejection must be surgical: neighbouring Math members still work.
  assert.equal(FE.compute("Math.round(row.area)", row).value, 25);
  assert.equal(FE.compute("Math.sqrt(row.price)", row).value, 10);
});

test("unary, comparison, logical, ternary", () => {
  assert.equal(FE.compute("-row.price", row).value, -100);
  assert.equal(FE.compute("row.price > row.area", row).value, true);
  assert.equal(FE.compute("row.price >= 100 && row.qty < 5", row).value, true);
  assert.equal(FE.compute("row.name == 'A'", row).value, true);
  assert.equal(FE.compute("row.name === 'B'", row).value, false);
  assert.equal(FE.compute("row.price > 50 ? row.price : 0", row).value, 100);
  assert.equal(FE.compute("row.flag ? 'yes' : 'no'", row).value, "yes");
  assert.equal(FE.compute("!row.zero", row).value, true);
});

test("bracket field access + string/number/bool/null literals", () => {
  assert.equal(FE.compute("row['price'] + 1", row).value, 101);
  assert.equal(FE.compute("42", row).value, 42);
  assert.equal(FE.compute("true", row).value, true);
  assert.equal(FE.compute("false", row).value, false);
  assert.equal(FE.compute("'hello'", row).value, "hello");
});

// PLAN §12 B3′ — Korean / spaced / special-character column names. This app's domain is Korean
// apartment data, so a formula must be able to reference 한글 columns. Dot access works for valid
// identifiers (Korean letters are); brackets cover everything else (spaces, leading digits, symbols).
// These lock that so a tokenizer/parser change can't silently break it.
test("B3′: Korean and special column names via dot and bracket access", () => {
  const kr = { "가격": 100, "면적_m2": 25, "면적 (m²)": 30, "2024년": 7, "가-나": 5, "price/m2": 4 };
  // Korean identifier — dot access is valid (letters).
  assert.equal(FE.compute("row.가격 * 2", kr).value, 200);
  assert.equal(FE.compute("row.면적_m2 + 1", kr).value, 26);
  // Bracket access — the general escape hatch for names dots can't express.
  assert.equal(FE.compute('row["가격"] + row["면적_m2"]', kr).value, 125);
  assert.equal(FE.compute('row["면적 (m²)"] * 2', kr).value, 60);   // spaces + unicode symbol
  assert.equal(FE.compute('row["2024년"] + 1', kr).value, 8);        // leading digit
  assert.equal(FE.compute('row["가-나"] * row["price/m2"]', kr).value, 20); // hyphen, slash
  // Single-quoted brackets too.
  assert.equal(FE.compute("row['가격']", kr).value, 100);
});

test("B3′: bracket access stays sandboxed — no prototype escape via a Korean-looking key", () => {
  // The A1 security guarantees must still hold for bracket keys: prototype-chain keys are blocked and
  // only own data properties resolve (compute → null, not a function/constructor).
  const r = { "가격": 1 };
  assert.equal(FE.compute('row["constructor"]', r).value, null);
  assert.equal(FE.compute('row["__proto__"]', r).value, null);
  assert.equal(FE.compute('row["missing_한글"]', r).value, null); // absent own prop → null
});

test("compile returns a reusable per-row fn; runtime errors → null, not throw", () => {
  const fn = FE.compile("row.price / row.zero");   // 100/0 = Infinity (valid JS), stays a number
  assert.equal(fn(row), Infinity);
  const fn2 = FE.compile("Math.sqrt(row.price)");
  assert.equal(fn2({ price: 144 }), 12);
  // missing field → undefined arithmetic → NaN passes through as a value (matches old behavior)
  assert.ok(Number.isNaN(FE.compile("row.nope * 2")(row)));
});

// ── SECURITY: the whole point of A1 — no arbitrary code execution ─────────────
test("blocks arbitrary identifiers / globals", () => {
  for (const bad of [
    "window",
    "globalThis",
    "process",
    "document",
    "fetch('/x')",
    "require('fs')",
    "eval('1')",
    "alert(1)",
  ]) {
    const r = FE.compute(bad, row);
    assert.equal(r.value, null, `expected null value for: ${bad}`);
    assert.ok(r.error, `expected an error for: ${bad}`);
  }
});

test("row.constructor is neutralized to undefined→null (prototype chain not walked)", () => {
  // `row.constructor` parses but must NOT expose Object — it resolves to undefined (→ null value).
  const r = FE.compute("row.constructor", row);
  assert.equal(r.value, null);
});

test("blocks the classic new Function / constructor escape", () => {
  // `row.constructor.constructor("return process")()` — the canonical sandbox escape.
  const r = FE.compute("row.constructor.constructor('return process')()", row);
  assert.equal(r.value, null);
  assert.ok(r.error);
});

test("blocks non-whitelisted Math members", () => {
  // Math.constructor / Math.toString etc. must be rejected at parse time.
  assert.ok(FE.compute("Math.constructor", row).error);
  assert.ok(FE.compute("Math.constructor()", row).error);
  assert.ok(FE.compute("Math.__proto__", row).error);
});

test("blocks assignment / statements / member calls on results", () => {
  for (const bad of [
    "row.price = 5",
    "row.price; window",
    "row.name.toUpperCase()",   // method call on a value — not allowed
    "[1,2,3]",
    "{a:1}",
  ]) {
    assert.ok(FE.compute(bad, row).error, `expected error for: ${bad}`);
  }
});

test("compile throws on syntax error (so UI can reject up front)", () => {
  assert.throws(() => FE.compile("row.price *"));
  assert.throws(() => FE.compile("Math.foo("));
  assert.throws(() => FE.compile(")("));
});

test("parse exposes an AST; MATH_FNS/MATH_CONSTS are sets", () => {
  const ast = FE.parse("row.price + 1");
  assert.equal(ast.type, "binop");
  assert.ok(FE.MATH_FNS.has("sqrt"));
  assert.ok(FE.MATH_CONSTS.has("PI"));
  assert.ok(!FE.MATH_FNS.has("constructor"));
});
