/* NØDE — Settings panel: layout / sidebar / tone / density (accent fixed to brand orange) */
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

  function TweaksPanel() {
    const tw = useStore((s) => s.tweaks);
    const lang = tw.lang || "ko";
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
          <Icon name="sliders" size={14} /><span>{window.I18N.t(lang, "tweaks")}</span>
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
        </div>
        <div className="tweaks-foot">Changes apply live across every workspace.</div>
      </div>,
      document.body
    );
  }

  window.TweaksPanel = TweaksPanel;
})();
