'use client';

import { useEffect } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n, { getDirection } from '@/lib/i18n';

function DirectionSync() {
  useEffect(() => {
    const handleLanguageChanged = (lng: string) => {
      const dir = getDirection(lng);
      document.documentElement.dir = dir;
      document.documentElement.lang = lng;
    };

    // Set initial direction
    handleLanguageChanged(i18n.language);

    // Listen for language changes
    i18n.on('languageChanged', handleLanguageChanged);

    return () => {
      i18n.off('languageChanged', handleLanguageChanged);
    };
  }, []);

  return null;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  return (
    <I18nextProvider i18n={i18n}>
      <DirectionSync />
      {children}
    </I18nextProvider>
  );
}

