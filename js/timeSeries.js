(function () {
  "use strict";

  // ---- helpers -------------------------------------------------------------

  function toNum(v) {
    // treat null/undefined/NaN as missing
    if (v === null || v === undefined) return null;
    var n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function assert(cond, msg) {
    if (!cond) throw new Error(msg);
  }

  function isArray(a) {
    return Array.isArray(a);
  }

  // mean of finite entries only
  function meanFinite(arr) {
    var s = 0, c = 0;
    for (var i = 0; i < arr.length; i++) {
      var v = arr[i];
      if (v !== null && v !== undefined && Number.isFinite(v)) {
        s += v;
        c += 1;
      }
    }
    return c === 0 ? null : s / c;
  }

  // ---- moving average ------------------------------------------------------

  function movingAverage(values, window) {
    assert(isArray(values), "movingAverage: values must be an array");
    assert(Number.isInteger(window) && window >= 1, "movingAverage: window must be an integer >= 1");
    var n = values.length;
    var out = new Array(n);
    for (var i = 0; i < n; i++) {
      if (i < window - 1) {
        out[i] = null;
        continue;
      }
      var sum = 0, cnt = 0, missing = false;
      for (var j = i - window + 1; j <= i; j++) {
        var v = toNum(values[j]);
        if (v === null) {
          missing = true;
          break;
        }
        sum += v;
        cnt += 1;
      }
      out[i] = missing ? null : sum / cnt;
    }
    return out;
  }

  // ---- weighted moving average --------------------------------------------

  function weightedMovingAverage(values, weights) {
    assert(isArray(values), "weightedMovingAverage: values must be an array");
    assert(isArray(weights) && weights.length >= 1, "weightedMovingAverage: weights must be a non-empty array");
    var W = weights.length;
    var wsum = 0;
    for (var k = 0; k < W; k++) {
      var wk = Number(weights[k]);
      assert(Number.isFinite(wk), "weightedMovingAverage: weights must be finite numbers");
      wsum += wk;
    }
    assert(wsum !== 0, "weightedMovingAverage: weights must not sum to zero");
    var n = values.length;
    var out = new Array(n);
    for (var i = 0; i < n; i++) {
      if (i < W - 1) {
        out[i] = null;
        continue;
      }
      // weights applied to last W points: weights[0] -> oldest, weights[W-1] -> newest (values[i])
      var acc = 0, missing = false;
      for (var m = 0; m < W; m++) {
        var idx = i - (W - 1) + m;
        var v = toNum(values[idx]);
        if (v === null) {
          missing = true;
          break;
        }
        acc += v * Number(weights[m]);
      }
      out[i] = missing ? null : acc / wsum;
    }
    return out;
  }

  // ---- exponential smoothing ----------------------------------------------

  function exponentialSmoothing(values, alpha) {
    assert(isArray(values), "exponentialSmoothing: values must be an array");
    assert(typeof alpha === "number" && Number.isFinite(alpha) && alpha > 0 && alpha <= 1,
      "exponentialSmoothing: alpha must satisfy 0 < alpha <= 1");
    var n = values.length;
    var out = new Array(n);
    if (n === 0) return out;
    var prev = toNum(values[0]);
    out[0] = prev; // s[0] = values[0]
    for (var i = 1; i < n; i++) {
      var v = toNum(values[i]);
      if (prev === null) {
        // no previous level established; seed with current value
        prev = v;
        out[i] = v;
        continue;
      }
      if (v === null) {
        // carry the level forward when observation missing
        out[i] = prev;
        continue;
      }
      var s = alpha * v + (1 - alpha) * prev;
      out[i] = s;
      prev = s;
    }
    return out;
  }

  // ---- Holt's linear (double exponential) ---------------------------------

  function doubleExponential(values, alpha, beta) {
    assert(isArray(values), "doubleExponential: values must be an array");
    assert(typeof alpha === "number" && Number.isFinite(alpha) && alpha > 0 && alpha <= 1,
      "doubleExponential: alpha must satisfy 0 < alpha <= 1");
    assert(typeof beta === "number" && Number.isFinite(beta) && beta >= 0 && beta <= 1,
      "doubleExponential: beta must satisfy 0 <= beta <= 1");
    var n = values.length;
    var level = new Array(n);
    var trend = new Array(n);
    var fitted = new Array(n);
    if (n === 0) return { level: level, trend: trend, fitted: fitted };

    var v0 = toNum(values[0]);
    var l = v0;
    var b = 0;
    if (n >= 2) {
      var v1 = toNum(values[1]);
      if (v0 !== null && v1 !== null) b = v1 - v0;
    }
    level[0] = l;
    trend[0] = b;
    fitted[0] = l; // no one-step-ahead forecast for first point; use level

    for (var i = 1; i < n; i++) {
      var prevL = l;
      var prevB = b;
      // one-step-ahead forecast made at i-1 for time i
      fitted[i] = (prevL === null || prevB === null) ? null : prevL + prevB;
      var v = toNum(values[i]);
      if (v === null || prevL === null) {
        // propagate without update
        l = (prevL === null || prevB === null) ? prevL : prevL + prevB;
        b = prevB;
      } else {
        l = alpha * v + (1 - alpha) * (prevL + prevB);
        b = beta * (l - prevL) + (1 - beta) * prevB;
      }
      level[i] = l;
      trend[i] = b;
    }
    return { level: level, trend: trend, fitted: fitted };
  }

  // ---- differencing --------------------------------------------------------

  function diff(values, lag) {
    assert(isArray(values), "diff: values must be an array");
    if (lag === undefined) lag = 1;
    assert(Number.isInteger(lag) && lag >= 1, "diff: lag must be an integer >= 1");
    var n = values.length;
    var out = new Array(n);
    for (var i = 0; i < n; i++) {
      if (i < lag) {
        out[i] = null;
        continue;
      }
      var a = toNum(values[i]);
      var b = toNum(values[i - lag]);
      out[i] = (a === null || b === null) ? null : a - b;
    }
    return out;
  }

  // ---- ACF -----------------------------------------------------------------

  // Uses biased autocovariance convention: divide by n (not n-k), then normalize by variance.
  function acf(values, maxLag) {
    assert(isArray(values), "acf: values must be an array");
    assert(Number.isInteger(maxLag) && maxLag >= 0, "acf: maxLag must be an integer >= 0");
    // Keep values POSITIONAL — nulls stay in place (PLAN §12 E4).
    //
    // This used to COMPACT the series (push only finite values into a dense array), which shifted every
    // observation after a gap one slot earlier. A single missing point then destroyed the lag structure:
    // a clean quarterly series scored acf(lag4)=0.90, but with one missing month it collapsed to 0.79,
    // because "lag 4" no longer lined up with the same phase — exactly the seasonality ACF exists to
    // find. Fix: preserve positions and use PAIRWISE deletion — a lag-k term is included only when BOTH
    // x[t] and x[t-k] are present. When there are no gaps this reduces to the previous biased estimator
    // (denominator = finite count = n), so the no-gap results are unchanged.
    var xs = new Array(values.length);
    var nFinite = 0, sum = 0;
    for (var i = 0; i < values.length; i++) {
      var v = toNum(values[i]);
      xs[i] = v; // null preserved at its position
      if (v !== null) { nFinite++; sum += v; }
    }
    var out = new Array(maxLag + 1);
    if (nFinite === 0) {
      for (var q = 0; q <= maxLag; q++) out[q] = q === 0 ? 1 : null;
      return out;
    }
    var mean = sum / nFinite;

    var c0 = 0;
    for (var b = 0; b < xs.length; b++) {
      if (xs[b] === null) continue;
      var d = xs[b] - mean;
      c0 += d * d;
    }
    c0 /= nFinite;

    for (var k = 0; k <= maxLag; k++) {
      if (k === 0) { out[0] = 1; continue; }
      if (c0 === 0 || k >= xs.length) { out[k] = 0; continue; }
      var ck = 0;
      for (var t = k; t < xs.length; t++) {
        if (xs[t] === null || xs[t - k] === null) continue; // pairwise deletion — no shifting
        ck += (xs[t] - mean) * (xs[t - k] - mean);
      }
      ck /= nFinite;
      out[k] = ck / c0;
    }
    return out;
  }

  // ---- PACF via Durbin-Levinson -------------------------------------------

  function pacf(values, maxLag) {
    assert(isArray(values), "pacf: values must be an array");
    assert(Number.isInteger(maxLag) && maxLag >= 0, "pacf: maxLag must be an integer >= 0");
    var r = acf(values, maxLag); // r[0..maxLag], r[0] = 1
    var out = new Array(maxLag + 1);
    out[0] = 1;
    if (maxLag === 0) return out;

    // Durbin-Levinson recursion
    var phi = [];       // phi[k] current AR coefficients (1-indexed conceptually)
    var phiPrev = [];
    var v = 1; // normalized

    // k = 1
    var phi11 = (r[1] === null) ? 0 : r[1];
    out[1] = phi11;
    phiPrev = [phi11];
    v = 1 - phi11 * phi11;

    for (var k = 2; k <= maxLag; k++) {
      if (r[k] === null) {
        out[k] = 0;
        // still advance with zero
        var numZ = 0;
        // treat r[k] as 0
        var acc0 = 0;
        for (var j0 = 1; j0 <= k - 1; j0++) {
          acc0 += phiPrev[j0 - 1] * (r[k - j0] === null ? 0 : r[k - j0]);
        }
        var phikkZ = v === 0 ? 0 : (0 - acc0) / v;
        var newPhiZ = new Array(k);
        for (var iZ = 1; iZ <= k - 1; iZ++) {
          newPhiZ[iZ - 1] = phiPrev[iZ - 1] - phikkZ * phiPrev[k - 1 - iZ];
        }
        newPhiZ[k - 1] = phikkZ;
        phiPrev = newPhiZ;
        v = v * (1 - phikkZ * phikkZ);
        out[k] = phikkZ;
        continue;
      }
      var acc = 0;
      for (var j = 1; j <= k - 1; j++) {
        var rj = r[k - j] === null ? 0 : r[k - j];
        acc += phiPrev[j - 1] * rj;
      }
      var phikk = v === 0 ? 0 : (r[k] - acc) / v;
      var newPhi = new Array(k);
      for (var idx = 1; idx <= k - 1; idx++) {
        newPhi[idx - 1] = phiPrev[idx - 1] - phikk * phiPrev[k - 1 - idx];
      }
      newPhi[k - 1] = phikk;
      phiPrev = newPhi;
      v = v * (1 - phikk * phikk);
      out[k] = phikk;
    }
    return out;
  }

  // ---- rolling sample std (ddof=1) ----------------------------------------

  function rollingStd(values, window) {
    assert(isArray(values), "rollingStd: values must be an array");
    assert(Number.isInteger(window) && window >= 2, "rollingStd: window must be an integer >= 2 (sample std needs >=2)");
    var n = values.length;
    var out = new Array(n);
    for (var i = 0; i < n; i++) {
      if (i < window - 1) {
        out[i] = null;
        continue;
      }
      var win = [];
      var missing = false;
      for (var j = i - window + 1; j <= i; j++) {
        var v = toNum(values[j]);
        if (v === null) {
          missing = true;
          break;
        }
        win.push(v);
      }
      if (missing || win.length < 2) {
        out[i] = null;
        continue;
      }
      var m = 0;
      for (var a = 0; a < win.length; a++) m += win[a];
      m /= win.length;
      var ss = 0;
      for (var b = 0; b < win.length; b++) {
        var dd = win[b] - m;
        ss += dd * dd;
      }
      out[i] = Math.sqrt(ss / (win.length - 1));
    }
    return out;
  }

  // ---- export --------------------------------------------------------------

  const api = {
    movingAverage: movingAverage,
    weightedMovingAverage: weightedMovingAverage,
    exponentialSmoothing: exponentialSmoothing,
    doubleExponential: doubleExponential,
    diff: diff,
    acf: acf,
    pacf: pacf,
    rollingStd: rollingStd
  };

  if (typeof window !== "undefined") window.TimeSeries = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
