// duckdbEngine.mjs — the app's ONLY ES module. Loads DuckDB-WASM from the jsDelivr CDN (same
// CDN model as React/ECharts here), instantiates it (Web Worker + wasm), and exposes a small
// promise-based API on window.DuckDB for the classic IIFE code (sqlMode etc.) to await.
//
//   window.DuckDB.ready  : Promise that resolves(true) when instantiated, or rejects on failure.
//   window.DuckDB.query(sql) : async → { columns:[{key,label,type,role}], rows:[{...}] }
//   window.DuckDB.db     : the AsyncDuckDB instance (for S2 dataset registration)
//   window.DuckDB.status : "loading" | "ready" | "failed"
//
// Result conversion (Arrow→app shape, BigInt/Date coercion) uses window.DuckDBMap (js/duckdbMap.js,
// a classic script loaded before this module runs). Pinned version for reproducibility.
const DUCKDB_VERSION = "1.29.0";

const state = { db: null, status: "loading", error: null };
let _resolve, _reject;
const ready = new Promise((res, rej) => { _resolve = res; _reject = rej; });

async function instantiate() {
  const duckdb = await import(`https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@${DUCKDB_VERSION}/+esm`);
  const bundle = await duckdb.selectBundle(duckdb.getJsDelivrBundles());
  const workerUrl = URL.createObjectURL(new Blob([`importScripts("${bundle.mainWorker}");`], { type: "text/javascript" }));
  const worker = new Worker(workerUrl);
  const db = new duckdb.AsyncDuckDB(new duckdb.ConsoleLogger(), worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  URL.revokeObjectURL(workerUrl);
  return db;
}

async function query(sql) {
  await ready; // throws if instantiation failed
  const conn = await state.db.connect();
  try {
    const table = await conn.query(sql);
    return window.DuckDBMap.arrowToResult(table);
  } finally {
    await conn.close();
  }
}

// Register a [{ id, tableName, rows }] list as DuckDB tables. rows are plain objects.
async function registerTables(specs) {
  await ready;
  const conn = await state.db.connect();
  try {
    for (let i = 0; i < specs.length; i++) {
      const { tableName, rows } = specs[i];
      const fname = `__reg_${i}.json`; // ascii filename (table name may be Korean); table is quoted
      await state.db.registerFileText(fname, JSON.stringify(rows || []));
      await conn.query(`CREATE OR REPLACE TABLE "${tableName.replace(/"/g, '""')}" AS SELECT * FROM read_json_auto('${fname}')`);
    }
  } finally {
    await conn.close();
  }
}

// Register EVERY dataset's post-cleaning view as a table (enables cross-dataset JOIN). __rid is
// dropped (internal). Table name = sanitized short/id. Returns [{id, table, rows}] for the UI.
async function registerDatasets() {
  await ready;
  const S = window.Store, NODE = window.NODE, MAP = window.DuckDBMap;
  const datasets = (NODE && NODE.datasets) || [];
  const seen = {};
  const specs = datasets.map((ds) => {
    const view = S.derive.getActiveData(ds.id); // { rows, columns } after cleaning steps
    const rows = view.rows.map((r) => { const o = Object.assign({}, r); delete o.__rid; return o; });
    let table = MAP.sanitizeTableName(ds.short || ds.id);
    while (seen[table]) table = table + "_"; // de-dupe collisions
    seen[table] = true;
    return { id: ds.id, tableName: table, rows };
  });
  await registerTables(specs);
  return specs.map((s) => ({ id: s.id, table: s.tableName, rows: s.rows.length }));
}

window.DuckDB = {
  get db() { return state.db; },
  get status() { return state.status; },
  get error() { return state.error; },
  ready,
  query,
  registerTables,
  registerDatasets,
  version: DUCKDB_VERSION,
};

instantiate().then((db) => {
  state.db = db; state.status = "ready";
  _resolve(true);
  if (window.LOG && window.LOG.info) window.LOG.info("duckdb", "instantiated " + DUCKDB_VERSION);
}).catch((e) => {
  state.status = "failed"; state.error = e;
  _reject(e);
  if (window.LOG && window.LOG.error) window.LOG.error("duckdb", "instantiate failed: " + (e && e.message));
});
