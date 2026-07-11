const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function loadEngine() {
  const window = { NODE: { datasets: [] } };
  const context = vm.createContext({ window, console, Date, Set, Map, JSON, Number, String, Array, Object, RegExp, Error, ArrayBuffer, Uint8Array, isNaN });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "vendor", "sheetjs-0.20.3", "xlsx.full.min.js"), "utf8"), context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", "importEngine.js"), "utf8"), context);
  return { engine: window.ImportEngine, XLSX: context.XLSX || window.XLSX, window };
}

function textFile(name, text) {
  return { name, text: async () => text };
}

test("CSV parsing preserves leading-zero codes and infers deterministic types", async () => {
  const { engine } = loadEngine();
  const lines = ["code,qty,amount,flag,date,group,note"];
  for (let i = 0; i < 10; i++) lines.push(`00${i},${i + 1},${i + 0.5},${i % 2 ? "yes" : "no"},2026-07-${String(i + 1).padStart(2, "0")},${i < 5 ? "A" : "B"},"line ${i}"`);
  const result = await engine.parseFile(textFile("sample.csv", lines.join("\n")));
  const sheet = result.sheets[0];
  const types = Object.fromEntries(sheet.columns.map((column) => [column.key, column.type]));

  assert.equal(sheet.rows[0].code, "000");
  assert.deepEqual(types, { code: "string", qty: "integer", amount: "float", flag: "boolean", date: "datetime", group: "category", note: "string" });

  const dataset = engine.materialize(sheet);
  assert.equal(dataset.rows[0].code, "000");
  assert.equal(dataset.rows[0].qty, 1);
  assert.equal(dataset.rows[0].flag, false);
});

test("CSV parser supports escaped quotes, multiline cells, nulls, and duplicate headers", async () => {
  const { engine } = loadEngine();
  const file = textFile("quoted.csv", 'name,name,memo,empty\nAlice,A,"hello, ""world""\nnext",\n');
  const sheet = (await engine.parseFile(file)).sheets[0];
  assert.deepEqual(Array.from(sheet.columns, (column) => column.key), ["name", "name_2", "memo", "empty"]);
  assert.equal(sheet.rows[0].memo, 'hello, "world"\nnext');
  assert.equal(sheet.rows[0].empty, null);
});

test("JSON parser uses the union of keys and type overrides validate conversion", async () => {
  const { engine } = loadEngine();
  const file = textFile("items.json", JSON.stringify([{ id: "001", value: "2.5" }, { id: "002", extra: "x", value: "3.5" }]));
  const sheet = (await engine.parseFile(file)).sheets[0];
  assert.deepEqual(Array.from(sheet.columns, (column) => column.key), ["id", "value", "extra"]);
  const dataset = engine.materialize(sheet, { value: "float" });
  assert.equal(dataset.rows[0].id, "001");
  assert.equal(dataset.rows[0].value, 2.5);
  assert.equal(dataset.rows[0].extra, null);
  assert.throws(() => engine.materialize(sheet, { id: "integer" }), /Cannot convert/);
});

test("XLSX inspection exposes sheet metadata, dates, and first 20 preview rows", async () => {
  const { engine, XLSX } = loadEngine();
  const workbook = XLSX.utils.book_new();
  const rows = [["date", "amount"], ...Array.from({ length: 25 }, (_, index) => [new Date(Date.UTC(2026, 0, index + 1)), index + 1])];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), "Sales");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["name"], ["Seoul"]]), "Regions");
  const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx", cellDates: true });
  const file = { name: "book.xlsx", arrayBuffer: async () => bytes instanceof ArrayBuffer ? bytes : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
  const result = await engine.inspectWorkbook(file);

  assert.equal(result.sheets.length, 2);
  assert.equal(result.sheets[0].name, "Sales");
  assert.equal(result.sheets[0].rowCount, 25);
  assert.equal(result.sheets[0].columnCount, 2);
  assert.equal(result.sheets[0].preview.length, 20);
  assert.equal(result.sheets[0].columns[0].type, "datetime");
});

test("materialization suffixes duplicate dataset names and ids", async () => {
  const { engine, window } = loadEngine();
  const sheet = (await engine.parseFile(textFile("sales.csv", "value\n1\n2"))).sheets[0];
  const first = engine.materialize(sheet);
  window.NODE.datasets.push(first);
  const second = engine.materialize(sheet);
  assert.equal(second.short, "sales_2");
  assert.equal(second.id, "upload_sales_2");
});
