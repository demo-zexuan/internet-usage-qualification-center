/**
 * 用户档案页
 *
 * I. 展示内容
 *
 * 1. 考生昵称、考生编号、头像与档案建立时间
 * 2. 当前最高认证等级、当前有效证件、累计考试与通过次数、最近一次考试时间
 *
 * II. 可执行操作
 *
 * 1. 修改昵称与头像
 * 2. 导出个人数据（JSON）
 * 3. 重置本地考试档案（二次确认，不可撤销）
 *
 * III. 数据边界
 *
 * 1. 不涉及真实身份认证，不收集身份证号码、真实住址等敏感信息
 * 2. 全部数据仅保存在本机 IndexedDB
 *
 * @module pages/ProfilePage
 * @author zexuan.peng
 * @created 2026-10-14
 */

import { Download, RotateCcw, Save, ShieldCheck } from 'lucide-react';
import * as React from 'react';
import { Link } from 'react-router-dom';

import { useConfig } from '@/app/config-context';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { CertificateStatusBadge, LevelBadge, StatTile } from '@/components/common/indicators';
import { PageHeader, Section } from '@/components/common/page-header';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states';
import { ProfileForm } from '@/components/forms/profile-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert } from '@/components/ui/feedback';
import { useToast } from '@/components/ui/toast';
import { exportUserData, resetProfile, updateProfile } from '@/features/profile/service';
import { useAsyncAction } from '@/hooks/use-async-action';
import { useUserData } from '@/hooks/use-user-data';
import { downloadTextFile } from '@/services/import-export';
import { CERTIFICATE_STATUS_LABELS } from '@/types/certificate';
import { formatDateTime } from '@/utils/format';

/** 用户档案页 */
export function ProfilePage(): React.ReactElement {
  const { status, summary, certificates, attempts } = useUserData();
  const { levels } = useConfig();
  const { toast } = useToast();

  const updateAction = useAsyncAction(updateProfile);
  const exportAction = useAsyncAction(exportUserData);
  const resetAction = useAsyncAction(resetProfile);

  const [resetOpen, setResetOpen] = React.useState(false);

  if (status === 'loading') {
    return <LoadingState label="正在读取本地档案" rows={4} />;
  }

  if (status === 'no-profile' || !summary) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="我的档案" description="本机尚未建立考试档案。" />
        <EmptyState
          title="尚未建立本地考试档案"
          description="建立档案后即可参加模拟考试与正式考试、生成电子证件并查看权限清单。"
          action={
            <Button asChild size="sm">
              <Link to="/">返回首页建立档案</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const { profile } = summary;

  const handleUpdate = async (values: {
    displayName: string;
    avatarDataUrl: string | null;
  }): Promise<void> => {
    const outcome = await updateAction.run(profile.userId, {
      displayName: values.displayName,
      avatarDataUrl: values.avatarDataUrl,
    });

    if (outcome?.ok) {
      toast({ title: '档案已更新', tone: 'success' });
    }
  };

  const handleExport = async (): Promise<void> => {
    const outcome = await exportAction.run();

    if (outcome?.ok) {
      downloadTextFile(
        outcome.value,
        `iuqa-profile-${new Date().toISOString().slice(0, 10)}.json`,
      );
      toast({
        title: '个人数据已导出',
        description: '导出文件包含档案、证件、考试记录、设置与操作历史，不含题库正文。',
        tone: 'success',
      });
    }
  };

  const handleReset = async (): Promise<void> => {
    const outcome = await resetAction.run(profile.userId);

    if (outcome?.ok) {
      setResetOpen(false);
      toast({
        title: '本地考试档案已重置',
        description: '全部考试记录与证件已清除，考生编号已重新生成。',
        tone: 'success',
      });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="考生服务"
        title="我的档案"
        description="本档案仅保存在本机浏览器中。本中心不要求真实身份认证，也不收集身份证号码、真实住址等无必要信息。"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => void handleExport()} disabled={exportAction.pending}>
              <Download className="h-4 w-4" aria-hidden="true" />
              {exportAction.pending ? '正在导出…' : '导出个人数据'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setResetOpen(true)}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              重置考试档案
            </Button>
          </>
        }
      />

      {exportAction.error ? (
        <ErrorState
          title="导出失败"
          message={exportAction.error.message}
          hint={exportAction.error.hint}
          code={exportAction.error.code}
          details={exportAction.error.details}
        />
      ) : null}

      {resetAction.error ? (
        <ErrorState
          title="重置失败"
          message={resetAction.error.message}
          hint={resetAction.error.hint}
          code={resetAction.error.code}
          details={resetAction.error.details}
        />
      ) : null}

      {/* I. 档案概览 */}
      <Card>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-wrap items-start gap-5">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border border-line bg-surface-muted">
              {profile.avatarDataUrl ? (
                <img src={profile.avatarDataUrl} alt={`${profile.displayName} 的头像`} className="h-full w-full object-cover" />
              ) : (
                <span className="text-2xl font-semibold text-ink-faint" aria-hidden="true">
                  {profile.displayName.slice(0, 1)}
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-ink">{profile.displayName}</h2>
                <LevelBadge
                  level={summary.currentLevel}
                  temporary={!summary.levelFromCertificate}
                  size="sm"
                />
              </div>

              <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-[13px] sm:grid-cols-2">
                <div className="flex items-center justify-between gap-3 sm:justify-start">
                  <dt className="text-ink-faint">考生编号</dt>
                  <dd className="doc-code font-medium text-ink">{profile.candidateNumber}</dd>
                </div>
                <div className="flex items-center justify-between gap-3 sm:justify-start">
                  <dt className="text-ink-faint">档案建立时间</dt>
                  <dd className="tabular text-ink-soft">{formatDateTime(profile.establishedAt)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3 sm:justify-start">
                  <dt className="text-ink-faint">最近一次考试</dt>
                  <dd className="tabular text-ink-soft">
                    {summary.lastExamAt ? formatDateTime(summary.lastExamAt) : '尚无记录'}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 sm:justify-start">
                  <dt className="text-ink-faint">证件数量</dt>
                  <dd className="tabular text-ink-soft">{certificates.length} 张</dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="累计考试次数" value={summary.totalAttemptCount} unit="次" />
            <StatTile label="正式考试次数" value={summary.officialAttemptCount} unit="次" />
            <StatTile
              label="累计通过次数"
              value={summary.passedAttemptCount}
              unit="次"
              tone={summary.passedAttemptCount > 0 ? 'pass' : 'default'}
            />
            <StatTile
              label="当前等级"
              value={summary.currentLevel.levelId}
              hint={summary.currentLevel.nameZh}
              tone="brand"
            />
          </div>
        </CardContent>
      </Card>

      {/* II. 修改档案 */}
      <Section title="修改档案信息" description="昵称与头像会同步到成绩单与电子证件；已签发证件保留签发时的姓名快照。">
        <Card>
          <CardContent>
            <ProfileForm
              initialName={profile.displayName}
              initialAvatar={profile.avatarDataUrl}
              submitLabel="保存修改"
              onSubmit={handleUpdate}
              pending={updateAction.pending}
              error={updateAction.error?.message ?? null}
            />
          </CardContent>
        </Card>
      </Section>

      {/* III. 当前有效证件 */}
      <Section
        title="当前有效证件"
        description="升级后低等级证件会转为历史记录保留，不会因升级而被删除。"
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/certificates">查看全部证件</Link>
          </Button>
        }
      >
        {summary.activeCertificate ? (
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    to={`/certificate/${summary.activeCertificate.certificateId}`}
                    className="doc-code text-[15px] font-semibold text-brand underline-offset-4 hover:underline"
                  >
                    {summary.activeCertificate.certificateNumber}
                  </Link>
                  <CertificateStatusBadge
                    status={summary.activeCertificate.status}
                    label={CERTIFICATE_STATUS_LABELS[summary.activeCertificate.status]}
                  />
                </div>
                <p className="mt-1.5 text-[12px] text-ink-soft">
                  {levels.levels.find((level) => level.levelId === summary.activeCertificate?.levelId)
                    ?.nameZh ?? summary.activeCertificate.levelId}{' '}
                  · 授予于 {formatDateTime(summary.activeCertificate.issuedAt)}
                </p>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link to={`/certificate/${summary.activeCertificate.certificateId}`}>查看证件</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <EmptyState
            title="尚未签发任何证件"
            description="通过任一等级的正式考试后，系统会自动签发对应等级的电子证件。模拟考试不签发证件。"
            action={
              <Button asChild size="sm" variant="outline">
                <Link to="/exams">前往考试报名</Link>
              </Button>
            }
          />
        )}
      </Section>

      {/* IV. 数据说明 */}
      <Alert tone="info" title="本地数据说明">
        <ul className="mt-1 list-disc space-y-1 pl-4">
          <li>档案、考试记录、证件与设置全部保存在本机 IndexedDB，不涉及任何服务器。</li>
          <li>清除浏览器数据、更换浏览器或使用无痕模式会导致数据不可恢复，请及时导出备份。</li>
          <li>重置考试档案会清除全部考试记录与证件并重新生成考生编号，该操作不可撤销。</li>
          <li>
            本系统为纯前端应用，无法阻止使用者通过浏览器开发者工具直接修改本地数据，
            因此本地记录不构成任何可信凭证。
          </li>
        </ul>
      </Alert>

      <p className="flex items-start gap-2 text-[12px] leading-relaxed text-ink-faint">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          考试记录共 {attempts.length} 条。导出文件包含完整的答卷与试卷快照，可用于离线复核成绩。
        </span>
      </p>

      {/* V. 重置确认 */}
      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="重置本地考试档案"
        description={
          <>
            本操作将永久清除本机的
            <strong className="font-semibold text-ink">全部考试记录（{attempts.length} 条）</strong>
            与
            <strong className="font-semibold text-ink">全部电子证件（{certificates.length} 张）</strong>
            ，并重新生成考生编号。昵称与头像会保留。
          </>
        }
        notice="重置后已取得的等级与权限将一并失效，需要重新参加考试。该操作不可撤销。"
        confirmLabel="确认重置全部考试数据"
        destructive
        requireText="重置档案"
        pending={resetAction.pending}
        onConfirm={handleReset}
      />

      <div className="flex items-center gap-2 text-[12px] text-ink-faint">
        <Save className="h-4 w-4" aria-hidden="true" />
        建议在重置前先导出个人数据作为备份。
      </div>
    </div>
  );
}
