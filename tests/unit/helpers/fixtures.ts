/**
 * 测试数据构造器
 *
 * 提供试卷、考试记录与评分策略的最小可用构造器，
 * 使各测试用例只声明与断言相关的字段，避免大量重复样板。
 *
 * @author zexuan.peng
 * @created 2026-10-14
 */

import type {
  ExamAttempt,
  ExamPaper,
  ExamRuleSnapshot,
  PaperQuestion,
  ScoringPolicy,
} from '@/types/exam';

/** 默认评分策略：百分制归一化、四舍五入保留 1 位小数、不倒扣 */
export function makePolicy(overrides: Partial<ScoringPolicy> = {}): ScoringPolicy {
  return {
    normalizeToHundred: true,
    rounding: 'half_up',
    decimalPlaces: 1,
    allowNegativeTotal: false,
    defaultNegativeScore: 0,
    partialCreditEnabled: false,
    ...overrides,
  };
}

/** 构造一道试卷题目 */
export function makePaperQuestion(overrides: Partial<PaperQuestion> = {}): PaperQuestion {
  return {
    questionId: 'Q-001',
    type: 'single_choice',
    category: 'information_literacy',
    difficulty: 1,
    tags: ['test'],
    stem: '测试题干',
    options: [
      { id: 'A', text: '选项 A' },
      { id: 'B', text: '选项 B' },
      { id: 'C', text: '选项 C' },
      { id: 'D', text: '选项 D' },
    ],
    selection: 'single',
    correctOptionIds: ['B'],
    scoring: { mode: 'strict', negativeScore: 0 },
    score: 5,
    explanation: '测试解析',
    knowledgePoints: ['测试知识点'],
    bankId: 'test-bank',
    bankVersion: '1.0.0',
    sourceOptionIds: ['A', 'B', 'C', 'D'],
    ...overrides,
  };
}

/** 构造规则快照 */
export function makeRuleSnapshot(overrides: Partial<ExamRuleSnapshot> = {}): ExamRuleSnapshot {
  return {
    rulesId: 'rules-test',
    rulesVersion: '1.0.0',
    schemaVersion: '1.0.0',
    examId: 'EXAM-TEST',
    examTitle: '测试考试',
    levelId: 'L1',
    category: 'novice',
    durationMinutes: 10,
    questionCount: 1,
    totalScore: 100,
    passScore: 60,
    showAnswers: 'always',
    negativeScoring: false,
    scoring: makePolicy(),
    grantsLevelId: 'L1',
    grantsCertifications: [],
    ...overrides,
  };
}

/** 构造试卷 */
export function makePaper(questions: PaperQuestion[], overrides: Partial<ExamPaper> = {}): ExamPaper {
  const rawMaxScore = questions.reduce((sum, question) => sum + question.score, 0);

  return {
    paperId: 'paper-test',
    examId: 'EXAM-TEST',
    examTitle: '测试考试',
    levelId: 'L1',
    mode: 'official',
    generatedAt: Date.now(),
    seed: 'TEST-SEED',
    questionCount: questions.length,
    rawMaxScore,
    passScore: 60,
    durationMinutes: 10,
    questions,
    bankRefs: [{ bankId: 'test-bank', version: '1.0.0', source: 'builtin', title: '测试题库' }],
    ruleSnapshot: makeRuleSnapshot({ questionCount: questions.length }),
    ...overrides,
  };
}

/** 构造考试记录 */
export function makeAttempt(
  questions: PaperQuestion[],
  answers: Record<string, string[]>,
  overrides: Partial<ExamAttempt> = {},
): ExamAttempt {
  const now = Date.now();
  const paper = makePaper(questions, overrides.paper ? overrides.paper : {});

  return {
    schemaVersion: '1.0.0',
    attemptId: 'attempt-test',
    userId: 'user-test',
    examId: paper.examId,
    examTitle: paper.examTitle,
    levelId: paper.levelId,
    mode: 'official',
    status: 'in_progress',
    paper,
    answers,
    flaggedQuestionIds: [],
    currentIndex: 0,
    startedAt: now,
    expiresAt: now + 10 * 60 * 1000,
    remainingMs: 10 * 60 * 1000,
    lastSavedAt: now,
    submittedAt: null,
    submitReason: null,
    result: null,
    certificateId: null,
    durationMs: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
