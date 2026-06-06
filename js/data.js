/* ============================================================
   NØDE — Sample data engine (Seoul real-estate transactions)
   Seeded so values are stable across reloads.
   Exposes window.NODE = { datasets, fmt, ... }
   ============================================================ */
(function () {
  // mulberry32 seeded PRNG
  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const r = rng(20260605);
  const pick = (a) => a[Math.floor(r() * a.length)];
  const gauss = () => { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v); };
  const round = (n, d=0) => { const p = 10**d; return Math.round(n*p)/p; };

  // Seoul districts with base price (만원/m²) and centroid
  const DISTRICTS = [
    ["강남구", 2780, 37.495, 127.062], ["서초구", 2680, 37.483, 127.032],
    ["송파구", 2180, 37.505, 127.114], ["용산구", 2380, 37.532, 126.990],
    ["성동구", 1920, 37.563, 127.036], ["마포구", 1840, 37.566, 126.901],
    ["양천구", 1560, 37.516, 126.866], ["영등포구", 1700, 37.526, 126.896],
    ["광진구", 1780, 37.538, 127.082], ["강동구", 1600, 37.530, 127.123],
    ["노원구", 1120, 37.654, 127.056], ["은평구", 1240, 37.602, 126.929],
  ];
  const BRANDS = ["래미안", "자이", "힐스테이트", "푸르지오", "e편한세상", "롯데캐슬", "아이파크", "더샵", "센트럴", "포레나"];
  const SUFFIX = ["1단지", "2단지", "스카이", "퍼스트", "리버뷰", "파크", "센트로", "포레", "더힐", "하이츠"];
  const BTYPE = ["아파트", "아파트", "아파트", "오피스텔", "빌라"]; // weighted toward 아파트

  // monthly trend multiplier 2022-01 .. 2025-06 (peak 2022, dip 2023, recovery)
  function trend(year, month) {
    const t = (year - 2022) * 12 + (month - 1); // 0..41
    // sinusoid-ish: peak ~ t=4, trough ~ t=20, recovery up
    const base = 1.0
      + 0.10 * Math.exp(-((t-3)**2)/40)      // early peak
      - 0.16 * Math.exp(-((t-19)**2)/70)     // mid trough
      + 0.0035 * Math.max(0, t-24);          // recovery slope
    return base;
  }

  function buildTxns(n) {
    const rows = [];
    for (let i = 0; i < n; i++) {
      const [district, basePpm, lat, lon] = pick(DISTRICTS);
      const btype = pick(BTYPE);
      const brand = pick(BRANDS), suf = pick(SUFFIX);
      const complex = `${district.slice(0,2)} ${brand}${suf}`;
      const year = pick([2022,2022,2023,2023,2024,2024,2024,2025]);
      const month = 1 + Math.floor(r()*12);
      const day = 1 + Math.floor(r()*27);
      if (year === 2025 && month > 6) continue;
      const area = round(40 + Math.abs(gauss())*38 + (btype==="오피스텔"? -12: 0), 1); // m²
      const floor = btype === "빌라" ? 1 + Math.floor(r()*4) : 1 + Math.floor(r()*Math.min(35, 8+area));
      let built = 1990 + Math.floor(r()*34);
      const ppm = basePpm * trend(year, month) * (0.82 + r()*0.42) * (btype==="오피스텔"?0.78: btype==="빌라"?0.6:1);
      const price = Math.round(area * ppm / 100) * 100; // 만원, rounded to 100
      const row = {
        id: 100000 + i,
        txn_date: `${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`,
        district,
        building_type: btype,
        complex_name: complex,
        area_m2: area,
        floor,
        built_year: built,
        price_manwon: price,
        price_per_m2: round(price/area, 1),
        lat: round(lat + gauss()*0.012, 5),
        lon: round(lon + gauss()*0.012, 5),
      };
      rows.push(row);
    }
    // inject some realistic data-quality issues for the Cleaning studio
    for (let k = 0; k < rows.length; k++) {
      if (r() < 0.045) rows[k].built_year = null;            // missing
      if (r() < 0.03) rows[k].area_m2 = null;                // missing
      if (r() < 0.012) rows[k].price_per_m2 = round(rows[k].price_per_m2 * 6, 1); // outlier
    }
    // a few exact duplicates
    for (let k = 0; k < 6; k++) rows.push({ ...rows[Math.floor(r()*rows.length)] });
    return rows;
  }

  const txns = buildTxns(540);

  // ── Financial dataset: KOSPI-style stock (252 trading days, 2024) ──────────
  function buildStock() {
    const rs = rng(20240102);
    const rows2 = [];
    let price = 2680;
    // generate ~252 weekdays from 2024-01-02
    let y = 2024, m = 1, d = 2;
    function nextDay() { d++; const dm=[0,31,29,31,30,31,30,31,31,30,31,30,31]; if(d>dm[m]){d=1;m++;if(m>12){m=1;y++;}} }
    function dow() { // Zeller-ish simplified for 2024 weekday (Mon=1..Sun=7 in JS: 0=Sun)
      return new Date(y, m-1, d).getDay();
    }
    let cumRet = 0;
    for (let i = 0; i < 320; i++) {
      while (dow() === 0 || dow() === 6) nextDay();
      const date = `${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
      const drift = 0.00015;
      const vol = 0.012;
      const ret = drift + (rs() - 0.5) * vol * 2.5;
      const open = round(price, 2);
      const closeP = round(open * (1 + ret), 2);
      const high = round(Math.max(open, closeP) * (1 + rs() * 0.008), 2);
      const low  = round(Math.min(open, closeP) * (1 - rs() * 0.008), 2);
      const volume = Math.round(4e6 + rs() * 8e6);
      cumRet += ret;
      rows2.push({ date, open, high, low, close: closeP, volume, return_pct: round(ret * 100, 3), cum_return_pct: round(cumRet * 100, 2) });
      price = closeP;
      nextDay();
      if (y > 2024 && m >= 7) break; // stop ~mid 2025
    }
    return rows2;
  }
  const stock = buildStock();

  // monthly price index (aggregate, time series dataset)
  function buildMonthly() {
    const m = {};
    for (const t of txns) {
      const key = t.txn_date.slice(0,7);
      (m[key] = m[key] || []).push(t.price_per_m2);
    }
    return Object.keys(m).sort().map((k, i) => {
      const arr = m[k].filter(Boolean);
      const avg = arr.reduce((a,b)=>a+b,0)/arr.length;
      return { month: k, avg_price_per_m2: round(avg,1), txn_count: arr.length, index: round(avg/30,1) };
    });
  }
  const monthly = buildMonthly();

  // district summary
  function buildDistrict() {
    const m = {};
    for (const t of txns) { (m[t.district] = m[t.district] || []).push(t); }
    return Object.keys(m).map(d => {
      const a = m[d];
      const avgP = a.reduce((s,t)=>s+t.price_manwon,0)/a.length;
      const avgPpm = a.reduce((s,t)=>s+(t.price_per_m2||0),0)/a.length;
      return { district: d, txn_count: a.length, avg_price_manwon: Math.round(avgP),
               avg_price_per_m2: round(avgPpm,1), lat: a[0].lat, lon: a[0].lon };
    }).sort((x,y)=>y.avg_price_per_m2-x.avg_price_per_m2);
  }
  const district = buildDistrict();

  // Column metadata factory
  const COL = (key, label, type, role, opts={}) => ({ key, label, type, role, agg: opts.agg || (role==="measure"?"sum":null), unit: opts.unit||null, fmt: opts.fmt||null });

  const datasets = [
    {
      id: "seoul_txns",
      name: "Seoul_Apartment_Txns.csv",
      short: "Seoul_Apartment_Txns",
      icon: "table",
      source: "CSV",
      rows: txns,
      columns: [
        COL("id", "id", "integer", "dimension"),
        COL("txn_date", "txn_date", "datetime", "dimension"),
        COL("district", "district", "category", "dimension"),
        COL("building_type", "building_type", "category", "dimension"),
        COL("complex_name", "complex_name", "string", "dimension"),
        COL("area_m2", "area_m2", "float", "measure", { unit: "m²", agg: "avg" }),
        COL("floor", "floor", "integer", "measure", { agg: "avg" }),
        COL("built_year", "built_year", "integer", "dimension"),
        COL("price_manwon", "price_manwon", "integer", "measure", { unit: "만원", agg: "avg", fmt: "won" }),
        COL("price_per_m2", "price_per_m2", "float", "measure", { unit: "만원/m²", agg: "avg" }),
        COL("lat", "lat", "float", "dimension"),
        COL("lon", "lon", "float", "dimension"),
      ],
    },
    {
      id: "monthly_index",
      name: "Monthly_Price_Index.csv",
      short: "Monthly_Price_Index",
      icon: "trend",
      source: "Derived",
      rows: monthly,
      columns: [
        COL("month", "month", "datetime", "dimension"),
        COL("avg_price_per_m2", "avg_price_per_m2", "float", "measure", { unit: "만원/m²", agg: "avg" }),
        COL("txn_count", "txn_count", "integer", "measure", { agg: "sum" }),
        COL("index", "index", "float", "measure", { agg: "avg" }),
      ],
    },
    {
      id: "kospi_stock",
      name: "KOSPI_Stock_2024.csv",
      short: "KOSPI_Stock",
      icon: "trend",
      source: "Simulated",
      rows: stock,
      columns: [
        COL("date",           "date",           "datetime", "dimension"),
        COL("open",           "open",           "float",    "measure", { agg: "avg" }),
        COL("high",           "high",           "float",    "measure", { agg: "max" }),
        COL("low",            "low",            "float",    "measure", { agg: "min" }),
        COL("close",          "close",          "float",    "measure", { agg: "avg" }),
        COL("volume",         "volume",         "integer",  "measure", { agg: "sum" }),
        COL("return_pct",     "return_pct",     "float",    "measure", { unit: "%", agg: "avg" }),
        COL("cum_return_pct", "cum_return_pct", "float",    "measure", { unit: "%", agg: "avg" }),
      ],
    },
    {
      id: "district_stats",
      name: "District_Summary.csv",
      short: "District_Summary",
      icon: "map",
      source: "Derived",
      rows: district,
      columns: [
        COL("district", "district", "category", "dimension"),
        COL("txn_count", "txn_count", "integer", "measure", { agg: "sum" }),
        COL("avg_price_manwon", "avg_price_manwon", "integer", "measure", { agg: "avg", fmt: "won" }),
        COL("avg_price_per_m2", "avg_price_per_m2", "float", "measure", { unit: "만원/m²", agg: "avg" }),
        COL("lat", "lat", "float", "dimension"),
        COL("lon", "lon", "float", "dimension"),
      ],
    },
  ];

  // ── World GDP dataset (2023 nominal GDP, USD billion) ──────────────
  const WORLD_GDP = [
    { country: "United States", region: "Americas", gdp_bn: 26954, gdp_pc: 80412, pop_mn: 335, growth_pct: 2.5 },
    { country: "China", region: "Asia", gdp_bn: 17786, gdp_pc: 12614, pop_mn: 1410, growth_pct: 5.2 },
    { country: "Germany", region: "Europe", gdp_bn: 4430, gdp_pc: 52824, pop_mn: 84, growth_pct: -0.3 },
    { country: "Japan", region: "Asia", gdp_bn: 4231, gdp_pc: 33834, pop_mn: 125, growth_pct: 1.9 },
    { country: "India", region: "Asia", gdp_bn: 3730, gdp_pc: 2612, pop_mn: 1428, growth_pct: 7.8 },
    { country: "United Kingdom", region: "Europe", gdp_bn: 3089, gdp_pc: 45295, pop_mn: 68, growth_pct: 0.1 },
    { country: "France", region: "Europe", gdp_bn: 2924, gdp_pc: 44408, pop_mn: 68, growth_pct: 0.9 },
    { country: "Italy", region: "Europe", gdp_bn: 2170, gdp_pc: 36812, pop_mn: 59, growth_pct: 0.7 },
    { country: "Brazil", region: "Americas", gdp_bn: 2082, gdp_pc: 9673, pop_mn: 215, growth_pct: 2.9 },
    { country: "Canada", region: "Americas", gdp_bn: 2090, gdp_pc: 53834, pop_mn: 39, growth_pct: 1.1 },
    { country: "South Korea", region: "Asia", gdp_bn: 1709, gdp_pc: 33147, pop_mn: 52, growth_pct: 1.4 },
    { country: "Australia", region: "Oceania", gdp_bn: 1693, gdp_pc: 64491, pop_mn: 26, growth_pct: 2.0 },
    { country: "Russia", region: "Europe", gdp_bn: 1862, gdp_pc: 12888, pop_mn: 145, growth_pct: 3.6 },
    { country: "Spain", region: "Europe", gdp_bn: 1581, gdp_pc: 32882, pop_mn: 48, growth_pct: 2.5 },
    { country: "Mexico", region: "Americas", gdp_bn: 1323, gdp_pc: 10295, pop_mn: 128, growth_pct: 3.2 },
    { country: "Indonesia", region: "Asia", gdp_bn: 1320, gdp_pc: 4788, pop_mn: 276, growth_pct: 5.1 },
    { country: "Netherlands", region: "Europe", gdp_bn: 1092, gdp_pc: 62153, pop_mn: 18, growth_pct: 0.1 },
    { country: "Saudi Arabia", region: "Middle East", gdp_bn: 1069, gdp_pc: 30436, pop_mn: 36, growth_pct: -0.9 },
    { country: "Turkey", region: "Europe", gdp_bn: 1108, gdp_pc: 12762, pop_mn: 87, growth_pct: 4.5 },
    { country: "Switzerland", region: "Europe", gdp_bn: 905, gdp_pc: 103093, pop_mn: 9, growth_pct: 0.7 },
    { country: "Poland", region: "Europe", gdp_bn: 688, gdp_pc: 18258, pop_mn: 38, growth_pct: 0.4 },
    { country: "Argentina", region: "Americas", gdp_bn: 640, gdp_pc: 13861, pop_mn: 46, growth_pct: -2.5 },
    { country: "Sweden", region: "Europe", gdp_bn: 597, gdp_pc: 56901, pop_mn: 11, growth_pct: -0.1 },
    { country: "Belgium", region: "Europe", gdp_bn: 593, gdp_pc: 50614, pop_mn: 12, growth_pct: 1.4 },
    { country: "Thailand", region: "Asia", gdp_bn: 512, gdp_pc: 7278, pop_mn: 70, growth_pct: 1.9 },
    { country: "Nigeria", region: "Africa", gdp_bn: 477, gdp_pc: 2184, pop_mn: 218, growth_pct: 2.7 },
    { country: "Egypt", region: "Africa", gdp_bn: 396, gdp_pc: 3720, pop_mn: 106, growth_pct: 3.8 },
    { country: "Vietnam", region: "Asia", gdp_bn: 430, gdp_pc: 4367, pop_mn: 98, growth_pct: 5.0 },
    { country: "South Africa", region: "Africa", gdp_bn: 377, gdp_pc: 6192, pop_mn: 61, growth_pct: 0.6 },
    { country: "Malaysia", region: "Asia", gdp_bn: 399, gdp_pc: 11993, pop_mn: 33, growth_pct: 3.8 },
  ];

  datasets.push({
    id: "world_gdp",
    name: "World_GDP_2023.csv",
    short: "World_GDP",
    icon: "map",
    source: "IMF (2023)",
    rows: WORLD_GDP,
    columns: [
      COL("country",     "country",     "string",  "dimension"),
      COL("region",      "region",      "category","dimension"),
      COL("gdp_bn",      "gdp_bn",      "float",   "measure", { unit: "USD bn", agg: "sum" }),
      COL("gdp_pc",      "gdp_pc",      "float",   "measure", { unit: "USD", agg: "avg" }),
      COL("pop_mn",      "pop_mn",      "float",   "measure", { unit: "M", agg: "sum" }),
      COL("growth_pct",  "growth_pct",  "float",   "measure", { unit: "%", agg: "avg" }),
    ],
  });

  // ---- formatting helpers ----
  function fmtWon(v) {
    if (v == null || isNaN(v)) return "—";
    if (v >= 10000) { const eok = v/10000; return (eok>=10? eok.toFixed(1): eok.toFixed(2)).replace(/\.0+$/,"") + "억"; }
    return Math.round(v).toLocaleString() + "만";
  }
  function fmtNum(v, d=0) {
    if (v == null || v === "") return "—";
    if (typeof v !== "number") return String(v);
    return v.toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: 0 });
  }
  function fmtCompact(v) {
    if (v == null || isNaN(v)) return "—";
    const a = Math.abs(v);
    if (a >= 1e8) return (v/1e8).toFixed(1)+"억";
    if (a >= 1e4) return (v/1e4).toFixed(1)+"만";
    if (a >= 1e3) return (v/1e3).toFixed(1)+"k";
    return String(round(v,1));
  }

  window.NODE = {
    datasets,
    fmtWon, fmtNum, fmtCompact, round,
    palette: ["--cat-1","--cat-2","--cat-3","--cat-4","--cat-5","--cat-6","--cat-7","--cat-8"],
  };
})();
