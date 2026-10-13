/**
 * 考试卡片
 *
 * 展示一场考试的制度参数、报名资格与可执行操作。
 * 不满足报名条件时必须显示**具体原因**，而不是让按钮静默失效。
 *
 * @module components/exam/exam-card
 * @author zexuan.peng
 * @created 2026-10-14
 */

import { CircleAlert, CircleCheck, Clock, FileText, ListChecks, PlayCircle, RotateCcw, Target } from 'lucide-react';
import * as React from 'react';
import { Link } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { LevelBadge } from '@/components/common/indicators';
import { EXAM_CATEGORY_LABELS } from '@/types/exam';
import type { ExamCatalogItem } from '@/types/exam';
import type { LevelDefinition } from '@/types/level';
import { formatDateTime, formatScore, formatWaitMinutes } from '@/utils/format';
import { cn } from '@/utils/cn';

/** 考试卡片属性 */
export interface ExamCardProps {
  item: ExamCatalogItem;
  /** 对应等级定义，用于展示等级徽章 */
  level: LevelDefinition | null;
  /** 是否展示完整说明（报名页为 true，首页摘要为 false） */
  detailed?: boolean;
  className?: string;
}

/** 考试卡片 */
export function ExamCard({ item, level, detailed = false, className }: ExamCardProps): React.ReactElement {
  const { rule, eligibility } = item;

  const instructionsLink = `/exams/${rule.examId}/instructions`;

  return (
    <Card className={cn('flex flex-col', className)}>
      <CardContent className="flex flex-1 flex-col gap-3">
        {/* I. 标题与等级 */}
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold leading-snug text-ink">{rule.title}</h3>
            <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">{rule.summary}</p>
          </div>
          {level ? <LevelBadge level={level} size="sm" /> : null}
        </div>

        {/* II. 制度参数 */}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-y border-line py-3 text-[12px] sm:grid-cols-4">
          <div>
            <dt className="flex items-center gap-1 text-ink-faint">
              <ListChecks className="h-3.5 w-3.5" aria-hidden="true" />
              题目数量
            </dt>
            <dd className="tabular mt-0.5 font-medium text-ink">{rule.questionCount} 题</dd>
          </div>
          <div>
            <dt className="flex items-center gap-1 text-ink-faint">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              考试时限
            </dt>
            <dd className="tabular mt-0.5 font-medium text-ink">{rule.durationMinutes} 分钟</dd>
          </div>
          <div>
            <dt className="flex items-center gap-1 text-ink-faint">
              <Target className="h-3.5 w-3.5" aria-hidden="true" />
              及格线
            </dt>
            <dd className="tabular mt-0.5 font-medium text-ink">{rule.passScore} 分</dd>
          </div>
          <div>
            <dt className="flex items-center gap-1 text-ink-faint">
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              补考
            </dt>
            <dd className="mt-0.5 font-medium text-ink">
              {rule.allowRetake
                ? rule.retakeCooldownMinutes > 0
                  ? `允许，间隔 ${rule.retakeCooldownMinutes} 分钟`
                  : '允许，可立即重考'
                : '不允许补考'}
            </dd>
          </div>
        </dl>

        {/* III. 元信息 */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline">{EXAM_CATEGORY_LABELS[rule.category]}</Badge>
          <Badge variant="neutral">满分 {rule.totalScore} 分</Badge>
          {rule.showAnswers !== 'always' ? (
            <Badge variant="warn">
              {rule.showAnswers === 'never' ? '不展示答案' : '通过后展示答案'}
            </Badge>
          ) : null}
          {item.passed ? <Badge variant="pass">已通过</Badge> : null}
          {item.bestScore !== null ? (
            <Badge variant="info">历史最高 {formatScore(item.bestScore)} 分</Badge>
          ) : null}
          {rule.grantsCertifications && rule.grantsCertifications.length > 0 ? (
            <Badge variant="brand">授予专项能力认证</Badge>
          ) : null}
        </div>

        {/* IV. 报名资格 */}
        <div className="flex flex-col gap-1.5 text-[12px]">
          {eligibility.eligible ? (
            <p className="flex items-start gap-1.5 text-pass">
              <CircleCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>符合报名条件</span>
            </p>
          ) : (
            <div className="flex items-start gap-1.5 text-warn">
              <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-medium">暂不符合报名条件</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 leading-relaxed">
                  {eligibility.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {!item.canRetakeNow && item.retakeWaitMinutes > 0 ? (
            <p className="text-ink-faint">{formatWaitMinutes(item.retakeWaitMinutes)}</p>
          ) : null}

          {item.lastAttemptAt ? (
            <p className="text-ink-faint">最近一次考试：{formatDateTime(item.lastAttemptAt)}</p>
          ) : null}
        </div>

        {detailed ? (
          <div className="rounded-md border border-line bg-surface-muted px-3 py-2 text-[12px] leading-relaxed text-ink-soft">
            {rule.description}
          </div>
        ) : null}

        {/* V. 操作区 */}
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
          {item.inProgressAttemptId ? (
            <Button asChild size="sm">
              <Link to={`/exam/${item.inProgressAttemptId}`}>
                <PlayCircle className="h-4 w-4" aria-hidden="true" />
                继续考试
              </Link>
            </Button>
          ) : (
            <Button asChild size="sm" disabled={!eligibility.eligible}>
              <Link
                to={eligibility.eligible ? `${instructionsLink}?mode=official` : instructionsLink}
                aria-disabled={!eligibility.eligible}
                onClick={(event) => {
                  if (!eligibility.eligible) {
                    event.preventDefault();
                  }
                }}
              >
                <FileText className="h-4 w-4" aria-hidden="true" />
                {item.passed ? '重新考试' : '正式报名'}
              </Link>
            </Button>
          )}

          {rule.allowMock ? (
            <Button asChild size="sm" variant="outline">
              <Link to={`${instructionsLink}?mode=mock`}>
                <PlayCircle className="h-4 w-4" aria-hidden="true" />
                模拟考试
              </Link>
            </Button>
          ) : null}

          <Button asChild size="sm" variant="ghost">
            <Link to={instructionsLink}>考试须知</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
