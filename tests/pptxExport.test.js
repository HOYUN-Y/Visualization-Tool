const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const PX = require(path.join(__dirname, "..", "js", "pptxExport.js"));

// Minimal ECharts-option factories mirroring what js/vizMode.jsx buildOption emits.
const catAxis = (cats) => ({ type: "category", data: cats });
const valAxis = () => ({ type: "value" });

// ── extract(): reads categories + per-series {type,axis,stacked,area} ──────────
test("extract pulls categories + a single bar series", () => {
  const opt = { xAxis: catAxis(["A", "B"]), yAxis: valAxis(), series: [{ name: "Sales", type: "bar", data: [10, 20] }] };
  const d = PX.extract({ type: "bar" }, opt);
  assert.equal(d.kind, "cat");
  assert.deepEqual(d.cats, ["A", "B"]);
  assert.equal(d.series.length, 1);
  assert.deepEqual(d.series[0].values, [10, 20]);
  assert.equal(d.series[0].axis, 0);
  assert.equal(d.series[0].stacked, false);
});

test("extract flags area (line + areaStyle) and secondary axis (yAxisIndex=1)", () => {
  const opt = {
    xAxis: catAxis(["A", "B"]),
    yAxis: [valAxis(), valAxis()],
    series: [
      { name: "Area", type: "line", areaStyle: { opacity: 0.2 }, data: [1, 2] },
      { name: "Right", type: "line", yAxisIndex: 1, data: [3, 4] },
    ],
  };
  const d = PX.extract({ type: "area" }, opt);
  assert.equal(d.series[0].area, true);
  assert.equal(d.series[1].axis, 1);
});

test("extract reads pie labels + values", () => {
  const opt = { series: [{ type: "pie", data: [{ name: "X", value: 3 }, { name: "Y", value: 7 }] }] };
  const d = PX.extract({ type: "pie" }, opt);
  assert.equal(d.kind, "pie");
  assert.deepEqual(d.labels, ["X", "Y"]);
  assert.deepEqual(d.values, [3, 7]);
});

// ── planChart(): decides the PPT chart structure ──────────────────────────────
test("plan: single bar → one clustered entry, not stacked/combo", () => {
  const opt = { xAxis: catAxis(["A"]), yAxis: valAxis(), series: [{ name: "S", type: "bar", data: [5] }] };
  const p = PX.planChart({ type: "bar" }, opt);
  assert.equal(p.ok, true);
  assert.equal(p.kind, "cat");
  assert.equal(p.combo, false);
  assert.equal(p.stacked, false);
  assert.equal(p.entries.length, 1);
  assert.equal(p.entries[0].chartType, "bar");
  assert.equal(p.entries[0].barDir, "col");
});

test("plan: hbar sets barDir=bar", () => {
  const opt = { xAxis: valAxis(), yAxis: catAxis(["A"]), series: [{ name: "S", type: "bar", data: [5] }] };
  const p = PX.planChart({ type: "hbar" }, opt);
  assert.equal(p.entries[0].barDir, "bar");
});

test("plan: STACKED — any series with a stack key → stacked grouping", () => {
  const opt = {
    xAxis: catAxis(["A", "B"]), yAxis: valAxis(),
    series: [
      { name: "P", type: "bar", stack: "t", data: [1, 2] },
      { name: "Q", type: "bar", stack: "t", data: [3, 4] },
    ],
  };
  const p = PX.planChart({ type: "bar" }, opt);
  assert.equal(p.combo, false);
  assert.equal(p.stacked, true);
  assert.equal(p.entries.length, 1);
  assert.equal(p.entries[0].series.length, 2);
});

test("plan: stacked AREA is honored (grouping applies to area too)", () => {
  const opt = {
    xAxis: catAxis(["A", "B"]), yAxis: valAxis(),
    series: [
      { name: "P", type: "line", areaStyle: {}, stack: "t", data: [1, 2] },
      { name: "Q", type: "line", areaStyle: {}, stack: "t", data: [3, 4] },
    ],
  };
  const p = PX.planChart({ type: "area" }, opt);
  assert.equal(p.stacked, true);
  assert.equal(p.entries[0].chartType, "area");
});

test("plan: COMBO — mixed bar + line → combo with one entry per type", () => {
  const opt = {
    xAxis: catAxis(["A", "B"]), yAxis: valAxis(),
    series: [
      { name: "Bars", type: "bar", data: [1, 2] },
      { name: "Trend", type: "line", data: [3, 4] },
    ],
  };
  const p = PX.planChart({ type: "bar" }, opt);
  assert.equal(p.combo, true);
  assert.equal(p.secondary, false);
  assert.equal(p.entries.length, 2);
  const types = p.entries.map((e) => e.chartType).sort();
  assert.deepEqual(types, ["bar", "line"]);
});

test("plan: SECONDARY AXIS — a yAxisIndex=1 series marks its bucket secondary", () => {
  const opt = {
    xAxis: catAxis(["A", "B"]), yAxis: [valAxis(), valAxis()],
    series: [
      { name: "Left", type: "bar", yAxisIndex: 0, data: [10, 20] },
      { name: "Right", type: "line", yAxisIndex: 1, data: [0.1, 0.2] },
    ],
  };
  const p = PX.planChart({ type: "bar" }, opt);
  assert.equal(p.combo, true);
  assert.equal(p.secondary, true);
  const rightEntry = p.entries.find((e) => e.secondary);
  assert.ok(rightEntry, "a secondary-axis entry exists");
  assert.equal(rightEntry.series[0].name, "Right");
  const leftEntry = p.entries.find((e) => !e.secondary);
  assert.equal(leftEntry.series[0].name, "Left");
});

test("plan: two same-type bars on primary axis stay a single non-combo entry", () => {
  const opt = {
    xAxis: catAxis(["A"]), yAxis: valAxis(),
    series: [
      { name: "M1", type: "bar", data: [1] },
      { name: "M2", type: "bar", data: [2] },
    ],
  };
  const p = PX.planChart({ type: "bar" }, opt);
  assert.equal(p.combo, false);
  assert.equal(p.entries.length, 1);
  assert.equal(p.entries[0].series.length, 2);
});

// ── unsupported / degenerate ──────────────────────────────────────────────────
test("plan: candlestick has no PPT-native mapping → unsupported (honest fallback)", () => {
  const opt = { xAxis: catAxis(["d1"]), yAxis: valAxis(), series: [{ type: "candlestick", data: [[1, 2, 0, 3]] }] };
  const p = PX.planChart({ type: "candlestick" }, opt);
  assert.equal(p.ok, false);
  assert.equal(p.reason, "unsupported");
});

test("plan: scatter / boxplot are unsupported", () => {
  for (const t of ["scatter", "boxplot", "ohlcvol", "cumreturn"]) {
    const p = PX.planChart({ type: t }, { series: [{ type: "scatter", data: [] }] });
    assert.equal(p.ok, false, `${t} should be unsupported`);
    assert.equal(p.reason, "unsupported");
  }
});

test("plan: missing option / empty series → no-chart", () => {
  assert.equal(PX.planChart({ type: "bar" }, null).reason, "no-chart");
  assert.equal(PX.planChart({ type: "bar" }, { series: [] }).reason, "no-chart");
  assert.equal(PX.planChart({ type: "pie" }, { series: [{ type: "pie", data: [] }] }).reason, "no-chart");
});

test("supported() keeps the bar/line/area/pie contract", () => {
  for (const t of ["bar", "hbar", "line", "area", "pie"]) assert.equal(PX.supported(t), true);
  for (const t of ["candlestick", "scatter", "boxplot", "facet"]) assert.equal(PX.supported(t), false);
});
