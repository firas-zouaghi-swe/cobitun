"use client";

import React from 'react';
import { useTranslation } from 'react-i18next';
import useAuth, { Roles } from '@/hooks/use-auth';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { ShieldAlert } from 'lucide-react';

function isAllowedRole(userRole: string | undefined, roles?: string[]) {
  if (!roles || roles.length === 0) return true;
  if (!userRole) return false;

  // SUPER_ADMIN should be allowed wherever ADMIN access is required.
  if (roles.includes(Roles.ADMIN) && userRole === Roles.SUPER_ADMIN) return true;
  return roles.includes(userRole);
}

export function Protected({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { t } = useTranslation('common');
  const { user, isAuthenticated } = useAuth();
  const hydrated = useAppStore((s) => s.hydrated);
  const setCurrentPage = useAppStore((s) => s.setCurrentPage);

  React.useEffect(() => {
    if (!hydrated) return;

    if (!isAuthenticated) {
      const loginPage = roles
        ? (roles.includes(Roles.ADMIN) || roles.includes(Roles.SUPER_ADMIN)) && !roles.includes(Roles.CUSTOMER)
          ? 'admin-login'
          : 'customer-login'
        : 'customer-login';
      setCurrentPage(loginPage);
    }
  }, [hydrated, isAuthenticated, roles, setCurrentPage]);

  React.useEffect(() => {
    if (!hydrated || !isAuthenticated) return;
    if (!roles || roles.length === 0) return;

    const allowed = isAllowedRole(user?.role, roles);
    if (!allowed) {
      const loginPage = (roles.includes(Roles.ADMIN) || roles.includes(Roles.SUPER_ADMIN)) && !roles.includes(Roles.CUSTOMER)
        ? 'admin-login'
        : 'home';
      setCurrentPage(loginPage);
    }
  }, [hydrated, isAuthenticated, roles, user?.role, setCurrentPage]);

  if (!hydrated || !isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-64" role="status" aria-label={t('action.loading')}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (roles && roles.length > 0) {
    const allowed = isAllowedRole(user?.role, roles);
    if (!allowed) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 p-8 text-center" role="alert">
          <div className="bg-destructive/10 w-16 h-16 rounded-2xl flex items-center justify-center">
            <ShieldAlert className="h-8 w-8 text-destructive" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-foreground">{t('error.accessDenied')}</h2>
            <p className="text-muted-foreground text-sm">{t('error.noPermission', 'You do not have permission to view this page.')}</p>
          </div>
          <Button variant="outline" onClick={() => setCurrentPage('home')}>
            {t('nav.backToHome')}
          </Button>
        </div>
      );
    }
  }

  return <>{children}</>;
}

export default Protected;
