'use client';

import { useEffect, useState } from 'react';
import { fetchWithAuth } from '@/hooks/use-auth';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/lib/store';
import { DollarSign, FileText } from 'lucide-react';
import { PageLoadingState, PageErrorState, PageEmptyState } from '@/components/shared/PageStates';
import { formatDate } from '@/lib/i18n';
import { safeToFixed, formatTnd } from '@/lib/utils';

interface ClaimRow {
  id: number;
  outageDurationHours: number;
  mttrHours: number;
  insuredHours: number;
  payoutAmount: number;
  statusCode: string;
  statusName: string;
  autoApproved: boolean;
  payoutCalculationJson: string | null;
  createdAt: string;
  policy: { cloudProvider: { organisationName: string; asn: string } };
}

const STATUS_STYLES: Record<string, { badge: string; dot: string }> = {
  DETECTED: { badge: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800/30', dot: 'bg-blue-500' },
  VALIDATED: { badge: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-300 dark:border-cyan-800/30', dot: 'bg-cyan-500' },
  APPROVED: { badge: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800/30', dot: 'bg-yellow-500' },
  PAID: { badge: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800/30', dot: 'bg-green-500' },
  DISPUTED: { badge: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800/30', dot: 'bg-red-500' },
  REJECTED: { badge: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800/30', dot: 'bg-red-500' },
};

export default function CustomerParametricClaimsPage() {
  const { user, setCurrentPage, setWorkflowContext } = useAppStore();
  const { t } = useTranslation(['common', 'customerParametric']);
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.id) fetchClaims();
  }, [user?.id]);

  const fetchClaims = async () => {
    setLoading(true);
    setError(null);
    try {
      const endpoint = '/api/customer/parametric-claims';
      const res = await fetchWithAuth(endpoint);
      if (!res.ok) throw new Error('Failed to load claims');
      const data = await res.json();
      setClaims(data.claims || []);
    } catch (err) {
      console.error('Failed to fetch claims:', err);
      setError(t('common:errors.failedToLoad', 'Failed to load claims. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <PageLoadingState message={t('customerParametric:claims.loading', 'Loading parametric claims…')} />;
  }

  if (error) {
    return <PageErrorState message={error} onRetry={fetchClaims} />;
  }

  return (
    <div className="page-enter">
      <div className="mb-6 animate-fade-in-down">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <DollarSign className="h-6 w-6 text-primary" /> {t('customerParametric:claims.title')}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">{t('customerParametric:claims.subtitle')}</p>
      </div>

      {claims.length === 0 ? (
        <Card className="shadow-md animate-fade-in-up">
          <CardContent className="p-12 text-center">
            <div className="bg-muted w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground font-medium">{t('customerParametric:claims.emptyTitle')}</p>
            <p className="text-muted-foreground text-sm mt-1">{t('customerParametric:claims.emptySubtitle')}</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-md animate-fade-in-up">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">{t('customerParametric:claims.title')}</caption>
                <thead>
                  <tr className="border-b bg-muted/80">
                    <th className="text-start p-3 font-medium text-muted-foreground">{t('customerParametric:claims.colId')}</th>
                    <th className="text-start p-3 font-medium text-muted-foreground">{t('customerParametric:claims.colProvider')}</th>
                    <th className="text-start p-3 font-medium text-muted-foreground">{t('customerParametric:claims.colOutageDuration')}</th>
                    <th className="text-start p-3 font-medium text-muted-foreground">{t('customerParametric:claims.colInsuredHours')}</th>
                    <th className="text-start p-3 font-medium text-muted-foreground">{t('customerParametric:claims.colPayout')}</th>
                    <th className="text-start p-3 font-medium text-muted-foreground">{t('customerParametric:claims.colStatus')}</th>
                    <th className="text-start p-3 font-medium text-muted-foreground">{t('customerParametric:claims.colDate')}</th>
                    <th className="text-start p-3 font-medium text-muted-foreground">{t('customerParametric:claims.colCalc')}</th>
                  </tr>
                </thead>
                <tbody>
                  {claims.map((c) => {
                    const style = STATUS_STYLES[c.statusCode] || STATUS_STYLES.DETECTED;
                    return (
                      <tr key={c.id} className="border-b table-row-hover">
                        <td className="p-3 font-mono text-xs text-muted-foreground">{c.id}</td>
                        <td className="p-3 font-medium">{c.policy.cloudProvider.organisationName}</td>
                        <td className="p-3 text-muted-foreground">{safeToFixed(c.outageDurationHours, 2)}h</td>
                        <td className="p-3 font-semibold text-primary">{safeToFixed(c.insuredHours, 2)}h</td>
                        <td className="p-3 font-bold text-emerald-600 dark:text-emerald-400">{formatTnd(c.payoutAmount)} {t('common:unit.tnd', 'TND')}</td>
                        <td className="p-3">
                          <Badge variant="outline" className={style.badge} title={c.statusName || c.statusCode}>
                            <span className={`w-1.5 h-1.5 rounded-full ${style.dot} me-1.5`} />
                            {c.statusName || c.statusCode}
                          </Badge>
                        </td>
                        <td className="p-3 text-xs text-muted-foreground">{formatDate(c.createdAt)}</td>
                        <td className="p-3">
                          {c.payoutCalculationJson ? (
                            <details className="text-xs">
                              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">{t('customerParametric:claims.details')}</summary>
                              <pre className="mt-1 text-[10px] bg-muted p-2 rounded max-w-xs overflow-x-auto whitespace-pre-wrap">
                                {(() => { try { return JSON.stringify(JSON.parse(c.payoutCalculationJson), null, 2); } catch { return c.payoutCalculationJson; } })()}
                              </pre>
                            </details>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

