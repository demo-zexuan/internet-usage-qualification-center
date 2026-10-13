/**
 * 证件服务单元测试
 *
 * 覆盖：
 * 1. 证件编号格式与唯一性
 * 2. 校验码确定性
 * 3. 校验图形的确定性与结构（定位角、定时图案、矩阵规模）
 * 4. 证件记录校验（损坏数据识别）
 * 5. 当前证件选择逻辑
 *
 * @author zexuan.peng
 * @created 2026-10-14
 */

import { describe, expect, it } from 'vitest';

import {
  buildVerificationGraphic,
  computeCertificateChecksum,
  generateCertificateNumber,
  resolveActiveCertificate,
} from '@/features/certificates/service';
import { validateCertificateRecord, validateCertificateTemplate } from '@/schemas';
import certificateTemplateJson from '@/data/certificate-template.json';
import type { CertificateRecord } from '@/types/certificate';
import type { CertificateTemplate } from '@/types/certificate';

const template = (validateCertificateTemplate(certificateTemplateJson as unknown) as {
  ok: true;
  value: CertificateTemplate;
}).value;

/** 构造证件记录 */
function makeCertificate(overrides: Partial<CertificateRecord> = {}): CertificateRecord {
  const now = Date.now();
  return {
    schemaVersion: '1.0.0',
    certificateId: 'cert-1',
    certificateNumber: 'IUQA-2026-ABCDEF',
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

describe('证件编号生成', () => {
  it('编号符合 IUQA-年份-序号 格式', () => {
    const number = generateCertificateNumber(template, new Date('2026-05-20T10:00:00Z').getTime());

    expect(number).toMatch(/^IUQA-2026-[A-Z0-9]{6}$/);
  });

  it('编号年份取自授予日期', () => {
    const number = generateCertificateNumber(template, new Date('2031-01-02T00:00:00Z').getTime());
    expect(number.startsWith('IUQA-2031-')).toBe(true);
  });

  it('编号已存在时会重新生成', () => {
    const taken = new Set<string>();
    const numbers = Array.from({ length: 20 }, () => {
      const number = generateCertificateNumber(template, Date.now(), (candidate) =>
        taken.has(candidate),
      );
      taken.add(number);
      return number;
    });

    expect(new Set(numbers).size).toBe(numbers.length);
  });

  it('模板声明的前缀与随机段长度被遵守', () => {
    const customTemplate: CertificateTemplate = {
      ...template,
      numberPrefix: 'TEST',
      numberRandomLength: 4,
    };

    const number = generateCertificateNumber(customTemplate, Date.now());
    expect(number).toMatch(/^TEST-\d{4}-[A-Z0-9]{4}$/);
  });
});

describe('证件校验码', () => {
  it('同一编号与等级生成的校验码完全一致', () => {
    const first = computeCertificateChecksum('IUQA-2026-ABCDEF', 'L1');
    const second = computeCertificateChecksum('IUQA-2026-ABCDEF', 'L1');
    expect(first).toBe(second);
    expect(first).toHaveLength(6);
  });

  it('编号不同则校验码不同', () => {
    expect(computeCertificateChecksum('IUQA-2026-ABCDEF', 'L1')).not.toBe(
      computeCertificateChecksum('IUQA-2026-GHIJKL', 'L1'),
    );
  });

  it('等级不同则校验码不同', () => {
    expect(computeCertificateChecksum('IUQA-2026-ABCDEF', 'L1')).not.toBe(
      computeCertificateChecksum('IUQA-2026-ABCDEF', 'L2'),
    );
  });

  it('校验码只使用不易混淆的字符集', () => {
    const checksum = computeCertificateChecksum('IUQA-2026-ABCDEF', 'L6');
    expect(checksum).toMatch(/^[A-HJ-NP-Z2-9]+$/);
  });
});

describe('证件校验图形', () => {
  it('同一编号生成的图形完全一致（确定性）', () => {
    const first = buildVerificationGraphic('IUQA-2026-ABCDEF', 'ABCDEF');
    const second = buildVerificationGraphic('IUQA-2026-ABCDEF', 'ABCDEF');

    expect([...first.cells].sort()).toEqual([...second.cells].sort());
    expect(first.size).toBe(21);
  });

  it('不同编号生成的图形不同', () => {
    const first = buildVerificationGraphic('IUQA-2026-ABCDEF', 'ABCDEF');
    const second = buildVerificationGraphic('IUQA-2026-ABCDEF', 'GHIJKL');

    expect([...first.cells].sort()).not.toEqual([...second.cells].sort());
  });

  it('包含三个 7×7 定位图案的角点', () => {
    const graphic = buildVerificationGraphic('IUQA-2026-ABCDEF', 'ABCDEF');

    // 左上、右上、左下三个定位角的边框与核心单元格必须被填充
    expect(graphic.cells.has('0-0')).toBe(true);
    expect(graphic.cells.has('0-20')).toBe(true);
    expect(graphic.cells.has('20-0')).toBe(true);
    expect(graphic.cells.has('3-3')).toBe(true);
    expect(graphic.cells.has('3-17')).toBe(true);
    expect(graphic.cells.has('17-3')).toBe(true);
  });

  it('定位图案的中间环为空（与常见二维码观感一致）', () => {
    const graphic = buildVerificationGraphic('IUQA-2026-ABCDEF', 'ABCDEF');
    expect(graphic.cells.has('1-1')).toBe(false);
    expect(graphic.cells.has('5-5')).toBe(false);
  });

  it('校验码随图形一并返回，便于界面展示', () => {
    const graphic = buildVerificationGraphic('IUQA-2026-ABCDEF', 'ZZZZZZ');
    expect(graphic.checksum).toBe('ZZZZZZ');
  });
});

describe('证件记录校验', () => {
  it('合法记录通过校验', () => {
    const result = validateCertificateRecord(makeCertificate());
    expect(result.ok).toBe(true);
  });

  it('编号格式非法时定位到字段', () => {
    const result = validateCertificateRecord(makeCertificate({ certificateNumber: 'BAD-NUMBER' }));
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.issues.some((issue) => issue.path === 'certificateNumber')).toBe(true);
  });

  it('证件状态非法时拒绝', () => {
    const result = validateCertificateRecord(
      makeCertificate({ status: 'unknown' as CertificateRecord['status'] }),
    );
    expect(result.ok).toBe(false);
  });

  it('缺少签发依据时拒绝（证件必须关联考试记录）', () => {
    const result = validateCertificateRecord(makeCertificate({ examAttemptId: '' }));
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.issues.some((issue) => issue.path === 'examAttemptId')).toBe(true);
  });
});

describe('当前证件选择', () => {
  it('优先返回用户指定的证件', () => {
    const certificates = [
      makeCertificate({ certificateId: 'c1', levelId: 'L1', levelOrder: 1, status: 'superseded' }),
      makeCertificate({ certificateId: 'c2', levelId: 'L2', levelOrder: 2, status: 'valid' }),
    ];

    expect(resolveActiveCertificate(certificates, 'c1')?.certificateId).toBe('c1');
  });

  it('未指定时返回等级最高的有效证件', () => {
    const certificates = [
      makeCertificate({ certificateId: 'c1', levelId: 'L1', levelOrder: 1, status: 'superseded' }),
      makeCertificate({ certificateId: 'c2', levelId: 'L3', levelOrder: 3, status: 'valid' }),
      makeCertificate({ certificateId: 'c3', levelId: 'L2', levelOrder: 2, status: 'valid' }),
    ];

    expect(resolveActiveCertificate(certificates, null)?.certificateId).toBe('c2');
  });

  it('没有任何有效证件时回退到第一条记录', () => {
    const certificates = [
      makeCertificate({ certificateId: 'c1', status: 'revoked' }),
    ];

    expect(resolveActiveCertificate(certificates, null)?.certificateId).toBe('c1');
  });

  it('证件列表为空时返回 null', () => {
    expect(resolveActiveCertificate([], null)).toBeNull();
  });

  it('指定的证件不存在时回退到最高有效等级证件', () => {
    const certificates = [
      makeCertificate({ certificateId: 'c1', levelId: 'L2', levelOrder: 2, status: 'valid' }),
    ];

    expect(resolveActiveCertificate(certificates, 'not-exist')?.certificateId).toBe('c1');
  });
});
