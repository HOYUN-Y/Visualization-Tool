// Storage durability probe + one-time notice (PLAN §12 A6).
//
// IndexedDB is not permanent: Safari ITP wipes script-writable storage after ~7 days without a visit,
// private windows discard on close, and any browser may evict under storage pressure. Users were never
// told — they'd just lose projects. ProjectStore now asks for an eviction exemption via
// StorageManager.persist() (the real mitigation) and reports the outcome via getStatus().storage:
//   granted     → durable; say nothing
//   best-effort → supported but not granted; advise a JSON backup
//   unsupported → no StorageManager / non-secure context; advise a JSON backup
//
// The notice must appear ONLY when eviction is actually possible, or it becomes noise users dismiss
// reflexively — which would defeat the point when it matters.
import { test, expect } from '@playwright/test';
import { bootApp, teardownDuckDB } from './helpers.mjs';

test.setTimeout(60000);
test.afterEach(async ({ page }) => teardownDuckDB(page));

test("init probes durability and reports a concrete storage mode", async ({ page }) => {
  await bootApp(page);
  const s = await page.evaluate(() => window.ProjectStore.getStatus());
  // Must resolve to a real verdict — "unknown" would mean the probe never ran.
  expect(["granted", "best-effort", "unsupported"]).toContain(s.storage);
});

test("a granted (durable) origin shows no notice", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "storage", {
      configurable: true,
      value: { persisted: async () => true, persist: async () => true },
    });
  });
  await bootApp(page);
  expect(await page.evaluate(() => window.ProjectStore.getStatus().storage)).toBe("granted");
  await expect(page.locator(".storage-notice")).toHaveCount(0);
});

test("a best-effort origin warns and the dismissal sticks across reloads", async ({ page }) => {
  await page.addInitScript(() => {
    // Supported, but the browser refuses the exemption → projects are evictable.
    Object.defineProperty(navigator, "storage", {
      configurable: true,
      value: { persisted: async () => false, persist: async () => false },
    });
  });
  await bootApp(page);
  expect(await page.evaluate(() => window.ProjectStore.getStatus().storage)).toBe("best-effort");

  const notice = page.locator(".storage-notice");
  await expect(notice).toBeVisible();
  await expect(notice).toContainText("Project JSON");   // points at the actual remedy

  await notice.locator("button").click();
  await expect(notice).toHaveCount(0);

  // One-time means one time — a warning that returns every load is one users learn to ignore.
  await page.reload({ waitUntil: "load" });
  await page.waitForFunction(() => document.querySelector(".app"), { timeout: 30000 });
  await page.waitForTimeout(800);
  await expect(page.locator(".storage-notice")).toHaveCount(0);
});

test("a browser without StorageManager (Safari-like) is reported unsupported and warned", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "storage", { configurable: true, value: undefined });
  });
  await bootApp(page);
  expect(await page.evaluate(() => window.ProjectStore.getStatus().storage)).toBe("unsupported");
  await expect(page.locator(".storage-notice")).toBeVisible();
});

test("a throwing StorageManager cannot break boot", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "storage", {
      configurable: true,
      value: { persisted: async () => { throw new Error("blocked by policy"); } },
    });
  });
  await bootApp(page);   // would time out if the probe took the app down
  const s = await page.evaluate(() => window.ProjectStore.getStatus());
  expect(s.storage).toBe("unsupported");
  expect(s.initialized).toBe(true);   // the app still booted and the project still loaded
  expect(s.projectId).toBeTruthy();
});
