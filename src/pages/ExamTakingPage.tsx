/**
 * 在线考试页（项目最核心页面）
 *
 * I. 答题能力
 *
 * 1. 支持单选、多选、判断、情景分析、阅读理解与观点辨析六种题型的作答
 * 2. 切换题目不丢失答案；答案、剩余时间与当前题号定期保存至 IndexedDB
 * 3. 刷新页面或意外关闭浏览器后可从报名页恢复本次考试
 *
 * II. 计时与结算
 *
 * 1. 倒计时以试卷快照中的到期时间为准，不受页面刷新影响
 * 2. 倒计时归零时自动交卷；主动交卷、超时交卷与恢复结算共用统一结算流程
 * 3. 结算后考试状态变为已提交，答卷不可再修改
 *
 * III. 防重复
 *
 * 1. 交卷按钮与结算流程均带幂等保护，重复点击不会产生重复结算
 * 2. 结算进行中禁止再次触发保存与交卷
 *
 * IV. 键盘
 *
 * 1. 左右方向键切换题目，数字键 1-9 选择选项，F 键标记疑问
 * 2. 快捷键在输入类控件获得焦点时不生效，避免干扰正常输入
 *
 * @module pages/ExamTakingPage
 * @author zexuan.peng
 * @created 2026-10-14
 */

import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CloudOff,
  Keyboard,
  ListOrdered,
  Save,
  Send,
} from 'lucide-react';
import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { useConfig } from '@/app/config-context';
import { LevelBadge } from '@/components/common/indicators';
import { ErrorState, LoadingState } from '@/components/common/states';
import { ExamTimer } from '@/components/exam/exam-timer';
import { QuestionCard } from '@/components/exam/question-card';
import { QuestionNavigator } from '@/components/exam/question-navigator';
import { SubmitDialog } from '@/components/exam/submit-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/feedback';
import { useToast } from '@/components/ui/toast';
import {
  finalizeAttempt,
  getAttempt,
  getRemainingMs,
  saveAttemptProgress,
} from '@/features/exams/attempt-service';
import { useUserData } from '@/hooks/use-user-data';
import { EXAM_MODE_LABELS } from '@/types/exam';
import type { AppError } from '@/types/common';
import type { ExamAttempt } from '@/types/exam';
import { formatClock } from '@/utils/format';
import { cn } from '@/utils/cn';

/** 在线考试页 */
export function ExamTakingPage(): React.ReactElement {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { levels, settings } = useConfig();
  const { status: userStatus } = useUserData();

  /* ---------------- 状态 ---------------- */
  const [attempt, setAttempt] = React.useState<ExamAttempt | null>(null);
  const [loadError, setLoadError] = React.useState<AppError | null>(null);
  const [loading, setLoading] = React.useState(true);

  const [answers, setAnswers] = React.useState<Record<string, string[]>>({});
  const [flaggedIds, setFlaggedIds] = React.useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = React.useState(0);

  const [remainingMs, setRemainingMs] = React.useState(0);
  const [lastSavedAt, setLastSavedAt] = React.useState<number | null>(null);
  const [saveError, setSaveError] = React.useState<AppError | null>(null);

  const [submitOpen, setSubmitOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [navigatorOpen, setNavigatorOpen] = React.useState(false);

  // 用 ref 保存最新值，供防抖保存与事件回调读取，避免闭包捕获旧状态
  const attemptRef = React.useRef<ExamAttempt | null>(null);
  const answersRef = React.useRef<Record<string, string[]>>({});
  const flaggedRef = React.useRef<string[]>([]);
  const indexRef = React.useRef(0);
  const settledRef = React.useRef(false);

  answersRef.current = answers;
  flaggedRef.current = flaggedIds;
  indexRef.current = currentIndex;

  const largeFont = settings.examPreferences.fontSize === 'large';

  /* ---------------- 载入考试记录 ---------------- */
  React.useEffect(() => {
    let cancelled = false;

    const load = async (): Promise<void> => {
      if (!attemptId) {
        setLoadError({
          code: 'INVALID_ROUTE_PARAM',
          message: '考试记录地址不完整。',
          hint: '请返回报名页重新进入考试。',
        });
        setLoading(false);
        return;
      }

      const record = await getAttempt(attemptId);

      if (cancelled) {
        return;
      }

      if (!record) {
        setLoadError({
          code: 'ATTEMPT_NOT_FOUND',
          message: '找不到该场考试记录。',
          hint: '该记录可能已被清除。请返回报名页重新开始考试。',
        });
        setLoading(false);
        return;
      }

      // I. 已结算的考试：直接跳转成绩页，禁止继续修改答案
      if (record.status !== 'in_progress') {
        navigate(`/results/${record.attemptId}`, { replace: true });
        return;
      }

      // II. 进入时已超时：按「恢复结算」统一处理
      if (getRemainingMs(record) <= 0) {
        settledRef.current = true;
        const finalized = await finalizeAttempt(record.attemptId, 'recovery');
        if (!cancelled && finalized.ok) {
          toast({
            title: '考试已超时，系统自动交卷',
            description: '恢复考试时发现时限已届满，已按最后一次自动保存的内容结算。',
            tone: 'warning',
          });
        }
        navigate(`/results/${record.attemptId}`, { replace: true });
        return;
      }

      attemptRef.current = record;
      setAttempt(record);
      setAnswers(record.answers);
      setFlaggedIds(record.flaggedQuestionIds);
      setCurrentIndex(Math.min(record.currentIndex, record.paper.questions.length - 1));
      setRemainingMs(getRemainingMs(record));
      setLastSavedAt(record.lastSavedAt);
      setLoading(false);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [attemptId, navigate, toast]);

  /* ---------------- 倒计时 ---------------- */
  React.useEffect(() => {
    if (!attempt || settledRef.current) {
      return;
    }

    const tick = (): void => {
      setRemainingMs(getRemainingMs(attempt));
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [attempt]);

  /* ---------------- 进度保存 ---------------- */
  const persist = React.useCallback(async (): Promise<void> => {
    const current = attemptRef.current;
    if (!current || settledRef.current) {
      return;
    }

    const result = await saveAttemptProgress({
      attemptId: current.attemptId,
      answers: answersRef.current,
      flaggedQuestionIds: flaggedRef.current,
      currentIndex: indexRef.current,
    });

    if (result.ok) {
      setLastSavedAt(Date.now());
      setSaveError(null);
    } else {
      setSaveError(result.error);
    }
  }, []);

  // I. 答题变化后防抖保存
  React.useEffect(() => {
    if (!attempt || settledRef.current) {
      return;
    }
    const timer = setTimeout(() => {
      void persist();
    }, 900);
    return () => clearTimeout(timer);
  }, [answers, flaggedIds, currentIndex, attempt, persist]);

  // II. 周期性保存：即使没有答题变化，也同步剩余时间
  React.useEffect(() => {
    if (!attempt || settledRef.current) {
      return;
    }
    const timer = setInterval(() => {
      void persist();
    }, 10_000);
    return () => clearInterval(timer);
  }, [attempt, persist]);

  // III. 页面隐藏或关闭前立即保存，降低意外退出丢失进度的风险
  React.useEffect(() => {
    const handleVisibilityChange = (): void => {
      if (document.visibilityState === 'hidden') {
        void persist();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [persist]);

  /* ---------------- 结算 ---------------- */
  const settle = React.useCallback(
    async (reason: 'user' | 'timeout'): Promise<void> => {
      const current = attemptRef.current;

      if (!current || settledRef.current) {
        return;
      }

      settledRef.current = true;
      setSubmitting(true);

      // 交卷前最后一次保存，确保已作答内容完整落库
      await saveAttemptProgress({
        attemptId: current.attemptId,
        answers: answersRef.current,
        flaggedQuestionIds: flaggedRef.current,
        currentIndex: indexRef.current,
      });

      const result = await finalizeAttempt(current.attemptId, reason);
      setSubmitting(false);

      if (!result.ok) {
        settledRef.current = false;
        setSaveError(result.error);
        toast({
          title: '交卷失败',
          description: result.error.message,
          tone: 'error',
        });
        return;
      }

      toast({
        title: reason === 'timeout' ? '考试时间已到，系统自动交卷' : '交卷成功',
        description: '成绩已生成，答卷已锁定，无法再修改答案。',
        tone: reason === 'timeout' ? 'warning' : 'success',
      });

      navigate(`/results/${current.attemptId}`, { replace: true });
    },
    [navigate, toast],
  );

  // 倒计时归零自动交卷
  React.useEffect(() => {
    if (!attempt || settledRef.current || remainingMs > 0) {
      return;
    }
    void settle('timeout');
  }, [remainingMs, attempt, settle]);

  /* ---------------- 答题操作 ---------------- */
  const question = attempt?.paper.questions[currentIndex] ?? null;
  const total = attempt?.paper.questions.length ?? 0;

  const answeredIndexes = React.useMemo(() => {
    const set = new Set<number>();
    attempt?.paper.questions.forEach((item, index) => {
      if ((answers[item.questionId] ?? []).length > 0) {
        set.add(index);
      }
    });
    return set;
  }, [attempt, answers]);

  const flaggedIndexes = React.useMemo(() => {
    const set = new Set<number>();
    attempt?.paper.questions.forEach((item, index) => {
      if (flaggedIds.includes(item.questionId)) {
        set.add(index);
      }
    });
    return set;
  }, [attempt, flaggedIds]);

  const unansweredCount = total - answeredIndexes.size;

  /** 选择选项：单选替换，多选切换 */
  const handleSelect = React.useCallback(
    (optionId: string): void => {
      if (!question || settledRef.current) {
        return;
      }

      setAnswers((current) => {
        const previous = current[question.questionId] ?? [];

        if (question.selection === 'multiple') {
          const next = previous.includes(optionId)
            ? previous.filter((id) => id !== optionId)
            : [...previous, optionId];
          return { ...current, [question.questionId]: next };
        }

        return { ...current, [question.questionId]: [optionId] };
      });
    },
    [question],
  );

  /** 标记或取消标记疑问 */
  const handleToggleFlag = React.useCallback((): void => {
    if (!question) {
      return;
    }
    setFlaggedIds((current) =>
      current.includes(question.questionId)
        ? current.filter((id) => id !== question.questionId)
        : [...current, question.questionId],
    );
  }, [question]);

  /** 跳转到指定题号 */
  const goTo = React.useCallback(
    (index: number): void => {
      if (!attempt) {
        return;
      }
      setCurrentIndex(Math.min(Math.max(index, 0), attempt.paper.questions.length - 1));
      setNavigatorOpen(false);
    },
    [attempt],
  );

  /* ---------------- 键盘快捷键 ---------------- */
  React.useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      // 数字键选择选项
      if (/^[1-9]$/.test(event.key) && question) {
        const option = question.options[Number(event.key) - 1];
        if (option) {
          event.preventDefault();
          handleSelect(option.id);
        }
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goTo(currentIndex - 1);
        return;
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        goTo(currentIndex + 1);
        return;
      }

      if (event.key === 'f' || event.key === 'F') {
        event.preventDefault();
        handleToggleFlag();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [question, currentIndex, goTo, handleSelect, handleToggleFlag]);

  /* ---------------- 渲染分支 ---------------- */
  if (loading || userStatus === 'loading') {
    return <LoadingState label="正在恢复考试记录" description="系统正在读取试卷快照与已保存的作答内容。" rows={4} />;
  }

  if (loadError) {
    return (
      <div className="flex flex-col gap-4">
        <ErrorState
          title="无法进入考试"
          message={loadError.message}
          hint={loadError.hint}
          code={loadError.code}
          details={loadError.details}
        />
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/exams">返回考试报名</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/">返回首页</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!attempt || !question) {
    return (
      <ErrorState
        title="试卷内容为空"
        message="本场考试的试卷快照中没有题目，无法继续作答。"
        hint="该情况通常由题库在考试开始后被清空导致。请返回报名页重新开始考试。"
        code="QUESTION_BANK_EMPTY"
      />
    );
  }

  const level = levels.levels.find((item) => item.levelId === attempt.levelId) ?? null;
  const progressPercent = total > 0 ? (answeredIndexes.size / total) * 100 : 0;

  return (
    <div className="flex flex-col gap-4">
      {/* I. 顶部信息栏 */}
      <Card className="sticky top-16 z-20">
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-base font-semibold leading-snug text-ink">{attempt.examTitle}</h1>
                <Badge variant={attempt.mode === 'official' ? 'brand' : 'info'}>
                  {EXAM_MODE_LABELS[attempt.mode]}
                </Badge>
                {level ? <LevelBadge level={level} size="sm" /> : null}
              </div>
              <p className="mt-1 text-[12px] text-ink-faint">
                试卷编号 <span className="doc-code">{attempt.paper.paperId.slice(-12)}</span> · 抽题种子{' '}
                <span className="doc-code">{attempt.paper.seed}</span>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <ExamTimer remainingMs={remainingMs} />
              <Button
                variant="danger"
                onClick={() => setSubmitOpen(true)}
                disabled={submitting}
                data-testid="open-submit"
              >
                <Send className="h-4 w-4" aria-hidden="true" />
                交卷
              </Button>
            </div>
          </div>

          {/* II. 进度 */}
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-ink-soft">
              <span className="tabular">
                当前第 {currentIndex + 1} 题 / 共 {total} 题 · 已作答 {answeredIndexes.size} 题 ·
                未作答{' '}
                <span className={cn('font-semibold', unansweredCount > 0 ? 'text-warn' : 'text-pass')}>
                  {unansweredCount}
                </span>{' '}
                题
              </span>
              <span className="flex items-center gap-1.5">
                {saveError ? (
                  <>
                    <CloudOff className="h-3.5 w-3.5 text-fail" aria-hidden="true" />
                    <span className="text-fail">自动保存失败</span>
                  </>
                ) : lastSavedAt ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-pass" aria-hidden="true" />
                    <span>已自动保存 {formatClock(lastSavedAt)}</span>
                  </>
                ) : (
                  <span>等待首次自动保存</span>
                )}
              </span>
            </div>
            <Progress
              value={progressPercent}
              tone={unansweredCount === 0 ? 'pass' : 'brand'}
              aria-label={`答题进度 ${Math.round(progressPercent)}%`}
            />
          </div>
        </CardContent>
      </Card>

      {saveError ? (
        <ErrorState
          title="答题进度保存失败"
          message={saveError.message}
          hint={saveError.hint ?? '答案仍保留在当前页面中，请不要关闭浏览器，并尝试点击「暂存答案」重试。'}
          code={saveError.code}
          details={saveError.details}
        />
      ) : null}

      {/* III. 主体：题目 + 题号导航 */}
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="min-w-0 flex-1">
          <Card>
            <CardContent>
              <QuestionCard
                question={question}
                number={currentIndex + 1}
                total={total}
                selectedOptionIds={answers[question.questionId] ?? []}
                flagged={flaggedIds.includes(question.questionId)}
                largeFont={largeFont}
                onSelect={handleSelect}
                onToggleFlag={handleToggleFlag}
              />
            </CardContent>
          </Card>

          {/* IV. 底部操作 */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={() => goTo(currentIndex - 1)}
              disabled={currentIndex === 0}
              data-testid="prev-question"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              上一题
            </Button>

            <Button
              variant="outline"
              onClick={() => goTo(currentIndex + 1)}
              disabled={currentIndex >= total - 1}
              data-testid="next-question"
            >
              下一题
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>

            <Button
              variant="subtle"
              onClick={() => {
                void persist().then(() => {
                  toast({ title: '答案已暂存到本机', tone: 'success', durationMs: 2500 });
                });
              }}
              data-testid="save-progress"
            >
              <Save className="h-4 w-4" aria-hidden="true" />
              暂存答案
            </Button>

            <Button
              variant="ghost"
              onClick={() => setNavigatorOpen((current) => !current)}
              aria-expanded={navigatorOpen}
              className="lg:hidden"
            >
              <ListOrdered className="h-4 w-4" aria-hidden="true" />
              题号面板
            </Button>
          </div>

          {/* V. 键盘说明 */}
          <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-faint">
            <span className="flex items-center gap-1">
              <Keyboard className="h-3.5 w-3.5" aria-hidden="true" />
              键盘快捷键：
            </span>
            <span>← / → 切换题目</span>
            <span>1-9 选择选项</span>
            <span>F 标记疑问</span>
          </p>
        </div>

        {/* VI. 题号导航 */}
        <aside className={cn('lg:block lg:w-64 lg:shrink-0', navigatorOpen ? 'block' : 'hidden')}>
          <Card className="lg:sticky lg:top-44">
            <CardContent>
              <QuestionNavigator
                total={total}
                currentIndex={currentIndex}
                answeredIndexes={answeredIndexes}
                flaggedIndexes={flaggedIndexes}
                onJump={goTo}
              />
            </CardContent>
          </Card>
        </aside>
      </div>

      {/* VII. 交卷确认 */}
      <SubmitDialog
        open={submitOpen}
        onOpenChange={setSubmitOpen}
        unansweredCount={unansweredCount}
        flaggedCount={flaggedIndexes.size}
        total={total}
        pending={submitting}
        onConfirm={() => {
          void settle('user');
        }}
      />
    </div>
  );
}
