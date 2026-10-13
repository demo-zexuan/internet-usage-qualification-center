/**
 * 顶部机构导航栏
 *
 * I. 桌面端
 *
 * 1. 深海军蓝底，承载机构徽记、机构中英文名称与主导航
 * 2. 右侧展示当前等级徽章、主题切换与档案入口
 *
 * II. 移动端
 *
 * 1. 仅保留徽记、机构缩写与菜单按钮，保证导航栏高度可控
 * 2. 菜单以左侧抽屉展开，列出全部业务导航与档案信息
 *
 * @module components/layout/top-bar
 * @author zexuan.peng
 * @created 2026-10-14
 */

import { Menu, Moon, Sun, UserRound } from 'lucide-react';
import * as React from 'react';
import { Link, NavLink } from 'react-router-dom';

import { APP_ABBR, APP_NAME_EN, APP_NAME_ZH } from '@/app/app-meta';
import { BUSINESS_NAV, PRIMARY_NAV } from '@/app/navigation';
import { useTheme } from '@/app/theme-context';
import { Emblem } from '@/components/layout/emblem';
import { LevelBadge } from '@/components/common/indicators';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useUserData } from '@/hooks/use-user-data';
import { cn } from '@/utils/cn';

/** 顶部导航链接样式 */
function primaryLinkClass({ isActive }: { isActive: boolean }): string {
  return cn(
    'rounded px-3 py-1.5 text-[13px] font-medium transition-colors',
    isActive ? 'bg-white/15 text-white' : 'text-navy-100 hover:bg-white/10 hover:text-white',
  );
}

/** 顶部机构导航栏 */
export function TopBar(): React.ReactElement {
  const { theme, toggleTheme } = useTheme();
  const { summary, status } = useUserData();
  const [menuOpen, setMenuOpen] = React.useState(false);

  const level = summary?.currentLevel ?? null;

  return (
    <header className="no-print sticky top-0 z-40 border-b border-navy-900 bg-navy-800 text-white">
      <div className="mx-auto flex h-14 w-full max-w-[1600px] items-center gap-3 px-4 lg:h-16 lg:px-6">
        {/* I. 机构标识 */}
        <Link
          to="/"
          className="flex min-w-0 items-center gap-2.5"
          aria-label={`${APP_NAME_ZH} 首页`}
        >
          <Emblem size={34} inverted />
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-semibold leading-tight tracking-wide">
              {APP_NAME_ZH}
            </span>
            <span className="hidden text-[10px] uppercase leading-tight tracking-[0.16em] text-navy-200 sm:block">
              {APP_NAME_EN} · {APP_ABBR}
            </span>
          </span>
        </Link>

        {/* II. 桌面端主导航 */}
        <nav aria-label="主导航" className="ml-4 hidden items-center gap-1 lg:flex">
          {PRIMARY_NAV.map((item) => (
            <NavLink key={item.to} to={item.to} className={primaryLinkClass} end={item.to === '/'}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {/* III. 当前等级 */}
          {status === 'ready' && level ? (
            <Link
              to="/permissions"
              className="hidden rounded px-1 py-1 sm:block"
              aria-label={`当前等级：${level.nameZh}，前往权限中心`}
            >
              <LevelBadge level={level} temporary={!summary?.levelFromCertificate} size="sm" />
            </Link>
          ) : null}

          {/* IV. 主题切换 */}
          <button
            type="button"
            onClick={toggleTheme}
            className="rounded p-2 text-navy-100 transition-colors hover:bg-white/10 hover:text-white"
            aria-label={theme === 'dark' ? '切换到浅色主题' : '切换到深色主题'}
          >
            {theme === 'dark' ? (
              <Sun className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Moon className="h-4 w-4" aria-hidden="true" />
            )}
          </button>

          {/* V. 档案入口（桌面端） */}
          <Link
            to="/profile"
            className="hidden items-center gap-1.5 rounded px-2 py-1.5 text-[13px] text-navy-100 transition-colors hover:bg-white/10 hover:text-white sm:flex"
          >
            <UserRound className="h-4 w-4" aria-hidden="true" />
            <span className="max-w-[8rem] truncate">
              {status === 'ready' && summary ? summary.profile.displayName : '我的档案'}
            </span>
          </Link>

          {/* VI. 移动端菜单 */}
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="rounded p-2 text-navy-100 transition-colors hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="打开导航菜单"
            aria-expanded={menuOpen}
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* VII. 移动端抽屉 */}
      <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
        <DialogContent
          className="left-0 top-0 h-full max-h-none w-[85vw] max-w-sm translate-x-0 translate-y-0 rounded-none border-r p-0"
          showClose={false}
        >
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-line bg-navy-800 px-4 py-3 text-white">
              <DialogTitle className="text-sm font-semibold">业务导航</DialogTitle>
              <Button
                variant="ghost"
                size="sm"
                className="text-navy-100 hover:bg-white/10 hover:text-white"
                onClick={() => setMenuOpen(false)}
              >
                关闭
              </Button>
            </div>

            <nav aria-label="业务导航" className="flex-1 overflow-y-auto p-2">
              <ul className="flex flex-col gap-0.5">
                {BUSINESS_NAV.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        end={item.to === '/'}
                        onClick={() => setMenuOpen(false)}
                        className={({ isActive }) =>
                          cn(
                            'flex items-start gap-2.5 rounded-md px-3 py-2.5 text-sm transition-colors',
                            isActive
                              ? 'bg-brand-soft text-brand'
                              : 'text-ink-soft hover:bg-surface-muted hover:text-ink',
                          )
                        }
                      >
                        <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                        <span className="min-w-0">
                          <span className="block font-medium">{item.label}</span>
                          <span className="mt-0.5 block text-[11px] leading-snug text-ink-faint">
                            {item.description}
                          </span>
                        </span>
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </nav>

            <div className="border-t border-line px-4 py-3">
              <Link
                to="/profile"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 text-sm text-ink-soft"
              >
                <UserRound className="h-4 w-4" aria-hidden="true" />
                {status === 'ready' && summary ? summary.profile.displayName : '建立本地档案'}
              </Link>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
}
