/* insight Analytics — pure SPC (Statistical Process Control) engine (window.SPC)
   Control charts (I-MR, X-bar/R, X-bar/S, p, c, u), process capability
   (Cp/Cpk/Pp/Ppk), and Pareto. Deterministic, no external deps. */
(function () {
  "use strict";

  // Control chart constants by subgroup size n (2..10)
  const A2 = { 2: 1.880, 3: 1.023, 4: 0.729, 5: 0.577, 6: 0.483, 7: 0.419, 8: 0.373, 9: 0.337, 10: 0.308 };
  const A3 = { 2: 2.659, 3: 1.954, 4: 1.628, 5: 1.427, 6: 1.287, 7: 1.182, 8: 1.099, 9: 1.032, 10: 0.975 };
  const D3 = { 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0.076, 8: 0.136, 9: 0.184, 10: 0.223 };
  const D4 = { 2: 3.267, 3: 2.574, 4: 2.282, 5: 2.114, 6: 2.004, 7: 1.924, 8: 1.864, 9: 1.816, 10: 1.777 };
  const B3 = { 2: 0, 3: 0, 4: 0, 5: 0, 6: 0.030, 7: 0.118, 8: 0.185, 9: 0.239, 10: 0.284 };
  const B4 = { 2: 3.267, 3: 2.568, 4: 2.266, 5: 2.089, 6: 1.970, 7: 1.882, 8: 1.815, 9: 1.761, 10: 1.716 };
  const d2 = { 2: 1.128, 3: 1.693, 4: 2.059, 5: 2.326, 6: 2.534, 7: 2.704, 8: 2.847, 9: 2.970, 10: 3.078 };
  const c4 = { 2: 0.7979, 3: 0.8862, 4: 0.9213, 5: 0.9400, 6: 0.9515, 7: 0.9594, 8: 0.9650, 9: 0.9693, 10: 0.9727 };

  const num = (a) => a.filter((v) => v != null && v !== "" && !isNaN(v)).map(Number);
  const mean = (a) => a.length ? a.reduce((s, v) => s + v, 0) / a.length : null;
  const sampleStd = (a) => { if (a.length < 2) return null; const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)); };

  function constAt(table, n) { const k = Math.max(2, Math.min(10, n)); return table[k]; }
  // Validate that X-bar/R/S subgroups are usable: every subgroup non-empty with a common size n in [2,10].
  // (Size-1 subgroups belong on an I-MR chart; empty subgroups would poison limits with Infinity/NaN.)
  function subgroupSize(groups) {
    const sizes = groups.map((g) => g.length);
    const n = sizes[0];
    if (!n || n < 2) throw new Error("X-bar/R·S needs subgroups of size ≥ 2 (use I-MR for individual points)");
    if (sizes.some((s) => s !== n)) throw new Error("X-bar/R·S needs equal-size subgroups");
    return n;
  }

  // Individuals + Moving Range (n=2 moving range)
  function iMR(values) {
    const x = num(values);
    if (x.length < 2) throw new Error("I-MR needs at least 2 points");
    const mr = []; for (let i = 1; i < x.length; i++) mr.push(Math.abs(x[i] - x[i - 1]));
    const xbar = mean(x), mrbar = mean(mr);
    const sigma = mrbar / d2[2];
    return {
      individuals: { center: xbar, ucl: xbar + 3 * sigma, lcl: xbar - 3 * sigma, points: x, sigma },
      movingRange: { center: mrbar, ucl: D4[2] * mrbar, lcl: D3[2] * mrbar, points: mr },
    };
  }

  function xbarR(subgroups) {
    if (!Array.isArray(subgroups) || subgroups.length < 2) throw new Error("X-bar/R needs >= 2 subgroups");
    const groups = subgroups.map(num);
    const n = subgroupSize(groups);
    const means = groups.map(mean);
    const ranges = groups.map((g) => Math.max(...g) - Math.min(...g));
    const xbarbar = mean(means), rbar = mean(ranges);
    return {
      xbar: { center: xbarbar, ucl: xbarbar + constAt(A2, n) * rbar, lcl: xbarbar - constAt(A2, n) * rbar, points: means },
      range: { center: rbar, ucl: constAt(D4, n) * rbar, lcl: constAt(D3, n) * rbar, points: ranges },
      n,
    };
  }

  function xbarS(subgroups) {
    if (!Array.isArray(subgroups) || subgroups.length < 2) throw new Error("X-bar/S needs >= 2 subgroups");
    const groups = subgroups.map(num);
    const n = subgroupSize(groups);
    const means = groups.map(mean);
    const stds = groups.map(sampleStd);
    const xbarbar = mean(means), sbar = mean(stds);
    return {
      xbar: { center: xbarbar, ucl: xbarbar + constAt(A3, n) * sbar, lcl: xbarbar - constAt(A3, n) * sbar, points: means },
      s: { center: sbar, ucl: constAt(B4, n) * sbar, lcl: constAt(B3, n) * sbar, points: stds },
      n,
    };
  }

  // p-chart: proportion defective; sizes may vary → per-point limits
  function pChart(defectives, sizes) {
    const d = defectives.map(Number), nArr = sizes.map(Number);
    const totalN = nArr.reduce((s, v) => s + (v > 0 ? v : 0), 0);
    const pbar = totalN > 0 ? d.reduce((s, v, i) => s + (nArr[i] > 0 ? v : 0), 0) / totalN : null;
    const points = d.map((v, i) => (nArr[i] > 0 ? v / nArr[i] : null));
    const limits = nArr.map((ni) => {
      if (!(ni > 0) || pbar == null) return { ucl: null, lcl: null };
      const sd = Math.sqrt(pbar * (1 - pbar) / ni); return { ucl: pbar + 3 * sd, lcl: Math.max(0, pbar - 3 * sd) };
    });
    return { center: pbar, points, limits };
  }

  function cChart(counts) {
    const c = counts.map(Number);
    const cbar = mean(c), sd = Math.sqrt(cbar);
    return { center: cbar, ucl: cbar + 3 * sd, lcl: Math.max(0, cbar - 3 * sd), points: c };
  }

  function uChart(counts, sizes) {
    const c = counts.map(Number), nArr = sizes.map(Number);
    const totalN = nArr.reduce((s, v) => s + (v > 0 ? v : 0), 0);
    const ubar = totalN > 0 ? c.reduce((s, v, i) => s + (nArr[i] > 0 ? v : 0), 0) / totalN : null;
    const points = c.map((v, i) => (nArr[i] > 0 ? v / nArr[i] : null));
    const limits = nArr.map((ni) => {
      if (!(ni > 0) || ubar == null) return { ucl: null, lcl: null };
      const sd = Math.sqrt(ubar / ni); return { ucl: ubar + 3 * sd, lcl: Math.max(0, ubar - 3 * sd) };
    });
    return { center: ubar, points, limits };
  }

  // Process capability. Within-sigma from moving range (short-term), overall from sample std.
  function capability(values, lsl, usl) {
    const x = num(values);
    if (x.length < 2) throw new Error("Capability needs >= 2 values");
    const mr = []; for (let i = 1; i < x.length; i++) mr.push(Math.abs(x[i] - x[i - 1]));
    const within = mean(mr) / d2[2];
    const overall = sampleStd(x);
    const mu = mean(x);
    const has = (v) => v != null && !isNaN(v);
    // Cp/Pp are only defined for a valid two-sided spec (usl > lsl); an inverted spec would give
    // meaningless negative indices, so treat it as no bilateral spec.
    const bilateral = has(lsl) && has(usl) && usl > lsl;
    const cp = (bilateral && within > 0) ? (usl - lsl) / (6 * within) : null;
    const pp = (bilateral && overall > 0) ? (usl - lsl) / (6 * overall) : null;
    // A one-sided spec is fine; only reject the case where BOTH limits are given but inverted.
    const specInverted = has(lsl) && has(usl) && usl <= lsl;
    const cpk = (within > 0 && !specInverted) ? Math.min(has(usl) ? (usl - mu) / (3 * within) : Infinity, has(lsl) ? (mu - lsl) / (3 * within) : Infinity) : null;
    const ppk = (overall > 0 && !specInverted) ? Math.min(has(usl) ? (usl - mu) / (3 * overall) : Infinity, has(lsl) ? (mu - lsl) / (3 * overall) : Infinity) : null;
    return { mean: mu, withinSigma: within, overallSigma: overall, cp, cpk: cpk === Infinity ? null : cpk, pp, ppk: ppk === Infinity ? null : ppk };
  }

  // Pareto: array of {label, value} or map → sorted desc with cumulative %
  function pareto(items) {
    const arr = Array.isArray(items) ? items.map((it) => ({ label: it.label, value: Number(it.value) })) : Object.entries(items).map(([label, value]) => ({ label, value: Number(value) }));
    arr.sort((a, b) => b.value - a.value);
    const total = arr.reduce((s, it) => s + it.value, 0) || 1;
    let cum = 0;
    return arr.map((it) => { cum += it.value; return { label: it.label, value: it.value, pct: it.value / total * 100, cumulative: cum, cumulativePct: cum / total * 100 }; });
  }

  // Nelson rule 1: any point beyond 3-sigma limits → out-of-control indices
  function violations(points, center, ucl, lcl) {
    return points.map((v, i) => (v > ucl || v < lcl) ? i : -1).filter((i) => i >= 0);
  }

  const api = { iMR, xbarR, xbarS, pChart, cChart, uChart, capability, pareto, violations, constants: { A2, A3, D3, D4, B3, B4, d2, c4 } };
  if (typeof window !== "undefined") window.SPC = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
