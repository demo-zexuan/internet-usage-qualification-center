/**
 * 权限计算引擎
 *
 * I. 计算原则
 *
 * 1. 权限不通过页面隐藏判定，全部由本模块统一计算
 * 2. 高级等级默认继承低级等级权限：`effectiveLevelOrder >= requiredLevelOrder` 即解锁
 * 3. 权限可通过 `grantedLevelIds` 指定显式授权等级清单，此时忽略继承规则
 * 4. 权限可通过 `requiredCertifications` 要求专项能力认证，与等级条件同时存在时取「同时满足」
 * 5. 只有「已作废」的证件失去效力；被更高级证件替代的历史证件仍证明对应等级已取得，
 *    因此任何考试失败都不会降低使用者已获得的权限
 *
 * II. 纯前端边界
 *
 * 1. 全部权限均为应用内的虚构授权，不影响真实网络连接
 * 2. 本模块只回答「本平台的模拟页面是否开放」，不回答任何真实权限问题
 *
 * @module features/permissions/engine
 * @author zexuan.peng
 * @created 2026-10-14
 */

import type { CertificateRecord } from '@/types/certificate';
import type { LevelsConfig } from '@/types/level';
import type {
  PermissionContext,
  PermissionDefinition,
  PermissionState,
  PermissionsConfig,
} from '@/types/permission';

import { findLevelById, getLevelOrder, getTemporaryLevel } from '@/features/levels/service';

/** 构造权限计算上下文的输入 */
export interface PermissionContextInput {
  levels: LevelsConfig;
  /** 该使用者的全部证件（含已被替代的历史证件） */
  certificates: CertificateRecord[];
  /** 已获得的专项能力认证标识 */
  certifications: string[];
}

/**
 * 构造权限计算上下文
 *
 * 1. 有效等级取「未被作废」证件中的最高等级
 * 2. 没有任何有效证件时进入临时浏览状态，有效等级序号为 0
 */
export function buildPermissionContext(input: PermissionContextInput): PermissionContext {
  const usableCertificates = input.certificates.filter(
    (certificate) => certificate.status !== 'revoked',
  );

  const validCertificateLevelIds = [
    ...new Set(usableCertificates.map((certificate) => certificate.levelId)),
  ];

  const effectiveLevelOrder = usableCertificates.reduce((max, certificate) => {
    const order = certificate.levelOrder || getLevelOrder(input.levels, certificate.levelId);
    return Math.max(max, order);
  }, 0);

  const highestCertificate = usableCertificates.reduce<CertificateRecord | null>(
    (best, certificate) => {
      if (!best) {
        return certificate;
      }
      const currentOrder = certificate.levelOrder || getLevelOrder(input.levels, certificate.levelId);
      const bestOrder = best.levelOrder || getLevelOrder(input.levels, best.levelId);
      return currentOrder > bestOrder ? certificate : best;
    },
    null,
  );

  const effectiveLevelId =
    highestCertificate?.levelId ??
    (effectiveLevelOrder > 0 ? null : (getTemporaryLevel(input.levels)?.levelId ?? null));

  return {
    effectiveLevelId,
    effectiveLevelOrder,
    isTemporary: usableCertificates.length === 0,
    validCertificateLevelIds,
    certifications: [...new Set(input.certifications)],
  };
}

/** 判断单条权限是否解锁 */
export function isPermissionUnlocked(
  context: PermissionContext,
  definition: PermissionDefinition,
): boolean {
  // I. 专项能力认证条件：必须全部满足
  const requiredCertifications = definition.requiredCertifications ?? [];
  if (requiredCertifications.length > 0) {
    const owned = new Set(context.certifications);
    if (!requiredCertifications.every((certification) => owned.has(certification))) {
      return false;
    }
  }

  // II. 显式授权等级清单：以清单为准，忽略继承
  if (definition.grantedLevelIds && definition.grantedLevelIds.length > 0) {
    return definition.grantedLevelIds.some((levelId) =>
      context.validCertificateLevelIds.includes(levelId),
    );
  }

  // III. 默认按等级序号继承
  return context.effectiveLevelOrder >= definition.requiredLevelOrder;
}

/**
 * 统一权限判定入口
 *
 * @param context - 权限计算上下文
 * @param permissionId - 权限 ID
 * @param config - 权限配置
 * @returns 是否解锁；权限 ID 不存在时返回 false
 */
export function hasPermission(
  context: PermissionContext,
  permissionId: string,
  config: PermissionsConfig,
): boolean {
  const definition = findPermission(config, permissionId);
  if (!definition) {
    return false;
  }
  return isPermissionUnlocked(context, definition);
}

/** 按 ID 查找权限定义 */
export function findPermission(
  config: PermissionsConfig,
  permissionId: string,
): PermissionDefinition | null {
  return config.permissions.find((permission) => permission.permissionId === permissionId) ?? null;
}

/** 计算单条权限的完整状态 */
export function computePermissionState(
  context: PermissionContext,
  definition: PermissionDefinition,
  levels: LevelsConfig,
): PermissionState {
  const unlocked = isPermissionUnlocked(context, definition);
  const remainingLevels = Math.max(0, definition.requiredLevelOrder - context.effectiveLevelOrder);

  let lockedReason: string | null = null;
  if (!unlocked) {
    const requiredCertifications = definition.requiredCertifications ?? [];
    const missingCertifications = requiredCertifications.filter(
      (certification) => !context.certifications.includes(certification),
    );

    if (missingCertifications.length > 0 && remainingLevels === 0) {
      lockedReason = '尚未取得该权限要求的专项能力认证。';
    } else if (context.isTemporary) {
      lockedReason = `当前处于临时浏览状态，需先取得 ${describeRequiredLevel(levels, definition.requiredLevelOrder)}。`;
    } else {
      lockedReason = `当前等级低于该权限要求，还需提升 ${remainingLevels} 级。`;
    }
  }

  return {
    definition,
    unlocked,
    lockedReason,
    currentLevelOrder: context.effectiveLevelOrder,
    requiredLevelOrder: definition.requiredLevelOrder,
    remainingLevels,
  };
}

/** 描述某个等级序号的名称，用于提示文案 */
function describeRequiredLevel(levels: LevelsConfig, order: number): string {
  const level = levels.levels.find((item) => item.order === order);
  return level ? `${level.nameZh}（${level.levelId}）` : `等级 ${order}`;
}

/** 计算全部权限的状态 */
export function computeAllPermissionStates(
  context: PermissionContext,
  permissionsConfig: PermissionsConfig,
  levels: LevelsConfig,
): PermissionState[] {
  return permissionsConfig.permissions.map((definition) =>
    computePermissionState(context, definition, levels),
  );
}

/** 取得当前已解锁的全部权限 */
export function getUnlockedPermissions(
  context: PermissionContext,
  permissionsConfig: PermissionsConfig,
): PermissionDefinition[] {
  return permissionsConfig.permissions.filter((definition) =>
    isPermissionUnlocked(context, definition),
  );
}

/** 按分组统计权限解锁情况，用于权限中心的进度展示 */
export function summarizePermissionGroups(states: PermissionState[]): {
  group: string;
  total: number;
  unlocked: number;
}[] {
  const map = new Map<string, { group: string; total: number; unlocked: number }>();

  for (const state of states) {
    const key = state.definition.group;
    const entry = map.get(key) ?? { group: key, total: 0, unlocked: 0 };
    entry.total += 1;
    if (state.unlocked) {
      entry.unlocked += 1;
    }
    map.set(key, entry);
  }

  return [...map.values()];
}

/** 校验上下文的当前等级定义（用于界面展示） */
export function resolveCurrentLevel(
  context: PermissionContext,
  levels: LevelsConfig,
): { levelId: string; nameZh: string; order: number } {
  if (context.isTemporary) {
    const temporary = getTemporaryLevel(levels);
    return {
      levelId: temporary?.levelId ?? 'L0',
      nameZh: temporary?.nameZh ?? '临时浏览状态',
      order: 0,
    };
  }

  const level = findLevelById(levels, context.effectiveLevelId);
  return {
    levelId: level?.levelId ?? 'L0',
    nameZh: level?.nameZh ?? '临时浏览状态',
    order: level?.order ?? context.effectiveLevelOrder,
  };
}
