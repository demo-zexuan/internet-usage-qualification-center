/**
 * 异步操作钩子
 *
 * 统一处理「执行中 / 成功 / 失败」三态，避免每个页面各写一套 pending 与 error 逻辑。
 * 失败时保留结构化错误信息，供 ErrorState 组件展示可读说明与技术细节。
 *
 * @module hooks/use-async-action
 * @author zexuan.peng
 * @created 2026-10-14
 */

import * as React from 'react';

import type { AppError, Result } from '@/types/common';

/** 异步操作状态 */
export interface AsyncActionState<T> {
  pending: boolean;
  /** 最近一次成功的结果 */
  data: T | null;
  /** 最近一次失败的错误 */
  error: AppError | null;
}

/** 异步操作钩子返回值 */
export interface AsyncActionApi<TArgs extends unknown[], TResult> extends AsyncActionState<TResult> {
  /**
   * 执行操作
   *
   * 直接返回本次调用的 Result，而不是只返回布尔值。
   * 原因：调用方在 `await run()` 之后读取的 `data` 来自上一次渲染的闭包，
   * 首次调用时必然为 null；返回 Result 可以让调用方拿到本次的真实结果。
   *
   * @returns 本次执行结果；组件已卸载时返回 null
   */
  run: (...args: TArgs) => Promise<Result<TResult, AppError> | null>;
  /** 重置状态 */
  reset: () => void;
  /** 手动设置错误（用于校验失败等场景） */
  setError: (error: AppError | null) => void;
}

/**
 * 包装一个返回 Result 的异步操作
 *
 * @param operation - 业务操作
 * @returns 状态与执行函数
 */
export function useAsyncAction<TArgs extends unknown[], TResult>(
  operation: (...args: TArgs) => Promise<Result<TResult, AppError>>,
): AsyncActionApi<TArgs, TResult> {
  const [state, setState] = React.useState<AsyncActionState<TResult>>({
    pending: false,
    data: null,
    error: null,
  });

  // 组件卸载后不再写入状态，避免 React 警告
  const mounted = React.useRef(true);
  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const operationRef = React.useRef(operation);
  operationRef.current = operation;

  const run = React.useCallback(
    async (...args: TArgs): Promise<Result<TResult, AppError> | null> => {
      setState((current) => ({ ...current, pending: true, error: null }));

      let result: Result<TResult, AppError>;

      try {
        result = await operationRef.current(...args);
      } catch (error) {
        result = {
          ok: false,
          error: {
            code: 'UNKNOWN',
            message: '操作执行时发生未预期的错误。',
            hint: '请重试；若问题持续存在，请刷新页面后重新操作。',
            details: [error instanceof Error ? error.message : String(error)],
          },
        };
      }

      if (!mounted.current) {
        return result;
      }

      setState(
        result.ok
          ? { pending: false, data: result.value, error: null }
          : { pending: false, data: null, error: result.error },
      );

      return result;
    },
    [],
  );

  const reset = React.useCallback(() => {
    setState({ pending: false, data: null, error: null });
  }, []);

  const setError = React.useCallback((error: AppError | null) => {
    setState((current) => ({ ...current, error }));
  }, []);

  return { ...state, run, reset, setError };
}
