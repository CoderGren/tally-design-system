import type { Decorator, Preview } from '@storybook/react-vite';
import { useEffect, type ReactNode } from 'react';
import '../src/styles/index.css';

function ThemeFrame({ theme, children }: { theme: 'light' | 'dark'; children: ReactNode }) {
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);
  return (
    <div className="tally-root" style={{ background: 'var(--tally-color-bg)', padding: 24, minHeight: '100%' }}>
      {children}
    </div>
  );
}

const withTheme: Decorator = (Story, context) => (
  <ThemeFrame theme={context.globals.theme as 'light' | 'dark'}>
    <Story />
  </ThemeFrame>
);

const preview: Preview = {
  tags: ['autodocs'],
  decorators: [withTheme],
  globalTypes: {
    theme: {
      description: 'Color theme',
      toolbar: { title: 'Theme', icon: 'mirror', items: ['light', 'dark'], dynamicTitle: true },
    },
  },
  initialGlobals: { theme: 'light' },
  parameters: {
    layout: 'fullscreen',
    controls: { expanded: true },
    // Fail the a11y panel loudly on violations.
    a11y: { test: 'error' },
  },
};

export default preview;
