'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from '@/components/ui/input-otp';
import { useAppStore } from '@/lib/store';
import { Roles } from '@/hooks/use-auth';
import { User, ArrowLeft, Loader2, Mail, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { FieldError, RequiredIndicator } from '@/components/ui/form-warning';

interface MfaState {
  userId: number;
  preAuthToken: string;
  method: string;
}

export default function CustomerLoginPage() {
  const { t } = useTranslation(['auth', 'common']);
  const { login, setCurrentPage } = useAppStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [mfaState, setMfaState] = useState<MfaState | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const validateField = (field: string, value: string, rules?: { required?: boolean; minLength?: number }) => {
    const errors: Record<string, string> = { ...fieldErrors };
    if (rules?.required && !value.trim()) {
      errors[field] = t('common:validation.required');
    } else if (rules?.minLength && value.length < rules.minLength) {
      errors[field] = t('common:validation.minLength', { count: rules.minLength });
    } else {
      delete errors[field];
    }
    setFieldErrors(errors);
    return !errors[field];
  };

  const clearFieldError = (field: string) => {
    if (fieldErrors[field]) {
      setFieldErrors((prev) => { const next = { ...prev }; delete next[field]; return next; });
    }
  };

  const startCooldown = () => {
    setCooldownSeconds(60);
  };

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = setTimeout(() => setCooldownSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldownSeconds]);

  const completeLogin = (userData: { id: number; username: string; firstName: string; lastName: string; email?: string | null; role: string; customerId?: number }) => {
    const user = {
      ...userData,
      id: Number(userData.id),
      customerId: userData.customerId ? Number(userData.customerId) : undefined,
    };
    login(user);
    setCurrentPage('customer-dashboard');
    toast.success(t('auth:toast.welcomeBack'));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error(t('common:errors.fillAllFields'));
      // Show field-level errors too
      if (!username) validateField('username', username, { required: true });
      if (!password) validateField('password', password, { required: true });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || t('auth:toast.loginFailed'));
        return;
      }

      // Handle MFA challenge
      if (data.mfaRequired) {
        setMfaState({
          userId: data.userId,
          preAuthToken: data.preAuthToken,
          method: data.method,
        });
        // Automatically send OTP challenge
        try {
          const challengeRes = await fetch('/api/auth/mfa/challenge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: data.userId, preAuthToken: data.preAuthToken }),
          });
          const challengeData = await challengeRes.json();
          if (!challengeRes.ok) {
            // Show the error but keep MFA state so user can retry
            // Rate-limit errors (MFA_CHALLENGE_FAILED) are temporary
            toast.error(challengeData.error || challengeData.message || t('auth:mfa.sendFailed'));
            if (challengeData.code !== 'MFA_CHALLENGE_FAILED') {
              setMfaState(null);
              return;
            }
            // Rate limited — still show OTP form, user can resend after cooldown
            return;
          }
          setOtpSent(true);
          startCooldown();
          toast.success(challengeData.message || t('auth:mfa.codeSent'));
        } catch {
          toast.error(t('auth:mfa.sendFailed'));
          // Keep MFA state so user can retry
        }
        return;
      }

      if (data.user.role !== Roles.CUSTOMER) {
        toast.error(t('auth:toast.customersOnly'));
        return;
      }
      completeLogin(data.user);
    } catch {
      toast.error(t('common:errors.somethingWrong'));
    } finally {
      setLoading(false);
    }
  };

  const handleOtpVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaState || otpCode.length !== 6) {
      toast.error(t('auth:mfa.enterCode'));
      return;
    }
    setOtpLoading(true);
    try {
      const res = await fetch('/api/auth/mfa/verify', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'x-pre-auth-token': mfaState.preAuthToken,
        },
        body: JSON.stringify({
          code: otpCode,
          purpose: 'login',
          userId: mfaState.userId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || data.message || t('auth:mfa.invalidCode'));
        return;
      }
      // MFA verified — data.user contains the full user object
      if (data.user) {
        if (data.user.role !== Roles.CUSTOMER) {
          toast.error(t('auth:toast.customersOnly'));
          return;
        }
        completeLogin(data.user);
      }
    } catch {
      toast.error(t('auth:mfa.verificationFailed'));
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!mfaState) return;
    setOtpLoading(true);
    try {
      const res = await fetch('/api/auth/mfa/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: mfaState.userId, preAuthToken: mfaState.preAuthToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || data.message || t('auth:mfa.resendFailed'));
        return;
      }
      toast.success(data.message || t('auth:mfa.newCodeSent'));
      startCooldown();
    } catch {
      toast.error(t('auth:mfa.resendFailed'));
    } finally {
      setOtpLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-tunis-blue-light to-tunis-blue flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.06]">
        <div className="absolute top-20 start-20 w-80 h-80 bg-tunis-orange rounded-full blur-3xl" />
        <div className="absolute bottom-20 end-20 w-64 h-64 bg-white rounded-full blur-3xl" />
      </div>
      <Card className="w-full max-w-md shadow-2xl relative z-10 border-tunis-blue/10">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-tunis-blue-light to-tunis-blue rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-tunis-blue/20">
            {mfaState ? <Mail className="w-8 h-8 text-white" /> : <User className="w-8 h-8 text-white" />}
          </div>
          <CardTitle className="text-2xl font-bold text-foreground">
            {mfaState ? t('auth:mfa.title') : t('auth:customerLogin.title')}
          </CardTitle>
          <CardDescription>
            {mfaState
              ? t('auth:mfa.description')
              : t('auth:customerLogin.subtitle')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {mfaState ? (
            <form onSubmit={handleOtpVerify} className="space-y-6">
              <div className="flex flex-col items-center space-y-4">
                <InputOTP
                  maxLength={6}
                  value={otpCode}
                  onChange={setOtpCode}
                  disabled={otpLoading}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                  </InputOTPGroup>
                  <InputOTPSeparator />
                  <InputOTPGroup>
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
                <p className="text-sm text-muted-foreground text-center">
                  {t('auth:mfa.codeHint')}
                </p>
              </div>
              <Button type="submit" variant="tunis" className="w-full" disabled={otpLoading || otpCode.length !== 6}>
                {otpLoading ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
                {otpLoading ? t('auth:mfa.verifying') : t('auth:mfa.verifyButton')}
              </Button>
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={cooldownSeconds > 0 ? () => toast.warning(t('common:mfa.cooldownWarning')) : handleResendOtp}
                  disabled={otpLoading || cooldownSeconds > 0}
                  className="text-sm text-primary hover:underline font-medium disabled:opacity-50"
                  aria-live="polite"
                >
                  {cooldownSeconds > 0
                    ? t('common:mfa.resendIn', { seconds: cooldownSeconds })
                    : t('common:mfa.resendAvailable')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMfaState(null);
                    setOtpCode('');
                    setOtpSent(false);
                    setCooldownSeconds(0);
                  }}
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  {t('auth:mfa.backToLogin')}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">{t('common:label.username')}<RequiredIndicator /></Label>
                <Input
                  id="username"
                  autoComplete="username"
                  placeholder={t('common:label.usernamePlaceholder')}
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); clearFieldError('username'); }}
                  onBlur={() => validateField('username', username, { required: true })}
                  aria-invalid={!!fieldErrors.username}
                  aria-describedby={fieldErrors.username ? 'username-error' : undefined}
                  className="focus-visible:ring-tunis-blue/30"
                />
                <FieldError id="username-error">{fieldErrors.username}</FieldError>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t('common:label.password')}<RequiredIndicator /></Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder={t('common:label.passwordPlaceholder')}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); clearFieldError('password'); }}
                    onBlur={() => validateField('password', password, { required: true })}
                    aria-invalid={!!fieldErrors.password}
                    aria-describedby={fieldErrors.password ? 'password-error' : undefined}
                    className="focus-visible:ring-tunis-blue/30 pe-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showPassword ? t('common:action.hidePassword', 'Hide password') : t('common:action.showPassword', 'Show password')}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <FieldError id="password-error">{fieldErrors.password}</FieldError>
              </div>
              <Button type="submit" variant="tunis" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
                {loading ? t('common:action.signingIn') : t('common:action.signIn')}
              </Button>
            </form>
          )}
          <div className="space-y-3 text-center mt-4">
            {!mfaState && (
              <>
                <div>
                  <span className="text-sm text-muted-foreground">{t('auth:signup.noAccount')} </span>
                  <button
                    onClick={() => setCurrentPage('customer-signup')}
                    className="text-sm text-primary hover:underline font-medium"
                  >
                    {t('common:action.signUp')}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setCurrentPage('forgot-password')}
                  className="text-sm text-primary hover:underline font-medium"
                >
                  {t('auth:forgotPassword.link', 'Forgot password?')}
                </button>
              </>
            )}
          </div>
          {!mfaState && (
            <button
              onClick={() => setCurrentPage('home')}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mt-4 mx-auto transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> {t('common:nav.backToHome')}
            </button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

