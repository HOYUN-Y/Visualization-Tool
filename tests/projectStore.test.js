const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function loadProjectStoreInternals() {
  const window = {
    __PROJECT_STORE_DISABLE_AUTO_INIT__: true,
    crypto: { randomUUID: () => "generated-project-id" },
    dispatchEvent: () => {},
  };
  const context = vm.createContext({
    window,
    console,
    setTimeout,
    clearTimeout,
    structuredClone,
    CustomEvent: class CustomEvent {},
    Blob,
    URL,
    document: {},
  });
  const source = fs.readFileSync(path.join(__dirname, "..", "js", "projectStore.js"), "utf8");
  vm.runInContext(source, context, { filename: "projectStore.js" });
  return window.ProjectStore.__test;
}

function validBundle() {
  return {
    schemaVersion: 1,
    exportedAt: "2026-07-10T00:00:00.000Z",
    project: {
      id: "project-a",
      name: "Analysis A",
      createdAt: "2026-07-10T00:00:00.000Z",
      updatedAt: "2026-07-10T00:00:00.000Z",
    },
    state: {
      theme: "dark",
      mode: "data",
      activeId: "sales",
      ui: { leftW: 230, aiOpen: true },
      clean: {},
      vizSheets: [{ id: "sheet-1", name: "시트 1", datasetId: null, type: "bar", cols: [], rows: [] }],
      vizActive: "sheet-1",
      pivotSheets: [{ id: "pivot-1", name: "피벗 1", datasetId: null, rows: [], columns: [], values: [] }],
      pivotActive: "pivot-1",
      dash: {},
      tweaks: {},
      transientValue: "do not persist",
    },
    datasets: [{
      id: "sales",
      name: "sales.csv",
      short: "sales",
      rows: [{ amount: 10 }],
      columns: [{ key: "amount", label: "amount", type: "integer", role: "measure" }],
    }],
    analysis: { mlHistory: [{ kind: "reg" }], lastAnalysisResult: { type: "ml" } },
  };
}

test("portable project validation keeps supported state and removes session-only UI", () => {
  const internals = loadProjectStoreInternals();
  const input = validBundle();
  const result = internals.validatePortableBundle(input);

  assert.equal(result.schemaVersion, 1);
  assert.equal(result.project.id, "project-a");
  assert.equal(result.state.ui.leftW, 230);
  assert.equal(result.state.ui.aiOpen, undefined);
  assert.equal(result.state.transientValue, undefined);
  assert.ok(Array.isArray(result.state.vizSheets) && result.state.vizSheets.length === 1);
  assert.ok(Array.isArray(result.state.pivotSheets) && result.state.pivotSheets.length === 1);
  assert.equal(result.state.vizActive, "sheet-1");
  assert.equal(result.state.pivotActive, "pivot-1");
  assert.equal(result.analysis.mlHistory.length, 1);

  input.datasets[0].rows[0].amount = 999;
  assert.equal(result.datasets[0].rows[0].amount, 10, "validated project must be cloned");
});

test("portable project validation rejects future schema versions", () => {
  const internals = loadProjectStoreInternals();
  const input = validBundle();
  input.schemaVersion = 2;
  assert.throws(() => internals.validatePortableBundle(input), /future schema version 2/);
});

test("portable project validation rejects duplicate and missing active datasets", () => {
  const internals = loadProjectStoreInternals();
  const duplicate = validBundle();
  duplicate.datasets.push({ ...duplicate.datasets[0] });
  assert.throws(() => internals.validatePortableBundle(duplicate), /Duplicate dataset id/);

  const missing = validBundle();
  missing.state.activeId = "missing";
  assert.throws(() => internals.validatePortableBundle(missing), /Active dataset does not exist/);
});
