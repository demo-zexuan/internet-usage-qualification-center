/**
 * 移动端底部导航
 *
 * I. 设计约束
 *
 * 1. 最多五项，图标 + 文字，触控区域高度不低于 56px，便于单手操作
 * 2. 固定于视口底部，并为内容区预留安全区高度
 *
 * II. 无障碍
 *
 * 1. 使用 nav + aria-label，当前页通过 aria-current 标注
 * 2. 图标均带 aria-hidden，名称由文字承担
 *
 * @module components/layout/mobile-nav
 * @author zexuan.peng
 * @created 2026-10-14
 */

import * as React from 'react';
import { NavLink } from 'react-router-dom';

import { MOBILE_NAV } from '@/app/navigation';
import { cn } from '@/utils/cn';

/** 移动端底部导航 */
export function MobileNav(): React.ReactElement {
  return (
    <nav
      aria-label="移动端底部导航"
      className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="flex items-stretch">
        {MOBILE_NAV.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.to} className="flex-1">
              <NavLink
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-[56px] flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] transition-colors',
                    isActive ? 'font-medium text-brand' : 'text-ink-faint',
                  )
                }
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
