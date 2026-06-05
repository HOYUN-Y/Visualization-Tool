/* NØDE — Visualization Builder: shelves + Show Me + ECharts canvas */
(function () {
  const { useStore, actions, derive, stat, aggFn } = window.Store;
  const Icon = window.Icon, NODE = window.NODE, Charts = window.Charts;
  const { isNumType, Popover } = window;
  const EChart = Charts.EChart;

  const AGGS = ["sum", "avg", "median", "min", "max", "count", "countd"];

  // Grouped chart type registry
  const CHART_GROUPS = [
    {
      label: "Basic",
      types: [
        { id: "bar",      label: "Bar",       icon: "bar",       need: "1d+1m" },
        { id: "hbar",     label: "H-Bar",     icon: "bar",       need: "1d+1m" },
        { id: "line",     label: "Line",      icon: "line",      need: "1d+1m" },
        { id: "area",     label: "Area",      icon: "area",      need: "1d+1m" },
        { id: "pie",      label: "Pie",       icon: "pie",       need: "1d+1m" },
        { id: "scatter",  label: "Scatter",   icon: "scatter",   need: "2m"    },
        { id: "treemap",  label: "Treemap",   icon: "treemap",   need: "1d+1m" },
        { id: "heatmap",  label: "Heatmap",   icon: "heatmap",   need: "2d+1m" },
      ],
    },
    {
      label: "Advanced",
      types: [
        { id: "bubble",    label: "Bubble",    icon: "bubble",    need: "3m"    },
        { id: "waterfall", label: "Waterfall", icon: "waterfall", need: "1d+1m" },
        { id: "funnel",    label: "Funnel",    icon: "funnel",    need: "1d+1m" },
        { id: "radar",     label: "Radar",     icon: "radar",     need: "1d+2m" },
        { id: "boxplot",   label: "Box",       icon: "boxplot",   need: "1d+1m" },
        { id: "violin",    label: "Violin",    icon: "violin",    need: "1d+1m" },
        { id: "sankey",    label: "Sankey",    icon: "sankey",    need: "2d+1m" },
        { id: "sunburst",  label: "Sunburst",  icon: "sunburst",  need: "2d+1m" },
      ],
    },
    {
      label: "Financial",
      types: [
        { id: "candlestick", label: "Candle",   icon: "candle",     need: "fin" },
        { id: "ohlcvol",     label: "OHLC+Vol", icon: "candle",     need: "fin" },
        { id: "cumreturn",   label: "Return",   icon: "cumreturn",  need: "fin" },
      ],
    },
    {
      label: "Special",
      types: [
        { id: "facet", label: "Facet", icon: "facet", need: "2d+1m" },
      ],
    },
  ];
  const ALL_CHART_TYPES = CHART_GROUPS.flatMap((g) => g.types);

  // expose for double-click add from explorer
  window.VizAddField = (f) => {
    const st = window.Store.getState();
    if (st.mode !== "visualize") return;
    if (f.role === "measure") actions.addToShelf("rows", f);
    else actions.addToShelf("cols", f);
  };

  function readField(e) {
    try { return JSON.parse(e.dataTransfer.getData("application/node-field")); } catch (x) { return null; }
  }

  function Shelf({ label, kind, chips, accept }) {
    const [over, setOver] = React.useState(false);
    const onDrop = (e) => {
      e.preventDefault(); setOver(false);
      const f = readField(e); if (!f) return;
      if (kind === "cols") actions.addToShelf("cols", f);
      else if (kind === "rows") actions.addToShelf("rows", f.role === "measure" ? f : { ...f, agg: "countd" });
      else if (kind === "color") actions.addToShelf("color", f);
    };
    return (
      <div className="shelf">
        <span className="shelf-label">{label}</span>
        <div className={"shelf-well" + (over ? " over" : "")}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)} onDrop={onDrop}>
          {chips}
          {(!chips || (Array.isArray(chips) && chips.length === 0)) && <span className="shelf-hint">{accept}</span>}
        </div>
      </div>
    );
  }

  function MeasureChip({ chip }) {
    const [menu, setMenu] = React.useState(null);
    return (
      <span className="chip meas">
        <span className="agg" onClick={(e) => setMenu(e.currentTarget.getBoundingClientRect())}>{chip.agg.toUpperCase()}</span>
        {chip.label}
        <span className="x" onClick={() => actions.removeFromShelf("rows", chip.key)}><Icon name="x" size={12} /></span>
        {menu && (
          <Popover anchor={menu} onClose={() => setMenu(null)}>
            {AGGS.map((a) => (
              <div key={a} className="pi" onClick={() => { actions.setRowAgg(chip.key, a); setMenu(null); }}>
                {chip.agg === a && <Icon name="check" size={13} />}<span style={{ marginLeft: chip.agg === a ? 0 : 21 }}>{a.toUpperCase()}</span>
              </div>
            ))}
          </Popover>
        )}
      </span>
    );
  }

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

  // ─── Main option builder ──────────────────────────────────────────────────
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
          animation: false, backgroundColor: "transparent",
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
          animation: false, backgroundColor: "transparent",
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
        animation: false, backgroundColor: "transparent",
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
      if (colorKey) {
        const groups = new Map();
        for (const r of rows) { const g = r[colorKey]; if (!groups.has(g)) groups.set(g, []); groups.get(g).push([r[mx.key], r[my.key]]); }
        series = [...groups.entries()].slice(0, 12).map(([g, data], i) => ({ name: String(g), type: "scatter", symbolSize: 7, itemStyle: { color: pal[i % 8], opacity: 0.75 }, data }));
      } else {
        series = [{ type: "scatter", symbolSize: 7, itemStyle: { color: pal[0], opacity: 0.7 }, data: rows.map((r) => [r[mx.key], r[my.key]]) }];
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
      const mkData = (arr) => arr.map((r) => [r[mx.key], r[my.key], r[ms.key]]);
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

    // ── Bar / Line / Area ────────────────────────────────────────────────────
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
      series = measures.map((m, mi) => ({
        name: m.label, type: type === "line" || type === "area" ? "line" : "bar",
        areaStyle: type === "area" ? { opacity: 0.22 } : undefined,
        smooth: type === "line" || type === "area" ? 0.2 : false, symbol: "none",
        itemStyle: { color: pal[mi % 8], borderRadius: type.includes("bar") ? (horiz ? [0, 3, 3, 0] : [3, 3, 0, 0]) : 0 },
        data: pairs.map((p) => p.vals[mi]),
      }));
      cats.length = 0; cats.push(...sortedCats);
    }
    const catAxis = { type: "category", data: cats, ...axisCommon, axisLabel: { ...axisCommon.axisLabel, rotate: !horiz && cats.length > 7 ? 32 : 0, interval: 0 } };
    const valAxis = { type: "value", ...axisCommon, axisLabel: { ...axisCommon.axisLabel, formatter: fmtVal } };
    const hasLegend = (colorKey && colorKey !== xKey) || measures.length > 1;
    return {
      ...base,
      grid: { ...base.grid, top: hasLegend ? 30 : 16, bottom: horiz ? 8 : (cats.length > 7 ? 40 : 8) },
      legend: hasLegend ? { top: 0, type: "scroll", textStyle: { color: c.text, fontSize: 11 }, icon: "roundRect" } : undefined,
      tooltip: { ...base.tooltip, trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: fmtVal },
      xAxis: horiz ? valAxis : catAxis,
      yAxis: horiz ? { ...catAxis, inverse: true } : valAxis,
      series,
    };
  }

  // ─── Facet Grid (Small Multiples) ─────────────────────────────────────────
  function FacetGrid({ rows, cols, measures, color, theme }) {
    if (!color || !cols.length || !measures.length) {
      return <div className="empty"><Icon name="facet" /><div className="t">Facet Grid</div><div className="s">Drop a dimension on <b>Columns</b>, a measure on <b>Rows</b>, and a <b>Color</b> dimension to facet by.</div></div>;
    }
    const c = Charts.themeColors();
    const facetVals = [...new Set(rows.map((r) => r[color.key]))].sort().slice(0, 12);
    return (
      <div className="facet-grid">
        {facetVals.map((fv, fi) => {
          const subRows = rows.filter((r) => r[color.key] === fv);
          const opt = buildOption("bar", { rows: subRows, cols, measures, color: null, sortDesc: false, topN: 8 });
          // make titles/grids more compact
          const compactOpt = {
            ...opt,
            grid: { top: 28, bottom: 24, left: 38, right: 8 },
            title: { text: String(fv), textStyle: { color: c.text, fontSize: 11, fontWeight: 600, fontFamily: "IBM Plex Sans" }, top: 4, left: 6 },
            tooltip: opt.tooltip ? { ...opt.tooltip, confine: true } : undefined,
          };
          return <div key={fv} className="facet-cell"><EChart option={compactOpt} theme={theme} style={{ width: "100%", height: "100%" }} /></div>;
        })}
      </div>
    );
  }

  // ─── Center panel ─────────────────────────────────────────────────────────
  function VizCenter() {
    const activeId = useStore((s) => s.activeId);
    const viz = useStore((s) => s.viz);
    const theme = useStore((s) => s.theme);
    const { rows, columns } = derive.getActiveData(activeId);
    const measures = viz.rows;
    const colsChips = viz.cols.map((c) => (
      <span key={c.key} className="chip dim">
        <Icon name={c.type === "datetime" ? "trend" : "layers"} size={12} style={{ opacity: 0.6 }} />
        {c.label}
        <span className="x" onClick={() => actions.removeFromShelf("cols", c.key)}><Icon name="x" size={12} /></span>
      </span>
    ));
    const rowChips = measures.map((c) => <MeasureChip key={c.key} chip={c} />);

    const option = React.useMemo(() => {
      if (viz.type === "facet") return null;
      return buildOption(viz.type, { rows, cols: viz.cols, measures, color: viz.color, sortDesc: viz.sortDesc, topN: viz.topN });
    }, [viz, rows, theme]);

    const title = measures.length && viz.cols.length
      ? `${measures.map((m) => `${m.agg.toUpperCase()}(${m.label})`).join(", ")} by ${viz.cols.map((c) => c.label).join(", ")}`
      : "Untitled visualization";

    return (
      <React.Fragment>
        <div className="phead">
          <span className="ttl" style={{ textTransform: "none", fontSize: "var(--fs-13)", letterSpacing: 0, color: "var(--tx-hi)" }}>{title}</span>
          <div className="spacer" />
          <button className="btn ghost sm"><Icon name="download" /> PNG</button>
          <button className="btn sm"><Icon name="save" /> Save to dashboard</button>
        </div>
        <div className="shelfbar">
          <Shelf label="Columns" kind="cols" chips={colsChips} accept="Drop dimensions (x-axis / groups)" />
          <Shelf label="Rows" kind="rows" chips={rowChips} accept="Drop measures (y-axis values)" />
        </div>
        <div className="vizcanvas">
          {viz.type === "facet"
            ? <FacetGrid rows={rows} cols={viz.cols} measures={measures} color={viz.color} theme={theme} />
            : (measures.length || viz.cols.length
              ? <EChart option={option} theme={theme} style={{ height: "100%" }} />
              : <div className="empty"><Icon name="visualize" /><div className="t">Build a chart</div><div className="s">Drag fields from the Data Explorer onto the <b>Columns</b> and <b>Rows</b> shelves — or double-click a field. Then pick a chart type on the right.</div></div>
            )
          }
        </div>
      </React.Fragment>
    );
  }

  // ─── Right panel: Show Me + Marks ─────────────────────────────────────────
  function VizPanel() {
    const viz = useStore((s) => s.viz);
    const activeId = useStore((s) => s.activeId);
    const { columns } = derive.getActiveData(activeId);
    const nDim = viz.cols.length, nMeas = viz.rows.length;
    const hasOHLC = ["open", "high", "low", "close"].every((k) => columns.some((c) => c.key === k));

    const valid = (need) => {
      if (need === "fin")    return hasOHLC;
      if (need === "3m")     return nMeas >= 3;
      if (need === "2m")     return nMeas >= 2;
      if (need === "1d+2m")  return nDim >= 1 && nMeas >= 2;
      if (need === "2d+1m")  return nDim >= 2 && nMeas >= 1;
      return nDim >= 1 && nMeas >= 1;
    };

    return (
      <div className="vizpanel">
        {CHART_GROUPS.map((group) => (
          <div key={group.label} className="cp-block">
            <div className="cp-blocktitle">{group.label}</div>
            <div className="showme">
              {group.types.map((t) => {
                const ok = valid(t.need);
                return (
                  <button key={t.id} className={"sm-tile" + (viz.type === t.id ? " on" : "") + (ok ? "" : " disabled")}
                    disabled={!ok} onClick={() => actions.setViz({ type: t.id })}
                    title={ok ? t.label : `Needs ${t.need}`}>
                    <Icon name={t.icon} size={18} /><span>{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <div className="cp-block">
          <div className="cp-blocktitle">Marks</div>
          <div className="markrow">
            <span className="mark-lbl"><Icon name="layers" size={13} /> Color</span>
            <div className="mark-well" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { const f = readField(e); if (f) actions.addToShelf("color", f); }}>
              {viz.color
                ? <span className="chip dim">{viz.color.label}<span className="x" onClick={() => actions.removeFromShelf("color")}><Icon name="x" size={12} /></span></span>
                : <span className="mark-hint">Drop a dimension</span>}
            </div>
          </div>
        </div>

        <div className="cp-block">
          <div className="cp-blocktitle">Sort & limit</div>
          <div className="ctl-row">
            <span className="fieldlabel" style={{ margin: 0 }}>Order</span>
            <div className="seg">
              <button className={viz.sortDesc ? "on" : ""} onClick={() => actions.setViz({ sortDesc: true })}>Desc</button>
              <button className={!viz.sortDesc ? "on" : ""} onClick={() => actions.setViz({ sortDesc: false })}>Asc</button>
            </div>
          </div>
          <div className="ctl-row">
            <span className="fieldlabel" style={{ margin: 0 }}>Top N</span>
            <div className="seg">
              {[0, 5, 10, 20].map((n) => <button key={n} className={viz.topN === n ? "on" : ""} onClick={() => actions.setViz({ topN: n })}>{n === 0 ? "All" : n}</button>)}
            </div>
          </div>
        </div>

        <div className="cp-block">
          <div className="cp-blocktitle">Quick fields</div>
          <div className="quickfields">
            {columns.map((c) => (
              <div key={c.key} className={"field " + (c.role === "measure" ? "meas" : "dim")} draggable
                onDragStart={(e) => e.dataTransfer.setData("application/node-field", JSON.stringify(c))}
                onDoubleClick={() => window.VizAddField(c)}>
                <span className="ic">{c.type === "datetime" ? "◷" : c.role === "measure" ? "#" : "Abc"}</span>
                <span className="nm">{c.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  window.VizMode = function () {
    return <window.Workspace left={<window.DatasetTree />} leftTitle="Data Explorer"
      center={<VizCenter />} right={<VizPanel />} rightTitle="Show Me & Marks" />;
  };
  window.buildVizOption = buildOption; // reused by dashboard
})();
