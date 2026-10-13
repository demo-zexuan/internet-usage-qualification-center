/**
 * 试卷生成引擎
 *
 * I. 职责
 *
 * 1. 按考试规则从启用题库中抽题，支持固定题目、随机抽题与分类配额三种模式
 * 2. 将原始题目归一化为试卷快照：补齐判断题选项、解析正确选项、解析评分配置、随机化选项顺序
 * 3. 每次正式考试生成独立试卷快照，快照包含题目内容、选项顺序、分值与规则版本，
 *    后续导入新题库不会影响历史答卷的复核
 *
 * II. 失败即拒绝开考
 *
 * 1. 题库不足以满足题目数量或分类配额时返回明确错误，绝不生成残缺试卷
 * 2. 错误信息逐条列出缺口，便于题库作者定位问题
 *
 * @module features/exams/paper-builder
 * @author zexuan.peng
 * @created 2026-10-14
 */

import type { AppError, Result } from '@/types/common';
import type {
  ExamMode,
  ExamPaper,
  ExamRule,
  ExamRuleSnapshot,
  ExamRulesConfig,
  PaperBankRef,
  PaperOption,
  PaperQuestion,
  ResolvedQuestionScoring,
  ScoringPolicy,
} from '@/types/exam';
import type { QuestionBank, QuestionBankRecord, RawQuestion } from '@/types/question';

import { createPaperId, createSeed } from '@/utils/id';
import { createSeededRandom, shuffle, type RandomSource } from '@/utils/random';
import {
  resolveCorrectOptionIds,
  resolveQuestionOptions,
  resolveSelectionMode,
} from '@/utils/question';
import { toHundredths } from '@/features/grading/engine';

/** 抽题时携带题库来源信息的题目 */
interface PooledQuestion {
  question: RawQuestion;
  bank: QuestionBankRecord;
}

/** 构建试卷的输入 */
export interface BuildPaperInput {
  rule: ExamRule;
  rulesConfig: ExamRulesConfig;
  /** 当前启用的题库记录 */
  banks: QuestionBankRecord[];
  mode: ExamMode;
  /** 指定随机种子；为空时自动生成 */
  seed?: string;
}

/** 解析题目最终生效的评分配置 */
export function resolveQuestionScoring(
  question: RawQuestion,
  policy: ScoringPolicy,
  examNegativeScoringEnabled: boolean,
): ResolvedQuestionScoring {
  // I. 情景分析题按选项分值累加判分，不适用严格匹配与部分得分
  if (question.answer.mode === 'points') {
    return { mode: 'points', negativeScore: 0 };
  }

  // II. 部分得分必须由考试规则显式开启，不允许题目私自改变全卷规则
  const declared = question.scoring;
  const usePartial = declared?.mode === 'partial' && policy.partialCreditEnabled;

  // III. 倒扣分需要全卷开关开启，题目未声明时使用全卷默认值
  const negativeScore = examNegativeScoringEnabled
    ? (declared?.negativeScore ?? policy.defaultNegativeScore)
    : 0;

  return {
    mode: usePartial ? 'partial' : 'strict',
    partial: usePartial ? declared?.partial : undefined,
    negativeScore,
  };
}

/** 构造规则快照 */
function buildRuleSnapshot(rule: ExamRule, rulesConfig: ExamRulesConfig): ExamRuleSnapshot {
  return {
    rulesId: rulesConfig.rulesId,
    rulesVersion: rulesConfig.version,
    schemaVersion: rulesConfig.schemaVersion,
    examId: rule.examId,
    examTitle: rule.title,
    levelId: rule.levelId,
    category: rule.category,
    durationMinutes: rule.durationMinutes,
    questionCount: rule.questionCount,
    totalScore: rule.totalScore,
    passScore: rule.passScore,
    showAnswers: rule.showAnswers,
    negativeScoring: rule.negativeScoring,
    scoring: rulesConfig.scoring,
    grantsLevelId: rule.grantsLevelId,
    grantsCertifications: rule.grantsCertifications ?? [],
  };
}

/** 选项展示编号使用的字母表 */
const OPTION_LETTERS = 'ABCDEFGHIJ';

/**
 * 将原始题目归一化为试卷题目
 *
 * 1. 判断题补齐「正确 / 错误」选项
 * 2. 解析正确选项 ID（布尔答案映射为 TRUE / FALSE）
 * 3. 按题目与全卷配置决定是否随机化选项顺序
 * 4. 选项顺序被随机化后，按显示顺序重新编号为 A、B、C、D，
 *    避免出现「第 4 个选项标着 A」的错乱观感；题库原始 ID 保留在 sourceId 中
 */
export function buildPaperQuestion(
  pooled: PooledQuestion,
  rule: ExamRule,
  rulesConfig: ExamRulesConfig,
  random: RandomSource,
): PaperQuestion {
  const { question, bank } = pooled;
  const sourceOptions = resolveQuestionOptions(question);
  const sourceOptionIds = sourceOptions.map((option) => option.id);

  // I. 选项顺序随机化
  // 1. 判断题的「正确 / 错误」顺序固定，随机化会造成阅读障碍
  // 2. 其余题型按题目级配置优先、全卷配置兜底
  const shouldShuffle =
    question.type !== 'true_false' && (question.shuffleOptions ?? rule.paper.shuffleOptions);
  const orderedOptions = shouldShuffle ? shuffle(sourceOptions, random) : [...sourceOptions];

  // II. 随机化后按显示顺序重新编号，保证展示编号与阅读顺序一致
  const options: PaperOption[] = orderedOptions.map((option, index) => ({
    ...option,
    sourceId: option.id,
    id: shouldShuffle ? (OPTION_LETTERS[index] ?? option.id) : option.id,
  }));

  /** 把题库中的选项 ID 映射为试卷内的展示编号 */
  const remapOptionId = (sourceId: string): string =>
    options.find((option) => option.sourceId === sourceId)?.id ?? sourceId;

  const correctOptionIds = resolveCorrectOptionIds(question).map(remapOptionId);

  // III. 情景分析题的分值表同样需要重映射
  let optionPoints: Record<string, number> | undefined;
  if (question.answer.mode === 'points') {
    const sourcePoints = question.answer.optionPoints;
    optionPoints = {};
    for (const option of options) {
      optionPoints[option.id] = sourcePoints[option.sourceId ?? option.id] ?? 0;
    }
  }

  return {
    questionId: question.id,
    type: question.type,
    category: question.category,
    difficulty: question.difficulty,
    tags: [...question.tags],
    stem: question.stem,
    material: question.material,
    materialTitle: question.materialTitle,
    options,
    selection: resolveSelectionMode(question),
    correctOptionIds,
    optionPoints,
    scoring: resolveQuestionScoring(question, rulesConfig.scoring, rule.negativeScoring),
    score: question.score,
    explanation: question.explanation,
    knowledgePoints: [...(question.knowledgePoints ?? [])],
    multipleValidViewpoints: question.multipleValidViewpoints,
    bankId: bank.bankId,
    bankVersion: bank.version,
    sourceOptionIds,
  };
}

/** 按标签过滤题目 */
function filterByTags(pool: PooledQuestion[], rule: ExamRule): PooledQuestion[] {
  const required = rule.paper.requiredTags ?? [];
  const excluded = rule.paper.excludedTags ?? [];

  return pool.filter(({ question }) => {
    const tags = new Set(question.tags);
    if (required.some((tag) => !tags.has(tag))) {
      return false;
    }
    if (excluded.some((tag) => tags.has(tag))) {
      return false;
    }
    return true;
  });
}

/** 抽题结果 */
interface SelectionOutcome {
  selected: PooledQuestion[];
  shortages: string[];
}

/**
 * 按规则从题目池中抽题
 *
 * 1. 已选中的题目不会被第二次选中，避免配额之间重复
 * 2. 任何配额无法满足时记录缺口，最终统一返回，不生成残缺试卷
 */
function selectQuestions(pool: PooledQuestion[], rule: ExamRule, random: RandomSource): SelectionOutcome {
  const shortages: string[] = [];
  const selected: PooledQuestion[] = [];
  const usedIds = new Set<string>();

  /** 从未使用的题目中随机取 count 道 */
  const take = (candidates: PooledQuestion[], count: number): PooledQuestion[] => {
    const available = candidates.filter((item) => !usedIds.has(item.question.id));
    const picked = shuffle(available, random).slice(0, count);
    for (const item of picked) {
      usedIds.add(item.question.id);
    }
    return picked;
  };

  switch (rule.paper.mode) {
    // I. 固定题目列表：必须逐题命中，缺失即失败
    case 'fixed': {
      const idList = rule.paper.questionIds ?? [];
      for (const questionId of idList) {
        const found = pool.find((item) => item.question.id === questionId);
        if (!found) {
          shortages.push(`题库中不存在题目 ID：${questionId}`);
          continue;
        }
        if (usedIds.has(questionId)) {
          shortages.push(`固定题目列表中题目 ID 重复：${questionId}`);
          continue;
        }
        usedIds.add(questionId);
        selected.push(found);
      }
      break;
    }

    // II. 分类配额：逐条配额抽取，配额之间不重复
    case 'quota': {
      for (const quota of rule.paper.quotas ?? []) {
        const candidates = pool.filter(({ question }) => {
          const categoryMatched = quota.category === null || question.category === quota.category;
          const difficultyMatched =
            quota.difficulty === null || question.difficulty === quota.difficulty;
          return categoryMatched && difficultyMatched;
        });

        const picked = take(candidates, quota.count);
        if (picked.length < quota.count) {
          const categoryLabel = quota.category ?? '不限分类';
          const difficultyLabel =
            quota.difficulty === null ? '不限难度' : `难度 ${quota.difficulty}`;
          shortages.push(
            `${categoryLabel} / ${difficultyLabel} 需要 ${quota.count} 道，扣除已选题目后仅剩 ${picked.length} 道`,
          );
        }
        selected.push(...picked);
      }
      break;
    }

    // III. 随机抽题：可选按难度分布抽取
    case 'random':
    default: {
      const distribution = rule.paper.difficultyDistribution;
      if (distribution) {
        for (const [difficultyKey, count] of Object.entries(distribution)) {
          const difficulty = Number(difficultyKey);
          const wanted = count ?? 0;
          if (wanted <= 0) {
            continue;
          }
          const candidates = pool.filter(({ question }) => question.difficulty === difficulty);
          const picked = take(candidates, wanted);
          if (picked.length < wanted) {
            shortages.push(`难度 ${difficulty} 需要 ${wanted} 道，扣除已选题目后仅剩 ${picked.length} 道`);
          }
          selected.push(...picked);
        }
      } else {
        const picked = take(pool, rule.questionCount);
        if (picked.length < rule.questionCount) {
          shortages.push(
            `题库可用题目共 ${picked.length} 道，少于本场考试要求的 ${rule.questionCount} 道`,
          );
        }
        selected.push(...picked);
      }
      break;
    }
  }

  return { selected, shortages };
}

/** 将题库记录转换为抽题池 */
function toPool(banks: QuestionBankRecord[], rule: ExamRule): PooledQuestion[] {
  const pool: PooledQuestion[] = [];

  for (const bankId of rule.paper.bankIds) {
    const bank = banks.find((item) => item.bankId === bankId);
    if (!bank) {
      continue;
    }
    for (const question of bank.questions) {
      pool.push({ question, bank });
    }
  }

  return pool;
}

/**
 * 生成试卷快照
 *
 * @param input - 规则、题库与考试模式
 * @returns 成功时返回试卷快照；失败时返回可读的开考拒绝原因
 */
export function buildExamPaper(input: BuildPaperInput): Result<ExamPaper, AppError> {
  const { rule, rulesConfig, banks, mode } = input;

  // I. 题库存在性检查
  const missingBankIds = rule.paper.bankIds.filter(
    (bankId) => !banks.some((bank) => bank.bankId === bankId),
  );
  if (missingBankIds.length > 0) {
    return {
      ok: false,
      error: {
        code: 'QUESTION_BANK_EMPTY',
        message: '本场考试所需的题库尚未载入，无法生成试卷。',
        hint: '请前往「题库管理」页面导入对应题库，或恢复内置示例题库。',
        details: missingBankIds.map((bankId) => `缺少题库：${bankId}`),
      },
    };
  }

  const pool = filterByTags(toPool(banks, rule), rule);

  if (pool.length === 0) {
    return {
      ok: false,
      error: {
        code: 'QUESTION_BANK_EMPTY',
        message: '本场考试可用的题目为空，无法生成试卷。',
        hint: '请检查题库是否包含题目，以及考试规则的标签过滤条件是否过于严格。',
      },
    };
  }

  // II. 抽题
  const seed = input.seed ?? rule.paper.seed ?? createSeed();
  const random = createSeededRandom(seed);
  const { selected, shortages } = selectQuestions(pool, rule, random);

  if (shortages.length > 0 || selected.length !== rule.questionCount) {
    return {
      ok: false,
      error: {
        code: 'QUESTION_BANK_INSUFFICIENT',
        message: '题库内容不足以生成本场考试的试卷，考试无法开始。',
        hint: '请在「题库管理」页面补充题目，或调整本场考试的题目数量与分类配额。',
        details: shortages,
      },
    };
  }

  // III. 归一化为试卷题目
  const paperQuestions = selected.map((pooled) =>
    buildPaperQuestion(pooled, rule, rulesConfig, random),
  );

  // IV. 题目顺序随机化
  const orderedQuestions = rule.paper.shuffleQuestions
    ? shuffle(paperQuestions, random)
    : paperQuestions;

  // V. 汇总题库引用信息
  const bankRefs: PaperBankRef[] = [];
  for (const bankId of rule.paper.bankIds) {
    const bank = banks.find((item) => item.bankId === bankId);
    if (bank && !bankRefs.some((ref) => ref.bankId === bankId)) {
      bankRefs.push({
        bankId: bank.bankId,
        version: bank.version,
        source: bank.source,
        title: bank.title,
      });
    }
  }

  const rawMaxScore =
    orderedQuestions.reduce((sum, question) => sum + toHundredths(question.score), 0) / 100;

  return {
    ok: true,
    value: {
      paperId: createPaperId(),
      examId: rule.examId,
      examTitle: rule.title,
      levelId: rule.levelId,
      mode,
      generatedAt: Date.now(),
      seed,
      questionCount: orderedQuestions.length,
      rawMaxScore,
      passScore: rule.passScore,
      durationMinutes: rule.durationMinutes,
      questions: orderedQuestions,
      bankRefs,
      ruleSnapshot: buildRuleSnapshot(rule, rulesConfig),
    },
  };
}

/** 试卷摘要：用于考前须知页展示 */
export interface PaperPreview {
  examId: string;
  questionCount: number;
  rawMaxScore: number;
  durationMinutes: number;
  /** 各题型题目数量 */
  typeCounts: Record<string, number>;
  /** 各分类题目数量 */
  categoryCounts: Record<string, number>;
  /** 试卷包含的题库来源 */
  bankRefs: PaperBankRef[];
}

/**
 * 生成试卷预览
 *
 * 用于考前须知页：在不真正开始考试的前提下展示题型构成与分值口径。
 * 使用固定种子，因此预览结果与实际开考后的构成一致（题目内容可能不同）。
 */
export function previewExamPaper(input: Omit<BuildPaperInput, 'mode'>): Result<PaperPreview, AppError> {
  const built = buildExamPaper({ ...input, mode: 'mock', seed: `preview-${input.rule.examId}` });

  if (!built.ok) {
    return built;
  }

  const paper = built.value;
  const typeCounts: Record<string, number> = {};
  const categoryCounts: Record<string, number> = {};

  for (const question of paper.questions) {
    typeCounts[question.type] = (typeCounts[question.type] ?? 0) + 1;
    categoryCounts[question.category] = (categoryCounts[question.category] ?? 0) + 1;
  }

  return {
    ok: true,
    value: {
      examId: paper.examId,
      questionCount: paper.questionCount,
      rawMaxScore: paper.rawMaxScore,
      durationMinutes: paper.durationMinutes,
      typeCounts,
      categoryCounts,
      bankRefs: paper.bankRefs,
    },
  };
}

/** 便捷断言：判断题库记录是否满足某场考试的抽题要求（供管理页面使用） */
export function describeBankSources(banks: QuestionBank[]): string {
  return banks.map((bank) => `${bank.title}（${bank.questions.length} 题）`).join('、');
}
