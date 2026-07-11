/*
 * distributionFit.js — pure-JS distribution-fit / QQ-plot / normality engine.
 * No-build, browser-first. Pure & deterministic (no Date.now / Math.random).
 * Exposes window.DistFit (and module.exports under Node).
 */
(function () {
  "use strict";

  // --- helpers -------------------------------------------------------------

  // Keep only finite numbers (drops null, "", NaN, Infinity, non-numbers).
  function clean(values) {
    var out = [];
    if (!values) return out;
    for (var i = 0; i < values.length; i++) {
      var v = values[i];
      if (v === null || v === "" || v === undefined) continue;
      var n = typeof v === "number" ? v : Number(v);
      if (typeof n === "number" && isFinite(n)) out.push(n);
    }
    return out;
  }

  function mean(a) {
    if (!a.length) return NaN;
    var s = 0;
    for (var i = 0; i < a.length; i++) s += a[i];
    return s / a.length;
  }

  // Sample standard deviation (ddof = 1). Returns 0 when n < 2.
  function stdDev(a, mu) {
    var n = a.length;
    if (n < 2) return 0;
    if (mu === undefined) mu = mean(a);
    var s = 0;
    for (var i = 0; i < n; i++) {
      var d = a[i] - mu;
      s += d * d;
    }
    return Math.sqrt(s / (n - 1));
  }

  // --- normInv: inverse standard normal CDF (Acklam's algorithm) -----------
  // Accurate to ~1.15e-9 over (0,1). Domain (0,1); returns +/-Infinity at edges.
  function normInv(p) {
    p = Number(p);
    if (!(p > 0 && p < 1)) {
      if (p === 0) return -Infinity;
      if (p === 1) return Infinity;
      return NaN;
    }

    // Coefficients for the rational approximations.
    var a = [
      -3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02,
       1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00
    ];
    var b = [
      -5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02,
       6.680131188771972e+01, -1.328068155288572e+01
    ];
    var c = [
      -7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00,
      -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00
    ];
    var d = [
       7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00,
       3.754408661907416e+00
    ];

    var pLow = 0.02425;
    var pHigh = 1 - pLow;
    var q, r, x;

    if (p < pLow) {
      // Lower tail.
      q = Math.sqrt(-2 * Math.log(p));
      x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
          ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    } else if (p <= pHigh) {
      // Central region.
      q = p - 0.5;
      r = q * q;
      x = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
          (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
    } else {
      // Upper tail.
      q = Math.sqrt(-2 * Math.log(1 - p));
      x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
           ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }

    // Acklam's rational approximation alone is accurate to ~1.15e-9 over (0,1);
    // no Newton/Halley refinement needed (and refining with an approximate erf
    // would only add noise, e.g. at p=0.5 where the exact answer is 0).
    return x;
  }

  // --- normCdf: standard normal CDF via erf (Abramowitz-Stegun 7.1.26) ------
  function erf(x) {
    // Numerical Recipes-style rational approx; ~1.2e-7 max error.
    var sign = x < 0 ? -1 : 1;
    var ax = Math.abs(x);
    var t = 1 / (1 + 0.3275911 * ax);
    var y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t -
      0.284496736) * t + 0.254829592) * t * Math.exp(-ax * ax);
    return sign * y;
  }

  function normCdf(z) {
    z = Number(z);
    return 0.5 * (1 + erf(z / Math.SQRT2));
  }

  // --- qqNormal ------------------------------------------------------------
  // points: sorted ascending by sample; theoretical = normInv((i-0.5)/n).
  // line: fitted reference y = mean + std*theoretical => {slope:std, intercept:mean}.
  function qqNormal(values) {
    var a = clean(values).slice().sort(function (x, y) { return x - y; });
    var n = a.length;
    var mu = mean(a);
    var sd = stdDev(a, mu);
    var points = [];
    for (var i = 0; i < n; i++) {
      var p = (i + 1 - 0.5) / n; // i is 0-based; formula uses 1-based (i-0.5)/n
      points.push({ theoretical: normInv(p), sample: a[i] });
    }
    return { points: points, line: { slope: sd, intercept: mu } };
  }

  // --- normalFit -----------------------------------------------------------
  function normalPdf(x, mu, sd) {
    if (sd <= 0) return 0;
    var z = (x - mu) / sd;
    return Math.exp(-0.5 * z * z) / (sd * Math.sqrt(2 * Math.PI));
  }

  function normalFit(values, steps) {
    var a = clean(values);
    var n = a.length;
    if (steps === undefined) steps = 60;
    var mu = mean(a);
    var sd = stdDev(a, mu);
    var mn = n ? Math.min.apply(null, a) : NaN;
    var mx = n ? Math.max.apply(null, a) : NaN;

    var pdf = [];
    if (n && isFinite(mn) && isFinite(mx)) {
      var span = mx - mn;
      if (span === 0) {
        pdf.push({ x: mn, y: normalPdf(mn, mu, sd) });
      } else {
        for (var i = 0; i <= steps; i++) {
          var x = mn + (span * i) / steps;
          pdf.push({ x: x, y: normalPdf(x, mu, sd) });
        }
      }
    }

    return { mean: mu, std: sd, min: mn, max: mx, pdf: pdf };
  }

  // --- jarqueBera ----------------------------------------------------------
  // Uses population moments (divide by n) for skewness/kurtosis, excess kurt.
  // JB = n/6 * (S^2 + (K-3)^2/4). Approx p-value via chi-square df=2.
  function jarqueBera(values) {
    var a = clean(values);
    var n = a.length;
    // The JB test is undefined for tiny samples; report nulls rather than a false "normal" (pValue 1).
    if (n < 4) return { statistic: null, skewness: null, kurtosis: null, excessKurtosis: null, pValue: null, n: n };
    var mu = mean(a);

    var m2 = 0, m3 = 0, m4 = 0;
    for (var i = 0; i < n; i++) {
      var d = a[i] - mu;
      var d2 = d * d;
      m2 += d2;
      m3 += d2 * d;
      m4 += d2 * d2;
    }
    m2 /= n; m3 /= n; m4 /= n;

    var s = m2 > 0 ? m3 / Math.pow(m2, 1.5) : 0;      // skewness
    var k = m2 > 0 ? m4 / (m2 * m2) : 0;              // kurtosis (non-excess)
    var excess = k - 3;
    var jb = (n / 6) * (s * s + (excess * excess) / 4);

    // chi-square df=2 survival function is exp(-x/2); gives an easy p-value.
    var pValue = isFinite(jb) ? Math.exp(-jb / 2) : NaN;

    return { statistic: jb, skewness: s, kurtosis: k, excessKurtosis: excess, pValue: pValue, n: n };
  }

  // --- histogram -----------------------------------------------------------
  function histogram(values, bins) {
    var a = clean(values);
    var n = a.length;
    if (bins === undefined || !(bins > 0)) bins = 20;
    bins = Math.floor(bins);

    if (!n) return { bins: [], max: 0 };

    var mn = Math.min.apply(null, a);
    var mx = Math.max.apply(null, a);

    var result = [];
    var maxCount = 0;

    if (mn === mx) {
      // Degenerate range: single bin holding everything.
      result.push({ x0: mn, x1: mx, count: n });
      return { bins: result, max: n };
    }

    var width = (mx - mn) / bins;
    var counts = new Array(bins);
    for (var b = 0; b < bins; b++) counts[b] = 0;

    for (var i = 0; i < n; i++) {
      var idx = Math.floor((a[i] - mn) / width);
      if (idx >= bins) idx = bins - 1; // include the max value in the last bin
      if (idx < 0) idx = 0;
      counts[idx]++;
    }

    for (var j = 0; j < bins; j++) {
      var x0 = mn + j * width;
      var x1 = j === bins - 1 ? mx : mn + (j + 1) * width;
      if (counts[j] > maxCount) maxCount = counts[j];
      result.push({ x0: x0, x1: x1, count: counts[j] });
    }

    return { bins: result, max: maxCount };
  }

  // --- parametric fits with AIC (for "which distribution fits best?") -------
  var LN2PI = Math.log(2 * Math.PI);

  function normalLogLik(values) {
    var a = clean(values), n = a.length;
    if (n < 2) return null;
    var mu = mean(a), sd = stdDev(a, mu);
    if (!(sd > 0)) return null;
    var ll = 0;
    for (var i = 0; i < n; i++) { var d = a[i] - mu; ll += -0.5 * LN2PI - Math.log(sd) - (d * d) / (2 * sd * sd); }
    return { dist: "normal", params: { mean: mu, std: sd }, logLik: ll, k: 2, n: n, aic: 2 * 2 - 2 * ll };
  }

  // Exponential MLE: rate = 1/mean (requires strictly positive data).
  function exponentialFit(values) {
    var a = clean(values), n = a.length;
    if (n < 2) return { ok: false, reason: "need >= 2 values" };
    if (a.some(function (v) { return v <= 0; })) return { ok: false, reason: "exponential needs strictly positive values" };
    var mu = mean(a), rate = 1 / mu, sum = a.reduce(function (s, v) { return s + v; }, 0);
    var ll = n * Math.log(rate) - rate * sum;
    return { ok: true, dist: "exponential", params: { rate: rate, mean: mu }, logLik: ll, k: 1, n: n, aic: 2 * 1 - 2 * ll };
  }

  // Lognormal MLE: fit a normal to ln(x) (requires strictly positive data).
  function lognormalFit(values) {
    var a = clean(values), n = a.length;
    if (n < 2) return { ok: false, reason: "need >= 2 values" };
    if (a.some(function (v) { return v <= 0; })) return { ok: false, reason: "lognormal needs strictly positive values" };
    var logs = a.map(function (v) { return Math.log(v); });
    var mu = mean(logs), sd = stdDev(logs, mu);
    if (!(sd > 0)) return { ok: false, reason: "zero variance in log-space" };
    var ll = 0;
    for (var i = 0; i < n; i++) { var d = logs[i] - mu; ll += -Math.log(a[i]) - Math.log(sd) - 0.5 * LN2PI - (d * d) / (2 * sd * sd); }
    return { ok: true, dist: "lognormal", params: { logMean: mu, logStd: sd }, logLik: ll, k: 2, n: n, aic: 2 * 2 - 2 * ll };
  }

  // Rank candidate distributions by AIC (lower is better). Skips fits that don't apply.
  function compareFits(values) {
    var candidates = [];
    var nrm = normalLogLik(values); if (nrm) candidates.push(nrm);
    var exp = exponentialFit(values); if (exp.ok) candidates.push({ dist: exp.dist, params: exp.params, logLik: exp.logLik, k: exp.k, n: exp.n, aic: exp.aic });
    var lnm = lognormalFit(values); if (lnm.ok) candidates.push({ dist: lnm.dist, params: lnm.params, logLik: lnm.logLik, k: lnm.k, n: lnm.n, aic: lnm.aic });
    candidates.sort(function (x, y) { return x.aic - y.aic; });
    return { fits: candidates, best: candidates[0] ? candidates[0].dist : null };
  }

  // --- exports -------------------------------------------------------------
  var api = {
    normInv: normInv,
    normCdf: normCdf,
    exponentialFit: exponentialFit,
    lognormalFit: lognormalFit,
    compareFits: compareFits,
    erf: erf,
    qqNormal: qqNormal,
    normalFit: normalFit,
    jarqueBera: jarqueBera,
    histogram: histogram,
    _clean: clean,
    _mean: mean,
    _stdDev: stdDev
  };

  if (typeof window !== "undefined") window.DistFit = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
