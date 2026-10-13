/**
 * 权限中心
 *
 * I. 展示内容
 *
 * 1. 按分组展示全部模拟互联网权限：名称、是否解锁、解锁条件、权限说明、对应等级、升级建议
 * 2. 已解锁的权限提供应用内入口；未解锁的权限说明还差多少级或缺少哪项专项认证
 *
 * II. 计算来源
 *
 * 1. 全部权限状态由 `features/permissions` 模块统一计算，页面不做任何权限判断
 * 2. 高级等级默认继承低级等级权限，只有「已作废」证件会失去效力
 *
 * III. 边界声明
 *
 * 1. 所有权限均为应用内的虚构授权，不影响真实网络连接
 * 2. 全局免责声明与逐条免责声明必须完整展示
 *
 * @module pages/PermissionsPage
 * @author zexuan.peng
 * @created 2026-10-14
 */

import { ExternalLink, Lock, ShieldCheck, Unlock } from 'lucide-react';
import * as React from 'react';
import { Link } from 'react-router-dom';

import { FRONTEND_BOUNDARY_STATEMENT } from '@/app/app-meta';
import { useConfig } from '@/app/config-context';
import { LevelBadge } from '@/components/common/indicators';
import { PageHeader, Section } from '@/components/common/page-header';
import { EmptyState, LoadingState } from '@/components/common/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, Progress } from '@/components/ui/feedback';
import { useUserData } from '@/hooks/use-user-data';
import { PERMISSION_GROUP_LABELS } from '@/types/permission';
import type { PermissionGroup, PermissionState } from '@/types/permission';
import { cn } from '@/utils/cn';

/** 单条权限卡片 */
function PermissionItem({
  state,
  levelName,
}: {
  state: PermissionState;
  levelName: string | null;
}): React.ReactElement {
  const { definition, unlocked } = state;

  return (
    <li>
      <article
        className={cn(
          'flex flex-col gap-3 rounded-lg border bg-surface p-4',
          unlocked ? 'border-pass/35' : 'border-line',
        )}
      >
        <header className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="flex flex-wrap items-center gap-2 text-[14px] font-semibold text-ink">
              {definition.name}
              {definition.simulated ? <Badge variant="outline" size="sm">模拟权限</Badge> : null}
            </h3>
            <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">{definition.description}</p>
          </div>

          <Badge variant={unlocked ? 'pass' : 'neutral'} size="default">
            {unlocked ? (
              <Unlock className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {unlocked ? '已解锁' : '未解锁'}
          </Badge>
        </header>

        <dl className="grid gap-x-5 gap-y-2 border-t border-line pt-3 text-[12px] sm:grid-cols-2">
          <div>
            <dt className="text-ink-faint">解锁条件</dt>
            <dd className="mt-0.5 leading-relaxed text-ink-soft">{definition.unlockCondition}</dd>
          </div>
          <div>
            <dt className="text-ink-faint">对应等级</dt>
            <dd className="mt-0.5 leading-relaxed text-ink-soft">
              {definition.requiredLevelOrder === 0
                ? '无需任何资格'
                : `等级序号 ≥ ${definition.requiredLevelOrder}${
                    levelName ? `（当前：${levelName}）` : ''
                  }`}
            </dd>
          </div>
          {!unlocked ? (
            <div className="sm:col-span-2">
              <dt className="text-ink-faint">升级建议</dt>
              <dd className="mt-0.5 leading-relaxed text-ink-soft">
                {state.lockedReason ? `${state.lockedReason} ` : ''}
                {definition.upgradeAdvice}
              </dd>
            </div>
          ) : null}
        </dl>

        <p className="rounded border border-line bg-surface-muted px-3 py-2 text-[11px] leading-relaxed text-ink-faint">
          {definition.disclaimer}
        </p>

        {unlocked && definition.route ? (
          <div>
            <Button asChild size="sm" variant="outline">
              <Link to={definition.route}>
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                进入功能
              </Link>
            </Button>
          </div>
        ) : null}
      </article>
    </li>
  );
}

/** 权限中心 */
export function PermissionsPage(): React.ReactElement {
  const { status, permissionContext, permissionStates, summary } = useUserData();
  const { levels, permissions, rulesConfig } = useConfig();

  if (status === 'loading') {
    return <LoadingState label="正在计算权限状态" rows={4} />;
  }

  if (status === 'no-profile' || !summary || !permissionContext) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="权限中心" description="尚未建立本地档案。" />
        <EmptyState
          title="尚未建立本地考试档案"
          description="建立档案后即可查看当前状态对应的模拟互联网权限清单。"
          action={
            <Button asChild size="sm">
              <Link to="/">返回首页建立档案</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const unlockedCount = permissionStates.filter((state) => state.unlocked).length;

  // 按分组聚合，保持配置中的分组顺序
  const grouped = new Map<PermissionGroup, PermissionState[]>();
  for (const state of permissionStates) {
    const list = grouped.get(state.definition.group) ?? [];
    list.push(state);
    grouped.set(state.definition.group, list);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="资格管理"
        title="模拟互联网权限中心"
        description="本页面列出当前资格等级对应的全部模拟互联网权限。高级等级默认继承低级等级权限；任何考试未通过都不会降低已取得的等级，也不会收回已解锁的权限。"
        actions={<LevelBadge level={summary.currentLevel} temporary={!summary.levelFromCertificate} size="lg" />}
      />

      {/* I. 概览 */}
      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs text-ink-faint">权限解锁进度</p>
              <p className="tabular mt-1 text-2xl font-semibold text-ink">
                {unlockedCount}
                <span className="ml-1 text-sm font-normal text-ink-faint">
                  / {permissionStates.length} 项已解锁
                </span>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {summary.certifications.length > 0 ? (
                <Badge variant="brand">专项认证：{summary.certifications.join('、')}</Badge>
              ) : (
                <Badge variant="neutral">暂无专项能力认证</Badge>
              )}
            </div>
          </div>

          <Progress
            value={(unlockedCount / Math.max(1, permissionStates.length)) * 100}
            aria-label={`权限解锁进度 ${Math.round((unlockedCount / Math.max(1, permissionStates.length)) * 100)}%`}
          />

          <p className="text-[12px] leading-relaxed text-ink-soft">
            当前资格依据：
            {summary.levelFromCertificate
              ? `${summary.currentLevel.levelId} ${summary.currentLevel.nameZh}（由有效证件确定）`
              : '临时浏览状态（尚未取得任何证件）'}
            。有效证件等级：
            {permissionContext.validCertificateLevelIds.length > 0
              ? permissionContext.validCertificateLevelIds.join('、')
              : '无'}
            。
          </p>
        </CardContent>
      </Card>

      {/* II. 边界声明 */}
      <Alert tone="warning" title="权限性质说明">
        <p className="mt-1">{permissions.globalDisclaimer}</p>
        <p className="mt-2 font-medium text-ink">{FRONTEND_BOUNDARY_STATEMENT}</p>
      </Alert>

      {/* III. 分组清单 */}
      {[...grouped.entries()].map(([group, states]) => (
        <Section
          key={group}
          title={PERMISSION_GROUP_LABELS[group] ?? group}
          description={`本组共 ${states.length} 项权限，已解锁 ${states.filter((state) => state.unlocked).length} 项。`}
        >
          <ul className="flex flex-col gap-3">
            {states.map((state) => (
              <PermissionItem
                key={state.definition.permissionId}
                state={state}
                levelName={
                  levels.levels.find((level) => level.order === state.definition.requiredLevelOrder)
                    ?.nameZh ?? null
                }
              />
            ))}
          </ul>
        </Section>
      ))}

      {/* IV. 升级路径 */}
      <Section title="升级路径" description="逐级晋升，高级等级继承低级等级的全部权限。">
        <Card>
          <CardContent>
            <ol className="flex flex-col gap-3">
              {levels.levels
                .filter((level) => !level.isTemporary)
                .sort((a, b) => a.order - b.order)
                .map((level) => {
                  const reached = summary.currentLevel.order >= level.order;
                  const grantingExam = rulesConfig.exams.find(
                    (exam) => exam.grantsLevelId === level.levelId,
                  );

                  return (
                    <li key={level.levelId} className="flex items-start gap-3">
                      <span
                        aria-hidden="true"
                        className={cn(
                          'mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold',
                          reached
                            ? 'border-pass/50 bg-pass-soft text-pass'
                            : 'border-line bg-surface-muted text-ink-faint',
                        )}
                      >
                        {reached ? '✓' : level.order}
                      </span>
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 text-[13px] font-medium text-ink">
                          {level.levelId} {level.nameZh}
                          {reached ? <Badge variant="pass" size="sm">已达成</Badge> : null}
                        </p>
                        <p className="mt-0.5 text-[12px] leading-relaxed text-ink-soft">
                          {level.summary}
                        </p>
                        {grantingExam ? (
                          <p className="mt-1 text-[11px] text-ink-faint">
                            授予考试：{grantingExam.title} · {grantingExam.questionCount} 题 ·{' '}
                            {grantingExam.durationMinutes} 分钟 · 及格线 {grantingExam.passScore} 分
                          </p>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
            </ol>

            <div className="mt-4">
              <Button asChild size="sm">
                <Link to="/exams">
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  前往考试报名
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </Section>
    </div>
  );
}
