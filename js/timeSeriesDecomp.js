/* insight Analytics — classical seasonal decomposition (window.TSDecomp).
   Deterministic, pure. Splits a series into trend + seasonal + residual via a
   centered moving-average trend and per-period seasonal indices.
   Additive:        y = trend + seasonal + residual
   Multiplicative:  y = trend * seasonal * residual  */
(function () {
  "use strict";

  const toNum = (v) => (v == null || v === "" || isNaN(v) ? null : Number(v));

  // Centered moving average of length = period. For even periods a 2×period MA is used
  // (average of two adjacent period-length windows) so the trend stays phase-centered.
  function centeredMA(y, period) {
    const n = y.length;
    const trend = new Array(n).fill(null);
    const half = Math.floor(period / 2);
    const even = period % 2 === 0;
    for (let i = 0; i < n; i++) {
      let sum = 0, ok = true;
      if (even) {
        // weights: 0.5 at the two ends, 1 in the middle, over [i-half, i+half]
        if (i - half < 0 || i + half > n - 1) { trend[i] = null; continue; }
        for (let j = -half; j <= half; j++) {
          const w = (j === -half || j === half) ? 0.5 : 1;
          const v = y[i + j];
          if (v == null) { ok = false; break; }
          sum += w * v;
        }
        trend[i] = ok ? sum / period : null;
      } else {
        if (i - half < 0 || i + half > n - 1) { trend[i] = null; continue; }
        for (let j = -half; j <= half; j++) {
          const v = y[i + j];
          if (v == null) { ok = false; break; }
          sum += v;
        }
        trend[i] = ok ? sum / period : null;
      }
    }
    return trend;
  }

  // spec: decompose(values, { period, model }) — model "additive" | "multiplicative"
  function decompose(values, options) {
    options = options || {};
    const period = options.period | 0;
    const model = options.model === "multiplicative" ? "multiplicative" : "additive";
    if (period < 2) throw new Error("Seasonal decomposition needs period >= 2");
    const y = (values || []).map(toNum);
    const n = y.length;
    if (n < period * 2) throw new Error("Seasonal decomposition needs at least 2 full periods of data");

    const trend = centeredMA(y, period);

    // detrended = y - trend (additive) or y / trend (multiplicative)
    const detr = y.map((v, i) => {
      if (v == null || trend[i] == null) return null;
      if (model === "multiplicative") return trend[i] === 0 ? null : v / trend[i];
      return v - trend[i];
    });

    // average detrended value per season position (i mod period)
    const seasonSum = new Array(period).fill(0);
    const seasonCnt = new Array(period).fill(0);
    for (let i = 0; i < n; i++) {
      if (detr[i] == null) continue;
      const s = i % period;
      seasonSum[s] += detr[i]; seasonCnt[s] += 1;
    }
    let seasonAvg = seasonSum.map((s, k) => (seasonCnt[k] ? s / seasonCnt[k] : (model === "multiplicative" ? 1 : 0)));

    // normalize: additive → indices sum to 0; multiplicative → indices average to 1
    if (model === "multiplicative") {
      const mean = seasonAvg.reduce((a, b) => a + b, 0) / period;
      seasonAvg = seasonAvg.map((v) => (mean ? v / mean : 1));
    } else {
      const mean = seasonAvg.reduce((a, b) => a + b, 0) / period;
      seasonAvg = seasonAvg.map((v) => v - mean);
    }

    const seasonal = y.map((_, i) => seasonAvg[i % period]);
    const residual = y.map((v, i) => {
      if (v == null || trend[i] == null) return null;
      if (model === "multiplicative") {
        const s = seasonal[i];
        return (trend[i] === 0 || s === 0) ? null : v / (trend[i] * s);
      }
      return v - trend[i] - seasonal[i];
    });

    return { model, period, n, trend, seasonal, residual, seasonalIndices: seasonAvg };
  }

  const api = { decompose, centeredMA };
  if (typeof window !== "undefined") window.TSDecomp = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
