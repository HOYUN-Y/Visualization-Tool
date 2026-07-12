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

// Register a { id, tableName, rows } list as DuckDB tables (S2 uses this). rows are plain objects.
async function registerTables(specs) {
  await ready;
  const conn = await state.db.connect();
  try {
    for (const { tableName, rows } of specs) {
      const fname = `__reg_${tableName}.json`;
      await state.db.registerFileText(fname, JSON.stringify(rows || []));
      await conn.query(`CREATE OR REPLACE TABLE "${tableName}" AS SELECT * FROM read_json_auto('${fname}')`);
    }
  } finally {
    await conn.close();
  }
}

window.DuckDB = {
  get db() { return state.db; },
  get status() { return state.status; },
  get error() { return state.error; },
  ready,
  query,
  registerTables,
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
