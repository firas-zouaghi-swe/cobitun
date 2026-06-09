'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, KeyRound, Loader2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/lib/store';
import { PasswordComplexityIndicator, validatePasswordComplexity } from '@/components/ui/password-complexity';
import { FieldError, RequiredIndicator } from '@/components/ui/form-warning';

export default function ResetPasswordPage() {
  const { t } = useTranslation(['auth', 'common']);
  const searchParams = useSearchParams();
  const { setCurrentPage, goBack } = useAppStore();
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const clearFieldError = (field: string) => {
    if (fieldErrors[field]) {
      setFieldErrors((prev) => { const next = { ...prev }; delete next[field]; return next; });
    }
  };

  useEffect(() => {
    const queryToken = searchParams.get('token');
    if (queryToken) setToken(queryToken);
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newPassword || !confirmPassword) {
      if (!token) setFieldErrors((prev) => ({ ...prev, token: t('common:validation.required') }));
      if (!newPassword) setFieldErrors((prev) => ({ ...prev, newPassword: t('common:validation.required') }));
      if (!confirmPassword) setFieldErrors((prev) => ({ ...prev, confirmPassword: t('common:validation.required') }));
      toast.error(t('common:errors.fillAllFields'));
      return;
    }
    const { valid: passwordValid } = validatePasswordComplexity(newPassword);
    if (!passwordValid) {
      toast.error(t('common:validation.password.complexity'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setFieldErrors((prev) => ({ ...prev, confirmPassword: t('common:validation.password.mismatch') }));
      toast.error(t('auth:toast.passwordsMismatch'));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword, confirmPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || t('auth:toast.resetPasswordFailed'));
        return;
      }
      setSuccess(true);
      toast.success(t('auth:toast.resetPasswordSuccess'));
    } catch (error) {
      console.error('Reset password submit failed:', error);
      toast.error(t('common:errors.somethingWrong'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-tunis-blue to-tunis-blue-light flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.06] pointer-events-none">
        <div className="absolute top-20 start-20 w-80 h-80 bg-tunis-orange rounded-full blur-3xl" />
        <div className="absolute bottom-20 end-20 w-64 h-64 bg-white rounded-full blur-3xl" />
      </div>
      <Card className="w-full max-w-md shadow-2xl relative z-10 border-tunis-blue/10">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-tunis-blue to-tunis-blue-dark rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-tunis-blue/20">
            <KeyRound className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold text-foreground">{t('auth:resetPassword.title', 'Reset password')}</CardTitle>
          <CardDescription>{t('auth:resetPassword.subtitle', 'Choose a new secure password for your account.')}</CardDescription>
        </CardHeader>
        <CardContent>
          {success ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">{t('auth:resetPassword.successMessage', 'Your password has been updated. You may now log in with your new credentials.')}</p>
              <Button variant="tunis" className="w-full" onClick={() => goBack()}>
                {t('auth:resetPassword.backToLogin', 'Back to previous page')}
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="token">{t('auth:resetPassword.tokenLabel', 'Reset token')}<RequiredIndicator /></Label>
                <Input
                  id="token"
                  value={token}
                  onChange={(e) => { setToken(e.target.value); clearFieldError('token'); }}
                  onBlur={() => { if (!token.trim()) setFieldErrors((prev) => ({ ...prev, token: t('common:validation.required') })); }}
                  placeholder={t('auth:resetPassword.tokenPlaceholder', 'Paste your reset token or use the link token')}
                  className="focus-visible:ring-tunis-blue/30"
                  readOnly={!!searchParams.get('token')}
                  aria-invalid={!!fieldErrors.token}
                  aria-describedby={fieldErrors.token ? 'token-error' : undefined}
                />
                <FieldError id="token-error">{fieldErrors.token}</FieldError>
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">{t('common:label.newPassword')}<RequiredIndicator /></Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => { setNewPassword(e.target.value); clearFieldError('newPassword'); }}
                    onBlur={() => { if (!newPassword.trim()) setFieldErrors((prev) => ({ ...prev, newPassword: t('common:validation.required') })); else if (newPassword.length < 8) setFieldErrors((prev) => ({ ...prev, newPassword: t('common:validation.minLength', { count: 8 }) })); }}
                    placeholder={t('common:label.newPasswordPlaceholder')}
                    className="focus-visible:ring-tunis-blue/30 pe-10"
                    aria-invalid={!!fieldErrors.newPassword}
                    aria-describedby={fieldErrors.newPassword ? 'newPassword-error' : undefined}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showNewPassword ? t('common:action.hidePassword', 'Hide password') : t('common:action.showPassword', 'Show password')}
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <PasswordComplexityIndicator password={newPassword} />
                <FieldError id="newPassword-error">{fieldErrors.newPassword}</FieldError>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{t('common:label.confirmPassword')}<RequiredIndicator /></Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); clearFieldError('confirmPassword'); }}
                    onBlur={() => {
                      if (!confirmPassword.trim()) setFieldErrors((prev) => ({ ...prev, confirmPassword: t('common:validation.required') }));
                      else if (newPassword !== confirmPassword) setFieldErrors((prev) => ({ ...prev, confirmPassword: t('common:validation.password.mismatch') }));
                    }}
                    placeholder={t('common:label.confirmPasswordPlaceholder')}
                    className="focus-visible:ring-tunis-blue/30 pe-10"
                    aria-invalid={!!fieldErrors.confirmPassword}
                    aria-describedby={fieldErrors.confirmPassword ? 'confirmPassword-error' : undefined}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showConfirmPassword ? t('common:action.hidePassword', 'Hide password') : t('common:action.showPassword', 'Show password')}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <FieldError id="confirmPassword-error">{fieldErrors.confirmPassword}</FieldError>
              </div>
              <Button type="submit" variant="tunisBlue" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
                {loading ? t('common:action.saving') : t('auth:resetPassword.submit', 'Update password')}
              </Button>
              <button
                type="button"
                onClick={() => goBack()}
                className="flex items-center justify-center gap-2 w-full text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                <ArrowLeft className="h-4 w-4" /> {t('auth:resetPassword.backToLogin', 'Back to previous page')}
              </button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

