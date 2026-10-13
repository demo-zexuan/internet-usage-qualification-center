/**
 * 评分引擎单元测试
 *
 * 覆盖项目测试要求中的判分相关条目：
 * 1. 单选题判分
 * 2. 多选题严格匹配
 * 3. 多选题部分得分
 * 4. 判断题判分
 * 5. 百分制计算
 * 6. 及格线边界
 * 7. 情景分析题按选项分值判分
 * 8. 倒扣分与未作答处理
 *
 * @author zexuan.peng
 * @created 2026-10-14
 */

import { describe, expect, it } from 'vitest';

import {
  SCORE_SCALE,
  computePaperMaxHundredths,
  fromHundredths,
  gradeAttempt,
  gradeQuestion,
  roundHundredths,
  toHundredths,
} from '@/features/grading/engine';
import { makeAttempt, makePaperQuestion, makePolicy } from '../helpers/fixtures';

const strictContext = { policy: makePolicy(), negativeScoringEnabled: false };

describe('单选题判分', () => {
  const question = makePaperQuestion({ selection: 'single', correctOptionIds: ['B'], score: 5 });

  it('选择唯一正确选项得满分', () => {
    const outcome = gradeQuestion(question, ['B'], strictContext);
    expect(outcome.earnedHundredths).toBe(toHundredths(5));
    expect(outcome.status).toBe('correct');
    expect(outcome.isCorrect).toBe(true);
  });

  it('选择错误选项得零分', () => {
    const outcome = gradeQuestion(question, ['C'], strictContext);
    expect(outcome.earnedHundredths).toBe(0);
    expect(outcome.status).toBe('wrong');
  });

  it('未作答得零分且状态为未作答', () => {
    const outcome = gradeQuestion(question, [], strictContext);
    expect(outcome.earnedHundredths).toBe(0);
    expect(outcome.status).toBe('unanswered');
  });

  it('单选题选择了多个选项时不得分（严格集合比较）', () => {
    const outcome = gradeQuestion(question, ['B', 'C'], strictContext);
    expect(outcome.earnedHundredths).toBe(0);
    expect(outcome.status).toBe('wrong');
  });
});

describe('判断题判分', () => {
  const question = makePaperQuestion({
    type: 'true_false',
    selection: 'single',
    correctOptionIds: ['TRUE'],
    score: 5,
  });

  it('选择 TRUE 且正确答案为 TRUE 时得满分', () => {
    expect(gradeQuestion(question, ['TRUE'], strictContext).earnedHundredths).toBe(toHundredths(5));
  });

  it('选择 FALSE 时得零分', () => {
    const outcome = gradeQuestion(question, ['FALSE'], strictContext);
    expect(outcome.earnedHundredths).toBe(0);
    expect(outcome.status).toBe('wrong');
  });
});

describe('多选题严格匹配', () => {
  const question = makePaperQuestion({
    type: 'multiple_choice',
    selection: 'multiple',
    correctOptionIds: ['A', 'C'],
    score: 5,
  });

  it('选项集合完全一致时得满分（与顺序无关）', () => {
    expect(gradeQuestion(question, ['C', 'A'], strictContext).earnedHundredths).toBe(toHundredths(5));
  });

  it('少选不得满分', () => {
    const outcome = gradeQuestion(question, ['A'], strictContext);
    expect(outcome.earnedHundredths).toBe(0);
    expect(outcome.status).toBe('wrong');
  });

  it('多选不得满分', () => {
    const outcome = gradeQuestion(question, ['A', 'C', 'D'], strictContext);
    expect(outcome.earnedHundredths).toBe(0);
  });

  it('错选不得满分', () => {
    const outcome = gradeQuestion(question, ['A', 'B'], strictContext);
    expect(outcome.earnedHundredths).toBe(0);
  });
});

describe('多选题部分得分', () => {
  const question = makePaperQuestion({
    type: 'multiple_choice',
    selection: 'multiple',
    correctOptionIds: ['A', 'B', 'C'],
    score: 6,
    scoring: {
      mode: 'partial',
      partial: { strategy: 'per_option', penaltyPerWrongOption: 0 },
      negativeScore: 0,
    },
  });

  it('考试规则未开启部分得分时仍按严格匹配处理', () => {
    const outcome = gradeQuestion(question, ['A', 'B'], {
      policy: makePolicy({ partialCreditEnabled: false }),
      negativeScoringEnabled: false,
    });
    expect(outcome.earnedHundredths).toBe(0);
  });

  it('开启部分得分后按选对比例给分（per_option）', () => {
    const outcome = gradeQuestion(question, ['A', 'B'], {
      policy: makePolicy({ partialCreditEnabled: true }),
      negativeScoringEnabled: false,
    });
    // 选对 2/3，满分 6 分 → 4 分
    expect(outcome.earnedHundredths).toBe(toHundredths(4));
    expect(outcome.status).toBe('partial');
  });

  it('未设置错选罚分时，错选不影响已获得的选对分', () => {
    const outcome = gradeQuestion(question, ['A', 'D'], {
      policy: makePolicy({ partialCreditEnabled: true }),
      negativeScoringEnabled: false,
    });
    // 选对 1/3 → 2 分；罚分为 0 → 保留 2 分
    expect(outcome.earnedHundredths).toBe(toHundredths(2));
    expect(outcome.status).toBe('partial');
  });

  it('错选罚分生效且得分不低于 0', () => {
    const penalised = makePaperQuestion({
      type: 'multiple_choice',
      selection: 'multiple',
      correctOptionIds: ['A', 'B', 'C'],
      score: 6,
      scoring: {
        mode: 'partial',
        partial: { strategy: 'per_option', penaltyPerWrongOption: 3 },
        negativeScore: 0,
      },
    });

    const outcome = gradeQuestion(penalised, ['A', 'D'], {
      policy: makePolicy({ partialCreditEnabled: true }),
      negativeScoringEnabled: false,
    });
    // 选对 1/3 → 2 分，再扣 1 个错选 × 3 分 = -1 → 截断为 0
    expect(outcome.earnedHundredths).toBe(0);
    expect(outcome.status).toBe('wrong');
  });

  it('proportional 策略下选错会抵消选对', () => {
    const proportional = makePaperQuestion({
      type: 'multiple_choice',
      selection: 'multiple',
      correctOptionIds: ['A', 'B', 'C', 'D'],
      score: 8,
      scoring: { mode: 'partial', partial: { strategy: 'proportional' }, negativeScore: 0 },
    });

    const outcome = gradeQuestion(proportional, ['A', 'B', 'C', 'E'], {
      policy: makePolicy({ partialCreditEnabled: true }),
      negativeScoringEnabled: false,
    });
    // (3 - 1) / 4 × 8 = 4 分
    expect(outcome.earnedHundredths).toBe(toHundredths(4));
  });
});

describe('情景分析题判分', () => {
  const question = makePaperQuestion({
    type: 'scenario_analysis',
    selection: 'single',
    correctOptionIds: ['B'],
    score: 5,
    scoring: { mode: 'points', negativeScore: 0 },
    optionPoints: { A: 0, B: 5, C: 2, D: -1 },
  });

  it('选择满分选项得满分', () => {
    expect(gradeQuestion(question, ['B'], strictContext).earnedHundredths).toBe(toHundredths(5));
  });

  it('选择部分得分选项按预设分值给分', () => {
    const outcome = gradeQuestion(question, ['C'], strictContext);
    expect(outcome.earnedHundredths).toBe(toHundredths(2));
    expect(outcome.status).toBe('partial');
  });

  it('选择负分选项时得分截断为 0（默认不允许负总分）', () => {
    const outcome = gradeQuestion(question, ['D'], strictContext);
    expect(outcome.earnedHundredths).toBe(0);
    expect(outcome.status).toBe('wrong');
  });

  it('允许负总分时保留负分', () => {
    const outcome = gradeQuestion(question, ['D'], {
      policy: makePolicy({ allowNegativeTotal: true }),
      negativeScoringEnabled: false,
    });
    expect(outcome.earnedHundredths).toBe(toHundredths(-1));
  });
});

describe('倒扣分', () => {
  const question = makePaperQuestion({
    selection: 'single',
    correctOptionIds: ['B'],
    score: 5,
    scoring: { mode: 'strict', negativeScore: 2 },
  });

  it('考试未开启倒扣分时题目级倒扣分不生效', () => {
    const outcome = gradeQuestion(question, ['C'], strictContext);
    expect(outcome.earnedHundredths).toBe(0);
  });

  it('考试开启倒扣分时答错扣分且截断为 0', () => {
    const outcome = gradeQuestion(question, ['C'], {
      policy: makePolicy(),
      negativeScoringEnabled: true,
    });
    expect(outcome.earnedHundredths).toBe(0);
  });

  it('未作答不适用倒扣分', () => {
    const outcome = gradeQuestion(question, [], {
      policy: makePolicy(),
      negativeScoringEnabled: true,
    });
    expect(outcome.earnedHundredths).toBe(0);
    expect(outcome.status).toBe('unanswered');
  });
});

describe('百分制归一化计算', () => {
  it('题目分值合计为 50 分时折算为百分制', () => {
    const questions = [
      makePaperQuestion({ questionId: 'Q1', correctOptionIds: ['A'], score: 10 }),
      makePaperQuestion({ questionId: 'Q2', correctOptionIds: ['B'], score: 10 }),
      makePaperQuestion({ questionId: 'Q3', correctOptionIds: ['C'], score: 10 }),
      makePaperQuestion({ questionId: 'Q4', correctOptionIds: ['D'], score: 10 }),
      makePaperQuestion({ questionId: 'Q5', correctOptionIds: ['A'], score: 10 }),
    ];

    // 全部答对 → 50 / 50 × 100 = 100 分
    const attempt = makeAttempt(questions, {
      Q1: ['A'],
      Q2: ['B'],
      Q3: ['C'],
      Q4: ['D'],
      Q5: ['A'],
    });

    const result = gradeAttempt(attempt);
    expect(result.rawMaxScore).toBe(50);
    expect(result.rawEarnedScore).toBe(50);
    expect(result.score).toBe(100);
    expect(result.maxScore).toBe(100);
    expect(result.normalized).toBe(true);
    expect(result.passed).toBe(true);
  });

  it('关闭归一化时直接使用原始分值口径', () => {
    const questions = [
      makePaperQuestion({ questionId: 'Q1', correctOptionIds: ['A'], score: 10 }),
      makePaperQuestion({ questionId: 'Q2', correctOptionIds: ['B'], score: 10 }),
    ];

    const attempt = makeAttempt(questions, { Q1: ['A'], Q2: ['C'] });
    attempt.paper.ruleSnapshot.scoring = makePolicy({ normalizeToHundred: false });

    const result = gradeAttempt(attempt);
    expect(result.normalized).toBe(false);
    expect(result.score).toBe(10);
    expect(result.maxScore).toBe(20);
  });

  it('试卷原始满分与配置满分不一致时按归一化规则折算', () => {
    // 15 题 × 5 分 = 75 分原始满分，答对 12 题 = 60 分原始得分 → 80 分
    const questions = Array.from({ length: 15 }, (_, index) =>
      makePaperQuestion({ questionId: `Q${index + 1}`, correctOptionIds: ['A'], score: 5 }),
    );

    const answers: Record<string, string[]> = {};
    questions.forEach((question, index) => {
      answers[question.questionId] = index < 12 ? ['A'] : ['B'];
    });

    const result = gradeAttempt(makeAttempt(questions, answers));
    expect(result.rawMaxScore).toBe(75);
    expect(result.rawEarnedScore).toBe(60);
    expect(result.score).toBe(80);
  });
});

describe('及格线边界', () => {
  /** 构造一份 10 题、每题 10 分的试卷，答对 n 题即得 10n 分 */
  function buildTenQuestionAttempt(correctCount: number) {
    const questions = Array.from({ length: 10 }, (_, index) =>
      makePaperQuestion({ questionId: `Q${index + 1}`, correctOptionIds: ['A'], score: 10 }),
    );

    const answers: Record<string, string[]> = {};
    questions.forEach((question, index) => {
      answers[question.questionId] = index < correctCount ? ['A'] : ['B'];
    });

    return makeAttempt(questions, answers);
  }

  it('恰好达到及格线（60 分）判定为通过', () => {
    const result = gradeAttempt(buildTenQuestionAttempt(6));
    expect(result.score).toBe(60);
    expect(result.passed).toBe(true);
  });

  it('低于及格线 0.1 分判定为未通过', () => {
    const attempt = buildTenQuestionAttempt(6);
    attempt.paper.ruleSnapshot.passScore = 60.1;
    attempt.paper.passScore = 60.1;

    const result = gradeAttempt(attempt);
    expect(result.score).toBe(60);
    expect(result.passed).toBe(false);
  });

  it('归一化后出现小数时按配置的舍入方式与及格线比较', () => {
    // 7 题 × 5 分 = 35 分原始满分；答对 5 题 = 25 分 → 71.4285…% → 保留 1 位小数 = 71.4
    const questions = Array.from({ length: 7 }, (_, index) =>
      makePaperQuestion({ questionId: `Q${index + 1}`, correctOptionIds: ['A'], score: 5 }),
    );

    const answers: Record<string, string[]> = {};
    questions.forEach((question, index) => {
      answers[question.questionId] = index < 5 ? ['A'] : ['B'];
    });

    const attempt = makeAttempt(questions, answers);
    attempt.paper.ruleSnapshot.passScore = 71.4;
    attempt.paper.passScore = 71.4;

    const result = gradeAttempt(attempt);
    expect(result.score).toBe(71.4);
    expect(result.passed).toBe(true);
  });

  it('及格线判定使用与展示分数相同的舍入口径', () => {
    // 原始 71.4285…% 保留 1 位小数后为 71.4，及格线 71.45 四舍五入后为 71.5
    const questions = Array.from({ length: 7 }, (_, index) =>
      makePaperQuestion({ questionId: `Q${index + 1}`, correctOptionIds: ['A'], score: 5 }),
    );

    const answers: Record<string, string[]> = {};
    questions.forEach((question, index) => {
      answers[question.questionId] = index < 5 ? ['A'] : ['B'];
    });

    const attempt = makeAttempt(questions, answers);
    attempt.paper.ruleSnapshot.passScore = 71.45;
    attempt.paper.passScore = 71.45;

    const result = gradeAttempt(attempt);
    expect(result.score).toBe(71.4);
    expect(result.passScore).toBe(71.45);
    expect(result.passed).toBe(false);
  });
});

describe('成绩统计与答案可见性', () => {
  const questions = [
    makePaperQuestion({ questionId: 'Q1', type: 'single_choice', correctOptionIds: ['A'], score: 5 }),
    makePaperQuestion({
      questionId: 'Q2',
      type: 'multiple_choice',
      selection: 'multiple',
      correctOptionIds: ['A', 'B'],
      score: 5,
    }),
    makePaperQuestion({ questionId: 'Q3', type: 'single_choice', correctOptionIds: ['C'], score: 5 }),
  ];

  it('正确、错误与未作答数量统计准确', () => {
    const result = gradeAttempt(
      makeAttempt(questions, { Q1: ['A'], Q2: ['C'] }),
    );

    expect(result.totalQuestions).toBe(3);
    expect(result.correctCount).toBe(1);
    expect(result.wrongCount).toBe(1);
    expect(result.unansweredCount).toBe(1);
    expect(result.questionResults[2]?.status).toBe('unanswered');
  });

  it('规则声明不展示答案时结果中标记为不可见', () => {
    const attempt = makeAttempt(questions, { Q1: ['A'] });
    attempt.paper.ruleSnapshot.showAnswers = 'never';

    const result = gradeAttempt(attempt);
    expect(result.answersVisible).toBe(false);
  });

  it('规则声明仅通过后展示答案时，未通过则不展示', () => {
    const attempt = makeAttempt(questions, { Q1: ['A'] });
    attempt.paper.ruleSnapshot.showAnswers = 'after_pass';

    const result = gradeAttempt(attempt);
    expect(result.passed).toBe(false);
    expect(result.answersVisible).toBe(false);
  });

  it('模拟考试通过后不授予等级', () => {
    const questions5 = Array.from({ length: 5 }, (_, index) =>
      makePaperQuestion({ questionId: `Q${index + 1}`, correctOptionIds: ['A'], score: 5 }),
    );

    const attempt = makeAttempt(questions5, {
      Q1: ['A'],
      Q2: ['A'],
      Q3: ['A'],
      Q4: ['A'],
      Q5: ['A'],
    });
    attempt.mode = 'mock';

    const result = gradeAttempt(attempt);
    expect(result.passed).toBe(true);
    expect(result.levelAwarded).toBeNull();
  });

  it('正式考试通过后授予规则声明的等级', () => {
    const questions5 = Array.from({ length: 5 }, (_, index) =>
      makePaperQuestion({ questionId: `Q${index + 1}`, correctOptionIds: ['A'], score: 5 }),
    );

    const attempt = makeAttempt(questions5, {
      Q1: ['A'],
      Q2: ['A'],
      Q3: ['A'],
      Q4: ['A'],
      Q5: ['A'],
    });

    const result = gradeAttempt(attempt);
    expect(result.levelAwarded).toBe('L1');
  });

  it('判分是纯函数：同一份记录重复判分结果完全一致', () => {
    const attempt = makeAttempt(questions, { Q1: ['A'], Q2: ['A', 'B'], Q3: ['C'] });
    const first = gradeAttempt(attempt);
    const second = gradeAttempt(attempt);

    expect(second.score).toBe(first.score);
    expect(second.correctCount).toBe(first.correctCount);
    expect(second.questionResults.map((item) => item.earnedScore)).toEqual(
      first.questionResults.map((item) => item.earnedScore),
    );
  });
});

describe('分数工具函数', () => {
  it('百分之一分整数与展示分值可以无损往返', () => {
    expect(toHundredths(72.35)).toBe(7235);
    expect(fromHundredths(7235)).toBe(72.35);
  });

  it('roundHundredths 按配置的小数位与舍入方式处理', () => {
    // 7142 表示 71.42%
    expect(roundHundredths(7142, 'half_up', 1)).toBe(7140);
    expect(roundHundredths(7150, 'half_up', 1)).toBe(7150);
    expect(roundHundredths(7149, 'floor', 1)).toBe(7140);
    expect(roundHundredths(7141, 'ceil', 1)).toBe(7150);
    expect(roundHundredths(7142, 'truncate', 1)).toBe(7140);
    expect(roundHundredths(7142, 'half_up', 2)).toBe(7142);
    expect(roundHundredths(7150, 'half_up', 0)).toBe(7200);
  });

  it('computePaperMaxHundredths 使用整数运算累加题目分值', () => {
    const questions = [
      makePaperQuestion({ score: 0.1 }),
      makePaperQuestion({ score: 0.2 }),
      makePaperQuestion({ score: 0.3 }),
    ];

    // 0.1 + 0.2 + 0.3 在浮点下为 0.6000000000000001，整数口径下必须精确等于 60
    expect(computePaperMaxHundredths(questions)).toBe(60);
    expect(computePaperMaxHundredths(questions) / SCORE_SCALE).toBe(0.6);
  });
});
