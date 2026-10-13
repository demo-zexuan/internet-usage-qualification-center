/**
 * 右侧资格状态面板
 *
 * I. 展示内容
 *
 * 1. 当前资格等级与有效证件编号
 * 2. 距离下一等级还需完成的条件
 * 3. 进行中的考试提醒
 * 4. 最新公告
 *
 * II. 数据来源
 *
 * 全部数据来自 `useUserData` 的派生结果，面板本身不进行任何业务计算。
 *
 * @module components/layout/status-panel
 * @author zexuan.peng
 * @created 2026-10-14
 */

import { CircleCheck, CircleDashed, Clock, Megaphone } from 'lucide-react';
import * as React from 'react';
import { Link } from 'react-router-dom';

import { useConfig } from '@/app/config-context';
import { LevelBadge } from '@/components/common/indicators';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useUserData } from '@/hooks/use-user-data';
import { formatDate } from '@/utils/format';
import { cn } from '@/utils/cn';

/** 右侧资格状态面板 */
export function StatusPanel({ className }: { className?: string }): React.ReactElement | null {
  const { summary, status, attempts } = useUserData();
  const { announcements } = useConfig();

  if (status !== 'ready' || !summary) {
    return null;
  }

  const inProgress = attempts.find((attempt) => attempt.status === 'in_progress');
  const pendingRequirements = summary.nextLevelRequirements.filter((item) => !item.satisfied);
  const latestAnnouncements = [...announcements.announcements]
    .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, 2);

  return (
    <aside aria-label="资格状态面板" className={cn('flex flex-col gap-3', className)}>
      {/* I. 当前资格 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">当前资格</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 pt-0">
          <LevelBadge
            level={summary.currentLevel}
            temporary={!summary.levelFromCertificate}
            size="lg"
            className="self-start"
          />

          <dl className="flex flex-col gap-1.5 text-[12px]">
            <div className="flex items-center justify-between gap-2">
              <dt className="text-ink-faint">有效证件</dt>
              <dd className="truncate text-right">
                {summary.activeCertificate ? (
                  <Link
                    to={`/certificate/${summary.activeCertificate.certificateId}`}
                    className="doc-code text-brand underline-offset-4 hover:underline"
                  >
                    {summary.activeCertificate.certificateNumber}
                  </Link>
                ) : (
                  <span className="text-ink-soft">尚未签发</span>
                )}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-ink-faint">累计考试</dt>
              <dd className="tabular text-right text-ink-soft">
                {summary.totalAttemptCount} 次 / 通过 {summary.passedAttemptCount} 次
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-ink-faint">最近考试</dt>
              <dd className="tabular text-right text-ink-soft">
                {summary.lastExamAt ? formatDate(summary.lastExamAt) : '尚无记录'}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* II. 进行中的考试 */}
      {inProgress ? (
        <Card className="border-warn/40">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1.5 text-sm">
              <Clock className="h-4 w-4 text-warn" aria-hidden="true" />
              有未完成的考试
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 pt-0">
            <p className="text-[13px] leading-relaxed text-ink-soft">{inProgress.examTitle}</p>
            <p className="text-[11px] text-ink-faint">
              剩余时间将在进入答题页后按本地记录继续计时。
            </p>
            <Link
              to={`/exam/${inProgress.attemptId}`}
              className="text-[13px] font-medium text-brand underline-offset-4 hover:underline"
            >
              继续考试 →
            </Link>
          </CardContent>
        </Card>
      ) : null}

      {/* III. 升级条件 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            {summary.nextLevel ? `升级至 ${summary.nextLevel.nameZh}` : '已达最高等级'}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {summary.nextLevel ? (
            pendingRequirements.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {pendingRequirements.slice(0, 4).map((requirement) => (
                  <li key={requirement.label} className="flex items-start gap-2 text-[12px]">
                    <CircleDashed className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-faint" aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block leading-snug text-ink-soft">{requirement.label}</span>
                      {requirement.hint ? (
                        <span className="mt-0.5 block text-[11px] leading-snug text-ink-faint">
                          {requirement.hint}
                        </span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="flex items-start gap-2 text-[12px] text-pass">
                <CircleCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                升级条件已全部满足，可前往报名页参加考试。
              </p>
            )
          ) : (
            <p className="text-[12px] leading-relaxed text-ink-soft">
              已取得本体系最高等级。可继续参加专项能力认证考试，或重新参加已有考试刷新成绩。
            </p>
          )}

          <div className="mt-3">
            <Link
              to="/permissions"
              className="text-[13px] font-medium text-brand underline-offset-4 hover:underline"
            >
              查看权限清单 →
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* IV. 最新公告 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-1.5 text-sm">
            <Megaphone className="h-4 w-4 text-brand" aria-hidden="true" />
            最新公告
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 pt-0">
          {latestAnnouncements.map((announcement) => (
            <article key={announcement.announcementId} className="border-b border-line pb-3 last:border-0 last:pb-0">
              <div className="flex items-center gap-1.5">
                {announcement.pinned ? <Badge variant="warn" size="sm">置顶</Badge> : null}
                <span className="text-[11px] text-ink-faint">{announcement.publishedAt}</span>
              </div>
              <p className="mt-1 text-[12px] font-medium leading-snug text-ink">{announcement.title}</p>
              <p className="mt-1 text-[11px] text-ink-faint">{announcement.department}</p>
            </article>
          ))}
        </CardContent>
      </Card>
    </aside>
  );
}
