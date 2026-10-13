/**
 * 考前须知页
 *
 * I. 展示内容
 *
 * 1. 考试时限、题目数量、分值规则、及格线
 * 2. 题型构成与各题型作答说明（题型说明由题库配置推导，不硬编码）
 * 3. 是否存在倒扣分、交卷规则、自动保存说明与不可逆操作提示
 *
 * II. 确认机制
 *
 * 1. 正式考试必须勾选「已阅读考试须知」后方可开始
 * 2. 模拟考试免除该要求，但仍会展示完整须知
 *
 * III. 失败即拒绝
 *
 * 1. 题库不足以生成试卷时，页面直接展示缺口清单，不提供开始按钮
 *
 * @module pages/ExamInstructionsPage
 * @author zexuan.peng
 * @created 2026-10-14
 */

import { AlertTriangle, ArrowLeft, BookOpenCheck, Info, PlayCircle } from 'lucide-react';
import * as React from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { useConfig } from '@/app/config-context';
import { LevelBadge } from '@/components/common/indicators';
import { PageHeader } from '@/components/common/page-header';
import { ErrorState, LoadingState } from '@/components/common/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/choice';
import { Alert, Separator, Table, TableCell, TableHead, TableWrapper } from '@/components/ui/feedback';
import { useToast } from '@/components/ui/toast';
import { startExamAttempt } from '@/features/exams/attempt-service';
import { previewExamPaper } from '@/features/exams/paper-builder';
import { useAsyncAction } from '@/hooks/use-async-action';
import { useUserData } from '@/hooks/use-user-data';
import { ANSWER_VISIBILITY_LABELS, EXAM_MODE_LABELS } from '@/types/exam';
import type { ExamMode } from '@/types/exam';
import {
  DIFFICULTY_LABELS,
  QUESTION_CATEGORY_LABELS,
  QUESTION_TYPE_HINTS,
  QUESTION_TYPE_LABELS,
} from '@/types/question';
import type { QuestionType } from '@/types/question';
import { formatScore } from '@/utils/format';

/** 考前须知页 */
export function ExamInstructionsPage(): React.ReactElement {
  const { examId } = useParams<{ examId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { rulesConfig, levels, activeBanks, settings } = useConfig();
  const { status, profile, attempts, summary, permissionContext } = useUserData();
  const startAction = useAsyncAction(startExamAttempt);

  const [agreed, setAgreed] = React.useState(false);

  const mode: ExamMode = searchParams.get('mode') === 'mock' ? 'mock' : 'official';

  const rule = React.useMemo(
    () => rulesConfig.exams.find((exam) => exam.examId === examId) ?? null,
    [rulesConfig.exams, examId],
  );

  const level = React.useMemo(
    () => (rule ? (levels.levels.find((item) => item.levelId === rule.levelId) ?? null) : null),
    [levels.levels, rule],
  );

  // I. 试卷预览：在不开始考试的前提下展示题型构成与分值口径
  const preview = React.useMemo(() => {
    if (!rule) {
      return null;
    }
    return previewExamPaper({ rule, rulesConfig, banks: activeBanks });
  }, [rule, rulesConfig, activeBanks]);

  // II. 开始考试
  const handleStart = async (): Promise<void> => {
    if (!rule || !profile || !permissionContext) {
      return;
    }

    const passedExamIds = new Set(
      attempts
        .filter((attempt) => attempt.mode === 'official' && attempt.result?.passed)
        .map((attempt) => attempt.examId),
    );

    const outcome = await startAction.run({
      examId: rule.examId,
      mode,
      userId: profile.userId,
      rulesConfig,
      levels,
      banks: activeBanks,
      passedExamIds,
      officialAttempts: attempts.filter((attempt) => attempt.mode === 'official'),
      allAttempts: attempts,
      effectiveLevelOrder: permissionContext.effectiveLevelOrder,
      studyMaterialProgress: settings.studyMaterialProgress,
    });

    if (!outcome?.ok) {
      return;
    }

    toast({
      title: outcome.value.resumed ? '已恢复未完成的考试' : '考试已开始',
      description: '倒计时已启动，答题进度会自动保存到本机。',
      tone: 'info',
    });
    navigate(`/exam/${outcome.value.attempt.attemptId}`, { replace: true });
  };

  if (status === 'loading') {
    return <LoadingState label="正在读取考试规则" rows={4} />;
  }

  // III. 考试不存在
  if (!rule) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="考试须知" crumbs={[{ label: '首页', to: '/' }, { label: '考试报名', to: '/exams' }, { label: '考试须知' }]} />
        <ErrorState
          title="找不到指定的考试"
          message={`考试标识「${examId ?? '(空)'}」在当前启用的考试规则中不存在。`}
          hint="请返回报名页重新选择考试。若刚导入过考试规则，可能已不再包含该场考试。"
          code="EXAM_NOT_FOUND"
        />
        <div>
          <Button asChild variant="outline" size="sm">
            <Link to="/exams">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              返回考试报名
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  // IV. 题库不足：直接展示缺口，不提供开始按钮
  if (preview && !preview.ok) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title={rule.title}
          crumbs={[
            { label: '首页', to: '/' },
            { label: '考试报名', to: '/exams' },
            { label: rule.title },
          ]}
        />
        <ErrorState
          title="题库内容不足以生成试卷"
          message={preview.error.message}
          hint={preview.error.hint}
          code={preview.error.code}
          details={preview.error.details}
        />
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/admin">前往题库管理</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/exams">返回考试报名</Link>
          </Button>
        </div>
      </div>
    );
  }

  const paperPreview = preview?.ok ? preview.value : null;
  const requiresAgreement = mode === 'official';
  const canStart = (!requiresAgreement || agreed) && !startAction.pending;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={EXAM_MODE_LABELS[mode]}
        title={rule.title}
        crumbs={[
          { label: '首页', to: '/' },
          { label: '考试报名', to: '/exams' },
          { label: '考前须知' },
        ]}
        description={rule.description}
        actions={
          <>
            <Badge variant={mode === 'official' ? 'brand' : 'info'} size="lg">
              {EXAM_MODE_LABELS[mode]}
            </Badge>
            {level ? <LevelBadge level={level} size="default" /> : null}
          </>
        }
      />

      {startAction.error ? (
        <ErrorState
          title="无法开始考试"
          message={startAction.error.message}
          hint={startAction.error.hint}
          code={startAction.error.code}
          details={startAction.error.details}
        />
      ) : null}

      {/* I. 考试参数 */}
      <Card>
        <CardContent className="flex flex-col gap-4">
          <h2 className="text-base font-semibold text-ink">考试参数</h2>
          <dl className="grid grid-cols-2 gap-4 text-[13px] sm:grid-cols-3 lg:grid-cols-6">
            <div>
              <dt className="text-ink-faint">考试时限</dt>
              <dd className="tabular mt-1 text-base font-semibold text-ink">
                {rule.durationMinutes} 分钟
              </dd>
            </div>
            <div>
              <dt className="text-ink-faint">题目数量</dt>
              <dd className="tabular mt-1 text-base font-semibold text-ink">
                {rule.questionCount} 题
              </dd>
            </div>
            <div>
              <dt className="text-ink-faint">满分</dt>
              <dd className="tabular mt-1 text-base font-semibold text-ink">
                {rule.totalScore} 分
              </dd>
            </div>
            <div>
              <dt className="text-ink-faint">及格线</dt>
              <dd className="tabular mt-1 text-base font-semibold text-accent">
                {rule.passScore} 分
              </dd>
            </div>
            <div>
              <dt className="text-ink-faint">倒扣分</dt>
              <dd className="mt-1 text-base font-semibold text-ink">
                {rule.negativeScoring ? '启用' : '不启用'}
              </dd>
            </div>
            <div>
              <dt className="text-ink-faint">答案展示</dt>
              <dd className="mt-1 text-[13px] font-medium text-ink">
                {ANSWER_VISIBILITY_LABELS[rule.showAnswers]}
              </dd>
            </div>
          </dl>

          <Separator />

          {/* II. 分值规则 */}
          <div className="flex flex-col gap-2 text-[13px] leading-relaxed text-ink-soft">
            <h3 className="text-sm font-semibold text-ink">分值规则</h3>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                试卷题目分值合计为{' '}
                <span className="tabular font-medium text-ink">
                  {paperPreview ? formatScore(paperPreview.rawMaxScore) : rule.totalScore}
                </span>{' '}
                分，配置满分为 {rule.totalScore} 分。
                {rulesConfig.scoring.normalizeToHundred
                  ? '系统按百分制归一化折算：最终得分 = 原始得分 ÷ 原始满分 × 100。'
                  : '系统不启用百分制归一化，最终得分即原始得分。'}
              </li>
              <li>
                折算结果按「
                {rulesConfig.scoring.rounding === 'half_up'
                  ? '四舍五入'
                  : rulesConfig.scoring.rounding === 'floor'
                    ? '向下取整'
                    : rulesConfig.scoring.rounding === 'ceil'
                      ? '向上取整'
                      : '截断小数'}
                」保留 {rulesConfig.scoring.decimalPlaces} 位小数，及格线判定使用同一口径，避免边界分数不一致。
              </li>
              <li>
                {rule.negativeScoring
                  ? `本场考试启用倒扣分，答错题目会扣除配置的分值；未作答不扣分。总分最低为 ${rulesConfig.scoring.allowNegativeTotal ? '负分' : '0 分'}。`
                  : '本场考试不启用倒扣分：答错与未作答均为 0 分，不会产生负分。'}
              </li>
              <li>
                {rulesConfig.scoring.partialCreditEnabled
                  ? '多选题可能按题目配置启用部分得分规则，具体以题目说明为准。'
                  : '多选题采用严格匹配评分：选项集合完全一致才得满分，少选、多选或错选均不得满分。'}
              </li>
            </ul>
          </div>

          <Separator />

          {/* III. 题型构成 */}
          {paperPreview ? (
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-ink">题型构成</h3>
              <TableWrapper>
                <Table>
                  <caption className="sr-only">本场考试题型构成与作答说明</caption>
                  <thead>
                    <tr>
                      <TableHead>题型</TableHead>
                      <TableHead className="text-right">题量</TableHead>
                      <TableHead>作答说明</TableHead>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(paperPreview.typeCounts).map(([type, count]) => (
                      <tr key={type}>
                        <TableCell className="whitespace-nowrap font-medium">
                          {QUESTION_TYPE_LABELS[type as QuestionType] ?? type}
                        </TableCell>
                        <TableCell className="tabular text-right">{count} 题</TableCell>
                        <TableCell className="text-[12px] leading-relaxed text-ink-soft">
                          {QUESTION_TYPE_HINTS[type as QuestionType] ?? '按题目要求作答。'}
                        </TableCell>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrapper>

              <div className="flex flex-wrap gap-1.5">
                {Object.entries(paperPreview.categoryCounts).map(([category, count]) => (
                  <Badge key={category} variant="outline">
                    {QUESTION_CATEGORY_LABELS[category as keyof typeof QUESTION_CATEGORY_LABELS] ??
                      category}
                    ：{count} 题
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* IV. 考试须知 */}
      <Card>
        <CardContent className="flex flex-col gap-3">
          <h2 className="flex items-center gap-1.5 text-base font-semibold text-ink">
            <BookOpenCheck className="h-4 w-4 text-brand" aria-hidden="true" />
            考试须知
          </h2>

          <ol className="list-decimal space-y-2 pl-5 text-[13px] leading-relaxed text-ink-soft">
            {rule.instructions.map((instruction, index) => (
              <li key={index}>{instruction}</li>
            ))}
          </ol>

          <Separator />

          <div className="flex flex-col gap-2 text-[13px] leading-relaxed text-ink-soft">
            <h3 className="text-sm font-semibold text-ink">交卷与自动保存</h3>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                答题过程中系统会定期把答案、剩余时间与当前题号保存到本机数据库；
                刷新页面或意外关闭浏览器后，可从报名页恢复本次考试。
              </li>
              <li>
                倒计时归零时系统将自动交卷，已作答内容以最后一次自动保存为准，未作答题目按 0 分计。
              </li>
              <li>
                交卷前会弹出确认对话框，并明确告知未作答题目数量。交卷后考试记录变为已结算状态，
                <strong className="font-medium text-ink">答案不可再修改</strong>。
              </li>
              <li>
                交卷结算由统一评分引擎完成，主动交卷、超时自动交卷与恢复结算使用同一套流程，
                重复交卷不会重新判分。
              </li>
            </ul>
          </div>

          <Alert tone="warning" title="不可逆操作提示">
            <ul className="mt-1 list-disc space-y-1 pl-4">
              <li>点击「开始考试」后倒计时立即启动，中途退出不会暂停计时。</li>
              <li>交卷后本场考试的答卷将被锁定，无法继续作答或修改答案。</li>
              {mode === 'official' ? (
                <li>
                  正式考试的成绩会计入考试记录，并在通过时作为证件签发依据；
                  未通过时已取得的等级与证件不受影响。
                </li>
              ) : (
                <li>模拟考试的成绩不计入正式考试次数，也不会签发证件，仅用于练习。</li>
              )}
            </ul>
          </Alert>
        </CardContent>
      </Card>

      {/* V. 报名条件回显 */}
      {summary ? (
        <Card>
          <CardContent className="flex flex-col gap-2">
            <h2 className="flex items-center gap-1.5 text-base font-semibold text-ink">
              <Info className="h-4 w-4 text-ink-faint" aria-hidden="true" />
              报名条件
            </h2>
            <ul className="flex flex-col gap-1.5 text-[13px]">
              {rule.eligibility.requirePrerequisite ? (
                <li className="text-ink-soft">
                  前置等级：
                  {rule.eligibility.prerequisiteLevelIds
                    .map(
                      (levelId) =>
                        levels.levels.find((item) => item.levelId === levelId)?.nameZh ?? levelId,
                    )
                    .join(' / ')}
                </li>
              ) : (
                <li className="text-ink-soft">前置等级：无，任何已建立档案的考生均可报考</li>
              )}
              <li className="text-ink-soft">
                补考规则：
                {rule.allowRetake
                  ? rule.retakeCooldownMinutes > 0
                    ? `允许补考，间隔 ${rule.retakeCooldownMinutes} 分钟`
                    : '允许补考，可立即重考'
                  : '不允许补考（一次性认证考试）'}
              </li>
              <li className="text-ink-soft">
                当前等级：{summary.currentLevel.levelId} {summary.currentLevel.nameZh}
              </li>
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {/* VI. 开始考试 */}
      <Card>
        <CardContent className="flex flex-col gap-4">
          {requiresAgreement ? (
            <label
              htmlFor="agree-instructions"
              className="flex cursor-pointer items-start gap-2.5 rounded-md border border-line bg-surface-muted px-3.5 py-3"
            >
              <Checkbox
                id="agree-instructions"
                checked={agreed}
                onCheckedChange={(checked) => setAgreed(checked === true)}
                className="mt-0.5"
                aria-describedby="agree-hint"
              />
              <span className="text-[13px] leading-relaxed text-ink">
                我已阅读并理解上述考试须知，包括考试时限、分值规则、交卷规则与不可逆操作提示。
                <span id="agree-hint" className="mt-0.5 block text-[12px] text-ink-faint">
                  模拟考试免除该确认要求。
                </span>
              </span>
            </label>
          ) : (
            <Alert tone="info">
              本场为模拟考试，无需确认须知即可开始。模拟成绩不计入正式记录，也不会签发证件。
            </Alert>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="lg"
              onClick={() => void handleStart()}
              disabled={!canStart || !profile}
              data-testid="start-exam"
            >
              <PlayCircle className="h-4 w-4" aria-hidden="true" />
              {startAction.pending
                ? '正在生成试卷…'
                : mode === 'official'
                  ? '开始正式考试'
                  : '开始模拟考试'}
            </Button>

            <Button asChild variant="outline" size="lg">
              <Link to="/exams">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                返回报名页
              </Link>
            </Button>

            {requiresAgreement && !agreed ? (
              <span className="flex items-center gap-1.5 text-[12px] text-ink-faint">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                需先勾选已阅读考试须知
              </span>
            ) : null}
          </div>

          {!profile ? (
            <p className="text-[12px] text-fail">尚未建立本地档案，请先返回首页建立档案。</p>
          ) : null}
        </CardContent>
      </Card>

      <p className="text-[12px] leading-relaxed text-ink-faint">
        本场考试的难度分布：
        {Object.entries(
          rule.paper.difficultyDistribution ?? {},
        ).length > 0
          ? Object.entries(rule.paper.difficultyDistribution ?? {})
              .map(([difficulty, count]) => `${DIFFICULTY_LABELS[Number(difficulty) as 1]} ${count} 题`)
              .join('、')
          : '不限定难度，从题库中随机抽取'}
        。题目与选项顺序按考试配置随机化，因此每次考试的试卷构成可能不同。
      </p>
    </div>
  );
}
