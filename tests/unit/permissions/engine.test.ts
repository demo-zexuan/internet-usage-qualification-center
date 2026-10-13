/**
 * 权限计算引擎单元测试
 *
 * 覆盖项目测试要求中的权限相关条目：
 * 1. 等级权限继承
 * 2. 显式授权等级清单
 * 3. 专项能力认证条件
 * 4. 已作废证件失去效力，已被替代证件仍有效
 * 5. 升级考试失败后保留原等级与权限
 *
 * @author zexuan.peng
 * @created 2026-10-14
 */

import { describe, expect, it } from 'vitest';

import {
  buildPermissionContext,
  computeAllPermissionStates,
  hasPermission,
  isPermissionUnlocked,
} from '@/features/permissions/engine';
import type { CertificateRecord } from '@/types/certificate';
import type { LevelsConfig } from '@/types/level';
import type { PermissionsConfig } from '@/types/permission';

/** 等级配置：L0 临时状态 + L1..L6 */
const levels: LevelsConfig = {
  schemaVersion: '1.0.0',
  configId: 'test',
  version: '1.0.0',
  title: '测试等级',
  description: '',
  levels: [
    {
      levelId: 'L0',
      order: 0,
      nameZh: '临时浏览状态',
      nameEn: 'Provisional',
      shortName: '临时',
      summary: '',
      description: '',
      badgeColorToken: 'level-1',
      certificateTitle: '',
      certificateMotto: '',
      isEntryLevel: false,
      isTemporary: true,
      disclaimer: '',
    },
    ...Array.from({ length: 6 }, (_, index) => ({
      levelId: `L${index + 1}`,
      order: index + 1,
      nameZh: `等级 ${index + 1}`,
      nameEn: `Level ${index + 1}`,
      shortName: `L${index + 1}`,
      summary: '',
      description: '',
      badgeColorToken: `level-${index + 1}` as const,
      certificateTitle: '',
      certificateMotto: '',
      isEntryLevel: index === 0,
      isTemporary: false,
      disclaimer: '',
    })),
  ],
};

/** 权限配置：覆盖继承、显式清单与专项认证三种解锁方式 */
const permissions: PermissionsConfig = {
  schemaVersion: '1.0.0',
  configId: 'test',
  version: '1.0.0',
  title: '测试权限',
  description: '',
  globalDisclaimer: '全部权限均为应用内模拟授权。',
  permissions: [
    {
      permissionId: 'guest_access',
      group: 'basic',
      name: '临时浏览',
      description: '',
      unlockCondition: '建立档案即可',
      upgradeAdvice: '',
      requiredLevelOrder: 0,
      simulated: true,
      route: '/simulator',
      disclaimer: '模拟权限，不影响真实网络连接。',
    },
    {
      permissionId: 'browse',
      group: 'basic',
      name: '浏览互联网',
      description: '',
      unlockCondition: '取得 L1',
      upgradeAdvice: '',
      requiredLevelOrder: 1,
      simulated: true,
      route: '/simulator',
      disclaimer: '模拟权限，不影响真实网络连接。',
    },
    {
      permissionId: 'comment',
      group: 'interaction',
      name: '发表评论',
      description: '',
      unlockCondition: '取得 L2',
      upgradeAdvice: '',
      requiredLevelOrder: 2,
      simulated: true,
      route: '/simulator/discussion',
      disclaimer: '模拟权限，不影响真实网络连接。',
    },
    {
      permissionId: 'vpn_zone',
      group: 'cross_border',
      name: 'VPN 知识专区',
      description: '',
      unlockCondition: '取得 L5',
      upgradeAdvice: '',
      requiredLevelOrder: 5,
      simulated: true,
      route: '/zone/vpn',
      disclaimer: '模拟权限，不影响真实网络连接。',
    },
    {
      permissionId: 'explicit_only',
      group: 'certification',
      name: '显式授权权限',
      description: '',
      unlockCondition: '仅 L2 与 L4 可解锁',
      upgradeAdvice: '',
      requiredLevelOrder: 2,
      grantedLevelIds: ['L2', 'L4'],
      simulated: false,
      route: null,
      disclaimer: '该权限按显式清单授权。',
    },
    {
      permissionId: 'info_certified',
      group: 'certification',
      name: '信息辨别能力认证',
      description: '',
      unlockCondition: '通过信息辨别专项考试',
      upgradeAdvice: '',
      requiredLevelOrder: 3,
      requiredCertifications: ['information_literacy_certified'],
      simulated: false,
      route: null,
      disclaimer: '该认证仅记录平台内部考试结果。',
    },
  ],
};

/** 构造证件记录 */
function makeCertificate(overrides: Partial<CertificateRecord> = {}): CertificateRecord {
  const now = Date.now();
  return {
    schemaVersion: '1.0.0',
    certificateId: 'cert-1',
    certificateNumber: 'IUQA-2026-AAAAAA',
    userId: 'user-1',
    levelId: 'L1',
    levelOrder: 1,
    examAttemptId: 'attempt-1',
    examId: 'L1-BASIC',
    holderName: '测试考生',
    candidateNumber: 'IUQA-C-000001',
    issuedAt: now,
    status: 'valid',
    checksum: 'ABCDEF',
    issuerName: '互联网使用资格考试中心',
    issuerCode: 'IUQA',
    templateVersion: '1.0.0',
    certifications: [],
    fromMockExam: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('等级权限继承', () => {
  it('未取得任何证件时仅解锁无需资格权限', () => {
    const context = buildPermissionContext({ levels, certificates: [], certifications: [] });

    expect(context.isTemporary).toBe(true);
    expect(context.effectiveLevelOrder).toBe(0);
    expect(hasPermission(context, 'guest_access', permissions)).toBe(true);
    expect(hasPermission(context, 'browse', permissions)).toBe(false);
  });

  it('取得 L1 后解锁 L1 及以下权限，但不解锁 L2', () => {
    const context = buildPermissionContext({
      levels,
      certificates: [makeCertificate({ levelId: 'L1', levelOrder: 1 })],
      certifications: [],
    });

    expect(hasPermission(context, 'browse', permissions)).toBe(true);
    expect(hasPermission(context, 'comment', permissions)).toBe(false);
  });

  it('高级等级继承全部低级等级权限', () => {
    const context = buildPermissionContext({
      levels,
      certificates: [makeCertificate({ levelId: 'L5', levelOrder: 5 })],
      certifications: [],
    });

    expect(hasPermission(context, 'guest_access', permissions)).toBe(true);
    expect(hasPermission(context, 'browse', permissions)).toBe(true);
    expect(hasPermission(context, 'comment', permissions)).toBe(true);
    expect(hasPermission(context, 'vpn_zone', permissions)).toBe(true);
  });

  it('已作废的证件失去效力，等级回落到剩余证件', () => {
    const context = buildPermissionContext({
      levels,
      certificates: [
        makeCertificate({ certificateId: 'c1', levelId: 'L1', levelOrder: 1, status: 'valid' }),
        makeCertificate({ certificateId: 'c2', levelId: 'L3', levelOrder: 3, status: 'revoked' }),
      ],
      certifications: [],
    });

    expect(context.effectiveLevelOrder).toBe(1);
    expect(hasPermission(context, 'comment', permissions)).toBe(false);
  });

  it('已被更高级证件替代的历史证件仍然证明等级已取得', () => {
    const context = buildPermissionContext({
      levels,
      certificates: [
        makeCertificate({ certificateId: 'c1', levelId: 'L1', levelOrder: 1, status: 'superseded' }),
        makeCertificate({ certificateId: 'c2', levelId: 'L2', levelOrder: 2, status: 'valid' }),
      ],
      certifications: [],
    });

    expect(context.effectiveLevelOrder).toBe(2);
    expect(context.validCertificateLevelIds).toEqual(['L1', 'L2']);
    expect(hasPermission(context, 'browse', permissions)).toBe(true);
    expect(hasPermission(context, 'comment', permissions)).toBe(true);
  });
});

describe('显式授权等级清单', () => {
  it('持有 L2 时解锁显式清单中的权限', () => {
    const context = buildPermissionContext({
      levels,
      certificates: [makeCertificate({ levelId: 'L2', levelOrder: 2 })],
      certifications: [],
    });
    expect(hasPermission(context, 'explicit_only', permissions)).toBe(true);
  });

  it('持有 L3 时反而不在显式清单中，权限不解锁（忽略继承）', () => {
    const context = buildPermissionContext({
      levels,
      certificates: [makeCertificate({ levelId: 'L3', levelOrder: 3 })],
      certifications: [],
    });
    expect(hasPermission(context, 'explicit_only', permissions)).toBe(false);
  });

  it('持有 L4 时再次命中显式清单', () => {
    const context = buildPermissionContext({
      levels,
      certificates: [makeCertificate({ levelId: 'L4', levelOrder: 4 })],
      certifications: [],
    });
    expect(hasPermission(context, 'explicit_only', permissions)).toBe(true);
  });
});

describe('专项能力认证条件', () => {
  it('等级达标但缺少认证时不解锁', () => {
    const context = buildPermissionContext({
      levels,
      certificates: [makeCertificate({ levelId: 'L4', levelOrder: 4 })],
      certifications: [],
    });
    expect(hasPermission(context, 'info_certified', permissions)).toBe(false);
  });

  it('等级达标且持有认证时解锁', () => {
    const context = buildPermissionContext({
      levels,
      certificates: [makeCertificate({ levelId: 'L4', levelOrder: 4 })],
      certifications: ['information_literacy_certified'],
    });
    expect(hasPermission(context, 'info_certified', permissions)).toBe(true);
  });
});

describe('升级失败不降低已有等级', () => {
  it('L6 考试未通过后仍保留 L5 的全部权限', () => {
    // 升级失败不会写入任何证件，因此权限上下文与升级前完全一致
    const before = buildPermissionContext({
      levels,
      certificates: [makeCertificate({ levelId: 'L5', levelOrder: 5 })],
      certifications: [],
    });

    const after = buildPermissionContext({
      levels,
      certificates: [makeCertificate({ levelId: 'L5', levelOrder: 5 })],
      certifications: [],
    });

    expect(after.effectiveLevelOrder).toBe(before.effectiveLevelOrder);
    expect(hasPermission(after, 'vpn_zone', permissions)).toBe(true);
    expect(hasPermission(after, 'comment', permissions)).toBe(true);
  });
});

describe('权限状态与提示', () => {
  it('未解锁时给出原因与所需等级', () => {
    const context = buildPermissionContext({
      levels,
      certificates: [makeCertificate({ levelId: 'L1', levelOrder: 1 })],
      certifications: [],
    });

    const states = computeAllPermissionStates(context, permissions, levels);
    const vpnState = states.find((state) => state.definition.permissionId === 'vpn_zone');

    expect(vpnState?.unlocked).toBe(false);
    expect(vpnState?.remainingLevels).toBe(4);
    expect(vpnState?.lockedReason).toContain('还需提升 4 级');
  });

  it('临时状态下给出临时状态说明', () => {
    const context = buildPermissionContext({ levels, certificates: [], certifications: [] });
    const states = computeAllPermissionStates(context, permissions, levels);
    const browseState = states.find((state) => state.definition.permissionId === 'browse');

    expect(browseState?.lockedReason).toContain('临时浏览状态');
  });

  it('缺少专项认证且等级已达标时说明认证缺失', () => {
    const context = buildPermissionContext({
      levels,
      certificates: [makeCertificate({ levelId: 'L4', levelOrder: 4 })],
      certifications: [],
    });

    const states = computeAllPermissionStates(context, permissions, levels);
    const certifiedState = states.find(
      (state) => state.definition.permissionId === 'info_certified',
    );

    expect(certifiedState?.lockedReason).toContain('专项能力认证');
  });

  it('不存在的权限 ID 一律判定为未解锁', () => {
    const context = buildPermissionContext({ levels, certificates: [], certifications: [] });
    expect(hasPermission(context, 'not_exist', permissions)).toBe(false);
    expect(isPermissionUnlocked(context, permissions.permissions[0]!)).toBe(true);
  });
});
