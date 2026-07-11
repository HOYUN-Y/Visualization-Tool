const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { dimsOf, measOf, dateOf, cardinality, lowCardDim, suggestions, interpret, dimChipOf, measChipOf } =
  require(path.join(__dirname, "..", "js", "aiIntent.js"));

// Subway-like: 노선명 (low card ~27), 역명 (high card ~600), numeric measures
const columns = [
  { key: "노선명", label: "노선명", type: "string", role: "dimension" },
  { key: "역명", label: "역명", type: "string", role: "dimension" },
  { key: "승차총승객수", label: "승차총승객수", type: "integer", role: "measure" },
  { key: "요금", label: "요금", type: "float", role: "measure" },
  { key: "월", label: "월", type: "datetime", role: "dimension" },
];
// build rows: 30 lines, 600 stations
const rows = [];
for (let i = 0; i < 600; i++) {
  rows.push({ 노선명: "라인" + (i % 30), 역명: "역" + i, 승차총승객수: i * 10, 요금: 1.4, 월: "2026-06" });
}

test("dimsOf/measOf/dateOf classify columns", () => {
  assert.deepEqual(dimsOf(columns).map((c) => c.key), ["노선명", "역명"]);
  assert.deepEqual(measOf(columns).map((c) => c.key), ["승차총승객수", "요금"]);
  assert.equal(dateOf(columns).key, "월");
});

test("lowCardDim prefers the 2–50 distinct dimension over a high-cardinality one", () => {
  const d = lowCardDim(rows, dimsOf(columns));
  assert.equal(d.key, "노선명"); // 30 distinct, not 역명 (600)
});

test("cardinality caps its scan but reflects distinct count for low-card columns", () => {
  assert.equal(cardinality(rows, "노선명"), 30);
  assert.ok(cardinality(rows, "역명") > 50);
});

test("suggestion chips use the low-cardinality dimension, not the high-card one", () => {
  const s = suggestions(rows, columns);
  assert.ok(s.some((x) => x.includes("노선명")));
  assert.ok(!s.some((x) => x.includes("역명"))); // 역명 (600) never suggested for grouping
  assert.ok(s.length <= 6);
  // "마지막 분석 요약" is always appended, but the 6-chip cap can drop it on a rich dataset.
  const sparse = suggestions(rows, [{ key: "노선명", label: "노선명", type: "string", role: "dimension" }]);
  assert.ok(sparse.includes("마지막 분석 요약"));
});

test("each generated chip round-trips through interpret to a concrete intent", () => {
  for (const chip of suggestions(rows, columns)) {
    const intent = interpret(chip, columns, rows);
    assert.ok(intent && typeof intent.kind === "string", `no intent for chip: ${chip}`);
  }
});

test("interpret maps intent keywords", () => {
  assert.equal(interpret("승차총승객수 이상치", columns, rows).kind, "outlier");
  assert.equal(interpret("상관관계 보기", columns, rows).kind, "goStats");
  assert.equal(interpret("회귀 분석", columns, rows).kind, "goStats");
  assert.equal(interpret("분포 보기", columns, rows).kind, "goStats");
  assert.equal(interpret("군집 분석", columns, rows).kind, "goMl");
  assert.equal(interpret("마지막 분석 요약", columns, rows).kind, "last");
  assert.equal(interpret("월별 추세", columns, rows).kind, "trend");
  assert.equal(interpret("상위 10 노선명", columns, rows).kind, "top");
  assert.equal(interpret("노선명 비율", columns, rows).kind, "mix");
  assert.equal(interpret("그냥 막대", columns, rows).kind, "bar"); // fallback
});

test("interpret resolves a column mentioned by name in free text", () => {
  const intent = interpret("요금 상위", columns, rows);
  assert.equal(intent.kind, "top");
  assert.equal(intent.measure.key, "요금"); // matched by label
});

test("chip helpers build valid shelf entries", () => {
  assert.deepEqual(dimChipOf({ key: "노선명", label: "노선명", type: "string" }),
    [{ key: "노선명", label: "노선명", role: "dimension", type: "string" }]);
  const m = measChipOf({ key: "요금", label: "요금", type: "float" });
  assert.equal(m[0].agg, "avg");
  assert.equal(m[0].id, "요금_avg");
  assert.deepEqual(dimChipOf(null), []);
  assert.deepEqual(measChipOf(null), []);
});
