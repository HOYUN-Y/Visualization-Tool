# INSIGHT Analytics Workbench — Project Handoff

> **먼저 읽기:** 승인된 구현 계획은 [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md), 현재 체크포인트와 다음 행동은 [`WORKLOG.md`](./WORKLOG.md#current-state)를 기준으로 합니다.

> Local-first Business Intelligence & data-analytics workbench (Tableau / Power BI / JMP-style),
> built as a **single-page, no-build** web app. Dark-default + light themes, English UI,
> high information density. Sample domain: **Seoul apartment transactions (실거래가)**.
>
> 이 문서는 다른 모델/계정/Claude Code에서 코드를 바로 이해하고 수정할 수 있도록 작성된 개발 인수인계 문서입니다.
> (코드 식별자는 영어, 설명은 영어 + 일부 한글 주석)

---

## 1. TL;DR — what this is

A browser-only analytics tool with **8 workspace modes** selectable from the left rail:

| Rail id | Label | What it does |
|---|---|---|
| `data` | Data | Dataset explorer + dense data grid + auto profiling + per-column statistics |
| `clean` | Clean | Cleaning Studio: reversible cleaning pipeline (missing/dupes/outliers/transform) |
| `sql` | SQL | Local SQL engine (SELECT/WHERE/GROUP BY/aggregates/ORDER/LIMIT) over datasets |
| `visualize` | Chart | Tableau-style Columns/Rows shelves → ECharts (20 chart types in 4 groups) |
| `map` | Map | Seoul · Korea · World 3-tab maps + imported lat/lon data overlay |
| `dashboard` | Board | Drag/resize widget grid (KPI/Chart/Table/Text) with **cross-filtering** |
| `stats` | Stats | Significance testing: Correlation, T-Test, ANOVA, Chi-Square, Regression + auto-interpretation |
| `ml` | ML | In-browser AutoML: OLS regression, k-NN classification, KMeans clustering |

Plus: **Ask Insight** AI drawer (auto-insights + NL→chart), **Tweaks** panel (layout/tone/accent),
dark/light toggle, CSV/TSV/JSON/XLSX import, PNG/CSV export. Projects, mutable datasets, analysis
history, and workspace state persist locally in IndexedDB; portable project JSON provides backup/restore.
Session logs remain separate in `localStorage` and are not included in projects.

---

## 2. Run / preview

No build step. It's plain HTML + in-browser Babel.

- Just open `index.html` in a static server (any), or the project preview.
- External CDNs required at runtime:
  - React 18.3.1, ReactDOM 18.3.1, @babel/standalone 7.29.0 (pinned, with SRI integrity hashes — keep them).
  - Apache ECharts 5.5.1 (`cdn.jsdelivr.net`).
  - Google Fonts: **IBM Plex Sans** + **IBM Plex Mono**.
  - Map mode fetches Seoul, Korea-province, and world GeoJSON at runtime. Seoul falls back to a bubble map; Korea/world choropleths require their remote GeoJSON.

SheetJS CE 0.20.3 is vendored locally under `vendor/sheetjs-0.20.3/`; do not replace it with a runtime CDN reference without updating its recorded license and SHA-256.

> ⚠️ It uses the **in-browser Babel transformer** (fine for prototyping; the console prints the usual "precompile for production" warning). For a real app you'd migrate to the Next.js/Vite stack described in §11.

Automated persistence regression tests:

```bash
node --test tests/*.test.js
```

Browser approval checklist: [`tests/MANUAL_PROJECT_PERSISTENCE.md`](./tests/MANUAL_PROJECT_PERSISTENCE.md).

---

## 3. Tech & rendering model

- **React 18** via global `React` / `ReactDOM` (UMD) — **no JSX imports/modules**. Every `*.jsx` file is a `<script type="text/babel">` that runs in its own transpile scope.
- **Cross-file sharing is done through `window`**: each module attaches its exports to `window` at the end of its IIFE (e.g. `window.DataGrid = …`, `Object.assign(window, { DatasetTree, DataCenter })`). Other files read them as `window.X` at render time.
- **No `import`/`export`, no bundler.** Load order in `index.html` matters (data → math → icons → store → projectStore → charts → grid → shell → modes → tweaks → ai → app).
- **Charts**: Apache ECharts, wrapped by `window.Charts.EChart`.
- **CSS**: hand-written, one file per concern, all driven by CSS custom properties (design tokens).

---

## 4. File map

```
index.html                 # loads everything; <script> order is significant

css/
  tokens.css               # design tokens: type, spacing, dark/light themes, accent, chart palette
  app.css                  # base + shell components (topbar, rail, panels, buttons, fields, chips, inputs…)
  grid.css                 # dense DataGrid
  data.css                 # Data mode (explorer rows, profiling cards, column profile, histograms)
  clean.css                # Cleaning Studio (issue bar, pipeline)
  viz.css                  # Visualization Builder (shelves, Show Me tiles, marks)
  dash.css                 # Dashboard (widget grid, KPI, cross-filter bar)
  sql.css                  # SQL Workspace (editor, results bar, reference)
  map.css                  # Map mode (note banner, leaderboard)
  ml.css                   # ML Studio (metric cards, feature importance)
  stats.css                # Stats Studio (cards, verdict callout, tables)
  tweaks.css               # Tweaks panel + all variation overrides (tone/density/sidebar/accent)
  ai.css                   # Ask Insight drawer

js/
  data.js          (plain) # window.NODE: sample datasets + formatters (seeded, stable)
  statsMath.js     (plain) # window.SM: incomplete gamma/beta, t/F/chi² p-values, matrix inverse
  icons.jsx                # window.Icon — inline line-icon set <Icon name="…" />
  store.jsx                # window.Store — global state, actions, transforms, aggregation, stats helpers
  projectStore.js          # window.ProjectStore — IndexedDB projects, autosave, portable JSON
  importEngine.js          # window.ImportEngine — shared parsers, XLSX inspection, deterministic type inference
  dataOps.js               # window.DataOps — pure union/join engines, lineage, materialized datasets
  combineModal.jsx         # window.CombineModal — Union/Join UI modal (Data explorer)
  pivotEngine.js           # window.PivotEngine — pure cross-tab aggregation, grand totals, toDataset
  pivotMode.jsx            # window.PivotMode — drag-and-drop Pivot workspace (Rows/Columns/Values)
  kpiFormula.js            # window.KPIFormula — safe aggregate formula parser/evaluator (no eval), compute()
  pca.js                   # window.PCA — standardized covariance + Jacobi eigen, scree/biplot
  logistic.js              # window.Logistic — logistic regression, ROC/AUC, PR curve, metrics
  timeSeries.js            # window.TimeSeries — MA/WMA/EMA, Holt, diff, ACF/PACF, rolling std
  distributionFit.js       # window.DistFit — normInv/normCdf, QQ-normal, normal fit, Jarque-Bera
  spc.js                   # window.SPC — control charts (I-MR/X-bar/p/c/u), Cp/Cpk, Pareto
  clustering.js            # window.Clustering — DBSCAN + agglomerative hierarchical (Lance-Williams)
  timeSeriesDecomp.js      # window.TSDecomp — classical seasonal decomposition (trend/seasonal/residual, add|mult)
  outliers.js              # window.Outliers — multivariate Mahalanobis outliers (self-contained inverse + χ² cutoff)
  geoMatch.js              # window.GeoMatch — region-name normalize/match (KO admin suffix + EN/KO aliases) for choropleths
  i18n.js                  # window.I18N — ko/en dictionary + t(lang,key); lang in tweaks.lang
  chartAdvisor.js          # window.ChartAdvisor — rule-based chart-type recommendation (Show Me)
  # ── config helpers extracted from mode .jsx for Node regression tests (dual-mode) ──
  statsCfg.js              # window.StatsCfg — schema-agnostic Stats starter/heal (catsOf/numsOf/defaultCfg/resolveCfg)
  mlCfg.js                 # window.MlCfg — schema-agnostic ML config (mlNums/mlCats/mlDefaultCfg/mlResolveCfg)
  dashWidgets.js           # window.DashWidgets — dynamic dashboard starter widgets + staleness (defaultWidgets/widgetStale)
  aiIntent.js              # window.AiIntent — Ask Insight column helpers + NL→intent + suggestion chips
  sheets.js                # window.Sheets — generic multi-tab sheet reducers (add/rename/remove/duplicate/updateActive); store wiring pending
  pptxExport.js            # window.PptxExport — native .pptx chart export (needs vendor/pptxgenjs)
  # vizMode.jsx: FormatPanel (title/legend/labels/axis/grid/bg/text/series/size), applyFormat post-processor,
  #   chart resize handles, legend/title free-drag, Export menu (PNG/SVG/clipboard/PPTX). viz.format holds all overrides.
  # ML mode wires Logistic/PCA/DBSCAN/Hierarchical; Stats mode wires Q-Q/Time Series/SPC
  charts.jsx               # window.Charts — ECharts wrapper + CSS-var→rgb resolver + theme colors
  grid.jsx                 # window.DataGrid, Popover, fmtCell, typeShort, isNumType, colorMap
  shell.jsx                # window.TopBar, Rail, StatusBar, Workspace, MODES
  dataMode.jsx             # window.DatasetTree, DataCenter, ColumnProfile
  cleanMode.jsx            # window.CleanMode
  vizMode.jsx              # window.VizMode, window.buildVizOption (reused by dashboard), window.VizAddField
  dashMode.jsx             # window.DashMode
  sqlMode.jsx              # window.SqlMode (+ internal runSQL engine)
  mapMode.jsx              # window.MapMode
  insightEngine.js (plain) # window.IE: profileDataset, summarizeCorrelation/Regression/Clustering/Classification, recommendNextStep
  mlMode.jsx               # window.MlMode (regression/classification/kmeans) + window.NODE.mlHistory + lastAnalysisResult
  statsMode.jsx            # window.StatsMode (corr/ttest/anova/chisq/regression/distribution/builder)
  tweaks.jsx               # window.TweaksPanel
  aiDrawer.jsx             # window.AIDrawer (IE auto-profile + NL intent routing + last result linking)
  app.jsx                  # window App root: applies theme/tweak attributes, routes mode→component, mounts
```

---

## 5. State store (`js/store.jsx`)

Tiny redux-like store. **Read with the `useStore(selector)` hook; mutate only through `actions`.**

```js
const { useStore, getState, setState, subscribe, actions, derive, stat, aggFn } = window.Store;
const mode = useStore(s => s.mode);          // subscribes & re-renders on change
actions.setMode("visualize");                 // never setState directly from components
```

### State shape
```js
{
  theme: "dark" | "light",
  mode: "data"|"clean"|"sql"|"visualize"|"map"|"dashboard"|"stats"|"ml",
  activeId: "seoul_txns",                      // current dataset id
  ui: {
    leftW, rightW,                             // side-panel widths (px), drag-resizable
    dataTab: "preview"|"profiling",
    selCol: string|null,                       // selected column (Data mode right panel)
    aiOpen: bool,
    ml:   {...} | undefined,                   // ML Studio config + last result (see §9 ML)
    stats:{...} | undefined,                   // Stats config (see §9 Stats)
  },
  clean: { [datasetId]: { steps: Step[], cursor: number } },  // cleaning history per dataset
  viz: { type, cols[], rows[], color, filters[], sortDesc, topN },  // chart spec
  dash: { widgets: Widget[]|null, cross: {key,value,source}|null, edit: bool },
  tweaks: { layout, sidebar, tone, density, accent, explorerSide }, // see §10
}
```

### Actions (selected)
`setTheme, toggleTheme, setMode, setActive, setUI, setTweak`
`hydrateProject, registerDataset, removeDataset`  (project restore + dataset lifecycle)
`addStep, undo, redo, gotoStep, clearSteps`  (cleaning; `cursor` is the undo pointer)
`setViz, addToShelf(shelf,field), removeFromShelf, setRowAgg`  (chart)
`setDash, setCross`  (dashboard)

### Derived helpers (`Store.derive`)
- `getDataset(id)` → dataset object.
- `getActiveData(id)` → `{ ds, rows, columns, steps, cursor }` — **rows/columns are the dataset after applying its cleaning pipeline up to `cursor`.** Always read data through this so cleaning steps propagate everywhere (grid, charts, stats, ml…). **Memoized** on `(dataset ref, steps ref, cursor)`; repeat calls return the *same* object. ⚠️ **Treat the returned `rows`/`columns` as read-only** — copy before sorting/mutating (`[...rows].sort(…)`), never `rows.sort()`/`row[k]=…` in feature code, or you corrupt the shared cache. Mutations belong in cleaning ops (`applySteps`).
- `applySteps(dataset, steps)` → `{rows, columns}` (pure).
- `aggregate(rows, dimKeys[], measures[])` → grouped rows; measures are `{key, agg, id}`.
- `colStats(rows, key)` → `{mean, median, mode, q1, q3}`.

### Stats helpers (`Store.stat`)
`mean, sum, min, max, median, quantile(a,q), std, mode, countDistinct, missing, pearson(a,b), histogram(a,bins)`.
`Store.aggFn` maps agg names → functions: `sum, avg, mean, median, min, max, count, countd`.

---

## 6. Data model (`js/data.js` → `window.NODE`)

Seeded PRNG (stable across reloads). Seven built-in datasets:

| id | rows | note |
|---|---|---|
| `seoul_txns` | 503 | main fact table; **intentionally dirty** (injected missing `built_year`/`area_m2`, duplicate rows, a few ₩/m² outliers) so Cleaning Studio has work to do |
| `monthly_index` | ~42 | derived monthly avg ₩/m² + counts (time series; rise→dip→recovery trend baked in) |
| `kospi_stock` | 320 | simulated OHLCV data used by the three financial chart types |
| `district_stats` | 12 | derived per-district aggregates + lat/lon (used by Map) |
| `world_gdp` | 30 | country GDP, population, per-capita GDP, and growth data |
| `korea_provinces` | 17 | province-level population, area, density, and GRDP |
| `korea_municipalities` | 84 | municipality-level population, area, density, and lat/lon |

`seoul_txns` columns: `id, txn_date(datetime), district(category, 12 Seoul gu), building_type(category: 아파트/오피스텔/빌라), complex_name, area_m2(float,m²), floor(int), built_year(int), price_manwon(int, 만원, fmt:"won"), price_per_m2(float, 만원/m²), lat, lon`.

**Column metadata** = `{ key, label, type, role, agg, unit, fmt }`:
- `type`: `string | integer | float | category | datetime | boolean`
- `role`: `dimension | measure` (drives Tableau-style field bucketing)
- `agg`: default aggregation for measures
- `fmt`: `"won"` → formatted as 억/만 via `NODE.fmtWon`

Formatters on `window.NODE`: `fmtWon(만원)`, `fmtNum(v,dec)`, `fmtCompact(v)` (억/만/k), `round(n,d)`.
Datasets remain in `window.NODE.datasets`, but every runtime addition/removal must go through
`Store.actions.registerDataset(dataset, {activate})` / `removeDataset(id)` so React updates and autosave run.

> To swap in real data: replace the dataset objects in `data.js` (keep the `{rows, columns}` shape + column metadata). Everything downstream is generic.

---

## 7. Design system (`css/tokens.css`)

All visuals are CSS variables; **never hard-code colors in components** — use tokens.

- **Type**: `--font-ui` = IBM Plex Sans, `--font-mono` = IBM Plex Mono (numbers use `.mono`/tabular figures). Compact scale `--fs-9 … --fs-32`.
- **Density metrics**: `--row-h: 28px`, `--topbar-h: 44px`, `--rail-w: 52px`, `--tab-h: 34px`.
- **Themes**: `:root`/`[data-theme="dark"]` (default) and `[data-theme="light"]`. Backgrounds `--bg-0..3`, text `--tx-hi/mid/lo/faint`, lines `--line/-2/-strong`, all in **oklch**.
- **Accent** (orange by default): `--accent`, `--accent-hi`, `--accent-soft`, `--accent-line`.
- **Field role colors**: `--dim-color` (cool blue, dimensions), `--meas-color` (green, measures).
- **Chart palette**: `--cat-1 … --cat-8` (orange anchor + harmonious set). `charts.jsx` resolves these CSS vars to rgb (via a 1×1 canvas) so ECharts can use them; `Charts.palette()` / `Charts.themeColors()`.

`app.jsx` writes theme + tweak choices as attributes on `<html>`: `data-theme, data-tone, data-density, data-sidebar, data-accent`. CSS overrides hang off those (see `tweaks.css`).

---

## 8. Shell & layout (`js/shell.jsx`)

- `<TopBar>` — Insight logomark, workbench name, project switcher/save status, functional CSV/TSV/JSON/XLSX **Import**, functional PNG/CSV **Export**, **Ask Insight** toggle (`ui.aiOpen`), Tweaks button, theme toggle, avatar.
- `<Rail>` — the 8 `MODES`. Active mode highlighted; click → `actions.setMode`.
- `<StatusBar>` — engine label, dataset, row/col counts. The current UI string says `Local engine · DuckDB`, but the runtime still uses the hand-written JavaScript SQL/aggregation engine; treat the DuckDB label as aspirational until the engine swap is implemented.
- `<Workspace left center right …>` — the **3-panel frame** used by every mode. Left = explorer, center = workspace, right = inspector. Side panels are **drag-resizable** (the `.resizer` handles write `ui.leftW/rightW`). Honors tweaks: `explorerSide:"right"` swaps panels; `layout:"focus"` hides the right panel.

Every mode returns `<Workspace left={<DatasetTree/>} center={<XCenter/>} right={<XPanel/>} />`.
`DatasetTree` (left explorer) is **shared by all modes** — lists datasets, expands to Dimensions/Measures, fields are draggable (`dataTransfer "application/node-field"`) and double-clickable (→ `window.VizAddField` in Chart mode).

---

## 9. Mode-by-mode detail

### Data (`dataMode.jsx`)
- Center tabs: **Data Preview** (DataGrid) / **Profiling** (one card per column: mini distribution + key stats + % null).
- Right: **Column Profile** for `ui.selCol` — overview (count/missing/distinct), numeric → full histogram + boxplot + mean/median/std/quartiles; category → top values; datetime → range.
- **DataGrid** (`grid.jsx`) features: global search, click-header sort, per-column menu (sort/filter/freeze/hide), category multi-select **filter popovers** + numeric range filters, column show/hide menu, pagination, frozen columns, type badges, in-cell data bars (measures), category swatches, and null styling. In Data mode, an Edit toggle additionally enables cell editing, row selection/add/delete, column add/delete/rename/type change, and header drag reorder. Clean & SQL reuse the read-only grid.

### Clean (`cleanMode.jsx`)
- Top **issue bar**: live counts of missing cells / duplicate rows / outliers with one-click fixes.
- Center: DataGrid of the **current pipeline output** (recomputes on every step / undo / redo).
- Right: **Add operation** (per-column) + **Pipeline** (ordered steps; click any step to time-travel; steps after `cursor` shown struck-through = redoable).
- Ops (`Step.op`) are centralized in `Store.derive.applySteps`: basic cleaning (`drop_missing`, fills, duplicates, outliers, rename/replace/type), encoding (`label_encode`, `dummy_encode`), numeric transforms (`standardize`, `normalize`, `log_transform`, `rank_transform`, `winsorize`, `binning`), `formula`, column removal, and direct-edit ops (`set_cell`, `drop_rows`, `add_row`, `add_col`, `reorder_cols`). **To add an op:** add a `case` there + a button in `CleanPanel` + a label/icon in the pipeline.

### SQL (`sqlMode.jsx`)
- Hand-written engine `runSQL(sql)` — supports `SELECT (cols / *, AGG(col) AS alias)`, `FROM <datasetId|short>`, `WHERE c op v [AND …]` (ops `= != <> > < >= <= LIKE`, `%`/`_` wildcards), `GROUP BY`, aggregates `SUM/AVG/COUNT/MIN/MAX/MEDIAN` (`COUNT(*)`), `ORDER BY col [ASC|DESC]`, `LIMIT n`. No JOIN/subquery/window yet.
- Editor (textarea + gutter), **⌘/Ctrl+Enter** runs, results in DataGrid, **Save as dataset** pushes results into `NODE.datasets`. Right panel: example queries + table schema chips.

### Chart / Visualization Builder (`vizMode.jsx`)
- **Shelves**: drag dimensions → **Columns** (`viz.cols`), measures → **Rows** (`viz.rows`, each carries an `agg` with a click-to-change menu). Drop a dimension on **Marks ▸ Color** (`viz.color`) to split series.
- **Show Me** contains 20 chart types in four groups: Basic 8, Advanced 8, Financial 3, Special/Facet 1. Tiles enable/disable according to each type's field requirement (`need`).
- Sort/limit controls (`sortDesc`, `topN`).
- `buildVizOption(type, {rows, cols, measures, color, sortDesc, topN})` builds the ECharts option and is **exported (`window.buildVizOption`) and reused by dashboard chart widgets**.
- `window.VizAddField(field)` = double-click-to-add behavior.

### Map (`mapMode.jsx`)
- **Seoul · 구**: uses `district_stats`; metric toggle (₩/m² · Price · Txns), choropleth/bubble view, district selection through shared cross-filter state. Seoul GeoJSON failure falls back to lat/lon bubbles.
- **Korea · 행정구역**: 17-province choropleth plus 84-municipality bubbles, province filtering/drilldown, and an imported-data mode that auto-detects lat/lon columns. Highcharts map-collection coordinates require the built-in WGS84→UTM52N/JSON conversion.
- **World · GDP**: 30-country choropleth for GDP, per-capita GDP, population, and growth.
- Module-level `_geoState`, `_koreaProvState`, and `_worldGeoState` cache the three remote map resources.

### Board / Dashboard (`dashMode.jsx`)
- 12-column grid; widgets `{id, type, x, y, w, h, title, spec}`. Types: `kpi, chart, table, text`.
- `defaultWidgets()` seeds a market overview (4 KPIs + bar + donut + scatter + table).
- **Edit mode** (`dash.edit`): drag header to move, corner handle to resize, duplicate, delete; Add-widget tiles in right panel.
- **Cross-filtering**: clicking a mark in any chart sets `dash.cross = {key, value, source}`. `applyCross(rows, cross, widgetId)` filters every other widget (the **source** widget stays unfiltered as context). KPIs show "% of total". Click same mark again or **Clear** to reset.

### Stats (`statsMode.jsx` + `statsMath.js` + `insightEngine.js`)
- Tests (8 total): **Descriptive, Distribution, Correlation (Pearson/Spearman), T-Test (Welch + Cohen's d), ANOVA (one-way + η²), Chi-Square (independence + Cramér's V), Regression (OLS + per-coef SE/t/p + R²/adj/F), Analysis Builder**.
- **Exact p-values** from `window.SM`: `tP(t,df)`, `fP(F,d1,d2)`, `chiP(x,df)` (regularized incomplete beta/gamma), plus `matInverse` for regression standard errors. Also `SM.skewness(a)` and `SM.kurtosis(a)` (Fisher's excess, sample-corrected).
- Each result shows metric cards + a chart/table + a **color-coded significance verdict** (α=0.05) + `InterpretationPanel` (IE-generated, blue tint) + `NextStepPanel` (green tint, suggests next analysis). Config in `ui.stats`.
- **Distribution tab** (`DistributionCenter`): column picker → histogram (category-axis ECharts bar with bin labels) + horizontal boxplot (`layout:"horizontal"`, scatter overlay for IQR outliers) + 8 stat cards (n, missing, mean, median, std, min/max, IQR, skewness, kurtosis, outlier count).
- **Analysis Builder tab** (`AnalysisBuilderCenter`): target + multi-input column selector → `runBuilder()` auto-detects type by column types (numInputs≥1+isNumTarget → OLS regression; catInputs≥1+isNumTarget → ANOVA; catInputs≥1+isCatTarget → chi-square) → shows Summary/Visual/Statistical Results/Next Step.
- **Descriptive table**: includes Skewness and Kurtosis columns; warns with accent color if |sk|>1.5.

### ML (`mlMode.jsx`)
- Tasks: **Regression** (OLS via normal equations → R²/RMSE/MAE, predicted-vs-actual scatter, standardized feature importance), **Classification** (k-NN on standardized features → accuracy + confusion-matrix heatmap + **per-class Precision/Recall/F1 table** + macroF1), **Clustering** (Lloyd's KMeans → cluster scatter + inertia + sizes + **cluster characteristics table** in original scale).
- Config + result in `ui.ml = {task, target, feats[], split, k, K, result}`. Seeded train/test split. All math is inline (no libs).
- **`window.NODE.mlHistory`** — mutable array on the NODE object (not in Store), included in project persistence. Each entry: `{ task, target, metric, score, ts }`. Max 10 shown in the Model Comparison History table. `pushHistory(entry)` also sets `window.NODE.lastAnalysisResult = { type:"ml", ...entry }` and marks the project dirty.
- **IE interpretation panel** shown above metrics after training (calls `IE.summarizeClassification` / `IE.summarizeClustering`).

### Ask Insight (`aiDrawer.jsx`)
- Slide-over drawer (`ui.aiOpen`). **Market insights**: `buildInsights(rows)` computes real findings (district share, top-3 concentration, price leader, 2022→2024 trend, building-type premium, outlier count).
- **IE auto-profile**: `IE.profileDataset(activeId)` runs on every render (memoized) → "Dataset Profile" section with shape/missing/outlier/skewness/correlation insights for any active dataset.
- **Last Analysis Result**: reads `window.NODE.lastAnalysisResult` (set by ML Train and Stats tests) → shown as a linked summary chip.
- **NL routing**: `interpret(text)` → intent → `runIntent(kind)` actually navigates and builds a chart (e.g. "top complexes" → switches to Chart mode with a Top-10 hbar; "outliers" → Clean mode; "correlation" → Stats/corr tab; "ml" → ML mode). Pattern-matched (no real LLM call) but it drives the genuine app state.

---

## 10. Tweaks (`tweaks.jsx`) & variation system

Toggled by the topbar sliders button (`node-tweaks-toggle` event). Writes to `tweaks.*`; `app.jsx` reflects them as `<html>` attributes; `tweaks.css` holds the overrides.

| Tweak | Values | Effect |
|---|---|---|
| `layout` | `standard` / `focus` | focus hides the right inspector panel |
| `explorerSide` | `left` / `right` | swaps explorer & inspector sides |
| `sidebar` | `labeled` / `compact` | compact rail = icons only, narrower |
| `tone` | `cool` / `warm` / `contrast` | re-hues neutrals (per theme) |
| `density` | `compact` / `cozy` | row heights / paddings / base font |
| `accent` | `orange` / `blue` / `teal` / `violet` | swaps `--accent*` + `--cat-1` |

These are demo/customization toggles, not persisted.

---

## 11. Conventions & gotchas (read before editing)

- **ECharts `animation: false`** is set in `Charts.baseGrid` **on purpose** — entrance animations rely on `requestAnimationFrame`, which is throttled in offscreen/preview iframes, leaving charts blank. Keep it off (or charts may not render in previews/exports).
- **CSS `.fade` animates transform only, never opacity** — same offscreen-rAF reason; don't gate visibility on animation.
- **Cross-file scope**: anything used by another file must be on `window`. New module → end with `window.X = …` or `Object.assign(window, {…})`. Don't rely on top-level consts being visible across files.
- **No `const styles = {…}`** global naming collisions — inline styles or uniquely-named objects only (Babel-per-script scope rule).
- **Always read data via `Store.derive.getActiveData(activeId)`** so cleaning steps propagate. Don't read `NODE.datasets[i].rows` directly in feature code. Its result is **memoized & shared** — never mutate the returned `rows`/`columns` in place; copy first (`[...rows]`).
- **Native `<select>` capture quirk**: screenshots of native selects can show the first option regardless of value — the live value is correct; verify via DOM if unsure.
- **Project persistence:** `window.ProjectStore` owns IndexedDB and JSON I/O. Do not write project data directly to `localStorage`; session logs intentionally remain separate.
- Canonical HTML / explicit closing tags are used so the visual editor can direct-edit; keep that style.

---

## 12. Suggested next steps (for the Next.js port / further work)

1. **Data combine** — add materialized Union/Join results with lineage metadata.
2. **Import expansion** — CSV/TSV/JSON/XLSX and deterministic inference are implemented; Parquet remains future work.
3. **Engine swap** — replace `runSQL` and in-JS aggregation with **DuckDB-WASM**; move ML/stats work to a worker if datasets grow. SQL still lacks JOIN/subquery/window support.
4. **Export expansion** — PNG, CSV, and portable project JSON are implemented; add PDF/XLSX.
5. **Analysis roadmap** — Auto Chart Recommendation, PCA/Biplot/Scree, Logistic Regression + ROC/AUC/CV, time-series basics, and SPC are the next browser-feasible batches. Confusion Matrix, per-class P/R/F1, and OLS feature importance already exist.
6. **Modes still partial**: no mode is a placeholder, but Map choropleths depend on remote GeoJSON and AI is rule-based rather than connected to an LLM.
7. **Productionize**: move from in-browser Babel to the intended stack — Next.js + TypeScript + Tailwind + shadcn/ui + Zustand (the `Store` maps almost 1:1 to a Zustand store) + TanStack Table (replace `DataGrid`) + ECharts/Plotly + dnd-kit (replace the hand-rolled drag in dashboard/shelves) + FastAPI/DuckDB/Polars backend.

---

## 13. Quick orientation for a new contributor

- Want to **add a chart type**? → `vizMode.jsx` `CHART_GROUPS` + a branch in `buildOption`.
- Add a **cleaning op**? → `applySteps` case (store) + button (`CleanPanel`) + `stepLabel`.
- Add a **stat test**? → math in `statsMath.js`, test fn + center render + config in `statsMode.jsx`, entry in `TESTS`.
- Add a **dashboard widget type**? → renderer in `dashMode.jsx` + Add-widget tile.
- Change **brand/theme**? → `tokens.css` (tokens) + `shell.jsx` TopBar (logomark/name).
- Add a **mode**? → new `xMode.jsx` exporting `window.XMode`, add to `MODES` (shell), add a route branch in `app.jsx`, add `<script>` + `<link>` in `index.html`.
