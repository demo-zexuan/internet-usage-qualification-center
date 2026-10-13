/**
 * 本地考生档案类型定义
 *
 * I. 数据最小化原则
 *
 * 1. 仅收集昵称与可选头像，不收集身份证号、真实住址等敏感信息
 * 2. 档案只保存在本机 IndexedDB，不上传任何服务器
 *
 * II. 派生字段策略
 *
 * 1. 最高等级、累计考试次数、通过次数等均为派生数据，由档案汇总模块实时计算
 * 2. 档案记录本身只保存用户直接提供的信息，避免派生数据与事实漂移
 *
 * @module types/user
 * @author zexuan.peng
 * @created 2026-10-14
 */

import type { VersionedRecord } from './common';
import type { CertificateRecord } from './certificate';
import type { LevelDefinition } from './level';

/** 本地考生档案记录 */
export interface UserProfileRecord extends VersionedRecord {
  /** 档案主键（本地生成） */
  userId: string;
  /** 考生姓名或昵称 */
  displayName: string;
  /** 考生编号，形如 IUQA-C-000123 */
  candidateNumber: string;
  /** 头像（DataURL）；未设置时为 null */
  avatarDataUrl: string | null;
  /** 档案建立时间（Unix 毫秒） */
  establishedAt: number;
  /** 用户指定优先展示的证件 ID；为 null 时自动选择最高有效等级证件 */
  preferredCertificateId: string | null;
}

/** 档案汇总视图：首页与个人中心使用的派生数据 */
export interface UserProfileSummary {
  profile: UserProfileRecord;
  /** 当前最高有效等级；无证件时为临时等级定义 */
  currentLevel: LevelDefinition;
  /** 当前等级是否来自有效证件（false 表示临时浏览状态） */
  levelFromCertificate: boolean;
  /** 当前有效证件 */
  activeCertificate: CertificateRecord | null;
  /** 全部证件，按等级倒序 */
  certificates: CertificateRecord[];
  /** 累计考试次数（含模拟考试） */
  totalAttemptCount: number;
  /** 累计正式考试次数 */
  officialAttemptCount: number;
  /** 累计通过次数 */
  passedAttemptCount: number;
  /** 最近一次考试时间 */
  lastExamAt: number | null;
  /** 已获得的专项能力认证 */
  certifications: string[];
  /** 距离下一等级还需要完成的条件说明 */
  nextLevelRequirements: NextLevelRequirement[];
  /** 下一等级定义；已是最高级时为 null */
  nextLevel: LevelDefinition | null;
}

/** 升级条件条目 */
export interface NextLevelRequirement {
  /** 条件描述 */
  label: string;
  /** 是否已满足 */
  satisfied: boolean;
  /** 附加说明 */
  hint?: string;
}
