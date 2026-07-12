// mlCfg.js — ML mode configuration helpers (schema-agnostic, dual-mode).
// Extracted from mlMode.jsx so the hardcoding-healing logic has permanent Node regression tests.
// Pure functions only. Loadable in browser (window.MlCfg) and Node (require).
(function () {
  // Categorical = category OR string; numeric = integer/float.
  const mlNums = (columns) => columns.filter((c) => c.type === "integer" || c.type === "float");
  const mlCats = (columns) => columns.filter((c) => c.type === "category" || c.type === "string");

  function mlDefaultCfg(columns) {
    const nums = mlNums(columns);
    // Prefer a real measure over an identifier column as the default target (id/__rid make a
    // meaningless regression target — FOLLOWUP §7 observation).
    const num0 = (nums.find((c) => c.key !== "id" && c.key !== "__rid") || nums[0] || {}).key || "";
    return { task: "reg", target: num0, feats: nums.filter((c) => c.key !== num0).slice(0, 3).map((c) => c.key), split: 0.3, k: 5, K: 3 };
  }

  // Heal a (possibly persisted / cross-dataset) ML config against the current columns.
  function mlResolveCfg(cfgS, columns) {
    const base = mlDefaultCfg(columns);
    const cfg = { ...base, ...(cfgS || {}) };
    const nums = mlNums(columns), cats = mlCats(columns);
    const num0 = nums[0] ? nums[0].key : "";
    const isCatTask = cfg.task === "clf" || cfg.task === "logit" || cfg.task === "dt" || cfg.task === "nb";
    const okTarget = isCatTask ? cats.some((c) => c.key === cfg.target) : nums.some((c) => c.key === cfg.target);
    if (!okTarget) cfg.target = isCatTask ? ((cats[0] || {}).key || "") : num0;
    cfg.feats = (cfg.feats || []).filter((k) => k !== cfg.target && nums.some((c) => c.key === k));
    if (!cfg.feats.length) cfg.feats = nums.filter((c) => c.key !== cfg.target).slice(0, 3).map((c) => c.key);
    return cfg;
  }

  // Distinct value count for a column (capped scan).
  function distinctCount(rows, key, cap) {
    const s = new Set();
    for (const r of rows) { const v = r[key]; if (v != null && v !== "") s.add(String(v)); if (cap && s.size > cap) break; }
    return s.size;
  }

  // Data-driven task eligibility: which ML tasks can actually run on these columns+rows, and which
  // targets are valid for each. Returns { <task>: { ok, reason, validTargets:[{key,label,classes?}] } }.
  // Supervised feature = any numeric column (target excluded downstream). Categorical target class
  // count uses a capped distinct scan. logit/clf/dt/nb are classification (categorical target);
  // reg is numeric target; pca/km/dbscan/hier are unsupervised (numeric columns only).
  function mlEligibility(columns, rows) {
    columns = columns || []; rows = rows || [];
    const nums = mlNums(columns), cats = mlCats(columns);
    const n = rows.length;
    const catInfo = cats.map((c) => ({ key: c.key, label: c.label || c.key, classes: distinctCount(rows, c.key, 200) }));
    const clfTargets = catInfo.filter((c) => c.classes >= 2 && c.classes <= 20);   // usable categorical targets
    const binaryTargets = catInfo.filter((c) => c.classes === 2);
    const numTargets = nums.map((c) => ({ key: c.key, label: c.label || c.key }));
    const hasNumFeat = nums.length >= 1;

    const clfElig = () => (clfTargets.length && hasNumFeat)
      ? { ok: true, reason: "", validTargets: clfTargets }
      : { ok: false, reason: !hasNumFeat ? "숫자 특성이 필요합니다" : "2~20 클래스 범주형 목표가 필요합니다", validTargets: clfTargets };
    const unsup = (min) => (nums.length >= 2 && n >= min)
      ? { ok: true, reason: "", validTargets: [] }
      : { ok: false, reason: nums.length < 2 ? "숫자 열이 2개 이상 필요합니다" : `행이 ${min}개 이상 필요합니다`, validTargets: [] };

    return {
      // Regression: numeric target + ≥1 other numeric feature → needs ≥2 numeric columns
      reg: (nums.length >= 2)
        ? { ok: true, reason: "", validTargets: numTargets }
        : { ok: false, reason: "숫자 열이 2개 이상 필요합니다 (목표 + 특성)", validTargets: numTargets },
      clf: clfElig(),
      dt: clfElig(),
      nb: clfElig(),
      // Logistic: binary classification. With one-vs-rest (positive-class pick) ANY 2–20 class target
      // works, so eligibility == clf; multiTargets flags which need a positive class chosen.
      logit: (clfTargets.length && hasNumFeat)
        ? { ok: true, reason: "", validTargets: clfTargets, binaryTargets: binaryTargets }
        : { ok: false, reason: !hasNumFeat ? "숫자 특성이 필요합니다" : "범주형 목표가 필요합니다 (2클래스 또는 양성 클래스 선택)", validTargets: clfTargets, binaryTargets: binaryTargets },
      pca: unsup(2), km: unsup(3), dbscan: unsup(4), hier: unsup(2),
    };
  }

  const api = { mlNums, mlCats, mlDefaultCfg, mlResolveCfg, mlEligibility, distinctCount };
  if (typeof window !== "undefined") window.MlCfg = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
