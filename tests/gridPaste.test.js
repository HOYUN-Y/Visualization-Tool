const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { parseClipboardMatrix, isBlock } = require(path.join(__dirname, "..", "js", "gridPaste.js"));

test("parses a tab/newline TSV block into a matrix", () => {
  assert.deepEqual(parseClipboardMatrix("a\tb\tc\n1\t2\t3"), [["a", "b", "c"], ["1", "2", "3"]]);
});

test("drops a single trailing newline (Excel appends one)", () => {
  assert.deepEqual(parseClipboardMatrix("1\t2\n3\t4\n"), [["1", "2"], ["3", "4"]]);
});

test("normalizes CRLF and CR line endings", () => {
  assert.deepEqual(parseClipboardMatrix("1\t2\r\n3\t4"), [["1", "2"], ["3", "4"]]);
  assert.deepEqual(parseClipboardMatrix("1\r2"), [["1"], ["2"]]);
});

test("preserves empty cells between tabs", () => {
  assert.deepEqual(parseClipboardMatrix("1\t\t3"), [["1", "", "3"]]);
});

test("single value → 1x1 matrix", () => {
  assert.deepEqual(parseClipboardMatrix("hello"), [["hello"]]);
});

test("empty / null input → empty matrix", () => {
  assert.deepEqual(parseClipboardMatrix(""), []);
  assert.deepEqual(parseClipboardMatrix(null), []);
  assert.deepEqual(parseClipboardMatrix("\n"), []);
});

test("isBlock distinguishes single cell from a block", () => {
  assert.equal(isBlock("x"), false);
  assert.equal(isBlock("a\tb"), true);   // multi-column
  assert.equal(isBlock("a\nb"), true);   // multi-row
  assert.equal(isBlock(""), false);
});
