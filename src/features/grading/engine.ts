/**
 * 统一评分引擎
 *
 * I. 设计原则
 *
 * 1. 全站所有分数只由本模块计算，页面组件不得自行算分
 * 2. 内部一律使用「百分之一分」整数运算，最后一步才转换为小数展示，
 *    从根本上避免浮点误差导致及格线边界判定不一致
 * 3. 判分只依赖试卷快照（PaperQuestion），不读取原始题库，保证历史答卷可复核
 *
 * II. 各题型判分规则
 *
 * 1. 单选题：选项集合完全一致得满分，否则零分
 * 2. 多选题（strict）：选项集合完全一致得满分，少选、多选、错选均不得满分
 * 3. 多选题（partial）：按配置逐项给分并扣除错选罚分，需考试规则显式开启
 * 4. 判断题：归一化为 TRUE / FALSE 选项后按单选题规则判分
 * 5. 情景分析题：累加所选选项的预设分值，按题目满分截断
 * 6. 阅读理解题与观点辨析题：按配置的标准答案与评分规则判分
 *
 * III. 归一化
 *
 * 1. 试卷原始满分等于题目分值之和，与考试配置的满分未必一致
 * 2. 启用 normalizeToHundred 时，最终得分按「原始得分 / 原始满分 × 100」折算
 * 3. 折算后再按配置的舍入方式与小数位取整，及格线判定使用同一口径
 *
 * @module features/grading/engine
 * @author zexuan.peng
 * @created 2026-10-14
 */

import type {
  ExamAttempt,
  ExamResult,
  PaperQuestion,
  QuestionResult,
  ResolvedQuestionScoring,
  RoundingMode,
  ScoringPolicy,
} from '@/types/exam';
import type { SelectionMode } from '@/types/question';

/** 分数内部精度：百分之一分 */
export const SCORE_SCALE = 100;

/** 将分值转换为百分之一分整数 */
export function toHundredths(value: number): number {
  return Math.round(value * SCORE_SCALE);
}

/** 将百分之一分整数转换为展示用分值（保留两位小数） */
export function fromHundredths(value: number): number {
  return Math.round(value) / SCORE_SCALE;
}

/**
 * 按配置的舍入方式处理百分之一分整数
 *
 * @param hundredths - 百分之一分整数（非负）
 * @param mode - 舍入方式
 * @param decimalPlaces - 保留小数位（0 / 1 / 2）
 */
export function roundHundredths(
  hundredths: number,
  mode: RoundingMode,
  decimalPlaces: number,
): number {
  const step = 10 ** (2 - decimalPlaces);
  if (step <= 1) {
    return hundredths;
  }

  const quotient = hundredths / step;
  let rounded: number;
  switch (mode) {
    case 'half_up':
      rounded = Math.round(quotient);
      break;
    case 'floor':
      rounded = Math.floor(quotient);
      break;
    case 'ceil':
      rounded = Math.ceil(quotient);
      break;
    case 'truncate':
      rounded = Math.trunc(quotient);
      break;
    default:
      rounded = Math.round(quotient);
  }

  return rounded * step;
}

/** 单题判分结果 */
export interface QuestionGradingOutcome {
  /** 该题得分（百分之一分整数） */
  earnedHundredths: number;
  /** 该题满分（百分之一分整数） */
  maxHundredths: number;
  /** 作答状态 */
  status: QuestionResult['status'];
  /** 是否完全正确 */
  isCorrect: boolean;
}

/** 判分上下文 */
export interface QuestionGradingContext {
  /** 全卷评分策略 */
  policy: ScoringPolicy;
  /** 本场考试是否启用倒扣分 */
  negativeScoringEnabled: boolean;
}

/**
 * 判断所选选项集合是否与正确集合完全一致
 *
 * 集合比较与顺序无关，因此选项随机化不会影响判分结果。
 */
function isExactMatch(selected: string[], correct: string[]): boolean {
  if (selected.length !== correct.length) {
    return false;
  }
  const correctSet = new Set(correct);
  return selected.every((id) => correctSet.has(id));
}

/**
 * 计算多选题部分得分
 *
 * @param selected - 考生所选选项
 * @param correct - 正确选项
 * @param maxHundredths - 该题满分（百分之一分整数）
 * @param scoring - 已生效的题目级评分配置
 */
function computePartialScore(
  selected: string[],
  correct: string[],
  maxHundredths: number,
  scoring: ResolvedQuestionScoring,
): number {
  const partial = scoring.partial;
  if (!partial) {
    return 0;
  }

  const correctSet = new Set(correct);
  const correctSelected = selected.filter((id) => correctSet.has(id)).length;
  const wrongSelected = selected.length - correctSelected;
  const totalCorrect = correct.length;

  if (totalCorrect === 0) {
    return 0;
  }

  let score: number;
  if (partial.strategy === 'per_option') {
    // 每个正确选项均分该题分值，再扣除错选罚分
    score = (maxHundredths * correctSelected) / totalCorrect;
    const penalty = toHundredths(partial.penaltyPerWrongOption ?? 0) * wrongSelected;
    score -= penalty;
  } else {
    // 按「选对比例 - 选错比例」计分，选错会直接抵消选对
    score = (maxHundredths * (correctSelected - wrongSelected)) / totalCorrect;
  }

  return Math.round(Math.min(Math.max(score, 0), maxHundredths));
}

/**
 * 情景分析题判分：累加所选选项的预设分值
 *
 * 单选情景题取所选唯一选项的分值；多选情景题累加全部所选选项分值。
 * 最终得分按题目满分截断，且不低于 0（除非全卷允许负分）。
 */
function computePointsScore(
  question: PaperQuestion,
  selected: string[],
  policy: ScoringPolicy,
): number {
  const optionPoints = question.optionPoints ?? {};
  const maxHundredths = toHundredths(question.score);

  const relevant = question.selection === 'single' ? selected.slice(0, 1) : selected;
  const raw = relevant.reduce((sum, id) => sum + toHundredths(optionPoints[id] ?? 0), 0);

  const floor = policy.allowNegativeTotal ? -maxHundredths : 0;
  return Math.min(Math.max(raw, floor), maxHundredths);
}

/**
 * 对单道题目判分
 *
 * @param question - 试卷中的题目快照
 * @param selectedOptionIds - 考生所选选项 ID
 * @param context - 判分上下文
 * @returns 得分、状态与是否正确
 */
export function gradeQuestion(
  question: PaperQuestion,
  selectedOptionIds: string[],
  context: QuestionGradingContext,
): QuestionGradingOutcome {
  const maxHundredths = toHundredths(question.score);
  const selected = selectedOptionIds.filter((id) => typeof id === 'string');

  // I. 未作答：直接零分，且不适用倒扣分
  if (selected.length === 0) {
    return {
      earnedHundredths: 0,
      maxHundredths,
      status: 'unanswered',
      isCorrect: false,
    };
  }

  // II. 计算基础得分
  let earned: number;
  let isCorrect: boolean;

  if (question.scoring.mode === 'points') {
    earned = computePointsScore(question, selected, context.policy);
    isCorrect = earned >= maxHundredths;
  } else if (question.scoring.mode === 'partial' && context.policy.partialCreditEnabled) {
    const exact = isExactMatch(selected, question.correctOptionIds);
    earned = exact
      ? maxHundredths
      : computePartialScore(selected, question.correctOptionIds, maxHundredths, question.scoring);
    isCorrect = exact;
  } else {
    const exact = isExactMatch(selected, question.correctOptionIds);
    earned = exact ? maxHundredths : 0;
    isCorrect = exact;
  }

  // III. 倒扣分：仅在「答错且已作答」时生效，且需要全卷开关开启
  const negativeHundredths = toHundredths(question.scoring.negativeScore);
  if (!isCorrect && context.negativeScoringEnabled && negativeHundredths > 0) {
    earned -= negativeHundredths;
    const floor = context.policy.allowNegativeTotal ? -maxHundredths : 0;
    earned = Math.max(earned, floor);
  }

  // IV. 归一化状态：完全正确、部分得分、答错
  let status: QuestionResult['status'];
  if (isCorrect) {
    status = 'correct';
  } else if (earned > 0) {
    status = 'partial';
  } else {
    status = 'wrong';
  }

  return {
    earnedHundredths: Math.round(earned),
    maxHundredths,
    status,
    isCorrect,
  };
}

/** 试卷原始满分（题目分值之和，百分之一分整数） */
export function computePaperMaxHundredths(questions: PaperQuestion[]): number {
  return questions.reduce((sum, question) => sum + toHundredths(question.score), 0);
}

/** 将试卷题目转换为成绩页所需的选项顺序信息 */
function buildQuestionResult(
  question: PaperQuestion,
  selectedOptionIds: string[],
  outcome: QuestionGradingOutcome,
  flagged: boolean,
): QuestionResult {
  return {
    questionId: question.questionId,
    type: question.type,
    stem: question.stem,
    selection: question.selection as SelectionMode,
    selectedOptionIds: [...selectedOptionIds],
    correctOptionIds: [...question.correctOptionIds],
    status: outcome.status,
    earnedScore: fromHundredths(outcome.earnedHundredths),
    maxScore: fromHundredths(outcome.maxHundredths),
    flagged,
    explanation: question.explanation,
    knowledgePoints: [...question.knowledgePoints],
    category: question.category,
    difficulty: question.difficulty,
    optionPoints: question.optionPoints,
    multipleValidViewpoints: question.multipleValidViewpoints,
  };
}

/**
 * 判定是否展示正确答案与解析
 *
 * 1. `always`：交卷后始终展示
 * 2. `after_pass`：仅通过时展示
 * 3. `never`：不展示
 */
export function resolveAnswersVisible(
  visibility: ExamAttempt['paper']['ruleSnapshot']['showAnswers'],
  passed: boolean,
): boolean {
  switch (visibility) {
    case 'always':
      return true;
    case 'after_pass':
      return passed;
    case 'never':
      return false;
    default:
      return false;
  }
}

/**
 * 结算整场考试
 *
 * 本函数是纯函数：相同的考试记录必然得到相同的成绩，
 * 因此交卷、超时自动交卷与恢复结算可以共用同一条可靠路径。
 *
 * @param attempt - 考试记录（含试卷快照与答卷）
 * @returns 评分结果
 */
export function gradeAttempt(attempt: ExamAttempt): ExamResult {
  const { paper } = attempt;
  const policy = paper.ruleSnapshot.scoring;
  const context: QuestionGradingContext = {
    policy,
    negativeScoringEnabled: paper.ruleSnapshot.negativeScoring,
  };

  // I. 逐题判分
  const flagged = new Set(attempt.flaggedQuestionIds);
  const questionResults: QuestionResult[] = [];
  let rawEarnedHundredths = 0;

  for (const question of paper.questions) {
    const selected = attempt.answers[question.questionId] ?? [];
    const outcome = gradeQuestion(question, selected, context);
    rawEarnedHundredths += outcome.earnedHundredths;
    questionResults.push(
      buildQuestionResult(question, selected, outcome, flagged.has(question.questionId)),
    );
  }

  const rawMaxHundredths = computePaperMaxHundredths(paper.questions);

  // II. 统计各状态题目数量
  const correctCount = questionResults.filter((item) => item.status === 'correct').length;
  const partialCount = questionResults.filter((item) => item.status === 'partial').length;
  const wrongCount = questionResults.filter((item) => item.status === 'wrong').length;
  const unansweredCount = questionResults.filter((item) => item.status === 'unanswered').length;

  // III. 归一化到百分制
  // 1. 未启用归一化时直接使用原始分值口径
  // 2. 启用时按「原始得分 / 原始满分 × 100」折算，并转换为百分之一分整数
  const normalized = policy.normalizeToHundred && rawMaxHundredths > 0;

  let finalHundredths: number;
  let maxHundredths: number;

  if (normalized) {
    finalHundredths = Math.round((rawEarnedHundredths * 100 * SCORE_SCALE) / rawMaxHundredths);
    maxHundredths = 100 * SCORE_SCALE;
  } else {
    finalHundredths = rawEarnedHundredths;
    maxHundredths = rawMaxHundredths;
  }

  // 4. 总分下限：默认不允许负分
  if (!policy.allowNegativeTotal && finalHundredths < 0) {
    finalHundredths = 0;
  }

  // 5. 按配置舍入，及格线判定使用同一舍入口径
  const roundedFinal = roundHundredths(finalHundredths, policy.rounding, policy.decimalPlaces);
  const passHundredths = roundHundredths(
    toHundredths(paper.passScore),
    policy.rounding,
    policy.decimalPlaces,
  );

  const passed = roundedFinal >= passHundredths;

  // IV. 等级与认证：模拟考试不授予等级，避免刷模拟考试升级
  const isOfficial = attempt.mode === 'official';
  const levelAwarded = passed && isOfficial ? paper.ruleSnapshot.grantsLevelId : null;
  const certificationsAwarded = passed && isOfficial ? [...paper.ruleSnapshot.grantsCertifications] : [];

  return {
    attemptId: attempt.attemptId,
    examId: attempt.examId,
    examTitle: attempt.examTitle,
    levelId: attempt.levelId,
    mode: attempt.mode,
    rawEarnedScore: fromHundredths(rawEarnedHundredths),
    rawMaxScore: fromHundredths(rawMaxHundredths),
    score: fromHundredths(roundedFinal),
    maxScore: fromHundredths(maxHundredths),
    passScore: paper.passScore,
    passed,
    totalQuestions: paper.questions.length,
    correctCount,
    partialCount,
    wrongCount,
    unansweredCount,
    normalized,
    rounding: policy.rounding,
    decimalPlaces: policy.decimalPlaces,
    questionResults,
    levelAwarded,
    certificationsAwarded,
    answersVisible: resolveAnswersVisible(paper.ruleSnapshot.showAnswers, passed),
    gradedAt: Date.now(),
    scoringRuleVersion: `${paper.ruleSnapshot.rulesId}@${paper.ruleSnapshot.rulesVersion}`,
  };
}
