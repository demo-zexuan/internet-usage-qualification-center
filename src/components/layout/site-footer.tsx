/**
 * 站点页脚
 *
 * 必须展示机构声明、虚构性质说明与版本号。
 * 该声明是项目边界的一部分，不得省略或弱化。
 *
 * @module components/layout/site-footer
 * @author zexuan.peng
 * @created 2026-10-14
 */

import * as React from 'react';
import { Link } from 'react-router-dom';

import {
  APP_ABBR,
  APP_DATA_VERSION,
  APP_MOTTO,
  APP_NAME_EN,
  APP_NAME_ZH,
  APP_VERSION,
  INSTITUTION_STATEMENT,
} from '@/app/app-meta';
import { Emblem } from '@/components/layout/emblem';

/** 站点页脚 */
export function SiteFooter(): React.ReactElement {
  return (
    <footer className="no-print mt-10 border-t border-line bg-surface">
      <div className="mx-auto w-full max-w-[1600px] px-4 py-8 lg:px-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          {/* I. 机构标识 */}
          <div className="flex max-w-md items-start gap-3">
            <Emblem size={40} />
            <div>
              <p className="text-sm font-semibold text-ink">{APP_NAME_ZH}</p>
              <p className="text-[11px] uppercase tracking-[0.14em] text-ink-faint">
                {APP_NAME_EN} · {APP_ABBR}
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{APP_MOTTO}</p>
            </div>
          </div>

          {/* II. 机构声明 */}
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
              机构声明
            </p>
            <ul className="mt-2 flex flex-col gap-1.5">
              {INSTITUTION_STATEMENT.map((statement) => (
                <li key={statement} className="text-[12px] leading-relaxed text-ink-soft">
                  {statement}
                </li>
              ))}
            </ul>
          </div>

          {/* III. 快捷入口 */}
          <nav aria-label="页脚导航" className="text-[12px]">
            <p className="font-semibold uppercase tracking-[0.14em] text-ink-faint">相关页面</p>
            <ul className="mt-2 flex flex-col gap-1.5">
              <li>
                <Link to="/exams" className="text-ink-soft underline-offset-4 hover:text-brand hover:underline">
                  考试报名
                </Link>
              </li>
              <li>
                <Link to="/permissions" className="text-ink-soft underline-offset-4 hover:text-brand hover:underline">
                  权限中心
                </Link>
              </li>
              <li>
                <Link to="/certificates" className="text-ink-soft underline-offset-4 hover:text-brand hover:underline">
                  电子证件
                </Link>
              </li>
              <li>
                <Link to="/admin" className="text-ink-soft underline-offset-4 hover:text-brand hover:underline">
                  题库管理
                </Link>
              </li>
            </ul>
          </nav>
        </div>

        {/* IV. 版本信息 */}
        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line pt-4 text-[11px] text-ink-faint">
          <span>
            应用版本 <span className="doc-code">{APP_VERSION}</span>
          </span>
          <span>
            数据版本 <span className="doc-code">{APP_DATA_VERSION}</span>
          </span>
          <span>纯前端本地应用 · 数据仅存于本机浏览器</span>
        </div>
      </div>
    </footer>
  );
}
