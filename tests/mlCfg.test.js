const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { mlNums, mlCats, mlDefaultCfg, mlResolveCfg } = require(path.join(__dirname, "..", "js", "mlCfg.js"));

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
