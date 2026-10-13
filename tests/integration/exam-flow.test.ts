/**
 * 考试闭环集成测试
 *
 * 使用真实的题库与考试规则配置，覆盖项目测试要求中的关键流程条目：
 * 1. 建立档案 → 开始考试 → 答题 → 交卷 → 判分 → 签发证件
 * 2. 考试超时自动交卷
 * 3. 重复交卷的幂等性
 * 4. 刷新恢复答题（进度持久化）
 * 5. 正式考试结束后禁止修改答案
 * 6. 未通过时不签发证件且不授予等级
 * 7. 重复签发证件的幂等性
 * 8. 升级考试失败后保留原有等级与证件
 *
 * @author zexuan.peng
 * @created 2026-10-14
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { loadBuiltinConfigs } from '@/features/config/builtin';
import {
  finalizeAttempt,
  finalizeIfExpired,
  getAttempt,
  saveAttemptProgress,
  startExamAttempt,
} from '@/features/exams/attempt-service';
import {
  findCertificateByAttempt,
  issueCertificateForAttempt,
  listCertificates,
} from '@/features/certificates/service';
import { buildPermissionContext, hasPermission } from '@/features/permissions/engine';
import { buildProfileSummary } from '@/features/profile/summary';
import { createProfile } from '@/features/profile/service';
import { clearAllTables } from '../unit/helpers/database';

/** 内置配置（真实题库与规则） */
const builtin = loadBuiltinConfigs();
if (!builtin.ok) {
  throw new Error(`内置配置校验失败，无法运行集成测试：${builtin.error.message}`);
}

const config = builtin.value;

/** 题库记录：把内置题库转换为落库形态 */
const bankRecords = config.questionBanks.map((bank) => ({
  ...bank,
  source: 'builtin' as const,
  importedAt: Date.now(),
  rawJson: JSON.stringify(bank),
  stats: {
    totalQuestions: bank.questions.length,
    byType: {},
    byCategory: {},
    byDifficulty: {},
    totalScore: bank.questions.reduce((sum, question) => sum + question.score, 0),
  },
}));

/** 按 bankId 取出内置题库记录 */
function findBank(bankId: string) {
  const bank = bankRecords.find((record) => record.bankId === bankId);
  if (!bank) {
    throw new Error(`内置题库 ${bankId} 不存在`);
  }
  return bank;
}

/** 建立一份测试档案 */
async function setupProfile(name = '集成测试考生') {
  const result = await createProfile({ displayName: name });
  if (!result.ok) {
    throw new Error(`档案建立失败：${result.error.message}`);
  }
  return result.value;
}

/** 开始一场考试 */
async function startExam(
  userId: string,
  examId: string,
  mode: 'mock' | 'official',
  options: { seed?: string; effectiveLevelOrder?: number } = {},
) {
  const result = await startExamAttempt({
    examId,
    mode,
    userId,
    rulesConfig: config.examRules,
    levels: config.levels,
    banks: bankRecords,
    passedExamIds: new Set(),
    officialAttempts: [],
    allAttempts: [],
    effectiveLevelOrder: options.effectiveLevelOrder ?? 0,
    studyMaterialProgress: {},
    seed: options.seed ?? 'INTEGRATION-SEED',
  });

  if (!result.ok) {
    throw new Error(`考试开始失败：${result.error.message}（${result.error.details?.join('；')}）`);
  }

  return result.value.attempt;
}

/** 从已签发证件推导当前有效等级序号 */
async function currentLevelOrder(userId: string): Promise<number> {
  const certificates = await listCertificates(userId);
  return certificates
    .filter((certificate) => certificate.status !== 'revoked')
    .reduce((max, certificate) => Math.max(max, certificate.levelOrder), 0);
}

/** 生成全部正确的答案 */
function correctAnswers(questions: { questionId: string; correctOptionIds: string[] }[]) {
  const answers: Record<string, string[]> = {};
  for (const question of questions) {
    answers[question.questionId] = [...question.correctOptionIds];
  }
  return answers;
}

/** 生成全部错误的答案 */
function wrongAnswers(questions: { questionId: string; correctOptionIds: string[] }[]) {
  const answers: Record<string, string[]> = {};
  for (const question of questions) {
    const wrongOption = ['A', 'B', 'C', 'D', 'TRUE', 'FALSE'].find(
      (id) => !question.correctOptionIds.includes(id),
    );
    answers[question.questionId] = wrongOption ? [wrongOption] : [];
  }
  return answers;
}

beforeEach(async () => {
  await clearAllTables();
});

describe('L1 正式考试闭环', () => {
  it('通过考试后取得等级并签发证件', async () => {
    const profile = await setupProfile();

    // I. 开始考试
    const attempt = await startExam(profile.userId, 'L1-BASIC', 'official');
    expect(attempt.status).toBe('in_progress');
    expect(attempt.paper.questions).toHaveLength(10);
    expect(attempt.paper.bankRefs[0]?.bankId).toBe('demo-basic');
    expect(attempt.expiresAt - attempt.startedAt).toBe(10 * 60 * 1000);

    // II. 全部答对并保存进度
    const answers = correctAnswers(attempt.paper.questions);
    const saved = await saveAttemptProgress({
      attemptId: attempt.attemptId,
      answers,
      currentIndex: 9,
      flaggedQuestionIds: [attempt.paper.questions[0]!.questionId],
    });
    expect(saved.ok).toBe(true);

    // III. 交卷结算
    const finalized = await finalizeAttempt(attempt.attemptId, 'user');
    expect(finalized.ok).toBe(true);
    if (!finalized.ok) {
      return;
    }

    const record = finalized.value;
    expect(record.status).toBe('submitted');
    expect(record.submitReason).toBe('user');
    expect(record.result?.score).toBe(100);
    expect(record.result?.passed).toBe(true);
    expect(record.result?.levelAwarded).toBe('L1');
    expect(record.result?.correctCount).toBe(10);
    expect(record.result?.unansweredCount).toBe(0);
    expect(record.durationMs).not.toBeNull();

    // IV. 签发证件
    const issued = await issueCertificateForAttempt({
      attempt: record,
      profile,
      template: config.certificateTemplate,
      levels: config.levels,
      certifications: [],
    });

    expect(issued.ok).toBe(true);
    if (!issued.ok) {
      return;
    }

    expect(issued.value.created).toBe(true);
    expect(issued.value.certificate?.levelId).toBe('L1');
    expect(issued.value.certificate?.status).toBe('valid');
    expect(issued.value.certificate?.certificateNumber).toMatch(/^IUQA-\d{4}-[A-Z0-9]{6}$/);

    // V. 权限随之解锁
    const certificates = await listCertificates(profile.userId);
    const context = buildPermissionContext({
      levels: config.levels,
      certificates,
      certifications: [],
    });

    expect(context.effectiveLevelOrder).toBe(1);
    expect(hasPermission(context, 'browse_internet', config.permissions)).toBe(true);
    expect(hasPermission(context, 'post_comment', config.permissions)).toBe(false);
  });

  it('未通过考试时不授予等级也不签发证件', async () => {
    const profile = await setupProfile();

    const attempt = await startExam(profile.userId, 'L1-BASIC', 'official');
    await saveAttemptProgress({
      attemptId: attempt.attemptId,
      answers: wrongAnswers(attempt.paper.questions),
    });

    const finalized = await finalizeAttempt(attempt.attemptId, 'user');
    expect(finalized.ok).toBe(true);
    if (!finalized.ok) {
      return;
    }

    expect(finalized.value.result?.passed).toBe(false);
    expect(finalized.value.result?.levelAwarded).toBeNull();

    const issued = await issueCertificateForAttempt({
      attempt: finalized.value,
      profile,
      template: config.certificateTemplate,
      levels: config.levels,
      certifications: [],
    });

    expect(issued.ok).toBe(false);
    if (issued.ok) {
      return;
    }
    expect(issued.error.code).toBe('PREREQUISITE_NOT_MET');

    expect(await listCertificates(profile.userId)).toHaveLength(0);
  });

  it('模拟考试通过后不签发证件', async () => {
    const profile = await setupProfile();

    const attempt = await startExam(profile.userId, 'L1-BASIC', 'mock');
    await saveAttemptProgress({
      attemptId: attempt.attemptId,
      answers: correctAnswers(attempt.paper.questions),
    });

    const finalized = await finalizeAttempt(attempt.attemptId, 'user');
    expect(finalized.ok).toBe(true);
    if (!finalized.ok) {
      return;
    }

    expect(finalized.value.result?.passed).toBe(true);
    expect(finalized.value.result?.levelAwarded).toBeNull();

    const issued = await issueCertificateForAttempt({
      attempt: finalized.value,
      profile,
      template: config.certificateTemplate,
      levels: config.levels,
      certifications: [],
    });

    expect(issued.ok).toBe(false);
    expect(await listCertificates(profile.userId)).toHaveLength(0);
  });
});

describe('重复交卷的幂等性', () => {
  it('重复调用结算不会重新判分，也不会覆盖首次结果', async () => {
    const profile = await setupProfile();
    const attempt = await startExam(profile.userId, 'L1-BASIC', 'official');

    await saveAttemptProgress({
      attemptId: attempt.attemptId,
      answers: correctAnswers(attempt.paper.questions),
    });

    const first = await finalizeAttempt(attempt.attemptId, 'user');
    const second = await finalizeAttempt(attempt.attemptId, 'user');
    const third = await finalizeAttempt(attempt.attemptId, 'timeout');

    expect(first.ok && second.ok && third.ok).toBe(true);
    if (!first.ok || !second.ok || !third.ok) {
      return;
    }

    expect(second.value.result?.gradedAt).toBe(first.value.result?.gradedAt);
    expect(third.value.result?.gradedAt).toBe(first.value.result?.gradedAt);
    expect(third.value.submitReason).toBe('user');
    expect(third.value.submittedAt).toBe(first.value.submittedAt);
  });

  it('交卷后继续保存答案不会修改已结算的答卷', async () => {
    const profile = await setupProfile();
    const attempt = await startExam(profile.userId, 'L1-BASIC', 'official');

    await saveAttemptProgress({
      attemptId: attempt.attemptId,
      answers: correctAnswers(attempt.paper.questions),
    });

    const finalized = await finalizeAttempt(attempt.attemptId, 'user');
    expect(finalized.ok).toBe(true);

    // 交卷后尝试写入错误答案
    const tamper = await saveAttemptProgress({
      attemptId: attempt.attemptId,
      answers: wrongAnswers(attempt.paper.questions),
      currentIndex: 0,
    });

    expect(tamper.ok).toBe(true);
    if (!tamper.ok) {
      return;
    }

    expect(tamper.value.status).toBe('submitted');
    expect(tamper.value.result?.score).toBe(100);

    const reloaded = await getAttempt(attempt.attemptId);
    expect(reloaded?.result?.score).toBe(100);
    expect(reloaded?.answers).toEqual(correctAnswers(attempt.paper.questions));
  });
});

describe('考试超时自动交卷', () => {
  it('到期后调用恢复结算自动交卷并标记为超时', async () => {
    const profile = await setupProfile();
    const attempt = await startExam(profile.userId, 'L1-BASIC', 'official');

    // 只作答一部分，然后模拟时间已过
    const partial: Record<string, string[]> = {};
    attempt.paper.questions.slice(0, 4).forEach((question) => {
      partial[question.questionId] = [...question.correctOptionIds];
    });

    await saveAttemptProgress({ attemptId: attempt.attemptId, answers: partial });

    // 把到期时间改到过去，模拟「关闭浏览器后重新打开时已超时」
    const { db } = await import('@/services/database');
    await db.examAttempts.update(attempt.attemptId, { expiresAt: Date.now() - 1000 });

    const finalized = await finalizeIfExpired(attempt.attemptId);
    expect(finalized.ok).toBe(true);
    if (!finalized.ok) {
      return;
    }

    expect(finalized.value.status).toBe('submitted');
    expect(finalized.value.submitReason).toBe('timeout');
    expect(finalized.value.result?.correctCount).toBe(4);
    expect(finalized.value.result?.unansweredCount).toBe(6);
    // 4 / 10 题正确 → 40 分，未通过
    expect(finalized.value.result?.score).toBe(40);
    expect(finalized.value.result?.passed).toBe(false);
  });

  it('未到期时恢复结算不改变考试状态', async () => {
    const profile = await setupProfile();
    const attempt = await startExam(profile.userId, 'L1-BASIC', 'official');

    const result = await finalizeIfExpired(attempt.attemptId);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.status).toBe('in_progress');
    expect(result.value.result).toBeNull();
  });
});

describe('刷新恢复答题', () => {
  it('保存的答案、题号与标记在重新读取后完整保留', async () => {
    const profile = await setupProfile();
    const attempt = await startExam(profile.userId, 'L1-BASIC', 'official');

    const answers: Record<string, string[]> = {};
    attempt.paper.questions.slice(0, 3).forEach((question) => {
      answers[question.questionId] = [...question.correctOptionIds];
    });
    const flagged = [attempt.paper.questions[1]!.questionId, attempt.paper.questions[2]!.questionId];

    await saveAttemptProgress({
      attemptId: attempt.attemptId,
      answers,
      flaggedQuestionIds: flagged,
      currentIndex: 5,
    });

    // 模拟刷新页面：重新从数据库读取
    const reloaded = await getAttempt(attempt.attemptId);

    expect(reloaded).not.toBeNull();
    expect(reloaded?.status).toBe('in_progress');
    expect(reloaded?.answers).toEqual(answers);
    expect(reloaded?.flaggedQuestionIds).toEqual(flagged);
    expect(reloaded?.currentIndex).toBe(5);
    expect(reloaded?.remainingMs).toBeGreaterThan(0);
  });

  it('重复开始同一场考试会恢复既有记录而不是新建', async () => {
    const profile = await setupProfile();
    const first = await startExam(profile.userId, 'L1-BASIC', 'official');

    const second = await startExamAttempt({
      examId: 'L1-BASIC',
      mode: 'official',
      userId: profile.userId,
      rulesConfig: config.examRules,
      levels: config.levels,
      banks: bankRecords,
      passedExamIds: new Set(),
      officialAttempts: [],
      allAttempts: [],
      effectiveLevelOrder: 0,
      studyMaterialProgress: {},
    });

    expect(second.ok).toBe(true);
    if (!second.ok) {
      return;
    }

    expect(second.value.resumed).toBe(true);
    expect(second.value.attempt.attemptId).toBe(first.attemptId);

    const { db } = await import('@/services/database');
    const count = await db.examAttempts.where('userId').equals(profile.userId).count();
    expect(count).toBe(1);
  });
});

describe('重复签发证件的幂等性', () => {
  it('同一场考试重复签发只产生一张证件', async () => {
    const profile = await setupProfile();
    const attempt = await startExam(profile.userId, 'L1-BASIC', 'official');

    await saveAttemptProgress({
      attemptId: attempt.attemptId,
      answers: correctAnswers(attempt.paper.questions),
    });

    const finalized = await finalizeAttempt(attempt.attemptId, 'user');
    if (!finalized.ok) {
      throw new Error('交卷失败');
    }

    const input = {
      attempt: finalized.value,
      profile,
      template: config.certificateTemplate,
      levels: config.levels,
      certifications: [],
    };

    const first = await issueCertificateForAttempt(input);
    const second = await issueCertificateForAttempt(input);
    const third = await issueCertificateForAttempt(input);

    expect(first.ok && second.ok && third.ok).toBe(true);
    if (!first.ok || !second.ok || !third.ok) {
      return;
    }

    expect(first.value.created).toBe(true);
    expect(second.value.created).toBe(false);
    expect(third.value.created).toBe(false);
    expect(second.value.certificate?.certificateId).toBe(first.value.certificate?.certificateId);

    const certificates = await listCertificates(profile.userId);
    expect(certificates).toHaveLength(1);

    // 考试记录中的 certificateId 已回写
    const reloaded = await getAttempt(attempt.attemptId);
    expect(reloaded?.certificateId).toBe(first.value.certificate?.certificateId);

    const byAttempt = await findCertificateByAttempt(attempt.attemptId);
    expect(byAttempt?.certificateNumber).toBe(first.value.certificate?.certificateNumber);
  });
});

describe('升级与等级保留', () => {
  /** 走完一场正式考试并签发证件 */
  async function completeExam(
    userId: string,
    examId: string,
    profile: Awaited<ReturnType<typeof setupProfile>>,
    mode: 'official' | 'mock' = 'official',
  ) {
    // 正式考试需要按当前已取得的等级判定报名资格
    const levelOrder = await currentLevelOrder(userId);
    const attempt = await startExam(userId, examId, mode, { effectiveLevelOrder: levelOrder });
    await saveAttemptProgress({
      attemptId: attempt.attemptId,
      answers: correctAnswers(attempt.paper.questions),
    });
    const finalized = await finalizeAttempt(attempt.attemptId, 'user');
    if (!finalized.ok) {
      throw new Error('交卷失败');
    }

    await issueCertificateForAttempt({
      attempt: finalized.value,
      profile,
      template: config.certificateTemplate,
      levels: config.levels,
      certifications: [],
    });

    return finalized.value;
  }

  it('升级到 L2 后低等级证件被标记为已被替代但仍保留', async () => {
    const profile = await setupProfile();

    await completeExam(profile.userId, 'L1-BASIC', profile);
    const certificatesAfterL1 = await listCertificates(profile.userId);
    expect(certificatesAfterL1).toHaveLength(1);
    expect(certificatesAfterL1[0]?.levelId).toBe('L1');

    await completeExam(profile.userId, 'L2-INTERACT', profile);

    const certificatesAfterL2 = await listCertificates(profile.userId);
    expect(certificatesAfterL2).toHaveLength(2);

    const l1 = certificatesAfterL2.find((certificate) => certificate.levelId === 'L1');
    const l2 = certificatesAfterL2.find((certificate) => certificate.levelId === 'L2');

    expect(l1?.status).toBe('superseded');
    expect(l2?.status).toBe('valid');

    // 历史证件仍证明 L1 已取得，权限不回退
    const context = buildPermissionContext({
      levels: config.levels,
      certificates: certificatesAfterL2,
      certifications: [],
    });
    expect(context.effectiveLevelOrder).toBe(2);
    expect(context.validCertificateLevelIds).toContain('L1');
  });

  it('升级考试失败后保留原有等级、证件与权限', async () => {
    const profile = await setupProfile();

    await completeExam(profile.userId, 'L1-BASIC', profile);

    // 参加 L2 考试并全部答错
    const attempt = await startExam(profile.userId, 'L2-INTERACT', 'official', {
      effectiveLevelOrder: await currentLevelOrder(profile.userId),
    });
    await saveAttemptProgress({
      attemptId: attempt.attemptId,
      answers: wrongAnswers(attempt.paper.questions),
    });

    const finalized = await finalizeAttempt(attempt.attemptId, 'user');
    expect(finalized.ok).toBe(true);
    if (!finalized.ok) {
      return;
    }

    expect(finalized.value.result?.passed).toBe(false);

    // 等级、证件与权限均保持不变
    const certificates = await listCertificates(profile.userId);
    expect(certificates).toHaveLength(1);
    expect(certificates[0]?.levelId).toBe('L1');
    expect(certificates[0]?.status).toBe('valid');

    const context = buildPermissionContext({
      levels: config.levels,
      certificates,
      certifications: [],
    });
    expect(context.effectiveLevelOrder).toBe(1);
    expect(hasPermission(context, 'browse_internet', config.permissions)).toBe(true);

    // 档案汇总中的当前等级仍为 L1，且此前通过记录仍然计入统计
    const { db } = await import('@/services/database');
    const allAttempts = await db.examAttempts.where('userId').equals(profile.userId).toArray();

    const summary = buildProfileSummary({
      profile,
      certificates,
      attempts: allAttempts,
      levels: config.levels,
      rulesConfig: config.examRules,
      studyMaterialProgress: {},
    });

    expect(summary.currentLevel.levelId).toBe('L1');
    expect(summary.totalAttemptCount).toBe(2);
    expect(summary.passedAttemptCount).toBe(1);
    expect(summary.nextLevel?.levelId).toBe('L2');
  });
});

describe('报名资格判定', () => {
  it('未取得前置等级时拒绝开始正式考试', async () => {
    const profile = await setupProfile();

    const result = await startExamAttempt({
      examId: 'L2-INTERACT',
      mode: 'official',
      userId: profile.userId,
      rulesConfig: config.examRules,
      levels: config.levels,
      banks: bankRecords,
      passedExamIds: new Set(),
      officialAttempts: [],
      allAttempts: [],
      effectiveLevelOrder: 0,
      studyMaterialProgress: {},
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe('PREREQUISITE_NOT_MET');
    expect(result.error.details?.some((detail) => detail.includes('前置等级'))).toBe(true);
  });

  it('模拟考试免除报名条件', async () => {
    const profile = await setupProfile();

    const result = await startExamAttempt({
      examId: 'L2-INTERACT',
      mode: 'mock',
      userId: profile.userId,
      rulesConfig: config.examRules,
      levels: config.levels,
      banks: bankRecords,
      passedExamIds: new Set(),
      officialAttempts: [],
      allAttempts: [],
      effectiveLevelOrder: 0,
      studyMaterialProgress: {},
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.attempt.mode).toBe('mock');
  });

  it('未完成学习材料时拒绝开始 L5 正式考试', async () => {
    const profile = await setupProfile();

    const result = await startExamAttempt({
      examId: 'L5-CROSSDOMAIN',
      mode: 'official',
      userId: profile.userId,
      rulesConfig: config.examRules,
      levels: config.levels,
      banks: bankRecords,
      passedExamIds: new Set(),
      officialAttempts: [],
      allAttempts: [],
      effectiveLevelOrder: 5,
      studyMaterialProgress: {},
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.details?.some((detail) => detail.includes('学习材料'))).toBe(true);
  });

  it('题库不足时拒绝开始考试', async () => {
    const profile = await setupProfile();

    const result = await startExamAttempt({
      examId: 'L1-BASIC',
      mode: 'official',
      userId: profile.userId,
      rulesConfig: config.examRules,
      levels: config.levels,
      // 只提供题目数量不足的题库（保留 L1 所需的 bankId，仅裁剪题目）
      banks: [
        {
          ...findBank('demo-basic'),
          questions: findBank('demo-basic').questions.slice(0, 3),
        },
      ],
      passedExamIds: new Set(),
      officialAttempts: [],
      allAttempts: [],
      effectiveLevelOrder: 0,
      studyMaterialProgress: {},
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.code).toBe('QUESTION_BANK_INSUFFICIENT');
  });
});
