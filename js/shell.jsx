/* NØDE — App shell: top bar, mode rail, workspace (3-panel + resizers), status bar */
(function () {
  const { useStore, actions } = window.Store;
  const Icon = window.Icon;

  const MODES = [
    { id: "data", label: "Data", icon: "data" },
    { id: "clean", label: "Clean", icon: "clean" },
    { id: "sql", label: "SQL", icon: "sql" },
    { id: "visualize", label: "Chart", icon: "visualize" },
    { id: "pivot", label: "Pivot", icon: "grid" },
    { id: "map", label: "Map", icon: "map" },
    { id: "dashboard", label: "Board", icon: "dashboard" },
    { id: "stats", label: "Stats", icon: "stats" },
    { id: "ml", label: "ML", icon: "ml" },
  ];

  // ── A6: storage durability notice ────────────────────────────────
  // Shown once, and only when the browser did NOT grant persistent storage — i.e. when projects can
  // actually be evicted (Safari ITP's ~7-day wipe, private windows, storage pressure). If persist() was
  // granted there's nothing to warn about, so we stay quiet rather than train the user to dismiss us.
  const STORAGE_NOTICE_KEY = "insight.storageNoticeSeen";

  function StorageNotice({ storage }) {
    const [dismissed, setDismissed] = React.useState(() => {
      try { return localStorage.getItem(STORAGE_NOTICE_KEY) === "1"; } catch (e) { return false; }
    });
    // "unknown" = init hasn't probed yet; don't flash a warning before we know.
    if (dismissed || storage === "granted" || storage === "unknown" || !storage) return null;

    const close = () => {
      setDismissed(true);
      try { localStorage.setItem(STORAGE_NOTICE_KEY, "1"); } catch (e) {}
    };
    return (
      <div className="storage-notice">
        <Icon name="info" size={14} />
        <div className="storage-notice-body">
          <strong>프로젝트는 이 브라우저에만 저장됩니다.</strong>
          <span>
            {storage === "unsupported"
              ? "이 브라우저는 저장소 보존을 지원하지 않습니다 (Safari는 7일간 미방문 시 자동 삭제). "
              : "브라우저가 저장소 보존을 허용하지 않아 용량 부족 시 삭제될 수 있습니다. "}
            중요한 작업은 <b>Projects › Project JSON</b>으로 백업하세요.
          </span>
        </div>
        <button className="iconbtn" onClick={close} title="닫기"><Icon name="x" size={13} /></button>
      </div>
    );
  }

  // ── Project library + save status ────────────────────────────────
  function ProjectControls() {
    const PS = window.ProjectStore;
    const [snapshot, setSnapshot] = React.useState(() => PS.getStatus());
    const [projects, setProjects] = React.useState([]);
    const [open, setOpen] = React.useState(false);
    const [busy, setBusy] = React.useState(false);
    const fileRef = React.useRef(null);

    const refresh = React.useCallback(async () => {
      try { setProjects(await PS.list()); }
      catch (error) { console.error(error); }
    }, []);

    React.useEffect(() => {
      let alive = true;
      const unsubscribe = PS.subscribe((next) => { if (alive) setSnapshot(next); });
      PS.init().then(() => { if (alive) { setSnapshot(PS.getStatus()); refresh(); } })
        .catch((error) => { if (alive) setSnapshot(PS.getStatus()); console.error(error); });
      return () => { alive = false; unsubscribe(); };
    }, []);

    async function run(task, closeAfter) {
      setBusy(true);
      try {
        await task();
        await refresh();
        if (closeAfter !== false) setOpen(false);
      } catch (error) {
        window.UI.toast(error.message || String(error), { type: "error" });
      } finally {
        setBusy(false);
      }
    }

    // C3: native prompt/confirm → window.UI equivalents. Same control flow, just awaited —
    // UI.prompt resolves null on cancel exactly like prompt() returned null.
    async function createProject() {
      const name = await window.UI.prompt("새 프로젝트 이름", { title: "새 프로젝트", defaultValue: "Untitled Project" });
      if (name == null) return;
      run(() => PS.create(name));
    }

    async function renameProject() {
      if (!snapshot.project) return;
      const name = await window.UI.prompt("프로젝트 이름 변경", { title: "이름 변경", defaultValue: snapshot.project.name });
      if (name == null) return;
      run(() => PS.rename(snapshot.project.id, name));
    }

    async function duplicateProject() {
      if (!snapshot.project) return;
      const name = await window.UI.prompt("복제 프로젝트 이름", { title: "프로젝트 복제", defaultValue: snapshot.project.name + " Copy" });
      if (name == null) return;
      run(() => PS.duplicate(snapshot.project.id, name));
    }

    async function removeProject() {
      if (!snapshot.project) return;
      const ok = await window.UI.confirm('"' + snapshot.project.name + '" 프로젝트를 삭제할까요?\n이 브라우저에서는 되돌릴 수 없습니다.',
        { title: "프로젝트 삭제", danger: true, confirmLabel: "삭제" });
      if (!ok) return;
      run(() => PS.remove(snapshot.project.id));
    }

    function importProject(file) {
      if (!file) return;
      run(() => PS.importJSON(file));
      if (fileRef.current) fileRef.current.value = "";
    }

    // P10: build a shareable #p=… link for the current project and copy it to the clipboard.
    // Full project (data included) → deflate → base64url → URL fragment (never hits a server).
    // Safe to open because Formula Columns run through the A1 safe evaluator, not new Function.
    async function shareLink() {
      if (!snapshot.project) return;
      const bundle = await PS.exportBundle(snapshot.project.id);
      const base = location.origin + location.pathname;
      const res = await window.ShareLink.encodeShareLink(base, bundle);
      if (res.tooLarge) {
        await window.UI.alert("이 프로젝트는 공유 링크로 담기엔 너무 큽니다 (" + Math.round(res.chars / 1024) + "KB).\n대신 \"Project JSON\"으로 내보내 파일로 공유하세요.",
          { title: "공유 링크가 너무 큼" });
        return;
      }
      // A4: navigator.clipboard is secure-context-only — absent on an http:// deployment. Fall back to a
      // selectable field and say WHY, so it doesn't read as a bug.
      let copied = false;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(res.url); copied = true; }
      } catch (e) { copied = false; }
      window.LOG && window.LOG.info("share", "link built · " + res.chars + " chars · " + (res.compressed ? "deflate" : "raw") + " · " + (copied ? "copied" : "manual"));
      if (copied) { window.UI.toast("공유 링크를 클립보드에 복사했습니다 · 열면 데이터·분석이 그대로 재현됩니다", { type: "success" }); return; }
      const why = !window.isSecureContext
        ? "자동 복사는 HTTPS에서만 됩니다 (현재 http:// 접속).\n아래 링크를 직접 복사하세요."
        : "자동 복사에 실패했습니다.\n아래 링크를 직접 복사하세요.";
      // prompt() doubled as a "here's text you can select" affordance — UI.prompt keeps that, prefilled.
      await window.UI.prompt(why, { title: "공유 링크", defaultValue: res.url });
    }

    const saveState = snapshot.state || "unsaved";
    const projectName = snapshot.project ? snapshot.project.name : "Loading project…";

    return (
      <React.Fragment>
        <StorageNotice storage={snapshot.storage} />
        <div className="project-switcher">
          <button className="btn ghost sm project-trigger" onClick={() => setOpen(!open)} disabled={busy} title={projectName}>
            <Icon name="db" size={13} /><span>{projectName}</span><Icon name="chevD" size={11} />
          </button>
          {open && (
            <div className="project-overlay" onClick={() => setOpen(false)}>
              <div className="project-menu" onClick={(event) => event.stopPropagation()}>
                <div className="project-menu-head">
                  <div><strong>Projects</strong><span>Local browser library</span></div>
                  <button className="iconbtn" onClick={() => setOpen(false)}><Icon name="x" size={14} /></button>
                </div>
                <div className="project-list">
                  {projects.map((project) => (
                    <button key={project.id} className={"project-item" + (snapshot.project && project.id === snapshot.project.id ? " active" : "")}
                      disabled={busy} onClick={() => run(() => PS.open(project.id))}>
                      <span className="project-item-icon"><Icon name="table" size={13} /></span>
                      <span className="project-item-copy"><strong>{project.name}</strong><small>{new Date(project.updatedAt).toLocaleString()}</small></span>
                      {snapshot.project && project.id === snapshot.project.id && <Icon name="check" size={13} />}
                    </button>
                  ))}
                </div>
                <div className="project-actions">
                  <button className="btn ghost sm" disabled={busy} onClick={createProject}><Icon name="plus" /> New</button>
                  <button className="btn ghost sm" disabled={busy || !snapshot.project} onClick={renameProject}><Icon name="edit" /> Rename</button>
                  <button className="btn ghost sm" disabled={busy || !snapshot.project} onClick={duplicateProject}><Icon name="duplicate" /> Duplicate</button>
                  <button className="btn ghost sm danger" disabled={busy || !snapshot.project} onClick={removeProject}><Icon name="trash" /> Delete</button>
                </div>
                <div className="project-actions backup">
                  <button className="btn ghost sm" disabled={busy || !snapshot.project} onClick={() => run(() => PS.exportJSON(), false)}><Icon name="download" /> Project JSON</button>
                  <button className="btn ghost sm" disabled={busy} onClick={() => fileRef.current.click()}><Icon name="upload" /> Restore JSON</button>
                  <button className="btn ghost sm" disabled={busy || !snapshot.project} onClick={() => run(() => shareLink(), false)}><Icon name="share" /> Share link</button>
                  <input ref={fileRef} type="file" accept=".json,application/json" style={{ display: "none" }} onChange={(event) => importProject(event.target.files[0])} />
                </div>
              </div>
            </div>
          )}
        </div>
        {/* B1: another tab holds this project. Autosave is last-write-wins with no merge, so silence
            here means one side's work vanishes without a trace. Warn instead of pretending. */}
        {snapshot.conflict && (
          <span className={"tab-conflict" + (snapshot.peerSavedAt ? " stale" : "")}
            title={snapshot.peerSavedAt
              ? "다른 탭이 이 프로젝트를 저장했습니다 (" + new Date(snapshot.peerSavedAt).toLocaleTimeString() + ").\n"
                + "이 탭의 화면은 그 변경을 반영하지 않은 상태입니다 — 여기서 저장하면 다른 탭의 작업을 덮어씁니다.\n"
                + "안전하게 하려면: 이 탭을 새로고침해 최신 상태를 불러오세요."
              : "이 프로젝트가 다른 탭 " + snapshot.peerCount + "개에서도 열려 있습니다.\n"
                + "양쪽이 1초마다 자동저장하므로 나중에 저장한 쪽이 상대 작업을 덮어씁니다.\n"
                + "한쪽 탭만 남기고 닫는 것을 권장합니다."}>
            <Icon name="info" size={12} />
            {snapshot.peerSavedAt ? "다른 탭이 저장함" : "다른 탭에서 열림"}
          </span>
        )}
        <button className={"btn ghost sm save-now " + saveState} disabled={busy || saveState === "saving" || !snapshot.initialized}
          onClick={() => run(() => PS.saveNow(), false)} title={snapshot.error || snapshot.label}>
          <span className="save-dot" />
          <Icon name="save" /> {saveState === "saving" ? "Saving…" : "Save now"}
          <span className="save-label">{snapshot.label}</span>
        </button>
      </React.Fragment>
    );
  }

  // ── Import modal ──────────────────────────────────────────────────
  function ImportBtn() {
    const [open, setOpen] = React.useState(false);
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState("");
    const [inspection, setInspection] = React.useState(null);
    const [selected, setSelected] = React.useState({});
    const [activeSheet, setActiveSheet] = React.useState("");
    const [overrides, setOverrides] = React.useState({});
    const lang = useStore((s) => s.tweaks.lang) || "ko";
    const fileRef = React.useRef(null);
    const TYPES = ["boolean", "integer", "float", "datetime", "category", "string"];

    const reset = React.useCallback(() => {
      setInspection(null); setSelected({}); setActiveSheet(""); setOverrides({}); setError("");
      if (fileRef.current) fileRef.current.value = "";
    }, []);

    const handleFiles = React.useCallback(async (files) => {
      const file = files && files[0]; if (!file) return;
      setOpen(true); setBusy(true); setError("");
      try {
        const result = await window.ImportEngine.parseFile(file);
        const available = result.sheets.filter((sheet) => sheet.columnCount > 0);
        const nextSelected = {};
        available.forEach((sheet) => { nextSelected[sheet.name] = true; });
        setInspection(result); setSelected(nextSelected); setActiveSheet(available[0] ? available[0].name : ""); setOverrides({});
      } catch (err) { setError(err.message || String(err)); setInspection(null); }
      finally { setBusy(false); }
    }, []);

    React.useEffect(() => {
      const listener = (event) => { setOpen(true); if (event.detail && event.detail.files) handleFiles(event.detail.files); };
      window.addEventListener("insight-import-open", listener);
      return () => window.removeEventListener("insight-import-open", listener);
    }, [handleFiles]);

    const sheet = inspection && inspection.sheets.find((item) => item.name === activeSheet);
    const selectedSheets = inspection ? inspection.sheets.filter((item) => selected[item.name] && item.columnCount > 0) : [];

    async function importSelected() {
      if (!selectedSheets.length) return;
      setBusy(true); setError("");
      try {
        selectedSheets.forEach((item, index) => {
          const dataset = window.ImportEngine.materialize(item, overrides[item.name] || {});
          actions.registerDataset(dataset, { activate: index === selectedSheets.length - 1 });
          window.LOG && window.LOG.info("import", `Loaded ${dataset.short} — ${dataset.rows.length} rows`);
        });
        if (window.ProjectStore) await window.ProjectStore.saveNow();
        setOpen(false); reset();
      } catch (err) { setError(err.message || String(err)); }
      finally { setBusy(false); }
    }

    return (
      <div>
        <button className="btn ghost sm" onClick={() => { setOpen(true); reset(); }}><Icon name="upload" size={13} /> {window.I18N.t(lang, "import")}</button>
        {open && (
          <div className="import-overlay" onClick={() => { if (!busy) { setOpen(false); reset(); } }}>
            <div className="import-modal" onClick={(event) => event.stopPropagation()}>
              <div className="import-head">
                <div><strong>Import data</strong><span>CSV · TSV · JSON · XLSX</span></div>
                <button className="iconbtn" disabled={busy} onClick={() => { setOpen(false); reset(); }}><Icon name="x" /></button>
              </div>
              {!inspection ? (
                <div className="import-drop" onClick={() => fileRef.current.click()} onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => { event.preventDefault(); handleFiles(event.dataTransfer.files); }}>
                  <Icon name="upload" size={28} /><strong>{busy ? "Inspecting file…" : "Drop a file or click to browse"}</strong>
                  <span>Original strings are preserved before deterministic type inference.</span>
                </div>
              ) : (
                <React.Fragment>
                  <div className="import-filebar"><Icon name="table" /><strong>{inspection.fileName}</strong><span>{inspection.sourceType}</span>
                    <button className="btn ghost sm" disabled={busy} onClick={() => { reset(); fileRef.current.click(); }}>Choose another</button>
                  </div>
                  <div className="import-sheets">
                    {inspection.sheets.map((item) => (
                      <label key={item.name} className={"import-sheet" + (item.name === activeSheet ? " active" : "") + (!item.columnCount ? " disabled" : "")} onClick={() => item.columnCount && setActiveSheet(item.name)}>
                        <input type="checkbox" disabled={!item.columnCount} checked={!!selected[item.name]}
                          onChange={(event) => setSelected((current) => ({ ...current, [item.name]: event.target.checked }))} />
                        <span><strong>{item.name}</strong><small>{item.range || "No range"} · {item.rowCount} rows × {item.columnCount} cols</small></span>
                      </label>
                    ))}
                  </div>
                  {sheet && (
                    <div className="import-preview-wrap">
                      <div className="import-preview-title"><strong>Preview · {sheet.name}</strong><span>First {sheet.preview.length} rows</span></div>
                      <div className="import-preview"><table><thead><tr>
                        {sheet.columns.map((column) => <th key={column.key}><span>{column.label}</span>
                          <select value={(overrides[sheet.name] && overrides[sheet.name][column.key]) || column.type}
                            onChange={(event) => setOverrides((current) => ({ ...current, [sheet.name]: { ...(current[sheet.name] || {}), [column.key]: event.target.value } }))}>
                            {TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                          </select></th>)}
                      </tr></thead><tbody>
                        {sheet.preview.map((row, index) => <tr key={index}>{sheet.columns.map((column) => {
                          const value = row[column.key]; const text = value == null ? "—" : value instanceof Date ? value.toISOString() : String(value);
                          return <td key={column.key} title={text}>{text}</td>;
                        })}</tr>)}
                      </tbody></table></div>
                    </div>
                  )}
                </React.Fragment>
              )}
              {error && <div className="import-error"><Icon name="info" size={13} />{error}</div>}
              <input ref={fileRef} type="file" accept=".csv,.tsv,.json,.xlsx" style={{ display: "none" }} onChange={(event) => handleFiles(event.target.files)} />
              <div className="import-actions">
                <button className="btn ghost sm" disabled={busy} onClick={() => { setOpen(false); reset(); }}>Cancel</button>
                <button className="btn primary sm" disabled={busy || !selectedSheets.length} onClick={importSelected}><Icon name="upload" /> Import {selectedSheets.length ? `${selectedSheets.length} dataset${selectedSheets.length > 1 ? "s" : ""}` : ""}</button>
              </div>
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
    const lang = useStore((s) => s.tweaks.lang) || "ko";

    function exportPNG() {
      const ok = window.Charts.downloadPNG("insight-chart");
      if (!ok) window.UI.toast("내보낼 차트가 없습니다 · Chart 모드에서 차트를 먼저 그려주세요", { type: "warn" });
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
        <button className="btn ghost sm" onClick={() => setOpen(!open)}><Icon name="download" size={13} /> {window.I18N.t(lang, "export")}</button>
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
    const lang = tweaks.lang || "ko";
    const T = (k) => window.I18N.t(lang, k);
    return (
      <div className="topbar">
        <div className="brand"><span className="logomark"><Icon name="visualize" size={16} /></span></div>
        <div className="wb-name">
          <span className="k logo-text"><span className="logo-in">in</span><span className="logo-sight">sight</span><span className="logo-an"> Analytics</span></span>
          <span className="v">Local Analytics Workbench</span>
        </div>
        <div className="topbar-sep" />
        <ProjectControls />
        <ImportBtn />
        <ExportBtn />
        <div className="topbar-spacer" />
        <button className={"btn sm" + (aiOpen ? " primary" : "")} onClick={() => actions.setUI({ aiOpen: !aiOpen })}>
          <Icon name="ai" /> {T("askInsight")}
        </button>
        <div className="topbar-sep" />
        <button className="iconbtn lang-toggle" title={T("langToggle")} aria-label={T("langToggle")}
          style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.02em" }}
          onClick={() => actions.setTweak({ lang: lang === "ko" ? "en" : "ko" })}>
          {lang === "ko" ? "EN" : "한"}
        </button>
        <button className="iconbtn" title={T("tweaks")}
          onClick={() => window.dispatchEvent(new CustomEvent("node-tweaks-toggle"))}>
          <Icon name="sliders" />
        </button>
        <button className="iconbtn" title={T("themeToggle")} onClick={actions.toggleTheme}>
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
    const lang = useStore((s) => s.tweaks.lang) || "ko";
    const T = (k) => window.I18N.t(lang, k);
    return (
      <div className="rail">
        {MODES.map((m) => (
          <button key={m.id} className={"rail-item" + (mode === m.id ? " on" : "")}
            onClick={() => { actions.setMode(m.id); window.LOG && window.LOG.info('mode', 'Mode switched to ' + m.id); }} title={T(m.id)}>
            <Icon name={m.icon} />
            <span className="lbl">{T(m.id)}</span>
          </button>
        ))}
        <div className="rail-spacer" />
        <button className="rail-item" title={T("docs")}><Icon name="book" /><span className="lbl">{T("docs")}</span></button>
      </div>
    );
  }

  function StatusBar() {
    const { ds, rows } = window.Store.derive.getActiveData(useStore((s) => s.activeId));
    const mode = useStore((s) => s.mode);
    return (
      <div className="statusbar">
        <span className="si"><span className="dot" /> Local engine · {window.DuckDB && window.DuckDB.status === "ready" ? "DuckDB-WASM" : "in-browser JS"}</span>
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

  // Shared sheet/worksheet tab bar (PLAN §12 F5). VizTabs / PivotTabs / DashTabs were three near-identical
  // ~40-line components — same markup, same dbl-click-rename with editId/draft/commit, same dup/close/add
  // buttons — differing only in the store selectors, action names, icon, Korean tooltips, and whether a
  // per-sheet dataset picker trails the row. Parameterize all of that; callers pass their sheets/active,
  // handlers, and an optional `tail` (the dataset picker JSX; dashboards have none).
  function SheetTabs({ sheets, active, icon, onActivate, onRename, onDuplicate, onRemove, onAdd, dupTitle, closeTitle, addTitle, tail }) {
    const [editId, setEditId] = React.useState(null);
    const [draft, setDraft] = React.useState("");
    const commit = () => { if (editId) onRename(editId, draft.trim()); setEditId(null); };
    return (
      <div className="viz-tabs">
        <div className="viz-tabs-scroll">
          {sheets.map((sh) => (
            <div key={sh.id} className={"viz-tab" + (sh.id === active ? " on" : "")}
              onClick={() => sh.id !== active && onActivate(sh.id)}
              onDoubleClick={() => { setEditId(sh.id); setDraft(sh.name); }}
              title="더블클릭해서 이름 변경">
              <Icon name={icon} size={12} style={{ opacity: 0.6 }} />
              {editId === sh.id
                ? <input autoFocus className="viz-tab-edit" value={draft}
                    onChange={(e) => setDraft(e.target.value)} onBlur={commit}
                    onKeyDown={(e) => { if (e.key === "Enter") commit(); else if (e.key === "Escape") setEditId(null); }}
                    onClick={(e) => e.stopPropagation()} />
                : <span className="viz-tab-nm">{sh.name}</span>}
              {sh.id === active && (
                <span className="viz-tab-dup" title={dupTitle}
                  onClick={(e) => { e.stopPropagation(); onDuplicate(sh.id); }}><Icon name="duplicate" size={11} /></span>
              )}
              {sheets.length > 1 && (
                <span className="viz-tab-x" title={closeTitle}
                  onClick={(e) => { e.stopPropagation(); onRemove(sh.id); }}><Icon name="x" size={11} /></span>
              )}
            </div>
          ))}
          <button className="viz-tab-add" title={addTitle} onClick={onAdd}><Icon name="plus" size={13} /></button>
        </div>
        {tail || null}
      </div>
    );
  }

  Object.assign(window, { TopBar, Rail, StatusBar, Workspace, MODES, SheetTabs });
})();
