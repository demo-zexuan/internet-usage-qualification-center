/**
 * 考生数据钩子
 *
 * I. 单一数据源
 *
 * 1. 档案、证件、考试记录全部通过 Dexie 实时查询获取，任何写入都会自动刷新界面
 * 2. 等级、权限、考试目录等派生数据统一在此计算，页面组件不得自行推导
 *
 * II. 状态机
 *
 * 1. `loading` 数据尚未读出
 * 2. `no-profile` 尚未建立本地档案（首次访问）
 * 3. `ready` 数据完整可用
 *
 * @module hooks/use-user-data
 * @author zexuan.peng
 * @created 2026-10-14
 */

import { useLiveQuery } from 'dexie-react-hooks';
import * as React from 'react';

import type { CertificateRecord } from '@/types/certificate';
import type { ExamAttempt, ExamCatalogItem } from '@/types/exam';
import type { PermissionContext, PermissionState } from '@/types/permission';
import type { UserProfileRecord, UserProfileSummary } from '@/types/user';

import { useConfig } from '@/app/config-context';
import { buildExamCatalog } from '@/features/exams/catalog';
import {
  buildPermissionContext,
  computeAllPermissionStates,
  findPermission,
  hasPermission as checkPermission,
} from '@/features/permissions/engine';
import { buildProfileSummary } from '@/features/profile/summary';
import { db } from '@/services/database';

/** 考生数据状态 */
export interface UserDataState {
  status: 'loading' | 'no-profile' | 'ready';
  profile: UserProfileRecord | null;
  certificates: CertificateRecord[];
  attempts: ExamAttempt[];
  summary: UserProfileSummary | null;
  permissionContext: PermissionContext | null;
  permissionStates: PermissionState[];
  catalog: ExamCatalogItem[];
}

/**
 * 读取当前本地档案及其全部派生数据
 *
 * 本应用为单机应用，数据库中最多存在一份档案，因此直接取第一条记录。
 */
export function useUserData(): UserDataState {
  const config = useConfig();

  const profile = useLiveQuery(async () => {
    const records = await db.users.toCollection().toArray();
    return records[0] ?? null;
  }, []);

  const userId = profile?.userId ?? null;

  const certificates = useLiveQuery(
    async () => (userId ? db.certificates.where('userId').equals(userId).toArray() : []),
    [userId],
  );

  const attempts = useLiveQuery(
    async () => (userId ? db.examAttempts.where('userId').equals(userId).toArray() : []),
    [userId],
  );

  const loading =
    profile === undefined || certificates === undefined || attempts === undefined;

  const state = React.useMemo<UserDataState>(() => {
    if (loading) {
      return {
        status: 'loading',
        profile: null,
        certificates: [],
        attempts: [],
        summary: null,
        permissionContext: null,
        permissionStates: [],
        catalog: [],
      };
    }

    if (!profile) {
      return {
        status: 'no-profile',
        profile: null,
        certificates: [],
        attempts: [],
        summary: null,
        permissionContext: null,
        permissionStates: [],
        catalog: [],
      };
    }

    // I. 档案汇总
    const summary = buildProfileSummary({
      profile,
      certificates,
      attempts,
      levels: config.levels,
      rulesConfig: config.rulesConfig,
      studyMaterialProgress: config.settings.studyMaterialProgress,
    });

    // II. 权限上下文与权限状态
    const permissionContext = buildPermissionContext({
      levels: config.levels,
      certificates,
      certifications: summary.certifications,
    });

    const permissionStates = computeAllPermissionStates(
      permissionContext,
      config.permissions,
      config.levels,
    );

    // III. 考试目录
    const catalog = buildExamCatalog({
      rulesConfig: config.rulesConfig,
      levels: config.levels,
      certificates,
      attempts,
      studyMaterialProgress: config.settings.studyMaterialProgress,
    });

    return {
      status: 'ready',
      profile,
      certificates: [...certificates].sort(
        (a, b) => b.levelOrder - a.levelOrder || b.issuedAt - a.issuedAt,
      ),
      attempts: [...attempts].sort((a, b) => b.startedAt - a.startedAt),
      summary,
      permissionContext,
      permissionStates,
      catalog,
    };
  }, [loading, profile, certificates, attempts, config]);

  return state;
}

/** 权限判定结果 */
export interface PermissionCheck {
  permissionId: string;
  unlocked: boolean;
  state: PermissionState | null;
}

/**
 * 判定当前使用者是否拥有某项权限
 *
 * 页面路由、按钮显示与模拟功能必须统一使用本钩子，禁止用页面隐藏代替权限判定。
 */
export function usePermission(permissionId: string): PermissionCheck {
  const { permissionContext, permissionStates } = useUserData();
  const config = useConfig();

  return React.useMemo(() => {
    const state = permissionStates.find((item) => item.definition.permissionId === permissionId) ?? null;

    if (!permissionContext) {
      return { permissionId, unlocked: false, state };
    }

    return {
      permissionId,
      unlocked: checkPermission(permissionContext, permissionId, config.permissions),
      state,
    };
  }, [permissionContext, permissionStates, permissionId, config.permissions]);
}

/** 取得权限定义（不存在时返回 null） */
export function usePermissionDefinition(permissionId: string): ReturnType<typeof findPermission> {
  const config = useConfig();
  return React.useMemo(
    () => findPermission(config.permissions, permissionId),
    [config.permissions, permissionId],
  );
}
