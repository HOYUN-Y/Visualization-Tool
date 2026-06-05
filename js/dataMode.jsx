/* NØDE — Data mode: Explorer (left), Preview/Profiling (center), Column profile (right) */
(function () {
  const { useStore, actions, derive, stat } = window.Store;
  const Icon = window.Icon, NODE = window.NODE, DataGrid = window.DataGrid;
  const { typeShort, isNumType } = window;

  // ---------- Left: dataset explorer ----------
  function DatasetTree() {
    const activeId = useStore((s) => s.activeId);
    const selCol = useStore((s) => s.ui.selCol);
    const [open, setOpen] = React.useState(() => ({ [activeId]: true }));
    const [q, setQ] = React.useState("");

    return (
      <div>
        <div style={{ padding: 8 }}>
          <div className="search"><Icon name="search" /><input placeholder="Search datasets & fields…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        </div>
        <div className="sect-label" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Datasets</span><span className="mono" style={{ color: "var(--tx-faint)" }}>{NODE.datasets.length}</span>
        </div>
        {NODE.datasets.map((ds) => {
          const isOpen = open[ds.id];
          const active = ds.id === activeId;
          const dims = ds.columns.filter((c) => c.role === "dimension");
          const meas = ds.columns.filter((c) => c.role === "measure");
          const fields = ds.columns.filter((c) => !q || c.label.toLowerCase().includes(q.toLowerCase()));
          return (
            <div key={ds.id} style={{ marginBottom: 1 }}>
              <div className={"ds-row" + (active ? " on" : "")} onClick={() => { actions.setActive(ds.id); setOpen((o) => ({ ...o, [ds.id]: true })); }}>
                <span className="caret" onClick={(e) => { e.stopPropagation(); setOpen((o) => ({ ...o, [ds.id]: !o[ds.id] })); }}>
                  <Icon name="chevR" size={12} style={{ transform: isOpen ? "rotate(90deg)" : "none", transition: "transform .12s" }} />
                </span>
                <Icon name={ds.icon} size={14} />
                <span className="ds-name">{ds.short}</span>
                <span className="ds-meta mono">{ds.rows.length}</span>
              </div>
              {isOpen && (
                <div className="ds-fields">
                  <FieldGroup label="Dimensions" count={dims.length} fields={fields.filter((c) => c.role === "dimension")} selCol={active ? selCol : null} dsId={ds.id} />
                  <FieldGroup label="Measures" count={meas.length} fields={fields.filter((c) => c.role === "measure")} selCol={active ? selCol : null} dsId={ds.id} />
                </div>
              )}
            </div>
          );
        })}
        <div className="sect-label">Connect</div>
        <div className="drop" style={{ margin: "0 8px 10px", padding: "14px 10px", textAlign: "center", color: "var(--tx-faint)" }}>
          <Icon name="upload" size={18} />
          <div style={{ fontSize: 11, marginTop: 6 }}>Drop CSV · XLSX · JSON · Parquet</div>
          <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 8 }}>
            <span className="badge"><Icon name="db" size={11} /> PostgreSQL</span>
            <span className="badge">MySQL</span>
          </div>
        </div>
      </div>
    );
  }

  function FieldGroup({ label, count, fields, selCol, dsId }) {
    if (!fields.length) return null;
    return (
      <div className="fgroup">
        <div className="fgroup-h">{label} <span className="mono">{count}</span></div>
        {fields.map((c) => {
          const tb = typeShort(c.type);
          return (
            <div key={c.key} className={"field " + (c.role === "measure" ? "meas" : "dim") + (selCol === c.key ? " fsel" : "")}
              draggable onDragStart={(e) => { e.dataTransfer.setData("application/node-field", JSON.stringify({ ...c, dsId })); }}
              onDoubleClick={() => window.VizAddField && window.VizAddField(c)}
              onClick={() => { actions.setActive(dsId); actions.setUI({ selCol: c.key, dataTab: "profiling" }); }}>
              <span className="ic">{c.type === "datetime" ? "◷" : c.role === "measure" ? "#" : "Abc"}</span>
              <span className="nm">{c.label}</span>
              <span className="ty">{c.unit || tb.label}</span>
            </div>
          );
        })}
      </div>
    );
  }

  // ---------- Center: preview / profiling ----------
  function DataCenter() {
    const activeId = useStore((s) => s.activeId);
    const tab = useStore((s) => s.ui.dataTab);
    const selCol = useStore((s) => s.ui.selCol);
    const { rows, columns } = derive.getActiveData(activeId);

    return (
      <React.Fragment>
        <div className="phead" style={{ height: "var(--tab-h)", paddingLeft: 0 }}>
          <div className="tabs">
            {[["preview", "Data Preview"], ["profiling", "Profiling"]].map(([k, l]) => (
              <button key={k} className={"tab" + (tab === k ? " on" : "")} onClick={() => actions.setUI({ dataTab: k })}>
                {l}{k === "preview" && <span className="cnt">{rows.length}</span>}
              </button>
            ))}
          </div>
          <div className="spacer" />
          <span className="badge" style={{ marginRight: 8 }}><Icon name="bolt" size={11} /> auto-profiled</span>
        </div>
        {tab === "preview"
          ? <DataGrid columns={columns} rows={rows} selCol={selCol} onSelectCol={(k) => actions.setUI({ selCol: k })} />
          : <ProfilingGrid columns={columns} rows={rows} selCol={selCol} />}
      </React.Fragment>
    );
  }

  // mini distribution drawn with divs
  function MiniHist({ rows, col, h = 30 }) {
    const data = React.useMemo(() => {
      if (col.type === "category") {
        const m = new Map(); for (const r of rows) { const v = r[col.key]; if (v != null) m.set(v, (m.get(v) || 0) + 1); }
        const arr = [...m.values()].sort((a, b) => b - a).slice(0, 14); const mx = Math.max(...arr, 1);
        return { bars: arr.map((c) => c / mx), kind: "cat" };
      }
      const hh = stat.histogram(rows.map((r) => r[col.key]), 22);
      return { bars: hh.bins.map((b) => b.c / (hh.max || 1)), kind: "num" };
    }, [rows, col]);
    return (
      <div className="minihist" style={{ height: h }}>
        {data.bars.map((v, i) => <span key={i} style={{ height: Math.max(2, v * h) + "px", background: data.kind === "cat" ? "var(--dim-color)" : "var(--meas-color)" }} />)}
      </div>
    );
  }

  function ProfilingGrid({ columns, rows, selCol }) {
    return (
      <div className="pbody" style={{ padding: 12 }}>
        <div className="profgrid">
          {columns.map((c) => {
            const col = rows.map((r) => r[c.key]);
            const missing = stat.missing(col); const miss = (missing / rows.length * 100);
            const tb = typeShort(c.type);
            return (
              <div key={c.key} className={"profcard" + (selCol === c.key ? " sel" : "")} onClick={() => actions.setUI({ selCol: c.key })}>
                <div className="pc-head">
                  <span className={"th-type " + tb.cls}>{tb.label}</span>
                  <span className="pc-name">{c.label}</span>
                </div>
                <MiniHist rows={rows} col={c} h={34} />
                <div className="pc-stats">
                  {isNumType(c.type) ? (
                    <React.Fragment>
                      <span><b>{NODE.fmtCompact(stat.mean(col))}</b> avg</span>
                      <span><b>{NODE.fmtCompact(stat.min(col))}</b>–<b>{NODE.fmtCompact(stat.max(col))}</b></span>
                    </React.Fragment>
                  ) : (
                    <React.Fragment>
                      <span><b>{stat.countDistinct(col)}</b> distinct</span>
                      <span className="ell">mode <b>{String(stat.mode(col)).slice(0, 10)}</b></span>
                    </React.Fragment>
                  )}
                  <span className={miss > 0 ? "miss" : ""}>{miss > 0 ? <b>{miss.toFixed(1)}% null</b> : "0 null"}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ---------- Right: column profile ----------
  function ColumnProfile() {
    const activeId = useStore((s) => s.activeId);
    const selCol = useStore((s) => s.ui.selCol);
    const { rows, columns } = derive.getActiveData(activeId);
    const col = columns.find((c) => c.key === selCol);
    if (!col) return (
      <div className="empty"><Icon name="info" /><div className="t">No column selected</div><div className="s">Click a column header or a profiling card to inspect its distribution and statistics.</div></div>
    );
    const vals = rows.map((r) => r[col.key]);
    const tb = typeShort(col.type);
    const missing = stat.missing(vals);
    const Row = ({ k, v, accent }) => <div className="kv"><span className="k">{k}</span><span className={"v mono" + (accent ? " acc" : "")}>{v}</span></div>;

    return (
      <div className="colprofile fade" key={selCol}>
        <div className="cp-head">
          <span className={"th-type " + tb.cls} style={{ fontSize: 10 }}>{tb.label}</span>
          <span className="cp-name">{col.label}</span>
        </div>
        <div className="cp-sub">{col.type}{col.unit ? ` · ${col.unit}` : ""} · {col.role}</div>

        <div className="cp-section">
          <div className="cp-title">Overview</div>
          <Row k="Count" v={rows.length.toLocaleString()} />
          <Row k="Missing" v={`${missing} (${(missing / rows.length * 100).toFixed(1)}%)`} accent={missing > 0} />
          <Row k="Distinct" v={stat.countDistinct(vals).toLocaleString()} />
        </div>

        {isNumType(col.type) ? (
          <React.Fragment>
            <div className="cp-section">
              <div className="cp-title">Distribution</div>
              <FullHist rows={rows} col={col} />
              <BoxPlot vals={vals} />
            </div>
            <div className="cp-section">
              <div className="cp-title">Statistics</div>
              <Row k="Mean" v={NODE.fmtNum(stat.mean(vals), 1)} />
              <Row k="Median" v={NODE.fmtNum(stat.median(vals), 1)} />
              <Row k="Std dev" v={NODE.fmtNum(stat.std(vals), 1)} />
              <Row k="Min" v={NODE.fmtNum(stat.min(vals), 1)} />
              <Row k="Q1 / Q3" v={`${NODE.fmtNum(stat.quantile(vals, .25), 0)} / ${NODE.fmtNum(stat.quantile(vals, .75), 0)}`} />
              <Row k="Max" v={NODE.fmtNum(stat.max(vals), 1)} />
            </div>
          </React.Fragment>
        ) : col.type === "datetime" ? (
          <div className="cp-section">
            <div className="cp-title">Range</div>
            <Row k="Start" v={vals.filter(Boolean).sort()[0]} />
            <Row k="End" v={vals.filter(Boolean).sort().slice(-1)[0]} />
          </div>
        ) : (
          <div className="cp-section">
            <div className="cp-title">Top values</div>
            <TopValues rows={rows} col={col} />
          </div>
        )}
      </div>
    );
  }

  function FullHist({ rows, col }) {
    const hh = React.useMemo(() => stat.histogram(rows.map((r) => r[col.key]), 24), [rows, col]);
    return (
      <div className="fullhist">
        {hh.bins.map((b, i) => (
          <span key={i} className="fh-bar" style={{ height: Math.max(2, (b.c / (hh.max || 1)) * 100) + "%" }}
            title={`${NODE.fmtCompact(b.x0)}–${NODE.fmtCompact(b.x1)}: ${b.c}`} />
        ))}
      </div>
    );
  }

  function BoxPlot({ vals }) {
    const min = stat.min(vals), max = stat.max(vals), q1 = stat.quantile(vals, .25), q3 = stat.quantile(vals, .75), med = stat.median(vals);
    if (min == null) return null;
    const sc = (v) => ((v - min) / (max - min || 1)) * 100;
    return (
      <div className="boxplot">
        <div className="bp-line" />
        <div className="bp-box" style={{ left: sc(q1) + "%", width: (sc(q3) - sc(q1)) + "%" }} />
        <div className="bp-med" style={{ left: sc(med) + "%" }} />
      </div>
    );
  }

  function TopValues({ rows, col }) {
    const data = React.useMemo(() => {
      const m = new Map(); for (const r of rows) { const v = r[col.key]; m.set(v, (m.get(v) || 0) + 1); }
      return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    }, [rows, col]);
    const max = Math.max(...data.map((d) => d[1]), 1);
    return (
      <div className="topvals">
        {data.map(([v, c], i) => (
          <div key={i} className="tv-row">
            <span className="tv-name ell">{v == null ? <i className="cell-null">null</i> : String(v)}</span>
            <span className="tv-bar"><span style={{ width: (c / max * 100) + "%", background: `var(--cat-${(i % 8) + 1})` }} /></span>
            <span className="tv-cnt mono">{c}</span>
          </div>
        ))}
      </div>
    );
  }

  Object.assign(window, { DatasetTree, DataCenter, ColumnProfile });
})();
