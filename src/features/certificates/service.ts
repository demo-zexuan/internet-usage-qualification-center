/**
 * 电子证件服务
 *
 * I. 签发幂等性
 *
 * 1. 同一场考试无论打开多少次成绩页，都只会签发一张证件
 * 2. 幂等判定以 `examAttemptId` 为唯一依据，重复调用返回既有证件并标记 created=false
 *
 * II. 编号与校验图形
 *
 * 1. 编号格式为 `IUQA-年份-随机段`，随机段长度由证件模板配置
 * 2. 校验码由编号与等级确定性推导，仅用于生成防伪视觉元素
 * 3. 校验图形是装饰性图案，**不是可扫描的二维码**，本平台未部署任何在线核验服务
 *
 * III. 升级处理
 *
 * 1. 签发更高等级证件时，将同档案的低等级有效证件标记为「已被更高级证件替代」
 * 2. 历史证件记录永久保留，不会因升级而删除
 *
 * @module features/certificates/service
 * @author zexuan.peng
 * @created 2026-10-14
 */

import type { AppError, Result } from '@/types/common';
import type {
  CertificateRecord,
  CertificateTemplate,
  CertificateVerificationGraphic,
} from '@/types/certificate';
import type { ExamAttempt } from '@/types/exam';
import type { LevelsConfig } from '@/types/level';
import type { UserProfileRecord } from '@/types/user';

import { createCertificateId, randomString } from '@/utils/id';
import { createSeededRandom } from '@/utils/random';
import { getLevelOrder } from '@/features/levels/service';
import { db, recordAuditEvent } from '@/services/database';

/** 证件记录结构版本 */
const CERTIFICATE_SCHEMA_VERSION = '1.0.0';

/* ============================================================
   0. 签发串行化
   ============================================================ */

/**
 * 签发串行队列
 *
 * 幂等检查与写入之间存在时间窗口：并发调用（例如 React 副作用因依赖变化
 * 被连续触发两次）会同时通过「尚未签发」的判断，从而各写入一张证件。
 * 这里用一条串行队列把签发过程串起来，保证同一时刻只有一个签发流程在运行。
 */
let issuanceQueue: Promise<unknown> = Promise.resolve();

/** 在签发队列中串行执行任务 */
function withIssuanceLock<T>(task: () => Promise<T>): Promise<T> {
  const run = issuanceQueue.then(task, task);
  // 队列本身不因单个任务失败而中断
  issuanceQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/* ============================================================
   I. 编号与校验码
   ============================================================ */

/**
 * 生成证件编号
 *
 * @param template - 证件模板（提供前缀与随机段长度）
 * @param issuedAt - 授予时间
 * @param isTaken - 判断编号是否已被占用的回调，用于避免极小概率的重复
 */
export function generateCertificateNumber(
  template: CertificateTemplate,
  issuedAt: number,
  isTaken: (candidate: string) => boolean = () => false,
): string {
  const year = new Date(issuedAt).getFullYear();
  const length = Math.min(Math.max(template.numberRandomLength, 4), 12);

  // 最多重试 10 次，避免随机段冲突导致死循环
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = `${template.numberPrefix}-${year}-${randomString(length)}`;
    if (!isTaken(candidate)) {
      return candidate;
    }
  }

  // 连续冲突时追加时间戳后缀，保证一定生成唯一编号
  return `${template.numberPrefix}-${year}-${randomString(length)}${Date.now().toString(36).toUpperCase().slice(-2)}`;
}

/** 计算证件校验码（FNV-1a 哈希后按自定义字母表编码） */
export function computeCertificateChecksum(certificateNumber: string, levelId: string): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const input = `${certificateNumber}|${levelId}`;

  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  let value = hash >>> 0;
  let checksum = '';
  for (let index = 0; index < 6; index += 1) {
    checksum += alphabet[value % alphabet.length];
    value = Math.floor(value / alphabet.length) + 7;
  }

  return checksum;
}

/**
 * 生成证件校验图形
 *
 * 1. 图案由编号与校验码确定性推导，同一张证件每次渲染完全一致
 * 2. 三个定位角与定时图案仅用于视觉上接近常见二维码的观感
 * 3. 该图案不含任何可解码数据，第三方无法通过它核验证件
 *
 * @param certificateNumber - 证件编号
 * @param checksum - 校验码
 * @param size - 矩阵边长（默认 21，与常见二维码版本 1 尺寸一致）
 */
export function buildVerificationGraphic(
  certificateNumber: string,
  checksum: string,
  size = 21,
): CertificateVerificationGraphic {
  const random = createSeededRandom(`${certificateNumber}#${checksum}`);
  const cells = new Set<string>();

  /** 绘制 7×7 定位图案 */
  const drawFinder = (originRow: number, originColumn: number): void => {
    for (let row = 0; row < 7; row += 1) {
      for (let column = 0; column < 7; column += 1) {
        const isBorder = row === 0 || row === 6 || column === 0 || column === 6;
        const isCore = row >= 2 && row <= 4 && column >= 2 && column <= 4;
        if (isBorder || isCore) {
          cells.add(`${originRow + row}-${originColumn + column}`);
        }
      }
    }
  };

  // I. 三个定位角
  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  /** 判断坐标是否落在定位图案的保留区内 */
  const inReservedArea = (row: number, column: number): boolean => {
    const inTopLeft = row < 8 && column < 8;
    const inTopRight = row < 8 && column >= size - 8;
    const inBottomLeft = row >= size - 8 && column < 8;
    return inTopLeft || inTopRight || inBottomLeft;
  };

  // II. 定时图案：第 6 行与第 6 列交替填充
  for (let index = 8; index < size - 8; index += 1) {
    if (index % 2 === 0) {
      cells.add(`6-${index}`);
      cells.add(`${index}-6`);
    }
  }

  // III. 数据区：按伪随机序列填充，形成稳定的纹理
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      if (inReservedArea(row, column)) {
        continue;
      }
      if (row === 6 || column === 6) {
        continue;
      }
      if (random() > 0.52) {
        cells.add(`${row}-${column}`);
      }
    }
  }

  return { size, cells, checksum };
}

/* ============================================================
   II. 签发
   ============================================================ */

/** 签发结果 */
export interface CertificateIssuanceResult {
  /** 当前应展示的证件；专项考试不提升等级时为既有的当前证件 */
  certificate: CertificateRecord | null;
  /** 本次调用是否真的签发了新证件 */
  created: boolean;
  /** 未签发新证件时的原因说明 */
  reason: string | null;
}

/** 签发输入 */
export interface IssueCertificateInput {
  attempt: ExamAttempt;
  profile: UserProfileRecord;
  template: CertificateTemplate;
  levels: LevelsConfig;
  /** 该档案已获得的专项能力认证 */
  certifications: string[];
}

/** 查找某场考试已签发的证件 */
export async function findCertificateByAttempt(
  attemptId: string,
): Promise<CertificateRecord | null> {
  const record = await db.certificates.where('examAttemptId').equals(attemptId).first();
  return record ?? null;
}

/** 按 ID 查找证件 */
export async function findCertificateById(
  certificateId: string,
): Promise<CertificateRecord | null> {
  const record = await db.certificates.get(certificateId);
  return record ?? null;
}

/** 列出某档案的全部证件，按等级从高到低排序 */
export async function listCertificates(userId: string): Promise<CertificateRecord[]> {
  const records = await db.certificates.where('userId').equals(userId).toArray();
  return records.sort((a, b) => b.levelOrder - a.levelOrder || b.issuedAt - a.issuedAt);
}

/**
 * 为一场已通过的正式考试签发证件
 *
 * 1. 幂等：已签发过则直接返回既有证件
 * 2. 模拟考试不签发正式证件
 * 3. 专项能力认证考试不提升等级，此时只返回当前证件并说明原因
 * 4. 并发调用被串行化，避免同一场考试被签发多张证件
 */
export async function issueCertificateForAttempt(
  input: IssueCertificateInput,
): Promise<Result<CertificateIssuanceResult, AppError>> {
  return withIssuanceLock(() => issueCertificateUnlocked(input));
}

/** 实际签发流程：调用方必须已持有签发锁 */
async function issueCertificateUnlocked(
  input: IssueCertificateInput,
): Promise<Result<CertificateIssuanceResult, AppError>> {
  const { attempt, profile, template, levels, certifications } = input;

  // I. 前置条件检查
  if (attempt.status !== 'submitted' || !attempt.result) {
    return {
      ok: false,
      error: {
        code: 'ATTEMPT_NOT_FOUND',
        message: '该考试尚未结算，无法签发证件。',
        hint: '请先完成交卷，再查看成绩页面。',
      },
    };
  }

  if (attempt.mode !== 'official') {
    return {
      ok: false,
      error: {
        code: 'CERTIFICATE_ALREADY_ISSUED',
        message: '模拟考试不签发正式证件。',
        hint: '模拟考试成绩仅用于练习，正式证件需通过正式考试取得。',
      },
    };
  }

  if (!attempt.result.passed) {
    return {
      ok: false,
      error: {
        code: 'PREREQUISITE_NOT_MET',
        message: '本次考试未达到及格线，不签发证件。',
        hint: '请查看成绩页的补考规则后重新报考。',
      },
    };
  }

  // II. 幂等：同一场考试只签发一次
  const existing = await findCertificateByAttempt(attempt.attemptId);
  if (existing) {
    return { ok: true, value: { certificate: existing, created: false, reason: null } };
  }

  const grantedLevelId = attempt.result.levelAwarded ?? attempt.paper.ruleSnapshot.grantsLevelId;
  const grantedOrder = getLevelOrder(levels, grantedLevelId);

  // III. 专项能力认证考试不提升等级
  const currentCertificates = await listCertificates(profile.userId);
  const currentMaxOrder = currentCertificates
    .filter((certificate) => certificate.status !== 'revoked')
    .reduce((max, certificate) => Math.max(max, certificate.levelOrder), 0);

  if (grantedOrder <= currentMaxOrder) {
    const active = currentCertificates.find((certificate) => certificate.status === 'valid') ?? null;

    await recordAuditEvent({
      type: 'certificate_issued',
      userId: profile.userId,
      message: `专项能力认证考试通过，不提升等级（授予认证：${attempt.result.certificationsAwarded.join('、') || '无'}）`,
      metadata: { attemptId: attempt.attemptId, examId: attempt.examId },
    });

    return {
      ok: true,
      value: {
        certificate: active,
        created: false,
        reason: '本场考试为专项能力认证考试，通过后不提升等级，认证标注将显示在当前证件上。',
      },
    };
  }

  // IV. 生成证件记录
  try {
    const issuedAt = attempt.submittedAt ?? Date.now();
    const takenNumbers = new Set((await db.certificates.toArray()).map((row) => row.certificateNumber));
    const certificateNumber = generateCertificateNumber(
      template,
      issuedAt,
      (candidate) => takenNumbers.has(candidate),
    );

    const now = Date.now();
    const record: CertificateRecord = {
      schemaVersion: CERTIFICATE_SCHEMA_VERSION,
      certificateId: createCertificateId(),
      certificateNumber,
      userId: profile.userId,
      levelId: grantedLevelId,
      levelOrder: grantedOrder,
      examAttemptId: attempt.attemptId,
      examId: attempt.examId,
      holderName: profile.displayName,
      candidateNumber: profile.candidateNumber,
      issuedAt,
      status: 'valid',
      checksum: computeCertificateChecksum(certificateNumber, grantedLevelId),
      issuerName: template.issuerName,
      issuerCode: template.issuerCode,
      templateVersion: template.version,
      certifications: [...certifications],
      fromMockExam: false,
      createdAt: now,
      updatedAt: now,
    };

    await db.certificates.put(record);

    // V. 低等级有效证件标记为已被替代（历史记录保留）
    const lowerValid = currentCertificates.filter(
      (certificate) => certificate.status === 'valid' && certificate.levelOrder < grantedOrder,
    );
    if (lowerValid.length > 0) {
      await db.certificates.bulkPut(
        lowerValid.map((certificate) => ({
          ...certificate,
          status: 'superseded' as const,
          updatedAt: Date.now(),
        })),
      );
    }

    // VI. 回写考试记录的证件 ID，避免成绩页重复触发签发
    await db.examAttempts.update(attempt.attemptId, { certificateId: record.certificateId });

    await recordAuditEvent({
      type: 'certificate_issued',
      userId: profile.userId,
      message: `签发证件 ${record.certificateNumber}（${grantedLevelId}）`,
      metadata: { certificateId: record.certificateId, attemptId: attempt.attemptId },
    });

    return { ok: true, value: { certificate: record, created: true, reason: null } };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      error: {
        code: 'DATABASE_INIT_FAILED',
        message: '证件写入本地数据库失败，证件未能签发。',
        hint: '请检查浏览器是否允许本站点使用本地存储后重试。',
        details: [detail],
      },
    };
  }
}

/* ============================================================
   III. 查询与状态
   ============================================================ */

/**
 * 取得当前应展示的证件
 *
 * 1. 优先使用用户指定的证件（用于查看历史证件）
 * 2. 否则取等级最高的有效证件
 */
export function resolveActiveCertificate(
  certificates: CertificateRecord[],
  preferredCertificateId: string | null,
): CertificateRecord | null {
  if (preferredCertificateId) {
    const preferred = certificates.find(
      (certificate) => certificate.certificateId === preferredCertificateId,
    );
    if (preferred) {
      return preferred;
    }
  }

  const valid = certificates.filter((certificate) => certificate.status === 'valid');
  if (valid.length === 0) {
    return certificates[0] ?? null;
  }

  return valid.reduce((best, certificate) =>
    certificate.levelOrder > best.levelOrder ? certificate : best,
  );
}

/** 作废证件（用于本地数据管理，不影响历史考试记录） */
export async function revokeCertificate(certificateId: string): Promise<Result<void, AppError>> {
  const record = await findCertificateById(certificateId);
  if (!record) {
    return {
      ok: false,
      error: {
        code: 'CERTIFICATE_NOT_FOUND',
        message: '指定的证件不存在或已被清除。',
        hint: '请返回证件历史列表重新选择。',
      },
    };
  }

  await db.certificates.update(certificateId, { status: 'revoked', updatedAt: Date.now() });

  await recordAuditEvent({
    type: 'settings_changed',
    userId: record.userId,
    message: `作废证件 ${record.certificateNumber}`,
    metadata: { certificateId },
  });

  return { ok: true, value: undefined };
}

/** 由通过考试的记录推导专项能力认证清单 */
export function deriveCertifications(attempts: ExamAttempt[]): string[] {
  const set = new Set<string>();

  for (const attempt of attempts) {
    if (attempt.mode !== 'official' || attempt.status !== 'submitted') {
      continue;
    }
    if (!attempt.result?.passed) {
      continue;
    }
    for (const certification of attempt.result.certificationsAwarded) {
      set.add(certification);
    }
  }

  return [...set];
}
