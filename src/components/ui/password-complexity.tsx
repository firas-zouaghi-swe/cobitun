'use client';

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Password complexity rules — configurable via env vars or defaults.
 */
interface PasswordRule {
  key: string;           // i18n key under 'validation.password'
  test: (pw: string) => boolean;
  enabled: boolean;
}

const DEFAULT_RULES: PasswordRule[] = [
  { key: 'minLength', test: (pw) => pw.length >= 8, enabled: true },
  { key: 'uppercase', test: (pw) => /[A-Z]/.test(pw), enabled: true },
  { key: 'lowercase', test: (pw) => /[a-z]/.test(pw), enabled: true },
  { key: 'number', test: (pw) => /\d/.test(pw), enabled: true },
  { key: 'specialChar', test: (pw) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pw), enabled: true },
];

/** Common password patterns to warn about */
const COMMON_PASSWORDS = [
  'password', 'password1', 'password123', '12345678', 'qwerty12',
  'abc12345', 'letmein1', 'welcome1', 'admin123', 'iloveyou1',
];

interface PasswordComplexityIndicatorProps {
  password: string;
  className?: string;
  minLength?: number;
}

/**
 * PasswordComplexityIndicator — real-time validation checklist below password field.
 * Shows green check / red x for each rule.
 * Warns if password is common (non-blocking).
 */
export function PasswordComplexityIndicator({
  password,
  className,
  minLength,
}: PasswordComplexityIndicatorProps) {
  const { t } = useTranslation('common');

  if (!password) return null;

  const rules = DEFAULT_RULES.map((rule) => {
    if (rule.key === 'minLength' && minLength) {
      return { ...rule, test: (pw: string) => pw.length >= minLength };
    }
    return rule;
  }).filter((r) => r.enabled);

  const isCommon = COMMON_PASSWORDS.some(
    (cp) => password.toLowerCase() === cp || password.toLowerCase().startsWith(cp)
  );

  const allPassed = rules.every((r) => r.test(password));

  return (
    <div className={cn('space-y-1 mt-2', className)} role="status" aria-live="polite">
      {rules.map((rule) => {
        const passed = rule.test(password);
        return (
          <div
            key={rule.key}
            className={cn(
              'flex items-center gap-1.5 text-xs transition-colors duration-200',
              passed ? 'text-green-600 dark:text-green-400' : 'text-destructive'
            )}
          >
            {passed ? (
              <Check className="h-3 w-3 flex-shrink-0" />
            ) : (
              <X className="h-3 w-3 flex-shrink-0" />
            )}
            {t(`validation.password.${rule.key}`, rule.key)}
          </div>
        );
      })}
      {isCommon && !allPassed && (
        <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 mt-1">
          <span aria-hidden="true">⚠</span>
          {t('validation.password.commonWarning', 'This password is commonly used. Consider choosing a stronger one.')}
        </div>
      )}
    </div>
  );
}

/**
 * Checks if a password meets all complexity requirements.
 * Returns { valid: boolean, errors: string[] } with i18n keys for failed rules.
 */
export function validatePasswordComplexity(
  password: string,
  minLength: number = 8
): { valid: boolean; failedRules: string[] } {
  const rules = DEFAULT_RULES.map((rule) => {
    if (rule.key === 'minLength') {
      return { ...rule, test: (pw: string) => pw.length >= minLength };
    }
    return rule;
  }).filter((r) => r.enabled);

  const failedRules = rules.filter((r) => !r.test(password)).map((r) => r.key);
  return { valid: failedRules.length === 0, failedRules };
}
