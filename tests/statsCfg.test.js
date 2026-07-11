const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { catsOf, numsOf, defaultCfg, resolveCfg } = require(path.join(__dirname, "..", "js", "statsCfg.js"));

// Subway-like dataset (categoricals typed as string, numeric measures)
const subwayCols = [
  { key: "노선명", type: "string" },
  { key: "역명", type: "category" },
  { key: "승차총승객수", type: "integer" },
  { key: "하차총승객수", type: "integer" },
  { key: "요금", type: "float" },
];
const subwayRows = [
  { 노선명: "1호선", 역명: "서울역", 승차총승객수: 100, 하차총승객수: 90, 요금: 1.4 },
  { 노선명: "2호선", 역명: "강남", 승차총승객수: 200, 하차총승객수: 180, 요금: 1.5 },
  { 노선명: "2호선", 역명: "홍대", 승차총승객수: 300, 하차총승객수: 250, 요금: 1.5 },
];

test("catsOf treats both category and string as categorical; numsOf takes integer+float", () => {
  assert.deepEqual(catsOf(subwayCols).map((c) => c.key), ["노선명", "역명"]);
  assert.deepEqual(numsOf(subwayCols).map((c) => c.key), ["승차총승객수", "하차총승객수", "요금"]);
});

test("defaultCfg is derived from real columns — no hardcoded field names", () => {
  const cfg = defaultCfg(subwayCols);
  assert.equal(cfg.test, "descriptive");
  assert.equal(cfg.measure, "승차총승객수"); // first numeric
  assert.equal(cfg.group, "노선명");         // first categorical
  assert.equal(cfg.a, "노선명");
  assert.equal(cfg.b, "역명");               // second categorical
  assert.equal(cfg.target, "승차총승객수");
  assert.ok(cfg.preds.every((k) => k !== cfg.target)); // preds exclude target
  assert.ok(cfg.preds.length <= 3);
  assert.equal(cfg.distCol, "승차총승객수");
  // ensure no leaked Seoul-real-estate hardcodes
  const s = JSON.stringify(cfg);
  assert.ok(!/price_per_m2|price_manwon|아파트|오피스텔/.test(s));
});

test("resolveCfg heals a stale cross-dataset (Seoul real-estate) config against subway columns", () => {
  const stale = {
    test: "anova", method: "pearson",
    measure: "price_per_m2", group: "매물종류",
    l1: "아파트", l2: "오피스텔",
    a: "매물종류", b: "지역구",
    target: "price_manwon", preds: ["area_m2", "floor", "built_year"],
    distCol: "price_per_m2",
    builder: { target: "price_manwon", inputs: ["area_m2"], result: { foo: 1 } },
  };
  const cfg = resolveCfg(stale, subwayCols, subwayRows);
  const has = (k) => subwayCols.some((c) => c.key === k);
  // every column reference now points to an existing column
  for (const k of [cfg.measure, cfg.group, cfg.a, cfg.b, cfg.target, cfg.distCol, cfg.builder.target]) {
    assert.ok(has(k), `${k} should exist in columns`);
  }
  assert.ok(cfg.preds.every(has));
  assert.equal(cfg.test, "anova"); // preserves user's chosen test
  // group levels re-derived from actual rows
  assert.ok(["1호선", "2호선"].includes(cfg.l1));
  assert.ok(["1호선", "2호선"].includes(cfg.l2));
  // stale builder inputs pruned
  assert.deepEqual(cfg.builder.inputs, []);
});

test("resolveCfg preserves an already-valid config", () => {
  const valid = defaultCfg(subwayCols);
  valid.test = "corr";
  valid.measure = "하차총승객수";
  valid.group = "역명";
  const cfg = resolveCfg(valid, subwayCols, subwayRows);
  assert.equal(cfg.test, "corr");
  assert.equal(cfg.measure, "하차총승객수");
  assert.equal(cfg.group, "역명");
});

test("resolveCfg / defaultCfg do not crash on empty columns or empty rows", () => {
  const cfg = resolveCfg({}, [], []);
  assert.equal(cfg.measure, "");
  assert.equal(cfg.group, "");
  assert.deepEqual(cfg.preds, []);
  assert.deepEqual(defaultCfg([]).preds, []);
  // rows can be null without throwing
  assert.doesNotThrow(() => resolveCfg({ group: "노선명" }, subwayCols, null));
});
