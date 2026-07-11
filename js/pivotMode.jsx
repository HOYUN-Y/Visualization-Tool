/* insight Analytics — Pivot mode: drag Rows/Columns/Values/Filters → cross-tab table */
(function () {
  const { useStore, actions, derive } = window.Store;
  const Icon = window.Icon, NODE = window.NODE;

  const AGGS = ["sum", "avg", "count", "countd", "min", "max", "median"];
  const curPivotSheet = (s) => (s.pivotSheets || []).find((x) => x.id === s.pivotActive) || (s.pivotSheets || [])[0];
  const pvState = (s) => ({ rows: [], columns: [], values: [], filters: [], ...(curPivotSheet(s) || {}) });
  const readField = (e) => { try { return JSON.parse(e.dataTransfer.getData("application/node-field")); } catch (x) { return null; } };
  const fmt = (v) => (v == null ? "—" : typeof v === "number" ? NODE.fmtNum(v, 1) : String(v));
  const colLabel = (columns, key) => (columns.find((c) => c.key === key) || {}).label || key;

  function Shelf({ label, hint, children, onDropField }) {
    const [over, setOver] = React.useState(false);
    const arr = React.Children.toArray(children);
    return (
      <div className="pv-shelf">
        <div className="pv-shelf-label">{label}</div>
        <div className={"pv-well" + (over ? " over" : "")}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); const f = readField(e); if (f) onDropField(f); }}>
          {arr}
          {!arr.length && <span className="pv-hint">{hint}</span>}
        </div>
      </div>
    );
  }

  function DimChip({ label, onRemove }) {
    return <span className="pv-chip dim">{label}<span className="pv-x" onClick={onRemove}><Icon name="x" size={11} /></span></span>;
  }

  // ─── Pivot sheet tab bar (multiple pivots) ───────────────────────────────
  function PivotTabs() {
    const sheets = useStore((s) => s.pivotSheets);
    const active = useStore((s) => s.pivotActive);
    const globalActive = useStore((s) => s.activeId);
    const [editId, setEditId] = React.useState(null);
    const [draft, setDraft] = React.useState("");
    const commit = () => { if (editId) actions.renamePivotSheet(editId, draft.trim()); setEditId(null); };
    const activeSheet = sheets.find((x) => x.id === active) || sheets[0];
    const datasets = NODE.datasets;
    return (
      <div className="viz-tabs">
        <div className="viz-tabs-scroll">
          {sheets.map((sh) => (
            <div key={sh.id} className={"viz-tab" + (sh.id === active ? " on" : "")}
              onClick={() => sh.id !== active && actions.setPivotActive(sh.id)}
              onDoubleClick={() => { setEditId(sh.id); setDraft(sh.name); }}
              title="더블클릭해서 이름 변경">
              <Icon name="grid" size={12} style={{ opacity: 0.6 }} />
              {editId === sh.id
                ? <input autoFocus className="viz-tab-edit" value={draft}
                    onChange={(e) => setDraft(e.target.value)} onBlur={commit}
                    onKeyDown={(e) => { if (e.key === "Enter") commit(); else if (e.key === "Escape") setEditId(null); }}
                    onClick={(e) => e.stopPropagation()} />
                : <span className="viz-tab-nm">{sh.name}</span>}
              {sh.id === active && (
                <span className="viz-tab-dup" title="탭 복제"
                  onClick={(e) => { e.stopPropagation(); actions.duplicatePivotSheet(sh.id); }}><Icon name="duplicate" size={11} /></span>
              )}
              {sheets.length > 1 && (
                <span className="viz-tab-x" title="탭 닫기"
                  onClick={(e) => { e.stopPropagation(); actions.removePivotSheet(sh.id); }}><Icon name="x" size={11} /></span>
              )}
            </div>
          ))}
          <button className="viz-tab-add" title="새 피벗 탭" onClick={() => actions.addPivotSheet()}><Icon name="plus" size={13} /></button>
        </div>
        <div className="spacer" />
        <div className="viz-tab-ds" title="이 탭의 데이터셋">
          <Icon name="layers" size={12} style={{ opacity: 0.6 }} />
          <select className="sel" value={activeSheet.datasetId || globalActive}
            onChange={(e) => actions.setPivotSheetDataset(activeSheet.id, e.target.value)}>
            {datasets.map((d) => <option key={d.id} value={d.id}>{d.short}</option>)}
          </select>
        </div>
      </div>
    );
  }

  function PivotPanel() {
    const pv = useStore(pvState);
    const activeId = useStore((s) => s.activeId);
    const { columns } = derive.getActiveData(activeId);
    const setP = actions.setPivot;

    const addDim = (shelf) => (f) => { if (!pv[shelf].includes(f.key)) setP({ [shelf]: [...pv[shelf], f.key] }); };
    const rmDim = (shelf, key) => setP({ [shelf]: pv[shelf].filter((k) => k !== key) });
    const addVal = (f) => {
      const agg = f.role === "measure" ? "sum" : "countd";
      if (!pv.values.find((v) => v.key === f.key && v.agg === agg)) setP({ values: [...pv.values, { key: f.key, agg, label: f.label || f.key }] });
    };
    const setValAgg = (i, agg) => setP({ values: pv.values.map((v, j) => j === i ? { ...v, agg } : v) });
    const rmVal = (i) => setP({ values: pv.values.filter((_, j) => j !== i) });

    return (
      <div className="pv-panel">
        <Shelf label="Rows" hint="Drop dimension fields" onDropField={addDim("rows")}>
          {pv.rows.map((k) => <DimChip key={k} label={colLabel(columns, k)} onRemove={() => rmDim("rows", k)} />)}
        </Shelf>
        <Shelf label="Columns" hint="Drop dimension fields" onDropField={addDim("columns")}>
          {pv.columns.map((k) => <DimChip key={k} label={colLabel(columns, k)} onRemove={() => rmDim("columns", k)} />)}
        </Shelf>
        <Shelf label="Values" hint="Drop measure/dimension fields" onDropField={addVal}>
          {pv.values.map((v, i) => (
            <span className="pv-chip meas" key={v.key + v.agg + i}>
              <select value={v.agg} onChange={(e) => setValAgg(i, e.target.value)}>{AGGS.map((a) => <option key={a} value={a}>{a}</option>)}</select>
              <span className="pv-chip-name">{colLabel(columns, v.key)}</span>
              <span className="pv-x" onClick={() => rmVal(i)}><Icon name="x" size={11} /></span>
            </span>
          ))}
        </Shelf>
        <div className="pv-note">필드는 좌측 Data Explorer에서 드래그하세요. 합계·집계는 원본 행에서 재계산됩니다.</div>
        {(pv.rows.length || pv.columns.length || pv.values.length) ?
          <button className="btn ghost sm" style={{ margin: "8px 12px" }} onClick={() => actions.setPivot({ rows: [], columns: [], values: [], filters: [] })}>Clear</button> : null}
      </div>
    );
  }

  function PivotCenter() {
    const activeId = useStore((s) => s.activeId);
    const pv = useStore(pvState);
    const sheet = useStore(curPivotSheet);
    // Keep this tab's remembered dataset in sync with the active dataset.
    React.useEffect(() => {
      if (sheet && sheet.datasetId !== activeId) actions.setPivotSheetDataset(sheet.id, activeId);
    }, [activeId, sheet && sheet.id]);
    const { ds, rows, columns } = derive.getActiveData(activeId);
    const [name, setName] = React.useState("");

    const spec = { rows: pv.rows, columns: pv.columns, values: pv.values, filters: pv.filters };
    const result = React.useMemo(() => {
      if (!pv.values.length) return null;
      try { return window.PivotEngine.build(rows, columns, spec); } catch (e) { return { err: e.message }; }
    }, [rows, columns, JSON.stringify(spec)]);

    function saveAsDataset() {
      if (!result || result.err) return;
      const ids = new Set(NODE.datasets.map((d) => d.id));
      const names = new Set(NODE.datasets.flatMap((d) => [d.short, d.name]).filter(Boolean));
      let short = (name.trim() || `${ds.short}_pivot`); let n = 2; const base = short;
      while (names.has(short) || names.has(short + ".csv")) short = `${base}_${n++}`;
      let id = `pivot_${short.replace(/[^a-zA-Z0-9가-힣]+/g, "_").toLowerCase()}`; let m = 2; const idBase = id;
      while (ids.has(id)) id = `${idBase}_${m++}`;
      const dsObj = window.PivotEngine.toDataset(result, { short, id, createdAt: new Date().toISOString() });
      actions.registerDataset(dsObj, { activate: true });
      window.LOG && window.LOG.info("pivot", `saved ${short} — ${dsObj.rows.length} rows`);
      if (window.ProjectStore) window.ProjectStore.saveNow();
      actions.setMode("visualize");
    }

    const hasCols = pv.columns.length > 0;
    return (
      <React.Fragment>
        <PivotTabs />
        <div className="phead">
          <span className="ttl" style={{ color: "var(--tx-hi)", textTransform: "none", fontSize: "var(--fs-13)", letterSpacing: 0 }}>
            <Icon name="grid" size={14} style={{ verticalAlign: "-2px", marginRight: 6, color: "var(--accent)" }} />Pivot Table
          </span>
          <span className="badge mono">{ds.short}</span>
          <div className="spacer" />
          {result && !result.err && (
            <React.Fragment>
              <input className="inp" placeholder={`${ds.short}_pivot`} value={name} onChange={(e) => setName(e.target.value)} style={{ width: 150, marginRight: 8 }} />
              <button className="btn primary sm" onClick={saveAsDataset}><Icon name="visualize" size={12} /> Save & open in Chart</button>
            </React.Fragment>
          )}
        </div>

        {!pv.values.length ? (
          <div className="empty"><Icon name="grid" /><div className="t">Build a pivot</div><div className="s">Drag fields into Rows, Columns, and Values in the right panel. Values need at least one field.</div></div>
        ) : result.err ? (
          <div className="empty"><Icon name="info" /><div className="t">Pivot error</div><div className="s">{result.err}</div></div>
        ) : (
          <div className="pv-tablewrap">
            <table className="pv-table">
              <thead>
                <tr>
                  {result.rowFields.map((f) => <th key={f} className="pv-corner">{colLabel(columns, f)}</th>)}
                  {!result.rowFields.length && <th className="pv-corner" />}
                  {result.leaves.map((l) => <th key={l.id} className="pv-meas">{l.label || l.value.label}</th>)}
                  {hasCols && result.values.map((v) => <th key={v.id} className="pv-total">Σ {v.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((r) => (
                  <tr key={r.id || "all"}>
                    {result.rowFields.map((f, i) => <td key={f} className="pv-dim">{r.key[i] == null ? "—" : String(r.key[i])}</td>)}
                    {!result.rowFields.length && <td className="pv-dim">All</td>}
                    {result.leaves.map((l) => <td key={l.id} className="pv-num">{fmt(r.cells[l.id])}</td>)}
                    {hasCols && result.values.map((v) => <td key={v.id} className="pv-num pv-total">{fmt(r.total[v.id])}</td>)}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="pv-dim" colSpan={Math.max(1, result.rowFields.length)}>Grand Total</td>
                  {result.leaves.map((l) => <td key={l.id} className="pv-num pv-total">{fmt(result.colTotals[l.id])}</td>)}
                  {hasCols && result.values.map((v) => <td key={v.id} className="pv-num pv-total">{fmt(result.grandTotal[v.id])}</td>)}
                </tr>
              </tfoot>
            </table>
            <div className="pv-meta mono">{result.rowCount.toLocaleString()} source rows · {result.rows.length} row groups × {result.leaves.length} value columns</div>
          </div>
        )}
      </React.Fragment>
    );
  }

  window.PivotMode = function () {
    return <window.Workspace left={<window.DatasetTree />} leftTitle="Data Explorer"
      center={<PivotCenter />} right={<PivotPanel />} rightTitle="Pivot Builder" />;
  };
})();
