/**
 * 应用设置、公告与学习材料校验 Schema
 *
 * I. 存储边界
 *
 * 1. 应用设置保存在 IndexedDB 的 appSettings 表
 * 2. 公告与学习材料为内置配置文件，随构建产物一同分发
 *
 * @module schemas/settings.schema
 * @author zexuan.peng
 * @created 2026-10-14
 */

import { z } from 'zod';

import type { Result } from '@/types/common';
import type { AnnouncementsConfig, StudyMaterialsConfig } from '@/types/settings';

import { parseWithSchema, type ValidationFailure } from './validation';

/** 公告配置结构版本 */
export const ANNOUNCEMENTS_SCHEMA_VERSION = '1.0.0';
/** 学习材料配置结构版本 */
export const STUDY_MATERIALS_SCHEMA_VERSION = '1.0.0';

const announcementSchema = z.object({
  announcementId: z.string().min(1, { error: '公告 ID 不能为空' }),
  title: z.string().min(1, { error: '公告标题不能为空' }),
  department: z.string().min(1, { error: '发布科室不能为空' }),
  publishedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { error: '发布日期必须形如 2026-10-14' }),
  severity: z.enum(['info', 'notice', 'warning'], { error: '公告级别不合法' }),
  body: z.array(z.string().min(1)).min(1, { error: '公告正文至少一段' }),
  pinned: z.boolean().optional(),
});

const announcementsConfigSchema = z.object({
  schemaVersion: z.string().min(1),
  configId: z.string().min(1),
  version: z.string().min(1),
  title: z.string().min(1),
  announcements: z.array(announcementSchema).min(1, { error: '至少需要一条公告' }),
});

const studyMaterialSchema = z.object({
  materialId: z.string().min(1, { error: '材料 ID 不能为空' }),
  title: z.string().min(1, { error: '材料标题不能为空' }),
  route: z.string().regex(/^\//, { error: '材料入口路由必须以 / 开头' }),
  summary: z.string().min(1, { error: '材料摘要不能为空' }),
  body: z.array(z.string().min(1)).min(1, { error: '材料正文至少一段' }),
  references: z
    .array(z.object({ label: z.string().min(1), url: z.string().url({ error: '参考链接必须是合法 URL' }) }))
    .optional(),
  checkpoints: z.array(z.string().min(1)).min(1, { error: '材料至少需要一个自查问题' }),
  requiredLevelOrder: z.number().int().min(0, { error: '所需等级序号必须为非负整数' }),
});

const studyMaterialsConfigSchema = z.object({
  schemaVersion: z.string().min(1),
  configId: z.string().min(1),
  version: z.string().min(1),
  title: z.string().min(1),
  materials: z.array(studyMaterialSchema).min(1, { error: '至少需要一份学习材料' }),
});

/** 校验公告配置 */
export function validateAnnouncements(raw: unknown): Result<AnnouncementsConfig, ValidationFailure> {
  return parseWithSchema(announcementsConfigSchema, raw, '公告配置校验未通过') as Result<
    AnnouncementsConfig,
    ValidationFailure
  >;
}

/** 校验学习材料配置 */
export function validateStudyMaterials(raw: unknown): Result<StudyMaterialsConfig, ValidationFailure> {
  return parseWithSchema(studyMaterialsConfigSchema, raw, '学习材料配置校验未通过') as Result<
    StudyMaterialsConfig,
    ValidationFailure
  >;
}
