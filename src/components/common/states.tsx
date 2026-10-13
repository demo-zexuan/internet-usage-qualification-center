/**
 * 通用状态组件
 *
 * I. 覆盖的页面状态
 *
 * 1. 加载中（骨架屏 + 文字说明，不使用无意义转圈）
 * 2. 空数据（说明为什么为空，并给出下一步操作）
 * 3. 错误（面向用户的中文说明 + 可选的修复建议与错误码）
 * 4. 无权限（说明所需等级与升级路径）
 *
 * II. 无障碍
 *
 * 1. 加载态使用 aria-busy 与 role="status"
 * 2. 错误态使用 role="alert"，确保屏幕阅读器立即播报
 *
 * @module components/common/states
 * @author zexuan.peng
 * @created 2026-10-14
 */

import { AlertTriangle, Inbox, Loader2, ShieldAlert } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/feedback';
import { cn } from '@/utils/cn';

/** 加载态 */
export function LoadingState({
  label = '正在载入数据',
  description,
  rows = 3,
  className,
}: {
  label?: string;
  description?: string;
  rows?: number;
  className?: string;
}): React.ReactElement {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={cn('flex flex-col gap-3 rounded-lg border border-line bg-surface p-5', className)}
    >
      <div className="flex items-center gap-2 text-sm text-ink-soft">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        <span>{label}</span>
      </div>
      {description ? <p className="text-xs text-ink-faint">{description}</p> : null}
      <div className="mt-1 flex flex-col gap-2">
        {Array.from({ length: rows }).map((_, index) => (
          <Skeleton key={index} className="h-4" style={{ width: `${88 - index * 12}%` }} />
        ))}
      </div>
    </div>
  );
}

/** 空数据态 */
export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}): React.ReactElement {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 rounded-lg border border-dashed border-line bg-surface px-5 py-10 text-center',
        className,
      )}
    >
      <span className="text-ink-faint">
        {icon ?? <Inbox className="h-8 w-8" aria-hidden="true" />}
      </span>
      <div>
        <p className="text-sm font-medium text-ink">{title}</p>
        {description ? (
          <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-ink-soft">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

/** 错误态 */
export function ErrorState({
  title = '操作未能完成',
  message,
  hint,
  code,
  details,
  onRetry,
  retryLabel = '重试',
  className,
}: {
  title?: string;
  message: string;
  hint?: string;
  code?: string;
  details?: string[];
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}): React.ReactElement {
  const [showDetails, setShowDetails] = React.useState(false);

  return (
    <div
      role="alert"
      className={cn('rounded-lg border border-fail/35 bg-fail-soft/60 p-5', className)}
    >
      <div className="flex gap-2.5">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-fail" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">{title}</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">{message}</p>
          {hint ? <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">建议：{hint}</p> : null}

          {details && details.length > 0 ? (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setShowDetails((current) => !current)}
                className="text-xs font-medium text-brand underline-offset-4 hover:underline"
                aria-expanded={showDetails}
              >
                {showDetails ? '收起技术细节' : `查看技术细节（${details.length} 条）`}
              </button>
              {showDetails ? (
                <ul className="mt-2 space-y-1 rounded border border-line bg-surface p-2.5 font-mono text-[11px] leading-relaxed text-ink-soft">
                  {details.map((detail, index) => (
                    <li key={index} className="break-all">
                      {detail}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {onRetry ? (
              <Button size="sm" variant="outline" onClick={onRetry}>
                {retryLabel}
              </Button>
            ) : null}
            {code ? <span className="text-[11px] text-ink-faint">错误码：{code}</span> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

/** 无权限态 */
export function PermissionDeniedState({
  title = '当前等级尚不能使用此功能',
  reason,
  requirement,
  advice,
  action,
  className,
}: {
  title?: string;
  reason?: string | null;
  requirement?: string;
  advice?: string;
  action?: React.ReactNode;
  className?: string;
}): React.ReactElement {
  return (
    <div
      className={cn(
        'rounded-lg border border-warn/35 bg-warn-soft/60 p-5 text-center sm:text-left',
        className,
      )}
    >
      <div className="flex flex-col items-center gap-2.5 sm:flex-row sm:items-start">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-warn" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">{title}</p>
          {reason ? <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">{reason}</p> : null}
          {requirement ? (
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">解锁条件：{requirement}</p>
          ) : null}
          {advice ? (
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">升级建议：{advice}</p>
          ) : null}
          {action ? <div className="mt-3">{action}</div> : null}
        </div>
      </div>
    </div>
  );
}
