// Excel-style cell selection E2E (FOLLOWUP §5 C2). Editing the grid used to open the inline editor
// on a *single* click — "select" and "edit" were indistinguishable, colliding with P9 range-select /
// copy UX. The C2 fix: single click = select the cell (`.cellactive`, no editor), and only a
// double-click / F2 / typing a printable char opens the editor. This spec locks that contract in a
// real browser (unit tests can't reach the grid's DOM interactions).
import { test, expect } from '@playwright/test';
import { bootApp, teardownDuckDB } from './helpers.mjs';

test.setTimeout(60000);
test.afterEach(async ({ page }) => teardownDuckDB(page));

// Enter data mode, toggle Edit on, and return the locator for the first editable body cell.
async function firstEditableCell(page) {
  await bootApp(page, { activeId: "seoul_txns", mode: "data" });
  // Toggle Edit mode (button text is "편집" ko / "Edit" en, becomes "편집 중"/"Editing" when on).
  await page.getByRole("button", { name: /^(편집|Edit)$/ }).click();
  const cell = page.locator("table.grid tbody td.editable:not(.col-idx)").first();
  await cell.waitFor({ state: "visible", timeout: 5000 });
  return cell;
}

test("single click selects (no editor); double-click opens the inline editor", async ({ page }) => {
  const cell = await firstEditableCell(page);

  // 1) Single click → the cell becomes active (selected) but NO inline editor opens.
  await cell.click();
  await expect(cell).toHaveClass(/cellactive/);
  expect(await page.locator("table.grid td.editing input.cell-input").count(), "single click must NOT open an editor").toBe(0);

  // 2) Double click → the inline editor opens.
  await cell.dblclick();
  await expect(page.locator("table.grid td.editing input.cell-input")).toHaveCount(1);

  // tidy: cancel editor, restore data mode + clean save
  await page.keyboard.press("Escape");
  await page.evaluate(async () => {
    window.Store.actions.setMode("data");
    if (window.ProjectStore && window.ProjectStore.saveNow) await window.ProjectStore.saveNow();
  });
});

test("F2 on a selected cell opens the editor keeping the value; Escape closes it", async ({ page }) => {
  const cell = await firstEditableCell(page);
  await cell.click();
  await expect(cell).toHaveClass(/cellactive/);

  // The displayed cell text is *formatted* (commas / won), but the editor seeds with the raw
  // stored value — so assert F2 keeps a non-empty value, and contrast against typing (which replaces).
  await page.keyboard.press("F2");
  const input = page.locator("table.grid td.editing input.cell-input");
  await expect(input).toHaveCount(1);
  // F2 preserves the existing (non-empty) cell value in the editor rather than clearing it.
  const f2Val = (await input.inputValue()).trim();
  expect(f2Val.length, "F2 keeps the existing cell value (non-empty)").toBeGreaterThan(0);

  await page.keyboard.press("Escape");
  await expect(page.locator("table.grid td.editing input.cell-input")).toHaveCount(0);

  await page.evaluate(async () => {
    window.Store.actions.setMode("data");
    if (window.ProjectStore && window.ProjectStore.saveNow) await window.ProjectStore.saveNow();
  });
});

test("typing a printable char on a selected cell starts editing and replaces the value", async ({ page }) => {
  const cell = await firstEditableCell(page);
  await cell.click();
  await expect(cell).toHaveClass(/cellactive/);
  // A single printable key begins editing, replacing the cell content (Excel behavior).
  await cell.press("x");
  const typed = page.locator("table.grid td.editing input.cell-input");
  await expect(typed).toHaveCount(1);
  expect((await typed.inputValue()), "typing replaces the value with the typed char").toBe("x");
  await page.keyboard.press("Escape");

  await page.evaluate(async () => {
    window.Store.actions.setMode("data");
    if (window.ProjectStore && window.ProjectStore.saveNow) await window.ProjectStore.saveNow();
  });
});
