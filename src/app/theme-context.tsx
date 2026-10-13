/**
 * 明暗主题上下文
 *
 * I. 存储边界
 *
 * 1. 主题属于非关键 UI 偏好，按项目约定存放在 localStorage
 * 2. 业务数据一律存放于 IndexedDB，不因主题切换而受影响
 *
 * II. 首屏一致性
 *
 * 1. index.html 中的预置脚本会在首屏渲染前应用主题，避免闪烁
 * 2. 本模块只负责后续切换，并保持与预置脚本使用同一存储键
 *
 * @module app/theme-context
 * @author zexuan.peng
 * @created 2026-10-14
 */

import * as React from 'react';

/** 主题取值 */
export type Theme = 'light' | 'dark';

/** localStorage 存储键，必须与 index.html 中的预置脚本保持一致 */
export const THEME_STORAGE_KEY = 'iuqa.ui.theme';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

/** 读取当前主题：优先读取 DOM 上已应用的主题，保证与首屏脚本一致 */
function readInitialTheme(): Theme {
  if (typeof document === 'undefined') {
    return 'light';
  }
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

/** 主题 Provider */
export function ThemeProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [theme, setThemeState] = React.useState<Theme>(readInitialTheme);

  React.useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.dataset.theme = theme;

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // 隐私模式下 localStorage 可能不可用；主题仍对当前会话生效
    }
  }, [theme]);

  const value = React.useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme: setThemeState,
      toggleTheme: () => setThemeState((current) => (current === 'dark' ? 'light' : 'dark')),
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** 读取主题上下文 */
export function useTheme(): ThemeContextValue {
  const context = React.useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme 必须在 ThemeProvider 内部使用');
  }
  return context;
}
