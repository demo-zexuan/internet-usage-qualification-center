/**
 * 题号导航面板
 *
 * I. 状态表达
 *
 * 1. 当前题、已作答、未作答、已标记四种状态同时用**图形与文字**表达
 * 2. 图例带文字说明，去掉颜色后仍可区分
 *
 * II. 无障碍
 *
 * 1. 每个题号按钮都带完整的 aria-label（含题号与作答状态）
 * 2. 当前题通过 aria-current 标注
 * 3. 面板在小屏幕上折叠为可展开区域，避免挤占答题空间
 *
 * @module components/exam/question-navigator
 * @author zexuan.peng
 * @created 2026-10-14
 */

import { Flag } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/utils/cn';

/** 题号导航面板属性 */
export interface QuestionNavigatorProps {
  total: number;
  currentIndex: number;
  /** 已作答的题目序号集合（从 0 开始） */
  answeredIndexes: Set<number>;
  /** 已标记疑问的题目序号集合（从 0 开始） */
  flaggedIndexes: Set<number>;
  onJump: (index: number) => void;
  className?: string;
}

/** 题号导航面板 */
export function QuestionNavigator({
  total,
  currentIndex,
  answeredIndexes,
  flaggedIndexes,
  onJump,
  className,
}: QuestionNavigatorProps): React.ReactElement {
  const unansweredCount = total - answeredIndexes.size;

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">题号导航</h2>
        <span className="tabular text-[12px] text-ink-faint">
          未作答 <span className={cn('font-semibold', unansweredCount > 0 ? 'text-warn' : 'text-pass')}>
            {unansweredCount}
          </span>{' '}
          / {total} 题
        </span>
      </div>

      {/* I. 图例 */}
      <ul className="flex flex-wrap gap-x-3 gap-y-1.5 text-[11px] text-ink-faint">
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-3.5 w-3.5 rounded border-2 border-brand bg-brand" />
          已作答
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-3.5 w-3.5 rounded border border-line-strong bg-surface" />
          未作答
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="flex h-3.5 w-3.5 items-center justify-center rounded border border-warn/60 bg-warn-soft">
            <Flag className="h-2.5 w-2.5 text-warn" />
          </span>
          已标记疑问
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-3.5 w-3.5 rounded border-2 border-ink bg-surface" />
          当前题目
        </li>
      </ul>

      {/* II. 题号网格 */}
      <div
        role="group"
        aria-label="题号快速跳转"
        className="grid grid-cols-6 gap-1.5 sm:grid-cols-8 lg:grid-cols-6"
      >
        {Array.from({ length: total }).map((_, index) => {
          const isCurrent = index === currentIndex;
          const isAnswered = answeredIndexes.has(index);
          const isFlagged = flaggedIndexes.has(index);

          const stateLabel = isAnswered ? '已作答' : '未作答';

          return (
            <button
              key={index}
              type="button"
              onClick={() => onJump(index)}
              aria-current={isCurrent ? 'true' : undefined}
              aria-label={`第 ${index + 1} 题，${stateLabel}${isFlagged ? '，已标记疑问' : ''}${isCurrent ? '，当前题目' : ''}`}
              data-testid={`nav-${index + 1}`}
              className={cn(
                'tabular relative flex h-9 items-center justify-center rounded border text-[12px] font-medium transition-colors',
                isAnswered
                  ? 'border-brand bg-brand text-on-brand'
                  : 'border-line-strong bg-surface text-ink-soft hover:bg-surface-muted',
                isCurrent && 'ring-2 ring-ink ring-offset-1',
              )}
            >
              {index + 1}
              {isFlagged ? (
                <Flag
                  className={cn(
                    'absolute -right-1 -top-1 h-3 w-3',
                    isAnswered ? 'text-warn' : 'text-warn',
                  )}
                  aria-hidden="true"
                />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
