/**
 * 资格等级定义
 *
 * 等级体系参考驾驶证分级思路设计，但权限内容完全独立，
 * 不映射任何真实法律权限。所有名称与参数均可由 levels.json 覆盖。
 *
 * @module types/level
 * @author zexuan.peng
 * @created 2026-10-14
 */

import type { DataSource } from './common';

/** 单个资格等级定义 */
export interface LevelDefinition {
  /** 等级 ID，例如 L1 */
  levelId: string;
  /** 等级序号，1 为最低；权限继承按序号比较 */
  order: number;
  /** 中文等级名称 */
  nameZh: string;
  /** 英文等级名称 */
  nameEn: string;
  /** 简短代号，用于徽章与表格 */
  shortName: string;
  /** 一句话定位 */
  summary: string;
  /** 完整说明，用于权限中心与证件页 */
  description: string;
  /** 徽章色令牌名，对应 index.css 中的 --color-level-* */
  badgeColorToken: string;
  /** 证件标题 */
  certificateTitle: string;
  /** 证件题词 */
  certificateMotto: string;
  /** 是否为入门等级 */
  isEntryLevel: boolean;
  /** 是否为临时状态等级（未取得任何证件时的默认展示等级） */
  isTemporary: boolean;
  /** 该等级的严肃免责声明 */
  disclaimer: string;
}

/** levels.json 顶层结构 */
export interface LevelsConfig {
  schemaVersion: string;
  configId: string;
  version: string;
  title: string;
  description: string;
  updatedAt?: string;
  levels: LevelDefinition[];
}

/** 落库的等级配置记录 */
export interface LevelsRecord extends LevelsConfig {
  source: DataSource;
  importedAt: number;
  rawJson: string;
}
