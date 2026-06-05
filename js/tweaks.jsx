/* NØDE — Tweaks panel: layout / sidebar / tone / density / accent variations */
(function () {
  const { useStore, actions } = window.Store;
  const Icon = window.Icon;

  function Seg({ label, value, options, onChange }) {
    return (
      <div className="tw-row">
        <span className="tw-label">{label}</span>
        <div className="seg">
          {options.map((o) => (
            <button key={o.v} className={value === o.v ? "on" : ""} onClick={() => onChange(o.v)}>{o.l}</button>
          ))}
        </div>
      </div>
    );
  }

  function Swatches({ value, options, onChange }) {
    return (
      <div className="tw-row">
        <span className="tw-label">Accent</span>
        <div className="tw-swatches">
          {options.map((o) => (
            <button key={o.v} className={"tw-sw" + (value === o.v ? " on" : "")} onClick={() => onChange(o.v)}
              style={{ background: o.c }} title={o.v} />
          ))}
        </div>
      </div>
    );
  }

  function TweaksPanel() {
    const tw = useStore((s) => s.tweaks);
    const [open, setOpen] = React.useState(false);
    React.useEffect(() => {
      const h = () => setOpen((o) => !o);
      window.addEventListener("node-tweaks-toggle", h);
      return () => window.removeEventListener("node-tweaks-toggle", h);
    }, []);
    if (!open) return null;
    return ReactDOM.createPortal(
      <div className="tweaks">
        <div className="tweaks-head">
          <Icon name="sliders" size={14} /><span>Tweaks</span>
          <div style={{ flex: 1 }} />
          <button className="iconbtn" style={{ width: 24, height: 24 }} onClick={() => setOpen(false)}><Icon name="x" size={14} /></button>
        </div>
        <div className="tweaks-body">
          <div className="tw-sect">Layout</div>
          <Seg label="Panel structure" value={tw.layout} onChange={(v) => actions.setTweak({ layout: v })}
            options={[{ v: "standard", l: "Split" }, { v: "focus", l: "Focus" }]} />
          <Seg label="Explorer side" value={tw.explorerSide || "left"} onChange={(v) => actions.setTweak({ explorerSide: v })}
            options={[{ v: "left", l: "Left" }, { v: "right", l: "Right" }]} />

          <div className="tw-sect">Navigation</div>
          <Seg label="Mode rail" value={tw.sidebar} onChange={(v) => actions.setTweak({ sidebar: v })}
            options={[{ v: "labeled", l: "Labeled" }, { v: "compact", l: "Icons" }]} />

          <div className="tw-sect">Visual tone</div>
          <Seg label="Neutrals" value={tw.tone} onChange={(v) => actions.setTweak({ tone: v })}
            options={[{ v: "cool", l: "Cool" }, { v: "warm", l: "Warm" }, { v: "contrast", l: "Contrast" }]} />
          <Seg label="Density" value={tw.density} onChange={(v) => actions.setTweak({ density: v })}
            options={[{ v: "compact", l: "Compact" }, { v: "cozy", l: "Cozy" }]} />
          <Swatches value={tw.accent || "orange"} onChange={(v) => actions.setTweak({ accent: v })}
            options={[{ v: "orange", c: "#f97316" }, { v: "blue", c: "#3b82f6" }, { v: "teal", c: "#14b8a6" }, { v: "violet", c: "#8b5cf6" }]} />
        </div>
        <div className="tweaks-foot">Changes apply live across every workspace.</div>
      </div>,
      document.body
    );
  }

  window.TweaksPanel = TweaksPanel;
})();
