/**
 * 模拟浏览专区
 *
 * I. 定位
 *
 * 1. 本专区展示的「信息流」全部由本平台内置，不来自真实互联网
 * 2. 专区的工具按权限逐级解锁，未解锁的工具展示解锁条件而不是静默隐藏
 *
 * II. 工具
 *
 * 1. 基础浏览：查看样例信息条目与来源标签
 * 2. 高级检索（L4）：按来源类型、证据强度与时间范围筛选
 * 3. 来源对比面板（L4）：并排比较多个来源在关键维度上的差异
 * 4. 证据链编排训练（L4）：按时间顺序排列证据片段并检查结果
 *
 * III. 边界
 *
 * 1. 本专区不连接任何真实搜索引擎，也不改变使用者对任何真实网站的访问能力
 *
 * @module pages/SimulatorPage
 * @author zexuan.peng
 * @created 2026-10-14
 */

import { ArrowDown, ArrowUp, Check, Compass, Filter, GitCompare, ListOrdered } from 'lucide-react';
import * as React from 'react';
import { Link } from 'react-router-dom';

import { PermissionDeniedState } from '@/components/common/states';
import { PageHeader, Section } from '@/components/common/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select } from '@/components/ui/form-controls';
import { Alert, Table, TableCell, TableHead, TableWrapper } from '@/components/ui/feedback';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import {
  COMPARISON_DIMENSIONS,
  EVIDENCE_CHAIN_EXERCISES,
  SAMPLE_EVIDENCE_LABELS,
  SAMPLE_SOURCE_LABELS,
  SIMULATOR_SAMPLES,
} from '@/features/simulator/sample-data';
import type { SampleEvidenceLevel, SampleSourceType } from '@/features/simulator/sample-data';
import { usePermission } from '@/hooks/use-user-data';
import { cn } from '@/utils/cn';

/** 权限说明条 */
function ToolLockNotice({ permissionId }: { permissionId: string }): React.ReactElement {
  const permission = usePermission(permissionId);

  return (
    <PermissionDeniedState
      title={`「${permission.state?.definition.name ?? '该工具'}」尚未解锁`}
      reason={permission.state?.lockedReason}
      requirement={permission.state?.definition.unlockCondition}
      advice={permission.state?.definition.upgradeAdvice}
      action={
        <Button asChild size="sm" variant="outline">
          <Link to="/permissions">查看权限清单</Link>
        </Button>
      }
    />
  );
}

/** 基础浏览 */
function BrowseTab(): React.ReactElement {
  return (
    <div className="flex flex-col gap-3">
      <Alert tone="info" title="以下信息流为平台内置样例">
        全部条目由本平台编写，机构名称、账号名称与事件均为虚构，不对应任何真实主体或事件。
        本专区不连接真实互联网，也不代表任何真实网站的界面或内容。
      </Alert>

      <ul className="flex flex-col gap-3">
        {SIMULATOR_SAMPLES.map((sample) => (
          <li key={sample.sampleId}>
            <Card>
              <CardContent className="flex flex-col gap-2.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="min-w-0 text-[14px] font-semibold leading-snug text-ink">
                    {sample.title}
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge
                      variant={
                        sample.sourceType === 'primary'
                          ? 'pass'
                          : sample.sourceType === 'secondary'
                            ? 'warn'
                            : 'fail'
                      }
                    >
                      {SAMPLE_SOURCE_LABELS[sample.sourceType]}
                    </Badge>
                    <Badge variant="outline">{SAMPLE_EVIDENCE_LABELS[sample.evidenceLevel]}</Badge>
                  </div>
                </div>

                <p className="text-[12px] text-ink-faint">
                  {sample.publisher} · {sample.publishedAt} · 编号{' '}
                  <span className="doc-code">{sample.sampleId}</span>
                </p>

                <p className="text-[13px] leading-relaxed text-ink-soft">{sample.body}</p>

                <div className="rounded-md border border-line bg-surface-muted px-3 py-2">
                  <p className="text-[11px] font-medium text-ink">核心断言</p>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-ink-soft">{sample.claim}</p>
                </div>

                <div>
                  <p className="text-[11px] font-medium text-ink">可核查要素</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[12px] leading-relaxed text-ink-soft">
                    {sample.checkablePoints.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                </div>

                <p className="text-[12px] leading-relaxed text-ink-faint">
                  一致性说明：{sample.consistency}
                </p>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 高级检索 */
function AdvancedSearchTab(): React.ReactElement {
  const [sourceFilter, setSourceFilter] = React.useState<SampleSourceType | 'all'>('all');
  const [evidenceFilter, setEvidenceFilter] = React.useState<SampleEvidenceLevel | 'all'>('all');
  const [rangeFilter, setRangeFilter] = React.useState<'all' | '30d' | '90d'>('all');

  const filtered = React.useMemo(() => {
    // 以样例数据中最晚的发布日期为基准，避免使用真实当前时间导致筛选结果随日期漂移
    const latest = SIMULATOR_SAMPLES.reduce(
      (max, sample) => (sample.publishedAt > max ? sample.publishedAt : max),
      '1970-01-01',
    );
    const baseTime = new Date(`${latest}T00:00:00`).getTime();
    const rangeMs = rangeFilter === '30d' ? 30 * 86400000 : rangeFilter === '90d' ? 90 * 86400000 : null;

    return SIMULATOR_SAMPLES.filter((sample) => {
      if (sourceFilter !== 'all' && sample.sourceType !== sourceFilter) {
        return false;
      }
      if (evidenceFilter !== 'all' && sample.evidenceLevel !== evidenceFilter) {
        return false;
      }
      if (rangeMs !== null) {
        const time = new Date(`${sample.publishedAt}T00:00:00`).getTime();
        if (baseTime - time > rangeMs) {
          return false;
        }
      }
      return true;
    });
  }, [sourceFilter, evidenceFilter, rangeFilter]);

  return (
    <div className="flex flex-col gap-3">
      <Card>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-[13px] font-medium text-ink">
            <Filter className="h-4 w-4 text-ink-faint" aria-hidden="true" />
            高级检索条件
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="sim-source" className="text-xs text-ink-soft">
                来源类型
              </label>
              <Select
                id="sim-source"
                value={sourceFilter}
                onChange={(event) => setSourceFilter(event.target.value as SampleSourceType | 'all')}
              >
                <option value="all">全部来源</option>
                <option value="primary">一手来源</option>
                <option value="secondary">二手转述</option>
                <option value="unverifiable">无法追溯</option>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="sim-evidence" className="text-xs text-ink-soft">
                证据强度
              </label>
              <Select
                id="sim-evidence"
                value={evidenceFilter}
                onChange={(event) =>
                  setEvidenceFilter(event.target.value as SampleEvidenceLevel | 'all')
                }
              >
                <option value="all">全部强度</option>
                <option value="documented">有完整记录</option>
                <option value="partial">仅有片段</option>
                <option value="none">无支撑材料</option>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="sim-range" className="text-xs text-ink-soft">
                时间范围（以样例中最晚日期为基准）
              </label>
              <Select
                id="sim-range"
                value={rangeFilter}
                onChange={(event) => setRangeFilter(event.target.value as 'all' | '30d' | '90d')}
              >
                <option value="all">全部时间</option>
                <option value="30d">最近 30 天</option>
                <option value="90d">最近 90 天</option>
              </Select>
            </div>
          </div>

          <p className="text-[12px] text-ink-faint">
            命中 {filtered.length} / {SIMULATOR_SAMPLES.length} 条。
          </p>
        </CardContent>
      </Card>

      <TableWrapper>
        <Table>
          <caption className="sr-only">高级检索结果</caption>
          <thead>
            <tr>
              <TableHead>编号</TableHead>
              <TableHead>标题</TableHead>
              <TableHead>来源</TableHead>
              <TableHead>证据</TableHead>
              <TableHead>发布日期</TableHead>
            </tr>
          </thead>
          <tbody>
            {filtered.map((sample) => (
              <tr key={sample.sampleId}>
                <TableCell className="doc-code text-[11px]">{sample.sampleId}</TableCell>
                <TableCell className="min-w-[14rem] text-[12px] text-ink">{sample.title}</TableCell>
                <TableCell className="whitespace-nowrap text-[12px] text-ink-soft">
                  {SAMPLE_SOURCE_LABELS[sample.sourceType]}
                </TableCell>
                <TableCell className="whitespace-nowrap text-[12px] text-ink-soft">
                  {SAMPLE_EVIDENCE_LABELS[sample.evidenceLevel]}
                </TableCell>
                <TableCell className="tabular whitespace-nowrap text-[12px] text-ink-soft">
                  {sample.publishedAt}
                </TableCell>
              </tr>
            ))}
          </tbody>
        </Table>
      </TableWrapper>

      {filtered.length === 0 ? (
        <p className="text-[12px] text-ink-faint">没有符合条件的结果，请放宽筛选条件。</p>
      ) : null}
    </div>
  );
}

/** 来源对比面板 */
function ComparisonTab(): React.ReactElement {
  const [selectedIds, setSelectedIds] = React.useState<string[]>(['SMP-001', 'SMP-002', 'SMP-003']);

  const selected = SIMULATOR_SAMPLES.filter((sample) => selectedIds.includes(sample.sampleId));

  const toggle = (sampleId: string): void => {
    setSelectedIds((current) =>
      current.includes(sampleId)
        ? current.filter((id) => id !== sampleId)
        : [...current, sampleId].slice(-4),
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <Card>
        <CardContent className="flex flex-col gap-3">
          <p className="text-[13px] font-medium text-ink">
            选择 2 至 4 条来源进行并排对比（最多保留最近选择的 4 条）
          </p>
          <div className="flex flex-wrap gap-2">
            {SIMULATOR_SAMPLES.map((sample) => {
              const isSelected = selectedIds.includes(sample.sampleId);
              return (
                <button
                  key={sample.sampleId}
                  type="button"
                  onClick={() => toggle(sample.sampleId)}
                  aria-pressed={isSelected}
                  className={cn(
                    'rounded border px-2.5 py-1.5 text-[12px] transition-colors',
                    isSelected
                      ? 'border-brand bg-brand-soft font-medium text-brand'
                      : 'border-line bg-surface text-ink-soft hover:bg-surface-muted',
                  )}
                >
                  {isSelected ? '✓ ' : ''}
                  {sample.sampleId}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {selected.length < 2 ? (
        <Alert tone="warning" title="请至少选择两条来源">
          来源对比的意义在于发现差异。只选择一条来源无法形成对比。
        </Alert>
      ) : (
        <TableWrapper>
          <Table>
            <caption className="sr-only">来源对比结果</caption>
            <thead>
              <tr>
                <TableHead className="min-w-[8rem]">对比维度</TableHead>
                {selected.map((sample) => (
                  <TableHead key={sample.sampleId} className="min-w-[12rem]">
                    {sample.sampleId}
                    <span className="mt-0.5 block text-[10px] font-normal text-ink-faint">
                      {sample.publisher}
                    </span>
                  </TableHead>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <TableCell className="text-[12px] font-medium text-ink">核心断言</TableCell>
                {selected.map((sample) => (
                  <TableCell key={sample.sampleId} className="text-[12px] text-ink-soft">
                    {sample.claim}
                  </TableCell>
                ))}
              </tr>
              {COMPARISON_DIMENSIONS.map((row) => (
                <tr key={row.dimension}>
                  <TableCell className="text-[12px] font-medium text-ink">
                    {row.dimension}
                    <span className="mt-0.5 block text-[10px] font-normal text-ink-faint">
                      {row.description}
                    </span>
                  </TableCell>
                  {selected.map((sample) => (
                    <TableCell key={sample.sampleId} className="text-[12px] text-ink-soft">
                      {row.dimension === '来源类型'
                        ? SAMPLE_SOURCE_LABELS[sample.sourceType]
                        : row.dimension === '发布时间'
                          ? sample.publishedAt
                          : row.dimension === '证据支撑'
                            ? SAMPLE_EVIDENCE_LABELS[sample.evidenceLevel]
                            : row.dimension === '关键限定词'
                              ? sample.claim
                              : sample.consistency}
                    </TableCell>
                  ))}
                </tr>
              ))}
            </tbody>
          </Table>
        </TableWrapper>
      )}
    </div>
  );
}

/** 证据链编排训练 */
function EvidenceChainTab(): React.ReactElement {
  const { toast } = useToast();
  const [exerciseIndex, setExerciseIndex] = React.useState(0);
  const exercise = EVIDENCE_CHAIN_EXERCISES[exerciseIndex] as
    | (typeof EVIDENCE_CHAIN_EXERCISES)[number]
    | undefined;

  const [order, setOrder] = React.useState<string[]>([]);
  const [checked, setChecked] = React.useState<boolean | null>(null);

  // 切换训练题时重置排序
  React.useEffect(() => {
    if (exercise) {
      setOrder([...exercise.fragments].map((fragment) => fragment.fragmentId).reverse());
      setChecked(null);
    }
  }, [exercise]);

  if (!exercise) {
    return <Alert tone="info">当前没有可用的证据链训练题。</Alert>;
  }

  const move = (index: number, direction: -1 | 1): void => {
    setOrder((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) {
        return current;
      }
      const currentValue = next[index] as string;
      next[index] = next[target] as string;
      next[target] = currentValue;
      return next;
    });
    setChecked(null);
  };

  const handleCheck = (): void => {
    const isCorrect = order.every((fragmentId, index) => {
      const fragment = exercise.fragments.find((item) => item.fragmentId === fragmentId);
      return fragment?.correctOrder === index + 1;
    });

    setChecked(isCorrect);

    if (isCorrect) {
      toast({ title: '排列正确', description: '可以查看下方结论说明。', tone: 'success' });
    }
  };

  const fragmentMap = new Map(exercise.fragments.map((fragment) => [fragment.fragmentId, fragment]));

  return (
    <div className="flex flex-col gap-3">
      <Card>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {EVIDENCE_CHAIN_EXERCISES.map((item, index) => (
              <Button
                key={item.exerciseId}
                size="sm"
                variant={index === exerciseIndex ? 'primary' : 'outline'}
                onClick={() => setExerciseIndex(index)}
              >
                {item.title}
              </Button>
            ))}
          </div>

          <p className="text-[13px] leading-relaxed text-ink-soft">{exercise.scenario}</p>
        </CardContent>
      </Card>

      <ol className="flex flex-col gap-2">
        {order.map((fragmentId, index) => {
          const fragment = fragmentMap.get(fragmentId);
          if (!fragment) {
            return null;
          }

          const isCorrectPosition = checked === true && fragment.correctOrder === index + 1;

          return (
            <li key={fragmentId}>
              <div
                className={cn(
                  'flex items-start gap-3 rounded-md border bg-surface px-3.5 py-3',
                  isCorrectPosition ? 'border-pass/45' : 'border-line',
                )}
              >
                <span className="tabular mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface-muted text-[12px] font-semibold text-ink-soft">
                  {index + 1}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-ink">{fragment.label}</p>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-ink-soft">
                    {fragment.description}
                  </p>
                </div>

                <div className="flex shrink-0 flex-col gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    aria-label={`将「${fragment.label}」上移一位`}
                  >
                    <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => move(index, 1)}
                    disabled={index === order.length - 1}
                    aria-label={`将「${fragment.label}」下移一位`}
                  >
                    <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={handleCheck}>
          <Check className="h-4 w-4" aria-hidden="true" />
          检查排列结果
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setOrder([...exercise.fragments].map((fragment) => fragment.fragmentId).reverse());
            setChecked(null);
          }}
        >
          重置顺序
        </Button>
      </div>

      {checked === true ? (
        <Alert tone="success" title="排列正确">
          <p className="mt-1">{exercise.conclusion}</p>
        </Alert>
      ) : checked === false ? (
        <Alert tone="warning" title="排列不正确">
          请重新观察各片段之间的时间与依赖关系：先有数据或公告，才有转述与再加工。
        </Alert>
      ) : null}
    </div>
  );
}

/** 模拟浏览专区 */
export function SimulatorPage(): React.ReactElement {
  const basePermission = usePermission('simulated_browsing_trial');
  const advancedPermission = usePermission('advanced_search');
  const comparisonPermission = usePermission('source_comparison');
  const evidencePermission = usePermission('evidence_chain_training');

  if (!basePermission.unlocked) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="模拟浏览专区" description="本专区按资格等级逐级开放。" />
        <ToolLockNotice permissionId="simulated_browsing_trial" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="模拟功能"
        title="模拟浏览与信息辨别专区"
        description="本专区用于演示来源核验、多源交叉验证与证据链编排。全部内容为平台内置样例，不来自真实互联网。"
        actions={
          <Badge variant="outline">
            <Compass className="h-3.5 w-3.5" aria-hidden="true" />
            模拟环境
          </Badge>
        }
      />

      <Alert tone="warning" title="边界说明">
        本专区不连接任何真实搜索引擎，不代理、不镜像、不转发任何真实网站的内容，
        也不改变使用者对任何真实网站的访问能力。专区内的机构名称与账号名称均为虚构。
      </Alert>

      <Tabs defaultValue="browse">
        <TabsList>
          <TabsTrigger value="browse">模拟信息流</TabsTrigger>
          <TabsTrigger value="search">
            <Filter className="h-3.5 w-3.5" aria-hidden="true" />
            高级检索
          </TabsTrigger>
          <TabsTrigger value="compare">
            <GitCompare className="h-3.5 w-3.5" aria-hidden="true" />
            来源对比
          </TabsTrigger>
          <TabsTrigger value="evidence">
            <ListOrdered className="h-3.5 w-3.5" aria-hidden="true" />
            证据链编排
          </TabsTrigger>
        </TabsList>

        <TabsContent value="browse">
          <BrowseTab />
        </TabsContent>

        <TabsContent value="search">
          {advancedPermission.unlocked ? <AdvancedSearchTab /> : <ToolLockNotice permissionId="advanced_search" />}
        </TabsContent>

        <TabsContent value="compare">
          {comparisonPermission.unlocked ? (
            <ComparisonTab />
          ) : (
            <ToolLockNotice permissionId="source_comparison" />
          )}
        </TabsContent>

        <TabsContent value="evidence">
          {evidencePermission.unlocked ? (
            <EvidenceChainTab />
          ) : (
            <ToolLockNotice permissionId="evidence_chain_training" />
          )}
        </TabsContent>
      </Tabs>

      <Section title="专区说明">
        <Card>
          <CardContent>
            <ul className="list-disc space-y-1.5 pl-5 text-[12px] leading-relaxed text-ink-soft">
              <li>基础浏览对所有状态开放，用于展示来源标签与证据强度的基本概念。</li>
              <li>高级检索、来源对比与证据链编排需要取得 L4 高级信息检索资格后解锁。</li>
              <li>
                专区中的全部条目、机构名称与账号名称均为本平台编写，用于教学演示，
                不对应任何真实主体、真实报道或真实事件。
              </li>
              <li>本专区不产生任何网络请求，全部数据随应用一同分发。</li>
            </ul>
          </CardContent>
        </Card>
      </Section>
    </div>
  );
}
