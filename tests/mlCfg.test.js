const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { mlNums, mlCats, mlDefaultCfg, mlResolveCfg, mlEligibility } = require(path.join(__dirname, "..", "js", "mlCfg.js"));

// ---- P13: task eligibility ----
const eligCols = [
  { key: "id", type: "integer", role: "measure" },
  { key: "price", type: "float", role: "measure" },
  { key: "floor", type: "integer", role: "measure" },
  { key: "type2", type: "string", role: "dimension" },   // 2 classes
  { key: "type3", type: "category", role: "dimension" }, // 3 classes
];
const eligRows = [
  { id: 1, price: 10, floor: 1, type2: "A", type3: "x" },
  { id: 2, price: 20, floor: 2, type2: "B", type3: "y" },
  { id: 3, price: 30, floor: 3, type2: "A", type3: "z" },
  { id: 4, price: 40, floor: 4, type2: "B", type3: "x" },
];

test("mlDefaultCfg skips an 'id' column as the default regression target", () => {
  assert.equal(mlDefaultCfg(eligCols).target, "price"); // not "id"
});

test("mlEligibility: regression needs ≥2 numeric columns", () => {
  const e = mlEligibility(eligCols, eligRows);
  assert.equal(e.reg.ok, true);
  assert.ok(e.reg.validTargets.some((t) => t.key === "price"));
  const oneNum = mlEligibility([{ key: "x", type: "float", role: "measure" }, { key: "c", type: "string" }], [{ x: 1, c: "a" }]);
  assert.equal(oneNum.reg.ok, false);
});

test("mlEligibility: clf needs a 2–20 class categorical target + numeric feature", () => {
  const e = mlEligibility(eligCols, eligRows);
  assert.equal(e.clf.ok, true);
  const keys = e.clf.validTargets.map((t) => t.key);
  assert.ok(keys.includes("type2") && keys.includes("type3"));
  // annotated with class counts
  assert.equal(e.clf.validTargets.find((t) => t.key === "type2").classes, 2);
  assert.equal(e.clf.validTargets.find((t) => t.key === "type3").classes, 3);
  // no categorical → not ok
  assert.equal(mlEligibility([{ key: "a", type: "float", role: "measure" }, { key: "b", type: "float", role: "measure" }], eligRows).clf.ok, false);
});

test("mlEligibility: logit eligible for any 2–20 class target (one-vs-rest), flags binary targets", () => {
  const e = mlEligibility(eligCols, eligRows);
  assert.equal(e.logit.ok, true);
  assert.deepEqual(e.logit.binaryTargets.map((t) => t.key), ["type2"]); // only type2 is exactly-binary
  assert.ok(e.logit.validTargets.some((t) => t.key === "type3"));       // multiclass usable via positive class
});

test("mlEligibility: dt/nb mirror clf; unsupervised need ≥2 numeric + rows", () => {
  const e = mlEligibility(eligCols, eligRows);
  assert.equal(e.dt.ok, true);
  assert.equal(e.nb.ok, true);
  assert.equal(e.pca.ok, true);
  assert.equal(e.km.ok, true);   // 4 rows ≥ 3
  assert.equal(e.dbscan.ok, true); // 4 rows ≥ 4
  // only 1 numeric → unsupervised not ok
  assert.equal(mlEligibility([{ key: "x", type: "float", role: "measure" }, { key: "c", type: "string" }], eligRows).pca.ok, false);
});

test("mlEligibility: empty columns/rows degrade without throwing", () => {
  assert.doesNotThrow(() => mlEligibility([], []));
  const e = mlEligibility([], []);
  assert.equal(e.reg.ok, false);
  assert.equal(e.clf.ok, false);
});

const cols = [
  { key: "노선명", type: "string" },
  { key: "역명", type: "category" },
  { key: "승차총승객수", type: "integer" },
  { key: "하차총승객수", type: "integer" },
  { key: "요금", type: "float" },
];

test("mlNums / mlCats partition columns by type", () => {
  assert.deepEqual(mlNums(cols).map((c) => c.key), ["승차총승객수", "하차총승객수", "요금"]);
  assert.deepEqual(mlCats(cols).map((c) => c.key), ["노선명", "역명"]);
});

test("mlDefaultCfg is derived from real columns (reg task, first numeric target)", () => {
  const cfg = mlDefaultCfg(cols);
  assert.equal(cfg.task, "reg");
  assert.equal(cfg.target, "승차총승객수");
  assert.ok(cfg.feats.every((k) => k !== cfg.target));
  assert.ok(cfg.feats.length <= 3);
  const s = JSON.stringify(cfg);
  assert.ok(!/price_manwon|area_m2|built_year|floor/.test(s), "no Seoul real-estate hardcodes");
});

test("mlResolveCfg picks a categorical target for classification tasks", () => {
  const clf = mlResolveCfg({ task: "clf", target: "승차총승객수", feats: [] }, cols);
  assert.equal(clf.target, "노선명"); // healed to first categorical
  const logit = mlResolveCfg({ task: "logit", target: "does_not_exist" }, cols);
  assert.equal(logit.target, "노선명");
});

test("mlResolveCfg keeps a numeric target for regression tasks", () => {
  const reg = mlResolveCfg({ task: "reg", target: "역명" }, cols); // categorical target invalid for reg
  assert.equal(reg.target, "승차총승객수");
});

test("mlResolveCfg heals a stale Seoul real-estate config", () => {
  const stale = { task: "reg", target: "price_manwon", feats: ["area_m2", "floor", "built_year"] };
  const cfg = mlResolveCfg(stale, cols);
  assert.ok(mlNums(cols).some((c) => c.key === cfg.target));
  assert.ok(cfg.feats.every((k) => mlNums(cols).some((c) => c.key === k) && k !== cfg.target));
  assert.ok(cfg.feats.length > 0);
});

test("mlResolveCfg prunes feats equal to target and non-numeric feats", () => {
  const cfg = mlResolveCfg({ task: "reg", target: "승차총승객수", feats: ["승차총승객수", "노선명", "요금"] }, cols);
  assert.ok(!cfg.feats.includes("승차총승객수")); // target excluded
  assert.ok(!cfg.feats.includes("노선명"));      // non-numeric excluded
  assert.ok(cfg.feats.includes("요금"));
});

test("mlResolveCfg does not crash on empty columns", () => {
  const cfg = mlResolveCfg({}, []);
  assert.equal(cfg.target, "");
  assert.deepEqual(cfg.feats, []);
});
