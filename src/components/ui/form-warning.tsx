'use client';

import * as React from 'react';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * FormWarning — displays a non-blocking advisory message below a form field.
 * Styled in yellow/orange to distinguish from error (red) messages.
 * Does NOT block form submission.
 */
interface FormWarningProps {
  className?: string;
  children?: React.ReactNode;
  id?: string;
}

export function FormWarning({ className, children, id }: FormWarningProps) {
  if (!children) return null;

  return (
    <p
      id={id}
      role="status"
      className={cn(
        'flex items-center gap-1.5 text-sm mt-1 text-amber-600 dark:text-amber-400 transition-all duration-200',
        className
      )}
    >
      <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
      {children}
    </p>
  );
}

/**
 * FieldError — displays a validation error message below a form field.
 * Consistent styling with aria-describedby support.
 */
interface FieldErrorProps {
  className?: string;
  children?: React.ReactNode;
  id?: string;
}

export function FieldError({ className, children, id }: FieldErrorProps) {
  if (!children) return null;

  return (
    <p
      id={id}
      role="alert"
      className={cn('text-destructive text-sm mt-1 transition-all duration-200', className)}
    >
      {children}
    </p>
  );
}

/**
 * FieldHint — displays a hint/example below a form field.
 * Styled in muted color, not blocking.
 */
interface FieldHintProps {
  className?: string;
  children?: React.ReactNode;
  id?: string;
}

export function FieldHint({ className, children, id }: FieldHintProps) {
  if (!children) return null;

  return (
    <p
      id={id}
      className={cn('text-muted-foreground text-xs mt-1', className)}
    >
      {children}
    </p>
  );
}

/**
 * CharCounter — shows a live character counter for inputs with maxLength.
 * Turns yellow when approaching limit, red when at/exceeding limit.
 */
interface CharCounterProps {
  current: number;
  max: number;
  className?: string;
}

export function CharCounter({ current, max, className }: CharCounterProps) {
  const pct = current / max;
  const colorClass =
    pct >= 1
      ? 'text-destructive'
      : pct >= 0.9
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-muted-foreground';

  return (
    <span className={cn('text-xs mt-0.5 block text-end', colorClass, className)}>
      {current}/{max}
    </span>
  );
}

/**
 * RequiredIndicator — renders a red asterisk for required fields.
 */
interface RequiredIndicatorProps {
  className?: string;
}

export function RequiredIndicator({ className }: RequiredIndicatorProps) {
  return (
    <span className={cn('text-destructive ms-0.5', className)} aria-hidden="true">
      *
    </span>
  );
}
