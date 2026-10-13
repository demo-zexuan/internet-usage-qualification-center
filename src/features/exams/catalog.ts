/**
 * 考试目录
 *
 * 将考试规则、报名资格与历史成绩合并为报名页所需的统一视图，
 * 使页面组件无需自行拼接多个数据源，也无需重复实现资格判定。
 *
 * @module features/exams/catalog
 * @author zexuan.peng
 * @created 2026-10-14
 */

import type { CertificateRecord } from '@/types/certificate';
import type { ExamAttempt, ExamCatalogItem, ExamRulesConfig } from '@/types/exam';
import type { LevelsConfig } from '@/types/level';

import { getLevelOrder } from '@/features/levels/service';

import { checkExamEligibility, computeRetakeStatus } from './eligibility';

/** 考试目录构建输入 */
export interface ExamCatalogInput {
  rulesConfig: ExamRulesConfig;
  levels: LevelsConfig;
  certificates: CertificateRecord[];
  attempts: ExamAttempt[];
  studyMaterialProgress: Record<string, number>;
  /** 当前时间戳，便于测试注入固定时间 */
  now?: number;
}

/**
 * 构建考试目录
 *
 * 1. 每场考试都会给出完整的报名判定结果与原因
 * 2. 同时给出进行中的考试记录 ID，供报名页展示「继续考试」入口
 */
export function buildExamCatalog(input: ExamCatalogInput): ExamCatalogItem[] {
  const { rulesConfig, levels, certificates, attempts } = input;
  const now = input.now ?? Date.now();

  // I. 当前有效等级序号：取未被作废证件中的最高等级
  const effectiveLevelOrder = certificates
    .filter((certificate) => certificate.status !== 'revoked')
    .reduce(
      (max, certificate) =>
        Math.max(max, certificate.levelOrder || getLevelOrder(levels, certificate.levelId)),
      0,
    );

  // II. 已通过的考试 ID 与正式考试总数
  const officialAttempts = attempts.filter((attempt) => attempt.mode === 'official');
  const passedExamIds = new Set(
    officialAttempts.filter((attempt) => attempt.result?.passed).map((attempt) => attempt.examId),
  );

  return rulesConfig.exams.map((rule) => {
    const examAttempts = officialAttempts.filter((attempt) => attempt.examId === rule.examId);
    const eligibility = checkExamEligibility({
      rule,
      levels,
      effectiveLevelOrder,
      officialAttempts: examAttempts,
      passedExamIds,
      totalOfficialAttemptCount: officialAttempts.length,
      studyMaterialProgress: input.studyMaterialProgress,
      now,
    });

    const retake = computeRetakeStatus(rule, examAttempts, now);

    const bestScore = examAttempts.reduce<number | null>((best, attempt) => {
      const score = attempt.result?.score;
      if (score === undefined) {
        return best;
      }
      return best === null || score > best ? score : best;
    }, null);

    const lastAttemptAt = examAttempts.reduce<number | null>(
      (latest, attempt) =>
        latest === null || attempt.startedAt > latest ? attempt.startedAt : latest,
      null,
    );

    // III. 进行中的考试：优先展示正式考试，其次展示模拟考试
    const inProgressOfficial = attempts.find(
      (attempt) =>
        attempt.examId === rule.examId && attempt.mode === 'official' && attempt.status === 'in_progress',
    );
    const inProgressMock = attempts.find(
      (attempt) =>
        attempt.examId === rule.examId && attempt.mode === 'mock' && attempt.status === 'in_progress',
    );

    return {
      rule,
      eligibility,
      officialAttemptCount: examAttempts.length,
      passed: passedExamIds.has(rule.examId),
      bestScore,
      lastAttemptAt,
      canRetakeNow: retake.canRetakeNow,
      retakeWaitMinutes: retake.waitMinutes,
      inProgressAttemptId: inProgressOfficial?.attemptId ?? inProgressMock?.attemptId ?? null,
    };
  });
}

/** 在目录中查找某场考试 */
export function findCatalogItem(
  catalog: ExamCatalogItem[],
  examId: string,
): ExamCatalogItem | null {
  return catalog.find((item) => item.rule.examId === examId) ?? null;
}
