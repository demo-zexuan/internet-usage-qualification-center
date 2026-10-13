/**
 * 左侧业务导航
 *
 * I. 权限感知
 *
 * 1. 需要权限的条目仍会展示，但在未解锁时显示锁形图标并给出解锁提示
 * 2. 这样使用者能看见「存在但尚未开放」的功能，而不是被静默隐藏
 *
 * II. 无障碍
 *
 * 1. 使用 nav + ul/li 结构，当前页通过 aria-current 标注
 * 2. 锁定的条目仍然可点击，跳转到权限中心说明原因
 *
 * @module components/layout/side-nav
 * @author zexuan.peng
 * @created 2026-10-14
 */

import { Lock } from 'lucide-react';
import * as React from 'react';
import { NavLink } from 'react-router-dom';

import { BUSINESS_NAV } from '@/app/navigation';
import type { NavItem } from '@/app/navigation';
import { usePermission } from '@/hooks/use-user-data';
import { cn } from '@/utils/cn';

/** 单个导航条目：独立组件以便调用权限钩子 */
function NavEntry({ item }: { item: NavItem }): React.ReactElement {
  const permission = usePermission(item.permissionId ?? '__none__');
  const locked = Boolean(item.permissionId) && !permission.unlocked;
  const Icon = item.icon;

  return (
    <li>
      <NavLink
        to={item.to}
        end={item.to === '/'}
        className={({ isActive }) =>
          cn(
            'group flex items-start gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
            isActive
              ? 'bg-brand-soft font-medium text-brand'
              : 'text-ink-soft hover:bg-surface-muted hover:text-ink',
          )
        }
        aria-label={locked ? `${item.label}（尚未解锁）` : item.label}
      >
        <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate">{item.label}</span>
            {locked ? <Lock className="h-3 w-3 shrink-0 text-ink-faint" aria-hidden="true" /> : null}
          </span>
          <span className="mt-0.5 block truncate text-[11px] leading-snug text-ink-faint">
            {locked ? '尚未解锁，点击查看解锁条件' : item.description}
          </span>
        </span>
      </NavLink>
    </li>
  );
}

/** 左侧业务导航 */
export function SideNav({ className }: { className?: string }): React.ReactElement {
  return (
    <nav aria-label="业务导航" className={cn('flex flex-col gap-2', className)}>
      <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
        业务办理
      </p>
      <ul className="flex flex-col gap-0.5">
        {BUSINESS_NAV.map((item) => (
          <NavEntry key={item.to} item={item} />
        ))}
      </ul>
    </nav>
  );
}
