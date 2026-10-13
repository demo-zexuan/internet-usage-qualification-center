/**
 * 404 页面
 *
 * 用于处理非法路由参数与不存在的地址。
 * 必须给出可执行的下一步操作，而不是只显示一行错误文字。
 *
 * @module pages/NotFoundPage
 * @author zexuan.peng
 * @created 2026-10-14
 */

import { Compass, Home } from 'lucide-react';
import * as React from 'react';
import { Link, useLocation } from 'react-router-dom';

import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

/** 404 页面 */
export function NotFoundPage(): React.ReactElement {
  const location = useLocation();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="路由错误"
        title="找不到该页面"
        description="请求的地址在当前应用中不存在，可能是链接已失效或地址输入有误。"
      />

      <Card>
        <CardContent className="flex flex-col gap-3">
          <p className="text-[13px] text-ink-soft">
            请求地址：<span className="doc-code break-all text-ink">{location.pathname}</span>
          </p>
          <p className="text-[12px] leading-relaxed text-ink-soft">
            若你是通过历史链接进入本页，该考试记录或证件可能已随本地数据清除而删除。
            可先前往考试历史页面确认现有记录。
          </p>

          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link to="/">
                <Home className="h-4 w-4" aria-hidden="true" />
                返回首页
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/exams">
                <Compass className="h-4 w-4" aria-hidden="true" />
                前往考试报名
              </Link>
            </Button>
            <Button asChild size="sm" variant="ghost">
              <Link to="/history">查看考试历史</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
