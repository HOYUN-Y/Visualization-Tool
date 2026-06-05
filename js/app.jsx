/* NØDE — root app */
(function () {
  const { useStore, actions, derive } = window.Store;
  const Icon = window.Icon;

  function ModePlaceholder({ icon, title, desc }) {
    return (
      <div className="empty" style={{ gap: 14 }}>
        <div style={{ width: 56, height: 56, borderRadius: 14, background: "var(--bg-1)", border: "1px solid var(--line)",
          display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)" }}>
          <Icon name={icon} size={26} />
        </div>
        <div className="t" style={{ fontSize: 15, color: "var(--tx-hi)", fontWeight: 600 }}>{title}</div>
        <div className="s">{desc}</div>
        <span className="badge" style={{ marginTop: 4 }}><span className="dot" style={{ background: "var(--warn)" }} /> In this build iteration</span>
      </div>
    );
  }

  function App() {
    const theme = useStore((s) => s.theme);
    const mode = useStore((s) => s.mode);
    const tw = useStore((s) => s.tweaks);
    React.useEffect(() => {
      const r = document.documentElement;
      r.setAttribute("data-theme", theme);
      r.setAttribute("data-tone", tw.tone || "cool");
      r.setAttribute("data-density", tw.density || "compact");
      r.setAttribute("data-sidebar", tw.sidebar || "labeled");
      r.setAttribute("data-accent", tw.accent || "orange");
    }, [theme, tw]);

    let content;
    if (mode === "data") {
      content = <window.Workspace left={<window.DatasetTree />} leftTitle="Data Explorer"
        center={<window.DataCenter />} right={<window.ColumnProfile />} rightTitle="Column Profile" />;
    } else if (mode === "clean" && window.CleanMode) {
      content = window.CleanMode();
    } else if (mode === "sql" && window.SqlMode) {
      content = window.SqlMode();
    } else if (mode === "visualize" && window.VizMode) {
      content = window.VizMode();
    } else if (mode === "map" && window.MapMode) {
      content = window.MapMode();
    } else if (mode === "dashboard" && window.DashMode) {
      content = window.DashMode();
    } else if (mode === "ml" && window.MlMode) {
      content = window.MlMode();
    } else if (mode === "stats" && window.StatsMode) {
      content = window.StatsMode();
    } else {
      const meta = {
        stats: ["stats", "Statistical Analysis", "Loading…"],
      }[mode] || ["data", "Module", ""];
      content = <window.Workspace left={<window.DatasetTree />} leftTitle="Data Explorer"
        center={<ModePlaceholder icon={meta[0]} title={meta[1]} desc={meta[2]} />} />;
    }

    return (
      <div className="app">
        <window.TopBar />
        <div className="body">
          <window.Rail />
          {content}
        </div>
        <window.StatusBar />
        {window.TweaksPanel && <window.TweaksPanel />}
        {window.AIDrawer && <window.AIDrawer />}
      </div>
    );
  }

  const root = ReactDOM.createRoot(document.getElementById("root"));
  root.render(<App />);
})();
