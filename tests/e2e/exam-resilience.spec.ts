/**
 * 考试健壮性端到端测试
 *
 * 覆盖项目测试要求中必须验证的异常路径：
 * 1. 刷新页面后恢复答题（答案、题号、标记不丢失）
 * 2. 关闭浏览器后重开，已超时的考试自动交卷
 * 3. 重复交卷的幂等性
 * 4. 未通过考试的补考规则展示与不签发证件
 * 5. 非法路由参数与不存在记录的错误提示
 * 6. 本地档案在刷新后保留
 *
 * @author zexuan.peng
 * @created 2026-10-14
 */

import { expect, test } from '@playwright/test';

import {
  answerAllQuestions,
  extractAttemptId,
  forceAttemptExpiry,
  pickCorrect,
  pickWrong,
  readAttemptProgress,
  readAttemptResult,
  readPaperAnswers,
} from './helpers';

const CANDIDATE_NAME = '健壮性考生';

/** 建立档案并返回 */
async function createProfile(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  await page.getByLabel(/考生姓名或昵称/).fill(CANDIDATE_NAME);
  await page.getByRole('button', { name: /建立本地档案并进入考试工作台/ }).click();
  await expect(page.getByRole('heading', { name: new RegExp(`${CANDIDATE_NAME} 的考试工作台`) })).toBeVisible();
}

/** 开始一场模拟考试并返回记录 ID */
async function startMockExam(
  page: import('@playwright/test').Page,
  examId: string,
): Promise<string> {
  await page.goto(`/exams/${examId}/instructions?mode=mock`);
  await page.getByTestId('start-exam').click();
  await expect(page).toHaveURL(/\/exam\//);
  return extractAttemptId(page.url());
}

test.describe('刷新与恢复', () => {
  test('刷新页面后答案、题号与标记完整保留', async ({ page }) => {
    await createProfile(page);
    const attemptId = await startMockExam(page, 'L1-BASIC');

    const answers = await readPaperAnswers(page, attemptId);
    expect(answers.length).toBeGreaterThanOrEqual(10);

    // 作答前 3 题，并把当前题推进到第 4 题
    const first = answers[0]!;
    const second = answers[1]!;
    const third = answers[2]!;

    for (const optionId of pickCorrect(first)) {
      await page.getByTestId(`option-${optionId}`).click();
    }
    await page.getByTestId('next-question').click();

    for (const optionId of pickCorrect(second)) {
      await page.getByTestId(`option-${optionId}`).click();
    }
    await page.getByTestId('next-question').click();

    for (const optionId of pickCorrect(third)) {
      await page.getByTestId(`option-${optionId}`).click();
    }
    await page.getByTestId('next-question').click();

    // 标记当前题为疑问
    await page.getByRole('button', { name: '标记本题为疑问' }).click();

    // 等待自动保存真正写入数据库（界面上的「已自动保存」在载入时即存在，不能作为等待依据）
    await expect
      .poll(async () => readAttemptProgress(page, attemptId), { timeout: 15_000 })
      .toMatchObject({ currentIndex: 3, answeredCount: 3, flaggedCount: 1 });

    // I. 刷新页面
    await page.reload();

    await expect(page).toHaveURL(new RegExp(`/exam/${attemptId}`));
    await expect(page.getByText('第 4 题 / 共 10 题', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '取消标记本题为疑问' })).toBeVisible();

    // II. 回到第 1 题确认答案仍在
    await page.getByTestId('prev-question').click();
    await page.getByTestId('prev-question').click();
    await page.getByTestId('prev-question').click();

    for (const optionId of pickCorrect(first)) {
      await expect(page.getByTestId(`option-${optionId}`)).toHaveAttribute('aria-checked', 'true');
    }

    // III. 报名页展示「继续考试」入口
    await page.goto('/exam');
    await expect(page.getByRole('link', { name: /继续考试/ }).first()).toBeVisible();

    // IV. 从报名页恢复后仍指向同一场考试
    await page.getByRole('link', { name: /继续考试/ }).first().click();
    await expect(page).toHaveURL(new RegExp(`/exam/${attemptId}`));
  });

  test('关闭浏览器后重开且已超时，系统自动交卷', async ({ page }) => {
    await createProfile(page);
    const attemptId = await startMockExam(page, 'L1-BASIC');

    const answers = await readPaperAnswers(page, attemptId);
    // 只答对前 4 题
    for (let index = 0; index < 4; index += 1) {
      const answer = answers[index]!;
      for (const optionId of pickCorrect(answer)) {
        await page.getByTestId(`option-${optionId}`).click();
      }
      await page.getByTestId('next-question').click();
    }

    await expect
      .poll(async () => readAttemptProgress(page, attemptId), { timeout: 15_000 })
      .toMatchObject({ answeredCount: 4 });

    // 模拟「关闭浏览器期间时间已过」：把到期时间改到过去
    await forceAttemptExpiry(page, attemptId);

    // 重新打开答题页，应触发恢复结算并跳转成绩页
    await page.goto(`/exam/${attemptId}`);
    await expect(page).toHaveURL(/\/results\//, { timeout: 15_000 });

    // 成绩页说明由超时自动交卷
    await expect(page.getByText(/系统自动交卷/).first()).toBeVisible();

    const record = await readAttemptResult(page, attemptId);
    expect(record?.status).toBe('submitted');
    // 载入答题页时发现已超时，走的是统一的「恢复结算」路径
    expect(record?.submitReason).toBe('recovery');
    // 4 / 10 题正确 → 40 分，未通过
    expect(record?.score).toBe(40);
    expect(record?.passed).toBe(false);
  });
});

test.describe('交卷幂等与未通过路径', () => {
  test('重复点击交卷不会产生重复结算', async ({ page }) => {
    await createProfile(page);
    const attemptId = await startMockExam(page, 'L1-BASIC');

    const answers = await readPaperAnswers(page, attemptId);
    await answerAllQuestions(page, answers, pickCorrect);

    await page.getByTestId('open-submit').click();
    await page.getByTestId('confirm-submit').click();
    await expect(page).toHaveURL(/\/results\//);

    const first = await readAttemptResult(page, attemptId);
    expect(first?.score).toBe(100);

    // 交卷后直接访问答题页应被重定向回成绩页
    await page.goto(`/exam/${attemptId}`);
    await expect(page).toHaveURL(new RegExp(`/results/${attemptId}`));

    const second = await readAttemptResult(page, attemptId);
    expect(second?.score).toBe(first?.score);
    expect(second?.status).toBe('submitted');

    // 证件仍然只有一张
    await page.goto('/certificates');
    await expect(page.getByText('尚未签发任何证件')).toBeVisible();
  });

  test('未通过考试展示补考规则且不签发证件', async ({ page }) => {
    await createProfile(page);

    // 先取得 L1 资格，使 L2 正式考试可以报名
    await page.goto('/exams/L1-BASIC/instructions?mode=official');
    await page.getByRole('checkbox', { name: /我已阅读并理解上述考试须知/ }).click();
    await page.getByTestId('start-exam').click();
    await expect(page).toHaveURL(/\/exam\//);
    const l1AttemptId = extractAttemptId(page.url());
    await answerAllQuestions(page, await readPaperAnswers(page, l1AttemptId), pickCorrect);
    await page.getByTestId('open-submit').click();
    await page.getByTestId('confirm-submit').click();
    await expect(page.getByText('电子证件已签发')).toBeVisible();

    // L2 正式考试全部答错
    await page.goto('/exams/L2-INTERACT/instructions?mode=official');
    await page.getByRole('checkbox', { name: /我已阅读并理解上述考试须知/ }).click();
    await page.getByTestId('start-exam').click();
    await expect(page).toHaveURL(/\/exam\//);
    const l2AttemptId = extractAttemptId(page.url());

    await answerAllQuestions(page, await readPaperAnswers(page, l2AttemptId), pickWrong);
    await page.getByTestId('open-submit').click();
    await page.getByTestId('confirm-submit').click();
    await expect(page).toHaveURL(/\/results\//);

    // 未通过：展示补考规则，且不签发新证件
    await expect(page.getByText('考试未通过').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: '补考规则' })).toBeVisible();
    await expect(page.getByText(/未通过不会降低已取得的等级/)).toBeVisible();

    // 原有 L1 等级与证件保持不变
    await page.goto('/permissions');
    const browsePermission = page.locator('article').filter({ hasText: '浏览互联网' }).first();
    await expect(browsePermission.getByText('已解锁')).toBeVisible();

    await page.goto('/certificates');
    const rows = page.locator('table tbody tr');
    await expect(rows).toHaveCount(1);
    await expect(rows.filter({ hasText: '有效' })).toHaveCount(1);
  });
});

test.describe('异常与非法参数', () => {
  test('不存在的考试记录给出可读错误', async ({ page }) => {
    await createProfile(page);

    await page.goto('/results/not-exist-attempt');
    await expect(page.getByText('找不到该场考试记录')).toBeVisible();
    await expect(page.getByRole('link', { name: /返回考试历史/ })).toBeVisible();

    await page.goto('/exam/not-exist-attempt');
    await expect(page.getByText('找不到该场考试记录')).toBeVisible();
  });

  test('不存在的证件给出可读错误', async ({ page }) => {
    await createProfile(page);

    await page.goto('/certificate/not-exist-certificate');
    await expect(page.getByText('找不到该证件记录')).toBeVisible();
  });

  test('不存在的考试 ID 在须知页给出可读错误', async ({ page }) => {
    await createProfile(page);

    await page.goto('/exams/NOT-EXIST/instructions');
    await expect(page.getByText('找不到指定的考试')).toBeVisible();
    await expect(page.getByRole('link', { name: /返回考试报名/ })).toBeVisible();
  });

  test('未知路由进入 404 页面', async ({ page }) => {
    await createProfile(page);

    await page.goto('/this-route-does-not-exist');
    await expect(page.getByRole('heading', { name: '找不到该页面' })).toBeVisible();
    await expect(page.getByRole('link', { name: /返回首页/ })).toBeVisible();
  });

  test('刷新后本地档案与考试记录仍然存在', async ({ page }) => {
    await createProfile(page);
    const attemptId = await startMockExam(page, 'L1-BASIC');

    await page.reload();
    await page.goto('/profile');
    await expect(page.getByRole('heading', { name: CANDIDATE_NAME })).toBeVisible();

    await page.goto('/history');
    await expect(page.getByRole('link', { name: '互联网浏览资格基础考试' }).first()).toBeVisible();
    await expect(page.getByText(/共 1 条记录/)).toBeVisible();

    const record = await readAttemptResult(page, attemptId);
    expect(record?.status).toBe('in_progress');
  });
});

test.describe('题库管理', () => {
  test('本地管理模式可开启并展示题库统计', async ({ page }) => {
    await createProfile(page);

    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: '题库管理与制度配置' })).toBeVisible();
    await expect(page.getByText('本地管理模式当前已关闭')).toBeVisible();

    // 开启管理模式
    await page.getByTestId('admin-mode-toggle').click();
    await expect(page.getByRole('tab', { name: '题库管理' })).toBeVisible();

    // 题库列表与统计可见
    await expect(
      page.getByRole('heading', { name: '互联网使用基础资格题库' }),
    ).toBeVisible();
    await expect(page.getByText('题库总览')).toBeVisible();

    // 考试规则页展示评分策略
    await page.getByRole('tab', { name: '考试规则' }).click();
    await expect(page.getByText('全站评分策略')).toBeVisible();
    await expect(page.getByText('百分制归一化')).toBeVisible();

    // 数据管理页展示版本信息
    await page.getByRole('tab', { name: '数据管理' }).click();
    await expect(page.getByText('当前数据版本')).toBeVisible();
    await expect(page.getByText('本地操作历史')).toBeVisible();

    // 刷新后管理模式状态保持
    await page.reload();
    await expect(page.getByRole('tab', { name: '题库管理' })).toBeVisible();
  });
});
