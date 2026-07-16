// Share link round-trip (P10). A project is encoded into a #p=… URL fragment (full data, deflate,
// base64url — no backend) and opening that URL re-imports the project. This proves, in a real
// browser: (1) encode/decode via CompressionStream survives a round-trip, and (2) the boot-time
// hook actually imports a project from a #p= link and strips the fragment.
import { test, expect } from '@playwright/test';
import { bootApp, teardownDuckDB } from './helpers.mjs';

test.setTimeout(90000);
test.afterEach(async ({ page }) => teardownDuckDB(page));

test("ShareLink encode→decode round-trips a bundle in the browser (deflate path)", async ({ page }) => {
  await bootApp(page, {});
  const r = await page.evaluate(async () => {
    const bundle = {
      schemaVersion: 1,
      exportedAt: "2026-07-17T00:00:00.000Z",
      project: { id: "share_rt", name: "왕복 테스트 🎉", createdAt: "a", updatedAt: "b" },
      state: { activeId: "d1", mode: "data", tweaks: { lang: "ko" } },
      datasets: [{ id: "d1", name: "D1", columns: [{ key: "v" }], rows: Array.from({ length: 200 }, (_, i) => ({ v: "row_" + (i % 4) })) }],
      analysis: {},
    };
    const enc = await window.ShareLink.encodeShareLink("https://x.dev/index.html", bundle);
    const back = await window.ShareLink.decodeShareFragmentAsync(enc.url);
    return {
      compressed: enc.compressed,
      tooLarge: enc.tooLarge,
      hasFragment: enc.url.indexOf("#p=") >= 0,
      roundtripEqual: JSON.stringify(back) === JSON.stringify(bundle),
    };
  });
  expect(r.hasFragment, "URL carries a #p= fragment").toBe(true);
  expect(r.compressed, "large repetitive bundle uses deflate").toBe(true);
  expect(r.tooLarge, "sample bundle is within size cap").toBe(false);
  expect(r.roundtripEqual, "decoded bundle equals the original").toBe(true);
});

test("opening a #p= link imports the project and clears the fragment", async ({ page }) => {
  // First, on a normal boot, build a share URL from a small synthetic bundle.
  await bootApp(page, {});
  const shareUrl = await page.evaluate(async () => {
    const bundle = {
      schemaVersion: 1,
      exportedAt: "2026-07-17T00:00:00.000Z",
      project: { id: "imported_via_link", name: "링크로 열린 프로젝트", createdAt: "a", updatedAt: "b" },
      state: { activeId: "dz", mode: "data", tweaks: { lang: "ko" } },
      datasets: [{ id: "dz", name: "DZ", columns: [{ key: "x" }, { key: "y" }], rows: [{ x: 1, y: "a" }, { x: 2, y: "b" }] }],
      analysis: {},
    };
    const enc = await window.ShareLink.encodeShareLink(location.origin + location.pathname, bundle);
    return enc.url;
  });
  expect(shareUrl).toContain("#p=");

  // Now navigate to that share URL as a fresh visitor. Go through about:blank first so this is a
  // real document load (a same-page goto that only changes the hash is treated as SPA hash-nav and
  // would NOT re-run app.jsx). A new tab / new visitor — the real use case — always loads fresh.
  await page.goto("about:blank");
  await page.goto(shareUrl, { waitUntil: "load" });
  await page.waitForFunction(() => {
    return window.Store && window.ProjectStore &&
      (window.ProjectStore.getStatus().project || {}).name === "링크로 열린 프로젝트";
  }, { timeout: 30000 });

  const s = await page.evaluate(() => {
    const st = window.Store.getState();
    const ds = st.datasets || (window.NODE && window.NODE.datasets) || [];
    return {
      projectName: window.ProjectStore.getStatus().project.name,
      hashCleared: location.hash === "" || location.hash.indexOf("p=") < 0,
      hasDataset: Array.isArray(ds) ? ds.some((d) => d.id === "dz") : false,
      activeId: st.activeId,
    };
  });
  expect(s.projectName, "share link imported the named project").toBe("링크로 열린 프로젝트");
  expect(s.hashCleared, "the #p= fragment was stripped after import").toBe(true);

  // tidy: remove the imported project + reset to a clean data view on the shared server state
  await page.evaluate(async () => {
    try {
      const st = window.ProjectStore.getStatus();
      if (st.project) await window.ProjectStore.remove(st.project.id);
    } catch (e) {}
    window.Store.actions.setMode("data");
  });
});
