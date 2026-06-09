'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { MessageSquare, Loader2, Tag, AlertCircle } from 'lucide-react';
import { formatDate } from '@/lib/i18n';
import { useTranslation } from 'react-i18next';
import Protected from '@/components/Protected';
import { fetchWithAuth, Roles } from '@/hooks/use-auth';
import { PageLoadingState, PageErrorState, PageEmptyState } from '@/components/shared/PageStates';
import { FieldError, RequiredIndicator } from '@/components/ui/form-warning';

interface CustomerQuestion {
  id: number;
  category: string;
  subject: string;
  description: string;
  priority: string;
  statusCode: string;
  statusName: string;
  adminComment: string | null;
  createdAt: string;
  customer: {
    id: number;
    user: { firstName: string; lastName: string; username: string };
  };
}

const PRIORITY_STYLES: Record<string, string> = {
  URGENT: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800/30',
  HIGH: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800/30',
  MEDIUM: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800/30',
  LOW: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800/30',
};

const QUESTION_STATUS_STYLES: Record<string, string> = {
  OPEN: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800/30',
  IN_PROGRESS: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800/30',
  RESOLVED: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800/30',
  CLOSED: 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-900/30 dark:text-gray-300 dark:border-gray-800/30',
};

export default function AdminQuestionsPage() {
  const { t } = useTranslation(['adminCommon', 'common']);
  const [questions, setQuestions] = useState<CustomerQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState<CustomerQuestion | null>(null);
  const [adminComment, setAdminComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const clearFieldError = (field: string) => {
    setFieldErrors(prev => {
      const next = {...prev};
      delete next[field];
      return next;
    });
  };

  useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    try {
      const res = await fetchWithAuth('/api/admin/questions');
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.error || `Request failed with status ${res.status}`);
      }
      const data = await res.json();
      setQuestions(data.questions || []);
    } catch (err) {
      console.error('Failed to fetch questions:', err);
      setError(t('errors.failedToLoad', 'Failed to load data'));
    } finally {
      setLoading(false);
    }
  };

  const openAnswerDialog = (question: CustomerQuestion) => {
    setSelectedQuestion(question);
    setAdminComment(question.adminComment || '');
    setFieldErrors({});
    setDialogOpen(true);
  };

  const handleAnswer = async () => {
    if (!selectedQuestion || !adminComment.trim()) {
      setFieldErrors({ adminComment: t('adminCommon:questions.responseRequired') });
      return;
    }
    setSaving(true);
    try {
      const res = await fetchWithAuth('/api/admin/questions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedQuestion.id, adminComment: adminComment.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || t('adminCommon:updateFailed'));
        return;
      }
      toast.success(t('adminCommon:questions.answerSuccess'));
      setDialogOpen(false);
      fetchQuestions();
    } catch {
      toast.error(t('common:error.somethingWentWrong'));
    } finally {
      setSaving(false);
    }
  };

  if (error) {
    return (
      <Protected roles={[Roles.ADMIN, Roles.SUPER_ADMIN]}>
        <PageErrorState message={error} onRetry={fetchQuestions} />
      </Protected>
    );
  }

  if (loading) {
    return (
      <Protected roles={[Roles.ADMIN, Roles.SUPER_ADMIN]}>
        <PageLoadingState message={t('common:loading', 'Loading...')} />
      </Protected>
    );
  }

  return (
    <Protected roles={[Roles.ADMIN, Roles.SUPER_ADMIN]}>

      <div>
      <h1 className="text-2xl font-bold mb-6">{t('adminCommon:questions.title')}</h1>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <caption className="sr-only">{t('adminCommon:questions.title')}</caption>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('adminCommon:questions.customer')}</TableHead>
                  <TableHead>{t('adminCommon:questions.category')}</TableHead>
                  <TableHead>{t('adminCommon:questions.subject')}</TableHead>
                  <TableHead>{t('adminCommon:questions.priority')}</TableHead>
                  <TableHead>{t('adminCommon:questions.status')}</TableHead>
                  <TableHead>{t('adminCommon:questions.adminResponse')}</TableHead>
                  <TableHead>{t('adminCommon:questions.askedOn')}</TableHead>
                  <TableHead className="text-end">{t('common:label.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {questions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-0 border-0">
                      <PageEmptyState
                        icon={<MessageSquare className="h-8 w-8 text-muted-foreground" />}
                        title={t('adminCommon:questions.noQuestions')}
                        description={t('adminCommon:questions.noQuestionsDescription', 'No customer questions have been submitted yet.')}
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  questions.map((question) => (
                    <TableRow key={question.id}>
                      <TableCell className="font-medium">
                        {question.customer.user.firstName} {question.customer.user.lastName}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          <Tag className="h-3 w-3 me-1" />
                          {question.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <div className="flex items-start gap-2">
                          <MessageSquare className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                          <span className="line-clamp-2">{question.subject || question.description}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={PRIORITY_STYLES[question.priority] || PRIORITY_STYLES.MEDIUM} title={question.priority}>
                          {question.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={QUESTION_STATUS_STYLES[question.statusCode] || QUESTION_STATUS_STYLES.OPEN} title={question.statusName || question.statusCode}>
                          {question.statusName || (question.statusCode ?? '').replace(/_/g, ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {question.adminComment ? (
                          <span className="text-sm line-clamp-2">{question.adminComment}</span>
                        ) : (
                          <Badge variant="outline" className="text-orange-600 dark:text-orange-300 border-orange-300 dark:border-orange-800/30" title={t('adminCommon:questions.notAnswered')}>
                            <AlertCircle className="h-3 w-3 me-1" />
                            {t('adminCommon:questions.notAnswered')}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{formatDate(question.createdAt)}</TableCell>
                      <TableCell className="text-end">
                        <Button size="sm" variant="outline" onClick={() => openAnswerDialog(question)}>
                          {t('adminCommon:questions.reply')}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('adminCommon:questions.answerQuestion')}</DialogTitle>
          </DialogHeader>
          {selectedQuestion && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm text-muted-foreground">{t('adminCommon:questions.from', { name: `${selectedQuestion.customer.user.firstName} ${selectedQuestion.customer.user.lastName}` })}</Label>
                {selectedQuestion.category && (
                  <Badge variant="outline" className="ms-2 text-xs">
                    <Tag className="h-3 w-3 me-1" />
                    {selectedQuestion.category}
                  </Badge>
                )}
              </div>
              {selectedQuestion.subject && (
                <div className="text-sm font-medium">{selectedQuestion.subject}</div>
              )}
              <div className="p-3 bg-muted rounded-md text-sm">
                {selectedQuestion.description}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={PRIORITY_STYLES[selectedQuestion.priority] || PRIORITY_STYLES.MEDIUM} title={selectedQuestion.priority}>
                  {t('adminCommon:questions.priority')}: {selectedQuestion.priority}
                </Badge>
                  <Badge variant="outline" className={QUESTION_STATUS_STYLES[selectedQuestion.statusCode] || QUESTION_STATUS_STYLES.OPEN} title={selectedQuestion.statusName || selectedQuestion.statusCode}>
                  {selectedQuestion.statusName || (selectedQuestion.statusCode ?? '').replace(/_/g, ' ')}
                </Badge>
              </div>
              <div className="space-y-2">
                <Label htmlFor="adminComment">
                  {t('adminCommon:questions.yourResponse')} <RequiredIndicator />
                </Label>
                <Textarea
                  id="adminComment"
                  placeholder={t('adminCommon:questions.responsePlaceholder')}
                  value={adminComment}
                  onChange={(e) => { setAdminComment(e.target.value); clearFieldError('adminComment'); }}
                  onBlur={() => { if (!adminComment.trim()) setFieldErrors(prev => ({...prev, adminComment: t('adminCommon:questions.responseRequired') })); }}
                  rows={4}
                  aria-invalid={!!fieldErrors.adminComment}
                  aria-describedby={fieldErrors.adminComment ? 'adminComment-error' : undefined}
                />
                <FieldError id="adminComment-error">{fieldErrors.adminComment}</FieldError>
              </div>
              <Button className="w-full" variant="tunis" onClick={handleAnswer} disabled={saving}>
                {saving ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
                {saving ? t('adminCommon:questions.submitting') : t('adminCommon:questions.submitResponse')}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
      </div>
    </Protected>
  );
}

