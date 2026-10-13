/**
 * 资格等级体系说明
 *
 * 从 levels.json 与 exam-rules.json 读取等级与考试参数并生成对照表，
 * 等级名称、考试题量、时限与及格线均不在组件中硬编码。
 *
 * @module components/home/level-system-panel
 * @author zexuan.peng
 * @created 2026-10-14
 */

import * as React from 'react';

import { useConfig } from '@/app/config-context';
import { LevelBadge } from '@/components/common/indicators';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableCell, TableHead, TableWrapper } from '@/components/ui/feedback';
import type { LevelDefinition } from '@/types/level';

/** 单个等级的考试参数 */
interface LevelExamSummary {
  examTitle: string;
  questionCount: number;
  durationMinutes: number;
  passScore: number;
  prerequisiteNames: string;
}

/** 资格等级体系说明 */
export function LevelSystemPanel(): React.ReactElement {
  const { levels, rulesConfig } = useConfig();

  // 为每个正式等级找到授予它的考试，并汇总考试参数
  const rows = React.useMemo(() => {
    const official = levels.levels
      .filter((level) => !level.isTemporary)
      .sort((a, b) => a.order - b.order);

    return official.map((level: LevelDefinition) => {
      const exam = rulesConfig.exams.find((item) => item.grantsLevelId === level.levelId);

      const prerequisiteNames = exam?.eligibility.requirePrerequisite
        ? exam.eligibility.prerequisiteLevelIds
            .map((levelId) => levels.levels.find((item) => item.levelId === levelId)?.nameZh ?? levelId)
            .join(' / ')
        : '无（可直接报考）';

      const summary: LevelExamSummary | null = exam
        ? {
            examTitle: exam.title,
            questionCount: exam.questionCount,
            durationMinutes: exam.durationMinutes,
            passScore: exam.passScore,
            prerequisiteNames,
          }
        : null;

      return { level, summary };
    });
  }, [levels, rulesConfig]);

  const temporary = levels.levels.find((level) => level.isTemporary) ?? null;

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div>
          <h2 className="text-base font-semibold text-ink">资格等级与考试制度</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
            本体系共设 {rows.length} 个正式等级，采用逐级晋升制度。高级等级默认继承低级等级的权限，
            任何考试未通过都不会降低已取得的等级或作废已签发的证件。
          </p>
        </div>

        {temporary ? (
          <div className="rounded-md border border-line bg-surface-muted px-3.5 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <LevelBadge level={temporary} temporary size="sm" />
              <span className="text-[12px] text-ink-soft">默认状态</span>
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-ink-soft">{temporary.description}</p>
          </div>
        ) : null}

        <TableWrapper>
          <Table>
            <caption className="sr-only">资格等级与对应考试参数对照表</caption>
            <thead>
              <tr>
                <TableHead>等级</TableHead>
                <TableHead>等级定位</TableHead>
                <TableHead>授予考试</TableHead>
                <TableHead className="text-right">题量</TableHead>
                <TableHead className="text-right">时限</TableHead>
                <TableHead className="text-right">及格线</TableHead>
                <TableHead>前置等级</TableHead>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ level, summary }) => (
                <tr key={level.levelId}>
                  <TableCell className="whitespace-nowrap">
                    <LevelBadge level={level} showName={false} size="sm" />
                    <span className="mt-1 block text-[12px] font-medium text-ink">{level.nameZh}</span>
                  </TableCell>
                  <TableCell className="min-w-[16rem]">
                    <p className="text-[12px] leading-relaxed text-ink-soft">{level.summary}</p>
                  </TableCell>
                  <TableCell className="min-w-[12rem]">
                    <p className="text-[12px] text-ink">{summary?.examTitle ?? '未配置'}</p>
                  </TableCell>
                  <TableCell className="tabular text-right text-[12px]">
                    {summary ? `${summary.questionCount}` : '—'}
                  </TableCell>
                  <TableCell className="tabular whitespace-nowrap text-right text-[12px]">
                    {summary ? `${summary.durationMinutes} 分钟` : '—'}
                  </TableCell>
                  <TableCell className="tabular text-right text-[12px]">
                    {summary ? `${summary.passScore} 分` : '—'}
                  </TableCell>
                  <TableCell className="min-w-[8rem] text-[12px] text-ink-soft">
                    {summary?.prerequisiteNames ?? '—'}
                  </TableCell>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableWrapper>

        <p className="text-[12px] leading-relaxed text-ink-faint">
          说明：满分口径为百分制归一化。试卷实际题目分值合计与配置满分不一致时，
          系统按「原始得分 ÷ 原始满分 × 100」折算，折算结果按配置的舍入方式保留
          {rulesConfig.scoring.decimalPlaces} 位小数后与及格线比较。
        </p>
      </CardContent>
    </Card>
  );
}
