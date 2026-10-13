/**
 * 应用设置与公告类型定义
 *
 * I. 存储边界
 *
 * 1. 业务设置（启用题库、启用规则、管理模式开关、公告阅读状态）保存在 IndexedDB
 * 2. localStorage 仅承载主题、侧边栏折叠等非关键 UI 偏好
 *
 * II. 管理模式声明
 *
 * 1. 本地管理模式开关只是界面便利功能，不构成安全边界
 * 2. 纯前端项目无法阻止使用者直接修改浏览器存储或前端代码
 *
 * @module types/settings
 * @author zexuan.peng
 * @created 2026-10-14
 */

/** 应用设置键 */
export type AppSettingKey =
  | 'activeRulesId'
  | 'activeBankIds'
  | 'adminMode'
  | 'onboardingCompleted'
  | 'readAnnouncementIds'
  | 'studyMaterialProgress'
  | 'examPreferences'
  | 'dataVersion';

/** 应用设置取值映射 */
export interface AppSettingValueMap {
  /** 当前启用的考试规则配置 ID */
  activeRulesId: string;
  /** 当前启用的题库 ID 列表 */
  activeBankIds: string[];
  /** 本地管理模式开关 */
  adminMode: boolean;
  /** 首次引导是否已完成 */
  onboardingCompleted: boolean;
  /** 已阅读的公告 ID 列表 */
  readAnnouncementIds: string[];
  /** 学习材料完成情况：材料 ID → 完成时间戳 */
  studyMaterialProgress: Record<string, number>;
  /** 考试界面偏好 */
  examPreferences: {
    /** 答题界面字号 */
    fontSize: 'normal' | 'large';
    /** 是否自动跳转到下一题 */
    autoAdvance: boolean;
    /** 是否在题号面板中高亮已标记题目 */
    highlightFlagged: boolean;
  };
  /** 本地数据版本，用于数据迁移与导出标识 */
  dataVersion: string;
}

/** 应用设置记录 */
export interface AppSettingRecord<K extends AppSettingKey = AppSettingKey> {
  key: K;
  value: AppSettingValueMap[K];
  updatedAt: number;
}

/** 公告定义（announcements.json） */
export interface AnnouncementDefinition {
  announcementId: string;
  /** 公告标题 */
  title: string;
  /** 发布机构科室 */
  department: string;
  /** 发布日期（ISO 日期字符串） */
  publishedAt: string;
  /** 严重程度，决定提示条样式 */
  severity: 'info' | 'notice' | 'warning';
  /** 正文段落 */
  body: string[];
  /** 是否为置顶公告 */
  pinned?: boolean;
}

/** announcements.json 顶层结构 */
export interface AnnouncementsConfig {
  schemaVersion: string;
  configId: string;
  version: string;
  title: string;
  announcements: AnnouncementDefinition[];
}

/** 学习材料定义（study-materials.json），供 L5 等专区与升级条件使用 */
export interface StudyMaterialDefinition {
  materialId: string;
  title: string;
  /** 所属专区路由 */
  route: string;
  /** 摘要 */
  summary: string;
  /** 正文段落 */
  body: string[];
  /** 参考资料链接（可选，均为外部知识说明） */
  references?: { label: string; url: string }[];
  /** 完成材料后需要确认的自查问题 */
  checkpoints: string[];
  /** 所需最低等级序号，用于权限中心提示 */
  requiredLevelOrder: number;
}

/** study-materials.json 顶层结构 */
export interface StudyMaterialsConfig {
  schemaVersion: string;
  configId: string;
  version: string;
  title: string;
  materials: StudyMaterialDefinition[];
}
