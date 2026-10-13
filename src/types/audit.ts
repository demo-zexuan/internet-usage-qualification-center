/**
 * 本地操作审计事件类型定义
 *
 * 审计事件仅保存在本机 IndexedDB，用于展示操作历史与排查问题，
 * 不构成任何安全审计能力，也不作为权限判定依据。
 *
 * @module types/audit
 * @author zexuan.peng
 * @created 2026-10-14
 */

export const AUDIT_EVENT_TYPES = [
  'profile_created',
  'profile_updated',
  'profile_reset',
  'exam_started',
  'exam_resumed',
  'exam_submitted',
  'exam_auto_submitted',
  'exam_abandoned',
  'certificate_issued',
  'bank_imported',
  'bank_import_failed',
  'bank_exported',
  'bank_restored',
  'rules_imported',
  'rules_import_failed',
  'rules_restored',
  'data_exported',
  'data_cleared',
  'settings_changed',
] as const;

export type AuditEventType = (typeof AUDIT_EVENT_TYPES)[number];

export const AUDIT_EVENT_LABELS: Record<AuditEventType, string> = {
  profile_created: '建立本地档案',
  profile_updated: '更新档案信息',
  profile_reset: '重置本地档案',
  exam_started: '开始考试',
  exam_resumed: '恢复考试',
  exam_submitted: '提交试卷',
  exam_auto_submitted: '超时自动交卷',
  exam_abandoned: '放弃考试',
  certificate_issued: '签发电子证件',
  bank_imported: '导入题库成功',
  bank_import_failed: '导入题库失败',
  bank_exported: '导出题库',
  bank_restored: '恢复内置题库',
  rules_imported: '导入考试规则成功',
  rules_import_failed: '导入考试规则失败',
  rules_restored: '恢复内置考试规则',
  data_exported: '导出个人数据',
  data_cleared: '清除本地模拟数据',
  settings_changed: '修改应用设置',
};

/** 审计事件记录 */
export interface AuditEventRecord {
  /** 自增主键，由 Dexie 生成 */
  id?: number;
  type: AuditEventType;
  /** 事件发生时间（Unix 毫秒） */
  at: number;
  /** 关联的档案 ID；与档案无关的操作（如题库导入）为 null */
  userId: string | null;
  /** 面向用户的简短说明 */
  message: string;
  /** 结构化附加信息（不得包含敏感数据） */
  metadata?: Record<string, unknown>;
}

/** 审计事件查询条件 */
export interface AuditQuery {
  type?: AuditEventType;
  userId?: string;
  limit?: number;
}
