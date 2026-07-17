/* NØDE — Visualization Builder: shelves + Show Me + ECharts canvas */
(function () {
  const { useStore, actions, derive, stat, aggFn } = window.Store;
  const Icon = window.Icon, NODE = window.NODE, Charts = window.Charts;
  const { isNumType, Popover } = window;
  const EChart = Charts.EChart;

  const AGGS = ["sum", "avg", "median", "min", "max", "count", "countd"];

  // Grouped chart type registry
  const CHART_GROUPS = [
    {
      label: "Basic",
      types: [
        { id: "bar",      label: "Bar",       icon: "bar",       need: "1d+1m" },
        { id: "hbar",     label: "H-Bar",     icon: "bar",       need: "1d+1m" },
        { id: "line",     label: "Line",      icon: "line",      need: "1d+1m" },
        { id: "area",     label: "Area",      icon: "area",      need: "1d+1m" },
        { id: "pie",      label: "Pie",       icon: "pie",       need: "1d+1m" },
        { id: "scatter",  label: "Scatter",   icon: "scatter",   need: "2m"    },
        { id: "treemap",  label: "Treemap",   icon: "treemap",   need: "1d+1m" },
        { id: "heatmap",  label: "Heatmap",   icon: "heatmap",   need: "2d+1m" },
      ],
    },
    {
      label: "Advanced",
      types: [
        { id: "bubble",    label: "Bubble",    icon: "bubble",    need: "3m"    },
        { id: "waterfall", label: "Waterfall", icon: "waterfall", need: "1d+1m" },
        { id: "funnel",    label: "Funnel",    icon: "funnel",    need: "1d+1m" },
        { id: "radar",     label: "Radar",     icon: "radar",     need: "1d+2m" },
        { id: "boxplot",   label: "Box",       icon: "boxplot",   need: "1d+1m" },
        { id: "violin",    label: "Violin",    icon: "violin",    need: "1d+1m" },
        { id: "sankey",    label: "Sankey",    icon: "sankey",    need: "2d+1m" },
        { id: "sunburst",  label: "Sunburst",  icon: "sunburst",  need: "2d+1m" },
      ],
    },
    {
      label: "Financial",
      types: [
        { id: "candlestick", label: "Candle",   icon: "candle",     need: "fin" },
        { id: "ohlcvol",     label: "OHLC+Vol", icon: "candle",     need: "fin" },
        { id: "cumreturn",   label: "Return",   icon: "cumreturn",  need: "fin" },
      ],
    },
    {
      label: "Special",
      types: [
        { id: "facet", label: "Facet", icon: "facet", need: "2d+1m" },
      ],
    },
  ];
  const ALL_CHART_TYPES = CHART_GROUPS.flatMap((g) => g.types);

  // expose for double-click add from explorer
  window.VizAddField = (f) => {
    const st = window.Store.getState();
    if (st.mode !== "visualize") return;
    if (f.role === "measure") actions.addToShelf("rows", f);
    else actions.addToShelf("cols", f);
  };

  function readField(e) {
    try { return JSON.parse(e.dataTransfer.getData("application/node-field")); } catch (x) { return null; }
  }

  function Shelf({ label, kind, chips, accept }) {
    const [over, setOver] = React.useState(false);
    const onDrop = (e) => {
      e.preventDefault(); setOver(false);
      const f = readField(e); if (!f) return;
      if (kind === "cols") actions.addToShelf("cols", f);
      else if (kind === "rows") actions.addToShelf("rows", f.role === "measure" ? f : { ...f, agg: "countd" });
      else if (kind === "color") actions.addToShelf("color", f);
    };
    return (
      <div className="shelf">
        <span className="shelf-label">{label}</span>
        <div className={"shelf-well" + (over ? " over" : "")}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)} onDrop={onDrop}>
          {chips}
          {(!chips || (Array.isArray(chips) && chips.length === 0)) && <span className="shelf-hint">{accept}</span>}
        </div>
      </div>
    );
  }

  const MARKS = [["bar", "Bar"], ["line", "Line"], ["area", "Area"]];
  function MeasureChip({ chip, showMark, baseMark }) {
    const [menu, setMenu] = React.useState(null);
    const curMark = chip.mark || baseMark || "bar";
    const markIcon = showMark ? { bar: "bar", line: "line", area: "area" }[curMark] : null;
    return (
      <span className="chip meas">
        <span className="agg" onClick={(e) => setMenu(e.currentTarget.getBoundingClientRect())}>{chip.agg.toUpperCase()}</span>
        {showMark && <span className="mk" title={"mark: " + curMark + (chip.axis ? " · right axis" : "")} onClick={(e) => setMenu(e.currentTarget.getBoundingClientRect())}><Icon name={markIcon} size={11} />{chip.axis ? "R" : ""}</span>}
        {chip.label}
        <span className="x" onClick={() => actions.removeFromShelf("rows", chip.key)}><Icon name="x" size={12} /></span>
        {menu && (
          <Popover anchor={menu} onClose={() => setMenu(null)}>
            <div className="ph">Aggregation</div>
            {AGGS.map((a) => (
              <div key={a} className="pi" onClick={() => { actions.setRowAgg(chip.key, a); setMenu(null); }}>
                {chip.agg === a && <Icon name="check" size={13} />}<span style={{ marginLeft: chip.agg === a ? 0 : 21 }}>{a.toUpperCase()}</span>
              </div>
            ))}
            {showMark && (
              <React.Fragment>
                <div className="sep" />
                <div className="ph">Mark</div>
                {MARKS.map(([mk, lbl]) => (
                  <div key={mk} className="pi" onClick={() => { actions.setRowMark(chip.key, mk); }}>
                    {curMark === mk && <Icon name="check" size={13} />}<span style={{ marginLeft: curMark === mk ? 0 : 21 }}>{lbl}</span>
                  </div>
                ))}
                <div className="sep" />
                <div className="ph">Axis</div>
                {[[0, "Left (primary)"], [1, "Right (secondary)"]].map(([ax, lbl]) => (
                  <div key={ax} className="pi" onClick={() => { actions.setRowAxis(chip.key, ax); }}>
                    {(chip.axis || 0) === ax && <Icon name="check" size={13} />}<span style={{ marginLeft: (chip.axis || 0) === ax ? 0 : 21 }}>{lbl}</span>
                  </div>
                ))}
              </React.Fragment>
            )}
          </Popover>
        )}
      </span>
    );
  }

  // ─── Facet Grid (Small Multiples) ─────────────────────────────────────────
  function FacetGrid({ rows, cols, measures, color, theme }) {
    if (!color || !cols.length || !measures.length) {
      return <div className="empty"><Icon name="facet" /><div className="t">Facet Grid</div><div className="s">Drop a dimension on <b>Columns</b>, a measure on <b>Rows</b>, and a <b>Color</b> dimension to facet by.</div></div>;
    }
    const c = Charts.themeColors();
    const facetVals = [...new Set(rows.map((r) => r[color.key]))].sort().slice(0, 12);
    return (
      <div className="facet-grid">
        {facetVals.map((fv, fi) => {
          const subRows = rows.filter((r) => r[color.key] === fv);
          const opt = window.buildVizOption("bar", { rows: subRows, cols, measures, color: null, sortDesc: false, topN: 8 });
          // make titles/grids more compact
          const compactOpt = {
            ...opt,
            grid: { top: 28, bottom: 24, left: 38, right: 8 },
            title: { text: String(fv), textStyle: { color: c.text, fontSize: 11, fontWeight: 600, fontFamily: "IBM Plex Sans" }, top: 4, left: 6 },
            tooltip: opt.tooltip ? { ...opt.tooltip, confine: true } : undefined,
          };
          return <div key={fv} className="facet-cell"><EChart option={compactOpt} theme={theme} style={{ width: "100%", height: "100%" }} /></div>;
        })}
      </div>
    );
  }

  function rgbToHex(rgb) {
    const m = String(rgb).match(/(\d+),\s*(\d+),\s*(\d+)/);
    if (!m) return "#888888";
    return "#" + [m[1], m[2], m[3]].map((x) => Math.max(0, Math.min(255, +x)).toString(16).padStart(2, "0")).join("");
  }

  // ─── Sheet tab bar (multiple visualizations) ─────────────────────────────
  function VizTabs() {
    const sheets = useStore((s) => s.vizSheets);
    const active = useStore((s) => s.vizActive);
    const globalActive = useStore((s) => s.activeId);
    const activeSheet = sheets.find((x) => x.id === active) || sheets[0];
    const datasets = window.NODE.datasets;
    const tail = (
      <React.Fragment>
        <div className="spacer" />
        <div className="viz-tab-ds" title="이 탭의 데이터셋">
          <Icon name="layers" size={12} style={{ opacity: 0.6 }} />
          <select className="sel" value={activeSheet.datasetId || globalActive}
            onChange={(e) => actions.setSheetDataset(activeSheet.id, e.target.value)}>
            {datasets.map((d) => <option key={d.id} value={d.id}>{d.short}</option>)}
          </select>
        </div>
      </React.Fragment>
    );
    return <window.SheetTabs sheets={sheets} active={active} icon="visualize"
      onActivate={actions.setVizActive} onRename={actions.renameVizSheet}
      onDuplicate={actions.duplicateVizSheet} onRemove={actions.removeVizSheet} onAdd={actions.addVizSheet}
      dupTitle="탭 복제" closeTitle="탭 닫기" addTitle="새 시각화 탭" tail={tail} />;
  }

  // ─── Center panel ─────────────────────────────────────────────────────────
  function VizCenter() {
    const activeId = useStore((s) => s.activeId);
    const vizSheets = useStore((s) => s.vizSheets);
    const vizActive = useStore((s) => s.vizActive);
    const viz = vizSheets.find((x) => x.id === vizActive) || vizSheets[0];
    // Keep this tab's remembered dataset in sync with the active dataset, so the
    // shelves always match the rendered data (switching datasets can't mismatch).
    React.useEffect(() => {
      if (viz && viz.datasetId !== activeId) actions.setSheetDataset(viz.id, activeId);
    }, [activeId, viz && viz.id]);
    const theme = useStore((s) => s.theme);
    const lang = useStore((s) => s.tweaks.lang) || "ko";
    const T = (k) => window.I18N.t(lang, k);
    const { rows, columns } = derive.getActiveData(activeId);
    const measures = viz.rows;
    const colsChips = viz.cols.map((c) => (
      <span key={c.key} className="chip dim">
        <Icon name={c.type === "datetime" ? "trend" : "layers"} size={12} style={{ opacity: 0.6 }} />
        {c.label}
        <span className="x" onClick={() => actions.removeFromShelf("cols", c.key)}><Icon name="x" size={12} /></span>
      </span>
    ));
    const markable = ["bar", "line", "area"].includes(viz.type) && !viz.color;
    const baseMark = viz.type === "line" || viz.type === "area" ? viz.type : "bar";
    const rowChips = measures.map((c) => <MeasureChip key={c.key} chip={c} showMark={markable} baseMark={baseMark} />);

    const option = React.useMemo(() => {
      if (viz.type === "facet") return null;
      return window.applyVizFormat(window.buildVizOption(viz.type, { rows, cols: viz.cols, measures, color: viz.color, sortDesc: viz.sortDesc, topN: viz.topN }), viz.format);
    }, [viz, rows, theme]);

    const title = measures.length && viz.cols.length
      ? `${measures.map((m) => `${m.agg.toUpperCase()}(${m.label})`).join(", ")} by ${viz.cols.map((c) => c.label).join(", ")}`
      : "Untitled visualization";

    const [expOpen, setExpOpen] = React.useState(false);
    const doExport = (kind, bg) => {
      const name = "insight-" + (viz.type || "chart");
      const bgVal = bg === "current" ? undefined : (bg === "white" ? "#ffffff" : "transparent");
      const inst = chartInstRef.current;   // C4: export this chart, not the global last one
      const ok = kind === "svg" ? window.Charts.downloadSVG(name, bgVal, inst) : window.Charts.downloadPNG(name, bgVal, inst);
      if (!ok) window.UI.toast("차트를 먼저 그려주세요 / Draw a chart first", { type: "warn" });
      else window.LOG && window.LOG.info("export", kind.toUpperCase() + " exported · " + bg);
      setExpOpen(false);
    };
    // A4: the async Clipboard API is HTTPS-only. On an http:// deployment it is simply absent, so a
    // bare "copy" would fail silently and read as broken. Explain the actual reason and fall back to
    // the PNG download automatically — the user still gets their image into PowerPoint.
    const doCopy = () => {
      const inst = chartInstRef.current;
      const sup = window.Charts.clipboardSupport();
      if (!sup.ok) {
        const why = sup.reason === "insecure"
          ? "클립보드 복사는 HTTPS에서만 지원됩니다 (현재 http:// 접속).\n대신 PNG로 내려받았습니다 — 파워포인트에 끌어다 넣으세요."
          : "이 브라우저는 클립보드 이미지 복사를 지원하지 않습니다.\n대신 PNG로 내려받았습니다 — 파워포인트에 끌어다 넣으세요.";
        const saved = window.Charts.downloadPNG("insight-" + (viz.type || "chart"), undefined, inst);
        window.UI.toast(saved ? why : "차트를 먼저 그려주세요 / Draw a chart first", { type: saved ? "info" : "warn" });
        window.LOG && window.LOG.info("export", "clipboard unavailable (" + sup.reason + ") → PNG fallback");
        setExpOpen(false);
        return;
      }
      window.Charts.copyPNG(undefined, inst).then((ok) => {
        if (ok) { window.UI.toast("클립보드에 복사됨 · 파워포인트에서 Ctrl+V", { type: "success" }); return; }
        // Secure context but the write still failed (permission denied, transient) — don't strand the user.
        const saved = window.Charts.downloadPNG("insight-" + (viz.type || "chart"), undefined, inst);
        window.UI.toast(saved ? "클립보드 복사에 실패해 PNG로 내려받았습니다" : "차트를 먼저 그려주세요 / Draw a chart first", { type: "warn" });
      });
      setExpOpen(false);
    };
    const doPPTX = () => {
      const inst = chartInstRef.current;   // C4: PPTX from this chart's option
      const opt = inst ? inst.getOption() : (window.Charts.lastInst ? window.Charts.lastInst.getOption() : null);
      const r = window.PptxExport ? window.PptxExport.exportChart(viz, opt, "insight-" + (viz.type || "chart"), (viz.format && viz.format.title && viz.format.title.text) || "") : { ok: false, reason: "no-lib" };
      if (!r.ok) {
        if (r.reason === "no-lib") window.UI.alert("PowerPoint 내보내기 라이브러리(PptxGenJS)가 아직 설치되지 않았습니다.\nvendor/pptxgenjs/pptxgen.bundle.js 를 추가하세요 (vendor/pptxgenjs/README.md 참고).", { title: "라이브러리 없음" });
        else if (r.reason === "unsupported") window.UI.alert("이 차트 종류(캔들스틱·분산형·박스플롯 등)는 PPT 네이티브 차트로 대응되는 형식이 없습니다.\n막대·라인·영역·파이(스택·보조축·콤보 포함)만 가능 — 나머지는 이미지/SVG로 내보내세요.", { title: "PPT 네이티브 미지원" });
        else if (r.reason === "no-chart") window.UI.toast("차트를 먼저 그려주세요", { type: "warn" });
        else window.UI.toast("PPTX 내보내기 실패: " + r.reason, { type: "error" });
      } else window.LOG && window.LOG.info("export", "PPTX exported");
      setExpOpen(false);
    };
    const piStyle = { width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 8, padding: "7px 14px" };
    const saveToDash = () => {
      if (!measures.length) { window.UI.toast("측정값을 먼저 올려주세요 / Add a measure first", { type: "warn" }); return; }
      const st = window.Store.getState();
      const sheet = (st.dash.sheets || []).find((x) => x.id === st.dash.active) || (st.dash.sheets || [])[0];
      const widgets = ((sheet && sheet.widgets) || []).slice();
      widgets.push({ id: "w" + Date.now(), type: "chart", x: 0, y: 99, w: 6, h: 6, title,
        spec: { chartType: viz.type, cols: viz.cols.map((c) => c.key), measures: measures.map((m) => [m.key, m.agg || "sum"]), color: viz.color ? viz.color.key : undefined } });
      actions.setDashWidgets(widgets);
      window.LOG && window.LOG.info("viz", "Saved chart to dashboard");
      window.UI.toast("활성 대시보드에 추가되었습니다 / Added to the dashboard", { type: "success" });
    };

    const chartH = (viz.format && viz.format.height) || null;
    const chartW = (viz.format && viz.format.width) || null;
    // ── Free positioning (drag) for legend or title ──
    const canvasRef = React.useRef(null);
    // C4: capture *this* chart's instance so export targets it explicitly
    // (not the global lastInst, which facet cells / other modes overwrite).
    const chartInstRef = React.useRef(null);
    const [poseTarget, setPoseTarget] = React.useState(null);   // "legend" | "title" | null
    React.useEffect(() => {
      const h = (e) => setPoseTarget((e.detail && e.detail.target) || "legend");
      window.addEventListener("viz-pose", h);
      return () => window.removeEventListener("viz-pose", h);
    }, []);
    const poseFmt = poseTarget ? ((viz.format && viz.format[poseTarget]) || {}) : {};
    const poseFree = !!poseFmt.free;
    const pfx = poseFmt.fx != null ? poseFmt.fx : 0.5, pfy = poseFmt.fy != null ? poseFmt.fy : (poseTarget === "title" ? 0.02 : 0.04);
    React.useEffect(() => { if (poseTarget && !poseFree) setPoseTarget(null); }, [poseFree, poseTarget]);
    const onHandleDown = (e) => {
      e.preventDefault(); e.stopPropagation();
      const rect = canvasRef.current.getBoundingClientRect();
      const hr = e.currentTarget.getBoundingClientRect();
      const offX = e.clientX - hr.left, offY = e.clientY - hr.top;
      const tgt = poseTarget;
      const move = (ev) => {
        const nfx = Math.max(0, Math.min(0.95, (ev.clientX - offX - rect.left) / rect.width));
        const nfy = Math.max(0, Math.min(0.92, (ev.clientY - offY - rect.top) / rect.height));
        actions.setFormat({ [tgt]: { fx: nfx, fy: nfy } });
      };
      const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
      window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
    };
    const showPose = poseTarget && poseFree && (measures.length || viz.cols.length) && viz.type !== "facet";

    // ── Drag-to-resize chart from any edge (PowerPoint-style) ──
    const clampV = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const onEdgeDown = (edge) => (e) => {
      e.preventDefault(); e.stopPropagation();
      const startX = e.clientX, startY = e.clientY;
      const startH = canvasRef.current ? canvasRef.current.clientHeight : 400;
      const startW = canvasRef.current ? canvasRef.current.clientWidth : 600;
      const startOffTop = (viz.format && viz.format.offsetTop) || 0;
      const startOffLeft = (viz.format && viz.format.offsetLeft) || 0;
      const bottomPos = startOffTop + startH;          // keep the bottom edge fixed for the top handle
      const rightPos = startOffLeft + startW;          // keep the right edge fixed for the left handle
      const plotMode = (viz.format && viz.format.resizeMode) === "plot";
      const pi0 = (viz.format && viz.format.plotInset) || {};
      const clamp0 = (v) => Math.max(0, Math.min(600, v));
      document.body.style.cursor = (edge === "left" || edge === "right") ? "ew-resize" : "ns-resize";
      const move = (ev) => {
        const patch = {};
        if (plotMode) {
          const dx = ev.clientX - startX, dy = ev.clientY - startY;
          if (edge === "bottom") patch.plotInset = { bottom: clamp0((pi0.bottom || 0) - dy) };
          else if (edge === "top") patch.plotInset = { top: clamp0((pi0.top || 0) + dy) };
          else if (edge === "right") patch.plotInset = { right: clamp0((pi0.right || 0) - dx) };
          else if (edge === "left") patch.plotInset = { left: clamp0((pi0.left || 0) + dx) };
          actions.setFormat(patch);
          return;
        }
        if (edge === "bottom") patch.height = clampV(startH + (ev.clientY - startY), 180, 1800);
        else if (edge === "top") { const off = clampV(startOffTop + (ev.clientY - startY), 0, bottomPos - 180); patch.offsetTop = off; patch.height = bottomPos - off; }
        else if (edge === "right") patch.width = clampV(startW + (ev.clientX - startX), 260, 3200);
        else if (edge === "left") { const off = clampV(startOffLeft + (ev.clientX - startX), 0, rightPos - 260); patch.offsetLeft = off; patch.width = rightPos - off; }
        actions.setFormat(patch);
      };
      const up = () => { document.body.style.cursor = ""; window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
      window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
    };

    return (
      <React.Fragment>
        <VizTabs />
        <div className="phead">
          <span className="ttl" style={{ textTransform: "none", fontSize: "var(--fs-13)", letterSpacing: 0, color: "var(--tx-hi)" }}>{title}</span>
          <div className="spacer" />
          <div style={{ position: "relative" }}>
            <button className="btn ghost sm" onClick={() => setExpOpen((v) => !v)}><Icon name="download" /> Export</button>
            {expOpen && (
              <React.Fragment>
                <div style={{ position: "fixed", inset: 0, zIndex: 8000 }} onClick={() => setExpOpen(false)} />
                <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 8001, background: "var(--bg-2)", border: "1px solid var(--line-strong)", borderRadius: "var(--r-md)", boxShadow: "var(--shadow-pop)", minWidth: 200, overflow: "hidden", padding: "6px 0" }}>
                  <button className="pi" style={piStyle} onClick={doCopy}><Icon name="duplicate" size={13} /> 클립보드 복사 (PPT에 Ctrl+V)</button>
                  <div className="sep" />
                  <div className="ph" style={{ padding: "3px 12px" }}>PNG 이미지</div>
                  <button className="pi" style={piStyle} onClick={() => doExport("png", "current")}><Icon name="image" size={13} /> 현재 배경</button>
                  <button className="pi" style={piStyle} onClick={() => doExport("png", "white")}><Icon name="image" size={13} /> 흰색 배경</button>
                  <button className="pi" style={piStyle} onClick={() => doExport("png", "transparent")}><Icon name="image" size={13} /> 투명 배경</button>
                  <div className="sep" />
                  <div className="ph" style={{ padding: "3px 12px" }}>SVG · 벡터</div>
                  <button className="pi" style={piStyle} onClick={() => doExport("svg", "current")}><Icon name="visualize" size={13} /> 현재 배경</button>
                  <button className="pi" style={piStyle} onClick={() => doExport("svg", "transparent")}><Icon name="visualize" size={13} /> 투명 배경</button>
                  <div className="sep" />
                  <div className="ph" style={{ padding: "3px 12px" }}>PowerPoint</div>
                  <button className="pi" style={piStyle} onClick={doPPTX}><Icon name="dashboard" size={13} /> .pptx (데이터 편집 가능)</button>
                </div>
              </React.Fragment>
            )}
          </div>
          <button className="btn sm" onClick={saveToDash}><Icon name="save" /> Save to dashboard</button>
        </div>
        <div className="shelfbar">
          <Shelf label={T("vizColumns")} kind="cols" chips={colsChips} accept={T("vizColumnsHint")} />
          <Shelf label={T("vizRows")} kind="rows" chips={rowChips} accept={T("vizRowsHint")} />
        </div>
        <div className="vizcanvas" style={{ display: "flex", flexDirection: "column", alignItems: chartW ? "flex-start" : "stretch", overflow: (chartH || chartW) ? "auto" : "hidden" }}>
          <div className="viz-chart-area" ref={canvasRef} style={{ position: "relative", flex: chartH ? "0 0 auto" : "1 1 auto", height: chartH || "auto", width: chartW || "100%", marginTop: chartH ? ((viz.format && viz.format.offsetTop) || 0) : 0, marginLeft: chartW ? ((viz.format && viz.format.offsetLeft) || 0) : 0, minHeight: 0 }}>
            {viz.type === "facet"
              ? <FacetGrid rows={rows} cols={viz.cols} measures={measures} color={viz.color} theme={theme} />
              : (measures.length || viz.cols.length
                ? <EChart option={option} theme={theme} style={{ height: "100%" }} onInst={(i) => { chartInstRef.current = i; }} />
                : <div className="empty"><Icon name="visualize" /><div className="t">Build a chart</div><div className="s">Drag fields from the Data Explorer onto the <b>Columns</b> and <b>Rows</b> shelves — or double-click a field. Then pick a chart type on the right.</div></div>
              )
            }
            {showPose && (
              <div className="legend-pose-overlay">
                <div className="legend-pose-handle" style={{ left: (pfx * 100) + "%", top: (pfy * 100) + "%" }} onMouseDown={onHandleDown}>
                  <Icon name="move" size={12} /> {poseTarget === "title" ? "타이틀" : "범례"} · 여기를 잡고 드래그
                </div>
                <button className="btn primary sm legend-pose-done" onClick={() => setPoseTarget(null)}><Icon name="check" size={13} /> 이동 완료</button>
              </div>
            )}
            {!showPose && viz.type !== "facet" && (measures.length || viz.cols.length) && (
              <React.Fragment>
                <div className="rh rh-top" onMouseDown={onEdgeDown("top")} title="드래그해서 높이 조절" />
                <div className="rh rh-bottom" onMouseDown={onEdgeDown("bottom")} title="드래그해서 높이 조절" />
                <div className="rh rh-left" onMouseDown={onEdgeDown("left")} title="드래그해서 너비 조절" />
                <div className="rh rh-right" onMouseDown={onEdgeDown("right")} title="드래그해서 너비 조절" />
              </React.Fragment>
            )}
          </div>
        </div>
      </React.Fragment>
    );
  }

  // ─── Format panel (PowerPoint-style: pick a category from a dropdown) ──────
  const FMT_SECTIONS = [
    ["title", "제목 · Title"], ["legend", "범례 · Legend"], ["labels", "값 레이블 · Data labels"],
    ["axis", "축 · Axis (스케일·방향)"], ["grid", "격자·보조선 · Grid lines"], ["bg", "배경 · Background"],
    ["text", "텍스트 · Text"], ["series", "계열 · Series (색·이름)"], ["size", "크기 · Size"],
  ];
  const CIN = { width: 26, height: 22, padding: 0, border: "1px solid var(--line)", borderRadius: 4, background: "none", cursor: "pointer", flexShrink: 0 };
  const rotBtns = (cur, onPick) => [["auto", "자동"], [0, "가로"], [45, "45°"], [90, "세로"]].map(([v, s]) =>
    <button key={String(v)} className={((v === "auto" && cur == null) || cur === v) ? "on" : ""} onClick={() => onPick(v === "auto" ? null : v)}>{s}</button>);

  function FormatPanel({ viz }) {
    const fmt = viz.format || {};
    const setF = actions.setFormat;
    const [sec, setSec] = React.useState("title");
    const [sel, setSel] = React.useState([]);   // selected series keys (Series section)
    const t = fmt.title || {}, lg = fmt.legend || {}, lb = fmt.labels || {}, ax = fmt.axis || {}, g = fmt.grid || {}, tx = fmt.text || {};
    const legendOn = lg.show !== false, labelsOn = !!lb.show, isLine = viz.type === "line" || viz.type === "area";
    const num = (v) => v == null || v === "" ? "" : v;
    return (
      <div className="cp-block fmt-panel">
        <select className="sel fmt-sel" value={sec} onChange={(e) => setSec(e.target.value)}>
          {FMT_SECTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>

        {sec === "title" && (
          <React.Fragment>
            <div className="ctl-row"><span className="fieldlabel" style={{ margin: 0 }}>텍스트</span>
              <input className="inp" placeholder="차트 제목 입력" value={t.text || ""} onChange={(e) => setF({ title: { text: e.target.value } })} style={{ flex: 1, minWidth: 0 }} /></div>
            {t.text && (
              <React.Fragment>
                <div className="ctl-row"><span className="fieldlabel" style={{ margin: 0 }}>세로</span>
                  <div className="seg">{[["top", "위"], ["middle", "중간"], ["bottom", "아래"]].map(([p, s]) => <button key={p} className={(!t.free && (t.v || "top") === p) ? "on" : ""} onClick={() => setF({ title: { v: p, free: false } })}>{s}</button>)}
                    <button className={t.free ? "on" : ""} onClick={() => { setF({ title: { free: true } }); window.dispatchEvent(new CustomEvent("viz-pose", { detail: { target: "title" } })); }}>자유</button></div></div>
                {!t.free && <div className="ctl-row"><span className="fieldlabel" style={{ margin: 0 }}>가로</span>
                  <div className="seg">{[["left", "왼쪽"], ["center", "가운데"], ["right", "오른쪽"]].map(([p, s]) => <button key={p} className={(t.h || "center") === p ? "on" : ""} onClick={() => setF({ title: { h: p } })}>{s}</button>)}</div></div>}
              </React.Fragment>
            )}
          </React.Fragment>
        )}

        {sec === "legend" && (
          <React.Fragment>
            <div className="ctl-row"><span className="fieldlabel" style={{ margin: 0 }}>표시</span>
              <div className="seg"><button className={legendOn ? "on" : ""} onClick={() => setF({ legend: { show: true } })}>On</button><button className={!legendOn ? "on" : ""} onClick={() => setF({ legend: { show: false } })}>Off</button></div></div>
            {legendOn && (
              <React.Fragment>
                <div className="ctl-row"><span className="fieldlabel" style={{ margin: 0 }}>세로</span>
                  <div className="seg">{[["top", "위"], ["middle", "중간"], ["bottom", "아래"]].map(([p, s]) => <button key={p} className={(!lg.free && (lg.v || "top") === p) ? "on" : ""} onClick={() => setF({ legend: { v: p, free: false } })}>{s}</button>)}
                    <button className={lg.free ? "on" : ""} onClick={() => { setF({ legend: { free: true } }); window.dispatchEvent(new CustomEvent("viz-pose", { detail: { target: "legend" } })); }}>자유</button></div></div>
                {!lg.free && <div className="ctl-row"><span className="fieldlabel" style={{ margin: 0 }}>가로</span>
                  <div className="seg">{[["left", "왼쪽"], ["center", "가운데"], ["right", "오른쪽"]].map(([p, s]) => <button key={p} className={(lg.h || "center") === p ? "on" : ""} onClick={() => setF({ legend: { h: p } })}>{s}</button>)}</div></div>}
              </React.Fragment>
            )}
          </React.Fragment>
        )}

        {sec === "labels" && (
          <React.Fragment>
            <div className="ctl-row"><span className="fieldlabel" style={{ margin: 0 }}>표시</span>
              <div className="seg"><button className={labelsOn ? "on" : ""} onClick={() => setF({ labels: { show: true } })}>On</button><button className={!labelsOn ? "on" : ""} onClick={() => setF({ labels: { show: false } })}>Off</button></div></div>
            {labelsOn && (
              <React.Fragment>
                <div className="ctl-row"><span className="fieldlabel" style={{ margin: 0 }}>형식</span>
                  <div className="seg"><button className={(lb.fmt || "full") === "full" ? "on" : ""} onClick={() => setF({ labels: { fmt: "full" } })}>Full</button><button className={lb.fmt === "compact" ? "on" : ""} onClick={() => setF({ labels: { fmt: "compact" } })}>Compact</button></div></div>
                <div className="ctl-row"><span className="fieldlabel" style={{ margin: 0 }}>위치</span>
                  <div className="seg">{[["top", "위"], ["inside", "안쪽"]].map(([p, s]) => <button key={p} className={(lb.pos || "top") === p ? "on" : ""} onClick={() => setF({ labels: { pos: p } })}>{s}</button>)}</div></div>
              </React.Fragment>
            )}
          </React.Fragment>
        )}

        {sec === "axis" && (
          <React.Fragment>
            <div className="ctl-row"><span className="fieldlabel" style={{ margin: 0 }}>Y 범위</span>
              <input className="inp" type="number" placeholder="min" value={num(ax.yMin)} onChange={(e) => setF({ axis: { yMin: e.target.value === "" ? null : +e.target.value } })} style={{ width: 62 }} />
              <input className="inp" type="number" placeholder="max" value={num(ax.yMax)} onChange={(e) => setF({ axis: { yMax: e.target.value === "" ? null : +e.target.value } })} style={{ width: 62 }} /></div>
            <div className="ctl-row"><span className="fieldlabel" style={{ margin: 0 }}>X 범위</span>
              <input className="inp" type="number" placeholder="min" value={num(ax.xMin)} onChange={(e) => setF({ axis: { xMin: e.target.value === "" ? null : +e.target.value } })} style={{ width: 62 }} />
              <input className="inp" type="number" placeholder="max" value={num(ax.xMax)} onChange={(e) => setF({ axis: { xMax: e.target.value === "" ? null : +e.target.value } })} style={{ width: 62 }} /></div>
            <div style={{ fontSize: "var(--fs-11)", color: "var(--tx-faint)", margin: "-2px 0 6px" }}>값(숫자) 축에만 적용 · 비우면 자동. 범위를 좁히면 차이가 극적으로 보입니다.</div>
            <div className="ctl-row"><span className="fieldlabel" style={{ margin: 0 }}>Y 레이블</span><div className="seg">{rotBtns(ax.yLabelRotate, (v) => setF({ axis: { yLabelRotate: v } }))}</div></div>
            <div className="ctl-row"><span className="fieldlabel" style={{ margin: 0 }}>X 레이블</span><div className="seg">{rotBtns(ax.xLabelRotate, (v) => setF({ axis: { xLabelRotate: v } }))}</div></div>
          </React.Fragment>
        )}

        {sec === "grid" && (
          <React.Fragment>
            <div className="ctl-row"><span className="fieldlabel" style={{ margin: 0 }}>표시</span>
              <div className="seg"><button className={fmt.gridlines !== false ? "on" : ""} onClick={() => setF({ gridlines: true })}>On</button><button className={fmt.gridlines === false ? "on" : ""} onClick={() => setF({ gridlines: false })}>Off(투명)</button></div></div>
            {fmt.gridlines !== false && (
              <React.Fragment>
                <div className="ctl-row"><span className="fieldlabel" style={{ margin: 0 }}>굵기</span>
                  <div className="seg">{[1, 2, 3].map((w) => <button key={w} className={(g.width || 1) === w ? "on" : ""} onClick={() => setF({ grid: { width: w } })}>{w}</button>)}</div></div>
                <div className="ctl-row"><span className="fieldlabel" style={{ margin: 0 }}>색상</span>
                  <input type="color" value={g.color || rgbToHex(Charts.themeColors().split)} onChange={(e) => setF({ grid: { color: e.target.value } })} style={CIN} />
                  {g.color && <button className="iconbtn" style={{ width: 20, height: 20 }} onClick={() => setF({ grid: { color: null } })}><Icon name="undo" size={11} /></button>}</div>
                <div className="ctl-row"><span className="fieldlabel" style={{ margin: 0 }}>빈도</span>
                  <div className="seg">{[["auto", "자동"], [3, "3"], [5, "5"], [8, "8"], [10, "10"]].map(([v, s]) => <button key={String(v)} className={((v === "auto" && g.splitNumber == null) || g.splitNumber === v) ? "on" : ""} onClick={() => setF({ grid: { splitNumber: v === "auto" ? null : v } })}>{s}</button>)}</div></div>
              </React.Fragment>
            )}
          </React.Fragment>
        )}

        {sec === "bg" && (
          <React.Fragment>
            <div className="ctl-row"><span className="fieldlabel" style={{ margin: 0 }}>배경색</span>
              <input type="color" value={fmt.background || "#ffffff"} onChange={(e) => setF({ background: e.target.value })} style={CIN} />
              <div className="seg" style={{ marginLeft: 6 }}><button onClick={() => setF({ background: "#ffffff" })}>흰색</button><button className={!fmt.background ? "on" : ""} onClick={() => setF({ background: null })}>기본/투명</button></div></div>
            <div style={{ fontSize: "var(--fs-11)", color: "var(--tx-faint)" }}>PNG로 내보낼 때 이 배경으로 저장됩니다 — 다른 자료 배경에 맞추세요.</div>
          </React.Fragment>
        )}

        {sec === "text" && (
          <React.Fragment>
            <div className="ctl-row"><span className="fieldlabel" style={{ margin: 0 }}>글자색</span>
              <input type="color" value={tx.color || rgbToHex(Charts.themeColors().text)} onChange={(e) => setF({ text: { color: e.target.value } })} style={CIN} />
              {tx.color && <button className="iconbtn" style={{ width: 20, height: 20 }} onClick={() => setF({ text: { color: null } })}><Icon name="undo" size={11} /></button>}</div>
            <div className="ctl-row"><span className="fieldlabel" style={{ margin: 0 }}>크기</span>
              <div className="seg">{[["auto", "자동"], [10, "10"], [12, "12"], [14, "14"], [16, "16"]].map(([v, s]) => <button key={String(v)} className={((v === "auto" && !tx.size) || tx.size === v) ? "on" : ""} onClick={() => setF({ text: { size: v === "auto" ? null : v } })}>{s}</button>)}</div></div>
            <div className="ctl-row"><span className="fieldlabel" style={{ margin: 0 }}>스타일</span>
              <div className="seg"><button className={tx.bold ? "on" : ""} style={{ fontWeight: 700 }} onClick={() => setF({ text: { bold: !tx.bold } })}>B</button><button className={tx.italic ? "on" : ""} style={{ fontStyle: "italic" }} onClick={() => setF({ text: { italic: !tx.italic } })}>I</button></div></div>
          </React.Fragment>
        )}

        {sec === "series" && (() => {
          const isPie = viz.type === "pie";
          const markOf = (m) => m.mark || (viz.type === "line" || viz.type === "area" ? viz.type : "bar");
          const hasBar = !isPie && viz.rows.some((m) => markOf(m) === "bar");
          // series list: pie → slices; else → measures
          let list = [];
          if (isPie) {
            const pd = window.Charts.lastInst ? (((window.Charts.lastInst.getOption().series || [])[0] || {}).data || []) : [];
            list = pd.map((d) => { const nm = (d && d.name != null) ? String(d.name) : String(d); return { key: nm, colorKey: nm, name: nm, mark: "pie" }; });
          } else if (!viz.color) {
            list = viz.rows.map((m) => ({ key: m.label, colorKey: m.label, label: m.label, name: (fmt.seriesNames && fmt.seriesNames[m.label]) || m.label, mark: markOf(m) }));
          }
          const selected = list.filter((it) => sel.includes(it.key));
          const toggle = (k) => setSel((s) => s.includes(k) ? s.filter((x) => x !== k) : [...s, k]);
          const allLine = selected.length > 0 && selected.every((it) => it.mark === "line" || it.mark === "area");
          const someLine = selected.some((it) => it.mark === "line" || it.mark === "area");
          const first = selected[0];
          const firstIdx = first ? list.findIndex((x) => x.key === first.key) : 0;
          const curColor = (first && fmt.colors && fmt.colors[first.colorKey]) || rgbToHex(Charts.palette()[(firstIdx < 0 ? 0 : firstIdx) % 8]);
          const applyEach = (fn) => { const p = {}; selected.forEach((it) => fn(p, it)); return p; };
          return (
            <React.Fragment>
              {hasBar && (
                <div className="ctl-row"><span className="fieldlabel" style={{ margin: 0 }}>막대 간격</span>
                  <div className="seg">{[["10%", "좁게"], ["30%", "보통"], ["50%", "넓게"], ["70%", "아주넓게"]].map(([v, s]) => <button key={v} className={((fmt.bar && fmt.bar.categoryGap) || "30%") === v ? "on" : ""} onClick={() => setF({ bar: { categoryGap: v } })}>{s}</button>)}</div></div>
              )}
              {isPie && (
                <div className="ctl-row"><span className="fieldlabel" style={{ margin: 0 }}>파이 굵기</span>
                  <div className="seg">{[["0%", "꽉참"], ["40%", "도넛"], ["58%", "얇게"]].map(([v, s]) => <button key={v} className={((fmt.pie && fmt.pie.inner) || "40%") === v ? "on" : ""} onClick={() => setF({ pie: { inner: v } })}>{s}</button>)}</div></div>
              )}

              {!list.length ? (
                <div style={{ fontSize: "var(--fs-11)", color: "var(--tx-faint)", marginTop: 8 }}>{viz.color ? "색상(Color) 차원을 쓰면 계열이 색으로 나뉩니다 — 해제 후 이용하세요." : (isPie ? "차트를 먼저 그리면 조각이 나옵니다." : "측정값(Rows)을 올리면 계열이 나옵니다.")}</div>
              ) : (
                <React.Fragment>
                  <div className="fieldlabel" style={{ marginTop: 8, display: "flex", justifyContent: "space-between" }}>
                    <span>계열 선택 (다중)</span>
                    <span><span style={{ color: "var(--accent)", cursor: "pointer" }} onClick={() => setSel(list.map((it) => it.key))}>전체</span> · <span style={{ color: "var(--accent)", cursor: "pointer" }} onClick={() => setSel([])}>해제</span></span>
                  </div>
                  <div className="fmt-serieslist">
                    {list.map((it, i) => { const on = sel.includes(it.key); const sw = (fmt.colors && fmt.colors[it.colorKey]) || rgbToHex(Charts.palette()[i % 8]);
                      return (
                        <div key={it.key} className={"fmt-seriesitem" + (on ? " on" : "")} onClick={() => toggle(it.key)}>
                          <span className={"checkbox" + (on ? " on" : "")}>{on && <Icon name="check" size={11} />}</span>
                          <span className="sw" style={{ background: sw }} />
                          <span className="nm">{it.name}</span>
                          {!isPie && it.mark !== "bar" && <span style={{ fontSize: 9, color: "var(--tx-faint)" }}>{it.mark}</span>}
                        </div>
                      ); })}
                  </div>

                  {selected.length === 0 ? (
                    <div style={{ fontSize: "var(--fs-11)", color: "var(--tx-faint)", marginTop: 6 }}>위에서 계열을 선택하면 설정이 나옵니다.</div>
                  ) : (
                    <React.Fragment>
                      <div className="fieldlabel" style={{ marginTop: 8 }}>{selected.length}개 선택됨 — 설정</div>
                      <div className="ctl-row"><span className="fieldlabel" style={{ margin: 0 }}>색상</span>
                        <input type="color" value={curColor} onChange={(e) => setF({ colors: applyEach((p, it) => { p[it.colorKey] = e.target.value; }) })} style={CIN} />
                        <button className="iconbtn" style={{ width: 20, height: 20 }} title="색 초기화" onClick={() => setF({ colors: applyEach((p, it) => { p[it.colorKey] = null; }) })}><Icon name="undo" size={11} /></button></div>
                      {isPie && (
                        <div className="ctl-row"><span className="fieldlabel" style={{ margin: 0 }}>조각 분리</span>
                          <div className="seg"><button onClick={() => setF({ explode: applyEach((p, it) => { p[it.name] = true; }) })}>분리</button><button onClick={() => setF({ explode: applyEach((p, it) => { p[it.name] = false; }) })}>붙이기</button></div></div>
                      )}
                      {!isPie && selected.length === 1 && (
                        <div className="ctl-row"><span className="fieldlabel" style={{ margin: 0 }}>이름</span>
                          <input className="inp" placeholder={first.label} value={(fmt.seriesNames && fmt.seriesNames[first.label]) || ""} onChange={(e) => setF({ seriesNames: { [first.label]: e.target.value } })} style={{ flex: 1, minWidth: 0 }} /></div>
                      )}
                      {!isPie && allLine && (
                        <div className="ctl-row"><span className="fieldlabel" style={{ margin: 0 }}>선 굵기</span>
                          <div className="seg">{[1, 2, 3, 4].map((w) => <button key={w} className={((fmt.seriesOpts && fmt.seriesOpts[first.label] && fmt.seriesOpts[first.label].lineWidth) || 2) === w ? "on" : ""} onClick={() => setF({ seriesOpts: applyEach((p, it) => { p[it.label] = { lineWidth: w }; }) })}>{w}</button>)}</div></div>
                      )}
                      {!isPie && !allLine && someLine && (
                        <div style={{ fontSize: "var(--fs-11)", color: "var(--tx-faint)", marginTop: 4 }}>선 굵기는 라인 계열만 골랐을 때 편집됩니다 (복합차트에서 라인 하나만 선택).</div>
                      )}
                    </React.Fragment>
                  )}
                </React.Fragment>
              )}
            </React.Fragment>
          );
        })()}

        {sec === "size" && (
          <React.Fragment>
            <div className="ctl-row"><span className="fieldlabel" style={{ margin: 0 }}>리사이즈</span>
              <div className="seg">
                <button className={(fmt.resizeMode || "all") === "all" ? "on" : ""} onClick={() => setF({ resizeMode: "all" })}>전체</button>
                <button className={fmt.resizeMode === "plot" ? "on" : ""} onClick={() => setF({ resizeMode: "plot" })}>플롯만</button>
              </div></div>
            <div style={{ fontSize: "var(--fs-11)", color: "var(--tx-faint)", margin: "-2px 0 6px" }}>전체 = 범례 포함 요소 전체 · 플롯만 = 그래프 영역만(범례·제목 고정)</div>
            <div className="ctl-row"><span className="fieldlabel" style={{ margin: 0 }}>프리셋</span>
              <div className="seg">{[["Auto", null], ["S", 320], ["M", 460], ["L", 640], ["XL", 820]].map(([s, h]) => <button key={s} className={(!fmt.width && (fmt.height || null) === h) ? "on" : ""} onClick={() => setF(h === null ? { height: null, width: null, offsetTop: 0, offsetLeft: 0, plotInset: { top: 0, bottom: 0, left: 0, right: 0 } } : { height: h, offsetTop: 0 })}>{s}</button>)}</div></div>
            <div style={{ fontSize: "var(--fs-11)", color: "var(--tx-faint)" }}>차트 모서리(상·하·좌·우)를 드래그해 크기 조절 · Auto로 초기화</div>
          </React.Fragment>
        )}
      </div>
    );
  }

  // ─── Right panel: Show Me + Marks ─────────────────────────────────────────
  function VizPanel() {
    const vizSheets = useStore((s) => s.vizSheets);
    const vizActive = useStore((s) => s.vizActive);
    const activeId = useStore((s) => s.activeId);
    const viz = vizSheets.find((x) => x.id === vizActive) || vizSheets[0];
    const { columns, rows } = derive.getActiveData(activeId);
    const nDim = viz.cols.length, nMeas = viz.rows.length;
    const hasOHLC = ["open", "high", "low", "close"].every((k) => columns.some((c) => c.key === k));

    const rec = window.ChartAdvisor ? window.ChartAdvisor.recommend(
      viz.cols.map((c) => ({ key: c.key, type: c.type, cardinality: (c.type === "category" || c.type === "string") ? new Set(rows.map((r) => r[c.key])).size : null })),
      viz.rows, { hasOHLC }
    ) : null;

    const valid = (need) => {
      if (need === "fin")    return hasOHLC;
      if (need === "3m")     return nMeas >= 3;
      if (need === "2m")     return nMeas >= 2;
      if (need === "1d+2m")  return nDim >= 1 && nMeas >= 2;
      if (need === "2d+1m")  return nDim >= 2 && nMeas >= 1;
      return nDim >= 1 && nMeas >= 1;
    };
    const [ptab, setPtab] = React.useState("chart");

    return (
      <div className="vizpanel">
        <div className="viz-subtabs">
          <button className={ptab === "chart" ? "on" : ""} onClick={() => setPtab("chart")}><Icon name="visualize" size={13} /> 차트 / Chart</button>
          <button className={ptab === "format" ? "on" : ""} onClick={() => setPtab("format")}><Icon name="sliders" size={13} /> 서식 / Format</button>
        </div>
        {ptab === "chart" && (
        <React.Fragment>
        {rec && rec.type && rec.type !== viz.type && (
          <button className="viz-rec" onClick={() => actions.setViz({ type: rec.type })} title={rec.reason}>
            <Icon name="bolt" size={13} /><span><b>Show Me:</b> {rec.type} — {rec.reason}</span>
          </button>
        )}
        {CHART_GROUPS.map((group) => (
          <div key={group.label} className="cp-block">
            <div className="cp-blocktitle">{group.label}</div>
            <div className="showme">
              {group.types.map((t) => {
                const ok = valid(t.need);
                return (
                  <button key={t.id} className={"sm-tile" + (viz.type === t.id ? " on" : "") + (ok ? "" : " disabled")}
                    disabled={!ok} onClick={() => actions.setViz({ type: t.id })}
                    title={ok ? t.label : `Needs ${t.need}`}>
                    <Icon name={t.icon} size={18} /><span>{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <div className="cp-block">
          <div className="cp-blocktitle">Marks</div>
          <div className="markrow">
            <span className="mark-lbl"><Icon name="layers" size={13} /> Color</span>
            <div className="mark-well" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { const f = readField(e); if (f) actions.addToShelf("color", f); }}>
              {viz.color
                ? <span className="chip dim">{viz.color.label}<span className="x" onClick={() => actions.removeFromShelf("color")}><Icon name="x" size={12} /></span></span>
                : <span className="mark-hint">Drop a dimension</span>}
            </div>
          </div>
        </div>

        <div className="cp-block">
          <div className="cp-blocktitle">Sort & limit</div>
          <div className="ctl-row">
            <span className="fieldlabel" style={{ margin: 0 }}>Order</span>
            <div className="seg">
              <button className={viz.sortDesc ? "on" : ""} onClick={() => actions.setViz({ sortDesc: true })}>Desc</button>
              <button className={!viz.sortDesc ? "on" : ""} onClick={() => actions.setViz({ sortDesc: false })}>Asc</button>
            </div>
          </div>
          <div className="ctl-row">
            <span className="fieldlabel" style={{ margin: 0 }}>Top N</span>
            <div className="seg">
              {[0, 5, 10, 20].map((n) => <button key={n} className={viz.topN === n ? "on" : ""} onClick={() => actions.setViz({ topN: n })}>{n === 0 ? "All" : n}</button>)}
            </div>
          </div>
        </div>

        <div className="cp-block">
          <div className="cp-blocktitle">Quick fields</div>
          <div className="quickfields">
            {columns.map((c) => (
              <div key={c.key} className={"field " + (c.role === "measure" ? "meas" : "dim")} draggable
                onDragStart={(e) => e.dataTransfer.setData("application/node-field", JSON.stringify(c))}
                onDoubleClick={() => window.VizAddField(c)}>
                <span className="ic">{c.type === "datetime" ? "◷" : c.role === "measure" ? "#" : "Abc"}</span>
                <span className="nm">{c.label}</span>
              </div>
            ))}
          </div>
        </div>
        </React.Fragment>
        )}

        {ptab === "format" && <FormatPanel viz={viz} />}
      </div>
    );
  }

  window.VizMode = function () {
    return <window.Workspace left={<window.DatasetTree />} leftTitle="Data Explorer"
      center={<VizCenter />} right={<VizPanel />} rightTitle="Chart & Format" />;
  };
  // buildOption/applyFormat now live in js/vizOptions.js (window.buildVizOption / window.applyVizFormat).
})();
