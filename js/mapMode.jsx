/* NØDE/Insight — Map mode: Seoul choropleth + bubble fallback (offline-safe) */
(function () {
  const { useStore, actions, derive, stat } = window.Store;
  const Icon = window.Icon, NODE = window.NODE, Charts = window.Charts;
  const EChart = Charts.EChart;

  const GEO_URL = "https://raw.githubusercontent.com/southkorea/seoul-maps/master/kostat/2013/json/seoul_municipalities_geo_simple.json";
  const METRICS = [
    { k: "avg_price_per_m2", label: "₩/m²", fmt: (v) => NODE.fmtNum(v, 0) + "만" },
    { k: "avg_price_manwon", label: "Price", fmt: (v) => NODE.fmtWon(v) },
    { k: "txn_count", label: "Txns", fmt: (v) => NODE.fmtNum(v, 0) },
  ];

  let _geoState = "idle"; // idle | ok | fail (module-level cache)

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

  window.MapMode = function () {
    return <window.Workspace left={<window.DatasetTree />} leftTitle="Data Explorer"
      center={<MapCenter />} right={<MapPanel />} rightTitle="Districts" />;
  };
})();
