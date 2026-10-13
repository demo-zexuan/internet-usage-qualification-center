/**
 * 样式类名合并工具
 *
 * 组合 clsx 与 tailwind-merge：前者负责条件拼接，后者负责消除冲突的 Tailwind 类，
 * 使组件可以通过 className 覆盖默认样式而不产生优先级纠纷。
 *
 * @module utils/cn
 * @author zexuan.peng
 * @created 2026-10-14
 */

import { clsx } from 'clsx';
import type { ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** 合并样式类名 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
