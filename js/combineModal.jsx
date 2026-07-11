/* insight Analytics — Combine datasets modal (Union / Join) → window.CombineModal
   Uses the pure window.DataOps engine; materializes results via Store.actions.registerDataset. */
(function () {
  const { useStore, actions } = window.Store;
  const Icon = window.Icon;

  function uniqueId(base) {
    const ids = new Set((window.NODE.datasets || []).map((d) => d.id));
    let id = base, n = 2;
    while (ids.has(id)) id = `${base}_${n++}`;
    return id;
  }
  function uniqueShort(base) {
    const names = new Set((window.NODE.datasets || []).flatMap((d) => [d.short, d.name]).filter(Boolean));
    let s = base, n = 2;
    while (names.has(s) || names.has(`${s}.csv`)) s = `${base}_${n++}`;
    return s;
  }

  function CombineModal() {
    useStore((s) => s.activeId); // re-render when datasets/active change
    const [open, setOpen] = React.useState(false);
    const [op, setOp] = React.useState("union");
    const [picked, setPicked] = React.useState({});     // union: {id:true}
    const [addSource, setAddSource] = React.useState(true);
    const [leftId, setLeftId] = React.useState("");
    const [rightId, setRightId] = React.useState("");
    const [joinType, setJoinType] = React.useState("inner");
    const [pairs, setPairs] = React.useState([{ left: "", right: "" }]);
    const [name, setName] = React.useState("");
    const [error, setError] = React.useState("");

    const datasets = window.NODE.datasets || [];
    const byId = (id) => datasets.find((d) => d.id === id);

    const reset = React.useCallback(() => {
      setError(""); setName(""); setPicked({}); setPairs([{ left: "", right: "" }]);
      setLeftId(datasets[0] ? datasets[0].id : ""); setRightId(datasets[1] ? datasets[1].id : "");
    }, [datasets]);

    React.useEffect(() => {
      const listener = () => { setOpen(true); reset(); };
      window.addEventListener("insight-combine-open", listener);
      return () => window.removeEventListener("insight-combine-open", listener);
    }, [reset]);

    // build the combine result (or null + error)
    const result = React.useMemo(() => {
      try {
        if (op === "union") {
          const sel = datasets.filter((d) => picked[d.id]);
          if (sel.length < 2) return { err: "Select at least two datasets" };
          return { value: window.DataOps.union(sel, { addSource }) };
        }
        const L = byId(leftId), R = byId(rightId);
        if (!L || !R) return { err: "Select left and right datasets" };
        if (L.id === R.id) return { err: "Left and right must differ" };
        const kp = pairs.filter((p) => p.left && p.right);
        if (!kp.length) return { err: "Map at least one key pair" };
        return { value: window.DataOps.join(L, R, { type: joinType, keyPairs: kp }) };
      } catch (e) { return { err: e.message || String(e) }; }
    }, [op, picked, addSource, leftId, rightId, joinType, pairs, datasets]);

    if (!open) return null;
    const res = result && result.value;
    const previewCols = res ? res.columns.slice(0, 12) : [];
    const previewRows = res ? window.DataOps.preview(res, 12) : [];

    function confirm() {
      if (!res) { setError((result && result.err) || "Nothing to combine"); return; }
      try {
        const base = name.trim() || (op === "join" ? "joined" : "combined");
        const short = uniqueShort(base);
        const dsObj = window.DataOps.toDataset(
          { ...res, lineage: { ...res.lineage, createdAt: new Date().toISOString() } },
          { short, id: uniqueId(`combine_${short.replace(/[^a-zA-Z0-9가-힣]+/g, "_").toLowerCase()}`) }
        );
        actions.registerDataset(dsObj, { activate: true });
        window.LOG && window.LOG.info("combine", `${res.op} → ${dsObj.short} (${dsObj.rows.length} rows)`);
        if (window.ProjectStore) window.ProjectStore.saveNow();
        setOpen(false);
      } catch (e) { setError(e.message || String(e)); }
    }

    const L = byId(leftId), R = byId(rightId);
    return (
      <div className="import-overlay" onClick={() => setOpen(false)}>
        <div className="import-modal" onClick={(e) => e.stopPropagation()} style={{ width: "min(960px, calc(100vw - 36px))" }}>
          <div className="import-head">
            <div><strong>Combine datasets</strong><span>UNION · JOIN</span></div>
            <button className="iconbtn" onClick={() => setOpen(false)}><Icon name="x" /></button>
          </div>

          {/* op toggle */}
          <div className="import-filebar">
            {["union", "join"].map((o) => (
              <button key={o} className={"btn sm " + (op === o ? "primary" : "ghost")} onClick={() => setOp(o)}>{o === "union" ? "Union (stack rows)" : "Join (match keys)"}</button>
            ))}
            {op === "union" && (
              <label style={{ marginLeft: 12, display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--tx-mid)" }}>
                <input type="checkbox" checked={addSource} onChange={(e) => setAddSource(e.target.checked)} /> add __source column
              </label>
            )}
          </div>

          {/* selectors */}
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)" }}>
            {op === "union" ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {datasets.map((d) => (
                  <label key={d.id} className={"import-sheet" + (picked[d.id] ? " active" : "")} style={{ minWidth: 170 }} onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={!!picked[d.id]} onChange={(e) => setPicked((p) => ({ ...p, [d.id]: e.target.checked }))} />
                    <span><strong>{d.short}</strong><small>{d.rows.length} rows × {d.columns.length} cols</small></span>
                  </label>
                ))}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <select className="sel" value={leftId} onChange={(e) => { setLeftId(e.target.value); setPairs([{ left: "", right: "" }]); }}>
                    <option value="">Left dataset…</option>
                    {datasets.map((d) => <option key={d.id} value={d.id}>{d.short}</option>)}
                  </select>
                  <select className="sel" value={joinType} onChange={(e) => setJoinType(e.target.value)}>
                    {["inner", "left", "right", "full"].map((t) => <option key={t} value={t}>{t} join</option>)}
                  </select>
                  <select className="sel" value={rightId} onChange={(e) => { setRightId(e.target.value); setPairs([{ left: "", right: "" }]); }}>
                    <option value="">Right dataset…</option>
                    {datasets.map((d) => <option key={d.id} value={d.id}>{d.short}</option>)}
                  </select>
                </div>
                {L && R && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ fontSize: 11, color: "var(--tx-faint)" }}>Key mapping</div>
                    {pairs.map((p, i) => (
                      <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <select className="sel" value={p.left} onChange={(e) => setPairs((ps) => ps.map((x, j) => j === i ? { ...x, left: e.target.value } : x))}>
                          <option value="">{L.short} key…</option>
                          {L.columns.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                        </select>
                        <span style={{ color: "var(--tx-faint)" }}>=</span>
                        <select className="sel" value={p.right} onChange={(e) => setPairs((ps) => ps.map((x, j) => j === i ? { ...x, right: e.target.value } : x))}>
                          <option value="">{R.short} key…</option>
                          {R.columns.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                        </select>
                        {pairs.length > 1 && <button className="iconbtn" onClick={() => setPairs((ps) => ps.filter((_, j) => j !== i))}><Icon name="x" size={12} /></button>}
                      </div>
                    ))}
                    <button className="btn ghost sm" style={{ alignSelf: "flex-start" }} onClick={() => setPairs((ps) => [...ps, { left: "", right: "" }])}><Icon name="plus" size={12} /> Add key</button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* preview + warnings */}
          {res && (
            <div className="import-preview-wrap">
              <div className="import-preview-title">
                <strong>Preview</strong>
                <span>{res.rows.length.toLocaleString()} rows × {res.columns.length} cols · first {previewRows.length}</span>
                {res.stats && res.stats.manyToMany && <span style={{ color: "var(--neg)", marginLeft: 8 }}>⚠ many-to-many — row explosion ({res.stats.outputRows.toLocaleString()} rows)</span>}
              </div>
              <div className="import-preview">
                <table><thead><tr>{previewCols.map((c) => <th key={c.key}><span>{c.label}</span><select value={c.type} disabled><option>{c.type}</option></select></th>)}</tr></thead>
                  <tbody>{previewRows.map((row, i) => <tr key={i}>{previewCols.map((c) => {
                    const v = row[c.key]; const t = v == null ? "—" : String(v);
                    return <td key={c.key} title={t}>{t}</td>;
                  })}</tr>)}</tbody></table>
              </div>
            </div>
          )}

          {(error || (result && result.err)) && <div className="import-error"><Icon name="info" size={13} />{error || result.err}</div>}
          <div className="import-actions">
            <input className="inp" placeholder={op === "join" ? "joined" : "combined"} value={name} onChange={(e) => setName(e.target.value)} style={{ width: 180, marginRight: "auto" }} />
            <button className="btn ghost sm" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn primary sm" disabled={!res} onClick={confirm}><Icon name="plus" /> Create dataset{res ? ` (${res.rows.length.toLocaleString()} rows)` : ""}</button>
          </div>
        </div>
      </div>
    );
  }

  window.CombineModal = CombineModal;
})();
