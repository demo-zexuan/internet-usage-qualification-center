/**
 * 权限配置校验 Schema
 *
 * I. 校验重点
 *
 * 1. permissionId 全局唯一，否则权限判定结果不确定
 * 2. requiredLevelOrder 必须为非负整数，0 表示无需任何资格
 * 3. 模拟权限必须提供免责声明，界面需要原样展示
 * 4. 声明了应用内入口的权限，路由必须以 / 开头
 *
 * @module schemas/permissions.schema
 * @author zexuan.peng
 * @created 2026-10-14
 */

import { z } from 'zod';

import type { Result } from '@/types/common';
import { PERMISSION_GROUPS } from '@/types/permission';
import type { PermissionsConfig } from '@/types/permission';

import { collectIssues, parseWithSchema, type ValidationFailure, type ValidationIssue } from './validation';

/** 当前权限配置结构版本 */
export const PERMISSIONS_SCHEMA_VERSION = '1.0.0';

/** 受支持的权限配置结构版本列表 */
export const SUPPORTED_PERMISSIONS_SCHEMA_VERSIONS: readonly string[] = ['1.0.0'];

const permissionDefinitionSchema = z.object({
  permissionId: z
    .string()
    .min(1, { error: '权限 ID 不能为空' })
    .regex(/^[a-z0-9_]+$/, { error: '权限 ID 只能包含小写字母、数字与下划线' }),
  group: z.enum(PERMISSION_GROUPS, { error: '权限分组不合法' }),
  name: z.string().min(1, { error: '权限名称不能为空' }),
  description: z.string().min(1, { error: '权限说明不能为空' }),
  unlockCondition: z.string().min(1, { error: '解锁条件说明不能为空' }),
  upgradeAdvice: z.string().min(1, { error: '升级建议不能为空' }),
  requiredLevelOrder: z.number().int().min(0, { error: '解锁所需等级序号必须为非负整数' }),
  grantedLevelIds: z.array(z.string().min(1)).optional(),
  requiredCertifications: z.array(z.string().min(1)).optional(),
  simulated: z.boolean(),
  route: z
    .string()
    .regex(/^\//, { error: '权限入口路由必须以 / 开头' })
    .nullable(),
  disclaimer: z.string().min(1, { error: '免责声明不能为空' }),
});

const permissionsConfigSchema = z
  .object({
    schemaVersion: z
      .string()
      .min(1)
      .refine((value) => SUPPORTED_PERMISSIONS_SCHEMA_VERSIONS.includes(value), {
        error: `不支持的权限配置结构版本，当前支持：${SUPPORTED_PERMISSIONS_SCHEMA_VERSIONS.join('、')}`,
      }),
    configId: z.string().min(1, { error: 'configId 不能为空' }),
    version: z.string().min(1, { error: '配置版本号不能为空' }),
    title: z.string().min(1, { error: '配置标题不能为空' }),
    description: z.string().default(''),
    updatedAt: z.string().optional(),
    globalDisclaimer: z.string().min(1, { error: '全局免责声明不能为空' }),
    permissions: z.array(permissionDefinitionSchema).min(1, { error: '至少需要定义一条权限' }),
  })
  .superRefine((config, ctx) => {
    // I. permissionId 唯一
    const ids = config.permissions.map((permission) => permission.permissionId);
    const duplicated = ids.filter((id, index) => ids.indexOf(id) !== index);
    [...new Set(duplicated)].forEach((id) => {
      ctx.addIssue({
        code: 'custom',
        path: ['permissions', ids.indexOf(id), 'permissionId'],
        message: `权限 ID 重复：${id}`,
      });
    });

    // II. 模拟权限必须说明其模拟性质
    config.permissions.forEach((permission, index) => {
      if (permission.simulated && permission.disclaimer.length < 10) {
        ctx.addIssue({
          code: 'custom',
          path: ['permissions', index, 'disclaimer'],
          message: '模拟权限的免责声明过于简略，需明确说明不产生真实网络权限',
        });
      }
    });
  });

/** 权限配置校验结果 */
export interface PermissionsValidationOutcome {
  ok: boolean;
  config: PermissionsConfig | null;
  issues: ValidationIssue[];
  warnings: ValidationIssue[];
}

/**
 * 校验权限配置
 *
 * @param raw - 由 JSON.parse 得到的原始数据
 */
export function validatePermissions(raw: unknown): PermissionsValidationOutcome {
  const parsed = permissionsConfigSchema.safeParse(raw);

  if (!parsed.success) {
    return { ok: false, config: null, issues: collectIssues(parsed.error), warnings: [] };
  }

  const config = parsed.data as PermissionsConfig;
  const warnings: ValidationIssue[] = [];

  // 所有权限都要求等级 1 以上时，临时浏览状态将没有任何可用功能
  const guestAccessible = config.permissions.filter(
    (permission) => permission.requiredLevelOrder === 0,
  );
  if (guestAccessible.length === 0) {
    warnings.push({
      path: 'permissions',
      message: '没有任何权限对未取得证件的临时状态开放，新用户进入应用后将无任何可用模拟功能',
      code: 'warning_no_guest_permission',
    });
  }

  return { ok: true, config, issues: [], warnings };
}

/** 严格校验权限配置，返回统一 Result 结构 */
export function parsePermissionsStrict(raw: unknown): Result<PermissionsConfig, ValidationFailure> {
  return parseWithSchema(permissionsConfigSchema, raw, '权限配置校验未通过') as Result<
    PermissionsConfig,
    ValidationFailure
  >;
}
