/**
 * 题库导入数据保护集成测试
 *
 * 覆盖项目测试要求中的「题库导入失败时的数据保护」条目：
 * 1. 非法 JSON 文本不写入数据库，现有题库保持不变
 * 2. 结构校验失败的题库不写入数据库
 * 3. 校验通过的题库正常写入并加入启用列表
 * 4. 覆盖同 ID 题库时标记为替换
 * 5. 导入与导出写入本地操作历史
 *
 * @author zexuan.peng
 * @created 2026-10-14
 */

import { beforeEach, describe, expect, it } from 'vitest';

import {
  exportQuestionBank,
  importQuestionBank,
  listBankRecords,
  loadActiveBanks,
  restoreBuiltinBanks,
  setActiveBankIds,
} from '@/features/config/service';
import { db } from '@/services/database';
import { clearAllTables } from '../unit/helpers/database';

/** 一份合法的题库 JSON 文本 */
function validBankText(bankId = 'imported-bank', title = '导入题库'): string {
  return JSON.stringify({
    schemaVersion: '1.0.0',
    bankId,
    title,
    description: '导入测试题库',
    language: 'zh-CN',
    version: '2.0.0',
    questions: [
      {
        id: 'IMP-001',
        type: 'single_choice',
        category: 'information_literacy',
        difficulty: 2,
        tags: ['imported'],
        stem: '导入的测试题干',
        options: [
          { id: 'A', text: '选项 A' },
          { id: 'B', text: '选项 B' },
        ],
        answer: { mode: 'key', correctOptionIds: ['A'] },
        explanation: '导入的测试解析',
        score: 5,
      },
    ],
  });
}

beforeEach(async () => {
  await clearAllTables();
  // 先写入一个有效的内置题库，用于验证导入失败时它不被破坏
  await importQuestionBank(validBankText('existing-bank', '既有有效题库'), { source: 'builtin' });
});

describe('导入失败时的数据保护', () => {
  it('非法 JSON 文本被拒绝且现有题库保持不变', async () => {
    const before = await listBankRecords();
    expect(before).toHaveLength(1);

    const result = await importQuestionBank('{ 这不是合法 JSON');

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe('IMPORT_VALIDATION_FAILED');
    expect(result.error.message).toContain('JSON');

    const after = await listBankRecords();
    expect(after).toHaveLength(1);
    expect(after[0]?.bankId).toBe('existing-bank');
    expect(after[0]?.rawJson).toBe(validBankText('existing-bank', '既有有效题库'));
  });

  it('结构校验失败的题库被拒绝且现有题库保持不变', async () => {
    const invalid = JSON.stringify({
      schemaVersion: '1.0.0',
      bankId: 'bad-bank',
      title: '非法题库',
      version: '1.0.0',
      questions: [
        {
          id: 'BAD-001',
          type: 'single_choice',
          category: 'information_literacy',
          difficulty: 1,
          tags: ['bad'],
          stem: '题干',
          options: [
            { id: 'A', text: 'A' },
            { id: 'B', text: 'B' },
          ],
          // 引用了不存在的选项
          answer: { mode: 'key', correctOptionIds: ['Z'] },
          explanation: '解析',
          score: 5,
        },
      ],
    });

    const result = await importQuestionBank(invalid);

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.details?.some((detail) => detail.includes('correctOptionIds'))).toBe(true);

    const after = await listBankRecords();
    expect(after.map((bank) => bank.bankId)).toEqual(['existing-bank']);
  });

  it('结构版本不受支持时被拒绝', async () => {
    const invalid = JSON.stringify({
      schemaVersion: '99.0.0',
      bankId: 'future-bank',
      title: '未来版本题库',
      version: '1.0.0',
      questions: [],
    });

    const result = await importQuestionBank(invalid);
    expect(result.ok).toBe(false);

    const after = await listBankRecords();
    expect(after.map((bank) => bank.bankId)).toEqual(['existing-bank']);
  });

  it('导入失败会写入操作历史以便追溯', async () => {
    await importQuestionBank('not-json');

    const events = await db.auditEvents.where('type').equals('bank_import_failed').toArray();
    expect(events.length).toBeGreaterThan(0);
  });
});

describe('导入成功后的应用', () => {
  it('校验通过的题库写入数据库并自动加入启用列表', async () => {
    const result = await importQuestionBank(validBankText());

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.bankId).toBe('imported-bank');
    expect(result.value.questionCount).toBe(1);
    expect(result.value.replaced).toBe(false);

    const records = await listBankRecords();
    expect(records.map((bank) => bank.bankId).sort()).toEqual(['existing-bank', 'imported-bank']);

    const active = await loadActiveBanks();
    expect(active.map((bank) => bank.bankId)).toContain('imported-bank');

    const imported = records.find((bank) => bank.bankId === 'imported-bank');
    expect(imported?.source).toBe('imported');
    expect(imported?.stats.totalQuestions).toBe(1);
    expect(imported?.stats.totalScore).toBe(5);
  });

  it('覆盖同 ID 题库时标记为替换并保留新内容', async () => {
    const result = await importQuestionBank(validBankText('existing-bank', '更新后的题库'));

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.replaced).toBe(true);

    const records = await listBankRecords();
    expect(records).toHaveLength(1);
    expect(records[0]?.title).toBe('更新后的题库');
    expect(records[0]?.version).toBe('2.0.0');
  });

  it('导出的 JSON 与导入的原文逐字节一致', async () => {
    const original = validBankText('roundtrip-bank', '往返测试题库');
    await importQuestionBank(original);

    const exported = await exportQuestionBank('roundtrip-bank');

    expect(exported.ok).toBe(true);
    if (!exported.ok) {
      return;
    }
    expect(exported.value).toBe(original);
  });

  it('导出不存在的题库时返回可读错误', async () => {
    const result = await exportQuestionBank('not-exist');
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.code).toBe('QUESTION_BANK_EMPTY');
  });
});

describe('启用列表与内置恢复', () => {
  it('启用列表为空时回退到全部题库，避免无题可用', async () => {
    await setActiveBankIds([]);
    const active = await loadActiveBanks();
    expect(active.length).toBeGreaterThan(0);
  });

  it('启用的题库全部被删除时回退到全部题库', async () => {
    await setActiveBankIds(['not-exist-bank']);
    const active = await loadActiveBanks();
    expect(active.map((bank) => bank.bankId)).toContain('existing-bank');
  });

  it('恢复内置题库会写回全部内置题库并重置启用列表', async () => {
    const result = await restoreBuiltinBanks();

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value).toBeGreaterThanOrEqual(3);

    const records = await listBankRecords();
    const builtinIds = records
      .filter((bank) => bank.source === 'restored')
      .map((bank) => bank.bankId);

    expect(builtinIds).toContain('demo-basic');
    expect(builtinIds).toContain('demo-intermediate');
    expect(builtinIds).toContain('demo-advanced');

    // 恢复后启用列表被重置为全部内置题库；用户导入的其他题库仍保留在本地但不再启用
    const active = await loadActiveBanks();
    expect(active.map((bank) => bank.bankId).sort()).toEqual([
      'demo-advanced',
      'demo-basic',
      'demo-intermediate',
    ]);
    expect(records.map((bank) => bank.bankId)).toContain('existing-bank');
  });
});
