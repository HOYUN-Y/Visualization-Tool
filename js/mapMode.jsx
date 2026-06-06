/* NØDE/Insight — Map mode: Seoul choropleth + World map */
(function () {
  const { useStore, actions, derive, stat } = window.Store;
  const Icon = window.Icon, NODE = window.NODE, Charts = window.Charts;
  const EChart = Charts.EChart;

  const GEO_URL      = "https://raw.githubusercontent.com/southkorea/seoul-maps/master/kostat/2013/json/seoul_municipalities_geo_simple.json";
  // Highcharts map-collection (npm CDN) — province level only; municipality uses bubble overlay
  const KOREA_PROV_URL = "https://cdn.jsdelivr.net/npm/@highcharts/map-collection@2.0.1/countries/kr/kr-all.geo.json";
  // English→Korean name map for Highcharts GeoJSON properties
  const KOREA_HC_NAME = {
    "Seoul":"서울특별시","Busan":"부산광역시","Daegu":"대구광역시","Incheon":"인천광역시",
    "Gwangju":"광주광역시","Daejeon":"대전광역시","Ulsan":"울산광역시","Sejong":"세종특별자치시",
    "Gyeonggi":"경기도","Gangwon":"강원특별자치도","North Chungcheong":"충청북도","South Chungcheong":"충청남도",
    "North Jeolla":"전라북도","South Jeolla":"전라남도","North Gyeongsang":"경상북도",
    "South Gyeongsang":"경상남도","Jeju":"제주특별자치도",
  };
  const WORLD_GEO_URL = "https://cdn.jsdelivr.net/npm/echarts@4.9.0/map/json/world.json";
  const METRICS = [
    { k: "avg_price_per_m2", label: "₩/m²", fmt: (v) => NODE.fmtNum(v, 0) + "만" },
    { k: "avg_price_manwon", label: "Price", fmt: (v) => NODE.fmtWon(v) },
    { k: "txn_count", label: "Txns", fmt: (v) => NODE.fmtNum(v, 0) },
  ];
  const WORLD_METRICS = [
    { k: "gdp_bn",     label: "GDP",    fmt: (v) => "$" + NODE.fmtNum(v, 0) + "B" },
    { k: "gdp_pc",     label: "Per Capita", fmt: (v) => "$" + NODE.fmtNum(v, 0) },
    { k: "pop_mn",     label: "Population", fmt: (v) => NODE.fmtNum(v, 0) + "M" },
    { k: "growth_pct", label: "Growth", fmt: (v) => (v > 0 ? "+" : "") + v.toFixed(1) + "%" },
  ];

  let _geoState = "idle";       // idle | ok | fail
  let _koreaProvState = "idle"; // province GeoJSON (Highcharts, names remapped to Korean)
  let _worldGeoState  = "idle";

  function MapCenter() {
    const theme = useStore((s) => s.theme);
    const sel = useStore((s) => s.dash.cross); // reuse cross as map selection
    const [metric, setMetric] = React.useState("avg_price_per_m2");
    const [view, setView] = React.useState("choropleth");
    const [geo, setGeo] = React.useState(_geoState);
    const ds = NODE.datasets.find((d) => d.id === "district_stats");
    const rows = ds.rows;
    const m = METRICS.find((x) => x.k === metric);

    React.useEffect(() => {
      if (_geoState === "ok") { setGeo("ok"); return; }
      if (_geoState === "fail") { setGeo("fail"); setView("bubble"); return; }
      let alive = true;
      fetch(GEO_URL).then((r) => r.json()).then((gj) => {
        if (!alive) return; echarts.registerMap("seoul", gj); _geoState = "ok"; setGeo("ok");
      }).catch(() => { if (!alive) return; _geoState = "fail"; setGeo("fail"); setView("bubble"); });
      return () => { alive = false; };
    }, []);

    const c = Charts.themeColors(); const pal = Charts.palette();
    const data = rows.map((r) => ({ name: r.district, value: r[metric], lat: r.lat, lon: r.lon }));
    const vals = data.map((d) => d.value); const minV = Math.min(...vals), maxV = Math.max(...vals);

    const visualMap = {
      min: minV, max: maxV, calculable: true, left: 12, bottom: 18, orient: "vertical",
      itemHeight: 130, text: [m.fmt(maxV), m.fmt(minV)], textStyle: { color: c.text, fontSize: 10 },
      inRange: { color: [Charts.resolveVar("--bg-3"), pal[0]] },
    };
    const tooltip = { ...Charts.baseGrid(c).tooltip, trigger: "item",
      formatter: (p) => `<b>${p.name}</b><br/>${m.label}: <b>${p.value != null && !isNaN(p.value) ? m.fmt(p.value) : "—"}</b>` };

    let option;
    if (view === "choropleth" && geo === "ok") {
      option = { animation: false, tooltip, visualMap,
        series: [{ type: "map", map: "seoul", roam: true, scaleLimit: { min: 1, max: 6 },
          data, label: { show: true, color: c.text, fontSize: 9, fontFamily: "IBM Plex Sans" },
          itemStyle: { borderColor: c.bg, borderWidth: 1 },
          emphasis: { label: { color: c.textHi, fontWeight: "bold" }, itemStyle: { areaColor: pal[0] } },
          select: { itemStyle: { areaColor: Charts.resolveVar("--accent-hi") }, label: { color: "#fff" } } }] };
    } else {
      // bubble fallback — scatter on lon/lat (geo if available, else cartesian)
      const useGeo = geo === "ok";
      const sizes = data.map((d) => d.value); const smin = Math.min(...sizes), smax = Math.max(...sizes);
      const sz = (v) => 14 + ((v - smin) / (smax - smin || 1)) * 42;
      const scatterData = data.map((d) => ({ name: d.name, value: useGeo ? [d.lon, d.lat, d.value] : [d.lon, d.lat, d.value] }));
      option = { animation: false, tooltip, visualMap: { ...visualMap, dimension: 2 },
        geo: useGeo ? { map: "seoul", roam: true, itemStyle: { areaColor: Charts.resolveVar("--bg-2"), borderColor: c.split }, emphasis: { disabled: true } } : undefined,
        grid: useGeo ? undefined : { left: 30, right: 20, top: 20, bottom: 30, containLabel: true },
        xAxis: useGeo ? undefined : { type: "value", min: 126.76, max: 127.18, axisLabel: { color: c.faint, fontSize: 9, formatter: (v) => v.toFixed(2) }, splitLine: { lineStyle: { color: c.split } }, name: "lon" },
        yAxis: useGeo ? undefined : { type: "value", min: 37.42, max: 37.70, axisLabel: { color: c.faint, fontSize: 9, formatter: (v) => v.toFixed(2) }, splitLine: { lineStyle: { color: c.split } }, name: "lat" },
        series: [{ type: "scatter", coordinateSystem: useGeo ? "geo" : "cartesian2d",
          symbolSize: (val) => sz(val[2]), data: scatterData,
          label: { show: true, formatter: "{b}", position: "right", color: c.text, fontSize: 9 },
          itemStyle: { opacity: 0.85, borderColor: c.bg, borderWidth: 1 } }] };
    }

    const onEvents = { click: (p) => { if (p.name) actions.setCross({ key: "district", value: p.name, source: "map" }); } };

    return (
      <React.Fragment>
        <div className="phead">
          <span className="ttl" style={{ textTransform: "none", fontSize: "var(--fs-13)", letterSpacing: 0, color: "var(--tx-hi)" }}>
            <Icon name="map" size={14} style={{ verticalAlign: "-2px", marginRight: 6, color: "var(--accent)" }} />Geo Map · Seoul
          </span>
          <div className="seg" style={{ marginLeft: 6 }}>
            {METRICS.map((x) => <button key={x.k} className={metric === x.k ? "on" : ""} onClick={() => setMetric(x.k)}>{x.label}</button>)}
          </div>
          <div className="spacer" />
          <div className="seg">
            <button className={view === "choropleth" ? "on" : ""} disabled={geo !== "ok"} onClick={() => setView("choropleth")}>Choropleth</button>
            <button className={view === "bubble" ? "on" : ""} onClick={() => setView("bubble")}>Bubble</button>
          </div>
        </div>
        {geo === "fail" && <div className="map-note"><Icon name="info" size={12} /> District boundaries unavailable offline — showing bubble map from lat/lon coordinates.</div>}
        {geo === "idle" && <div className="map-note"><Icon name="info" size={12} /> Loading Seoul district boundaries…</div>}
        <div className="vizcanvas" style={{ padding: 0 }}>
          <EChart option={option} theme={theme + view + geo} onEvents={onEvents} style={{ height: "100%" }} />
        </div>
      </React.Fragment>
    );
  }

  function MapPanel() {
    const sel = useStore((s) => s.dash.cross);
    const [metric] = [useStore((s) => s.ui.mapMetric) || "avg_price_per_m2"];
    const ds = NODE.datasets.find((d) => d.id === "district_stats");
    const rank = [...ds.rows].map((r) => ({ d: r.district, v: r.avg_price_per_m2, p: r.avg_price_manwon, n: r.txn_count }))
      .sort((a, b) => b.v - a.v);
    const max = Math.max(...rank.map((r) => r.v));
    const selD = sel && sel.key === "district" ? sel.value : null;
    return (
      <div className="mappanel">
        <div className="cp-block">
          <div className="cp-blocktitle">District leaderboard · ₩/m²</div>
          <div className="maprank">
            {rank.map((r, i) => (
              <div key={r.d} className={"mr-row" + (selD === r.d ? " sel" : "")} onClick={() => actions.setCross({ key: "district", value: r.d, source: "map" })}>
                <span className="mr-rank mono">{i + 1}</span>
                <span className="mr-name">{r.d}</span>
                <span className="mr-bar"><span style={{ width: (r.v / max * 100) + "%" }} /></span>
                <span className="mr-val mono">{NODE.fmtNum(r.v, 0)}</span>
              </div>
            ))}
          </div>
        </div>
        {selD && (() => {
          const r = ds.rows.find((x) => x.district === selD);
          return (
            <div className="cp-block">
              <div className="cp-blocktitle">{selD}</div>
              <div className="kv"><span className="k">Avg ₩/m²</span><span className="v mono">{NODE.fmtNum(r.avg_price_per_m2, 0)}만</span></div>
              <div className="kv"><span className="k">Avg price</span><span className="v mono">{NODE.fmtWon(r.avg_price_manwon)}</span></div>
              <div className="kv"><span className="k">Transactions</span><span className="v mono">{r.txn_count}</span></div>
              <button className="btn ghost sm" style={{ marginTop: 8 }} onClick={() => actions.setCross(null)}><Icon name="x" /> Clear selection</button>
            </div>
          );
        })()}
        <div className="cp-block">
          <div className="cf-info"><Icon name="bolt" size={14} /><div>Click any district on the map or list to select it. Choropleth shades by the chosen metric; switch to Bubble for a coordinate view.</div></div>
        </div>
      </div>
    );
  }

  // ── Korea Map ────────────────────────────────────────────────────
  const KOREA_PROV_METRICS = [
    { k: "pop_man",     label: "인구",   fmt: (v) => NODE.fmtNum(v,0)+"만명" },
    { k: "pop_density", label: "인구밀도", fmt: (v) => NODE.fmtNum(v,0)+"명/km²" },
    { k: "area_km2",    label: "면적",   fmt: (v) => NODE.fmtNum(v,0)+"km²" },
    { k: "gdp_tr",      label: "GRDP",  fmt: (v) => NODE.fmtNum(v,0)+"조" },
  ];
  const KOREA_MUN_METRICS = [
    { k: "pop_man",     label: "인구",   fmt: (v) => NODE.fmtNum(v,0)+"만명" },
    { k: "pop_density", label: "인구밀도", fmt: (v) => NODE.fmtNum(v,0)+"명/km²" },
    { k: "area_km2",    label: "면적",   fmt: (v) => NODE.fmtNum(v,0)+"km²" },
  ];

  // Province names mapping for filtering municipalities
  const PROV_SHORT = {
    "서울특별시":"서울","경기도":"경기","인천광역시":"인천","부산광역시":"부산",
    "대구광역시":"대구","대전광역시":"대전","광주광역시":"광주","울산광역시":"울산",
    "세종특별자치시":"세종","경상남도":"경남","경상북도":"경북","충청남도":"충남",
    "충청북도":"충북","전라남도":"전남","전라북도":"전북",
    "강원특별자치도":"강원","제주특별자치도":"제주",
  };

  // municipality lat/lon (approximate centroids for bubble overlay)
  const MUN_LATLON = {
    "강남구":[37.517,127.047],"송파구":[37.514,127.106],"서초구":[37.483,127.032],"강서구":[37.551,126.849],
    "노원구":[37.654,127.056],"관악구":[37.479,126.952],"은평구":[37.619,126.923],"강북구":[37.637,127.025],
    "영등포구":[37.526,126.896],"성북구":[37.589,127.017],"마포구":[37.566,126.901],"용산구":[37.532,126.990],
    "중구":[37.563,126.998],"종로구":[37.573,126.979],"동대문구":[37.574,127.040],"성동구":[37.563,127.036],
    "광진구":[37.538,127.082],"강동구":[37.530,127.123],"중랑구":[37.606,127.093],"도봉구":[37.669,127.047],
    "동작구":[37.512,126.940],"구로구":[37.495,126.888],"금천구":[37.457,126.895],"양천구":[37.516,126.866],
    "서대문구":[37.579,126.937],
    "수원시":[37.264,127.029],"고양시":[37.659,126.832],"용인시":[37.241,127.177],"성남시":[37.420,127.127],
    "화성시":[37.200,126.831],"부천시":[37.504,126.766],"남양주시":[37.636,127.216],"안산시":[37.321,126.831],
    "안양시":[37.394,126.957],"평택시":[37.000,126.997],"시흥시":[37.380,126.803],"파주시":[37.760,126.780],
    "김포시":[37.615,126.716],"의정부시":[37.738,127.034],
    "연수구":[37.410,126.678],"부평구":[37.508,126.722],"남동구":[37.447,126.731],"서구":[37.546,126.668],
    "미추홀구":[37.467,126.651],
    "해운대구":[35.163,129.162],"부산진구":[35.164,129.053],"북구":[35.197,128.991],"사상구":[35.149,128.992],
    "금정구":[35.243,129.092],
    "달서구":[35.829,128.532],"수성구":[35.858,128.630],
    "창원시":[35.228,128.681],"김해시":[35.234,128.882],"진주시":[35.180,128.107],"양산시":[35.334,129.038],
    "거제시":[34.880,128.621],
    "포항시":[36.019,129.343],"구미시":[36.119,128.344],"경주시":[35.856,129.225],"안동시":[36.568,128.729],
    "천안시":[36.806,127.152],"아산시":[36.789,127.002],"당진시":[36.890,126.626],
    "청주시":[36.642,127.489],"충주시":[36.991,127.925],"제천시":[37.133,128.191],
    "여수시":[34.761,127.662],"순천시":[34.949,127.487],"목포시":[34.812,126.393],
    "전주시":[35.821,127.148],"익산시":[35.948,126.954],"군산시":[35.967,126.736],
    "원주시":[37.342,127.920],"춘천시":[37.882,127.729],"강릉시":[37.751,128.876],"동해시":[37.524,129.114],
    "유성구":[36.362,127.357],
    "광산구":[35.139,126.793],"북구":[35.174,126.912],
    "제주시":[33.500,126.531],"서귀포시":[33.254,126.560],
  };

  // Convert WGS84 lat/lon → UTM Zone 52N → Highcharts projected coords
  // (Highcharts map-collection GeoJSON uses UTM52N projected space, NOT WGS84)
  function wgs84ToHCKorea(lon, lat) {
    const a=6378137.0,f=1/298.257223563,k0=0.9996;
    const e2=2*f-f*f, ep2=e2/(1-e2);
    const lon0=129*Math.PI/180;
    const latR=lat*Math.PI/180, lonR=lon*Math.PI/180;
    const Nv=a/Math.sqrt(1-e2*Math.sin(latR)**2);
    const T=Math.tan(latR)**2, C=ep2*Math.cos(latR)**2;
    const Av=Math.cos(latR)*(lonR-lon0);
    const e4=e2*e2, e6=e4*e2;
    const M=a*((1-e2/4-3*e4/64-5*e6/256)*latR-(3*e2/8+3*e4/32+45*e6/1024)*Math.sin(2*latR)+(15*e4/256+45*e6/1024)*Math.sin(4*latR)-(35*e6/3072)*Math.sin(6*latR));
    const northing=k0*(M+Nv*Math.tan(latR)*(Av**2/2+(5-T+9*C+4*C**2)*Av**4/24+(61-58*T+T**2+600*C-330*ep2)*Av**6/720));
    const easting=k0*Nv*(Av+(1-T+C)*Av**3/6+(5-18*T+T**2+72*C-58*ep2)*Av**5/120)+500000;
    const xoff=114507.650342,yoff=4275280.75883,sf=0.00116959721971*15.5,mX=-999,mY=9851;
    return [(easting-xoff)*sf+mX, mY+(northing-yoff)*sf];
  }

  // Detect lat/lon/value columns from a dataset's column list
  function detectGeoColumns(columns) {
    const latPat = /^(lat|latitude|위도|y|y_coord|lat_y)$/i;
    const lonPat = /^(lon|lng|longitude|경도|x|x_coord|lon_x|long)$/i;
    const latCol = columns.find((c) => latPat.test(c.key));
    const lonCol = columns.find((c) => lonPat.test(c.key));
    const valCols = columns.filter((c) => c.type === "float" || c.type === "integer")
      .filter((c) => c.key !== latCol?.key && c.key !== lonCol?.key);
    return { latCol: latCol?.key || null, lonCol: lonCol?.key || null, valCols };
  }

  function KoreaMapCenter() {
    const theme = useStore((s) => s.theme);
    const activeId = useStore((s) => s.activeId);
    const [level, setLevel] = React.useState("province");  // "province" | "municipality" | "custom"
    const [metric, setMetric] = React.useState("pop_man");
    const [provGeo, setProvGeo] = React.useState(_koreaProvState);
    const [selProv, setSelProv] = React.useState(null);
    // custom data controls
    const [customLatCol, setCustomLatCol] = React.useState(null);
    const [customLonCol, setCustomLonCol] = React.useState(null);
    const [customValCol, setCustomValCol] = React.useState(null);
    const [customLabelCol, setCustomLabelCol] = React.useState(null);

    // Check active dataset for lat/lon columns → auto-suggest "내 데이터" mode
    const { ds: activeDs, rows: activeRows } = derive.getActiveData(activeId);
    const geoDetect = React.useMemo(() => detectGeoColumns(activeDs.columns || []), [activeId]);
    const hasGeoData = !!(geoDetect.latCol && geoDetect.lonCol);

    // Auto-populate column selectors when switching to custom or dataset changes
    React.useEffect(() => {
      if (geoDetect.latCol)  setCustomLatCol(geoDetect.latCol);
      if (geoDetect.lonCol)  setCustomLonCol(geoDetect.lonCol);
      if (geoDetect.valCols.length) setCustomValCol(geoDetect.valCols[0].key);
    }, [activeId]);

    const metrics = level === "province" ? KOREA_PROV_METRICS : KOREA_MUN_METRICS;
    const m = metrics.find((x) => x.k === metric) || metrics[0];

    // fetch province GeoJSON and remap English names → Korean
    React.useEffect(() => {
      if (_koreaProvState === "ok") { setProvGeo("ok"); return; }
      if (_koreaProvState === "fail") { setProvGeo("fail"); return; }
      let alive = true;
      fetch(KOREA_PROV_URL).then((r) => r.json()).then((gj) => {
        if (!alive) return;
        // remap feature names from English to Korean
        gj.features.forEach((f) => {
          const engName = f.properties && f.properties.name;
          if (engName && KOREA_HC_NAME[engName]) f.properties.name = KOREA_HC_NAME[engName];
        });
        echarts.registerMap("korea_prov", gj);
        _koreaProvState = "ok"; setProvGeo("ok");
      }).catch(() => { if (!alive) return; _koreaProvState = "fail"; setProvGeo("fail"); });
      return () => { alive = false; };
    }, []);

    const c = Charts.themeColors(); const pal = Charts.palette();

    // reset metric if not valid for current level
    React.useEffect(() => {
      const keys = metrics.map((x) => x.k);
      if (!keys.includes(metric)) setMetric(keys[0]);
    }, [level]);

    const provDs = NODE.datasets.find((d) => d.id === "korea_provinces");
    const munDs  = NODE.datasets.find((d) => d.id === "korea_municipalities");
    const provRows = provDs ? provDs.rows : [];
    let munRows  = munDs ? munDs.rows : [];
    if (selProv) munRows = munRows.filter((r) => r.province === selProv);

    const rows = level === "province" ? provRows : munRows;
    const vals = rows.map((r) => r[metric]).filter((v) => v != null);
    const minV = vals.length ? Math.min(...vals) : 0;
    const maxV = vals.length ? Math.max(...vals) : 1;

    const visualMap = {
      min: minV, max: maxV, calculable: true, left: 12, bottom: 18, orient: "vertical",
      itemHeight: 120, text: [m.fmt(maxV), m.fmt(minV)],
      textStyle: { color: c.text, fontSize: 10 },
      inRange: { color: [Charts.resolveVar("--bg-3"), pal[0]] },
    };

    // Province choropleth option
    const provOption = provGeo === "ok" ? {
      animation: false,
      tooltip: { ...Charts.baseGrid(c).tooltip, trigger: "item",
        formatter: (p) => {
          const row = provRows.find((r) => r.name === p.name);
          if (!row) return `<b>${p.name}</b><br/>데이터 없음`;
          return `<b>${p.name}</b><br/>인구: <b>${NODE.fmtNum(row.pop_man,0)}만명</b><br/>인구밀도: <b>${NODE.fmtNum(row.pop_density,0)}명/km²</b><br/>면적: <b>${NODE.fmtNum(row.area_km2,0)} km²</b><br/>GRDP: <b>${NODE.fmtNum(row.gdp_tr,0)}조원</b>`;
        }
      },
      visualMap,
      series: [{
        type: "map", map: "korea_prov", roam: true, scaleLimit: { min: 1, max: 10 },
        data: provRows.map((r) => ({ name: r.name, value: r[metric] })),
        label: { show: true, color: c.text, fontSize: 8.5, fontFamily: "IBM Plex Sans" },
        itemStyle: { borderColor: c.bg, borderWidth: 0.5 },
        emphasis: { label: { show: true, color: c.textHi, fontSize: 10 }, itemStyle: { areaColor: pal[0] } },
        select: { itemStyle: { areaColor: Charts.resolveVar("--accent-hi") }, label: { color: "#fff" } },
      }]
    } : null;

    // Municipality bubble overlay on province map background
    const munSizes = munRows.map((r) => r.pop_man);
    const sMin = munSizes.length ? Math.min(...munSizes) : 0;
    const sMax = munSizes.length ? Math.max(...munSizes) : 1;
    const sz = (v) => 8 + ((v - sMin) / (sMax - sMin + 1)) * 28;

    const munOption = provGeo === "ok" ? {
      animation: false,
      tooltip: { ...Charts.baseGrid(c).tooltip, trigger: "item",
        formatter: (p) => {
          const row = munRows[p.dataIndex];
          if (!row) return p.name;
          return `<b>${row.name}</b><br/><span style="color:var(--tx-faint)">${row.province}</span><br/>인구: <b>${NODE.fmtNum(row.pop_man,0)}만명</b><br/>인구밀도: <b>${NODE.fmtNum(row.pop_density,0)}명/km²</b><br/>면적: <b>${NODE.fmtNum(row.area_km2,0)} km²</b>`;
        }
      },
      visualMap: { ...visualMap, dimension: 2 },
      geo: { map: "korea_prov", roam: true, scaleLimit: { min: 1, max: 10 },
        itemStyle: { areaColor: Charts.resolveVar("--bg-2"), borderColor: c.split, borderWidth: 0.5 },
        emphasis: { disabled: true } },
      series: [{
        type: "scatter", coordinateSystem: "geo",
        symbolSize: (val) => sz(val[2]),
        data: munRows.map((r) => {
          const ll = MUN_LATLON[r.name] || [37.5, 127.0]; // [lat, lon]
          // Highcharts GeoJSON uses UTM52N projected coords; convert WGS84→HC
          const hc = wgs84ToHCKorea(ll[1], ll[0]);
          return { name: r.name, value: [hc[0], hc[1], r[metric]] };
        }),
        label: { show: munRows.length < 20, formatter: "{b}", position: "right", color: c.text, fontSize: 9 },
        itemStyle: { opacity: 0.85, borderColor: c.bg, borderWidth: 1 },
        encode: { value: 2 },
      }]
    } : null;

    // ── Custom (사용자 데이터) option ──────────────────────────────────
    const customOption = React.useMemo(() => {
      if (provGeo !== "ok" || level !== "custom") return null;
      if (!customLatCol || !customLonCol) return null;
      const validRows = activeRows.filter((r) => {
        const lat = r[customLatCol], lon = r[customLonCol];
        return typeof lat === "number" && typeof lon === "number"
          && lat >= 33 && lat <= 39 && lon >= 124 && lon <= 132; // Korea bounds
      });
      if (!validRows.length) return null;
      const vals = customValCol ? validRows.map((r) => r[customValCol]).filter((v) => v != null) : [];
      const vMin = vals.length ? Math.min(...vals) : 0;
      const vMax = vals.length ? Math.max(...vals) : 1;
      const szFn = vals.length
        ? (v) => 6 + ((v - vMin) / (vMax - vMin + 1)) * 26
        : () => 10;
      const strCols = (activeDs.columns || []).filter((c) => c.type === "string");
      const labelKey = customLabelCol || strCols[0]?.key || null;
      return {
        animation: false,
        tooltip: { ...Charts.baseGrid(c).tooltip, trigger: "item",
          formatter: (p) => {
            const r = validRows[p.dataIndex]; if (!r) return p.name;
            const label = labelKey ? r[labelKey] : `행 ${p.dataIndex+1}`;
            const valLine = customValCol ? `<br/>${customValCol}: <b>${NODE.fmtNum(r[customValCol],1)}</b>` : "";
            return `<b>${label}</b><br/>위도 ${r[customLatCol].toFixed(4)} / 경도 ${r[customLonCol].toFixed(4)}${valLine}`;
          }
        },
        ...(vals.length ? { visualMap: { min: vMin, max: vMax, calculable: true, left:12, bottom:18, orient:"vertical",
          itemHeight:120, text:[NODE.fmtNum(vMax,0), NODE.fmtNum(vMin,0)],
          textStyle:{ color:c.text, fontSize:10 },
          inRange:{ color:[Charts.resolveVar("--bg-3"), pal[0]] }, dimension: 2 } } : {}),
        geo: { map: "korea_prov", roam: true, scaleLimit: { min:1, max:20 },
          itemStyle: { areaColor: Charts.resolveVar("--bg-2"), borderColor: c.split, borderWidth: 0.5 },
          emphasis: { disabled: true } },
        series: [{
          type: "scatter", coordinateSystem: "geo",
          symbolSize: (val) => szFn(val[2]),
          data: validRows.map((r) => {
            const hc = wgs84ToHCKorea(r[customLonCol], r[customLatCol]);
            return { value: [hc[0], hc[1], customValCol ? r[customValCol] : 0] };
          }),
          label: { show: validRows.length <= 50 && !!labelKey, formatter: (p) => {
            const r = validRows[p.dataIndex]; return labelKey && r ? String(r[labelKey]) : "";
          }, position: "right", color: c.text, fontSize: 9 },
          itemStyle: { color: pal[0], opacity: 0.8, borderColor: c.bg, borderWidth: 1 },
          encode: { value: 2 },
        }]
      };
    }, [provGeo, level, activeId, customLatCol, customLonCol, customValCol, customLabelCol, theme]);

    const option = level === "province" ? provOption : level === "custom" ? customOption : munOption;
    const geoReady = provGeo === "ok";
    const geoLoading = provGeo === "idle";
    const provList = provRows;

    const onEvents = level === "province"
      ? { click: (p) => { if (p.name) { setSelProv(p.name); setLevel("municipality"); } } }
      : {};

    const numCols = (activeDs.columns || []).filter((c) => c.type === "float" || c.type === "integer");
    const strCols = (activeDs.columns || []).filter((c) => c.type === "string");
    const allCols = activeDs.columns || [];
    const selStyle = { fontSize:11, background:"var(--bg-2)", color:"var(--tx-mid)", border:"1px solid var(--line-strong)", borderRadius:"var(--r-sm)", padding:"2px 6px", cursor:"pointer" };

    return (
      <React.Fragment>
        <div className="phead">
          <span className="ttl" style={{ textTransform:"none", fontSize:"var(--fs-13)", letterSpacing:0, color:"var(--tx-hi)" }}>
            <Icon name="map" size={14} style={{ verticalAlign:"-2px", marginRight:6, color:"var(--accent)" }} />
            Korea · {level === "province" ? "시도 (17)" : level === "custom" ? "내 데이터" : selProv ? selProv+" 시군구" : "시군구 전체"}
          </span>
          <div className="seg" style={{ marginLeft:6 }}>
            <button className={level==="province"?"on":""} onClick={() => { setLevel("province"); setSelProv(null); }}>시도</button>
            <button className={level==="municipality"?"on":""} onClick={() => setLevel("municipality")}>시군구</button>
            <button className={level==="custom"?"on":""} onClick={() => setLevel("custom")}
              title={hasGeoData ? `${activeDs.short}에 위경도 컬럼 감지됨` : "위경도 컬럼이 있는 데이터셋을 임포트하면 활성화됩니다"}
              style={{ color: hasGeoData ? "var(--accent)" : undefined }}>
              내 데이터{hasGeoData ? " ✦" : ""}
            </button>
          </div>
          <div className="spacer" />
          {level === "municipality" && (
            <select value={selProv||""} onChange={(e) => setSelProv(e.target.value||null)} style={{ ...selStyle, marginRight:6 }}>
              <option value="">전체 시도</option>
              {provList.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
            </select>
          )}
          {level === "custom" ? (
            <div style={{ display:"flex", gap:4, alignItems:"center", flexWrap:"wrap" }}>
              <span style={{ fontSize:10, color:"var(--tx-faint)" }}>위도</span>
              <select value={customLatCol||""} onChange={(e) => setCustomLatCol(e.target.value||null)} style={selStyle}>
                <option value="">— 선택 —</option>
                {allCols.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
              <span style={{ fontSize:10, color:"var(--tx-faint)" }}>경도</span>
              <select value={customLonCol||""} onChange={(e) => setCustomLonCol(e.target.value||null)} style={selStyle}>
                <option value="">— 선택 —</option>
                {allCols.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
              <span style={{ fontSize:10, color:"var(--tx-faint)" }}>값</span>
              <select value={customValCol||""} onChange={(e) => setCustomValCol(e.target.value||null)} style={selStyle}>
                <option value="">없음</option>
                {numCols.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
              <span style={{ fontSize:10, color:"var(--tx-faint)" }}>라벨</span>
              <select value={customLabelCol||""} onChange={(e) => setCustomLabelCol(e.target.value||null)} style={selStyle}>
                <option value="">없음</option>
                {strCols.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
          ) : (
            <div className="seg">
              {metrics.map((x) => <button key={x.k} className={metric===x.k?"on":""} onClick={() => setMetric(x.k)}>{x.label}</button>)}
            </div>
          )}
        </div>
        {geoLoading && <div className="map-note"><Icon name="info" size={12} /> 지도 로딩 중…</div>}
        {!geoLoading && !geoReady && <div className="map-note"><Icon name="info" size={12} /> 지도를 불러올 수 없습니다 (jsDelivr CDN 필요)</div>}
        {level === "province" && geoReady && <div className="map-note" style={{ background:"var(--accent-soft)", borderColor:"var(--accent)" }}><Icon name="bolt" size={12} /> 시도 클릭 → 해당 지역 시군구 드릴다운 · 시군구는 위치 버블로 표시</div>}
        {level === "custom" && geoReady && !customLatCol && <div className="map-note"><Icon name="info" size={12} /> 위도·경도 컬럼을 선택하거나, 위경도가 포함된 데이터를 임포트하세요</div>}
        {level === "custom" && geoReady && customLatCol && customLonCol && !customOption && <div className="map-note"><Icon name="info" size={12} /> 한국 영역(위도 33–39°, 경도 124–132°) 내 좌표가 없습니다</div>}
        <div className="vizcanvas" style={{ padding:0 }}>
          {geoReady && option
            ? <EChart option={option} theme={theme+level+metric+(selProv||"")+(customLatCol||"")+(customValCol||"")} onEvents={onEvents} style={{ height:"100%" }} />
            : <div className="empty"><div className="s">{geoLoading ? "지도 로딩 중…" : "지도를 불러올 수 없습니다"}</div></div>}
        </div>
      </React.Fragment>
    );
  }

  function KoreaPanel() {
    const [level, setLevel] = React.useState("province");
    const [selProv, setSelProv] = React.useState(null);
    const provDs = NODE.datasets.find((d) => d.id === "korea_provinces");
    const munDs  = NODE.datasets.find((d) => d.id === "korea_municipalities");
    const provRows = provDs ? [...provDs.rows].sort((a,b)=>b.pop_man-a.pop_man) : [];
    const munRows  = munDs ? [...munDs.rows] : [];
    const filteredMun = selProv ? munRows.filter((r)=>r.province===selProv) : munRows;
    const sortedMun = [...filteredMun].sort((a,b)=>b.pop_man-a.pop_man).slice(0,30);
    const maxPop = level==="province"
      ? Math.max(...provRows.map((r)=>r.pop_man))
      : Math.max(...sortedMun.map((r)=>r.pop_man));

    return (
      <div className="mappanel">
        <div className="cp-block">
          <div style={{ display:"flex", gap:6, marginBottom:8 }}>
            <div className="seg" style={{ flex:1 }}>
              <button className={level==="province"?"on":""} style={{ flex:1 }} onClick={()=>setLevel("province")}>시도</button>
              <button className={level==="municipality"?"on":""} style={{ flex:1 }} onClick={()=>setLevel("municipality")}>시군구</button>
            </div>
          </div>
          {level === "municipality" && (
            <select value={selProv||""} onChange={(e)=>setSelProv(e.target.value||null)}
              style={{ width:"100%", fontSize:11, background:"var(--bg-2)", color:"var(--tx-mid)",
                border:"1px solid var(--line-strong)", borderRadius:"var(--r-sm)", padding:"4px 6px",
                marginBottom:8, cursor:"pointer" }}>
              <option value="">전체 시도</option>
              {provRows.map((p)=><option key={p.name} value={p.name}>{p.name}</option>)}
            </select>
          )}
          <div className="cp-blocktitle">인구 순위 ({level==="province"?"시도":"시군구"})</div>
          <div className="maprank">
            {(level==="province" ? provRows : sortedMun).map((r,i)=>(
              <div key={r.name} className="mr-row">
                <span className="mr-rank mono">{i+1}</span>
                <span className="mr-name" style={{ fontSize:11 }}>{r.name}</span>
                <span className="mr-bar"><span style={{ width:(r.pop_man/maxPop*100)+"%" }} /></span>
                <span className="mr-val mono">{NODE.fmtNum(r.pop_man,0)}만</span>
              </div>
            ))}
          </div>
        </div>
        {level === "province" && (
          <div className="cp-block">
            <div className="cp-blocktitle">권역별 인구</div>
            {["수도권","영남","충청","호남","강원","제주"].map((reg)=>{
              const total = provRows.filter((r)=>r.region===reg).reduce((s,r)=>s+r.pop_man,0);
              return <div key={reg} className="kv"><span className="k">{reg}</span><span className="v mono">{NODE.fmtNum(total,0)}만명</span></div>;
            })}
          </div>
        )}
        <div className="cp-block">
          <div className="cf-info"><Icon name="bolt" size={14} /><div>시도를 클릭하면 해당 지역으로 드릴다운됩니다. 시군구 뷰에서 시도 필터로 특정 지역만 볼 수 있습니다.</div></div>
        </div>
      </div>
    );
  }

  // ── World Map ────────────────────────────────────────────────────
  function WorldMapCenter() {
    const theme = useStore((s) => s.theme);
    const [metric, setMetric] = React.useState("gdp_bn");
    const [geoW, setGeoW] = React.useState(_worldGeoState);
    const ds = NODE.datasets.find((d) => d.id === "world_gdp");
    const rows = ds ? ds.rows : [];
    const m = WORLD_METRICS.find((x) => x.k === metric);

    React.useEffect(() => {
      if (_worldGeoState === "ok") { setGeoW("ok"); return; }
      if (_worldGeoState === "fail") { setGeoW("fail"); return; }
      let alive = true;
      fetch(WORLD_GEO_URL).then((r) => r.json()).then((gj) => {
        if (!alive) return;
        echarts.registerMap("world", gj);
        _worldGeoState = "ok"; setGeoW("ok");
      }).catch(() => { if (!alive) return; _worldGeoState = "fail"; setGeoW("fail"); });
      return () => { alive = false; };
    }, []);

    const c = Charts.themeColors(); const pal = Charts.palette();
    const vals = rows.map((r) => r[metric]);
    const minV = Math.min(...vals), maxV = Math.max(...vals);

    const visualMap = {
      min: minV, max: maxV, calculable: true, left: 12, bottom: 18, orient: "vertical",
      itemHeight: 130, text: [m.fmt(maxV), m.fmt(minV)], textStyle: { color: c.text, fontSize: 10 },
      inRange: { color: [Charts.resolveVar("--bg-3"), pal[0]] },
    };
    const tooltip = { ...Charts.baseGrid(c).tooltip, trigger: "item",
      formatter: (p) => {
        const row = rows.find((r) => r.country === p.name);
        if (!row) return p.name;
        return `<b>${p.name}</b><br/>GDP: <b>$${NODE.fmtNum(row.gdp_bn, 0)}B</b><br/>Per Capita: <b>$${NODE.fmtNum(row.gdp_pc, 0)}</b><br/>Growth: <b>${row.growth_pct > 0 ? "+" : ""}${row.growth_pct}%</b>`;
      }
    };

    const mapData = rows.map((r) => ({ name: r.country, value: r[metric] }));

    const option = geoW === "ok"
      ? { animation: false, tooltip, visualMap,
          series: [{ type: "map", map: "world", roam: true, scaleLimit: { min: 1, max: 8 },
            data: mapData,
            label: { show: false },
            emphasis: { label: { show: true, color: c.textHi, fontSize: 10 }, itemStyle: { areaColor: pal[0] } },
            itemStyle: { borderColor: c.bg, borderWidth: 0.5 },
            select: { itemStyle: { areaColor: Charts.resolveVar("--accent-hi") } } }] }
      : { animation: false,
          tooltip: { ...Charts.baseGrid(c).tooltip, trigger: "item",
            formatter: (p) => { const r = rows.find((x) => x.country === p.name); return r ? `<b>${r.country}</b><br/>${m.label}: <b>${m.fmt(r[metric])}</b>` : p.name; } },
          geo: { map: "world", roam: true, itemStyle: { areaColor: Charts.resolveVar("--bg-2"), borderColor: c.split }, emphasis: { disabled: true } },
          series: [] };

    return (
      <React.Fragment>
        <div className="phead">
          <span className="ttl" style={{ textTransform: "none", fontSize: "var(--fs-13)", letterSpacing: 0, color: "var(--tx-hi)" }}>
            <Icon name="map" size={14} style={{ verticalAlign: "-2px", marginRight: 6, color: "var(--accent)" }} />World Map · GDP 2023
          </span>
          <div className="seg" style={{ marginLeft: 6 }}>
            {WORLD_METRICS.map((x) => <button key={x.k} className={metric === x.k ? "on" : ""} onClick={() => setMetric(x.k)}>{x.label}</button>)}
          </div>
        </div>
        {geoW === "fail" && <div className="map-note"><Icon name="info" size={12} /> 세계 지도 GeoJSON 로드 실패 (인터넷 연결 확인)</div>}
        {geoW === "idle" && <div className="map-note"><Icon name="info" size={12} /> Loading world boundaries…</div>}
        <div className="vizcanvas" style={{ padding: 0 }}>
          {geoW === "ok"
            ? <EChart option={option} theme={theme + metric + geoW} style={{ height: "100%" }} />
            : geoW === "fail"
              ? <div className="empty"><div className="t">세계 지도를 불러올 수 없습니다</div><div className="s">인터넷 연결이 필요합니다 (CDN: jsdelivr.net)</div></div>
              : <div className="empty"><div className="s">세계 지도 로딩 중…</div></div>}
        </div>
      </React.Fragment>
    );
  }

  function WorldPanel() {
    const ds = NODE.datasets.find((d) => d.id === "world_gdp");
    const rows = ds ? [...ds.rows].sort((a, b) => b.gdp_bn - a.gdp_bn) : [];
    const maxGDP = Math.max(...rows.map((r) => r.gdp_bn));
    const regions = [...new Set(rows.map((r) => r.region))];
    return (
      <div className="mappanel">
        <div className="cp-block">
          <div className="cp-blocktitle">GDP Ranking · 2023</div>
          <div className="maprank">
            {rows.map((r, i) => (
              <div key={r.country} className="mr-row">
                <span className="mr-rank mono">{i + 1}</span>
                <span className="mr-name" style={{ fontSize: 11 }}>{r.country}</span>
                <span className="mr-bar"><span style={{ width: (r.gdp_bn / maxGDP * 100) + "%" }} /></span>
                <span className="mr-val mono">${Math.round(r.gdp_bn / 100) / 10}T</span>
              </div>
            ))}
          </div>
        </div>
        <div className="cp-block">
          <div className="cp-blocktitle">Regions</div>
          {regions.map((reg) => {
            const rRows = rows.filter((r) => r.region === reg);
            const total = rRows.reduce((s, r) => s + r.gdp_bn, 0);
            return <div key={reg} className="kv"><span className="k">{reg}</span><span className="v mono">${Math.round(total / 100) / 10}T</span></div>;
          })}
        </div>
      </div>
    );
  }

  // ── Root component — tab switcher ───────────────────────────────
  // Rendered as <MapModeRoot /> by window.MapMode so hooks work correctly
  const MAP_TABS = [
    { id: "seoul", label: "Seoul · 구" },
    { id: "korea", label: "Korea · 행정구역" },
    { id: "world", label: "World · GDP" },
  ];

  function MapModeRoot() {
    const [tab, setTab] = React.useState("seoul");
    let center, right, rtitle;
    if (tab === "seoul")  { center = <MapCenter />;      right = <MapPanel />;   rtitle = "Districts"; }
    else if (tab === "korea") { center = <KoreaMapCenter />; right = <KoreaPanel />; rtitle = "Korea"; }
    else                  { center = <WorldMapCenter />; right = <WorldPanel />; rtitle = "Countries"; }

    const tabBar = (
      <div style={{ background: "var(--bg-1)", borderBottom: "1px solid var(--line)",
        display: "flex", gap: 0, padding: "0 10px", flexShrink: 0 }}>
        {MAP_TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding: "7px 14px", fontSize: 12, fontWeight: 600, background: "none", border: "none",
              borderBottom: tab === t.id ? "2px solid var(--accent)" : "2px solid transparent",
              color: tab === t.id ? "var(--accent)" : "var(--tx-lo)", cursor: "pointer", transition: "all .12s" }}>
            {t.label}
          </button>
        ))}
      </div>
    );

    return (
      <div style={{ display: "grid", gridTemplateRows: "auto 1fr", minHeight: 0, overflow: "hidden" }}>
        {tabBar}
        <window.Workspace key={tab} left={<window.DatasetTree />} leftTitle="Data Explorer"
          center={center} right={right} rightTitle={rtitle} />
      </div>
    );
  }

  // window.MapMode must be a hook-free function — hooks live inside MapModeRoot
  window.MapMode = function() { return <MapModeRoot />; };
})();
