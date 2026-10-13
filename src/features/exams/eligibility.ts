/**
 * 考试报名资格判定
 *
 * I. 设计原则
 *
 * 1. 不满足条件时必须给出**具体原因**，而不是让按钮静默失效
 * 2. 同时给出已满足的条件，让考生知道还差什么、已经完成了什么
 * 3. 所有条件均来自考试规则配置，本模块不硬编码任何具体考试的参数
 *
 * II. 判定顺序
 *
 * 1. 前置等级 → 指定专项考试 → 前置考试最低分数 → 累计考试次数
 * 2. 学习材料完成情况 → 最大考试次数 → 是否允许补考 → 补考间隔
 *
 * @module features/exams/eligibility
 * @author zexuan.peng
 * @created 2026-10-14
 */

import type { EligibilityResult, ExamAttempt, ExamRule } from '@/types/exam';
import type { LevelsConfig } from '@/types/level';

import { findLevelById, satisfiesPrerequisite } from '@/features/levels/service';

/** 资格判定输入 */
export interface EligibilityInput {
  rule: ExamRule;
  levels: LevelsConfig;
  /** 当前有效等级序号（由有效证件推导） */
  effectiveLevelOrder: number;
  /** 该场考试的正式考试记录 */
  officialAttempts: ExamAttempt[];
  /** 已通过的考试 ID 集合（正式考试） */
  passedExamIds: Set<string>;
  /** 全部正式考试次数 */
  totalOfficialAttemptCount: number;
  /** 学习材料完成情况：材料 ID → 完成时间戳 */
  studyMaterialProgress: Record<string, number>;
  /** 当前时间戳，便于测试注入固定时间 */
  now?: number;
}

/** 计算某场考试的补考等待情况 */
export interface RetakeStatus {
  /** 是否可以立即报考 */
  canRetakeNow: boolean;
  /** 还需等待的分钟数 */
  waitMinutes: number;
  /** 是否已用尽考试次数 */
  exhausted: boolean;
}

/**
 * 计算补考状态
 *
 * 1. 已通过的考试再次报考属于「重新考试」，不受补考间隔限制
 * 2. 未通过时的等待时间从最近一次考试的交卷时间起算
 * 3. 规则声明不允许补考时，参加过正式考试即视为用尽机会
 */
export function computeRetakeStatus(rule: ExamRule, attempts: ExamAttempt[], now = Date.now()): RetakeStatus {
  const exhausted =
    rule.maxAttempts !== null && attempts.length >= rule.maxAttempts
      ? true
      : !rule.allowRetake && attempts.length > 0;

  if (exhausted || attempts.length === 0) {
    return { canRetakeNow: !exhausted, waitMinutes: 0, exhausted };
  }

  const sorted = [...attempts].sort((a, b) => b.startedAt - a.startedAt);
  const latest = sorted[0];
  if (!latest) {
    return { canRetakeNow: true, waitMinutes: 0, exhausted: false };
  }

  // 已通过时视为重新考试，不受补考间隔限制
  if (latest.result?.passed) {
    return { canRetakeNow: true, waitMinutes: 0, exhausted: false };
  }

  if (rule.retakeCooldownMinutes <= 0) {
    return { canRetakeNow: true, waitMinutes: 0, exhausted: false };
  }

  const finishedAt = latest.submittedAt ?? latest.startedAt;
  const elapsedMinutes = (now - finishedAt) / 60000;
  const remaining = rule.retakeCooldownMinutes - elapsedMinutes;

  if (remaining <= 0) {
    return { canRetakeNow: true, waitMinutes: 0, exhausted: false };
  }

  return { canRetakeNow: false, waitMinutes: remaining, exhausted: false };
}

/**
 * 判定是否可以报名某场考试
 *
 * @param input - 判定所需的全部上下文
 * @returns 是否可报名、未满足原因与已满足条件
 */
export function checkExamEligibility(input: EligibilityInput): EligibilityResult {
  const { rule, levels, officialAttempts, passedExamIds, studyMaterialProgress } = input;
  const now = input.now ?? Date.now();

  const reasons: string[] = [];
  const satisfied: string[] = [];

  // I. 前置等级
  if (rule.eligibility.requirePrerequisite) {
    const ok = satisfiesPrerequisite(levels, input.effectiveLevelOrder, rule.eligibility.prerequisiteLevelIds);
    const names = rule.eligibility.prerequisiteLevelIds
      .map((levelId) => findLevelById(levels, levelId)?.nameZh ?? levelId)
      .join('、');

    if (ok) {
      satisfied.push(`已取得前置等级：${names}`);
    } else {
      reasons.push(`需先取得前置等级：${names}`);
    }
  }

  // II. 指定专项考试
  const requiredSpecialtyExams = rule.eligibility.requiredSpecialtyExamIds ?? [];
  if (requiredSpecialtyExams.length > 0) {
    const missing = requiredSpecialtyExams.filter((examId) => !passedExamIds.has(examId));
    if (missing.length === 0) {
      satisfied.push('已通过本场考试要求的专项考试');
    } else {
      reasons.push(`需先通过专项考试：${missing.join('、')}`);
    }
  }

  // III. 前置考试最低分数
  const minScore = rule.eligibility.minPrerequisiteScore;
  if (minScore !== null && minScore !== undefined) {
    const prerequisiteAttempts = officialAttempts.filter((attempt) =>
      rule.eligibility.prerequisiteLevelIds.includes(attempt.levelId),
    );
    const best = prerequisiteAttempts.reduce(
      (max, attempt) => Math.max(max, attempt.result?.score ?? 0),
      0,
    );

    if (best >= minScore) {
      satisfied.push(`前置考试最高分 ${best} 分，已达到 ${minScore} 分要求`);
    } else {
      reasons.push(`前置考试最高分需达到 ${minScore} 分，当前为 ${best} 分`);
    }
  }

  // IV. 累计考试次数
  const minAttemptCount = rule.eligibility.minAttemptCount;
  if (minAttemptCount !== null && minAttemptCount !== undefined && minAttemptCount > 0) {
    if (input.totalOfficialAttemptCount >= minAttemptCount) {
      satisfied.push(`累计正式考试次数已达 ${minAttemptCount} 次`);
    } else {
      reasons.push(
        `需累计完成 ${minAttemptCount} 次正式考试，当前已完成 ${input.totalOfficialAttemptCount} 次`,
      );
    }
  }

  // V. 学习材料
  if (rule.eligibility.requireStudyMaterial) {
    const materialIds = rule.eligibility.studyMaterialIds ?? [];
    const missing = materialIds.filter((materialId) => !studyMaterialProgress[materialId]);
    if (missing.length === 0) {
      satisfied.push('已完成本场考试要求的学习材料');
    } else {
      reasons.push(`需先完成学习材料：${missing.join('、')}`);
    }
  }

  // VI. 考试次数与补考限制
  const retake = computeRetakeStatus(rule, officialAttempts, now);

  if (retake.exhausted) {
    reasons.push(
      rule.maxAttempts !== null && officialAttempts.length >= rule.maxAttempts
        ? `本场考试的正式考试次数已用尽（上限 ${rule.maxAttempts} 次）`
        : '本场考试为一次性认证考试，已参加过一次正式考试，不予补考',
    );
  } else if (officialAttempts.length === 0) {
    satisfied.push('尚未参加过本场正式考试，可直接报名');
  } else if (!retake.canRetakeNow) {
    reasons.push(`补考间隔未结束，还需等待约 ${Math.ceil(retake.waitMinutes)} 分钟`);
  } else if (rule.allowRetake) {
    satisfied.push('已满足补考间隔，可以重新报考');
  }

  return {
    eligible: reasons.length === 0,
    reasons,
    satisfied,
  };
}
