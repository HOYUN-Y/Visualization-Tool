/* NØDE/Insight — statistics math: incomplete gamma/beta, p-values, matrix inverse */
(function () {
  function gammln(xx) {
    const cof = [76.18009172947146, -86.50532032941677, 24.01409824083091,
      -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
    let x = xx, y = xx, tmp = x + 5.5; tmp -= (x + 0.5) * Math.log(tmp);
    let ser = 1.000000000190015;
    for (let j = 0; j < 6; j++) { y++; ser += cof[j] / y; }
    return -tmp + Math.log(2.5066282746310005 * ser / x);
  }
  function gser(a, x) {
    if (x <= 0) return 0;
    let ap = a, sum = 1 / a, del = sum;
    for (let n = 0; n < 200; n++) { ap++; del *= x / ap; sum += del; if (Math.abs(del) < Math.abs(sum) * 1e-12) break; }
    return sum * Math.exp(-x + a * Math.log(x) - gammln(a));
  }
  function gcf(a, x) {
    const FPMIN = 1e-300; let b = x + 1 - a, c = 1 / FPMIN, d = 1 / b, h = d;
    for (let i = 1; i <= 200; i++) {
      const an = -i * (i - a); b += 2; d = an * d + b; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = b + an / c; if (Math.abs(c) < FPMIN) c = FPMIN; d = 1 / d; const del = d * c; h *= del;
      if (Math.abs(del - 1) < 1e-12) break;
    }
    return Math.exp(-x + a * Math.log(x) - gammln(a)) * h;
  }
  const gammp = (a, x) => x < a + 1 ? gser(a, x) : 1 - gcf(a, x);   // lower regularized
  const gammq = (a, x) => x < a + 1 ? 1 - gser(a, x) : gcf(a, x);   // upper regularized

  function betacf(a, b, x) {
    const FPMIN = 1e-300; let qab = a + b, qap = a + 1, qam = a - 1;
    let c = 1, d = 1 - qab * x / qap; if (Math.abs(d) < FPMIN) d = FPMIN; d = 1 / d; let h = d;
    for (let m = 1; m <= 200; m++) {
      const m2 = 2 * m;
      let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN; c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN; d = 1 / d; h *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN; c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN; d = 1 / d;
      const del = d * c; h *= del; if (Math.abs(del - 1) < 1e-12) break;
    }
    return h;
  }
  function betai(a, b, x) {
    if (x <= 0) return 0; if (x >= 1) return 1;
    const bt = Math.exp(gammln(a + b) - gammln(a) - gammln(b) + a * Math.log(x) + b * Math.log(1 - x));
    return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b;
  }

  // two-tailed p for Student t
  function tP(t, df) { if (!isFinite(t)) return 0; return betai(df / 2, 0.5, df / (df + t * t)); }
  // upper-tail p for F
  function fP(F, d1, d2) { if (F <= 0) return 1; return betai(d2 / 2, d1 / 2, d2 / (d2 + d1 * F)); }
  // upper-tail p for chi-square
  function chiP(x, df) { if (x <= 0) return 1; return gammq(df / 2, x / 2); }

  // Gauss-Jordan inverse with partial pivoting. Returns **null** when M is singular (or numerically
  // indistinguishable from it) — same convention as inverse() in js/outliers.js.
  //
  // WHY NULL, AND NOT A FUDGED PIVOT. This used to read `const piv = A[c][c] || 1e-9;`: a zero pivot was
  // silently replaced with 1e-9 and the routine returned a huge-but-finite garbage inverse that no caller
  // could distinguish from a real one. regression() (statsMode.jsx) feeds (XtX)^-1 straight into the
  // standard errors, so exact collinearity produced se ≈ 1e7, t ≈ 0, p ≈ 1 — i.e. a confident
  // "this predictor is not significant" about a predictor the model cannot identify at all. That is a
  // wrong answer presented as a real one, which is worse than an error message.
  //
  // Reachable, not theoretical: Clean's `dummy_encode` emits a column for EVERY level (store.jsx:233,
  // no drop-first) and regression prepends an intercept (statsMode.jsx:88). Dummy-encode a category,
  // regress on all its levels, and XtX is exactly singular — the classic dummy variable trap.
  //
  // The threshold is RELATIVE to the matrix scale. XtX entries here can reach ~1e13 (won prices squared,
  // summed over rows), where an absolute cutoff like 1e-12 would never fire; on a small-scale matrix the
  // same cutoff would reject a healthy pivot. So we scale by the largest |element| of the input.
  const SINGULAR_REL_EPS = 1e-12;
  function matInverse(M) {
    const n = M.length; const A = M.map((r, i) => [...r, ...r.map((_, j) => (i === j ? 1 : 0))]);
    let scale = 0;
    for (const row of M) for (const v of row) { const a = Math.abs(v); if (a > scale) scale = a; }
    const eps = SINGULAR_REL_EPS * (scale || 1);
    for (let c = 0; c < n; c++) {
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
      if (!(Math.abs(A[p][c]) > eps)) return null; // singular — no pivot survives elimination (NaN-safe)
      [A[c], A[p]] = [A[p], A[c]];
      const piv = A[c][c]; for (let k = 0; k < 2 * n; k++) A[c][k] /= piv;
      for (let r = 0; r < n; r++) if (r !== c) { const f = A[r][c]; for (let k = 0; k < 2 * n; k++) A[r][k] -= f * A[c][k]; }
    }
    return A.map((r) => r.slice(n));
  }

  function skewness(a) {
    const x = (Array.isArray(a) ? a : []).filter((v) => v != null && !isNaN(v)).map(Number);
    const n = x.length; if (n < 3) return null;
    const m = x.reduce((t, v) => t + v, 0) / n;
    const s = Math.sqrt(x.reduce((t, v) => t + (v - m) ** 2, 0) / (n - 1));
    if (s < 1e-12) return 0;
    return (n / ((n - 1) * (n - 2))) * x.reduce((t, v) => t + ((v - m) / s) ** 3, 0);
  }
  function kurtosis(a) {
    const x = (Array.isArray(a) ? a : []).filter((v) => v != null && !isNaN(v)).map(Number);
    const n = x.length; if (n < 4) return null;
    const m = x.reduce((t, v) => t + v, 0) / n;
    const s = Math.sqrt(x.reduce((t, v) => t + (v - m) ** 2, 0) / (n - 1));
    if (s < 1e-12) return 0;
    return (n * (n + 1) / ((n - 1) * (n - 2) * (n - 3))) * x.reduce((t, v) => t + ((v - m) / s) ** 4, 0)
      - 3 * (n - 1) ** 2 / ((n - 2) * (n - 3));
  }

  // Dual-mode export (the convention every other engine in js/ follows): `window.SM` for the browser,
  // `module.exports` so tests/statsMath.test.js can require() it under Node. This file feeds EVERY
  // p-value in the app (t/F/chi²) and was previously untestable purely because this line was missing.
  const api = { gammp, gammq, betai, tP, fP, chiP, matInverse, gammln, skewness, kurtosis };
  if (typeof window !== "undefined") window.SM = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
