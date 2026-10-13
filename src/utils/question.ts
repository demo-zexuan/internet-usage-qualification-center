/**
 * 题目归一化工具
 *
 * I. 存在意义
 *
 * 1. 题库 JSON 为了书写友好允许省略部分字段（例如判断题的选项、单选/多选的作答方式）
 * 2. 评分引擎与答题界面需要完全确定的形态，因此在抽题时统一归一化
 * 3. 归一化逻辑集中在此处，避免校验层与抽题层各写一套而出现行为漂移
 *
 * II. 判断题约定
 *
 * 1. 判断题统一使用 TRUE / FALSE 两个选项 ID
 * 2. 题库作者可省略选项，此时使用默认文案「正确 / 错误」
 * 3. 若自定义选项文案，ID 仍必须是 TRUE 与 FALSE
 *
 * @module utils/question
 * @author zexuan.peng
 * @created 2026-10-14
 */

import type { QuestionOption, RawQuestion, SelectionMode } from '@/types/question';

/** 判断题的固定选项 ID */
export const TRUE_OPTION_ID = 'TRUE';
/** 判断题的固定选项 ID */
export const FALSE_OPTION_ID = 'FALSE';

/** 判断题默认选项 */
export const DEFAULT_TRUE_FALSE_OPTIONS: readonly QuestionOption[] = [
  { id: TRUE_OPTION_ID, text: '正确' },
  { id: FALSE_OPTION_ID, text: '错误' },
];

/**
 * 推导题目的作答方式
 *
 * 1. 题目显式声明 `selection` 时直接采用
 * 2. 否则按题型推导：单选与判断为单选，多选为多选
 * 3. 情景分析、阅读理解、观点辨析按正确答案数量推导
 */
export function resolveSelectionMode(question: RawQuestion): SelectionMode {
  if (question.selection) {
    return question.selection;
  }

  switch (question.type) {
    case 'single_choice':
    case 'true_false':
      return 'single';
    case 'multiple_choice':
      return 'multiple';
    case 'scenario_analysis':
    case 'reading_comprehension':
    case 'opinion_analysis':
      return resolveCorrectOptionIds(question).length > 1 ? 'multiple' : 'single';
    default:
      return 'single';
  }
}

/**
 * 推导题目的完整选项列表
 *
 * 判断题未提供选项时补齐默认的「正确 / 错误」两项。
 */
export function resolveQuestionOptions(question: RawQuestion): QuestionOption[] {
  if (question.options && question.options.length > 0) {
    return question.options;
  }

  if (question.type === 'true_false') {
    return DEFAULT_TRUE_FALSE_OPTIONS.map((option) => ({ ...option }));
  }

  return [];
}

/**
 * 推导题目的正确选项 ID 集合
 *
 * 情景分析题返回的是参考最优选项，其真实判分依赖选项分值。
 */
export function resolveCorrectOptionIds(question: RawQuestion): string[] {
  const { answer } = question;

  switch (answer.mode) {
    case 'key':
      return [...answer.correctOptionIds];
    case 'boolean':
      return [answer.correctBoolean ? TRUE_OPTION_ID : FALSE_OPTION_ID];
    case 'points':
      return [...answer.bestOptionIds];
    default:
      return [];
  }
}

/** 题目是否为分值型判分（情景分析题） */
export function isPointsScoredQuestion(question: RawQuestion): boolean {
  return question.answer.mode === 'points';
}
