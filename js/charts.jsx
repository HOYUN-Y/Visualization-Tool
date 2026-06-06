/* NØDE — ECharts wrapper + theme color resolution */
(function () {
  // resolve a CSS custom property (possibly oklch) to an rgb string via canvas
  const _cache = {};
  function resolveVar(name) {
    const key = name + "|" + document.documentElement.getAttribute("data-theme");
    if (_cache[key]) return _cache[key];
    const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    let out = raw;
    try {
      const c = document.createElement("canvas"); c.width = c.height = 1;
      const ctx = c.getContext("2d"); ctx.fillStyle = "#000"; ctx.fillStyle = raw; ctx.fillRect(0, 0, 1, 1);
      const d = ctx.getImageData(0, 0, 1, 1).data; out = `rgb(${d[0]},${d[1]},${d[2]})`;
    } catch (e) {}
    _cache[key] = out; return out;
  }
  function palette() { return Array.from({ length: 8 }, (_, i) => resolveVar(`--cat-${i + 1}`)); }
  function themeColors() {
    return {
      text: resolveVar("--tx-mid"), textHi: resolveVar("--tx-hi"), faint: resolveVar("--tx-faint"),
      axis: resolveVar("--line-strong"), split: resolveVar("--grid-line"),
      bg: resolveVar("--bg-1"), accent: resolveVar("--accent"),
      dim: resolveVar("--dim-color"), meas: resolveVar("--meas-color"),
    };
  }

  function baseGrid(c) {
    return {
      animation: false,
      textStyle: { fontFamily: "IBM Plex Sans, sans-serif", color: c.text },
      grid: { left: 8, right: 14, top: 18, bottom: 6, containLabel: true },
      tooltip: {
        backgroundColor: c.bg, borderColor: resolveVar("--line-strong"), borderWidth: 1,
        textStyle: { color: c.textHi, fontSize: 12, fontFamily: "IBM Plex Sans" },
        confine: true, extraCssText: "box-shadow:0 12px 38px -8px rgba(0,0,0,.5);border-radius:6px;",
      },
    };
  }

  function EChart({ option, onEvents, style, className, theme, group }) {
    const ref = React.useRef(null);
    const inst = React.useRef(null);
    React.useEffect(() => {
      inst.current = echarts.init(ref.current, null, { renderer: "canvas" });
      if (group) inst.current.group = group;
      Charts.lastInst = inst.current;
      const ro = new ResizeObserver(() => inst.current && inst.current.resize());
      ro.observe(ref.current);
      return () => { ro.disconnect(); inst.current && inst.current.dispose(); if (Charts.lastInst === inst.current) Charts.lastInst = null; };
    }, []);
    React.useEffect(() => {
      if (!inst.current) return;
      Charts.lastInst = inst.current;
      inst.current.setOption(option, true);
      if (onEvents) {
        inst.current.off("click");
        for (const ev in onEvents) { inst.current.off(ev); inst.current.on(ev, onEvents[ev]); }
      }
    }, [option, theme]);
    return <div ref={ref} className={className} style={{ width: "100%", height: "100%", ...style }} />;
  }

  // ── Export helpers ───────────────────────────────────────────────
  function downloadPNG(filename) {
    const inst = Charts.lastInst;
    if (!inst) return false;
    try {
      const url = inst.getDataURL({ type: "png", pixelRatio: 2, backgroundColor: resolveVar("--bg-1") });
      const a = document.createElement("a");
      a.href = url; a.download = (filename || "chart") + ".png"; a.click();
      return true;
    } catch (e) { return false; }
  }

  function downloadCSV(rows, columns, filename) {
    if (!rows || !rows.length) return false;
    const cols = columns || Object.keys(rows[0]).map((k) => ({ key: k, label: k }));
    const header = cols.map((c) => JSON.stringify(c.label)).join(",");
    const body = rows.map((r) => cols.map((c) => {
      const v = r[c.key]; if (v == null) return "";
      return typeof v === "string" ? JSON.stringify(v) : v;
    }).join(",")).join("\n");
    const blob = new Blob([header + "\n" + body], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = (filename || "data") + ".csv"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  }

  window.Charts = { resolveVar, palette, themeColors, baseGrid, EChart, downloadPNG, downloadCSV, lastInst: null };
})();
