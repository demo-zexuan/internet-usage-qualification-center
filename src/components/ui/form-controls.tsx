/**
 * 表单基础组件
 *
 * 包含输入框、文本域与标签。表单错误提示必须与控件通过 aria-describedby 关联，
 * 保证屏幕阅读器能够读到错误原因。
 *
 * @module components/ui/form-controls
 * @author zexuan.peng
 * @created 2026-10-14
 */

import * as LabelPrimitive from '@radix-ui/react-label';
import * as React from 'react';

import { cn } from '@/utils/cn';

/** 输入框 */
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, type = 'text', ...props }, ref) {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          'flex h-10 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink',
          'placeholder:text-ink-faint disabled:cursor-not-allowed disabled:opacity-60',
          'aria-[invalid=true]:border-fail aria-[invalid=true]:outline-fail',
          className,
        )}
        {...props}
      />
    );
  },
);

/** 文本域 */
export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, rows = 4, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(
        'flex w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink',
        'placeholder:text-ink-faint disabled:cursor-not-allowed disabled:opacity-60',
        'aria-[invalid=true]:border-fail',
        className,
      )}
      {...props}
    />
  );
});

/** 标签 */
export const Label = React.forwardRef<
  React.ComponentRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(function Label({ className, ...props }, ref) {
  return (
    <LabelPrimitive.Root
      ref={ref}
      className={cn('text-sm font-medium leading-none text-ink', className)}
      {...props}
    />
  );
});

/** 表单字段容器：统一标签、说明与错误提示的排版 */
export interface FieldProps {
  label: string;
  htmlFor?: string;
  /** 字段说明 */
  hint?: string;
  /** 校验错误，存在时以红色文本展示并标注 aria-invalid */
  error?: string | null;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

/** 表单字段 */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
  className,
}: FieldProps): React.ReactElement {
  const hintId = htmlFor ? `${htmlFor}-hint` : undefined;
  const errorId = htmlFor ? `${htmlFor}-error` : undefined;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required ? (
          <span className="ml-0.5 text-accent" aria-hidden="true">
            *
          </span>
        ) : null}
        {required ? <span className="sr-only">（必填）</span> : null}
      </Label>

      {children}

      {hint && !error ? (
        <p id={hintId} className="text-xs leading-relaxed text-ink-faint">
          {hint}
        </p>
      ) : null}

      {error ? (
        <p id={errorId} role="alert" className="text-xs font-medium text-fail">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** 原生下拉选择：使用系统控件以保证移动端可用性与无障碍支持 */
export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, children, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={cn(
        'flex h-10 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink',
        'disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
});
