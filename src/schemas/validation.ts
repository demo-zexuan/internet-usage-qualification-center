/**
 * 校验基础设施
 *
 * I. 职责
 *
 * 1. 将 Zod 的 issue 列表转换为面向用户的、带字段路径的可读错误
 * 2. 提供统一的「校验后返回 Result」入口，避免各处重复 try/catch
 *
 * II. 错误路径约定
 *
 * 1. 路径以属性名与数组下标拼接，例如 `questions[3].answer.correctOptionIds`
 * 2. 该路径直接用于管理页面的错误列表，必须与原始 JSON 结构一一对应
 *
 * @module schemas/validation
 * @author zexuan.peng
 * @created 2026-10-14
 */

import { z } from 'zod';

import type { Result } from '@/types/common';

/** 单条校验错误 */
export interface ValidationIssue {
  /** 字段路径，例如 questions[3].answer.correctOptionIds */
  path: string;
  /** 面向用户的中文说明 */
  message: string;
  /** Zod 错误码，便于测试断言 */
  code: string;
}

/** 校验失败信息 */
export interface ValidationFailure {
  /** 概要说明 */
  summary: string;
  /** 具体错误条目 */
  issues: ValidationIssue[];
}

/** 将 Zod 的路径数组格式化为可读路径字符串 */
export function formatIssuePath(path: readonly PropertyKey[]): string {
  if (path.length === 0) {
    return '(根对象)';
  }

  return path.reduce<string>((acc, segment) => {
    if (typeof segment === 'number') {
      return `${acc}[${segment}]`;
    }
    return acc.length === 0 ? String(segment) : `${acc}.${String(segment)}`;
  }, '');
}

/** 将 ZodError 转换为可读错误列表 */
export function collectIssues(error: z.ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    path: formatIssuePath(issue.path),
    message: issue.message,
    code: String(issue.code),
  }));
}

/**
 * 使用给定 Zod schema 解析未知数据
 *
 * @param schema - 目标 Zod schema
 * @param raw - 待校验的原始数据
 * @param summary - 校验失败时的概要文案
 * @returns 成功时返回强类型数据，失败时返回可读错误列表
 */
export function parseWithSchema<T>(
  schema: z.ZodType<T>,
  raw: unknown,
  summary: string,
): Result<T, ValidationFailure> {
  const parsed = schema.safeParse(raw);

  if (parsed.success) {
    return { ok: true, value: parsed.data };
  }

  return {
    ok: false,
    error: {
      summary,
      issues: collectIssues(parsed.error),
    },
  };
}

/**
 * 安全解析 JSON 文本
 *
 * @param text - JSON 文本
 * @returns 成功时返回解析后的值，失败时返回带位置的错误说明
 */
export function safeJsonParse(text: string): Result<unknown, ValidationFailure> {
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知解析错误';
    return {
      ok: false,
      error: {
        summary: 'JSON 文本无法解析',
        issues: [{ path: '(整个文件)', message, code: 'invalid_json' }],
      },
    };
  }
}
