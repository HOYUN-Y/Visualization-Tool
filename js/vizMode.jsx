/* NØDE — Visualization Builder: shelves + Show Me + ECharts canvas */
(function () {
  const { useStore, actions, derive, stat, aggFn } = window.Store;
  const Icon = window.Icon, NODE = window.NODE, Charts = window.Charts;
  const { isNumType, Popover } = window;
  const EChart = Charts.EChart;

  const AGGS = ["sum", "avg", "median", "min", "max", "count", "countd"];
  const CHART_TYPES = [
    { id: "bar", label: "Bar", icon: "bar", need: "1d+1m" },
    { id: "hbar", label: "H-Bar", icon: "bar", need: "1d+1m" },
    { id: "line", label: "Line", icon: "line", need: "1d+1m" },
    { id: "area", label: "Area", icon: "area", need: "1d+1m" },
    { id: "pie", label: "Pie", icon: "pie", need: "1d+1m" },
    { id: "scatter", label: "Scatter", icon: "scatter", need: "2m" },
    { id: "treemap", label: "Treemap", icon: "treemap", need: "1d+1m" },
    { id: "heatmap", label: "Heatmap", icon: "heatmap", need: "2d+1m" },
  ];

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

  // ---------- build ECharts option ----------
  function buildOption(type, ctx) {
    const c = Charts.themeColors(); const pal = Charts.palette();
    const { rows, cols, measures, color, sortDesc, topN } = ctx;
    const base = Charts.baseGrid(c);
    const axisCommon = {
      axisLine: { lineStyle: { color: c.axis } }, axisTick: { show: false },
      axisLabel: { color: c.text, fontSize: 11, hideOverlap: true },
      splitLine: { lineStyle: { color: c.split } },
      nameTextStyle: { color: c.faint }, nameGap: 8,
    };
    const fmtVal = (v) => NODE.fmtCompact(v);

    if (!measures.length || (!cols.length && type !== "scatter")) return emptyOption(c);

    // ---- scatter: 2 measures ----
    if (type === "scatter") {
      if (measures.length < 2) return emptyOption(c, "Scatter needs 2 measures on Rows");
      const mx = measures[0], my = measures[1];
      const colorKey = color ? color.key : null;
      let series;
      if (colorKey) {
        const groups = new Map();
        for (const r of rows) { const g = r[colorKey]; if (!groups.has(g)) groups.set(g, []); groups.get(g).push([r[mx.key], r[my.key]]); }
        series = [...groups.entries()].slice(0, 12).map(([g, data], i) => ({ name: String(g), type: "scatter", symbolSize: 7, itemStyle: { color: pal[i % 8], opacity: 0.75 }, data }));
      } else {
        series = [{ type: "scatter", symbolSize: 7, itemStyle: { color: pal[0], opacity: 0.7 }, data: rows.map((r) => [r[mx.key], r[my.key]]) }];
      }
      return { ...base, legend: color ? { top: 0, textStyle: { color: c.text }, type: "scroll" } : undefined,
        grid: { ...base.grid, top: color ? 30 : 18 },
        xAxis: { type: "value", name: mx.label, ...axisCommon, axisLabel: { ...axisCommon.axisLabel, formatter: fmtVal } },
        yAxis: { type: "value", name: my.label, ...axisCommon, axisLabel: { ...axisCommon.axisLabel, formatter: fmtVal } },
        tooltip: { ...base.tooltip, trigger: "item" }, series };
    }

    const xKey = cols[0].key;
    const colorKey = color ? color.key : (cols[1] ? cols[1].key : null);

    // aggregate
    const dimKeys = colorKey && colorKey !== xKey ? [xKey, colorKey] : [xKey];
    const agg = derive.aggregate(rows, dimKeys, measures);
    const m0 = measures[0];

    // ---- heatmap: 2 dims + 1 measure ----
    if (type === "heatmap") {
      const k2 = colorKey && colorKey !== xKey ? colorKey : (cols[1] && cols[1].key);
      if (!k2) return emptyOption(c, "Heatmap needs 2 dimensions on Columns");
      const xs = [...new Set(agg.map((r) => r[xKey]))]; const ys = [...new Set(agg.map((r) => r[k2]))];
      const data = agg.map((r) => [xs.indexOf(r[xKey]), ys.indexOf(r[k2]), r[m0.id] || 0]);
      const maxV = Math.max(...data.map((d) => d[2]), 1);
      return { ...base, grid: { ...base.grid, top: 14, bottom: 50, right: 60 },
        tooltip: { ...base.tooltip, trigger: "item" },
        xAxis: { type: "category", data: xs, ...axisCommon, axisLabel: { ...axisCommon.axisLabel, rotate: xs.length > 6 ? 35 : 0 } },
        yAxis: { type: "category", data: ys, ...axisCommon },
        visualMap: { min: 0, max: maxV, calculable: true, orient: "vertical", right: 4, bottom: 30,
          inRange: { color: [c.bg, pal[0]] }, textStyle: { color: c.text, fontSize: 10 } },
        series: [{ type: "heatmap", data, label: { show: false } }] };
    }

    // ---- treemap ----
    if (type === "treemap") {
      const data = agg.map((r, i) => ({ name: String(r[xKey]), value: r[m0.id] || 0, itemStyle: { color: pal[i % 8] } }))
        .sort((a, b) => b.value - a.value);
      return { ...base, tooltip: { ...base.tooltip, trigger: "item", formatter: (p) => `${p.name}<br/><b>${fmtVal(p.value)}</b>` },
        series: [{ type: "treemap", roam: false, nodeClick: false, breadcrumb: { show: false }, data,
          label: { color: "#fff", fontSize: 12, fontFamily: "IBM Plex Sans" },
          itemStyle: { borderColor: c.bg, borderWidth: 2, gapWidth: 2 }, levels: [{ itemStyle: { gapWidth: 2 } }] }] };
    }

    // ---- pie ----
    if (type === "pie") {
      let data = agg.map((r, i) => ({ name: String(r[xKey]), value: r[m0.id] || 0 }));
      data.sort((a, b) => b.value - a.value); if (topN) data = data.slice(0, topN);
      return { ...base, tooltip: { ...base.tooltip, trigger: "item", formatter: (p) => `${p.name}<br/><b>${fmtVal(p.value)}</b> (${p.percent}%)` },
        legend: { type: "scroll", orient: "vertical", right: 4, top: 8, textStyle: { color: c.text, fontSize: 11 } },
        color: pal, series: [{ type: "pie", radius: ["42%", "70%"], center: ["40%", "52%"], data,
          itemStyle: { borderColor: c.bg, borderWidth: 2 }, label: { color: c.text, fontSize: 11 } }] };
    }

    // ---- bar / line / area ----
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
      // sort categories by first measure
      let pairs = cats.map((cat) => ({ cat, vals: measures.map((m) => { const f = agg.find((r) => r[xKey] === cat); return f ? f[m.id] : 0; }) }));
      pairs.sort((a, b) => sortDesc ? b.vals[0] - a.vals[0] : a.vals[0] - b.vals[0]);
      if (topN) pairs = pairs.slice(0, topN);
      const sortedCats = pairs.map((p) => p.cat);
      series = measures.map((m, mi) => ({
        name: m.label, type: type === "line" || type === "area" ? "line" : "bar",
        areaStyle: type === "area" ? { opacity: 0.22 } : undefined, smooth: (type === "line" || type === "area") ? 0.2 : false, symbol: "none",
        itemStyle: { color: pal[mi % 8], borderRadius: type.includes("bar") ? (horiz ? [0, 3, 3, 0] : [3, 3, 0, 0]) : 0 },
        data: pairs.map((p) => p.vals[mi]),
      }));
      cats.length = 0; cats.push(...sortedCats);
    }
    const catAxis = { type: "category", data: cats, ...axisCommon, axisLabel: { ...axisCommon.axisLabel, rotate: !horiz && cats.length > 7 ? 32 : 0, interval: 0 } };
    const valAxis = { type: "value", ...axisCommon, axisLabel: { ...axisCommon.axisLabel, formatter: fmtVal } };
    return { ...base, grid: { ...base.grid, top: (colorKey && colorKey !== xKey) || measures.length > 1 ? 30 : 16, bottom: horiz ? 8 : (cats.length > 7 ? 40 : 8) },
      legend: (colorKey && colorKey !== xKey) || measures.length > 1 ? { top: 0, type: "scroll", textStyle: { color: c.text, fontSize: 11 }, icon: "roundRect" } : undefined,
      tooltip: { ...base.tooltip, trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: fmtVal },
      xAxis: horiz ? valAxis : catAxis, yAxis: horiz ? { ...catAxis, inverse: true } : valAxis, series };
  }

  function emptyOption(c, msg) {
    return { graphic: { type: "text", left: "center", top: "center",
      style: { text: msg || "Drop a dimension and a measure", fill: c.faint, fontSize: 13, fontFamily: "IBM Plex Sans" } } };
  }

  // ---------- Center ----------
  function VizCenter() {
    const activeId = useStore((s) => s.activeId);
    const viz = useStore((s) => s.viz);
    const theme = useStore((s) => s.theme);
    const { rows, columns } = derive.getActiveData(activeId);
    // re-map shelf chips to live columns (labels)
    const measures = viz.rows;
    const colsChips = viz.cols.map((c) => <span key={c.key} className="chip dim"><Icon name={c.type === "datetime" ? "trend" : "layers"} size={12} style={{ opacity: .6 }} />{c.label}<span className="x" onClick={() => actions.removeFromShelf("cols", c.key)}><Icon name="x" size={12} /></span></span>);
    const rowChips = measures.map((c) => <MeasureChip key={c.key} chip={c} />);

    const option = React.useMemo(() => buildOption(viz.type, { rows, cols: viz.cols, measures, color: viz.color, sortDesc: viz.sortDesc, topN: viz.topN }),
      [viz, rows, theme]);

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
          {measures.length || viz.cols.length
            ? <EChart option={option} theme={theme} style={{ height: "100%" }} />
            : <div className="empty"><Icon name="visualize" /><div className="t">Build a chart</div><div className="s">Drag fields from the Data Explorer onto the <b>Columns</b> and <b>Rows</b> shelves — or double-click a field. Then pick a chart type on the right.</div></div>}
        </div>
      </React.Fragment>
    );
  }

  // ---------- Right: Show Me + Marks ----------
  function VizPanel() {
    const viz = useStore((s) => s.viz);
    const activeId = useStore((s) => s.activeId);
    const { columns } = derive.getActiveData(activeId);
    const dims = columns.filter((c) => c.role === "dimension");
    const nDim = viz.cols.length, nMeas = viz.rows.length;
    const valid = (need) => {
      if (need === "2m") return nMeas >= 2;
      if (need === "2d+1m") return nDim >= 2 && nMeas >= 1;
      return nDim >= 1 && nMeas >= 1;
    };

    return (
      <div className="vizpanel">
        <div className="cp-block">
          <div className="cp-blocktitle">Show Me</div>
          <div className="showme">
            {CHART_TYPES.map((t) => {
              const ok = valid(t.need);
              return (
                <button key={t.id} className={"sm-tile" + (viz.type === t.id ? " on" : "") + (ok ? "" : " disabled")}
                  disabled={!ok} onClick={() => actions.setViz({ type: t.id })} title={ok ? t.label : `Needs ${t.need}`}>
                  <Icon name={t.icon} size={18} /><span>{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

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
