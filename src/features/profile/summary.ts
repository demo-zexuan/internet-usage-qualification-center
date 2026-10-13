/**
 * 考生档案汇总
 *
 * I. 派生数据原则
 *
 * 1. 最高等级、累计考试次数、通过次数、最近考试时间等均为**派生数据**，
 *    由本模块依据证件与考试记录实时计算，不写入档案记录，避免与事实漂移
 * 2. 当前有效等级只由未被作废的证件决定，任何考试失败都不会降低等级
 *
 * II. 升级条件
 *
 * 1. 下一等级的要求由「授予该等级的考试规则」推导，本模块不硬编码任何条件
 * 2. 每条要求都带有是否已满足的标记，首页与权限中心据此给出升级建议
 *
 * @module features/profile/summary
 * @author zexuan.peng
 * @created 2026-10-14
 */

import type { CertificateRecord } from '@/types/certificate';
import type { ExamAttempt, ExamRulesConfig } from '@/types/exam';
import type { LevelDefinition, LevelsConfig } from '@/types/level';
import type { NextLevelRequirement, UserProfileRecord, UserProfileSummary } from '@/types/user';

import { deriveCertifications, resolveActiveCertificate } from '@/features/certificates/service';
import { getNextLevel, getTemporaryLevel, satisfiesPrerequisite } from '@/features/levels/service';

/** 档案汇总输入 */
export interface ProfileSummaryInput {
  profile: UserProfileRecord;
  certificates: CertificateRecord[];
  attempts: ExamAttempt[];
  levels: LevelsConfig;
  rulesConfig: ExamRulesConfig;
  /** 学习材料完成情况：材料 ID → 完成时间戳 */
  studyMaterialProgress: Record<string, number>;
}

/**
 * 计算当前有效等级
 *
 * 1. 取未被作废证件中的最高等级
 * 2. 没有任何证件时返回临时浏览状态
 */
export function resolveProfileCurrentLevel(
  certificates: CertificateRecord[],
  levels: LevelsConfig,
): { level: LevelDefinition; fromCertificate: boolean } {
  const usable = certificates.filter((certificate) => certificate.status !== 'revoked');

  if (usable.length === 0) {
    const temporary = getTemporaryLevel(levels);
    return {
      level:
        temporary ?? {
          levelId: 'L0',
          order: 0,
          nameZh: '临时浏览状态',
          nameEn: 'Provisional Browsing Status',
          shortName: '临时',
          summary: '尚未取得任何 IUQA 资格。',
          description: '尚未取得任何 IUQA 资格。',
          badgeColorToken: 'level-1',
          certificateTitle: '临时浏览状态凭证',
          certificateMotto: '本状态不签发证件。',
          isEntryLevel: false,
          isTemporary: true,
          disclaimer: '临时浏览状态不构成任何形式的资格认证。',
        },
      fromCertificate: false,
    };
  }

  const highestOrder = usable.reduce((max, certificate) => Math.max(max, certificate.levelOrder), 0);
  const highestCertificate =
    usable.find((certificate) => certificate.levelOrder === highestOrder) ?? usable[0];
  const level = levels.levels.find((item) => item.levelId === highestCertificate?.levelId);

  if (!level) {
    const temporary = getTemporaryLevel(levels);
    return {
      level: temporary as LevelDefinition,
      fromCertificate: false,
    };
  }

  return { level, fromCertificate: true };
}

/**
 * 推导下一等级的升级条件
 *
 * @param nextLevel - 下一等级定义
 * @param input - 档案汇总上下文
 */
function buildNextLevelRequirements(
  nextLevel: LevelDefinition,
  input: ProfileSummaryInput,
  currentOrder: number,
  passedExamIds: Set<string>,
): NextLevelRequirement[] {
  const requirements: NextLevelRequirement[] = [];

  // I. 找到授予该等级的考试规则
  const grantingExam = input.rulesConfig.exams.find((exam) => exam.grantsLevelId === nextLevel.levelId);

  if (!grantingExam) {
    requirements.push({
      label: `通过可授予「${nextLevel.nameZh}」的考试`,
      satisfied: false,
      hint: '当前考试规则配置中没有任何考试授予该等级，请检查考试规则配置。',
    });
    return requirements;
  }

  // II. 前置等级
  if (grantingExam.eligibility.requirePrerequisite) {
    const satisfied = satisfiesPrerequisite(
      input.levels,
      currentOrder,
      grantingExam.eligibility.prerequisiteLevelIds,
    );
    const names = grantingExam.eligibility.prerequisiteLevelIds
      .map((levelId) => input.levels.levels.find((level) => level.levelId === levelId)?.nameZh ?? levelId)
      .join('、');

    requirements.push({
      label: `取得前置等级：${names}`,
      satisfied,
      hint: satisfied ? undefined : '请先完成前置等级的正式考试。',
    });
  }

  // III. 通过对应考试并达到及格线
  const passed = passedExamIds.has(grantingExam.examId);
  requirements.push({
    label: `通过「${grantingExam.title}」并达到 ${grantingExam.passScore} 分`,
    satisfied: passed,
    hint: passed
      ? undefined
      : `考试时长 ${grantingExam.durationMinutes} 分钟，共 ${grantingExam.questionCount} 题。`,
  });

  // IV. 学习材料
  if (grantingExam.eligibility.requireStudyMaterial) {
    const materialIds = grantingExam.eligibility.studyMaterialIds ?? [];
    const missing = materialIds.filter(
      (materialId) => !input.studyMaterialProgress[materialId],
    );

    requirements.push({
      label: `完成学习材料：${materialIds.join('、')}`,
      satisfied: missing.length === 0,
      hint:
        missing.length === 0
          ? '学习材料已完成。'
          : `尚未完成 ${missing.length} 份材料，可在学习材料专区阅读并完成自查问题。`,
    });
  }

  // V. 累计考试次数
  const minAttemptCount = grantingExam.eligibility.minAttemptCount;
  if (minAttemptCount !== null && minAttemptCount !== undefined && minAttemptCount > 0) {
    const officialCount = input.attempts.filter((attempt) => attempt.mode === 'official').length;
    requirements.push({
      label: `累计完成 ${minAttemptCount} 次正式考试`,
      satisfied: officialCount >= minAttemptCount,
      hint: `当前已完成 ${officialCount} 次。`,
    });
  }

  return requirements;
}

/**
 * 构建档案汇总视图
 *
 * @param input - 档案、证件、考试记录与配置
 */
export function buildProfileSummary(input: ProfileSummaryInput): UserProfileSummary {
  const { certificates, attempts, levels } = input;

  const { level: currentLevel, fromCertificate } = resolveProfileCurrentLevel(certificates, levels);
  const activeCertificate = resolveActiveCertificate(certificates, input.profile.preferredCertificateId);

  const sortedCertificates = [...certificates].sort(
    (a, b) => b.levelOrder - a.levelOrder || b.issuedAt - a.issuedAt,
  );

  const officialAttempts = attempts.filter((attempt) => attempt.mode === 'official');
  const passedAttempts = attempts.filter((attempt) => attempt.result?.passed);
  const passedExamIds = new Set(
    officialAttempts.filter((attempt) => attempt.result?.passed).map((attempt) => attempt.examId),
  );

  const lastExamAt = attempts.reduce<number | null>(
    (latest, attempt) => (latest === null || attempt.startedAt > latest ? attempt.startedAt : latest),
    null,
  );

  const nextLevel = getNextLevel(levels, currentLevel.order);

  return {
    profile: input.profile,
    currentLevel,
    levelFromCertificate: fromCertificate,
    activeCertificate,
    certificates: sortedCertificates,
    totalAttemptCount: attempts.length,
    officialAttemptCount: officialAttempts.length,
    passedAttemptCount: passedAttempts.length,
    lastExamAt,
    certifications: deriveCertifications(attempts),
    nextLevel,
    nextLevelRequirements: nextLevel
      ? buildNextLevelRequirements(nextLevel, input, currentLevel.order, passedExamIds)
      : [],
  };
}
