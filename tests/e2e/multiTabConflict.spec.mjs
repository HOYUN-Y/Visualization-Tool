// Multi-tab last-write-wins detection (PLAN §12 B1).
//
// Autosave holds a full in-memory snapshot and rewrites the whole project record every second. Two tabs
// on one project therefore overwrite each other — whoever saves last wins, and the other's work is gone
// with no error and no trace. There is no merge and shouldn't be one; the fix is to TELL the user.
// ProjectStore announces tabs over BroadcastChannel and exposes it via getStatus():
//   conflict:    a peer tab holds the same project
//   peerSavedAt: a peer has written since our last save → our snapshot is stale, saving would clobber
//
// Two real tabs are the only way to test this (BroadcastChannel doesn't deliver to the posting context),
// so it lives in E2E rather than a Node unit test.
import { test, expect } from '@playwright/test';
import { bootApp, teardownDuckDB } from './helpers.mjs';

test.setTimeout(90000);

test("a lone tab reports no conflict", async ({ page }) => {
  await bootApp(page);
  const s = await page.evaluate(() => window.ProjectStore.getStatus());
  expect(s.conflict).toBe(false);
  expect(s.peerCount).toBe(0);
  expect(s.peerSavedAt).toBe(null);
  await teardownDuckDB(page);
});

test("two tabs on the same project both detect the conflict, and a peer write marks the other stale", async ({ context }) => {
  const tabA = await context.newPage();
  await bootApp(tabA);
  const projectId = await tabA.evaluate(() => window.ProjectStore.getStatus().projectId);
  expect(projectId).toBeTruthy();

  // Second tab on the same origin → same BroadcastChannel, same persisted lastProjectId → same project.
  const tabB = await context.newPage();
  await bootApp(tabB);
  const idB = await tabB.evaluate(() => window.ProjectStore.getStatus().projectId);
  expect(idB).toBe(projectId); // both really are on the same project, else the test proves nothing

  // The announce → here handshake is async; give it a beat.
  await tabA.waitForFunction(() => window.ProjectStore.getStatus().conflict === true, { timeout: 5000 });
  await tabB.waitForFunction(() => window.ProjectStore.getStatus().conflict === true, { timeout: 5000 });

  const [sA, sB] = await Promise.all([
    tabA.evaluate(() => window.ProjectStore.getStatus()),
    tabB.evaluate(() => window.ProjectStore.getStatus()),
  ]);
  expect(sA.peerCount).toBe(1);
  expect(sB.peerCount).toBe(1);
  expect(sA.tabId).not.toBe(sB.tabId);
  expect(sA.peerSavedAt).toBe(null); // nobody has written yet

  // The badge is the whole point of the feature — it must actually render.
  await expect(tabA.locator(".tab-conflict")).toBeVisible();

  // Now tab B writes. Tab A's snapshot is now behind what's on disk.
  await tabB.evaluate(() => window.ProjectStore.saveNow());
  await tabA.waitForFunction(() => window.ProjectStore.getStatus().peerSavedAt !== null, { timeout: 5000 });

  const staleA = await tabA.evaluate(() => window.ProjectStore.getStatus());
  expect(staleA.peerSavedAt).toBeTruthy();
  await expect(tabA.locator(".tab-conflict.stale")).toBeVisible();

  // B just saved, so B itself is current — it must NOT flag itself as stale.
  const freshB = await tabB.evaluate(() => window.ProjectStore.getStatus());
  expect(freshB.peerSavedAt).toBe(null);

  // Tab A saving clears its own stale marker (its write is now the record on disk).
  await tabA.evaluate(() => window.ProjectStore.saveNow());
  const afterA = await tabA.evaluate(() => window.ProjectStore.getStatus());
  expect(afterA.peerSavedAt).toBe(null);

  await teardownDuckDB(tabA);
  await teardownDuckDB(tabB);
});

test("closing a peer tab clears the conflict", async ({ context }) => {
  const tabA = await context.newPage();
  await bootApp(tabA);
  const tabB = await context.newPage();
  await bootApp(tabB);
  await tabA.waitForFunction(() => window.ProjectStore.getStatus().conflict === true, { timeout: 5000 });

  // pagehide fires on close → peer posts "close" → A drops it. Otherwise a stale warning would linger
  // forever and users would learn to ignore the badge.
  await teardownDuckDB(tabB);
  await tabB.close();
  await tabA.waitForFunction(() => window.ProjectStore.getStatus().conflict === false, { timeout: 5000 });

  const s = await tabA.evaluate(() => window.ProjectStore.getStatus());
  expect(s.peerCount).toBe(0);
  await expect(tabA.locator(".tab-conflict")).toHaveCount(0);
  await teardownDuckDB(tabA);
});
