'use client';

import { useAppStore } from '@/lib/store';
import Protected from '@/components/Protected';
import { Roles } from '@/hooks/use-auth';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import ChangePasswordForm from '@/components/ui/ChangePasswordForm';
import { PageLoadingState } from '@/components/shared/PageStates';
import { Shield, Mail } from 'lucide-react';

export default function AccountSettingsPage() {
  const { user } = useAppStore();
  const { t } = useTranslation('common');

  if (!user) {
    return (
      <Protected roles={[Roles.ADMIN, Roles.CUSTOMER]}>
        <PageLoadingState />
      </Protected>
    );
  }

  return (
    <Protected roles={[Roles.ADMIN, Roles.CUSTOMER]}>
      <div className="space-y-6 page-enter">
        <div className="animate-fade-in-down">
          <h1 className="text-2xl font-bold mb-1">{t('accountSettings', { defaultValue: 'Account Settings' })}</h1>
          <p className="text-muted-foreground text-sm">{t('accountSettingsDescription', { defaultValue: 'Secure your account and review your profile details in one central place.' })}</p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
          <Card className="animate-fade-in-up">
            <CardContent className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="rounded-2xl bg-slate-100 dark:bg-slate-900 p-3">
                  <Shield className="h-6 w-6 text-slate-700 dark:text-slate-200" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{t('profileDetails', { defaultValue: 'Profile details' })}</p>
                  <p className="text-sm text-muted-foreground">{t('profileDetailsDescription', { defaultValue: 'Your account information and role-based access' })}</p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-[0.2em] mb-2">{t('name', { defaultValue: 'Name' })}</p>
                  <p className="font-medium">{user?.firstName} {user?.lastName}</p>
                </div>
                <div className="rounded-xl border border-border p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-[0.2em] mb-2">{t('email', { defaultValue: 'Email' })}</p>
                  <p className="font-medium">{user?.email ?? t('notAvailable', { defaultValue: 'Not available' })}</p>
                </div>
                <div className="rounded-xl border border-border p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-[0.2em] mb-2">{t('role', { defaultValue: 'Role' })}</p>
                  <p className="font-medium">{user?.role}</p>
                </div>
                <div className="rounded-xl border border-border p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-[0.2em] mb-2">{t('username', { defaultValue: 'Username' })}</p>
                  <p className="font-medium">{user?.username}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="animate-fade-in-up">
            <CardContent className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="rounded-2xl bg-slate-100 dark:bg-slate-900 p-3">
                  <Mail className="h-6 w-6 text-slate-700 dark:text-slate-200" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{t('security', { defaultValue: 'Security' })}</p>
                  <p className="text-sm text-muted-foreground">{t('securityDescription', { defaultValue: 'Change your password securely anytime.' })}</p>
                </div>
              </div>

              <ChangePasswordForm />
            </CardContent>
          </Card>
        </div>
      </div>
    </Protected>
  );
}

