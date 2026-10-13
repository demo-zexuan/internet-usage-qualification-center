/**
 * 证件模板与证件记录校验 Schema
 *
 * I. 模板校验
 *
 * 1. 证件文案全部来自 certificate-template.json，业务组件不得硬编码文案
 * 2. 模板必须包含免责声明，界面需原样展示
 *
 * II. 证件记录校验
 *
 * 1. 用于校验从 IndexedDB 读出的证件数据，识别损坏记录
 * 2. 证件编号必须符合 IUQA-年份-序号 的格式
 *
 * @module schemas/certificate.schema
 * @author zexuan.peng
 * @created 2026-10-14
 */

import { z } from 'zod';

import { CERTIFICATE_STATUSES } from '@/types/certificate';
import type { CertificateRecord, CertificateTemplate } from '@/types/certificate';

import { parseWithSchema, type ValidationFailure } from './validation';
import type { Result } from '@/types/common';

/** 当前证件模板结构版本 */
export const CERTIFICATE_TEMPLATE_SCHEMA_VERSION = '1.0.0';

/** 受支持的证件模板结构版本列表 */
export const SUPPORTED_CERTIFICATE_TEMPLATE_VERSIONS: readonly string[] = ['1.0.0'];

/** 证件记录结构版本 */
export const CERTIFICATE_RECORD_SCHEMA_VERSION = '1.0.0';

/** 证件编号格式：IUQA-四位年份-序号 */
export const CERTIFICATE_NUMBER_PATTERN = /^IUQA-\d{4}-[A-Z0-9]{4,12}$/;

/* ============================================================
   I. 证件模板
   ============================================================ */

const certificateTemplateSchema = z.object({
  schemaVersion: z
    .string()
    .min(1)
    .refine((value) => SUPPORTED_CERTIFICATE_TEMPLATE_VERSIONS.includes(value), {
      error: `不支持的证件模板结构版本，当前支持：${SUPPORTED_CERTIFICATE_TEMPLATE_VERSIONS.join('、')}`,
    }),
  templateId: z.string().min(1, { error: 'templateId 不能为空' }),
  version: z.string().min(1, { error: '模板版本号不能为空' }),
  documentTitle: z.string().min(1, { error: '证件标题不能为空' }),
  documentTitleEn: z.string().min(1, { error: '证件英文标题不能为空' }),
  issuerName: z.string().min(1, { error: '签发机构名称不能为空' }),
  issuerNameEn: z.string().min(1, { error: '签发机构英文名称不能为空' }),
  issuerCode: z.string().min(1, { error: '签发机构代码不能为空' }),
  numberPrefix: z
    .string()
    .min(1, { error: '编号前缀不能为空' })
    .regex(/^[A-Z]+$/, { error: '编号前缀必须为大写字母' }),
  numberRandomLength: z
    .number()
    .int()
    .min(4, { error: '编号随机段至少 4 位' })
    .max(12, { error: '编号随机段最多 12 位' }),
  statement: z.string().min(1, { error: '证件说明不能为空' }),
  clauses: z.array(z.string().min(1)).min(1, { error: '证件条款至少一条' }),
  disclaimer: z.string().min(1, { error: '免责声明不能为空' }),
  signatories: z
    .array(z.object({ title: z.string().min(1), name: z.string().min(1) }))
    .min(1, { error: '签署栏至少一项' }),
  validityStatement: z.string().min(1, { error: '有效期说明不能为空' }),
});

/* ============================================================
   II. 证件记录
   ============================================================ */

const certificateRecordSchema = z.object({
  schemaVersion: z.string().min(1),
  certificateId: z.string().min(1, { error: '证件 ID 不能为空' }),
  certificateNumber: z
    .string()
    .regex(CERTIFICATE_NUMBER_PATTERN, { error: '证件编号格式不合法，应形如 IUQA-2026-4F7K2M' }),
  userId: z.string().min(1, { error: '证件必须关联档案' }),
  levelId: z.string().regex(/^L\d+$/, { error: '证件等级 ID 不合法' }),
  levelOrder: z.number().int().min(1, { error: '证件等级序号必须为正整数' }),
  examAttemptId: z.string().min(1, { error: '证件必须关联考试记录' }),
  examId: z.string().min(1),
  holderName: z.string().min(1, { error: '持证人姓名不能为空' }),
  candidateNumber: z.string().min(1, { error: '考生编号不能为空' }),
  issuedAt: z.number().int().positive({ error: '授予日期不合法' }),
  status: z.enum(CERTIFICATE_STATUSES, { error: '证件状态不合法' }),
  checksum: z.string().min(1, { error: '证件校验码不能为空' }),
  issuerName: z.string().min(1),
  issuerCode: z.string().min(1),
  templateVersion: z.string().min(1),
  certifications: z.array(z.string()),
  fromMockExam: z.boolean(),
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive(),
});

/* ============================================================
   III. 对外接口
   ============================================================ */

/** 校验证件模板配置 */
export function validateCertificateTemplate(raw: unknown): Result<CertificateTemplate, ValidationFailure> {
  return parseWithSchema(certificateTemplateSchema, raw, '证件模板校验未通过') as Result<
    CertificateTemplate,
    ValidationFailure
  >;
}

/** 校验单条证件记录，用于识别损坏数据 */
export function validateCertificateRecord(raw: unknown): Result<CertificateRecord, ValidationFailure> {
  return parseWithSchema(certificateRecordSchema, raw, '证件记录校验未通过') as Result<
    CertificateRecord,
    ValidationFailure
  >;
}
