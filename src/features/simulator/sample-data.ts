/**
 * 模拟专区示例数据
 *
 * I. 数据性质
 *
 * 1. 以下全部内容由本平台编写，机构名称、账号名称与事件均为虚构，不对应任何真实主体或事件
 * 2. 数据用于演示来源核验、证据链编排与信息辨别流程，不来自真实互联网
 *
 * II. 为什么放在代码中
 *
 * 1. 这是模拟专区的演示素材，不属于题库、考试参数、等级、权限或证件文案
 * 2. 若需要替换为其他教学素材，直接修改本文件即可，不影响任何业务逻辑
 *
 * @module features/simulator/sample-data
 * @author zexuan.peng
 * @created 2026-10-14
 */

/** 来源类型 */
export type SampleSourceType = 'primary' | 'secondary' | 'unverifiable';

export const SAMPLE_SOURCE_LABELS: Record<SampleSourceType, string> = {
  primary: '一手来源',
  secondary: '二手转述',
  unverifiable: '无法追溯',
};

/** 证据强度 */
export type SampleEvidenceLevel = 'documented' | 'partial' | 'none';

export const SAMPLE_EVIDENCE_LABELS: Record<SampleEvidenceLevel, string> = {
  documented: '有完整记录',
  partial: '仅有片段',
  none: '无支撑材料',
};

/** 一条模拟信息条目 */
export interface SimulatorSample {
  sampleId: string;
  title: string;
  publisher: string;
  publishedAt: string;
  sourceType: SampleSourceType;
  evidenceLevel: SampleEvidenceLevel;
  /** 核心断言 */
  claim: string;
  /** 正文摘要 */
  body: string;
  /** 可核查的具体要素 */
  checkablePoints: string[];
  /** 与其他条目的一致性说明 */
  consistency: string;
}

/** 模拟信息流样例 */
export const SIMULATOR_SAMPLES: SimulatorSample[] = [
  {
    sampleId: 'SMP-001',
    title: '某市公共交通票价调整方案公开征求意见',
    publisher: '甲市交通运输管理机构公告栏',
    publishedAt: '2026-03-11',
    sourceType: 'primary',
    evidenceLevel: 'documented',
    claim: '甲市拟自 2026 年 7 月起调整公共交通票价，现公开征求意见。',
    body: '公告列出了调整方案的三档票价、适用范围、优惠人群与意见反馈渠道，并附有调整依据的说明文件编号。公告同时给出了意见征集的起止日期与受理方式。',
    checkablePoints: [
      '公告发布主体是否为该机构本身',
      '是否给出文件编号与生效日期',
      '是否提供意见反馈的具体渠道',
    ],
    consistency: '与后续乙机构转载内容一致，但转载版本删去了文件编号。',
  },
  {
    sampleId: 'SMP-002',
    title: '（转载）甲市下月公交涨价，市民反应强烈',
    publisher: '某自媒体账号',
    publishedAt: '2026-03-12',
    sourceType: 'secondary',
    evidenceLevel: 'partial',
    claim: '甲市下月公交将涨价，市民反应强烈。',
    body: '文章引用了原始公告的部分内容，但将「拟调整、公开征求意见」表述为「确定下月涨价」，并称「市民反应强烈」，未说明该结论的调查范围与样本量。',
    checkablePoints: [
      '是否标注原始来源与链接',
      '「确定」与「拟」的差别是否被保留',
      '「反应强烈」是否有可核查的调查依据',
    ],
    consistency: '与一手公告在时间与确定性上存在差异：把征求意见阶段描述为已确定事项。',
  },
  {
    sampleId: 'SMP-003',
    title: '（群聊截图）据说票价要翻倍',
    publisher: '未知群聊转发',
    publishedAt: '2026-03-12',
    sourceType: 'unverifiable',
    evidenceLevel: 'none',
    claim: '票价要翻倍。',
    body: '一张聊天截图，未显示对话参与者身份，也未提供任何文件、公告或数据来源。截图本身无法验证是否经过编辑。',
    checkablePoints: ['截图是否可追溯到原始发布者', '是否存在对应的公开文件'],
    consistency: '与一手公告的调整幅度不一致，且无任何支撑材料。',
  },
  {
    sampleId: 'SMP-004',
    title: '甲市统计年鉴（节选）：公共交通运营数据',
    publisher: '甲市统计机构年度出版物',
    publishedAt: '2025-12-20',
    sourceType: 'primary',
    evidenceLevel: 'documented',
    claim: '上一年度甲市公共交通客运量为某数值，运营补贴为某数值。',
    body: '年鉴给出客运量、运营里程、补贴金额与统计口径说明，并注明了数据采集方式与修订记录。',
    checkablePoints: ['统计口径与统计年度', '是否说明修订情况', '分母与单位是否明确'],
    consistency: '与新闻报道中引用的数字一致，但新闻未说明口径，导致增长率计算出现差异。',
  },
  {
    sampleId: 'SMP-005',
    title: '某研究机构报告：通勤时间与出行方式的相关性',
    publisher: '某研究机构公开报告',
    publishedAt: '2026-01-08',
    sourceType: 'primary',
    evidenceLevel: 'documented',
    claim: '通勤时间与出行方式之间存在相关性。',
    body: '报告给出了样本量、抽样方式、置信区间与局限性说明，并明确指出相关性不等同于因果关系。',
    checkablePoints: ['样本量与抽样方式', '是否说明局限性', '结论是否超出数据支持范围'],
    consistency: '与二手报道的结论方向一致，但二手报道删去了局限性说明并给出了因果表述。',
  },
  {
    sampleId: 'SMP-006',
    title: '（短视频）三分钟看懂票价调整',
    publisher: '某短视频账号',
    publishedAt: '2026-03-13',
    sourceType: 'secondary',
    evidenceLevel: 'partial',
    claim: '票价调整会让所有人多花钱。',
    body: '视频使用了原始公告的截图作为背景，但未展示优惠人群条款，并以「所有人」概括受影响的群体。',
    checkablePoints: ['是否完整呈现原始条款', '「所有人」是否成立', '是否给出优惠与豁免范围'],
    consistency: '与一手公告存在选择性呈现：忽略了学生、老年人与特定群体的优惠条款。',
  },
];

/** 证据链编排训练：一组待排序的证据片段 */
export interface EvidenceFragment {
  fragmentId: string;
  label: string;
  /** 正确的时间顺序序号（从 1 开始） */
  correctOrder: number;
  description: string;
}

/** 证据链训练题 */
export interface EvidenceChainExercise {
  exerciseId: string;
  title: string;
  scenario: string;
  fragments: EvidenceFragment[];
  /** 完成后的结论说明 */
  conclusion: string;
}

/** 证据链训练题库 */
export const EVIDENCE_CHAIN_EXERCISES: EvidenceChainExercise[] = [
  {
    exerciseId: 'EC-001',
    title: '训练一：还原一次票价调整信息的传播过程',
    scenario:
      '请把下列片段按时间先后排列，观察信息在传播过程中如何被逐步改写。排列正确后可以看到每一步的语义变化。',
    fragments: [
      {
        fragmentId: 'F1',
        label: '统计年鉴发布运营数据',
        correctOrder: 1,
        description: '统计机构发布上一年度运营数据，含口径说明与修订记录。',
      },
      {
        fragmentId: 'F2',
        label: '管理机构发布征求意见公告',
        correctOrder: 2,
        description: '公告使用「拟调整」表述，并给出文件编号与反馈渠道。',
      },
      {
        fragmentId: 'F3',
        label: '自媒体转载并改写标题',
        correctOrder: 3,
        description: '「拟调整」被改写为「下月涨价」，文件编号被删除。',
      },
      {
        fragmentId: 'F4',
        label: '群聊截图出现「翻倍」说法',
        correctOrder: 4,
        description: '出现无法追溯的截图，表述进一步偏离原始公告。',
      },
      {
        fragmentId: 'F5',
        label: '短视频以「所有人」概括影响',
        correctOrder: 5,
        description: '优惠条款被忽略，受影响范围被扩大表述。',
      },
    ],
    conclusion:
      '传播链上的每一环都做了一次「简化」：删掉限定词、删掉来源编号、忽略例外条款。单独看每一步都像是为了方便理解，累积起来就变成了与事实不同的另一件事。',
  },
  {
    exerciseId: 'EC-002',
    title: '训练二：为一项结论补齐证据链缺口',
    scenario:
      '某结论声称「通勤时间越长的人越倾向选择公共交通」。请按证据链的正确顺序排列下列片段，并注意其中缺失的环节。',
    fragments: [
      {
        fragmentId: 'G1',
        label: '明确研究问题与变量定义',
        correctOrder: 1,
        description: '先定义「通勤时间」与「出行方式」的测量方式，避免口径漂移。',
      },
      {
        fragmentId: 'G2',
        label: '抽样并采集数据',
        correctOrder: 2,
        description: '说明样本量、抽样方式与采集时间。',
      },
      {
        fragmentId: 'G3',
        label: '统计分析与局限性说明',
        correctOrder: 3,
        description: '给出相关系数与置信区间，并说明未控制混杂因素。',
      },
      {
        fragmentId: 'G4',
        label: '结论表述限定在相关关系内',
        correctOrder: 4,
        description: '结论只陈述相关性，不推断因果。',
      },
      {
        fragmentId: 'G5',
        label: '二手报道改写为因果结论',
        correctOrder: 5,
        description: '报道删去局限性说明，把相关性改写为「导致」。',
      },
    ],
    conclusion:
      '证据链的缺口往往出现在最后一步：原始研究明确写了局限性，转述时被删掉，读者看到的就只剩一个过强的因果结论。',
  },
];

/** 来源对比面板：可对比的断言维度 */
export interface ComparisonRow {
  dimension: string;
  description: string;
}

/** 对比维度说明 */
export const COMPARISON_DIMENSIONS: ComparisonRow[] = [
  { dimension: '来源类型', description: '一手来源、二手转述或无法追溯' },
  { dimension: '发布时间', description: '是否为最早的可查版本，是否存在时间线矛盾' },
  { dimension: '关键限定词', description: '「拟」「可能」「已确认」等限定词是否被保留' },
  { dimension: '证据支撑', description: '是否提供文件编号、数据、样本量与口径说明' },
  { dimension: '例外条款', description: '优惠、豁免、适用范围等例外是否被完整呈现' },
];
