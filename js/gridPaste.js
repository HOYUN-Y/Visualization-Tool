// gridPaste.js — parse clipboard text (TSV, as copied from Excel/Sheets) into a 2D matrix.
// Pure & deterministic, dual-mode (window.GridPaste + Node require) so the parser has Node tests.
(function () {
  "use strict";

  // Parse pasted text into rows of cells. Splits on newlines (\r\n or \n), each row on tabs.
  // A single trailing empty line (from a terminal newline) is dropped. Returns [][] of strings.
  function parseClipboardMatrix(text) {
    if (text == null) return [];
    let s = String(text);
    if (s === "") return [];
    // normalize line endings, drop one trailing newline if present
    s = s.replace(/\r\n?/g, "\n");
    if (s.endsWith("\n")) s = s.slice(0, -1);
    if (s === "") return [];
    return s.split("\n").map((line) => line.split("\t"));
  }

  // Is this pasted content a multi-cell block (more than one row or column)?
  function isBlock(text) {
    const m = parseClipboardMatrix(text);
    return m.length > 1 || (m.length === 1 && m[0].length > 1);
  }

  const api = { parseClipboardMatrix, isBlock };
  if (typeof window !== "undefined") window.GridPaste = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
