// In-app toasts and dialogs replacing native alert/confirm/prompt (PLAN §12 C3).
//
// Native dialogs block the event loop: an embed/iframe host freezes on them, and this very test suite
// had to pre-register `page.on("dialog", d => d.dismiss())` in bootApp or runs would hang — that
// workaround was the clearest evidence of the problem. They're also unstyleable, and Chrome silently
// suppresses repeated ones ("prevent this page from creating additional dialogs"), swallowing messages.
//
// window.UI replaces them with promise-based equivalents that mirror the native contract:
//   UI.confirm → true/false      UI.prompt → string|null (null = cancelled)      UI.toast → non-blocking
//
// The most important assertion here is the negative one: no native dialog may fire at all.
import { test, expect } from '@playwright/test';
import { bootApp, teardownDuckDB } from './helpers.mjs';

test.setTimeout(60000);
test.afterEach(async ({ page }) => teardownDuckDB(page));

// Fail loudly if anything still reaches for a native dialog. Without dismissing we'd also hang, which
// is exactly the failure mode C3 removes — so record, dismiss, and assert.
function trapNativeDialogs(page) {
  const seen = [];
  page.on("dialog", (d) => { seen.push(d.type() + ": " + d.message()); d.dismiss().catch(() => {}); });
  return seen;
}

test("UI.toast shows, stacks, and auto-dismisses", async ({ page }) => {
  await bootApp(page, { dialogDismiss: false });
  const native = trapNativeDialogs(page);

  await page.evaluate(() => window.UI.toast("first message", { type: "success" }));
  await expect(page.locator(".toast")).toHaveCount(1);
  await expect(page.locator(".toast")).toContainText("first message");
  await expect(page.locator(".toast.success")).toHaveCount(1);

  await page.evaluate(() => window.UI.toast("second message", { type: "error" }));
  await expect(page.locator(".toast")).toHaveCount(2);

  // Short duration → it must clear itself; a notice that never leaves is just clutter.
  await page.evaluate(() => window.UI.toast("brief", { duration: 400 }));
  await expect(page.locator(".toast")).toHaveCount(3);
  await page.waitForTimeout(900);
  await expect(page.locator(".toast")).toHaveCount(2);   // only the brief one went

  expect(native).toEqual([]);
});

test("UI.toast is dismissible by click", async ({ page }) => {
  await bootApp(page, { dialogDismiss: false });
  await page.evaluate(() => window.UI.toast("click me away", { duration: 0 }));
  await expect(page.locator(".toast")).toHaveCount(1);
  await page.locator(".toast").click();
  await expect(page.locator(".toast")).toHaveCount(0);
});

test("UI.confirm resolves true on 확인 and false on 취소/Escape", async ({ page }) => {
  await bootApp(page, { dialogDismiss: false });
  const native = trapNativeDialogs(page);

  // accept
  let pending = page.evaluate(() => window.UI.confirm("정말 진행할까요?", { title: "확인 필요" }));
  await expect(page.locator(".ui-dialog")).toBeVisible();
  await expect(page.locator(".ui-dialog")).toContainText("정말 진행할까요?");
  await page.locator(".ui-dialog-foot .btn.primary").click();
  expect(await pending).toBe(true);
  await expect(page.locator(".ui-dialog")).toHaveCount(0);

  // cancel
  pending = page.evaluate(() => window.UI.confirm("두 번째 질문"));
  await expect(page.locator(".ui-dialog")).toBeVisible();
  await page.locator(".ui-dialog-foot .btn.ghost").click();
  expect(await pending).toBe(false);

  // Escape cancels — native confirm did, so this must too.
  pending = page.evaluate(() => window.UI.confirm("세 번째 질문"));
  await expect(page.locator(".ui-dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  expect(await pending).toBe(false);
  await expect(page.locator(".ui-dialog")).toHaveCount(0);

  expect(native).toEqual([]);
});

test("UI.prompt returns the typed value, and null when cancelled", async ({ page }) => {
  await bootApp(page, { dialogDismiss: false });

  // default value is prefilled and preselected, so typing replaces it (like native prompt)
  let pending = page.evaluate(() => window.UI.prompt("이름을 입력하세요", { defaultValue: "기본값" }));
  await expect(page.locator(".ui-dialog-input")).toHaveValue("기본값");
  await page.locator(".ui-dialog-input").fill("새 이름");
  await page.locator(".ui-dialog-foot .btn.primary").click();
  expect(await pending).toBe("새 이름");

  // Enter submits
  pending = page.evaluate(() => window.UI.prompt("다시 입력"));
  await page.locator(".ui-dialog-input").fill("엔터로 제출");
  await page.locator(".ui-dialog-input").press("Enter");
  expect(await pending).toBe("엔터로 제출");

  // cancel → null (NOT empty string — callers branch on `== null`)
  pending = page.evaluate(() => window.UI.prompt("취소할 것"));
  await page.locator(".ui-dialog-foot .btn.ghost").click();
  expect(await pending).toBe(null);
});

test("UI.alert resolves when acknowledged and offers no cancel", async ({ page }) => {
  await bootApp(page, { dialogDismiss: false });
  const pending = page.evaluate(() => window.UI.alert("알림 내용", { title: "알림" }));
  await expect(page.locator(".ui-dialog")).toContainText("알림 내용");
  // An alert is a statement, not a question — a 취소 button would imply the action can be declined.
  await expect(page.locator(".ui-dialog-foot .btn.ghost")).toHaveCount(0);
  await page.locator(".ui-dialog-foot .btn.primary").click();
  await pending;
  await expect(page.locator(".ui-dialog")).toHaveCount(0);
});

test("renaming a project uses the in-app dialog — no native prompt fires", async ({ page }) => {
  await bootApp(page, { dialogDismiss: false });
  const native = trapNativeDialogs(page);

  await page.locator(".project-trigger").click();
  await page.getByRole("button", { name: /이름 변경|Rename/i }).first().click();

  // The real flow must reach the in-app dialog, prefilled with the current name.
  await expect(page.locator(".ui-dialog")).toBeVisible();
  const input = page.locator(".ui-dialog-input");
  await expect(input).not.toHaveValue("");
  await input.fill("이름 바뀐 프로젝트");
  await page.locator(".ui-dialog-foot .btn.primary").click();

  await page.waitForFunction(() => window.ProjectStore.getStatus().project.name === "이름 바뀐 프로젝트", { timeout: 5000 });
  expect(native).toEqual([]);   // the whole point: nothing blocked the page
});

test("deleting a project asks for confirmation in-app and honours cancel", async ({ page }) => {
  await bootApp(page, { dialogDismiss: false });
  const native = trapNativeDialogs(page);
  const before = await page.evaluate(() => window.ProjectStore.getStatus().projectId);

  await page.locator(".project-trigger").click();
  await page.getByRole("button", { name: /삭제|Delete/i }).first().click();

  await expect(page.locator(".ui-dialog")).toBeVisible();
  await expect(page.locator(".ui-dialog")).toContainText("되돌릴 수 없습니다");
  await page.locator(".ui-dialog-foot .btn.ghost").click();   // cancel

  // Cancelling must actually cancel — the project is still here.
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.ProjectStore.getStatus().projectId)).toBe(before);
  expect(native).toEqual([]);
});
