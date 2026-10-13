/**
 * 选择控件
 *
 * 包含复选框与单选组，均基于 Radix 实现，支持键盘操作与屏幕阅读器。
 * 答题界面使用本模块的单选组与复选框渲染选项。
 *
 * @module components/ui/choice
 * @author zexuan.peng
 * @created 2026-10-14
 */

import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import { Check } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/utils/cn';

/** 复选框 */
export const Checkbox = React.forwardRef<
  React.ComponentRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(function Checkbox({ className, ...props }, ref) {
  return (
    <CheckboxPrimitive.Root
      ref={ref}
      className={cn(
        'flex h-5 w-5 shrink-0 items-center justify-center rounded border border-line-strong bg-surface',
        'data-[state=checked]:border-brand data-[state=checked]:bg-brand data-[state=checked]:text-on-brand',
        'disabled:cursor-not-allowed disabled:opacity-55',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center">
        <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
});

/** 单选组 */
export const RadioGroup = React.forwardRef<
  React.ComponentRef<typeof RadioGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>
>(function RadioGroup({ className, ...props }, ref) {
  return <RadioGroupPrimitive.Root ref={ref} className={cn('flex flex-col gap-2', className)} {...props} />;
});

/** 单选项 */
export const RadioGroupItem = React.forwardRef<
  React.ComponentRef<typeof RadioGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>
>(function RadioGroupItem({ className, ...props }, ref) {
  return (
    <RadioGroupPrimitive.Item
      ref={ref}
      className={cn(
        'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface',
        'data-[state=checked]:border-brand disabled:cursor-not-allowed disabled:opacity-55',
        className,
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator className="block h-2.5 w-2.5 rounded-full bg-brand" />
    </RadioGroupPrimitive.Item>
  );
});
