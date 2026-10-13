/**
 * IndexedDB 数据迁移测试
 *
 * 验证从数据库版本 1 升级到版本 2 时：
 * 1. 新增的 auditEvents 表被创建
 * 2. 旧版考试记录缺失的 mode / durationMs / certificateId / flaggedQuestionIds 字段被补齐
 * 3. 迁移不会丢失既有数据
 *
 * 说明：本用例需要独占数据库，因此单独放在一个测试文件中。
 *
 * @author zexuan.peng
 * @created 2026-10-14
 */

import Dexie from 'dexie';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DATABASE_NAME, closeDatabase, db, initializeDatabase } from '@/services/database';

/** 版本 1 的表结构，与 database.ts 中的历史定义保持一致 */
const V1_STORES = {
  users: 'userId, candidateNumber, createdAt',
  questionBanks: 'bankId, source, importedAt, version',
  examRules: 'rulesId, importedAt, version',
  examAttempts:
    'attemptId, userId, examId, levelId, status, startedAt, [userId+examId], [userId+status]',
  certificates:
    'certificateId, userId, certificateNumber, levelId, examAttemptId, status, issuedAt, [userId+status]',
  appSettings: 'key',
};

describe('IndexedDB 版本迁移', () => {
  beforeAll(async () => {
    // 先关闭并删除现有数据库，构造一个真实的版本 1 数据库
    await closeDatabase();
    await Dexie.delete(DATABASE_NAME);

    const legacy = new Dexie(DATABASE_NAME);
    legacy.version(1).stores(V1_STORES);
    await legacy.open();

    await legacy.table('examAttempts').put({
      attemptId: 'legacy-attempt-1',
      userId: 'legacy-user',
      examId: 'L1-BASIC',
      examTitle: '旧版考试记录',
      levelId: 'L1',
      status: 'submitted',
      startedAt: 1_700_000_000_000,
      // 故意不提供 mode / durationMs / certificateId / flaggedQuestionIds
    });

    await legacy.table('users').put({
      userId: 'legacy-user',
      displayName: '旧版考生',
      candidateNumber: 'IUQA-C-LEGACY',
      createdAt: 1_700_000_000_000,
      updatedAt: 1_700_000_000_000,
    });

    legacy.close();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it('打开数据库时自动执行迁移且不报错', async () => {
    const result = await initializeDatabase();
    expect(result.ok).toBe(true);
  });

  it('旧版考试记录被补齐新增字段', async () => {
    const migrated = await db.examAttempts.get('legacy-attempt-1');

    expect(migrated).toBeDefined();
    expect(migrated?.mode).toBe('official');
    expect(migrated?.durationMs).toBeNull();
    expect(migrated?.certificateId).toBeNull();
    expect(migrated?.flaggedQuestionIds).toEqual([]);
  });

  it('迁移不丢失既有数据', async () => {
    const user = await db.users.get('legacy-user');
    expect(user?.displayName).toBe('旧版考生');
    expect(user?.candidateNumber).toBe('IUQA-C-LEGACY');

    const attempt = await db.examAttempts.get('legacy-attempt-1');
    expect(attempt?.examTitle).toBe('旧版考试记录');
    expect(attempt?.startedAt).toBe(1_700_000_000_000);
  });

  it('新增的操作历史表可用', async () => {
    const id = await db.auditEvents.add({
      type: 'settings_changed',
      at: Date.now(),
      userId: null,
      message: '迁移后写入的操作历史',
    });

    expect(typeof id).toBe('number');
    const stored = await db.auditEvents.get(id);
    expect(stored?.message).toBe('迁移后写入的操作历史');

    await db.auditEvents.clear();
  });

  it('迁移后仍可正常写入并读取新版本字段', async () => {
    await db.examAttempts.put({
      schemaVersion: '1.0.0',
      attemptId: 'new-attempt-1',
      userId: 'legacy-user',
      examId: 'L2-INTERACT',
      examTitle: '新版考试记录',
      levelId: 'L2',
      mode: 'mock',
      status: 'in_progress',
      paper: {} as never,
      answers: {},
      flaggedQuestionIds: ['Q1'],
      currentIndex: 0,
      startedAt: Date.now(),
      expiresAt: Date.now() + 600_000,
      remainingMs: 600_000,
      lastSavedAt: Date.now(),
      submittedAt: null,
      submitReason: null,
      result: null,
      certificateId: null,
      durationMs: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const stored = await db.examAttempts.get('new-attempt-1');
    expect(stored?.mode).toBe('mock');
    expect(stored?.flaggedQuestionIds).toEqual(['Q1']);
  });

  it('按 userId 与 mode 的复合索引可以正常查询', async () => {
    const results = await db.examAttempts.where('[userId+mode]').equals(['legacy-user', 'mock']).toArray();
    expect(results.map((item) => item.attemptId)).toContain('new-attempt-1');
  });
});
