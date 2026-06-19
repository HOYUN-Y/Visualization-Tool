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
  // editable: enables JMP/Excel-style editing. `edit` provides callbacks:
  //   { onCell(rid,key,val), onDeleteRows(rids), onAddRow(), onAddCol(),
  //     onRename(key,to), onChangeType(key,type), onInsertCol(atIndex), onDeleteCol(key), onReorder(orderKeys) }
  function DataGrid({ columns, rows, selCol, onSelectCol, pageSize = 100, compact, idStart = 1, editable = false, edit = null }) {
    const [sort, setSort] = React.useState(null);     // {key,dir}
    const [hidden, setHidden] = React.useState(() => new Set());
    const [frozen, setFrozen] = React.useState(() => new Set());
    const [page, setPage] = React.useState(0);
    const [search, setSearch] = React.useState("");
    const [filters, setFilters] = React.useState({}); // {key: {kind:'in', set} | {kind:'range', min,max}}
    const [menu, setMenu] = React.useState(null);      // {key, rect}
    const [filterMenu, setFilterMenu] = React.useState(null);
    // editing state
    const [cellEdit, setCellEdit] = React.useState(null); // {rid, key}
    const [cellVal, setCellVal] = React.useState("");
    const [headEdit, setHeadEdit] = React.useState(null); // key being renamed
    const [headVal, setHeadVal] = React.useState("");
    const [selRows, setSelRows] = React.useState(() => new Set()); // selected __rid
    const [dragKey, setDragKey] = React.useState(null);   // column being dragged
    const [dragOver, setDragOver] = React.useState(null); // column hovered during drag

    const visCols = columns.filter((c) => !hidden.has(c.key));

    // commit / cancel cell edit
    const startCell = (rid, key, cur) => { setCellEdit({ rid, key }); setCellVal(cur == null ? "" : String(cur)); };
    const commitCell = () => { if (cellEdit) { edit.onCell(cellEdit.rid, cellEdit.key, cellVal); setCellEdit(null); } };
    const startHead = (key, cur) => { setHeadEdit(key); setHeadVal(cur); setMenu(null); };
    const commitHead = () => { if (headEdit) { const t = headVal.trim(); if (t && t !== headEdit) edit.onRename(headEdit, t); setHeadEdit(null); } };
    // reorder: move fromKey before toKey within full column order
    const doReorder = (fromKey, toKey) => {
      if (!fromKey || fromKey === toKey) return;
      const order = columns.map((c) => c.key);
      order.splice(order.indexOf(fromKey), 1);
      order.splice(order.indexOf(toKey), 0, fromKey);
      edit.onReorder(order);
    };

    // Delete key removes selected rows
    React.useEffect(() => {
      if (!editable) return;
      const h = (e) => {
        if ((e.key === "Delete" || e.key === "Backspace") && selRows.size && !cellEdit && !headEdit) {
          const tag = document.activeElement && document.activeElement.tagName;
          if (tag === "INPUT" || tag === "TEXTAREA") return;
          e.preventDefault(); edit.onDeleteRows([...selRows]); setSelRows(new Set());
        }
      };
      document.addEventListener("keydown", h);
      return () => document.removeEventListener("keydown", h);
    }, [editable, selRows, cellEdit, headEdit]);

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
                  const editingHead = editable && headEdit === c.key;
                  return (
                    <th key={c.key} className={(selCol === c.key ? "sel " : "") + (fr ? "frozen" : "") + (editable && dragOver === c.key ? " drop-target" : "")}
                      style={fr ? { left: 46 } : undefined}
                      draggable={editable && !editingHead && !fr}
                      onDragStart={editable ? (e) => { setDragKey(c.key); e.dataTransfer.effectAllowed = "move"; } : undefined}
                      onDragOver={editable && dragKey ? (e) => { e.preventDefault(); if (dragOver !== c.key) setDragOver(c.key); } : undefined}
                      onDragLeave={editable ? () => setDragOver((k) => k === c.key ? null : k) : undefined}
                      onDrop={editable && dragKey ? (e) => { e.preventDefault(); doReorder(dragKey, c.key); setDragKey(null); setDragOver(null); } : undefined}
                      onDragEnd={editable ? () => { setDragKey(null); setDragOver(null); } : undefined}>
                      {editingHead ? (
                        <div className="th-inner" style={{ cursor: "text" }}>
                          <input className="th-rename" autoFocus value={headVal}
                            onChange={(e) => setHeadVal(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") commitHead(); else if (e.key === "Escape") setHeadEdit(null); }}
                            onBlur={commitHead} />
                        </div>
                      ) : (
                        <div className="th-inner" onClick={() => { onSelectCol && onSelectCol(c.key); toggleSort(c.key); }}
                          onDoubleClick={editable ? (e) => { e.stopPropagation(); startHead(c.key, c.label); } : undefined}>
                          {editable && <span className="th-grip" title="Drag to reorder"><Icon name="move" size={11} /></span>}
                          <span className={"th-type " + tb.cls}>{tb.label}</span>
                          <span className="th-name">{c.label}</span>
                          {sort && sort.key === c.key && (
                            <span className="th-sort"><Icon name="chevD" size={12} style={{ transform: sort.dir === "asc" ? "rotate(180deg)" : "none" }} /></span>
                          )}
                          <span className="th-menu" onClick={(e) => openMenu(e, c.key)}><Icon name="dots" size={14} /></span>
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r, i) => {
                const rid = r.__rid;
                const rowSel = editable && rid != null && selRows.has(rid);
                return (
                <tr key={editable && rid != null ? rid : i} className={rowSel ? "rowsel" : ""}>
                  <td className={"col-idx" + (editable ? " editable" : "")}
                    onClick={editable && rid != null ? (e) => {
                      setSelRows((p) => { const n = new Set(p); n.has(rid) ? n.delete(rid) : n.add(rid); return n; });
                    } : undefined}>
                    {editable ? (
                      <span className="idx-edit">
                        <span className="idx-num">{pg * pageSize + i + idStart}</span>
                        <span className="row-del" title="Delete row" onClick={(e) => { e.stopPropagation(); edit.onDeleteRows([rid]); setSelRows((p) => { const n = new Set(p); n.delete(rid); return n; }); }}><Icon name="x" size={11} /></span>
                      </span>
                    ) : (pg * pageSize + i + idStart)}
                  </td>
                  {visCols.map((c) => {
                    const fr = frozen.has(c.key);
                    const style = fr ? { left: 46 } : undefined;
                    const editingCell = editable && cellEdit && cellEdit.rid === rid && cellEdit.key === c.key;
                    if (editingCell) {
                      return <td key={c.key} className={"editing" + (fr ? " frozen" : "")} style={style}>
                        <input className="cell-input" autoFocus value={cellVal}
                          onChange={(e) => setCellVal(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") commitCell(); else if (e.key === "Escape") setCellEdit(null); }}
                          onBlur={commitCell} />
                      </td>;
                    }
                    const f = fmtCell(r[c.key], c);
                    const cls = [f.cls === "num" ? "num" : "", selCol === c.key ? "sel" : "", fr ? "frozen" : "", editable ? "editable" : ""].filter(Boolean).join(" ");
                    const dbl = editable && rid != null ? () => startCell(rid, c.key, r[c.key]) : undefined;
                    if (f.isNull) return <td key={c.key} className={cls} style={style} onDoubleClick={dbl}><span className="cell-null">null</span></td>;
                    if (c.type === "category" && cmaps[c.key]) {
                      return <td key={c.key} className={cls} style={style} onDoubleClick={dbl}><span className="cell-cat" style={{ "--swatch": cmaps[c.key][r[c.key]] || "var(--tx-faint)" }}>{f.text}</span></td>;
                    }
                    if (f.cls === "num" && extents[c.key] && c.role === "measure") {
                      const [lo, hi] = extents[c.key]; const pct = hi > lo ? Math.max(2, ((f.num - lo) / (hi - lo)) * 100) : 0;
                      return <td key={c.key} className={cls + " databar"} style={style} onDoubleClick={dbl}><span className="fill" style={{ width: pct + "%" }} /><span className="val">{f.text}</span></td>;
                    }
                    return <td key={c.key} className={cls} style={style} onDoubleClick={dbl}>{f.text}</td>;
                  })}
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {editable && (
          <div className="grid-editbar">
            <button className="btn ghost sm" onClick={() => edit.onAddRow()}><Icon name="plus" size={12} /> Add row</button>
            <button className="btn ghost sm" onClick={() => edit.onAddCol()}><Icon name="plus" size={12} /> Add column</button>
            <div className="spacer" style={{ flex: 1 }} />
            {selRows.size > 0 && (
              <React.Fragment>
                <span className="meta">{selRows.size} selected</span>
                <button className="btn danger sm" onClick={() => { edit.onDeleteRows([...selRows]); setSelRows(new Set()); }}><Icon name="trash" size={12} /> Delete</button>
                <button className="btn ghost sm" onClick={() => setSelRows(new Set())}>Clear</button>
              </React.Fragment>
            )}
          </div>
        )}

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
            {editable && (
              <React.Fragment>
                <div className="sep" />
                <div className="pi" onClick={() => startHead(menu.key, (columns.find((c) => c.key === menu.key) || {}).label || menu.key)}><Icon name="edit" /> Rename…</div>
                <div className="ph">Change type</div>
                {[["string", "Text"], ["integer", "Integer"], ["float", "Decimal"], ["category", "Category"], ["datetime", "Date"]].map(([t, lbl]) => (
                  <div className="pi" key={t} onClick={() => { edit.onChangeType(menu.key, t); setMenu(null); }} style={{ paddingLeft: 18 }}>
                    <span className={"th-type " + typeShort(t).cls} style={{ minWidth: 26, textAlign: "center" }}>{typeShort(t).label}</span> {lbl}
                  </div>
                ))}
                <div className="sep" />
                <div className="pi" onClick={() => { edit.onInsertCol(columns.findIndex((c) => c.key === menu.key)); setMenu(null); }}><Icon name="plus" /> Insert left</div>
                <div className="pi" onClick={() => { edit.onInsertCol(columns.findIndex((c) => c.key === menu.key) + 1); setMenu(null); }}><Icon name="plus" /> Insert right</div>
                <div className="pi danger" onClick={() => { edit.onDeleteCol(menu.key); setMenu(null); }}><Icon name="trash" /> Delete column</div>
              </React.Fragment>
            )}
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
