// Municipality coordinate disambiguation (PLAN §12 C9).
//
// MUN_LATLON was a flat 시군구명 → [lat,lon] map, but Korean district names are not unique across 시도:
// 북구 exists in 부산·대구·광주, 서구 in 인천·대전·광주. The object literal listed "북구" twice, so JS
// silently kept the last one and ALL THREE 북구 rows plotted on Gwangju — Busan's bubble ~200km from
// Busan — while the tooltip read "북구 / 부산광역시". Same for 서구. The dataset carries `province`; the
// lookup just wasn't using it.
//
// esbuild's duplicate-object-key warning surfaced this during the deploy build; in-browser Babel never
// warned, and 329 unit + 25 E2E tests never caught it. This spec locks the fix.
//
// The municipality bubble layer lives on the "한국 · 행정구역" tab at level=시군구, and `level` is local
// component state — so the spec drives the real UI rather than poking internals.
import { test, expect } from '@playwright/test';
import { bootApp, teardownDuckDB } from './helpers.mjs';

test.setTimeout(90000);
test.afterEach(async ({ page }) => teardownDuckDB(page));

// Open Map → 한국 · 행정구역 → 시군구, and wait for the bubble scatter to actually render.
async function openMunicipalityLayer(page) {
  await bootApp(page, { mode: "map" });
  await page.getByRole("button", { name: /한국.*행정구역/ }).click();
  await page.waitForTimeout(800);
  // "시군구" appears on more than one control (level toggle + a metric/label elsewhere), so target the
  // level toggle by its sibling — it's the group that also holds "시도".
  const levelBar = page.locator("button", { hasText: /^시도$/ }).first().locator("..");
  await levelBar.getByRole("button", { name: "시군구", exact: true }).click();
  // The province GeoJSON loads from a CDN; the scatter only exists once it's in.
  await page.waitForFunction(() => {
    const inst = window.Charts.lastInst;
    if (!inst) return false;
    const s = (inst.getOption().series || []).find((x) => x.type === "scatter" && x.coordinateSystem === "geo");
    return !!(s && s.data && s.data.length > 50);   // 84 municipalities; >50 rules out the Seoul layer
  }, { timeout: 30000 });
  await page.waitForTimeout(400);
}

// Read the rendered bubbles, pairing each projected point with the dataset row at the same index.
async function readBubbles(page) {
  return page.evaluate(() => {
    const inst = window.Charts.lastInst;
    const s = (inst.getOption().series || []).find((x) => x.type === "scatter" && x.coordinateSystem === "geo");
    const ds = window.NODE.datasets.find((d) => d.id === "korea_municipalities");
    return {
      points: s.data.map((d, i) => ({ name: d.name, x: d.value[0], y: d.value[1], i })),
      rows: ds.rows.map((r) => ({ name: r.name, province: r.province })),
    };
  });
}

test("all 84 municipalities render, and every bubble sits at a distinct point", async ({ page }) => {
  await openMunicipalityLayer(page);
  const { points, rows } = await readBubbles(page);

  // Nothing may be dropped: coverage is complete today, and a silent drop would look like a fixed map.
  expect(rows.length).toBe(84);
  expect(points.length).toBe(84);

  // Every municipality is a distinct place. Identical coordinates = a lookup collision (this bug).
  const keys = new Set(points.map((p) => Math.round(p.x) + "," + Math.round(p.y)));
  expect(keys.size).toBe(84);
});

test("북구 ×3 and 서구 ×3 land in their own province instead of stacking on one city", async ({ page }) => {
  await openMunicipalityLayer(page);
  const { points, rows } = await readBubbles(page);

  // The colliding names must actually be in the data, else this test proves nothing.
  expect(rows.filter((r) => r.name === "북구").length).toBe(3);
  expect(rows.filter((r) => r.name === "서구").length).toBe(3);

  for (const name of ["북구", "서구"]) {
    const idx = rows.map((r, i) => (r.name === name ? i : -1)).filter((i) => i >= 0);
    const pts = idx.map((i) => points[i]);
    expect(pts.length).toBe(3);
    // Before the fix all three shared one coordinate (the last literal entry won).
    const distinct = new Set(pts.map((p) => Math.round(p.x) + "," + Math.round(p.y)));
    expect(distinct.size, `${name} bubbles must not share a coordinate`).toBe(3);
  }
});

test("bubble position matches the province its tooltip claims", async ({ page }) => {
  await openMunicipalityLayer(page);
  const { points, rows } = await readBubbles(page);

  // Sanity anchors: 부산 북구 must be far from 광주 북구 (the exact swap this bug caused), and each
  // ambiguous district must be nearer its own metro than the others'. Distances are in projected units,
  // so we compare relative ordering rather than absolute km.
  const at = (name, province) => {
    const i = rows.findIndex((r) => r.name === name && r.province === province);
    expect(i, `${province} ${name} missing from dataset`).toBeGreaterThan(-1);
    return points[i];
  };
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  const busanBuk = at("북구", "부산광역시");
  const daeguBuk = at("북구", "대구광역시");
  const gwangjuBuk = at("북구", "광주광역시");

  // 부산 북구 belongs beside 부산진구, not beside 광산구 (Gwangju) — the old behaviour put it there.
  const busanjin = at("부산진구", "부산광역시");
  const gwangsan = at("광산구", "광주광역시");
  expect(dist(busanBuk, busanjin)).toBeLessThan(dist(busanBuk, gwangsan));

  // 대구 북구 belongs beside 수성구 (Daegu).
  const suseong = at("수성구", "대구광역시");
  expect(dist(daeguBuk, suseong)).toBeLessThan(dist(daeguBuk, busanjin));

  // 광주 북구 belongs beside 광산구 (Gwangju).
  expect(dist(gwangjuBuk, gwangsan)).toBeLessThan(dist(gwangjuBuk, busanjin));

  // 인천 서구 beside 부평구 (Incheon), 대전 서구 beside 유성구 (Daejeon).
  const incheonSeo = at("서구", "인천광역시");
  const bupyeong = at("부평구", "인천광역시");
  const daejeonSeo = at("서구", "대전광역시");
  const yuseong = at("유성구", "대전광역시");
  expect(dist(incheonSeo, bupyeong)).toBeLessThan(dist(incheonSeo, yuseong));
  expect(dist(daejeonSeo, yuseong)).toBeLessThan(dist(daejeonSeo, bupyeong));
});
