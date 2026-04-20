import { defineConfig } from '@playwright/test';

/**
 * Playwright + Electron 测试配置
 * 使用 Electron 作为测试目标，不需要 webServer
 */
export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,          // Electron 测试通常串行更稳定
  retries: 0,
  reporter: [['html', { open: 'never' }]],
  outputDir: './test-results',
});
