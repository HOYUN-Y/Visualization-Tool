/* NØDE/Insight — SQL Workspace: pragmatic local SQL engine over datasets */
(function () {
  const { useStore, actions, derive, stat, aggFn } = window.Store;
  const Icon = window.Icon, NODE = window.NODE, DataGrid = window.DataGrid;

  // ---- tiny SQL engine ----
  function splitTop(s, sep) {
    const out = []; let depth = 0, cur = "";
    for (const ch of s) {
      if (ch === "(") depth++; if (ch === ")") depth--;
      if (ch === sep && depth === 0) { out.push(cur); cur = ""; } else cur += ch;
    }
    if (cur.trim()) out.push(cur); return out.map((x) => x.trim());
  }
  const AGG_RE = /^(sum|avg|count|min|max|median)\s*\(\s*(\*|[\w]+)\s*\)$/i;

  function parseSelectItem(item) {
    let alias = null;
    const am = item.match(/\s+as\s+([\w]+)\s*$/i);
    if (am) { alias = am[1]; item = item.slice(0, am.index).trim(); }
    const ag = item.match(AGG_RE);
    if (ag) { const fn = ag[1].toLowerCase(), col = ag[2]; return { kind: "agg", fn, col, alias: alias || `${fn}_${col === "*" ? "all" : col}` }; }
    return { kind: "col", col: item, alias: alias || item };
  }
  function parseWhere(s) {
    return splitTop(s, " ").join(" ").split(/\s+and\s+/i).map((c) => {
      const m = c.trim().match(/^([\w]+)\s*(>=|<=|!=|<>|=|>|<|like)\s*(.+)$/i);
      if (!m) throw new Error("Cannot parse WHERE: " + c);
      let val = m[3].trim();
      const isStr = /^['"].*['"]$/.test(val);
      if (isStr) val = val.slice(1, -1); else if (/^-?\d+(\.\d+)?$/.test(val)) val = parseFloat(val);
      return { col: m[1], op: m[2].toLowerCase(), val, isStr };
    });
  }
  function testWhere(row, conds) {
    return conds.every((c) => {
      const v = row[c.col];
      switch (c.op) {
        case "=": return String(v) == String(c.val);
        case "!=": case "<>": return String(v) != String(c.val);
        case ">": return v > c.val; case "<": return v < c.val;
        case ">=": return v >= c.val; case "<=": return v <= c.val;
        case "like": { const re = new RegExp("^" + String(c.val).replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".") + "$", "i"); return re.test(String(v)); }
      }
    });
  }

  function runSQL(sql) {
    const t0 = performance.now();
    try {
      let s = sql.replace(/;\s*$/, "").replace(/\s+/g, " ").trim();
      const fromM = s.match(/\bfrom\b/i); if (!fromM) throw new Error("Missing FROM clause");
      const selPart = s.slice(0, fromM.index).replace(/^select\s+/i, "").trim();
      let rest = s.slice(fromM.index + 4).trim();
      const kw = rest.search(/\b(where|group by|order by|limit)\b/i);
      const tableName = (kw === -1 ? rest : rest.slice(0, kw)).trim();
      rest = kw === -1 ? "" : rest.slice(kw);
      const ds = NODE.datasets.find((d) => d.id.toLowerCase() === tableName.toLowerCase() || d.short.toLowerCase() === tableName.toLowerCase());
      if (!ds) throw new Error(`Unknown table "${tableName}". Try: ${NODE.datasets.map((d) => d.id).join(", ")}`);

      const grab = (re) => { const m = rest.match(re); return m ? m[1].trim() : null; };
      const whereS = grab(/\bwhere\b(.+?)(?:\bgroup by\b|\border by\b|\blimit\b|$)/i);
      const groupS = grab(/\bgroup by\b(.+?)(?:\border by\b|\blimit\b|$)/i);
      const orderS = grab(/\border by\b(.+?)(?:\blimit\b|$)/i);
      const limitS = grab(/\blimit\b\s*(\d+)/i);

      let rows = derive.getActiveData(ds.id).rows; // base rows incl. any cleaning steps
      const conds = whereS ? parseWhere(whereS) : null;
      if (conds) rows = rows.filter((r) => testWhere(r, conds));

      const items = splitTop(selPart, ",").map(parseSelectItem);
      const star = items.length === 1 && items[0].col === "*";
      const groupBy = groupS ? splitTop(groupS, ",") : [];
      const hasAgg = items.some((i) => i.kind === "agg");

      let out;
      if (star && !hasAgg && !groupBy.length) {
        out = rows.map((r) => ({ ...r }));
      } else if (groupBy.length || hasAgg) {
        const groups = new Map();
        for (const r of rows) { const k = groupBy.map((g) => r[g]).join("\u0001"); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); }
        out = [];
        for (const grp of groups.values()) {
          const o = {};
          for (const it of items) {
            if (it.kind === "col") o[it.alias] = grp[0][it.col];
            else if (it.col === "*" && it.fn === "count") o[it.alias] = grp.length;
            else o[it.alias] = aggFn[it.fn] ? NODE.round(aggFn[it.fn](grp.map((r) => r[it.col])), 2) : null;
          }
          out.push(o);
        }
      } else {
        out = rows.map((r) => { const o = {}; for (const it of items) o[it.alias] = r[it.col]; return o; });
      }

      if (orderS) {
        const om = orderS.match(/^([\w]+)\s*(asc|desc)?/i); const key = om[1], dir = (om[2] || "asc").toLowerCase() === "desc" ? -1 : 1;
        out.sort((a, b) => { const x = a[key], y = b[key]; if (x == null) return 1; if (y == null) return -1; return (typeof x === "number" ? x - y : String(x).localeCompare(String(y), "ko")) * dir; });
      }
      if (limitS) out = out.slice(0, parseInt(limitS));

      // infer columns
      const keys = out.length ? Object.keys(out[0]) : items.map((i) => i.alias);
      const columns = keys.map((k) => {
        const sample = out.find((r) => r[k] != null);
        const v = sample ? sample[k] : null;
        let type = "string", role = "dimension";
        if (typeof v === "number") { type = Number.isInteger(v) ? "integer" : "float"; role = "measure"; }
        else if (typeof v === "string" && /^\d{4}-\d{2}/.test(v)) type = "datetime";
        else if (typeof v === "string") { const dist = new Set(out.map((r) => r[k])).size; type = dist <= 30 ? "category" : "string"; }
        const src = ds.columns.find((c) => c.key === k);
        return { key: k, label: k, type, role, fmt: src ? src.fmt : null, unit: src ? src.unit : null };
      });
      return { columns, rows: out, ms: (performance.now() - t0).toFixed(1), table: ds, n: out.length };
    } catch (e) { return { error: e.message, ms: (performance.now() - t0).toFixed(1) }; }
  }

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
    const res = runSQL(sql); res.engine = "js"; return res;
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
              <code>SELECT</code> · <code>WHERE</code> (AND, LIKE) · <code>GROUP BY</code> · aggregates
              <code> SUM/AVG/COUNT/MIN/MAX/MEDIAN</code> · <code>ORDER BY</code> · <code>LIMIT</code>. {T("sqlSavableNote")}
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
