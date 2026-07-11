const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { addSheet, setActiveId, renameSheet, removeSheet, duplicateSheet, updateActive } =
  require(path.join(__dirname, "..", "js", "sheets.js"));

const base = () => [
  { id: "a", name: "시트 1", type: "bar" },
  { id: "b", name: "시트 2", type: "pie" },
];
let seq = 0;
const mkId = () => "gen-" + (seq++); // deterministic id injection

test("addSheet appends and activates the new sheet", () => {
  const { list, active } = addSheet(base(), () => ({ id: "c", name: "시트 3" }));
  assert.equal(list.length, 3);
  assert.equal(list[2].id, "c");
  assert.equal(active, "c");
});

test("setActiveId only switches to an existing sheet", () => {
  assert.equal(setActiveId(base(), "a", "b"), "b");
  assert.equal(setActiveId(base(), "a", "zzz"), "a"); // unknown → keep current
});

test("renameSheet renames by id and ignores empty names", () => {
  const l = renameSheet(base(), "a", "Renamed");
  assert.equal(l[0].name, "Renamed");
  assert.equal(renameSheet(base(), "a", "")[0].name, "시트 1"); // empty ignored
});

test("removeSheet never removes the last sheet", () => {
  const solo = [{ id: "a", name: "only" }];
  const r = removeSheet(solo, "a", "a");
  assert.equal(r.list.length, 1);
  assert.equal(r.removed, null);
});

test("removeSheet drops the active sheet and picks a neighbor", () => {
  const r = removeSheet(base(), "a", "a"); // remove active first sheet
  assert.equal(r.list.length, 1);
  assert.equal(r.list[0].id, "b");
  assert.equal(r.active, "b"); // neighbor became active
  assert.equal(r.removed.id, "a");
});

test("removeSheet keeps active when a non-active sheet is removed", () => {
  const three = base().concat([{ id: "c", name: "시트 3" }]);
  const r = removeSheet(three, "a", "c"); // active 'a' stays
  assert.equal(r.active, "a");
  assert.deepEqual(r.list.map((x) => x.id), ["a", "b"]);
});

test("duplicateSheet deep-clones after the source with a new id and 복사 name", () => {
  const src = [{ id: "a", name: "시트 1", spec: { nested: [1, 2] } }, { id: "b", name: "시트 2" }];
  const { list, active, copy } = duplicateSheet(src, "a", "a", mkId);
  assert.equal(list.length, 3);
  assert.equal(list[1].id, copy.id);       // inserted right after source
  assert.equal(copy.name, "시트 1 복사");
  assert.equal(active, copy.id);
  copy.spec.nested.push(3);                // mutating copy must not touch source
  assert.deepEqual(src[0].spec.nested, [1, 2]);
});

test("duplicateSheet falls back to the active sheet when id is unknown", () => {
  const { copy } = duplicateSheet(base(), "b", "zzz", mkId);
  assert.equal(copy.name, "시트 2 복사");
});

test("updateActive maps only the active sheet", () => {
  const l = updateActive(base(), "b", (s) => ({ ...s, type: "line" }));
  assert.equal(l[0].type, "bar");   // untouched
  assert.equal(l[1].type, "line");  // updated
});

test("reducers tolerate null/empty lists", () => {
  assert.deepEqual(renameSheet(null, "a", "x"), []);
  assert.deepEqual(updateActive(undefined, "a", (s) => s), []);
  assert.equal(setActiveId(null, "a", "b"), "a");
});
