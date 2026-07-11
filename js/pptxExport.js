/* insight Analytics — native PowerPoint (.pptx) chart export (window.PptxExport)
   Uses PptxGenJS (vendored, optional) to emit a native, editable PPT chart —
   PowerPoint's "Edit Data" opens the embedded worksheet. Supported chart types
   map to PPT-native ones (bar/line/area/pie); others fall back to image export. */
(function () {
  "use strict";

  const SUPPORTED = { bar: 1, hbar: 1, line: 1, area: 1, pie: 1 };
  const supported = (type) => !!SUPPORTED[type];

  const numOf = (v) => Array.isArray(v) ? (+v[v.length - 1] || 0) : (v && v.value != null ? (+v.value || 0) : (+v || 0));

  // Pull categories + series values out of the rendered ECharts option.
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
      .map((s) => ({ name: String(s.name || "series"), labels: cats, values: (s.data || []).map(numOf) }));
    return { kind: "cat", series, cats };
  }

  // returns { ok, reason? }
  function exportChart(viz, option, filename, title) {
    if (typeof window.PptxGenJS === "undefined") return { ok: false, reason: "no-lib" };
    if (!supported(viz.type)) return { ok: false, reason: "unsupported" };
    if (!option || !option.series) return { ok: false, reason: "no-chart" };
    try {
      const pptx = new window.PptxGenJS();
      pptx.defineLayout({ name: "INSIGHT_W", width: 10, height: 5.63 });
      pptx.layout = "INSIGHT_W";
      const slide = pptx.addSlide();
      const data = extract(viz, option);
      const CT = pptx.ChartType;
      const common = { x: 0.5, y: 0.5, w: 9, h: 4.6, showLegend: true, legendPos: "b", showTitle: !!title, title: title || "" };
      if (data.kind === "pie") {
        slide.addChart(CT.pie, [{ name: title || "Series", labels: data.labels, values: data.values }], { ...common, showPercent: true });
      } else {
        if (!data.series.length) return { ok: false, reason: "no-chart" };
        const chartType = viz.type === "line" ? CT.line : viz.type === "area" ? CT.area : CT.bar;
        slide.addChart(chartType, data.series, { ...common, barDir: viz.type === "hbar" ? "bar" : "col" });
      }
      pptx.writeFile({ fileName: (filename || "chart") + ".pptx" });
      return { ok: true };
    } catch (e) { window.LOG && window.LOG.error && window.LOG.error("export", "pptx failed: " + e.message); return { ok: false, reason: e.message || "error" }; }
  }

  window.PptxExport = { supported, exportChart };
})();
