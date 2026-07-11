/* insight Analytics — multivariate outlier detection via Mahalanobis distance (window.Outliers).
   Self-contained & deterministic (no external deps) so it runs in the browser AND Node tests.
   A point is flagged when its squared Mahalanobis distance exceeds a chi-square cutoff
   (df = #dimensions), approximated with Wilson-Hilferty. Degrades cleanly on singular covariance. */
(function () {
  "use strict";

  const isNum = (v) => v != null && v !== "" && !isNaN(v);

  // Standard-normal quantile (Acklam's rational approximation). p in (0,1).
  function normInv(p) {
    if (p <= 0) return -Infinity;
    if (p >= 1) return Infinity;
    const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
    const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
    const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
    const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
    const pl = 0.02425;
    let q, r;
    if (p < pl) { q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    if (p > 1 - pl) { q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    q = p - 0.5; r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }

  // Chi-square quantile via Wilson-Hilferty (df = k, probability p).
  function chiSquareQuantile(p, k) {
    const z = normInv(p);
    const t = 1 - 2 / (9 * k) + z * Math.sqrt(2 / (9 * k));
    return k * t * t * t;
  }

  // Gauss-Jordan inverse with partial pivoting. Returns null if (near-)singular.
  function inverse(M) {
    const n = M.length;
    const A = M.map((row, i) => row.concat(row.map((_, j) => (i === j ? 1 : 0))));
    for (let c = 0; c < n; c++) {
      let p = c;
      for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
      if (Math.abs(A[p][c]) < 1e-12) return null; // singular
      [A[c], A[p]] = [A[p], A[c]];
      const piv = A[c][c];
      for (let kk = 0; kk < 2 * n; kk++) A[c][kk] /= piv;
      for (let r = 0; r < n; r++) if (r !== c) { const f = A[r][c]; for (let kk = 0; kk < 2 * n; kk++) A[r][kk] -= f * A[c][kk]; }
    }
    return A.map((row) => row.slice(n));
  }

  // detect(rows, keys, { alpha=0.975, topK, standardizeNothing }) → outlier report.
  function detect(rows, keys, options) {
    options = options || {};
    const alpha = options.alpha == null ? 0.975 : options.alpha;
    keys = keys || [];
    const d = keys.length;
    if (d < 2) throw new Error("Multivariate outliers need at least 2 numeric columns");

    // keep only complete rows; remember original indices
    const data = [], sourceIndex = [];
    (rows || []).forEach((r, i) => {
      if (keys.every((k) => isNum(r[k]))) { data.push(keys.map((k) => Number(r[k]))); sourceIndex.push(i); }
    });
    const n = data.length;
    if (n <= d) return { ok: false, reason: "not enough complete rows for the number of dimensions", n, d, outliers: [] };

    // mean + sample covariance
    const mean = new Array(d).fill(0);
    for (const row of data) for (let j = 0; j < d; j++) mean[j] += row[j];
    for (let j = 0; j < d; j++) mean[j] /= n;
    const cov = Array.from({ length: d }, () => new Array(d).fill(0));
    for (const row of data) for (let a = 0; a < d; a++) for (let b = 0; b < d; b++) cov[a][b] += (row[a] - mean[a]) * (row[b] - mean[b]);
    for (let a = 0; a < d; a++) for (let b = 0; b < d; b++) cov[a][b] /= (n - 1);

    const inv = inverse(cov);
    if (!inv) return { ok: false, reason: "singular covariance (constant or collinear columns)", n, d, outliers: [] };

    const threshold = chiSquareQuantile(alpha, d); // cutoff on squared distance
    const results = data.map((row, i) => {
      const dev = row.map((v, j) => v - mean[j]);
      let d2 = 0;
      for (let a = 0; a < d; a++) { let s = 0; for (let b = 0; b < d; b++) s += inv[a][b] * dev[b]; d2 += dev[a] * s; }
      return { index: sourceIndex[i], d2, distance: Math.sqrt(Math.max(0, d2)), outlier: d2 > threshold };
    });

    let outliers = results.filter((r) => r.outlier).map((r) => r.index);
    if (options.topK != null) {
      outliers = results.slice().sort((a, b) => b.d2 - a.d2).slice(0, options.topK).map((r) => r.index);
    }

    return { ok: true, keys, n, d, alpha, threshold, mean, results, outliers };
  }

  const api = { detect, normInv, chiSquareQuantile, inverse };
  if (typeof window !== "undefined") window.Outliers = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
