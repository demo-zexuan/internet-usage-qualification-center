/**
 * 可复现的伪随机数工具
 *
 * I. 存在意义
 *
 * 1. 试卷抽题与选项随机化必须可由种子完全复现，便于调试与成绩复核
 * 2. 使用 xmur3 哈希 + mulberry32 生成器，实现简单且分布足够均匀
 *
 * II. 用法
 *
 * ```ts
 * const random = createSeededRandom('SEED-2026');
 * const shuffled = shuffle([1, 2, 3, 4], random);
 * ```
 *
 * @module utils/random
 * @author zexuan.peng
 * @created 2026-10-14
 */

/** 随机数生成器签名 */
export type RandomSource = () => number;

/** 将字符串种子哈希为 32 位整数序列 */
function xmur3(seed: string): () => number {
  let h = 1779033703 ^ seed.length;

  for (let index = 0; index < seed.length; index += 1) {
    h = Math.imul(h ^ seed.charCodeAt(index), 3432918353);
    h = (h << 13) | (h >>> 19);
  }

  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

/** mulberry32 伪随机数生成器 */
function mulberry32(seedValue: number): RandomSource {
  let a = seedValue;

  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 由字符串种子创建可复现的随机源
 *
 * @param seed - 随机种子
 * @returns 返回 [0, 1) 区间浮点数的函数
 */
export function createSeededRandom(seed: string): RandomSource {
  const hashed = xmur3(seed);
  return mulberry32(hashed());
}

/**
 * 使用给定随机源打乱数组（Fisher-Yates）
 *
 * 不修改原数组，返回新数组。
 *
 * @param items - 待打乱的数组
 * @param random - 随机源
 */
export function shuffle<T>(items: readonly T[], random: RandomSource): T[] {
  const result = [...items];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const current = result[index] as T;
    const target = result[swapIndex] as T;
    result[index] = target;
    result[swapIndex] = current;
  }

  return result;
}
