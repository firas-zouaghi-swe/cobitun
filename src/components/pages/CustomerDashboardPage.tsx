'use client';

import { useEffect, useState } from 'react';
import { fetchWithAuth } from '@/hooks/use-auth';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/lib/store';
import {
  FileText, CheckCircle, Clock, XCircle, FolderOpen, HelpCircle,
  Shield, DollarSign, SatelliteDish, Zap, Cloud, ArrowRight, ChevronRight
} from 'lucide-react';
import StyleSettings from '@/components/ui/StyleSettings';
import { formatDate } from '@/lib/i18n';
import { safeToFixed } from '@/lib/utils';
import { PageLoadingState, PageErrorState } from '@/components/shared/PageStates';

interface LastTriggerInfo {
  insuredHours: number;
  providerName: string;
  date: string;
  payoutAmount: number;
}

interface CustomerStats {
  availablePolicies: number;
  appliedPolicies: number;
  totalCategories: number;
  totalQuestions: number;
  approvedPolicies: number;
  pendingPolicies: number;
  disapprovedPolicies: number;
  parametricPoliciesApproved: number;
  parametricPoliciesTotal: number;
  parametricClaimsTotal: number;
  parametricClaimsPaid: number;
  totalPayoutAmount: number;
  activeOutages: number;
  lastTriggerInfo: LastTriggerInfo | null;
  hasParametricPolicies: boolean;
}

export default function CustomerDashboardPage() {
  const { user, setCurrentPage } = useAppStore();
  const { t } = useTranslation(['common', 'customerDashboard']);
  const [stats, setStats] = useState<CustomerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.id) fetchStats();
  }, [user?.id]);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!user?.id) {
        throw new Error('User is not authenticated');
      }
      const endpoint = '/api/customer/dashboard';
      const res = await fetchWithAuth(endpoint);
      if (!res.ok) {
        throw new Error('Failed to load dashboard data');
      }
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch dashboard stats:', err);
      setError(t('common:errors.failedToLoad', 'Failed to load dashboard. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <PageLoadingState message={t('customerDashboard:loading', 'Loading dashboard…')} />;
  }

  if (error) {
    return <PageErrorState message={error} onRetry={fetchStats} />;
  }

  const traditionalCards = [
    { label: t('customerDashboard:traditional.availablePolicies'), value: stats?.availablePolicies || 0, icon: FileText, gradient: 'from-[#4A7EC4] to-[#4A7EC4]' },
    { label: t('customerDashboard:traditional.appliedPolicies'), value: stats?.appliedPolicies || 0, icon: CheckCircle, gradient: 'from-[#2E5A9D] to-[#4A7EC4]' },
    { label: t('customerDashboard:traditional.categories'), value: stats?.totalCategories || 0, icon: FolderOpen, gradient: 'from-emerald-500 to-emerald-600' },
    { label: t('customerDashboard:traditional.myQuestions'), value: stats?.totalQuestions || 0, icon: HelpCircle, gradient: 'from-amber-500 to-amber-600' },
    { label: t('customerDashboard:traditional.approved'), value: stats?.approvedPolicies || 0, icon: CheckCircle, gradient: 'from-green-500 to-green-600' },
    { label: t('customerDashboard:traditional.pending'), value: stats?.pendingPolicies || 0, icon: Clock, gradient: 'from-orange-500 to-orange-600' },
    { label: t('customerDashboard:traditional.disapproved'), value: stats?.disapprovedPolicies || 0, icon: XCircle, gradient: 'from-red-500 to-red-600' },
  ];

  const parametricCards = [
    {
      label: t('customerDashboard:parametric.cloudCoverage'),
      value: stats?.parametricPoliciesApproved || 0,
      icon: Shield,
      gradient: 'from-[#2E5A9D] to-[#E5693A]',
      action: stats?.parametricPoliciesApproved ? t('customerDashboard:parametric.viewPolicies') : t('common:action.getProtected'),
      actionPage: stats?.parametricPoliciesApproved ? 'customer-parametric-policies' : 'apply-parametric-policy',
    },
    {
      label: t('customerDashboard:parametric.parametricClaims'),
      value: stats?.parametricClaimsTotal || 0,
      icon: DollarSign,
      gradient: 'from-emerald-500 to-emerald-600',
      action: t('customerDashboard:parametric.viewHistory'),
      actionPage: 'customer-parametric-claims',
    },
    {
      label: t('customerDashboard:parametric.outageMonitor'),
      value: stats?.activeOutages || 0,
      icon: SatelliteDish,
      gradient: 'from-amber-500 to-amber-600',
      action: t('customerDashboard:parametric.monitor'),
      actionPage: 'customer-outage-monitor',
    },
    {
      label: t('customerDashboard:parametric.lastTrigger'),
      value: stats?.lastTriggerInfo ? `${safeToFixed(stats?.lastTriggerInfo?.insuredHours, 1)}h` : '—',
      icon: Zap,
      gradient: 'from-[#1a1a2e] to-[#0f3460]',
      action: t('customerDashboard:parametric.details'),
      actionPage: 'customer-parametric-claims',
    },
  ];

  return (
    <div className="space-y-6 page-enter">
      <div className="animate-fade-in-down">
        <h1 className="text-2xl font-bold mb-1">{t('customerDashboard:title')}</h1>
        <p className="text-muted-foreground text-sm">{t('customerDashboard:welcome', { name: user?.firstName })}</p>
      </div>

      {/* Traditional Insurance Cards */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">{t('customerDashboard:traditional.title')}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {traditionalCards.map((card, i) => (
            <Card key={i} className={`overflow-hidden card-hover-lift stat-card-shimmer animate-fade-in-up stagger-${i + 1}`}>
              <CardContent className="p-0">
                <div className={`bg-gradient-to-br ${card.gradient} p-4 text-white`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium opacity-90">{card.label}</p>
                      <p className="text-3xl font-bold mt-1 animate-count-up" style={{ animationDelay: `${0.2 + i * 0.05}s` }}>{card.value}</p>
                    </div>
                    <div className="bg-white/20 p-2.5 rounded-xl">
                      <card.icon className="h-6 w-6" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Parametric Insurance Cards */}
      <div>
        <h3 className="text-sm font-semibold text-accent uppercase tracking-wider mb-3 flex items-center gap-2 animate-fade-in-up">
          <Cloud className="h-4 w-4" /> {t('customerDashboard:parametric.sectionTitle')}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {parametricCards.map((card, i) => (
            <Card key={i} className={`overflow-hidden card-hover stat-card-shimmer animate-fade-in-up stagger-${i + 1}`}>
              <CardContent className="p-0">
                <div className={`bg-gradient-to-br ${card.gradient} p-4 text-white relative`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium opacity-90">{card.label}</p>
                      <p className="text-3xl font-bold mt-1 animate-count-up" style={{ animationDelay: `${0.4 + i * 0.05}s` }}>{card.value}</p>
                    </div>
                    <div className="bg-white/20 p-2.5 rounded-xl">
                      <card.icon className="h-6 w-6" />
                    </div>
                  </div>
                  <button
                    onClick={() => setCurrentPage(card.actionPage)}
                    className="mt-3 text-xs font-medium bg-white/20 hover:bg-white/30 transition-all px-3 py-1.5 rounded-full flex items-center gap-1 w-fit backdrop-blur-sm"
                    aria-label={card.action}
                  >
                    {card.action} <ChevronRight className="h-3 w-3" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Total Payout Banner */}
      {(stats?.totalPayoutAmount ?? 0) > 0 && (
        <Card className="border-emerald-200 dark:border-emerald-800/30 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 animate-fade-in-up">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-100 dark:bg-emerald-900/30 p-2.5 rounded-xl">
                <DollarSign className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-emerald-700 dark:text-emerald-300 font-medium">{t('customerDashboard:payouts.totalReceived')}</p>
                <p className="text-2xl font-bold text-emerald-800 dark:text-emerald-300">{safeToFixed(stats?.totalPayoutAmount ?? 0, 2)} {t('common:unit.tnd', 'TND')}</p>
              </div>
            </div>
            <Badge className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300" title={t('customerDashboard:payouts.claimsPaid', { count: stats?.parametricClaimsPaid ?? 0 })}>{t('customerDashboard:payouts.claimsPaid', { count: stats?.parametricClaimsPaid ?? 0 })}</Badge>
          </CardContent>
        </Card>
      )}

      {/* Last Trigger Detail */}
      {stats?.lastTriggerInfo && (
        <Card className="border-primary/20 animate-fade-in-up stagger-2">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2.5 rounded-xl">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground font-medium">{t('customerDashboard:parametric.lastTrigger')}</p>
                  <p className="font-semibold">
                    {t('customerDashboard:parametric.insuredHours', { hours: safeToFixed(stats.lastTriggerInfo.insuredHours, 1) })} — {stats.lastTriggerInfo.providerName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(stats.lastTriggerInfo.date)} &bull; {t('customerDashboard:parametric.payout')}: {safeToFixed(stats.lastTriggerInfo.payoutAmount, 2)} {t('common:unit.tnd', 'TND')}
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" className="border-primary/30 text-primary hover:bg-primary/5" onClick={() => setCurrentPage('customer-parametric-claims')}>
                {t('customerDashboard:parametric.viewClaims')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Onboarding Card - shown if no parametric policies */}
      {!stats?.hasParametricPolicies && (
        <Card className="border-accent/50 shadow-xl overflow-hidden animate-fade-in-up stagger-3">
          <CardContent className="p-0">
            <div className="bg-gradient-to-r from-[#1a1a2e] to-[#0f3460] p-6 md:p-8 text-white relative overflow-hidden">
              {/* Decorative elements */}
              <div className="absolute top-0 end-0 w-32 h-32 bg-[#E5693A]/10 rounded-full blur-2xl" />
              <div className="absolute bottom-0 start-0 w-24 h-24 bg-[#4A7EC4]/10 rounded-full blur-2xl" />

              <div className="flex items-start gap-4 mb-6 relative z-10">
                <div className="bg-[#E5693A]/20 p-3 rounded-xl">
                  <Cloud className="h-8 w-8 text-[#E5693A]" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-1 text-white">{t('customerDashboard:onboarding.title')}</h3>
                  <p className="text-white/60 text-sm leading-relaxed">{t('customerDashboard:onboarding.description')}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 relative z-10">
                {[
                  { step: 1, label: t('customerDashboard:onboarding.step1'), icon: Cloud },
                  { step: 2, label: t('customerDashboard:onboarding.step2'), icon: Shield },
                  { step: 3, label: t('customerDashboard:onboarding.step3'), icon: CheckCircle },
                  { step: 4, label: t('customerDashboard:onboarding.step4'), icon: Zap },
                ].map((s, i) => (
                  <div key={s.step} className="glass rounded-xl p-3 text-center transition-all hover:bg-white/[0.12] animate-fade-in-up" style={{ animationDelay: `${0.5 + i * 0.1}s` }}>
                    <div className="w-8 h-8 bg-[#E5693A] text-[#1a1a2e] rounded-lg flex items-center justify-center mx-auto mb-2 text-sm font-bold">
                      {s.step}
                    </div>
                    <s.icon className="h-4 w-4 mx-auto mb-1 text-[#E5693A]" />
                    <p className="text-xs font-medium">{s.label}</p>
                  </div>
                ))}
              </div>

              <Button
                size="lg"
                className="bg-[#E5693A] hover:bg-[#C44D20] text-[#1a1a2e] font-bold transition-all hover:shadow-lg hover:shadow-[#E5693A]/20 hover:scale-[1.02]"
                onClick={() => setCurrentPage('apply-parametric-policy')}
              >
                {t('customerDashboard:onboarding.applyNow')} <ArrowRight className="ms-2 h-5 w-5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <StyleSettings />
    </div>
  );
}

