'use client';

import { useEffect, useState } from 'react';
import { fetchWithAuth } from '@/hooks/use-auth';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/lib/store';
import { Shield, Clock, AlertTriangle, FileText, CheckCircle, XCircle, Ban } from 'lucide-react';
import { PageLoadingState, PageErrorState, PageEmptyState } from '@/components/shared/PageStates';
import { formatDate } from '@/lib/i18n';
import { formatTnd } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface CoverageGrant {
  id: number;
  code: string;
  name: string;
  exclusions: string[];
}

interface ProductInfo {
  productCode: string;
  productName: string;
  productType: string | { id: number; typeCode?: string; typeName?: string };
  coverageGrants: CoverageGrant[];
}

interface CyberPolicy {
  id: number;
  policyLimit: number;
  deductibleSIR: number;
  premium: number;
  indemnityPeriodDays: number;
  selectedCoverages: string[];
  endorsements: string[];
  statusCode: string; // PENDING, ACTIVE, LAPSED, CANCELLED
  statusName: string;
  inceptionDate: string | null;
  expiryDate: string | null;
  adminComment: string | null;
  isActive: boolean;
  createdAt: string;
  product: ProductInfo;
  claims: { id: number }[];
}

// ── Status styles ──────────────────────────────────────────────────────
const STATUS_STYLES: Record<string, { border: string; bg: string; badge: string; dot: string; icon: typeof Shield }> = {
  ACTIVE: {
    border: 'border-s-green-500',
    bg: 'bg-green-50/50 dark:bg-green-900/20',
    badge: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800/30',
    dot: 'bg-green-500',
    icon: CheckCircle,
  },
  PENDING: {
    border: 'border-s-yellow-500',
    bg: 'bg-yellow-50/50 dark:bg-yellow-900/20',
    badge: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800/30',
    dot: 'bg-yellow-500',
    icon: Clock,
  },
  LAPSED: {
    border: 'border-s-gray-500',
    bg: 'bg-gray-50/50 dark:bg-gray-800/20',
    badge: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800/30 dark:text-gray-300 dark:border-gray-700/30',
    dot: 'bg-gray-500',
    icon: AlertTriangle,
  },
  CANCELLED: {
    border: 'border-s-red-500',
    bg: 'bg-red-50/50 dark:bg-red-900/20',
    badge: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800/30',
    dot: 'bg-red-500',
    icon: Ban,
  },
};

const COVERAGE_COLORS: Record<string, string> = {
  BI: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800/30',
  DR: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800/30',
  CE: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800/30',
  SR: 'bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-300 dark:border-cyan-800/30',
  CM: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800/30',
  PL: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800/30',
  RD: 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800/30',
  ML: 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800/30',
  SE: 'bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-800/30',
};

export default function CustomerCyberPoliciesPage() {
  function resolveProductType(pt: string | { id: number; typeCode?: string; typeName?: string }) {
    if (!pt) return '—';
    if (typeof pt === 'string') return pt;
    return pt.typeName || pt.typeCode || String(pt.id || '—');
  }
  const { user, setCurrentPage, setWorkflowContext } = useAppStore();
  const { t } = useTranslation(['customerCyber', 'common']);
  const [policies, setPolicies] = useState<CyberPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.id) fetchPolicies();
  }, [user?.id]);

  const fetchPolicies = async () => {
    setLoading(true);
    setError(null);
    try {
      const endpoint = '/api/customer/cyber/policies';
      const res = await fetchWithAuth(endpoint);
      if (!res.ok) throw new Error('Failed to load cyber policies');
      const data = await res.json();
      setPolicies(data.policies || []);
    } catch (err) {
      console.error('Failed to fetch cyber policies:', err);
      setError(t('common:errors.failedToLoad', 'Failed to load cyber policies. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <PageLoadingState message={t('customerCyber:policies.loading', 'Loading cyber policies…')} />;
  }

  if (error) {
    return <PageErrorState message={error} onRetry={fetchPolicies} />;
  }

  return (
    <div className="page-enter">
      <div className="mb-6 animate-fade-in-down">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="h-6 w-6 text-[#E5693A]" /> {t('customerCyber:policies.title')}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">{t('customerCyber:policies.subtitle')}</p>
      </div>

      {policies.length === 0 ? (
        <Card className="shadow-md animate-fade-in-up">
          <CardContent className="p-12 text-center">
            <div className="bg-muted w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Shield className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground font-medium">{t('customerCyber:policies.empty')}</p>
            <p className="text-muted-foreground text-sm mt-1">{t('customerCyber:policies.emptyDesc')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {policies.map((p, i) => {
            const style = STATUS_STYLES[p.statusCode] || STATUS_STYLES.PENDING;
            const StatusIcon = style.icon;
            return (
              <Card
                key={p.id}
                className={`border-s-4 ${style.border} ${style.bg} overflow-hidden card-hover-lift animate-fade-in-up stagger-${(i % 8) + 1} cursor-pointer`}
                onClick={() => { setWorkflowContext({ policyId: p.id }); setCurrentPage('customer-cyber-policies'); }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setWorkflowContext({ policyId: p.id }); setCurrentPage('customer-cyber-policies'); } }}
                aria-label={t('customerCyber:policies.viewDetails', 'View details for {{name}}', { name: p.product.productName })}
              >
                <CardContent className="p-4 space-y-3">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="bg-gradient-to-br from-[#2E5A9D] to-[#E5693A] p-1.5 rounded-lg">
                        <Shield className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{p.product.productName}</p>
                        <p className="text-xs text-muted-foreground">{resolveProductType(p.product.productType)}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className={style.badge} title={p.statusName || p.statusCode}>
                      <span className={`w-1.5 h-1.5 rounded-full ${style.dot} me-1.5`} />
                      {p.statusName || p.statusCode}
                    </Badge>
                  </div>

                  {/* Financial Details */}
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">{t('customerCyber:policies.policyLimit')}</p>
                      <p className="font-semibold text-primary">{Number(p.policyLimit ?? 0).toLocaleString()} {t('common:unit.tnd', 'TND')}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">{t('customerCyber:policies.deductible')}</p>
                      <p className="font-medium text-amber-600 dark:text-amber-400">{Number(p.deductibleSIR ?? 0).toLocaleString()} {t('common:unit.tnd', 'TND')}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">{t('customerCyber:policies.premium')}</p>
                      <p className="font-semibold">{formatTnd(p.premium)} {t('common:unit.tnd', 'TND')}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">{t('customerCyber:policies.indemnityPeriod')}</p>
                      <p className="font-medium">{p.indemnityPeriodDays} {t('customerCyber:policies.days')}</p>
                    </div>
                  </div>

                  {/* Selected Coverages */}
                  {p.selectedCoverages && p.selectedCoverages.length > 0 && (
                    <div className="pt-2 border-t border-border">
                      <p className="text-xs text-muted-foreground mb-1.5">{t('customerCyber:policies.coverages')}</p>
                      <div className="flex flex-wrap gap-1">
                        {p.selectedCoverages.map((code) => (
                          <Badge
                            key={code}
                            variant="outline"
                            className={`text-xs font-mono ${COVERAGE_COLORS[code] || 'bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-300'}`}
                            title={code}
                          >
                            {code}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Claims Count */}
                  <div className="flex items-center gap-1 text-sm">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground text-xs">{t('customerCyber:policies.claims')}:</span>
                    <span className="font-medium">{p.claims?.length || 0}</span>
                  </div>

                  {/* Admin Comment */}
                  {p.adminComment && (
                    <div className="pt-2 border-t border-border">
                      <p className="text-xs text-muted-foreground">{t('customerCyber:policies.adminComment')}</p>
                      <p className="text-sm bg-card p-2 rounded-lg mt-1">{p.adminComment}</p>
                    </div>
                  )}

                  {/* Dates */}
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    {p.inceptionDate && (
                      <p>{t('customerCyber:policies.inception')}: {formatDate(p.inceptionDate)}</p>
                    )}
                    {p.expiryDate && (
                      <p>{t('customerCyber:policies.expiry')}: {formatDate(p.expiryDate)}</p>
                    )}
                    <p>{t('customerCyber:policies.created')}: {formatDate(p.createdAt)}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

