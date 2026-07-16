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
        <button className="btn ghost sm" style={{ marginTop: 6 }} onClick={() => actions.setMode("data")}><Icon name="table" size={12} /> 데이터 화면으로</button>
      </div>
    );
  }

  // Global error boundary — a render crash in one mode must not white-screen the app.
  class ErrorBoundary extends React.Component {
    constructor(props) { super(props); this.state = { err: null }; }
    static getDerivedStateFromError(err) { return { err }; }
    componentDidCatch(err) {
      if (window.LOG && window.LOG.error) window.LOG.error("app", "render crash: " + (err && err.message), { mode: this.props.mode });
      // If an ML result render crashed, clear the stored result so "다시 시도" works and the bad
      // result isn't autosaved (persisted `ui.ml.result` would re-crash on reload → mode locked).
      try { if (this.props.mode === "ml") actions.setUI({ ml: { ...(window.Store.getState().ui.ml || {}), result: null } }); } catch (e) {}
    }
    render() {
      if (this.state.err) {
        return (
          <div className="empty" style={{ gap: 12, padding: 32 }}>
            <Icon name="info" size={26} />
            <div className="t" style={{ color: "var(--tx-hi)", fontWeight: 600 }}>이 화면을 표시하는 중 오류가 발생했습니다</div>
            <div className="s" style={{ maxWidth: 460 }}>{String((this.state.err && this.state.err.message) || this.state.err)}</div>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button className="btn sm" onClick={() => this.setState({ err: null })}>다시 시도</button>
              <button className="btn ghost sm" onClick={() => actions.setMode("data")}>데이터 화면으로</button>
            </div>
          </div>
        );
      }
      return this.props.children;
    }
  }

  function App() {
    const theme = useStore((s) => s.theme);
    const mode = useStore((s) => s.mode);
    const tw = useStore((s) => s.tweaks);
    React.useEffect(() => {
      const r = document.documentElement;
      r.setAttribute("data-theme", theme);
      r.setAttribute("lang", tw.lang || "ko");
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
      // Render modes as ELEMENTS, not function calls — each mode owns its hook scope so its
      // hooks aren't counted as App's. Rendering window.XMode() inline made a mode's top-level
      // useStore(lang) shift App's hook count on mode switch → "Rendered more hooks" crash that
      // ErrorBoundary couldn't catch (it wraps content, not App). Elements also let ErrorBoundary
      // actually catch a mode crash. (FOLLOWUP P0 / C5)
      content = <window.CleanMode />;
    } else if (mode === "sql" && window.SqlMode) {
      content = <window.SqlMode />;
    } else if (mode === "visualize" && window.VizMode) {
      content = <window.VizMode />;
    } else if (mode === "pivot" && window.PivotMode) {
      content = <window.PivotMode />;
    } else if (mode === "map" && window.MapMode) {
      content = <window.MapMode />;
    } else if (mode === "dashboard" && window.DashMode) {
      content = <window.DashMode />;
    } else if (mode === "ml" && window.MlMode) {
      content = <window.MlMode />;
    } else if (mode === "stats" && window.StatsMode) {
      content = <window.StatsMode />;
    } else {
      const meta = {
        stats: ["stats", "통계 분석", "모듈을 불러오는 중입니다…"],
      }[mode] || ["data", "모듈을 불러오는 중", "잠시 후에도 이 화면이 보이면 데이터 화면으로 이동해 주세요."];
      content = <window.Workspace left={<window.DatasetTree />} leftTitle="Data Explorer"
        center={<ModePlaceholder icon={meta[0]} title={meta[1]} desc={meta[2]} />} />;
    }

    return (
      <div className="app">
        <window.TopBar />
        <div className="body">
          <window.Rail />
          <ErrorBoundary key={mode} mode={mode}>{content}</ErrorBoundary>
        </div>
        <window.StatusBar />
        {window.TweaksPanel && <window.TweaksPanel />}
        {window.AIDrawer && <window.AIDrawer />}
        {window.CombineModal && <window.CombineModal />}
      </div>
    );
  }

  // P10: if the page was opened with a #p=… share link, decode it into a project and import it.
  // Runs before/around the first render; importJSON validates the bundle (schemaVersion, ids) and
  // activates it, and the store subscription re-renders. We strip the hash so a reload doesn't
  // re-import, and so the (potentially huge) fragment isn't left in the address bar.
  async function maybeImportShareLink() {
    try {
      if (!window.ShareLink || !location.hash || location.hash.indexOf("p=") < 0) return;
      const bundle = await window.ShareLink.decodeShareFragmentAsync(location.hash);
      if (!bundle) return;
      // clear the fragment first (avoid re-import on reload) without adding a history entry
      try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { location.hash = ""; }
      await window.ProjectStore.importJSON(bundle);
      window.LOG && window.LOG.info("share", "imported project from share link");
    } catch (e) {
      console.error("share link import failed", e);
      alert("공유 링크를 열지 못했습니다: " + (e.message || e));
    }
  }
  maybeImportShareLink();

  const root = ReactDOM.createRoot(document.getElementById("root"));
  root.render(<App />);
})();
