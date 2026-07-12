// Playwright smoke E2E — uses the system Chrome (no bundled browser download) and serves the
// no-build static app via python http.server. Catches render-rule regressions (e.g. the P0
// mode-switch "Rendered more hooks" crash) that Node/tsc can't see.
// Run: npx playwright test   (server auto-starts; reuses one already on :8742)
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  fullyParallel: false,
  // Single worker: the full-suite "worker-N process did not exit" force-kill was a parallel-teardown
  // race where a secondary worker's system-Chrome instance didn't close (subsets ran clean, the full
  // 8-spec run didn't). One worker → one browser lifecycle at a time → clean exit. The suite is small
  // and DuckDB CDN download dominates, so serial costs little.
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:8742',
    channel: 'chrome',        // system Google Chrome — no PLAYWRIGHT browser download needed
    headless: true,
    // System Chrome can leave a GPU/shared-memory helper process alive at shutdown (esp. after a
    // WASM Web Worker like DuckDB), which makes Playwright wait out a 5-min "worker did not exit"
    // force-kill. These args keep Chrome to a single process tree that exits cleanly.
    launchOptions: { args: ['--disable-gpu', '--disable-dev-shm-usage', '--no-sandbox'] },
  },
  webServer: {
    command: 'python3 -m http.server 8742',
    url: 'http://localhost:8742/index.html',
    reuseExistingServer: true,
    timeout: 20000,
  },
});
