// mlCfg.js — ML mode configuration helpers (schema-agnostic, dual-mode).
// Extracted from mlMode.jsx so the hardcoding-healing logic has permanent Node regression tests.
// Pure functions only. Loadable in browser (window.MlCfg) and Node (require).
(function () {
  // Categorical = category OR string; numeric = integer/float.
  const mlNums = (columns) => columns.filter((c) => c.type === "integer" || c.type === "float");
  const mlCats = (columns) => columns.filter((c) => c.type === "category" || c.type === "string");

  function mlDefaultCfg(columns) {
    const nums = mlNums(columns);
    const num0 = nums[0] ? nums[0].key : "";
    return { task: "reg", target: num0, feats: nums.filter((c) => c.key !== num0).slice(0, 3).map((c) => c.key), split: 0.3, k: 5, K: 3 };
  }

  // Heal a (possibly persisted / cross-dataset) ML config against the current columns.
  function mlResolveCfg(cfgS, columns) {
    const base = mlDefaultCfg(columns);
    const cfg = { ...base, ...(cfgS || {}) };
    const nums = mlNums(columns), cats = mlCats(columns);
    const num0 = nums[0] ? nums[0].key : "";
    const isCatTask = cfg.task === "clf" || cfg.task === "logit";
    const okTarget = isCatTask ? cats.some((c) => c.key === cfg.target) : nums.some((c) => c.key === cfg.target);
    if (!okTarget) cfg.target = isCatTask ? ((cats[0] || {}).key || "") : num0;
    cfg.feats = (cfg.feats || []).filter((k) => k !== cfg.target && nums.some((c) => c.key === k));
    if (!cfg.feats.length) cfg.feats = nums.filter((c) => c.key !== cfg.target).slice(0, 3).map((c) => c.key);
    return cfg;
  }

  const api = { mlNums, mlCats, mlDefaultCfg, mlResolveCfg };
  if (typeof window !== "undefined") window.MlCfg = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
