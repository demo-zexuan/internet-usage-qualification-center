/**
 * 考试倒计时组件
 *
 * I. 显示策略
 *
 * 1. 常规状态以等宽字体显示 MM:SS，剩余不足 5 分钟转为警示色，不足 1 分钟转为危险色
 * 2. 状态同时以文字说明表达（例如「剩余不足 1 分钟」），不依赖颜色单独传达
 *
 * II. 无障碍
 *
 * 1. 每秒变化的数字不做实时播报，避免屏幕阅读器被噪声淹没
 * 2. 在 10 分钟、5 分钟与 1 分钟节点通过独立的 live region 播报一次
 *
 * @module components/exam/exam-timer
 * @author zexuan.peng
 * @created 2026-10-14
 */

import { Clock } from 'lucide-react';
import * as React from 'react';

import { formatCountdown } from '@/utils/format';
import { cn } from '@/utils/cn';

/** 需要播报的时间节点（毫秒） */
const ANNOUNCE_THRESHOLDS = [10 * 60 * 1000, 5 * 60 * 1000, 60 * 1000];

/** 倒计时属性 */
export interface ExamTimerProps {
  /** 剩余毫秒数 */
  remainingMs: number;
  className?: string;
}

/** 考试倒计时 */
export function ExamTimer({ remainingMs, className }: ExamTimerProps): React.ReactElement {
  const [announcement, setAnnouncement] = React.useState('');
  const announcedRef = React.useRef(new Set<number>());

  // 到点播报：每个阈值只播报一次
  React.useEffect(() => {
    for (const threshold of ANNOUNCE_THRESHOLDS) {
      if (remainingMs <= threshold && !announcedRef.current.has(threshold)) {
        announcedRef.current.add(threshold);
        const minutes = threshold / 60000;
        setAnnouncement(
          minutes >= 1 ? `考试剩余时间不足 ${minutes} 分钟。` : '考试剩余时间不足 1 分钟。',
        );
      }
    }
  }, [remainingMs]);

  const isCritical = remainingMs <= 60 * 1000;
  const isWarning = remainingMs <= 5 * 60 * 1000;

  const statusLabel = isCritical
    ? '剩余不足 1 分钟'
    : isWarning
      ? '剩余不足 5 分钟'
      : '考试进行中';

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-md border px-3 py-2',
        isCritical
          ? 'border-fail/50 bg-fail-soft'
          : isWarning
            ? 'border-warn/50 bg-warn-soft'
            : 'border-line bg-surface',
        className,
      )}
    >
      <Clock
        className={cn(
          'h-4 w-4 shrink-0',
          isCritical ? 'text-fail' : isWarning ? 'text-warn' : 'text-ink-faint',
        )}
        aria-hidden="true"
      />

      <div className="min-w-0">
        <p className="text-[10px] leading-none text-ink-faint">剩余时间</p>
        <p
          className={cn(
            'tabular text-lg font-semibold leading-tight',
            isCritical ? 'text-fail' : isWarning ? 'text-warn' : 'text-ink',
          )}
          data-testid="exam-countdown"
        >
          {formatCountdown(remainingMs)}
        </p>
      </div>

      <span className="sr-only" role="status" aria-live="polite">
        {announcement}
      </span>

      <span
        className={cn(
          'ml-1 hidden text-[11px] sm:block',
          isCritical ? 'font-medium text-fail' : isWarning ? 'font-medium text-warn' : 'text-ink-faint',
        )}
      >
        {statusLabel}
      </span>
    </div>
  );
}
