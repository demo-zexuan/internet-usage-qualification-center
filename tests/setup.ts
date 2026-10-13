/**
 * Vitest 全局测试环境准备
 *
 * I. 断言扩展
 * 1. 注册 @testing-library/jest-dom 匹配器
 *
 * II. 浏览器能力补全
 * 1. 注入 fake-indexeddb，使 Dexie 数据层可在 Node 环境中运行
 * 2. 补全 jsdom 缺失的 matchMedia / ResizeObserver / scrollTo 等 API
 *
 * @author zexuan.peng
 * @created 2026-10-14
 */
import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';

// I. 注入内存版 IndexedDB 实现（必须在任何 Dexie 实例创建之前完成）
import 'fake-indexeddb/auto';

// II. 补全 jsdom 未实现的浏览器 API
if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe(): void {
      /* 测试环境无需真实观察尺寸变化 */
    }
    unobserve(): void {
      /* noop */
    }
    disconnect(): void {
      /* noop */
    }
  } as unknown as typeof ResizeObserver;
}

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView(): void {
    /* noop */
  };
}

// III. 每个用例后卸载 React 树，避免 DOM 泄漏到下一个用例
afterEach(() => {
  cleanup();
});

// IV. 每个用例前清理 localStorage，保证用例之间互不影响
beforeEach(() => {
  window.localStorage.clear();
});
