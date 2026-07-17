/* insight Analytics Workbench — versioned local project repository */
(function () {
  "use strict";

  var DB_NAME = "insight-workbench";
  var DB_VERSION = 1;
  var SCHEMA_VERSION = 1;
  var AUTOSAVE_DELAY = 1000;
  // "viz" is retained (read-only) so legacy single-viz projects still load & migrate;
  // new saves write "vizSheets" + "vizActive" instead.
  var STATE_KEYS = ["theme", "mode", "activeId", "ui", "clean", "viz", "vizSheets", "vizActive", "pivot", "pivotSheets", "pivotActive", "dash", "tweaks"];

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
  // B1 multi-tab state: this tab's identity, peers holding the same project, and the last time a peer
  // reported a write (meaning our in-memory snapshot no longer matches what's on disk).
  var channel = null;
  var peerTabs = new Set();
  var peerSavedAt = null;
  var storageMode = "unknown";   // A6: "granted" | "best-effort" | "unsupported" | "unknown"
  var TAB_ID = "tab_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);

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

  // ── A6: storage durability ─────────────────────────────────────────────────
  // IndexedDB is not permanent storage. Projects can vanish without warning: Safari's ITP wipes
  // script-writable storage after ~7 days without a visit, private windows discard everything on close,
  // and any browser may evict "best-effort" origins under storage pressure. The user is never told —
  // they'd just find their work gone.
  //
  // The real mitigation (not a warning) is StorageManager.persist(): it asks the browser to exempt this
  // origin from automatic eviction. Chromium usually grants it silently for an engaged origin; Safari
  // does not implement it. It requires a secure context, so on a plain http:// deployment the API is
  // absent and we stay best-effort. Result is reported via getStatus().storage so the UI can advise a
  // JSON backup only when durability is NOT guaranteed.
  //   granted     — persisted, exempt from automatic eviction
  //   best-effort — supported but not granted (or refused)
  //   unsupported — no StorageManager (Safari, or non-secure context)
  async function ensurePersistence() {
    try {
      var s = navigator.storage;
      if (!s || typeof s.persisted !== "function") { storageMode = "unsupported"; return; }
      if (await s.persisted()) { storageMode = "granted"; return; }
      if (typeof s.persist !== "function") { storageMode = "best-effort"; return; }
      storageMode = (await s.persist()) ? "granted" : "best-effort";
    } catch (_) {
      storageMode = "unsupported";   // never let a durability probe break boot
    }
  }

  // ── B1: multi-tab detection ────────────────────────────────────────────────
  // Autosave is last-write-wins: two tabs on the same project each hold a full in-memory snapshot and
  // overwrite the whole record every second, so whichever saves last silently erases the other's work.
  // There is no merge here and there shouldn't be one — the honest fix is to tell the user, not to
  // guess. Tabs announce themselves over BroadcastChannel; `conflict` is true while a peer holds the
  // same project. This warns; it does not lock (see PLAN §12 B1 for the Web Locks escalation).
  function setupChannel() {
    if (channel || typeof window.BroadcastChannel === "undefined") return; // absent on older Safari — degrade to no warning
    try { channel = new window.BroadcastChannel("insight-workbench-tabs"); } catch (_) { channel = null; return; }
    channel.onmessage = function (event) {
      var msg = event && event.data;
      if (!msg || msg.tabId === TAB_ID) return;
      if (!currentProject || msg.projectId !== currentProject.id) return;
      if (msg.type === "open") { addPeer(msg.tabId); post("here"); }         // a peer just opened my project
      else if (msg.type === "here") addPeer(msg.tabId);                      // a peer answered my announce
      else if (msg.type === "close") removePeer(msg.tabId);
      else if (msg.type === "saved") {                                       // peer wrote — my snapshot is now stale
        addPeer(msg.tabId);
        peerSavedAt = msg.updatedAt || null;
        notify();
      }
    };
  }

  function post(type, extra) {
    if (!channel || !currentProject) return;
    var msg = { type: type, projectId: currentProject.id, tabId: TAB_ID };
    if (extra) Object.keys(extra).forEach(function (k) { msg[k] = extra[k]; });
    try { channel.postMessage(msg); } catch (_) {}
  }

  function addPeer(tabId) {
    if (peerTabs.has(tabId)) return;
    peerTabs.add(tabId);
    notify();
  }

  function removePeer(tabId) {
    if (!peerTabs.delete(tabId)) return;
    if (!peerTabs.size) peerSavedAt = null;
    notify();
  }

  // Called whenever the active project changes: drop stale peers, then re-announce for the new project.
  function announceProject() {
    peerTabs.clear();
    peerSavedAt = null;
    post("open");
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
      announceProject();   // B1: tell other tabs which project this one now holds
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
        setupChannel();          // B1: listen for peer tabs before we activate a project and announce
        await ensurePersistence(); // A6: ask for eviction exemption before we start writing projects
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
        // Flush the pending autosave on unload too. The 1s debounce window (scheduleAutosave) means a
        // hard tab-close / crash can lose the last edit — visibilitychange doesn't fire on every close.
        // pagehide is the bfcache-friendly signal; beforeunload is the fallback for older paths. The
        // saveNow write is async (IndexedDB) so completion isn't guaranteed on abrupt exit, but this
        // fires the pending write immediately instead of waiting out the debounce.
        var flushOnExit = function () {
          if (currentProject && status.state !== "saved") api.saveNow().catch(function () {});
          post("close");   // B1: let peers drop us so a closed tab stops showing as a conflict
        };
        window.addEventListener("pagehide", flushOnExit);
        window.addEventListener("beforeunload", flushOnExit);
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
        // B1: our write just became the record on disk, so any peer's snapshot is now stale — and ours
        // is current again, which clears the stale marker this tab was showing.
        peerSavedAt = null;
        post("saved", { updatedAt: currentProject.updatedAt });
        setStatus("saved");
        return projectSummary(currentProject);
      } catch (error) {
        setStatus("error", error);
        throw error;
      }
    },

    // Return the portable bundle object WITHOUT downloading a file — used by the P10 share-link
    // encoder (ShareLink.encodeShareLink). Same validated shape exportJSON serializes.
    exportBundle: async function (id) {
      await api.init();
      id = id || (currentProject && currentProject.id);
      if (!id) throw new Error("No project selected");
      if (currentProject && currentProject.id === id) await api.saveNow();
      return toPortable(await loadBundle(id));
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
        // B1: another tab holds this same project — autosave from either will overwrite the other.
        conflict: peerTabs.size > 0,
        peerCount: peerTabs.size,
        // A peer has written since our last save: what's on disk is theirs, not ours. Saving from this
        // tab now would overwrite their work with our older snapshot.
        peerSavedAt: peerSavedAt,
        tabId: TAB_ID,
        // A6: durability of this browser's storage. "granted" = exempt from automatic eviction;
        // anything else means projects can disappear and a JSON backup is the only real protection.
        storage: storageMode,
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
