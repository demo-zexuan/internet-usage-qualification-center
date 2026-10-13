/**
 * 证件导出端到端测试
 *
 * 覆盖项目测试要求中「证件图片、打印页面必须分别测试」的条目：
 * 1. 下载 PNG 会真实触发浏览器下载，且文件名包含证件编号
 * 2. 打印按钮会调用浏览器打印能力
 * 3. 复制证件编号与复制展示页链接可用
 * 4. 证件页面明确声明不可在线核验
 *
 * @author zexuan.peng
 * @created 2026-10-14
 */

import { expect, test } from '@playwright/test';

import { extractAttemptId, pickCorrect, readPaperAnswers } from './helpers';

const CANDIDATE_NAME = '证件导出考生';

/** 建立档案并通过 L1 正式考试，最终停留在证件页面 */
async function reachCertificatePage(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  await page.getByLabel(/考生姓名或昵称/).fill(CANDIDATE_NAME);
  await page.getByRole('button', { name: /建立本地档案并进入考试工作台/ }).click();
  await expect(page.getByRole('heading', { name: new RegExp(`${CANDIDATE_NAME} 的考试工作台`) })).toBeVisible();

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
  await expect(page.getByTestId('certificate-document')).toBeVisible();
}

test.describe('证件导出', () => {
  test('下载 PNG 触发真实下载且文件名包含证件编号', async ({ page }) => {
    test.setTimeout(120_000);

    await reachCertificatePage(page);

    const certificateNumber = (await page.getByTestId('certificate-number').textContent())?.trim() ?? '';
    expect(certificateNumber).toMatch(/^IUQA-\d{4}-[A-Z0-9]{6}$/);

    const downloadPromise = page.waitForEvent('download', { timeout: 60_000 });
    await page.getByTestId('download-png').click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toContain(certificateNumber);
    expect(download.suggestedFilename()).toMatch(/\.png$/);

    // 导出成功后给出提示
    await expect(page.getByText('证件图片已下载')).toBeVisible();
  });

  test('打印按钮调用浏览器打印能力并提示另存为 PDF', async ({ page }) => {
    test.setTimeout(120_000);

    await reachCertificatePage(page);

    // 拦截 window.print，避免真实弹出打印对话框
    await page.evaluate(() => {
      (window as unknown as { __printCalled?: number }).__printCalled = 0;
      window.print = () => {
        (window as unknown as { __printCalled?: number }).__printCalled =
          ((window as unknown as { __printCalled?: number }).__printCalled ?? 0) + 1;
      };
    });

    await page.getByRole('button', { name: /打印 \/ 另存为 PDF/ }).click();

    await expect(page.getByText('已调用浏览器打印')).toBeVisible();

    const printCalls = await page.evaluate(
      () => (window as unknown as { __printCalled?: number }).__printCalled ?? 0,
    );
    expect(printCalls).toBe(1);
  });

  test('复制证件编号与展示页链接可用', async ({ page, context }) => {
    test.setTimeout(120_000);

    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await reachCertificatePage(page);

    await page.getByRole('button', { name: /复制编号/ }).click();
    await expect(page.getByText('证件编号已复制')).toBeVisible();

    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard).toMatch(/^IUQA-\d{4}-[A-Z0-9]{6}$/);

    await page.getByRole('button', { name: /复制展示页链接/ }).click();
    await expect(page.getByText('展示页链接已复制')).toBeVisible();

    const link = await page.evaluate(() => navigator.clipboard.readText());
    expect(link).toContain('/certificate/');
  });

  test('证件页面明确声明不可在线核验且不具有法律效力', async ({ page }) => {
    test.setTimeout(120_000);

    await reachCertificatePage(page);

    await expect(page.getByText('重要说明：本证件不具有现实法律效力')).toBeVisible();
    await expect(page.getByText(/本平台未部署任何在线验证服务/)).toBeVisible();
    await expect(page.getByText(/不可扫描/).first()).toBeVisible();
    await expect(page.getByText(/虚构的娱乐性质资格认证/).first()).toBeVisible();
  });

  test('证件历史列表保留历史证件并标注状态', async ({ page }) => {
    test.setTimeout(120_000);

    await reachCertificatePage(page);

    await page.goto('/certificates');
    const rows = page.locator('table tbody tr');
    await expect(rows).toHaveCount(1);
    await expect(rows.filter({ hasText: '有效' })).toHaveCount(1);
    await expect(rows.filter({ hasText: '当前' })).toHaveCount(1);
  });
});
