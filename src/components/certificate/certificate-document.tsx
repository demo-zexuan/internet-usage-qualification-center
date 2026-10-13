/**
 * 电子证件正文
 *
 * I. 版式
 *
 * 1. 采用横向证件版式（约 720×460 设计宽度），便于打印与导出 PNG
 * 2. 使用细密防伪底纹与行政红印章样式图形，但不伪造任何真实机关印章
 *
 * II. 必备要素
 *
 * 1. 机构徽记与名称、持证人姓名、考生编号、证件编号、等级中英文名称
 * 2. 授予日期、有效状态、签发机构与签发编号、本地校验图形
 * 3. 虚构性质免责声明（不可省略）
 *
 * III. 导出适配
 *
 * 1. 组件接受 ref，供图片导出与打印定位使用
 * 2. 超长昵称通过截断与换行约束，避免撑破版式
 *
 * @module components/certificate/certificate-document
 * @author zexuan.peng
 * @created 2026-10-14
 */

import * as React from 'react';

import { APP_NAME_EN, APP_ABBR } from '@/app/app-meta';
import { Emblem } from '@/components/layout/emblem';
import { VerificationGraphic } from '@/components/certificate/verification-graphic';
import { CERTIFICATE_STATUS_LABELS } from '@/types/certificate';
import type { CertificateRecord, CertificateTemplate } from '@/types/certificate';
import type { LevelDefinition } from '@/types/level';
import { formatDate } from '@/utils/format';
import { cn } from '@/utils/cn';

/** 证件设计宽度，导出与打印均按此宽度渲染 */
export const CERTIFICATE_DESIGN_WIDTH = 720;

/** 证件正文属性 */
export interface CertificateDocumentProps {
  certificate: CertificateRecord;
  level: LevelDefinition;
  template: CertificateTemplate;
  /** 持证人当前展示用昵称（可能与签发时快照不同） */
  holderName: string;
  /** 当前实际拥有的专项能力认证（用于证件标注） */
  certifications: string[];
  className?: string;
}

/** 电子证件正文 */
export const CertificateDocument = React.forwardRef<HTMLDivElement, CertificateDocumentProps>(
  function CertificateDocument(
    { certificate, level, template, holderName, certifications, className },
    ref,
  ) {
    return (
      <div
        ref={ref}
        data-testid="certificate-document"
        style={{ maxWidth: CERTIFICATE_DESIGN_WIDTH }}
        className={cn(
          'doc-paper doc-guilloche relative w-full overflow-hidden p-6 sm:p-8',
          className,
        )}
      >
        {/* I. 顶部机构栏 */}
        <header className="flex items-start justify-between gap-4 border-b-2 border-navy-800 pb-4">
          <div className="flex min-w-0 items-center gap-3">
            <Emblem size={46} />
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold leading-tight text-navy-800">
                {template.issuerName}
              </p>
              <p className="truncate text-[9px] uppercase tracking-[0.16em] text-ink-faint">
                {template.issuerNameEn}
              </p>
            </div>
          </div>

          <div className="shrink-0 text-right">
            <p className="text-[10px] text-ink-faint">证件编号</p>
            <p className="doc-code text-[12px] font-semibold text-navy-800" data-testid="certificate-number">
              {certificate.certificateNumber}
            </p>
            <p className="mt-1 text-[10px] text-ink-faint">
              签发编号 <span className="doc-code">{certificate.certificateId.slice(-10).toUpperCase()}</span>
            </p>
          </div>
        </header>

        {/* II. 证件标题 */}
        <div className="mt-5 text-center">
          <h2 className="text-xl font-semibold tracking-[0.2em] text-navy-800">
            {template.documentTitle}
          </h2>
          <p className="mt-1 text-[9px] uppercase tracking-[0.2em] text-ink-faint">
            {template.documentTitleEn}
          </p>
        </div>

        {/* III. 等级展示 */}
        <div className="mt-5 flex items-center justify-center gap-4">
          <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-full border-2 border-navy-800 text-navy-800">
            <span className="doc-code text-lg font-semibold leading-none">{level.levelId}</span>
            <span className="mt-0.5 text-[8px] leading-none text-ink-faint">等级</span>
          </div>
          <div className="min-w-0 text-left">
            <p className="text-[17px] font-semibold leading-tight text-ink">{level.nameZh}</p>
            <p className="text-[11px] leading-tight text-ink-soft">{level.nameEn}</p>
            <p className="mt-1 text-[10px] leading-tight text-ink-faint">{level.certificateMotto}</p>
          </div>
        </div>

        {/* IV. 持证人信息 */}
        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 border-y border-line py-4 text-[12px]">
          <div className="min-w-0">
            <dt className="text-[10px] text-ink-faint">持证人</dt>
            <dd
              className="mt-0.5 truncate text-[15px] font-semibold text-ink"
              title={holderName}
              data-testid="certificate-holder"
            >
              {holderName}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[10px] text-ink-faint">考生编号</dt>
            <dd className="doc-code mt-0.5 truncate text-[13px] text-ink">
              {certificate.candidateNumber}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[10px] text-ink-faint">授予日期</dt>
            <dd className="tabular mt-0.5 text-[13px] text-ink">{formatDate(certificate.issuedAt)}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[10px] text-ink-faint">有效状态</dt>
            <dd className="mt-0.5 text-[13px] font-medium text-ink">
              {CERTIFICATE_STATUS_LABELS[certificate.status]}
            </dd>
          </div>
        </dl>

        {/* V. 证件说明 */}
        <p className="mt-4 text-[11px] leading-relaxed text-ink-soft">{template.statement}</p>

        {/* VI. 专项能力认证 */}
        {certifications.length > 0 ? (
          <div className="mt-3">
            <p className="text-[10px] text-ink-faint">专项能力认证</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {certifications.map((certification) => (
                <span
                  key={certification}
                  className="rounded border border-navy-800/35 px-2 py-0.5 text-[10px] font-medium text-navy-800"
                >
                  {certification}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {/* VII. 底部：校验图形 + 印章 + 签署 */}
        <div className="mt-5 flex items-end justify-between gap-4 border-t border-line pt-4">
          <VerificationGraphic
            certificateNumber={certificate.certificateNumber}
            checksum={certificate.checksum}
            size={92}
          />

          <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <div className="doc-seal h-20 w-20">
              <span className="px-1 text-[9px] font-semibold leading-tight">
                {APP_ABBR}
                <br />
                资格认证专用
              </span>
            </div>
            <p className="text-center text-[9px] text-ink-faint">
              印章为装饰性图形，非真实机关印章
            </p>
          </div>

          <div className="shrink-0 text-right text-[10px] leading-relaxed text-ink-soft">
            {template.signatories.map((signatory) => (
              <p key={signatory.title}>
                <span className="text-ink-faint">{signatory.title}：</span>
                {signatory.name}
              </p>
            ))}
            <p className="mt-1 text-ink-faint">
              签发机构代码 <span className="doc-code">{template.issuerCode}</span>
            </p>
            <p className="text-ink-faint">模板版本 {certificate.templateVersion}</p>
          </div>
        </div>

        {/* VIII. 免责声明 */}
        <p className="mt-4 rounded border border-accent/35 bg-accent-soft/50 px-3 py-2 text-[10px] leading-relaxed text-ink-soft">
          {template.disclaimer}
        </p>

        <p className="mt-2 text-center text-[9px] text-ink-faint">
          {APP_NAME_EN} · {template.validityStatement}
        </p>
      </div>
    );
  },
);
