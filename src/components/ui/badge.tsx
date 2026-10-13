/**
 * 徽章组件
 *
 * 用于等级、状态与结果标记。无障碍要求：状态不得只用颜色表示，
 * 因此徽章必须始终携带文字标签。
 *
 * @module components/ui/badge
 * @author zexuan.peng
 * @created 2026-10-14
 */

import { cva } from 'class-variance-authority';
import type { VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/utils/cn';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium leading-5 whitespace-nowrap',
  {
    variants: {
      variant: {
        neutral: 'border-line bg-surface-muted text-ink-soft',
        brand: 'border-brand/30 bg-brand-soft text-brand',
        pass: 'border-pass/30 bg-pass-soft text-pass',
        fail: 'border-fail/30 bg-fail-soft text-fail',
        warn: 'border-warn/30 bg-warn-soft text-warn',
        info: 'border-info/30 bg-info-soft text-info',
        outline: 'border-line-strong bg-transparent text-ink-soft',
      },
      size: {
        sm: 'px-1.5 py-0 text-[11px]',
        default: '',
        lg: 'px-2.5 py-1 text-sm',
      },
    },
    defaultVariants: { variant: 'neutral', size: 'default' },
  },
);

/** 徽章属性 */
export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

/** 徽章 */
export function Badge({ className, variant, size, ...props }: BadgeProps): React.ReactElement {
  return <span className={cn(badgeVariants({ variant, size }), className)} {...props} />;
}

export { badgeVariants };
