import { useEffect, type ReactNode } from 'react';
import type { ThemeName } from '../tokens/tokens';

export interface ThemeProviderProps {
  /** 'system' follows prefers-color-scheme. */
  theme: ThemeName | 'system';
  /** Element that receives data-theme; defaults to <html>. */
  target?: HTMLElement;
  children?: ReactNode;
}

/** Applies the light/dark token set by toggling data-theme. */
export function ThemeProvider({ theme, target, children }: ThemeProviderProps) {
  useEffect(() => {
    const el = target ?? document.documentElement;
    if (theme === 'system') el.removeAttribute('data-theme');
    else el.setAttribute('data-theme', theme);
  }, [theme, target]);
  return <>{children}</>;
}
