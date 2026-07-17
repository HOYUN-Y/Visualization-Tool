/* NØDE — Visualization option builder (extracted from vizMode.jsx, PLAN §12 F3).
 *
 * buildOption() and applyFormat() are PURE functions — no React, no hooks — that turn a chart spec into
 * an ECharts option and then post-process legend/labels/colors/axis/grid onto it. They were ~630 lines
 * living inside the 1431-line vizMode.jsx, which made the app's most intricate logic its least
 * inspectable. Moving them next to pivotEngine.js / dashWidgets.js (the same "pure logic in a plain .js"
 * pattern this repo already uses) shrinks vizMode and gives buildOption a home of its own.
 *
 * NOT Node-testable in isolation yet: buildOption reads Charts.themeColors()/palette()/baseGrid() (which
 * resolve CSS custom properties through a canvas) and NODE formatters at CALL time, so it needs a live
 * browser. It's verified by tests/e2e/vizOptions.spec.mjs, which exercises all 20 chart types. Full Node
 * unit tests would require injecting those dependencies — a separate change (PLAN §12 F3 note).
 *
 * window.buildVizOption stays the public name (dashMode.jsx and vizMode.jsx both call it); window.applyVizFormat
 * is exposed for vizMode's render path. Both read window.Charts/NODE/Store at call time, so load order
 * only needs charts.js + store.js before first render, which index.html already guarantees.
 */
(function () {
  const Charts = window.Charts, NODE = window.NODE;
  const derive = window.Store.derive;

  // ─── Statistics helpers ────────────────────────────────────────────────────
  function calcBoxStats(values) {
    const v = values.filter((x) => x != null && !isNaN(x)).sort((a, b) => a - b);
    if (!v.length) return null;
    const n = v.length;
    const q = (p) => { const i = p * (n - 1); const lo = Math.floor(i), hi = Math.ceil(i); return v[lo] + (v[hi] - v[lo]) * (i - lo); };
    return { min: v[0], q1: q(0.25), median: q(0.5), q3: q(0.75), max: v[n - 1], all: v };
  }

  function kernelDensity(vals, bandwidth, yPts) {
    return yPts.map((y) => {
      const s = vals.reduce((sum, v) => sum + Math.exp(-0.5 * ((y - v) / bandwidth) ** 2), 0);
      return s / (vals.length * bandwidth * Math.sqrt(2 * Math.PI));
    });
  }

  // deterministic jitter (no Math.random) for violin scatter overlay
  function stableJitter(ci, idx) {
    return (((Math.sin(ci * 127.1 + idx * 311.7 + 43758.5) % 1) + 1) % 1) * 0.36 - 0.18;
  }

  function buildOption(type, ctx) {
    const c = Charts.themeColors();
    const pal = Charts.palette();
    const { rows, cols, measures, color, sortDesc, topN } = ctx;
    const base = Charts.baseGrid(c);
    const axisCommon = {
      axisLine: { lineStyle: { color: c.axis } }, axisTick: { show: false },
      axisLabel: { color: c.text, fontSize: 11, hideOverlap: true },
      splitLine: { lineStyle: { color: c.split } },
      nameTextStyle: { color: c.faint }, nameGap: 8,
    };
    const fmtVal = (v) => NODE.fmtCompact(v);
    const noData = (msg) => ({ graphic: { type: "text", left: "center", top: "center", style: { text: msg || "Drop a dimension and a measure", fill: c.faint, fontSize: 13, fontFamily: "IBM Plex Sans" } } });

    // ── Financial charts ────────────────────────────────────────────────────
    if (type === "candlestick" || type === "ohlcvol" || type === "cumreturn") {
      if (!rows.length || !("open" in rows[0])) return noData("Select a financial dataset with open/high/low/close columns");
      const sorted = [...rows].filter((r) => r.open != null).sort((a, b) => String(a.date).localeCompare(String(b.date)));
      const dates = sorted.map((r) => r.date);

      if (type === "cumreturn") {
        const base0 = sorted[0].close;
        const retData = sorted.map((r) => NODE.round((r.close / base0 - 1) * 100, 2));
        const lastRet = retData[retData.length - 1] || 0;
        const lineColor = lastRet >= 0 ? pal[2] : "#e05c5c";
        return {
          backgroundColor: "transparent",
          grid: { ...base.grid, top: 20, bottom: 40 },
          xAxis: { type: "category", data: dates, ...axisCommon, axisLabel: { ...axisCommon.axisLabel, rotate: 35, interval: Math.max(1, Math.floor(dates.length / 8)) } },
          yAxis: { type: "value", ...axisCommon, axisLabel: { ...axisCommon.axisLabel, formatter: (v) => v.toFixed(1) + "%" } },
          tooltip: { trigger: "axis", backgroundColor: c.bg2, borderColor: c.line, textStyle: { color: c.text, fontSize: 11 }, formatter: (p) => `${p[0].name}<br/>Return: <b>${p[0].value}%</b>` },
          series: [{ type: "line", data: retData, smooth: 0.1, symbol: "none", lineStyle: { color: lineColor, width: 1.5 }, areaStyle: { color: lineColor, opacity: 0.12 }, itemStyle: { color: lineColor } }],
        };
      }

      const ohlcData = sorted.map((r) => [r.open, r.close, r.low, r.high]);
      const upColor = pal[2] || "#26a69a", downColor = "#ef5350";

      if (type === "ohlcvol") {
        const volData = sorted.map((r) => ({ value: r.volume, itemStyle: { color: r.close >= r.open ? upColor : downColor, opacity: 0.65 } }));
        return {
          backgroundColor: "transparent",
          grid: [{ top: 16, bottom: "35%", left: 60, right: 16 }, { top: "68%", bottom: 38, left: 60, right: 16 }],
          xAxis: [
            { gridIndex: 0, type: "category", data: dates, ...axisCommon, axisLabel: { show: false }, splitLine: { show: false } },
            { gridIndex: 1, type: "category", data: dates, ...axisCommon, axisLabel: { ...axisCommon.axisLabel, rotate: 35, interval: Math.max(1, Math.floor(dates.length / 8)) } },
          ],
          yAxis: [
            { gridIndex: 0, type: "value", scale: true, ...axisCommon, axisLabel: { ...axisCommon.axisLabel, formatter: fmtVal } },
            { gridIndex: 1, type: "value", ...axisCommon, axisLabel: { ...axisCommon.axisLabel, formatter: (v) => NODE.fmtCompact(v) }, splitLine: { show: false } },
          ],
          tooltip: { trigger: "axis", axisPointer: { type: "cross" }, backgroundColor: c.bg2, borderColor: c.line, textStyle: { color: c.text, fontSize: 11 } },
          dataZoom: [{ type: "inside", xAxisIndex: [0, 1], start: Math.max(0, 100 - Math.round(6000 / dates.length)), end: 100 }],
          series: [
            { type: "candlestick", xAxisIndex: 0, yAxisIndex: 0, data: ohlcData, itemStyle: { color: upColor, color0: downColor, borderColor: upColor, borderColor0: downColor } },
            { type: "bar", xAxisIndex: 1, yAxisIndex: 1, data: volData, barMaxWidth: 8 },
          ],
        };
      }

      // plain candlestick
      return {
        backgroundColor: "transparent",
        grid: { ...base.grid, top: 16, bottom: 40, left: 55 },
        xAxis: { type: "category", data: dates, ...axisCommon, axisLabel: { ...axisCommon.axisLabel, rotate: 35, interval: Math.max(1, Math.floor(dates.length / 8)) } },
        yAxis: { type: "value", scale: true, ...axisCommon, axisLabel: { ...axisCommon.axisLabel, formatter: fmtVal } },
        tooltip: { trigger: "axis", axisPointer: { type: "cross" }, backgroundColor: c.bg2, borderColor: c.line, textStyle: { color: c.text, fontSize: 11 } },
        dataZoom: [{ type: "inside", start: Math.max(0, 100 - Math.round(6000 / dates.length)), end: 100 }],
        series: [{ type: "candlestick", data: ohlcData, itemStyle: { color: upColor, color0: downColor, borderColor: upColor, borderColor0: downColor } }],
      };
    }

    // All non-financial types need at least a dimension + measure (except scatter/bubble)
    if (!measures.length || (!cols.length && type !== "scatter" && type !== "bubble")) return noData();

    const xKey = cols[0] ? cols[0].key : null;
    const colorKey = color ? color.key : (cols[1] ? cols[1].key : null);

    // ── Scatter ────────────────────────────────────────────────────────────
    if (type === "scatter") {
      if (measures.length < 2) return noData("Scatter needs 2 measures on Rows");
      const mx = measures[0], my = measures[1];
      let series;
      // Big datasets: enable ECharts' high-performance point renderer so a scatter
      // over tens of thousands of raw rows stays responsive (no browser freeze).
      const bigScatter = { large: true, largeThreshold: 2000, progressive: 4000, progressiveThreshold: 4000 };
      if (colorKey) {
        const groups = new Map();
        for (const r of rows) { const g = r[colorKey]; if (!groups.has(g)) groups.set(g, []); groups.get(g).push([r[mx.key], r[my.key]]); }
        series = [...groups.entries()].slice(0, 12).map(([g, data], i) => ({ name: String(g), type: "scatter", symbolSize: 7, itemStyle: { color: pal[i % 8], opacity: 0.75 }, data, ...bigScatter }));
      } else {
        series = [{ type: "scatter", symbolSize: 7, itemStyle: { color: pal[0], opacity: 0.7 }, data: rows.map((r) => [r[mx.key], r[my.key]]), ...bigScatter }];
      }
      return {
        ...base, legend: color ? { top: 0, textStyle: { color: c.text }, type: "scroll" } : undefined,
        grid: { ...base.grid, top: color ? 30 : 18 },
        xAxis: { type: "value", name: mx.label, ...axisCommon, axisLabel: { ...axisCommon.axisLabel, formatter: fmtVal } },
        yAxis: { type: "value", name: my.label, ...axisCommon, axisLabel: { ...axisCommon.axisLabel, formatter: fmtVal } },
        tooltip: { ...base.tooltip, trigger: "item" }, series,
      };
    }

    // ── Bubble ─────────────────────────────────────────────────────────────
    if (type === "bubble") {
      if (measures.length < 3) return noData("Bubble needs 3 measures: X · Y · Size");
      const mx = measures[0], my = measures[1], ms = measures[2];
      const allSizes = rows.map((r) => r[ms.key] || 0);
      const maxSz = Math.max(...allSizes, 1);
      // Bubble's per-point symbolSize callback is incompatible with ECharts' `large` renderer,
      // so instead deterministically downsample when there are too many points to draw sanely
      // (thousands of overlapping bubbles are both unreadable and a browser-freeze risk).
      const BUBBLE_CAP = 5000;
      const capPoints = (arr) => { if (arr.length <= BUBBLE_CAP) return arr; const step = Math.ceil(arr.length / BUBBLE_CAP); return arr.filter((_, i) => i % step === 0); };
      const mkData = (arr) => capPoints(arr).map((r) => [r[mx.key], r[my.key], r[ms.key]]);
      const symbolSize = (val) => Math.max(6, Math.sqrt(Math.abs(val[2]) / maxSz) * 52);
      let series;
      if (colorKey) {
        const groups = new Map();
        for (const r of rows) { const g = r[colorKey]; if (!groups.has(g)) groups.set(g, []); groups.get(g).push(r); }
        series = [...groups.entries()].slice(0, 12).map(([g, arr], i) => ({ name: String(g), type: "scatter", symbolSize, itemStyle: { color: pal[i % 8], opacity: 0.7 }, data: mkData(arr) }));
      } else {
        series = [{ type: "scatter", symbolSize, itemStyle: { color: pal[0], opacity: 0.65 }, data: mkData(rows) }];
      }
      return {
        ...base, legend: colorKey ? { top: 0, textStyle: { color: c.text }, type: "scroll" } : undefined,
        grid: { ...base.grid, top: colorKey ? 30 : 18 },
        xAxis: { type: "value", name: mx.label, ...axisCommon, axisLabel: { ...axisCommon.axisLabel, formatter: fmtVal } },
        yAxis: { type: "value", name: my.label, ...axisCommon, axisLabel: { ...axisCommon.axisLabel, formatter: fmtVal } },
        tooltip: { ...base.tooltip, trigger: "item", formatter: (p) => `${colorKey ? p.seriesName + "<br/>" : ""}${mx.label}: <b>${fmtVal(p.value[0])}</b><br/>${my.label}: <b>${fmtVal(p.value[1])}</b><br/>${ms.label}: <b>${fmtVal(p.value[2])}</b>` },
        series,
      };
    }

    // aggregate for dimension-based charts
    const dimKeys = colorKey && colorKey !== xKey ? [xKey, colorKey] : [xKey];
    const agg = derive.aggregate(rows, dimKeys, measures);
    const m0 = measures[0];

    // ── Heatmap ────────────────────────────────────────────────────────────
    if (type === "heatmap") {
      const k2 = colorKey && colorKey !== xKey ? colorKey : (cols[1] && cols[1].key);
      if (!k2) return noData("Heatmap needs 2 dimensions on Columns");
      const xs = [...new Set(agg.map((r) => r[xKey]))];
      const ys = [...new Set(agg.map((r) => r[k2]))];
      const data = agg.map((r) => [xs.indexOf(r[xKey]), ys.indexOf(r[k2]), r[m0.id] || 0]);
      const maxV = Math.max(...data.map((d) => d[2]), 1);
      return {
        ...base, grid: { ...base.grid, top: 14, bottom: 50, right: 60 },
        tooltip: { ...base.tooltip, trigger: "item" },
        xAxis: { type: "category", data: xs, ...axisCommon, axisLabel: { ...axisCommon.axisLabel, rotate: xs.length > 6 ? 35 : 0 } },
        yAxis: { type: "category", data: ys, ...axisCommon },
        visualMap: { min: 0, max: maxV, calculable: true, orient: "vertical", right: 4, bottom: 30, inRange: { color: [c.bg, pal[0]] }, textStyle: { color: c.text, fontSize: 10 } },
        series: [{ type: "heatmap", data, label: { show: false } }],
      };
    }

    // ── Treemap ─────────────────────────────────────────────────────────────
    if (type === "treemap") {
      const data = agg.map((r, i) => ({ name: String(r[xKey]), value: r[m0.id] || 0, itemStyle: { color: pal[i % 8] } })).sort((a, b) => b.value - a.value);
      return {
        ...base,
        tooltip: { ...base.tooltip, trigger: "item", formatter: (p) => `${p.name}<br/><b>${fmtVal(p.value)}</b>` },
        series: [{ type: "treemap", roam: false, nodeClick: false, breadcrumb: { show: false }, data, label: { color: "#fff", fontSize: 12, fontFamily: "IBM Plex Sans" }, itemStyle: { borderColor: c.bg, borderWidth: 2, gapWidth: 2 }, levels: [{ itemStyle: { gapWidth: 2 } }] }],
      };
    }

    // ── Pie ─────────────────────────────────────────────────────────────────
    if (type === "pie") {
      let data = agg.map((r) => ({ name: String(r[xKey]), value: r[m0.id] || 0 }));
      data.sort((a, b) => b.value - a.value);
      if (topN) data = data.slice(0, topN);
      return {
        ...base,
        tooltip: { ...base.tooltip, trigger: "item", formatter: (p) => `${p.name}<br/><b>${fmtVal(p.value)}</b> (${p.percent}%)` },
        legend: { type: "scroll", orient: "vertical", right: 4, top: 8, textStyle: { color: c.text, fontSize: 11 } },
        color: pal,
        series: [{ type: "pie", radius: ["42%", "70%"], center: ["40%", "52%"], data, itemStyle: { borderColor: c.bg, borderWidth: 2 }, label: { color: c.text, fontSize: 11 } }],
      };
    }

    // ── Funnel ──────────────────────────────────────────────────────────────
    if (type === "funnel") {
      let data = agg.map((r, i) => ({ name: String(r[xKey]), value: r[m0.id] || 0 }));
      data.sort((a, b) => b.value - a.value);
      if (topN) data = data.slice(0, topN);
      return {
        ...base,
        tooltip: { ...base.tooltip, trigger: "item", formatter: (p) => `${p.name}<br/><b>${fmtVal(p.value)}</b>` },
        series: [{
          type: "funnel", left: "8%", width: "84%", top: 20, bottom: 20,
          min: 0, max: data[0] ? data[0].value : 1,
          minSize: "8%", maxSize: "100%", sort: "descending", gap: 2,
          label: { show: true, position: "inside", color: "#fff", fontSize: 12, fontFamily: "IBM Plex Sans" },
          itemStyle: { borderColor: c.bg, borderWidth: 1 },
          data: data.map((d, i) => ({ ...d, itemStyle: { color: pal[i % 8] } })),
        }],
      };
    }

    // ── Radar ───────────────────────────────────────────────────────────────
    if (type === "radar") {
      if (measures.length < 2) return noData("Radar needs 2+ measures on Rows");
      const aggR = derive.aggregate(rows, [xKey], measures);
      const indicator = measures.map((m) => {
        const vals = aggR.map((r) => r[m.id] || 0);
        return { name: m.label, max: Math.max(...vals, 1) * 1.15 };
      });
      const items = (topN ? aggR.slice(0, topN) : aggR).slice(0, 12);
      return {
        ...base, legend: { top: 0, type: "scroll", textStyle: { color: c.text, fontSize: 11 } },
        radar: {
          indicator, center: ["50%", "54%"], radius: "62%",
          axisName: { color: c.text, fontSize: 11 },
          splitLine: { lineStyle: { color: c.split } },
          axisLine: { lineStyle: { color: c.axis } },
          splitArea: { show: false },
        },
        tooltip: { ...base.tooltip, trigger: "item" },
        series: [{
          type: "radar",
          data: items.map((r, i) => ({
            name: String(r[xKey]),
            value: measures.map((m) => r[m.id] || 0),
            itemStyle: { color: pal[i % 8] },
            lineStyle: { color: pal[i % 8], width: 1.5 },
            areaStyle: { opacity: 0.1 },
          })),
        }],
      };
    }

    // ── Waterfall ───────────────────────────────────────────────────────────
    if (type === "waterfall") {
      let cats = [...new Set(agg.map((r) => r[xKey]))];
      if (sortDesc) cats.sort((a, b) => (agg.find((r) => r[xKey] === b) || {})[m0.id] - (agg.find((r) => r[xKey] === a) || {})[m0.id]);
      if (topN) cats = cats.slice(0, topN);
      const vals = cats.map((cat) => { const f = agg.find((r) => r[xKey] === cat); return f ? (f[m0.id] || 0) : 0; });
      const bases = [];
      let running = 0;
      vals.forEach((v) => { bases.push(v >= 0 ? running : running + v); running += v; });
      const posColor = pal[0], negColor = "#e05c5c";
      return {
        ...base,
        tooltip: { ...base.tooltip, trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: fmtVal },
        xAxis: { type: "category", data: cats, ...axisCommon, axisLabel: { ...axisCommon.axisLabel, rotate: cats.length > 7 ? 32 : 0, interval: 0 } },
        yAxis: { type: "value", ...axisCommon, axisLabel: { ...axisCommon.axisLabel, formatter: fmtVal } },
        series: [
          { name: "_base", type: "bar", stack: "wf", silent: true, itemStyle: { opacity: 0 }, tooltip: { show: false }, data: bases },
          {
            name: m0.label, type: "bar", stack: "wf",
            data: vals.map((v, i) => ({ value: v, itemStyle: { color: v >= 0 ? posColor : negColor, borderRadius: v >= 0 ? [3, 3, 0, 0] : [0, 0, 3, 3] } })),
            label: { show: true, position: "top", color: c.text, fontSize: 10, formatter: (p) => fmtVal(p.value) },
          },
        ],
      };
    }

    // ── Box Plot ─────────────────────────────────────────────────────────────
    if (type === "boxplot") {
      const groups = new Map();
      for (const r of rows) { const g = r[xKey]; if (!groups.has(g)) groups.set(g, []); const v = r[m0.key]; if (v != null && !isNaN(v)) groups.get(g).push(+v); }
      const cats = [...groups.keys()];
      const bpData = cats.map((g) => { const s = calcBoxStats(groups.get(g)); return s ? [s.min, s.q1, s.median, s.q3, s.max] : null; }).filter(Boolean);
      const outliers = [];
      cats.forEach((g, i) => {
        const bp = bpData[i]; if (!bp) return;
        const iqr = bp[3] - bp[1];
        groups.get(g).forEach((v) => { if (v < bp[1] - 1.5 * iqr || v > bp[3] + 1.5 * iqr) outliers.push([i, v]); });
      });
      return {
        ...base, grid: { ...base.grid, bottom: cats.length > 6 ? 40 : 8 },
        tooltip: {
          ...base.tooltip, trigger: "item",
          formatter: (p) => p.seriesType === "boxplot"
            ? `<b>${p.name}</b><br/>Max: ${fmtVal(p.data[5])}<br/>Q3: ${fmtVal(p.data[4])}<br/>Median: ${fmtVal(p.data[3])}<br/>Q1: ${fmtVal(p.data[2])}<br/>Min: ${fmtVal(p.data[1])}`
            : `Outlier: <b>${fmtVal(p.value[1])}</b>`,
        },
        xAxis: { type: "category", data: cats, ...axisCommon, axisLabel: { ...axisCommon.axisLabel, rotate: cats.length > 6 ? 32 : 0 } },
        yAxis: { type: "value", ...axisCommon, axisLabel: { ...axisCommon.axisLabel, formatter: fmtVal } },
        series: [
          { type: "boxplot", data: bpData, itemStyle: { color: pal[0] + "40", borderColor: pal[0], borderWidth: 1.5 }, boxWidth: ["20%", "45%"] },
          { type: "scatter", data: outliers, symbolSize: 5, itemStyle: { color: pal[3], opacity: 0.75 } },
        ],
      };
    }

    // ── Violin ──────────────────────────────────────────────────────────────
    if (type === "violin") {
      const groups = new Map();
      for (const r of rows) { const g = r[xKey]; if (!groups.has(g)) groups.set(g, []); const v = r[m0.key]; if (v != null && !isNaN(v)) groups.get(g).push(+v); }
      const cats = [...groups.keys()];

      const N_PTS = 40;
      const allVals = [...groups.values()].flat();
      const gMin = Math.min(...allVals), gMax = Math.max(...allVals);
      const yPts = Array.from({ length: N_PTS }, (_, i) => gMin + (gMax - gMin) * (i / (N_PTS - 1)));

      const densities = cats.map((g) => {
        const vals = groups.get(g);
        const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
        const std = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length) || 1;
        const bw = Math.max(1.06 * std * Math.pow(vals.length, -0.2), (gMax - gMin) * 0.05);
        return kernelDensity(vals, bw, yPts);
      });
      const maxD = Math.max(...densities.flat(), 1e-10);

      const boxStats = cats.map((g) => calcBoxStats(groups.get(g)));

      // Custom series: violin polygon in pixel space (category axis doesn't support fractional indices)
      const renderItem = (params, api) => {
        const ci = api.value(0);
        const dens = densities[ci];
        if (!dens) return { type: "group", children: [] };
        // Pixel center x of this category
        const centerX = api.coord([ci, yPts[0]])[0];
        // Half-width in pixels — use distance to next category as reference
        const nextX = ci + 1 < cats.length ? api.coord([ci + 1, yPts[0]])[0] : centerX + 48;
        const halfPxW = Math.abs(nextX - centerX) * 0.42;
        // Build polygon points entirely in pixel space
        const rightPts = dens.map((d, i) => [centerX + (d / maxD) * halfPxW, api.coord([ci, yPts[i]])[1]]);
        const leftPts  = dens.map((d, i) => [centerX - (d / maxD) * halfPxW, api.coord([ci, yPts[i]])[1]]);
        return {
          type: "polygon", transition: [],
          shape: { points: [...rightPts, ...leftPts.reverse()] },
          style: { fill: pal[ci % 8], opacity: 0.6 },
        };
      };

      return {
        ...base, grid: { ...base.grid, bottom: cats.length > 6 ? 40 : 8 },
        xAxis: { type: "category", data: cats, ...axisCommon, axisLabel: { ...axisCommon.axisLabel, rotate: cats.length > 6 ? 32 : 0 } },
        yAxis: { type: "value", min: gMin, max: gMax, ...axisCommon, axisLabel: { ...axisCommon.axisLabel, formatter: fmtVal } },
        tooltip: { ...base.tooltip, trigger: "axis" },
        series: [
          { type: "custom", data: cats.map((_, ci) => [ci, 0]), renderItem, encode: { x: 0, y: 1 }, z: 1 },
          // Median dot overlay
          { type: "scatter", symbolSize: 7, z: 3, itemStyle: { color: "#fff", borderColor: "rgba(0,0,0,0.5)", borderWidth: 1.5 }, data: cats.map((g, i) => [i, boxStats[i] ? boxStats[i].median : 0]) },
          // IQR bar overlay
          { type: "custom", z: 2,
            data: cats.map((g, i) => [i, boxStats[i] ? boxStats[i].q1 : 0, boxStats[i] ? boxStats[i].q3 : 0]),
            renderItem: (p, api) => {
              const x = api.coord([api.value(0), 0])[0];
              const y1 = api.coord([0, api.value(1)])[1];
              const y2 = api.coord([0, api.value(2)])[1];
              const w = 4;
              return { type: "rect", shape: { x: x - w / 2, y: Math.min(y1, y2), width: w, height: Math.abs(y2 - y1) }, style: { fill: "#fff", opacity: 0.8 } };
            },
          },
        ],
      };
    }

    // ── Sankey ──────────────────────────────────────────────────────────────
    if (type === "sankey") {
      const k2 = colorKey && colorKey !== xKey ? colorKey : (cols[1] && cols[1].key);
      if (!k2) return noData("Sankey needs 2 dimensions on Columns");
      const aggS = derive.aggregate(rows, [xKey, k2], measures);
      const srcSet = new Set(aggS.map((r) => "S:" + r[xKey]));
      const tgtSet = new Set(aggS.map((r) => "T:" + r[k2]));
      const nodes = [...srcSet, ...tgtSet].map((name) => ({ name }));
      const links = aggS.map((r) => ({ source: "S:" + r[xKey], target: "T:" + r[k2], value: r[m0.id] || 0 })).filter((l) => l.value > 0);
      if (!links.length) return noData("No flow data — check columns");
      return {
        ...base,
        tooltip: { ...base.tooltip, trigger: "item", formatter: (p) => p.dataType === "edge" ? `${p.data.source.replace(/^[ST]:/, "")} → ${p.data.target.replace(/^[ST]:/, "")}<br/><b>${fmtVal(p.data.value)}</b>` : p.name.replace(/^[ST]:/, "") },
        series: [{
          type: "sankey", layout: "none", emphasis: { focus: "adjacency" },
          data: nodes, links,
          lineStyle: { color: "gradient", opacity: 0.45 },
          label: { color: c.text, fontSize: 11, fontFamily: "IBM Plex Sans", formatter: (p) => p.name.replace(/^[ST]:/, "") },
          itemStyle: { borderWidth: 0 },
          nodeWidth: 14, nodeGap: 8,
        }],
      };
    }

    // ── Sunburst ─────────────────────────────────────────────────────────────
    if (type === "sunburst") {
      const k2 = colorKey && colorKey !== xKey ? colorKey : (cols[1] && cols[1].key);
      if (!k2) return noData("Sunburst needs 2 dimensions on Columns");
      const aggSB = derive.aggregate(rows, [xKey, k2], measures);
      const rootMap = new Map();
      aggSB.forEach((r) => {
        const p = r[xKey], ch = r[k2], v = r[m0.id] || 0;
        if (!rootMap.has(p)) rootMap.set(p, []);
        rootMap.get(p).push({ name: String(ch), value: v });
      });
      const sbData = [...rootMap.entries()].map(([p, children], i) => ({
        name: String(p), children,
        itemStyle: { color: pal[i % 8] },
      }));
      return {
        ...base,
        tooltip: { ...base.tooltip, trigger: "item", formatter: (p) => `${p.treePathInfo.map((n) => n.name).join(" › ")}<br/><b>${fmtVal(p.value)}</b>` },
        series: [{
          type: "sunburst", data: sbData,
          radius: ["15%", "85%"], center: ["50%", "50%"],
          sort: "desc",
          label: { rotate: "radial", color: c.text, fontSize: 10, fontFamily: "IBM Plex Sans" },
          itemStyle: { borderColor: c.bg, borderWidth: 1.5 },
          levels: [
            {},
            { r0: "20%", r: "55%", label: { align: "right" } },
            { r0: "55%", r: "80%", label: { position: "outside", padding: 3, silent: false } },
          ],
        }],
      };
    }

    // ── Bar / Line / Area (per-measure mark → combo, dual/secondary axis) ────
    const horiz = type === "hbar";
    const cats = [...new Set(agg.map((r) => r[xKey]))];
    let series;
    if (colorKey && colorKey !== xKey) {
      const seriesNames = [...new Set(agg.map((r) => r[colorKey]))].slice(0, 16);
      series = seriesNames.map((sn, i) => ({
        name: String(sn), type: type === "line" || type === "area" ? "line" : "bar",
        stack: type === "area" ? "t" : undefined, areaStyle: type === "area" ? { opacity: 0.25 } : undefined,
        smooth: type === "line" || type === "area" ? 0.2 : false, symbol: "none",
        itemStyle: { color: pal[i % 8], borderRadius: type.includes("bar") ? (horiz ? [0, 3, 3, 0] : [3, 3, 0, 0]) : 0 },
        data: cats.map((cat) => { const f = agg.find((r) => r[xKey] === cat && r[colorKey] === sn); return f ? f[m0.id] : 0; }),
      }));
    } else {
      let pairs = cats.map((cat) => ({ cat, vals: measures.map((m) => { const f = agg.find((r) => r[xKey] === cat); return f ? f[m.id] : 0; }) }));
      pairs.sort((a, b) => sortDesc ? b.vals[0] - a.vals[0] : a.vals[0] - b.vals[0]);
      if (topN) pairs = pairs.slice(0, topN);
      const sortedCats = pairs.map((p) => p.cat);
      // Per-measure mark (bar/line/area) → mixed "combo" charts; default mark = base chart type.
      const baseMark = (type === "line" || type === "area") ? type : "bar";
      series = measures.map((m, mi) => {
        const mk = !horiz ? (m.mark || baseMark) : baseMark;
        const ax = !horiz ? (m.axis || 0) : 0;
        return {
          name: m.label, type: mk === "area" ? "line" : mk, yAxisIndex: ax,
          areaStyle: mk === "area" ? { opacity: 0.22 } : undefined,
          smooth: (mk === "line" || mk === "area") ? 0.2 : false, symbol: "none",
          z: mk === "bar" ? 1 : 2,
          itemStyle: { color: pal[mi % 8], borderRadius: mk === "bar" ? (horiz ? [0, 3, 3, 0] : [3, 3, 0, 0]) : 0 },
          lineStyle: mk !== "bar" ? { color: pal[mi % 8], width: 2 } : undefined,
          data: pairs.map((p) => p.vals[mi]),
        };
      });
      cats.length = 0; cats.push(...sortedCats);
    }
    const grouped = colorKey && colorKey !== xKey;
    const hasRight = !horiz && !grouped && measures.some((m) => (m.axis || 0) === 1);
    const catAxis = { type: "category", data: cats, ...axisCommon, axisLabel: { ...axisCommon.axisLabel, rotate: !horiz && cats.length > 7 ? 32 : 0, interval: 0 } };
    const valAxis = { type: "value", ...axisCommon, axisLabel: { ...axisCommon.axisLabel, formatter: fmtVal } };
    const valAxisRight = { type: "value", ...axisCommon, position: "right", axisLabel: { ...axisCommon.axisLabel, formatter: fmtVal }, splitLine: { show: false } };
    const hasLegend = grouped || measures.length > 1;
    return {
      ...base,
      grid: { ...base.grid, top: hasLegend ? 30 : 16, right: hasRight ? 46 : 14, bottom: horiz ? 8 : (cats.length > 7 ? 40 : 8) },
      legend: hasLegend ? { top: 0, type: "scroll", textStyle: { color: c.text, fontSize: 11 }, icon: "roundRect" } : undefined,
      tooltip: { ...base.tooltip, trigger: "axis", axisPointer: { type: hasRight ? "cross" : "shadow" }, valueFormatter: fmtVal },
      xAxis: horiz ? valAxis : catAxis,
      yAxis: horiz ? { ...catAxis, inverse: true } : (hasRight ? [valAxis, valAxisRight] : valAxis),
      series,
    };
  }

  function applyFormat(opt, fmt) {
    if (!opt || !fmt || !opt.series) return opt;
    const c = Charts.themeColors();
    const o = { ...opt };
    // Legend — 2-axis placement (vertical × horizontal = 9 anchors) or free (dragged) position
    if (fmt.legend) {
      if (fmt.legend.show === false) o.legend = undefined;
      else if (fmt.legend.free) {
        const fx = fmt.legend.fx != null ? fmt.legend.fx : 0.5;
        const fy = fmt.legend.fy != null ? fmt.legend.fy : 0.04;
        o.legend = { ...(o.legend || {}), type: "scroll", orient: "horizontal", textStyle: { color: c.text, fontSize: 11 },
          left: (fx * 100).toFixed(1) + "%", top: (fy * 100).toFixed(1) + "%", right: "auto", bottom: "auto" };
      } else {
        // migrate legacy { pos } → { v, h }
        const v = fmt.legend.v || (fmt.legend.pos === "bottom" ? "bottom" : "top");
        const h = fmt.legend.h || (fmt.legend.pos === "left" ? "left" : fmt.legend.pos === "right" ? "right" : "center");
        const sideVertical = (h === "left" || h === "right") && v === "middle";
        const leg = { ...(o.legend || {}), type: "scroll", textStyle: { color: c.text, fontSize: 11 }, orient: sideVertical ? "vertical" : "horizontal" };
        // vertical anchor
        if (v === "top") { leg.top = 0; leg.bottom = "auto"; }
        else if (v === "bottom") { leg.bottom = 0; leg.top = "auto"; }
        else { leg.top = "middle"; leg.bottom = "auto"; }
        // horizontal anchor
        if (h === "left") { leg.left = 0; leg.right = "auto"; }
        else if (h === "right") { leg.right = 0; leg.left = "auto"; }
        else { leg.left = "center"; leg.right = "auto"; }
        o.legend = leg;
        // make room in the grid so the legend doesn't overlap the plot
        if (o.grid && !Array.isArray(o.grid)) {
          const g = { ...o.grid };
          if (v === "top") g.top = Math.max(typeof g.top === "number" ? g.top : 16, 30);
          if (v === "bottom") g.bottom = Math.max(typeof g.bottom === "number" ? g.bottom : 8, 38);
          if (sideVertical && h === "left") g.left = Math.max(typeof g.left === "number" ? g.left : 8, 90);
          if (sideVertical && h === "right") g.right = Math.max(typeof g.right === "number" ? g.right : 14, 90);
          o.grid = g;
        }
      }
    }
    // Title
    if (fmt.title && fmt.title.text) {
      const t = fmt.title;
      const tt = { text: t.text, textStyle: { color: c.textHi, fontSize: 15, fontWeight: 600, fontFamily: "IBM Plex Sans" } };
      if (t.free) { tt.left = ((t.fx != null ? t.fx : 0.5) * 100).toFixed(1) + "%"; tt.top = ((t.fy != null ? t.fy : 0.01) * 100).toFixed(1) + "%"; }
      else {
        const tv = t.v || "top", th = t.h || "center";
        tt.left = th === "left" ? "left" : th === "right" ? "right" : "center";
        tt.top = tv === "bottom" ? "bottom" : tv === "middle" ? "middle" : "top";
        if (tv === "top" && o.grid && !Array.isArray(o.grid)) {
          const g = { ...o.grid }; g.top = Math.max(typeof g.top === "number" ? g.top : 16, 34);
          if (o.legend && o.legend.top === 0) { o.legend = { ...o.legend, top: 28 }; g.top = Math.max(g.top, 52); }
          o.grid = g;
        }
      }
      o.title = tt;
    }
    // Value (data) labels
    if (fmt.labels && fmt.labels.show) {
      const fv = (v) => v == null ? "" : (fmt.labels.fmt === "compact" ? NODE.fmtCompact(v) : (typeof v === "number" ? v.toLocaleString(undefined, { maximumFractionDigits: 1 }) : String(v)));
      o.series = o.series.map((s) => (s.type === "bar" || s.type === "line") ? { ...s,
        label: { show: true, position: fmt.labels.pos || "top", color: c.text, fontSize: 10, fontFamily: "IBM Plex Sans",
          formatter: (p) => { const v = Array.isArray(p.value) ? p.value[p.value.length - 1] : p.value; return fv(v); } } } : s);
    }
    // Per-series colour overrides (keyed by original series name)
    if (fmt.colors && Object.keys(fmt.colors).length) {
      o.series = o.series.map((s) => { const col = fmt.colors[s.name]; if (!col) return s;
        return { ...s, itemStyle: { ...(s.itemStyle || {}), color: col }, lineStyle: s.lineStyle ? { ...s.lineStyle, color: col } : s.lineStyle, areaStyle: s.areaStyle ? { ...s.areaStyle, color: col } : s.areaStyle }; });
    }
    // Bar spacing (gap between bar groups)
    if (fmt.bar && fmt.bar.categoryGap != null) {
      o.series = o.series.map((s) => s.type === "bar" ? { ...s, barCategoryGap: fmt.bar.categoryGap } : s);
    }
    // Per-series detail — line width
    if (fmt.seriesOpts && Object.keys(fmt.seriesOpts).length) {
      o.series = o.series.map((s) => {
        const so = fmt.seriesOpts[s.name]; if (!so) return s;
        if (s.type === "line" && so.lineWidth) return { ...s, lineStyle: { ...(s.lineStyle || {}), width: so.lineWidth } };
        return s;
      });
    }
    // Pie — inner radius (doughnut) + slice explode + per-slice colour
    {
      const explodeOn = fmt.explode && Object.keys(fmt.explode).length;
      const colorsOn = fmt.colors && Object.keys(fmt.colors).length;
      const innerOn = fmt.pie && fmt.pie.inner != null;
      if (explodeOn || colorsOn || innerOn) {
        o.series = o.series.map((s) => {
          if (s.type !== "pie") return s;
          const n = { ...s };
          if (innerOn) n.radius = [fmt.pie.inner, Array.isArray(s.radius) ? s.radius[1] : "70%"];
          if (explodeOn) { n.selectedMode = "multiple"; n.selectedOffset = 16; }
          if (explodeOn || colorsOn) {
            n.data = (s.data || []).map((d) => {
              const o2 = (d && typeof d === "object") ? { ...d } : { value: d };
              if (explodeOn) o2.selected = !!fmt.explode[o2.name];
              if (colorsOn && fmt.colors[o2.name]) o2.itemStyle = { ...(o2.itemStyle || {}), color: fmt.colors[o2.name] };
              return o2;
            });
          }
          return n;
        });
      }
    }
    // Custom series (legend) names — applied last so colours still key off the original name
    if (fmt.seriesNames && Object.keys(fmt.seriesNames).length) {
      o.series = o.series.map((s) => { const nm = fmt.seriesNames[s.name]; return (nm && nm.trim()) ? { ...s, name: nm } : s; });
    }
    const mapAx = (ax, fn) => ax == null ? ax : (Array.isArray(ax) ? ax.map(fn) : fn(ax));
    // Grid / split lines (on-off · width · colour · frequency)
    {
      const g = fmt.grid || {};
      const off = fmt.gridlines === false;
      if (off || g.width != null || g.color || g.splitNumber != null) {
        o.xAxis = mapAx(o.xAxis, styleGridAxis); o.yAxis = mapAx(o.yAxis, styleGridAxis);
      }
      function styleGridAxis(ax) {
        if (!ax) return ax; const a = { ...ax };
        if (off) a.splitLine = { ...(a.splitLine || {}), show: false };
        else if (g.width != null || g.color) a.splitLine = { ...(a.splitLine || {}), show: true, lineStyle: { ...((a.splitLine && a.splitLine.lineStyle) || {}), ...(g.width != null ? { width: g.width } : {}), ...(g.color ? { color: g.color } : {}) } };
        if (!off && g.splitNumber != null) a.splitNumber = g.splitNumber;
        return a;
      }
    }
    // Axis scale (min/max on value axes) + label rotation
    {
      const ax = fmt.axis || {}; const has = (v) => v != null && v !== "";
      if (has(ax.xMin) || has(ax.xMax) || ax.xLabelRotate != null) o.xAxis = mapAx(o.xAxis, (a) => {
        if (!a) return a; const n = { ...a };
        if (a.type === "value") { if (has(ax.xMin)) n.min = +ax.xMin; if (has(ax.xMax)) n.max = +ax.xMax; }
        if (ax.xLabelRotate != null) n.axisLabel = { ...(a.axisLabel || {}), rotate: ax.xLabelRotate };
        return n;
      });
      if (has(ax.yMin) || has(ax.yMax) || ax.yLabelRotate != null) o.yAxis = mapAx(o.yAxis, (a) => {
        if (!a) return a; const n = { ...a };
        if (a.type === "value") { if (has(ax.yMin)) n.min = +ax.yMin; if (has(ax.yMax)) n.max = +ax.yMax; }
        if (ax.yLabelRotate != null) n.axisLabel = { ...(a.axisLabel || {}), rotate: ax.yLabelRotate };
        return n;
      });
    }
    // Text styling — colour / size / bold / italic across labels, legend, title, axis names
    {
      const t = fmt.text || {};
      if (t.color || t.size || t.bold || t.italic) {
        const tl = {};
        if (t.color) tl.color = t.color;
        if (t.size) tl.fontSize = t.size;
        if (t.bold) tl.fontWeight = "bold";
        if (t.italic) tl.fontStyle = "italic";
        const styleAxisText = (a) => a ? { ...a, axisLabel: { ...(a.axisLabel || {}), ...tl }, nameTextStyle: { ...(a.nameTextStyle || {}), ...(t.color ? { color: t.color } : {}) } } : a;
        o.xAxis = mapAx(o.xAxis, styleAxisText); o.yAxis = mapAx(o.yAxis, styleAxisText);
        if (o.legend) o.legend = { ...o.legend, textStyle: { ...(o.legend.textStyle || {}), ...tl } };
        if (o.title) o.title = { ...o.title, textStyle: { ...(o.title.textStyle || {}), ...(t.color ? { color: t.color } : {}), ...(t.bold ? { fontWeight: "bold" } : {}), ...(t.italic ? { fontStyle: "italic" } : {}) } };
        o.series = o.series.map((s) => (s.label && s.label.show) ? { ...s, label: { ...s.label, ...tl } } : s);
      }
    }
    // Plot-only resize — extra grid padding, keeps the container & legend fixed
    {
      const pi = fmt.plotInset || {};
      if ((pi.top || pi.bottom || pi.left || pi.right) && o.grid && !Array.isArray(o.grid)) {
        const b = o.grid, nz = (v) => typeof v === "number" ? v : 0;
        o.grid = { ...b, top: nz(b.top) + (pi.top || 0), bottom: nz(b.bottom) + (pi.bottom || 0), left: nz(b.left) + (pi.left || 0), right: nz(b.right) + (pi.right || 0) };
      }
    }
    // Background colour (also used by PNG export)
    if (fmt.background) o.backgroundColor = fmt.background;
    // Smooth override for line series
    if (fmt.smooth != null) {
      o.series = o.series.map((s) => s.type === "line" ? { ...s, smooth: fmt.smooth ? 0.3 : false } : s);
    }
    return o;
  }


  window.buildVizOption = buildOption;   // public name — dashMode + vizMode both call this
  window.applyVizFormat = applyFormat;
})();
