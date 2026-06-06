/* NØDE/Insight — Map mode: Seoul choropleth + World map */
(function () {
  const { useStore, actions, derive, stat } = window.Store;
  const Icon = window.Icon, NODE = window.NODE, Charts = window.Charts;
  const EChart = Charts.EChart;

  const GEO_URL = "https://raw.githubusercontent.com/southkorea/seoul-maps/master/kostat/2013/json/seoul_municipalities_geo_simple.json";
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

  let _geoState = "idle"; // idle | ok | fail (module-level cache)
  let _worldGeoState = "idle";

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
  function MapModeRoot() {
    const [tab, setTab] = React.useState("seoul");
    const center = tab === "seoul" ? <MapCenter /> : <WorldMapCenter />;
    const right   = tab === "seoul" ? <MapPanel /> : <WorldPanel />;
    const rtitle  = tab === "seoul" ? "Districts" : "Countries";

    const tabBar = (
      <div style={{ background: "var(--bg-1)", borderBottom: "1px solid var(--line)",
        display: "flex", gap: 0, padding: "0 10px", flexShrink: 0 }}>
        {[{ id: "seoul", label: "Seoul · Korea" }, { id: "world", label: "World · GDP" }].map((t) => (
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
