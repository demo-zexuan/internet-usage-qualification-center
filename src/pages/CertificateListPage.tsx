/**
 * 证件历史列表页
 *
 * I. 展示规则
 *
 * 1. 按等级从高到低展示全部证件，包含已被更高级证件替代的历史证件
 * 2. 升级不会删除旧证件，历史证件永久保留并标注状态
 *
 * II. 状态表达
 *
 * 1. 证件状态以文字徽章表达，不依赖颜色
 * 2. 当前证件单独标注，便于区分「当前资格」与「历史记录」
 *
 * @module pages/CertificateListPage
 * @author zexuan.peng
 * @created 2026-10-14
 */

import { FileBadge, PlusCircle } from 'lucide-react';
import * as React from 'react';
import { Link } from 'react-router-dom';

import { useConfig } from '@/app/config-context';
import { CertificateStatusBadge, LevelBadge } from '@/components/common/indicators';
import { PageHeader, Section } from '@/components/common/page-header';
import { EmptyState, LoadingState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableCell, TableHead, TableWrapper } from '@/components/ui/feedback';
import { useUserData } from '@/hooks/use-user-data';
import { CERTIFICATE_STATUS_LABELS } from '@/types/certificate';
import { formatDateTime } from '@/utils/format';
import { cn } from '@/utils/cn';

/** 证件历史列表页 */
export function CertificateListPage(): React.ReactElement {
  const { status, certificates, summary } = useUserData();
  const { levels } = useConfig();

  if (status === 'loading') {
    return <LoadingState label="正在读取证件记录" rows={4} />;
  }

  if (status === 'no-profile') {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="电子证件" description="尚未建立本地档案。" />
        <EmptyState
          title="尚未建立本地考试档案"
          description="建立档案并参加正式考试后，通过即可获得电子证件。"
          action={
            <Button asChild size="sm">
              <Link to="/">返回首页建立档案</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const activeId = summary?.activeCertificate?.certificateId ?? null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="证件服务"
        title="我的电子证件"
        description="本中心为每一位通过正式考试的考生签发电子证件。升级后低等级证件转为历史记录保留，不会因升级而被删除。"
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/exams">
              <PlusCircle className="h-4 w-4" aria-hidden="true" />
              参加升级考试
            </Link>
          </Button>
        }
      />

      {certificates.length === 0 ? (
        <EmptyState
          title="尚未签发任何证件"
          description="通过任一等级的正式考试后，系统会自动签发对应等级的电子证件。模拟考试不签发证件，也不计入正式考试次数。"
          icon={<FileBadge className="h-8 w-8" aria-hidden="true" />}
          action={
            <Button asChild size="sm">
              <Link to="/exams">前往考试报名</Link>
            </Button>
          }
        />
      ) : (
        <>
          <Section
            title={`共 ${certificates.length} 张证件`}
            description={
              summary?.levelFromCertificate
                ? `当前资格依据为 ${summary.currentLevel.levelId} ${summary.currentLevel.nameZh}。`
                : '当前尚无有效证件。'
            }
          >
            <Card>
              <CardContent className="pt-4">
                <TableWrapper>
                  <Table>
                    <caption className="sr-only">电子证件列表</caption>
                    <thead>
                      <tr>
                        <TableHead>证件编号</TableHead>
                        <TableHead>等级</TableHead>
                        <TableHead>授予日期</TableHead>
                        <TableHead>状态</TableHead>
                        <TableHead>专项认证</TableHead>
                        <TableHead className="text-right">操作</TableHead>
                      </tr>
                    </thead>
                    <tbody>
                      {certificates.map((certificate) => {
                        const level =
                          levels.levels.find((item) => item.levelId === certificate.levelId) ?? null;
                        const isActive = certificate.certificateId === activeId;

                        return (
                          <tr key={certificate.certificateId} className={cn(isActive && 'bg-brand-soft/40')}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Link
                                  to={`/certificate/${certificate.certificateId}`}
                                  className="doc-code text-[12px] font-medium text-brand underline-offset-4 hover:underline"
                                >
                                  {certificate.certificateNumber}
                                </Link>
                                {isActive ? (
                                  <span className="rounded border border-brand/35 px-1.5 py-0 text-[10px] font-medium text-brand">
                                    当前
                                  </span>
                                ) : null}
                              </div>
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {level ? <LevelBadge level={level} size="sm" /> : certificate.levelId}
                            </TableCell>
                            <TableCell className="tabular whitespace-nowrap text-[12px] text-ink-soft">
                              {formatDateTime(certificate.issuedAt)}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              <CertificateStatusBadge
                                status={certificate.status}
                                label={CERTIFICATE_STATUS_LABELS[certificate.status]}
                              />
                            </TableCell>
                            <TableCell className="text-[12px] text-ink-soft">
                              {certificate.certifications.length > 0
                                ? certificate.certifications.join('、')
                                : '—'}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button asChild size="sm" variant="outline">
                                <Link to={`/certificate/${certificate.certificateId}`}>查看</Link>
                              </Button>
                            </TableCell>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Table>
                </TableWrapper>
              </CardContent>
            </Card>
          </Section>

          <p className="text-[12px] leading-relaxed text-ink-faint">
            说明：证件状态中的「已被更高级证件替代」表示该证件对应的等级已被更高等级覆盖，
            但持证人仍然保有该等级的资格与权限，历史证件仅作记录保留。
            「已作废」表示该证件不再作为资格依据。
          </p>
        </>
      )}
    </div>
  );
}
