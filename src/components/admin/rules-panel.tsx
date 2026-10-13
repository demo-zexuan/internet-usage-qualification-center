/**
 * 考试规则管理面板
 *
 * I. 功能
 *
 * 1. 展示当前启用的考试规则版本、评分策略与考试清单
 * 2. 导入考试规则 JSON（先校验后应用）、导出、恢复内置规则
 * 3. 列出本地已有的全部规则配置，可切换启用项
 *
 * II. 数据保护
 *
 * 1. 校验失败时不写入数据库，当前有效规则保持不变
 * 2. 规则与题库的容量匹配在开考时判定，本面板给出提示
 *
 * @module components/admin/rules-panel
 * @author zexuan.peng
 * @created 2026-10-14
 */

import { Download, FileCog, Upload, Wand2 } from 'lucide-react';
import * as React from 'react';

import { useConfig } from '@/app/config-context';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { SourceBadge } from '@/components/common/indicators';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, Table, TableCell, TableHead, TableWrapper } from '@/components/ui/feedback';
import { useToast } from '@/components/ui/toast';
import {
  exportExamRules,
  importExamRules,
  listRulesRecords,
  restoreBuiltinExamRules,
} from '@/features/config/service';
import { setSetting } from '@/services/database';
import { validateExamRules } from '@/schemas';
import type { ValidationIssue } from '@/schemas';
import { downloadTextFile, pickFile, readFileAsText } from '@/services/import-export';
import type { ExamRulesRecord } from '@/types/exam';
import { EXAM_CATEGORY_LABELS, ROUNDING_LABELS } from '@/types/exam';
import { formatDateTime } from '@/utils/format';

/** 考试规则管理面板 */
export function RulesPanel(): React.ReactElement {
  const { rulesConfig, settings } = useConfig();
  const { toast } = useToast();

  const [records, setRecords] = React.useState<ExamRulesRecord[]>([]);
  const [issues, setIssues] = React.useState<ValidationIssue[] | null>(null);
  const [failureMessage, setFailureMessage] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [restoreOpen, setRestoreOpen] = React.useState(false);

  const refresh = React.useCallback(async (): Promise<void> => {
    setRecords(await listRulesRecords());
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  /** 导入规则 */
  const handleImport = async (): Promise<void> => {
    setIssues(null);
    setFailureMessage(null);

    const file = await pickFile('.json,application/json');
    if (!file) {
      return;
    }

    const textResult = await readFileAsText(file);
    if (!textResult.ok) {
      setFailureMessage(textResult.error.message);
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(textResult.value) as unknown;
    } catch (error) {
      setFailureMessage(
        `JSON 文本无法解析，现有规则保持不变：${error instanceof Error ? error.message : '未知错误'}`,
      );
      return;
    }

    // 先校验后应用：校验失败时不写入数据库
    const outcome = validateExamRules(parsed);
    if (!outcome.ok || !outcome.config) {
      setIssues(outcome.issues);
      setFailureMessage('考试规则未通过校验，现有有效规则保持不变。');
      return;
    }

    setBusy(true);
    const result = await importExamRules(textResult.value);
    setBusy(false);

    if (result.ok) {
      toast({
        title: result.value.replaced ? '考试规则已更新' : '考试规则导入成功',
        description: `规则版本 ${result.value.version}，共 ${result.value.examCount} 场考试。`,
        tone: 'success',
      });
      if (result.value.warnings.length > 0) {
        setIssues(result.value.warnings);
      }
      await refresh();
    } else {
      setFailureMessage(result.error.message);
      setIssues(
        (result.error.details ?? []).map((detail) => ({
          path: '(规则文件)',
          message: detail,
          code: 'import_failed',
        })),
      );
    }
  };

  /** 导出规则 */
  const handleExport = async (): Promise<void> => {
    const result = await exportExamRules();

    if (result.ok) {
      downloadTextFile(result.value, `${rulesConfig.rulesId}.json`);
      toast({ title: '考试规则已导出', tone: 'success' });
    } else {
      toast({ title: '导出失败', description: result.error.message, tone: 'error' });
    }
  };

  /** 恢复内置规则 */
  const handleRestore = async (): Promise<void> => {
    setBusy(true);
    const result = await restoreBuiltinExamRules();
    setBusy(false);
    setRestoreOpen(false);

    if (result.ok) {
      toast({ title: '已恢复内置考试规则', tone: 'success' });
      await refresh();
    } else {
      toast({ title: '恢复失败', description: result.error.message, tone: 'error' });
    }
  };

  /** 切换启用的规则 */
  const handleActivate = async (rulesId: string): Promise<void> => {
    await setSetting('activeRulesId', rulesId);
    toast({ title: '已切换启用的考试规则', description: rulesId, tone: 'success' });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* I. 操作区 */}
      <Card>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => void handleImport()} data-testid="import-rules">
              <Upload className="h-4 w-4" aria-hidden="true" />
              导入考试规则
            </Button>
            <Button size="sm" variant="outline" onClick={() => void handleExport()}>
              <Download className="h-4 w-4" aria-hidden="true" />
              导出当前规则
            </Button>
            <Button size="sm" variant="outline" onClick={() => setRestoreOpen(true)}>
              <Wand2 className="h-4 w-4" aria-hidden="true" />
              恢复内置规则
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[12px] text-ink-soft">
            <span>当前启用规则：</span>
            <span className="doc-code font-medium text-ink">{rulesConfig.rulesId}</span>
            <Badge variant="outline">v{rulesConfig.version}</Badge>
            <Badge variant="neutral">结构版本 {rulesConfig.schemaVersion}</Badge>
            <Badge variant="info">{rulesConfig.exams.length} 场考试</Badge>
          </div>
        </CardContent>
      </Card>

      {/* II. 校验结果 */}
      {failureMessage ? (
        <Alert tone="danger" title="考试规则导入未完成">
          <p className="mt-1">{failureMessage}</p>
        </Alert>
      ) : null}

      {issues && issues.length > 0 ? (
        <Alert tone={failureMessage ? 'warning' : 'info'} title={`校验信息（${issues.length} 条）`}>
          <ul className="mt-1.5 max-h-64 space-y-1 overflow-y-auto rounded border border-line bg-surface p-2.5">
            {issues.map((issue, index) => (
              <li key={index} className="text-[11px] leading-relaxed">
                <span className="doc-code font-semibold text-ink">{issue.path}</span>
                <span className="ml-2 text-ink-soft">{issue.message}</span>
              </li>
            ))}
          </ul>
        </Alert>
      ) : null}

      {/* III. 评分策略 */}
      <Card>
        <CardContent className="flex flex-col gap-3">
          <h3 className="flex items-center gap-1.5 text-[14px] font-semibold text-ink">
            <FileCog className="h-4 w-4 text-brand" aria-hidden="true" />
            全站评分策略
          </h3>

          <dl className="grid grid-cols-2 gap-3 text-[12px] lg:grid-cols-3">
            <div>
              <dt className="text-ink-faint">百分制归一化</dt>
              <dd className="mt-0.5 font-medium text-ink">
                {rulesConfig.scoring.normalizeToHundred ? '启用' : '关闭'}
              </dd>
            </div>
            <div>
              <dt className="text-ink-faint">舍入方式</dt>
              <dd className="mt-0.5 font-medium text-ink">
                {ROUNDING_LABELS[rulesConfig.scoring.rounding]}
              </dd>
            </div>
            <div>
              <dt className="text-ink-faint">保留小数位</dt>
              <dd className="tabular mt-0.5 font-medium text-ink">
                {rulesConfig.scoring.decimalPlaces} 位
              </dd>
            </div>
            <div>
              <dt className="text-ink-faint">允许负总分</dt>
              <dd className="mt-0.5 font-medium text-ink">
                {rulesConfig.scoring.allowNegativeTotal ? '允许' : '不允许（最低 0 分）'}
              </dd>
            </div>
            <div>
              <dt className="text-ink-faint">默认倒扣分</dt>
              <dd className="tabular mt-0.5 font-medium text-ink">
                {rulesConfig.scoring.defaultNegativeScore} 分
              </dd>
            </div>
            <div>
              <dt className="text-ink-faint">部分得分</dt>
              <dd className="mt-0.5 font-medium text-ink">
                {rulesConfig.scoring.partialCreditEnabled ? '允许题目声明' : '全站严格匹配'}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* IV. 考试清单 */}
      <Card>
        <CardContent className="pt-4">
          <h3 className="text-[14px] font-semibold text-ink">当前规则下的考试清单</h3>
          <TableWrapper className="mt-3">
            <Table>
              <caption className="sr-only">考试规则清单</caption>
              <thead>
                <tr>
                  <TableHead>考试</TableHead>
                  <TableHead>类别</TableHead>
                  <TableHead>等级</TableHead>
                  <TableHead className="text-right">题量</TableHead>
                  <TableHead className="text-right">时限</TableHead>
                  <TableHead className="text-right">及格线</TableHead>
                  <TableHead>抽题来源</TableHead>
                  <TableHead>答案</TableHead>
                </tr>
              </thead>
              <tbody>
                {rulesConfig.exams.map((exam) => (
                  <tr key={exam.examId}>
                    <TableCell className="min-w-[10rem] text-[12px] font-medium text-ink">
                      {exam.title}
                      <span className="doc-code mt-0.5 block text-[10px] text-ink-faint">
                        {exam.examId}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-[12px] text-ink-soft">
                      {EXAM_CATEGORY_LABELS[exam.category]}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-[12px] text-ink-soft">
                      {exam.levelId}
                    </TableCell>
                    <TableCell className="tabular text-right text-[12px]">{exam.questionCount}</TableCell>
                    <TableCell className="tabular whitespace-nowrap text-right text-[12px]">
                      {exam.durationMinutes} 分
                    </TableCell>
                    <TableCell className="tabular text-right text-[12px]">{exam.passScore}</TableCell>
                    <TableCell className="doc-code text-[11px] text-ink-soft">
                      {exam.paper.bankIds.join(', ')}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-[11px] text-ink-soft">
                      {exam.showAnswers === 'always'
                        ? '展示'
                        : exam.showAnswers === 'after_pass'
                          ? '通过后'
                          : '不展示'}
                    </TableCell>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrapper>
        </CardContent>
      </Card>

      {/* V. 本地规则记录 */}
      {records.length > 0 ? (
        <Card>
          <CardContent className="pt-4">
            <h3 className="text-[14px] font-semibold text-ink">本地规则配置记录</h3>
            <TableWrapper className="mt-3">
              <Table>
                <caption className="sr-only">本地考试规则配置记录</caption>
                <thead>
                  <tr>
                    <TableHead>规则 ID</TableHead>
                    <TableHead>标题</TableHead>
                    <TableHead>来源</TableHead>
                    <TableHead>版本</TableHead>
                    <TableHead>导入时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => {
                    const isActive = record.rulesId === settings.activeRulesId;
                    return (
                      <tr key={record.rulesId}>
                        <TableCell className="doc-code text-[12px]">{record.rulesId}</TableCell>
                        <TableCell className="text-[12px] text-ink-soft">{record.title}</TableCell>
                        <TableCell>
                          <SourceBadge source={record.source} />
                        </TableCell>
                        <TableCell className="doc-code text-[12px] text-ink-soft">{record.version}</TableCell>
                        <TableCell className="tabular text-[12px] text-ink-soft">
                          {formatDateTime(record.importedAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          {isActive ? (
                            <Badge variant="pass">当前启用</Badge>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void handleActivate(record.rulesId)}
                            >
                              设为启用
                            </Button>
                          )}
                        </TableCell>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </TableWrapper>
          </CardContent>
        </Card>
      ) : null}

      <ConfirmDialog
        open={restoreOpen}
        onOpenChange={setRestoreOpen}
        title="恢复内置考试规则"
        description="将把随应用分发的内置考试规则写回本机数据库，并覆盖同 ID 的规则配置。"
        notice="恢复后当前启用的规则会切换为内置规则，评分策略与考试参数将一并还原。"
        confirmLabel="确认恢复内置规则"
        pending={busy}
        onConfirm={handleRestore}
      />
    </div>
  );
}
