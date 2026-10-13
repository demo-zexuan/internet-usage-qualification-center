/**
 * 答题界面组件测试（React Testing Library）
 *
 * 覆盖：
 * 1. 题目卡片的题型渲染（单选 / 多选）
 * 2. 选项的可访问性角色与选中状态
 * 3. 标记疑问的开关语义（aria-pressed）
 * 4. 题号导航面板的状态与无障碍标签
 * 5. 交卷确认对话框的未作答提示
 *
 * @author zexuan.peng
 * @created 2026-10-14
 */

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { QuestionCard } from '@/components/exam/question-card';
import { QuestionNavigator } from '@/components/exam/question-navigator';
import { SubmitDialog } from '@/components/exam/submit-dialog';
import { makePaperQuestion } from '../unit/helpers/fixtures';

describe('QuestionCard 单选渲染', () => {
  const question = makePaperQuestion({
    questionId: 'Q1',
    selection: 'single',
    correctOptionIds: ['B'],
  });

  it('渲染题干、题号与选项文本', () => {
    render(
      <QuestionCard
        question={question}
        number={3}
        total={10}
        selectedOptionIds={[]}
        flagged={false}
        onSelect={() => {}}
        onToggleFlag={() => {}}
      />,
    );

    expect(screen.getByText(/第 3 题 \/ 共 10 题/)).toBeInTheDocument();
    expect(screen.getByText('测试题干')).toBeInTheDocument();
    expect(screen.getByText('选项 A')).toBeInTheDocument();
    expect(screen.getByText('选项 B')).toBeInTheDocument();
  });

  it('选项组使用 radiogroup 角色，选项使用 radio 角色', () => {
    render(
      <QuestionCard
        question={question}
        number={1}
        total={10}
        selectedOptionIds={[]}
        flagged={false}
        onSelect={() => {}}
        onToggleFlag={() => {}}
      />,
    );

    const group = screen.getByRole('radiogroup', { name: '第 1 题的选项' });
    const radios = within(group).getAllByRole('radio');
    expect(radios).toHaveLength(4);
  });

  it('已选选项的 aria-checked 为 true', () => {
    render(
      <QuestionCard
        question={question}
        number={1}
        total={10}
        selectedOptionIds={['C']}
        flagged={false}
        onSelect={() => {}}
        onToggleFlag={() => {}}
      />,
    );

    expect(screen.getByTestId('option-C')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('option-A')).toHaveAttribute('aria-checked', 'false');
  });

  it('点击选项触发 onSelect 并传入选项 ID', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(
      <QuestionCard
        question={question}
        number={1}
        total={10}
        selectedOptionIds={[]}
        flagged={false}
        onSelect={onSelect}
        onToggleFlag={() => {}}
      />,
    );

    await user.click(screen.getByTestId('option-D'));
    expect(onSelect).toHaveBeenCalledWith('D');
  });

  it('标记疑问按钮使用 aria-pressed 表达状态', async () => {
    const user = userEvent.setup();
    const onToggleFlag = vi.fn();

    render(
      <QuestionCard
        question={question}
        number={1}
        total={10}
        selectedOptionIds={[]}
        flagged
        onSelect={() => {}}
        onToggleFlag={onToggleFlag}
      />,
    );

    const button = screen.getByRole('button', { name: '取消标记本题为疑问' });
    expect(button).toHaveAttribute('aria-pressed', 'true');

    await user.click(button);
    expect(onToggleFlag).toHaveBeenCalledTimes(1);
  });
});

describe('QuestionCard 多选渲染', () => {
  const question = makePaperQuestion({
    questionId: 'Q2',
    type: 'multiple_choice',
    selection: 'multiple',
    correctOptionIds: ['A', 'C'],
  });

  it('多选题使用 checkbox 角色并提示可多选', () => {
    render(
      <QuestionCard
        question={question}
        number={2}
        total={5}
        selectedOptionIds={['A']}
        flagged={false}
        onSelect={() => {}}
        onToggleFlag={() => {}}
      />,
    );

    expect(screen.getByText(/本题为多选题/)).toBeInTheDocument();
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(4);
    expect(screen.getByTestId('option-A')).toHaveAttribute('aria-checked', 'true');
  });
});

describe('QuestionCard 材料题', () => {
  it('阅读理解题展示材料标题与正文', () => {
    const question = makePaperQuestion({
      questionId: 'Q3',
      type: 'reading_comprehension',
      materialTitle: '材料：两份口径不同的统计报告',
      material: '甲报告称增长 12%，乙报告称下降 3%。',
    });

    render(
      <QuestionCard
        question={question}
        number={1}
        total={1}
        selectedOptionIds={[]}
        flagged={false}
        onSelect={() => {}}
        onToggleFlag={() => {}}
      />,
    );

    expect(screen.getByText('材料：两份口径不同的统计报告')).toBeInTheDocument();
    expect(screen.getByText('甲报告称增长 12%，乙报告称下降 3%。')).toBeInTheDocument();
  });

  it('无材料时不渲染材料区域', () => {
    const question = makePaperQuestion({ questionId: 'Q4', material: undefined });

    render(
      <QuestionCard
        question={question}
        number={1}
        total={1}
        selectedOptionIds={[]}
        flagged={false}
        onSelect={() => {}}
        onToggleFlag={() => {}}
      />,
    );

    expect(screen.queryByLabelText('题目材料')).not.toBeInTheDocument();
  });
});

describe('QuestionNavigator 题号面板', () => {
  it('展示未作答数量与图例文字', () => {
    render(
      <QuestionNavigator
        total={5}
        currentIndex={0}
        answeredIndexes={new Set([0, 1])}
        flaggedIndexes={new Set([2])}
        onJump={() => {}}
      />,
    );

    // 「未作答」同时出现在数量汇总与图例中，因此使用 getAllByText
    expect(screen.getAllByText('未作答').length).toBeGreaterThan(0);
    expect(screen.getByText('已作答')).toBeInTheDocument();
    expect(screen.getByText('已标记疑问')).toBeInTheDocument();
  });

  it('题号按钮带完整的无障碍标签', () => {
    render(
      <QuestionNavigator
        total={3}
        currentIndex={1}
        answeredIndexes={new Set([0])}
        flaggedIndexes={new Set([2])}
        onJump={() => {}}
      />,
    );

    expect(screen.getByRole('button', { name: '第 1 题，已作答' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '第 2 题，未作答，当前题目' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '第 3 题，未作答，已标记疑问' })).toBeInTheDocument();
  });

  it('当前题通过 aria-current 标注', () => {
    render(
      <QuestionNavigator
        total={3}
        currentIndex={2}
        answeredIndexes={new Set()}
        flaggedIndexes={new Set()}
        onJump={() => {}}
      />,
    );

    expect(screen.getByTestId('nav-3')).toHaveAttribute('aria-current', 'true');
    expect(screen.getByTestId('nav-1')).not.toHaveAttribute('aria-current');
  });

  it('点击题号触发跳转回调', async () => {
    const user = userEvent.setup();
    const onJump = vi.fn();

    render(
      <QuestionNavigator
        total={3}
        currentIndex={0}
        answeredIndexes={new Set()}
        flaggedIndexes={new Set()}
        onJump={onJump}
      />,
    );

    await user.click(screen.getByTestId('nav-2'));
    expect(onJump).toHaveBeenCalledWith(1);
  });
});

describe('SubmitDialog 交卷确认', () => {
  it('展示未作答数量与不可撤销提示', () => {
    render(
      <SubmitDialog
        open
        onOpenChange={() => {}}
        unansweredCount={3}
        flaggedCount={1}
        total={10}
        pending={false}
        onConfirm={() => {}}
      />,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/仍有 3 道题未作答/)).toBeInTheDocument();
    expect(screen.getByText('交卷后不可撤销')).toBeInTheDocument();
    expect(screen.getByText(/已作答/)).toBeInTheDocument();
  });

  it('全部作答时给出正向提示', () => {
    render(
      <SubmitDialog
        open
        onOpenChange={() => {}}
        unansweredCount={0}
        flaggedCount={0}
        total={10}
        pending={false}
        onConfirm={() => {}}
      />,
    );

    expect(screen.getByText('所有题目均已作答')).toBeInTheDocument();
  });

  it('确认按钮在提交中禁用，防止重复交卷', () => {
    render(
      <SubmitDialog
        open
        onOpenChange={() => {}}
        unansweredCount={0}
        flaggedCount={0}
        total={10}
        pending
        onConfirm={() => {}}
      />,
    );

    expect(screen.getByTestId('confirm-submit')).toBeDisabled();
    expect(screen.getByText('正在结算…')).toBeInTheDocument();
  });

  it('点击确认触发交卷回调', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(
      <SubmitDialog
        open
        onOpenChange={() => {}}
        unansweredCount={2}
        flaggedCount={0}
        total={10}
        pending={false}
        onConfirm={onConfirm}
      />,
    );

    await user.click(screen.getByTestId('confirm-submit'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
