/**
 * 反馈与布局辅助组件
 *
 * 包含进度条、提示条、分隔线、骨架屏与表格基础样式。
 * 所有提示条均以「图标 + 文字」表达语义，不依赖颜色单独传达状态。
 *
 * @module components/ui/feedback
 * @author zexuan.peng
 * @created 2026-10-14
 */

import * as ProgressPrimitive from '@radix-ui/react-progress';
import * as SeparatorPrimitive from '@radix-ui/react-separator';
import { AlertTriangle, CheckCircle2, Info, OctagonAlert } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/utils/cn';

/* ============================================================
   I. 进度条
   ============================================================ */

/** 进度条属性 */
export interface ProgressProps
  extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  /** 进度值 0-100 */
  value: number;
  /** 语义色调 */
  tone?: 'brand' | 'pass' | 'fail' | 'warn';
}

const PROGRESS_TONE: Record<NonNullable<ProgressProps['tone']>, string> = {
  brand: 'bg-brand',
  pass: 'bg-pass',
  fail: 'bg-fail',
  warn: 'bg-warn',
};

/** 进度条 */
export const Progress = React.forwardRef<
  React.ComponentRef<typeof ProgressPrimitive.Root>,
  ProgressProps
>(function Progress({ className, value, tone = 'brand', ...props }, ref) {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <ProgressPrimitive.Root
      ref={ref}
      value={clamped}
      className={cn('relative h-2 w-full overflow-hidden rounded-full bg-surface-sunken', className)}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn('h-full w-full transition-transform duration-300', PROGRESS_TONE[tone])}
        style={{ transform: `translateX(-${100 - clamped}%)` }}
      />
    </ProgressPrimitive.Root>
  );
});

/* ============================================================
   II. 提示条
   ============================================================ */

/** 提示条语义 */
export type AlertTone = 'info' | 'success' | 'warning' | 'danger';

const ALERT_STYLE: Record<AlertTone, { wrapper: string; icon: React.ReactNode; label: string }> = {
  info: {
    wrapper: 'border-info/30 bg-info-soft text-ink',
    icon: <Info className="h-4 w-4 text-info" aria-hidden="true" />,
    label: '提示',
  },
  success: {
    wrapper: 'border-pass/30 bg-pass-soft text-ink',
    icon: <CheckCircle2 className="h-4 w-4 text-pass" aria-hidden="true" />,
    label: '成功',
  },
  warning: {
    wrapper: 'border-warn/30 bg-warn-soft text-ink',
    icon: <AlertTriangle className="h-4 w-4 text-warn" aria-hidden="true" />,
    label: '注意',
  },
  danger: {
    wrapper: 'border-fail/30 bg-fail-soft text-ink',
    icon: <OctagonAlert className="h-4 w-4 text-fail" aria-hidden="true" />,
    label: '错误',
  },
};

/** 提示条属性 */
export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: AlertTone;
  title?: string;
  /** 是否显示语义文字标签（默认由 title 承担） */
  iconOnly?: boolean;
}

/** 提示条 */
export function Alert({
  tone = 'info',
  title,
  className,
  children,
  iconOnly = false,
  ...props
}: AlertProps): React.ReactElement {
  const style = ALERT_STYLE[tone];

  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn('flex gap-2.5 rounded-md border px-3.5 py-3 text-sm', style.wrapper, className)}
      {...props}
    >
      <span className="mt-0.5 shrink-0">{style.icon}</span>
      <div className="min-w-0 flex-1">
        {title ? <p className="font-medium">{title}</p> : null}
        {!title && iconOnly ? <span className="sr-only">{style.label}</span> : null}
        {children ? <div className={cn('leading-relaxed', title && 'mt-1')}>{children}</div> : null}
      </div>
    </div>
  );
}

/* ============================================================
   III. 分隔线与骨架屏
   ============================================================ */

/** 分隔线 */
export const Separator = React.forwardRef<
  React.ComponentRef<typeof SeparatorPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>
>(function Separator({ className, orientation = 'horizontal', decorative = true, ...props }, ref) {
  return (
    <SeparatorPrimitive.Root
      ref={ref}
      decorative={decorative}
      orientation={orientation}
      className={cn(
        'shrink-0 bg-line',
        orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
        className,
      )}
      {...props}
    />
  );
});

/** 骨架屏：加载态占位 */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.ReactElement {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded bg-surface-sunken', className)}
      {...props}
    />
  );
}

/* ============================================================
   IV. 表格
   ============================================================ */

/** 表格容器：窄屏下允许横向滚动，避免撑破页面 */
export function TableWrapper({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.ReactElement {
  return <div className={cn('-mx-1 overflow-x-auto px-1', className)} {...props} />;
}

/** 表格 */
export function Table({
  className,
  ...props
}: React.TableHTMLAttributes<HTMLTableElement>): React.ReactElement {
  return <table className={cn('w-full border-collapse text-sm', className)} {...props} />;
}

/** 表头 */
export function TableHead({
  className,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement>): React.ReactElement {
  return (
    <th
      scope="col"
      className={cn(
        'border-b border-line bg-surface-muted px-3 py-2.5 text-left text-xs font-semibold text-ink-soft',
        className,
      )}
      {...props}
    />
  );
}

/** 单元格 */
export function TableCell({
  className,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>): React.ReactElement {
  return <td className={cn('border-b border-line px-3 py-2.5 align-top', className)} {...props} />;
}
