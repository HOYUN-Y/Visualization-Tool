/* NØDE — Data Cleaning Studio: issues bar, live grid, operations + history */
(function () {
  const { useStore, actions, derive, stat } = window.Store;
  const Icon = window.Icon, NODE = window.NODE, DataGrid = window.DataGrid;
  const { isNumType, typeShort } = window;

  function stepLabel(s) {
    const c = s.col;
    switch (s.op) {
      case "drop_missing": return [`Drop missing`, c];
      case "fill_mean": return [`Fill mean`, c];
      case "fill_median": return [`Fill median`, c];
      case "fill_mode": return [`Fill mode`, c];
      case "drop_duplicates": return [`Drop duplicate rows`, ""];
      case "remove_outliers": return [`Remove outliers (IQR)`, c];
      case "rename": return [`Rename → ${s.params.to}`, c];
      case "replace": return [`Replace "${s.params.from}" → "${s.params.to}"`, c];
      case "change_type": return [`Change type → ${s.params.to}`, c];
      default: return [s.op, c];
    }
  }
  const OP_ICON = { drop_missing: "x", fill_mean: "plus", fill_median: "plus", fill_mode: "plus",
    drop_duplicates: "duplicate", remove_outliers: "filter", rename: "text", replace: "redo", change_type: "layers" };

  function CleanCenter() {
    const activeId = useStore((s) => s.activeId);
    const { ds, rows, columns, steps, cursor } = derive.getActiveData(activeId);

    const issues = React.useMemo(() => {
      const missing = {}; let totalMissing = 0;
      for (const c of columns) { const m = stat.missing(rows.map((r) => r[c.key])); if (m) { missing[c.key] = m; totalMissing += m; } }
      const seen = new Set(); let dups = 0;
      for (const r of rows) { const k = JSON.stringify(r); if (seen.has(k)) dups++; else seen.add(k); }
      let outliers = 0, outCol = null;
      for (const c of columns) if (isNumType(c.type) && c.role === "measure") {
        const cs = derive.colStats(rows, c.key); const iqr = cs.q3 - cs.q1; const lo = cs.q1 - 1.5 * iqr, hi = cs.q3 + 1.5 * iqr;
        const n = rows.filter((r) => r[c.key] != null && (r[c.key] < lo || r[c.key] > hi)).length;
        if (n > outliers) { outliers = n; outCol = c.key; }
      }
      return { missing, totalMissing, dups, outliers, outCol };
    }, [rows, columns]);

    const missCols = Object.keys(issues.missing);

    return (
      <React.Fragment>
        <div className="phead">
          <span className="ttl" style={{ color: "var(--tx-hi)", textTransform: "none", fontSize: "var(--fs-13)", letterSpacing: 0 }}>
            <Icon name="clean" size={14} style={{ verticalAlign: "-2px", marginRight: 6, color: "var(--accent)" }} />Cleaning Studio
          </span>
          <span className="badge mono">{ds.short}</span>
          <div className="spacer" />
          <button className="btn ghost sm" disabled={cursor === 0} onClick={actions.undo}><Icon name="undo" /> Undo</button>
          <button className="btn ghost sm" disabled={cursor >= steps.length} onClick={actions.redo}><Icon name="redo" /> Redo</button>
        </div>

        <div className="issuebar">
          <Issue ok={!issues.totalMissing} icon="info" label="Missing cells"
            val={issues.totalMissing} cols={missCols.length}
            action={missCols.length ? { txt: "Drop / fill", fn: () => { } } : null} />
          <Issue ok={!issues.dups} icon="duplicate" label="Duplicate rows" val={issues.dups}
            action={issues.dups ? { txt: "Drop dupes", fn: () => actions.addStep({ op: "drop_duplicates", col: null }) } : null} />
          <Issue ok={!issues.outliers} icon="filter" label="Outliers" val={issues.outliers} sub={issues.outCol}
            action={issues.outliers ? { txt: "Remove", fn: () => actions.addStep({ op: "remove_outliers", col: issues.outCol }) } : null} />
          <div className="spacer" />
          <div className="issue-meta">
            <span className="mono">{rows.length}</span> rows after <span className="mono">{cursor}</span> step{cursor !== 1 ? "s" : ""}
            <span className="delta">{rows.length - ds.rows.length !== 0 ? `${rows.length - ds.rows.length > 0 ? "+" : ""}${rows.length - ds.rows.length}` : ""}</span>
          </div>
        </div>

        <DataGrid columns={columns} rows={rows} pageSize={100} />
      </React.Fragment>
    );
  }

  function Issue({ ok, icon, label, val, sub, cols, action }) {
    return (
      <div className={"issue" + (ok ? " ok" : "")}>
        <span className="issue-ic"><Icon name={ok ? "check" : icon} size={13} /></span>
        <div className="issue-body">
          <div className="issue-val mono">{ok ? "Clean" : val.toLocaleString()}</div>
          <div className="issue-lbl">{label}{!ok && cols ? ` · ${cols} cols` : ""}{!ok && sub ? ` · ${sub}` : ""}</div>
        </div>
        {action && <button className="btn sm" onClick={action.fn}>{action.txt}</button>}
      </div>
    );
  }

  // ---------- Right: operations + history ----------
  function CleanPanel() {
    const activeId = useStore((s) => s.activeId);
    const { ds, columns, steps, cursor } = derive.getActiveData(activeId);
    const [col, setCol] = React.useState(columns[0] ? columns[0].key : "");
    const selCol = columns.find((c) => c.key === col) || columns[0];
    const [renameVal, setRenameVal] = React.useState("");
    const [repl, setRepl] = React.useState({ from: "", to: "" });

    React.useEffect(() => { if (!columns.find((c) => c.key === col)) setCol(columns[0] && columns[0].key); }, [activeId]);

    const add = (op, params) => {
      window.LOG && window.LOG.info('clean', 'Clean step added', { op, col, params });
      actions.addStep({ op, col, params });
    };
    const isNum = selCol && isNumType(selCol.type);

    return (
      <div className="cleanpanel">
        <div className="cp-block">
          <div className="cp-blocktitle">Add operation</div>
          <label className="fieldlabel">Column</label>
          <select className="sel" style={{ width: "100%" }} value={col} onChange={(e) => setCol(e.target.value)}>
            {columns.map((c) => <option key={c.key} value={c.key}>{c.label} ({c.type})</option>)}
          </select>

          <div className="opgroup">
            <div className="opgroup-h">Missing values</div>
            <div className="opbtns">
              <button className="opbtn" onClick={() => add("drop_missing")}><Icon name="x" size={13} />Drop rows</button>
              {isNum && <button className="opbtn" onClick={() => add("fill_mean")}><Icon name="plus" size={13} />Fill mean</button>}
              {isNum && <button className="opbtn" onClick={() => add("fill_median")}><Icon name="plus" size={13} />Fill median</button>}
              <button className="opbtn" onClick={() => add("fill_mode")}><Icon name="plus" size={13} />Fill mode</button>
            </div>
          </div>

          <div className="opgroup">
            <div className="opgroup-h">Rows</div>
            <div className="opbtns">
              <button className="opbtn" onClick={() => actions.addStep({ op: "drop_duplicates", col: null })}><Icon name="duplicate" size={13} />Drop duplicates</button>
              {isNum && <button className="opbtn" onClick={() => add("remove_outliers")}><Icon name="filter" size={13} />Remove outliers</button>}
            </div>
          </div>

          <div className="opgroup">
            <div className="opgroup-h">Transform</div>
            <div className="op-inline">
              <input className="inp" placeholder={`Rename "${selCol ? selCol.label : ""}"`} value={renameVal} onChange={(e) => setRenameVal(e.target.value)} />
              <button className="btn sm" disabled={!renameVal.trim()} onClick={() => { add("rename", { to: renameVal.trim() }); setRenameVal(""); }}>Apply</button>
            </div>
            <div className="op-inline">
              <input className="inp" placeholder="from" value={repl.from} onChange={(e) => setRepl({ ...repl, from: e.target.value })} />
              <input className="inp" placeholder="to" value={repl.to} onChange={(e) => setRepl({ ...repl, to: e.target.value })} />
              <button className="btn sm" disabled={!repl.from} onClick={() => { add("replace", { from: repl.from, to: repl.to }); setRepl({ from: "", to: "" }); }}>Set</button>
            </div>
            <div className="op-inline">
              <span className="fieldlabel" style={{ flex: 1 }}>Change type</span>
              {["string", "integer", "float", "category", "datetime"].map((t) => (
                <button key={t} className="typebtn" onClick={() => add("change_type", { to: t })}>{t.slice(0, 3)}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="cp-block">
          <div className="cp-blocktitle" style={{ display: "flex", alignItems: "center" }}>
            Pipeline <span className="mono" style={{ color: "var(--tx-faint)", marginLeft: 6 }}>{cursor}/{steps.length}</span>
            <div style={{ flex: 1 }} />
            {steps.length > 0 && <button className="btn ghost sm" onClick={actions.clearSteps}>Clear</button>}
          </div>
          <div className="pipeline">
            <div className={"pl-step source" + (cursor === 0 ? " cur" : "")} onClick={() => actions.gotoStep(0)}>
              <span className="pl-ic"><Icon name="db" size={12} /></span>
              <div className="pl-body"><div className="pl-name">Source · {ds.short}</div><div className="pl-sub">{ds.rows.length} rows loaded</div></div>
            </div>
            {steps.map((s, i) => {
              const [name, c] = stepLabel(s);
              const future = i >= cursor;
              return (
                <div key={s.id} className={"pl-step" + (i + 1 === cursor ? " cur" : "") + (future ? " future" : "")} onClick={() => actions.gotoStep(i + 1)}>
                  <span className="pl-ic"><Icon name={OP_ICON[s.op] || "bolt"} size={12} /></span>
                  <div className="pl-body"><div className="pl-name">{name}</div>{c && <div className="pl-sub mono">{c}</div>}</div>
                  <span className="pl-n mono">{i + 1}</span>
                </div>
              );
            })}
            {steps.length === 0 && <div className="pl-empty">No steps yet. Add an operation above — every action is recorded and reversible.</div>}
          </div>
        </div>
      </div>
    );
  }

  window.CleanMode = function () {
    return <window.Workspace left={<window.DatasetTree />} leftTitle="Data Explorer"
      center={<CleanCenter />} right={<CleanPanel />} rightTitle="Operations & Pipeline" />;
  };
})();
