/**
 * 标签页组件
 *
 * 基于 Radix Tabs，支持方向键切换与正确的 aria 关联。
 * 用于成绩页的「作答明细 / 成绩概览」以及权限中心的分组切换。
 *
 * @module components/ui/tabs
 * @author zexuan.peng
 * @created 2026-10-14
 */

import * as TabsPrimitive from '@radix-ui/react-tabs';
import * as React from 'react';

import { cn } from '@/utils/cn';

/** 标签页根节点 */
export const Tabs = TabsPrimitive.Root;

/** 标签页导航条 */
export const TabsList = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(function TabsList({ className, ...props }, ref) {
  return (
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        'flex w-full flex-wrap items-center gap-1 rounded-md border border-line bg-surface-muted p-1',
        className,
      )}
      {...props}
    />
  );
});

/** 单个标签 */
export const TabsTrigger = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(function TabsTrigger({ className, ...props }, ref) {
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded px-3 py-1.5 text-[13px] font-medium text-ink-soft transition-colors',
        'hover:text-ink',
        'data-[state=active]:bg-surface data-[state=active]:text-ink data-[state=active]:shadow-sm',
        className,
      )}
      {...props}
    />
  );
});

/** 标签内容面板 */
export const TabsContent = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(function TabsContent({ className, ...props }, ref) {
  return <TabsPrimitive.Content ref={ref} className={cn('mt-4', className)} {...props} />;
});
