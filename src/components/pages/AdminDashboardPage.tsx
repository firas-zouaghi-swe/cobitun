'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/lib/store';
import Protected from '@/components/Protected';
import { fetchWithAuth, Roles } from '@/hooks/use-auth';
import { useTranslation } from 'react-i18next';
import { PageLoadingState, PageErrorState } from '@/components/shared/PageStates';
import {
  Users, FileText, FolderOpen, HelpCircle, CheckCircle, XCircle, Clock,
  Shield, Cloud, SatelliteDish, DollarSign, Zap, Activity, TrendingUp, AlertTriangle,
  BarChart3, Eye
} from 'lucide-react';

interface DashboardStats {
  // Traditional
  totalUsers: number;
  totalPolicies: number;
  totalCategories: number;
  totalQuestions: number;
  totalPolicyHolders: number;
  approvedHolders: number;
  disapprovedHolders: number;
  pendingHolders: number;
  // Parametric
  activeProviders: number;
  totalProviders: number;
  totalOutageEvents: number;
  unprocessedOutages: number;
  totalMergedIncidents: number;
  totalTriggerEvents: number;
  recentTriggers: number;
  parametricPoliciesTotal: number;
  parametricPoliciesApproved: number;
  parametricPoliciesPending: number;
  parametricClaimsTotal: number;
  parametricClaimsDetected: number;
  parametricClaimsPaid: number;
  parametricClaimsDisputed: number;
  totalPayoutsTnd: number;
  totalPremiumTnd: number;
  // Fraud Detection
  totalChecked: number;
  fakeDetected: number;
  needsReview: number;
  avgRiskScore: number;
  suspiciousIps: number;
}

export default function AdminDashboardPage() {
  const { setCurrentPage } = useAppStore();
  const { t } = useTranslation(['adminDashboard', 'common']);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth('/api/admin/dashboard');
      if (!res.ok) throw new Error('Failed to load dashboard data');
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch dashboard stats:', err);
      setError(t('common:errors.failedToLoad', 'Failed to load dashboard. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const formatTnd = (value: unknown) => {
    const amount = Number(value ?? 0);
    return Number.isFinite(amount) ? amount.toFixed(2) : '0.00';
  };

  if (loading) {
    return (
      <Protected roles={[Roles.ADMIN, Roles.SUPER_ADMIN]}>
        <PageLoadingState message={t('adminDashboard:loading', 'Loading dashboard...')} />
      </Protected>
    );
  }

  if (error) {
    return (
      <Protected roles={[Roles.ADMIN, Roles.SUPER_ADMIN]}>
        <PageErrorState message={error} onRetry={fetchStats} />
      </Protected>
    );
  }

  const traditionalCards = [
    { label: t('adminDashboard:traditional.totalUsers'), value: stats?.totalUsers || 0, icon: Users, gradient: 'from-[#2E5A9D] to-[#4A7EC4]' },
    { label: t('adminDashboard:traditional.totalPolicies'), value: stats?.totalPolicies || 0, icon: FileText, gradient: 'from-[#4A7EC4] to-[#4A7EC4]' },
    { label: t('adminDashboard:traditional.totalCategories'), value: stats?.totalCategories || 0, icon: FolderOpen, gradient: 'from-emerald-500 to-emerald-600' },
    { label: t('adminDashboard:traditional.totalQuestions'), value: stats?.totalQuestions || 0, icon: HelpCircle, gradient: 'from-amber-500 to-amber-600' },
    { label: t('adminDashboard:traditional.policyHolders'), value: stats?.totalPolicyHolders || 0, icon: Shield, gradient: 'from-purple-500 to-purple-600' },
    { label: t('adminDashboard:traditional.approved'), value: stats?.approvedHolders || 0, icon: CheckCircle, gradient: 'from-green-500 to-green-600' },
    { label: t('adminDashboard:traditional.pending'), value: stats?.pendingHolders || 0, icon: Clock, gradient: 'from-orange-500 to-orange-600' },
    { label: t('adminDashboard:traditional.disapproved'), value: stats?.disapprovedHolders || 0, icon: XCircle, gradient: 'from-red-500 to-red-600' },
  ];

  const parametricCards = [
    {
      label: t('adminDashboard:parametric.activeProviders'),
      value: stats?.activeProviders || 0,
      icon: Cloud,
      gradient: 'from-[#2E5A9D] to-[#E5693A]',
      action: t('adminDashboard:parametric.manage'),
      actionPage: 'admin-cloud-providers',
      sub: t('adminDashboard:parametric.total', { count: stats?.totalProviders || 0 }),
    },
    {
      label: t('adminDashboard:parametric.unprocessedOutages'),
      value: stats?.unprocessedOutages || 0,
      icon: SatelliteDish,
      gradient: stats?.unprocessedOutages ? 'from-amber-500 to-red-500' : 'from-[#1a1a2e] to-[#0f3460]',
      action: t('adminDashboard:parametric.monitor'),
      actionPage: 'admin-outage-monitor',
      sub: t('adminDashboard:parametric.totalEvents', { count: stats?.totalOutageEvents || 0 }),
      isLive: true,
    },
    {
      label: t('adminDashboard:parametric.parametricClaims'),
      value: stats?.parametricClaimsTotal || 0,
      icon: DollarSign,
      gradient: 'from-emerald-500 to-teal-500',
      action: t('adminDashboard:parametric.manage'),
      actionPage: 'admin-parametric-claims',
      sub: t('adminDashboard:parametric.claimsSub', { paid: stats?.parametricClaimsPaid || 0, disputed: stats?.parametricClaimsDisputed || 0 }),
    },
    {
      label: t('adminDashboard:parametric.autoTriggers'),
      value: stats?.recentTriggers || 0,
      icon: Zap,
      gradient: stats?.recentTriggers ? 'from-red-500 to-orange-500' : 'from-amber-500 to-orange-500',
      action: t('adminDashboard:parametric.details'),
      actionPage: 'admin-outage-monitor',
      sub: t('adminDashboard:parametric.total', { count: stats?.totalTriggerEvents || 0 }),
    },
  ];

  return (
    <Protected roles={[Roles.ADMIN, Roles.SUPER_ADMIN]}>
      <div className="space-y-6 page-enter">
      <div className="animate-fade-in-down">
        <h1 className="text-2xl font-bold mb-1">{t('adminDashboard:title')}</h1>
        <p className="text-muted-foreground text-sm">{t('adminDashboard:subtitle')}</p>
      </div>

        {/* Traditional Insurance Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {traditionalCards.map((card, i) => {
            const Icon = card.icon;
            return (
              <Card key={i} className={`overflow-hidden card-hover-lift stat-card-shimmer animate-fade-in-up stagger-${i + 1}`}>
                <CardContent className="p-0">
                  <div className={`bg-gradient-to-br ${card.gradient} p-4 text-white`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium opacity-90">{card.label}</p>
                        <p className="text-3xl font-bold mt-1 animate-count-up" style={{ animationDelay: `${0.2 + i * 0.05}s` }}>{card.value}</p>
                      </div>
                      <div className="bg-white/20 p-2.5 rounded-xl">
                        <Icon className="h-6 w-6" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

          {/* Fraud Detection Cards */}
      <div>
        <h3 className="text-sm font-semibold text-foreground dark:text-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
          <BarChart3 className="h-4 w-4" /> {t('adminDashboard:fraudDetection.sectionTitle')}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className={`overflow-hidden card-hover-lift stat-card-shimmer animate-fade-in-up stagger-5`}>
            <CardContent className="p-0">
              <div className={`bg-gradient-to-br from-blue-500 to-indigo-600 p-4 text-white`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium opacity-90">{t('adminDashboard:fraudDetection.totalChecked')}</p>
                    <p className="text-3xl font-bold mt-1 animate-count-up">{stats?.totalChecked || 0}</p>
                  </div>
                  <div className="bg-white/20 p-2.5 rounded-xl">
                    <Eye className="h-6 w-6" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className={`overflow-hidden card-hover-lift stat-card-shimmer animate-fade-in-up stagger-6`}>
            <CardContent className="p-0">
              <div className={`bg-gradient-to-br from-red-500 to-red-600 p-4 text-white`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium opacity-90">{t('adminDashboard:fraudDetection.fakeDetected')}</p>
                    <p className="text-3xl font-bold mt-1 animate-count-up">{stats?.fakeDetected || 0}</p>
                  </div>
                  <div className="bg-white/20 p-2.5 rounded-xl">
                    <XCircle className="h-6 w-6" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className={`overflow-hidden card-hover-lift stat-card-shimmer animate-fade-in-up stagger-7`}>
            <CardContent className="p-0">
              <div className={`bg-gradient-to-br from-yellow-500 to-yellow-600 p-4 text-white`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium opacity-90">{t('adminDashboard:fraudDetection.needsReview')}</p>
                    <p className="text-3xl font-bold mt-1 animate-count-up">{stats?.needsReview || 0}</p>
                  </div>
                  <div className="bg-white/20 p-2.5 rounded-xl">
                    <Clock className="h-6 w-6" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className={`overflow-hidden card-hover-lift stat-card-shimmer animate-fade-in-up stagger-8`}>
            <CardContent className="p-0">
              <div className={`bg-gradient-to-br from-purple-500 to-purple-600 p-4 text-white`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium opacity-90">{t('adminDashboard:fraudDetection.avgRiskScore')}</p>
                    <p className="text-3xl font-bold mt-1 animate-count-up">{stats?.avgRiskScore || 0}</p>
                  </div>
                  <div className="bg-white/20 p-2.5 rounded-xl">
                    <BarChart3 className="h-6 w-6" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className={`overflow-hidden card-hover-lift stat-card-shimmer animate-fade-in-up stagger-9`}>
            <CardContent className="p-0">
              <div className={`bg-gradient-to-br from-orange-500 to-orange-600 p-4 text-white`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium opacity-90">{t('adminDashboard:fraudDetection.suspiciousIps')}</p>
                    <p className="text-3xl font-bold mt-1 animate-count-up">{stats?.suspiciousIps || 0}</p>
                  </div>
                  <div className="bg-white/20 p-2.5 rounded-xl">
                    <AlertTriangle className="h-6 w-6" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="mt-4 flex justify-end">
          <Button 
            onClick={() => setCurrentPage('admin-fraud-detection')}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
          >
            <BarChart3 className="h-4 w-4" />
            {t('adminDashboard:fraudDetection.viewDetails')}
          </Button>
        </div>
      </div>

          {/* Parametric Insurance Cards */}
      <div>
        <h3 className="text-sm font-semibold text-foreground dark:text-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
          <Cloud className="h-4 w-4" /> {t('adminDashboard:parametric.sectionTitle')}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {parametricCards.map((card, i) => {
            const Icon = card.icon;
            return (
              <Card key={i} className={`overflow-hidden card-hover stat-card-shimmer animate-fade-in-up stagger-${i + 1}`}>
                <CardContent className="p-0">
                  <div className={`bg-gradient-to-br ${card.gradient} p-4 text-white relative`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium opacity-90">{card.label}</p>
                        <p className="text-3xl font-bold mt-1 animate-count-up" style={{ animationDelay: `${0.4 + i * 0.05}s` }}>
                          {card.value}
                          {card.isLive && <span className="ms-2 inline-flex items-center"><span className="w-2 h-2 bg-[#E5693A] rounded-full animate-pulse" /></span>}
                        </p>
                      </div>
                      <div className="bg-white/20 p-2.5 rounded-xl">
                        <Icon className="h-6 w-6" />
                      </div>
                    </div>
                    {card.sub && (
                      <p className="text-xs text-white/60 dark:text-white/60 mt-1">{card.sub}</p>
                    )}
                    <button
                      onClick={() => setCurrentPage(card.actionPage)}
                      className="mt-2 text-xs font-medium bg-white/20 hover:bg-white/30 dark:bg-white/10 dark:hover:bg-white/20 transition-all px-3 py-1.5 rounded-full flex items-center gap-1 w-fit backdrop-blur-sm"
                      aria-label={card.action}
                      tabIndex={0}
                    >
                      {card.action}
                    </button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Parametric Finance Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 dark:border-emerald-800/30 dark:from-emerald-900/20 dark:to-teal-900/20 animate-fade-in-up">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-100 dark:bg-emerald-900/30 p-2.5 rounded-xl">
                <TrendingUp className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-emerald-700 dark:text-emerald-300 font-medium">{t('adminDashboard:finance.totalPremiums')}</p>
                <p className="text-2xl font-bold text-emerald-800 dark:text-emerald-300">{formatTnd(stats?.totalPremiumTnd)} {t('common:unit.tnd')}</p>
              </div>
            </div>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2">{stats?.parametricPoliciesApproved || 0} {t('adminDashboard:finance.activePolicies')}</p>
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50 dark:border-amber-800/30 dark:from-amber-900/20 dark:to-yellow-900/20 animate-fade-in-up stagger-1">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="bg-amber-100 dark:bg-amber-900/30 p-2.5 rounded-xl">
                <DollarSign className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">{t('adminDashboard:finance.totalPayouts')}</p>
                <p className="text-2xl font-bold text-amber-800 dark:text-amber-300">{formatTnd(stats?.totalPayoutsTnd)} {t('common:unit.tnd')}</p>
              </div>
            </div>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">{stats?.parametricClaimsPaid || 0} {t('adminDashboard:finance.claimsPaid')}</p>
          </CardContent>
        </Card>

        <Card className="border-primary/20 animate-fade-in-up stagger-2">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2.5 rounded-xl">
                <Activity className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium">{t('adminDashboard:finance.policyRequests')}</p>
                <p className="text-2xl font-bold text-primary">{stats?.parametricPoliciesPending || 0} {t('adminDashboard:finance.pending')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800/30 text-xs" title={t('common:status.approved')}>{stats?.parametricPoliciesApproved || 0} {t('common:status.approved').toLowerCase()}</Badge>
              <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800/30 text-xs" title={t('adminDashboard:finance.pending')}>{stats?.parametricPoliciesPending || 0} {t('adminDashboard:finance.pending')}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Outage Events Summary */}
      {stats?.unprocessedOutages ? (
        <Card className="border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 dark:border-amber-800/30 dark:from-amber-900/20 dark:to-orange-900/20 animate-fade-in-up stagger-3">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-amber-100 dark:bg-amber-900/30 p-2.5 rounded-xl">
                <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">{t('adminDashboard:outage.unprocessedEvents')}</p>
                <p className="text-2xl font-bold text-amber-800 dark:text-amber-300">{t('adminDashboard:outage.eventsRequireProcessing', { count: stats.unprocessedOutages })}</p>
              </div>
            </div>
            <Badge className="bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300" title={t('adminDashboard:outage.unprocessedEvents')}>{t('adminDashboard:parametric.total', { count: stats.totalOutageEvents })}</Badge>
          </CardContent>
        </Card>
      ) : null}

      </div>
    </Protected>
  );
}

