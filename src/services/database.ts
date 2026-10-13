/**
 * IndexedDB 数据层（Dexie 封装）
 *
 * I. 表结构
 *
 * 1. users          本地考生档案
 * 2. questionBanks  题库（内置与导入）
 * 3. examRules      考试规则配置
 * 4. examAttempts   考试记录（含试卷快照与答卷）
 * 5. certificates   电子证件
 * 6. appSettings    应用设置
 * 7. auditEvents    本地操作历史
 *
 * II. 版本迁移
 *
 * 1. 版本 1 建立基础表结构
 * 2. 版本 2 增加 auditEvents 表，并为考试记录补充 mode / durationMs / certificateId 字段
 * 3. 迁移逻辑写在 `upgrade` 回调中，仅在从旧版本升级时执行
 *
 * III. 可用性
 *
 * 1. IndexedDB 不可用时必须明确报错，绝不假装保存成功
 * 2. 所有写入方法在失败时返回 Result，由调用方决定如何提示用户
 *
 * @module services/database
 * @author zexuan.peng
 * @created 2026-10-14
 */

import Dexie from 'dexie';
import type { Table } from 'dexie';

import type { AppSettingKey, AppSettingRecord, AppSettingValueMap } from '@/types/settings';
import type { AppError, Result } from '@/types/common';
import type { AuditEventRecord } from '@/types/audit';
import type { CertificateRecord } from '@/types/certificate';
import type { ExamAttempt, ExamRulesRecord } from '@/types/exam';
import type { QuestionBankRecord } from '@/types/question';
import type { UserProfileRecord } from '@/types/user';

/** 数据库名称 */
export const DATABASE_NAME = 'iuqa-local-authority';

/** 当前数据结构版本 */
export const DATABASE_VERSION = 2;

/** 本地数据版本标识，随导出文件一同保存 */
export const DATA_VERSION = '1.0.0';

/**
 * IUQA 本地数据库
 *
 * 所有业务数据均存放于此，localStorage 仅用于主题等非关键 UI 偏好。
 */
export class IuqaDatabase extends Dexie {
  /** 本地考生档案 */
  users!: Table<UserProfileRecord, string>;
  /** 题库 */
  questionBanks!: Table<QuestionBankRecord, string>;
  /** 考试规则 */
  examRules!: Table<ExamRulesRecord, string>;
  /** 考试记录 */
  examAttempts!: Table<ExamAttempt, string>;
  /** 电子证件 */
  certificates!: Table<CertificateRecord, string>;
  /** 应用设置 */
  appSettings!: Table<AppSettingRecord, AppSettingKey>;
  /** 操作历史 */
  auditEvents!: Table<AuditEventRecord, number>;

  constructor(name: string = DATABASE_NAME) {
    super(name);

    // I. 版本 1：基础表结构
    this.version(1).stores({
      users: 'userId, candidateNumber, createdAt',
      questionBanks: 'bankId, source, importedAt, version',
      examRules: 'rulesId, importedAt, version',
      examAttempts:
        'attemptId, userId, examId, levelId, status, startedAt, [userId+examId], [userId+status]',
      certificates:
        'certificateId, userId, certificateNumber, levelId, examAttemptId, status, issuedAt, [userId+status]',
      appSettings: 'key',
    });

    // II. 版本 2：新增操作历史表，并为考试记录补充字段
    this.version(DATABASE_VERSION)
      .stores({
        users: 'userId, candidateNumber, createdAt, updatedAt',
        questionBanks: 'bankId, source, importedAt, version, schemaVersion',
        examRules: 'rulesId, importedAt, version, schemaVersion',
        examAttempts:
          'attemptId, userId, examId, levelId, status, mode, startedAt, [userId+examId], [userId+status], [userId+mode]',
        certificates:
          'certificateId, userId, certificateNumber, levelId, examAttemptId, status, issuedAt, schemaVersion, [userId+status]',
        appSettings: 'key, updatedAt',
        auditEvents: '++id, type, at, userId, [userId+at]',
      })
      .upgrade(async (transaction) => {
        // 1. 旧版考试记录缺少 mode 字段，统一按正式考试处理
        // 2. 同时补齐后续版本新增的可空字段，避免读取时出现 undefined 分支
        await transaction
          .table('examAttempts')
          .toCollection()
          .modify((attempt: Partial<ExamAttempt>) => {
            if (attempt.mode === undefined) {
              attempt.mode = 'official';
            }
            if (attempt.durationMs === undefined) {
              attempt.durationMs = null;
            }
            if (attempt.certificateId === undefined) {
              attempt.certificateId = null;
            }
            if (attempt.flaggedQuestionIds === undefined) {
              attempt.flaggedQuestionIds = [];
            }
          });
      });
  }
}

/** 全局数据库实例 */
export const db = new IuqaDatabase();

/** 数据库是否已成功初始化 */
let initialized = false;

/** 检测当前环境是否提供 IndexedDB */
export function isIndexedDbSupported(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false;
  }
}

/** 构造数据库不可用错误 */
function unavailableError(): AppError {
  return {
    code: 'INDEXED_DB_UNAVAILABLE',
    message: '当前浏览器环境不支持本地数据库（IndexedDB），考试数据无法保存。',
    hint: '请改用最新版本的 Chrome、Edge、Firefox 或 Safari；若处于无痕模式，请改用普通窗口。',
  };
}

/**
 * 初始化数据库
 *
 * 1. 首次调用会触发 Dexie 建表与版本迁移
 * 2. 重复调用直接返回成功，不重复打开连接
 */
export async function initializeDatabase(): Promise<Result<void, AppError>> {
  if (initialized) {
    return { ok: true, value: undefined };
  }

  if (!isIndexedDbSupported()) {
    return { ok: false, error: unavailableError() };
  }

  try {
    await db.open();
    initialized = true;
    return { ok: true, value: undefined };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      error: {
        code: 'DATABASE_INIT_FAILED',
        message: '本地数据库初始化失败，考试数据无法读取或保存。',
        hint: '请尝试清除本站点数据后重新加载页面；若问题持续存在，可能是浏览器禁用了本地存储。',
        details: [detail],
      },
    };
  }
}

/** 关闭数据库连接（主要用于测试与重置） */
export async function closeDatabase(): Promise<void> {
  if (db.isOpen()) {
    db.close();
  }
  initialized = false;
}

/**
 * 删除并重建整个本地数据库
 *
 * 仅在「清除本地模拟数据」与测试中使用，调用方必须已完成二次确认。
 */
export async function destroyDatabase(): Promise<Result<void, AppError>> {
  try {
    db.close();
    await Dexie.delete(DATABASE_NAME);
    initialized = false;
    await db.open();
    initialized = true;
    return { ok: true, value: undefined };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      error: {
        code: 'DATABASE_INIT_FAILED',
        message: '清除本地数据失败。',
        hint: '请关闭其他打开了本站点的标签页后重试。',
        details: [detail],
      },
    };
  }
}

/* ============================================================
   IV. 应用设置读写
   ============================================================ */

/** 读取单个应用设置 */
export async function getSetting<K extends AppSettingKey>(
  key: K,
): Promise<AppSettingValueMap[K] | undefined> {
  const record = await db.appSettings.get(key);
  return record?.value as AppSettingValueMap[K] | undefined;
}

/** 写入单个应用设置 */
export async function setSetting<K extends AppSettingKey>(
  key: K,
  value: AppSettingValueMap[K],
): Promise<void> {
  await db.appSettings.put({ key, value, updatedAt: Date.now() } as AppSettingRecord);
}

/** 批量读取全部应用设置 */
export async function getAllSettings(): Promise<Partial<AppSettingValueMap>> {
  const records = await db.appSettings.toArray();
  const result: Partial<AppSettingValueMap> = {};
  for (const record of records) {
    Object.assign(result, { [record.key]: record.value });
  }
  return result;
}

/* ============================================================
   V. 操作历史
   ============================================================ */

/** 记录一条本地操作历史 */
export async function recordAuditEvent(
  event: Omit<AuditEventRecord, 'id' | 'at'> & { at?: number },
): Promise<void> {
  try {
    await db.auditEvents.add({ ...event, at: event.at ?? Date.now() });
  } catch {
    // 操作历史写入失败不应影响主流程，静默忽略
  }
}

/** 查询操作历史 */
export async function listAuditEvents(limit = 50, userId?: string): Promise<AuditEventRecord[]> {
  const collection = userId
    ? db.auditEvents.where('userId').equals(userId)
    : db.auditEvents.orderBy('at');

  const events = await collection.reverse().limit(limit).toArray();
  return events.sort((a, b) => b.at - a.at);
}
