/* insight Analytics Workbench — versioned local project repository */
(function () {
  "use strict";

  var DB_NAME = "insight-workbench";
  var DB_VERSION = 1;
  var SCHEMA_VERSION = 1;
  var AUTOSAVE_DELAY = 1000;
  // "viz" is retained (read-only) so legacy single-viz projects still load & migrate;
  // new saves write "vizSheets" + "vizActive" instead.
  var STATE_KEYS = ["theme", "mode", "activeId", "ui", "clean", "viz", "vizSheets", "vizActive", "pivot", "dash", "tweaks"];

  var dbPromise = null;
  var currentProject = null;
  var seedSnapshot = null;
  var autosaveTimer = null;
  var hydrating = false;
  var initialized = false;
  var initPromise = null;
  var storeUnsubscribe = null;
  var listeners = new Set();
  var status = { state: "unsaved", label: "Unsaved", error: null, projectId: null, updatedAt: null };

  function clone(value) {
    if (value == null) return value;
    if (typeof structuredClone === "function") {
      try { return structuredClone(value); } catch (_) {}
    }
    return JSON.parse(JSON.stringify(value));
  }

  function makeId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
    return "project_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
  }

  function safeName(name, fallback) {
    var clean = String(name || "").trim();
    return clean || fallback || "Untitled Project";
  }

  function sanitizeState(source) {
    source = source || {};
    var out = {};
    STATE_KEYS.forEach(function (key) {
      if (source[key] !== undefined) out[key] = clone(source[key]);
    });
    out.ui = out.ui || {};
    delete out.ui.aiOpen;
    if (!out.pivot) out.pivot = {};
    return out;
  }

  function sanitizeAnalysis(source) {
    source = source || {};
    return {
      mlHistory: Array.isArray(source.mlHistory) ? clone(source.mlHistory) : [],
      lastAnalysisResult: source.lastAnalysisResult == null ? null : clone(source.lastAnalysisResult),
    };
  }

  function validateDataset(dataset, index) {
    if (!dataset || typeof dataset !== "object" || Array.isArray(dataset)) {
      throw new Error("datasets[" + index + "] must be an object");
    }
    if (typeof dataset.id !== "string" || !dataset.id.trim()) {
      throw new Error("datasets[" + index + "].id is required");
    }
    if (!Array.isArray(dataset.rows) || !Array.isArray(dataset.columns)) {
      throw new Error("datasets[" + index + "] must include rows and columns arrays");
    }
    dataset.columns.forEach(function (column, columnIndex) {
      if (!column || typeof column.key !== "string" || !column.key) {
        throw new Error("datasets[" + index + "].columns[" + columnIndex + "].key is required");
      }
    });
  }

  function validatePortableBundle(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Project JSON must be an object");
    if (!Number.isInteger(input.schemaVersion)) throw new Error("schemaVersion must be an integer");
    if (input.schemaVersion > SCHEMA_VERSION) {
      throw new Error("This project uses future schema version " + input.schemaVersion + ". This build supports version " + SCHEMA_VERSION + ".");
    }
    if (input.schemaVersion < 1) throw new Error("Unsupported project schema version");
    if (!input.project || typeof input.project !== "object") throw new Error("project metadata is required");
    if (!input.state || typeof input.state !== "object" || Array.isArray(input.state)) throw new Error("state must be an object");
    if (!Array.isArray(input.datasets) || !input.datasets.length) throw new Error("At least one dataset is required");

    var ids = new Set();
    input.datasets.forEach(function (dataset, index) {
      validateDataset(dataset, index);
      if (ids.has(dataset.id)) throw new Error("Duplicate dataset id: " + dataset.id);
      ids.add(dataset.id);
    });

    var activeId = input.state.activeId;
    if (activeId && !ids.has(activeId)) throw new Error("Active dataset does not exist: " + activeId);

    var now = new Date().toISOString();
    return {
      schemaVersion: SCHEMA_VERSION,
      exportedAt: typeof input.exportedAt === "string" ? input.exportedAt : now,
      project: {
        id: typeof input.project.id === "string" && input.project.id ? input.project.id : makeId(),
        name: safeName(input.project.name),
        createdAt: typeof input.project.createdAt === "string" ? input.project.createdAt : now,
        updatedAt: typeof input.project.updatedAt === "string" ? input.project.updatedAt : now,
      },
      state: sanitizeState(input.state),
      datasets: clone(input.datasets),
      analysis: sanitizeAnalysis(input.analysis),
    };
  }

  function toPortable(bundle) {
    return validatePortableBundle({
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      project: bundle.project,
      state: bundle.state,
      datasets: bundle.datasets,
      analysis: bundle.analysis,
    });
  }

  function requestResult(request) {
    return new Promise(function (resolve, reject) {
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error || new Error("IndexedDB request failed")); };
    });
  }

  function transactionDone(transaction) {
    return new Promise(function (resolve, reject) {
      transaction.oncomplete = function () { resolve(); };
      transaction.onerror = function () { reject(transaction.error || new Error("IndexedDB transaction failed")); };
      transaction.onabort = function () { reject(transaction.error || new Error("IndexedDB transaction aborted")); };
    });
  }

  function openDatabase() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      if (!window.indexedDB) {
        reject(new Error("IndexedDB is not available in this browser"));
        return;
      }
      var request = window.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = function () {
        var db = request.result;
        if (!db.objectStoreNames.contains("projects")) db.createObjectStore("projects", { keyPath: "id" });
        if (!db.objectStoreNames.contains("datasets")) {
          var datasets = db.createObjectStore("datasets", { keyPath: "key" });
          datasets.createIndex("projectId", "projectId", { unique: false });
        }
        if (!db.objectStoreNames.contains("settings")) db.createObjectStore("settings", { keyPath: "key" });
      };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error || new Error("Unable to open IndexedDB")); };
      request.onblocked = function () { reject(new Error("IndexedDB upgrade is blocked by another tab")); };
    });
    return dbPromise;
  }

  async function getSetting(key) {
    var db = await openDatabase();
    var tx = db.transaction("settings", "readonly");
    var record = await requestResult(tx.objectStore("settings").get(key));
    return record ? record.value : null;
  }

  async function setSetting(key, value) {
    var db = await openDatabase();
    var tx = db.transaction("settings", "readwrite");
    tx.objectStore("settings").put({ key: key, value: value });
    await transactionDone(tx);
  }

  async function getProjectRecord(id) {
    var db = await openDatabase();
    var tx = db.transaction("projects", "readonly");
    return requestResult(tx.objectStore("projects").get(id));
  }

  async function listProjectRecords() {
    var db = await openDatabase();
    var tx = db.transaction("projects", "readonly");
    var rows = await requestResult(tx.objectStore("projects").getAll());
    return rows.sort(function (a, b) { return String(b.updatedAt).localeCompare(String(a.updatedAt)); });
  }

  async function loadBundle(id) {
    var db = await openDatabase();
    var record = await getProjectRecord(id);
    if (!record) throw new Error("Project not found: " + id);
    var tx = db.transaction("datasets", "readonly");
    var store = tx.objectStore("datasets");
    var datasets = await Promise.all((record.datasetIds || []).map(function (datasetId) {
      return requestResult(store.get(id + ":" + datasetId)).then(function (row) {
        if (!row) throw new Error("Dataset record is missing: " + datasetId);
        return row.dataset;
      });
    }));
    return validatePortableBundle({
      schemaVersion: SCHEMA_VERSION,
      project: { id: record.id, name: record.name, createdAt: record.createdAt, updatedAt: record.updatedAt },
      state: record.state,
      datasets: datasets,
      analysis: record.analysis,
    });
  }

  async function saveBundle(bundle) {
    bundle = toPortable(bundle);
    var db = await openDatabase();
    var previous = await getProjectRecord(bundle.project.id);
    var tx = db.transaction(["projects", "datasets"], "readwrite");
    var projects = tx.objectStore("projects");
    var datasets = tx.objectStore("datasets");
    (previous && previous.datasetIds || []).forEach(function (datasetId) {
      datasets.delete(bundle.project.id + ":" + datasetId);
    });
    bundle.datasets.forEach(function (dataset) {
      datasets.put({ key: bundle.project.id + ":" + dataset.id, projectId: bundle.project.id, dataset: clone(dataset) });
    });
    projects.put({
      id: bundle.project.id,
      name: bundle.project.name,
      createdAt: bundle.project.createdAt,
      updatedAt: bundle.project.updatedAt,
      state: bundle.state,
      analysis: bundle.analysis,
      datasetIds: bundle.datasets.map(function (dataset) { return dataset.id; }),
    });
    await transactionDone(tx);
    return bundle;
  }

  async function deleteBundle(id) {
    var db = await openDatabase();
    var previous = await getProjectRecord(id);
    if (!previous) return false;
    var tx = db.transaction(["projects", "datasets"], "readwrite");
    tx.objectStore("projects").delete(id);
    var datasets = tx.objectStore("datasets");
    (previous.datasetIds || []).forEach(function (datasetId) { datasets.delete(id + ":" + datasetId); });
    await transactionDone(tx);
    return true;
  }

  function notify() {
    var snapshot = api.getStatus();
    listeners.forEach(function (listener) {
      try { listener(snapshot); } catch (error) { console.error(error); }
    });
    try { window.dispatchEvent(new CustomEvent("project-store-status", { detail: snapshot })); } catch (_) {}
  }

  function setStatus(next, error) {
    var labels = { saved: "Saved", saving: "Saving", unsaved: "Unsaved", error: "Error" };
    status = {
      state: next,
      label: labels[next] || next,
      error: error ? String(error.message || error) : null,
      projectId: currentProject ? currentProject.id : null,
      updatedAt: currentProject ? currentProject.updatedAt : null,
    };
    notify();
  }

  function captureBundle() {
    if (!currentProject) throw new Error("No active project");
    return {
      schemaVersion: SCHEMA_VERSION,
      project: clone(currentProject),
      state: sanitizeState(window.Store.getState()),
      datasets: clone(window.NODE.datasets),
      analysis: sanitizeAnalysis({
        mlHistory: window.NODE.mlHistory,
        lastAnalysisResult: window.NODE.lastAnalysisResult,
      }),
    };
  }

  function makeSeedBundle(name) {
    var now = new Date().toISOString();
    var id = makeId();
    return {
      schemaVersion: SCHEMA_VERSION,
      project: { id: id, name: safeName(name), createdAt: now, updatedAt: now },
      state: clone(seedSnapshot.state),
      datasets: clone(seedSnapshot.datasets),
      analysis: clone(seedSnapshot.analysis),
    };
  }

  async function activateBundle(bundle) {
    hydrating = true;
    try {
      window.Store.actions.hydrateProject(bundle);
      currentProject = clone(bundle.project);
      await setSetting("lastProjectId", currentProject.id);
      setStatus("saved");
    } finally {
      hydrating = false;
    }
  }

  function scheduleAutosave() {
    if (!initialized || hydrating || !currentProject) return;
    if (autosaveTimer) clearTimeout(autosaveTimer);
    setStatus("unsaved");
    autosaveTimer = setTimeout(function () {
      autosaveTimer = null;
      api.saveNow().catch(function () {});
    }, AUTOSAVE_DELAY);
  }

  function downloadText(text, filename) {
    var blob = new Blob([text], { type: "application/json;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function projectSummary(record) {
    return { id: record.id, name: record.name, createdAt: record.createdAt, updatedAt: record.updatedAt };
  }

  var api = {
    init: function () {
      if (initPromise) return initPromise;
      initPromise = (async function () {
        if (!window.Store || !window.NODE) throw new Error("Store must be loaded before ProjectStore");
        seedSnapshot = {
          state: sanitizeState(window.Store.getState()),
          datasets: clone(window.NODE.datasets),
          analysis: sanitizeAnalysis({ mlHistory: window.NODE.mlHistory, lastAnalysisResult: window.NODE.lastAnalysisResult }),
        };
        await openDatabase();
        var records = await listProjectRecords();
        var lastId = await getSetting("lastProjectId");
        var target = records.find(function (record) { return record.id === lastId; }) || records[0];
        if (target) await activateBundle(await loadBundle(target.id));
        else {
          var first = makeSeedBundle("Untitled Project");
          await saveBundle(first);
          await activateBundle(first);
        }
        storeUnsubscribe = window.Store.subscribe(scheduleAutosave);
        document.addEventListener("visibilitychange", function () {
          if (document.visibilityState === "hidden" && currentProject && status.state !== "saved") api.saveNow().catch(function () {});
        });
        initialized = true;
        setStatus("saved");
        return api.getStatus();
      })().catch(function (error) {
        setStatus("error", error);
        throw error;
      });
      return initPromise;
    },

    list: async function () {
      return (await listProjectRecords()).map(projectSummary);
    },

    create: async function (name) {
      await api.init();
      if (currentProject) await api.saveNow();
      var bundle = makeSeedBundle(name);
      await saveBundle(bundle);
      await activateBundle(bundle);
      notify();
      return projectSummary(bundle.project);
    },

    open: async function (id) {
      await api.init();
      if (currentProject && currentProject.id === id) return projectSummary(currentProject);
      if (currentProject) await api.saveNow();
      var bundle = await loadBundle(id);
      await activateBundle(bundle);
      notify();
      return projectSummary(bundle.project);
    },

    rename: async function (id, name) {
      await api.init();
      name = safeName(name);
      if (currentProject && currentProject.id === id) await api.saveNow();
      var bundle = await loadBundle(id);
      bundle.project.name = name;
      bundle.project.updatedAt = new Date().toISOString();
      await saveBundle(bundle);
      if (currentProject && currentProject.id === id) {
        currentProject = clone(bundle.project);
        setStatus("saved");
      }
      notify();
      return projectSummary(bundle.project);
    },

    duplicate: async function (id, name) {
      await api.init();
      if (currentProject && currentProject.id === id) await api.saveNow();
      var source = await loadBundle(id);
      var now = new Date().toISOString();
      source.project = {
        id: makeId(),
        name: safeName(name, source.project.name + " Copy"),
        createdAt: now,
        updatedAt: now,
      };
      await saveBundle(source);
      await activateBundle(source);
      notify();
      return projectSummary(source.project);
    },

    remove: async function (id) {
      await api.init();
      var removingCurrent = currentProject && currentProject.id === id;
      if (removingCurrent) {
        if (autosaveTimer) clearTimeout(autosaveTimer);
        autosaveTimer = null;
        hydrating = true;
      }
      try {
        await deleteBundle(id);
        if (removingCurrent) {
          currentProject = null;
          var remaining = await listProjectRecords();
          if (remaining.length) await activateBundle(await loadBundle(remaining[0].id));
          else {
            var replacement = makeSeedBundle("Untitled Project");
            await saveBundle(replacement);
            await activateBundle(replacement);
          }
        }
        notify();
        return true;
      } finally {
        if (removingCurrent) hydrating = false;
      }
    },

    saveNow: async function () {
      await api.init();
      if (autosaveTimer) clearTimeout(autosaveTimer);
      autosaveTimer = null;
      setStatus("saving");
      try {
        var bundle = captureBundle();
        bundle.project.updatedAt = new Date().toISOString();
        bundle = await saveBundle(bundle);
        currentProject = clone(bundle.project);
        await setSetting("lastProjectId", currentProject.id);
        setStatus("saved");
        return projectSummary(currentProject);
      } catch (error) {
        setStatus("error", error);
        throw error;
      }
    },

    exportJSON: async function (id) {
      await api.init();
      id = id || (currentProject && currentProject.id);
      if (!id) throw new Error("No project selected");
      if (currentProject && currentProject.id === id) await api.saveNow();
      var bundle = toPortable(await loadBundle(id));
      var json = JSON.stringify(bundle, null, 2);
      var filename = bundle.project.name.replace(/[^a-z0-9가-힣_-]+/gi, "_") || "insight-project";
      downloadText(json, filename + ".insight.json");
      return json;
    },

    importJSON: async function (input) {
      await api.init();
      if (currentProject) await api.saveNow();
      var value = input;
      if (value && typeof value.text === "function") value = await value.text();
      if (typeof value === "string") {
        try { value = JSON.parse(value); } catch (error) { throw new Error("Invalid JSON: " + error.message); }
      }
      var bundle = validatePortableBundle(value);
      var records = await listProjectRecords();
      if (records.some(function (record) { return record.id === bundle.project.id; })) {
        bundle.project.id = makeId();
        bundle.project.name = safeName(bundle.project.name + " (Imported)");
        bundle.project.createdAt = new Date().toISOString();
      }
      bundle.project.updatedAt = new Date().toISOString();
      await saveBundle(bundle);
      await activateBundle(bundle);
      notify();
      return projectSummary(bundle.project);
    },

    markDirty: scheduleAutosave,

    getStatus: function () {
      return {
        state: status.state,
        label: status.label,
        error: status.error,
        projectId: status.projectId,
        project: currentProject ? projectSummary(currentProject) : null,
        updatedAt: status.updatedAt,
        initialized: initialized,
      };
    },

    subscribe: function (listener) {
      listeners.add(listener);
      return function () { listeners.delete(listener); };
    },

    __test: {
      sanitizeState: sanitizeState,
      sanitizeAnalysis: sanitizeAnalysis,
      validatePortableBundle: validatePortableBundle,
      toPortable: toPortable,
    },
  };

  window.ProjectStore = api;
  if (!window.__PROJECT_STORE_DISABLE_AUTO_INIT__) {
    setTimeout(function () { api.init().catch(function (error) { console.error("ProjectStore init failed", error); }); }, 0);
  }
})();
