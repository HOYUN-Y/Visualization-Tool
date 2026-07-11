const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const CA = require(path.join(__dirname, "..", "js", "chartAdvisor.js"));

const rec = (cols, meas, opts) => CA.recommend(cols, meas, opts).type;

test("no measure → needs a measure", () => {
  assert.equal(CA.recommend([{ key: "d", type: "category" }], []).type, null);
});

test("2 measures no dimension → scatter, 3 → bubble", () => {
  assert.equal(rec([], [{ key: "a" }, { key: "b" }]), "scatter");
  assert.equal(rec([], [{ key: "a" }, { key: "b" }, { key: "c" }]), "bubble");
});

test("date dimension → line", () => {
  assert.equal(rec([{ key: "month", type: "datetime" }], [{ key: "v" }]), "line");
});

test("category dimension × 1 measure → bar; low cardinality → pie", () => {
  assert.equal(rec([{ key: "region", type: "category" }], [{ key: "v" }]), "bar");
  assert.equal(rec([{ key: "region", type: "category", cardinality: 5 }], [{ key: "v" }]), "pie");
});

test("category × multiple measures → bar (grouped)", () => {
  assert.equal(rec([{ key: "region", type: "category" }], [{ key: "a" }, { key: "b" }]), "bar");
});

test("2 dimensions × measure → heatmap", () => {
  assert.equal(rec([{ key: "a", type: "category" }, { key: "b", type: "category" }], [{ key: "v" }]), "heatmap");
});

test("OHLC hint with empty shelves → candlestick", () => {
  assert.equal(CA.recommend([], [], { hasOHLC: true }).type, "candlestick");
});

test("recommendation always returns a reason string", () => {
  const r = CA.recommend([{ key: "d", type: "category" }], [{ key: "v" }]);
  assert.ok(typeof r.reason === "string" && r.reason.length > 0);
});
