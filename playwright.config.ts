/**
 * Playwright 端到端测试配置
 *
 * I. 被测应用
 * 1. 通过 `vite preview` 启动生产构建产物，验证真实交付形态
 * 2. 复用已存在的 4173 端口服务，便于本地反复调试
 *
 * II. 浏览器矩阵
 * 1. Desktop Chrome（桌面政务门户布局）
 * 2. Pixel 7（移动端单列布局与触控区域）
 *
 * @author zexuan.peng
 * @created 2026-10-14
 */
import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

/**
 * 被测地址
 *
 * 1. 默认启动本地生产预览服务，验证真实交付形态
 * 2. 设置 PLAYWRIGHT_BASE_URL 时改为测试该地址（例如已部署的
 *    Cloudflare Pages 站点），并跳过本地 webServer 启动
 */
const REMOTE_BASE_URL = process.env.PLAYWRIGHT_BASE_URL;
const BASE_URL = REMOTE_BASE_URL ?? `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],

  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
  },

  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 960 } },
      // 桌面端运行全部用例
      testMatch: /.*\.spec\.ts/,
    },
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 7'] },
      // 移动端只运行完整流程与响应式用例，避免重复执行全部边缘用例
      testMatch: [/full-flow\.spec\.ts/, /responsive\.spec\.ts/],
    },
  ],

  // 测试远程已部署站点时不需要也不应该启动本地预览服务
  webServer: REMOTE_BASE_URL
    ? undefined
    : {
        command: 'npm run build:only && npm run preview',
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
        stdout: 'ignore',
        stderr: 'pipe',
      },
});
