/**
 * 文件导入导出服务
 *
 * I. 职责
 *
 * 1. 统一的文件下载入口，处理 Blob 创建与对象 URL 释放
 * 2. 统一的文件选择入口，避免每个页面各写一个隐藏 input
 * 3. 浏览器能力检测：不支持下载能力时返回明确错误，而不是静默失败
 *
 * II. 边界
 *
 * 1. 全部操作在本机完成，不涉及任何上传
 * 2. 导入内容在使用前必须经过调用方校验，本模块不做业务校验
 *
 * @module services/import-export
 * @author zexuan.peng
 * @created 2026-10-14
 */

import type { AppError, Result } from '@/types/common';

/** 检测浏览器是否支持文件下载 */
export function isDownloadSupported(): boolean {
  return typeof document !== 'undefined' && typeof URL.createObjectURL === 'function';
}

/** 触发浏览器下载 */
export function downloadBlob(blob: Blob, fileName: string): Result<void, AppError> {
  if (!isDownloadSupported()) {
    return {
      ok: false,
      error: {
        code: 'EXPORT_UNSUPPORTED',
        message: '当前浏览器不支持文件下载功能。',
        hint: '请改用最新版本的 Chrome、Edge、Firefox 或 Safari 后重试。',
      },
    };
  }

  try {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);

    // 延迟释放，确保下载已经开始
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    return { ok: true, value: undefined };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: 'EXPORT_UNSUPPORTED',
        message: '文件下载失败。',
        hint: '请检查浏览器是否拦截了自动下载。',
        details: [error instanceof Error ? error.message : String(error)],
      },
    };
  }
}

/** 下载文本文件（JSON / 纯文本） */
export function downloadTextFile(
  content: string,
  fileName: string,
  mimeType = 'application/json;charset=utf-8',
): Result<void, AppError> {
  return downloadBlob(new Blob([content], { type: mimeType }), fileName);
}

/**
 * 通过隐藏的 input 选择本地文件
 *
 * @param accept - 允许的文件类型，例如 `.json,application/json`
 * @returns 用户选择的文件；取消选择时返回 null
 */
export function pickFile(accept = '.json,application/json'): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';

    let settled = false;
    const finish = (file: File | null): void => {
      if (settled) {
        return;
      }
      settled = true;
      input.remove();
      resolve(file);
    };

    input.addEventListener('change', () => {
      finish(input.files?.[0] ?? null);
    });

    // 用户取消选择时不会触发 change；依赖窗口重新获得焦点后兜底清理
    window.addEventListener(
      'focus',
      () => {
        setTimeout(() => finish(input.files?.[0] ?? null), 300);
      },
      { once: true },
    );

    document.body.appendChild(input);
    input.click();
  });
}

/** 读取文件为文本 */
export function readFileAsText(file: File): Promise<Result<string, AppError>> {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = () => resolve({ ok: true, value: String(reader.result) });
    reader.onerror = () =>
      resolve({
        ok: false,
        error: {
          code: 'IMPORT_VALIDATION_FAILED',
          message: '文件读取失败。',
          hint: '请确认文件未被其他程序占用后重试。',
        },
      });

    reader.readAsText(file, 'utf-8');
  });
}
