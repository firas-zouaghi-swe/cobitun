'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';

interface PageErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function PageErrorState({ message, onRetry }: PageErrorStateProps) {
  const { t } = useTranslation('common');

  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4 animate-fade-in-up" role="alert">
      <div className="bg-destructive/10 w-16 h-16 rounded-2xl flex items-center justify-center">
        <AlertTriangle className="h-8 w-8 text-destructive" />
      </div>
      <div className="text-center space-y-1">
        <p className="font-medium text-foreground">{t('errors.somethingWrong', 'Something went wrong')}</p>
        <p className="text-muted-foreground text-sm">{message || t('errors.failedToLoad', 'Failed to load data. Please try again.')}</p>
      </div>
      {onRetry && (
        <Button variant="tunis" onClick={onRetry} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          {t('action.retry', 'Retry')}
        </Button>
      )}
    </div>
  );
}

interface PageEmptyStateProps {
  icon?: React.ReactNode;
  title?: string;
  description?: string;
}

export function PageEmptyState({ icon, title, description }: PageEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-4 animate-fade-in-up" role="status">
      {icon && <div className="bg-muted w-16 h-16 rounded-2xl flex items-center justify-center">{icon}</div>}
      {title && <p className="text-muted-foreground font-medium">{title}</p>}
      {description && <p className="text-muted-foreground text-sm">{description}</p>}
    </div>
  );
}

interface PageLoadingStateProps {
  message?: string;
}

export function PageLoadingState({ message }: PageLoadingStateProps) {
  const { t } = useTranslation('common');

  return (
    <div className="flex flex-col items-center justify-center h-64 gap-3" role="status" aria-label={t('action.loading')}>
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      {message && <p className="text-muted-foreground text-sm">{message}</p>}
    </div>
  );
}

