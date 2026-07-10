const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function dataset(id, rows) {
  return {
    id,
    name: id + ".csv",
    short: id,
    icon: "table",
    source: "Test",
    rows,
    columns: [{ key: "value", label: "value", type: "integer", role: "measure" }],
  };
}

function loadStore() {
  const window = { NODE: { datasets: [dataset("seed", [{ value: 1 }])] } };
  const React = {
    useReducer: () => [0, () => {}],
    useEffect: () => {},
  };
  const context = vm.createContext({ window, React, console, JSON, Math, Date, Set, Map });
  const source = fs.readFileSync(path.join(__dirname, "..", "js", "store.jsx"), "utf8");
  vm.runInContext(source, context, { filename: "store.jsx" });
  return { Store: window.Store, NODE: window.NODE };
}

test("hydrateProject restores datasets, analysis, UI policy, and row id sequence", () => {
  const { Store, NODE } = loadStore();
  let notifications = 0;
  Store.subscribe(() => { notifications += 1; });

  Store.actions.hydrateProject({
    state: { mode: "clean", activeId: "restored", ui: { leftW: 300, aiOpen: true } },
    datasets: [dataset("restored", [{ value: 7, __rid: 42 }])],
    analysis: { mlHistory: [{ kind: "reg" }], lastAnalysisResult: { type: "ml" } },
  });

  assert.equal(Store.getState().mode, "clean");
  assert.equal(Store.getState().ui.leftW, 300);
  assert.equal(Store.getState().ui.aiOpen, false);
  assert.equal(NODE.datasets[0].id, "restored");
  assert.equal(NODE.mlHistory.length, 1);
  assert.equal(notifications, 1);

  Store.actions.addRow({ value: 8 });
  const rows = Store.derive.getActiveData().rows;
  assert.equal(rows.length, 2);
  assert.equal(rows[1].__rid, 43, "new row ids must continue after the restored maximum");
});

test("dataset registry activates, rejects duplicate ids, and removes centrally", () => {
  const { Store, NODE } = loadStore();
  let notifications = 0;
  const unsubscribe = Store.subscribe(() => { notifications += 1; });

  Store.actions.registerDataset(dataset("upload", [{ value: 2 }]), { activate: true });
  assert.equal(Store.getState().activeId, "upload");
  assert.equal(NODE.datasets.length, 2);
  assert.throws(() => Store.actions.registerDataset(dataset("upload", [])), /already exists/);

  assert.equal(Store.actions.removeDataset("upload"), true);
  assert.equal(Store.getState().activeId, "seed");
  assert.equal(NODE.datasets.length, 1);
  assert.throws(() => Store.actions.removeDataset("seed"), /at least one dataset/);
  assert.ok(notifications >= 2);
  unsubscribe();
});
