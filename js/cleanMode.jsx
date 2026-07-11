/* NØDE — Data Cleaning Studio: issues bar, live grid, operations + history */
(function () {
  const { useStore, actions, derive, stat } = window.Store;
  const Icon = window.Icon, NODE = window.NODE, DataGrid = window.DataGrid;
  const { isNumType, typeShort } = window;

  function stepLabel(s, T) {
    const c = s.col;
    switch (s.op) {
      case "drop_missing": return [T("cleanDropMissing"), c];
      case "fill_mean": return [T("cleanFillMean"), c];
      case "fill_median": return [T("cleanFillMedian"), c];
      case "fill_mode": return [T("cleanFillMode"), c];
      case "drop_duplicates": return [T("cleanDropDupRows"), ""];
      case "remove_outliers": return [`Remove outliers (IQR)`, c];
      case "rename": return [`${T("cleanRename")} → ${s.params.to}`, c];
      case "replace": return [`${T("cleanReplace")} "${s.params.from}" → "${s.params.to}"`, c];
      case "change_type": return [`${T("cleanChangeType")} → ${s.params.to}`, c];
      case "label_encode": return [`Label Encode`, c];
      case "dummy_encode": return [`Dummy Encode (One-Hot)`, c];
      case "drop_col": return [T("cleanDropCol"), c];
      case "standardize": return [`Standardize (Z-Score)`, c];
      case "normalize": return [`Normalize (Min-Max)`, c];
      case "log_transform": return [`Log Transform (log1p)`, c];
      case "rank_transform": return [`Rank Transform`, c];
      case "winsorize": return [`Winsorize ${s.params && s.params.p != null ? s.params.p : 5}%`, c];
      case "binning": return [`Binning (${s.params && s.params.bins ? s.params.bins : 5} bins)`, c];
      case "formula": return [`${T("cleanFormula")}: ${s.params.name}`, s.params.expr];
      case "set_cell": return [`${T("cleanEditCell")} → ${s.params.value === "" || s.params.value == null ? "null" : s.params.value}`, c];
      case "drop_rows": return [T("cleanDeleteRowsN").replace("{n}", (s.rids || []).length), ""];
      case "add_row": return [T("gAddRow"), ""];
      case "add_col": return [T("gAddCol"), s.params.key];
      case "reorder_cols": return [T("cleanReorderCols"), ""];
      default: return [s.op, c];
    }
  }
  const OP_ICON = { drop_missing: "x", fill_mean: "plus", fill_median: "plus", fill_mode: "plus",
    drop_duplicates: "duplicate", remove_outliers: "filter", rename: "text", replace: "redo", change_type: "layers",
    label_encode: "layers", dummy_encode: "layers", drop_col: "x", standardize: "bolt", normalize: "bolt",
    log_transform: "bolt", rank_transform: "bolt", winsorize: "filter", binning: "filter", formula: "bolt",
    set_cell: "edit", drop_rows: "trash", add_row: "plus", add_col: "plus", reorder_cols: "move" };

  function CleanCenter() {
    const activeId = useStore((s) => s.activeId);
    const selCol = useStore((s) => s.ui.selCol);
    const lang = useStore((s) => s.tweaks.lang) || "ko";
    const T = (k) => window.I18N.t(lang, k);
    const { ds, rows, columns, steps, cursor } = derive.getActiveData(activeId);

    // Direct grid editing — same non-destructive step pipeline as Data mode,
    // so column add/delete/insert/rename/type + row add/delete live in the "…" menu.
    const uniqKey = (base) => {
      const keys = new Set(columns.map((c) => c.key)); let k = base, i = 1;
      while (keys.has(k)) k = base + "_" + (++i);
      return k;
    };
    const editHandlers = {
      onCell: (rid, key, val) => actions.editCell(rid, key, val),
      onDeleteRows: (rids) => actions.deleteRows(rids),
      onAddRow: () => actions.addRow({}),
      onAddCol: () => actions.addColumn({ key: uniqKey("new_col"), type: "string" }),
      onInsertCol: (at) => actions.addColumn({ key: uniqKey("new_col"), type: "string", at }),
      onRename: (key, to) => actions.addStep({ op: "rename", col: key, params: { to } }),
      onChangeType: (key, t) => actions.addStep({ op: "change_type", col: key, params: { to: t } }),
      onDeleteCol: (key) => actions.addStep({ op: "drop_col", col: key }),
      onReorder: (order) => actions.reorderCols(order),
    };

    const issues = React.useMemo(() => {
      const missing = {}; let totalMissing = 0;
      for (const c of columns) { const m = stat.missing(rows.map((r) => r[c.key])); if (m) { missing[c.key] = m; totalMissing += m; } }
      const seen = new Set(); let dups = 0;
      for (const r of rows) { const { __rid, ...rest } = r; const k = JSON.stringify(rest); if (seen.has(k)) dups++; else seen.add(k); }
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
            <Icon name="clean" size={14} style={{ verticalAlign: "-2px", marginRight: 6, color: "var(--accent)" }} />{T("cleanTitle")}
          </span>
          <span className="badge mono">{ds.short}</span>
          <div className="spacer" />
          <button className="btn ghost sm" disabled={cursor === 0} onClick={actions.undo}><Icon name="undo" /> {T("dUndo")}</button>
          <button className="btn ghost sm" disabled={cursor >= steps.length} onClick={actions.redo}><Icon name="redo" /> {T("dRedo")}</button>
        </div>

        <div className="issuebar">
          <Issue ok={!issues.totalMissing} icon="info" label={T("cleanMissingCells")}
            val={issues.totalMissing} cols={missCols.length}
            action={missCols.length ? { txt: T("cleanDropFill"), fn: () => { } } : null} />
          <Issue ok={!issues.dups} icon="duplicate" label={T("cleanDupRows")} val={issues.dups}
            action={issues.dups ? { txt: T("cleanDropDupes"), fn: () => actions.addStep({ op: "drop_duplicates", col: null }) } : null} />
          <Issue ok={!issues.outliers} icon="filter" label={T("cleanOutliers")} val={issues.outliers} sub={issues.outCol}
            action={issues.outliers ? { txt: T("cleanRemove"), fn: () => actions.addStep({ op: "remove_outliers", col: issues.outCol }) } : null} />
          <div className="spacer" />
          <div className="issue-meta">
            <span className="mono">{rows.length}</span> {T("cleanRowsAfter")} <span className="mono">{cursor}</span> {T("cleanSteps")}
            <span className="delta">{rows.length - ds.rows.length !== 0 ? `${rows.length - ds.rows.length > 0 ? "+" : ""}${rows.length - ds.rows.length}` : ""}</span>
          </div>
        </div>

        <DataGrid columns={columns} rows={rows} pageSize={100}
          selCol={selCol} onSelectCol={(k) => actions.setUI({ selCol: k })}
          editable={true} cellEditable={false} edit={editHandlers} />
      </React.Fragment>
    );
  }

  function Issue({ ok, icon, label, val, sub, cols, action }) {
    const lang = useStore((s) => s.tweaks.lang) || "ko";
    const T = (k) => window.I18N.t(lang, k);
    return (
      <div className={"issue" + (ok ? " ok" : "")}>
        <span className="issue-ic"><Icon name={ok ? "check" : icon} size={13} /></span>
        <div className="issue-body">
          <div className="issue-val mono">{ok ? T("cleanClean") : val.toLocaleString()}</div>
          <div className="issue-lbl">{label}{!ok && cols ? ` · ${cols} ${T("cols")}` : ""}{!ok && sub ? ` · ${sub}` : ""}</div>
        </div>
        {action && <button className="btn sm" onClick={action.fn}>{action.txt}</button>}
      </div>
    );
  }

  // ---------- Right: operations + history ----------
  function CleanPanel() {
    const activeId = useStore((s) => s.activeId);
    const lang = useStore((s) => s.tweaks.lang) || "ko";
    const T = (k) => window.I18N.t(lang, k);
    const { ds, rows, columns, steps, cursor } = derive.getActiveData(activeId);
    const [col, setCol] = React.useState(columns[0] ? columns[0].key : "");
    const selCol = columns.find((c) => c.key === col) || columns[0];
    const [renameVal, setRenameVal] = React.useState("");
    const [repl, setRepl] = React.useState({ from: "", to: "" });
    const [bins, setBins] = React.useState("5");
    const [winsP, setWinsP] = React.useState("5");
    const [fmlExpr, setFmlExpr] = React.useState("");
    const [fmlName, setFmlName] = React.useState("");

    React.useEffect(() => { if (!columns.find((c) => c.key === col)) setCol(columns[0] && columns[0].key); }, [activeId]);

    const add = (op, params) => {
      window.LOG && window.LOG.info('clean', 'Clean step added', { op, col, params });
      actions.addStep({ op, col, params });
    };
    const isNum = selCol && isNumType(selCol.type);

    return (
      <div className="cleanpanel">
        <div className="cp-block">
          <div className="cp-blocktitle">{T("cleanAddOperation")}</div>
          <label className="fieldlabel">{T("cleanColumn")}</label>
          <select className="sel" style={{ width: "100%" }} value={col} onChange={(e) => setCol(e.target.value)}>
            {columns.map((c) => <option key={c.key} value={c.key}>{c.label} ({c.type})</option>)}
          </select>

          <div className="opgroup">
            <div className="opgroup-h">{T("cleanMissingValues")}</div>
            <div className="opbtns">
              <button className="opbtn" onClick={() => add("drop_missing")}><Icon name="x" size={13} />{T("cleanDropRows")}</button>
              {isNum && <button className="opbtn" onClick={() => add("fill_mean")}><Icon name="plus" size={13} />{T("cleanFillMean")}</button>}
              {isNum && <button className="opbtn" onClick={() => add("fill_median")}><Icon name="plus" size={13} />{T("cleanFillMedian")}</button>}
              <button className="opbtn" onClick={() => add("fill_mode")}><Icon name="plus" size={13} />{T("cleanFillMode")}</button>
            </div>
          </div>

          <div className="opgroup">
            <div className="opgroup-h">{T("pRows")}</div>
            <div className="opbtns">
              <button className="opbtn" onClick={() => actions.addStep({ op: "drop_duplicates", col: null })}><Icon name="duplicate" size={13} />{T("cleanDropDuplicates")}</button>
              {isNum && <button className="opbtn" onClick={() => add("remove_outliers")}><Icon name="filter" size={13} />{T("cleanRemoveOutliers")}</button>}
            </div>
          </div>

          <div className="opgroup">
            <div className="opgroup-h">{T("pColumns")}</div>
            <div className="opbtns">
              <button className="opbtn" onClick={() => {
                const keys = new Set(columns.map((c) => c.key)); let k = "new_col", i = 1;
                while (keys.has(k)) k = "new_col_" + (++i);
                actions.addColumn({ key: k, type: "string" });
              }}><Icon name="plus" size={13} />{T("gAddCol")}</button>
              <button className="opbtn" style={{ color: "var(--danger, #e05)" }} onClick={() => add("drop_col")}><Icon name="x" size={13} />{T("cleanDropCol")}</button>
            </div>
            <div style={{ fontSize: "var(--fs-11)", color: "var(--tx-faint)", marginTop: 3 }}>열 위치 변경은 그리드 헤더를 드래그하세요. 헤더 <b>⋯</b> 메뉴에서도 삽입·삭제·이름변경 가능.</div>
          </div>

          <div className="opgroup">
            <div className="opgroup-h">{T("cleanTransform")}</div>
            <div className="op-inline">
              <input className="inp" placeholder={`${T("cleanRename")} "${selCol ? selCol.label : ""}"`} value={renameVal} onChange={(e) => setRenameVal(e.target.value)} />
              <button className="btn sm" disabled={!renameVal.trim()} onClick={() => { add("rename", { to: renameVal.trim() }); setRenameVal(""); }}>{T("gApply")}</button>
            </div>
            <div className="op-inline">
              <input className="inp" placeholder={T("cleanFrom")} value={repl.from} onChange={(e) => setRepl({ ...repl, from: e.target.value })} />
              <input className="inp" placeholder={T("cleanTo")} value={repl.to} onChange={(e) => setRepl({ ...repl, to: e.target.value })} />
              <button className="btn sm" disabled={!repl.from} onClick={() => { add("replace", { from: repl.from, to: repl.to }); setRepl({ from: "", to: "" }); }}>{T("cleanSet")}</button>
            </div>
            <div className="op-inline">
              <span className="fieldlabel" style={{ flex: 1 }}>{T("cleanChangeType")}</span>
              {[["string"], ["integer"], ["float"], ["category"], ["datetime"], ["boolean", "T/F"]].map(([t, lbl]) => (
                <button key={t} className="typebtn" onClick={() => add("change_type", { to: t })}>{lbl || t.slice(0, 3)}</button>
              ))}
            </div>
          </div>

          <div className="opgroup">
            <div className="opgroup-h">{T("cleanEncoding")}</div>
            <div className="opbtns">
              <button className="opbtn" onClick={() => add("label_encode")}><Icon name="layers" size={13} />Label Encode</button>
              <button className="opbtn" onClick={() => {
                const uniq = [...new Set(rows.map((r) => r[col]).filter((v) => v != null && v !== ""))];
                if (uniq.length > 20 && !window.confirm(`컬럼 "${col}"의 고유값이 ${uniq.length}개입니다. 더미 컬럼 ${uniq.length}개가 추가됩니다. 계속하시겠습니까?`)) return;
                add("dummy_encode");
              }}><Icon name="layers" size={13} />Dummy Encode</button>
            </div>
            <div style={{ fontSize: "var(--fs-11)", color: "var(--tx-faint)", marginTop: 3 }}>
              Label: 문자열 → 정수(0,1,2…) 새 컬럼 | Dummy: One-Hot 0/1 컬럼 추가
            </div>
          </div>

          {isNum && (
            <div className="opgroup">
              <div className="opgroup-h">{T("cleanNumericTransform")}</div>
              <div className="opbtns">
                <button className="opbtn" onClick={() => add("standardize")}><Icon name="bolt" size={13} />Z-Score</button>
                <button className="opbtn" onClick={() => add("normalize")}><Icon name="bolt" size={13} />Min-Max</button>
                <button className="opbtn" onClick={() => add("log_transform")}><Icon name="bolt" size={13} />Log(1+x)</button>
                <button className="opbtn" onClick={() => add("rank_transform")}><Icon name="bolt" size={13} />Rank</button>
              </div>
              <div className="op-inline" style={{ marginTop: 6 }}>
                <span className="fieldlabel" style={{ whiteSpace: "nowrap" }}>Bins</span>
                <input className="inp" type="number" min="2" max="50" value={bins} onChange={(e) => setBins(e.target.value)} style={{ width: 52 }} />
                <button className="btn sm" onClick={() => add("binning", { bins: Math.max(2, parseInt(bins) || 5) })}>Bin</button>
                <span className="fieldlabel" style={{ whiteSpace: "nowrap", marginLeft: 8 }}>Winsorize %</span>
                <input className="inp" type="number" min="1" max="49" value={winsP} onChange={(e) => setWinsP(e.target.value)} style={{ width: 44 }} />
                <button className="btn sm" onClick={() => add("winsorize", { p: Math.max(1, Math.min(49, parseFloat(winsP) || 5)) })}>{T("gApply")}</button>
              </div>
              <div style={{ fontSize: "var(--fs-11)", color: "var(--tx-faint)", marginTop: 3 }}>
                Bin: 등폭 구간 범주 컬럼 추가 | Winsorize: 상하 p% 클리핑
              </div>
            </div>
          )}

          <div className="opgroup">
            <div className="opgroup-h">{T("cleanFormulaColumn")}</div>
            <div className="op-inline">
              <input className="inp" placeholder="새 컬럼 이름" value={fmlName} onChange={(e) => setFmlName(e.target.value)} style={{ width: 120 }} />
            </div>
            <div className="op-inline">
              <input className="inp mono" placeholder="row.price * 1.1" value={fmlExpr} onChange={(e) => setFmlExpr(e.target.value)} style={{ flex: 1, fontFamily: "var(--font-mono)" }} />
              <button className="btn sm" disabled={!fmlExpr.trim() || !fmlName.trim()} onClick={() => { add("formula", { name: fmlName.trim(), expr: fmlExpr.trim() }); setFmlExpr(""); setFmlName(""); }}>{T("cleanAdd")}</button>
            </div>
            <div style={{ fontSize: "var(--fs-11)", color: "var(--tx-faint)", marginTop: 3 }}>
              <code style={{ background: "var(--bg-dp1)", padding: "1px 4px", borderRadius: 3 }}>row</code> 객체로 각 행 접근. 예: <code style={{ background: "var(--bg-dp1)", padding: "1px 4px", borderRadius: 3 }}>row.area * row.price</code>
            </div>
          </div>
        </div>

        <div className="cp-block">
          <div className="cp-blocktitle" style={{ display: "flex", alignItems: "center" }}>
            {T("cleanPipeline")} <span className="mono" style={{ color: "var(--tx-faint)", marginLeft: 6 }}>{cursor}/{steps.length}</span>
            <div style={{ flex: 1 }} />
            {steps.length > 0 && <button className="btn ghost sm" onClick={actions.clearSteps}>{T("gClear")}</button>}
          </div>
          <div className="pipeline">
            <div className={"pl-step source" + (cursor === 0 ? " cur" : "")} onClick={() => actions.gotoStep(0)}>
              <span className="pl-ic"><Icon name="db" size={12} /></span>
              <div className="pl-body"><div className="pl-name">{T("cleanSource")} · {ds.short}</div><div className="pl-sub">{ds.rows.length} {T("cleanRowsLoaded")}</div></div>
            </div>
            {steps.map((s, i) => {
              const [name, c] = stepLabel(s, T);
              const future = i >= cursor;
              return (
                <div key={s.id} className={"pl-step" + (i + 1 === cursor ? " cur" : "") + (future ? " future" : "")} onClick={() => actions.gotoStep(i + 1)}>
                  <span className="pl-ic"><Icon name={OP_ICON[s.op] || "bolt"} size={12} /></span>
                  <div className="pl-body"><div className="pl-name">{name}</div>{c && <div className="pl-sub mono">{c}</div>}</div>
                  <span className="pl-n mono">{i + 1}</span>
                </div>
              );
            })}
            {steps.length === 0 && <div className="pl-empty">{T("cleanNoSteps")}</div>}
          </div>
        </div>
      </div>
    );
  }

  window.CleanMode = function () {
    const lang = useStore((s) => s.tweaks.lang) || "ko";
    const T = (k) => window.I18N.t(lang, k);
    return <window.Workspace left={<window.DatasetTree />} leftTitle={T("dashDataExplorer")}
      center={<CleanCenter />} right={<CleanPanel />} rightTitle={T("cleanOpsPipeline")} />;
  };
})();
