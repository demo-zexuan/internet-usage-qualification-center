/**
 * 导出与剪贴板服务单元测试
 *
 * 覆盖项目测试要求中的「PNG 导出异常处理」条目，并验证浏览器能力缺失时
 * 一律返回可读错误而不是抛出异常。
 *
 * @author zexuan.peng
 * @created 2026-10-14
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  copyToClipboard,
  exportElementToPng,
  printDocument,
} from '@/services/image-export';
import {
  downloadBlob,
  downloadTextFile,
  isDownloadSupported,
  readFileAsText,
} from '@/services/import-export';

describe('下载能力检测与降级', () => {
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it('浏览器支持时检测为可用', () => {
    expect(isDownloadSupported()).toBe(true);
  });

  it('下载文本文件会创建对象 URL 并触发点击', () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    const result = downloadTextFile('{"a":1}', 'test.json');

    expect(result.ok).toBe(true);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);

    clickSpy.mockRestore();
  });

  it('下载 Blob 失败时返回可读错误而不是抛出异常', () => {
    URL.createObjectURL = vi.fn(() => {
      throw new Error('对象 URL 创建失败');
    });

    const result = downloadBlob(new Blob(['x']), 'test.txt');

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.code).toBe('EXPORT_UNSUPPORTED');
    expect(result.error.hint).toContain('拦截');
  });

  it('不支持对象 URL 时给出明确的能力缺失说明', () => {
    const original = URL.createObjectURL;

    // 模拟浏览器能力缺失：直接移除 createObjectURL
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: undefined,
    });

    expect(isDownloadSupported()).toBe(false);

    const result = downloadTextFile('x', 'x.txt');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('不支持文件下载');
    }

    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: original,
    });
  });

  it('读取文件为文本成功时返回内容', async () => {
    const file = new File(['{"hello":"world"}'], 'data.json', { type: 'application/json' });
    const result = await readFileAsText(file);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe('{"hello":"world"}');
    }
  });
});

describe('PNG 导出异常处理', () => {
  it('导出失败时返回可读错误且不抛出异常', async () => {
    const element = document.createElement('div');
    element.textContent = '证件内容';
    document.body.appendChild(element);

    const result = await exportElementToPng(element, { fileName: 'certificate' });

    // jsdom 环境缺少真实渲染能力，此处必然失败；关键在于失败路径是可控的
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe('EXPORT_UNSUPPORTED');
    expect(result.error.message.length).toBeGreaterThan(0);
    // 必须给出替代方案，而不是只报错
    expect(result.error.hint).toContain('打印');

    document.body.removeChild(element);
  });

  it('导出失败后恢复元素原始宽度，避免影响页面布局', async () => {
    const element = document.createElement('div');
    element.style.width = '320px';
    element.style.maxWidth = '320px';
    element.textContent = '证件内容';
    document.body.appendChild(element);

    await exportElementToPng(element, { fileName: 'certificate', targetWidth: 720 });

    expect(element.style.width).toBe('320px');
    expect(element.style.maxWidth).toBe('320px');

    document.body.removeChild(element);
  });

  it('导出不会因为元素包含标记为跳过的子节点而崩溃', async () => {
    const element = document.createElement('div');
    const toolbar = document.createElement('div');
    toolbar.dataset.export = 'skip';
    toolbar.textContent = '不导出的工具栏';
    element.appendChild(toolbar);
    document.body.appendChild(element);

    const result = await exportElementToPng(element, { fileName: 'certificate' });
    expect(typeof result.ok).toBe('boolean');

    document.body.removeChild(element);
  });
});

describe('打印能力', () => {
  it('浏览器不支持打印时返回可读错误', () => {
    const original = window.print;
    // @ts-expect-error 测试中临时移除浏览器能力
    delete window.print;

    const result = printDocument();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('不支持打印');
      expect(result.error.hint).toContain('桌面端');
    }

    window.print = original;
  });

  it('浏览器支持打印时调用成功', () => {
    const printSpy = vi.fn();
    window.print = printSpy;

    const result = printDocument();

    expect(result.ok).toBe(true);
    expect(printSpy).toHaveBeenCalledTimes(1);
  });
});

describe('剪贴板复制', () => {
  it('优先使用 navigator.clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    const result = await copyToClipboard('IUQA-2026-ABCDEF');

    expect(result.ok).toBe(true);
    expect(writeText).toHaveBeenCalledWith('IUQA-2026-ABCDEF');
  });

  it('clipboard 不可用时降级到 execCommand', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    });

    const execCommand = vi.fn(() => true);
    // jsdom 未实现 execCommand，测试中注入
    (document as unknown as { execCommand: typeof execCommand }).execCommand = execCommand;

    const result = await copyToClipboard('IUQA-2026-ABCDEF');

    expect(result.ok).toBe(true);
    expect(execCommand).toHaveBeenCalledWith('copy');
  });

  it('两种方式都失败时返回可读错误', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    });

    (document as unknown as { execCommand: () => boolean }).execCommand = () => false;

    const result = await copyToClipboard('IUQA-2026-ABCDEF');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('复制到剪贴板失败');
      expect(result.error.hint).toContain('手动选中');
    }
  });
});
