/**
 * 配置服务
 *
 * I. 数据来源优先级
 *
 * 1. 题库与考试规则以 IndexedDB 中的记录为准，支持用户导入与恢复内置
 * 2. 等级、权限、证件模板、公告、学习材料为只读内置配置，随构建产物分发
 * 3. 首次运行时自动将内置题库与内置规则写入数据库，使用户可见、可导出、可恢复
 *
 * II. 导入安全
 *
 * 1. 导入前先完整解析与校验，校验失败时直接返回错误，绝不触碰现有有效数据
 * 2. 只有校验通过的数据才会写入数据库
 *
 * @module features/config/service
 * @author zexuan.peng
 * @created 2026-10-14
 */

import { computeQuestionBankStats, validateExamRules, validateQuestionBank } from '@/schemas';
import type { QuestionBankValidationOutcome, ValidationIssue } from '@/schemas';
import type { AppError, DataSource, Result } from '@/types/common';
import type { ExamRulesConfig, ExamRulesRecord } from '@/types/exam';
import type { QuestionBank, QuestionBankRecord } from '@/types/question';

import { db, getSetting, recordAuditEvent, setSetting } from '@/services/database';

import { getSkippedBuiltinBanks, loadBuiltinConfigs } from './builtin';

/** 题库导入结果 */
export interface BankImportOutcome {
  bankId: string;
  title: string;
  questionCount: number;
  /** 校验通过但需要作者注意的提示 */
  warnings: { path: string; message: string }[];
  /** 是否为覆盖同 ID 题库 */
  replaced: boolean;
}

/** 规则导入结果 */
export interface RulesImportOutcome {
  rulesId: string;
  version: string;
  examCount: number;
  warnings: ValidationIssue[];
  /** 是否为覆盖同 ID 的既有规则 */
  replaced: boolean;
}

/**
 * 首次运行播种：写入内置题库与内置考试规则
 *
 * 1. 已存在记录的题库不会被覆盖，避免冲掉用户导入的版本
 * 2. 幂等：重复调用不会产生重复记录
 */
export async function ensureConfigSeeded(): Promise<Result<void, AppError>> {
  const builtin = loadBuiltinConfigs();
  if (!builtin.ok) {
    return { ok: false, error: builtin.error };
  }

  try {
    const now = Date.now();

    // I. 播种内置题库
    const existingBanks = new Set((await db.questionBanks.toArray()).map((bank) => bank.bankId));
    const newBanks: QuestionBankRecord[] = builtin.value.questionBanks
      .filter((bank) => !existingBanks.has(bank.bankId))
      .map((bank) => ({
        ...bank,
        source: 'builtin' as const,
        importedAt: now,
        rawJson: JSON.stringify(bank, null, 2),
        stats: computeQuestionBankStats(bank),
      }));

    if (newBanks.length > 0) {
      await db.questionBanks.bulkPut(newBanks);
    }

    // II. 播种内置考试规则
    const rulesCount = await db.examRules.count();
    if (rulesCount === 0) {
      const rulesRecord: ExamRulesRecord = {
        ...builtin.value.examRules,
        source: 'builtin',
        importedAt: now,
        rawJson: JSON.stringify(builtin.value.examRules, null, 2),
        isActive: true,
      };
      await db.examRules.put(rulesRecord);
    }

    // III. 初始化启用项设置
    const activeBankIds = await getSetting('activeBankIds');
    if (!activeBankIds || activeBankIds.length === 0) {
      const allBankIds = (await db.questionBanks.toArray()).map((bank) => bank.bankId);
      await setSetting('activeBankIds', allBankIds);
    }

    const activeRulesId = await getSetting('activeRulesId');
    if (!activeRulesId) {
      await setSetting('activeRulesId', builtin.value.examRules.rulesId);
    }

    return { ok: true, value: undefined };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      error: {
        code: 'DATABASE_INIT_FAILED',
        message: '初始化内置题库与考试规则失败。',
        hint: '请重新加载页面；若问题持续存在，请清除本站点数据后重试。',
        details: [detail],
      },
    };
  }
}

/* ============================================================
   I. 考试规则
   ============================================================ */

/** 载入当前启用的考试规则 */
export async function loadActiveRulesConfig(): Promise<Result<ExamRulesConfig, AppError>> {
  const builtin = loadBuiltinConfigs();
  if (!builtin.ok) {
    return { ok: false, error: builtin.error };
  }

  try {
    const activeRulesId = (await getSetting('activeRulesId')) ?? builtin.value.examRules.rulesId;
    const record = await db.examRules.get(activeRulesId);

    if (record) {
      return { ok: true, value: stripRulesRecord(record) };
    }

    // 启用的规则不存在时回退到内置规则，并修复设置，避免界面长期处于异常状态
    await setSetting('activeRulesId', builtin.value.examRules.rulesId);
    return { ok: true, value: builtin.value.examRules };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      error: {
        code: 'EXAM_RULE_INVALID',
        message: '读取本地考试规则失败，已回退到内置规则。',
        hint: '可在「题库管理」页面恢复内置考试规则。',
        details: [detail],
      },
    };
  }
}

/** 去掉落库附加字段，还原为纯配置对象 */
function stripRulesRecord(record: ExamRulesRecord): ExamRulesConfig {
  const { source: _source, importedAt: _importedAt, rawJson: _rawJson, isActive: _isActive, ...config } =
    record;
  return config;
}

/** 列出全部本地考试规则配置 */
export async function listRulesRecords(): Promise<ExamRulesRecord[]> {
  const records = await db.examRules.toArray();
  return records.sort((a, b) => b.importedAt - a.importedAt);
}

/** 导入考试规则配置 */
export async function importExamRules(rawText: string): Promise<Result<RulesImportOutcome, AppError>> {
  // I. 解析
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知解析错误';
    return {
      ok: false,
      error: {
        code: 'IMPORT_VALIDATION_FAILED',
        message: '考试规则文件不是合法的 JSON 文本，导入已取消。',
        hint: '请确认文件内容为完整的 JSON，且未包含注释或多余逗号。',
        details: [message],
      },
    };
  }

  // II. 校验：失败时不写入任何数据
  const outcome = validateExamRules(parsed);
  if (!outcome.ok || !outcome.config) {
    await recordAuditEvent({
      type: 'rules_import_failed',
      userId: null,
      message: '导入考试规则失败：校验未通过',
      metadata: { issueCount: outcome.issues.length },
    });

    return {
      ok: false,
      error: {
        code: 'IMPORT_VALIDATION_FAILED',
        message: '考试规则未通过校验，现有有效规则保持不变。',
        hint: '请按错误列表逐项修正后重新导入。',
        details: outcome.issues.map((issue) => `${issue.path}：${issue.message}`),
      },
    };
  }

  // III. 写入
  try {
    const config = outcome.config;
    const existing = await db.examRules.get(config.rulesId);

    const record: ExamRulesRecord = {
      ...config,
      source: 'imported',
      importedAt: Date.now(),
      rawJson: rawText,
      isActive: true,
    };

    await db.examRules.put(record);
    await setSetting('activeRulesId', config.rulesId);

    await recordAuditEvent({
      type: 'rules_imported',
      userId: null,
      message: `导入考试规则「${config.title}」（${config.exams.length} 场考试）`,
      metadata: { rulesId: config.rulesId, version: config.version },
    });

    return {
      ok: true,
      value: {
        rulesId: config.rulesId,
        version: config.version,
        examCount: config.exams.length,
        warnings: outcome.warnings,
        replaced: Boolean(existing),
      },
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      error: {
        code: 'DATABASE_INIT_FAILED',
        message: '考试规则写入本地数据库失败。',
        hint: '请检查浏览器是否允许本站点使用本地存储。',
        details: [detail],
      },
    };
  }
}

/** 导出当前启用的考试规则 JSON 文本 */
export async function exportExamRules(rulesId?: string): Promise<Result<string, AppError>> {
  const config = await loadActiveRulesConfig();
  if (!config.ok) {
    return { ok: false, error: config.error };
  }

  const target = rulesId ?? config.value.rulesId;
  const record = await db.examRules.get(target);

  if (record) {
    return { ok: true, value: record.rawJson };
  }

  return { ok: true, value: JSON.stringify(config.value, null, 2) };
}

/** 恢复内置考试规则 */
export async function restoreBuiltinExamRules(): Promise<Result<void, AppError>> {
  const builtin = loadBuiltinConfigs();
  if (!builtin.ok) {
    return { ok: false, error: builtin.error };
  }

  try {
    const record: ExamRulesRecord = {
      ...builtin.value.examRules,
      source: 'restored',
      importedAt: Date.now(),
      rawJson: JSON.stringify(builtin.value.examRules, null, 2),
      isActive: true,
    };

    await db.examRules.put(record);
    await setSetting('activeRulesId', builtin.value.examRules.rulesId);

    await recordAuditEvent({
      type: 'rules_restored',
      userId: null,
      message: '恢复内置考试规则配置',
    });

    return { ok: true, value: undefined };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      error: {
        code: 'DATABASE_INIT_FAILED',
        message: '恢复内置考试规则失败。',
        details: [detail],
      },
    };
  }
}

/* ============================================================
   II. 题库
   ============================================================ */

/** 列出本地全部题库记录 */
export async function listBankRecords(): Promise<QuestionBankRecord[]> {
  const records = await db.questionBanks.toArray();
  return records.sort((a, b) => a.bankId.localeCompare(b.bankId));
}

/** 载入当前启用的题库 */
export async function loadActiveBanks(): Promise<QuestionBankRecord[]> {
  const activeIds = await getSetting('activeBankIds');
  const all = await listBankRecords();

  if (!activeIds || activeIds.length === 0) {
    return all;
  }

  const active = all.filter((bank) => activeIds.includes(bank.bankId));
  // 启用的题库全部被删除时回退到全部题库，避免应用进入无题可用的死状态
  return active.length > 0 ? active : all;
}

/** 设置启用的题库 */
export async function setActiveBankIds(bankIds: string[]): Promise<void> {
  await setSetting('activeBankIds', bankIds);
}

/** 导入题库 */
export async function importQuestionBank(
  rawText: string,
  options: { source?: DataSource } = {},
): Promise<Result<BankImportOutcome, AppError>> {
  // I. 解析
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知解析错误';
    await recordAuditEvent({
      type: 'bank_import_failed',
      userId: null,
      message: '导入题库失败：JSON 解析错误',
    });
    return {
      ok: false,
      error: {
        code: 'IMPORT_VALIDATION_FAILED',
        message: '题库文件不是合法的 JSON 文本，导入已取消。',
        hint: '请确认文件内容为完整 JSON，且未包含注释、尾随逗号或多余的 BOM 字符。',
        details: [message],
      },
    };
  }

  // II. 校验：失败时保持现有有效题库不变
  const outcome: QuestionBankValidationOutcome = validateQuestionBank(parsed);
  if (!outcome.ok || !outcome.bank) {
    await recordAuditEvent({
      type: 'bank_import_failed',
      userId: null,
      message: '导入题库失败：校验未通过',
      metadata: { issueCount: outcome.issues.length },
    });

    return {
      ok: false,
      error: {
        code: 'IMPORT_VALIDATION_FAILED',
        message: '题库未通过校验，当前正在使用的题库保持不变。',
        hint: '请按错误列表中的字段路径逐项修正后重新导入。',
        details: outcome.issues.map((issue) => `${issue.path}：${issue.message}`),
      },
    };
  }

  // III. 写入
  try {
    const bank: QuestionBank = outcome.bank;
    const existing = await db.questionBanks.get(bank.bankId);

    const record: QuestionBankRecord = {
      ...bank,
      source: options.source ?? 'imported',
      importedAt: Date.now(),
      rawJson: rawText,
      stats: computeQuestionBankStats(bank),
    };

    await db.questionBanks.put(record);

    // 新导入的题库自动纳入启用列表，避免导入后「看不见」
    const activeIds = (await getSetting('activeBankIds')) ?? [];
    if (!activeIds.includes(bank.bankId)) {
      await setSetting('activeBankIds', [...activeIds, bank.bankId]);
    }

    await recordAuditEvent({
      type: 'bank_imported',
      userId: null,
      message: `导入题库「${bank.title}」（${bank.questions.length} 题）`,
      metadata: { bankId: bank.bankId, version: bank.version, replaced: Boolean(existing) },
    });

    return {
      ok: true,
      value: {
        bankId: bank.bankId,
        title: bank.title,
        questionCount: bank.questions.length,
        warnings: outcome.warnings,
        replaced: Boolean(existing),
      },
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      error: {
        code: 'DATABASE_INIT_FAILED',
        message: '题库写入本地数据库失败，当前正在使用的题库保持不变。',
        hint: '请检查浏览器是否允许本站点使用本地存储。',
        details: [detail],
      },
    };
  }
}

/** 导出指定题库的原始 JSON 文本 */
export async function exportQuestionBank(bankId: string): Promise<Result<string, AppError>> {
  const record = await db.questionBanks.get(bankId);

  if (!record) {
    return {
      ok: false,
      error: {
        code: 'QUESTION_BANK_EMPTY',
        message: '指定的题库不存在，无法导出。',
        hint: '请刷新题库列表后重试。',
      },
    };
  }

  await recordAuditEvent({
    type: 'bank_exported',
    userId: null,
    message: `导出题库「${record.title}」`,
    metadata: { bankId },
  });

  return { ok: true, value: record.rawJson };
}

/** 删除指定题库 */
export async function deleteQuestionBank(bankId: string): Promise<Result<void, AppError>> {
  try {
    await db.questionBanks.delete(bankId);
    const activeIds = (await getSetting('activeBankIds')) ?? [];
    await setSetting(
      'activeBankIds',
      activeIds.filter((id) => id !== bankId),
    );
    return { ok: true, value: undefined };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      error: {
        code: 'DATABASE_INIT_FAILED',
        message: '删除题库失败。',
        details: [detail],
      },
    };
  }
}

/** 恢复全部内置题库 */
export async function restoreBuiltinBanks(): Promise<Result<number, AppError>> {
  const builtin = loadBuiltinConfigs();
  if (!builtin.ok) {
    return { ok: false, error: builtin.error };
  }

  try {
    const now = Date.now();
    const records: QuestionBankRecord[] = builtin.value.questionBanks.map((bank) => ({
      ...bank,
      source: 'restored' as const,
      importedAt: now,
      rawJson: JSON.stringify(bank, null, 2),
      stats: computeQuestionBankStats(bank),
    }));

    await db.questionBanks.bulkPut(records);
    await setSetting(
      'activeBankIds',
      records.map((record) => record.bankId),
    );

    await recordAuditEvent({
      type: 'bank_restored',
      userId: null,
      message: `恢复 ${records.length} 个内置题库`,
    });

    return { ok: true, value: records.length };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      error: {
        code: 'DATABASE_INIT_FAILED',
        message: '恢复内置题库失败。',
        details: [detail],
      },
    };
  }
}

/** 内置题库中校验失败被跳过的条目，供管理页面提示 */
export function listSkippedBuiltinBanks(): string[] {
  return getSkippedBuiltinBanks();
}
