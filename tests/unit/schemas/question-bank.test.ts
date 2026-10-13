/**
 * 题库校验单元测试
 *
 * 覆盖项目测试要求中的校验相关条目：
 * 1. 题库 JSON 校验（结构、枚举、必填字段）
 * 2. 非法选项引用
 * 3. 题目 ID 重复
 * 4. 单选题多个正确答案
 * 5. 多选题无正确答案
 * 6. 分值非法
 * 7. 结构版本不兼容
 * 8. 情景分析题分值表不完整
 *
 * @author zexuan.peng
 * @created 2026-10-14
 */

import { describe, expect, it } from 'vitest';

import { checkBankCapacity, computeQuestionBankStats, validateQuestionBank } from '@/schemas';
import type { QuestionBank } from '@/types';

/** 构造一份最小可用的题库 JSON */
function makeBank(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: '1.0.0',
    bankId: 'test-bank',
    title: '测试题库',
    description: '用于单元测试',
    language: 'zh-CN',
    version: '1.0.0',
    questions: [
      {
        id: 'T-001',
        type: 'single_choice',
        category: 'information_literacy',
        difficulty: 1,
        tags: ['test'],
        stem: '测试题干',
        options: [
          { id: 'A', text: '选项 A' },
          { id: 'B', text: '选项 B' },
        ],
        answer: { mode: 'key', correctOptionIds: ['B'] },
        explanation: '测试解析',
        score: 5,
      },
    ],
    ...overrides,
  };
}

describe('题库结构校验', () => {
  it('合法题库通过校验', () => {
    const outcome = validateQuestionBank(makeBank());
    expect(outcome.ok).toBe(true);
    expect(outcome.issues).toEqual([]);
    expect(outcome.bank?.bankId).toBe('test-bank');
  });

  it('结构版本不受支持时拒绝导入并说明支持范围', () => {
    const outcome = validateQuestionBank(makeBank({ schemaVersion: '9.9.9' }));
    expect(outcome.ok).toBe(false);
    expect(outcome.issues.some((issue) => issue.path === 'schemaVersion')).toBe(true);
    expect(outcome.issues.some((issue) => issue.message.includes('1.0.0'))).toBe(true);
  });

  it('缺少必填字段时给出字段路径', () => {
    const bank = makeBank();
    const questions = bank.questions as Record<string, unknown>[];
    delete questions[0]?.stem;

    const outcome = validateQuestionBank(bank);
    expect(outcome.ok).toBe(false);
    expect(outcome.issues.some((issue) => issue.path === 'questions[0].stem')).toBe(true);
  });

  it('题目 ID 重复时定位到重复条目', () => {
    const bank = makeBank({
      questions: [
        {
          id: 'T-001',
          type: 'single_choice',
          category: 'information_literacy',
          difficulty: 1,
          tags: ['test'],
          stem: '题干一',
          options: [
            { id: 'A', text: 'A' },
            { id: 'B', text: 'B' },
          ],
          answer: { mode: 'key', correctOptionIds: ['A'] },
          explanation: '解析一',
          score: 5,
        },
        {
          id: 'T-001',
          type: 'single_choice',
          category: 'information_literacy',
          difficulty: 1,
          tags: ['test'],
          stem: '题干二',
          options: [
            { id: 'A', text: 'A' },
            { id: 'B', text: 'B' },
          ],
          answer: { mode: 'key', correctOptionIds: ['A'] },
          explanation: '解析二',
          score: 5,
        },
      ],
    });

    const outcome = validateQuestionBank(bank);
    expect(outcome.ok).toBe(false);
    expect(outcome.issues.some((issue) => issue.message.includes('题目 ID 重复'))).toBe(true);
  });

  it('题目分值必须为正数', () => {
    const bank = makeBank();
    const questions = bank.questions as Record<string, unknown>[];
    if (questions[0]) {
      questions[0].score = 0;
    }

    const outcome = validateQuestionBank(bank);
    expect(outcome.ok).toBe(false);
    expect(outcome.issues.some((issue) => issue.path === 'questions[0].score')).toBe(true);
  });

  it('题目数量为空时拒绝导入', () => {
    const outcome = validateQuestionBank(makeBank({ questions: [] }));
    expect(outcome.ok).toBe(false);
    expect(outcome.issues.some((issue) => issue.path === 'questions')).toBe(true);
  });
});

describe('选项与答案关系校验', () => {
  it('正确答案引用不存在的选项时给出精确路径', () => {
    const bank = makeBank();
    const questions = bank.questions as Record<string, unknown>[];
    if (questions[0]) {
      questions[0].answer = { mode: 'key', correctOptionIds: ['Z'] };
    }

    const outcome = validateQuestionBank(bank);
    expect(outcome.ok).toBe(false);
    expect(
      outcome.issues.some((issue) => issue.path === 'questions[0].answer.correctOptionIds[0]'),
    ).toBe(true);
    expect(outcome.issues.some((issue) => issue.message.includes('Z'))).toBe(true);
  });

  it('选项 ID 重复时拒绝导入', () => {
    const bank = makeBank();
    const questions = bank.questions as Record<string, unknown>[];
    if (questions[0]) {
      questions[0].options = [
        { id: 'A', text: '选项一' },
        { id: 'A', text: '选项二' },
      ];
    }

    const outcome = validateQuestionBank(bank);
    expect(outcome.ok).toBe(false);
    expect(outcome.issues.some((issue) => issue.message.includes('选项 ID 重复'))).toBe(true);
  });

  it('单选题存在多个正确答案时拒绝导入', () => {
    const bank = makeBank();
    const questions = bank.questions as Record<string, unknown>[];
    if (questions[0]) {
      questions[0].answer = { mode: 'key', correctOptionIds: ['A', 'B'] };
    }

    const outcome = validateQuestionBank(bank);
    expect(outcome.ok).toBe(false);
    expect(outcome.issues.some((issue) => issue.message.includes('单选题必须且只能有一个正确答案'))).toBe(
      true,
    );
  });

  it('多选题没有正确答案时拒绝导入', () => {
    const bank = makeBank();
    const questions = bank.questions as Record<string, unknown>[];
    if (questions[0]) {
      questions[0].type = 'multiple_choice';
      questions[0].selection = 'multiple';
      questions[0].answer = { mode: 'key', correctOptionIds: [] };
    }

    const outcome = validateQuestionBank(bank);
    expect(outcome.ok).toBe(false);
    expect(outcome.issues.some((issue) => issue.message.includes('至少需要一个正确答案'))).toBe(true);
  });

  it('布尔型答案用于非判断题时拒绝导入', () => {
    const bank = makeBank();
    const questions = bank.questions as Record<string, unknown>[];
    if (questions[0]) {
      questions[0].answer = { mode: 'boolean', correctBoolean: true };
    }

    const outcome = validateQuestionBank(bank);
    expect(outcome.ok).toBe(false);
    expect(outcome.issues.some((issue) => issue.path === 'questions[0].answer.mode')).toBe(true);
  });

  it('判断题不提供选项时自动补齐并通过校验', () => {
    const bank = makeBank({
      questions: [
        {
          id: 'T-002',
          type: 'true_false',
          category: 'platform_rules',
          difficulty: 1,
          tags: ['test'],
          stem: '本平台不收集身份证号码。',
          answer: { mode: 'boolean', correctBoolean: true },
          explanation: '本平台只收集昵称与可选头像。',
          score: 5,
        },
      ],
    });

    const outcome = validateQuestionBank(bank);
    expect(outcome.ok).toBe(true);
    expect(outcome.issues).toEqual([]);
  });

  it('情景分析题分值表未覆盖全部选项时拒绝导入', () => {
    const bank = makeBank({
      questions: [
        {
          id: 'T-003',
          type: 'scenario_analysis',
          category: 'public_discourse',
          difficulty: 3,
          tags: ['test'],
          stem: '应如何处理？',
          materialTitle: '情景',
          material: '情景描述内容。',
          options: [
            { id: 'A', text: '做法 A' },
            { id: 'B', text: '做法 B' },
            { id: 'C', text: '做法 C' },
          ],
          answer: { mode: 'points', bestOptionIds: ['B'], optionPoints: { A: 0, B: 5 } },
          explanation: '解析内容。',
          score: 5,
        },
      ],
    });

    const outcome = validateQuestionBank(bank);
    expect(outcome.ok).toBe(false);
    expect(outcome.issues.some((issue) => issue.path === 'questions[0].answer.optionPoints.C')).toBe(
      true,
    );
  });

  it('材料题缺少 material 时拒绝导入', () => {
    const bank = makeBank({
      questions: [
        {
          id: 'T-004',
          type: 'reading_comprehension',
          category: 'information_literacy',
          difficulty: 3,
          tags: ['test'],
          stem: '根据材料回答。',
          options: [
            { id: 'A', text: 'A' },
            { id: 'B', text: 'B' },
          ],
          answer: { mode: 'key', correctOptionIds: ['A'] },
          explanation: '解析。',
          score: 5,
        },
      ],
    });

    const outcome = validateQuestionBank(bank);
    expect(outcome.ok).toBe(false);
    expect(outcome.issues.some((issue) => issue.path === 'questions[0].material')).toBe(true);
  });

  it('声明部分得分但缺少 partial 规则时拒绝导入', () => {
    const bank = makeBank();
    const questions = bank.questions as Record<string, unknown>[];
    if (questions[0]) {
      questions[0].scoring = { mode: 'partial' };
    }

    const outcome = validateQuestionBank(bank);
    expect(outcome.ok).toBe(false);
    expect(outcome.issues.some((issue) => issue.path === 'questions[0].scoring.partial')).toBe(true);
  });
});

describe('题库统计与容量检查', () => {
  const bank = validateQuestionBank(makeBank()).bank as QuestionBank;

  it('统计信息按题型、分类与难度正确计数', () => {
    const stats = computeQuestionBankStats(bank);
    expect(stats.totalQuestions).toBe(1);
    expect(stats.byType.single_choice).toBe(1);
    expect(stats.byCategory.information_literacy).toBe(1);
    expect(stats.byDifficulty['1']).toBe(1);
    expect(stats.totalScore).toBe(5);
  });

  it('题量不足时给出缺口说明', () => {
    const capacity = checkBankCapacity([bank], { questionCount: 10 });
    expect(capacity.satisfied).toBe(false);
    expect(capacity.shortages[0]).toContain('少于本场考试要求的 10 道');
  });

  it('分类配额不足时逐条列出缺口', () => {
    const capacity = checkBankCapacity([bank], {
      questionCount: 1,
      quotas: [{ category: 'cyber_security', difficulty: null, count: 3 }],
    });

    expect(capacity.satisfied).toBe(false);
    expect(capacity.shortages.some((item) => item.includes('cyber_security'))).toBe(true);
  });

  it('容量充足时判定为满足', () => {
    const capacity = checkBankCapacity([bank], {
      questionCount: 1,
      quotas: [{ category: 'information_literacy', difficulty: 1, count: 1 }],
    });

    expect(capacity.satisfied).toBe(true);
    expect(capacity.shortages).toEqual([]);
  });
});
