/**
 * 交卷确认对话框
 *
 * I. 必须告知的信息
 *
 * 1. 未作答题目数量，并提供「返回继续作答」与「仍然交卷」两个选择
 * 2. 已标记疑问的题目数量，提示是否已复核
 * 3. 交卷后的不可逆性说明
 *
 * II. 幂等保护
 *
 * 1. 提交过程中禁用按钮，避免重复点击产生多次交卷请求
 * 2. 结算本身也是幂等的，重复调用不会重新判分
 *
 * @module components/exam/submit-dialog
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
import { Alert } from '@/components/ui/feedback';

/** 交卷确认对话框属性 */
export interface SubmitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 未作答题目数量 */
  unansweredCount: number;
  /** 已标记疑问题目数量 */
  flaggedCount: number;
  /** 总题数 */
  total: number;
  /** 是否由超时触发（超时自动交卷时不需要确认） */
  timedOut?: boolean;
  pending: boolean;
  onConfirm: () => void;
}

/** 交卷确认对话框 */
export function SubmitDialog({
  open,
  onOpenChange,
  unansweredCount,
  flaggedCount,
  total,
  pending,
  onConfirm,
}: SubmitDialogProps): React.ReactElement {
  const answeredCount = total - unansweredCount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>确认交卷</DialogTitle>
        <DialogDescription asChild>
          <div className="mt-2 space-y-3 text-sm leading-relaxed text-ink-soft">
            <p>
              本次考试共 {total} 题，已作答{' '}
              <strong className="tabular font-semibold text-ink">{answeredCount}</strong> 题，未作答{' '}
              <strong className="tabular font-semibold text-ink">{unansweredCount}</strong> 题。
            </p>

            {unansweredCount > 0 ? (
              <Alert tone="warning" title={`仍有 ${unansweredCount} 道题未作答`}>
                未作答题目按 0 分计。建议返回题号导航面板逐题复核后再交卷。
              </Alert>
            ) : (
              <Alert tone="success" title="所有题目均已作答">
                交卷前仍可通过题号导航面板复核已标记的疑问题目。
              </Alert>
            )}

            {flaggedCount > 0 ? (
              <p className="text-[13px]">
                你标记了 <strong className="tabular font-semibold text-ink">{flaggedCount}</strong>{' '}
                道疑问题目，建议在交卷前确认。
              </p>
            ) : null}
          </div>
        </DialogDescription>

        <div className="mt-4 rounded-md border border-fail/35 bg-fail-soft/60 p-3 text-[13px] leading-relaxed text-ink-soft">
          <p className="font-medium text-ink">交卷后不可撤销</p>
          <p className="mt-1">
            交卷后本场考试立即结算并锁定答卷，无法再修改任何答案。系统将自动判分并生成成绩，
            通过正式考试时将同时签发电子证件。
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            返回继续作答
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={pending} data-testid="confirm-submit">
            {pending ? '正在结算…' : '确认交卷并结算'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
