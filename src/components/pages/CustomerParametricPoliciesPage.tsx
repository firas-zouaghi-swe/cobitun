'use client';

import { useEffect, useState } from 'react';
import { fetchWithAuth } from '@/hooks/use-auth';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/lib/store';
import { Cloud, Shield, Clock, FileText } from 'lucide-react';
import { PageLoadingState, PageErrorState, PageEmptyState } from '@/components/shared/PageStates';
import { formatDate } from '@/lib/i18n';
import { formatTnd } from '@/lib/utils';

interface PolicyCard {
  id: number;
  sectorName: string;
  businessModelName: string;
  resilienceProfile: string;
  annualTurnoverTnd: number;
  grossMargin: number;
  cloudDependency: number;
  criticality: number;
  resilienceFactor: number;
  bmFactor: number;
  providerFactor: number;
  payoutPerHour: number | null;
  maxPayoutPerEventHours: number;
  purePremium: number | null;
  commercialPremium: number | null;
  finalPremium: number | null;
  premiumRatePct: number | null;
  underwritingDecision: string | null;
  statusCode: string;
  statusName: string;
  adminComment: string | null;
  createdAt: string;
  cloudProvider: { organisationName: string; asn: string; slaTier: { tierCode: string; tierName: string } | string };
  _count?: { claims: number };
}

const STATUS_STYLES: Record<string, { border: string; bg: string; badge: string; dot: string }> = {
  APPROVED: { border: 'border-s-green-500', bg: 'bg-green-50/50 dark:bg-green-900/20', badge: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800/30', dot: 'bg-green-500' },
  PENDING: { border: 'border-s-yellow-500', bg: 'bg-yellow-50/50 dark:bg-yellow-900/20', badge: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800/30', dot: 'bg-yellow-500' },
  REJECTED: { border: 'border-s-red-500', bg: 'bg-red-50/50 dark:bg-red-900/20', badge: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800/30', dot: 'bg-red-500' },
  SUSPENDED: { border: 'border-s-gray-500', bg: 'bg-gray-50/50 dark:bg-gray-800/20', badge: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800/30 dark:text-gray-300 dark:border-gray-700/30', dot: 'bg-gray-500' },
};

const TIER_GRADIENTS: Record<string, string> = {
  Platinum: 'from-emerald-500 to-emerald-600',
  Gold: 'from-amber-500 to-amber-600',
  Silver: 'from-gray-400 to-gray-500',
  Bronze: 'from-orange-500 to-orange-600',
};

export default function CustomerParametricPoliciesPage() {
  const { user, setCurrentPage, setWorkflowContext } = useAppStore();
  const { t } = useTranslation(['common', 'customerParametric']);
  const [policies, setPolicies] = useState<PolicyCard[]>([]);
  const [loading, setLoading] = useState(true);

  // Helper to safely format values that might be numbers, numeric strings, or Decimal-like objects
  const formatValue = (v: any, decimals = 2, defaultStr = '—') => {
    if (v === null || v === undefined) return defaultStr;
    // If it's a plain number
    if (typeof v === 'number' && !isNaN(v)) return v.toFixed(decimals);
    // If it has a toNumber method (Prisma Decimal), use it
    if (v && typeof v.toNumber === 'function') {
      try { return v.toNumber().toFixed(decimals); } catch (e) { /* continue */ }
    }
    // If it has a toFixed method (stringified maybe), try that
    if (v && typeof v.toFixed === 'function') {
      try { return v.toFixed(decimals); } catch (e) { /* continue */ }
    }
    // Try coercing to Number
    const n = Number(v);
    if (!isNaN(n)) return n.toFixed(decimals);
    return defaultStr;
  };

  // Helper to safely resolve display text for fields that may be strings or objects
  const resolveText = (v: any, fallback = ''): string => {
    if (v === null || v === undefined) return fallback;
    if (typeof v === 'string' || typeof v === 'number') return String(v);
    if (typeof v === 'object') {
      // common possible fields
      return String(v.profileName ?? v.name ?? v.sectorName ?? v.modelName ?? v.code ?? v.profileCode ?? fallback);
    }
    return fallback;
  };

  useEffect(() => {
    if (user?.id) fetchPolicies();
  }, [user?.id]);

  const [error, setError] = useState<string | null>(null);

  const fetchPolicies = async () => {
    setLoading(true);
    setError(null);
    try {
      const endpoint = '/api/customer/parametric-policies';
      const res = await fetchWithAuth(endpoint);
      if (!res.ok) throw new Error('Failed to load policies');
      const data = await res.json();
      setPolicies(data.policies || []);
    } catch (err) {
      console.error('Failed to fetch policies:', err);
      setError(t('common:errors.failedToLoad', 'Failed to load policies. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <PageLoadingState message={t('customerParametric:policies.loading', 'Loading parametric policies…')} />;
  }

  if (error) {
    return <PageErrorState message={error} onRetry={fetchPolicies} />;
  }

  return (
    <div className="page-enter">
      <div className="mb-6 animate-fade-in-down">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Cloud className="h-6 w-6 text-[#E5693A]" /> {t('customerParametric:policies.title')}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">{t('customerParametric:policies.subtitle')}</p>
      </div>

      {policies.length === 0 ? (
        <Card className="shadow-md animate-fade-in-up">
          <CardContent className="p-12 text-center">
            <div className="bg-muted w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Cloud className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground font-medium">{t('customerParametric:policies.emptyTitle')}</p>
            <p className="text-muted-foreground text-sm mt-1">{t('customerParametric:policies.emptySubtitle')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {policies.map((p, i) => {
            const style = STATUS_STYLES[p.statusCode] || STATUS_STYLES.PENDING;
            return (
              <Card key={p.id} className={`border-s-4 ${style.border} ${style.bg} overflow-hidden card-hover-lift animate-fade-in-up stagger-${(i % 8) + 1} cursor-pointer`}
                onClick={() => { setWorkflowContext({ policyId: p.id }); setCurrentPage('customer-parametric-policies'); }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setWorkflowContext({ policyId: p.id }); setCurrentPage('customer-parametric-policies'); } }}
                aria-label={t('customerParametric:policies.viewDetails', 'View policy details for {{provider}}', { provider: p.cloudProvider.organisationName })}
              >
                <CardContent className="p-4 space-y-3">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`bg-gradient-to-br ${TIER_GRADIENTS[typeof p.cloudProvider.slaTier === 'object' ? p.cloudProvider.slaTier.tierName : p.cloudProvider.slaTier] || 'from-gray-400 to-gray-500'} p-1.5 rounded-lg`}>
                        <Cloud className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{p.cloudProvider.organisationName}</p>
                        <p className="text-xs text-muted-foreground">ASN {p.cloudProvider.asn}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className={style.badge} title={p.statusName || p.statusCode}>
                      <span className={`w-1.5 h-1.5 rounded-full ${style.dot} me-1.5`} />
                      {p.statusName || p.statusCode}
                    </Badge>
                  </div>

                  {/* Details */}
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">{t('customerParametric:policies.sector')}</p>
                      <p className="font-medium">{p.sectorName}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">{t('customerParametric:policies.businessModel')}</p>
                      <p className="font-medium">{p.businessModelName}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">{t('customerParametric:policies.resilience')}</p>
                        <p className="font-medium">{resolveText(p.resilienceProfile, 'Medium')}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">{t('customerParametric:policies.annualTurnover')}</p>
                      <p className="font-medium">{formatTnd(p.annualTurnoverTnd)} {t('common:unit.tnd', 'TND')}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">{t('customerParametric:policies.finalPremium')}</p>
                      <p className="font-semibold text-primary">{formatValue(p.finalPremium, 2, '') || formatValue(p.commercialPremium, 2, '—')} {t('common:unit.tnd', 'TND')}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">{t('customerParametric:policies.rate')}</p>
                      <p className="font-medium">{formatValue(p.premiumRatePct, 4, '—')}%</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">{t('customerParametric:policies.payoutPerHour')}</p>
                      <p className="font-medium text-emerald-600 dark:text-emerald-400">{formatValue(p.payoutPerHour, 4, '—')} {t('common:unit.tnd', 'TND')}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">{t('customerParametric:policies.providerFactor')}</p>
                      <p className="font-medium">×{formatValue(p.providerFactor, 2, '1.00')}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">{t('customerParametric:policies.maxPerEvent')}</p>
                      <p className="font-medium">{p.maxPayoutPerEventHours}h</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">{t('customerParametric:policies.claims')}</p>
                      <p className="font-medium">{p._count?.claims || 0}</p>
                    </div>
                  </div>

                  {/* Underwriting Decision */}
                  {p.underwritingDecision && (
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className={`text-[10px] ${
                        p.underwritingDecision === 'AUTO_ACCEPT' ? 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800/30' :
                        p.underwritingDecision === 'MANUAL_REVIEW' ? 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800/30' :
                        p.underwritingDecision === 'SURCHARGE' ? 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800/30' :
                        'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800/30'
                      }`} title={p.underwritingDecision.replace(/_/g, ' ')}>
                        {p.underwritingDecision.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                  )}

                  {/* Admin Comment */}
                  {p.adminComment && (
                    <div className="pt-2 border-t border-border">
                      <p className="text-xs text-muted-foreground">{t('customerParametric:policies.adminComment')}</p>
                      <p className="text-sm bg-card p-2 rounded-lg mt-1">{p.adminComment}</p>
                    </div>
                  )}

                  {/* Date */}
                  <p className="text-xs text-muted-foreground">
                    {t('customerParametric:policies.applied')}: {formatDate(p.createdAt)}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

