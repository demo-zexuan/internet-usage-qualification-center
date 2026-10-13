/**
 * 成绩页面
 *
 * I. 数据来源
 *
 * 1. 成绩全部来自统一评分引擎写入考试记录的 `result`，页面不进行任何分数计算
 * 2. 试卷快照与规则快照一并存于考试记录中，保证历史成绩可复核
 *
 * II. 证件签发
 *
 * 1. 正式考试通过后自动签发证件，签发过程幂等，重复打开成绩页不会重复签发
 * 2. 模拟考试不签发证件
 *
 * III. 未通过处理
 *
 * 1. 展示补考规则与等待时间，并给出模拟考试练习入口
 * 2. 明确说明未通过不会降低已取得的等级或作废已签发的证件
 *
 * @module pages/ExamResultPage
 * @author zexuan.peng
 * @created 2026-10-14
 */

import { Award, CircleCheck, CircleX, FileBadge, Info, RotateCcw } from 'lucide-react';
import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { useConfig } from '@/app/config-context';
import { LevelBadge, ResultBadge, StatTile } from '@/components/common/indicators';
import { PageHeader, Section } from '@/components/common/page-header';
import { ErrorState, LoadingState } from '@/components/common/states';
import { AnswersHiddenNotice, AnswerReview } from '@/components/exam/answer-review';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert } from '@/components/ui/feedback';
import { issueCertificateForAttempt } from '@/features/certificates/service';
import { finalizeAttempt, getAttempt } from '@/features/exams/attempt-service';
import { useUserData } from '@/hooks/use-user-data';
import { CERTIFICATE_STATUS_LABELS } from '@/types/certificate';
import type { CertificateRecord } from '@/types/certificate';
import type { AppError } from '@/types/common';
import type { ExamAttempt } from '@/types/exam';
import { EXAM_MODE_LABELS, SUBMIT_REASON_LABELS } from '@/types/exam';
import { formatDateTime, formatDuration, formatScore, formatWaitMinutes } from '@/utils/format';

/** 成绩页面 */
export function ExamResultPage(): React.ReactElement {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const { levels, certificateTemplate, rulesConfig } = useConfig();
  const { summary, catalog } = useUserData();

  const [attempt, setAttempt] = React.useState<ExamAttempt | null>(null);
  const [loadError, setLoadError] = React.useState<AppError | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [certificate, setCertificate] = React.useState<CertificateRecord | null>(null);
  const [certificateNote, setCertificateNote] = React.useState<string | null>(null);
  const [certificateError, setCertificateError] = React.useState<AppError | null>(null);

  /* ---------------- 载入考试记录 ---------------- */
  React.useEffect(() => {
    let cancelled = false;

    const load = async (): Promise<void> => {
      if (!attemptId) {
        setLoadError({
          code: 'INVALID_ROUTE_PARAM',
          message: '成绩页面地址不完整。',
          hint: '请返回考试历史页面重新选择记录。',
        });
        setLoading(false);
        return;
      }

      let record = await getAttempt(attemptId);

      if (cancelled) {
        return;
      }

      if (!record) {
        setLoadError({
          code: 'ATTEMPT_NOT_FOUND',
          message: '找不到该场考试记录。',
          hint: '该记录可能已被清除。请返回考试历史页面查看其他记录。',
        });
        setLoading(false);
        return;
      }

      // I. 仍在进行中：若已超时则统一结算，否则回到答题页继续作答
      if (record.status === 'in_progress') {
        if (Date.now() >= record.expiresAt) {
          const finalized = await finalizeAttempt(record.attemptId, 'recovery');
          if (!cancelled && finalized.ok) {
            record = finalized.value;
          }
        } else {
          navigate(`/exam/${record.attemptId}`, { replace: true });
          return;
        }
      }

      if (cancelled) {
        return;
      }

      setAttempt(record);
      setLoading(false);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [attemptId, navigate]);

  /* ---------------- 证件签发 ---------------- */
  // 记录已处理过的考试记录 ID，避免副作用因依赖变化被重复触发
  const issuanceHandledRef = React.useRef<string | null>(null);
  const mountedRef = React.useRef(true);

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  React.useEffect(() => {
    if (!attempt?.result || !summary) {
      return;
    }

    // 仅正式考试通过后签发；签发本身幂等，重复进入不会产生多张证件
    if (attempt.mode !== 'official' || !attempt.result.passed) {
      return;
    }

    if (issuanceHandledRef.current === attempt.attemptId) {
      return;
    }
    issuanceHandledRef.current = attempt.attemptId;

    // 不在此副作用中返回清理函数：签发结果必须落地到界面状态，
    // 否则依赖变化触发的重跑会把已成功的结果丢弃。重复调用由上面的 ref 与
    // 服务端的串行化幂等保护共同拦截。
    void (async () => {
      const outcome = await issueCertificateForAttempt({
        attempt,
        profile: summary.profile,
        template: certificateTemplate,
        levels,
        certifications: summary.certifications,
      });

      if (!mountedRef.current) {
        return;
      }

      if (outcome.ok) {
        setCertificate(outcome.value.certificate);
        setCertificateNote(outcome.value.reason);
        setCertificateError(null);
      } else {
        // 失败时允许下次渲染重试
        issuanceHandledRef.current = null;
        setCertificateError(outcome.error);
      }
    })();
  }, [attempt, summary, certificateTemplate, levels]);

  /* ---------------- 渲染分支 ---------------- */
  if (loading) {
    return <LoadingState label="正在读取成绩" description="系统正在读取试卷快照与评分结果。" rows={4} />;
  }

  if (loadError) {
    return (
      <div className="flex flex-col gap-4">
        <ErrorState
          title="无法读取成绩"
          message={loadError.message}
          hint={loadError.hint}
          code={loadError.code}
          details={loadError.details}
        />
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/history">返回考试历史</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!attempt?.result) {
    return (
      <ErrorState
        title="成绩尚未生成"
        message="该考试记录没有评分结果。"
        hint="请返回考试历史页面，或重新参加本场考试。"
        code="ATTEMPT_NOT_FOUND"
      />
    );
  }

  const result = attempt.result;
  const awardedLevelId = result.levelAwarded ?? attempt.levelId;
  const level = levels.levels.find((item) => item.levelId === awardedLevelId) ?? null;
  const nextLevel = levels.levels.find((item) => item.order === (level?.order ?? 0) + 1) ?? null;
  const catalogItem = catalog.find((item) => item.rule.examId === attempt.examId) ?? null;
  const grantingExam = rulesConfig.exams.find((exam) => exam.grantsLevelId === nextLevel?.levelId) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={EXAM_MODE_LABELS[attempt.mode]}
        title="考试成绩"
        crumbs={[
          { label: '首页', to: '/' },
          { label: '考试历史', to: '/history' },
          { label: '成绩详情' },
        ]}
        description={
          <>
            {attempt.examTitle} · 结算方式：
            {attempt.submitReason ? SUBMIT_REASON_LABELS[attempt.submitReason] : '未知'}
          </>
        }
        actions={
          <>
            <ResultBadge passed={result.passed} size="lg" />
            {level ? <LevelBadge level={level} size="default" /> : null}
          </>
        }
      />

      {/* I. 结果横幅 */}
      <Card className={result.passed ? 'border-pass/40' : 'border-fail/40'}>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs text-ink-faint">最终得分</p>
              <p
                className={`tabular mt-1 text-4xl font-semibold leading-none ${
                  result.passed ? 'text-pass' : 'text-fail'
                }`}
                data-testid="result-score"
              >
                {formatScore(result.score)}
                <span className="ml-1.5 text-base font-normal text-ink-faint">
                  / {formatScore(result.maxScore)} 分
                </span>
              </p>
              <p className="mt-2 text-[12px] text-ink-soft">
                及格线 {formatScore(result.passScore)} 分 ·{' '}
                {result.passed ? '已达到及格标准' : '未达到及格标准'}
              </p>
            </div>

            <div className="flex flex-col items-start gap-1 text-[12px] text-ink-soft">
              <span className="flex items-center gap-1.5">
                {result.passed ? (
                  <CircleCheck className="h-4 w-4 text-pass" aria-hidden="true" />
                ) : (
                  <CircleX className="h-4 w-4 text-fail" aria-hidden="true" />
                )}
                {result.passed ? '考试通过' : '考试未通过'}
              </span>
              <span>
                原始得分 {formatScore(result.rawEarnedScore)} / {formatScore(result.rawMaxScore)} 分
                {result.normalized ? '（已按百分制归一化）' : '（未归一化）'}
              </span>
              <span>
                评分规则 {result.scoringRuleVersion} · 舍入{' '}
                {result.rounding === 'half_up'
                  ? '四舍五入'
                  : result.rounding === 'floor'
                    ? '向下取整'
                    : result.rounding === 'ceil'
                      ? '向上取整'
                      : '截断'}
                ，保留 {result.decimalPlaces} 位小数
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="正确题数" value={result.correctCount} unit="题" tone="pass" />
            <StatTile
              label="部分得分"
              value={result.partialCount}
              unit="题"
              tone={result.partialCount > 0 ? 'brand' : 'default'}
            />
            <StatTile label="错误题数" value={result.wrongCount} unit="题" tone={result.wrongCount > 0 ? 'fail' : 'default'} />
            <StatTile
              label="未作答题数"
              value={result.unansweredCount}
              unit="题"
              tone={result.unansweredCount > 0 ? 'fail' : 'default'}
            />
          </div>
        </CardContent>
      </Card>

      {/* II. 通过结果 */}
      {result.passed ? (
        <Section
          title="等级与证件"
          description={
            result.levelAwarded
              ? `本场考试已授予 ${result.levelAwarded} 等级。`
              : '本场考试为专项能力认证考试，不提升等级。'
          }
        >
          <Card>
            <CardContent className="flex flex-col gap-4">
              {certificateError ? (
                <ErrorState
                  title="证件签发失败"
                  message={certificateError.message}
                  hint={certificateError.hint}
                  code={certificateError.code}
                  details={certificateError.details}
                />
              ) : null}

              {certificateNote ? <Alert tone="info">{certificateNote}</Alert> : null}

              {certificate ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
                      <FileBadge className="h-4 w-4 text-brand" aria-hidden="true" />
                      电子证件已签发
                    </p>
                    <p className="doc-code mt-1 text-[13px] text-ink-soft">
                      {certificate.certificateNumber}
                    </p>
                    <p className="mt-1 text-[12px] text-ink-faint">
                      等级 {certificate.levelId} · 授予于 {formatDateTime(certificate.issuedAt)} ·{' '}
                      {CERTIFICATE_STATUS_LABELS[certificate.status]}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild size="sm">
                      <Link to={`/certificate/${certificate.certificateId}`}>
                        <FileBadge className="h-4 w-4" aria-hidden="true" />
                        查看电子证件
                      </Link>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <Link to="/certificates">证件历史</Link>
                    </Button>
                  </div>
                </div>
              ) : attempt.mode === 'mock' ? (
                <Alert tone="info" title="模拟考试不签发证件">
                  本场为模拟考试，成绩不计入正式记录，也不会签发电子证件。
                  如需取得证件，请返回报名页参加正式考试。
                </Alert>
              ) : null}

              {result.certificationsAwarded.length > 0 ? (
                <div>
                  <p className="text-[12px] text-ink-faint">本场考试授予的专项能力认证</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {result.certificationsAwarded.map((certification) => (
                      <Badge key={certification} variant="brand">
                        {certification}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}

              {nextLevel ? (
                <div className="rounded-md border border-line bg-surface-muted px-3.5 py-3">
                  <p className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
                    <Award className="h-4 w-4 text-brand" aria-hidden="true" />
                    下一等级：{nextLevel.levelId} {nextLevel.nameZh}
                  </p>
                  {grantingExam ? (
                    <p className="mt-1.5 text-[12px] leading-relaxed text-ink-soft">
                      需通过「{grantingExam.title}」并达到 {grantingExam.passScore} 分
                      {grantingExam.eligibility.requirePrerequisite
                        ? `，且已取得前置等级 ${grantingExam.eligibility.prerequisiteLevelIds.join(' / ')}`
                        : ''}
                      。
                    </p>
                  ) : (
                    <p className="mt-1.5 text-[12px] text-ink-soft">当前配置中未找到授予该等级的考试。</p>
                  )}
                  <div className="mt-2">
                    <Link
                      to="/permissions"
                      className="text-[12px] font-medium text-brand underline-offset-4 hover:underline"
                    >
                      查看权限变化 →
                    </Link>
                  </div>
                </div>
              ) : (
                <p className="text-[12px] text-ink-soft">已取得本体系最高等级。</p>
              )}
            </CardContent>
          </Card>
        </Section>
      ) : (
        /* III. 未通过：补考规则 */
        <Section title="补考规则" description="未通过不会降低已取得的等级，也不会作废已签发的证件。">
          <Card>
            <CardContent className="flex flex-col gap-3">
              <ul className="flex flex-col gap-1.5 text-[13px] leading-relaxed text-ink-soft">
                <li>
                  补考资格：
                  {attempt.mode === 'mock'
                    ? '模拟考试不计入正式次数，可随时重新练习。'
                    : catalogItem?.rule.allowRetake
                      ? catalogItem.rule.retakeCooldownMinutes > 0
                        ? `允许补考，间隔 ${catalogItem.rule.retakeCooldownMinutes} 分钟。`
                        : '允许补考，可立即重新报名。'
                      : '本场考试为一次性认证考试，不予补考。'}
                </li>
                {catalogItem && !catalogItem.canRetakeNow && catalogItem.retakeWaitMinutes > 0 ? (
                  <li className="font-medium text-warn">
                    {formatWaitMinutes(catalogItem.retakeWaitMinutes)}。
                  </li>
                ) : null}
                {catalogItem?.rule.maxAttempts !== null && catalogItem ? (
                  <li>
                    正式考试次数：已参加 {catalogItem.officialAttemptCount} 次，上限{' '}
                    {catalogItem.rule.maxAttempts} 次。
                  </li>
                ) : null}
                <li>
                  建议先参加同一考试的模拟考试进行练习。模拟考试免除报名条件，
                  可完整查看答案解析，且不影响正式考试次数。
                </li>
              </ul>

              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link to={`/exams/${attempt.examId}/instructions?mode=mock`}>
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                    参加模拟考试
                  </Link>
                </Button>
                <Button asChild size="sm">
                  <Link to={`/exams/${attempt.examId}/instructions?mode=official`}>重新报名正式考试</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </Section>
      )}

      {/* IV. 考生与考试信息 */}
      <Section title="考试信息">
        <Card>
          <CardContent>
            <dl className="grid gap-x-6 gap-y-2 text-[13px] sm:grid-cols-2">
              <div className="flex items-center justify-between gap-3 sm:justify-start">
                <dt className="text-ink-faint">考生姓名</dt>
                <dd className="font-medium text-ink">{summary?.profile.displayName ?? '—'}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 sm:justify-start">
                <dt className="text-ink-faint">考生编号</dt>
                <dd className="doc-code text-ink-soft">{summary?.profile.candidateNumber ?? '—'}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 sm:justify-start">
                <dt className="text-ink-faint">考试名称</dt>
                <dd className="text-ink-soft">{attempt.examTitle}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 sm:justify-start">
                <dt className="text-ink-faint">考试模式</dt>
                <dd className="text-ink-soft">{EXAM_MODE_LABELS[attempt.mode]}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 sm:justify-start">
                <dt className="text-ink-faint">开始时间</dt>
                <dd className="tabular text-ink-soft">{formatDateTime(attempt.startedAt)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 sm:justify-start">
                <dt className="text-ink-faint">结束时间</dt>
                <dd className="tabular text-ink-soft">
                  {attempt.submittedAt ? formatDateTime(attempt.submittedAt) : '—'}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 sm:justify-start">
                <dt className="text-ink-faint">作答用时</dt>
                <dd className="tabular text-ink-soft">
                  {attempt.durationMs !== null ? formatDuration(attempt.durationMs) : '—'}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 sm:justify-start">
                <dt className="text-ink-faint">试卷题目来源</dt>
                <dd className="text-ink-soft">
                  {attempt.paper.bankRefs
                    .map((ref) => `${ref.title} v${ref.version}`)
                    .join('、') || '—'}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </Section>

      {/* V. 逐题复核 */}
      <Section
        title="逐题作答情况"
        description={
          result.answersVisible
            ? '以下展示每道题的作答、正确答案、解析、错误原因与相关知识点。'
            : '以下展示每道题的作答与得分，本场考试规则设置为不展示正确答案与解析。'
        }
        actions={
          <Badge variant="outline">
            共 {result.totalQuestions} 题 · 得分 {formatScore(result.score)} 分
          </Badge>
        }
      >
        {result.answersVisible ? null : <AnswersHiddenNotice />}

        <div className={result.answersVisible ? '' : 'mt-4'}>
          <AnswerReview
            attempt={attempt}
            results={result.questionResults}
            answersVisible={result.answersVisible}
          />
        </div>
      </Section>

      <Alert tone="info" title="成绩说明">
        <ul className="mt-1 list-disc space-y-1 pl-4">
          <li>
            成绩由统一评分引擎生成，页面不参与任何分数计算；试卷快照与规则版本一并保存在考试记录中，
            导入新题库不会影响本次成绩的复核。
          </li>
          <li>
            本系统为纯前端应用，成绩记录保存在本机浏览器中，不构成任何可被第三方验证的凭证。
          </li>
          {!result.answersVisible ? (
            <li>本场考试配置为不展示答案与解析，如需完整复盘请参加模拟考试。</li>
          ) : null}
        </ul>
      </Alert>

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link to="/history">
            <Info className="h-4 w-4" aria-hidden="true" />
            返回考试历史
          </Link>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link to="/exams">返回考试报名</Link>
        </Button>
      </div>
    </div>
  );
}
