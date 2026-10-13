/**
 * 对话框组件
 *
 * 基于 Radix Dialog，自带焦点陷阱、Esc 关闭与滚动锁定。
 * 无障碍要求：标题必须提供，供屏幕阅读器朗读对话框用途。
 *
 * @module components/ui/dialog
 * @author zexuan.peng
 * @created 2026-10-14
 */

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/utils/cn';

/** 对话框根节点 */
export const Dialog = DialogPrimitive.Root;
/** 对话框触发器 */
export const DialogTrigger = DialogPrimitive.Trigger;
/** 对话框关闭按钮 */
export const DialogClose = DialogPrimitive.Close;

/** 对话框内容 */
export const DialogContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    /** 是否显示右上角关闭按钮 */
    showClose?: boolean;
  }
>(function DialogContent({ className, children, showClose = true, ...props }, ref) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        className={cn(
          'fixed inset-0 z-50 bg-slate-blue-900/45 backdrop-blur-[1px]',
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
        )}
      />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          'fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2',
          'max-h-[calc(100vh-3rem)] overflow-y-auto rounded-lg border border-line bg-surface p-5 shadow-lg',
          className,
        )}
        {...props}
      >
        {children}
        {showClose ? (
          <DialogPrimitive.Close
            className="absolute right-3 top-3 rounded p-1 text-ink-faint transition-colors hover:bg-surface-muted hover:text-ink"
            aria-label="关闭对话框"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </DialogPrimitive.Close>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
});

/** 对话框标题 */
export const DialogTitle = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(function DialogTitle({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Title
      ref={ref}
      className={cn('pr-6 text-base font-semibold leading-snug text-ink', className)}
      {...props}
    />
  );
});

/** 对话框说明 */
export const DialogDescription = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(function DialogDescription({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Description
      ref={ref}
      className={cn('mt-2 text-sm leading-relaxed text-ink-soft', className)}
      {...props}
    />
  );
});

/** 对话框底部操作区 */
export function DialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.ReactElement {
  return (
    <div
      className={cn('mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  );
}
