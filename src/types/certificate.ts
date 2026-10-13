/**
 * 电子证件类型定义
 *
 * 证件为本地生成的虚构资格凭证，仅在应用内展示，
 * 不具备任何现实法律效力，也无法被第三方在线核验。
 *
 * @module types/certificate
 * @author zexuan.peng
 * @created 2026-10-14
 */

import type { VersionedRecord } from './common';

/** 证件状态 */
export const CERTIFICATE_STATUSES = ['valid', 'superseded', 'revoked'] as const;

export type CertificateStatus = (typeof CERTIFICATE_STATUSES)[number];

export const CERTIFICATE_STATUS_LABELS: Record<CertificateStatus, string> = {
  valid: '有效',
  superseded: '已被更高级证件替代',
  revoked: '已作废',
};

/** 电子证件记录 */
export interface CertificateRecord extends VersionedRecord {
  /** 内部主键 */
  certificateId: string;
  /** 证件编号，形如 IUQA-2026-4F7K2M */
  certificateNumber: string;
  userId: string;
  levelId: string;
  /** 等级序号冗余存储，便于排序与权限计算 */
  levelOrder: number;
  /** 签发依据的考试记录 ID */
  examAttemptId: string;
  examId: string;
  /** 持证人姓名或昵称 */
  holderName: string;
  /** 考生编号 */
  candidateNumber: string;
  /** 授予日期（Unix 毫秒） */
  issuedAt: number;
  status: CertificateStatus;
  /** 本地校验码：由证件编号与等级推导，用于生成校验图形 */
  checksum: string;
  /** 签发机构名称 */
  issuerName: string;
  /** 签发机构代码 */
  issuerCode: string;
  /** 证件模板版本，便于文案变更后区分历史证件 */
  templateVersion: string;
  /** 随证件授予的专项能力认证 */
  certifications: string[];
  /** 该证件是否由模拟考试成绩签发（模拟考试默认不签发正式证件） */
  fromMockExam: boolean;
}

/** 证件模板配置（certificate-template.json） */
export interface CertificateTemplate {
  schemaVersion: string;
  templateId: string;
  version: string;
  /** 证件标题 */
  documentTitle: string;
  documentTitleEn: string;
  /** 签发机构 */
  issuerName: string;
  issuerNameEn: string;
  issuerCode: string;
  /** 编号前缀 */
  numberPrefix: string;
  /** 编号随机段长度 */
  numberRandomLength: number;
  /** 证件正面说明 */
  statement: string;
  /** 证件条款条目 */
  clauses: string[];
  /** 必须展示的免责声明 */
  disclaimer: string;
  /** 签署栏 */
  signatories: { title: string; name: string }[];
  /** 有效期说明 */
  validityStatement: string;
}

/** 证件编号解析结果 */
export interface CertificateNumberParts {
  prefix: string;
  year: number;
  serial: string;
}

/** 证件校验图形数据：由编号确定性推导的装饰矩阵 */
export interface CertificateVerificationGraphic {
  /** 矩阵边长 */
  size: number;
  /** 需要填充的单元格坐标集合，形如 "r-c" */
  cells: Set<string>;
  /** 校验码文本 */
  checksum: string;
}
