/* insight Analytics — native PowerPoint (.pptx) chart export (window.PptxExport)
   Uses PptxGenJS (vendored, optional) to emit a native, editable PPT chart —
   PowerPoint's "Edit Data" opens the embedded worksheet. Supported chart types
   map to PPT-native ones (bar/line/area/pie); others (candlestick, scatter, box…)
   have no PowerPoint-native equivalent → caller falls back to image/SVG export.

   P10 mapping expansion (FOLLOWUP §3 P10.1): the rendered ECharts option is now read for
   richer native mappings —
     • STACKED  — a series `stack` key → PptxGenJS `barGrouping: "stacked"` (bar AND area; the
                  OOXML `<c:grouping val="stacked"/>` is emitted for both by the vendored build).
     • SECONDARY AXIS (보조축) — a series `yAxisIndex === 1` → a combo chart whose secondary
                  series carry `secondaryValAxis/secondaryCatAxis` so the right-hand axis survives.
     • COMBO — mixed series types (bar + line) → a multi-type `addChart([...])` call.
     • CANDLESTICK — no PPT-native stock chart exists; honestly reported as `unsupported`
                  so the UI routes the user to image/SVG export (no fake mapping).

   Layering (deterministic parts unit-testable in Node, PptxGenJS calls stay in the browser):
     • Pure/tested: extract() reads categories + per-series {type,axis,stack} from the option;
       planChart() decides the PPT chart structure and returns a plan (or {ok:false,reason}).
     • Browser: exportChart() consumes the plan and drives window.PptxGenJS. */
(function () {
  "use strict";

  // PPT-native chart types we can emit as editable charts. Others fall back to image/SVG.
  const SUPPORTED = { bar: 1, hbar: 1, line: 1, area: 1, pie: 1 };
  const supported = (type) => !!SUPPORTED[type];

  const numOf = (v) => Array.isArray(v) ? (+v[v.length - 1] || 0) : (v && v.value != null ? (+v.value || 0) : (+v || 0));

  // Pull categories + per-series {name,type,axis,stacked,area,values} out of a rendered ECharts option.
  // ECharts renders "area" as a line series with an areaStyle, so we keep an explicit `area` flag.
  function extract(viz, option) {
    if (viz.type === "pie") {
      const data = (option.series && option.series[0] && option.series[0].data) || [];
      return { kind: "pie", labels: data.map((d) => String(d && d.name != null ? d.name : d)), values: data.map((d) => numOf(d)) };
    }
    const axes = [].concat(option.xAxis || [], option.yAxis || []);
    const catAxis = axes.find((a) => a && a.type === "category");
    const cats = ((catAxis && catAxis.data) || []).map(String);
    const series = (option.series || [])
      .filter((s) => s.type === "bar" || s.type === "line")
      .map((s) => ({
        name: String(s.name || "series"),
        type: s.type,                          // "bar" | "line" (area is line + areaStyle)
        axis: s.yAxisIndex === 1 ? 1 : 0,      // secondary value axis?
        stacked: s.stack != null && s.stack !== "",
        area: !!s.areaStyle,
        labels: cats,
        values: (s.data || []).map(numOf),
      }));
    return { kind: "cat", series, cats };
  }

  // Map one extracted series to a PPT-native chart type name.
  function chartTypeOf(s, vizType) {
    if (s.area || vizType === "area") return "area";
    return s.type === "line" ? "line" : "bar";
  }

  // Pure planner: decide the PPT chart structure from viz + rendered option (testable in Node).
  // Returns { ok:false, reason } or a plan:
  //   { ok:true, kind:"pie", labels, values }
  //   { ok:true, kind:"cat", combo:false, stacked:bool, entries:[{chartType,series,barDir}] }
  //   { ok:true, kind:"cat", combo:true, secondary:bool, entries:[{chartType,series,barDir,secondary}] }
  function planChart(viz, option) {
    if (!supported(viz.type)) return { ok: false, reason: "unsupported" };
    if (!option || !option.series) return { ok: false, reason: "no-chart" };
    const data = extract(viz, option);

    if (data.kind === "pie") {
      if (!data.values.length) return { ok: false, reason: "no-chart" };
      return { ok: true, kind: "pie", labels: data.labels, values: data.values };
    }
    if (!data.series.length) return { ok: false, reason: "no-chart" };

    const horiz = viz.type === "hbar";
    const barDir = horiz ? "bar" : "col";
    const hasSecondary = !horiz && data.series.some((s) => s.axis === 1);
    const ctList = data.series.map((s) => chartTypeOf(s, viz.type));
    const isCombo = new Set(ctList).size > 1;

    // Combo (mixed types) or a secondary axis → one entry per (chartType, axis) bucket.
    if (isCombo || hasSecondary) {
      const buckets = new Map();
      data.series.forEach((s, i) => {
        const ct = ctList[i];
        const axis = s.axis === 1 ? 1 : 0;
        const key = ct + ":" + axis;
        if (!buckets.has(key)) buckets.set(key, { chartType: ct, axis, series: [] });
        buckets.get(key).series.push({ name: s.name, labels: s.labels, values: s.values });
      });
      const entries = [...buckets.values()].map((b) => ({
        chartType: b.chartType, series: b.series, barDir, secondary: b.axis === 1,
      }));
      return { ok: true, kind: "cat", combo: true, secondary: hasSecondary, entries };
    }

    // Single-type chart (bar / line / area). `stack` on any series → stacked grouping.
    const chartType = chartTypeOf(data.series[0], viz.type);
    const stacked = data.series.some((s) => s.stacked);
    return {
      ok: true, kind: "cat", combo: false, stacked,
      entries: [{ chartType, series: data.series.map((s) => ({ name: s.name, labels: s.labels, values: s.values })), barDir }],
    };
  }

  // returns { ok, reason? }
  function exportChart(viz, option, filename, title) {
    if (typeof window.PptxGenJS === "undefined") return { ok: false, reason: "no-lib" };
    const plan = planChart(viz, option);
    if (!plan.ok) return plan;
    try {
      const pptx = new window.PptxGenJS();
      pptx.defineLayout({ name: "INSIGHT_W", width: 10, height: 5.63 });
      pptx.layout = "INSIGHT_W";
      const slide = pptx.addSlide();
      const CT = pptx.ChartType;
      const ctMap = { bar: CT.bar, line: CT.line, area: CT.area };
      const common = { x: 0.5, y: 0.5, w: 9, h: 4.6, showLegend: true, legendPos: "b", showTitle: !!title, title: title || "" };

      if (plan.kind === "pie") {
        slide.addChart(CT.pie, [{ name: title || "Series", labels: plan.labels, values: plan.values }], { ...common, showPercent: true });
      } else if (plan.combo) {
        // Multi-type combo: one chart entry per (type, axis) bucket; secondary bucket gets the 2nd axis.
        const multi = plan.entries.map((e) => ({
          type: ctMap[e.chartType] || CT.bar,
          data: e.series,
          options: Object.assign({ barDir: e.barDir }, e.secondary ? { secondaryValAxis: true, secondaryCatAxis: true } : {}),
        }));
        slide.addChart(multi, { ...common });
      } else {
        const e = plan.entries[0];
        slide.addChart(ctMap[e.chartType] || CT.bar, e.series, {
          ...common, barDir: e.barDir, ...(plan.stacked ? { barGrouping: "stacked" } : {}),
        });
      }
      pptx.writeFile({ fileName: (filename || "chart") + ".pptx" });
      return { ok: true };
    } catch (e) { window.LOG && window.LOG.error && window.LOG.error("export", "pptx failed: " + e.message); return { ok: false, reason: e.message || "error" }; }
  }

  const api = { supported, extract, planChart, exportChart };
  if (typeof window !== "undefined") window.PptxExport = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
