/**
 * 题库文件校验测试
 *
 * I. 覆盖范围
 *
 * 1. `src/data/question-banks/` 下的每个题库文件都必须通过完整校验
 * 2. 每个题库都必须满足所有引用它的考试所要求的题目数量与分类配额
 *
 * II. 存在意义
 *
 * 1. 题库是纯数据文件，TypeScript 无法在编译期保证其正确性
 * 2. 本测试是题库进入构建产物前的最后一道闸门，也是题库作者的校验入口
 *
 * @author zexuan.peng
 * @created 2026-10-14
 */

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { checkBankCapacity, validateExamRules, validateQuestionBank } from '@/schemas';
import type { QuestionBank, ExamRulesConfig } from '@/types';

/**
 * 数据目录
 *
 * 使用 process.cwd() 而非 import.meta.url 解析路径：
 * Vitest 的 jsdom 环境下 import.meta.url 为 http URL，fileURLToPath 会直接抛错。
 */
const DATA_DIR = path.resolve(process.cwd(), 'src/data');
const BANKS_DIR = path.join(DATA_DIR, 'question-banks');

/** 读取并解析 JSON 文件 */
function readJson(filePath: string): unknown {
  return JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
}

/** 列出题库目录下的全部 JSON 文件 */
function listBankFiles(): string[] {
  return readdirSync(BANKS_DIR)
    .filter((name) => name.endsWith('.json'))
    .sort();
}

const bankFiles = listBankFiles();
const banks = new Map<string, QuestionBank>();

describe('内置题库文件', () => {
  it('题库目录中至少存在三个内置题库', () => {
    expect(bankFiles.length).toBeGreaterThanOrEqual(3);
  });

  it.each(bankFiles)('%s 通过题库校验', (fileName) => {
    const raw = readJson(path.join(BANKS_DIR, fileName));
    const outcome = validateQuestionBank(raw);

    // 校验失败时输出完整错误路径，便于题库作者定位问题
    expect(outcome.issues).toEqual([]);
    expect(outcome.ok).toBe(true);

    if (outcome.bank) {
      banks.set(outcome.bank.bankId, outcome.bank);
    }
  });

  it.each(bankFiles)('%s 的题目分值均为正数且题目 ID 唯一', (fileName) => {
    const raw = readJson(path.join(BANKS_DIR, fileName)) as { questions?: { id: string; score: number }[] };
    const questions = raw.questions ?? [];

    const ids = questions.map((question) => question.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const question of questions) {
      expect(question.score).toBeGreaterThan(0);
    }
  });
});

describe('题库容量与考试规则匹配', () => {
  const rulesRaw = readJson(path.join(DATA_DIR, 'exam-rules.json'));
  const rulesOutcome = validateExamRules(rulesRaw);

  it('考试规则配置本身通过校验', () => {
    expect(rulesOutcome.issues).toEqual([]);
    expect(rulesOutcome.ok).toBe(true);
  });

  it('每一场考试引用的题库都存在', () => {
    const config = rulesOutcome.config as ExamRulesConfig;
    const knownBankIds = new Set(banks.keys());

    for (const exam of config.exams) {
      for (const bankId of exam.paper.bankIds) {
        expect(knownBankIds.has(bankId), `考试 ${exam.examId} 引用了不存在的题库 ${bankId}`).toBe(
          true,
        );
      }
    }
  });

  it('每一场考试的题目数量与分类配额都能被题库满足', () => {
    const config = rulesOutcome.config as ExamRulesConfig;

    for (const exam of config.exams) {
      const examBanks = exam.paper.bankIds
        .map((bankId) => banks.get(bankId))
        .filter((bank): bank is QuestionBank => bank !== undefined);

      const capacity = checkBankCapacity(examBanks, {
        questionCount: exam.questionCount,
        quotas: (exam.paper.quotas ?? []).map((quota) => ({
          category: quota.category,
          difficulty: quota.difficulty,
          count: quota.count,
        })),
      });

      expect(capacity.shortages, `考试 ${exam.examId} 的题库容量不足`).toEqual([]);
      expect(capacity.satisfied).toBe(true);
    }
  });
});
