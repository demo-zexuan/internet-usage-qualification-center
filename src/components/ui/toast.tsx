/**
 * 轻量提示（Toast）
 *
 * I. 为什么自建
 *
 * 1. 仅需要「操作结果反馈」这一种能力，引入完整组件库并不划算
 * 2. 自建可以精确控制无障碍语义：容器使用 role="status" 并支持键盘关闭
 *
 * II. 无障碍
 *
 * 1. 成功与信息类提示使用 role="status"（礼貌播报）
 * 2. 错误类提示使用 role="alert"（立即播报）
 *
 * @module components/ui/toast
 * @author zexuan.peng
 * @created 2026-10-14
 */

import { AlertTriangle, CheckCircle2, Info, X, OctagonAlert } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/utils/cn';

/** 提示语义 */
export type ToastTone = 'info' | 'success' | 'warning' | 'error';

/** 一条提示 */
export interface ToastItem {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
  /** 自动关闭时长（毫秒），0 表示不自动关闭 */
  durationMs: number;
}

/** 创建提示的入参 */
export interface ToastInput {
  title: string;
  description?: string;
  tone?: ToastTone;
  durationMs?: number;
}

interface ToastContextValue {
  /** 弹出提示 */
  toast: (input: ToastInput) => string;
  /** 手动关闭提示 */
  dismiss: (id: string) => void;
  /** 当前全部提示 */
  items: ToastItem[];
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

const TONE_STYLE: Record<ToastTone, { wrapper: string; icon: React.ReactNode }> = {
  info: {
    wrapper: 'border-info/40 bg-surface',
    icon: <Info className="h-4 w-4 text-info" aria-hidden="true" />,
  },
  success: {
    wrapper: 'border-pass/40 bg-surface',
    icon: <CheckCircle2 className="h-4 w-4 text-pass" aria-hidden="true" />,
  },
  warning: {
    wrapper: 'border-warn/40 bg-surface',
    icon: <AlertTriangle className="h-4 w-4 text-warn" aria-hidden="true" />,
  },
  error: {
    wrapper: 'border-fail/40 bg-surface',
    icon: <OctagonAlert className="h-4 w-4 text-fail" aria-hidden="true" />,
  },
};

/** 提示容器组件 */
export function ToastViewport({
  items,
  onDismiss,
}: {
  items: ToastItem[];
  onDismiss: (id: string) => void;
}): React.ReactElement | null {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="no-print pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-0 sm:top-0 sm:bottom-auto sm:items-end">
      {items.map((item) => {
        const style = TONE_STYLE[item.tone];
        return (
          <div
            key={item.id}
            role={item.tone === 'error' ? 'alert' : 'status'}
            className={cn(
              'pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-md border px-3.5 py-3 shadow-lg',
              style.wrapper,
            )}
          >
            <span className="mt-0.5 shrink-0">{style.icon}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">{item.title}</p>
              {item.description ? (
                <p className="mt-1 text-xs leading-relaxed text-ink-soft">{item.description}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(item.id)}
              aria-label="关闭提示"
              className="rounded p-0.5 text-ink-faint transition-colors hover:bg-surface-muted hover:text-ink"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

/** 提示上下文 Provider */
export function ToastProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const timers = React.useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = React.useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const toast = React.useCallback(
    (input: ToastInput): string => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const durationMs = input.durationMs ?? (input.tone === 'error' ? 8000 : 4500);

      setItems((current) => [
        ...current.slice(-3),
        {
          id,
          tone: input.tone ?? 'info',
          title: input.title,
          description: input.description,
          durationMs,
        },
      ]);

      if (durationMs > 0) {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), durationMs),
        );
      }

      return id;
    },
    [dismiss],
  );

  // 卸载时清理全部定时器，避免测试环境出现悬挂的计时器
  React.useEffect(() => {
    const map = timers.current;
    return () => {
      for (const timer of map.values()) {
        clearTimeout(timer);
      }
      map.clear();
    };
  }, []);

  const value = React.useMemo<ToastContextValue>(
    () => ({ toast, dismiss, items }),
    [toast, dismiss, items],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport items={items} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

/** 读取提示上下文 */
export function useToast(): ToastContextValue {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error('useToast 必须在 ToastProvider 内部使用');
  }
  return context;
}
