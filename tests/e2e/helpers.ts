/**
 * 端到端测试辅助
 *
 * I. 读取试卷快照
 *
 * 1. 通过页面上下文的 IndexedDB 读取当前考试记录的试卷快照
 * 2. 由此得到每道题的正确答案，使端到端测试可以真实走通「通过」与「未通过」两条路径
 *
 * II. 为什么直接读数据库
 *
 * 1. 试卷快照本身就是应用的持久化数据，读取它不依赖任何测试专用后门
 * 2. 这样可以在不修改生产代码的前提下验证完整的考试闭环
 *
 * @author zexuan.peng
 * @created 2026-10-14
 */

import type { Page } from '@playwright/test';

/** 单题答案信息 */
export interface QuestionAnswerInfo {
  questionId: string;
  correctOptionIds: string[];
  allOptionIds: string[];
}

/** 从页面上下文的 IndexedDB 读取试卷快照中的答案信息 */
export async function readPaperAnswers(
  page: Page,
  attemptId: string,
): Promise<QuestionAnswerInfo[]> {
  return page.evaluate(async (id: string) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('iuqa-local-authority');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    const attempt = await new Promise<Record<string, unknown> | undefined>((resolve, reject) => {
      const transaction = database.transaction('examAttempts', 'readonly');
      const request = transaction.objectStore('examAttempts').get(id);
      request.onsuccess = () => resolve(request.result as Record<string, unknown> | undefined);
      request.onerror = () => reject(request.error);
    });

    database.close();

    if (!attempt) {
      return [];
    }

    const paper = attempt.paper as {
      questions: {
        questionId: string;
        correctOptionIds: string[];
        options: { id: string }[];
      }[];
    };

    return paper.questions.map((question) => ({
      questionId: question.questionId,
      correctOptionIds: question.correctOptionIds,
      allOptionIds: question.options.map((option) => option.id),
    }));
  }, attemptId);
}

/** 从当前地址中取出考试记录 ID */
export function extractAttemptId(url: string): string {
  const match = /\/exam\/([^/?#]+)/.exec(url);
  if (!match?.[1]) {
    throw new Error(`无法从地址中解析考试记录 ID：${url}`);
  }
  return match[1];
}

/**
 * 逐题作答
 *
 * 通过「下一题」按钮推进，避免依赖题号导航面板（移动端默认折叠）。
 */
export async function answerAllQuestions(
  page: Page,
  answers: QuestionAnswerInfo[],
  picker: (answer: QuestionAnswerInfo) => string[],
): Promise<void> {
  for (let index = 0; index < answers.length; index += 1) {
    const answer = answers[index];
    if (!answer) {
      continue;
    }

    for (const optionId of picker(answer)) {
      await page.getByTestId(`option-${optionId}`).click();
    }

    if (index < answers.length - 1) {
      await page.getByTestId('next-question').click();
    }
  }
}

/** 选择全部正确选项 */
export function pickCorrect(answer: QuestionAnswerInfo): string[] {
  return answer.correctOptionIds;
}

/** 选择一个明确错误的选项（若不存在则返回空数组，表示不作答） */
export function pickWrong(answer: QuestionAnswerInfo): string[] {
  const wrong = answer.allOptionIds.find((id) => !answer.correctOptionIds.includes(id));
  return wrong ? [wrong] : [];
}

/** 在页面上下文中修改考试记录的到期时间，用于验证超时恢复路径 */
export async function forceAttemptExpiry(page: Page, attemptId: string): Promise<void> {
  await page.evaluate(async (id: string) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('iuqa-local-authority');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('examAttempts', 'readwrite');
      const store = transaction.objectStore('examAttempts');
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const record = getRequest.result as Record<string, unknown>;
        record.expiresAt = Date.now() - 5_000;
        record.remainingMs = 0;
        const putRequest = store.put(record);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      };
      getRequest.onerror = () => reject(getRequest.error);
    });

    database.close();
  }, attemptId);
}

/** 读取考试记录的答题进度 */
export async function readAttemptProgress(
  page: Page,
  attemptId: string,
): Promise<{ currentIndex: number; answeredCount: number; flaggedCount: number } | null> {
  return page.evaluate(async (id: string) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('iuqa-local-authority');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    const attempt = await new Promise<Record<string, unknown> | undefined>((resolve, reject) => {
      const transaction = database.transaction('examAttempts', 'readonly');
      const request = transaction.objectStore('examAttempts').get(id);
      request.onsuccess = () => resolve(request.result as Record<string, unknown> | undefined);
      request.onerror = () => reject(request.error);
    });

    database.close();

    if (!attempt) {
      return null;
    }

    const answers = (attempt.answers ?? {}) as Record<string, string[]>;

    return {
      currentIndex: Number(attempt.currentIndex ?? 0),
      answeredCount: Object.values(answers).filter((ids) => ids.length > 0).length,
      flaggedCount: ((attempt.flaggedQuestionIds ?? []) as string[]).length,
    };
  }, attemptId);
}

/** 读取考试记录的状态与成绩 */
export async function readAttemptResult(
  page: Page,
  attemptId: string,
): Promise<{
  status: string;
  submitReason: string | null;
  score: number | null;
  passed: boolean | null;
  certificateId: string | null;
} | null> {
  return page.evaluate(async (id: string) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('iuqa-local-authority');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    const attempt = await new Promise<Record<string, unknown> | undefined>((resolve, reject) => {
      const transaction = database.transaction('examAttempts', 'readonly');
      const request = transaction.objectStore('examAttempts').get(id);
      request.onsuccess = () => resolve(request.result as Record<string, unknown> | undefined);
      request.onerror = () => reject(request.error);
    });

    database.close();

    if (!attempt) {
      return null;
    }

    const result = attempt.result as { score: number; passed: boolean } | null;

    return {
      status: String(attempt.status),
      submitReason: (attempt.submitReason as string | null) ?? null,
      score: result?.score ?? null,
      passed: result?.passed ?? null,
      certificateId: (attempt.certificateId as string | null) ?? null,
    };
  }, attemptId);
}
