/**
 * 考生档案服务
 *
 * I. 数据最小化
 *
 * 1. 只收集昵称与可选头像，不收集身份证号、真实住址等敏感信息
 * 2. 档案只保存在本机 IndexedDB，不上传任何服务器
 *
 * II. 重置语义
 *
 * 1. 「重置本地考试档案」清除全部考试记录与证件，并重新生成考生编号
 * 2. 该操作不可撤销，调用方必须先完成二次确认
 *
 * @module features/profile/service
 * @author zexuan.peng
 * @created 2026-10-14
 */

import type { AppError, Result } from '@/types/common';
import type { UserProfileRecord } from '@/types/user';

import { createCandidateNumber } from '@/utils/id';
import { db, recordAuditEvent } from '@/services/database';

/** 档案结构版本 */
const PROFILE_SCHEMA_VERSION = '1.0.0';

/** 昵称长度上限 */
export const DISPLAY_NAME_MAX_LENGTH = 24;

/** 头像文件大小上限（2MB，超出会导致 IndexedDB 写入缓慢） */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

/** 建立档案输入 */
export interface CreateProfileInput {
  displayName: string;
  avatarDataUrl?: string | null;
}

/** 校验昵称 */
export function validateDisplayName(name: string): string | null {
  const trimmed = name.trim();

  if (trimmed.length === 0) {
    return '请填写考生姓名或昵称。';
  }
  if (trimmed.length > DISPLAY_NAME_MAX_LENGTH) {
    return `昵称长度不能超过 ${DISPLAY_NAME_MAX_LENGTH} 个字符。`;
  }
  return null;
}

/** 读取当前档案（单机应用最多一份） */
export async function getCurrentProfile(): Promise<UserProfileRecord | null> {
  const records = await db.users.toCollection().toArray();
  return records[0] ?? null;
}

/**
 * 建立本地考试档案
 *
 * 已存在档案时直接返回既有档案，避免产生并列的多份档案。
 */
export async function createProfile(
  input: CreateProfileInput,
): Promise<Result<UserProfileRecord, AppError>> {
  const nameError = validateDisplayName(input.displayName);
  if (nameError) {
    return {
      ok: false,
      error: { code: 'UNKNOWN', message: nameError, hint: '请修改后重新提交。' },
    };
  }

  try {
    const existing = await getCurrentProfile();
    if (existing) {
      return { ok: true, value: existing };
    }

    const now = Date.now();
    const profile: UserProfileRecord = {
      schemaVersion: PROFILE_SCHEMA_VERSION,
      userId: `user_${now.toString(36)}${Math.random().toString(36).slice(2, 8)}`,
      displayName: input.displayName.trim(),
      candidateNumber: createCandidateNumber(),
      avatarDataUrl: input.avatarDataUrl ?? null,
      establishedAt: now,
      preferredCertificateId: null,
      createdAt: now,
      updatedAt: now,
    };

    await db.users.put(profile);

    await recordAuditEvent({
      type: 'profile_created',
      userId: profile.userId,
      message: `建立本地考试档案：${profile.displayName}（${profile.candidateNumber}）`,
    });

    return { ok: true, value: profile };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      error: {
        code: 'DATABASE_INIT_FAILED',
        message: '档案写入本地数据库失败，档案未能建立。',
        hint: '请检查浏览器是否允许本站点使用本地存储。',
        details: [detail],
      },
    };
  }
}

/** 更新档案信息 */
export async function updateProfile(
  userId: string,
  patch: Partial<Pick<UserProfileRecord, 'displayName' | 'avatarDataUrl' | 'preferredCertificateId'>>,
): Promise<Result<UserProfileRecord, AppError>> {
  const profile = await db.users.get(userId);

  if (!profile) {
    return {
      ok: false,
      error: {
        code: 'PROFILE_NOT_FOUND',
        message: '本地档案不存在或已被清除。',
        hint: '请返回首页重新建立档案。',
      },
    };
  }

  if (patch.displayName !== undefined) {
    const nameError = validateDisplayName(patch.displayName);
    if (nameError) {
      return { ok: false, error: { code: 'UNKNOWN', message: nameError } };
    }
  }

  try {
    const updated: UserProfileRecord = {
      ...profile,
      ...patch,
      displayName: patch.displayName !== undefined ? patch.displayName.trim() : profile.displayName,
      updatedAt: Date.now(),
    };

    await db.users.put(updated);

    await recordAuditEvent({
      type: 'profile_updated',
      userId,
      message: '更新本地档案信息',
      metadata: { fields: Object.keys(patch) },
    });

    return { ok: true, value: updated };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      error: {
        code: 'DATABASE_INIT_FAILED',
        message: '档案更新失败。',
        details: [detail],
      },
    };
  }
}

/**
 * 重置本地考试档案
 *
 * 1. 清除全部考试记录与证件，并重新生成考生编号
 * 2. 保留昵称与头像，便于直接重新开始考试
 */
export async function resetProfile(userId: string): Promise<Result<UserProfileRecord, AppError>> {
  const profile = await db.users.get(userId);

  if (!profile) {
    return {
      ok: false,
      error: {
        code: 'PROFILE_NOT_FOUND',
        message: '本地档案不存在，无需重置。',
      },
    };
  }

  try {
    // I. 清除考试记录与证件
    await db.examAttempts.where('userId').equals(userId).delete();
    await db.certificates.where('userId').equals(userId).delete();

    // II. 重置档案字段
    const reset: UserProfileRecord = {
      ...profile,
      candidateNumber: createCandidateNumber(),
      preferredCertificateId: null,
      establishedAt: Date.now(),
      updatedAt: Date.now(),
    };

    await db.users.put(reset);

    await recordAuditEvent({
      type: 'profile_reset',
      userId,
      message: '重置本地考试档案，清除全部考试记录与证件',
    });

    return { ok: true, value: reset };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      error: {
        code: 'DATABASE_INIT_FAILED',
        message: '重置档案失败，原有数据未被清除。',
        hint: '请关闭其他打开了本站点的标签页后重试。',
        details: [detail],
      },
    };
  }
}

/** 导出数据结构 */
export interface UserDataExport {
  exportVersion: string;
  exportedAt: string;
  profile: UserProfileRecord | null;
  certificates: unknown[];
  attempts: unknown[];
  settings: unknown[];
  auditEvents: unknown[];
  /** 题库与规则的元信息摘要（完整内容请使用题库导出功能） */
  dataSummary: {
    bankCount: number;
    bankIds: string[];
    rulesCount: number;
    activeRulesId: string | null;
  };
}

/**
 * 导出个人数据
 *
 * 1. 导出内容为可读 JSON，包含档案、证件、考试记录、设置与操作历史
 * 2. 不包含题库正文（题库有独立的导出入口），仅给出元信息摘要
 */
export async function exportUserData(): Promise<Result<string, AppError>> {
  try {
    const profile = await getCurrentProfile();
    const userId = profile?.userId ?? null;

    const [certificates, attempts, settings, auditEvents, banks, rules] = await Promise.all([
      userId ? db.certificates.where('userId').equals(userId).toArray() : Promise.resolve([]),
      userId ? db.examAttempts.where('userId').equals(userId).toArray() : Promise.resolve([]),
      db.appSettings.toArray(),
      userId ? db.auditEvents.where('userId').equals(userId).toArray() : Promise.resolve([]),
      db.questionBanks.toArray(),
      db.examRules.toArray(),
    ]);

    const activeRulesId = settings.find((record) => record.key === 'activeRulesId')?.value as
      | string
      | undefined;

    const payload: UserDataExport = {
      exportVersion: '1.0.0',
      exportedAt: new Date().toISOString(),
      profile,
      certificates,
      attempts,
      settings,
      auditEvents,
      dataSummary: {
        bankCount: banks.length,
        bankIds: banks.map((bank) => bank.bankId),
        rulesCount: rules.length,
        activeRulesId: activeRulesId ?? null,
      },
    };

    await recordAuditEvent({
      type: 'data_exported',
      userId,
      message: '导出个人数据',
    });

    return { ok: true, value: JSON.stringify(payload, null, 2) };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      error: {
        code: 'DATABASE_INIT_FAILED',
        message: '导出个人数据失败。',
        hint: '请检查浏览器是否允许本站点读取本地存储。',
        details: [detail],
      },
    };
  }
}
