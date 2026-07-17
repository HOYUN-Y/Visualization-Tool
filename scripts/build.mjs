// Deployment build (PLAN §12 A2 + D2).
//
// WHY THIS EXISTS — AND WHY DEV STILL HAS NO BUILD
// The app is deliberately no-build: open index.html off a static server and it runs, with React + Babel
// Standalone compiling the 18 JSX files in the browser on every load. That is the right trade for
// development (edit → refresh, no toolchain), but it is the wrong thing to ship:
//   • react.development.js is several times slower than production and logs dev warnings to the console
//   • Babel Standalone is a ~3 MB download that then compiles 18 files before the first paint
// So: development keeps the no-build path untouched. `npm run build` produces dist/ where the JSX is
// already compiled and Babel is gone. Nothing in js/ or index.html changes — dist/ is generated.
//
// NOT A BUNDLER. Every module is a global (`window.Store`, `window.Charts`, …) and index.html's script
// order IS the dependency graph. So we transform each file 1:1 and keep the tags in the same order.
// Bundling would need real module boundaries — a much larger refactor, and not what A2 asks for.
//
// React is vendored INTO dist rather than swapped to a production CDN URL: a different URL needs a
// different SRI hash, and hand-copied hashes rot silently. Local files need no SRI and drop two CDN
// round-trips. ECharts keeps its CDN + SRI (already correct); DuckDB still loads from jsDelivr at
// runtime (PLAN §12 A3′ — open).
import { build } from "esbuild";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");
const REACT_VERSION = "18.3.1";
const REACT_FILES = [
  { url: `https://unpkg.com/react@${REACT_VERSION}/umd/react.production.min.js`, out: "react.production.min.js" },
  { url: `https://unpkg.com/react-dom@${REACT_VERSION}/umd/react-dom.production.min.js`, out: "react-dom.production.min.js" },
];

const log = (msg) => console.log(msg);
const rel = (p) => path.relative(ROOT, p);

async function copyDir(from, to, skip = () => false) {
  await fs.mkdir(to, { recursive: true });
  for (const entry of await fs.readdir(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (skip(entry.name, src)) continue;
    if (entry.isDirectory()) await copyDir(src, dst, skip);
    else await fs.copyFile(src, dst);
  }
}

// ── 1. clean ────────────────────────────────────────────────────────────────
await fs.rm(DIST, { recursive: true, force: true });
await fs.mkdir(DIST, { recursive: true });

// ── 2. JSX → JS, one file in / one file out ─────────────────────────────────
// Same semantics as the in-browser @babel/preset-react classic runtime, so the output behaves
// identically to dev. No bundling, no minify of our own source (keeps stack traces readable).
const jsFiles = (await fs.readdir(path.join(ROOT, "js"))).sort();
const jsxFiles = jsFiles.filter((f) => f.endsWith(".jsx"));
await fs.mkdir(path.join(DIST, "js"), { recursive: true });

for (const file of jsxFiles) {
  await build({
    entryPoints: [path.join(ROOT, "js", file)],
    outfile: path.join(DIST, "js", file.replace(/\.jsx$/, ".js")),
    loader: { ".jsx": "jsx" },
    jsx: "transform",
    jsxFactory: "React.createElement",
    jsxFragment: "React.Fragment",
    bundle: false,
    minify: false,
    target: ["chrome111", "safari16.2"], // matches the support floor README states (oklch/color-mix)
    logLevel: "warning",
  });
}
log(`  JSX 트랜스파일: ${jsxFiles.length}개 → dist/js/*.js`);

// ── 3. copy everything that ships as-is ─────────────────────────────────────
for (const file of jsFiles.filter((f) => !f.endsWith(".jsx"))) {
  await fs.copyFile(path.join(ROOT, "js", file), path.join(DIST, "js", file));
}
await copyDir(path.join(ROOT, "css"), path.join(DIST, "css"));
await copyDir(path.join(ROOT, "vendor"), path.join(DIST, "vendor"), (name) => name === "README.md");
log(`  복사: js(${jsFiles.length - jsxFiles.length}) · css · vendor`);

// ── 4. vendor React production ──────────────────────────────────────────────
const reactDir = path.join(DIST, "vendor", "react");
await fs.mkdir(reactDir, { recursive: true });
for (const { url, out } of REACT_FILES) {
  let res;
  try {
    res = await fetch(url);
  } catch (e) {
    throw new Error(`React 다운로드 실패 (네트워크): ${url}\n${e.message}\n빌드는 최초 1회 네트워크가 필요합니다.`);
  }
  if (!res.ok) throw new Error(`React 다운로드 실패 HTTP ${res.status}: ${url}`);
  const body = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(path.join(reactDir, out), body);
  const sha = createHash("sha256").update(body).digest("hex").slice(0, 16);
  log(`  vendor react: ${out} (${(body.length / 1024).toFixed(0)}KB · sha256 ${sha}…)`);
}

// ── 5. rewrite index.html ───────────────────────────────────────────────────
let html = await fs.readFile(path.join(ROOT, "index.html"), "utf8");
const before = html;
const must = (pattern, replacement, label) => {
  const next = html.replace(pattern, replacement);
  if (next === html) throw new Error(`index.html 재작성 실패 — 패턴을 찾지 못함: ${label}\n` +
    `index.html이 바뀌었다면 scripts/build.mjs도 함께 고쳐야 합니다.`);
  html = next;
};

// 5a. React dev CDN → vendored production. Drops integrity/crossorigin with the URL (same-origin now).
must(
  /<script src="https:\/\/unpkg\.com\/react@[\d.]+\/umd\/react\.development\.js"[^>]*><\/script>/,
  `<script src="vendor/react/react.production.min.js"></script>`,
  "react.development.js",
);
must(
  /<script src="https:\/\/unpkg\.com\/react-dom@[\d.]+\/umd\/react-dom\.development\.js"[^>]*><\/script>/,
  `<script src="vendor/react/react-dom.production.min.js"></script>`,
  "react-dom.development.js",
);

// 5b. Babel Standalone is dead weight once the JSX is compiled — remove the tag entirely.
must(
  /<script src="https:\/\/unpkg\.com\/@babel\/standalone@[^"]+"[^>]*><\/script>\n?/,
  "",
  "@babel/standalone",
);

// 5c. The loading screen gates on window.Babel. With Babel gone that check can never pass, so the
// loader would sit spinning for 8s and then report "react 로드 실패" on a perfectly good build.
must(
  /window\.React && window\.ReactDOM && window\.Babel/,
  "window.React && window.ReactDOM",
  "loader Babel check",
);
html = html.replace(/label: "React \+ Babel 로드 완료"/, 'label: "React 로드 완료"')
           .replace(/>\s*React 18 \+ Babel\s*</, ">React 18<");

// 5d. type="text/babel" → plain script, and .jsx → the compiled .js. Note projectStore.js is served as
// text/babel today despite being plain JS, so key off the attribute, not the extension.
const babelTags = html.match(/<script type="text\/babel"/g) || [];
html = html.replace(/<script type="text\/babel" src="js\/([\w.-]+)\.jsx(\?v=\d+)?"><\/script>/g,
  (_m, name, v) => `<script src="js/${name}.js${v || ""}"></script>`);
html = html.replace(/<script type="text\/babel" src="js\/([\w.-]+)\.js(\?v=\d+)?"><\/script>/g,
  (_m, name, v) => `<script src="js/${name}.js${v || ""}"></script>`);

if (/text\/babel/.test(html)) throw new Error("index.html에 text/babel 태그가 남아 있습니다 — 재작성 규칙 누락");
if (/\.jsx\?/.test(html) || /\.jsx"/.test(html)) throw new Error("index.html에 .jsx 참조가 남아 있습니다 — 재작성 규칙 누락");
if (html === before) throw new Error("index.html이 전혀 바뀌지 않았습니다");

await fs.writeFile(path.join(DIST, "index.html"), html);
log(`  index.html 재작성: text/babel ${babelTags.length}개 제거 · React production · Babel 제거`);

// ── 6. report ───────────────────────────────────────────────────────────────
async function dirSize(dir) {
  let total = 0;
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    total += entry.isDirectory() ? await dirSize(p) : (await fs.stat(p)).size;
  }
  return total;
}
log(`\n✅ 빌드 완료 → ${rel(DIST)}/  (${(await dirSize(DIST) / 1024 / 1024).toFixed(1)}MB)`);
log(`   확인:  npx http-server dist -p 8743   또는   (cd dist && python3 -m http.server 8743)`);
log(`   주의:  DuckDB는 여전히 런타임 CDN(jsDelivr) 로드 — 오프라인 시 JS 폴백 (PLAN §12 A3′)`);
