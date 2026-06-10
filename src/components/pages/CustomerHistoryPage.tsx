'use client';

import { useEffect, useState } from 'react';
import { fetchWithAuth } from '@/hooks/use-auth';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/lib/store';
import { formatCurrency, formatDate } from '@/lib/i18n';
import { CheckCircle, XCircle, Clock, Shield } from 'lucide-react';
import { PageLoadingState, PageErrorState, PageEmptyState } from '@/components/shared/PageStates';

interface PolicyRecord {
  id: number;
  statusCode: string;
  statusName: string;
  createdAt: string;
  policy: {
    id: number;
    policyName: string;
    sumAssurance: number;
    premium: number;
    tenure: number;
    category: { categoryName: string };
  };
}

export default function CustomerHistoryPage() {
  const { t } = useTranslation(['common', 'customerHistory']);
  const { user } = useAppStore();
  const [records, setRecords] = useState<PolicyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.id) void fetchRecords();
  }, [user?.id]);

  async function fetchRecords() {
    setLoading(true);
    setError(null);
    try {
      const endpoint = '/api/customer/history';
      const res = await fetchWithAuth(endpoint);
      if (!res.ok) throw new Error('Failed to load history');
      const data = await res.json();
      setRecords(data.records || []);
    } catch (err) {
      console.error('Failed to fetch records:', err);
      setError(t('common:errors.failedToLoad', 'Failed to load history. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (statusCode: string) => {
    switch (statusCode) {
      case 'Approved':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-300" title={t('common:status.approved')}><CheckCircle className="h-3 w-3 me-1" />{t('common:status.approved')}</Badge>;
      case 'Disapproved':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-300" title={t('common:status.disapproved')}><XCircle className="h-3 w-3 me-1" />{t('common:status.disapproved')}</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100 dark:bg-gray-900/30 dark:text-gray-300" title={t('common:status.unknown', 'Unknown')}><Clock className="h-3 w-3 me-1" />{t('common:status.unknown', 'Unknown')}</Badge>;
    }
  };

  if (loading) {
    return <PageLoadingState message={t('customerHistory:loading', 'Loading history…')} />;
  }

  if (error) {
    return <PageErrorState message={error} onRetry={fetchRecords} />;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t('customerHistory:title')}</h1>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableCaption className="sr-only">{t('customerHistory:title')}</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('customerHistory:table.policyName')}</TableHead>
                  <TableHead>{t('customerHistory:table.category')}</TableHead>
                  <TableHead>{t('customerHistory:table.sumAssurance')}</TableHead>
                  <TableHead>{t('customerHistory:table.premium')}</TableHead>
                  <TableHead>{t('customerHistory:table.tenure')}</TableHead>
                  <TableHead>{t('customerHistory:table.status')}</TableHead>
                  <TableHead>{t('customerHistory:table.appliedOn')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="p-0">
                      <PageEmptyState
                        icon={<Shield className="h-8 w-8 text-muted-foreground" />}
                        title={t('customerHistory:empty.noApplications')}
                        description={t('customerHistory:empty.noApplicationsDesc', 'You have not applied to any policies yet.')}
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  records.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">{record.policy.policyName}</TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          title={record.policy.category?.categoryName ?? t('customerHistory:unknownCategory', 'Uncategorized')}
                        >
                          {record.policy.category?.categoryName ?? t('customerHistory:unknownCategory', 'Uncategorized')}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatCurrency(record.policy.sumAssurance)}</TableCell>
                      <TableCell>{formatCurrency(record.policy.premium)}</TableCell>
                      <TableCell>{record.policy.tenure} {record.policy.tenure > 1 ? t('common:unit.years') : t('common:unit.year')}</TableCell>
                      <TableCell>{getStatusBadge(record.statusCode)}</TableCell>
                      <TableCell>{formatDate(record.createdAt)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

