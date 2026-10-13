/**
 * 首页（考试业务门户）
 *
 * I. 两种形态
 *
 * 1. 尚未建立本地档案时展示引导流程：机构介绍 + 档案建立表单
 * 2. 已建立档案时展示个人考试工作台：资格状态、待办事项、可参加考试、制度说明与公告
 *
 * II. 数据来源
 *
 * 1. 当前等级、证件状态、升级条件全部来自 `useUserData` 的派生结果
 * 2. 考试列表来自考试目录，报名资格由报名引擎统一判定
 *
 * @module pages/HomePage
 * @author zexuan.peng
 * @created 2026-10-14
 */

import {
  ArrowRight,
  BookOpenCheck,
  FileBadge,
  History,
  IdCard,
  PlayCircle,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import * as React from 'react';
import { Link } from 'react-router-dom';

import { APP_MISSION, APP_MOTTO, APP_NAME_EN, APP_NAME_ZH } from '@/app/app-meta';
import { useConfig } from '@/app/config-context';
import { AnnouncementPanel } from '@/components/home/announcement-panel';
import { LevelSystemPanel } from '@/components/home/level-system-panel';
import { ExamCard } from '@/components/exam/exam-card';
import { LevelBadge, StatTile } from '@/components/common/indicators';
import { PageHeader, Section } from '@/components/common/page-header';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states';
import { ProfileForm } from '@/components/forms/profile-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Emblem } from '@/components/layout/emblem';
import { useToast } from '@/components/ui/toast';
import { createProfile } from '@/features/profile/service';
import { useAsyncAction } from '@/hooks/use-async-action';
import { useUserData } from '@/hooks/use-user-data';
import { formatDateTime, formatScore } from '@/utils/format';

/* ============================================================
   I. 首次访问引导
   ============================================================ */

/** 首次访问引导视图 */
function OnboardingView(): React.ReactElement {
  const { toast } = useToast();
  const createAction = useAsyncAction(createProfile);

  const handleSubmit = async (values: {
    displayName: string;
    avatarDataUrl: string | null;
  }): Promise<void> => {
    const outcome = await createAction.run(values);

    if (outcome?.ok) {
      toast({
        title: '本地考试档案已建立',
        description: '档案与后续考试数据仅保存在本机浏览器中，不会上传到任何服务器。',
        tone: 'success',
      });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* I. 机构介绍 */}
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-5 bg-navy-800 px-6 py-8 text-white sm:px-8">
          <div className="flex items-center gap-3">
            <Emblem size={52} inverted />
            <div>
              <h1 className="text-xl font-semibold leading-tight sm:text-2xl">{APP_NAME_ZH}</h1>
              <p className="text-[11px] uppercase tracking-[0.18em] text-navy-200">{APP_NAME_EN}</p>
            </div>
          </div>
          <p className="max-w-3xl text-[13px] leading-relaxed text-navy-100">{APP_MISSION}</p>
          <p className="text-sm font-medium text-white">「{APP_MOTTO}」</p>
        </div>

        <CardContent className="flex flex-col gap-5 pt-6">
          <div>
            <h2 className="text-base font-semibold text-ink">建立本地考试档案</h2>
            <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-ink-soft">
              本中心不设账号中心，也不需要注册。建立档案后即可在本机参加模拟考试与正式考试、
              生成电子证件并查看权限清单。全部数据仅保存在本机浏览器，清除浏览器数据会一并删除。
            </p>
          </div>

          {createAction.error ? (
            <ErrorState
              title="档案建立失败"
              message={createAction.error.message}
              hint={createAction.error.hint}
              code={createAction.error.code}
              details={createAction.error.details}
            />
          ) : null}

          <ProfileForm
            onSubmit={handleSubmit}
            pending={createAction.pending}
            submitLabel="建立本地档案并进入考试工作台"
          />

          <div className="rounded-md border border-line bg-surface-muted px-3.5 py-3 text-[12px] leading-relaxed text-ink-soft">
            <p className="font-medium text-ink">关于隐私</p>
            <p className="mt-1">
              本中心不要求真实身份认证，不收集身份证号码、真实住址、手机号等无必要信息。
              昵称仅用于证件与成绩单展示，可随时修改。
            </p>
          </div>
        </CardContent>
      </Card>

      {/* II. 制度说明 */}
      <LevelSystemPanel />

      {/* III. 公告 */}
      <AnnouncementPanel limit={4} />
    </div>
  );
}

/* ============================================================
   II. 考试工作台
   ============================================================ */

/** 快捷入口 */
const QUICK_LINKS = [
  {
    to: '/certificates',
    label: '我的电子证件',
    description: '查看、打印、下载与复制证件编号',
    icon: FileBadge,
  },
  {
    to: '/history',
    label: '考试历史',
    description: '历次成绩、答卷复核与历史证件',
    icon: History,
  },
  {
    to: '/permissions',
    label: '权限中心',
    description: '当前等级的模拟互联网权限清单',
    icon: ShieldCheck,
  },
  {
    to: '/materials',
    label: '学习材料',
    description: '考前阅读材料与自查问题',
    icon: Sparkles,
  },
] as const;

/** 考试工作台视图 */
function DashboardView(): React.ReactElement {
  const { summary, catalog, attempts } = useUserData();
  const { levels } = useConfig();

  if (!summary) {
    return <LoadingState />;
  }

  // I. 待办：进行中的考试优先，其次是可立即报名的考试
  const inProgress = catalog.filter((item) => item.inProgressAttemptId);
  const readyToTake = catalog.filter(
    (item) => item.eligibility.eligible && !item.inProgressAttemptId && !item.passed,
  );
  const availableExams = [...inProgress, ...readyToTake].slice(0, 3);

  const pendingRequirements = summary.nextLevelRequirements.filter((item) => !item.satisfied);

  // II. 最近一次已结算的考试，用于展示最近成绩
  const latestSubmitted =
    attempts.find((attempt) => attempt.status === 'submitted' && attempt.result) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="考试业务门户"
        title={`${summary.profile.displayName} 的考试工作台`}
        description="本页面汇总当前资格状态、待办考试与升级条件。所有数据均来自本机考试记录，不涉及任何服务器。"
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link to="/profile">
                <IdCard className="h-4 w-4" aria-hidden="true" />
                我的档案
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/exams">
                <BookOpenCheck className="h-4 w-4" aria-hidden="true" />
                全部考试
              </Link>
            </Button>
          </>
        }
      />

      {/* I. 资格状态概览 */}
      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-ink-faint">当前资格等级</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <LevelBadge
                  level={summary.currentLevel}
                  temporary={!summary.levelFromCertificate}
                  size="lg"
                />
                {!summary.levelFromCertificate ? (
                  <Badge variant="warn">尚未取得任何证件</Badge>
                ) : null}
                {summary.certifications.length > 0 ? (
                  <Badge variant="brand">专项认证 {summary.certifications.length} 项</Badge>
                ) : null}
              </div>
              <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-ink-soft">
                {summary.currentLevel.description}
              </p>
            </div>

            <div className="min-w-[12rem]">
              <p className="text-xs text-ink-faint">证件有效状态</p>
              {summary.activeCertificate ? (
                <div className="mt-1.5">
                  <Link
                    to={`/certificate/${summary.activeCertificate.certificateId}`}
                    className="doc-code text-[13px] font-medium text-brand underline-offset-4 hover:underline"
                  >
                    {summary.activeCertificate.certificateNumber}
                  </Link>
                  <p className="mt-1 text-[11px] text-ink-faint">
                    授予日期 {formatDateTime(summary.activeCertificate.issuedAt)}
                  </p>
                </div>
              ) : (
                <p className="mt-1.5 text-[13px] text-ink-soft">尚未签发，需通过对应等级考试</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="累计考试次数" value={summary.totalAttemptCount} unit="次" />
            <StatTile
              label="正式考试次数"
              value={summary.officialAttemptCount}
              unit="次"
              hint="模拟考试不计入正式记录"
            />
            <StatTile
              label="通过次数"
              value={summary.passedAttemptCount}
              unit="次"
              tone={summary.passedAttemptCount > 0 ? 'pass' : 'default'}
            />
            <StatTile
              label="最近一次考试"
              value={summary.lastExamAt ? formatDateTime(summary.lastExamAt).slice(0, 10) : '—'}
              hint={summary.lastExamAt ? undefined : '尚无考试记录'}
            />
          </div>
        </CardContent>
      </Card>

      {/* II. 升级条件 */}
      <Section
        title={summary.nextLevel ? `距离「${summary.nextLevel.nameZh}」还需完成` : '等级状态'}
        description={
          summary.nextLevel
            ? `通过对应考试后可取得 ${summary.nextLevel.levelId} ${summary.nextLevel.nameZh}。`
            : '已取得本体系最高等级。'
        }
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/permissions">
              权限清单
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        }
      >
        {summary.nextLevel ? (
          pendingRequirements.length > 0 ? (
            <Card>
              <CardContent>
                <ul className="flex flex-col gap-3">
                  {pendingRequirements.map((requirement) => (
                    <li key={requirement.label} className="flex items-start gap-2.5">
                      <span
                        aria-hidden="true"
                        className="mt-1.5 h-2 w-2 shrink-0 rounded-full border border-line-strong bg-surface-sunken"
                      />
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium leading-snug text-ink">
                          {requirement.label}
                        </p>
                        {requirement.hint ? (
                          <p className="mt-0.5 text-[12px] leading-relaxed text-ink-soft">
                            {requirement.hint}
                          </p>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[13px] text-pass">
                  升级条件已全部满足，可前往报名页参加「{summary.nextLevel.nameZh}」考试。
                </p>
                <Button asChild size="sm">
                  <Link to="/exams">前往报名</Link>
                </Button>
              </CardContent>
            </Card>
          )
        ) : (
          <Card>
            <CardContent>
              <p className="text-[13px] leading-relaxed text-ink-soft">
                已取得互联网高级资格（L6）。可继续参加专项能力认证考试，
                或重新参加已有考试刷新成绩记录。
              </p>
            </CardContent>
          </Card>
        )}
      </Section>

      {/* III. 可参加的考试 */}
      <Section
        title="可参加的考试"
        description="优先展示进行中的考试与当前可立即报名的考试。模拟考试免除报名条件与须知确认。"
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/exams">查看全部 {catalog.length} 场考试</Link>
          </Button>
        }
      >
        {availableExams.length > 0 ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {availableExams.map((item) => (
              <ExamCard
                key={item.rule.examId}
                item={item}
                level={levels.levels.find((level) => level.levelId === item.rule.levelId) ?? null}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="当前没有可立即报名的考试"
            description="可能是前置等级尚未取得、补考间隔未结束，或已有考试次数用尽。可在报名页查看每场考试的具体条件。"
            action={
              <Button asChild variant="outline" size="sm">
                <Link to="/exams">
                  <PlayCircle className="h-4 w-4" aria-hidden="true" />
                  查看报名条件
                </Link>
              </Button>
            }
          />
        )}
      </Section>

      {/* IV. 快捷入口 */}
      <Section title="常用业务" description="高频入口，均可单手操作。">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {QUICK_LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.to}
                to={link.to}
                className="flex items-start gap-3 rounded-lg border border-line bg-surface px-4 py-3.5 transition-colors hover:border-brand/40 hover:bg-brand-soft/40"
              >
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium text-ink">{link.label}</span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-ink-faint">
                    {link.description}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </Section>

      {/* V. 制度说明 */}
      <LevelSystemPanel />

      {/* VI. 公告 */}
      <AnnouncementPanel limit={5} />

      {/* VII. 最近一次成绩 */}
      {latestSubmitted ? (
        <p className="text-[12px] text-ink-faint">
          最近一次考试「{latestSubmitted.examTitle}」得分{' '}
          <span className="tabular font-medium text-ink">
            {formatScore(latestSubmitted.result?.score ?? 0)}
          </span>{' '}
          分（{latestSubmitted.result?.passed ? '通过' : '未通过'}），于{' '}
          {formatDateTime(latestSubmitted.submittedAt ?? latestSubmitted.startedAt)} 结算。完整记录请前往
          <Link to="/history" className="ml-1 text-brand underline-offset-4 hover:underline">
            考试历史
          </Link>
          。
        </p>
      ) : null}
    </div>
  );
}

/* ============================================================
   III. 页面入口
   ============================================================ */

/** 首页 */
export function HomePage(): React.ReactElement {
  const { status } = useUserData();

  if (status === 'loading') {
    return <LoadingState label="正在读取本地考试档案" rows={4} />;
  }

  if (status === 'no-profile') {
    return <OnboardingView />;
  }

  return <DashboardView />;
}
