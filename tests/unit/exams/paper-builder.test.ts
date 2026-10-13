/**
 * 试卷生成引擎单元测试
 *
 * 覆盖：
 * 1. 配额抽题
 * 2. 固定题目列表抽题
 * 3. 随机抽题与难度分布
 * 4. 题库不足时拒绝生成并给出缺口
 * 5. 固定种子可复现
 * 6. 选项随机化与判断题选项固定
 * 7. 部分得分与倒扣分规则解析
 *
 * @author zexuan.peng
 * @created 2026-10-14
 */

import { describe, expect, it } from 'vitest';

import { buildExamPaper } from '@/features/exams/paper-builder';
import type { ExamRule, ExamRulesConfig } from '@/types/exam';
import type { QuestionBankRecord, RawQuestion } from '@/types/question';
import { makePolicy } from '../helpers/fixtures';

/** 构造题库记录 */
function makeBankRecord(questions: RawQuestion[], bankId = 'test-bank'): QuestionBankRecord {
  return {
    schemaVersion: '1.0.0',
    bankId,
    title: `测试题库 ${bankId}`,
    description: '单元测试题库',
    language: 'zh-CN',
    version: '1.0.0',
    questions,
    source: 'builtin',
    importedAt: Date.now(),
    rawJson: '{}',
    stats: {
      totalQuestions: questions.length,
      byType: {},
      byCategory: {},
      byDifficulty: {},
      totalScore: questions.reduce((sum, question) => sum + question.score, 0),
    },
  };
}

/** 构造一道单选题 */
function makeQuestion(
  id: string,
  category: RawQuestion['category'],
  difficulty: RawQuestion['difficulty'] = 1,
): RawQuestion {
  return {
    id,
    type: 'single_choice',
    category,
    difficulty,
    tags: ['test'],
    stem: `${id} 的题干`,
    options: [
      { id: 'A', text: '选项 A' },
      { id: 'B', text: '选项 B' },
      { id: 'C', text: '选项 C' },
      { id: 'D', text: '选项 D' },
    ],
    answer: { mode: 'key', correctOptionIds: ['B'] },
    explanation: `${id} 的解析`,
    score: 5,
  };
}

/** 构造一场考试规则 */
function makeRule(overrides: Partial<ExamRule> = {}): ExamRule {
  return {
    examId: 'EXAM-TEST',
    title: '测试考试',
    levelId: 'L1',
    category: 'novice',
    summary: '测试用考试',
    description: '测试用考试说明',
    instructions: ['测试须知'],
    durationMinutes: 10,
    questionCount: 4,
    totalScore: 100,
    passScore: 60,
    allowRetake: true,
    retakeCooldownMinutes: 0,
    maxAttempts: null,
    allowMock: true,
    negativeScoring: false,
    showAnswers: 'always',
    eligibility: { requirePrerequisite: false, prerequisiteLevelIds: [] },
    paper: {
      mode: 'quota',
      bankIds: ['test-bank'],
      quotas: [
        { category: 'information_literacy', difficulty: null, count: 2 },
        { category: 'cyber_security', difficulty: null, count: 2 },
      ],
      shuffleQuestions: true,
      shuffleOptions: true,
      seed: null,
    },
    grantsLevelId: 'L1',
    ...overrides,
  };
}

/** 构造规则集合 */
function makeRulesConfig(scoring = makePolicy()): ExamRulesConfig {
  return {
    schemaVersion: '1.0.0',
    rulesId: 'rules-test',
    version: '1.0.0',
    title: '测试规则',
    description: '',
    scoring,
    exams: [],
  };
}

/** 构造满足配额要求的题库 */
function makeSufficientBank(): QuestionBankRecord {
  return makeBankRecord([
    makeQuestion('IL-1', 'information_literacy'),
    makeQuestion('IL-2', 'information_literacy'),
    makeQuestion('IL-3', 'information_literacy'),
    makeQuestion('CS-1', 'cyber_security'),
    makeQuestion('CS-2', 'cyber_security'),
    makeQuestion('CS-3', 'cyber_security'),
  ]);
}

describe('配额抽题', () => {
  it('按分类配额抽取正确数量的题目', () => {
    const result = buildExamPaper({
      rule: makeRule(),
      rulesConfig: makeRulesConfig(),
      banks: [makeSufficientBank()],
      mode: 'official',
      seed: 'SEED-A',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.questions).toHaveLength(4);
    const categories = result.value.questions.map((question) => question.category);
    expect(categories.filter((category) => category === 'information_literacy')).toHaveLength(2);
    expect(categories.filter((category) => category === 'cyber_security')).toHaveLength(2);
  });

  it('同一道题不会被两条配额重复选中', () => {
    const bank = makeBankRecord([
      makeQuestion('A-1', 'information_literacy'),
      makeQuestion('A-2', 'information_literacy'),
    ]);

    const result = buildExamPaper({
      rule: makeRule({
        questionCount: 2,
        paper: {
          mode: 'quota',
          bankIds: ['test-bank'],
          quotas: [
            { category: 'information_literacy', difficulty: null, count: 1 },
            { category: 'information_literacy', difficulty: null, count: 1 },
          ],
          shuffleQuestions: false,
          shuffleOptions: false,
          seed: null,
        },
      }),
      rulesConfig: makeRulesConfig(),
      banks: [bank],
      mode: 'official',
      seed: 'SEED-B',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const ids = result.value.questions.map((question) => question.questionId);
    expect(new Set(ids).size).toBe(2);
  });

  it('题库不足以满足配额时拒绝生成并逐条列出缺口', () => {
    const result = buildExamPaper({
      rule: makeRule(),
      rulesConfig: makeRulesConfig(),
      banks: [makeBankRecord([makeQuestion('IL-1', 'information_literacy')])],
      mode: 'official',
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe('QUESTION_BANK_INSUFFICIENT');
    expect(result.error.details?.some((detail) => detail.includes('cyber_security'))).toBe(true);
    expect(result.error.details?.some((detail) => detail.includes('information_literacy'))).toBe(true);
  });

  it('引用的题库不存在时拒绝生成', () => {
    const result = buildExamPaper({
      rule: makeRule({ paper: { ...makeRule().paper, bankIds: ['missing-bank'] } }),
      rulesConfig: makeRulesConfig(),
      banks: [makeSufficientBank()],
      mode: 'official',
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe('QUESTION_BANK_EMPTY');
    expect(result.error.details).toContain('缺少题库：missing-bank');
  });
});

describe('固定题目列表与随机抽题', () => {
  it('固定题目列表模式按指定 ID 取题', () => {
    const result = buildExamPaper({
      rule: makeRule({
        questionCount: 2,
        paper: {
          mode: 'fixed',
          bankIds: ['test-bank'],
          questionIds: ['IL-2', 'CS-1'],
          shuffleQuestions: false,
          shuffleOptions: false,
          seed: null,
        },
      }),
      rulesConfig: makeRulesConfig(),
      banks: [makeSufficientBank()],
      mode: 'official',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.questions.map((question) => question.questionId).sort()).toEqual([
      'CS-1',
      'IL-2',
    ]);
  });

  it('固定题目列表引用了不存在的题目时拒绝生成', () => {
    const result = buildExamPaper({
      rule: makeRule({
        questionCount: 2,
        paper: {
          mode: 'fixed',
          bankIds: ['test-bank'],
          questionIds: ['IL-2', 'NOT-EXIST'],
          shuffleQuestions: false,
          shuffleOptions: false,
          seed: null,
        },
      }),
      rulesConfig: makeRulesConfig(),
      banks: [makeSufficientBank()],
      mode: 'official',
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.details?.some((detail) => detail.includes('NOT-EXIST'))).toBe(true);
  });

  it('随机抽题按难度分布抽取', () => {
    const bank = makeBankRecord([
      makeQuestion('D1-1', 'information_literacy', 1),
      makeQuestion('D1-2', 'information_literacy', 1),
      makeQuestion('D3-1', 'cyber_security', 3),
      makeQuestion('D3-2', 'cyber_security', 3),
    ]);

    const result = buildExamPaper({
      rule: makeRule({
        questionCount: 3,
        paper: {
          mode: 'random',
          bankIds: ['test-bank'],
          difficultyDistribution: { 1: 1, 3: 2 },
          shuffleQuestions: false,
          shuffleOptions: false,
          seed: null,
        },
      }),
      rulesConfig: makeRulesConfig(),
      banks: [bank],
      mode: 'official',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const difficulties = result.value.questions.map((question) => question.difficulty);
    expect(difficulties.filter((value) => value === 1)).toHaveLength(1);
    expect(difficulties.filter((value) => value === 3)).toHaveLength(2);
  });
});

describe('随机种子可复现', () => {
  it('相同种子生成相同的题目顺序', () => {
    const bank = makeSufficientBank();
    const rule = makeRule();

    const first = buildExamPaper({
      rule,
      rulesConfig: makeRulesConfig(),
      banks: [bank],
      mode: 'official',
      seed: 'REPRODUCIBLE-SEED',
    });
    const second = buildExamPaper({
      rule,
      rulesConfig: makeRulesConfig(),
      banks: [bank],
      mode: 'official',
      seed: 'REPRODUCIBLE-SEED',
    });

    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) {
      return;
    }

    expect(first.value.questions.map((question) => question.questionId)).toEqual(
      second.value.questions.map((question) => question.questionId),
    );
    expect(first.value.questions.map((question) => question.options.map((option) => option.id))).toEqual(
      second.value.questions.map((question) => question.options.map((option) => option.id)),
    );
  });

  it('不同种子生成不同的题目顺序或选项顺序', () => {
    const bank = makeSufficientBank();
    const rule = makeRule();

    const first = buildExamPaper({
      rule,
      rulesConfig: makeRulesConfig(),
      banks: [bank],
      mode: 'official',
      seed: 'SEED-ONE',
    });
    const second = buildExamPaper({
      rule,
      rulesConfig: makeRulesConfig(),
      banks: [bank],
      mode: 'official',
      seed: 'SEED-TWO',
    });

    if (!first.ok || !second.ok) {
      throw new Error('试卷生成失败');
    }

    const firstSignature = JSON.stringify(
      first.value.questions.map((question) => [
        question.questionId,
        question.options.map((option) => option.id),
      ]),
    );
    const secondSignature = JSON.stringify(
      second.value.questions.map((question) => [
        question.questionId,
        question.options.map((option) => option.id),
      ]),
    );

    expect(firstSignature).not.toBe(secondSignature);
  });
});

describe('选项归一化', () => {
  it('判断题补齐默认的「正确 / 错误」选项且不随机化顺序', () => {
    const bank = makeBankRecord([
      {
        id: 'TF-1',
        type: 'true_false',
        category: 'platform_rules',
        difficulty: 1,
        tags: ['test'],
        stem: '测试判断题',
        answer: { mode: 'boolean', correctBoolean: true },
        explanation: '解析',
        score: 5,
      },
    ]);

    const result = buildExamPaper({
      rule: makeRule({
        questionCount: 1,
        paper: {
          mode: 'fixed',
          bankIds: ['test-bank'],
          questionIds: ['TF-1'],
          shuffleQuestions: false,
          shuffleOptions: true,
          seed: null,
        },
      }),
      rulesConfig: makeRulesConfig(),
      banks: [bank],
      mode: 'official',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const question = result.value.questions[0];
    expect(question?.options.map((option) => option.id)).toEqual(['TRUE', 'FALSE']);
    expect(question?.correctOptionIds).toEqual(['TRUE']);
    expect(question?.selection).toBe('single');
  });

  it('试卷快照保留选项原始顺序，便于复核', () => {
    const result = buildExamPaper({
      rule: makeRule(),
      rulesConfig: makeRulesConfig(),
      banks: [makeSufficientBank()],
      mode: 'official',
      seed: 'SEED-C',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    for (const question of result.value.questions) {
      expect(question.sourceOptionIds).toEqual(['A', 'B', 'C', 'D']);
      // 随机化后按显示顺序重新编号，因此展示编号始终是 A-D 的有序序列
      expect(question.options.map((option) => option.id)).toEqual(['A', 'B', 'C', 'D']);
    }
  });

  it('选项随机化后按显示顺序重新编号，且正确答案随之重映射', () => {
    const bank = makeBankRecord([
      {
        ...makeQuestion('REL-1', 'information_literacy'),
        answer: { mode: 'key', correctOptionIds: ['C'] },
      },
    ]);

    const result = buildExamPaper({
      rule: makeRule({
        questionCount: 1,
        paper: {
          mode: 'fixed',
          bankIds: ['test-bank'],
          questionIds: ['REL-1'],
          shuffleQuestions: false,
          shuffleOptions: true,
          seed: null,
        },
      }),
      rulesConfig: makeRulesConfig(),
      banks: [bank],
      mode: 'official',
      seed: 'RELABEL-SEED',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const question = result.value.questions[0];
    if (!question) {
      throw new Error('试卷为空');
    }

    // 展示编号始终有序
    expect(question.options.map((option) => option.id)).toEqual(['A', 'B', 'C', 'D']);

    // 正确答案被重映射到新的展示编号，且指向的选项文本仍是原来的 C 选项
    const correctId = question.correctOptionIds[0];
    expect(correctId).toBeDefined();
    const correctOption = question.options.find((option) => option.id === correctId);
    expect(correctOption?.text).toBe('选项 C');
    expect(correctOption?.sourceId).toBe('C');
  });

  it('情景分析题的分值表随选项重编号一并重映射', () => {
    const bank = makeBankRecord([
      {
        ...makeQuestion('REL-2', 'public_discourse'),
        type: 'scenario_analysis',
        selection: 'single',
        materialTitle: '情景',
        material: '情景描述。',
        options: [
          { id: 'A', text: '做法 A' },
          { id: 'B', text: '做法 B' },
          { id: 'C', text: '做法 C' },
          { id: 'D', text: '做法 D' },
        ],
        answer: { mode: 'points', bestOptionIds: ['B'], optionPoints: { A: 0, B: 5, C: 2, D: -1 } },
      },
    ]);

    const result = buildExamPaper({
      rule: makeRule({
        questionCount: 1,
        paper: {
          mode: 'fixed',
          bankIds: ['test-bank'],
          questionIds: ['REL-2'],
          shuffleQuestions: false,
          shuffleOptions: true,
          seed: null,
        },
      }),
      rulesConfig: makeRulesConfig(),
      banks: [bank],
      mode: 'official',
      seed: 'RELABEL-POINTS-SEED',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const question = result.value.questions[0];
    if (!question?.optionPoints) {
      throw new Error('分值表缺失');
    }

    // 分值表键集合必须与展示编号一致
    expect(Object.keys(question.optionPoints).sort()).toEqual(['A', 'B', 'C', 'D']);

    // 每个展示编号的分值必须等于其来源选项的分值
    for (const option of question.options) {
      const expected = { A: 0, B: 5, C: 2, D: -1 }[option.sourceId as 'A'];
      expect(question.optionPoints[option.id]).toBe(expected);
    }
  });

  it('试卷快照记录题库来源与规则版本', () => {
    const result = buildExamPaper({
      rule: makeRule(),
      rulesConfig: makeRulesConfig(),
      banks: [makeSufficientBank()],
      mode: 'official',
      seed: 'SEED-D',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.bankRefs).toEqual([
      { bankId: 'test-bank', version: '1.0.0', source: 'builtin', title: '测试题库 test-bank' },
    ]);
    expect(result.value.ruleSnapshot.rulesVersion).toBe('1.0.0');
    expect(result.value.seed).toBe('SEED-D');
  });
});

describe('评分配置解析', () => {
  it('考试未开启部分得分时题目声明被降级为严格匹配', () => {
    const bank = makeBankRecord([
      {
        ...makeQuestion('MC-1', 'information_literacy'),
        type: 'multiple_choice',
        selection: 'multiple',
        answer: { mode: 'key', correctOptionIds: ['A', 'B'] },
        scoring: { mode: 'partial', partial: { strategy: 'per_option' } },
      },
    ]);

    const result = buildExamPaper({
      rule: makeRule({
        questionCount: 1,
        paper: {
          mode: 'fixed',
          bankIds: ['test-bank'],
          questionIds: ['MC-1'],
          shuffleQuestions: false,
          shuffleOptions: false,
          seed: null,
        },
      }),
      rulesConfig: makeRulesConfig(makePolicy({ partialCreditEnabled: false })),
      banks: [bank],
      mode: 'official',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.questions[0]?.scoring.mode).toBe('strict');
  });

  it('考试开启部分得分后题目声明生效', () => {
    const bank = makeBankRecord([
      {
        ...makeQuestion('MC-2', 'information_literacy'),
        type: 'multiple_choice',
        selection: 'multiple',
        answer: { mode: 'key', correctOptionIds: ['A', 'B'] },
        scoring: { mode: 'partial', partial: { strategy: 'proportional' } },
      },
    ]);

    const result = buildExamPaper({
      rule: makeRule({
        questionCount: 1,
        paper: {
          mode: 'fixed',
          bankIds: ['test-bank'],
          questionIds: ['MC-2'],
          shuffleQuestions: false,
          shuffleOptions: false,
          seed: null,
        },
      }),
      rulesConfig: makeRulesConfig(makePolicy({ partialCreditEnabled: true })),
      banks: [bank],
      mode: 'official',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.questions[0]?.scoring.mode).toBe('partial');
    expect(result.value.questions[0]?.scoring.partial?.strategy).toBe('proportional');
  });

  it('考试开启倒扣分时题目级倒扣分生效，未声明时使用全卷默认值', () => {
    const bank = makeBankRecord([
      { ...makeQuestion('N-1', 'information_literacy'), scoring: { mode: 'strict', negativeScore: 3 } },
      makeQuestion('N-2', 'information_literacy'),
    ]);

    const result = buildExamPaper({
      rule: makeRule({
        questionCount: 2,
        negativeScoring: true,
        paper: {
          mode: 'fixed',
          bankIds: ['test-bank'],
          questionIds: ['N-1', 'N-2'],
          shuffleQuestions: false,
          shuffleOptions: false,
          seed: null,
        },
      }),
      rulesConfig: makeRulesConfig(makePolicy({ defaultNegativeScore: 1 })),
      banks: [bank],
      mode: 'official',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const byId = new Map(result.value.questions.map((question) => [question.questionId, question]));
    expect(byId.get('N-1')?.scoring.negativeScore).toBe(3);
    expect(byId.get('N-2')?.scoring.negativeScore).toBe(1);
  });

  it('考试未开启倒扣分时题目级倒扣分一律为 0', () => {
    const bank = makeBankRecord([
      { ...makeQuestion('N-3', 'information_literacy'), scoring: { mode: 'strict', negativeScore: 3 } },
    ]);

    const result = buildExamPaper({
      rule: makeRule({
        questionCount: 1,
        negativeScoring: false,
        paper: {
          mode: 'fixed',
          bankIds: ['test-bank'],
          questionIds: ['N-3'],
          shuffleQuestions: false,
          shuffleOptions: false,
          seed: null,
        },
      }),
      rulesConfig: makeRulesConfig(makePolicy({ defaultNegativeScore: 5 })),
      banks: [bank],
      mode: 'official',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.questions[0]?.scoring.negativeScore).toBe(0);
  });
});
