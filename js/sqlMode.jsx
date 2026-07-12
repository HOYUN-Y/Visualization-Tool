/* NØDE/Insight — SQL Workspace: pragmatic local SQL engine over datasets */
(function () {
  const { useStore, actions, derive, stat, aggFn } = window.Store;
  const Icon = window.Icon, NODE = window.NODE, DataGrid = window.DataGrid;

  // The hand-written JS SQL engine (DuckDB fallback) lives in js/sqlFallback.js (window.SQLFallback,
  // dual-mode + Node-tested). Unicode identifiers supported there. runQuery() below injects datasets.

  const DEFAULT_SQL = `SELECT district,
       AVG(price_manwon) AS avg_price,
       AVG(price_per_m2) AS avg_ppm2,
       COUNT(*) AS txns
FROM seoul_txns
WHERE building_type = '아파트'
GROUP BY district
ORDER BY avg_price DESC
LIMIT 10`;

  const EXAMPLES = [
    { tk: "sqlExTopDistricts", q: DEFAULT_SQL },
    { tk: "sqlExMonthlyTxns", q: "SELECT month, txn_count, avg_price_per_m2\nFROM monthly_index\nORDER BY month ASC" },
    { tk: "sqlExLargePremium", q: "SELECT complex_name, district, area_m2, price_manwon\nFROM seoul_txns\nWHERE area_m2 > 120 AND price_manwon > 200000\nORDER BY price_manwon DESC\nLIMIT 20" },
    { tk: "sqlExMixByType", q: "SELECT building_type, COUNT(*) AS n, AVG(price_per_m2) AS ppm2\nFROM seoul_txns\nGROUP BY building_type\nORDER BY n DESC" },
  ];

  // Build a sensible starter query from the ACTIVE dataset's real columns.
  function defaultSql(ds) {
    if (!ds || !ds.columns || !ds.columns.length) return DEFAULT_SQL;
    const dim = ds.columns.find((c) => c.role === "dimension");
    const meas = ds.columns.filter((c) => c.role === "measure").slice(0, 2);
    if (dim && meas.length) {
      const aggs = meas.map((m) => `       AVG(${m.key}) AS avg_${m.key}`).join(",\n");
      return `SELECT ${dim.key},\n${aggs},\n       COUNT(*) AS n\nFROM ${ds.id}\nGROUP BY ${dim.key}\nORDER BY n DESC\nLIMIT 20`;
    }
    return `SELECT *\nFROM ${ds.id}\nLIMIT 100`;
  }

  function sqlErrMsg(e) { return String((e && e.message) || e || "query failed").replace(/^Error:\s*/, "").slice(0, 400); }

  // Run a query through DuckDB-WASM if it loaded (registering all datasets as tables first, so
  // cross-dataset JOIN/window/CTE work); otherwise fall back to the hand-written JS engine
  // (offline / CDN unreachable). Returns { columns, rows, n, ms, engine } or { error, ms, engine }.
  async function runQuery(sql) {
    const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
    const t0 = now(), dur = () => Math.round(now() - t0);
    const D = window.DuckDB;
    if (D) { try { await D.ready; } catch (e) { /* load failed → JS fallback below */ } }
    if (D && D.status === "ready") {
      try {
        await D.registerDatasets();
        const r = await D.query(sql);
        return { columns: r.columns, rows: r.rows, n: r.rows.length, ms: dur(), engine: "duckdb" };
      } catch (e) {
        return { error: sqlErrMsg(e), ms: dur(), engine: "duckdb" };
      }
    }
    const res = window.SQLFallback.runSQL(sql, {
      datasets: NODE.datasets,
      getRows: (id) => derive.getActiveData(id).rows,
      aggFn,
      round: NODE.round,
    });
    res.engine = "js"; return res;
  }

  function SQLCenter() {
    const lang = useStore((s) => s.tweaks.lang) || "ko";
    const T = (k) => window.I18N.t(lang, k);
    const activeId = useStore((s) => s.activeId);
    const initSql = React.useMemo(() => defaultSql(derive.getDataset(activeId)), []);
    const [sql, setSql] = React.useState(initSql);
    const [result, setResult] = React.useState(null);
    const [running, setRunning] = React.useState(true);
    const taRef = React.useRef(null);
    const execute = async (q) => {
      window.LOG && window.LOG.info('sql', 'SQL executed', { sql: q.trim().slice(0, 300) });
      setRunning(true);
      const res = await runQuery(q);
      if (res.error) window.LOG && window.LOG.warn('sql', 'SQL error: ' + res.error, { sql: q.trim().slice(0, 300) });
      setResult(res); setRunning(false);
    };
    const run = () => execute(sql);
    React.useEffect(() => { execute(initSql); }, []); // initial run once DuckDB (or fallback) is available
    React.useEffect(() => { window.__sqlSet = (q) => setSql(q); return () => { delete window.__sqlSet; }; }, []);
    const onKey = (e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); run(); } };
    const engineLabel = result && result.engine === "js" ? "in-browser JS" : "DuckDB-WASM";

    const save = () => {
      if (!result || result.error) return;
      const id = "query_" + Date.now().toString(36);
      actions.registerDataset({ id, name: id + ".csv", short: "Query result", icon: "trend", source: "SQL", rows: result.rows, columns: result.columns }, { activate: true });
      actions.setMode("data");
    };

    return (
      <React.Fragment>
        <div className="phead">
          <span className="ttl" style={{ textTransform: "none", fontSize: "var(--fs-13)", letterSpacing: 0, color: "var(--tx-hi)" }}>
            <Icon name="sql" size={14} style={{ verticalAlign: "-2px", marginRight: 6, color: "var(--accent)" }} />{T("sqlWorkspace")}
          </span>
          <span className="badge mono"><Icon name="db" size={11} /> {engineLabel}</span>
          <div className="spacer" />
          <button className="btn ghost sm" disabled={running || !result || result.error} onClick={save}><Icon name="save" /> {T("sqlSaveDataset")}</button>
          <button className="btn primary sm" disabled={running} onClick={run}><Icon name="play" size={12} /> {running ? T("sqlRunning") : T("sqlRun")} <span className="kbd" style={{ marginLeft: 4 }}>⌘↵</span></button>
        </div>

        <div className="sql-editor">
          <div className="sql-gutter">{sql.split("\n").map((_, i) => <div key={i}>{i + 1}</div>)}</div>
          <textarea ref={taRef} className="sql-ta mono" spellCheck={false} value={sql}
            onChange={(e) => setSql(e.target.value)} onKeyDown={onKey} />
        </div>

        <div className="sql-resbar">
          {running ? <span className="mono" style={{ color: "var(--tx-lo)" }}>{T("sqlRunning")}</span>
            : !result ? null
            : result.error ? <span className="sql-err"><Icon name="info" size={13} /> {result.error}</span>
            : <span className="mono"><span style={{ color: "var(--pos)" }}>●</span> {result.n} {T("rows")} · {result.ms} ms · <b style={{ color: "var(--tx-hi)" }}>{engineLabel}</b></span>}
          <div className="spacer" />
        </div>
        <div className="sql-results">
          {running ? <div className="empty"><Icon name="sql" /><div className="t">{T("sqlRunning")}</div></div>
            : !result ? null
            : result.error ? <div className="empty"><Icon name="sql" /><div className="t">{T("sqlQueryError")}</div><div className="s">{result.error}</div></div>
            : <DataGrid columns={result.columns} rows={result.rows} pageSize={50} />}
        </div>
      </React.Fragment>
    );
  }

  function SQLPanel() {
    const lang = useStore((s) => s.tweaks.lang) || "ko";
    const T = (k) => window.I18N.t(lang, k);
    const activeId = useStore((s) => s.activeId);
    const ds = derive.getDataset(activeId);
    const examples = [{ t: "현재 데이터 · " + (ds ? ds.short : "active"), q: defaultSql(ds) }, ...EXAMPLES];
    return (
      <div className="sqlpanel">
        <div className="cp-block">
          <div className="cp-blocktitle">{T("sqlExampleQueries")}</div>
          <div className="sql-examples">
            {examples.map((e, i) => (
              <button key={i} className="sql-ex" onClick={() => window.__sqlSet && window.__sqlSet(e.q)}>
                <Icon name="play" size={11} /><span>{e.tk ? T(e.tk) : e.t}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="cp-block">
          <div className="cp-blocktitle">{T("sqlTables")}</div>
          {NODE.datasets.map((ds) => (
            <div key={ds.id} className="sql-table">
              <div className="sql-table-h"><Icon name={ds.icon} size={13} /><span className="mono">{ds.id}</span><span className="sql-tn mono">{ds.rows.length}</span></div>
              <div className="sql-cols">{ds.columns.map((c) => <span key={c.key} className="sql-col mono" title={c.type}>{c.key}</span>)}</div>
            </div>
          ))}
        </div>
        <div className="cp-block">
          <div className="cp-blocktitle">{T("sqlSupported")}</div>
          <div className="cf-info" style={{ display: "block" }}>
            <span style={{ fontSize: "var(--fs-11)", color: "var(--tx-lo)", lineHeight: 1.6 }}>
              <code>SELECT</code> · <code>JOIN</code> · <code>WHERE</code> · <code>GROUP BY</code> · <code>HAVING</code> · <code>WITH</code> · window · <code>ORDER BY</code> · <code>LIMIT</code>. {T("sqlFullSql")} {T("sqlSavableNote")}
            </span>
          </div>
        </div>
      </div>
    );
  }

  window.SqlMode = function () {
    const lang = useStore((s) => s.tweaks.lang) || "ko";
    const T = (k) => window.I18N.t(lang, k);
    return <window.Workspace left={<window.DatasetTree />} leftTitle={T("dashDataExplorer")}
      center={<SQLCenter />} right={<SQLPanel />} rightTitle={T("sqlReference")} />;
  };
})();
