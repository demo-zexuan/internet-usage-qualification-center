/**
 * 题库与题目类型定义
 *
 * I. 分层设计
 *
 * 1. `RawQuestion` 是题库 JSON 中作者书写的原始形态，字段保持宽松、贴近书写习惯
 * 2. `PaperQuestion`（见 types/exam.ts）是抽题时归一化后的试卷快照形态
 * 3. 评分引擎只消费试卷快照，绝不直接读取原始题库，保证历史答卷可复核
 *
 * II. 题型与答案的对应关系
 *
 * 1. `key` 模式：单选 / 多选 / 判断 / 阅读理解 / 观点辨析，按正确选项集合判分
 * 2. `points` 模式：情景分析题，按所选选项的预设分值累加判分
 *
 * @module types/question
 * @author zexuan.peng
 * @created 2026-10-14
 */

/** 受支持的题型 */
export const QUESTION_TYPES = [
  'single_choice',
  'multiple_choice',
  'true_false',
  'scenario_analysis',
  'reading_comprehension',
  'opinion_analysis',
] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number];

/** 题型中文名，用于须知页与成绩页展示 */
export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  single_choice: '单选题',
  multiple_choice: '多选题',
  true_false: '判断题',
  scenario_analysis: '情景分析题',
  reading_comprehension: '阅读理解题',
  opinion_analysis: '观点辨析题',
};

/** 题型作答说明，出现在考前须知与题目提示中 */
export const QUESTION_TYPE_HINTS: Record<QuestionType, string> = {
  single_choice: '四个选项中仅有一个正确选项，选出唯一正确答案。',
  multiple_choice: '至少有两个正确选项，需选出全部正确选项；默认严格匹配，少选、多选、错选均不得分。',
  true_false: '判断陈述是否正确，选择“正确”或“错误”。',
  scenario_analysis: '根据情景描述选择最合适的处理方式，不同选项对应不同分值。',
  reading_comprehension: '阅读材料后按材料内容作答，答案必须以材料中的证据为依据。',
  opinion_analysis: '辨析观点的论证结构，考查证据辨识、逻辑一致性与来源核验，不考查立场本身。',
};

/** 题目分类：与考试抽题的分类配额对应 */
export const QUESTION_CATEGORIES = [
  'platform_rules',
  'internet_etiquette',
  'information_literacy',
  'cyber_security',
  'logical_reasoning',
  'public_discourse',
  'digital_wellbeing',
] as const;

export type QuestionCategory = (typeof QUESTION_CATEGORIES)[number];

/** 分类中文名 */
export const QUESTION_CATEGORY_LABELS: Record<QuestionCategory, string> = {
  platform_rules: '平台规则与制度',
  internet_etiquette: '网络礼仪与沟通',
  information_literacy: '信息辨别与溯源',
  cyber_security: '网络安全与隐私',
  logical_reasoning: '逻辑推理与论证',
  public_discourse: '公共讨论素养',
  digital_wellbeing: '数字健康与时间管理',
};

/** 难度等级：1 最易，5 最难 */
export type Difficulty = 1 | 2 | 3 | 4 | 5;

/** 难度中文名 */
export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  1: '入门',
  2: '基础',
  3: '进阶',
  4: '困难',
  5: '专家',
};

/** 作答方式：单选或多选，决定答题界面控件的形态 */
export type SelectionMode = 'single' | 'multiple';

/** 题目选项 */
export interface QuestionOption {
  /** 选项 ID，在同一题内唯一，例如 "A" / "B" / "TRUE" / "FALSE" */
  id: string;
  /** 选项正文 */
  text: string;
  /** 情景分析题：选择该选项可得分值，可为负（表示该做法有明显风险） */
  points?: number;
  /** 情景分析题：选择该选项后的后果说明，仅在成绩复核阶段展示 */
  rationale?: string;
}

/** 键值型答案：正确选项 ID 集合 */
export interface KeyAnswerSpec {
  mode: 'key';
  /** 正确选项 ID 列表；单选题长度为 1，多选题长度 >= 1 */
  correctOptionIds: string[];
}

/**
 * 布尔型答案：判断题可使用
 *
 * 归一化时映射为 TRUE / FALSE 选项，与键值型答案共用同一套判分流程。
 */
export interface BooleanAnswerSpec {
  mode: 'boolean';
  correctBoolean: boolean;
}

/** 分值型答案：情景分析题使用选项分值累加判分 */
export interface PointsAnswerSpec {
  mode: 'points';
  /** 参考最优选项（满分答案），用于成绩页展示“参考答案” */
  bestOptionIds: string[];
  /** 各选项对应分值，键必须覆盖该题全部选项 ID */
  optionPoints: Record<string, number>;
}

/** 题目答案声明 */
export type AnswerSpec = KeyAnswerSpec | BooleanAnswerSpec | PointsAnswerSpec;

/** 多选部分得分规则 */
export interface PartialCreditSpec {
  /**
   * 计分策略
   *
   * 1. `per_option`：每个正确选项均分该题分值，再扣除错选罚分
   * 2. `proportional`：按“选对比例 - 选错比例”计分
   */
  strategy: 'per_option' | 'proportional';
  /** 每错选一个选项扣除的分值（题内扣分，最终不低于 0） */
  penaltyPerWrongOption?: number;
}

/** 题目级评分配置 */
export interface QuestionScoringSpec {
  /** `strict` 完全匹配；`partial` 部分得分 */
  mode: 'strict' | 'partial';
  /** 当 mode 为 partial 时必须提供 */
  partial?: PartialCreditSpec;
  /** 答错时的倒扣分值（0 表示不倒扣），实际生效还需考试规则允许倒扣 */
  negativeScore?: number;
}

/**
 * 题库 JSON 中的原始题目
 *
 * `selection` 与判断题选项均可省略，由归一化函数推导，
 * 以降低题库作者的书写负担，同时保持内部处理的一致性。
 */
export interface RawQuestion {
  /** 题目唯一 ID，同一题库内不得重复 */
  id: string;
  type: QuestionType;
  category: QuestionCategory;
  difficulty: Difficulty;
  /** 检索标签，用于按主题抽题 */
  tags: string[];
  /** 题干 */
  stem: string;
  /** 材料正文：阅读理解材料或情景描述 */
  material?: string;
  /** 材料标题 */
  materialTitle?: string;
  /** 选项列表；判断题可省略，由归一化补齐“正确 / 错误” */
  options?: QuestionOption[];
  answer: AnswerSpec;
  /** 作答方式；省略时按题型推导 */
  selection?: SelectionMode;
  /** 答案解析 */
  explanation: string;
  /** 该题满分（正数） */
  score: number;
  /** 关联知识点，用于成绩页给出复习建议 */
  knowledgePoints?: string[];
  /** 题目出处或依据 */
  source?: string;
  /** 是否允许随机化本题选项顺序 */
  shuffleOptions?: boolean;
  /** 题目级评分配置 */
  scoring?: QuestionScoringSpec;
  /** 观点辨析题：标注本题存在多种可辩护立场，成绩页会提示不因立场判错 */
  multipleValidViewpoints?: boolean;
}

/** 题库元信息 */
export interface QuestionBankMeta {
  bankId: string;
  title: string;
  description: string;
  /** BCP 47 语言标签，例如 zh-CN */
  language: string;
  /** 题库内容版本 */
  version: string;
  /** 题库作者或维护方 */
  author?: string;
  /** 题库更新日期（ISO 日期字符串） */
  updatedAt?: string;
}

/** 已通过 Zod 校验的题库 */
export interface QuestionBank extends QuestionBankMeta {
  /** 题库结构版本，当前受支持版本见 schemas/question-bank.schema.ts */
  schemaVersion: string;
  questions: RawQuestion[];
}

/** 题库在数据库中的存储记录 */
export interface QuestionBankRecord extends QuestionBank {
  /** 数据来源：内置示例、用户导入或恢复内置 */
  source: import('./common').DataSource;
  /** 导入时间（Unix 毫秒） */
  importedAt: number;
  /** 原始 JSON 文本，导出时按原文还原 */
  rawJson: string;
  /** 校验通过时的统计信息 */
  stats: QuestionBankStats;
}

/** 题库统计信息 */
export interface QuestionBankStats {
  /** 题目总数 */
  totalQuestions: number;
  /** 各题型数量 */
  byType: Record<string, number>;
  /** 各分类数量 */
  byCategory: Record<string, number>;
  /** 各难度数量 */
  byDifficulty: Record<string, number>;
  /** 题目分值合计 */
  totalScore: number;
}
