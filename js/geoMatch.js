/* insight Analytics — region-name normalization & matching for data-driven choropleths (window.GeoMatch).
   Pure & deterministic. Normalizes messy region labels (Korean admin suffixes, EN/KO aliases,
   whitespace) so an arbitrary dataset column can be matched against a map layer's region names.
   Loadable in the browser and Node. */
(function () {
  "use strict";

  // Canonical alias table: many surface forms → one normalized token.
  // Korean provinces (English map names ↔ Korean), major countries (KO ↔ EN), a few frequent short forms.
  const ALIAS = {
    // Korean provinces / metropolitan cities → short Korean token
    "seoul": "서울", "서울특별시": "서울", "서울시": "서울",
    "busan": "부산", "부산광역시": "부산",
    "daegu": "대구", "대구광역시": "대구",
    "incheon": "인천", "인천광역시": "인천",
    "gwangju": "광주", "광주광역시": "광주",
    "daejeon": "대전", "대전광역시": "대전",
    "ulsan": "울산", "울산광역시": "울산",
    "sejong": "세종", "세종특별자치시": "세종",
    "gyeonggi": "경기", "경기도": "경기",
    "gangwon": "강원", "강원도": "강원", "강원특별자치도": "강원",
    "north chungcheong": "충북", "충청북도": "충북",
    "south chungcheong": "충남", "충청남도": "충남",
    "north jeolla": "전북", "전라북도": "전북", "전북특별자치도": "전북",
    "south jeolla": "전남", "전라남도": "전남",
    "north gyeongsang": "경북", "경상북도": "경북",
    "south gyeongsang": "경남", "경상남도": "경남",
    "jeju": "제주", "제주도": "제주", "제주특별자치도": "제주",
    // Countries (Korean → canonical lowercased English used by echarts world map)
    "대한민국": "south korea", "한국": "south korea", "korea": "south korea", "republic of korea": "south korea",
    "미국": "united states", "usa": "united states", "us": "united states", "united states of america": "united states",
    "일본": "japan", "중국": "china", "영국": "united kingdom", "uk": "united kingdom",
    "독일": "germany", "프랑스": "france", "이탈리아": "italy", "스페인": "spain",
    "캐나다": "canada", "호주": "australia", "인도": "india", "브라질": "brazil",
    "러시아": "russia", "멕시코": "mexico", "인도네시아": "indonesia",
  };

  // Strip Korean administrative suffixes so "성남시"/"강남구"/"제주도" reduce to their stem.
  function stripKoreanSuffix(s) {
    var t = s.replace(/(특별자치도|특별자치시|특별시|광역시|자치구|자치시|자치도)$/, "");
    // then a single-char admin suffix, but only when something meaningful remains
    var t2 = t.replace(/(특별시|광역시|도|시|군|구)$/, "");
    return t2.length >= 2 ? t2 : t;
  }

  function normalize(name) {
    if (name == null) return "";
    var s = String(name).trim();
    if (!s) return "";
    var lower = s.toLowerCase();
    if (ALIAS[lower]) return ALIAS[lower];
    if (ALIAS[s]) return ALIAS[s];
    // Korean text: strip admin suffix, drop spaces
    if (/[가-힣]/.test(s)) {
      var stem = stripKoreanSuffix(s).replace(/\s+/g, "");
      if (ALIAS[stem]) return ALIAS[stem];
      return stem;
    }
    // Latin text: lowercase, collapse whitespace/punctuation
    return lower.replace(/[.\-_]/g, " ").replace(/\s+/g, " ").trim();
  }

  // Build normalizedKey → canonical geo name lookup for a map layer's region list.
  function buildIndex(geoNames) {
    var idx = new Map();
    (geoNames || []).forEach(function (g) { var k = normalize(g); if (k && !idx.has(k)) idx.set(k, g); });
    return idx;
  }

  // Match a list of data region labels against the geo layer.
  // Returns { map: {dataLabel → geoName|null}, matched, total, rate, unmatched:[...] }.
  function match(dataNames, geoNames) {
    var idx = buildIndex(geoNames);
    var seen = new Set();
    var map = {}, unmatched = [];
    (dataNames || []).forEach(function (d) {
      var key = String(d);
      if (seen.has(key)) return;
      seen.add(key);
      var g = idx.get(normalize(d));
      map[key] = g || null;
      if (!g) unmatched.push(key);
    });
    var total = seen.size;
    var matched = total - unmatched.length;
    return { map: map, matched: matched, total: total, rate: total ? matched / total : 0, unmatched: unmatched };
  }

  function matchRate(dataNames, geoNames) { return match(dataNames, geoNames).rate; }

  // Find the column whose distinct values best match the geo layer (for auto-detecting a region column).
  // Returns { key, rate } for the best column above minRate, else null.
  function bestColumn(columns, rows, geoNames, minRate) {
    minRate = minRate == null ? 0.5 : minRate;
    var idx = buildIndex(geoNames);
    var best = null;
    (columns || []).forEach(function (c) {
      if (c.type !== "string" && c.type !== "category") return;
      var distinct = new Set();
      for (var i = 0; i < rows.length && distinct.size < 400; i++) { var v = rows[i][c.key]; if (v != null && v !== "") distinct.add(String(v)); }
      if (!distinct.size) return;
      var m = 0;
      distinct.forEach(function (v) { if (idx.has(normalize(v))) m++; });
      var rate = m / distinct.size;
      if (rate >= minRate && (!best || rate > best.rate)) best = { key: c.key, rate: rate };
    });
    return best;
  }

  const api = { normalize, buildIndex, match, matchRate, bestColumn, ALIAS };
  if (typeof window !== "undefined") window.GeoMatch = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
