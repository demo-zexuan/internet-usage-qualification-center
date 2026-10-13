/**
 * 题库管理面板
 *
 * I. 功能
 *
 * 1. 列出本地题库：来源标识、版本、题目数量、分值合计与分类分布
 * 2. 导入题库：先解析并校验，展示带字段路径的错误，校验通过后才允许应用
 * 3. 导出题库原始 JSON、恢复内置题库、删除题库、切换启用状态
 * 4. 预览题目内容，便于确认导入结果
 *
 * II. 数据保护
 *
 * 1. 校验未通过的题库不会写入数据库，当前正在使用的有效题库保持不变
 * 2. 导入与删除均写入本地操作历史
 *
 * III. 安全边界声明
 *
 * 1. 本页面不是服务器管理后台，也不构成任何安全边界
 * 2. 纯前端项目无法阻止使用者绕过页面直接修改浏览器存储或前端代码
 *
 * @module components/admin/bank-panel
 * @author zexuan.peng
 * @created 2026-10-14
 */

import { ChevronDown, Download, Eye, FileJson, Trash2, Upload, Wand2 } from 'lucide-react';
import * as React from 'react';

import { useConfig } from '@/app/config-context';
import { SourceBadge } from '@/components/common/indicators';
import { EmptyState } from '@/components/common/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/choice';
import { Alert, Table, TableCell, TableHead, TableWrapper } from '@/components/ui/feedback';
import { useToast } from '@/components/ui/toast';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import {
  deleteQuestionBank,
  exportQuestionBank,
  importQuestionBank,
  restoreBuiltinBanks,
  setActiveBankIds,
} from '@/features/config/service';
import { validateQuestionBank } from '@/schemas';
import type { ValidationIssue } from '@/schemas';
import { downloadTextFile, pickFile, readFileAsText } from '@/services/import-export';
import type { QuestionBank, QuestionBankRecord } from '@/types/question';
import {
  DIFFICULTY_LABELS,
  QUESTION_CATEGORY_LABELS,
  QUESTION_TYPE_LABELS,
} from '@/types/question';
import type { Difficulty, QuestionCategory, QuestionType } from '@/types/question';
import { formatDateTime, formatScore } from '@/utils/format';

/** 待确认的导入内容 */
interface PendingImport {
  fileName: string;
  rawText: string;
  /** 已通过校验的题库对象 */
  bank: QuestionBank;
  warnings: ValidationIssue[];
  replacesExisting: boolean;
}

/** 校验失败信息 */
interface ImportFailure {
  fileName: string;
  summary: string;
  issues: ValidationIssue[];
}

/** 单条题库卡片 */
function BankCard({
  bank,
  active,
  onToggleActive,
  onExport,
  onDelete,
  onPreview,
  previewOpen,
}: {
  bank: QuestionBankRecord;
  active: boolean;
  onToggleActive: (checked: boolean) => void;
  onExport: () => void;
  onDelete: () => void;
  onPreview: () => void;
  previewOpen: boolean;
}): React.ReactElement {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[14px] font-semibold text-ink">{bank.title}</h3>
              <SourceBadge source={bank.source} />
              <Badge variant="outline">v{bank.version}</Badge>
              <Badge variant="neutral">结构版本 {bank.schemaVersion}</Badge>
            </div>
            <p className="doc-code mt-1 text-[11px] text-ink-faint">{bank.bankId}</p>
            <p className="mt-1.5 text-[12px] leading-relaxed text-ink-soft">{bank.description}</p>
          </div>

          <label
            className="flex cursor-pointer items-center gap-2 text-[12px] text-ink-soft"
            htmlFor={`bank-active-${bank.bankId}`}
          >
            <Checkbox
              id={`bank-active-${bank.bankId}`}
              checked={active}
              onCheckedChange={(checked) => onToggleActive(checked === true)}
            />
            启用
          </label>
        </div>

        {/* 统计 */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-y border-line py-3 text-[12px] sm:grid-cols-4">
          <div>
            <p className="text-ink-faint">题目数量</p>
            <p className="tabular mt-0.5 font-medium text-ink">{bank.stats.totalQuestions} 题</p>
          </div>
          <div>
            <p className="text-ink-faint">分值合计</p>
            <p className="tabular mt-0.5 font-medium text-ink">
              {formatScore(bank.stats.totalScore)} 分
            </p>
          </div>
          <div>
            <p className="text-ink-faint">导入时间</p>
            <p className="tabular mt-0.5 font-medium text-ink">{formatDateTime(bank.importedAt)}</p>
          </div>
          <div>
            <p className="text-ink-faint">语言</p>
            <p className="mt-0.5 font-medium text-ink">{bank.language}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {Object.entries(bank.stats.byType).map(([type, count]) => (
            <Badge key={type} variant="outline" size="sm">
              {QUESTION_TYPE_LABELS[type as QuestionType] ?? type} {count}
            </Badge>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {Object.entries(bank.stats.byCategory).map(([category, count]) => (
            <Badge key={category} variant="info" size="sm">
              {QUESTION_CATEGORY_LABELS[category as QuestionCategory] ?? category} {count}
            </Badge>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {Object.entries(bank.stats.byDifficulty)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([difficulty, count]) => (
              <Badge key={difficulty} variant="neutral" size="sm">
                难度 {DIFFICULTY_LABELS[Number(difficulty) as Difficulty] ?? difficulty} {count}
              </Badge>
            ))}
        </div>

        {/* 题目预览 */}
        {previewOpen ? (
          <div className="max-h-96 overflow-y-auto rounded-md border border-line bg-surface-muted p-3">
            <ol className="flex flex-col gap-3">
              {bank.questions.slice(0, 20).map((question, index) => (
                <li key={question.id} className="border-b border-line pb-3 last:border-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="doc-code text-[11px] font-semibold text-ink-soft">
                      {question.id}
                    </span>
                    <Badge variant="brand" size="sm">
                      {QUESTION_TYPE_LABELS[question.type]}
                    </Badge>
                    <Badge variant="outline" size="sm">
                      {QUESTION_CATEGORY_LABELS[question.category]}
                    </Badge>
                    <Badge variant="neutral" size="sm">
                      难度 {question.difficulty}
                    </Badge>
                    <Badge variant="info" size="sm">
                      {question.score} 分
                    </Badge>
                  </div>
                  <p className="mt-1.5 text-[12px] font-medium leading-relaxed text-ink">
                    {index + 1}. {question.stem}
                  </p>
                  {question.options ? (
                    <ul className="mt-1 flex flex-col gap-0.5">
                      {question.options.map((option) => (
                        <li key={option.id} className="text-[11px] leading-relaxed text-ink-soft">
                          <span className="doc-code mr-1 font-semibold">{option.id}.</span>
                          {option.text}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ol>
            {bank.questions.length > 20 ? (
              <p className="mt-3 text-[11px] text-ink-faint">
                仅预览前 20 题，共 {bank.questions.length} 题。
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={onPreview} aria-expanded={previewOpen}>
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            {previewOpen ? '收起预览' : '预览题目'}
          </Button>
          <Button size="sm" variant="outline" onClick={onExport}>
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            导出 JSON
          </Button>
          <Button size="sm" variant="ghost" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            删除题库
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/** 题库管理面板 */
export function BankPanel(): React.ReactElement {
  const { banks, settings } = useConfig();
  const { toast } = useToast();

  const [pending, setPending] = React.useState<PendingImport | null>(null);
  const [failure, setFailure] = React.useState<ImportFailure | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [previewBankId, setPreviewBankId] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<QuestionBankRecord | null>(null);
  const [restoreOpen, setRestoreOpen] = React.useState(false);

  const activeIds = new Set(settings.activeBankIds);

  /** 选择并校验题库文件 */
  const handlePickFile = async (): Promise<void> => {
    setFailure(null);
    setPending(null);

    const file = await pickFile('.json,application/json');
    if (!file) {
      return;
    }

    const textResult = await readFileAsText(file);
    if (!textResult.ok) {
      setFailure({ fileName: file.name, summary: textResult.error.message, issues: [] });
      return;
    }

    // I. 解析 JSON
    let parsed: unknown;
    try {
      parsed = JSON.parse(textResult.value) as unknown;
    } catch (error) {
      setFailure({
        fileName: file.name,
        summary: 'JSON 文本无法解析，导入已取消，现有题库保持不变。',
        issues: [
          {
            path: '(整个文件)',
            message: error instanceof Error ? error.message : '未知解析错误',
            code: 'invalid_json',
          },
        ],
      });
      return;
    }

    // II. 完整校验：失败时不触碰现有数据
    const outcome = validateQuestionBank(parsed);

    if (!outcome.ok || !outcome.bank) {
      setFailure({
        fileName: file.name,
        summary: '题库未通过校验，现有题库保持不变。请按字段路径逐项修正后重新导入。',
        issues: outcome.issues,
      });
      return;
    }

    setPending({
      fileName: file.name,
      rawText: textResult.value,
      bank: outcome.bank,
      warnings: outcome.warnings,
      replacesExisting: banks.some((bank) => bank.bankId === outcome.bank?.bankId),
    });
  };

  /** 应用已校验通过的题库 */
  const handleApply = async (): Promise<void> => {
    if (!pending) {
      return;
    }

    setBusy(true);
    const result = await importQuestionBank(pending.rawText);
    setBusy(false);

    if (result.ok) {
      toast({
        title: result.value.replaced ? '题库已更新' : '题库导入成功',
        description: `「${result.value.title}」共 ${result.value.questionCount} 题，已加入启用列表。`,
        tone: 'success',
      });
      setPending(null);
    } else {
      setFailure({ fileName: pending.fileName, summary: result.error.message, issues: [] });
      setPending(null);
    }
  };

  /** 导出题库 */
  const handleExport = async (bankId: string): Promise<void> => {
    const result = await exportQuestionBank(bankId);

    if (result.ok) {
      downloadTextFile(result.value, `${bankId}.json`);
      toast({ title: '题库已导出', description: `${bankId}.json 已保存到下载目录。`, tone: 'success' });
    } else {
      toast({ title: '导出失败', description: result.error.message, tone: 'error' });
    }
  };

  /** 切换启用状态 */
  const handleToggleActive = async (bankId: string, checked: boolean): Promise<void> => {
    const next = checked
      ? [...settings.activeBankIds.filter((id) => id !== bankId), bankId]
      : settings.activeBankIds.filter((id) => id !== bankId);

    await setActiveBankIds(next);
  };

  /** 删除题库 */
  const handleDelete = async (): Promise<void> => {
    if (!deleteTarget) {
      return;
    }

    setBusy(true);
    const result = await deleteQuestionBank(deleteTarget.bankId);
    setBusy(false);
    setDeleteTarget(null);

    if (result.ok) {
      toast({ title: '题库已删除', description: `${deleteTarget.title} 已从本地移除。`, tone: 'success' });
    } else {
      toast({ title: '删除失败', description: result.error.message, tone: 'error' });
    }
  };

  /** 恢复内置题库 */
  const handleRestore = async (): Promise<void> => {
    setBusy(true);
    const result = await restoreBuiltinBanks();
    setBusy(false);
    setRestoreOpen(false);

    if (result.ok) {
      toast({
        title: '已恢复内置题库',
        description: `共恢复 ${result.value} 个内置题库，并设为启用状态。`,
        tone: 'success',
      });
    } else {
      toast({ title: '恢复失败', description: result.error.message, tone: 'error' });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* I. 操作区 */}
      <Card>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => void handlePickFile()} data-testid="import-bank">
              <Upload className="h-4 w-4" aria-hidden="true" />
              导入题库 JSON
            </Button>
            <Button size="sm" variant="outline" onClick={() => setRestoreOpen(true)}>
              <Wand2 className="h-4 w-4" aria-hidden="true" />
              恢复内置题库
            </Button>
            <span className="text-[12px] text-ink-faint">
              当前启用 {activeIds.size > 0 ? activeIds.size : banks.length} / {banks.length} 个题库
            </span>
          </div>

          <Alert tone="info" title="导入流程">
            选择文件后系统会先解析并完整校验，只有校验通过的题库才允许应用。
            校验失败时不会覆盖当前正在使用的有效题库。
          </Alert>
        </CardContent>
      </Card>

      {/* II. 校验失败 */}
      {failure ? (
        <Alert tone="danger" title={`「${failure.fileName}」校验未通过`}>
          <p className="mt-1">{failure.summary}</p>
          {failure.issues.length > 0 ? (
            <div className="mt-2">
              <p className="text-[12px] font-medium text-ink">
                共 {failure.issues.length} 处错误，字段路径如下：
              </p>
              <ul className="mt-1.5 max-h-64 space-y-1 overflow-y-auto rounded border border-line bg-surface p-2.5">
                {failure.issues.map((issue, index) => (
                  <li key={index} className="text-[11px] leading-relaxed">
                    <span className="doc-code font-semibold text-fail">{issue.path}</span>
                    <span className="ml-2 text-ink-soft">{issue.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Alert>
      ) : null}

      {/* III. 待应用的导入 */}
      {pending ? (
        <Card className="border-brand/40">
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <FileJson className="h-4 w-4 text-brand" aria-hidden="true" />
              <h3 className="text-[14px] font-semibold text-ink">
                校验通过：{pending.bank.title}
              </h3>
              <Badge variant="pass">可应用</Badge>
              {pending.replacesExisting ? <Badge variant="warn">将覆盖同 ID 题库</Badge> : null}
            </div>

            <dl className="grid grid-cols-2 gap-3 text-[12px] sm:grid-cols-4">
              <div>
                <dt className="text-ink-faint">来源文件</dt>
                <dd className="mt-0.5 truncate font-medium text-ink">{pending.fileName}</dd>
              </div>
              <div>
                <dt className="text-ink-faint">题库 ID</dt>
                <dd className="doc-code mt-0.5 font-medium text-ink">{pending.bank.bankId}</dd>
              </div>
              <div>
                <dt className="text-ink-faint">题目数量</dt>
                <dd className="tabular mt-0.5 font-medium text-ink">
                  {pending.bank.questions.length} 题
                </dd>
              </div>
              <div>
                <dt className="text-ink-faint">分值合计</dt>
                <dd className="tabular mt-0.5 font-medium text-ink">
                  {formatScore(pending.bank.questions.reduce((sum, q) => sum + q.score, 0))} 分
                </dd>
              </div>
            </dl>

            {pending.warnings.length > 0 ? (
              <Alert tone="warning" title={`${pending.warnings.length} 条提示（不影响导入）`}>
                <ul className="mt-1 space-y-0.5">
                  {pending.warnings.map((warning, index) => (
                    <li key={index} className="text-[11px] leading-relaxed">
                      <span className="doc-code font-medium">{warning.path}</span>：{warning.message}
                    </li>
                  ))}
                </ul>
              </Alert>
            ) : (
              <p className="text-[12px] text-pass">校验通过且无提示项。</p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => void handleApply()} disabled={busy}>
                {busy ? '正在写入…' : '应用该题库'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setPending(null)} disabled={busy}>
                取消导入
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* IV. 题库列表 */}
      {banks.length === 0 ? (
        <EmptyState
          title="本地没有任何题库"
          description="可导入题库 JSON，或恢复内置示例题库。没有可用题库时，考试将无法生成试卷。"
          action={
            <Button size="sm" variant="outline" onClick={() => setRestoreOpen(true)}>
              恢复内置题库
            </Button>
          }
        />
      ) : (
        banks.map((bank) => (
          <BankCard
            key={bank.bankId}
            bank={bank}
            active={activeIds.size === 0 || activeIds.has(bank.bankId)}
            onToggleActive={(checked) => void handleToggleActive(bank.bankId, checked)}
            onExport={() => void handleExport(bank.bankId)}
            onDelete={() => setDeleteTarget(bank)}
            onPreview={() =>
              setPreviewBankId((current) => (current === bank.bankId ? null : bank.bankId))
            }
            previewOpen={previewBankId === bank.bankId}
          />
        ))
      )}

      {/* V. 统计总览 */}
      {banks.length > 0 ? (
        <Card>
          <CardContent className="pt-4">
            <h3 className="text-[14px] font-semibold text-ink">题库总览</h3>
            <TableWrapper className="mt-3">
              <Table>
                <caption className="sr-only">本地题库统计总览</caption>
                <thead>
                  <tr>
                    <TableHead>题库</TableHead>
                    <TableHead>来源</TableHead>
                    <TableHead className="text-right">题量</TableHead>
                    <TableHead className="text-right">分值合计</TableHead>
                    <TableHead>版本</TableHead>
                    <TableHead>启用</TableHead>
                  </tr>
                </thead>
                <tbody>
                  {banks.map((bank) => (
                    <tr key={bank.bankId}>
                      <TableCell className="text-[12px] font-medium text-ink">{bank.title}</TableCell>
                      <TableCell>
                        <SourceBadge source={bank.source} />
                      </TableCell>
                      <TableCell className="tabular text-right text-[12px]">
                        {bank.stats.totalQuestions}
                      </TableCell>
                      <TableCell className="tabular text-right text-[12px]">
                        {formatScore(bank.stats.totalScore)}
                      </TableCell>
                      <TableCell className="doc-code text-[12px] text-ink-soft">{bank.version}</TableCell>
                      <TableCell className="text-[12px]">
                        {activeIds.size === 0 || activeIds.has(bank.bankId) ? '是' : '否'}
                      </TableCell>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrapper>
          </CardContent>
        </Card>
      ) : null}

      {/* VI. 删除确认 */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
        title="删除本地题库"
        description={
          deleteTarget ? (
            <>
              将从本机数据库中删除题库「{deleteTarget.title}」（{deleteTarget.stats.totalQuestions} 题）。
              已参加过的考试记录不受影响，因为试卷快照已独立保存。
            </>
          ) : null
        }
        notice="删除后如需恢复，可重新导入题库 JSON 或点击「恢复内置题库」。"
        confirmLabel="确认删除该题库"
        destructive
        pending={busy}
        onConfirm={handleDelete}
      />

      {/* VII. 恢复确认 */}
      <ConfirmDialog
        open={restoreOpen}
        onOpenChange={setRestoreOpen}
        title="恢复内置题库"
        description="将把随应用分发的内置题库写回本机数据库，并覆盖同 ID 的本地题库。"
        notice="用户导入的其他题库不会被删除。恢复后启用列表会重置为全部内置题库。"
        confirmLabel="确认恢复内置题库"
        pending={busy}
        onConfirm={handleRestore}
      />

      <p className="flex items-start gap-2 text-[11px] leading-relaxed text-ink-faint">
        <ChevronDown className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>
          说明：本页面是本地配置管理工具，不是服务器管理后台，也不构成任何安全边界。
          本系统为纯前端应用，熟悉浏览器开发者工具的使用者可以绕过本页面直接修改本地数据，
          本中心不对此作出安全承诺。
        </span>
      </p>
    </div>
  );
}
