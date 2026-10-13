/**
 * 证件图片导出服务
 *
 * I. 能力边界
 *
 * 1. 使用 html-to-image 把证件 DOM 渲染为 PNG，全部在本机完成
 * 2. 不涉及任何上传；导出结果通过浏览器下载保存
 *
 * II. 需要处理的现实问题
 *
 * 1. 字体未加载完成时导出会出现字形回退，必须先等待 document.fonts.ready
 * 2. 移动端容器宽度小于证件设计宽度时，需要按设计宽度渲染再缩放，避免换行错位
 * 3. 超长昵称会撑破证件版式，导出前需要临时限制宽度并保留省略
 * 4. 浏览器不支持 canvas 或导出被安全策略拦截时，必须给出可读提示
 *
 * @module services/image-export
 * @author zexuan.peng
 * @created 2026-10-14
 */

import { toPng } from 'html-to-image';

import type { AppError, Result } from '@/types/common';

import { downloadBlob } from './import-export';

/** 导出选项 */
export interface ExportElementOptions {
  /** 输出文件名（不含扩展名） */
  fileName: string;
  /** 像素密度，默认 2 以保证打印清晰度 */
  pixelRatio?: number;
  /** 渲染宽度；容器更窄时按该宽度渲染后再等比缩放 */
  targetWidth?: number;
  /** 背景色；不指定时使用透明 */
  backgroundColor?: string;
}

/** 等待字体加载完成 */
async function waitForFonts(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) {
    return;
  }

  try {
    await document.fonts.ready;
  } catch {
    // 字体加载失败不应阻断导出，继续使用已回退的字体
  }
}

/** 将 DataURL 转换为 Blob */
function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',');
  const mimeMatch = /:(.*?);/.exec(header ?? '');
  const mime = mimeMatch?.[1] ?? 'image/png';
  const binary = atob(base64 ?? '');
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mime });
}

/**
 * 把 DOM 元素导出为 PNG 并触发下载
 *
 * @param element - 需要导出的元素
 * @param options - 导出选项
 */
export async function exportElementToPng(
  element: HTMLElement,
  options: ExportElementOptions,
): Promise<Result<string, AppError>> {
  const { fileName, pixelRatio = 2, targetWidth, backgroundColor } = options;

  if (typeof document === 'undefined') {
    return {
      ok: false,
      error: {
        code: 'EXPORT_UNSUPPORTED',
        message: '当前环境不支持图片导出。',
        hint: '请在浏览器中使用本功能。',
      },
    };
  }

  // I. 等待字体就绪，避免导出图片出现字形回退
  await waitForFonts();

  // II. 记录并临时调整容器宽度：窄屏下按设计宽度渲染，保证版式不被压缩换行
  const originalWidth = element.style.width;
  const originalMaxWidth = element.style.maxWidth;
  const needsWidthOverride =
    typeof targetWidth === 'number' && element.getBoundingClientRect().width < targetWidth;

  if (needsWidthOverride) {
    element.style.width = `${targetWidth}px`;
    element.style.maxWidth = `${targetWidth}px`;
  }

  try {
    const dataUrl = await toPng(element, {
      pixelRatio,
      backgroundColor,
      cacheBust: true,
      // 导出时跳过带 no-export 标记的交互元素
      filter: (node) => {
        if (!(node instanceof HTMLElement)) {
          return true;
        }
        return node.dataset.export !== 'skip';
      },
    });

    if (!dataUrl || dataUrl === 'data:,') {
      return {
        ok: false,
        error: {
          code: 'EXPORT_UNSUPPORTED',
          message: '证件图片渲染结果为空。',
          hint: '请刷新页面后重试；若持续失败，可改用浏览器打印功能另存为 PDF。',
        },
      };
    }

    const blob = dataUrlToBlob(dataUrl);
    const downloadResult = downloadBlob(blob, `${fileName}.png`);

    if (!downloadResult.ok) {
      return downloadResult;
    }

    return { ok: true, value: dataUrl };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);

    return {
      ok: false,
      error: {
        code: 'EXPORT_UNSUPPORTED',
        message: '证件图片导出失败。',
        hint: '可改用浏览器打印功能（Ctrl/Cmd + P）并选择「另存为 PDF」保存证件。',
        details: [detail],
      },
    };
  } finally {
    // III. 无论成功与否都恢复原始宽度，避免影响页面布局
    if (needsWidthOverride) {
      element.style.width = originalWidth;
      element.style.maxWidth = originalMaxWidth;
    }
  }
}

/** 触发浏览器打印 */
export function printDocument(): Result<void, AppError> {
  if (typeof window === 'undefined' || typeof window.print !== 'function') {
    return {
      ok: false,
      error: {
        code: 'EXPORT_UNSUPPORTED',
        message: '当前浏览器不支持打印功能。',
        hint: '请改用桌面端浏览器打开本页面后重试。',
      },
    };
  }

  try {
    window.print();
    return { ok: true, value: undefined };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: 'EXPORT_UNSUPPORTED',
        message: '调用浏览器打印失败。',
        hint: '请手动使用 Ctrl/Cmd + P 打印本页面。',
        details: [error instanceof Error ? error.message : String(error)],
      },
    };
  }
}

/** 复制文本到剪贴板 */
export async function copyToClipboard(text: string): Promise<Result<void, AppError>> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return { ok: true, value: undefined };
    }

    // 降级方案：非安全上下文下 navigator.clipboard 不可用
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'readonly');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const succeeded = document.execCommand('copy');
    document.body.removeChild(textarea);

    if (!succeeded) {
      throw new Error('execCommand 返回失败');
    }

    return { ok: true, value: undefined };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: 'EXPORT_UNSUPPORTED',
        message: '复制到剪贴板失败。',
        hint: '请手动选中文本后使用系统复制快捷键。',
        details: [error instanceof Error ? error.message : String(error)],
      },
    };
  }
}
