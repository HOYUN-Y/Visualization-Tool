/* NØDE — shared helpers + dense DataGrid */
(function () {
  const Icon = window.Icon;
  const NODE = window.NODE;

  // ---- type badge ----
  function typeShort(type) {
    switch (type) {
      case "integer": case "float": return { label: type === "integer" ? "123" : "1.2", cls: "t-num" };
      case "datetime": return { label: "DATE", cls: "t-date" };
      case "category": return { label: "ABC", cls: "t-cat" };
      case "boolean": return { label: "T/F", cls: "t-num" };
      default: return { label: "STR", cls: "t-str" };
    }
  }
  const isNumType = (t) => t === "integer" || t === "float";

  // ---- cell formatting ----
  function fmtCell(v, col) {
    if (v == null || v === "") return { text: "null", cls: "cell-null", isNull: true };
    if (isNumType(col.type)) {
      let text;
      if (col.fmt === "won") text = NODE.fmtWon(v);
      else if (col.type === "float") text = (+v).toLocaleString(undefined, { maximumFractionDigits: 1 });
      else text = (+v).toLocaleString();
      return { text, cls: "num", num: +v };
    }
    if (col.type === "category") return { text: String(v), cls: "cat" };
    return { text: String(v), cls: "" };
  }

  // ---- low-cardinality color map (CSS var refs) ----
  function colorMap(rows, key, max = 12) {
    const vals = [...new Set(rows.map((r) => r[key]).filter((v) => v != null && v !== ""))];
    if (vals.length > max) return null;
    const m = {};
    vals.forEach((v, i) => (m[v] = `var(--cat-${(i % 8) + 1})`));
    return m;
  }

  // ---- Popover (fixed-position, click-out to close) ----
  function Popover({ anchor, onClose, children, align = "left", width }) {
    const ref = React.useRef(null);
    React.useEffect(() => {
      const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
      const k = (e) => { if (e.key === "Escape") onClose(); };
      setTimeout(() => document.addEventListener("mousedown", h), 0);
      document.addEventListener("keydown", k);
      return () => { document.removeEventListener("mousedown", h); document.removeEventListener("keydown", k); };
    }, []);
    if (!anchor) return null;
    const style = { top: anchor.bottom + 4 };
    if (align === "right") style.right = window.innerWidth - anchor.right;
    else style.left = anchor.left;
    if (width) style.width = width;
    return ReactDOM.createPortal(
      <div ref={ref} className={width ? "filterpop" : "popover"} style={style}>{children}</div>,
      document.body
    );
  }

  // ---- DataGrid ----
  function DataGrid({ columns, rows, selCol, onSelectCol, pageSize = 100, compact, idStart = 1 }) {
    const [sort, setSort] = React.useState(null);     // {key,dir}
    const [hidden, setHidden] = React.useState(() => new Set());
    const [frozen, setFrozen] = React.useState(() => new Set());
    const [page, setPage] = React.useState(0);
    const [search, setSearch] = React.useState("");
    const [filters, setFilters] = React.useState({}); // {key: {kind:'in', set} | {kind:'range', min,max}}
    const [menu, setMenu] = React.useState(null);      // {key, rect}
    const [filterMenu, setFilterMenu] = React.useState(null);

    const visCols = columns.filter((c) => !hidden.has(c.key));

    // color maps for category cols
    const cmaps = React.useMemo(() => {
      const m = {};
      for (const c of columns) if (c.type === "category") m[c.key] = colorMap(rows, c.key);
      return m;
    }, [columns, rows]);

    // numeric extents for databar
    const extents = React.useMemo(() => {
      const m = {};
      for (const c of columns) if (isNumType(c.type) && c.role === "measure") {
        let lo = Infinity, hi = -Infinity;
        for (const r of rows) { const v = r[c.key]; if (v != null && !isNaN(v)) { if (v < lo) lo = v; if (v > hi) hi = v; } }
        m[c.key] = [lo, hi];
      }
      return m;
    }, [columns, rows]);

    // filter + search
    const filtered = React.useMemo(() => {
      let out = rows;
      const fkeys = Object.keys(filters);
      if (fkeys.length) out = out.filter((r) => fkeys.every((k) => {
        const f = filters[k]; const v = r[k];
        if (f.kind === "in") return f.set.has(String(v));
        if (f.kind === "range") return v == null || ((f.min == null || v >= f.min) && (f.max == null || v <= f.max));
        return true;
      }));
      if (search.trim()) {
        const q = search.toLowerCase();
        out = out.filter((r) => visCols.some((c) => String(r[c.key] ?? "").toLowerCase().includes(q)));
      }
      return out;
    }, [rows, filters, search, visCols]);

    const sorted = React.useMemo(() => {
      if (!sort) return filtered;
      const { key, dir } = sort; const s = dir === "asc" ? 1 : -1;
      const col = columns.find((c) => c.key === key);
      const numeric = col && isNumType(col.type);
      return [...filtered].sort((a, b) => {
        let x = a[key], y = b[key];
        if (x == null) return 1; if (y == null) return -1;
        if (numeric) return (x - y) * s;
        return String(x).localeCompare(String(y), "ko") * s;
      });
    }, [filtered, sort, columns]);

    const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
    const pg = Math.min(page, totalPages - 1);
    const pageRows = sorted.slice(pg * pageSize, pg * pageSize + pageSize);

    React.useEffect(() => { setPage(0); }, [search, filters]);

    const toggleSort = (key) => setSort((s) => !s || s.key !== key ? { key, dir: "asc" } : s.dir === "asc" ? { key, dir: "desc" } : null);
    const headRef = React.useRef(null);

    const openMenu = (e, key) => { e.stopPropagation(); setMenu({ key, rect: e.currentTarget.getBoundingClientRect() }); };
    const openFilter = (key, rect) => { setMenu(null); setFilterMenu({ key, rect }); };

    return (
      <div className="gridwrap">
        <div className="gridtoolbar">
          <div className="search" style={{ width: 220 }}>
            <Icon name="search" />
            <input placeholder="Search all columns…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {Object.keys(filters).length > 0 && (
            <div className="filterchips">
              {Object.keys(filters).map((k) => {
                const col = columns.find((c) => c.key === k);
                const f = filters[k];
                const txt = f.kind === "in" ? `${col.label}: ${f.set.size} sel` : `${col.label}: range`;
                return (
                  <span className="fchip" key={k}><Icon name="filter" size={11} />{txt}
                    <span className="x" onClick={() => setFilters((p) => { const n = { ...p }; delete n[k]; return n; })}><Icon name="x" size={11} /></span>
                  </span>
                );
              })}
            </div>
          )}
          <div className="spacer" />
          <span className="meta">{sorted.length.toLocaleString()} {sorted.length !== rows.length ? `of ${rows.length.toLocaleString()} ` : ""}rows</span>
          <ColumnsMenu columns={columns} hidden={hidden} setHidden={setHidden} />
          <div className="pager">
            <button className="iconbtn" disabled={pg === 0} onClick={() => setPage(0)} title="First">«</button>
            <button className="iconbtn" disabled={pg === 0} onClick={() => setPage(pg - 1)}><Icon name="chevR" size={13} style={{ transform: "rotate(180deg)" }} /></button>
            <span className="meta" style={{ minWidth: 64, textAlign: "center" }}>{pg + 1} / {totalPages}</span>
            <button className="iconbtn" disabled={pg >= totalPages - 1} onClick={() => setPage(pg + 1)}><Icon name="chevR" size={13} /></button>
            <button className="iconbtn" disabled={pg >= totalPages - 1} onClick={() => setPage(totalPages - 1)} title="Last">»</button>
          </div>
        </div>

        <div className="gridscroll" ref={headRef}>
          <table className="grid">
            <thead>
              <tr>
                <th className="col-idx">#</th>
                {visCols.map((c) => {
                  const tb = typeShort(c.type);
                  const fr = frozen.has(c.key);
                  return (
                    <th key={c.key} className={(selCol === c.key ? "sel " : "") + (fr ? "frozen" : "")}
                      style={fr ? { left: 46 } : undefined}>
                      <div className="th-inner" onClick={() => { onSelectCol && onSelectCol(c.key); toggleSort(c.key); }}>
                        <span className={"th-type " + tb.cls}>{tb.label}</span>
                        <span className="th-name">{c.label}</span>
                        {sort && sort.key === c.key && (
                          <span className="th-sort"><Icon name="chevD" size={12} style={{ transform: sort.dir === "asc" ? "rotate(180deg)" : "none" }} /></span>
                        )}
                        <span className="th-menu" onClick={(e) => openMenu(e, c.key)}><Icon name="dots" size={14} /></span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r, i) => (
                <tr key={i}>
                  <td className="col-idx">{pg * pageSize + i + idStart}</td>
                  {visCols.map((c) => {
                    const f = fmtCell(r[c.key], c);
                    const fr = frozen.has(c.key);
                    const cls = [f.cls === "num" ? "num" : "", selCol === c.key ? "sel" : "", fr ? "frozen" : ""].filter(Boolean).join(" ");
                    const style = fr ? { left: 46 } : undefined;
                    if (f.isNull) return <td key={c.key} className={cls} style={style}><span className="cell-null">null</span></td>;
                    if (c.type === "category" && cmaps[c.key]) {
                      return <td key={c.key} className={cls} style={style}><span className="cell-cat" style={{ "--swatch": cmaps[c.key][r[c.key]] || "var(--tx-faint)" }}>{f.text}</span></td>;
                    }
                    if (f.cls === "num" && extents[c.key] && c.role === "measure") {
                      const [lo, hi] = extents[c.key]; const pct = hi > lo ? Math.max(2, ((f.num - lo) / (hi - lo)) * 100) : 0;
                      return <td key={c.key} className={cls + " databar"} style={style}><span className="fill" style={{ width: pct + "%" }} /><span className="val">{f.text}</span></td>;
                    }
                    return <td key={c.key} className={cls} style={style}>{f.text}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {menu && (
          <Popover anchor={menu.rect} onClose={() => setMenu(null)}>
            <div className="pi" onClick={() => { setSort({ key: menu.key, dir: "asc" }); setMenu(null); }}><Icon name="sort" /> Sort ascending</div>
            <div className="pi" onClick={() => { setSort({ key: menu.key, dir: "desc" }); setMenu(null); }}><Icon name="sort" style={{ transform: "scaleY(-1)" }} /> Sort descending</div>
            <div className="pi" onClick={() => openFilter(menu.key, menu.rect)}><Icon name="filter" /> Filter…</div>
            <div className="sep" />
            <div className="pi" onClick={() => { setFrozen((p) => { const n = new Set(p); n.has(menu.key) ? n.delete(menu.key) : n.add(menu.key); return n; }); setMenu(null); }}>
              <Icon name="pin" /> {frozen.has(menu.key) ? "Unfreeze" : "Freeze column"}
            </div>
            <div className="pi" onClick={() => { setHidden((p) => new Set(p).add(menu.key)); setMenu(null); }}><Icon name="eyeoff" /> Hide column</div>
          </Popover>
        )}
        {filterMenu && (
          <FilterPopover anchor={filterMenu.rect} col={columns.find((c) => c.key === filterMenu.key)} rows={rows}
            value={filters[filterMenu.key]} onClose={() => setFilterMenu(null)}
            onApply={(f) => { setFilters((p) => ({ ...p, [filterMenu.key]: f })); setFilterMenu(null); }}
            onClear={() => { setFilters((p) => { const n = { ...p }; delete n[filterMenu.key]; return n; }); setFilterMenu(null); }} />
        )}
      </div>
    );
  }

  function ColumnsMenu({ columns, hidden, setHidden }) {
    const [open, setOpen] = React.useState(null);
    return (
      <React.Fragment>
        <button className="iconbtn" title="Columns" onClick={(e) => setOpen(e.currentTarget.getBoundingClientRect())}><Icon name="columns" /></button>
        {open && (
          <Popover anchor={open} align="right" onClose={() => setOpen(null)}>
            <div className="ph">Toggle columns</div>
            {columns.map((c) => (
              <div className="pi" key={c.key} onClick={() => setHidden((p) => { const n = new Set(p); n.has(c.key) ? n.delete(c.key) : n.add(c.key); return n; })}>
                <span className={"checkbox" + (!hidden.has(c.key) ? " on" : "")}>{!hidden.has(c.key) && <Icon name="check" />}</span>
                {c.label}
              </div>
            ))}
          </Popover>
        )}
      </React.Fragment>
    );
  }

  function FilterPopover({ anchor, col, rows, value, onApply, onClear, onClose }) {
    const numeric = isNumType(col.type);
    const distinct = React.useMemo(() => {
      const m = new Map();
      for (const r of rows) { const v = String(r[col.key] ?? "null"); m.set(v, (m.get(v) || 0) + 1); }
      return [...m.entries()].sort((a, b) => b[1] - a[1]);
    }, [rows, col]);
    const [set, setSet] = React.useState(() => value && value.kind === "in" ? new Set(value.set) : new Set(distinct.map((d) => d[0])));
    const [range, setRange] = React.useState(() => value && value.kind === "range" ? value : { min: "", max: "" });
    const [q, setQ] = React.useState("");

    if (numeric) {
      return (
        <Popover anchor={anchor} onClose={onClose} width={210}>
          <div className="ph" style={{ padding: "2px 4px 6px" }}>Filter {col.label}</div>
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            <input className="inp" placeholder="min" value={range.min} onChange={(e) => setRange({ ...range, min: e.target.value })} />
            <input className="inp" placeholder="max" value={range.max} onChange={(e) => setRange({ ...range, max: e.target.value })} />
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button className="btn ghost sm" onClick={onClear}>Clear</button>
            <div style={{ flex: 1 }} />
            <button className="btn primary sm" onClick={() => onApply({ kind: "range", min: range.min === "" ? null : +range.min, max: range.max === "" ? null : +range.max })}>Apply</button>
          </div>
        </Popover>
      );
    }
    const shown = distinct.filter((d) => d[0].toLowerCase().includes(q.toLowerCase()));
    return (
      <Popover anchor={anchor} onClose={onClose} width={230}>
        <div className="search" style={{ marginBottom: 4 }}><Icon name="search" /><input placeholder={`Filter ${col.label}…`} value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div style={{ display: "flex", gap: 8, padding: "2px 6px" }}>
          <button className="btn ghost sm" style={{ height: 20 }} onClick={() => setSet(new Set(distinct.map((d) => d[0])))}>All</button>
          <button className="btn ghost sm" style={{ height: 20 }} onClick={() => setSet(new Set())}>None</button>
        </div>
        <div className="fp-list">
          {shown.map(([v, c]) => (
            <div className="fp-opt" key={v} onClick={() => setSet((p) => { const n = new Set(p); n.has(v) ? n.delete(v) : n.add(v); return n; })}>
              <span className={"checkbox" + (set.has(v) ? " on" : "")}>{set.has(v) && <Icon name="check" />}</span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{v}</span><span className="cnt">{c}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
          <button className="btn ghost sm" onClick={onClear}>Clear</button>
          <div style={{ flex: 1 }} />
          <button className="btn primary sm" onClick={() => onApply({ kind: "in", set })}>Apply ({set.size})</button>
        </div>
      </Popover>
    );
  }

  Object.assign(window, { DataGrid, Popover, fmtCell, typeShort, isNumType, colorMap });
})();
