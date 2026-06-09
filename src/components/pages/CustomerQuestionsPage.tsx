'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/lib/store';
import { toast } from 'sonner';
import { formatDate } from '@/lib/i18n';
import { MessageSquare, Send, Loader2 } from 'lucide-react';
import { PageLoadingState, PageErrorState, PageEmptyState } from '@/components/shared/PageStates';
import { fetchWithAuth } from '@/hooks/use-auth';

interface CustomerQuestion {
  id: number;
  description: string;
  adminComment: string;
  statusCode: string;
  statusName: string;
  createdAt: string;
}

export default function CustomerQuestionsPage() {
  const { t } = useTranslation(['common', 'customerQuestions']);
  const { user } = useAppStore();
  const [questions, setQuestions] = useState<CustomerQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user?.id) fetchQuestions();
  }, [user?.id]);

  const fetchQuestions = async () => {
    setLoading(true);
    setError(null);
    try {
      const endpoint = '/api/customer/questions';
      const res = await fetchWithAuth(endpoint, { method: 'GET' });
      if (!res.ok) throw new Error('Failed to load questions');
      const data = await res.json();
      setQuestions(data.questions || []);
    } catch (err) {
      console.error('Failed to fetch questions:', err);
      setError(t('common:errors.failedToLoad', 'Failed to load questions. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedDescription = description.trim();
    if (!trimmedDescription) {
      toast.error(t('customerQuestions:toast.enterQuestion'));
      return;
    }
    if (!user?.customerId) return;
    setSubmitting(true);
    try {
      const res = await fetchWithAuth('/api/customer/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: user.customerId, description: trimmedDescription }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || t('customerQuestions:toast.submitFailed'));
        return;
      }
      toast.success(t('customerQuestions:toast.submitSuccess'));
      setDescription('');
      fetchQuestions();
    } catch {
      toast.error(t('customerQuestions:toast.somethingWentWrong'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t('customerQuestions:title')}</h1>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Submit Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              {t('customerQuestions:form.title')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="question-input">{t('customerQuestions:form.yourQuestion')}</Label>
                <Textarea
                  id="question-input"
                  placeholder={t('customerQuestions:form.placeholder')}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                />
              </div>
              <Button type="submit" variant="tunis" className="w-full" disabled={submitting}>
                {submitting ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Send className="me-2 h-4 w-4" />}
                {submitting ? t('customerQuestions:form.submitting') : t('customerQuestions:form.submitQuestion')}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Questions History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              {t('customerQuestions:history.title')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <PageLoadingState message={t('customerQuestions:loading', 'Loading questions…')} />
            ) : error ? (
              <PageErrorState message={error} onRetry={fetchQuestions} />
            ) : questions.length === 0 ? (
              <PageEmptyState
                icon={<MessageSquare className="h-8 w-8 text-muted-foreground" />}
                title={t('customerQuestions:history.empty')}
                description={t('customerQuestions:history.emptyDesc', 'You have not submitted any questions yet.')}
              />
            ) : (
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {questions.map((question) => (
                  <div key={question.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <p className="text-sm font-medium">{question.description}</p>
                      <Badge variant="secondary" className="text-xs shrink-0 ms-2" title={formatDate(question.createdAt)}>
                        {formatDate(question.createdAt)}
                      </Badge>
                    </div>
                    <div className="mt-2 pt-2 border-t border-border">
                      <p className="text-xs text-muted-foreground mb-1">{t('customerQuestions:history.adminResponse')}</p>
                      {!question.adminComment || question.adminComment.trim() === '' ? (
                        <Badge variant="outline" className="text-orange-600 border-orange-300 dark:text-orange-400 dark:border-orange-700 text-xs" title={t('customerQuestions:history.notAnsweredYet')}>
                          {t('customerQuestions:history.notAnsweredYet')}
                        </Badge>
                      ) : (
                        <p className="text-sm text-green-700 dark:text-green-300">{question.adminComment}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

