/// <reference types="vitest/config" />
/**
 * Vite 构建与 Vitest 测试统一配置
 *
 * I. 构建插件
 * 1. React 插件（自动 JSX 运行时 + Fast Refresh）
 * 2. Tailwind CSS v4 Vite 插件（CSS-first 配置）
 *
 * II. 路径别名
 * 1. `@/*` 映射到 `src/*`，与 tsconfig.paths 保持一致
 *
 * III. 测试配置
 * 1. jsdom 环境用于组件测试
 * 2. fake-indexeddb 在 setup 中注入，用于数据层测试
 *
 * @author zexuan.peng
 * @created 2026-10-14
 */
import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },

  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
  },

  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: [
      'tests/unit/**/*.test.{ts,tsx}',
      'tests/integration/**/*.test.{ts,tsx}',
    ],
    exclude: ['tests/e2e/**', 'node_modules/**', 'dist/**'],
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        'src/main.tsx',
        'src/data/**',
        'src/components/ui/**',
      ],
    },
  },
});
