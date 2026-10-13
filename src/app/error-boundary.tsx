/**
 * 全局错误边界
 *
 * I. 职责
 *
 * 1. 捕获渲染期间未预期的异常，避免整页白屏
 * 2. 展示可理解的中文说明与恢复操作，绝不展示原始堆栈
 *
 * II. 恢复手段
 *
 * 1. 重新渲染当前页面
 * 2. 返回首页
 * 3. 清除本地数据并重新加载（用于本地数据损坏的情形）
 *
 * @module app/error-boundary
 * @author zexuan.peng
 * @created 2026-10-14
 */

import { RefreshCw, RotateCcw } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Emblem } from '@/components/layout/emblem';

interface ErrorBoundaryState {
  error: Error | null;
}

/** 全局错误边界 */
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error): void {
    // 仅在控制台保留技术细节，界面不展示堆栈
    console.error('[IUQA] 渲染期间发生未预期的错误：', error);
  }

  private readonly handleReload = (): void => {
    window.location.reload();
  };

  private readonly handleReset = (): void => {
    try {
      window.indexedDB.deleteDatabase('iuqa-local-authority');
    } catch {
      // 删除失败时仍继续重新加载，由启动流程再次报告问题
    }
    window.location.reload();
  };

  override render(): React.ReactNode {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-surface-muted px-4 py-10">
        <div className="flex flex-col items-center gap-3 text-center">
          <Emblem size={52} />
          <p className="text-lg font-semibold text-ink">互联网使用资格考试中心</p>
          <p className="text-[11px] uppercase tracking-[0.18em] text-ink-faint">IUQA</p>
        </div>

        <Card className="w-full max-w-2xl">
          <CardContent className="flex flex-col gap-4">
            <div>
              <h1 className="text-base font-semibold text-ink">页面渲染出现异常</h1>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
                当前页面在渲染时遇到未预期的错误。你的本地数据通常不会因此丢失，
                可先尝试重新加载页面；若问题持续出现，再考虑清除本地数据。
              </p>
            </div>

            <div className="rounded-md border border-warn/35 bg-warn-soft/60 px-3.5 py-3 text-[12px] leading-relaxed text-ink-soft">
              <p className="font-medium text-ink">技术细节（供排查使用）</p>
              <p className="mt-1 break-all font-mono text-[11px]">
                {this.state.error.name}: {this.state.error.message}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={this.handleReload}>
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                重新加载页面
              </Button>
              <Button size="sm" variant="outline" onClick={() => { window.location.href = '/'; }}>
                返回首页
              </Button>
              <Button size="sm" variant="danger" onClick={this.handleReset}>
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                清除本地数据并重载
              </Button>
            </div>

            <p className="text-[11px] leading-relaxed text-ink-faint">
              注意：清除本地数据会删除全部考生档案、考试记录与电子证件，且无法恢复。
              仅在确认数据损坏且无需保留时使用。
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }
}
