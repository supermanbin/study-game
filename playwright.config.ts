import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  // The game is physics- and frame-rate-driven: parallel browsers starve each other's frames and make
  // timing-based assertions flaky, so run serially with a generous expect timeout.
  workers: 1,
  expect: { timeout: 15_000 },
  use: { baseURL: 'http://localhost:5199' },
  webServer: {
    command: 'npm run dev -- --port 5199',
    url: 'http://localhost:5199',
    reuseExistingServer: true,
  },
});
