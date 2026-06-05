/* NØDE — Dashboard Builder: widget grid, KPIs, charts, cross-filtering */
(function () {
  const { useStore, actions, derive, stat, aggFn } = window.Store;
  const Icon = window.Icon, NODE = window.NODE, Charts = window.Charts;
  const EChart = Charts.EChart;

  const COLS = 12, ROWH = 62, GAP = 10;

  function defaultWidgets() {
    return [
      { id: "k1", type: "kpi", x: 0, y: 0, w: 3, h: 2, spec: { measure: "id", agg: "count", label: "Transactions", fmt: "num" } },
      { id: "k2", type: "kpi", x: 3, y: 0, w: 3, h: 2, spec: { measure: "price_manwon", agg: "avg", label: "Avg Price", fmt: "won" } },
      { id: "k3", type: "kpi", x: 6, y: 0, w: 3, h: 2, spec: { measure: "price_per_m2", agg: "avg", label: "Avg ₩/m²", fmt: "num", unit: "만원" } },
      { id: "k4", type: "kpi", x: 9, y: 0, w: 3, h: 2, spec: { measure: "complex_name", agg: "countd", label: "Complexes", fmt: "num" } },
      { id: "c1", type: "chart", x: 0, y: 2, w: 7, h: 6, title: "Avg price by district", spec: { chartType: "bar", cols: ["district"], measures: [["price_manwon", "avg"]] } },
      { id: "c2", type: "chart", x: 7, y: 2, w: 5, h: 6, title: "Mix by building type", spec: { chartType: "pie", cols: ["building_type"], measures: [["id", "count"]] } },
      { id: "c3", type: "chart", x: 0, y: 8, w: 7, h: 6, title: "Area vs price", spec: { chartType: "scatter", cols: [], measures: [["area_m2", "avg"], ["price_manwon", "avg"]], color: "building_type" } },
      { id: "t1", type: "table", x: 7, y: 8, w: 5, h: 6, title: "Top complexes by avg price", spec: { dim: "complex_name", measure: "price_manwon", agg: "avg" } },
    ];
  }

  const getCol = (columns, key) => columns.find((c) => c.key === key) || { key, label: key, type: "string", role: "dimension" };

  function applyCross(rows, cross, widgetId) {
    if (!cross || cross.source === widgetId) return rows;
    return rows.filter((r) => String(r[cross.key]) === String(cross.value));
  }

  // ---------- KPI ----------
  function KPIWidget({ w, rows, columns, cross }) {
    const data = applyCross(rows, cross, w.id);
    const s = w.spec; const col = getCol(columns, s.measure);
    const val = aggFn[s.agg] ? aggFn[s.agg](data.map((r) => r[s.measure])) : 0;
    const allVal = aggFn[s.agg] ? aggFn[s.agg](rows.map((r) => r[s.measure])) : 0;
    const text = s.fmt === "won" ? NODE.fmtWon(val) : (s.agg === "avg" ? NODE.fmtNum(val, 0) : NODE.fmtNum(val, 0));
    const pct = allVal ? (val / allVal * 100) : 100;
    const filtered = cross && cross.source !== w.id;
    return (
      <div className="kpi">
        <div className="kpi-label">{s.label}{s.unit ? <span className="kpi-unit"> {s.unit}</span> : ""}</div>
        <div className="kpi-val mono">{text}</div>
        <div className="kpi-sub">
          {filtered ? <span className="kpi-filt"><Icon name="filter" size={10} /> {pct.toFixed(0)}% of total</span>
            : <span className="mono" style={{ color: "var(--tx-faint)" }}>{s.agg.toUpperCase()} · {data.length} rows</span>}
        </div>
      </div>
    );
  }

  // ---------- Chart ----------
  function ChartWidget({ w, rows, columns, cross, theme, edit }) {
    const data = applyCross(rows, cross, w.id);
    const s = w.spec;
    const cols = (s.cols || []).map((k) => getCol(columns, k));
    const measures = (s.measures || []).map(([k, agg]) => ({ ...getCol(columns, k), agg, id: k + "_" + agg }));
    const color = s.color ? getCol(columns, s.color) : null;
    const option = React.useMemo(() => window.buildVizOption(s.chartType, { rows: data, cols, measures, color, sortDesc: true, topN: s.chartType === "pie" ? 8 : 0 }),
      [data, theme, JSON.stringify(s)]);
    const onEvents = {
      click: (p) => {
        if (edit) return;
        const dimKey = cols[0] && cols[0].key;
        if (!dimKey) return;
        const val = p.name;
        const cur = useStore.length; // no-op
        const st = window.Store.getState().dash.cross;
        if (st && st.key === dimKey && String(st.value) === String(val) && st.source === w.id) actions.setCross(null);
        else actions.setCross({ key: dimKey, value: val, source: w.id });
      },
    };
    return <EChart option={option} onEvents={onEvents} theme={theme} style={{ height: "100%" }} />;
  }

  // ---------- Table ----------
  function TableWidget({ w, rows, columns, cross }) {
    const data = applyCross(rows, cross, w.id);
    const s = w.spec; const dimCol = getCol(columns, s.dim), measCol = getCol(columns, s.measure);
    const agg = derive.aggregate(data, [s.dim], [{ key: s.measure, agg: s.agg, id: "v" }])
      .sort((a, b) => b.v - a.v).slice(0, 30);
    const max = Math.max(...agg.map((r) => r.v), 1);
    return (
      <div className="tablewidget">
        <div className="tw-head"><span>{dimCol.label}</span><span>{s.agg.toUpperCase()}({measCol.label})</span></div>
        <div className="tw-body">
          {agg.map((r, i) => (
            <div className="tw-row" key={i}>
              <span className="tw-rank mono">{i + 1}</span>
              <span className="tw-name ell">{r[s.dim]}</span>
              <span className="tw-bar"><span style={{ width: (r.v / max * 100) + "%" }} /></span>
              <span className="tw-val mono">{measCol.fmt === "won" ? NODE.fmtWon(r.v) : NODE.fmtNum(r.v, 0)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function TextWidget({ w }) {
    return <div className="textwidget" dangerouslySetInnerHTML={{ __html: w.spec.html || "Double-click to edit text" }} />;
  }

  // ---------- Canvas ----------
  function DashCanvas() {
    const activeId = useStore((s) => s.activeId);
    const dash = useStore((s) => s.dash);
    const theme = useStore((s) => s.theme);
    const { rows, columns, ds } = derive.getActiveData(activeId);
    const widgets = dash.widgets || defaultWidgets();
    React.useEffect(() => { if (!dash.widgets) actions.setDash({ widgets: defaultWidgets() }); }, []);
    const ref = React.useRef(null);
    const [cw, setCw] = React.useState(1000);
    React.useEffect(() => {
      if (!ref.current) return;
      const ro = new ResizeObserver(() => setCw(ref.current.clientWidth));
      ro.observe(ref.current); setCw(ref.current.clientWidth);
      return () => ro.disconnect();
    }, []);
    const colW = (cw - GAP) / COLS;
    const edit = dash.edit;
    const [drag, setDrag] = React.useState(null);

    const update = (id, patch) => actions.setDash({ widgets: widgets.map((w) => w.id === id ? { ...w, ...patch } : w) });
    const remove = (id) => actions.setDash({ widgets: widgets.filter((w) => w.id !== id) });
    const dup = (wd) => actions.setDash({ widgets: [...widgets, { ...wd, id: "w" + Date.now(), x: Math.min(wd.x + 1, COLS - wd.w), y: wd.y + 1 }] });

    const onHeadDown = (e, wd) => {
      if (!edit) return; e.preventDefault();
      const sx = e.clientX, sy = e.clientY, ox = wd.x, oy = wd.y;
      setDrag(wd.id);
      const move = (ev) => {
        const dx = Math.round((ev.clientX - sx) / colW), dy = Math.round((ev.clientY - sy) / (ROWH + GAP));
        update(wd.id, { x: Math.max(0, Math.min(COLS - wd.w, ox + dx)), y: Math.max(0, oy + dy) });
      };
      const up = () => { setDrag(null); window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
      window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
    };
    const onResizeDown = (e, wd) => {
      e.preventDefault(); e.stopPropagation();
      const sx = e.clientX, sy = e.clientY, ow = wd.w, oh = wd.h;
      setDrag(wd.id);
      const move = (ev) => {
        const dw = Math.round((ev.clientX - sx) / colW), dh = Math.round((ev.clientY - sy) / (ROWH + GAP));
        update(wd.id, { w: Math.max(2, Math.min(COLS - wd.x, ow + dw)), h: Math.max(2, oh + dh) });
      };
      const up = () => { setDrag(null); window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
      window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
    };

    const maxY = Math.max(8, ...widgets.map((w) => w.y + w.h));

    return (
      <React.Fragment>
        <div className="phead">
          <span className="ttl" style={{ textTransform: "none", fontSize: "var(--fs-13)", letterSpacing: 0, color: "var(--tx-hi)" }}>
            <Icon name="dashboard" size={14} style={{ verticalAlign: "-2px", marginRight: 6, color: "var(--accent)" }} />Seoul Market Overview
          </span>
          <div className="spacer" />
          <button className={"btn sm" + (edit ? " primary" : " ghost")} onClick={() => actions.setDash({ edit: !edit })}><Icon name="move" /> {edit ? "Editing" : "Edit layout"}</button>
          <button className="btn ghost sm" onClick={() => actions.setDash({ widgets: defaultWidgets() })}><Icon name="undo" /> Reset</button>
        </div>

        {dash.cross && (
          <div className="crossbar">
            <Icon name="filter" size={13} />
            <span>Cross-filter active:</span>
            <span className="cross-chip">{getCol(columns, dash.cross.key).label} = <b>{dash.cross.value}</b></span>
            <span className="cross-hint">All widgets filtered · click the same mark again or here to clear</span>
            <div className="spacer" />
            <button className="btn ghost sm" onClick={() => actions.setCross(null)}><Icon name="x" /> Clear</button>
          </div>
        )}

        <div className="dashscroll">
          <div className="dashgrid" ref={ref} style={{ height: maxY * (ROWH + GAP) + GAP, backgroundSize: edit ? `${colW}px ${ROWH + GAP}px` : undefined }}>
            {widgets.map((w) => {
              const style = { left: w.x * colW + GAP, top: w.y * (ROWH + GAP) + GAP, width: w.w * colW - GAP, height: w.h * (ROWH + GAP) - GAP };
              return (
                <div key={w.id} className={"widget" + (drag === w.id ? " drag" : "") + (w.type === "kpi" ? " is-kpi" : "")} style={style}>
                  {w.type !== "kpi" && (
                    <div className="widget-head" onMouseDown={(e) => onHeadDown(e, w)} style={{ cursor: edit ? "move" : "default" }}>
                      <span className="wh-title ell">{w.title}</span>
                      <span className="wh-tools">
                        {edit && <button className="iconbtn" style={{ width: 22, height: 22 }} onClick={() => dup(w)} title="Duplicate"><Icon name="duplicate" size={12} /></button>}
                        {edit && <button className="iconbtn" style={{ width: 22, height: 22 }} onClick={() => remove(w.id)} title="Delete"><Icon name="x" size={13} /></button>}
                      </span>
                    </div>
                  )}
                  <div className="widget-body">
                    {w.type === "kpi" && <KPIWidget w={w} rows={rows} columns={columns} cross={dash.cross} />}
                    {w.type === "chart" && <ChartWidget w={w} rows={rows} columns={columns} cross={dash.cross} theme={theme} edit={edit} />}
                    {w.type === "table" && <TableWidget w={w} rows={rows} columns={columns} cross={dash.cross} />}
                    {w.type === "text" && <TextWidget w={w} />}
                  </div>
                  {edit && w.type === "kpi" && (
                    <div className="widget-head kpi-head" onMouseDown={(e) => onHeadDown(e, w)}>
                      <span className="wh-tools"><button className="iconbtn" style={{ width: 20, height: 20 }} onClick={() => remove(w.id)}><Icon name="x" size={12} /></button></span>
                    </div>
                  )}
                  {edit && <div className="widget-resize" onMouseDown={(e) => onResizeDown(e, w)}><Icon name="move" size={10} /></div>}
                </div>
              );
            })}
          </div>
        </div>
      </React.Fragment>
    );
  }

  // ---------- Right: add widgets ----------
  function DashPanel() {
    const dash = useStore((s) => s.dash);
    const activeId = useStore((s) => s.activeId);
    const { columns } = derive.getActiveData(activeId);
    const widgets = dash.widgets || defaultWidgets();
    const add = (wd) => actions.setDash({ widgets: [...widgets, { ...wd, id: "w" + Date.now(), x: 0, y: 99 }] });
    const measures = columns.filter((c) => c.role === "measure");
    const dims = columns.filter((c) => c.role === "dimension" && c.type === "category");

    return (
      <div className="dashpanel">
        <div className="cp-block">
          <div className="cp-blocktitle">Add widget</div>
          <div className="addgrid">
            <button className="addtile" onClick={() => add({ type: "kpi", w: 3, h: 2, spec: { measure: measures[0].key, agg: "avg", label: measures[0].label, fmt: "num" } })}><Icon name="kpi" size={18} /><span>KPI</span></button>
            <button className="addtile" onClick={() => add({ type: "chart", w: 6, h: 6, title: "New chart", spec: { chartType: "bar", cols: [dims[0].key], measures: [[measures[0].key, "avg"]] } })}><Icon name="bar" size={18} /><span>Chart</span></button>
            <button className="addtile" onClick={() => add({ type: "table", w: 5, h: 6, title: "New table", spec: { dim: dims[0].key, measure: measures[0].key, agg: "avg" } })}><Icon name="table" size={18} /><span>Table</span></button>
            <button className="addtile" onClick={() => add({ type: "text", w: 4, h: 2, spec: { html: "<b>Note</b> — add commentary here." } })}><Icon name="text" size={18} /><span>Text</span></button>
          </div>
        </div>

        <div className="cp-block">
          <div className="cp-blocktitle">Cross-filtering</div>
          <div className="cf-info">
            <Icon name="bolt" size={14} />
            <div>Click any bar, slice or point in a chart to filter the entire dashboard in real time. Click it again to clear.</div>
          </div>
          <div className="cf-status">
            <span className="dot" style={{ background: dash.cross ? "var(--accent)" : "var(--pos)" }} />
            {dash.cross ? `Filtering ${getCol(columns, dash.cross.key).label} = ${dash.cross.value}` : "No active filter"}
          </div>
        </div>

        <div className="cp-block">
          <div className="cp-blocktitle">Layout</div>
          <div className="cf-info" style={{ background: "transparent", border: "none", padding: "0 2px" }}>
            <span style={{ fontSize: "var(--fs-11)", color: "var(--tx-lo)", lineHeight: 1.5 }}>
              {widgets.length} widgets on a {COLS}-column grid. Toggle <b style={{ color: "var(--tx-hi)" }}>Edit layout</b> to drag, resize, duplicate or remove.
            </span>
          </div>
        </div>
      </div>
    );
  }

  window.DashMode = function () {
    return <window.Workspace left={<window.DatasetTree />} leftTitle="Data Explorer"
      center={<DashCanvas />} right={<DashPanel />} rightTitle="Build Dashboard" />;
  };
})();
