/* NØDE — Dashboard Builder: widget grid, KPIs, charts, cross-filtering */
(function () {
  const { useStore, actions, derive, stat, aggFn } = window.Store;
  const Icon = window.Icon, NODE = window.NODE, Charts = window.Charts;
  const EChart = Charts.EChart;

  const COLS = 12, ROWH = 62, GAP = 10;

  const dashMeasures = (columns) => (columns || []).filter((c) => c.role === "measure");
  const dashDims = (columns) => (columns || []).filter((c) => c.role === "dimension" && (c.type === "category" || c.type === "string"));

  // Build a starter dashboard from the ACTIVE dataset's real columns (no hardcoded fields).
  function defaultWidgets(columns) {
    columns = columns || [];
    const meas = dashMeasures(columns);
    const dims = dashDims(columns);
    const anyKey = (columns[0] || { key: "__rid" }).key;   // count uses row length, any key works
    if (!meas.length && !dims.length) {
      return [{ id: "t_note", type: "text", x: 0, y: 0, w: 6, h: 3, title: "Getting started",
        spec: { text: "이 데이터셋에서 측정값(숫자)·차원을 찾지 못했습니다.\nData/Clean 탭에서 컬럼 타입을 확인한 뒤 대시보드를 다시 여세요." } }];
    }
    const out = [];
    out.push({ id: "k_count", type: "kpi", x: 0, y: 0, w: 3, h: 2, spec: { measure: anyKey, agg: "count", label: "Rows", fmt: "num" } });
    meas.slice(0, 3).forEach((m, i) => {
      out.push({ id: "k_" + m.key, type: "kpi", x: (i + 1) * 3, y: 0, w: 3, h: 2, spec: { measure: m.key, agg: "avg", label: "Avg " + m.label, fmt: "num" } });
    });
    let y = 2;
    if (dims[0] && meas[0]) out.push({ id: "c_bar", type: "chart", x: 0, y, w: 7, h: 6, title: `${meas[0].label} by ${dims[0].label}`, spec: { chartType: "bar", cols: [dims[0].key], measures: [[meas[0].key, "avg"]] } });
    const pieDim = dims[1] || dims[0];
    if (pieDim) out.push({ id: "c_pie", type: "chart", x: 7, y, w: 5, h: 6, title: `Mix by ${pieDim.label}`, spec: { chartType: "pie", cols: [pieDim.key], measures: [[anyKey, "count"]] } });
    y += 6;
    if (meas[1]) out.push({ id: "c_scatter", type: "chart", x: 0, y, w: 7, h: 6, title: `${meas[0].label} vs ${meas[1].label}`, spec: { chartType: "scatter", cols: [], measures: [[meas[0].key, "avg"], [meas[1].key, "avg"]], color: dims[0] ? dims[0].key : undefined } });
    if (dims[0] && meas[0]) out.push({ id: "t_top", type: "table", x: meas[1] ? 7 : 0, y, w: 5, h: 6, title: `Top ${dims[0].label}`, spec: { dim: dims[0].key, measure: meas[0].key, agg: "avg" } });
    return out;
  }

  const getCol = (columns, key) => columns.find((c) => c.key === key) || { key, label: key, type: "string", role: "dimension" };
  const colExists = (columns, key) => !!key && columns.some((c) => c.key === key);
  // Does a widget reference columns that don't exist in the active dataset?
  function widgetStale(w, columns) {
    const s = w.spec || {};
    if (w.type === "kpi")   return !s.formula && s.agg !== "count" && !!s.measure && !colExists(columns, s.measure);
    if (w.type === "chart") return (s.measures || []).some(([k]) => !colExists(columns, k)) || (s.cols || []).some((k) => !colExists(columns, k));
    if (w.type === "table") return (!!s.dim && !colExists(columns, s.dim)) || (!!s.measure && !colExists(columns, s.measure));
    return false;
  }

  function applyCross(rows, cross, widgetId) {
    if (!cross || cross.source === widgetId) return rows;
    return rows.filter((r) => String(r[cross.key]) === String(cross.value));
  }

  // ---------- KPI ----------
  function KPIWidget({ w, rows, columns, cross }) {
    const data = applyCross(rows, cross, w.id);
    const s = w.spec;
    const decimals = s.decimals != null ? s.decimals : 0;
    const missing = !s.formula && s.agg !== "count" && !colExists(columns, s.measure);
    if (missing) return (
      <div className="kpi" title={`컬럼 없음: ${s.measure}`}>
        <div className="kpi-label">{s.label}</div>
        <div className="kpi-val mono" style={{ color: "var(--tx-faint)" }}>—</div>
        <div className="kpi-sub"><span className="mono" style={{ color: "var(--tx-faint)" }}>컬럼 없음 · {s.measure}</span></div>
      </div>
    );
    let val = null, err = null, isFormula = !!s.formula;
    if (isFormula) { const r = window.KPIFormula.compute(s.formula, data, columns); val = r.value; err = r.error; }
    else { val = aggFn[s.agg] ? aggFn[s.agg](data.map((r) => r[s.measure])) : 0; }
    const text = err ? "—" : (val == null ? "—" : (s.fmt === "won" ? NODE.fmtWon(val) : NODE.fmtNum(val, decimals)));
    const allVal = !isFormula && aggFn[s.agg] ? aggFn[s.agg](rows.map((r) => r[s.measure])) : 0;
    const pct = allVal ? (val / allVal * 100) : 100;
    const filtered = cross && cross.source !== w.id;
    return (
      <div className="kpi" title={err || undefined}>
        <div className="kpi-label">{s.label}{s.unit ? <span className="kpi-unit"> {s.unit}</span> : ""}</div>
        <div className="kpi-val mono" style={err ? { color: "var(--neg)" } : undefined}>{text}</div>
        <div className="kpi-sub">
          {isFormula ? <span className="mono ell" style={{ color: err ? "var(--neg)" : "var(--tx-faint)" }} title={s.formula}>{err ? "formula error" : "ƒ " + s.formula}</span>
            : filtered ? <span className="kpi-filt"><Icon name="filter" size={10} /> {pct.toFixed(0)}% of total</span>
              : <span className="mono" style={{ color: "var(--tx-faint)" }}>{s.agg.toUpperCase()} · {data.length} rows</span>}
        </div>
      </div>
    );
  }

  // ---------- Chart ----------
  function MissingNote({ label }) {
    return <div className="empty" style={{ padding: 12 }}><Icon name="info" /><div className="s">이 위젯은 현재 데이터셋에 없는 컬럼({label})을 참조합니다. 우측 패널의 <b>재생성</b> 또는 인스펙터에서 컬럼을 다시 지정하세요.</div></div>;
  }

  function ChartWidget({ w, rows, columns, cross, theme, edit }) {
    const data = applyCross(rows, cross, w.id);
    const s = w.spec;
    if (widgetStale(w, columns)) {
      const bad = [...(s.cols || []), ...((s.measures || []).map(([k]) => k))].filter((k) => !colExists(columns, k));
      return <MissingNote label={bad.join(", ")} />;
    }
    const cols = (s.cols || []).map((k) => getCol(columns, k));
    const measures = (s.measures || []).map(([k, agg]) => ({ ...getCol(columns, k), agg, id: k + "_" + agg }));
    const color = s.color ? getCol(columns, s.color) : null;
    const option = React.useMemo(() => window.buildVizOption(s.chartType, { rows: data, cols, measures, color, sortDesc: true, topN: s.topN != null ? s.topN : (s.chartType === "pie" ? 8 : 0) }),
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
    const s = w.spec;
    if (widgetStale(w, columns)) {
      const bad = [s.dim, s.measure].filter((k) => !colExists(columns, k));
      return <MissingNote label={bad.join(", ")} />;
    }
    const dimCol = getCol(columns, s.dim), measCol = getCol(columns, s.measure);
    const agg = derive.aggregate(data, [s.dim], [{ key: s.measure, agg: s.agg, id: "v" }])
      .sort((a, b) => b.v - a.v).slice(0, s.limit || 30);
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

  // Migrate any legacy spec.html (rich text) to safe plain spec.text by stripping tags.
  function widgetText(spec) {
    if (spec.text != null) return spec.text;
    if (spec.html != null) return String(spec.html).replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
    return "";
  }
  function TextWidget({ w }) {
    const text = widgetText(w.spec);
    return <div className="textwidget" style={{ whiteSpace: "pre-wrap" }}>{text || "Double-click or use the inspector to edit text"}</div>;
  }

  // ---------- Canvas ----------
  function DashCanvas() {
    const activeId = useStore((s) => s.activeId);
    const dash = useStore((s) => s.dash);
    const theme = useStore((s) => s.theme);
    const { rows, columns, ds } = derive.getActiveData(activeId);
    const widgets = dash.widgets || defaultWidgets(columns);
    React.useEffect(() => { if (!dash.widgets) actions.setDash({ widgets: defaultWidgets(columns) }); }, []);
    const staleN = widgets.filter((w) => widgetStale(w, columns)).length;
    const rebuild = () => actions.setDash({ widgets: defaultWidgets(columns), selectedWidgetId: null });
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
      actions.setDash({ selectedWidgetId: wd.id });
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
            <Icon name="dashboard" size={14} style={{ verticalAlign: "-2px", marginRight: 6, color: "var(--accent)" }} />{ds.short} · 대시보드
          </span>
          <div className="spacer" />
          <button className={"btn sm" + (edit ? " primary" : " ghost")} onClick={() => actions.setDash({ edit: !edit })}><Icon name="move" /> {edit ? "Editing" : "Edit layout"}</button>
          <button className="btn ghost sm" onClick={rebuild} title="현재 데이터셋 기준으로 기본 위젯 재생성"><Icon name="undo" /> 재생성</button>
        </div>

        {staleN > 0 && (
          <div className="crossbar" style={{ background: "var(--warn-soft, var(--bg-2))" }}>
            <Icon name="info" size={13} />
            <span>위젯 <b>{staleN}</b>개가 <b>{ds.short}</b>에 없는 컬럼을 참조합니다 (다른 데이터셋용 대시보드일 수 있음).</span>
            <div className="spacer" />
            <button className="btn primary sm" onClick={rebuild}><Icon name="undo" size={12} /> 현재 데이터로 재생성</button>
          </div>
        )}

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
                <div key={w.id} className={"widget" + (drag === w.id ? " drag" : "") + (w.type === "kpi" ? " is-kpi" : "") + (edit && dash.selectedWidgetId === w.id ? " selected" : "")} style={style}
                  onMouseDown={edit && w.type === "kpi" ? () => actions.setDash({ selectedWidgetId: w.id }) : undefined}>
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

  // ---------- Right: widget configuration inspector ----------
  const AGG_OPTS = ["sum", "avg", "count", "countd", "min", "max", "median"];
  const CHART_OPTS = ["bar", "line", "area", "pie", "scatter"];

  function Field({ label, children }) {
    return <label className="insp-field"><span className="insp-label">{label}</span>{children}</label>;
  }

  function WidgetInspector({ w, columns, onChange, onClose }) {
    const measures = columns.filter((c) => c.role === "measure");
    const dims = columns.filter((c) => c.role === "dimension");
    const s = w.spec || {};
    const setSpec = (patch) => onChange({ spec: { ...s, ...patch } });
    const setTop = (patch) => onChange(patch);
    const formulaErr = s.formula ? (window.KPIFormula.compute(s.formula, [], columns).error) : null;
    const useFormula = !!s.formula;

    return (
      <div className="cp-block insp">
        <div className="cp-blocktitle" style={{ display: "flex", alignItems: "center" }}>
          <Icon name="sliders" size={13} style={{ marginRight: 6, color: "var(--accent)" }} />{w.type.toUpperCase()} settings
          <div style={{ flex: 1 }} /><button className="iconbtn" onClick={onClose} title="Done"><Icon name="x" size={13} /></button>
        </div>

        {w.type === "kpi" ? (
          <React.Fragment>
            <Field label="Label"><input className="inp" value={s.label || ""} onChange={(e) => setSpec({ label: e.target.value })} /></Field>
            <div className="insp-seg">
              <button className={"btn sm " + (!useFormula ? "primary" : "ghost")} onClick={() => setSpec({ formula: undefined, measure: s.measure || (measures[0] && measures[0].key), agg: s.agg || "avg" })}>Aggregate</button>
              <button className={"btn sm " + (useFormula ? "primary" : "ghost")} onClick={() => setSpec({ formula: s.formula || `AVG(${(measures[0] || {}).key || "value"})` })}>Formula</button>
            </div>
            {useFormula ? (
              <React.Fragment>
                <Field label="Formula"><textarea className="inp mono" rows={2} value={s.formula} onChange={(e) => setSpec({ formula: e.target.value })} placeholder="SUM(profit) / SUM(revenue) * 100" /></Field>
                <div className="insp-hint" style={formulaErr ? { color: "var(--neg)" } : undefined}>{formulaErr ? "⚠ " + formulaErr : "SUM·AVG·COUNT(*)·COUNTD·MIN·MAX·MEDIAN(field) + - * / ( )"}</div>
              </React.Fragment>
            ) : (
              <React.Fragment>
                <Field label="Measure"><select className="sel" value={s.measure || ""} onChange={(e) => setSpec({ measure: e.target.value })}>{columns.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select></Field>
                <Field label="Aggregation"><select className="sel" value={s.agg || "avg"} onChange={(e) => setSpec({ agg: e.target.value })}>{AGG_OPTS.map((a) => <option key={a} value={a}>{a}</option>)}</select></Field>
              </React.Fragment>
            )}
            <Field label="Format"><select className="sel" value={s.fmt || "num"} onChange={(e) => setSpec({ fmt: e.target.value })}><option value="num">Number</option><option value="won">Won (억/만)</option></select></Field>
            <div style={{ display: "flex", gap: 8 }}>
              <Field label="Unit"><input className="inp" value={s.unit || ""} onChange={(e) => setSpec({ unit: e.target.value })} /></Field>
              <Field label="Decimals"><input className="inp" type="number" min="0" max="4" value={s.decimals != null ? s.decimals : 0} onChange={(e) => setSpec({ decimals: Math.max(0, Math.min(4, parseInt(e.target.value) || 0)) })} /></Field>
            </div>
          </React.Fragment>
        ) : w.type === "chart" ? (
          <React.Fragment>
            <Field label="Title"><input className="inp" value={w.title || ""} onChange={(e) => setTop({ title: e.target.value })} /></Field>
            <Field label="Chart type"><select className="sel" value={s.chartType} onChange={(e) => setSpec({ chartType: e.target.value })}>{CHART_OPTS.map((t) => <option key={t} value={t}>{t}</option>)}</select></Field>
            <Field label="Dimension"><select className="sel" value={(s.cols || [])[0] || ""} onChange={(e) => setSpec({ cols: e.target.value ? [e.target.value] : [] })}><option value="">(none)</option>{dims.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select></Field>
            <Field label="Measure"><select className="sel" value={(s.measures && s.measures[0] && s.measures[0][0]) || ""} onChange={(e) => setSpec({ measures: [[e.target.value, (s.measures && s.measures[0] && s.measures[0][1]) || "avg"]] })}>{measures.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select></Field>
            <Field label="Aggregation"><select className="sel" value={(s.measures && s.measures[0] && s.measures[0][1]) || "avg"} onChange={(e) => setSpec({ measures: [[(s.measures && s.measures[0] && s.measures[0][0]) || measures[0].key, e.target.value]] })}>{AGG_OPTS.map((a) => <option key={a} value={a}>{a}</option>)}</select></Field>
            <Field label="Color by"><select className="sel" value={s.color || ""} onChange={(e) => setSpec({ color: e.target.value || undefined })}><option value="">(none)</option>{dims.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select></Field>
            <Field label="Top N (0 = all)"><input className="inp" type="number" min="0" max="50" value={s.topN != null ? s.topN : 0} onChange={(e) => setSpec({ topN: Math.max(0, parseInt(e.target.value) || 0) })} /></Field>
          </React.Fragment>
        ) : w.type === "table" ? (
          <React.Fragment>
            <Field label="Title"><input className="inp" value={w.title || ""} onChange={(e) => setTop({ title: e.target.value })} /></Field>
            <Field label="Dimension"><select className="sel" value={s.dim} onChange={(e) => setSpec({ dim: e.target.value })}>{dims.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select></Field>
            <Field label="Measure"><select className="sel" value={s.measure} onChange={(e) => setSpec({ measure: e.target.value })}>{measures.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select></Field>
            <Field label="Aggregation"><select className="sel" value={s.agg} onChange={(e) => setSpec({ agg: e.target.value })}>{AGG_OPTS.map((a) => <option key={a} value={a}>{a}</option>)}</select></Field>
            <Field label="Row limit"><input className="inp" type="number" min="1" max="200" value={s.limit || 30} onChange={(e) => setSpec({ limit: Math.max(1, parseInt(e.target.value) || 30) })} /></Field>
          </React.Fragment>
        ) : (
          <React.Fragment>
            <Field label="Title"><input className="inp" value={w.title || ""} onChange={(e) => setTop({ title: e.target.value })} /></Field>
            <Field label="Text"><textarea className="inp" rows={5} value={widgetText(s)} onChange={(e) => setSpec({ text: e.target.value, html: undefined })} /></Field>
          </React.Fragment>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          <Field label="Width"><input className="inp" type="number" min="2" max="12" value={w.w} onChange={(e) => setTop({ w: Math.max(2, Math.min(12, parseInt(e.target.value) || w.w)) })} /></Field>
          <Field label="Height"><input className="inp" type="number" min="2" max="20" value={w.h} onChange={(e) => setTop({ h: Math.max(2, parseInt(e.target.value) || w.h) })} /></Field>
        </div>
      </div>
    );
  }

  // ---------- Right: add widgets / inspector ----------
  function DashPanel() {
    const dash = useStore((s) => s.dash);
    const activeId = useStore((s) => s.activeId);
    const { columns } = derive.getActiveData(activeId);
    const widgets = dash.widgets || defaultWidgets(columns);
    const add = (wd) => actions.setDash({ widgets: [...widgets, { ...wd, id: "w" + Date.now(), x: 0, y: 99 }] });
    const update = (id, patch) => actions.setDash({ widgets: widgets.map((w) => w.id === id ? { ...w, ...patch } : w) });
    const measures = dashMeasures(columns);
    const dims = dashDims(columns);
    const m0 = measures[0], d0 = dims[0];

    const selected = dash.edit && dash.selectedWidgetId ? widgets.find((w) => w.id === dash.selectedWidgetId) : null;
    if (selected) return (
      <div className="dashpanel">
        <WidgetInspector w={selected} columns={columns} onChange={(patch) => update(selected.id, patch)} onClose={() => actions.setDash({ selectedWidgetId: null })} />
      </div>
    );

    return (
      <div className="dashpanel">
        <div className="cp-block">
          <div className="cp-blocktitle">Add widget</div>
          <div className="addgrid">
            <button className="addtile" disabled={!m0} title={m0 ? "" : "측정값(숫자) 컬럼이 필요합니다"} onClick={() => add({ type: "kpi", w: 3, h: 2, spec: { measure: m0.key, agg: "avg", label: m0.label, fmt: "num" } })}><Icon name="kpi" size={18} /><span>KPI</span></button>
            <button className="addtile" disabled={!m0 || !d0} title={m0 && d0 ? "" : "차원·측정값 컬럼이 필요합니다"} onClick={() => add({ type: "chart", w: 6, h: 6, title: "New chart", spec: { chartType: "bar", cols: [d0.key], measures: [[m0.key, "avg"]] } })}><Icon name="bar" size={18} /><span>Chart</span></button>
            <button className="addtile" disabled={!m0 || !d0} title={m0 && d0 ? "" : "차원·측정값 컬럼이 필요합니다"} onClick={() => add({ type: "table", w: 5, h: 6, title: "New table", spec: { dim: d0.key, measure: m0.key, agg: "avg" } })}><Icon name="table" size={18} /><span>Table</span></button>
            <button className="addtile" onClick={() => add({ type: "text", w: 4, h: 2, title: "Note", spec: { text: "Add commentary here." } })}><Icon name="text" size={18} /><span>Text</span></button>
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
