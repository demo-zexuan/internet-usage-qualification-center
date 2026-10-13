/**
 * 卡片组件
 *
 * 政务门户风格的内容容器：白底、细边框、极轻阴影，不使用大面积渐变。
 *
 * @module components/ui/card
 * @author zexuan.peng
 * @created 2026-10-14
 */

import * as React from 'react';

import { cn } from '@/utils/cn';

/** 卡片容器 */
export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function Card({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn(
          'rounded-lg border border-line bg-surface text-ink shadow-[0_1px_2px_0_rgb(16_22_29/0.05)]',
          className,
        )}
        {...props}
      />
    );
  },
);

/** 卡片头部 */
export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function CardHeader({ className, ...props }, ref) {
    return <div ref={ref} className={cn('flex flex-col gap-1 px-5 pt-5', className)} {...props} />;
  },
);

/** 卡片标题 */
export const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  function CardTitle({ className, ...props }, ref) {
    return <h3 ref={ref} className={cn('text-base font-semibold leading-tight', className)} {...props} />;
  },
);

/** 卡片说明文字 */
export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(function CardDescription({ className, ...props }, ref) {
  return <p ref={ref} className={cn('text-[13px] leading-relaxed text-ink-soft', className)} {...props} />;
});

/** 卡片内容区 */
export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function CardContent({ className, ...props }, ref) {
    return <div ref={ref} className={cn('px-5 py-4', className)} {...props} />;
  },
);

/** 卡片底部操作区 */
export const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function CardFooter({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn('flex flex-wrap items-center gap-2 border-t border-line px-5 py-3', className)}
        {...props}
      />
    );
  },
);
