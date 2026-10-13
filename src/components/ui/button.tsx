/**
 * 按钮组件
 *
 * 基于 class-variance-authority 定义变体，保证全站按钮尺寸与配色统一。
 * 无障碍要求：所有按钮必须有可读名称，仅图标按钮需通过 aria-label 提供。
 *
 * @module components/ui/button
 * @author zexuan.peng
 * @created 2026-10-14
 */

import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import type { VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/utils/cn';

const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors disabled:pointer-events-none disabled:opacity-55',
  {
    variants: {
      variant: {
        primary: 'bg-brand text-on-brand hover:bg-brand-strong',
        outline: 'border border-line bg-surface text-ink hover:bg-surface-muted',
        ghost: 'text-ink-soft hover:bg-surface-muted hover:text-ink',
        danger: 'bg-accent text-white hover:opacity-90',
        subtle: 'bg-surface-muted text-ink hover:bg-surface-sunken',
        link: 'text-brand underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-8 px-3 text-[13px]',
        default: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-base',
        icon: 'h-10 w-10',
      },
      block: {
        true: 'w-full',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  },
);

/** 按钮属性 */
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** 以子元素作为渲染载体（用于把链接渲染成按钮样式） */
  asChild?: boolean;
}

/** 按钮 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, block, asChild = false, type = 'button', ...props },
  ref,
) {
  const Component = asChild ? Slot : 'button';

  return (
    <Component
      ref={ref}
      type={asChild ? undefined : type}
      className={cn(buttonVariants({ variant, size, block }), className)}
      {...props}
    />
  );
});

export { buttonVariants };
