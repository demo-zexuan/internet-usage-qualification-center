/**
 * 考试报名页
 *
 * I. 展示内容
 *
 * 1. 全部考试的类别、等级、题量、时限、及格线、报名条件、考试说明与补考规则
 * 2. 不符合报名条件时逐条列出原因，并提供模拟考试入口作为练习途径
 *
 * II. 筛选
 *
 * 1. 按考试类别、目标等级与报名状态筛选
 * 2. 筛选条件写入 URL 查询参数，便于刷新后保持视图
 *
 * @module pages/ExamListPage
 * @author zexuan.peng
 * @created 2026-10-14
 */

import { Filter, X } from 'lucide-react';
import * as React from 'react';
import { useSearchParams } from 'react-router-dom';

import { useConfig } from '@/app/config-context';
import { ExamCard } from '@/components/exam/exam-card';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState, LoadingState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select } from '@/components/ui/form-controls';
import { useUserData } from '@/hooks/use-user-data';
import { EXAM_CATEGORIES, EXAM_CATEGORY_LABELS } from '@/types/exam';
import type { ExamCategory } from '@/types/exam';

/** 报名状态筛选项 */
const STATUS_OPTIONS = [
  { value: 'all', label: '全部考试' },
  { value: 'eligible', label: '可立即报名' },
  { value: 'in_progress', label: '有未完成考试' },
  { value: 'passed', label: '已通过' },
  { value: 'locked', label: '暂不符合条件' },
] as const;

type StatusFilter = (typeof STATUS_OPTIONS)[number]['value'];

/** 考试报名页 */
export function ExamListPage(): React.ReactElement {
  const { catalog, status } = useUserData();
  const { levels } = useConfig();
  const [searchParams, setSearchParams] = useSearchParams();

  const categoryFilter = (searchParams.get('category') ?? 'all') as ExamCategory | 'all';
  const levelFilter = searchParams.get('level') ?? 'all';
  const statusFilter = (searchParams.get('status') ?? 'all') as StatusFilter;

  /** 更新筛选参数 */
  const updateFilter = (key: string, value: string): void => {
    const next = new URLSearchParams(searchParams);
    if (value === 'all') {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    setSearchParams(next, { replace: true });
  };

  const filtered = React.useMemo(() => {
    return catalog.filter((item) => {
      if (categoryFilter !== 'all' && item.rule.category !== categoryFilter) {
        return false;
      }
      if (levelFilter !== 'all' && item.rule.levelId !== levelFilter) {
        return false;
      }
      switch (statusFilter) {
        case 'eligible':
          return item.eligibility.eligible && !item.inProgressAttemptId;
        case 'in_progress':
          return Boolean(item.inProgressAttemptId);
        case 'passed':
          return item.passed;
        case 'locked':
          return !item.eligibility.eligible;
        default:
          return true;
      }
    });
  }, [catalog, categoryFilter, levelFilter, statusFilter]);

  if (status === 'loading') {
    return <LoadingState label="正在读取考试目录" rows={4} />;
  }

  const hasFilter = categoryFilter !== 'all' || levelFilter !== 'all' || statusFilter !== 'all';

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="考试业务"
        title="考试报名"
        description="以下为本中心当前开设的全部考试。模拟考试免除报名条件与须知确认，可用于熟悉题型与节奏；正式考试的成绩将计入考试记录并作为证件签发依据。"
      />

      {/* I. 筛选区 */}
      <Card>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-[13px] font-medium text-ink">
            <Filter className="h-4 w-4 text-ink-faint" aria-hidden="true" />
            筛选条件
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="filter-category" className="text-xs text-ink-soft">
                考试类别
              </label>
              <Select
                id="filter-category"
                value={categoryFilter}
                onChange={(event) => updateFilter('category', event.target.value)}
              >
                <option value="all">全部类别</option>
                {EXAM_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {EXAM_CATEGORY_LABELS[category]}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="filter-level" className="text-xs text-ink-soft">
                目标等级
              </label>
              <Select
                id="filter-level"
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
              <label htmlFor="filter-status" className="text-xs text-ink-soft">
                报名状态
              </label>
              <Select
                id="filter-status"
                value={statusFilter}
                onChange={(event) => updateFilter('status', event.target.value)}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[12px] text-ink-faint">
            <span>
              共 {catalog.length} 场考试，当前筛选出 {filtered.length} 场。
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

      {/* II. 考试列表 */}
      {filtered.length > 0 ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {filtered.map((item) => (
            <ExamCard
              key={item.rule.examId}
              item={item}
              level={levels.levels.find((level) => level.levelId === item.rule.levelId) ?? null}
              detailed
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="没有符合条件的考试"
          description="请调整筛选条件，或清除筛选后查看全部考试。"
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSearchParams(new URLSearchParams(), { replace: true })}
            >
              清除筛选
            </Button>
          }
        />
      )}
    </div>
  );
}
