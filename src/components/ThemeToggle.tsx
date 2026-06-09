'use client';

import * as React from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useTranslation } from 'react-i18next';

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { t } = useTranslation('common');
  const [mounted, setMounted] = React.useState(false);

  // Prevent hydration mismatch
  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button
        className={`relative inline-flex items-center justify-center w-9 h-9 rounded-lg bg-muted hover:bg-muted/80 transition-all ${className}`}
        aria-label={t('theme.toggle')}
      >
        <Sun className="h-4 w-4 opacity-50" />
      </button>
    );
  }

  const cycleTheme = () => {
    if (theme === 'system') {
      setTheme('dark');
    } else if (theme === 'dark') {
      setTheme('light');
    } else {
      setTheme('system');
    }
  };

  const isDark = resolvedTheme === 'dark';
  const isSystem = theme === 'system';

  return (
    <button
      onClick={cycleTheme}
      className={`relative inline-flex items-center justify-center w-9 h-9 rounded-lg transition-all hover:scale-105 active:scale-95 ${
        isDark
          ? 'bg-white/10 hover:bg-white/20 text-yellow-300'
          : 'bg-tunis-blue/10 hover:bg-tunis-blue/20 text-tunis-blue'
      } ${className}`}
      aria-label={t('theme.toggle')}
      title={isSystem ? t('theme.systemClickDark') : isDark ? t('theme.darkClickLight') : t('theme.lightClickSystem')}
    >
      {isDark ? (
        <Moon className="h-4 w-4" />
      ) : (
        <Sun className="h-4 w-4" />
      )}
      {isSystem && (
        <Monitor className="h-2.5 w-2.5 absolute -bottom-0.5 -right-0.5 opacity-60" />
      )}
    </button>
  );
}

/**
 * Compact toggle variant for sidebars and tight spaces
 */
export function ThemeToggleCompact({ className = '', hideLabel = false }: { className?: string; hideLabel?: boolean }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { t } = useTranslation('common');
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const buttonLayout = hideLabel ? 'justify-center gap-0 text-center' : 'gap-3 text-left';

  if (!mounted) {
    return (
      <button
        className={`w-full flex items-center px-3 py-2.5 rounded-lg transition-all group text-slate-200 hover:!bg-white/5 hover:!text-white ${buttonLayout} ${className}`}
        aria-label={t('theme.toggle')}
      >
        <Sun className="h-5 w-5 shrink-0 transition-colors" />
        {!hideLabel && <span className="text-sm font-medium">{t('nav.theme')}</span>}
      </button>
    );
  }

  const isDark = resolvedTheme === 'dark';
  const isSystem = theme === 'system';

  const cycleTheme = () => {
    if (theme === 'system') {
      setTheme('dark');
    } else if (theme === 'dark') {
      setTheme('light');
    } else {
      setTheme('system');
    }
  };

  const label = isSystem ? t('theme.system') : isDark ? t('theme.dark') : t('theme.light');

  return (
    <button
      onClick={cycleTheme}
      className={`w-full flex items-center px-3 py-2.5 rounded-lg transition-all group text-slate-200 hover:!bg-white/5 hover:!text-white ${buttonLayout} ${className}`}
      aria-label={`${t('nav.theme')}: ${label}. Click to cycle.`}
      title={`${t('theme.current')}: ${label} — click to cycle`}
    >
      {isDark ? (
        <Moon className="h-5 w-5 shrink-0 transition-colors" />
      ) : (
        <Sun className="h-5 w-5 shrink-0 transition-colors" />
      )}
      {!hideLabel && <span className="text-sm font-medium">{label}</span>}
      {!hideLabel && isSystem && <Monitor className="h-3 w-3 ml-auto opacity-50" />}
    </button>
  );
}

