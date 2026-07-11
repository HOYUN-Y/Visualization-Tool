const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

// i18n.js assigns window.I18N; load it with a stub window.
function loadI18N() {
  const w = {};
  const code = require("node:fs").readFileSync(path.join(__dirname, "..", "js", "i18n.js"), "utf8");
  new Function("window", code)(w);
  return w.I18N;
}

test("ko and en dictionaries have identical key sets (no drift)", () => {
  const { dict } = loadI18N();
  const ko = Object.keys(dict.ko).sort();
  const en = Object.keys(dict.en).sort();
  const missingKo = en.filter((k) => !(k in dict.ko));
  const missingEn = ko.filter((k) => !(k in dict.en));
  assert.deepEqual(missingKo, [], "keys in en but missing from ko: " + missingKo.join(", "));
  assert.deepEqual(missingEn, [], "keys in ko but missing from en: " + missingEn.join(", "));
});

test("no dictionary value is empty", () => {
  const { dict } = loadI18N();
  for (const lang of ["ko", "en"]) {
    for (const [k, v] of Object.entries(dict[lang])) {
      assert.ok(typeof v === "string" && v.length > 0, `${lang}.${k} is empty`);
    }
  }
});

test("t() localizes, falls back to en, then to the key itself", () => {
  const { t } = loadI18N();
  assert.equal(t("ko", "gSortAsc"), "오름차순 정렬");
  assert.equal(t("en", "gSortAsc"), "Sort ascending");
  assert.equal(t("ko", "__nope__"), "__nope__"); // unknown key → key
  assert.equal(t("xx", "gAddRow"), "Add row");    // unknown lang → en fallback
});

test("newly added grid/data/pivot keys resolve in both languages", () => {
  const { t } = loadI18N();
  const keys = ["gDeleteCol", "gChangeType", "tBool", "dPreview", "dEdits", "pRows", "pValues", "pBuildDesc", "pSaveOpen", "dUnionJoin"];
  for (const k of keys) {
    assert.ok(t("ko", k) && t("ko", k) !== k, `ko missing ${k}`);
    assert.ok(t("en", k) && t("en", k) !== k, `en missing ${k}`);
  }
});
