const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const G = require(path.join(__dirname, "..", "js", "geoMatch.js"));

test("normalize collapses Korean admin suffixes to a common stem", () => {
  assert.equal(G.normalize("서울특별시"), G.normalize("서울"));
  assert.equal(G.normalize("서울특별시"), G.normalize("Seoul"));
  assert.equal(G.normalize("성남시"), "성남");
  assert.equal(G.normalize("강남구"), "강남");
  assert.equal(G.normalize("제주도"), G.normalize("제주특별자치도"));
});

test("normalize maps EN/KO country aliases to one canonical token", () => {
  assert.equal(G.normalize("대한민국"), G.normalize("Korea"));
  assert.equal(G.normalize("미국"), G.normalize("United States"));
  assert.equal(G.normalize("USA"), "united states");
  assert.equal(G.normalize("Japan"), G.normalize("일본"));
});

test("normalize is whitespace/punctuation tolerant and null-safe", () => {
  assert.equal(G.normalize("  United   States "), "united states");
  assert.equal(G.normalize("United-States"), "united states");
  assert.equal(G.normalize(null), "");
  assert.equal(G.normalize(""), "");
});

test("match resolves data labels to the layer's canonical names", () => {
  const geo = ["서울특별시", "경기도", "부산광역시"];
  const r = G.match(["서울", "경기", "부산", "울릉"], geo);
  assert.equal(r.map["서울"], "서울특별시");
  assert.equal(r.map["경기"], "경기도");
  assert.equal(r.map["부산"], "부산광역시");
  assert.equal(r.map["울릉"], null);
  assert.equal(r.matched, 3);
  assert.equal(r.total, 4);
  assert.deepEqual(r.unmatched, ["울릉"]);
});

test("match dedupes repeated labels before computing the rate", () => {
  const r = G.match(["서울", "서울", "서울", "경기"], ["서울특별시", "경기도"]);
  assert.equal(r.total, 2); // distinct
  assert.equal(r.rate, 1);
});

test("matchRate mixes EN geo names with KO data labels", () => {
  const geo = ["South Korea", "United States", "Japan", "China"];
  const rate = G.matchRate(["한국", "미국", "일본", "중국"], geo);
  assert.equal(rate, 1);
});

test("bestColumn picks the highest-matching string column", () => {
  const columns = [
    { key: "region", type: "string" },
    { key: "note", type: "string" },
    { key: "amount", type: "float" },
  ];
  const rows = [
    { region: "서울", note: "aaa", amount: 1 },
    { region: "부산", note: "bbb", amount: 2 },
    { region: "경기", note: "ccc", amount: 3 },
  ];
  const geo = ["서울특별시", "부산광역시", "경기도"];
  const best = G.bestColumn(columns, rows, geo);
  assert.equal(best.key, "region");
  assert.equal(best.rate, 1);
});

test("bestColumn returns null when no column clears the min match rate", () => {
  const columns = [{ key: "note", type: "string" }];
  const rows = [{ note: "xxx" }, { note: "yyy" }];
  assert.equal(G.bestColumn(columns, rows, ["서울특별시", "경기도"]), null);
});
