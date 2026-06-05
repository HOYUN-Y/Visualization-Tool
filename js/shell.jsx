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

  function TopBar() {
    const theme = useStore((s) => s.theme);
    const tweaks = useStore((s) => s.tweaks);
    const aiOpen = useStore((s) => s.ui.aiOpen);
    return (
      <div className="topbar">
        <div className="brand"><span className="logomark"><Icon name="visualize" size={16} /></span></div>
        <div className="wb-name">
          <span className="k">Insight · Workbench</span>
          <span className="v">Seoul Real-Estate Analysis</span>
        </div>
        <div className="topbar-sep" />
        <button className="btn ghost sm"><Icon name="save" /> Save</button>
        <button className="btn ghost sm"><Icon name="upload" /> Import</button>
        <button className="btn ghost sm"><Icon name="download" /> Export</button>
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
            onClick={() => actions.setMode(m.id)} title={m.label}>
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
