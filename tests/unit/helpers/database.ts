/**
 * 数据库测试辅助
 *
 * 提供测试用例之间的数据库清理，保证用例彼此独立。
 * 使用 fake-indexeddb（在 tests/setup.ts 中注入），无需真实浏览器环境。
 *
 * @author zexuan.peng
 * @created 2026-10-14
 */

import { db, initializeDatabase } from '@/services/database';

/** 清空全部业务表，保留数据库结构 */
export async function clearAllTables(): Promise<void> {
  await initializeDatabase();

  await Promise.all([
    db.users.clear(),
    db.questionBanks.clear(),
    db.examRules.clear(),
    db.examAttempts.clear(),
    db.certificates.clear(),
    db.appSettings.clear(),
    db.auditEvents.clear(),
  ]);
}

/** 统计各表记录数，用于断言幂等性（例如重复签发证件后证件数量不变） */
export async function countRows(): Promise<Record<string, number>> {
  const [users, banks, rules, attempts, certificates, settings, audits] = await Promise.all([
    db.users.count(),
    db.questionBanks.count(),
    db.examRules.count(),
    db.examAttempts.count(),
    db.certificates.count(),
    db.appSettings.count(),
    db.auditEvents.count(),
  ]);

  return {
    users,
    questionBanks: banks,
    examRules: rules,
    examAttempts: attempts,
    certificates,
    appSettings: settings,
    auditEvents: audits,
  };
}
