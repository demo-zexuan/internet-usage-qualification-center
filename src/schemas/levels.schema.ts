/**
 * 资格等级配置校验 Schema
 *
 * I. 校验重点
 *
 * 1. levelId 与 order 均必须唯一，否则权限继承计算会出现歧义
 * 2. 必须恰好存在一个入门等级，作为新用户的默认展示等级
 * 3. 徽章色令牌名必须指向 index.css 中已定义的 --color-level-* 变量
 *
 * @module schemas/levels.schema
 * @author zexuan.peng
 * @created 2026-10-14
 */

import { z } from 'zod';

import type { Result } from '@/types/common';
import type { LevelsConfig } from '@/types/level';

import { collectIssues, parseWithSchema, type ValidationFailure, type ValidationIssue } from './validation';

/** 当前等级配置结构版本 */
export const LEVELS_SCHEMA_VERSION = '1.0.0';

/** 受支持的等级配置结构版本列表 */
export const SUPPORTED_LEVELS_SCHEMA_VERSIONS: readonly string[] = ['1.0.0'];

/** 可用的徽章色令牌名 */
export const LEVEL_BADGE_TOKENS = [
  'level-1',
  'level-2',
  'level-3',
  'level-4',
  'level-5',
  'level-6',
] as const;

const levelDefinitionSchema = z.object({
  levelId: z.string().regex(/^L\d+$/, { error: 'levelId 必须形如 L1、L2' }),
  order: z.number().int().min(0, { error: '等级序号必须为非负整数' }),
  nameZh: z.string().min(1, { error: '中文等级名称不能为空' }),
  nameEn: z.string().min(1, { error: '英文等级名称不能为空' }),
  shortName: z.string().min(1, { error: '等级代号不能为空' }),
  summary: z.string().min(1, { error: '等级定位说明不能为空' }),
  description: z.string().min(1, { error: '等级完整说明不能为空' }),
  badgeColorToken: z.enum(LEVEL_BADGE_TOKENS, { error: '徽章色令牌不合法' }),
  certificateTitle: z.string().min(1, { error: '证件标题不能为空' }),
  certificateMotto: z.string().min(1, { error: '证件题词不能为空' }),
  isEntryLevel: z.boolean(),
  isTemporary: z.boolean(),
  disclaimer: z.string().min(1, { error: '等级免责声明不能为空' }),
});

const levelsConfigSchema = z
  .object({
    schemaVersion: z
      .string()
      .min(1)
      .refine((value) => SUPPORTED_LEVELS_SCHEMA_VERSIONS.includes(value), {
        error: `不支持的等级配置结构版本，当前支持：${SUPPORTED_LEVELS_SCHEMA_VERSIONS.join('、')}`,
      }),
    configId: z.string().min(1, { error: 'configId 不能为空' }),
    version: z.string().min(1, { error: '配置版本号不能为空' }),
    title: z.string().min(1, { error: '配置标题不能为空' }),
    description: z.string().default(''),
    updatedAt: z.string().optional(),
    levels: z.array(levelDefinitionSchema).min(1, { error: '至少需要定义一个等级' }),
  })
  .superRefine((config, ctx) => {
    // I. levelId 唯一
    const ids = config.levels.map((level) => level.levelId);
    const duplicatedIds = ids.filter((id, index) => ids.indexOf(id) !== index);
    [...new Set(duplicatedIds)].forEach((id) => {
      ctx.addIssue({
        code: 'custom',
        path: ['levels', ids.indexOf(id), 'levelId'],
        message: `levelId 重复：${id}`,
      });
    });

    // II. order 唯一
    const orders = config.levels.map((level) => level.order);
    const duplicatedOrders = orders.filter((order, index) => orders.indexOf(order) !== index);
    [...new Set(duplicatedOrders)].forEach((order) => {
      ctx.addIssue({
        code: 'custom',
        path: ['levels', orders.indexOf(order), 'order'],
        message: `等级序号重复：${order}`,
      });
    });

    // III. 必须恰好一个入门等级
    const entryLevels = config.levels.filter((level) => level.isEntryLevel);
    if (entryLevels.length !== 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['levels'],
        message: `必须且只能有一个入门等级（isEntryLevel 为 true），当前有 ${entryLevels.length} 个`,
      });
    }

    // IV. 必须恰好一个临时状态等级
    const temporaryLevels = config.levels.filter((level) => level.isTemporary);
    if (temporaryLevels.length > 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['levels'],
        message: `临时状态等级最多只能有一个，当前有 ${temporaryLevels.length} 个`,
      });
    }
  });

/** 等级配置校验结果 */
export interface LevelsValidationOutcome {
  ok: boolean;
  config: LevelsConfig | null;
  issues: ValidationIssue[];
  warnings: ValidationIssue[];
}

/**
 * 校验等级配置
 *
 * @param raw - 由 JSON.parse 得到的原始数据
 */
export function validateLevels(raw: unknown): LevelsValidationOutcome {
  const parsed = levelsConfigSchema.safeParse(raw);

  if (!parsed.success) {
    return { ok: false, config: null, issues: collectIssues(parsed.error), warnings: [] };
  }

  const config = parsed.data as LevelsConfig;
  const warnings: ValidationIssue[] = [];

  // 等级序号应逐级递增 1，否则界面上会出现看似缺失的等级
  const sortedOrders = [...config.levels].map((level) => level.order).sort((a, b) => a - b);
  sortedOrders.forEach((order, index) => {
    if (index === 0) {
      return;
    }
    const previous = sortedOrders[index - 1] ?? order;
    if (order !== previous + 1) {
      warnings.push({
        path: 'levels',
        message: `等级序号不连续：${previous} 之后为 ${order}，期望 ${previous + 1}`,
        code: 'warning_non_contiguous_order',
      });
    }
  });

  return { ok: true, config, issues: [], warnings };
}

/** 严格校验等级配置，返回统一 Result 结构 */
export function parseLevelsStrict(raw: unknown): Result<LevelsConfig, ValidationFailure> {
  return parseWithSchema(levelsConfigSchema, raw, '等级配置校验未通过') as Result<
    LevelsConfig,
    ValidationFailure
  >;
}
