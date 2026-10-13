/**
 * 公告栏
 *
 * I. 阅读状态
 *
 * 1. 已读状态保存在 IndexedDB 的 appSettings 中，属于业务数据
 * 2. 未读公告在标题前显示标记，已读公告折叠正文
 *
 * II. 无障碍
 *
 * 1. 展开按钮使用 aria-expanded 标注状态
 * 2. 公告级别以文字徽章表达，不依赖颜色
 *
 * @module components/home/announcement-panel
 * @author zexuan.peng
 * @created 2026-10-14
 */

import { ChevronDown, Megaphone } from 'lucide-react';
import * as React from 'react';

import { useConfig } from '@/app/config-context';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { recordAuditEvent, setSetting } from '@/services/database';
import type { AnnouncementDefinition } from '@/types/settings';
import { cn } from '@/utils/cn';

/** 公告级别对应的徽章样式 */
const SEVERITY_META: Record<
  AnnouncementDefinition['severity'],
  { label: string; variant: 'info' | 'warn' | 'neutral' }
> = {
  info: { label: '通告', variant: 'info' },
  notice: { label: '提示', variant: 'neutral' },
  warning: { label: '重要', variant: 'warn' },
};

/** 公告栏属性 */
export interface AnnouncementPanelProps {
  /** 最多展示条数，未指定时展示全部 */
  limit?: number;
  className?: string;
}

/** 公告栏 */
export function AnnouncementPanel({ limit, className }: AnnouncementPanelProps): React.ReactElement {
  const { announcements, settings } = useConfig();
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  const sorted = React.useMemo(() => {
    const list = [...announcements.announcements].sort(
      (a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.publishedAt.localeCompare(a.publishedAt),
    );
    return limit ? list.slice(0, limit) : list;
  }, [announcements.announcements, limit]);

  const readIds = new Set(settings.readAnnouncementIds);

  /** 展开公告并标记为已读 */
  const handleToggle = async (announcement: AnnouncementDefinition): Promise<void> => {
    const nextExpanded = expandedId === announcement.announcementId ? null : announcement.announcementId;
    setExpandedId(nextExpanded);

    if (nextExpanded && !readIds.has(announcement.announcementId)) {
      const nextReadIds = [...settings.readAnnouncementIds, announcement.announcementId];
      await setSetting('readAnnouncementIds', nextReadIds);
      await recordAuditEvent({
        type: 'settings_changed',
        userId: null,
        message: `阅读公告「${announcement.title}」`,
        metadata: { announcementId: announcement.announcementId },
      });
    }
  };

  return (
    <Card className={className}>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-1.5 text-base font-semibold text-ink">
            <Megaphone className="h-4 w-4 text-brand" aria-hidden="true" />
            最新公告
          </h2>
          <span className="text-[11px] text-ink-faint">共 {announcements.announcements.length} 条</span>
        </div>

        <ul className="flex flex-col divide-y divide-line">
          {sorted.map((announcement) => {
            const isExpanded = expandedId === announcement.announcementId;
            const isRead = readIds.has(announcement.announcementId);
            const severity = SEVERITY_META[announcement.severity];

            return (
              <li key={announcement.announcementId} className="py-3 first:pt-0 last:pb-0">
                <button
                  type="button"
                  onClick={() => {
                    void handleToggle(announcement);
                  }}
                  aria-expanded={isExpanded}
                  className="flex w-full items-start gap-2 text-left"
                >
                  <ChevronDown
                    className={cn(
                      'mt-1 h-4 w-4 shrink-0 text-ink-faint transition-transform',
                      isExpanded && 'rotate-180',
                    )}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      {announcement.pinned ? <Badge variant="warn" size="sm">置顶</Badge> : null}
                      <Badge variant={severity.variant} size="sm">
                        {severity.label}
                      </Badge>
                      {!isRead ? (
                        <Badge variant="brand" size="sm">
                          未读
                        </Badge>
                      ) : null}
                    </span>
                    <span className="mt-1.5 block text-[13px] font-medium leading-snug text-ink">
                      {announcement.title}
                    </span>
                    <span className="mt-1 block text-[11px] text-ink-faint">
                      {announcement.department} · {announcement.publishedAt}
                    </span>
                  </span>
                </button>

                {isExpanded ? (
                  <div className="mt-2 space-y-2 pl-6 text-[13px] leading-relaxed text-ink-soft">
                    {announcement.body.map((paragraph, index) => (
                      <p key={index}>{paragraph}</p>
                    ))}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
