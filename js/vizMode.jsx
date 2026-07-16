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

  const MARKS = [["bar", "Bar"], ["line", "Line"], ["area", "Area"]];
  function MeasureChip({ chip, showMark, baseMark }) {
    const [menu, setMenu] = React.useState(null);
    const curMark = chip.mark || baseMark || "bar";
    const markIcon = showMark ? { bar: "bar", line: "line", area: "area" }[curMark] : null;
    return (
      <span className="chip meas">
        <span className="agg" onClick={(e) => setMenu(e.currentTarget.getBoundingClientRect())}>{chip.agg.toUpperCase()}</span>
        {showMark && <span className="mk" title={"mark: " + curMark + (chip.axis ? " · right axis" : "")} onClick={(e) => setMenu(e.currentTarget.getBoundingClientRect())}><Icon name={markIcon} size={11} />{chip.axis ? "R" : ""}</span>}
        {chip.label}
        <span className="x" onClick={() => actions.removeFromShelf("rows", chip.key)}><Icon name="x" size={12} /></span>
        {menu && (
          <Popover anchor={menu} onClose={() => setMenu(null)}>
            <div className="ph">Aggregation</div>
            {AGGS.map((a) => (
              <div key={a} className="pi" onClick={() => { actions.setRowAgg(chip.key, a); setMenu(null); }}>
                {chip.agg === a && <Icon name="check" size={13} />}<span style={{ marginLeft: chip.agg === a ? 0 : 21 }}>{a.toUpperCase()}</span>
              </div>
            ))}
            {showMark && (
              <React.Fragment>
                <div className="sep" />
                <div className="ph">Mark</div>
                {MARKS.map(([mk, lbl]) => (
                  <div key={mk} className="pi" onClick={() => { actions.setRowMark(chip.key, mk); }}>
                    {curMark === mk && <Icon name="check" size={13} />}<span style={{ marginLeft: curMark === mk ? 0 : 21 }}>{lbl}</span>
                  </div>
                ))}
                <div className="sep" />
                <div className="ph">Axis</div>
                {[[0, "Left (primary)"], [1, "Right (secondary)"]].map(([ax, lbl]) => (
                  <div key={ax} className="pi" onClick={() => { actions.setRowAxis(chip.key, ax); }}>
                    {(chip.axis || 0) === ax && <Icon name="check" size={13} />}<span style={{ marginLeft: (chip.axis || 0) === ax ? 0 : 21 }}>{lbl}</span>
                  </div>
                ))}
              </React.Fragment>
            )}
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

  function rgbToHex(rgb) {
    const m = String(rgb).match(/(\d+),\s*(\d+),\s*(\d+)/);
    if (!m) return "#888888";
    return "#" + [m[1], m[2], m[3]].map((x) => Math.max(0, Math.min(255, +x)).toString(16).padStart(2, "0")).join("");
  }

  // ─── Format post-processor: apply legend/labels/colors/gridlines to any option ─
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

  // ─── Sheet tab bar (multiple visualizations) ─────────────────────────────
  function VizTabs() {
    const sheets = useStore((s) => s.vizSheets);
    const active = useStore((s) => s.vizActive);
    const globalActive = useStore((s) => s.activeId);
    const [editId, setEditId] = React.useState(null);
    const [draft, setDraft] = React.useState("");
    const commit = () => { if (editId) actions.renameVizSheet(editId, draft.trim()); setEditId(null); };
    const activeSheet = sheets.find((x) => x.id === active) || sheets[0];
    const datasets = window.NODE.datasets;
    return (
      <div className="viz-tabs">
        <div className="viz-tabs-scroll">
          {sheets.map((sh) => (
            <div key={sh.id} className={"viz-tab" + (sh.id === active ? " on" : "")}
              onClick={() => sh.id !== active && actions.setVizActive(sh.id)}
              onDoubleClick={() => { setEditId(sh.id); setDraft(sh.name); }}
              title="더블클릭해서 이름 변경">
              <Icon name="visualize" size={12} style={{ opacity: 0.6 }} />
              {editId === sh.id
                ? <input autoFocus className="viz-tab-edit" value={draft}
                    onChange={(e) => setDraft(e.target.value)} onBlur={commit}
                    onKeyDown={(e) => { if (e.key === "Enter") commit(); else if (e.key === "Escape") setEditId(null); }}
                    onClick={(e) => e.stopPropagation()} />
                : <span className="viz-tab-nm">{sh.name}</span>}
              {sh.id === active && (
                <span className="viz-tab-dup" title="탭 복제"
                  onClick={(e) => { e.stopPropagation(); actions.duplicateVizSheet(sh.id); }}><Icon name="duplicate" size={11} /></span>
              )}
              {sheets.length > 1 && (
                <span className="viz-tab-x" title="탭 닫기"
                  onClick={(e) => { e.stopPropagation(); actions.removeVizSheet(sh.id); }}><Icon name="x" size={11} /></span>
              )}
            </div>
          ))}
          <button className="viz-tab-add" title="새 시각화 탭" onClick={() => actions.addVizSheet()}><Icon name="plus" size={13} /></button>
        </div>
        <div className="spacer" />
        <div className="viz-tab-ds" title="이 탭의 데이터셋">
          <Icon name="layers" size={12} style={{ opacity: 0.6 }} />
          <select className="sel" value={activeSheet.datasetId || globalActive}
            onChange={(e) => actions.setSheetDataset(activeSheet.id, e.target.value)}>
            {datasets.map((d) => <option key={d.id} value={d.id}>{d.short}</option>)}
          </select>
        </div>
      </div>
    );
  }

  // ─── Center panel ─────────────────────────────────────────────────────────
  function VizCenter() {
    const activeId = useStore((s) => s.activeId);
    const vizSheets = useStore((s) => s.vizSheets);
    const vizActive = useStore((s) => s.vizActive);
    const viz = vizSheets.find((x) => x.id === vizActive) || vizSheets[0];
    // Keep this tab's remembered dataset in sync with the active dataset, so the
    // shelves always match the rendered data (switching datasets can't mismatch).
    React.useEffect(() => {
      if (viz && viz.datasetId !== activeId) actions.setSheetDataset(viz.id, activeId);
    }, [activeId, viz && viz.id]);
    const theme = useStore((s) => s.theme);
    const lang = useStore((s) => s.tweaks.lang) || "ko";
    const T = (k) => window.I18N.t(lang, k);
    const { rows, columns } = derive.getActiveData(activeId);
    const measures = viz.rows;
    const colsChips = viz.cols.map((c) => (
      <span key={c.key} className="chip dim">
        <Icon name={c.type === "datetime" ? "trend" : "layers"} size={12} style={{ opacity: 0.6 }} />
        {c.label}
        <span className="x" onClick={() => actions.removeFromShelf("cols", c.key)}><Icon name="x" size={12} /></span>
      </span>
    ));
    const markable = ["bar", "line", "area"].includes(viz.type) && !viz.color;
    const baseMark = viz.type === "line" || viz.type === "area" ? viz.type : "bar";
    const rowChips = measures.map((c) => <MeasureChip key={c.key} chip={c} showMark={markable} baseMark={baseMark} />);

    const option = React.useMemo(() => {
      if (viz.type === "facet") return null;
      return applyFormat(buildOption(viz.type, { rows, cols: viz.cols, measures, color: viz.color, sortDesc: viz.sortDesc, topN: viz.topN }), viz.format);
    }, [viz, rows, theme]);

    const title = measures.length && viz.cols.length
      ? `${measures.map((m) => `${m.agg.toUpperCase()}(${m.label})`).join(", ")} by ${viz.cols.map((c) => c.label).join(", ")}`
      : "Untitled visualization";

    const [expOpen, setExpOpen] = React.useState(false);
    const doExport = (kind, bg) => {
      const name = "insight-" + (viz.type || "chart");
      const bgVal = bg === "current" ? undefined : (bg === "white" ? "#ffffff" : "transparent");
      const inst = chartInstRef.current;   // C4: export this chart, not the global last one
      const ok = kind === "svg" ? window.Charts.downloadSVG(name, bgVal, inst) : window.Charts.downloadPNG(name, bgVal, inst);
      if (!ok) alert("차트를 먼저 그려주세요. / Draw a chart first.");
      else window.LOG && window.LOG.info("export", kind.toUpperCase() + " exported · " + bg);
      setExpOpen(false);
    };
    const doCopy = () => {
      window.Charts.copyPNG(undefined, chartInstRef.current).then((ok) => alert(ok ? "클립보드에 복사됨 · 파워포인트에서 Ctrl+V로 붙여넣기" : "복사를 지원하지 않는 브라우저입니다. PNG 다운로드를 사용하세요."));
      setExpOpen(false);
    };
    const doPPTX = () => {
      const inst = chartInstRef.current;   // C4: PPTX from this chart's option
      const opt = inst ? inst.getOption() : (window.Charts.lastInst ? window.Charts.lastInst.getOption() : null);
      const r = window.PptxExport ? window.PptxExport.exportChart(viz, opt, "insight-" + (viz.type || "chart"), (viz.format && viz.format.title && viz.format.title.text) || "") : { ok: false, reason: "no-lib" };
      if (!r.ok) {
        if (r.reason === "no-lib") alert("PowerPoint 내보내기 라이브러리(PptxGenJS)가 아직 설치되지 않았습니다.\nvendor/pptxgenjs/pptxgen.bundle.js 를 추가하세요 (vendor/pptxgenjs/README.md 참고).");
        else if (r.reason === "unsupported") alert("이 차트 종류(캔들스틱·분산형·박스플롯 등)는 PPT 네이티브 차트(데이터 편집)로 대응되는 형식이 없습니다.\n막대·라인·영역·파이(스택·보조축·콤보 포함)만 가능 — 나머지는 이미지/SVG로 내보내세요.");
        else if (r.reason === "no-chart") alert("차트를 먼저 그려주세요.");
        else alert("PPTX 내보내기 실패: " + r.reason);
      } else window.LOG && window.LOG.info("export", "PPTX exported");
      setExpOpen(false);
    };
    const piStyle = { width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 8, padding: "7px 14px" };
    const saveToDash = () => {
      if (!measures.length) { alert("측정값을 먼저 올려주세요. / Add a measure first."); return; }
      const st = window.Store.getState();
      const sheet = (st.dash.sheets || []).find((x) => x.id === st.dash.active) || (st.dash.sheets || [])[0];
      const widgets = ((sheet && sheet.widgets) || []).slice();
      widgets.push({ id: "w" + Date.now(), type: "chart", x: 0, y: 99, w: 6, h: 6, title,
        spec: { chartType: viz.type, cols: viz.cols.map((c) => c.key), measures: measures.map((m) => [m.key, m.agg || "sum"]), color: viz.color ? viz.color.key : undefined } });
      actions.setDashWidgets(widgets);
      window.LOG && window.LOG.info("viz", "Saved chart to dashboard");
      alert("활성 대시보드에 추가되었습니다. / Added to the active dashboard.");
    };

    const chartH = (viz.format && viz.format.height) || null;
    const chartW = (viz.format && viz.format.width) || null;
    // ── Free positioning (drag) for legend or title ──
    const canvasRef = React.useRef(null);
    // C4: capture *this* chart's instance so export targets it explicitly
    // (not the global lastInst, which facet cells / other modes overwrite).
    const chartInstRef = React.useRef(null);
    const [poseTarget, setPoseTarget] = React.useState(null);   // "legend" | "title" | null
    React.useEffect(() => {
      const h = (e) => setPoseTarget((e.detail && e.detail.target) || "legend");
      window.addEventListener("viz-pose", h);
      return () => window.removeEventListener("viz-pose", h);
    }, []);
    const poseFmt = poseTarget ? ((viz.format && viz.format[poseTarget]) || {}) : {};
    const poseFree = !!poseFmt.free;
    const pfx = poseFmt.fx != null ? poseFmt.fx : 0.5, pfy = poseFmt.fy != null ? poseFmt.fy : (poseTarget === "title" ? 0.02 : 0.04);
    React.useEffect(() => { if (poseTarget && !poseFree) setPoseTarget(null); }, [poseFree, poseTarget]);
    const onHandleDown = (e) => {
      e.preventDefault(); e.stopPropagation();
      const rect = canvasRef.current.getBoundingClientRect();
      const hr = e.currentTarget.getBoundingClientRect();
      const offX = e.clientX - hr.left, offY = e.clientY - hr.top;
      const tgt = poseTarget;
      const move = (ev) => {
        const nfx = Math.max(0, Math.min(0.95, (ev.clientX - offX - rect.left) / rect.width));
        const nfy = Math.max(0, Math.min(0.92, (ev.clientY - offY - rect.top) / rect.height));
        actions.setFormat({ [tgt]: { fx: nfx, fy: nfy } });
      };
      const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
      window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
    };
    const showPose = poseTarget && poseFree && (measures.length || viz.cols.length) && viz.type !== "facet";

    // ── Drag-to-resize chart from any edge (PowerPoint-style) ──
    const clampV = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const onEdgeDown = (edge) => (e) => {
      e.preventDefault(); e.stopPropagation();
      const startX = e.clientX, startY = e.clientY;
      const startH = canvasRef.current ? canvasRef.current.clientHeight : 400;
      const startW = canvasRef.current ? canvasRef.current.clientWidth : 600;
      const startOffTop = (viz.format && viz.format.offsetTop) || 0;
      const startOffLeft = (viz.format && viz.format.offsetLeft) || 0;
      const bottomPos = startOffTop + startH;          // keep the bottom edge fixed for the top handle
      const rightPos = startOffLeft + startW;          // keep the right edge fixed for the left handle
      const plotMode = (viz.format && viz.format.resizeMode) === "plot";
      const pi0 = (viz.format && viz.format.plotInset) || {};
      const clamp0 = (v) => Math.max(0, Math.min(600, v));
      document.body.style.cursor = (edge === "left" || edge === "right") ? "ew-resize" : "ns-resize";
      const move = (ev) => {
        const patch = {};
        if (plotMode) {
          const dx = ev.clientX - startX, dy = ev.clientY - startY;
          if (edge === "bottom") patch.plotInset = { bottom: clamp0((pi0.bottom || 0) - dy) };
          else if (edge === "top") patch.plotInset = { top: clamp0((pi0.top || 0) + dy) };
          else if (edge === "right") patch.plotInset = { right: clamp0((pi0.right || 0) - dx) };
          else if (edge === "left") patch.plotInset = { left: clamp0((pi0.left || 0) + dx) };
          actions.setFormat(patch);
          return;
        }
        if (edge === "bottom") patch.height = clampV(startH + (ev.clientY - startY), 180, 1800);
        else if (edge === "top") { const off = clampV(startOffTop + (ev.clientY - startY), 0, bottomPos - 180); patch.offsetTop = off; patch.height = bottomPos - off; }
        else if (edge === "right") patch.width = clampV(startW + (ev.clientX - startX), 260, 3200);
        else if (edge === "left") { const off = clampV(startOffLeft + (ev.clientX - startX), 0, rightPos - 260); patch.offsetLeft = off; patch.width = rightPos - off; }
        actions.setFormat(patch);
      };
      const up = () => { document.body.style.cursor = ""; window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
      window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
    };

    return (
      <React.Fragment>
        <VizTabs />
        <div className="phead">
          <span className="ttl" style={{ textTransform: "none", fontSize: "var(--fs-13)", letterSpacing: 0, color: "var(--tx-hi)" }}>{title}</span>
          <div className="spacer" />
          <div style={{ position: "relative" }}>
            <button className="btn ghost sm" onClick={() => setExpOpen((v) => !v)}><Icon name="download" /> Export</button>
            {expOpen && (
              <React.Fragment>
                <div style={{ position: "fixed", inset: 0, zIndex: 8000 }} onClick={() => setExpOpen(false)} />
                <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 8001, background: "var(--bg-2)", border: "1px solid var(--line-strong)", borderRadius: "var(--r-md)", boxShadow: "var(--shadow-pop)", minWidth: 200, overflow: "hidden", padding: "6px 0" }}>
                  <button className="pi" style={piStyle} onClick={doCopy}><Icon name="duplicate" size={13} /> 클립보드 복사 (PPT에 Ctrl+V)</button>
                  <div className="sep" />
                  <div className="ph" style={{ padding: "3px 12px" }}>PNG 이미지</div>
                  <button className="pi" style={piStyle} onClick={() => doExport("png", "current")}><Icon name="image" size={13} /> 현재 배경</button>
                  <button className="pi" style={piStyle} onClick={() => doExport("png", "white")}><Icon name="image" size={13} /> 흰색 배경</button>
                  <button className="pi" style={piStyle} onClick={() => doExport("png", "transparent")}><Icon name="image" size={13} /> 투명 배경</button>
                  <div className="sep" />
                  <div className="ph" style={{ padding: "3px 12px" }}>SVG · 벡터</div>
                  <button className="pi" style={piStyle} onClick={() => doExport("svg", "current")}><Icon name="visualize" size={13} /> 현재 배경</button>
                  <button className="pi" style={piStyle} onClick={() => doExport("svg", "transparent")}><Icon name="visualize" size={13} /> 투명 배경</button>
                  <div className="sep" />
                  <div className="ph" style={{ padding: "3px 12px" }}>PowerPoint</div>
                  <button className="pi" style={piStyle} onClick={doPPTX}><Icon name="dashboard" size={13} /> .pptx (데이터 편집 가능)</button>
                </div>
              </React.Fragment>
            )}
          </div>
          <button className="btn sm" onClick={saveToDash}><Icon name="save" /> Save to dashboard</button>
        </div>
        <div className="shelfbar">
          <Shelf label={T("vizColumns")} kind="cols" chips={colsChips} accept={T("vizColumnsHint")} />
          <Shelf label={T("vizRows")} kind="rows" chips={rowChips} accept={T("vizRowsHint")} />
        </div>
        <div className="vizcanvas" style={{ display: "flex", flexDirection: "column", alignItems: chartW ? "flex-start" : "stretch", overflow: (chartH || chartW) ? "auto" : "hidden" }}>
          <div className="viz-chart-area" ref={canvasRef} style={{ position: "relative", flex: chartH ? "0 0 auto" : "1 1 auto", height: chartH || "auto", width: chartW || "100%", marginTop: chartH ? ((viz.format && viz.format.offsetTop) || 0) : 0, marginLeft: chartW ? ((viz.format && viz.format.offsetLeft) || 0) : 0, minHeight: 0 }}>
            {viz.type === "facet"
              ? <FacetGrid rows={rows} cols={viz.cols} measures={measures} color={viz.color} theme={theme} />
              : (measures.length || viz.cols.length
                ? <EChart option={option} theme={theme} style={{ height: "100%" }} onInst={(i) => { chartInstRef.current = i; }} />
                : <div className="empty"><Icon name="visualize" /><div className="t">Build a chart</div><div className="s">Drag fields from the Data Explorer onto the <b>Columns</b> and <b>Rows</b> shelves — or double-click a field. Then pick a chart type on the right.</div></div>
              )
            }
            {showPose && (
              <div className="legend-pose-overlay">
                <div className="legend-pose-handle" style={{ left: (pfx * 100) + "%", top: (pfy * 100) + "%" }} onMouseDown={onHandleDown}>
                  <Icon name="move" size={12} /> {poseTarget === "title" ? "타이틀" : "범례"} · 여기를 잡고 드래그
                </div>
                <button className="btn primary sm legend-pose-done" onClick={() => setPoseTarget(null)}><Icon name="check" size={13} /> 이동 완료</button>
              </div>
            )}
            {!showPose && viz.type !== "facet" && (measures.length || viz.cols.length) && (
              <React.Fragment>
                <div className="rh rh-top" onMouseDown={onEdgeDown("top")} title="드래그해서 높이 조절" />
                <div className="rh rh-bottom" onMouseDown={onEdgeDown("bottom")} title="드래그해서 높이 조절" />
                <div className="rh rh-left" onMouseDown={onEdgeDown("left")} title="드래그해서 너비 조절" />
                <div className="rh rh-right" onMouseDown={onEdgeDown("right")} title="드래그해서 너비 조절" />
              </React.Fragment>
            )}
          </div>
        </div>
      </React.Fragment>
    );
  }

  // ─── Format panel (PowerPoint-style: pick a category from a dropdown) ──────
  const FMT_SECTIONS = [
    ["title", "제목 · Title"], ["legend", "범례 · Legend"], ["labels", "값 레이블 · Data labels"],
    ["axis", "축 · Axis (스케일·방향)"], ["grid", "격자·보조선 · Grid lines"], ["bg", "배경 · Background"],
    ["text", "텍스트 · Text"], ["series", "계열 · Series (색·이름)"], ["size", "크기 · Size"],
  ];
  const CIN = { width: 26, height: 22, padding: 0, border: "1px solid var(--line)", borderRadius: 4, background: "none", cursor: "pointer", flexShrink: 0 };
  const rotBtns = (cur, onPick) => [["auto", "자동"], [0, "가로"], [45, "45°"], [90, "세로"]].map(([v, s]) =>
    <button key={String(v)} className={((v === "auto" && cur == null) || cur === v) ? "on" : ""} onClick={() => onPick(v === "auto" ? null : v)}>{s}</button>);

  function FormatPanel({ viz }) {
    const fmt = viz.format || {};
    const setF = actions.setFormat;
    const [sec, setSec] = React.useState("title");
    const [sel, setSel] = React.useState([]);   // selected series keys (Series section)
    const t = fmt.title || {}, lg = fmt.legend || {}, lb = fmt.labels || {}, ax = fmt.axis || {}, g = fmt.grid || {}, tx = fmt.text || {};
    const legendOn = lg.show !== false, labelsOn = !!lb.show, isLine = viz.type === "line" || viz.type === "area";
    const num = (v) => v == null || v === "" ? "" : v;
    return (
      <div className="cp-block fmt-panel">
        <select className="sel fmt-sel" value={sec} onChange={(e) => setSec(e.target.value)}>
          {FMT_SECTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>

        {sec === "title" && (
          <React.Fragment>
            <div className="ctl-row"><span className="fieldlabel" style={{ margin: 0 }}>텍스트</span>
              <input className="inp" placeholder="차트 제목 입력" value={t.text || ""} onChange={(e) => setF({ title: { text: e.target.value } })} style={{ flex: 1, minWidth: 0 }} /></div>
            {t.text && (
              <React.Fragment>
                <div className="ctl-row"><span className="fieldlabel" style={{ margin: 0 }}>세로</span>
                  <div className="seg">{[["top", "위"], ["middle", "중간"], ["bottom", "아래"]].map(([p, s]) => <button key={p} className={(!t.free && (t.v || "top") === p) ? "on" : ""} onClick={() => setF({ title: { v: p, free: false } })}>{s}</button>)}
                    <button className={t.free ? "on" : ""} onClick={() => { setF({ title: { free: true } }); window.dispatchEvent(new CustomEvent("viz-pose", { detail: { target: "title" } })); }}>자유</button></div></div>
                {!t.free && <div className="ctl-row"><span className="fieldlabel" style={{ margin: 0 }}>가로</span>
                  <div className="seg">{[["left", "왼쪽"], ["center", "가운데"], ["right", "오른쪽"]].map(([p, s]) => <button key={p} className={(t.h || "center") === p ? "on" : ""} onClick={() => setF({ title: { h: p } })}>{s}</button>)}</div></div>}
              </React.Fragment>
            )}
          </React.Fragment>
        )}

        {sec === "legend" && (
          <React.Fragment>
            <div className="ctl-row"><span className="fieldlabel" style={{ margin: 0 }}>표시</span>
              <div className="seg"><button className={legendOn ? "on" : ""} onClick={() => setF({ legend: { show: true } })}>On</button><button className={!legendOn ? "on" : ""} onClick={() => setF({ legend: { show: false } })}>Off</button></div></div>
            {legendOn && (
              <React.Fragment>
                <div className="ctl-row"><span className="fieldlabel" style={{ margin: 0 }}>세로</span>
                  <div className="seg">{[["top", "위"], ["middle", "중간"], ["bottom", "아래"]].map(([p, s]) => <button key={p} className={(!lg.free && (lg.v || "top") === p) ? "on" : ""} onClick={() => setF({ legend: { v: p, free: false } })}>{s}</button>)}
                    <button className={lg.free ? "on" : ""} onClick={() => { setF({ legend: { free: true } }); window.dispatchEvent(new CustomEvent("viz-pose", { detail: { target: "legend" } })); }}>자유</button></div></div>
                {!lg.free && <div className="ctl-row"><span className="fieldlabel" style={{ margin: 0 }}>가로</span>
                  <div className="seg">{[["left", "왼쪽"], ["center", "가운데"], ["right", "오른쪽"]].map(([p, s]) => <button key={p} className={(lg.h || "center") === p ? "on" : ""} onClick={() => setF({ legend: { h: p } })}>{s}</button>)}</div></div>}
              </React.Fragment>
            )}
          </React.Fragment>
        )}

        {sec === "labels" && (
          <React.Fragment>
            <div className="ctl-row"><span className="fieldlabel" style={{ margin: 0 }}>표시</span>
              <div className="seg"><button className={labelsOn ? "on" : ""} onClick={() => setF({ labels: { show: true } })}>On</button><button className={!labelsOn ? "on" : ""} onClick={() => setF({ labels: { show: false } })}>Off</button></div></div>
            {labelsOn && (
              <React.Fragment>
                <div className="ctl-row"><span className="fieldlabel" style={{ margin: 0 }}>형식</span>
                  <div className="seg"><button className={(lb.fmt || "full") === "full" ? "on" : ""} onClick={() => setF({ labels: { fmt: "full" } })}>Full</button><button className={lb.fmt === "compact" ? "on" : ""} onClick={() => setF({ labels: { fmt: "compact" } })}>Compact</button></div></div>
                <div className="ctl-row"><span className="fieldlabel" style={{ margin: 0 }}>위치</span>
                  <div className="seg">{[["top", "위"], ["inside", "안쪽"]].map(([p, s]) => <button key={p} className={(lb.pos || "top") === p ? "on" : ""} onClick={() => setF({ labels: { pos: p } })}>{s}</button>)}</div></div>
              </React.Fragment>
            )}
          </React.Fragment>
        )}

        {sec === "axis" && (
          <React.Fragment>
            <div className="ctl-row"><span className="fieldlabel" style={{ margin: 0 }}>Y 범위</span>
              <input className="inp" type="number" placeholder="min" value={num(ax.yMin)} onChange={(e) => setF({ axis: { yMin: e.target.value === "" ? null : +e.target.value } })} style={{ width: 62 }} />
              <input className="inp" type="number" placeholder="max" value={num(ax.yMax)} onChange={(e) => setF({ axis: { yMax: e.target.value === "" ? null : +e.target.value } })} style={{ width: 62 }} /></div>
            <div className="ctl-row"><span className="fieldlabel" style={{ margin: 0 }}>X 범위</span>
              <input className="inp" type="number" placeholder="min" value={num(ax.xMin)} onChange={(e) => setF({ axis: { xMin: e.target.value === "" ? null : +e.target.value } })} style={{ width: 62 }} />
              <input className="inp" type="number" placeholder="max" value={num(ax.xMax)} onChange={(e) => setF({ axis: { xMax: e.target.value === "" ? null : +e.target.value } })} style={{ width: 62 }} /></div>
            <div style={{ fontSize: "var(--fs-11)", color: "var(--tx-faint)", margin: "-2px 0 6px" }}>값(숫자) 축에만 적용 · 비우면 자동. 범위를 좁히면 차이가 극적으로 보입니다.</div>
            <div className="ctl-row"><span className="fieldlabel" style={{ margin: 0 }}>Y 레이블</span><div className="seg">{rotBtns(ax.yLabelRotate, (v) => setF({ axis: { yLabelRotate: v } }))}</div></div>
            <div className="ctl-row"><span className="fieldlabel" style={{ margin: 0 }}>X 레이블</span><div className="seg">{rotBtns(ax.xLabelRotate, (v) => setF({ axis: { xLabelRotate: v } }))}</div></div>
          </React.Fragment>
        )}

        {sec === "grid" && (
          <React.Fragment>
            <div className="ctl-row"><span className="fieldlabel" style={{ margin: 0 }}>표시</span>
              <div className="seg"><button className={fmt.gridlines !== false ? "on" : ""} onClick={() => setF({ gridlines: true })}>On</button><button className={fmt.gridlines === false ? "on" : ""} onClick={() => setF({ gridlines: false })}>Off(투명)</button></div></div>
            {fmt.gridlines !== false && (
              <React.Fragment>
                <div className="ctl-row"><span className="fieldlabel" style={{ margin: 0 }}>굵기</span>
                  <div className="seg">{[1, 2, 3].map((w) => <button key={w} className={(g.width || 1) === w ? "on" : ""} onClick={() => setF({ grid: { width: w } })}>{w}</button>)}</div></div>
                <div className="ctl-row"><span className="fieldlabel" style={{ margin: 0 }}>색상</span>
                  <input type="color" value={g.color || rgbToHex(Charts.themeColors().split)} onChange={(e) => setF({ grid: { color: e.target.value } })} style={CIN} />
                  {g.color && <button className="iconbtn" style={{ width: 20, height: 20 }} onClick={() => setF({ grid: { color: null } })}><Icon name="undo" size={11} /></button>}</div>
                <div className="ctl-row"><span className="fieldlabel" style={{ margin: 0 }}>빈도</span>
                  <div className="seg">{[["auto", "자동"], [3, "3"], [5, "5"], [8, "8"], [10, "10"]].map(([v, s]) => <button key={String(v)} className={((v === "auto" && g.splitNumber == null) || g.splitNumber === v) ? "on" : ""} onClick={() => setF({ grid: { splitNumber: v === "auto" ? null : v } })}>{s}</button>)}</div></div>
              </React.Fragment>
            )}
          </React.Fragment>
        )}

        {sec === "bg" && (
          <React.Fragment>
            <div className="ctl-row"><span className="fieldlabel" style={{ margin: 0 }}>배경색</span>
              <input type="color" value={fmt.background || "#ffffff"} onChange={(e) => setF({ background: e.target.value })} style={CIN} />
              <div className="seg" style={{ marginLeft: 6 }}><button onClick={() => setF({ background: "#ffffff" })}>흰색</button><button className={!fmt.background ? "on" : ""} onClick={() => setF({ background: null })}>기본/투명</button></div></div>
            <div style={{ fontSize: "var(--fs-11)", color: "var(--tx-faint)" }}>PNG로 내보낼 때 이 배경으로 저장됩니다 — 다른 자료 배경에 맞추세요.</div>
          </React.Fragment>
        )}

        {sec === "text" && (
          <React.Fragment>
            <div className="ctl-row"><span className="fieldlabel" style={{ margin: 0 }}>글자색</span>
              <input type="color" value={tx.color || rgbToHex(Charts.themeColors().text)} onChange={(e) => setF({ text: { color: e.target.value } })} style={CIN} />
              {tx.color && <button className="iconbtn" style={{ width: 20, height: 20 }} onClick={() => setF({ text: { color: null } })}><Icon name="undo" size={11} /></button>}</div>
            <div className="ctl-row"><span className="fieldlabel" style={{ margin: 0 }}>크기</span>
              <div className="seg">{[["auto", "자동"], [10, "10"], [12, "12"], [14, "14"], [16, "16"]].map(([v, s]) => <button key={String(v)} className={((v === "auto" && !tx.size) || tx.size === v) ? "on" : ""} onClick={() => setF({ text: { size: v === "auto" ? null : v } })}>{s}</button>)}</div></div>
            <div className="ctl-row"><span className="fieldlabel" style={{ margin: 0 }}>스타일</span>
              <div className="seg"><button className={tx.bold ? "on" : ""} style={{ fontWeight: 700 }} onClick={() => setF({ text: { bold: !tx.bold } })}>B</button><button className={tx.italic ? "on" : ""} style={{ fontStyle: "italic" }} onClick={() => setF({ text: { italic: !tx.italic } })}>I</button></div></div>
          </React.Fragment>
        )}

        {sec === "series" && (() => {
          const isPie = viz.type === "pie";
          const markOf = (m) => m.mark || (viz.type === "line" || viz.type === "area" ? viz.type : "bar");
          const hasBar = !isPie && viz.rows.some((m) => markOf(m) === "bar");
          // series list: pie → slices; else → measures
          let list = [];
          if (isPie) {
            const pd = window.Charts.lastInst ? (((window.Charts.lastInst.getOption().series || [])[0] || {}).data || []) : [];
            list = pd.map((d) => { const nm = (d && d.name != null) ? String(d.name) : String(d); return { key: nm, colorKey: nm, name: nm, mark: "pie" }; });
          } else if (!viz.color) {
            list = viz.rows.map((m) => ({ key: m.label, colorKey: m.label, label: m.label, name: (fmt.seriesNames && fmt.seriesNames[m.label]) || m.label, mark: markOf(m) }));
          }
          const selected = list.filter((it) => sel.includes(it.key));
          const toggle = (k) => setSel((s) => s.includes(k) ? s.filter((x) => x !== k) : [...s, k]);
          const allLine = selected.length > 0 && selected.every((it) => it.mark === "line" || it.mark === "area");
          const someLine = selected.some((it) => it.mark === "line" || it.mark === "area");
          const first = selected[0];
          const firstIdx = first ? list.findIndex((x) => x.key === first.key) : 0;
          const curColor = (first && fmt.colors && fmt.colors[first.colorKey]) || rgbToHex(Charts.palette()[(firstIdx < 0 ? 0 : firstIdx) % 8]);
          const applyEach = (fn) => { const p = {}; selected.forEach((it) => fn(p, it)); return p; };
          return (
            <React.Fragment>
              {hasBar && (
                <div className="ctl-row"><span className="fieldlabel" style={{ margin: 0 }}>막대 간격</span>
                  <div className="seg">{[["10%", "좁게"], ["30%", "보통"], ["50%", "넓게"], ["70%", "아주넓게"]].map(([v, s]) => <button key={v} className={((fmt.bar && fmt.bar.categoryGap) || "30%") === v ? "on" : ""} onClick={() => setF({ bar: { categoryGap: v } })}>{s}</button>)}</div></div>
              )}
              {isPie && (
                <div className="ctl-row"><span className="fieldlabel" style={{ margin: 0 }}>파이 굵기</span>
                  <div className="seg">{[["0%", "꽉참"], ["40%", "도넛"], ["58%", "얇게"]].map(([v, s]) => <button key={v} className={((fmt.pie && fmt.pie.inner) || "40%") === v ? "on" : ""} onClick={() => setF({ pie: { inner: v } })}>{s}</button>)}</div></div>
              )}

              {!list.length ? (
                <div style={{ fontSize: "var(--fs-11)", color: "var(--tx-faint)", marginTop: 8 }}>{viz.color ? "색상(Color) 차원을 쓰면 계열이 색으로 나뉩니다 — 해제 후 이용하세요." : (isPie ? "차트를 먼저 그리면 조각이 나옵니다." : "측정값(Rows)을 올리면 계열이 나옵니다.")}</div>
              ) : (
                <React.Fragment>
                  <div className="fieldlabel" style={{ marginTop: 8, display: "flex", justifyContent: "space-between" }}>
                    <span>계열 선택 (다중)</span>
                    <span><span style={{ color: "var(--accent)", cursor: "pointer" }} onClick={() => setSel(list.map((it) => it.key))}>전체</span> · <span style={{ color: "var(--accent)", cursor: "pointer" }} onClick={() => setSel([])}>해제</span></span>
                  </div>
                  <div className="fmt-serieslist">
                    {list.map((it, i) => { const on = sel.includes(it.key); const sw = (fmt.colors && fmt.colors[it.colorKey]) || rgbToHex(Charts.palette()[i % 8]);
                      return (
                        <div key={it.key} className={"fmt-seriesitem" + (on ? " on" : "")} onClick={() => toggle(it.key)}>
                          <span className={"checkbox" + (on ? " on" : "")}>{on && <Icon name="check" size={11} />}</span>
                          <span className="sw" style={{ background: sw }} />
                          <span className="nm">{it.name}</span>
                          {!isPie && it.mark !== "bar" && <span style={{ fontSize: 9, color: "var(--tx-faint)" }}>{it.mark}</span>}
                        </div>
                      ); })}
                  </div>

                  {selected.length === 0 ? (
                    <div style={{ fontSize: "var(--fs-11)", color: "var(--tx-faint)", marginTop: 6 }}>위에서 계열을 선택하면 설정이 나옵니다.</div>
                  ) : (
                    <React.Fragment>
                      <div className="fieldlabel" style={{ marginTop: 8 }}>{selected.length}개 선택됨 — 설정</div>
                      <div className="ctl-row"><span className="fieldlabel" style={{ margin: 0 }}>색상</span>
                        <input type="color" value={curColor} onChange={(e) => setF({ colors: applyEach((p, it) => { p[it.colorKey] = e.target.value; }) })} style={CIN} />
                        <button className="iconbtn" style={{ width: 20, height: 20 }} title="색 초기화" onClick={() => setF({ colors: applyEach((p, it) => { p[it.colorKey] = null; }) })}><Icon name="undo" size={11} /></button></div>
                      {isPie && (
                        <div className="ctl-row"><span className="fieldlabel" style={{ margin: 0 }}>조각 분리</span>
                          <div className="seg"><button onClick={() => setF({ explode: applyEach((p, it) => { p[it.name] = true; }) })}>분리</button><button onClick={() => setF({ explode: applyEach((p, it) => { p[it.name] = false; }) })}>붙이기</button></div></div>
                      )}
                      {!isPie && selected.length === 1 && (
                        <div className="ctl-row"><span className="fieldlabel" style={{ margin: 0 }}>이름</span>
                          <input className="inp" placeholder={first.label} value={(fmt.seriesNames && fmt.seriesNames[first.label]) || ""} onChange={(e) => setF({ seriesNames: { [first.label]: e.target.value } })} style={{ flex: 1, minWidth: 0 }} /></div>
                      )}
                      {!isPie && allLine && (
                        <div className="ctl-row"><span className="fieldlabel" style={{ margin: 0 }}>선 굵기</span>
                          <div className="seg">{[1, 2, 3, 4].map((w) => <button key={w} className={((fmt.seriesOpts && fmt.seriesOpts[first.label] && fmt.seriesOpts[first.label].lineWidth) || 2) === w ? "on" : ""} onClick={() => setF({ seriesOpts: applyEach((p, it) => { p[it.label] = { lineWidth: w }; }) })}>{w}</button>)}</div></div>
                      )}
                      {!isPie && !allLine && someLine && (
                        <div style={{ fontSize: "var(--fs-11)", color: "var(--tx-faint)", marginTop: 4 }}>선 굵기는 라인 계열만 골랐을 때 편집됩니다 (복합차트에서 라인 하나만 선택).</div>
                      )}
                    </React.Fragment>
                  )}
                </React.Fragment>
              )}
            </React.Fragment>
          );
        })()}

        {sec === "size" && (
          <React.Fragment>
            <div className="ctl-row"><span className="fieldlabel" style={{ margin: 0 }}>리사이즈</span>
              <div className="seg">
                <button className={(fmt.resizeMode || "all") === "all" ? "on" : ""} onClick={() => setF({ resizeMode: "all" })}>전체</button>
                <button className={fmt.resizeMode === "plot" ? "on" : ""} onClick={() => setF({ resizeMode: "plot" })}>플롯만</button>
              </div></div>
            <div style={{ fontSize: "var(--fs-11)", color: "var(--tx-faint)", margin: "-2px 0 6px" }}>전체 = 범례 포함 요소 전체 · 플롯만 = 그래프 영역만(범례·제목 고정)</div>
            <div className="ctl-row"><span className="fieldlabel" style={{ margin: 0 }}>프리셋</span>
              <div className="seg">{[["Auto", null], ["S", 320], ["M", 460], ["L", 640], ["XL", 820]].map(([s, h]) => <button key={s} className={(!fmt.width && (fmt.height || null) === h) ? "on" : ""} onClick={() => setF(h === null ? { height: null, width: null, offsetTop: 0, offsetLeft: 0, plotInset: { top: 0, bottom: 0, left: 0, right: 0 } } : { height: h, offsetTop: 0 })}>{s}</button>)}</div></div>
            <div style={{ fontSize: "var(--fs-11)", color: "var(--tx-faint)" }}>차트 모서리(상·하·좌·우)를 드래그해 크기 조절 · Auto로 초기화</div>
          </React.Fragment>
        )}
      </div>
    );
  }

  // ─── Right panel: Show Me + Marks ─────────────────────────────────────────
  function VizPanel() {
    const vizSheets = useStore((s) => s.vizSheets);
    const vizActive = useStore((s) => s.vizActive);
    const activeId = useStore((s) => s.activeId);
    const viz = vizSheets.find((x) => x.id === vizActive) || vizSheets[0];
    const { columns, rows } = derive.getActiveData(activeId);
    const nDim = viz.cols.length, nMeas = viz.rows.length;
    const hasOHLC = ["open", "high", "low", "close"].every((k) => columns.some((c) => c.key === k));

    const rec = window.ChartAdvisor ? window.ChartAdvisor.recommend(
      viz.cols.map((c) => ({ key: c.key, type: c.type, cardinality: (c.type === "category" || c.type === "string") ? new Set(rows.map((r) => r[c.key])).size : null })),
      viz.rows, { hasOHLC }
    ) : null;

    const valid = (need) => {
      if (need === "fin")    return hasOHLC;
      if (need === "3m")     return nMeas >= 3;
      if (need === "2m")     return nMeas >= 2;
      if (need === "1d+2m")  return nDim >= 1 && nMeas >= 2;
      if (need === "2d+1m")  return nDim >= 2 && nMeas >= 1;
      return nDim >= 1 && nMeas >= 1;
    };
    const [ptab, setPtab] = React.useState("chart");

    return (
      <div className="vizpanel">
        <div className="viz-subtabs">
          <button className={ptab === "chart" ? "on" : ""} onClick={() => setPtab("chart")}><Icon name="visualize" size={13} /> 차트 / Chart</button>
          <button className={ptab === "format" ? "on" : ""} onClick={() => setPtab("format")}><Icon name="sliders" size={13} /> 서식 / Format</button>
        </div>
        {ptab === "chart" && (
        <React.Fragment>
        {rec && rec.type && rec.type !== viz.type && (
          <button className="viz-rec" onClick={() => actions.setViz({ type: rec.type })} title={rec.reason}>
            <Icon name="bolt" size={13} /><span><b>Show Me:</b> {rec.type} — {rec.reason}</span>
          </button>
        )}
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
        </React.Fragment>
        )}

        {ptab === "format" && <FormatPanel viz={viz} />}
      </div>
    );
  }

  window.VizMode = function () {
    return <window.Workspace left={<window.DatasetTree />} leftTitle="Data Explorer"
      center={<VizCenter />} right={<VizPanel />} rightTitle="Chart & Format" />;
  };
  window.buildVizOption = buildOption; // reused by dashboard
})();
