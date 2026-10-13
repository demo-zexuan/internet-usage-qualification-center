/**
 * 应用配置上下文
 *
 * I. 提供内容
 *
 * 1. 只读内置配置：等级、权限、证件模板、公告、学习材料
 * 2. 可变的本地配置：当前启用的考试规则与题库（来自 IndexedDB）
 * 3. 应用设置：启用题库、公告阅读状态、学习材料进度、管理模式开关
 *
 * II. 实时性
 *
 * 1. 考试规则、题库与设置使用 Dexie 的实时查询，管理页面写入后界面自动刷新
 * 2. 内置配置在应用启动时一次性校验并缓存
 *
 * @module app/config-context
 * @author zexuan.peng
 * @created 2026-10-14
 */

import { useLiveQuery } from 'dexie-react-hooks';
import * as React from 'react';

import type { AnnouncementsConfig, StudyMaterialsConfig } from '@/types/settings';
import type { CertificateTemplate } from '@/types/certificate';
import type { ExamRulesConfig } from '@/types/exam';
import type { LevelsConfig } from '@/types/level';
import type { PermissionsConfig } from '@/types/permission';
import type { QuestionBankRecord } from '@/types/question';

import { db } from '@/services/database';

/** 应用设置快照（带默认值） */
export interface AppSettingsSnapshot {
  activeBankIds: string[];
  activeRulesId: string | null;
  adminMode: boolean;
  onboardingCompleted: boolean;
  readAnnouncementIds: string[];
  studyMaterialProgress: Record<string, number>;
  examPreferences: {
    fontSize: 'normal' | 'large';
    autoAdvance: boolean;
    highlightFlagged: boolean;
  };
}

/** 默认应用设置 */
export const DEFAULT_SETTINGS: AppSettingsSnapshot = {
  activeBankIds: [],
  activeRulesId: null,
  adminMode: false,
  onboardingCompleted: false,
  readAnnouncementIds: [],
  studyMaterialProgress: {},
  examPreferences: {
    fontSize: 'normal',
    autoAdvance: false,
    highlightFlagged: true,
  },
};

/** 配置上下文取值 */
export interface ConfigContextValue {
  /** 只读内置配置 */
  levels: LevelsConfig;
  permissions: PermissionsConfig;
  certificateTemplate: CertificateTemplate;
  announcements: AnnouncementsConfig;
  studyMaterials: StudyMaterialsConfig;
  /** 当前启用的考试规则 */
  rulesConfig: ExamRulesConfig;
  /** 本地全部题库 */
  banks: QuestionBankRecord[];
  /** 当前启用的题库 */
  activeBanks: QuestionBankRecord[];
  /** 应用设置 */
  settings: AppSettingsSnapshot;
}

const ConfigContext = React.createContext<ConfigContextValue | null>(null);

/** 只读内置配置（由启动阶段校验后注入） */
export interface StaticConfig {
  levels: LevelsConfig;
  permissions: PermissionsConfig;
  certificateTemplate: CertificateTemplate;
  announcements: AnnouncementsConfig;
  studyMaterials: StudyMaterialsConfig;
  /** 内置考试规则，作为数据库尚未播种时的兜底 */
  builtinRules: ExamRulesConfig;
  /** 内置题库，作为数据库尚未播种时的兜底 */
  builtinBanks: QuestionBankRecord[];
}

/** 配置 Provider */
export function ConfigProvider({
  staticConfig,
  children,
}: {
  staticConfig: StaticConfig;
  children: React.ReactNode;
}): React.ReactElement {
  // I. 实时读取考试规则、题库与设置
  const rulesRecords = useLiveQuery(() => db.examRules.toArray(), [], undefined);
  const bankRecords = useLiveQuery(() => db.questionBanks.toArray(), [], undefined);
  const settingRecords = useLiveQuery(() => db.appSettings.toArray(), [], undefined);

  const settings = React.useMemo<AppSettingsSnapshot>(() => {
    const snapshot: AppSettingsSnapshot = {
      ...DEFAULT_SETTINGS,
      examPreferences: { ...DEFAULT_SETTINGS.examPreferences },
    };

    for (const record of settingRecords ?? []) {
      switch (record.key) {
        case 'activeBankIds':
          snapshot.activeBankIds = (record.value as string[]) ?? [];
          break;
        case 'activeRulesId':
          snapshot.activeRulesId = (record.value as string) ?? null;
          break;
        case 'adminMode':
          snapshot.adminMode = Boolean(record.value);
          break;
        case 'onboardingCompleted':
          snapshot.onboardingCompleted = Boolean(record.value);
          break;
        case 'readAnnouncementIds':
          snapshot.readAnnouncementIds = (record.value as string[]) ?? [];
          break;
        case 'studyMaterialProgress':
          snapshot.studyMaterialProgress = (record.value as Record<string, number>) ?? {};
          break;
        case 'examPreferences':
          snapshot.examPreferences = {
            ...snapshot.examPreferences,
            ...((record.value as AppSettingsSnapshot['examPreferences']) ?? {}),
          };
          break;
        default:
          break;
      }
    }

    return snapshot;
  }, [settingRecords]);

  const banks = React.useMemo<QuestionBankRecord[]>(
    () => (bankRecords && bankRecords.length > 0 ? bankRecords : staticConfig.builtinBanks),
    [bankRecords, staticConfig.builtinBanks],
  );

  const activeBanks = React.useMemo<QuestionBankRecord[]>(() => {
    if (settings.activeBankIds.length === 0) {
      return banks;
    }
    const active = banks.filter((bank) => settings.activeBankIds.includes(bank.bankId));
    // 启用的题库全部被删除时回退到全部题库，避免进入无题可用的死状态
    return active.length > 0 ? active : banks;
  }, [banks, settings.activeBankIds]);

  const rulesConfig = React.useMemo<ExamRulesConfig>(() => {
    const records = rulesRecords ?? [];
    const active = settings.activeRulesId
      ? records.find((record) => record.rulesId === settings.activeRulesId)
      : records.find((record) => record.isActive);

    if (!active) {
      return staticConfig.builtinRules;
    }

    const { source: _source, importedAt: _importedAt, rawJson: _rawJson, isActive: _isActive, ...config } =
      active;
    return config;
  }, [rulesRecords, settings.activeRulesId, staticConfig.builtinRules]);

  const value = React.useMemo<ConfigContextValue>(
    () => ({
      levels: staticConfig.levels,
      permissions: staticConfig.permissions,
      certificateTemplate: staticConfig.certificateTemplate,
      announcements: staticConfig.announcements,
      studyMaterials: staticConfig.studyMaterials,
      rulesConfig,
      banks,
      activeBanks,
      settings,
    }),
    [staticConfig, rulesConfig, banks, activeBanks, settings],
  );

  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
}

/** 读取配置上下文 */
export function useConfig(): ConfigContextValue {
  const context = React.useContext(ConfigContext);
  if (!context) {
    throw new Error('useConfig 必须在 ConfigProvider 内部使用');
  }
  return context;
}
