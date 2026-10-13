/**
 * 权限体系类型定义
 *
 * I. 权限计算原则
 *
 * 1. 权限不通过页面隐藏判定，统一由 features/permissions 模块计算
 * 2. 高级等级默认继承低级等级权限：`requiredLevelOrder` 小于等于当前有效等级序号即解锁
 * 3. 若权限声明了 `grantedLevelIds`，则以显式清单为准，忽略继承
 *
 * II. 纯前端边界
 *
 * 1. 所有权限均为应用内的虚构授权，只影响本应用的模拟页面与交互
 * 2. 权限对象必须携带 `simulated` 与 `disclaimer`，界面需原样展示免责说明
 *
 * @module types/permission
 * @author zexuan.peng
 * @created 2026-10-14
 */

import type { DataSource } from './common';

/** 权限分组，用于权限中心分区展示 */
export const PERMISSION_GROUPS = [
  'basic',
  'interaction',
  'publishing',
  'retrieval',
  'cross_border',
  'certification',
] as const;

export type PermissionGroup = (typeof PERMISSION_GROUPS)[number];

export const PERMISSION_GROUP_LABELS: Record<PermissionGroup, string> = {
  basic: '基础访问权限',
  interaction: '互动交流权限',
  publishing: '内容发布权限',
  retrieval: '信息检索权限',
  cross_border: '跨域访问权限',
  certification: '能力认证',
};

/** 单条权限定义 */
export interface PermissionDefinition {
  /** 权限 ID，例如 browse_internet */
  permissionId: string;
  group: PermissionGroup;
  /** 权限名称 */
  name: string;
  /** 权限说明 */
  description: string;
  /** 解锁条件说明 */
  unlockCondition: string;
  /** 升级建议，未解锁时展示 */
  upgradeAdvice: string;
  /** 解锁所需的最低等级序号；0 表示无需任何资格 */
  requiredLevelOrder: number;
  /** 显式授权等级清单；非空时忽略继承规则 */
  grantedLevelIds?: string[];
  /**
   * 解锁所需的专项能力认证标识
   *
   * 非空时必须全部满足；与等级条件同时存在时取「同时满足」。
   * 用于「信息辨别能力认证」「网络安全能力认证」这类由专项考试而非等级授予的权限。
   */
  requiredCertifications?: string[];
  /** 是否为模拟权限（只影响本应用内部） */
  simulated: boolean;
  /** 对应的应用内入口路由；无入口时为 null */
  route: string | null;
  /** 免责声明，界面必须原样展示 */
  disclaimer: string;
}

/** permissions.json 顶层结构 */
export interface PermissionsConfig {
  schemaVersion: string;
  configId: string;
  version: string;
  title: string;
  description: string;
  updatedAt?: string;
  /** 全局免责声明 */
  globalDisclaimer: string;
  permissions: PermissionDefinition[];
}

/** 落库的权限配置记录 */
export interface PermissionsRecord extends PermissionsConfig {
  source: DataSource;
  importedAt: number;
  rawJson: string;
}

/** 权限的运行时状态 */
export interface PermissionState {
  definition: PermissionDefinition;
  /** 当前是否解锁 */
  unlocked: boolean;
  /** 未解锁时的原因说明 */
  lockedReason: string | null;
  /** 当前有效等级序号 */
  currentLevelOrder: number;
  /** 解锁所需的等级序号 */
  requiredLevelOrder: number;
  /** 还差多少级 */
  remainingLevels: number;
}

/** 权限计算上下文 */
export interface PermissionContext {
  /** 当前有效等级 ID（无任何有效证件时为 null，表示临时浏览状态） */
  effectiveLevelId: string | null;
  /** 当前有效等级序号，无证件时为 0 */
  effectiveLevelOrder: number;
  /** 是否处于临时浏览状态（尚未取得 L1 证件） */
  isTemporary: boolean;
  /** 用户持有的全部有效证件等级 ID */
  validCertificateLevelIds: string[];
  /** 用户已获得的专项能力认证 */
  certifications: string[];
}
