/* insight Analytics Workbench — in-app toasts and dialogs (PLAN §12 C3)
 *
 * Replaces native alert()/confirm()/prompt(). Those are a problem beyond looking foreign:
 *   • they BLOCK the event loop — an embed/iframe host or an automation driver freezes on them,
 *     and Playwright must pre-register a dismiss handler or the whole run hangs
 *   • they're unstyleable, so the app's own visual language stops at the most important moments
 *   • Chrome suppresses repeated dialogs ("prevent this page from creating additional dialogs"),
 *     which silently swallows later messages
 *
 * window.UI = { toast, alert, confirm, prompt, Host }
 *
 *   UI.toast(msg, {type, duration})  → non-blocking notice. Fire-and-forget.
 *   UI.alert(msg, {title})           → Promise<void>, resolves when acknowledged
 *   UI.confirm(msg, {title, danger}) → Promise<boolean>
 *   UI.prompt(msg, {defaultValue})   → Promise<string|null>  (null = cancelled)
 *
 * The promise API mirrors the native call it replaces, so call sites change from
 *   `if (!confirm(x)) return;`  to  `if (!await UI.confirm(x)) return;`
 * and nothing else about their logic moves.
 *
 * <UI.Host/> renders once at the app root. State lives in a module-level store (same pattern as
 * window.Store) rather than React context so non-component code — event handlers, async flows in
 * shell.jsx, engines — can raise a dialog without needing a hook.
 */
(function () {
  "use strict";

  const listeners = new Set();
  let state = { toasts: [], dialog: null };
  let seq = 0;

  function emit() {
    const snap = state;
    listeners.forEach((l) => { try { l(snap); } catch (e) { console.error(e); } });
  }
  function set(patch) { state = Object.assign({}, state, patch); emit(); }

  // ── toasts ────────────────────────────────────────────────────────────────
  function dismissToast(id) {
    set({ toasts: state.toasts.filter((t) => t.id !== id) });
  }

  function toast(message, opts) {
    opts = opts || {};
    const id = ++seq;
    const type = opts.type || "info";                       // info | success | warn | error
    // Errors linger — they're the ones worth reading. Everything else clears itself.
    const duration = opts.duration != null ? opts.duration : (type === "error" ? 7000 : 3800);
    set({ toasts: state.toasts.concat([{ id, message: String(message), type }]) });
    if (duration > 0) setTimeout(() => dismissToast(id), duration);
    return id;
  }

  // ── modal dialogs ─────────────────────────────────────────────────────────
  // Only one at a time: a queue would let a background flow bury the dialog the user is answering.
  // A second request while one is open resolves the older one as cancelled, matching how a native
  // dialog would have blocked the second call from ever being made.
  function ask(kind, message, opts) {
    opts = opts || {};
    return new Promise((resolve) => {
      if (state.dialog) { try { state.dialog.resolve(kind === "confirm" ? false : null); } catch (e) {} }
      set({
        dialog: {
          id: ++seq,
          kind,                                              // alert | confirm | prompt
          message: String(message),
          title: opts.title || null,
          danger: !!opts.danger,
          confirmLabel: opts.confirmLabel || null,
          defaultValue: opts.defaultValue != null ? String(opts.defaultValue) : "",
          resolve,
        },
      });
    });
  }

  function closeDialog(value) {
    const d = state.dialog;
    if (!d) return;
    set({ dialog: null });
    try { d.resolve(value); } catch (e) { console.error(e); }
  }

  const alertFn = (message, opts) => ask("alert", message, opts).then(() => undefined);
  const confirmFn = (message, opts) => ask("confirm", message, opts).then((v) => v === true);
  const promptFn = (message, opts) => ask("prompt", message, opts).then((v) => (typeof v === "string" ? v : null));

  // ── Host component ────────────────────────────────────────────────────────
  function Host() {
    const [snap, setSnap] = React.useState(state);
    React.useEffect(() => {
      listeners.add(setSnap);
      return () => listeners.delete(setSnap);
    }, []);

    const d = snap.dialog;
    const inputRef = React.useRef(null);
    const [val, setVal] = React.useState("");

    // Reset the field per dialog (keyed on id, not on the object — a re-render must not wipe typing).
    React.useEffect(() => {
      if (!d) return;
      setVal(d.kind === "prompt" ? d.defaultValue : "");
      // Autofocus so Enter works immediately, like the native dialog it replaces.
      const t = setTimeout(() => { if (inputRef.current) inputRef.current.focus(); if (inputRef.current && inputRef.current.select) inputRef.current.select(); }, 30);
      return () => clearTimeout(t);
    }, [d && d.id]);

    // Escape cancels — native dialogs do, and users expect it.
    React.useEffect(() => {
      if (!d) return;
      const onKey = (e) => {
        if (e.key === "Escape") { e.preventDefault(); closeDialog(d.kind === "confirm" ? false : null); }
      };
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
    }, [d && d.id, d && d.kind]);

    const submit = () => closeDialog(d.kind === "prompt" ? val : true);

    return (
      <React.Fragment>
        {/* toasts */}
        {snap.toasts.length > 0 && (
          <div className="toast-stack">
            {snap.toasts.map((t) => (
              <div key={t.id} className={"toast " + t.type} role="status" onClick={() => dismissToast(t.id)}>
                <window.Icon name={t.type === "success" ? "check" : t.type === "error" || t.type === "warn" ? "info" : "info"} size={13} />
                <span>{t.message}</span>
                <button className="toast-x" onClick={(e) => { e.stopPropagation(); dismissToast(t.id); }} aria-label="닫기">
                  <window.Icon name="x" size={11} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* modal */}
        {d && (
          <div className="ui-overlay" onMouseDown={() => closeDialog(d.kind === "confirm" ? false : null)}>
            <div className="ui-dialog" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
              <div className="ui-dialog-body">
                {d.title && <strong className={d.danger ? "danger" : ""}>{d.title}</strong>}
                <p>{d.message}</p>
                {d.kind === "prompt" && (
                  <input ref={inputRef} className="ui-dialog-input" value={val}
                    onChange={(e) => setVal(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); } }} />
                )}
              </div>
              <div className="ui-dialog-foot">
                {d.kind !== "alert" && (
                  <button className="btn ghost sm" onClick={() => closeDialog(d.kind === "confirm" ? false : null)}>취소</button>
                )}
                <button ref={d.kind === "prompt" ? null : inputRef}
                  className={"btn sm " + (d.danger ? "danger" : "primary")} onClick={submit}>
                  {d.confirmLabel || (d.kind === "alert" ? "확인" : d.kind === "confirm" ? "확인" : "확인")}
                </button>
              </div>
            </div>
          </div>
        )}
      </React.Fragment>
    );
  }

  window.UI = {
    toast, dismissToast,
    alert: alertFn, confirm: confirmFn, prompt: promptFn,
    Host,
    // test seam — lets specs assert state without scraping the DOM
    _get: () => state,
  };
})();
