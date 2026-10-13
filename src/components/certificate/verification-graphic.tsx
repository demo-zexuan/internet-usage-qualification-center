/**
 * 证件校验图形
 *
 * I. 性质声明
 *
 * 1. 本图形是**装饰性图案**，不是可扫描的二维码，不含任何可解码数据
 * 2. 图案由证件编号与校验码确定性推导，同一张证件每次渲染完全一致
 * 3. 本平台未部署任何在线核验服务，第三方无法通过该图形核验证件真伪
 *
 * II. 无障碍
 *
 * 1. 图形对屏幕阅读器隐藏（aria-hidden），由旁边的文字说明承担信息传达
 * 2. 校验码以等宽字体单独展示，便于人工比对
 *
 * @module components/certificate/verification-graphic
 * @author zexuan.peng
 * @created 2026-10-14
 */

import * as React from 'react';

import { buildVerificationGraphic } from '@/features/certificates/service';
import { cn } from '@/utils/cn';

/** 校验图形属性 */
export interface VerificationGraphicProps {
  certificateNumber: string;
  checksum: string;
  /** 渲染尺寸（像素） */
  size?: number;
  className?: string;
}

/** 证件校验图形 */
export function VerificationGraphic({
  certificateNumber,
  checksum,
  size = 96,
  className,
}: VerificationGraphicProps): React.ReactElement {
  const graphic = React.useMemo(
    () => buildVerificationGraphic(certificateNumber, checksum),
    [certificateNumber, checksum],
  );

  const cellSize = size / graphic.size;

  return (
    <figure className={cn('flex flex-col items-center gap-1.5', className)}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label="证件编号校验图形（装饰性图案，不可扫描）"
        className="rounded border border-line bg-white p-0.5"
      >
        <rect width={size} height={size} fill="#ffffff" />
        {[...graphic.cells].map((cell) => {
          const [rowText, columnText] = cell.split('-');
          const row = Number(rowText);
          const column = Number(columnText);
          return (
            <rect
              key={cell}
              x={column * cellSize}
              y={row * cellSize}
              width={cellSize}
              height={cellSize}
              fill="#17365D"
            />
          );
        })}
      </svg>

      <figcaption className="text-center">
        <span className="doc-code block text-[10px] font-semibold text-ink-soft">
          {checksum}
        </span>
        <span className="block text-[9px] leading-tight text-ink-faint">
          本地校验图形 · 不可扫描
        </span>
      </figcaption>
    </figure>
  );
}
