"use client";

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/lib/store';
import { initFetchInterceptor } from '@/lib/initFetchInterceptor';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation('common');
  const storeHydrated = useAppStore((s) => s.hydrated);
  const [ready, setReady] = useState(false);

  // Wait for both the store rehydration and the fetch interceptor init
  useEffect(() => {
    initFetchInterceptor();
    // Use requestAnimationFrame to ensure the interceptor is set up before first render
    // This avoids the unmount/remount cycle that breaks React DevTools port
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  if (!ready || !storeHydrated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" aria-label={t('action.loading')} role="status" />
      </div>
    );
  }

  return <>{children}</>;
}

export default AuthProvider;

