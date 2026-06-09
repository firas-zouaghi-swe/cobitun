'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Mail, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/lib/store';
import { FieldError, RequiredIndicator } from '@/components/ui/form-warning';

export default function ForgotPasswordPage() {
  const { t } = useTranslation(['auth', 'common']);
  const { setCurrentPage, goBack } = useAppStore();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const startCooldown = () => {
    setCooldownSeconds(60);
  };

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = setTimeout(() => setCooldownSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldownSeconds]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setFieldErrors({ email: t('common:validation.required') });
      toast.error(t('common:errors.fillAllFields'));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFieldErrors({ email: t('common:validation.email.invalid') });
      toast.error(t('common:errors.fillAllFields'));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || t('auth:toast.forgotPasswordFailed'));
        return;
      }
      setSubmitted(true);
      startCooldown();
      toast.success(t('auth:toast.forgotPasswordSent'));
    } catch (error) {
      console.error('Forgot password submit failed:', error);
      toast.error(t('common:errors.somethingWrong'));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = () => {
    if (cooldownSeconds > 0) {
      toast.warning(t('common:mfa.cooldownWarning'));
      return;
    }
    setSubmitted(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-tunis-blue-light to-tunis-blue flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.06] pointer-events-none">
        <div className="absolute top-20 start-20 w-80 h-80 bg-tunis-orange rounded-full blur-3xl" />
        <div className="absolute bottom-20 end-20 w-64 h-64 bg-white rounded-full blur-3xl" />
      </div>
      <Card className="w-full max-w-md shadow-2xl relative z-10 border-tunis-blue/10">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-tunis-blue-light to-tunis-blue rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-tunis-blue/20">
            <Mail className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold text-foreground">{t('auth:forgotPassword.title', 'Forgot password?')}</CardTitle>
          <CardDescription>{t('auth:forgotPassword.subtitle', 'Enter the email associated with your account and we will send you a reset link.')}</CardDescription>
        </CardHeader>
        <CardContent>
          {submitted ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                {t('auth:forgotPassword.confirmation', 'If an account exists for that email, a password reset link has been sent.')}
              </p>
              <Button
                variant="tunis"
                className="w-full"
                onClick={handleResend}
                disabled={cooldownSeconds > 0}
                aria-live="polite"
              >
                {cooldownSeconds > 0
                  ? t('common:mfa.resendIn', { seconds: cooldownSeconds })
                  : t('auth:forgotPassword.resendLink', 'Resend reset link')}
              </Button>
              <Button variant="outline" className="w-full" onClick={() => goBack()}>
                {t('auth:forgotPassword.backToLogin', 'Back to previous page')}
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t('common:label.email')}<RequiredIndicator /></Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t('common:label.emailPlaceholder')}
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); if (fieldErrors.email) setFieldErrors((prev) => { const next = { ...prev }; delete next.email; return next; }); }}
                  onBlur={() => {
                    if (!email.trim()) setFieldErrors((prev) => ({ ...prev, email: t('common:validation.required') }));
                    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) setFieldErrors((prev) => ({ ...prev, email: t('common:validation.email.invalid') }));
                  }}
                  className="focus-visible:ring-tunis-blue/30"
                  aria-invalid={!!fieldErrors.email}
                  aria-describedby={fieldErrors.email ? 'email-error' : undefined}
                />
                <FieldError id="email-error">{fieldErrors.email}</FieldError>
              </div>
              <Button type="submit" variant="tunis" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
                {loading ? t('common:action.sending') : t('auth:forgotPassword.sendLink', 'Send reset link')}
              </Button>
              <button
                type="button"
                onClick={() => goBack()}
                className="flex items-center justify-center gap-2 w-full text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                <ArrowLeft className="h-4 w-4" /> {t('auth:forgotPassword.backToLogin', 'Back to previous page')}
              </button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
