// Smoke-test the BUILT app in a real browser (PLAN §12 A2).
//
// A build that "succeeds" but doesn't boot is worthless, and the dist rewrite has failure modes the
// build itself cannot see: a leftover text/babel tag, a .jsx reference with no Babel to compile it, a
// stale loader gate. Those produce a blank page in production while `npm run build` prints ✅. So we
// load the real dist output in real Chrome and assert it actually works.
//
// Usage:  npm run build && npm run verify:dist     (serves dist/ itself on :8743)
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 8743;

// Serve dist/ ourselves so the check is one command and can't accidentally test the dev tree.
const server = spawn("python3", ["-m", "http.server", String(PORT)], { cwd: path.join(ROOT, "dist"), stdio: "ignore" });
const stop = () => { try { server.kill(); } catch (_) {} };
process.on("exit", stop);
await new Promise((r) => setTimeout(r, 1500));

const url = `http://127.0.0.1:${PORT}/index.html`;
const browser = await chromium.launch({ channel: "chrome", args: ["--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage();
const errors = [];
// The browser requests /favicon.ico on its own; index.html declares no icon, so that 404 appears in dev
// too and says nothing about the build. Ignore it rather than train ourselves to ignore real failures.
// The console message text for a failed request doesn't name the file — the URL is on location().
const noise = (s) => /favicon\.ico/.test(s || "");
page.on("pageerror", (e) => { if (!noise(e.message)) errors.push("pageerror: " + e.message); });
page.on("console", (m) => {
  if (m.type() !== "error") return;
  if (noise(m.text()) || noise(m.location() && m.location().url)) return;
  errors.push("console: " + m.text());
});

await page.goto(url, { waitUntil: "load" });
await page.waitForFunction(() => {
  const l = document.querySelector("#node-loader");
  return window.Store && window.Store.actions && document.querySelector(".app") &&
    (!l || l.classList.contains("hiding") || getComputedStyle(l).display === "none");
}, { timeout: 30000 });
await page.waitForTimeout(1500);

const r = await page.evaluate(() => ({
  hasBabel: typeof window.Babel !== "undefined",
  reactDev: !!(window.React && window.React.version && document.querySelector('script[src*="development"]')),
  reactVersion: window.React && window.React.version,
  modules: ["Store", "Charts", "ProjectStore", "NODE", "PivotEngine", "DataOps", "FormulaEval", "ShareLink"].filter((k) => !window[k]),
  appRendered: !!document.querySelector(".app"),
  projectId: window.ProjectStore && window.ProjectStore.getStatus().projectId,
  storage: window.ProjectStore && window.ProjectStore.getStatus().storage,
  clipboard: window.Charts && window.Charts.clipboardSupport().reason,
  babelTags: document.querySelectorAll('script[type="text/babel"]').length,
  jsxRefs: document.querySelectorAll('script[src*=".jsx"]').length,
}));

// Walk EVERY mode. The grid.jsx TDZ bug (2026-07-17) only surfaced in the build — dev's in-browser
// Babel downlevels const→var, which hoists and masks it — and it crashed Data mode outright. Any mode
// could hide the same class of bug, so visiting one mode proves nothing about the other eight.
const MODES = ["data", "clean", "sql", "visualize", "dashboard", "map", "stats", "ml", "pivot"];
const modeFailures = [];
for (const m of MODES) {
  const mark = errors.length;
  await page.evaluate((x) => window.Store.actions.setMode(x), m);
  await page.waitForTimeout(1200);
  const ok = await page.evaluate((x) => window.Store.getState().mode === x && !!document.querySelector(".app"), m);
  if (!ok || errors.length > mark) modeFailures.push(m);
}
const vizOk = modeFailures.length === 0;

console.log(JSON.stringify({ ...r, modesChecked: MODES.length, modeFailures, errors: errors.slice(0, 8) }, null, 2));
await browser.close();
stop();

const fatal = [];
if (r.hasBabel) fatal.push("Babel still present in dist");
if (r.babelTags) fatal.push(`${r.babelTags} text/babel tags remain`);
if (r.jsxRefs) fatal.push(`${r.jsxRefs} .jsx refs remain`);
if (r.reactDev) fatal.push("React development build still referenced");
if (r.modules.length) fatal.push("missing globals: " + r.modules.join(","));
if (!r.appRendered) fatal.push("app did not render");
if (!r.projectId) fatal.push("no project loaded (IndexedDB path broken)");
if (!vizOk) fatal.push("mode(s) broken in dist: " + modeFailures.join(", "));
if (errors.length) fatal.push("console/page errors: " + errors.length);
if (fatal.length) { console.error("\n❌ FAIL:\n - " + fatal.join("\n - ")); process.exit(1); }
console.log(`\n✅ dist 부팅 · ${MODES.length}개 모드 전부 정상 · IndexedDB 정상 · Babel 제거 확인 · 콘솔 에러 0`);
