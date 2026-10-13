/**
 * 通用类型工具
 *
 * 提供全项目复用的结果类型、品牌类型与基础元数据定义，
 * 避免各模块各自定义互不兼容的错误结构。
 *
 * @module types/common
 * @author zexuan.peng
 * @created 2026-10-14
 */

/** 统一的成功 / 失败结果类型，用于替代抛出异常的控制流 */
export type Result<T, E = AppError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

/** 构造成功结果 */
export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

/** 构造失败结果 */
export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

/** 应用内可读错误：面向用户展示，禁止携带原始堆栈 */
export interface AppError {
  /** 机器可读错误码，便于测试断言 */
  code: AppErrorCode;
  /** 面向用户的中文说明 */
  message: string;
  /** 可选的修复建议 */
  hint?: string;
  /** 可选的结构化细节（例如校验错误的字段路径） */
  details?: string[];
}

export type AppErrorCode =
  | 'INDEXED_DB_UNAVAILABLE'
  | 'DATABASE_INIT_FAILED'
  | 'PROFILE_NOT_FOUND'
  | 'PROFILE_ALREADY_EXISTS'
  | 'EXAM_NOT_FOUND'
  | 'EXAM_RULE_INVALID'
  | 'QUESTION_BANK_INVALID'
  | 'QUESTION_BANK_INSUFFICIENT'
  | 'QUESTION_BANK_EMPTY'
  | 'ATTEMPT_NOT_FOUND'
  | 'ATTEMPT_ALREADY_SUBMITTED'
  | 'ATTEMPT_EXPIRED'
  | 'CERTIFICATE_NOT_FOUND'
  | 'CERTIFICATE_ALREADY_ISSUED'
  | 'PREREQUISITE_NOT_MET'
  | 'PERMISSION_DENIED'
  | 'IMPORT_VALIDATION_FAILED'
  | 'EXPORT_UNSUPPORTED'
  | 'INVALID_ROUTE_PARAM'
  | 'UNKNOWN';

/** 数据来源标识：区分内置题库与用户导入题库 */
export type DataSource = 'builtin' | 'imported' | 'restored';

/** 带 schema 版本的持久化记录公共字段 */
export interface VersionedRecord {
  /** 记录结构版本，用于数据库迁移与兼容性判断 */
  schemaVersion: string;
  /** 记录创建时间（Unix 毫秒） */
  createdAt: number;
  /** 记录最后更新时间（Unix 毫秒） */
  updatedAt: number;
}

/** 分页查询参数 */
export interface PageQuery {
  page: number;
  pageSize: number;
}

/** 分页结果 */
export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
