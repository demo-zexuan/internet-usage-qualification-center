/**
 * 展示格式化工具
 *
 * I. 时间
 *
 * 1. 全部按本机时区格式化为 `YYYY-MM-DD HH:mm`，不使用相对时间，避免考试记录产生歧义
 * 2. 倒计时统一为 `MM:SS`，超过一小时显示 `H:MM:SS`
 *
 * II. 分数
 *
 * 1. 分数保留两位小数但去除无意义的尾随零，避免出现「72.00 分」这类冗长展示
 *
 * @module utils/format
 * @author zexuan.peng
 * @created 2026-10-14
 */

/** 补零 */
function pad(value: number, length = 2): string {
  return String(value).padStart(length, '0');
}

/** 格式化为 YYYY-MM-DD */
export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** 格式化为 YYYY-MM-DD HH:mm */
export function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp);
  return `${formatDate(timestamp)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** 格式化为 HH:mm:ss */
export function formatClock(timestamp: number): string {
  const date = new Date(timestamp);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/**
 * 格式化为倒计时文本
 *
 * @param milliseconds - 剩余毫秒数（负数按 0 处理）
 */
export function formatCountdown(milliseconds: number): string {
  const total = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

/**
 * 格式化为中文耗时描述
 *
 * @param milliseconds - 耗时毫秒数
 */
export function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.round(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) {
    return `${seconds} 秒`;
  }
  if (seconds === 0) {
    return `${minutes} 分钟`;
  }
  return `${minutes} 分 ${seconds} 秒`;
}

/** 格式化剩余等待时间（用于补考间隔提示） */
export function formatWaitMinutes(minutes: number): string {
  if (minutes <= 0) {
    return '现在可以报考';
  }
  if (minutes < 60) {
    return `需等待约 ${Math.ceil(minutes)} 分钟`;
  }
  const hours = Math.floor(minutes / 60);
  const rest = Math.ceil(minutes % 60);
  return rest === 0 ? `需等待约 ${hours} 小时` : `需等待约 ${hours} 小时 ${rest} 分钟`;
}

/** 格式化分数，去除多余的尾随零 */
export function formatScore(score: number): string {
  if (Number.isInteger(score)) {
    return String(score);
  }
  return score.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

/** 格式化百分比 */
export function formatPercent(value: number, total: number): string {
  if (total <= 0) {
    return '0%';
  }
  return `${Math.round((value / total) * 100)}%`;
}

/** 格式化文件大小 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
