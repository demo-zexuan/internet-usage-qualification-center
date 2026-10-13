/**
 * 内置配置载入
 *
 * I. 职责
 *
 * 1. 载入并校验随构建产物一同分发的 JSON 配置：等级、权限、证件模板、公告、学习材料
 * 2. 题库通过 `import.meta.glob` 自动发现，新增题库文件无需修改任何代码
 *
 * II. 校验策略
 *
 * 1. 内置配置在应用启动时统一校验，任何一项失败都视为致命错误并展示明确提示
 * 2. 校验失败的配置不会被部分使用，避免出现「一半配置生效」的中间状态
 *
 * @module features/config/builtin
 * @author zexuan.peng
 * @created 2026-10-14
 */

import announcementsJson from '@/data/announcements.json';
import certificateTemplateJson from '@/data/certificate-template.json';
import examRulesJson from '@/data/exam-rules.json';
import levelsJson from '@/data/levels.json';
import permissionsJson from '@/data/permissions.json';
import studyMaterialsJson from '@/data/study-materials.json';
import type { AnnouncementsConfig, StudyMaterialsConfig } from '@/types/settings';
import type { AppError, Result } from '@/types/common';
import type { CertificateTemplate } from '@/types/certificate';
import type { ExamRulesConfig } from '@/types/exam';
import type { LevelsConfig } from '@/types/level';
import type { PermissionsConfig } from '@/types/permission';
import type { QuestionBank } from '@/types/question';

import {
  validateAnnouncements,
  validateCertificateTemplate,
  validateExamRules,
  validateLevels,
  validatePermissions,
  validateQuestionBank,
  validateStudyMaterials,
} from '@/schemas';

/** 内置配置集合 */
export interface BuiltinConfigs {
  levels: LevelsConfig;
  permissions: PermissionsConfig;
  certificateTemplate: CertificateTemplate;
  announcements: AnnouncementsConfig;
  studyMaterials: StudyMaterialsConfig;
  /** 内置考试规则，作为首次运行时的初始配置 */
  examRules: ExamRulesConfig;
  /** 随构建产物分发的内置题库 */
  questionBanks: QuestionBank[];
}

/**
 * 自动发现内置题库文件
 *
 * 1. 仅匹配 `src/data/question-banks/` 下的顶层 JSON 文件
 * 2. 分片目录 `_parts/` 不会被匹配，因为它位于子目录中
 */
const questionBankModules = import.meta.glob<{ default: unknown }>(
  '../../data/question-banks/*.json',
  { eager: true },
);

/** 将校验错误汇总为致命错误 */
function toFatalError(
  source: string,
  summary: string,
  issues: { path: string; message: string }[],
): AppError {
  return {
    code: 'EXAM_RULE_INVALID',
    message: `内置配置「${source}」未通过校验，应用无法启动。`,
    hint: '这通常意味着配置文件被意外修改。请恢复 src/data/ 目录下的原始 JSON 文件后重新构建。',
    details: [`${summary}`, ...issues.map((issue) => `${issue.path}：${issue.message}`)],
  };
}

/** 已缓存的配置，避免重复校验 */
let cachedConfigs: BuiltinConfigs | null = null;

/**
 * 载入并校验全部内置配置
 *
 * @returns 成功时返回强类型配置集合；失败时返回致命错误
 */
export function loadBuiltinConfigs(): Result<BuiltinConfigs, AppError> {
  if (cachedConfigs) {
    return { ok: true, value: cachedConfigs };
  }

  // I. 等级配置
  const levels = validateLevels(levelsJson as unknown);
  if (!levels.ok || !levels.config) {
    return { ok: false, error: toFatalError('levels.json', '等级配置校验未通过', levels.issues) };
  }

  // II. 权限配置
  const permissions = validatePermissions(permissionsJson as unknown);
  if (!permissions.ok || !permissions.config) {
    return {
      ok: false,
      error: toFatalError('permissions.json', '权限配置校验未通过', permissions.issues),
    };
  }

  // III. 证件模板
  const template = validateCertificateTemplate(certificateTemplateJson as unknown);
  if (!template.ok) {
    return {
      ok: false,
      error: toFatalError('certificate-template.json', '证件模板校验未通过', template.error.issues),
    };
  }

  // IV. 公告配置
  const announcements = validateAnnouncements(announcementsJson as unknown);
  if (!announcements.ok) {
    return {
      ok: false,
      error: toFatalError('announcements.json', '公告配置校验未通过', announcements.error.issues),
    };
  }

  // V. 学习材料配置
  const studyMaterials = validateStudyMaterials(studyMaterialsJson as unknown);
  if (!studyMaterials.ok) {
    return {
      ok: false,
      error: toFatalError(
        'study-materials.json',
        '学习材料配置校验未通过',
        studyMaterials.error.issues,
      ),
    };
  }

  // VI. 内置考试规则
  const examRules = validateExamRules(examRulesJson as unknown);
  if (!examRules.ok || !examRules.config) {
    return {
      ok: false,
      error: toFatalError('exam-rules.json', '考试规则配置校验未通过', examRules.issues),
    };
  }

  // VII. 内置题库：逐个校验，失败的题库被跳过并记录，不影响其他题库
  const questionBanks: QuestionBank[] = [];
  const skippedBanks: string[] = [];

  for (const [modulePath, module] of Object.entries(questionBankModules)) {
    const outcome = validateQuestionBank(module.default);
    if (outcome.ok && outcome.bank) {
      questionBanks.push(outcome.bank);
    } else {
      skippedBanks.push(
        `${modulePath}：${outcome.issues.map((issue) => `${issue.path} ${issue.message}`).join('；')}`,
      );
    }
  }

  if (questionBanks.length === 0) {
    return {
      ok: false,
      error: {
        code: 'QUESTION_BANK_EMPTY',
        message: '没有找到任何可用的内置题库，应用无法启动。',
        hint: '请确认 src/data/question-banks/ 目录下存在符合规范的题库 JSON 文件。',
        details: skippedBanks,
      },
    };
  }

  cachedConfigs = {
    levels: levels.config,
    permissions: permissions.config,
    certificateTemplate: template.value,
    announcements: announcements.value,
    studyMaterials: studyMaterials.value,
    examRules: examRules.config,
    questionBanks,
  };

  return { ok: true, value: cachedConfigs };
}

/** 清除内置配置缓存（仅测试使用） */
export function clearBuiltinConfigCache(): void {
  cachedConfigs = null;
}

/** 内置题库被跳过的原因，供题库管理页面展示 */
export function getSkippedBuiltinBanks(): string[] {
  const skipped: string[] = [];

  for (const [modulePath, module] of Object.entries(questionBankModules)) {
    const outcome = validateQuestionBank(module.default);
    if (!outcome.ok) {
      skipped.push(
        `${modulePath}：${outcome.issues.map((issue) => `${issue.path} ${issue.message}`).join('；')}`,
      );
    }
  }

  return skipped;
}
