/**
 * 题库 JSON 校验 Schema
 *
 * I. 校验层次
 *
 * 1. 结构层（Zod）：字段是否存在、类型是否正确、枚举值是否合法
 * 2. 关系层（superRefine）：选项 ID 是否重复、正确答案是否引用存在的选项、
 *    单选是否只有一个正确答案、多选是否至少一个正确答案、分值是否合法
 * 3. 全局层（本题库顶层 refine）：题目 ID 是否重复、题目数量与总分是否可用
 *
 * II. 错误路径
 *
 * 1. 所有错误均带可读路径，例如 `questions[3].answer.correctOptionIds`
 * 2. 阻断性错误与提示性警告分开返回：警告不阻止导入，但会在管理页面展示
 *
 * III. 兼容性
 *
 * 1. `schemaVersion` 不在受支持列表内时直接拒绝导入，并说明当前支持版本
 *
 * @module schemas/question-bank.schema
 * @author zexuan.peng
 * @created 2026-10-14
 */

import { z } from 'zod';

import { QUESTION_CATEGORIES, QUESTION_TYPES } from '@/types/question';
import type {
  Difficulty,
  QuestionBank,
  QuestionBankStats,
  RawQuestion,
} from '@/types/question';
import type { Result } from '@/types/common';
import {
  DEFAULT_TRUE_FALSE_OPTIONS,
  FALSE_OPTION_ID,
  TRUE_OPTION_ID,
  resolveCorrectOptionIds,
  resolveQuestionOptions,
  resolveSelectionMode,
} from '@/utils/question';

import {
  collectIssues,
  parseWithSchema,
  type ValidationFailure,
  type ValidationIssue,
} from './validation';

/** 当前题库结构版本 */
export const QUESTION_BANK_SCHEMA_VERSION = '1.0.0';

/** 受支持的题库结构版本列表 */
export const SUPPORTED_QUESTION_BANK_SCHEMA_VERSIONS: readonly string[] = ['1.0.0'];

/* ============================================================
   I. 基础片段
   ============================================================ */

const difficultySchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);

const optionSchema = z.object({
  id: z.string().min(1, { error: '选项 ID 不能为空' }).max(32, { error: '选项 ID 过长' }),
  text: z.string().min(1, { error: '选项正文不能为空' }),
  points: z.number({ error: '选项分值必须是数字' }).optional(),
  rationale: z.string().optional(),
});

const keyAnswerSchema = z.object({
  mode: z.literal('key'),
  correctOptionIds: z
    .array(z.string().min(1))
    .min(1, { error: '正确答案至少需要包含一个选项 ID' }),
});

const booleanAnswerSchema = z.object({
  mode: z.literal('boolean'),
  correctBoolean: z.boolean({ error: '判断题答案必须是布尔值' }),
});

const pointsAnswerSchema = z.object({
  mode: z.literal('points'),
  bestOptionIds: z
    .array(z.string().min(1))
    .min(1, { error: '参考最优选项至少需要包含一个选项 ID' }),
  optionPoints: z.record(z.string(), z.number({ error: '选项分值必须是数字' })),
});

const answerSchema = z.discriminatedUnion('mode', [
  keyAnswerSchema,
  booleanAnswerSchema,
  pointsAnswerSchema,
]);

const partialCreditSchema = z.object({
  strategy: z.enum(['per_option', 'proportional'], {
    error: '部分得分策略必须是 per_option 或 proportional',
  }),
  penaltyPerWrongOption: z.number().min(0, { error: '错选罚分不能为负数' }).optional(),
});

const scoringSchema = z.object({
  mode: z.enum(['strict', 'partial'], { error: '评分模式必须是 strict 或 partial' }),
  partial: partialCreditSchema.optional(),
  negativeScore: z.number().min(0, { error: '倒扣分值不能为负数' }).optional(),
});

/* ============================================================
   II. 题目 Schema（含关系层校验）
   ============================================================ */

const rawQuestionSchema = z
  .object({
    id: z.string().min(1, { error: '题目 ID 不能为空' }).max(64, { error: '题目 ID 过长' }),
    type: z.enum(QUESTION_TYPES, { error: '题型不合法' }),
    category: z.enum(QUESTION_CATEGORIES, { error: '题目分类不合法' }),
    difficulty: difficultySchema,
    tags: z.array(z.string().min(1)).default([]),
    stem: z.string().min(1, { error: '题干不能为空' }),
    material: z.string().min(1, { error: '材料内容不能为空' }).optional(),
    materialTitle: z.string().min(1, { error: '材料标题不能为空' }).optional(),
    options: z.array(optionSchema).optional(),
    answer: answerSchema,
    selection: z.enum(['single', 'multiple'], { error: '作答方式必须是 single 或 multiple' }).optional(),
    explanation: z.string().min(1, { error: '答案解析不能为空' }),
    score: z.number({ error: '题目分值必须是数字' }).positive({ error: '题目分值必须大于 0' }),
    knowledgePoints: z.array(z.string()).optional(),
    source: z.string().optional(),
    shuffleOptions: z.boolean().optional(),
    scoring: scoringSchema.optional(),
    multipleValidViewpoints: z.boolean().optional(),
  })
  .superRefine((question, ctx) => {
    // I. 选项层校验
    // 1. 除判断题外，题目必须提供选项
    const isTrueFalse = question.type === 'true_false';
    const options = question.options ?? [];

    if (!isTrueFalse && options.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['options'],
        message: '该题型必须提供至少两个选项',
      });
    }

    if (options.length === 1) {
      ctx.addIssue({ code: 'custom', path: ['options'], message: '选项数量不得少于 2 个' });
    }

    // 2. 选项 ID 不得重复
    const optionIds = options.map((option) => option.id);
    const duplicatedOptionIds = optionIds.filter((id, index) => optionIds.indexOf(id) !== index);
    if (duplicatedOptionIds.length > 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['options'],
        message: `选项 ID 重复：${[...new Set(duplicatedOptionIds)].join('、')}`,
      });
    }

    // 3. 判断题若自定义选项，必须恰好是 TRUE / FALSE 两项
    if (isTrueFalse && options.length > 0) {
      const sortedIds = [...optionIds].sort();
      const expected = [FALSE_OPTION_ID, TRUE_OPTION_ID].sort();
      const matches =
        sortedIds.length === expected.length &&
        sortedIds.every((id, index) => id === expected[index]);
      if (!matches) {
        ctx.addIssue({
          code: 'custom',
          path: ['options'],
          message: `判断题选项 ID 必须为 ${TRUE_OPTION_ID} 与 ${FALSE_OPTION_ID}`,
        });
      }
    }

    // II. 答案与作答方式的匹配校验
    const selection = resolveSelectionMode(question as RawQuestion);
    const correctOptionIds = resolveCorrectOptionIds(question as RawQuestion);

    // 1. 布尔型答案仅用于判断题
    if (question.answer.mode === 'boolean' && !isTrueFalse) {
      ctx.addIssue({
        code: 'custom',
        path: ['answer', 'mode'],
        message: '布尔型答案仅适用于判断题，其他题型请使用 key 或 points 模式',
      });
    }

    // 2. 判断题不得使用分值型答案
    if (isTrueFalse && question.answer.mode === 'points') {
      ctx.addIssue({
        code: 'custom',
        path: ['answer', 'mode'],
        message: '判断题不支持分值型答案，请使用 boolean 或 key 模式',
      });
    }

    // 3. 单选类题型必须恰好一个正确答案
    if (selection === 'single' && correctOptionIds.length !== 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['answer'],
        message: `单选题必须且只能有一个正确答案，当前为 ${correctOptionIds.length} 个`,
      });
    }

    // 4. 多选类题型至少一个正确答案
    if (selection === 'multiple' && correctOptionIds.length < 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['answer'],
        message: '多选题至少需要一个正确答案',
      });
    }

    // 5. 正确答案必须引用存在的选项
    const effectiveOptionIds = (isTrueFalse && options.length === 0
      ? DEFAULT_TRUE_FALSE_OPTIONS.map((option) => option.id)
      : optionIds
    ) as string[];

    if (question.answer.mode === 'key') {
      question.answer.correctOptionIds.forEach((id, index) => {
        if (!effectiveOptionIds.includes(id)) {
          ctx.addIssue({
            code: 'custom',
            path: ['answer', 'correctOptionIds', index],
            message: `正确答案引用了不存在的选项 ID：${id}`,
          });
        }
      });
    }

    // 6. 分值型答案：分值表必须覆盖全部选项，且参考最优选项必须存在
    if (question.answer.mode === 'points') {
      const optionPoints = question.answer.optionPoints;
      optionIds.forEach((id, index) => {
        if (!(id in optionPoints)) {
          ctx.addIssue({
            code: 'custom',
            path: ['answer', 'optionPoints', id],
            message: `选项 ${id}（第 ${index + 1} 个）缺少分值定义`,
          });
        }
      });
      Object.keys(optionPoints).forEach((id) => {
        if (!optionIds.includes(id)) {
          ctx.addIssue({
            code: 'custom',
            path: ['answer', 'optionPoints', id],
            message: `分值表引用了不存在的选项 ID：${id}`,
          });
        }
      });
      question.answer.bestOptionIds.forEach((id, index) => {
        if (!optionIds.includes(id)) {
          ctx.addIssue({
            code: 'custom',
            path: ['answer', 'bestOptionIds', index],
            message: `参考最优选项引用了不存在的选项 ID：${id}`,
          });
        }
      });
    }

    // III. 评分规则一致性
    if (question.scoring?.mode === 'partial' && !question.scoring.partial) {
      ctx.addIssue({
        code: 'custom',
        path: ['scoring', 'partial'],
        message: '声明部分得分模式时必须提供 partial 规则',
      });
    }

    // IV. 材料题必须提供材料
    if (
      (question.type === 'reading_comprehension' || question.type === 'scenario_analysis') &&
      !question.material
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['material'],
        message: '该题型必须提供 material 材料正文',
      });
    }
  });

/* ============================================================
   III. 题库 Schema（含全局校验）
   ============================================================ */

const questionBankSchema = z
  .object({
    schemaVersion: z
      .string()
      .min(1, { error: 'schemaVersion 不能为空' })
      .refine((value) => SUPPORTED_QUESTION_BANK_SCHEMA_VERSIONS.includes(value), {
        error: `不支持的题库结构版本，当前支持：${SUPPORTED_QUESTION_BANK_SCHEMA_VERSIONS.join('、')}`,
      }),
    bankId: z
      .string()
      .min(1, { error: 'bankId 不能为空' })
      .max(64, { error: 'bankId 过长' })
      .regex(/^[a-zA-Z0-9_-]+$/, { error: 'bankId 只能包含字母、数字、下划线与连字符' }),
    title: z.string().min(1, { error: '题库标题不能为空' }),
    description: z.string().default(''),
    language: z.string().default('zh-CN'),
    version: z.string().min(1, { error: '题库版本号不能为空' }),
    author: z.string().optional(),
    updatedAt: z.string().optional(),
    questions: z
      .array(rawQuestionSchema)
      .min(1, { error: '题库至少需要包含一道题目' }),
  })
  .superRefine((bank, ctx) => {
    // I. 题目 ID 全局唯一
    const ids = bank.questions.map((question) => question.id);
    const duplicated = ids.filter((id, index) => ids.indexOf(id) !== index);
    if (duplicated.length > 0) {
      [...new Set(duplicated)].forEach((id) => {
        const index = ids.indexOf(id);
        ctx.addIssue({
          code: 'custom',
          path: ['questions', index, 'id'],
          message: `题目 ID 重复：${id}`,
        });
      });
    }

    // II. 总分必须为正数
    const totalScore = bank.questions.reduce((sum, question) => sum + question.score, 0);
    if (!(totalScore > 0)) {
      ctx.addIssue({
        code: 'custom',
        path: ['questions'],
        message: '题库题目分值合计必须大于 0',
      });
    }
  });

/* ============================================================
   IV. 对外接口
   ============================================================ */

/** 题库校验结果：区分阻断性错误与提示性警告 */
export interface QuestionBankValidationOutcome {
  ok: boolean;
  /** 校验通过时的题库对象 */
  bank: QuestionBank | null;
  /** 阻断性错误，存在时不得导入 */
  issues: ValidationIssue[];
  /** 非阻断提示，允许导入但需在管理页面展示 */
  warnings: ValidationIssue[];
}

/**
 * 计算题库统计信息
 *
 * @param bank - 已校验的题库
 * @returns 题型、分类、难度分布与总分
 */
export function computeQuestionBankStats(bank: QuestionBank): QuestionBankStats {
  const byType: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  const byDifficulty: Record<string, number> = {};
  let totalScore = 0;

  for (const question of bank.questions) {
    byType[question.type] = (byType[question.type] ?? 0) + 1;
    byCategory[question.category] = (byCategory[question.category] ?? 0) + 1;
    const difficultyKey = String(question.difficulty);
    byDifficulty[difficultyKey] = (byDifficulty[difficultyKey] ?? 0) + 1;
    totalScore += question.score;
  }

  return {
    totalQuestions: bank.questions.length,
    byType,
    byCategory,
    byDifficulty,
    totalScore,
  };
}

/**
 * 生成提示性警告
 *
 * 这些情况不影响题库可用性，但会影响考试体验或成绩统计口径。
 */
function collectWarnings(bank: QuestionBank): ValidationIssue[] {
  const warnings: ValidationIssue[] = [];

  bank.questions.forEach((question, index) => {
    // 1. 情景分析题：选项可得分值上限与题目分值不一致时提示
    if (question.answer.mode === 'points') {
      const maxAttainable = Object.values(question.answer.optionPoints).reduce(
        (max, points) => Math.max(max, points),
        0,
      );
      if (maxAttainable !== question.score) {
        warnings.push({
          path: `questions[${index}].score`,
          message: `情景分析题单选项最高可得分值（${maxAttainable}）与题目分值（${question.score}）不一致，实际得分将按题目分值上限截断`,
          code: 'warning_points_mismatch',
        });
      }
    }

    // 2. 非整数分值会让百分制归一化出现小数，提示作者确认
    if (!Number.isInteger(question.score)) {
      warnings.push({
        path: `questions[${index}].score`,
        message: `题目分值 ${question.score} 不是整数，百分制归一化后可能出现小数分`,
        code: 'warning_fractional_score',
      });
    }

    // 3. 缺少标签会影响按主题抽题的精度
    if (question.tags.length === 0) {
      warnings.push({
        path: `questions[${index}].tags`,
        message: '题目未设置标签，按主题抽题时将无法命中该题',
        code: 'warning_missing_tags',
      });
    }
  });

  // 4. 题目数量过少会限制考试的抽题空间
  if (bank.questions.length < 10) {
    warnings.push({
      path: 'questions',
      message: `题库仅有 ${bank.questions.length} 道题目，可能无法满足正式考试的抽题数量要求`,
      code: 'warning_small_bank',
    });
  }

  return warnings;
}

/**
 * 校验题库 JSON
 *
 * @param raw - 由 JSON.parse 得到的原始数据
 * @returns 校验结果，含阻断性错误与提示性警告
 */
export function validateQuestionBank(raw: unknown): QuestionBankValidationOutcome {
  const parsed = questionBankSchema.safeParse(raw);

  // I. 结构或关系校验失败：直接返回全部错误路径，不产生任何副作用
  if (!parsed.success) {
    return {
      ok: false,
      bank: null,
      issues: collectIssues(parsed.error),
      warnings: [],
    };
  }

  // II. 校验通过：附加非阻断提示，供管理页面展示
  const bank = parsed.data as QuestionBank;

  return {
    ok: true,
    bank,
    issues: [],
    warnings: collectWarnings(bank),
  };
}

/**
 * 严格校验题库，返回统一 Result 结构
 *
 * 供内部加载器使用；管理页面应改用 `validateQuestionBank` 以获得警告信息。
 */
export function parseQuestionBankStrict(raw: unknown): Result<QuestionBank, ValidationFailure> {
  const parsed = parseWithSchema(questionBankSchema, raw, '题库校验未通过');
  return parsed as Result<QuestionBank, ValidationFailure>;
}

/** 考试对题库容量的要求 */
export interface BankCapacityRequirement {
  /** 需要的题目数量 */
  questionCount: number;
  /** 需要的总分（可选） */
  totalScore?: number;
  /** 分类配额要求（可选） */
  quotas?: { category: string | null; difficulty: Difficulty | null; count: number }[];
}

/** 题库容量检查结果 */
export interface BankCapacityResult {
  satisfied: boolean;
  /** 缺口说明，逐条面向用户 */
  shortages: string[];
}

/**
 * 检查题库是否满足考试的抽题要求
 *
 * 题库不足以满足题目数量或分类配额时，考试不得启动。
 */
export function checkBankCapacity(
  banks: QuestionBank[],
  requirement: BankCapacityRequirement,
): BankCapacityResult {
  const shortages: string[] = [];
  const allQuestions: { bank: QuestionBank; question: RawQuestion }[] = banks.flatMap((bank) =>
    bank.questions.map((question) => ({ bank, question })),
  );

  // I. 总题量检查
  if (allQuestions.length < requirement.questionCount) {
    shortages.push(
      `题库可用题目共 ${allQuestions.length} 道，少于本场考试要求的 ${requirement.questionCount} 道`,
    );
  }

  // II. 分类配额检查
  for (const quota of requirement.quotas ?? []) {
    const matched = allQuestions.filter(({ question }) => {
      const categoryMatched = quota.category === null || question.category === quota.category;
      const difficultyMatched =
        quota.difficulty === null || question.difficulty === quota.difficulty;
      return categoryMatched && difficultyMatched;
    });

    if (matched.length < quota.count) {
      const categoryLabel = quota.category ?? '不限分类';
      const difficultyLabel = quota.difficulty === null ? '不限难度' : `难度 ${quota.difficulty}`;
      shortages.push(
        `${categoryLabel} / ${difficultyLabel} 需要 ${quota.count} 道，实际仅有 ${matched.length} 道`,
      );
    }
  }

  // III. 总分检查
  if (requirement.totalScore !== undefined) {
    const totalScore = allQuestions.reduce((sum, item) => sum + item.question.score, 0);
    if (totalScore < requirement.totalScore) {
      shortages.push(
        `题库题目分值合计 ${totalScore} 分，少于本场考试要求的 ${requirement.totalScore} 分`,
      );
    }
  }

  return { satisfied: shortages.length === 0, shortages };
}

/** 归一化后的题目形态（供抽题与展示使用） */
export interface NormalizedQuestionView {
  options: ReturnType<typeof resolveQuestionOptions>;
  selection: ReturnType<typeof resolveSelectionMode>;
  correctOptionIds: string[];
}

/** 将原始题目归一化为统一形态 */
export function normalizeQuestionView(question: RawQuestion): NormalizedQuestionView {
  return {
    options: resolveQuestionOptions(question),
    selection: resolveSelectionMode(question),
    correctOptionIds: resolveCorrectOptionIds(question),
  };
}
