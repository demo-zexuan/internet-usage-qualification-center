/**
 * 状态指示组件
 *
 * I. 无障碍原则
 *
 * 1. 状态绝不只用颜色表示：等级徽章带等级代号与中文名，结果徽章带文字结论
 * 2. 颜色仅作为辅助强化，去掉颜色后信息依然完整
 *
 * II. 等级配色
 *
 * 使用 index.css 中定义的 --color-level-* 令牌，全站等级配色统一。
 *
 * @module components/common/indicators
 * @author zexuan.peng
 * @created 2026-10-14
 */

import { Award, BadgeCheck, CircleAlert, CircleCheck, CircleX, MinusCircle } from 'lucide-react';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import type { LevelDefinition } from '@/types/level';
import { cn } from '@/utils/cn';

/** 等级令牌对应的样式类（静态书写，保证 Tailwind 能扫描到） */
const LEVEL_TONE: Record<string, string> = {
  'level-1': 'border-level-1/40 bg-level-1/10 text-level-1',
  'level-2': 'border-level-2/40 bg-level-2/10 text-level-2',
  'level-3': 'border-level-3/40 bg-level-3/10 text-level-3',
  'level-4': 'border-level-4/40 bg-level-4/10 text-level-4',
  'level-5': 'border-level-5/40 bg-level-5/10 text-level-5',
  'level-6': 'border-level-6/40 bg-level-6/10 text-level-6',
};

/** 等级徽章属性 */
export interface LevelBadgeProps {
  level: LevelDefinition;
  /** 是否显示中文等级名称 */
  showName?: boolean;
  /** 是否显示为「未认证」样式 */
  temporary?: boolean;
  size?: 'sm' | 'default' | 'lg';
  className?: string;
}

/** 等级徽章 */
export function LevelBadge({
  level,
  showName = true,
  temporary = false,
  size = 'default',
  className,
}: LevelBadgeProps): React.ReactElement {
  const tone = temporary
    ? 'border-line bg-surface-muted text-ink-soft'
    : (LEVEL_TONE[level.badgeColorToken] ?? LEVEL_TONE['level-1']);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded border font-medium',
        size === 'lg' ? 'px-2.5 py-1 text-sm' : size === 'sm' ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-0.5 text-xs',
        tone,
        className,
      )}
    >
      <Award className={size === 'lg' ? 'h-4 w-4' : 'h-3.5 w-3.5'} aria-hidden="true" />
      <span className="doc-code font-semibold">{level.levelId}</span>
      {showName ? <span>{level.nameZh}</span> : null}
      {temporary ? <span className="text-ink-faint">（未认证）</span> : null}
    </span>
  );
}

/** 考试结果徽章 */
export function ResultBadge({
  passed,
  size = 'default',
}: {
  passed: boolean;
  size?: 'sm' | 'default' | 'lg';
}): React.ReactElement {
  return (
    <Badge variant={passed ? 'pass' : 'fail'} size={size}>
      {passed ? (
        <CircleCheck className="h-3.5 w-3.5" aria-hidden="true" />
      ) : (
        <CircleX className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      {passed ? '通过' : '未通过'}
    </Badge>
  );
}

/** 单题作答状态徽章 */
export function AnswerStatusBadge({
  status,
}: {
  status: 'correct' | 'wrong' | 'unanswered' | 'partial';
}): React.ReactElement {
  switch (status) {
    case 'correct':
      return (
        <Badge variant="pass">
          <CircleCheck className="h-3.5 w-3.5" aria-hidden="true" />
          正确
        </Badge>
      );
    case 'partial':
      return (
        <Badge variant="warn">
          <MinusCircle className="h-3.5 w-3.5" aria-hidden="true" />
          部分得分
        </Badge>
      );
    case 'unanswered':
      return (
        <Badge variant="outline">
          <CircleAlert className="h-3.5 w-3.5" aria-hidden="true" />
          未作答
        </Badge>
      );
    case 'wrong':
    default:
      return (
        <Badge variant="fail">
          <CircleX className="h-3.5 w-3.5" aria-hidden="true" />
          错误
        </Badge>
      );
  }
}

/** 证件状态徽章 */
export function CertificateStatusBadge({
  status,
  label,
}: {
  status: 'valid' | 'superseded' | 'revoked';
  label: string;
}): React.ReactElement {
  const variant = status === 'valid' ? 'pass' : status === 'superseded' ? 'neutral' : 'fail';
  return (
    <Badge variant={variant}>
      <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </Badge>
  );
}

/** 数据来源徽章：区分内置与导入数据 */
export function SourceBadge({ source }: { source: 'builtin' | 'imported' | 'restored' }): React.ReactElement {
  const map = {
    builtin: { variant: 'info' as const, label: '内置示例' },
    imported: { variant: 'brand' as const, label: '本地导入' },
    restored: { variant: 'warn' as const, label: '已恢复内置' },
  };
  const config = map[source];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

/** 数据小卡片：用于首页与成绩页的关键指标 */
export function StatTile({
  label,
  value,
  unit,
  hint,
  tone = 'default',
  className,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  hint?: string;
  tone?: 'default' | 'pass' | 'fail' | 'brand';
  className?: string;
}): React.ReactElement {
  const valueTone =
    tone === 'pass'
      ? 'text-pass'
      : tone === 'fail'
        ? 'text-fail'
        : tone === 'brand'
          ? 'text-brand'
          : 'text-ink';

  return (
    <div className={cn('rounded-md border border-line bg-surface px-4 py-3', className)}>
      <p className="text-xs text-ink-faint">{label}</p>
      <p className={cn('tabular mt-1 text-xl font-semibold leading-tight', valueTone)}>
        {value}
        {unit ? <span className="ml-1 text-xs font-normal text-ink-faint">{unit}</span> : null}
      </p>
      {hint ? <p className="mt-1 text-[11px] leading-relaxed text-ink-faint">{hint}</p> : null}
    </div>
  );
}
