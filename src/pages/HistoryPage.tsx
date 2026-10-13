/**
 * 考试历史页
 *
 * I. 展示内容
 *
 * 1. 每条记录包含考试名称、等级、日期、分数、结果、用时与证件编号
 * 2. 支持按等级、通过状态与时间范围筛选，筛选条件写入 URL 便于刷新保持
 *
 * II. 数据完整性
 *
 * 1. 历史记录不会因为升级、重置等级或导入新题库而被删除
 * 2. 每条记录携带试卷快照与规则版本，可随时复核历史答卷
 *
 * @module pages/HistoryPage
 * @author zexuan.peng
 * @created 2026-10-14
 */

import { FileBadge, Filter, History, X } from 'lucide-react';
import * as React from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { useConfig } from '@/app/config-context';
import { LevelBadge, ResultBadge } from '@/components/common/indicators';
import { PageHeader, Section } from '@/components/common/page-header';
import { EmptyState, LoadingState } from '@/components/common/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select } from '@/components/ui/form-controls';
import { Table, TableCell, TableHead, TableWrapper } from '@/components/ui/feedback';
import { useUserData } from '@/hooks/use-user-data';
import { EXAM_MODE_LABELS, SUBMIT_REASON_LABELS } from '@/types/exam';
import type { ExamAttempt } from '@/types/exam';
import { formatDate, formatDateTime, formatDuration, formatScore } from '@/utils/format';

/** 通过状态筛选项 */
const PASS_OPTIONS = [
  { value: 'all', label: '全部结果' },
  { value: 'passed', label: '仅通过' },
  { value: 'failed', label: '仅未通过' },
  { value: 'in_progress', label: '进行中' },
] as const;

/** 时间范围筛选项 */
const RANGE_OPTIONS = [
  { value: 'all', label: '全部时间' },
  { value: '7d', label: '最近 7 天' },
  { value: '30d', label: '最近 30 天' },
  { value: '90d', label: '最近 90 天' },
] as const;

/** 单条历史记录 */
function HistoryRow({
  attempt,
  certificateNumber,
  certificateId,
}: {
  attempt: ExamAttempt;
  certificateNumber: string | null;
  certificateId: string | null;
}): React.ReactElement {
  const { levels } = useConfig();
  const level = levels.levels.find((item) => item.levelId === attempt.levelId) ?? null;

  const isSettled = attempt.status === 'submitted' && attempt.result;

  return (
    <tr>
      <TableCell className="min-w-[12rem]">
        <Link
          to={
            isSettled
              ? `/results/${attempt.attemptId}`
              : attempt.status === 'in_progress'
                ? `/exam/${attempt.attemptId}`
                : `/results/${attempt.attemptId}`
          }
          className="text-[13px] font-medium text-brand underline-offset-4 hover:underline"
        >
          {attempt.examTitle}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <Badge variant={attempt.mode === 'official' ? 'brand' : 'info'} size="sm">
            {EXAM_MODE_LABELS[attempt.mode]}
          </Badge>
          {attempt.status === 'abandoned' ? <Badge variant="neutral" size="sm">已放弃</Badge> : null}
          {attempt.status === 'in_progress' ? <Badge variant="warn" size="sm">进行中</Badge> : null}
        </div>
      </TableCell>

      <TableCell className="whitespace-nowrap">
        {level ? <LevelBadge level={level} size="sm" /> : attempt.levelId}
      </TableCell>

      <TableCell className="tabular whitespace-nowrap text-[12px] text-ink-soft">
        {formatDate(attempt.startedAt)}
        <span className="mt-0.5 block text-[11px] text-ink-faint">
          {formatDateTime(attempt.startedAt).slice(11)}
        </span>
      </TableCell>

      <TableCell className="tabular whitespace-nowrap text-[13px] font-medium text-ink">
        {isSettled ? (
          <>
            {formatScore(attempt.result?.score ?? 0)}
            <span className="text-[11px] font-normal text-ink-faint">
              {' '}
              / {formatScore(attempt.result?.maxScore ?? 0)}
            </span>
          </>
        ) : (
          <span className="text-ink-faint">—</span>
        )}
      </TableCell>

      <TableCell className="whitespace-nowrap">
        {isSettled ? (
          <ResultBadge passed={attempt.result?.passed ?? false} size="sm" />
        ) : (
          <span className="text-[12px] text-ink-faint">未结算</span>
        )}
      </TableCell>

      <TableCell className="tabular whitespace-nowrap text-[12px] text-ink-soft">
        {attempt.durationMs !== null ? formatDuration(attempt.durationMs) : '—'}
        {attempt.submitReason ? (
          <span className="mt-0.5 block text-[11px] text-ink-faint">
            {SUBMIT_REASON_LABELS[attempt.submitReason]}
          </span>
        ) : null}
      </TableCell>

      <TableCell className="whitespace-nowrap text-[12px]">
        {certificateId && certificateNumber ? (
          <Link
            to={`/certificate/${certificateId}`}
            className="doc-code text-brand underline-offset-4 hover:underline"
          >
            {certificateNumber}
          </Link>
        ) : (
          <span className="text-ink-faint">—</span>
        )}
      </TableCell>

      <TableCell className="text-right">
        <div className="flex justify-end gap-1.5">
          {isSettled ? (
            <Button asChild size="sm" variant="outline">
              <Link to={`/results/${attempt.attemptId}`}>查看答卷</Link>
            </Button>
          ) : attempt.status === 'in_progress' ? (
            <Button asChild size="sm">
              <Link to={`/exam/${attempt.attemptId}`}>继续考试</Link>
            </Button>
          ) : (
            <span className="text-[12px] text-ink-faint">无答卷</span>
          )}
        </div>
      </TableCell>
    </tr>
  );
}

/** 考试历史页 */
export function HistoryPage(): React.ReactElement {
  const { status, attempts, certificates, summary } = useUserData();
  const { levels } = useConfig();
  const [searchParams, setSearchParams] = useSearchParams();

  const levelFilter = searchParams.get('level') ?? 'all';
  const passFilter = searchParams.get('result') ?? 'all';
  const rangeFilter = searchParams.get('range') ?? 'all';

  const updateFilter = (key: string, value: string): void => {
    const next = new URLSearchParams(searchParams);
    if (value === 'all') {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    setSearchParams(next, { replace: true });
  };

  /** 考试记录 ID → 证件编号，用于在历史中展示关联证件 */
  const certificateByAttempt = React.useMemo(() => {
    const map = new Map<string, { number: string; id: string }>();
    for (const certificate of certificates) {
      map.set(certificate.examAttemptId, {
        number: certificate.certificateNumber,
        id: certificate.certificateId,
      });
    }
    return map;
  }, [certificates]);

  const filtered = React.useMemo(() => {
    const now = Date.now();
    const rangeMs =
      rangeFilter === '7d'
        ? 7 * 86400000
        : rangeFilter === '30d'
          ? 30 * 86400000
          : rangeFilter === '90d'
            ? 90 * 86400000
            : null;

    return attempts.filter((attempt) => {
      if (levelFilter !== 'all' && attempt.levelId !== levelFilter) {
        return false;
      }

      if (rangeMs !== null && now - attempt.startedAt > rangeMs) {
        return false;
      }

      switch (passFilter) {
        case 'passed':
          return attempt.result?.passed === true;
        case 'failed':
          return attempt.status === 'submitted' && attempt.result?.passed === false;
        case 'in_progress':
          return attempt.status === 'in_progress';
        default:
          return true;
      }
    });
  }, [attempts, levelFilter, passFilter, rangeFilter]);

  if (status === 'loading') {
    return <LoadingState label="正在读取考试记录" rows={5} />;
  }

  if (status === 'no-profile') {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="考试历史" description="尚未建立本地档案。" />
        <EmptyState
          title="尚未建立本地考试档案"
          description="建立档案并参加考试后，这里会记录每一场考试的成绩与答卷。"
          action={
            <Button asChild size="sm">
              <Link to="/">返回首页建立档案</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const hasFilter = levelFilter !== 'all' || passFilter !== 'all' || rangeFilter !== 'all';
  const passedCount = attempts.filter((attempt) => attempt.result?.passed).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="考生服务"
        title="考试历史"
        description="全部考试记录永久保留在本机数据库中，不会因为升级、重置等级或导入新题库而被删除。每条记录都包含当次的试卷快照与评分规则版本，可随时复核。"
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/certificates">
              <FileBadge className="h-4 w-4" aria-hidden="true" />
              证件历史
            </Link>
          </Button>
        }
      />

      {/* I. 汇总 */}
      {summary ? (
        <Card>
          <CardContent className="grid grid-cols-2 gap-4 text-[13px] lg:grid-cols-4">
            <div>
              <p className="text-ink-faint">累计考试</p>
              <p className="tabular mt-1 text-lg font-semibold text-ink">
                {summary.totalAttemptCount} 次
              </p>
            </div>
            <div>
              <p className="text-ink-faint">正式考试</p>
              <p className="tabular mt-1 text-lg font-semibold text-ink">
                {summary.officialAttemptCount} 次
              </p>
            </div>
            <div>
              <p className="text-ink-faint">通过</p>
              <p className="tabular mt-1 text-lg font-semibold text-pass">{passedCount} 次</p>
            </div>
            <div>
              <p className="text-ink-faint">已签发证件</p>
              <p className="tabular mt-1 text-lg font-semibold text-ink">{certificates.length} 张</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* II. 筛选 */}
      <Card>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-[13px] font-medium text-ink">
            <Filter className="h-4 w-4 text-ink-faint" aria-hidden="true" />
            筛选条件
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="history-level" className="text-xs text-ink-soft">
                考试等级
              </label>
              <Select
                id="history-level"
                value={levelFilter}
                onChange={(event) => updateFilter('level', event.target.value)}
              >
                <option value="all">全部等级</option>
                {levels.levels.map((level) => (
                  <option key={level.levelId} value={level.levelId}>
                    {level.levelId} · {level.nameZh}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="history-result" className="text-xs text-ink-soft">
                通过状态
              </label>
              <Select
                id="history-result"
                value={passFilter}
                onChange={(event) => updateFilter('result', event.target.value)}
              >
                {PASS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="history-range" className="text-xs text-ink-soft">
                时间范围
              </label>
              <Select
                id="history-range"
                value={rangeFilter}
                onChange={(event) => updateFilter('range', event.target.value)}
              >
                {RANGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[12px] text-ink-faint">
            <span>
              共 {attempts.length} 条记录，当前筛选出 {filtered.length} 条。
            </span>
            {hasFilter ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchParams(new URLSearchParams(), { replace: true })}
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                清除筛选
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* III. 记录列表 */}
      {filtered.length === 0 ? (
        <EmptyState
          title={attempts.length === 0 ? '尚无考试记录' : '没有符合条件的记录'}
          description={
            attempts.length === 0
              ? '参加模拟考试或正式考试后，成绩与答卷会自动记录在这里。'
              : '请调整筛选条件，或清除筛选后查看全部记录。'
          }
          icon={<History className="h-8 w-8" aria-hidden="true" />}
          action={
            <Button asChild size="sm">
              <Link to="/exams">前往考试报名</Link>
            </Button>
          }
        />
      ) : (
        <Section title="考试记录" description="点击考试名称或「查看答卷」可复核当次作答详情。">
          <Card>
            <CardContent className="pt-4">
              <TableWrapper>
                <Table>
                  <caption className="sr-only">考试历史记录</caption>
                  <thead>
                    <tr>
                      <TableHead>考试名称</TableHead>
                      <TableHead>等级</TableHead>
                      <TableHead>日期</TableHead>
                      <TableHead>分数</TableHead>
                      <TableHead>结果</TableHead>
                      <TableHead>用时</TableHead>
                      <TableHead>证件编号</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((attempt) => {
                      const certificate = certificateByAttempt.get(attempt.attemptId);
                      return (
                        <HistoryRow
                          key={attempt.attemptId}
                          attempt={attempt}
                          certificateNumber={certificate?.number ?? null}
                          certificateId={certificate?.id ?? null}
                        />
                      );
                    })}
                  </tbody>
                </Table>
              </TableWrapper>
            </CardContent>
          </Card>
        </Section>
      )}

      <p className="text-[12px] leading-relaxed text-ink-faint">
        说明：模拟考试记录同样会保留，但不计入正式考试次数，也不会签发证件。
        试卷快照保存了当次考试的题目内容、选项顺序与评分规则版本，因此导入新题库不会影响历史成绩的复核。
      </p>
    </div>
  );
}
