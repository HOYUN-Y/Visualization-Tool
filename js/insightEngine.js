/* NØDE — Insight Engine: rule-based auto-interpretation (JMP-style) */
/* window.IE = { profileDataset, summarizeCorrelation, summarizeRegression,
                 summarizeClustering, summarizeClassification, recommendNextStep } */
(function () {

  function profileDataset(id) {
    const Store = window.Store, NODE = window.NODE, SM = window.SM;
    const { rows, columns } = Store.derive.getActiveData(id);
    const stat = Store.stat;
    const findings = [];

    const numCols = columns.filter((c) => c.type === "integer" || c.type === "float");
    const catCols = columns.filter((c) => c.type === "category");

    findings.push(`Dataset has **${rows.length} rows × ${columns.length} columns** (${numCols.length} numeric, ${catCols.length} categorical).`);

    // Missing values
    const withMissing = columns
      .map((c) => ({ label: c.label, miss: stat.missing(rows.map((r) => r[c.key])) }))
      .filter((x) => x.miss > 0)
      .sort((a, b) => b.miss - a.miss);
    if (withMissing.length) {
      findings.push(`**${withMissing.length}** column(s) have missing values — worst: **${withMissing[0].label}** (${withMissing[0].miss} nulls, ${(withMissing[0].miss / rows.length * 100).toFixed(0)}%).`);
    } else {
      findings.push(`All columns are **complete** — no missing values.`);
    }

    // Outliers (IQR method, total count)
    let totalOutliers = 0;
    for (const c of numCols) {
      const cs = Store.derive.colStats(rows, c.key);
      if (cs.q1 == null || cs.q3 == null) continue;
      const iqr = cs.q3 - cs.q1;
      totalOutliers += rows.filter((r) => {
        const v = r[c.key];
        return v != null && !isNaN(v) && (v < cs.q1 - 1.5 * iqr || v > cs.q3 + 1.5 * iqr);
      }).length;
    }
    if (totalOutliers > 0) {
      findings.push(`**${totalOutliers}** outlier value(s) detected across numeric columns (IQR ±1.5). Review in **Clean** mode.`);
    }

    // Skewness flags
    if (SM.skewness) {
      for (const c of numCols.slice(0, 6)) {
        const vals = rows.map((r) => r[c.key]);
        const sk = SM.skewness(vals);
        if (sk != null && Math.abs(sk) > 1.5) {
          findings.push(`**${c.label}** is strongly ${sk > 0 ? "right" : "left"}-skewed (γ₁ = ${sk.toFixed(2)}) — log-transform may help before regression.`);
        }
      }
    }

    // Strongest correlation among first 6 numeric columns
    if (numCols.length >= 2) {
      let bestR = 0, bestPair = null;
      const slice = numCols.slice(0, 6);
      for (let i = 0; i < slice.length; i++) {
        for (let j = i + 1; j < slice.length; j++) {
          const r = stat.pearson(rows.map((r2) => r2[slice[i].key]), rows.map((r2) => r2[slice[j].key]));
          if (r != null && Math.abs(r) > Math.abs(bestR)) { bestR = r; bestPair = [slice[i].label, slice[j].label]; }
        }
      }
      if (bestPair && Math.abs(bestR) > 0.35) {
        findings.push(`Strongest linear relationship: **${bestPair[0]}** ↔ **${bestPair[1]}** (r = ${bestR.toFixed(2)}, ${Math.abs(bestR) > 0.7 ? "strong" : "moderate"} correlation).`);
      }
    }

    return findings;
  }

  function summarizeCorrelation(result) {
    const { cols, matrix } = result;
    if (!cols || !matrix) return "Correlation analysis complete.";
    let bestR = 0, bestPair = null;
    matrix.forEach((row, i) => row.forEach((r, j) => {
      if (i < j && r != null && Math.abs(r) > Math.abs(bestR)) { bestR = r; bestPair = [cols[i].label, cols[j].label]; }
    }));
    const strongCount = matrix.reduce((tot, row, i) => tot + row.filter((r, j) => i < j && r != null && Math.abs(r) > 0.5).length, 0);
    let s = `Correlation matrix across **${cols.length} variables**.`;
    if (bestPair) s += ` Strongest pair: **${bestPair[0]} ↔ ${bestPair[1]}** (r = ${bestR.toFixed(2)}).`;
    if (strongCount > 0) s += ` **${strongCount}** pair(s) show moderate-to-strong correlation (|r| > 0.5).`;
    else s += ` No pairs exceed |r| = 0.5 — variables are largely independent.`;
    return s;
  }

  function summarizeRegression(result) {
    if (!result) return "";
    const { r2, adj, terms, target, pF } = result;
    const qual = r2 > 0.8 ? "excellent" : r2 > 0.6 ? "good" : r2 > 0.4 ? "moderate" : "weak";
    const sigTerms = (terms || []).filter((t) => t.name !== "(Intercept)" && t.p < 0.05).map((t) => t.name);
    let s = `Model explains **${(r2 * 100).toFixed(1)}%** of variance in **${target}** — ${qual} fit (adj. R² = ${adj.toFixed(3)}).`;
    if (sigTerms.length) s += ` Significant predictors: **${sigTerms.join(", ")}**.`;
    else s += ` No individual predictor reaches significance at α = 0.05.`;
    if (pF < 0.05) s += ` The overall model is statistically significant (p ${pF < 0.0001 ? "< .0001" : "= " + pF.toFixed(4)}).`;
    return s;
  }

  function summarizeClustering(result) {
    if (!result) return "";
    const { K, sizes, inertia } = result;
    const total = sizes.reduce((a, b) => a + b, 0);
    const maxShare = Math.max(...sizes) / total;
    let s = `KMeans partitioned **${total} points** into **${K} clusters** (inertia = ${inertia.toLocaleString()}).`;
    s += ` Sizes: ${sizes.map((n, i) => `C${i + 1}=${n}`).join(", ")}.`;
    if (maxShare > 0.6) s += ` Distribution is **imbalanced** — try K+1 or verify data scaling.`;
    else s += ` Cluster sizes are **relatively balanced**.`;
    return s;
  }

  function summarizeClassification(result) {
    if (!result) return "";
    const { acc, classes, cm, k } = result;
    const qual = acc > 0.9 ? "excellent" : acc > 0.75 ? "good" : acc > 0.6 ? "fair" : "poor";
    let s = `k-NN (k=${k}) achieved **${(acc * 100).toFixed(1)}% accuracy** — ${qual} performance on the test set.`;
    if (classes && classes.length <= 5) {
      const perClass = classes.map((cl, i) => {
        const tp = cm[i][i];
        const fp = cm.reduce((sum, row, ri) => ri !== i ? sum + row[i] : sum, 0);
        const fn = cm[i].reduce((sum, v, j) => j !== i ? sum + v : sum, 0);
        const prec = tp / (tp + fp) || 0;
        const rec = tp / (tp + fn) || 0;
        return `${cl}: P=${(prec * 100).toFixed(0)}%/R=${(rec * 100).toFixed(0)}%`;
      });
      s += ` Per-class: ${perClass.join(", ")}.`;
    }
    return s;
  }

  function recommendNextStep(context) {
    const { lastTest } = context;
    if (lastTest === "corr") return { icon: "scatter", text: "Run **Regression** to model the strongest correlated pairs, or use **Analysis Builder** for an automated end-to-end analysis." };
    if (lastTest === "reg") {
      const r2 = context.lastResult && context.lastResult.r2;
      if (r2 != null && r2 < 0.5) return { icon: "clean", text: "R² is below 0.5 — check **outliers** in Clean mode or add interaction terms. Consider checking variable distributions first." };
      return { icon: "ml", text: "Regression fit is solid — switch to **ML Studio** for out-of-sample RMSE and k-NN / KMeans exploration." };
    }
    if (lastTest === "ttest" || lastTest === "anova") return { icon: "scatter", text: "Group means differ — confirm with **Regression** using control variables, or visualize distributions in the **Distribution** tab." };
    if (lastTest === "distribution") return { icon: "clean", text: "Review skewness and outliers — visit **Clean Studio** to apply IQR removal or transforms before modeling." };
    if (lastTest === "builder") return { icon: "ml", text: "Analysis complete — move to **ML Studio** to evaluate predictive performance on a held-out test set." };
    return { icon: "stats", text: "Run **Correlation** first to identify which variables are most related, then build a targeted regression or ANOVA." };
  }

  window.IE = { profileDataset, summarizeCorrelation, summarizeRegression, summarizeClustering, summarizeClassification, recommendNextStep };
})();
