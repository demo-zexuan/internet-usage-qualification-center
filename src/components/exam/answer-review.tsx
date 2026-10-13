/**
 * 答卷复核列表
 *
 * I. 展示内容
 *
 * 1. 每题得分、作答状态、考生所选与正确答案
 * 2. 答案解析、错误原因与关联知识点
 * 3. 情景分析题的选项分值与选择后果说明
 *
 * II. 答案可见性
 *
 * 1. 是否展示正确答案与解析由 `ExamResult.answersVisible` 决定
 * 2. 规则设置为不展示答案时，只展示得分与作答状态，不泄露答案内容
 *
 * @module components/exam/answer-review
 * @author zexuan.peng
 * @created 2026-10-14
 */

import { AlertTriangle, Check, Lightbulb, X } from 'lucide-react';
import * as React from 'react';

import { AnswerStatusBadge } from '@/components/common/indicators';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/feedback';
import type { ExamAttempt, QuestionResult } from '@/types/exam';
import type { PaperQuestion } from '@/types/exam';
import {
  DIFFICULTY_LABELS,
  QUESTION_CATEGORY_LABELS,
  QUESTION_TYPE_LABELS,
} from '@/types/question';
import { formatScore } from '@/utils/format';
import { cn } from '@/utils/cn';

/**
 * 生成错误原因说明
 *
 * 依据作答状态与题型给出具体原因，而不是笼统地显示「答错」。
 */
function describeMistake(result: QuestionResult, question: PaperQuestion): string | null {
  switch (result.status) {
    case 'correct':
      return null;

    case 'unanswered':
      return '本题未作答，按 0 分计。未作答不适用倒扣分。';

    case 'partial':
      if (question.scoring.mode === 'points') {
        return '本题为情景分析题，所选做法的预设得分低于满分。不同处理方式对应的后果与分值不同。';
      }
      return '本题为多选题，采用了部分得分规则：选对了部分正确选项，但因未选全或存在错选而未能获得满分。';

    case 'wrong':
    default: {
      if (question.scoring.mode === 'points') {
        return '本题为情景分析题，所选做法属于明显风险项或未得分项。';
      }
      if (question.selection === 'multiple') {
        const missing = result.correctOptionIds.filter(
          (id) => !result.selectedOptionIds.includes(id),
        );
        const extra = result.selectedOptionIds.filter(
          (id) => !result.correctOptionIds.includes(id),
        );

        const parts: string[] = [];
        if (missing.length > 0) {
          parts.push(`漏选 ${missing.join('、')}`);
        }
        if (extra.length > 0) {
          parts.push(`错选 ${extra.join('、')}`);
        }
        return `多选题采用严格匹配评分，选项集合必须完全一致。本题${parts.join('，') || '选项集合与正确答案不一致'}。`;
      }
      return '所选选项与正确答案不一致。';
    }
  }
}

/** 答卷复核属性 */
export interface AnswerReviewProps {
  attempt: ExamAttempt;
  results: QuestionResult[];
  answersVisible: boolean;
  className?: string;
}

/** 答卷复核列表 */
export function AnswerReview({
  attempt,
  results,
  answersVisible,
  className,
}: AnswerReviewProps): React.ReactElement {
  const questionMap = new Map(attempt.paper.questions.map((question) => [question.questionId, question]));

  return (
    <ol className={cn('flex flex-col gap-3', className)}>
      {results.map((result, index) => {
        const question = questionMap.get(result.questionId);
        const mistake = question ? describeMistake(result, question) : null;
        const isCorrect = result.status === 'correct';

        return (
          <li key={result.questionId}>
            <article
              className={cn(
                'rounded-lg border bg-surface p-4',
                isCorrect ? 'border-pass/35' : result.status === 'unanswered' ? 'border-line' : 'border-fail/35',
              )}
            >
              {/* I. 头部 */}
              <header className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="tabular rounded bg-surface-muted px-2 py-0.5 text-[12px] font-semibold text-ink-soft">
                    第 {index + 1} 题
                  </span>
                  <AnswerStatusBadge status={result.status} />
                  {result.flagged ? <Badge variant="warn">曾标记疑问</Badge> : null}
                  <Badge variant="neutral">{QUESTION_TYPE_LABELS[result.type]}</Badge>
                  <Badge variant="outline">{QUESTION_CATEGORY_LABELS[result.category]}</Badge>
                  <Badge variant="outline">难度 {DIFFICULTY_LABELS[result.difficulty]}</Badge>
                </div>

                <span className="tabular text-[13px] font-semibold text-ink">
                  {formatScore(result.earnedScore)} / {formatScore(result.maxScore)} 分
                </span>
              </header>

              {/* II. 题干与材料 */}
              {question?.material ? (
                <details className="mt-3 rounded-md border border-line bg-surface-muted px-3.5 py-2.5">
                  <summary className="cursor-pointer text-[12px] font-medium text-ink-soft">
                    {question.materialTitle ?? '题目材料'}（点击展开）
                  </summary>
                  <div className="mt-2 max-h-64 overflow-y-auto whitespace-pre-line text-[12px] leading-relaxed text-ink-soft">
                    {question.material}
                  </div>
                </details>
              ) : null}

              <p className="mt-3 text-[13px] font-medium leading-relaxed text-ink">{result.stem}</p>

              {/* III. 选项对照 */}
              {question ? (
                <ul className="mt-3 flex flex-col gap-1.5">
                  {question.options.map((option) => {
                    const wasSelected = result.selectedOptionIds.includes(option.id);
                    const isAnswer = answersVisible && result.correctOptionIds.includes(option.id);

                    return (
                      <li
                        key={option.id}
                        className={cn(
                          'flex items-start gap-2 rounded border px-3 py-2 text-[12px] leading-relaxed',
                          isAnswer
                            ? 'border-pass/45 bg-pass-soft'
                            : wasSelected
                              ? 'border-fail/40 bg-fail-soft'
                              : 'border-line bg-surface',
                        )}
                      >
                        <span className="mt-0.5 flex shrink-0 items-center gap-1">
                          {isAnswer ? (
                            <Check className="h-3.5 w-3.5 text-pass" aria-hidden="true" />
                          ) : wasSelected ? (
                            <X className="h-3.5 w-3.5 text-fail" aria-hidden="true" />
                          ) : (
                            <span className="h-3.5 w-3.5" aria-hidden="true" />
                          )}
                        </span>

                        <span className="min-w-0 flex-1 text-ink-soft">
                          <span className="doc-code mr-1 font-semibold text-ink">{option.id}.</span>
                          {option.text}
                          {option.points !== undefined && answersVisible ? (
                            <span className="ml-1 text-ink-faint">（该选项 {option.points} 分）</span>
                          ) : null}
                          {option.rationale && answersVisible ? (
                            <span className="mt-1 block text-[11px] text-ink-faint">{option.rationale}</span>
                          ) : null}
                        </span>

                        <span className="flex shrink-0 flex-col items-end gap-0.5 text-[11px]">
                          {wasSelected ? <span className="text-ink-soft">你的选择</span> : null}
                          {isAnswer ? <span className="text-pass">正确答案</span> : null}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : null}

              {/* IV. 作答摘要 */}
              <dl className="mt-3 grid gap-1.5 text-[12px] sm:grid-cols-2">
                <div className="flex gap-2">
                  <dt className="shrink-0 text-ink-faint">你的作答</dt>
                  <dd className="font-medium text-ink">
                    {result.selectedOptionIds.length > 0 ? result.selectedOptionIds.join('、') : '未作答'}
                  </dd>
                </div>
                {answersVisible ? (
                  <div className="flex gap-2">
                    <dt className="shrink-0 text-ink-faint">
                      {question?.scoring.mode === 'points' ? '参考最优选项' : '正确答案'}
                    </dt>
                    <dd className="font-medium text-pass">{result.correctOptionIds.join('、')}</dd>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <dt className="shrink-0 text-ink-faint">正确答案</dt>
                    <dd className="text-ink-faint">本场考试不展示正确答案</dd>
                  </div>
                )}
              </dl>

              {/* V. 错误原因 */}
              {mistake ? (
                <div className="mt-3 flex items-start gap-2 rounded-md border border-fail/30 bg-fail-soft/50 px-3 py-2 text-[12px] leading-relaxed text-ink-soft">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-fail" aria-hidden="true" />
                  <span>
                    <span className="font-medium text-ink">错误原因：</span>
                    {mistake}
                  </span>
                </div>
              ) : null}

              {/* VI. 解析与知识点 */}
              {answersVisible ? (
                <div className="mt-3 rounded-md border border-line bg-surface-muted px-3.5 py-3">
                  <p className="flex items-center gap-1.5 text-[12px] font-semibold text-ink">
                    <Lightbulb className="h-3.5 w-3.5 text-brand" aria-hidden="true" />
                    答案解析
                  </p>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-ink-soft">{result.explanation}</p>

                  {result.multipleValidViewpoints ? (
                    <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">
                      本题标注为存在多种可辩护立场：评分只针对论证方式、证据充分性与逻辑一致性，
                      不针对立场本身。
                    </p>
                  ) : null}

                  {result.knowledgePoints.length > 0 ? (
                    <div className="mt-2.5">
                      <p className="text-[11px] text-ink-faint">相关知识点</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {result.knowledgePoints.map((point) => (
                          <Badge key={point} variant="info" size="sm">
                            {point}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </article>
          </li>
        );
      })}
    </ol>
  );
}

/** 答案不可见时的说明条 */
export function AnswersHiddenNotice(): React.ReactElement {
  return (
    <Alert tone="info" title="本场考试不展示正确答案与解析">
      该场考试的规则设置为隐藏答案。你可以查看每题的得分与作答状态，但系统不会展示正确答案与解析内容。
      如需完整复盘，可参加同一考试的模拟考试。
    </Alert>
  );
}
