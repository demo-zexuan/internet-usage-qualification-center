/**
 * 等级查询服务
 *
 * I. 职责
 *
 * 1. 提供等级配置的只读查询：按 ID、按序号、取临时等级、取下一等级
 * 2. 等级文案与参数全部来自 levels.json，本模块不硬编码任何等级名称
 *
 * II. 排序约定
 *
 * 1. 等级序号 order 越大级别越高，权限继承按序号比较
 * 2. 临时浏览状态的 order 为 0，低于任何正式等级
 *
 * @module features/levels/service
 * @author zexuan.peng
 * @created 2026-10-14
 */

import type { LevelDefinition, LevelsConfig } from '@/types/level';

/** 按等级 ID 查找等级定义 */
export function findLevelById(
  config: LevelsConfig,
  levelId: string | null | undefined,
): LevelDefinition | null {
  if (!levelId) {
    return null;
  }
  return config.levels.find((level) => level.levelId === levelId) ?? null;
}

/** 按等级序号查找等级定义 */
export function findLevelByOrder(
  config: LevelsConfig,
  order: number,
): LevelDefinition | null {
  return config.levels.find((level) => level.order === order) ?? null;
}

/** 取得等级序号；未知等级返回 0（等同于无资格） */
export function getLevelOrder(config: LevelsConfig, levelId: string | null | undefined): number {
  return findLevelById(config, levelId)?.order ?? 0;
}

/** 取得临时浏览状态等级定义 */
export function getTemporaryLevel(config: LevelsConfig): LevelDefinition | null {
  return config.levels.find((level) => level.isTemporary) ?? null;
}

/** 取得入门等级定义 */
export function getEntryLevel(config: LevelsConfig): LevelDefinition | null {
  return config.levels.find((level) => level.isEntryLevel) ?? null;
}

/** 按序号倒序排列的正式等级（不含临时状态） */
export function getOfficialLevelsDesc(config: LevelsConfig): LevelDefinition[] {
  return config.levels
    .filter((level) => !level.isTemporary)
    .slice()
    .sort((a, b) => b.order - a.order);
}

/** 取得指定序号之上的下一个等级 */
export function getNextLevel(config: LevelsConfig, currentOrder: number): LevelDefinition | null {
  const candidates = config.levels
    .filter((level) => !level.isTemporary && level.order > currentOrder)
    .sort((a, b) => a.order - b.order);

  return candidates[0] ?? null;
}

/** 取得最高正式等级 */
export function getHighestLevel(config: LevelsConfig): LevelDefinition | null {
  return getOfficialLevelsDesc(config)[0] ?? null;
}

/**
 * 判断给定等级是否满足「已取得某前置等级」
 *
 * 高级等级默认继承低级等级权限，因此持有 L3 视为已满足 L1 的前置要求。
 *
 * @param config - 等级配置
 * @param currentOrder - 当前有效等级序号
 * @param prerequisiteLevelIds - 允许的前置等级 ID 列表（满足其一即可）
 */
export function satisfiesPrerequisite(
  config: LevelsConfig,
  currentOrder: number,
  prerequisiteLevelIds: string[],
): boolean {
  if (prerequisiteLevelIds.length === 0) {
    return true;
  }

  const requiredOrders = prerequisiteLevelIds
    .map((levelId) => findLevelById(config, levelId)?.order)
    .filter((order): order is number => order !== undefined);

  if (requiredOrders.length === 0) {
    // 配置引用了不存在的等级时按不满足处理，避免误放行
    return false;
  }

  return currentOrder >= Math.min(...requiredOrders);
}
