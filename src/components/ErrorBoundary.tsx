'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

function ErrorFallback({ error, onRetry }: { error: Error | null; onRetry: () => void }) {
  const { t } = useTranslation('common');
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center" role="alert">
      <div className="bg-destructive/10 p-4 rounded-full mb-4">
        <AlertCircle className="h-10 w-10 text-destructive" />
      </div>
      <h2 className="text-xl font-semibold text-foreground mb-2">
        {t('errors.somethingWrong', 'Something went wrong')}
      </h2>
      <p className="text-muted-foreground text-sm max-w-md mb-6">
        {error?.message || t('errors.unexpectedError', 'An unexpected error occurred. Please try again.')}
      </p>
      <Button
        onClick={onRetry}
        variant="outline"
        className="gap-2"
      >
        <RefreshCw className="h-4 w-4" />
        {t('action.retry', 'Try Again')}
      </Button>
    </div>
  );
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return <ErrorFallback error={this.state.error} onRetry={this.handleRetry} />;
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
