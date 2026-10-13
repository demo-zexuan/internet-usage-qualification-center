/**
 * 机构标识（IUQA 徽记）
 *
 * 纯 SVG 绘制的虚构机构徽记：盾形外框 + 校验对勾 + 双环刻度。
 * 不使用任何真实政府机关、真实机构或真实证件的图案元素。
 *
 * @module components/layout/emblem
 * @author zexuan.peng
 * @created 2026-10-14
 */

import * as React from 'react';

import { cn } from '@/utils/cn';

/** 徽记属性 */
export interface EmblemProps {
  /** 尺寸（像素） */
  size?: number;
  className?: string;
  /** 是否使用浅色描边（用于深色导航栏） */
  inverted?: boolean;
}

/** 机构徽记 */
export function Emblem({ size = 36, className, inverted = false }: EmblemProps): React.ReactElement {
  const ring = inverted ? '#C0D3E8' : 'var(--iuqa-brand)';
  const shield = inverted ? '#FFFFFF' : 'var(--iuqa-brand)';
  const check = inverted ? '#E29AA0' : 'var(--iuqa-accent)';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="互联网使用资格考试中心徽记"
      className={cn('shrink-0', className)}
    >
      <circle cx="32" cy="32" r="29" fill="none" stroke={ring} strokeWidth="1" opacity="0.4" />
      <circle cx="32" cy="32" r="24" fill="none" stroke={ring} strokeWidth="0.8" opacity="0.25" />
      <path
        d="M32 8 L50 15 V33 C50 43.5 42.2 51 32 54 C21.8 51 14 43.5 14 33 V15 Z"
        fill="none"
        stroke={shield}
        strokeWidth="2.6"
        strokeLinejoin="round"
      />
      <path
        d="M24 32.5 L29.5 38 L41 26"
        fill="none"
        stroke={check}
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
