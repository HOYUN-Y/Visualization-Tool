/* insight Analytics — shared CSV/TSV/JSON/XLSX import engine */
(function () {
  "use strict";

  const TYPE_ORDER = ["boolean", "integer", "float", "datetime", "category", "string"];
  const BOOL = { true: true, yes: true, false: false, no: false };

  function extension(name) {
    const match = String(name || "").toLowerCase().match(/\.([^.]+)$/);
    return match ? match[1] : "";
  }

  function baseName(name) {
    return String(name || "Imported data").replace(/\.[^.]+$/, "").trim() || "Imported data";
  }

  function isBlank(value) {
    return value == null || (typeof value === "string" && value.trim() === "");
  }

  function normalizeHeader(value, index, used) {
    const base = String(value == null ? "" : value).trim() || `Column_${index + 1}`;
    let key = base, suffix = 2;
    while (used.has(key)) key = `${base}_${suffix++}`;
    used.add(key);
    return key;
  }

  function rowsFromMatrix(matrix) {
    const nonEmpty = matrix.filter((row) => row.some((value) => !isBlank(value)));
    if (!nonEmpty.length) return { headers: [], rows: [] };
    const width = Math.max(...nonEmpty.map((row) => row.length));
    const used = new Set();
    const headers = Array.from({ length: width }, (_, index) => normalizeHeader(nonEmpty[0][index], index, used));
    const rows = nonEmpty.slice(1).map((values) => {
      const row = {};
      headers.forEach((key, index) => { row[key] = isBlank(values[index]) ? null : values[index]; });
      return row;
    });
    return { headers, rows };
  }

  function parseDelimited(text, delimiter) {
    const matrix = [];
    let row = [], cell = "", quoted = false;
    text = String(text || "").replace(/^\uFEFF/, "");
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"') {
        if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
        else quoted = !quoted;
      } else if (char === delimiter && !quoted) {
        row.push(cell); cell = "";
      } else if ((char === "\n" || char === "\r") && !quoted) {
        if (char === "\r" && text[i + 1] === "\n") i++;
        row.push(cell); matrix.push(row); row = []; cell = "";
      } else cell += char;
    }
    if (cell !== "" || row.length) { row.push(cell); matrix.push(row); }
    if (quoted) throw new Error("Unclosed quoted field");
    return rowsFromMatrix(matrix);
  }

  function rowsFromObjects(input) {
    if (!Array.isArray(input) || !input.length) throw new Error("JSON must be a non-empty array of objects");
    const keys = [];
    const seen = new Set();
    input.forEach((row, index) => {
      if (!row || typeof row !== "object" || Array.isArray(row)) throw new Error(`JSON row ${index + 1} must be an object`);
      Object.keys(row).forEach((key) => { if (!seen.has(key)) { seen.add(key); keys.push(key); } });
    });
    return {
      headers: keys,
      rows: input.map((source) => {
        const row = {};
        keys.forEach((key) => { row[key] = isBlank(source[key]) ? null : source[key]; });
        return row;
      }),
    };
  }

  function boolValue(value) {
    if (typeof value === "boolean") return value;
    const key = String(value).trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(BOOL, key) ? BOOL[key] : null;
  }

  function isIntegerValue(value) {
    if (typeof value === "number") return Number.isFinite(value) && Number.isInteger(value);
    const text = String(value).trim();
    if (!/^[+-]?\d+$/.test(text)) return false;
    const unsigned = text.replace(/^[+-]/, "");
    return unsigned === "0" || !/^0\d+/.test(unsigned);
  }

  function isFloatValue(value) {
    if (typeof value === "number") return Number.isFinite(value);
    const text = String(value).trim();
    const unsigned = text.replace(/^[+-]/, "");
    if (/^0\d/.test(unsigned)) return false;
    return text !== "" && Number.isFinite(Number(text));
  }

  function isDateValue(value) {
    if (value instanceof Date) return !isNaN(value.getTime());
    if (typeof value !== "string") return false;
    const text = value.trim();
    if (!/^\d{4}-\d{2}-\d{2}(?:[T ][0-9:.+-]+Z?)?$/.test(text)) return false;
    return !isNaN(Date.parse(text));
  }

  function inferType(values) {
    const present = values.filter((value) => !isBlank(value));
    if (!present.length) return "string";
    if (present.every((value) => boolValue(value) !== null)) return "boolean";
    if (present.every(isIntegerValue)) return "integer";
    if (present.every(isFloatValue)) return "float";
    if (present.every(isDateValue)) return "datetime";
    const unique = new Set(present.map((value) => value instanceof Date ? value.toISOString() : String(value)));
    if (unique.size <= 30 && unique.size / present.length <= 0.2) return "category";
    return "string";
  }

  function inferColumns(rows) {
    const keys = [];
    const seen = new Set();
    rows.forEach((row) => Object.keys(row || {}).forEach((key) => { if (!seen.has(key)) { seen.add(key); keys.push(key); } }));
    return keys.map((key) => {
      const type = inferType(rows.map((row) => row[key]));
      const measure = type === "integer" || type === "float";
      return { key, label: key, type, role: measure ? "measure" : "dimension", agg: measure ? "sum" : null, unit: null, fmt: null };
    });
  }

  function convertValue(value, type) {
    if (isBlank(value)) return null;
    if (type === "boolean") {
      const converted = boolValue(value);
      if (converted === null) throw new Error(`Cannot convert "${value}" to boolean`);
      return converted;
    }
    if (type === "integer") {
      if (!isIntegerValue(value)) throw new Error(`Cannot convert "${value}" to integer`);
      return Number(value);
    }
    if (type === "float") {
      if (!isFloatValue(value)) throw new Error(`Cannot convert "${value}" to float`);
      return Number(value);
    }
    if (type === "datetime") {
      if (!isDateValue(value)) throw new Error(`Cannot convert "${value}" to datetime`);
      return value instanceof Date ? value.toISOString() : String(value).trim();
    }
    return String(value);
  }

  function safeSlug(value) {
    return String(value || "dataset").normalize("NFKC").replace(/[^a-zA-Z0-9가-힣]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase() || "dataset";
  }

  function uniqueDatasetName(base) {
    const datasets = window.NODE && Array.isArray(window.NODE.datasets) ? window.NODE.datasets : [];
    const names = new Set(datasets.flatMap((dataset) => [dataset.name, dataset.short]).filter(Boolean));
    let name = base, suffix = 2;
    while (names.has(name) || names.has(`${name}.csv`)) name = `${base}_${suffix++}`;
    return name;
  }

  function uniqueDatasetId(base) {
    const datasets = window.NODE && Array.isArray(window.NODE.datasets) ? window.NODE.datasets : [];
    const ids = new Set(datasets.map((dataset) => dataset.id));
    const root = `upload_${safeSlug(base)}`;
    let id = root, suffix = 2;
    while (ids.has(id)) id = `${root}_${suffix++}`;
    return id;
  }

  function makeSheet(fileName, sourceType, name, range, rows) {
    const columns = inferColumns(rows);
    return {
      name,
      fileName,
      sourceType,
      range: range || "",
      rowCount: rows.length,
      columnCount: columns.length,
      rows,
      columns,
      preview: rows.slice(0, 20),
    };
  }

  function readText(file) {
    if (file && typeof file.text === "function") return file.text();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error("Unable to read file"));
      reader.readAsText(file, "UTF-8");
    });
  }

  function readArrayBuffer(file) {
    if (file && typeof file.arrayBuffer === "function") return file.arrayBuffer();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error("Unable to read file"));
      reader.readAsArrayBuffer(file);
    });
  }

  async function inspectWorkbook(file) {
    if (!window.XLSX) throw new Error("SheetJS is not loaded");
    const data = await readArrayBuffer(file);
    const workbook = window.XLSX.read(data, { type: "array", cellDates: true, raw: true });
    const sheets = workbook.SheetNames.map((name) => {
      const worksheet = workbook.Sheets[name];
      const matrix = window.XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true, defval: null, blankrows: false });
      const parsed = rowsFromMatrix(matrix);
      return makeSheet(file.name, "XLSX", name, worksheet["!ref"] || "", parsed.rows);
    });
    if (!sheets.length || sheets.every((sheet) => !sheet.columnCount)) throw new Error("Workbook does not contain readable sheets");
    return { kind: "workbook", fileName: file.name, sourceType: "XLSX", sheets };
  }

  async function parseFile(file) {
    if (!file || !file.name) throw new Error("A file is required");
    const ext = extension(file.name);
    if (ext === "xlsx") return inspectWorkbook(file);
    if (!["csv", "tsv", "json"].includes(ext)) throw new Error("Supported formats: CSV, TSV, JSON, XLSX");
    const text = await readText(file);
    let parsed;
    if (ext === "json") {
      let value;
      try { value = JSON.parse(text); } catch (error) { throw new Error(`Invalid JSON: ${error.message}`); }
      parsed = rowsFromObjects(value);
    } else parsed = parseDelimited(text, ext === "tsv" ? "\t" : ",");
    if (!parsed.headers.length) throw new Error("The file does not contain a header row");
    const sheet = makeSheet(file.name, ext.toUpperCase(), baseName(file.name), "", parsed.rows);
    return { kind: "tabular", fileName: file.name, sourceType: ext.toUpperCase(), sheets: [sheet] };
  }

  function materialize(selection, overrides) {
    if (!selection || !Array.isArray(selection.rows)) throw new Error("A parsed sheet selection is required");
    overrides = overrides || {};
    const inferred = selection.columns || inferColumns(selection.rows);
    const columns = inferred.map((column) => {
      const type = overrides[column.key] || column.type;
      if (!TYPE_ORDER.includes(type)) throw new Error(`Unsupported type override: ${type}`);
      const measure = type === "integer" || type === "float";
      return { ...column, type, role: measure ? "measure" : "dimension", agg: measure ? (column.agg || "sum") : null };
    });
    const rows = selection.rows.map((source, rowIndex) => {
      const row = {};
      columns.forEach((column) => {
        try { row[column.key] = convertValue(source[column.key], column.type); }
        catch (error) { throw new Error(`Row ${rowIndex + 1}, ${column.key}: ${error.message}`); }
      });
      return row;
    });
    const fileBase = baseName(selection.fileName);
    const proposed = selection.sourceType === "XLSX" ? `${fileBase}_${selection.name}` : fileBase;
    const short = uniqueDatasetName(proposed);
    return {
      id: uniqueDatasetId(short),
      name: `${short}.${selection.sourceType === "XLSX" ? "xlsx" : selection.sourceType.toLowerCase()}`,
      short,
      icon: "table",
      source: selection.sourceType,
      rows,
      columns,
      importMeta: { fileName: selection.fileName, sheetName: selection.name, importedAt: new Date().toISOString() },
    };
  }

  window.ImportEngine = { parseFile, inspectWorkbook, inferColumns, materialize };
})();
