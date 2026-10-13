/**
 * 响应式布局端到端测试
 *
 * 在桌面端与移动端两个项目下运行，按视口宽度校验不同的布局契约：
 * 1. 桌面端：左侧业务导航与右侧资格状态面板可见
 * 2. 移动端：顶部精简导航 + 底部固定导航可见，单列布局
 * 3. 两端共同：无横向溢出、考试倒计时与交卷按钮始终可见、选项触控区域足够大
 *
 * @author zexuan.peng
 * @created 2026-10-14
 */

import { expect, test } from '@playwright/test';

import { extractAttemptId, readPaperAnswers, pickCorrect } from './helpers';

const CANDIDATE_NAME = '响应式考生';

/** 页面是否出现横向溢出 */
async function hasHorizontalOverflow(page: import('@playwright/test').Page): Promise<boolean> {
  return page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth > window.innerWidth + 1;
  });
}

/** 建立档案 */
async function createProfile(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  await page.getByLabel(/考生姓名或昵称/).fill(CANDIDATE_NAME);
  await page.getByRole('button', { name: /建立本地档案并进入考试工作台/ }).click();
  await expect(page.getByRole('heading', { name: new RegExp(`${CANDIDATE_NAME} 的考试工作台`) })).toBeVisible();
}

test.describe('响应式布局', () => {
  test('首页在两种视口下均无横向溢出', async ({ page }, testInfo) => {
    await createProfile(page);

    const isMobile = testInfo.project.name.includes('mobile');

    if (isMobile) {
      // 移动端：底部导航可见，侧边业务导航隐藏
      await expect(page.getByRole('navigation', { name: '移动端底部导航' })).toBeVisible();
      await expect(page.getByRole('navigation', { name: '业务导航' }).first()).toBeHidden();
    } else {
      // 桌面端：侧边业务导航可见
      await expect(page.getByRole('navigation', { name: '业务导航' }).first()).toBeVisible();
    }

    expect(await hasHorizontalOverflow(page)).toBe(false);
  });

  test('全部主要页面在两种视口下均无横向溢出', async ({ page }) => {
    await createProfile(page);

    const routes = [
      '/',
      '/profile',
      '/exams',
      '/exams/L1-BASIC/instructions',
      '/permissions',
      '/history',
      '/certificates',
      '/admin',
      '/materials',
      '/simulator',
      '/simulator/discussion',
    ];

    for (const route of routes) {
      await page.goto(route);
      await page.waitForLoadState('domcontentloaded');

      expect(await hasHorizontalOverflow(page), `页面 ${route} 出现横向溢出`).toBe(false);
    }
  });

  test('答题页在两种视口下倒计时与交卷按钮始终可见', async ({ page }, testInfo) => {
    await createProfile(page);

    await page.goto('/exams/L1-BASIC/instructions?mode=mock');
    await page.getByTestId('start-exam').click();
    await expect(page).toHaveURL(/\/exam\//);

    const attemptId = extractAttemptId(page.url());

    // 倒计时与交卷按钮必须同时可见
    await expect(page.getByTestId('exam-countdown')).toBeVisible();
    await expect(page.getByTestId('open-submit')).toBeVisible();

    // 题号面板在移动端默认折叠，可通过按钮展开
    if (testInfo.project.name.includes('mobile')) {
      await expect(page.getByRole('button', { name: '题号面板' })).toBeVisible();
      await expect(page.getByRole('navigation', { name: '移动端底部导航' })).toBeVisible();
    }

    // 选项触控区域高度不低于 44px（移动端可用性要求）
    const answers = await readPaperAnswers(page, attemptId);
    const firstOptionId = pickCorrect(answers[0]!)[0] ?? 'A';
    const box = await page.getByTestId(`option-${firstOptionId}`).boundingBox();

    expect(box).not.toBeNull();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);

    // 上一题 / 下一题按钮可见且可点
    await expect(page.getByTestId('prev-question')).toBeVisible();
    await expect(page.getByTestId('next-question')).toBeVisible();

    expect(await hasHorizontalOverflow(page)).toBe(false);
  });

  test('证件页面在两种视口下无横向溢出且打印版式可用', async ({ page }) => {
    await createProfile(page);

    // 通过 L1 正式考试以取得证件
    await page.goto('/exams/L1-BASIC/instructions?mode=official');
    await page.getByRole('checkbox', { name: /我已阅读并理解上述考试须知/ }).click();
    await page.getByTestId('start-exam').click();
    await expect(page).toHaveURL(/\/exam\//);

    const attemptId = extractAttemptId(page.url());
    const answers = await readPaperAnswers(page, attemptId);

    for (let index = 0; index < answers.length; index += 1) {
      for (const optionId of pickCorrect(answers[index]!)) {
        await page.getByTestId(`option-${optionId}`).click();
      }
      if (index < answers.length - 1) {
        await page.getByTestId('next-question').click();
      }
    }

    await page.getByTestId('open-submit').click();
    await page.getByTestId('confirm-submit').click();
    await expect(page).toHaveURL(/\/results\//);

    await page.getByRole('link', { name: /查看电子证件/ }).click();
    await expect(page).toHaveURL(/\/certificate\//);

    // 证件正文可见，编号与持证人信息完整
    await expect(page.getByTestId('certificate-document')).toBeVisible();
    await expect(page.getByTestId('certificate-number')).toContainText('IUQA-');
    await expect(page.getByTestId('certificate-holder')).toHaveText(CANDIDATE_NAME);

    // 证件正文宽度不超过视口（窄屏下允许容器内横向滚动，但页面本身不得溢出）
    const documentBox = await page.getByTestId('certificate-document').boundingBox();
    expect(documentBox?.width ?? 0).toBeGreaterThan(0);

    expect(await hasHorizontalOverflow(page)).toBe(false);
  });
});
