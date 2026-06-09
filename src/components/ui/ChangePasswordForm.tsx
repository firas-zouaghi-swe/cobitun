'use client';

import { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { fetchWithAuth } from '@/hooks/use-auth';
import { PasswordComplexityIndicator, validatePasswordComplexity } from '@/components/ui/password-complexity';
import { FieldError, RequiredIndicator } from '@/components/ui/form-warning';

export default function ChangePasswordForm() {
  const { t } = useTranslation(['auth', 'common']);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error(t('auth:changePassword.passwordsMismatch'));
      return;
    }

    const { valid } = validatePasswordComplexity(newPassword);
    if (!valid) {
      toast.error(t('common:validation.password.complexity'));
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetchWithAuth('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });

      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || t('auth:changePassword.changeFailed'));
        return;
      }

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success(data.message || t('auth:changePassword.changeSuccess'));
    } catch (err) {
      console.error('Change password submit error:', err);
      toast.error(t('auth:changePassword.unableToChange'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="border-slate-200/70 dark:border-slate-700/70">
      <CardContent className="space-y-4 p-6">
        <div>
          <h3 className="text-lg font-semibold">{t('auth:changePassword.title')}</h3>
          <p className="text-sm text-muted-foreground">{t('auth:changePassword.subtitle')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="currentPassword">{t('auth:changePassword.currentPassword')}<RequiredIndicator /></Label>
            <Input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              placeholder={t('auth:changePassword.currentPasswordPlaceholder')}
              required
            />
          </div>

          <div>
            <Label htmlFor="newPassword">{t('auth:changePassword.newPassword')}<RequiredIndicator /></Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder={t('auth:changePassword.newPasswordPlaceholder')}
              required
            />
            <PasswordComplexityIndicator password={newPassword} />
          </div>

          <div>
            <Label htmlFor="confirmPassword">{t('auth:changePassword.confirmNewPassword')}<RequiredIndicator /></Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder={t('auth:changePassword.confirmNewPasswordPlaceholder')}
              required
            />
            {confirmPassword && newPassword !== confirmPassword && (
              <FieldError>{t('auth:changePassword.passwordsMismatch')}</FieldError>
            )}
          </div>

          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? t('auth:changePassword.updating') : t('auth:changePassword.updateButton')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
