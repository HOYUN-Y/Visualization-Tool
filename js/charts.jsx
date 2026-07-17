/* NØDE — ECharts wrapper + theme color resolution */
(function () {
  // resolve a CSS custom property (possibly oklch) to an rgb/rgba string.
  // ECharts renders to <canvas>; if the browser's canvas can't parse oklch()
  // every colour would fall back to black and the whole chart goes invisible on
  // dark backgrounds. So convert oklch → sRGB in JS (Björn Ottosson's matrices),
  // independent of canvas colour-space support; other formats go through canvas.
  const _cache = {};
  function oklchToRgb(L, C, H, A) {
    const hr = (H * Math.PI) / 180;
    const a = C * Math.cos(hr), b = C * Math.sin(hr);
    const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
    const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
    const lin = [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
    ];
    const g = (x) => { const v = x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055; return Math.round(Math.min(1, Math.max(0, v)) * 255); };
    const [r, gg, bb] = lin.map(g);
    return A != null && A < 1 ? `rgba(${r},${gg},${bb},${A})` : `rgb(${r},${gg},${bb})`;
  }
  function resolveVar(name) {
    const key = name + "|" + document.documentElement.getAttribute("data-theme");
    if (_cache[key]) return _cache[key];
    const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    let out = raw || "#888888";
    const ok = raw.match(/oklch\(\s*([\d.]+%?)\s+([\d.]+%?)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\s*\)/i);
    if (ok) {
      const pct = (v) => v.endsWith("%") ? parseFloat(v) / 100 : parseFloat(v);
      const L = pct(ok[1]);
      const C = ok[2].endsWith("%") ? parseFloat(ok[2]) / 100 * 0.4 : parseFloat(ok[2]);
      const H = parseFloat(ok[3]);
      const A = ok[4] != null ? pct(ok[4]) : 1;
      try { out = oklchToRgb(L, C, H, A); } catch (e) {}
    } else if (raw) {
      try {
        const c = document.createElement("canvas"); c.width = c.height = 1;
        const ctx = c.getContext("2d"); ctx.fillStyle = "#000"; ctx.fillStyle = raw; ctx.fillRect(0, 0, 1, 1);
        const d = ctx.getImageData(0, 0, 1, 1).data; out = `rgb(${d[0]},${d[1]},${d[2]})`;
      } catch (e) {}
    }
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

  function EChart({ option, onEvents, style, className, theme, group, onInst }) {
    const ref = React.useRef(null);
    const inst = React.useRef(null);
    React.useEffect(() => {
      inst.current = echarts.init(ref.current, null, { renderer: "canvas" });
      if (group) inst.current.group = group;
      Charts.lastInst = inst.current;
      // C4: let the owner capture *this* instance so export can target it
      // explicitly instead of relying on the global `lastInst` (which any
      // other EChart mount clobbers — wrong chart exported in dashboards /
      // right after a mode/chart switch).
      if (onInst) onInst(inst.current);
      const ro = new ResizeObserver(() => inst.current && inst.current.resize());
      ro.observe(ref.current);
      return () => { ro.disconnect(); if (onInst) onInst(null); inst.current && inst.current.dispose(); if (Charts.lastInst === inst.current) Charts.lastInst = null; };
    }, []);
    React.useEffect(() => {
      if (!inst.current) return;
      Charts.lastInst = inst.current;
      // Enforce animation:false HERE, at the one setOption every chart in the app passes through
      // (PLAN §12 F4). The rule (README §개발 규칙 3) is a blanket "no animation" — animating charts
      // capture blank in iframe/Preview/screenshot contexts. It used to be re-declared by hand at ~18
      // sites because setOption(_, true) replaces wholesale, so any option not spread from baseGrid had
      // to repeat it — and a new chart that forgot would silently regress. Overriding it centrally makes
      // that impossible; the per-site copies are now redundant (harmless). No chart sets animation:true.
      inst.current.setOption({ ...option, animation: false }, true);
      if (onEvents) {
        inst.current.off("click");
        for (const ev in onEvents) { inst.current.off(ev); inst.current.on(ev, onEvents[ev]); }
      }
    }, [option, theme]);
    return <div ref={ref} className={className} style={{ width: "100%", height: "100%", ...style }} />;
  }

  // ── Export helpers ───────────────────────────────────────────────
  // `inst` (optional, last arg) lets a caller export a *specific* chart.
  // When omitted we fall back to the global last-rendered instance
  // (backward compatible). See C4 in docs/FOLLOWUP_PROPOSALS.md.
  function downloadPNG(filename, background, inst) {
    inst = inst || Charts.lastInst;
    if (!inst) return false;
    try {
      const opt = inst.getOption ? inst.getOption() : null;
      const bg = background !== undefined ? background : ((opt && opt.backgroundColor) || resolveVar("--bg-1"));
      const url = inst.getDataURL({ type: "png", pixelRatio: 2, backgroundColor: bg });
      const a = document.createElement("a");
      a.href = url; a.download = (filename || "chart") + ".png";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      return true;
    } catch (e) { window.LOG && window.LOG.error && window.LOG.error("export", "PNG failed: " + e.message); return false; }
  }

  // Why the clipboard is (un)available, so callers can explain the failure instead of just going quiet.
  // The async Clipboard API is secure-context-only: it exists on https:// and localhost, but NOT on a
  // plain http:// deployment — where `navigator.clipboard` is simply undefined. Detected at runtime so
  // the same build behaves correctly on http today and https later.
  //   "ready"       — clipboard usable
  //   "insecure"    — page is http:// (not localhost); the API requires HTTPS
  //   "unsupported" — secure context but the browser lacks Clipboard/ClipboardItem
  function clipboardSupport() {
    const hasApi = !!(navigator.clipboard && typeof window.ClipboardItem !== "undefined");
    if (hasApi) return { ok: true, reason: "ready" };
    if (!window.isSecureContext) return { ok: false, reason: "insecure" };
    return { ok: false, reason: "unsupported" };
  }

  // Copy the chart to the clipboard as a PNG image (paste straight into PowerPoint/Slides).
  // Resolves false on any failure; callers should use clipboardSupport() to explain why.
  function copyPNG(background, inst) {
    inst = inst || Charts.lastInst;
    if (!inst || !clipboardSupport().ok) return Promise.resolve(false);
    try {
      const opt = inst.getOption ? inst.getOption() : null;
      const bg = background !== undefined ? background : ((opt && opt.backgroundColor) || resolveVar("--bg-1"));
      const url = inst.getDataURL({ type: "png", pixelRatio: 2, backgroundColor: bg });
      return fetch(url).then((r) => r.blob())
        .then((blob) => navigator.clipboard.write([new window.ClipboardItem({ "image/png": blob })]).then(() => true))
        .catch((e) => { window.LOG && window.LOG.error && window.LOG.error("export", "copy failed: " + e.message); return false; });
    } catch (e) { return Promise.resolve(false); }
  }

  // Vector SVG export — re-render the current option with the SVG renderer offscreen.
  function downloadSVG(filename, background, inst) {
    inst = inst || Charts.lastInst;
    if (!inst || typeof echarts === "undefined") return false;
    let svgInst = null, div = null;
    try {
      const opt = inst.getOption();
      const w = inst.getWidth() || 800, h = inst.getHeight() || 500;
      div = document.createElement("div");
      div.style.cssText = "position:absolute;left:-99999px;top:0;width:" + w + "px;height:" + h + "px;";
      document.body.appendChild(div);
      svgInst = echarts.init(div, null, { renderer: "svg" });
      const bg = background !== undefined ? background : ((opt && opt.backgroundColor) || "transparent");
      svgInst.setOption({ ...opt, backgroundColor: bg });
      let svg = svgInst.renderToSVGString ? svgInst.renderToSVGString() : null;
      if (!svg) { const u = svgInst.getDataURL({ type: "svg" }); svg = decodeURIComponent((u.split(",")[1] || "").replace(/^base64,/, "")); }
      const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = (filename || "chart") + ".svg";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return true;
    } catch (e) { window.LOG && window.LOG.error && window.LOG.error("export", "SVG failed: " + e.message); return false; }
    finally { if (svgInst) svgInst.dispose(); if (div && div.parentNode) div.parentNode.removeChild(div); }
  }

  function downloadCSV(rows, columns, filename) {
    if (!rows || !rows.length) return false;
    const cols = columns || Object.keys(rows[0]).filter((k) => k !== "__rid").map((k) => ({ key: k, label: k }));
    const header = cols.map((c) => JSON.stringify(c.label)).join(",");
    const body = rows.map((r) => cols.map((c) => {
      const v = r[c.key]; if (v == null) return "";
      return typeof v === "string" ? JSON.stringify(v) : v;
    }).join(",")).join("\n");
    const blob = new Blob([header + "\n" + body], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = (filename || "data") + ".csv";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  }

  window.Charts = { resolveVar, palette, themeColors, baseGrid, EChart, downloadPNG, downloadSVG, copyPNG, clipboardSupport, downloadCSV, lastInst: null };
})();
