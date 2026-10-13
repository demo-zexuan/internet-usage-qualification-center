/**
 * 二次确认对话框
 *
 * 用于重置档案、清除本地数据、交卷等不可逆操作。
 * 无障碍要求：危险操作的确认按钮必须写明具体动作，禁止使用「确定」这类模糊文案。
 *
 * @module components/common/confirm-dialog
 * @author zexuan.peng
 * @created 2026-10-14
 */

import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/form-controls';

/** 二次确认对话框属性 */
export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  /** 确认按钮文案，必须写明具体动作 */
  confirmLabel: string;
  cancelLabel?: string;
  /** 是否为危险操作（使用强调红） */
  destructive?: boolean;
  /** 需要用户输入指定文本才能确认，用于极高风险操作 */
  requireText?: string;
  /** 额外的提示内容，例如影响范围说明 */
  notice?: React.ReactNode;
  onConfirm: () => void | Promise<void>;
  /** 是否处于执行中，执行期间禁用按钮防止重复点击 */
  pending?: boolean;
}

/** 二次确认对话框 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = '取消',
  destructive = false,
  requireText,
  notice,
  onConfirm,
  pending = false,
}: ConfirmDialogProps): React.ReactElement {
  const [typed, setTyped] = React.useState('');

  // 每次打开时重置输入，避免上一次的输入残留导致误确认
  React.useEffect(() => {
    if (open) {
      setTyped('');
    }
  }, [open]);

  const canConfirm = !pending && (!requireText || typed.trim() === requireText);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription asChild>
          <div className="mt-2 text-sm leading-relaxed text-ink-soft">{description}</div>
        </DialogDescription>

        {notice ? <div className="mt-3 rounded-md border border-warn/35 bg-warn-soft/60 p-3 text-[13px] leading-relaxed text-ink-soft">{notice}</div> : null}

        {requireText ? (
          <div className="mt-4 flex flex-col gap-1.5">
            <label htmlFor="confirm-text" className="text-xs text-ink-soft">
              请输入 <span className="doc-code font-semibold text-ink">{requireText}</span> 以确认操作
            </label>
            <Input
              id="confirm-text"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              aria-invalid={typed.length > 0 && typed.trim() !== requireText}
            />
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? 'danger' : 'primary'}
            onClick={() => {
              void onConfirm();
            }}
            disabled={!canConfirm}
          >
            {pending ? '正在执行…' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
