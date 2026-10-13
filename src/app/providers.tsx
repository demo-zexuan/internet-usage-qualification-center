/**
 * 应用启动门与全局 Provider
 *
 * I. 启动顺序
 *
 * 1. 初始化 IndexedDB（含版本迁移）
 * 2. 校验内置配置（等级、权限、证件模板、公告、学习材料、考试规则、题库）
 * 3. 首次运行时把内置题库与规则播种进数据库
 * 4. 进入正常渲染
 *
 * II. 失败处理
 *
 * 1. 任何一步失败都展示明确的中文说明与修复建议，不展示原始堆栈
 * 2. 数据库不可用时明确告知「数据无法保存」，绝不假装保存成功
 *
 * @module app/providers
 * @author zexuan.peng
 * @created 2026-10-14
 */

import * as React from 'react';

import { ConfigProvider } from '@/app/config-context';
import type { StaticConfig } from '@/app/config-context';
import { APP_ABBR, APP_NAME_ZH } from '@/app/app-meta';
import { ThemeProvider } from '@/app/theme-context';
import { ErrorState, LoadingState } from '@/components/common/states';
import { Emblem } from '@/components/layout/emblem';
import { ToastProvider } from '@/components/ui/toast';
import { computeQuestionBankStats, validateExamRules } from '@/schemas';
import type { AppError, Result } from '@/types/common';
import type { QuestionBankRecord } from '@/types/question';
import { ensureConfigSeeded } from '@/features/config/service';
import { loadBuiltinConfigs } from '@/features/config/builtin';
import { initializeDatabase } from '@/services/database';

/** 启动状态 */
type BootState =
  | { status: 'loading' }
  | { status: 'error'; error: AppError }
  | { status: 'ready'; staticConfig: StaticConfig };

/** 执行完整的启动流程 */
async function bootstrap(): Promise<Result<StaticConfig, AppError>> {
  // I. 数据库初始化（含版本迁移）
  const dbResult = await initializeDatabase();
  if (!dbResult.ok) {
    return { ok: false, error: dbResult.error };
  }

  // II. 内置配置校验
  const builtin = loadBuiltinConfigs();
  if (!builtin.ok) {
    return { ok: false, error: builtin.error };
  }

  // III. 首次运行播种
  const seeded = await ensureConfigSeeded();
  if (!seeded.ok) {
    return { ok: false, error: seeded.error };
  }

  // IV. 组装静态配置：题库转换为落库形态，供数据库尚未写入时兜底使用
  const now = Date.now();
  const builtinBanks: QuestionBankRecord[] = builtin.value.questionBanks.map((bank) => ({
    ...bank,
    source: 'builtin' as const,
    importedAt: now,
    rawJson: JSON.stringify(bank, null, 2),
    stats: computeQuestionBankStats(bank),
  }));

  // 内置考试规则再次校验，确保兜底配置可用
  const rulesCheck = validateExamRules(builtin.value.examRules);
  if (!rulesCheck.ok || !rulesCheck.config) {
    return {
      ok: false,
      error: {
        code: 'EXAM_RULE_INVALID',
        message: '内置考试规则未通过校验，应用无法启动。',
        hint: '请恢复 src/data/exam-rules.json 后重新构建。',
        details: rulesCheck.issues.map((issue) => `${issue.path}：${issue.message}`),
      },
    };
  }

  return {
    ok: true,
    value: {
      levels: builtin.value.levels,
      permissions: builtin.value.permissions,
      certificateTemplate: builtin.value.certificateTemplate,
      announcements: builtin.value.announcements,
      studyMaterials: builtin.value.studyMaterials,
      builtinRules: rulesCheck.config,
      builtinBanks,
    },
  };
}

/** 启动画面：加载中 */
function BootLoading(): React.ReactElement {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-surface-muted px-4">
      <div className="flex flex-col items-center gap-3 text-center">
        <Emblem size={56} />
        <div>
          <p className="text-lg font-semibold text-ink">{APP_NAME_ZH}</p>
          <p className="text-[11px] uppercase tracking-[0.18em] text-ink-faint">{APP_ABBR}</p>
        </div>
      </div>
      <LoadingState
        className="w-full max-w-md"
        label="正在初始化本地考试数据库"
        description="首次访问需要建立本地数据表并写入内置题库，请稍候。"
        rows={2}
      />
    </div>
  );
}

/** 启动画面：失败 */
function BootFailure({
  error,
  onRetry,
}: {
  error: AppError;
  onRetry: () => void;
}): React.ReactElement {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-surface-muted px-4">
      <div className="flex flex-col items-center gap-3 text-center">
        <Emblem size={56} />
        <div>
          <p className="text-lg font-semibold text-ink">{APP_NAME_ZH}</p>
          <p className="text-[11px] uppercase tracking-[0.18em] text-ink-faint">{APP_ABBR}</p>
        </div>
      </div>

      <ErrorState
        className="w-full max-w-2xl bg-surface"
        title="应用初始化失败"
        message={error.message}
        hint={error.hint}
        code={error.code}
        details={error.details}
        onRetry={onRetry}
        retryLabel="重新初始化"
      />

      <p className="max-w-2xl text-center text-xs leading-relaxed text-ink-faint">
        若持续无法初始化，请确认浏览器未禁用本地存储（IndexedDB），并尝试清除本站点数据后重新加载。
      </p>
    </div>
  );
}

/** 启动门：负责初始化，成功后挂载配置上下文 */
function BootstrapGate({ children }: { children: React.ReactNode }): React.ReactElement {
  const [state, setState] = React.useState<BootState>({ status: 'loading' });
  const [attempt, setAttempt] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });

    void bootstrap().then((result) => {
      if (cancelled) {
        return;
      }
      if (result.ok) {
        setState({ status: 'ready', staticConfig: result.value });
      } else {
        setState({ status: 'error', error: result.error });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  if (state.status === 'loading') {
    return <BootLoading />;
  }

  if (state.status === 'error') {
    return <BootFailure error={state.error} onRetry={() => setAttempt((value) => value + 1)} />;
  }

  return <ConfigProvider staticConfig={state.staticConfig}>{children}</ConfigProvider>;
}

/** 全局 Provider 组合 */
export function AppProviders({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <ThemeProvider>
      <ToastProvider>
        <BootstrapGate>{children}</BootstrapGate>
      </ToastProvider>
    </ThemeProvider>
  );
}
