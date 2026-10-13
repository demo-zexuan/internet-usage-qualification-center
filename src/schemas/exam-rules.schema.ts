/**
 * 考试规则配置校验 Schema
 *
 * I. 校验重点
 *
 * 1. 及格线不得高于满分，否则考试永远无法通过
 * 2. 配额抽题的数量之和必须等于题目数量，否则试卷无法生成
 * 3. 固定题目列表模式的数量必须与题目数量一致
 * 4. examId 全局唯一，避免报名列表出现重复条目
 *
 * II. 与题库的联合校验
 *
 * 1. 本 Schema 只校验规则自身的自洽性
 * 2. 规则与题库之间的容量匹配由 `checkBankCapacity` 在开考时判定
 *
 * @module schemas/exam-rules.schema
 * @author zexuan.peng
 * @created 2026-10-14
 */

import { z } from 'zod';

import { EXAM_CATEGORIES } from '@/types/exam';
import type { ExamRule, ExamRulesConfig } from '@/types/exam';
import { QUESTION_CATEGORIES } from '@/types/question';

import { collectIssues, parseWithSchema, type ValidationFailure, type ValidationIssue } from './validation';
import type { Result } from '@/types/common';

/** 当前考试规则结构版本 */
export const EXAM_RULES_SCHEMA_VERSION = '1.0.0';

/** 受支持的考试规则结构版本列表 */
export const SUPPORTED_EXAM_RULES_SCHEMA_VERSIONS: readonly string[] = ['1.0.0'];

const difficultySchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);

/* ============================================================
   I. 评分配置
   ============================================================ */

const scoringPolicySchema = z.object({
  normalizeToHundred: z.boolean(),
  rounding: z.enum(['half_up', 'floor', 'ceil', 'truncate'], { error: '舍入方式不合法' }),
  decimalPlaces: z
    .union([z.literal(0), z.literal(1), z.literal(2)], { error: '保留小数位只能是 0、1 或 2' }),
  allowNegativeTotal: z.boolean(),
  defaultNegativeScore: z.number().min(0, { error: '默认倒扣分值不能为负数' }),
  partialCreditEnabled: z.boolean(),
});

/* ============================================================
   II. 试卷生成配置
   ============================================================ */

const paperQuotaSchema = z.object({
  category: z.enum(QUESTION_CATEGORIES, { error: '配额分类不合法' }).nullable(),
  difficulty: difficultySchema.nullable(),
  count: z.number().int().min(1, { error: '配额数量必须是正整数' }),
});

const paperGenerationSchema = z.object({
  mode: z.enum(['fixed', 'random', 'quota'], { error: '试卷生成方式不合法' }),
  bankIds: z.array(z.string().min(1)).min(1, { error: '至少需要指定一个题库' }),
  questionIds: z.array(z.string().min(1)).optional(),
  quotas: z.array(paperQuotaSchema).optional(),
  difficultyDistribution: z
    .object({
      1: z.number().int().min(0).optional(),
      2: z.number().int().min(0).optional(),
      3: z.number().int().min(0).optional(),
      4: z.number().int().min(0).optional(),
      5: z.number().int().min(0).optional(),
    })
    .optional(),
  requiredTags: z.array(z.string().min(1)).optional(),
  excludedTags: z.array(z.string().min(1)).optional(),
  shuffleQuestions: z.boolean(),
  shuffleOptions: z.boolean(),
  seed: z.string().nullable().optional(),
});

/* ============================================================
   III. 报名条件
   ============================================================ */

const eligibilitySchema = z.object({
  requirePrerequisite: z.boolean(),
  prerequisiteLevelIds: z.array(z.string().min(1)),
  requiredSpecialtyExamIds: z.array(z.string().min(1)).optional(),
  minPrerequisiteScore: z.number().min(0).nullable().optional(),
  minAttemptCount: z.number().int().min(0).nullable().optional(),
  requireStudyMaterial: z.boolean().optional(),
  studyMaterialIds: z.array(z.string().min(1)).optional(),
});

/* ============================================================
   IV. 单场考试规则
   ============================================================ */

const examRuleSchema = z
  .object({
    examId: z
      .string()
      .min(1, { error: 'examId 不能为空' })
      .regex(/^[A-Za-z0-9_-]+$/, { error: 'examId 只能包含字母、数字、下划线与连字符' }),
    title: z.string().min(1, { error: '考试名称不能为空' }),
    levelId: z.string().min(1, { error: 'levelId 不能为空' }),
    category: z.enum(EXAM_CATEGORIES, { error: '考试类别不合法' }),
    summary: z.string().min(1, { error: '考试定位说明不能为空' }),
    description: z.string().min(1, { error: '考试说明不能为空' }),
    instructions: z.array(z.string().min(1)).min(1, { error: '考前须知至少需要一条' }),
    durationMinutes: z.number().int().min(1, { error: '考试时限至少为 1 分钟' }),
    questionCount: z.number().int().min(1, { error: '题目数量至少为 1' }),
    totalScore: z.number().positive({ error: '满分必须大于 0' }),
    passScore: z.number().min(0, { error: '及格线不能为负数' }),
    allowRetake: z.boolean(),
    retakeCooldownMinutes: z.number().int().min(0, { error: '补考间隔不能为负数' }),
    maxAttempts: z.number().int().min(1, { error: '最大考试次数至少为 1' }).nullable(),
    allowMock: z.boolean(),
    negativeScoring: z.boolean(),
    showAnswers: z.enum(['always', 'after_pass', 'never'], { error: '答案展示策略不合法' }),
    eligibility: eligibilitySchema,
    paper: paperGenerationSchema,
    grantsLevelId: z.string().min(1, { error: '授予等级不能为空' }),
    grantsCertifications: z.array(z.string().min(1)).optional(),
    specialty: z.string().nullable().optional(),
    mockOnly: z.boolean().optional(),
  })
  .superRefine((rule, ctx) => {
    // I. 及格线必须落在 (0, 满分] 区间
    if (rule.passScore <= 0) {
      ctx.addIssue({ code: 'custom', path: ['passScore'], message: '及格线必须大于 0' });
    }
    if (rule.passScore > rule.totalScore) {
      ctx.addIssue({
        code: 'custom',
        path: ['passScore'],
        message: `及格线（${rule.passScore}）不得高于满分（${rule.totalScore}），否则考试无法通过`,
      });
    }

    // II. 试卷生成配置与题目数量必须自洽
    if (rule.paper.mode === 'fixed') {
      const ids = rule.paper.questionIds ?? [];
      if (ids.length !== rule.questionCount) {
        ctx.addIssue({
          code: 'custom',
          path: ['paper', 'questionIds'],
          message: `固定题目列表模式需要 ${rule.questionCount} 道题目，实际提供 ${ids.length} 道`,
        });
      }
    }

    if (rule.paper.mode === 'quota') {
      const quotas = rule.paper.quotas ?? [];
      if (quotas.length === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['paper', 'quotas'],
          message: '配额抽题模式必须提供至少一条配额',
        });
      }
      const quotaTotal = quotas.reduce((sum, quota) => sum + quota.count, 0);
      if (quotaTotal !== rule.questionCount) {
        ctx.addIssue({
          code: 'custom',
          path: ['paper', 'quotas'],
          message: `配额数量合计 ${quotaTotal} 与题目数量 ${rule.questionCount} 不一致`,
        });
      }
    }

    if (rule.paper.mode === 'random' && rule.paper.difficultyDistribution) {
      const distributed = Object.values(rule.paper.difficultyDistribution).reduce(
        (sum, count) => sum + (count ?? 0),
        0,
      );
      if (distributed !== rule.questionCount) {
        ctx.addIssue({
          code: 'custom',
          path: ['paper', 'difficultyDistribution'],
          message: `难度分布合计 ${distributed} 与题目数量 ${rule.questionCount} 不一致`,
        });
      }
    }

    // III. 报名条件内部一致性
    if (rule.eligibility.requirePrerequisite && rule.eligibility.prerequisiteLevelIds.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['eligibility', 'prerequisiteLevelIds'],
        message: '声明需要前置等级时必须提供至少一个前置等级 ID',
      });
    }

    if (rule.eligibility.requireStudyMaterial) {
      const materials = rule.eligibility.studyMaterialIds ?? [];
      if (materials.length === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['eligibility', 'studyMaterialIds'],
          message: '声明需要完成学习材料时必须提供材料 ID 列表',
        });
      }
    }

    // IV. 补考开关与间隔的一致性
    if (!rule.allowRetake && rule.retakeCooldownMinutes > 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['retakeCooldownMinutes'],
        message: '不允许补考时不应设置补考间隔',
      });
    }
  });

/* ============================================================
   V. 规则集合
   ============================================================ */

const examRulesConfigSchema = z
  .object({
    schemaVersion: z
      .string()
      .min(1)
      .refine((value) => SUPPORTED_EXAM_RULES_SCHEMA_VERSIONS.includes(value), {
        error: `不支持的考试规则结构版本，当前支持：${SUPPORTED_EXAM_RULES_SCHEMA_VERSIONS.join('、')}`,
      }),
    rulesId: z.string().min(1, { error: 'rulesId 不能为空' }),
    version: z.string().min(1, { error: '规则版本号不能为空' }),
    title: z.string().min(1, { error: '规则标题不能为空' }),
    description: z.string().default(''),
    updatedAt: z.string().optional(),
    scoring: scoringPolicySchema,
    exams: z.array(examRuleSchema).min(1, { error: '至少需要配置一场考试' }),
  })
  .superRefine((config, ctx) => {
    // I. examId 唯一
    const ids = config.exams.map((exam) => exam.examId);
    const duplicated = ids.filter((id, index) => ids.indexOf(id) !== index);
    [...new Set(duplicated)].forEach((id) => {
      ctx.addIssue({
        code: 'custom',
        path: ['exams', ids.indexOf(id), 'examId'],
        message: `examId 重复：${id}`,
      });
    });
  });

/* ============================================================
   VI. 对外接口
   ============================================================ */

/** 考试规则校验结果 */
export interface ExamRulesValidationOutcome {
  ok: boolean;
  config: ExamRulesConfig | null;
  issues: ValidationIssue[];
  warnings: ValidationIssue[];
}

/** 生成考试规则的非阻断提示 */
function collectExamRulesWarnings(config: ExamRulesConfig): ValidationIssue[] {
  const warnings: ValidationIssue[] = [];

  config.exams.forEach((exam, index) => {
    // 1. 百分制归一化关闭时，及格线含义容易与满分口径混淆
    if (!config.scoring.normalizeToHundred && exam.passScore > exam.totalScore) {
      warnings.push({
        path: `exams[${index}].passScore`,
        message: '未启用百分制归一化时，及格线应与题目分值口径一致',
        code: 'warning_score_scale',
      });
    }

    // 2. 启用倒扣分但未设置默认倒扣分值
    if (exam.negativeScoring && config.scoring.defaultNegativeScore === 0) {
      warnings.push({
        path: `exams[${index}].negativeScoring`,
        message: '本场考试开启了倒扣分，但规则未设置默认倒扣分值，实际不会产生扣分',
        code: 'warning_negative_scoring_inert',
      });
    }

    // 3. 关闭答案展示会影响考生复盘体验，提示确认
    if (exam.showAnswers === 'never') {
      warnings.push({
        path: `exams[${index}].showAnswers`,
        message: '本场考试设置为不展示答案与解析，考生将无法在成绩页复盘',
        code: 'warning_answers_hidden',
      });
    }
  });

  return warnings;
}

/**
 * 校验考试规则配置
 *
 * @param raw - 由 JSON.parse 得到的原始数据
 * @returns 校验结果，含阻断性错误与提示性警告
 */
export function validateExamRules(raw: unknown): ExamRulesValidationOutcome {
  const parsed = examRulesConfigSchema.safeParse(raw);

  if (!parsed.success) {
    return { ok: false, config: null, issues: collectIssues(parsed.error), warnings: [] };
  }

  const config = parsed.data as ExamRulesConfig;
  return { ok: true, config, issues: [], warnings: collectExamRulesWarnings(config) };
}

/** 严格校验考试规则，返回统一 Result 结构 */
export function parseExamRulesStrict(raw: unknown): Result<ExamRulesConfig, ValidationFailure> {
  return parseWithSchema(examRulesConfigSchema, raw, '考试规则校验未通过') as Result<
    ExamRulesConfig,
    ValidationFailure
  >;
}

/** 在规则集合中查找指定考试 */
export function findExamRule(config: ExamRulesConfig, examId: string): ExamRule | null {
  return config.exams.find((exam) => exam.examId === examId) ?? null;
}
