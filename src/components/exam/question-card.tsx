/**
 * 题目卡片
 *
 * I. 覆盖的题型
 *
 * 1. 单选、判断：渲染为单选组
 * 2. 多选、阅读理解（多选）、观点辨析（多选）：渲染为复选框组
 * 3. 情景分析：单选或按选项分值作答，选项可展示分值提示
 * 4. 阅读理解：材料固定展示在题干上方，作答期间始终可见
 *
 * II. 无障碍
 *
 * 1. 使用 fieldset + legend 组织选项，屏幕阅读器可正确朗读题号与题干
 * 2. 选项为大尺寸触控区域（最小高度 48px），移动端易于点选
 * 3. 选中状态由控件自身状态与边框共同表达，不依赖颜色单独传达
 *
 * III. 键盘
 *
 * 1. 数字键 1-9 选择对应选项，单选题直接替换，多选题切换
 * 2. 快捷键由父级页面统一监听，本组件只负责渲染
 *
 * @module components/exam/question-card
 * @author zexuan.peng
 * @created 2026-10-14
 */

import { BookmarkCheck, BookmarkPlus, FileText } from 'lucide-react';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { PaperQuestion } from '@/types/exam';
import {
  DIFFICULTY_LABELS,
  QUESTION_CATEGORY_LABELS,
  QUESTION_TYPE_HINTS,
  QUESTION_TYPE_LABELS,
} from '@/types/question';
import { cn } from '@/utils/cn';

/** 题目卡片属性 */
export interface QuestionCardProps {
  question: PaperQuestion;
  /** 题号（从 1 开始） */
  number: number;
  total: number;
  /** 已选选项 ID */
  selectedOptionIds: string[];
  /** 是否已标记为疑问 */
  flagged: boolean;
  /** 是否使用大字号（无障碍设置） */
  largeFont?: boolean;
  onSelect: (optionId: string) => void;
  onToggleFlag: () => void;
  /** 供父级注册选项按钮引用，用于数字键快捷选择时的提示 */
  className?: string;
}

/** 题目卡片 */
export function QuestionCard({
  question,
  number,
  total,
  selectedOptionIds,
  flagged,
  largeFont = false,
  onSelect,
  onToggleFlag,
  className,
}: QuestionCardProps): React.ReactElement {
  const isMultiple = question.selection === 'multiple';
  const selectedSet = new Set(selectedOptionIds);
  const optionRefs = React.useRef(new Map<string, HTMLButtonElement>());

  return (
    <article className={cn('flex flex-col gap-4', className)} aria-labelledby="question-stem">
      {/* I. 题号与题型 */}
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="tabular rounded bg-brand px-2 py-0.5 text-[12px] font-semibold text-on-brand">
            第 {number} 题 / 共 {total} 题
          </span>
          <Badge variant="brand">{QUESTION_TYPE_LABELS[question.type]}</Badge>
          <Badge variant="neutral">{QUESTION_CATEGORY_LABELS[question.category]}</Badge>
          <Badge variant="outline">难度 {DIFFICULTY_LABELS[question.difficulty]}</Badge>
          <Badge variant="info">本题 {question.score} 分</Badge>
        </div>

        <Button
          variant={flagged ? 'subtle' : 'ghost'}
          size="sm"
          onClick={onToggleFlag}
          aria-pressed={flagged}
          aria-label={flagged ? '取消标记本题为疑问' : '标记本题为疑问'}
        >
          {flagged ? (
            <BookmarkCheck className="h-4 w-4 text-warn" aria-hidden="true" />
          ) : (
            <BookmarkPlus className="h-4 w-4" aria-hidden="true" />
          )}
          {flagged ? '已标记疑问' : '标记疑问'}
        </Button>
      </header>

      {/* II. 材料 */}
      {question.material ? (
        <section
          aria-label="题目材料"
          className="rounded-md border border-line bg-surface-muted px-4 py-3"
        >
          <p className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-soft">
            <FileText className="h-3.5 w-3.5" aria-hidden="true" />
            {question.materialTitle ?? '材料'}
          </p>
          <div
            className={cn(
              'mt-2 max-h-72 space-y-2 overflow-y-auto whitespace-pre-line leading-relaxed text-ink-soft',
              largeFont ? 'text-[15px]' : 'text-[13px]',
            )}
          >
            {question.material}
          </div>
        </section>
      ) : null}

      {/* III. 题干与选项 */}
      <fieldset className="flex flex-col gap-3">
        <legend
          id="question-stem"
          className={cn(
            'w-full font-medium leading-relaxed text-ink',
            largeFont ? 'text-[17px]' : 'text-[15px]',
          )}
        >
          {question.stem}
        </legend>

        <p className="text-[12px] text-ink-faint">
          {isMultiple
            ? '本题为多选题，请选择全部正确选项（可多选）。'
            : '本题为单选题，请选择唯一正确选项。'}
          {' '}
          {QUESTION_TYPE_HINTS[question.type]}
        </p>

        <div
          className="flex flex-col gap-2"
          role={isMultiple ? 'group' : 'radiogroup'}
          aria-label={`第 ${number} 题的选项`}
        >
          {question.options.map((option, optionIndex) => {
            const isSelected = selectedSet.has(option.id);

            return (
              <button
                key={option.id}
                type="button"
                ref={(element) => {
                  if (element) {
                    optionRefs.current.set(option.id, element);
                  } else {
                    optionRefs.current.delete(option.id);
                  }
                }}
                role={isMultiple ? 'checkbox' : 'radio'}
                aria-checked={isSelected}
                onClick={() => onSelect(option.id)}
                data-testid={`option-${option.id}`}
                className={cn(
                  'flex w-full items-start gap-3 rounded-md border px-3.5 py-3 text-left transition-colors',
                  'min-h-[48px]',
                  isSelected
                    ? 'border-brand bg-brand-soft'
                    : 'border-line bg-surface hover:border-line-strong hover:bg-surface-muted',
                )}
              >
                {/* 选项标记：单选为圆形，多选为方形 */}
                <span
                  aria-hidden="true"
                  className={cn(
                    'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border text-[11px] font-semibold',
                    isMultiple ? 'rounded' : 'rounded-full',
                    isSelected
                      ? 'border-brand bg-brand text-on-brand'
                      : 'border-line-strong bg-surface text-ink-faint',
                  )}
                >
                  {isSelected ? '✓' : optionIndex + 1}
                </span>

                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      'block leading-relaxed',
                      largeFont ? 'text-[15px]' : 'text-[13px]',
                      isSelected ? 'font-medium text-ink' : 'text-ink-soft',
                    )}
                  >
                    <span className="doc-code mr-1.5 font-semibold text-ink">{option.id}.</span>
                    {option.text}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>
    </article>
  );
}
