// useStore skips re-renders when a component's selected slice is unchanged (PLAN §12 C1).
// Mount a probe selecting ONE slice, count renders, fire an unrelated update then a related one.
import { test, expect } from '@playwright/test';
import { bootApp, teardownDuckDB } from './helpers.mjs';

test.setTimeout(60000);
test.afterEach(async ({ page }) => teardownDuckDB(page));

test('a probe on s.mode skips an unrelated ui update, re-renders on a mode change', async ({ page }) => {
  await bootApp(page, { mode: 'data' });
  const r = await page.evaluate(async () => {
    const React = window.React, ReactDOM = window.ReactDOM, S = window.Store;
    const container = document.createElement('div'); document.body.appendChild(container);
    let renders = 0;
    function Probe() { const m = S.useStore((s) => s.mode); renders++; return React.createElement('span', null, m); }
    const root = ReactDOM.createRoot(container);
    await new Promise((res) => { root.render(React.createElement(Probe)); setTimeout(res, 80); });
    const afterMount = renders;
    S.actions.setUI({ aiOpen: true }); S.actions.setUI({ aiOpen: false });
    await new Promise((res) => setTimeout(res, 80));
    const afterUnrelated = renders;
    S.actions.setMode('clean');
    await new Promise((res) => setTimeout(res, 80));
    const afterRelated = renders;
    root.unmount(); container.remove(); S.actions.setMode('data');
    return { afterMount, afterUnrelated, afterRelated };
  });
  expect(r.afterUnrelated, 'unrelated ui update must not re-render a s.mode subscriber').toBe(r.afterMount);
  expect(r.afterRelated, 'a mode change must re-render').toBeGreaterThan(r.afterUnrelated);
});
