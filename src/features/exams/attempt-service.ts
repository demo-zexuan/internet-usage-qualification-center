/**
 * 考试过程服务
 *
 * I. 统一结算路径
 *
 * 1. 主动交卷、超时自动交卷与恢复考试三种情况全部经由 `finalizeAttempt` 结算，
 *    保证判分口径、幂等性与审计记录完全一致
 * 2. 结算后考试状态变为 submitted，答卷不可再修改
 *
 * II. 幂等性
 *
 * 1. 重复交卷不会重新判分，也不会覆盖首次结算结果
 * 2. 进行中的考试重复「开始」会返回同一条记录，不会产生并列的两场考试
 *
 * III. 自动保存
 *
 * 1. 每次保存都会同步剩余时间与当前题号，刷新或关闭浏览器后可精确恢复
 * 2. 保存失败（例如超出配额）不会中断答题，但会在审计记录中留下痕迹
 *
 * @module features/exams/attempt-service
 * @author zexuan.peng
 * @created 2026-10-14
 */

import type { AppError, Result } from '@/types/common';
import type {
  ExamAttempt,
  ExamMode,
  ExamRulesConfig,
  SubmitReason,
} from '@/types/exam';
import type { LevelsConfig } from '@/types/level';
import type { QuestionBankRecord } from '@/types/question';

import { createAttemptId } from '@/utils/id';
import { gradeAttempt } from '@/features/grading/engine';
import { db, recordAuditEvent } from '@/services/database';

import { checkExamEligibility } from './eligibility';
import { buildExamPaper } from './paper-builder';

/** 开考输入 */
export interface StartAttemptInput {
  examId: string;
  mode: ExamMode;
  userId: string;
  rulesConfig: ExamRulesConfig;
  /** 等级配置，用于报名条件中的前置等级判定 */
  levels: LevelsConfig;
  banks: QuestionBankRecord[];
  /** 已通过的考试 ID 集合，用于报名条件判定 */
  passedExamIds: Set<string>;
  /** 该档案的正式考试记录，用于报名条件与补考判定 */
  officialAttempts: ExamAttempt[];
  /** 该档案的全部考试记录，用于统计累计次数 */
  allAttempts: ExamAttempt[];
  /** 当前有效等级序号 */
  effectiveLevelOrder: number;
  /** 学习材料完成情况 */
  studyMaterialProgress: Record<string, number>;
  /** 指定随机种子，便于测试复现 */
  seed?: string;
}

/** 开考结果 */
export interface StartAttemptOutcome {
  attempt: ExamAttempt;
  /** 是否为恢复既有进行中考试 */
  resumed: boolean;
}

/** 进度保存输入 */
export interface SaveProgressInput {
  attemptId: string;
  answers?: Record<string, string[]>;
  flaggedQuestionIds?: string[];
  currentIndex?: number;
}

/**
 * 开始一场考试
 *
 * 1. 正式考试需要先通过报名资格判定；模拟考试免除报名条件，但仍需题库充足
 * 2. 同一场考试已有进行中的记录时直接返回该记录，避免重复开考
 */
export async function startExamAttempt(
  input: StartAttemptInput,
): Promise<Result<StartAttemptOutcome, AppError>> {
  const rule = input.rulesConfig.exams.find((exam) => exam.examId === input.examId);

  if (!rule) {
    return {
      ok: false,
      error: {
        code: 'EXAM_NOT_FOUND',
        message: '指定的考试不存在。',
        hint: '请返回报名页重新选择考试。',
      },
    };
  }

  if (input.mode === 'mock' && !rule.allowMock) {
    return {
      ok: false,
      error: {
        code: 'EXAM_NOT_FOUND',
        message: '本场考试未开放模拟考试。',
        hint: '请直接参加正式考试。',
      },
    };
  }

  try {
    // I. 复用进行中的考试，避免并列产生多场未完成考试
    const existing = await db.examAttempts
      .where('userId')
      .equals(input.userId)
      .filter(
        (attempt) =>
          attempt.examId === input.examId &&
          attempt.mode === input.mode &&
          attempt.status === 'in_progress',
      )
      .first();

    if (existing) {
      await recordAuditEvent({
        type: 'exam_resumed',
        userId: input.userId,
        message: `恢复未完成的考试「${existing.examTitle}」`,
        metadata: { attemptId: existing.attemptId, examId: input.examId },
      });
      return { ok: true, value: { attempt: existing, resumed: true } };
    }

    // II. 正式考试校验报名资格
    if (input.mode === 'official') {
      const eligibility = checkExamEligibility({
        rule,
        levels: input.levels,
        effectiveLevelOrder: input.effectiveLevelOrder,
        officialAttempts: input.officialAttempts.filter((attempt) => attempt.examId === input.examId),
        passedExamIds: input.passedExamIds,
        totalOfficialAttemptCount: input.officialAttempts.length,
        studyMaterialProgress: input.studyMaterialProgress,
      });

      if (!eligibility.eligible) {
        return {
          ok: false,
          error: {
            code: 'PREREQUISITE_NOT_MET',
            message: '尚未满足本场考试的报名条件，无法开始正式考试。',
            hint: '可先参加模拟考试进行练习。',
            details: eligibility.reasons,
          },
        };
      }
    }

    // III. 生成试卷快照
    const paper = buildExamPaper({
      rule,
      rulesConfig: input.rulesConfig,
      banks: input.banks,
      mode: input.mode,
      seed: input.seed,
    });

    if (!paper.ok) {
      return { ok: false, error: paper.error };
    }

    // IV. 创建考试记录
    const startedAt = Date.now();
    const durationMs = rule.durationMinutes * 60 * 1000;

    const attempt: ExamAttempt = {
      schemaVersion: '1.0.0',
      attemptId: createAttemptId(),
      userId: input.userId,
      examId: rule.examId,
      examTitle: rule.title,
      levelId: rule.levelId,
      mode: input.mode,
      status: 'in_progress',
      paper: paper.value,
      answers: {},
      flaggedQuestionIds: [],
      currentIndex: 0,
      startedAt,
      expiresAt: startedAt + durationMs,
      remainingMs: durationMs,
      lastSavedAt: startedAt,
      submittedAt: null,
      submitReason: null,
      result: null,
      certificateId: null,
      durationMs: null,
      createdAt: startedAt,
      updatedAt: startedAt,
    };

    await db.examAttempts.put(attempt);

    await recordAuditEvent({
      type: 'exam_started',
      userId: input.userId,
      message: `开始${input.mode === 'mock' ? '模拟' : '正式'}考试「${rule.title}」`,
      metadata: { attemptId: attempt.attemptId, examId: rule.examId, mode: input.mode },
    });

    return { ok: true, value: { attempt, resumed: false } };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      error: {
        code: 'DATABASE_INIT_FAILED',
        message: '考试记录写入本地数据库失败，考试无法开始。',
        hint: '请检查浏览器是否允许本站点使用本地存储。',
        details: [detail],
      },
    };
  }
}

/** 按 ID 读取考试记录 */
export async function getAttempt(attemptId: string): Promise<ExamAttempt | null> {
  const attempt = await db.examAttempts.get(attemptId);
  return attempt ?? null;
}

/** 列出某档案的全部考试记录，按开始时间倒序 */
export async function listAttempts(userId: string): Promise<ExamAttempt[]> {
  const attempts = await db.examAttempts.where('userId').equals(userId).toArray();
  return attempts.sort((a, b) => b.startedAt - a.startedAt);
}

/**
 * 保存答题进度
 *
 * 已交卷的考试拒绝写入，保证正式考试结束后答卷不可修改。
 */
export async function saveAttemptProgress(
  input: SaveProgressInput,
): Promise<Result<ExamAttempt, AppError>> {
  const attempt = await getAttempt(input.attemptId);

  if (!attempt) {
    return {
      ok: false,
      error: {
        code: 'ATTEMPT_NOT_FOUND',
        message: '考试记录不存在，答题进度无法保存。',
        hint: '该记录可能已被清除，请返回报名页重新开始考试。',
      },
    };
  }

  // I. 已结算的考试不允许再修改答案
  if (attempt.status !== 'in_progress') {
    return { ok: true, value: attempt };
  }

  const now = Date.now();
  const updated: ExamAttempt = {
    ...attempt,
    answers: input.answers ?? attempt.answers,
    flaggedQuestionIds: input.flaggedQuestionIds ?? attempt.flaggedQuestionIds,
    currentIndex: input.currentIndex ?? attempt.currentIndex,
    remainingMs: Math.max(0, attempt.expiresAt - now),
    lastSavedAt: now,
    updatedAt: now,
  };

  try {
    await db.examAttempts.put(updated);
    return { ok: true, value: updated };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      error: {
        code: 'DATABASE_INIT_FAILED',
        message: '答题进度保存失败，答案仍保留在当前页面中。',
        hint: '请检查浏览器存储空间后重试，避免直接关闭页面。',
        details: [detail],
      },
    };
  }
}

/** 判断考试是否已超时 */
export function isAttemptExpired(attempt: ExamAttempt, now = Date.now()): boolean {
  return attempt.status === 'in_progress' && now >= attempt.expiresAt;
}

/** 计算剩余毫秒数 */
export function getRemainingMs(attempt: ExamAttempt, now = Date.now()): number {
  return Math.max(0, attempt.expiresAt - now);
}

/**
 * 结算考试
 *
 * 1. 幂等：已结算的考试直接返回既有记录，不重新判分
 * 2. 主动交卷、超时自动交卷与恢复结算共用本函数
 *
 * @param attemptId - 考试记录 ID
 * @param reason - 交卷原因
 */
export async function finalizeAttempt(
  attemptId: string,
  reason: SubmitReason,
): Promise<Result<ExamAttempt, AppError>> {
  const attempt = await getAttempt(attemptId);

  if (!attempt) {
    return {
      ok: false,
      error: {
        code: 'ATTEMPT_NOT_FOUND',
        message: '考试记录不存在，无法交卷。',
        hint: '该记录可能已被清除，请返回报名页重新开始考试。',
      },
    };
  }

  // I. 幂等：已结算直接返回，不重复判分
  if (attempt.status !== 'in_progress') {
    return { ok: true, value: attempt };
  }

  try {
    const now = Date.now();
    const result = gradeAttempt(attempt);

    const finalized: ExamAttempt = {
      ...attempt,
      status: 'submitted',
      submittedAt: now,
      submitReason: reason,
      remainingMs: 0,
      durationMs: Math.max(0, Math.min(now, attempt.expiresAt) - attempt.startedAt),
      result,
      updatedAt: now,
      lastSavedAt: now,
    };

    await db.examAttempts.put(finalized);

    await recordAuditEvent({
      type: reason === 'user' ? 'exam_submitted' : 'exam_auto_submitted',
      userId: attempt.userId,
      message:
        reason === 'user'
          ? `提交试卷「${attempt.examTitle}」，得分 ${result.score} 分`
          : `「${attempt.examTitle}」因超时自动交卷，得分 ${result.score} 分`,
      metadata: {
        attemptId,
        examId: attempt.examId,
        mode: attempt.mode,
        score: result.score,
        passed: result.passed,
        reason,
      },
    });

    return { ok: true, value: finalized };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      error: {
        code: 'DATABASE_INIT_FAILED',
        message: '交卷结算失败，考试记录未能更新。',
        hint: '请重试交卷；若持续失败，请检查浏览器存储空间。',
        details: [detail],
      },
    };
  }
}

/**
 * 超时自动结算
 *
 * 用于进入答题页或成绩页时补做超时结算，保证任何路径下都能得到确定的结果。
 */
export async function finalizeIfExpired(attemptId: string): Promise<Result<ExamAttempt, AppError>> {
  const attempt = await getAttempt(attemptId);

  if (!attempt) {
    return {
      ok: false,
      error: {
        code: 'ATTEMPT_NOT_FOUND',
        message: '考试记录不存在。',
        hint: '请返回报名页重新选择考试。',
      },
    };
  }

  if (!isAttemptExpired(attempt)) {
    return { ok: true, value: attempt };
  }

  return finalizeAttempt(attemptId, 'timeout');
}

/** 放弃进行中的考试 */
export async function abandonAttempt(attemptId: string): Promise<Result<ExamAttempt, AppError>> {
  const attempt = await getAttempt(attemptId);

  if (!attempt) {
    return {
      ok: false,
      error: {
        code: 'ATTEMPT_NOT_FOUND',
        message: '考试记录不存在。',
      },
    };
  }

  if (attempt.status !== 'in_progress') {
    return { ok: true, value: attempt };
  }

  const updated: ExamAttempt = {
    ...attempt,
    status: 'abandoned',
    submittedAt: Date.now(),
    submitReason: 'manual_reset',
    remainingMs: 0,
    updatedAt: Date.now(),
  };

  await db.examAttempts.put(updated);

  await recordAuditEvent({
    type: 'exam_abandoned',
    userId: attempt.userId,
    message: `放弃未完成的考试「${attempt.examTitle}」`,
    metadata: { attemptId, examId: attempt.examId },
  });

  return { ok: true, value: updated };
}

/** 查找某档案进行中的全部考试 */
export async function listInProgressAttempts(userId: string): Promise<ExamAttempt[]> {
  const attempts = await db.examAttempts
    .where('userId')
    .equals(userId)
    .filter((attempt) => attempt.status === 'in_progress')
    .toArray();

  return attempts.sort((a, b) => b.startedAt - a.startedAt);
}

/** 统计某场考试的正式考试次数 */
export async function countOfficialAttempts(userId: string, examId: string): Promise<number> {
  return db.examAttempts
    .where('userId')
    .equals(userId)
    .filter((attempt) => attempt.examId === examId && attempt.mode === 'official')
    .count();
}
