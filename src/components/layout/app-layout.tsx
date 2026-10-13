/**
 * 应用整体布局
 *
 * I. 桌面端三栏结构
 *
 * 1. 顶部机构导航栏（sticky）
 * 2. 左侧业务导航（lg 以上显示）
 * 3. 中央主内容区
 * 4. 右侧资格状态面板（xl 以上显示）
 *
 * II. 移动端单列结构
 *
 * 1. 顶部精简导航 + 主内容单列 + 底部固定导航
 * 2. 底部为固定导航预留安全高度，禁止横向溢出
 *
 * III. 变体
 *
 * 1. `focus` 变体用于答题页：隐藏侧边栏与状态面板，把宽度让给题目
 *
 * @module components/layout/app-layout
 * @author zexuan.peng
 * @created 2026-10-14
 */

import * as React from 'react';
import { Outlet, useLocation } from 'react-router-dom';

import { MobileNav } from '@/components/layout/mobile-nav';
import { SideNav } from '@/components/layout/side-nav';
import { SiteFooter } from '@/components/layout/site-footer';
import { StatusPanel } from '@/components/layout/status-panel';
import { TopBar } from '@/components/layout/top-bar';
import { cn } from '@/utils/cn';

/** 主内容区容器 */
function MainRegion({ children, wide }: { children: React.ReactNode; wide?: boolean }): React.ReactElement {
  return (
    <main
      id="main-content"
      className={cn('min-w-0 flex-1', wide ? 'max-w-none' : 'max-w-none')}
    >
      {children}
    </main>
  );
}

/** 标准布局 */
export function AppLayout(): React.ReactElement {
  const location = useLocation();
  const isExamTaking = /^\/exam\/[^/]+$/.test(location.pathname);

  // 答题页进入专注模式：滚动到顶部并隐藏辅助导航
  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col bg-surface-muted">
      <a
        href="#main-content"
        className="no-print sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:shadow-lg"
      >
        跳到主要内容
      </a>

      <TopBar />

      <div className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-5 pb-24 lg:px-6 lg:pb-8">
        {isExamTaking ? (
          <MainRegion wide>
            <Outlet />
          </MainRegion>
        ) : (
          <div className="flex gap-6">
            <div className="hidden w-60 shrink-0 lg:block">
              <div className="sticky top-20">
                <SideNav />
              </div>
            </div>

            <MainRegion>
              <Outlet />
            </MainRegion>

            <div className="hidden w-72 shrink-0 xl:block">
              <div className="sticky top-20">
                <StatusPanel />
              </div>
            </div>
          </div>
        )}
      </div>

      <SiteFooter />
      <MobileNav />
    </div>
  );
}
