// sheets.js — generic multi-tab ("sheet") list reducers (pure, dual-mode).
// Consolidates the viz/pivot/dash tab logic that is currently triplicated inline in store.jsx.
// Pure functions: no side effects, no Date.now (ids are injected by the caller for determinism).
// NOTE (autonomous build): the engine + tests land now; store.jsx wiring is a MORNING GATE
//   (higher-risk refactor of a working store) — do not rewire until reviewed.
// Loadable in browser (window.Sheets) and Node (require).
(function () {
  // Append a sheet produced by factory() and make it active. Returns {list, active}.
  function addSheet(list, factory) {
    const sh = factory();
    return { list: [...(list || []), sh], active: sh.id };
  }

  // Return id if it names an existing sheet, otherwise keep the current active.
  function setActiveId(list, active, id) {
    return (list || []).some((x) => x.id === id) ? id : active;
  }

  // Rename a sheet by id (empty name is ignored). Returns a new list.
  function renameSheet(list, id, name) {
    return (list || []).map((x) => x.id === id ? { ...x, name: name || x.name } : x);
  }

  // Remove a sheet by id. The last remaining sheet is never removed. If the removed
  // sheet was active, the neighbor at the same index (or the new last) becomes active.
  // Returns {list, active, removed} where removed is the sheet that was dropped (or null).
  function removeSheet(list, active, id) {
    const sheets = list || [];
    if (sheets.length <= 1) return { list: sheets, active, removed: null };
    const idx = sheets.findIndex((x) => x.id === id);
    if (idx < 0) return { list: sheets, active, removed: null };
    const removed = sheets[idx];
    const next = sheets.filter((x) => x.id !== id);
    let nextActive = active;
    if (active === id) {
      const neighbor = next[idx] || next[next.length - 1];
      nextActive = neighbor.id;
    }
    return { list: next, active: nextActive, removed };
  }

  // Deep-clone a sheet, give it mkId() and a "복사" name, insert after the source, activate it.
  // Falls back to the active sheet when id is not found. Returns {list, active, copy}.
  function duplicateSheet(list, active, id, mkId) {
    const sheets = list || [];
    const src = sheets.find((x) => x.id === id) || sheets.find((x) => x.id === active) || sheets[0];
    if (!src) return { list: sheets, active, copy: null };
    const copy = Object.assign(JSON.parse(JSON.stringify(src)), { id: mkId(), name: src.name + " 복사" });
    const srcIdx = sheets.findIndex((x) => x.id === src.id);
    const next = sheets.slice(0, srcIdx + 1).concat([copy], sheets.slice(srcIdx + 1));
    return { list: next, active: copy.id, copy };
  }

  // Map the active sheet through fn, leaving the others untouched. Returns a new list.
  function updateActive(list, active, fn) {
    return (list || []).map((x) => x.id === active ? fn(x) : x);
  }

  const api = { addSheet, setActiveId, renameSheet, removeSheet, duplicateSheet, updateActive };
  if (typeof window !== "undefined") window.Sheets = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
