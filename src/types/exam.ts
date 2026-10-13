/**
 * 考试制度、试卷快照与成绩类型定义
 *
 * I. 数据流
 *
 * 1. `ExamRule`（来自 exam-rules.json）描述一场考试的制度参数
 * 2. 抽题引擎据此生成 `ExamPaper` 试卷快照，快照内含归一化后的 `PaperQuestion`
 * 3. 答题过程产生 `ExamAttempt`，交卷后由评分引擎产出 `ExamResult`
 * 4. 试卷快照与规则快照一并落库，保证后续导入新题库不会影响历史答卷复核
 *
 * II. 时间与分数约定
 *
 * 1. 所有时间戳为 Unix 毫秒
 * 2. 所有分数计算在内部以「百分之一分」整数进行，避免浮点误差影响及格线判定
 *
 * @module types/exam
 * @author zexuan.peng
 * @created 2026-10-14
 */

import type { VersionedRecord } from './common';
import type {
  Difficulty,
  PartialCreditSpec,
  QuestionCategory,
  QuestionType,
  SelectionMode,
  QuestionOption,
} from './question';

/* ============================================================
   I. 考试类别
   ============================================================ */

export const EXAM_CATEGORIES = [
  'novice',
  'intermediate',
  'information_literacy',
  'cyber_security',
  'advanced',
  'special',
] as const;

export type ExamCategory = (typeof EXAM_CATEGORIES)[number];

export const EXAM_CATEGORY_LABELS: Record<ExamCategory, string> = {
  novice: '新手资格考试',
  intermediate: '进阶资格考试',
  information_literacy: '信息辨别专项考试',
  cyber_security: '网络安全专项考试',
  advanced: '高级互联网使用资格考试',
  special: '特别资格考试',
};

/* ============================================================
   II. 评分配置
   ============================================================ */

/** 舍入方式 */
export type RoundingMode = 'half_up' | 'floor' | 'ceil' | 'truncate';

export const ROUNDING_LABELS: Record<RoundingMode, string> = {
  half_up: '四舍五入',
  floor: '向下取整',
  ceil: '向上取整',
  truncate: '截断小数',
};

/** 全卷评分策略 */
export interface ScoringPolicy {
  /** 是否将原始得分归一化为百分制 */
  normalizeToHundred: boolean;
  /** 归一化后的舍入方式 */
  rounding: RoundingMode;
  /** 保留小数位（0 / 1 / 2） */
  decimalPlaces: number;
  /** 总分是否允许为负（默认不允许，最低为 0） */
  allowNegativeTotal: boolean;
  /** 全卷默认倒扣分：每题答错扣除的分值，0 表示不倒扣 */
  defaultNegativeScore: number;
  /** 是否允许题目声明的部分得分规则生效（需显式开启） */
  partialCreditEnabled: boolean;
}

/** 归一化到题目级之后的评分方式 */
export type ResolvedScoringMode = 'strict' | 'partial' | 'points';

/** 题目级最终生效的评分配置 */
export interface ResolvedQuestionScoring {
  mode: ResolvedScoringMode;
  partial?: PartialCreditSpec;
  /** 实际生效的倒扣分值（已结合考试规则开关） */
  negativeScore: number;
}

/* ============================================================
   III. 答案展示策略
   ============================================================ */

/**
 * 答案展示策略
 *
 * 1. `always`：交卷后始终展示正确答案与解析
 * 2. `after_pass`：仅在通过时展示正确答案与解析
 * 3. `never`：不展示正确答案，仅展示得分与作答状态
 */
export type AnswerVisibility = 'always' | 'after_pass' | 'never';

export const ANSWER_VISIBILITY_LABELS: Record<AnswerVisibility, string> = {
  always: '交卷后展示答案与解析',
  after_pass: '仅通过后展示答案与解析',
  never: '不展示答案与解析',
};

/* ============================================================
   IV. 试卷生成配置
   ============================================================ */

/** 分类配额抽题条目 */
export interface PaperQuota {
  /** 限定分类；null 表示不限分类 */
  category: QuestionCategory | null;
  /** 限定难度；null 表示不限难度 */
  difficulty: Difficulty | null;
  /** 该配额抽取的题目数量 */
  count: number;
}

/** 试卷生成方式 */
export type PaperGenerationMode = 'fixed' | 'random' | 'quota';

/**
 * 试卷生成配置
 *
 * 1. `fixed`：按 questionIds 固定取题，用于需要完全可复现的考试
 * 2. `random`：从 bankIds 随机抽题
 * 3. `quota`：按分类 / 难度配额抽题
 */
export interface PaperGenerationSpec {
  mode: PaperGenerationMode;
  /** 题目来源题库 ID 列表 */
  bankIds: string[];
  /** fixed 模式使用的题目 ID 列表 */
  questionIds?: string[];
  /** quota 模式使用的配额列表 */
  quotas?: PaperQuota[];
  /** 难度分布要求：键为难度，值为该难度抽取数量 */
  difficultyDistribution?: Partial<Record<'1' | '2' | '3' | '4' | '5', number>>;
  /** 必须包含的标签 */
  requiredTags?: string[];
  /** 必须排除的标签 */
  excludedTags?: string[];
  /** 是否随机化题目顺序 */
  shuffleQuestions: boolean;
  /** 是否随机化选项顺序（题目可用 shuffleOptions 单独覆盖） */
  shuffleOptions: boolean;
  /** 固定随机种子；为空时每次考试使用新的随机种子 */
  seed?: string | null;
}

/* ============================================================
   V. 报名条件
   ============================================================ */

/** 考试报名条件 */
export interface ExamEligibility {
  /** 是否要求已取得前置等级 */
  requirePrerequisite: boolean;
  /** 允许的前置等级 ID 列表（满足其一即可） */
  prerequisiteLevelIds: string[];
  /** 要求已通过的专项考试 ID 列表 */
  requiredSpecialtyExamIds?: string[];
  /** 前置等级考试的最低分数要求；null 表示不限制 */
  minPrerequisiteScore?: number | null;
  /** 要求的累计正式考试次数；null 表示不限制 */
  minAttemptCount?: number | null;
  /** 是否要求先完成学习材料 */
  requireStudyMaterial?: boolean;
  /** 需要完成的学习材料 ID 列表 */
  studyMaterialIds?: string[];
}

/** 报名资格判定结果 */
export interface EligibilityResult {
  eligible: boolean;
  /** 不满足时的具体原因，逐条面向用户说明 */
  reasons: string[];
  /** 已满足的条件说明，用于报名页正向反馈 */
  satisfied: string[];
}

/* ============================================================
   VI. 考试规则
   ============================================================ */

/** 单场考试的制度定义 */
export interface ExamRule {
  examId: string;
  title: string;
  /** 对应等级 ID */
  levelId: string;
  category: ExamCategory;
  /** 一句话定位，用于报名列表 */
  summary: string;
  /** 考试说明条目 */
  description: string;
  /** 考前须知条目 */
  instructions: string[];
  /** 考试时限（分钟） */
  durationMinutes: number;
  /** 题目数量 */
  questionCount: number;
  /** 满分（归一化前的题目分值合计目标） */
  totalScore: number;
  /** 及格线（百分制下为百分制分数） */
  passScore: number;
  /** 是否允许补考 */
  allowRetake: boolean;
  /** 补考间隔（分钟），0 表示可立即重考 */
  retakeCooldownMinutes: number;
  /** 允许的最大正式考试次数；null 表示不限 */
  maxAttempts: number | null;
  /** 是否开放模拟考试入口 */
  allowMock: boolean;
  /** 是否启用倒扣分 */
  negativeScoring: boolean;
  /** 答案展示策略 */
  showAnswers: AnswerVisibility;
  /** 报名条件 */
  eligibility: ExamEligibility;
  /** 试卷生成配置 */
  paper: PaperGenerationSpec;
  /** 通过后授予的等级 ID */
  grantsLevelId: string;
  /** 通过后额外授予的能力认证标识 */
  grantsCertifications?: string[];
  /** 是否为专项考试；非空时表示专项能力认证 */
  specialty?: string | null;
  /** 是否为模拟考试专用规则（模拟考试不计入正式记录） */
  mockOnly?: boolean;
}

/** 考试规则集合（exam-rules.json 的顶层结构） */
export interface ExamRulesConfig {
  schemaVersion: string;
  rulesId: string;
  version: string;
  title: string;
  description: string;
  updatedAt?: string;
  scoring: ScoringPolicy;
  exams: ExamRule[];
}

/** 落库的考试规则记录 */
export interface ExamRulesRecord extends ExamRulesConfig {
  source: import('./common').DataSource;
  importedAt: number;
  rawJson: string;
  /** 是否为当前启用配置 */
  isActive: boolean;
}

/* ============================================================
   VII. 试卷快照
   ============================================================ */

/**
 * 试卷中的选项
 *
 * 1. `id` 是试卷内的展示编号；选项顺序随机化后会按显示顺序重新编号为 A、B、C、D
 * 2. `sourceId` 保留题库中的原始选项 ID，便于成绩复核时回溯到题库
 */
export interface PaperOption extends QuestionOption {
  sourceId?: string;
}

/** 归一化后的试卷题目：评分引擎的唯一输入 */
export interface PaperQuestion {
  questionId: string;
  type: QuestionType;
  category: QuestionCategory;
  difficulty: Difficulty;
  tags: string[];
  stem: string;
  material?: string;
  materialTitle?: string;
  options: PaperOption[];
  selection: SelectionMode;
  /** 归一化后的正确选项 ID 集合；情景分析题为参考最优选项 */
  correctOptionIds: string[];
  /** 情景分析题各选项分值 */
  optionPoints?: Record<string, number>;
  /** 最终生效的评分配置 */
  scoring: ResolvedQuestionScoring;
  /** 该题满分 */
  score: number;
  explanation: string;
  knowledgePoints: string[];
  multipleValidViewpoints?: boolean;
  /** 题目来源题库标识，便于复核 */
  bankId: string;
  bankVersion: string;
  /** 选项原始顺序（随机化前），用于成绩页说明 */
  sourceOptionIds: string[];
}

/** 试卷引用的题库信息 */
export interface PaperBankRef {
  bankId: string;
  version: string;
  source: import('./common').DataSource;
  title: string;
}

/** 试卷快照 */
export interface ExamPaper {
  paperId: string;
  examId: string;
  examTitle: string;
  levelId: string;
  mode: ExamMode;
  generatedAt: number;
  /** 本次抽题使用的随机种子，便于复现 */
  seed: string;
  questionCount: number;
  /** 题目分值合计（归一化前的原始满分） */
  rawMaxScore: number;
  /** 及格线（与评分策略同一口径） */
  passScore: number;
  durationMinutes: number;
  questions: PaperQuestion[];
  bankRefs: PaperBankRef[];
  /** 规则快照，保证历史成绩可复核 */
  ruleSnapshot: ExamRuleSnapshot;
}

/** 考试模式 */
export type ExamMode = 'mock' | 'official';

export const EXAM_MODE_LABELS: Record<ExamMode, string> = {
  mock: '模拟考试',
  official: '正式考试',
};

/** 考试规则快照：冻结在试卷中的制度参数 */
export interface ExamRuleSnapshot {
  rulesId: string;
  rulesVersion: string;
  schemaVersion: string;
  examId: string;
  examTitle: string;
  levelId: string;
  category: ExamCategory;
  durationMinutes: number;
  questionCount: number;
  totalScore: number;
  passScore: number;
  showAnswers: AnswerVisibility;
  negativeScoring: boolean;
  scoring: ScoringPolicy;
  grantsLevelId: string;
  grantsCertifications: string[];
}

/* ============================================================
   VIII. 考试过程与成绩
   ============================================================ */

/** 考试状态 */
export type AttemptStatus = 'in_progress' | 'submitted' | 'abandoned';

/** 交卷原因，决定成绩页的说明文案 */
export type SubmitReason = 'user' | 'timeout' | 'recovery' | 'manual_reset';

export const SUBMIT_REASON_LABELS: Record<SubmitReason, string> = {
  user: '考生主动交卷',
  timeout: '考试时限届满，系统自动交卷',
  recovery: '恢复考试时已超时，系统自动交卷',
  manual_reset: '档案重置时统一结算',
};

/** 单题作答结果 */
export interface QuestionResult {
  questionId: string;
  type: QuestionType;
  stem: string;
  selection: SelectionMode;
  /** 考生所选选项 ID（未作答为空数组） */
  selectedOptionIds: string[];
  /** 正确答案选项 ID */
  correctOptionIds: string[];
  /** 作答状态，未作答与答错分别统计 */
  status: 'correct' | 'wrong' | 'unanswered' | 'partial';
  /** 该题得分（百分之一分整数口径下的展示值，保留两位小数） */
  earnedScore: number;
  maxScore: number;
  /** 是否被考生标记为疑问 */
  flagged: boolean;
  explanation: string;
  knowledgePoints: string[];
  category: QuestionCategory;
  difficulty: Difficulty;
  /** 选项级解析（情景分析题使用） */
  optionPoints?: Record<string, number>;
  multipleValidViewpoints?: boolean;
}

/** 评分结果 */
export interface ExamResult {
  attemptId: string;
  examId: string;
  examTitle: string;
  levelId: string;
  mode: ExamMode;
  /** 原始得分（题目分值口径） */
  rawEarnedScore: number;
  /** 原始满分 */
  rawMaxScore: number;
  /** 最终得分（归一化后为百分制） */
  score: number;
  /** 最终满分 */
  maxScore: number;
  /** 及格线（与 score 同口径） */
  passScore: number;
  passed: boolean;
  totalQuestions: number;
  correctCount: number;
  partialCount: number;
  wrongCount: number;
  unansweredCount: number;
  /** 是否已归一化为百分制 */
  normalized: boolean;
  rounding: RoundingMode;
  decimalPlaces: number;
  questionResults: QuestionResult[];
  /** 通过时授予的等级 ID */
  levelAwarded: string | null;
  /** 通过时授予的专项认证 */
  certificationsAwarded: string[];
  /** 是否展示正确答案与解析（由规则快照与通过状态共同决定） */
  answersVisible: boolean;
  gradedAt: number;
  /** 评分使用的规则版本，便于问题追溯 */
  scoringRuleVersion: string;
}

/** 考试记录 */
export interface ExamAttempt extends VersionedRecord {
  attemptId: string;
  userId: string;
  examId: string;
  examTitle: string;
  levelId: string;
  mode: ExamMode;
  status: AttemptStatus;
  /** 试卷快照 */
  paper: ExamPaper;
  /** 作答：题目 ID → 已选选项 ID 列表 */
  answers: Record<string, string[]>;
  /** 标记为疑问的题目 ID */
  flaggedQuestionIds: string[];
  /** 当前题目序号（从 0 开始），用于刷新恢复 */
  currentIndex: number;
  startedAt: number;
  /** 到期时间戳，等于 startedAt + 时限；倒计时归零即自动交卷 */
  expiresAt: number;
  /** 剩余时间（毫秒），每次保存时同步，用于离线恢复 */
  remainingMs: number;
  lastSavedAt: number;
  submittedAt: number | null;
  submitReason: SubmitReason | null;
  /** 评分结果；一旦写入即不再重算，保证交卷幂等 */
  result: ExamResult | null;
  /** 已签发的证件 ID，保证证件签发幂等 */
  certificateId: string | null;
  /** 作答耗时（毫秒），交卷时结算 */
  durationMs: number | null;
}

/** 考试列表项：规则 + 报名判定 + 历史统计的合并视图 */
export interface ExamCatalogItem {
  rule: ExamRule;
  eligibility: EligibilityResult;
  /** 该考试的正式考试次数 */
  officialAttemptCount: number;
  /** 是否已通过 */
  passed: boolean;
  /** 历史最高分 */
  bestScore: number | null;
  /** 最近一次考试时间 */
  lastAttemptAt: number | null;
  /** 是否可以立即再次报考 */
  canRetakeNow: boolean;
  /** 距离可重考还需等待的分钟数 */
  retakeWaitMinutes: number;
  /** 当前进行中的考试记录（用于“继续考试”入口） */
  inProgressAttemptId: string | null;
}
