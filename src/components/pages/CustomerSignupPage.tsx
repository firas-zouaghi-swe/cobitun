'use client';

import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { usePlaceAutocomplete } from '@/hooks/use-place-autocomplete';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppStore } from '@/lib/store';
import { UserPlus, ArrowLeft, Loader2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { PasswordComplexityIndicator, validatePasswordComplexity } from '@/components/ui/password-complexity';
import { FieldError, RequiredIndicator } from '@/components/ui/form-warning';

export default function CustomerSignupPage() {
  const { t } = useTranslation(['auth', 'common']);
  const { login, setCurrentPage } = useAppStore();
  const [form, setForm] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    email: '',
    companyName: '',
    mobile: '',
    address: '',
  });
  const [loading, setLoading] = useState(false);
  const [signupWarning, setSignupWarning] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
  const addressBlurTimeoutRef = useRef<number | null>(null);
  const { suggestions: addressSuggestions, loading: addressSuggestionsLoading, error: addressSuggestionsError } = usePlaceAutocomplete(form.address);

  const validateField = (field: string, value: string, rules?: { required?: boolean; minLength?: number; maxLength?: number; pattern?: RegExp; patternMessage?: string }) => {
    const errors: Record<string, string> = { ...fieldErrors };
    if (rules?.required && !value.trim()) {
      errors[field] = t('common:validation.required');
    } else if (rules?.minLength && value.length < rules.minLength) {
      errors[field] = t('common:validation.minLength', { count: rules.minLength });
    } else if (rules?.maxLength && value.length > rules.maxLength) {
      errors[field] = t('common:validation.maxLength', { count: rules.maxLength });
    } else if (rules?.pattern && !rules.pattern.test(value)) {
      errors[field] = rules.patternMessage || t('common:validation.email.invalid');
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

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    clearFieldError(field);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { username, password, confirmPassword, firstName, lastName, email, mobile, address, companyName } = form;
    // Validate all fields
    const v1 = validateField('firstName', firstName, { required: true, minLength: 2 });
    const v2 = validateField('lastName', lastName, { required: true, minLength: 2 });
    const v3 = validateField('username', username, { required: true, minLength: 3 });
    const v4 = validateField('email', email, { required: true, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, patternMessage: t('common:validation.email.invalid') });
    const v5 = validateField('password', password, { required: true, minLength: 8 });
    const v6 = validateField('confirmPassword', confirmPassword, { required: true });
    const v7 = validateField('mobile', mobile, { required: true, minLength: 8 });
    const v8 = validateField('address', address, { required: true, minLength: 5 });
    const v9 = validateField('companyName', companyName, { required: true, minLength: 2 });

    if (!v1 || !v2 || !v3 || !v4 || !v5 || !v6 || !v7 || !v8 || !v9) {
      // Focus first field with error
      const firstErrorField = ['firstName', 'lastName', 'username', 'email', 'password', 'confirmPassword', 'mobile', 'address', 'companyName'].find(f => fieldErrors[f] || [!v1 && 'firstName', !v2 && 'lastName', !v3 && 'username', !v4 && 'email', !v5 && 'password', !v6 && 'confirmPassword', !v7 && 'mobile', !v8 && 'address', !v9 && 'companyName'].includes(f));
      if (firstErrorField) document.getElementById(firstErrorField)?.focus();
      return;
    }
    if (password !== confirmPassword) {
      setFieldErrors((prev) => ({ ...prev, confirmPassword: t('common:validation.password.mismatch') }));
      document.getElementById('confirmPassword')?.focus();
      return;
    }
    const { valid, failedRules } = validatePasswordComplexity(password);
    if (!valid) {
      setFieldErrors((prev) => ({ ...prev, password: t('common:validation.password.complexity') }));
      document.getElementById('password')?.focus();
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          username: form.username.trim(),
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
          companyName: form.companyName.trim(),
          address: form.address.trim(),
          mobile: form.mobile.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data?.code === 'FRAUD_BLOCKED') {
          toast.error(t('auth:toast.fraudBlocked') || data.error || 'Account flagged for review');
        } else {
          toast.error(data.error || t('auth:toast.signupFailed'));
        }
        return;
      }

      // If server returned a fraud review warning, surface it to the user and show persistent banner
      if (data?.warning) {
        const msg = `${data.warning} (${data.riskScore ?? 'N/A'})`;
        toast.warning(msg);
        setSignupWarning(msg);
      } else {
        setSignupWarning(null);
      }
      // Ensure v3 numeric IDs are stored as numbers
      const userData = {
        ...data.user,
        id: Number(data.user.id),
        customerId: data.user.customerId ? Number(data.user.customerId) : undefined,
      };
      login(userData);
      toast.success(t('auth:toast.accountCreated'));
    } catch {
      toast.error(t('common:errors.somethingWrong'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-tunis-blue-light to-tunis-blue flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.06] pointer-events-none">
        <div className="absolute top-20 end-20 w-80 h-80 bg-tunis-orange rounded-full blur-3xl" />
        <div className="absolute bottom-20 start-20 w-64 h-64 bg-white rounded-full blur-3xl" />
      </div>
      <Card className="w-full max-w-lg shadow-2xl relative z-10 border-tunis-blue/10">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-tunis-orange to-tunis-orange-light rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-tunis-orange/20">
            <UserPlus className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold text-foreground">{t('auth:signup.title')}</CardTitle>
          <CardDescription>{t('auth:signup.subtitle')}</CardDescription>
        </CardHeader>
        {signupWarning && (
          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 dark:border-yellow-600 text-yellow-800 dark:text-yellow-200">
            <strong>{t('auth:signup.warningTitle') || 'Account under review'}</strong>
            <div className="text-sm mt-1">{signupWarning}</div>
          </div>
        )}
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">{t('auth:signup.firstName')}<RequiredIndicator /></Label>
                <Input
                  id="firstName"
                  placeholder={t('auth:signup.firstNamePlaceholder')}
                  value={form.firstName}
                  onChange={(e) => updateField('firstName', e.target.value)}
                  onBlur={() => validateField('firstName', form.firstName, { required: true, minLength: 2 })}
                  aria-invalid={!!fieldErrors.firstName}
                  aria-describedby={fieldErrors.firstName ? 'firstName-error' : undefined}
                  className="focus-visible:ring-tunis-blue/30"
                />
                <FieldError id="firstName-error">{fieldErrors.firstName}</FieldError>
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">{t('auth:signup.lastName')}<RequiredIndicator /></Label>
                <Input
                  id="lastName"
                  placeholder={t('auth:signup.lastNamePlaceholder')}
                  value={form.lastName}
                  onChange={(e) => updateField('lastName', e.target.value)}
                  onBlur={() => validateField('lastName', form.lastName, { required: true, minLength: 2 })}
                  aria-invalid={!!fieldErrors.lastName}
                  aria-describedby={fieldErrors.lastName ? 'lastName-error' : undefined}
                  className="focus-visible:ring-tunis-blue/30"
                />
                <FieldError id="lastName-error">{fieldErrors.lastName}</FieldError>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">{t('common:label.username')}<RequiredIndicator /></Label>
              <Input
                id="username"
                placeholder={t('auth:signup.usernamePlaceholder')}
                value={form.username}
                onChange={(e) => updateField('username', e.target.value)}
                onBlur={() => validateField('username', form.username, { required: true, minLength: 3 })}
                aria-invalid={!!fieldErrors.username}
                aria-describedby={fieldErrors.username ? 'username-error' : undefined}
                className="focus-visible:ring-tunis-blue/30"
              />
              <FieldError id="username-error">{fieldErrors.username}</FieldError>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t('common:label.email')}<RequiredIndicator /></Label>
              <Input
                id="email"
                type="email"
                placeholder={t('common:label.emailPlaceholder')}
                value={form.email}
                onChange={(e) => updateField('email', e.target.value)}
                onBlur={() => validateField('email', form.email, { required: true, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, patternMessage: t('common:validation.email.invalid') })}
                aria-invalid={!!fieldErrors.email}
                aria-describedby={fieldErrors.email ? 'email-error' : undefined}
                className="focus-visible:ring-tunis-blue/30"
              />
              <FieldError id="email-error">{fieldErrors.email}</FieldError>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="password">{t('common:label.password')}<RequiredIndicator /></Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder={t('auth:signup.passwordPlaceholder')}
                    value={form.password}
                    onChange={(e) => updateField('password', e.target.value)}
                    onBlur={() => validateField('password', form.password, { required: true, minLength: 8 })}
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
                <PasswordComplexityIndicator password={form.password} />
                <FieldError id="password-error">{fieldErrors.password}</FieldError>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{t('auth:signup.confirmPassword')}<RequiredIndicator /></Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder={t('auth:signup.confirmPasswordPlaceholder')}
                    value={form.confirmPassword}
                    onChange={(e) => updateField('confirmPassword', e.target.value)}
                    onBlur={() => {
                      validateField('confirmPassword', form.confirmPassword, { required: true });
                      if (form.confirmPassword && form.password !== form.confirmPassword) {
                        setFieldErrors((prev) => ({ ...prev, confirmPassword: t('common:validation.password.mismatch') }));
                      }
                    }}
                    aria-invalid={!!fieldErrors.confirmPassword}
                    aria-describedby={fieldErrors.confirmPassword ? 'confirmPassword-error' : undefined}
                    className="focus-visible:ring-tunis-blue/30 pe-10"
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
            </div>
            <div className="space-y-2">
              <Label htmlFor="mobile">{t('auth:signup.mobile')}<RequiredIndicator /></Label>
              <Input
                id="mobile"
                placeholder={t('auth:signup.mobilePlaceholder')}
                value={form.mobile}
                onChange={(e) => updateField('mobile', e.target.value)}
                onBlur={() => validateField('mobile', form.mobile, { required: true, minLength: 8 })}
                aria-invalid={!!fieldErrors.mobile}
                aria-describedby={fieldErrors.mobile ? 'mobile-error' : undefined}
                className="focus-visible:ring-tunis-blue/30"
              />
              <FieldError id="mobile-error">{fieldErrors.mobile}</FieldError>
            </div>
            <div className="space-y-2">
              <div className="relative">
                <Label htmlFor="address">{t('auth:signup.address')}<RequiredIndicator /></Label>
                <Input
                  id="address"
                  placeholder={t('auth:signup.addressPlaceholder')}
                  value={form.address}
                  onChange={(e) => {
                    updateField('address', e.target.value);
                    setShowAddressSuggestions(e.target.value.trim().length >= 3);
                  }}
                  onFocus={() => {
                    if (addressBlurTimeoutRef.current) {
                      window.clearTimeout(addressBlurTimeoutRef.current);
                      addressBlurTimeoutRef.current = null;
                    }
                    setShowAddressSuggestions(form.address.trim().length >= 3);
                  }}
                  onBlur={() => {
                    addressBlurTimeoutRef.current = window.setTimeout(() => {
                      setShowAddressSuggestions(false);
                    }, 100);
                    validateField('address', form.address, { required: true, minLength: 5 });
                  }}
                  aria-invalid={!!fieldErrors.address}
                  aria-describedby={fieldErrors.address ? 'address-error' : undefined}
                  className="focus-visible:ring-tunis-blue/30"
                  autoComplete="off"
                />
                <p className="text-xs text-muted-foreground">{t('auth:signup.addressHelper', 'Start typing an address or choose from the suggestions.')}</p>
                {addressSuggestionsLoading && (
                  <p className="text-xs text-muted-foreground mt-1">{t('auth:signup.loadingAddressSuggestions', 'Loading address suggestions…')}</p>
                )}
                {addressSuggestionsError && (
                  <p className="text-xs text-destructive mt-1">{addressSuggestionsError}</p>
                )}
                {addressSuggestions.length > 0 && showAddressSuggestions && (
                  <ul className="absolute z-10 w-full mt-1 overflow-hidden rounded-xl border bg-background shadow-lg">
                    {addressSuggestions.map((suggestion) => (
                      <li
                        key={suggestion.id}
                        className="cursor-pointer px-3 py-2 text-sm text-foreground hover:bg-slate-100 dark:hover:bg-slate-800"
                        onMouseDown={() => {
                          if (addressBlurTimeoutRef.current) {
                            window.clearTimeout(addressBlurTimeoutRef.current);
                            addressBlurTimeoutRef.current = null;
                          }
                          updateField('address', suggestion.displayName);
                          setShowAddressSuggestions(false);
                        }}
                      >
                        {suggestion.displayName}
                      </li>
                    ))}
                  </ul>
                )}
                <FieldError id="address-error">{fieldErrors.address}</FieldError>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyName">{t('auth:signup.companyName') || 'Company Name'}<RequiredIndicator /></Label>
              <Input
                id="companyName"
                placeholder={t('auth:signup.companyNamePlaceholder') || 'Company or Organisation name'}
                value={form.companyName}
                onChange={(e) => updateField('companyName', e.target.value)}
                onBlur={() => validateField('companyName', form.companyName, { required: true, minLength: 2 })}
                aria-invalid={!!fieldErrors.companyName}
                aria-describedby={fieldErrors.companyName ? 'companyName-error' : undefined}
                className="focus-visible:ring-tunis-blue/30"
              />
              <FieldError id="companyName-error">{fieldErrors.companyName}</FieldError>
            </div>
            <Button type="submit" variant="tunis" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
              {loading ? t('common:action.creatingAccount') : t('common:action.createAccount')}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <span className="text-sm text-muted-foreground">{t('auth:signup.hasAccount')} </span>
            <button
              onClick={() => setCurrentPage('customer-login')}
              className="text-sm text-primary hover:underline font-medium"
            >
              {t('common:action.signIn')}
            </button>
          </div>
          <button
            onClick={() => setCurrentPage('home')}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mt-4 mx-auto transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> {t('common:nav.backToHome')}
          </button>
        </CardContent>
      </Card>
    </div>
  );
}

