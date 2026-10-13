/**
 * 标识符与随机种子生成
 *
 * I. 标识符
 *
 * 1. 优先使用 crypto.randomUUID，降级到时间戳 + 随机串
 * 2. 所有业务主键（档案、考试记录、证件）均由本模块生成，保证格式统一
 *
 * II. 随机种子
 *
 * 1. 每场考试生成独立种子并写入试卷快照，便于按种子复现同一份试卷
 *
 * @module utils/id
 * @author zexuan.peng
 * @created 2026-10-14
 */

/** 生成随机字符串（仅使用大写字母与数字，避免歧义字符） */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * 生成指定长度的随机串
 *
 * 使用 crypto.getRandomValues 时分布均匀；不可用时降级到 Math.random。
 */
export function randomString(length: number): string {
  const values = new Uint32Array(length);
  let filled = false;

  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(values);
    filled = true;
  }

  let result = '';
  for (let index = 0; index < length; index += 1) {
    const value = filled ? (values[index] ?? 0) : Math.floor(Math.random() * 0xffffffff);
    result += ALPHABET[value % ALPHABET.length];
  }
  return result;
}

/** 生成带前缀的业务主键 */
export function createId(prefix: string): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `${prefix}_${globalThis.crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now().toString(36)}${randomString(10)}`;
}

/** 生成考试随机种子 */
export function createSeed(): string {
  return `${Date.now().toString(36).toUpperCase()}-${randomString(8)}`;
}

/** 生成考生编号，形如 IUQA-C-4F7K2M */
export function createCandidateNumber(): string {
  return `IUQA-C-${randomString(6)}`;
}

/** 生成试卷 ID */
export function createPaperId(): string {
  return createId('paper');
}

/** 生成考试记录 ID */
export function createAttemptId(): string {
  return createId('attempt');
}

/** 生成证件 ID */
export function createCertificateId(): string {
  return createId('cert');
}
