// statsCfg.js — Stats mode configuration helpers (schema-agnostic, dual-mode).
// Extracted from statsMode.jsx so the hardcoding-healing logic has permanent Node regression tests.
// Pure functions only (no React / no window.Store). Loadable in browser (window.StatsCfg) and Node (require).
(function () {
  // Categorical = category OR string (many datasets type their categoricals as string).
  const catsOf = (columns) => columns.filter((c) => c.type === "category" || c.type === "string");
  const numsOf = (columns) => columns.filter((c) => c.type === "integer" || c.type === "float");

  // Starter config derived from the ACTIVE dataset's real columns (no hardcoded fields).
  function defaultCfg(columns) {
    const cats = catsOf(columns), nums = numsOf(columns);
    const num0 = nums[0] ? nums[0].key : "";
    const cat0 = cats[0] ? cats[0].key : "";
    const cat1 = cats[1] ? cats[1].key : cat0;
    return {
      test: "descriptive", method: "pearson",
      measure: num0, group: cat0,
      l1: "", l2: "",
      a: cat0, b: cat1,
      target: num0, preds: nums.filter((c) => c.key !== num0).slice(0, 3).map((c) => c.key),
      distCol: num0,
      builder: { target: num0, inputs: [], result: null },
    };
  }

  // Heal a (possibly persisted / cross-dataset) config against the current columns so
  // no test ever references a missing column. Fills group levels from actual rows.
  function resolveCfg(cfgS, columns, rows) {
    const base = defaultCfg(columns);
    const cfg = { ...base, ...(cfgS || {}) };
    const has = (k) => !!k && columns.some((c) => c.key === k);
    const nums = numsOf(columns), cats = catsOf(columns);
    const num0 = nums[0] ? nums[0].key : "";
    const cat0 = cats[0] ? cats[0].key : "";
    const cat1 = cats[1] ? cats[1].key : cat0;
    if (!has(cfg.measure)) cfg.measure = num0;
    if (!has(cfg.group))   cfg.group   = cat0;
    if (!has(cfg.a))       cfg.a       = cat0;
    if (!has(cfg.b))       cfg.b       = cat1;
    if (!has(cfg.target))  cfg.target  = num0;
    cfg.preds = (cfg.preds || []).filter(has);
    if (!cfg.preds.length) cfg.preds = nums.filter((c) => c.key !== cfg.target).slice(0, 3).map((c) => c.key);
    if (!has(cfg.distCol)) cfg.distCol = num0;
    if (has(cfg.group)) {
      const lv = [...new Set((rows || []).map((r) => String(r[cfg.group])))];
      if (!lv.includes(cfg.l1)) cfg.l1 = lv[0] || "";
      if (!lv.includes(cfg.l2)) cfg.l2 = lv[1] || lv[0] || "";
    }
    const b = cfg.builder || {};
    cfg.builder = { target: has(b.target) ? b.target : num0, inputs: (b.inputs || []).filter(has), result: b.result || null };
    return cfg;
  }

  const api = { catsOf, numsOf, defaultCfg, resolveCfg };
  if (typeof window !== "undefined") window.StatsCfg = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
