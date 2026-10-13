/**
 * 本地数据管理面板
 *
 * I. 功能
 *
 * 1. 展示应用版本、数据版本、数据库版本与各配置结构版本
 * 2. 展示本地操作历史（审计事件）
 * 3. 清除本地模拟数据（二次确认 + 输入确认文本）
 *
 * II. 清除语义
 *
 * 1. 清除会删除全部档案、考试记录、证件、题库、规则与设置
 * 2. 该操作不可撤销，界面必须明确说明影响范围
 *
 * @module components/admin/data-panel
 * @author zexuan.peng
 * @created 2026-10-14
 */

import { Database, Trash2 } from 'lucide-react';
import * as React from 'react';

import { APP_DATA_VERSION, APP_VERSION } from '@/app/app-meta';
import { useConfig } from '@/app/config-context';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { EmptyState } from '@/components/common/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, Table, TableCell, TableHead, TableWrapper } from '@/components/ui/feedback';
import { useToast } from '@/components/ui/toast';
import { destroyDatabase, listAuditEvents, DATABASE_VERSION } from '@/services/database';
import { AUDIT_EVENT_LABELS } from '@/types/audit';
import type { AuditEventRecord } from '@/types/audit';
import { formatDateTime } from '@/utils/format';

/** 本地数据管理面板 */
export function DataPanel(): React.ReactElement {
  const { rulesConfig, levels, permissions, certificateTemplate, banks } = useConfig();
  const { toast } = useToast();

  const [events, setEvents] = React.useState<AuditEventRecord[]>([]);
  const [clearOpen, setClearOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const refresh = React.useCallback(async (): Promise<void> => {
    setEvents(await listAuditEvents(40));
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  /** 清除本地模拟数据 */
  const handleClear = async (): Promise<void> => {
    setBusy(true);
    const result = await destroyDatabase();
    setBusy(false);
    setClearOpen(false);

    if (result.ok) {
      toast({
        title: '本地模拟数据已清除',
        description: '页面即将重新加载，以便重新初始化内置题库与考试规则。',
        tone: 'success',
      });
      // 重新加载以重建内置数据，避免内存中残留已删除的对象
      setTimeout(() => window.location.reload(), 1200);
    } else {
      toast({ title: '清除失败', description: result.error.message, tone: 'error' });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* I. 版本信息 */}
      <Card>
        <CardContent className="flex flex-col gap-3">
          <h3 className="flex items-center gap-1.5 text-[14px] font-semibold text-ink">
            <Database className="h-4 w-4 text-brand" aria-hidden="true" />
            当前数据版本
          </h3>

          <dl className="grid grid-cols-2 gap-3 text-[12px] lg:grid-cols-4">
            <div>
              <dt className="text-ink-faint">应用版本</dt>
              <dd className="doc-code mt-0.5 font-medium text-ink">{APP_VERSION}</dd>
            </div>
            <div>
              <dt className="text-ink-faint">本地数据版本</dt>
              <dd className="doc-code mt-0.5 font-medium text-ink">{APP_DATA_VERSION}</dd>
            </div>
            <div>
              <dt className="text-ink-faint">IndexedDB 结构版本</dt>
              <dd className="tabular mt-0.5 font-medium text-ink">v{DATABASE_VERSION}</dd>
            </div>
            <div>
              <dt className="text-ink-faint">题库数量</dt>
              <dd className="tabular mt-0.5 font-medium text-ink">{banks.length} 个</dd>
            </div>
          </dl>

          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline">等级配置 {levels.schemaVersion}</Badge>
            <Badge variant="outline">权限配置 {permissions.schemaVersion}</Badge>
            <Badge variant="outline">考试规则 {rulesConfig.schemaVersion}</Badge>
            <Badge variant="outline">证件模板 {certificateTemplate.schemaVersion}</Badge>
            <Badge variant="neutral">规则版本 {rulesConfig.version}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* II. 清除数据 */}
      <Card className="border-fail/30">
        <CardContent className="flex flex-col gap-3">
          <h3 className="text-[14px] font-semibold text-ink">清除本地模拟数据</h3>
          <Alert tone="danger" title="该操作不可撤销">
            <ul className="mt-1 list-disc space-y-1 pl-4">
              <li>将删除本机数据库中的全部内容：考生档案、考试记录、电子证件、题库、考试规则、应用设置与操作历史。</li>
              <li>清除后页面会重新加载并重新写入内置题库与内置考试规则。</li>
              <li>如需保留记录，请先在「我的档案」页面导出个人数据。</li>
            </ul>
          </Alert>

          <div>
            <Button
              variant="danger"
              size="sm"
              onClick={() => setClearOpen(true)}
              data-testid="clear-data"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              清除全部本地数据
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* III. 操作历史 */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[14px] font-semibold text-ink">本地操作历史</h3>
            <Button size="sm" variant="ghost" onClick={() => void refresh()}>
              刷新
            </Button>
          </div>

          {events.length === 0 ? (
            <EmptyState
              className="mt-3"
              title="暂无操作记录"
              description="考试开始、交卷、证件签发、题库导入等操作会记录在这里，仅保存在本机。"
            />
          ) : (
            <TableWrapper className="mt-3">
              <Table>
                <caption className="sr-only">本地操作历史</caption>
                <thead>
                  <tr>
                    <TableHead>时间</TableHead>
                    <TableHead>操作类型</TableHead>
                    <TableHead>说明</TableHead>
                  </tr>
                </thead>
                <tbody>
                  {events.map((event) => (
                    <tr key={event.id}>
                      <TableCell className="tabular whitespace-nowrap text-[12px] text-ink-soft">
                        {formatDateTime(event.at)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-[12px]">
                        <Badge variant="neutral" size="sm">
                          {AUDIT_EVENT_LABELS[event.type] ?? event.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-[12px] text-ink-soft">{event.message}</TableCell>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrapper>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        title="清除全部本地模拟数据"
        description="本操作将删除本机数据库中的全部内容，包括考生档案、全部考试记录与电子证件、题库、考试规则、应用设置与操作历史。"
        notice="清除后页面会重新加载，并重新写入内置题库与内置考试规则。该操作不可撤销。"
        confirmLabel="确认清除全部本地数据"
        destructive
        requireText="清除数据"
        pending={busy}
        onConfirm={handleClear}
      />
    </div>
  );
}
