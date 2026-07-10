/* NØDE — App shell: top bar, mode rail, workspace (3-panel + resizers), status bar */
(function () {
  const { useStore, actions } = window.Store;
  const Icon = window.Icon;

  const MODES = [
    { id: "data", label: "Data", icon: "data" },
    { id: "clean", label: "Clean", icon: "clean" },
    { id: "sql", label: "SQL", icon: "sql" },
    { id: "visualize", label: "Chart", icon: "visualize" },
    { id: "map", label: "Map", icon: "map" },
    { id: "dashboard", label: "Board", icon: "dashboard" },
    { id: "stats", label: "Stats", icon: "stats" },
    { id: "ml", label: "ML", icon: "ml" },
  ];

  // ── Import modal ──────────────────────────────────────────────────
  function ImportBtn() {
    const [open, setOpen] = React.useState(false);
    const fileRef = React.useRef(null);

    function handleFiles(files) {
      const file = files[0]; if (!file) return;
      const ext = file.name.split(".").pop().toLowerCase();
      if (!["csv", "tsv", "json"].includes(ext)) { alert("CSV / TSV / JSON 파일만 지원합니다."); return; }
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          let rows, columns;
          if (ext === "json") {
            rows = JSON.parse(e.target.result);
            if (!Array.isArray(rows)) throw new Error("JSON must be an array of objects");
          } else {
            const sep = ext === "tsv" ? "\t" : ",";
            const lines = e.target.result.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter(Boolean);
            const parseRow = (line) => {
              const cells = []; let cur = "", inQ = false;
              for (let i = 0; i < line.length; i++) {
                const ch = line[i];
                if (ch === '"' && !inQ) { inQ = true; }
                else if (ch === '"' && inQ && line[i+1] === '"') { cur += '"'; i++; }
                else if (ch === '"' && inQ) { inQ = false; }
                else if (ch === sep && !inQ) { cells.push(cur); cur = ""; }
                else cur += ch;
              }
              cells.push(cur); return cells;
            };
            const headers = parseRow(lines[0]);
            rows = lines.slice(1).map((l) => {
              const vals = parseRow(l);
              const o = {};
              headers.forEach((h, i) => {
                const v = vals[i] !== undefined ? vals[i].trim() : "";
                o[h.trim()] = v === "" ? null : isNaN(v) ? v : +v;
              });
              return o;
            });
          }
          if (!rows.length) { alert("데이터가 비어 있습니다."); return; }
          const sample = rows[0];
          columns = Object.keys(sample).map((k) => {
            const vals = rows.map((r) => r[k]).filter((v) => v != null);
            const isNum = vals.length && vals.every((v) => typeof v === "number" && !isNaN(v));
            return { key: k, label: k, type: isNum ? "float" : "string", role: isNum ? "measure" : "dimension", agg: isNum ? "sum" : null, unit: null, fmt: null };
          });
          const id = "upload_" + Date.now();
          const ds = { id, name: file.name, short: file.name.replace(/\.[^.]+$/, ""), icon: "table", source: "Upload", rows, columns };
          window.Store.actions.registerDataset(ds, { activate: true });
          window.LOG && window.LOG.info("import", "Loaded " + file.name + " — " + rows.length + " rows");
          setOpen(false);
        } catch (err) { alert("파일 파싱 실패: " + err.message); }
      };
      reader.readAsText(file, "UTF-8");
    }

    return (
      <div style={{ position: "relative" }}>
        <button className="btn ghost sm" onClick={() => setOpen(!open)}><Icon name="upload" size={13} /> Import</button>
        {open && (
          <div style={{ position: "fixed", inset: 0, zIndex: 8000 }} onClick={() => setOpen(false)}>
            <div style={{ position: "absolute", top: 48, left: "50%", transform: "translateX(-50%)", width: 340,
              background: "var(--bg-2)", border: "1px solid var(--line-strong)", borderRadius: "var(--r-lg)",
              boxShadow: "var(--shadow-pop)", padding: 24 }} onClick={(e) => e.stopPropagation()}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--tx-hi)", marginBottom: 16 }}>파일 가져오기</div>
              <div style={{ border: "2px dashed var(--line-strong)", borderRadius: "var(--r-md)", padding: "28px 20px",
                textAlign: "center", color: "var(--tx-faint)", cursor: "pointer", transition: "all .15s" }}
                onClick={() => fileRef.current.click()}
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.background = "var(--accent-soft)"; }}
                onDragLeave={(e) => { e.currentTarget.style.borderColor = ""; e.currentTarget.style.background = ""; }}
                onDrop={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = ""; e.currentTarget.style.background = ""; handleFiles(e.dataTransfer.files); }}>
                <Icon name="upload" size={24} style={{ marginBottom: 8, display: "block", margin: "0 auto 10px" }} />
                <div style={{ fontSize: 13, color: "var(--tx-mid)", marginBottom: 4 }}>CSV / TSV / JSON 파일을 드롭하거나 클릭</div>
                <div style={{ fontSize: 11 }}>첫 행을 헤더로 인식 · 숫자 자동 감지</div>
              </div>
              <input ref={fileRef} type="file" accept=".csv,.tsv,.json" style={{ display: "none" }} onChange={(e) => handleFiles(e.target.files)} />
              <button className="btn ghost sm" style={{ marginTop: 14, width: "100%" }} onClick={() => setOpen(false)}>취소</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Export dropdown ───────────────────────────────────────────────
  function ExportBtn() {
    const [open, setOpen] = React.useState(false);
    const activeId = useStore((s) => s.activeId);

    function exportPNG() {
      const ok = window.Charts.downloadPNG("insight-chart");
      if (!ok) alert("내보낼 차트가 없습니다. Chart 모드에서 차트를 먼저 그려주세요.");
      setOpen(false);
      window.LOG && window.LOG.info("export", "PNG exported");
    }
    function exportCSV() {
      const { ds, rows, columns } = window.Store.derive.getActiveData(activeId);
      window.Charts.downloadCSV(rows, columns, ds.short);
      setOpen(false);
      window.LOG && window.LOG.info("export", "CSV exported — " + rows.length + " rows");
    }

    return (
      <div style={{ position: "relative" }}>
        <button className="btn ghost sm" onClick={() => setOpen(!open)}><Icon name="download" size={13} /> Export</button>
        {open && (
          <div style={{ position: "fixed", inset: 0, zIndex: 8000 }} onClick={() => setOpen(false)}>
            <div style={{ position: "absolute", top: 44, right: 140,
              background: "var(--bg-2)", border: "1px solid var(--line-strong)", borderRadius: "var(--r-md)",
              boxShadow: "var(--shadow-pop)", minWidth: 168, overflow: "hidden" }} onClick={(e) => e.stopPropagation()}>
              <div style={{ padding: "6px 0" }}>
                <div style={{ padding: "4px 10px 6px", fontSize: 10, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--tx-faint)" }}>내보내기</div>
                <button className="pi" style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 8, padding: "7px 14px" }} onClick={exportPNG}>
                  <Icon name="image" size={13} /><span>차트 이미지 (PNG)</span>
                </button>
                <button className="pi" style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 8, padding: "7px 14px" }} onClick={exportCSV}>
                  <Icon name="table" size={13} /><span>현재 데이터 (CSV)</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  function TopBar() {
    const theme = useStore((s) => s.theme);
    const tweaks = useStore((s) => s.tweaks);
    const aiOpen = useStore((s) => s.ui.aiOpen);
    return (
      <div className="topbar">
        <div className="brand"><span className="logomark"><Icon name="visualize" size={16} /></span></div>
        <div className="wb-name">
          <span className="k logo-text"><span className="logo-in">in</span><span className="logo-sight">sight</span><span className="logo-an"> Analytics</span></span>
          <span className="v">Seoul Real-Estate Analysis</span>
        </div>
        <div className="topbar-sep" />
        <button className="btn ghost sm"><Icon name="save" /> Save</button>
        <ImportBtn />
        <ExportBtn />
        <div className="topbar-spacer" />
        <button className={"btn sm" + (aiOpen ? " primary" : "")} onClick={() => actions.setUI({ aiOpen: !aiOpen })}>
          <Icon name="ai" /> Ask Insight
        </button>
        <div className="topbar-sep" />
        <button className="iconbtn" title="Tweaks (layout / tone)"
          onClick={() => window.dispatchEvent(new CustomEvent("node-tweaks-toggle"))}>
          <Icon name="sliders" />
        </button>
        <button className="iconbtn" title="Toggle theme" onClick={actions.toggleTheme}>
          <Icon name={theme === "dark" ? "sun" : "moon"} />
        </button>
        <div className="avatar" style={{ width: 26, height: 26, borderRadius: "50%",
          background: "var(--accent)", color: "#1a0f06", display: "flex", alignItems: "center",
          justifyContent: "center", fontSize: 11, fontWeight: 700 }}>JS</div>
      </div>
    );
  }

  function Rail() {
    const mode = useStore((s) => s.mode);
    return (
      <div className="rail">
        {MODES.map((m) => (
          <button key={m.id} className={"rail-item" + (mode === m.id ? " on" : "")}
            onClick={() => { actions.setMode(m.id); window.LOG && window.LOG.info('mode', 'Mode switched to ' + m.id); }} title={m.label}>
            <Icon name={m.icon} />
            <span className="lbl">{m.label}</span>
          </button>
        ))}
        <div className="rail-spacer" />
        <button className="rail-item" title="Help"><Icon name="book" /><span className="lbl">Docs</span></button>
      </div>
    );
  }

  function StatusBar() {
    const { ds, rows } = window.Store.derive.getActiveData(useStore((s) => s.activeId));
    const mode = useStore((s) => s.mode);
    return (
      <div className="statusbar">
        <span className="si"><span className="dot" /> Local engine · DuckDB</span>
        <span className="si mono">{ds.short}</span>
        <span className="si mono">{rows.length.toLocaleString()} rows × {ds.columns.length} cols</span>
        <span className="spacer" />
        <span className="si">{mode.toUpperCase()} workspace</span>
        <span className="si mono">~{(rows.length * ds.columns.length * 0.018).toFixed(1)} KB</span>
        <span className="si">UTF-8</span>
      </div>
    );
  }

  // Generic 3-panel workspace with draggable resizers.
  function Workspace({ left, center, right, leftTitle, rightTitle, leftHead, rightHead }) {
    const ui = useStore((s) => s.ui);
    const tweaks = useStore((s) => s.tweaks);
    const [drag, setDrag] = React.useState(null);

    // tweak-driven layout: swap explorer side / focus hides properties
    let L = left, R = right, LT = leftTitle, RT = rightTitle, LH = leftHead, RH = rightHead;
    if ((tweaks.explorerSide || "left") === "right") {
      [L, R] = [R, L]; [LT, RT] = [RT, LT]; [LH, RH] = [RH, LH];
    }
    if (tweaks.layout === "focus") { R = null; }
    const startResize = (which) => (e) => {
      e.preventDefault();
      const startX = e.clientX;
      const startW = which === "left" ? ui.leftW : ui.rightW;
      setDrag(which);
      const onMove = (ev) => {
        const dx = ev.clientX - startX;
        if (which === "left") actions.setUI({ leftW: Math.max(180, Math.min(420, startW + dx)) });
        else actions.setUI({ rightW: Math.max(220, Math.min(460, startW - dx)) });
      };
      const onUp = () => { setDrag(null); window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
      window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onUp);
    };

    const showLeft = !!L, showRight = !!R;
    const cols = [
      showLeft ? `${ui.leftW}px 5px` : "",
      "1fr",
      showRight ? `5px ${ui.rightW}px` : "",
    ].join(" ").trim();

    return (
      <div className="workspace" style={{ gridTemplateColumns: cols }}>
        {showLeft && (
          <React.Fragment>
            <div className="panel left">
              {LH || (LT && <div className="phead"><span className="ttl">{LT}</span></div>)}
              <div className="pbody">{L}</div>
            </div>
            <div className={"resizer" + (drag === "left" ? " drag" : "")} onMouseDown={startResize("left")} />
          </React.Fragment>
        )}
        <div className="center">{center}</div>
        {showRight && (
          <React.Fragment>
            <div className={"resizer" + (drag === "right" ? " drag" : "")} onMouseDown={startResize("right")} />
            <div className="panel right">
              {RH || (RT && <div className="phead"><span className="ttl">{RT}</span></div>)}
              <div className="pbody">{R}</div>
            </div>
          </React.Fragment>
        )}
      </div>
    );
  }

  Object.assign(window, { TopBar, Rail, StatusBar, Workspace, MODES });
})();
