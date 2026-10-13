/**
 * 应用入口
 *
 * I. 渲染顺序
 *
 * 1. 挂载全局错误边界，捕获渲染期异常
 * 2. 挂载全局 Provider（主题、提示、启动门与配置上下文）
 * 3. 挂载路由
 *
 * II. 说明
 *
 * 1. 不使用 StrictMode 的双重挂载调试行为，避免考试自动保存与计时逻辑被重复触发
 * 2. 全部数据初始化在 BootstrapGate 中完成，失败时展示可读错误
 *
 * @author zexuan.peng
 * @created 2026-10-14
 */

import { createRoot } from 'react-dom/client';

import { ErrorBoundary } from '@/app/error-boundary';
import { AppProviders } from '@/app/providers';
import { AppRouter } from '@/app/router';

import '@/index.css';

const container = document.getElementById('root');

if (!container) {
  throw new Error('找不到应用挂载节点 #root');
}

createRoot(container).render(
  <ErrorBoundary>
    <AppProviders>
      <AppRouter />
    </AppProviders>
  </ErrorBoundary>,
);
