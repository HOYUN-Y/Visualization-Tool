// Playwright smoke E2E — uses the system Chrome (no bundled browser download) and serves the
// no-build static app via python http.server. Catches render-rule regressions (e.g. the P0
// mode-switch "Rendered more hooks" crash) that Node/tsc can't see.
// Run: npx playwright test   (server auto-starts; reuses one already on :8742)
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:8742',
    channel: 'chrome',        // system Google Chrome — no PLAYWRIGHT browser download needed
    headless: true,
  },
  webServer: {
    command: 'python3 -m http.server 8742',
    url: 'http://localhost:8742/index.html',
    reuseExistingServer: true,
    timeout: 20000,
  },
});
