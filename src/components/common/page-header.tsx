/**
 * 页头组件
 *
 * 政务门户风格：机构层级面包屑 + 页面标题 + 说明 + 右侧操作区。
 * 移动端自动堆叠为单列，操作按钮换行显示。
 *
 * @module components/common/page-header
 * @author zexuan.peng
 * @created 2026-10-14
 */

import { ChevronRight } from 'lucide-react';
import * as React from 'react';
import { Link } from 'react-router-dom';

import { cn } from '@/utils/cn';

/** 面包屑条目 */
export interface Crumb {
  label: string;
  to?: string;
}

/** 页头属性 */
export interface PageHeaderProps {
  title: string;
  description?: React.ReactNode;
  crumbs?: Crumb[];
  actions?: React.ReactNode;
  /** 标题上方的机构标识行 */
  eyebrow?: string;
  className?: string;
}

/** 页头 */
export function PageHeader({
  title,
  description,
  crumbs,
  actions,
  eyebrow,
  className,
}: PageHeaderProps): React.ReactElement {
  return (
    <header className={cn('flex flex-col gap-3', className)}>
      {crumbs && crumbs.length > 0 ? (
        <nav aria-label="面包屑导航">
          <ol className="flex flex-wrap items-center gap-1 text-xs text-ink-faint">
            {crumbs.map((crumb, index) => (
              <li key={`${crumb.label}-${index}`} className="flex items-center gap-1">
                {index > 0 ? <ChevronRight className="h-3 w-3" aria-hidden="true" /> : null}
                {crumb.to ? (
                  <Link to={crumb.to} className="underline-offset-4 hover:text-brand hover:underline">
                    {crumb.label}
                  </Link>
                ) : (
                  <span aria-current="page">{crumb.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.14em] text-ink-faint">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="text-xl font-semibold leading-snug text-ink sm:text-2xl">{title}</h1>
          {description ? (
            <div className="mt-2 max-w-3xl text-[13px] leading-relaxed text-ink-soft">{description}</div>
          ) : null}
        </div>

        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

/** 内容区块：统一的标题 + 说明 + 内容排版 */
export function Section({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}): React.ReactElement {
  return (
    <section className={cn('flex flex-col gap-3', className)}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          {description ? (
            <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}
