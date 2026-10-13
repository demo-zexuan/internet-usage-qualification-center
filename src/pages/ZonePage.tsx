/**
 * 跨域信息访问与 VPN 知识专区
 *
 * I. 定位
 *
 * 1. 本专区只提供**模拟界面演示与知识说明**，不提供任何访问手段
 * 2. 专区内的全部来源样例、机构名称与网页版式均为本平台编写或虚构
 * 3. 本专区不代理、不镜像、不转发任何真实境外网站的内容，也不改变使用者对任何真实网站的访问能力
 *
 * II. 两个分区
 *
 * 1. 模拟境外信息访问专区：多语言来源样例与替代核验路径演示
 * 2. VPN 知识专区：加密隧道原理示意、风险清单与自查问题
 *
 * III. 明确禁止的内容
 *
 * 1. 不提供任何 VPN 客户端、服务器地址、配置参数、订阅链接或连接步骤
 * 2. 不提供任何绕过访问限制的方法
 *
 * @module pages/ZonePage
 * @author zexuan.peng
 * @created 2026-10-14
 */

import { Globe2, Lock, ShieldAlert, ShieldCheck } from 'lucide-react';
import * as React from 'react';
import { Link } from 'react-router-dom';

import { useConfig } from '@/app/config-context';
import { PermissionDeniedState } from '@/components/common/states';
import { PageHeader, Section } from '@/components/common/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert } from '@/components/ui/feedback';
import { Table, TableCell, TableHead, TableWrapper } from '@/components/ui/feedback';
import { usePermission } from '@/hooks/use-user-data';
import { cn } from '@/utils/cn';

/** 专区类型 */
export type ZoneKind = 'overseas' | 'vpn';

/** 模拟境外来源样例（全部为虚构内容） */
const OVERSEAS_SAMPLES = [
  {
    sampleId: 'OVS-001',
    originLabel: '虚构来源 A · 多语言公开说明',
    language: '英文',
    contentSummary:
      '一份虚构的多语言公开说明片段，用于演示「先确认发布主体与发布时间，再判断内容」的核验顺序。',
    verificationPath: '核对发布主体是否为原始机构，检查是否存在同议题的可访问独立来源。',
  },
  {
    sampleId: 'OVS-002',
    originLabel: '虚构来源 B · 行业统计摘要',
    language: '日文',
    contentSummary:
      '一份虚构的行业统计摘要片段，用于演示统计口径差异如何导致结论方向相反。',
    verificationPath: '检查统计年度、分母定义与样本范围，并与可访问来源交叉比对。',
  },
  {
    sampleId: 'OVS-003',
    originLabel: '虚构来源 C · 二手转述合集',
    language: '中文',
    contentSummary:
      '一份虚构的转述合集片段，用于演示「转述层级必须显式标注」的原则。',
    verificationPath: '标注转述层级，追溯最早可查版本，记录无法核实的环节。',
  },
];

/** 替代核验路径 */
const ALTERNATIVE_PATHS = [
  {
    title: '查阅公开转载并标注转述层级',
    description:
      '若原始来源无法直接访问，可查阅其公开转载与摘要，但必须显式标注这是二手转述，并说明转述环节可能引入的信息损耗。',
  },
  {
    title: '寻找同议题下可访问的独立来源',
    description:
      '独立来源指彼此不共享同一上游信源、也不互相引用。找到独立来源后，应比较结论方向与关键数字是否一致。',
  },
  {
    title: '检索学术数据库中的引用记录',
    description:
      '若该来源被学术文献引用，可通过引用记录了解其数据来源、方法与已知争议，这通常比转述更接近原始信息。',
  },
  {
    title: '查证原始数据是否另有公开版本',
    description:
      '许多结论所依赖的原始数据可能另有公开版本（例如统计年报）。直接核对原始数据往往可以绕开表述差异。',
  },
  {
    title: '把「无法访问」写进证据链',
    description:
      '当以上路径都无法完成时，应在证据链中明确标注该环节缺少证据，而不是用推测填补空缺。这是本中心最看重的一条。',
  },
];

/** 风险清单 */
const VPN_RISKS = [
  {
    risk: '服务方转售流量或注入内容',
    description:
      '免费或低价服务可能通过分析、转售流量或注入广告获利。加密解决的是传输过程，不解决服务方是否可信。',
  },
  {
    risk: '把「能连通」误认为「可安全使用」',
    description:
      '连通性只说明链路可用，不说明出口节点的可信度、日志策略与所在司法辖区。连通之后放松对来源的判断，是更常见的风险。',
  },
  {
    risk: '出口所在司法辖区的差异',
    description:
      '同一项技术在不同司法辖区的规定可能不同。这部分判断无法由平台代为作出，使用者需要自行确认适用规则。',
  },
  {
    risk: '认为使用隧道即等于匿名',
    description:
      '隧道出口必然解密流量，运营方在出口处可以看到明文。匿名性与加密是两个不同的问题。',
  },
  {
    risk: '长期依赖单一出口',
    description:
      '单一出口意味着单一信任点。一旦该出口不可用或不可信，全部依赖它的工作都会同时失效。',
  },
];

/** 专区页面属性 */
export interface ZonePageProps {
  kind: ZoneKind;
}

/** 跨域信息访问与 VPN 知识专区 */
export function ZonePage({ kind }: ZonePageProps): React.ReactElement {
  const { studyMaterials } = useConfig();

  const overseasPermission = usePermission('cross_domain_resource');
  const vpnPermission = usePermission('vpn_knowledge_zone');

  const isOverseas = kind === 'overseas';
  const permission = isOverseas ? overseasPermission : vpnPermission;
  const materialId = isOverseas ? 'cross-domain-compliance' : 'vpn-basics';
  const material = studyMaterials.materials.find((item) => item.materialId === materialId) ?? null;

  const title = isOverseas ? '模拟境外信息访问专区' : 'VPN 知识专区';
  const description = isOverseas
    ? '本专区用于演示跨境信息核验流程：在无法直接访问某来源时，如何通过替代路径完成核验并把缺口写进证据链。'
    : '本专区用于讲解加密隧道的基本原理、常见误解与风险类型。本专区不提供任何客户端、配置或连接能力。';

  if (!permission.unlocked) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          eyebrow="模拟功能"
          title={title}
          description="本专区需要取得 L5 跨域信息访问资格后开放。"
        />
        <PermissionDeniedState
          title={`「${permission.state?.definition.name ?? title}」尚未解锁`}
          reason={permission.state?.lockedReason}
          requirement={permission.state?.definition.unlockCondition}
          advice={permission.state?.definition.upgradeAdvice}
          action={
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline">
                <Link to="/permissions">查看权限清单</Link>
              </Button>
              <Button asChild size="sm" variant="ghost">
                <Link to="/materials">查看学习材料</Link>
              </Button>
            </div>
          }
        />
        <Alert tone="info" title="可以先阅读学习材料">
          本专区的相关学习材料对已取得 L4 资格的考生开放阅读。完成材料有助于通过跨域信息访问资格特别考试。
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="模拟功能"
        title={title}
        description={description}
        actions={
          <Badge variant="outline">
            {isOverseas ? (
              <Globe2 className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            模拟环境
          </Badge>
        }
      />

      {/* I. 边界声明 */}
      <Alert tone="danger" title="重要边界声明">
        <ul className="mt-1 list-disc space-y-1 pl-4">
          <li>
            本专区<strong className="font-semibold text-ink">不提供</strong>任何 VPN 客户端、服务器地址、
            配置参数、订阅链接、连接步骤，也不提供任何绕过访问限制的方法。
          </li>
          <li>
            本专区<strong className="font-semibold text-ink">不代理、不镜像、不转发</strong>
            任何真实境外网站的内容，专区内的全部来源样例、机构名称与网页版式均为本平台编写或虚构。
          </li>
          <li>本专区不改变使用者设备对任何真实网站的访问能力，也不修改任何系统或浏览器设置。</li>
          <li>本平台无法、也不会为使用者建立任何真实的加密隧道。</li>
        </ul>
      </Alert>

      {/* II. 分区内容 */}
      {isOverseas ? (
        <>
          <Section
            title="模拟来源样例"
            description="以下样例用于演示核验顺序，全部内容为虚构，不对应任何真实网站或机构。"
          >
            <TableWrapper>
              <Table>
                <caption className="sr-only">模拟境外来源样例</caption>
                <thead>
                  <tr>
                    <TableHead>编号</TableHead>
                    <TableHead>来源标识</TableHead>
                    <TableHead>语言</TableHead>
                    <TableHead>内容摘要</TableHead>
                    <TableHead>核验路径</TableHead>
                  </tr>
                </thead>
                <tbody>
                  {OVERSEAS_SAMPLES.map((sample) => (
                    <tr key={sample.sampleId}>
                      <TableCell className="doc-code whitespace-nowrap text-[11px]">
                        {sample.sampleId}
                      </TableCell>
                      <TableCell className="min-w-[10rem] text-[12px] text-ink">
                        {sample.originLabel}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-[12px] text-ink-soft">
                        {sample.language}
                      </TableCell>
                      <TableCell className="min-w-[14rem] text-[12px] leading-relaxed text-ink-soft">
                        {sample.contentSummary}
                      </TableCell>
                      <TableCell className="min-w-[14rem] text-[12px] leading-relaxed text-ink-soft">
                        {sample.verificationPath}
                      </TableCell>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrapper>
          </Section>

          <Section
            title="替代核验路径"
            description="当某个来源无法直接访问时，以下路径不涉及任何绕过访问限制的操作。"
          >
            <ol className="flex flex-col gap-3">
              {ALTERNATIVE_PATHS.map((path, index) => (
                <li key={path.title}>
                  <Card>
                    <CardContent className="flex items-start gap-3">
                      <span className="tabular mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-brand/40 bg-brand-soft text-[12px] font-semibold text-brand">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-ink">{path.title}</p>
                        <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">
                          {path.description}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ol>
          </Section>
        </>
      ) : (
        <>
          {/* 隧道原理示意 */}
          <Section
            title="加密隧道原理示意"
            description="以下为概念示意，用于说明加密解决与不解决的问题，不包含任何配置或连接信息。"
          >
            <Card>
              <CardContent className="flex flex-col gap-4">
                <svg
                  viewBox="0 0 640 160"
                  role="img"
                  aria-label="加密隧道概念示意图：本地设备与出口节点之间的加密段，以及出口之后的明文段"
                  className="h-auto w-full max-w-2xl"
                >
                  <rect x="0" y="60" width="120" height="40" rx="4" fill="none" stroke="#5A6675" strokeWidth="1.5" />
                  <text x="60" y="85" textAnchor="middle" fontSize="11" fill="#47525F">
                    本地设备
                  </text>

                  <rect
                    x="160"
                    y="60"
                    width="240"
                    height="40"
                    rx="4"
                    fill="none"
                    stroke="#17365D"
                    strokeWidth="2"
                    strokeDasharray="6 3"
                  />
                  <text x="280" y="78" textAnchor="middle" fontSize="11" fill="#17365D">
                    加密段（机密性与完整性）
                  </text>
                  <text x="280" y="92" textAnchor="middle" fontSize="10" fill="#6D7885">
                    中间节点无法读取内容
                  </text>

                  <rect x="440" y="60" width="120" height="40" rx="4" fill="none" stroke="#B4232D" strokeWidth="1.5" />
                  <text x="500" y="85" textAnchor="middle" fontSize="11" fill="#B4232D">
                    出口节点
                  </text>

                  <rect x="580" y="60" width="60" height="40" rx="4" fill="none" stroke="#5A6675" strokeWidth="1.5" />
                  <text x="610" y="85" textAnchor="middle" fontSize="10" fill="#47525F">
                    目的地
                  </text>

                  <line x1="120" y1="80" x2="160" y2="80" stroke="#5A6675" strokeWidth="1.5" />
                  <line x1="400" y1="80" x2="440" y2="80" stroke="#5A6675" strokeWidth="1.5" />
                  <line x1="560" y1="80" x2="580" y2="80" stroke="#B4232D" strokeWidth="2" />

                  <text x="500" y="120" textAnchor="middle" fontSize="10" fill="#B4232D">
                    出口之后流量被解密
                  </text>
                  <text x="280" y="140" textAnchor="middle" fontSize="10" fill="#6D7885">
                    加密不解决「出口节点是否可信」的问题
                  </text>
                </svg>

                <ul className="list-disc space-y-1.5 pl-5 text-[12px] leading-relaxed text-ink-soft">
                  <li>加密段保护的是传输过程的机密性与完整性，防止中间节点读取或篡改。</li>
                  <li>隧道两端仍然是具体的运营方，出口节点必然能看到解密后的流量。</li>
                  <li>因此「使用隧道」与「匿名」是两个不同的问题，不能互相替代。</li>
                </ul>
              </CardContent>
            </Card>
          </Section>

          {/* 风险清单 */}
          <Section title="常见风险类型" description="以下为风险识别要点，不构成任何使用建议。">
            <ul className="flex flex-col gap-3">
              {VPN_RISKS.map((item) => (
                <li key={item.risk}>
                  <Card>
                    <CardContent className="flex items-start gap-3">
                      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-ink">{item.risk}</p>
                        <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">
                          {item.description}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          </Section>
        </>
      )}

      {/* III. 关联学习材料 */}
      {material ? (
        <Section title="关联学习材料" description="完成学习材料是通过跨域信息访问资格特别考试的前置条件之一。">
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
                  <ShieldCheck className="h-4 w-4 text-brand" aria-hidden="true" />
                  {material.title}
                </p>
                <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">{material.summary}</p>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link to="/materials">前往学习材料</Link>
              </Button>
            </CardContent>
          </Card>
        </Section>
      ) : null}

      <p className={cn('text-[11px] leading-relaxed text-ink-faint')}>
        本专区全部内容随应用一同分发，不产生任何网络请求。若你需要了解相关技术标准的公开说明，
        可在学习材料页面查看本中心整理的外部参考资料链接。
      </p>
    </div>
  );
}
