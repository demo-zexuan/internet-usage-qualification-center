/**
 * 完整考试闭环端到端测试
 *
 * 覆盖项目测试要求中的完整流程：
 * 首次访问 → 初始化档案 → 模拟考试 → 正式考试 → 自动判分 →
 * 生成证件 → 查看权限 → 参加升级考试 → 查看历史记录
 *
 * 该用例在桌面端与移动端两个项目下都会运行，用于同时验证响应式布局。
 *
 * @author zexuan.peng
 * @created 2026-10-14
 */

import { expect, test } from '@playwright/test';

import {
  answerAllQuestions,
  extractAttemptId,
  pickCorrect,
  readPaperAnswers,
} from './helpers';

const CANDIDATE_NAME = '端到端考生';

/** 建立本地档案 */
async function createProfile(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: /建立本地考试档案/ })).toBeVisible();
  await page.getByLabel(/考生姓名或昵称/).fill(CANDIDATE_NAME);
  await page.getByRole('button', { name: /建立本地档案并进入考试工作台/ }).click();

  await expect(page.getByRole('heading', { name: new RegExp(`${CANDIDATE_NAME} 的考试工作台`) })).toBeVisible();
  // 首次访问时处于临时浏览状态
  await expect(page.getByText('尚未取得任何证件').first()).toBeVisible();
}

/** 走完一场考试并返回考试记录 ID 与是否通过 */
async function takeExam(
  page: import('@playwright/test').Page,
  examId: string,
  mode: 'mock' | 'official',
): Promise<{ attemptId: string; passed: boolean; score: number }> {
  await page.goto(`/exams/${examId}/instructions?mode=${mode}`);

  if (mode === 'official') {
    // 正式考试必须勾选已阅读考试须知
    await expect(page.getByTestId('start-exam')).toBeDisabled();
    await page.getByRole('checkbox', { name: /我已阅读并理解上述考试须知/ }).click();
  }

  await expect(page.getByTestId('start-exam')).toBeEnabled();
  await page.getByTestId('start-exam').click();

  await expect(page).toHaveURL(/\/exam\//);
  const attemptId = extractAttemptId(page.url());

  // 倒计时已启动
  await expect(page.getByTestId('exam-countdown')).toBeVisible();

  // 读取试卷快照后全部答对
  const answers = await readPaperAnswers(page, attemptId);
  expect(answers.length).toBeGreaterThan(0);
  await answerAllQuestions(page, answers, pickCorrect);

  // 交卷
  await page.getByTestId('open-submit').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByTestId('confirm-submit').click();

  await expect(page).toHaveURL(/\/results\//);
  await expect(page.getByTestId('result-score')).toBeVisible();

  const scoreText = (await page.getByTestId('result-score').textContent()) ?? '';
  // 文本形如「100 / 100 分」，取斜杠前的部分
  const score = Number((scoreText.split('/')[0] ?? '').replace(/[^\d.]/g, '') || '0');

  const passed = await page.getByText('考试通过', { exact: false }).isVisible();

  return { attemptId, passed, score };
}

test.describe('完整考试闭环', () => {
  test('首次访问到升级考试的全流程', async ({ page }) => {
    test.setTimeout(180_000);

    // I. 首次访问并建立档案
    await createProfile(page);

    // II. 模拟考试：免除报名条件与须知确认
    const mock = await takeExam(page, 'L1-BASIC', 'mock');
    expect(mock.passed).toBe(true);
    expect(mock.score).toBe(100);
    await expect(page.getByText('模拟考试不签发证件')).toBeVisible();

    // III. 正式考试：L1
    const official = await takeExam(page, 'L1-BASIC', 'official');
    expect(official.passed).toBe(true);
    expect(official.score).toBe(100);

    // IV. 自动判分与证件生成
    await expect(page.getByText('电子证件已签发')).toBeVisible();
    const certificateLink = page.getByRole('link', { name: /查看电子证件/ });
    await expect(certificateLink).toBeVisible();
    await certificateLink.click();

    await expect(page).toHaveURL(/\/certificate\//);
    await expect(page.getByTestId('certificate-document')).toBeVisible();
    await expect(page.getByTestId('certificate-holder')).toHaveText(CANDIDATE_NAME);

    const certificateNumber = (await page.getByTestId('certificate-number').textContent())?.trim() ?? '';
    expect(certificateNumber).toMatch(/^IUQA-\d{4}-[A-Z0-9]{6}$/);

    // 证件页面提供打印与导出能力
    await expect(page.getByRole('button', { name: /打印 \/ 另存为 PDF/ })).toBeVisible();
    await expect(page.getByTestId('download-png')).toBeVisible();
    await expect(page.getByText('本地校验图形 · 不可扫描')).toBeVisible();

    // V. 权限中心：L1 解锁浏览权限，L2 权限仍未解锁
    await page.goto('/permissions');
    await expect(page.getByRole('heading', { name: '模拟互联网权限中心' })).toBeVisible();

    const browsePermission = page.locator('article').filter({ hasText: '浏览互联网' }).first();
    await expect(browsePermission.getByText('已解锁')).toBeVisible();

    const commentPermission = page.locator('article').filter({ hasText: '发表评论' }).first();
    await expect(commentPermission.getByText('未解锁')).toBeVisible();

    // 边界声明必须存在（使用唯一片段，避免与全局免责声明冲突）
    await expect(
      page.getByText(/本系统的全部权限均为应用内的模拟授权/).first(),
    ).toBeVisible();

    // VI. 升级考试：L2
    const upgrade = await takeExam(page, 'L2-INTERACT', 'official');
    expect(upgrade.passed).toBe(true);

    // 升级后 L1 证件转为历史记录，L2 证件为当前证件
    await page.goto('/certificates');
    await expect(page.getByRole('heading', { name: '我的电子证件' })).toBeVisible();

    const certificateRows = page.locator('table tbody tr');
    await expect(certificateRows).toHaveCount(2);
    await expect(certificateRows.filter({ hasText: '已被更高级证件替代' })).toHaveCount(1);
    await expect(certificateRows.filter({ hasText: '当前' })).toHaveCount(1);

    // VII. 权限随之提升
    await page.goto('/permissions');
    const commentAfterUpgrade = page.locator('article').filter({ hasText: '发表评论' }).first();
    await expect(commentAfterUpgrade.getByText('已解锁')).toBeVisible();

    // VIII. 考试历史：记录完整保留
    await page.goto('/history');
    await expect(page.getByRole('heading', { name: '考试历史' })).toBeVisible();
    await expect(page.getByRole('link', { name: '互联网浏览资格基础考试' }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: '互动交流资格进阶考试' }).first()).toBeVisible();

    // 历史记录中可以查看答卷
    await page.getByRole('link', { name: '查看答卷' }).first().click();
    await expect(page).toHaveURL(/\/results\//);
    await expect(page.getByText('逐题作答情况')).toBeVisible();
    await expect(page.getByText('答案解析').first()).toBeVisible();
  });
});
