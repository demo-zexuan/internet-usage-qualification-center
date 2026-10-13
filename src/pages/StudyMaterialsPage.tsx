/**
 * 学习材料页
 *
 * I. 功能
 *
 * 1. 列出全部学习材料，按所需等级标注开放状态
 * 2. 阅读材料正文与外部参考资料链接（仅知识说明，不含操作指引）
 * 3. 逐条确认自查问题后方可标记材料为已完成，完成进度写入 IndexedDB
 *
 * II. 与考试的关系
 *
 * 1. 部分考试的报名条件要求完成指定学习材料，完成状态由报名引擎统一读取
 * 2. 未完成的材料会在考试报名页与首页升级条件中明确列出
 *
 * @module pages/StudyMaterialsPage
 * @author zexuan.peng
 * @created 2026-10-14
 */

import { BookOpen, Check, CircleCheck, ExternalLink, Lock } from 'lucide-react';
import * as React from 'react';

import { useConfig } from '@/app/config-context';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/choice';
import { Alert, Progress } from '@/components/ui/feedback';
import { useToast } from '@/components/ui/toast';
import { recordAuditEvent, setSetting } from '@/services/database';
import { useUserData } from '@/hooks/use-user-data';
import type { StudyMaterialDefinition } from '@/types/settings';
import { cn } from '@/utils/cn';

/** 学习材料页 */
export function StudyMaterialsPage(): React.ReactElement {
  const { studyMaterials, settings, levels } = useConfig();
  const { summary, permissionContext } = useUserData();
  const { toast } = useToast();

  const [selectedId, setSelectedId] = React.useState<string | null>(
    studyMaterials.materials[0]?.materialId ?? null,
  );
  const [checkedPoints, setCheckedPoints] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState(false);

  const currentOrder = permissionContext?.effectiveLevelOrder ?? 0;

  const selected = studyMaterials.materials.find((item) => item.materialId === selectedId) ?? null;
  const progress = settings.studyMaterialProgress;

  // 切换材料时重置自查勾选状态
  React.useEffect(() => {
    setCheckedPoints([]);
  }, [selectedId]);

  const completedCount = studyMaterials.materials.filter(
    (material) => progress[material.materialId],
  ).length;

  /** 标记材料为已完成 */
  const handleComplete = async (material: StudyMaterialDefinition): Promise<void> => {
    if (checkedPoints.length !== material.checkpoints.length) {
      return;
    }

    setBusy(true);
    const next = { ...progress, [material.materialId]: Date.now() };
    await setSetting('studyMaterialProgress', next);
    await recordAuditEvent({
      type: 'settings_changed',
      userId: summary?.profile.userId ?? null,
      message: `完成学习材料「${material.title}」`,
      metadata: { materialId: material.materialId },
    });
    setBusy(false);

    toast({
      title: '学习材料已标记为完成',
      description: '完成状态已写入本机数据库，考试报名条件将据此判定。',
      tone: 'success',
    });
  };

  /** 取消完成状态 */
  const handleReset = async (material: StudyMaterialDefinition): Promise<void> => {
    setBusy(true);
    const next = { ...progress };
    delete next[material.materialId];
    await setSetting('studyMaterialProgress', next);
    setBusy(false);
    toast({ title: '已取消完成状态', tone: 'info' });
  };

  if (studyMaterials.materials.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="学习材料" description="当前没有可用的学习材料。" />
        <EmptyState title="学习材料为空" description="请检查 study-materials.json 配置。" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="考生服务"
        title="学习材料"
        description="本中心整理的学习材料用于帮助考生理解考试涉及的知识范围。材料内容仅为知识说明，不包含任何操作指引。"
        actions={
          <Badge variant={completedCount === studyMaterials.materials.length ? 'pass' : 'neutral'}>
            已完成 {completedCount} / {studyMaterials.materials.length} 份
          </Badge>
        }
      />

      <Progress
        value={(completedCount / studyMaterials.materials.length) * 100}
        tone={completedCount === studyMaterials.materials.length ? 'pass' : 'brand'}
        aria-label={`学习材料完成进度 ${Math.round((completedCount / studyMaterials.materials.length) * 100)}%`}
      />

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* I. 材料列表 */}
        <nav aria-label="学习材料列表" className="lg:w-72 lg:shrink-0">
          <ul className="flex flex-col gap-2">
            {studyMaterials.materials.map((material) => {
              const isUnlocked = currentOrder >= material.requiredLevelOrder;
              const isCompleted = Boolean(progress[material.materialId]);
              const isSelected = material.materialId === selectedId;

              return (
                <li key={material.materialId}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(material.materialId)}
                    aria-current={isSelected ? 'true' : undefined}
                    className={cn(
                      'flex w-full flex-col gap-1 rounded-md border px-3.5 py-3 text-left transition-colors',
                      isSelected
                        ? 'border-brand bg-brand-soft'
                        : 'border-line bg-surface hover:bg-surface-muted',
                    )}
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="text-[13px] font-medium leading-snug text-ink">
                        {material.title}
                      </span>
                      {isCompleted ? (
                        <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-pass" aria-hidden="true" />
                      ) : !isUnlocked ? (
                        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" aria-hidden="true" />
                      ) : null}
                    </span>
                    <span className="flex flex-wrap items-center gap-1.5">
                      <Badge variant={isUnlocked ? 'outline' : 'neutral'} size="sm">
                        {material.requiredLevelOrder === 0
                          ? '无需资格'
                          : `需 L${material.requiredLevelOrder}+`}
                      </Badge>
                      {isCompleted ? (
                        <Badge variant="pass" size="sm">
                          已完成
                        </Badge>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* II. 材料详情 */}
        <div className="min-w-0 flex-1">
          {selected ? (
            <MaterialDetail
              material={selected}
              unlocked={currentOrder >= selected.requiredLevelOrder}
              completed={Boolean(progress[selected.materialId])}
              checkedPoints={checkedPoints}
              onTogglePoint={(point) =>
                setCheckedPoints((current) =>
                  current.includes(point) ? current.filter((item) => item !== point) : [...current, point],
                )
              }
              onComplete={() => void handleComplete(selected)}
              onReset={() => void handleReset(selected)}
              busy={busy}
              levelName={
                levels.levels.find((level) => level.order === selected.requiredLevelOrder)?.nameZh ?? null
              }
            />
          ) : (
            <EmptyState title="请选择一份学习材料" />
          )}
        </div>
      </div>
    </div>
  );
}

/** 材料详情 */
function MaterialDetail({
  material,
  unlocked,
  completed,
  checkedPoints,
  onTogglePoint,
  onComplete,
  onReset,
  busy,
  levelName,
}: {
  material: StudyMaterialDefinition;
  unlocked: boolean;
  completed: boolean;
  checkedPoints: string[];
  onTogglePoint: (point: string) => void;
  onComplete: () => void;
  onReset: () => void;
  busy: boolean;
  levelName: string | null;
}): React.ReactElement {
  const allChecked = checkedPoints.length === material.checkpoints.length;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="flex items-center gap-1.5 text-base font-semibold text-ink">
                <BookOpen className="h-4 w-4 text-brand" aria-hidden="true" />
                {material.title}
              </h2>
              <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">{material.summary}</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {completed ? <Badge variant="pass">已完成</Badge> : null}
              <Badge variant={unlocked ? 'outline' : 'neutral'}>
                {material.requiredLevelOrder === 0
                  ? '无需资格'
                  : `需 ${levelName ?? `L${material.requiredLevelOrder}`}`}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {!unlocked ? (
        <Alert tone="warning" title="当前等级尚不能阅读本材料">
          本材料需要等级序号 ≥ {material.requiredLevelOrder}
          {levelName ? `（${levelName}）` : ''}。可通过参加对应等级考试提升等级后阅读。
        </Alert>
      ) : (
        <>
          <Card>
            <CardContent className="flex flex-col gap-3">
              {material.body.map((paragraph, index) => (
                <p key={index} className="text-[13px] leading-relaxed text-ink-soft">
                  {paragraph}
                </p>
              ))}

              {material.references && material.references.length > 0 ? (
                <div className="rounded-md border border-line bg-surface-muted px-3.5 py-3">
                  <p className="text-[12px] font-semibold text-ink">外部参考资料</p>
                  <ul className="mt-1.5 flex flex-col gap-1">
                    {material.references.map((reference) => (
                      <li key={reference.url}>
                        <a
                          href={reference.url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="flex items-start gap-1.5 text-[12px] leading-relaxed text-brand underline-offset-4 hover:underline"
                        >
                          <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          {reference.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">
                    以上链接指向公开的技术标准文档，仅用于知识延伸阅读，不代表本平台提供任何操作指引。
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* 自查问题 */}
          <Card>
            <CardContent className="flex flex-col gap-3">
              <div>
                <h3 className="text-[14px] font-semibold text-ink">自查问题</h3>
                <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">
                  请逐条确认你已理解以下问题，全部确认后方可标记材料为已完成。
                </p>
              </div>

              <ul className="flex flex-col gap-2">
                {material.checkpoints.map((point) => {
                  const isChecked = checkedPoints.includes(point);
                  return (
                    <li key={point}>
                      <label
                        className={cn(
                          'flex cursor-pointer items-start gap-2.5 rounded-md border px-3.5 py-3 transition-colors',
                          isChecked ? 'border-pass/45 bg-pass-soft/50' : 'border-line bg-surface',
                        )}
                      >
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => onTogglePoint(point)}
                          className="mt-0.5"
                          aria-label={point}
                        />
                        <span className="text-[13px] leading-relaxed text-ink">{point}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>

              <div className="flex flex-wrap items-center gap-2">
                {completed ? (
                  <>
                    <Badge variant="pass" size="lg">
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      已完成本材料
                    </Badge>
                    <Button size="sm" variant="ghost" onClick={onReset} disabled={busy}>
                      取消完成状态
                    </Button>
                  </>
                ) : (
                  <>
                    <Button size="sm" onClick={onComplete} disabled={!allChecked || busy}>
                      {busy ? '正在保存…' : '标记为已完成'}
                    </Button>
                    {!allChecked ? (
                      <span className="text-[12px] text-ink-faint">
                        还需确认 {material.checkpoints.length - checkedPoints.length} 项自查问题
                      </span>
                    ) : null}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <p className="text-[11px] leading-relaxed text-ink-faint">
        完成状态保存在本机数据库中，仅用于判定考试报名条件。清除浏览器数据会一并清除该状态。
      </p>
    </div>
  );
}
