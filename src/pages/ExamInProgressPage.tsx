/**
 * 在线考试入口页
 *
 * 用于汇总当前进行中的考试，避免使用者需要回到报名页逐条查找。
 * 未建立档案或无进行中考试时给出明确的下一步操作。
 *
 * @module pages/ExamInProgressPage
 * @author zexuan.peng
 * @created 2026-10-14
 */

import { PlayCircle, Timer } from 'lucide-react';
import * as React from 'react';
import { Link } from 'react-router-dom';

import { useConfig } from '@/app/config-context';
import { LevelBadge } from '@/components/common/indicators';
import { PageHeader, Section } from '@/components/common/page-header';
import { EmptyState, LoadingState } from '@/components/common/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert } from '@/components/ui/feedback';
import { useUserData } from '@/hooks/use-user-data';
import { EXAM_MODE_LABELS } from '@/types/exam';
import { formatCountdown, formatDateTime } from '@/utils/format';

/** 在线考试入口页 */
export function ExamInProgressPage(): React.ReactElement {
  const { status, attempts } = useUserData();
  const { levels } = useConfig();

  const inProgress = attempts.filter((attempt) => attempt.status === 'in_progress');

  if (status === 'loading') {
    return <LoadingState label="正在读取进行中的考试" rows={3} />;
  }

  if (status === 'no-profile') {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="在线考试" description="尚未建立本地档案。" />
        <EmptyState
          title="尚未建立本地考试档案"
          description="建立档案并报名考试后，进行中的考试会显示在这里。"
          action={
            <Button asChild size="sm">
              <Link to="/">返回首页建立档案</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="考试业务"
        title="在线考试"
        description="本页面列出当前尚未结算的考试。倒计时按试卷快照中的到期时间计算，关闭浏览器不会暂停计时。"
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/exams">前往考试报名</Link>
          </Button>
        }
      />

      {inProgress.length === 0 ? (
        <EmptyState
          title="当前没有进行中的考试"
          description="报名并通过考前须知确认后，考试会出现在这里。刷新页面或关闭浏览器后可从本页面恢复未完成的考试。"
          action={
            <Button asChild size="sm">
              <Link to="/exams">前往考试报名</Link>
            </Button>
          }
        />
      ) : (
        <>
          <Alert tone="warning" title={`有 ${inProgress.length} 场考试尚未结算`}>
            考试期间关闭浏览器不会暂停计时。倒计时归零时系统会自动交卷，已作答内容以最后一次自动保存为准。
          </Alert>

          <Section title="进行中的考试">
            <ul className="flex flex-col gap-3">
              {inProgress.map((attempt) => {
                const level = levels.levels.find((item) => item.levelId === attempt.levelId) ?? null;
                const remaining = Math.max(0, attempt.expiresAt - Date.now());

                return (
                  <li key={attempt.attemptId}>
                    <Card>
                      <CardContent className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-[14px] font-semibold text-ink">{attempt.examTitle}</h3>
                            <Badge variant={attempt.mode === 'official' ? 'brand' : 'info'}>
                              {EXAM_MODE_LABELS[attempt.mode]}
                            </Badge>
                            {level ? <LevelBadge level={level} size="sm" /> : null}
                          </div>
                          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-soft">
                            <span className="flex items-center gap-1">
                              <Timer className="h-3.5 w-3.5" aria-hidden="true" />
                              剩余 <span className="tabular font-medium">{formatCountdown(remaining)}</span>
                            </span>
                            <span>开始于 {formatDateTime(attempt.startedAt)}</span>
                            <span className="tabular">
                              已作答 {Object.values(attempt.answers).filter((ids) => ids.length > 0).length} /{' '}
                              {attempt.paper.questions.length} 题
                            </span>
                          </p>
                        </div>

                        <Button asChild size="sm">
                          <Link to={`/exam/${attempt.attemptId}`}>
                            <PlayCircle className="h-4 w-4" aria-hidden="true" />
                            继续考试
                          </Link>
                        </Button>
                      </CardContent>
                    </Card>
                  </li>
                );
              })}
            </ul>
          </Section>
        </>
      )}
    </div>
  );
}
