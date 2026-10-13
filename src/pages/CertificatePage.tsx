/**
 * 电子证件页
 *
 * I. 提供能力
 *
 * 1. 网页证件展示与适合打印的版式
 * 2. 浏览器打印（可选择「另存为 PDF」保存）
 * 3. 下载 PNG 证件图片（基于 html-to-image）
 * 4. 复制证件编号与复制分享用展示页链接
 * 5. 证件历史入口
 *
 * II. 能力边界
 *
 * 1. 证件为本地生成的虚构凭证，本平台未部署任何在线核验服务
 * 2. 页面必须明确说明证件无法被第三方在线验证，且不具有现实法律效力
 *
 * III. 导出异常处理
 *
 * 1. 字体未加载、导出被拦截、浏览器不支持等情形均给出可读提示与替代方案
 *
 * @module pages/CertificatePage
 * @author zexuan.peng
 * @created 2026-10-14
 */

import { Copy, Download, Link2, Printer, ShieldAlert } from 'lucide-react';
import * as React from 'react';
import { Link, useParams } from 'react-router-dom';

import { useConfig } from '@/app/config-context';
import {
  CERTIFICATE_DESIGN_WIDTH,
  CertificateDocument,
} from '@/components/certificate/certificate-document';
import { CertificateStatusBadge } from '@/components/common/indicators';
import { PageHeader, Section } from '@/components/common/page-header';
import { ErrorState, LoadingState } from '@/components/common/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert } from '@/components/ui/feedback';
import { useToast } from '@/components/ui/toast';
import { findCertificateById } from '@/features/certificates/service';
import { useUserData } from '@/hooks/use-user-data';
import { copyToClipboard, exportElementToPng, printDocument } from '@/services/image-export';
import { CERTIFICATE_STATUS_LABELS } from '@/types/certificate';
import type { CertificateRecord } from '@/types/certificate';
import type { AppError } from '@/types/common';
import { formatDateTime } from '@/utils/format';

/** 电子证件页 */
export function CertificatePage(): React.ReactElement {
  const { certificateId } = useParams<{ certificateId: string }>();
  const { toast } = useToast();
  const { levels, certificateTemplate } = useConfig();
  const { summary } = useUserData();

  const [certificate, setCertificate] = React.useState<CertificateRecord | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<AppError | null>(null);
  const [exporting, setExporting] = React.useState(false);
  const [exportError, setExportError] = React.useState<AppError | null>(null);

  const documentRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    let cancelled = false;

    const load = async (): Promise<void> => {
      if (!certificateId) {
        setLoadError({
          code: 'INVALID_ROUTE_PARAM',
          message: '证件地址不完整。',
          hint: '请返回证件历史列表重新选择。',
        });
        setLoading(false);
        return;
      }

      const record = await findCertificateById(certificateId);

      if (cancelled) {
        return;
      }

      if (!record) {
        setLoadError({
          code: 'CERTIFICATE_NOT_FOUND',
          message: '找不到该证件记录。',
          hint: '该证件可能已随本地数据清除而删除。请返回证件历史列表查看现有证件。',
        });
        setLoading(false);
        return;
      }

      setCertificate(record);
      setLoading(false);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [certificateId]);

  if (loading) {
    return <LoadingState label="正在读取证件记录" rows={4} />;
  }

  if (loadError || !certificate) {
    return (
      <div className="flex flex-col gap-4">
        <ErrorState
          title="无法读取证件"
          message={loadError?.message ?? '证件记录不存在。'}
          hint={loadError?.hint}
          code={loadError?.code ?? 'CERTIFICATE_NOT_FOUND'}
          details={loadError?.details}
        />
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/certificates">返回证件历史</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/">返回首页</Link>
          </Button>
        </div>
      </div>
    );
  }

  const level = levels.levels.find((item) => item.levelId === certificate.levelId) ?? null;

  if (!level) {
    return (
      <ErrorState
        title="证件等级配置缺失"
        message={`证件记录的等级「${certificate.levelId}」在当前等级配置中不存在。`}
        hint="这通常意味着等级配置被修改过。请恢复 src/data/levels.json 后重新构建。"
        code="EXAM_RULE_INVALID"
      />
    );
  }

  /** 下载 PNG */
  const handleDownloadPng = async (): Promise<void> => {
    if (!documentRef.current) {
      return;
    }

    setExporting(true);
    setExportError(null);

    const result = await exportElementToPng(documentRef.current, {
      fileName: `iuqa-certificate-${certificate.certificateNumber}`,
      pixelRatio: 2,
      targetWidth: CERTIFICATE_DESIGN_WIDTH,
      backgroundColor: '#ffffff',
    });

    setExporting(false);

    if (result.ok) {
      toast({
        title: '证件图片已下载',
        description: 'PNG 文件已保存到浏览器的下载目录。',
        tone: 'success',
      });
    } else {
      setExportError(result.error);
    }
  };

  /** 浏览器打印 */
  const handlePrint = (): void => {
    const result = printDocument();
    if (!result.ok) {
      setExportError(result.error);
      return;
    }
    toast({
      title: '已调用浏览器打印',
      description: '在打印对话框中选择「另存为 PDF」即可保存为 PDF 文件。',
      tone: 'info',
    });
  };

  /** 复制证件编号 */
  const handleCopyNumber = async (): Promise<void> => {
    const result = await copyToClipboard(certificate.certificateNumber);
    if (result.ok) {
      toast({ title: '证件编号已复制', tone: 'success', durationMs: 2500 });
    } else {
      setExportError(result.error);
    }
  };

  /** 复制分享用链接 */
  const handleCopyLink = async (): Promise<void> => {
    const url = `${window.location.origin}/certificate/${certificate.certificateId}`;
    const result = await copyToClipboard(url);
    if (result.ok) {
      toast({
        title: '展示页链接已复制',
        description: '该链接指向本机应用中的证件页面，他人需要在本机打开该应用才能查看。',
        tone: 'info',
      });
    } else {
      setExportError(result.error);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="证件服务"
        title="电子资格证件"
        crumbs={[
          { label: '首页', to: '/' },
          { label: '电子证件', to: '/certificates' },
          { label: certificate.certificateNumber },
        ]}
        description="本证件由本机浏览器生成并保存，全部数据仅存在于当前设备。"
        actions={
          <>
            <CertificateStatusBadge
              status={certificate.status}
              label={CERTIFICATE_STATUS_LABELS[certificate.status]}
            />
            <Badge variant="brand">{level.levelId}</Badge>
          </>
        }
      />

      {exportError ? (
        <ErrorState
          title="导出或复制失败"
          message={exportError.message}
          hint={exportError.hint}
          code={exportError.code}
          details={exportError.details}
        />
      ) : null}

      {/* I. 证件正文 */}
      <Section
        title="证件展示"
        description="下方为证件正文。打印与图片导出均按该版式渲染。"
        actions={
          <div className="no-print flex flex-wrap gap-2">
            <Button size="sm" onClick={handlePrint}>
              <Printer className="h-4 w-4" aria-hidden="true" />
              打印 / 另存为 PDF
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void handleDownloadPng()}
              disabled={exporting}
              data-testid="download-png"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              {exporting ? '正在导出…' : '下载 PNG'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void handleCopyNumber()}>
              <Copy className="h-4 w-4" aria-hidden="true" />
              复制编号
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void handleCopyLink()}>
              <Link2 className="h-4 w-4" aria-hidden="true" />
              复制展示页链接
            </Button>
          </div>
        }
      >
        <div className="flex justify-center overflow-x-auto">
          <CertificateDocument
            ref={documentRef}
            certificate={certificate}
            level={level}
            template={certificateTemplate}
            holderName={summary?.profile.displayName ?? certificate.holderName}
            certifications={summary?.certifications ?? certificate.certifications}
            className="print-area"
          />
        </div>
      </Section>

      {/* II. 证件条款 */}
      <Section title="证件条款" description="以下条款为证件不可分割的组成部分。">
        <Card>
          <CardContent>
            <ol className="list-decimal space-y-2 pl-5 text-[13px] leading-relaxed text-ink-soft">
              {certificateTemplate.clauses.map((clause, index) => (
                <li key={index}>{clause}</li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </Section>

      {/* III. 边界声明 */}
      <Alert tone="warning" title="重要说明：本证件不具有现实法律效力">
        <ul className="mt-1 list-disc space-y-1 pl-4">
          <li>{certificateTemplate.disclaimer}</li>
          <li>
            本平台未部署任何在线验证服务。证件上的校验图形是装饰性图案，**不可扫描**，
            第三方无法通过任何渠道核验证件真伪。
          </li>
          <li>
            证件不授予持证人任何真实的网络访问权限、代理能力或平台发言权限，
            也不改变持证人设备的任何系统设置。
          </li>
          <li>「复制展示页链接」仅复制本机应用的页面地址，他人需要在本机打开本应用才能查看。</li>
        </ul>
      </Alert>

      {/* IV. 证件元信息 */}
      <Section title="证件记录信息">
        <Card>
          <CardContent>
            <dl className="grid gap-x-6 gap-y-2 text-[13px] sm:grid-cols-2">
              <div className="flex items-center justify-between gap-3 sm:justify-start">
                <dt className="text-ink-faint">证件编号</dt>
                <dd className="doc-code text-ink">{certificate.certificateNumber}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 sm:justify-start">
                <dt className="text-ink-faint">内部证件 ID</dt>
                <dd className="doc-code truncate text-ink-soft">{certificate.certificateId}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 sm:justify-start">
                <dt className="text-ink-faint">校验码</dt>
                <dd className="doc-code text-ink-soft">{certificate.checksum}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 sm:justify-start">
                <dt className="text-ink-faint">签发机构</dt>
                <dd className="text-ink-soft">
                  {certificate.issuerName}（{certificate.issuerCode}）
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 sm:justify-start">
                <dt className="text-ink-faint">授予日期</dt>
                <dd className="tabular text-ink-soft">{formatDateTime(certificate.issuedAt)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 sm:justify-start">
                <dt className="text-ink-faint">签发依据</dt>
                <dd className="text-ink-soft">
                  <Link
                    to={`/results/${certificate.examAttemptId}`}
                    className="text-brand underline-offset-4 hover:underline"
                  >
                    查看本场考试成绩
                  </Link>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 sm:justify-start">
                <dt className="text-ink-faint">模板版本</dt>
                <dd className="doc-code text-ink-soft">{certificate.templateVersion}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 sm:justify-start">
                <dt className="text-ink-faint">有效期</dt>
                <dd className="text-ink-soft">{certificateTemplate.validityStatement}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </Section>

      <p className="no-print flex items-start gap-2 text-[12px] leading-relaxed text-ink-faint">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          若需要 PDF 版本，请点击「打印 / 另存为 PDF」并在打印对话框的目标位置选择「另存为 PDF」。
          本系统不额外生成 PDF 文件，以避免引入复杂的排版依赖。
        </span>
      </p>

      <div className="no-print flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link to="/certificates">返回证件历史</Link>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link to="/permissions">查看当前权限</Link>
        </Button>
      </div>
    </div>
  );
}
