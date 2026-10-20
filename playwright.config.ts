import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/ui', workers: 1, timeout: 60000,
  use: { baseURL: 'http://127.0.0.1:8082', viewport: { width: 390, height: 844 }, headless: true,
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {},
    screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: { command: 'npx expo start --offline --port 8082', url: 'http://127.0.0.1:8082/status', reuseExistingServer: false, timeout: 120000,
    env: { EXPO_PUBLIC_MOCKAPI_URL: 'https://bit240115-test.mockapi.io/api/v1' } },
});
