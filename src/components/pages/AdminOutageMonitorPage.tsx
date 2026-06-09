'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Protected from '@/components/Protected';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Cloud, SatelliteDish, Zap, DollarSign, RefreshCw, Activity, FileText, Radio, Wifi, TrendingDown, Table2 } from 'lucide-react';
import { toast } from 'sonner';
import IODASignalChart from '@/components/IODASignalChart';
import IODAAlertsTable from '@/components/IODAAlertsTable';
import { fetchWithAuth, Roles } from '@/hooks/use-auth';
import { formatDateTime } from '@/lib/i18n';
import { PageLoadingState, PageErrorState } from '@/components/shared/PageStates';
import { safeToFixed } from '@/lib/utils';

interface MonitorStats {
  activeProviders: number;
  unprocessedOutages: number;
  recentTriggers: number;
  totalPayouts: number;
}

interface OutageEventRow {
  id: number;
  eventStart: string;
  eventEnd: string;
  durationHours: number | string;
  datasource: string;
  score: number | string | null;
  processed: boolean;
  cloudProvider: { organisationName: string; asn: string; slaTier: { tierCode: string; tierName: string; mttrHours: number } | string };
}

interface TriggerRow {
  id: number;
  slaTier: { tierCode: string; tierName: string; mttrHours: number } | string;
  mttrHours: number;
  insuredHours: number;
  claimCreated: boolean;
  createdAt: string;
  cloudProvider: { organisationName: string; asn: string };
}

interface ClaimRow {
  id: number;
  claimNumber: string;
  createdAt: string;
  declarationOfLossPdfUrl: string | null;
  statusCode: string;
  statusName: string;
  customer: { user: { firstName: string; lastName: string } };
  policyApplication: {
    applicationNumber: string;
    status?: { statusCode: string; statusName: string };
  } | null;
}

const TIER_STYLES: Record<string, { badge: string; dot: string }> = {
  Platinum: { badge: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800/30', dot: 'bg-purple-500' },
  Gold: { badge: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800/30', dot: 'bg-yellow-500' },
  Silver: { badge: 'bg-muted text-muted-foreground border-border', dot: 'bg-gray-400' },
  Bronze: { badge: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800/30', dot: 'bg-amber-500' },
};

function getTierName(slaTier: { tierCode: string; tierName: string; mttrHours: number } | string): string {
  return typeof slaTier === 'object' ? slaTier.tierName : slaTier;
}

export default function AdminOutageMonitorPage() {
  const { t } = useTranslation(['common', 'adminOutageMonitor', 'ioda']);
  const [stats, setStats] = useState<MonitorStats | null>(null);
  const [outageEvents, setOutageEvents] = useState<OutageEventRow[]>([]);
  const [triggers, setTriggers] = useState<TriggerRow[]>([]);
  const [recentClaims, setRecentClaims] = useState<ClaimRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runningCheck, setRunningCheck] = useState(false);
  const [activeTab, setActiveTab] = useState<'signals' | 'alerts' | 'events' | 'triggers' | 'claims'>('signals');

  const parseNumber = (value: unknown, fallback = 0): number => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    }
    return fallback;
  };

  const fetchData = async () => {
    setError(null);
    try {
      const res = await fetchWithAuth('/api/admin/outage-monitor');
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.error || `Request failed with status ${res.status}`);
      }
      const data = await res.json();
      setStats(data.stats);

      setOutageEvents((data.outageEvents || []).map((event: any) => ({
        ...event,
        durationHours: parseNumber(event.durationHours),
        score: event.score == null ? null : parseNumber(event.score),
      })));

      setTriggers((data.triggers || []).map((trigger: any) => ({
        ...trigger,
        mttrHours: parseNumber(trigger.mttrHours),
        insuredHours: parseNumber(trigger.insuredHours),
        slaTier: typeof trigger.slaTier === 'object' ? {
          ...trigger.slaTier,
          mttrHours: parseNumber(trigger.slaTier.mttrHours),
        } : trigger.slaTier,
      })));

      setRecentClaims((data.recentClaims || []).map((claim: any) => ({
        ...claim,
      })));
    } catch (err) {
      console.error('Failed to fetch monitor data:', err);
      setError(t('errors.failedToLoad', 'Failed to load data'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRunIodaCheck = async () => {
    setRunningCheck(true);
    try {
      const res = await fetchWithAuth('/api/admin/run-ioda-check', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        toast.success(t('adminOutageMonitor:toast.iodaCheckCompleted', { triggers: data.totalTriggers, claims: data.totalClaims }));
        fetchData();
      } else {
        toast.error(data.error || t('adminOutageMonitor:toast.iodaCheckFailed'));
      }
    } catch {
      toast.error(t('adminOutageMonitor:toast.iodaCheckFailed'));
    } finally {
      setRunningCheck(false);
    }
  };

  const getStatusBadge = (statusCode: string) => {
    const colors: Record<string, string> = {
      DETECTED: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800/30',
      VALIDATED: 'bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-300 dark:border-cyan-800/30',
      APPROVED: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800/30',
      PAID: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800/30',
      DISPUTED: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800/30',
      REJECTED: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800/30',
    };
    return colors[statusCode] || 'bg-muted text-foreground border-border';
  };

  if (error) {
    return (
      <Protected roles={[Roles.ADMIN, Roles.SUPER_ADMIN]}>
        <PageErrorState message={error} onRetry={fetchData} />
      </Protected>
    );
  }

  if (loading) {
    return (
      <Protected roles={[Roles.ADMIN, Roles.SUPER_ADMIN]}>
        <PageLoadingState />
      </Protected>
    );
  }

  const tabs = [
    { id: 'signals' as const, label: t('adminOutageMonitor:tabs.liveSignals'), icon: Radio },
    { id: 'alerts' as const, label: t('adminOutageMonitor:tabs.alertsTable'), icon: Table2 },
    { id: 'events' as const, label: t('adminOutageMonitor:tabs.outageEvents'), icon: Activity },
    { id: 'triggers' as const, label: t('adminOutageMonitor:tabs.triggers'), icon: Zap },
    { id: 'claims' as const, label: t('adminOutageMonitor:tabs.claims'), icon: FileText },
  ];

  return (
    <Protected roles={[Roles.ADMIN, Roles.SUPER_ADMIN]}>
      <div className="page-enter">
      <div className="flex items-center justify-between mb-6 animate-fade-in-down">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <SatelliteDish className="h-6 w-6 text-primary" /> {t('adminOutageMonitor:title')}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{t('adminOutageMonitor:subtitle')}</p>
        </div>
        <Button
          onClick={handleRunIodaCheck}
          disabled={runningCheck}
          variant="tunis"
        >
          <RefreshCw className={`h-4 w-4 me-2 ${runningCheck ? 'animate-spin' : ''}`} />
          {runningCheck ? t('adminOutageMonitor:runningIodaCheck') : t('adminOutageMonitor:runIodaCheck')}
        </Button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: t('adminOutageMonitor:stats.activeProviders'), value: stats?.activeProviders || 0, icon: Cloud, gradient: 'from-[#2E5A9D] to-[#4A7EC4]' },
          { label: t('adminOutageMonitor:stats.activeOutages'), value: stats?.unprocessedOutages || 0, icon: SatelliteDish, gradient: 'from-amber-500 to-amber-600' },
          { label: t('adminOutageMonitor:stats.triggers24h'), value: stats?.recentTriggers || 0, icon: Zap, gradient: 'from-[#4A7EC4] to-[#4A7EC4]' },
          { label: t('adminOutageMonitor:stats.totalPayoutsTnd'), value: stats?.totalPayouts?.toLocaleString() || 0, icon: DollarSign, gradient: 'from-emerald-500 to-emerald-600' },
        ].map((card, i) => (
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

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 bg-muted rounded-xl p-1 mb-6 overflow-x-auto" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-background text-primary shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
            {tab.id === 'events' && ((stats?.unprocessedOutages ?? 0) > 0) && (
              <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 text-[10px] px-1.5 py-0">{stats?.unprocessedOutages ?? 0}</Badge>
            )}
            {tab.id === 'alerts' && (
              <Badge className="bg-primary/10 text-primary text-[10px] px-1.5 py-0">{t('common:live', 'Live')}</Badge>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'signals' && (
        <div className="animate-fade-in-up">
          <IODASignalChart
            apiEndpoint="/api/admin/signals"
            showAdminControls={true}
            title={t('ioda:signal.defaultTitle')}
            subtitle={t('adminOutageMonitor:subtitle')}
            defaultDatasource="bgp"
            autoRefreshInterval={60}
          />
        </div>
      )}

      {activeTab === 'alerts' && (
        <div className="animate-fade-in-up">
          <IODAAlertsTable
            apiEndpoint="/api/admin/ioda-alerts"
            showAdminControls={true}
            title={t('ioda:alerts.defaultTitle')}
            subtitle={t('adminOutageMonitor:subtitle')}
            showMttrColumn={false}
          />
        </div>
      )}

      {activeTab === 'events' && (
        <Card className="shadow-md animate-fade-in-up">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5 text-amber-500" /> {t('adminOutageMonitor:events.title')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">{t('adminOutageMonitor:events.title')}</caption>
                <thead>
                  <tr className="border-b bg-muted/80">
                    <th className="text-start p-3 font-medium text-muted-foreground">{t('adminOutageMonitor:events.table.provider')}</th>
                    <th className="text-start p-3 font-medium text-muted-foreground">{t('adminOutageMonitor:events.table.start')}</th>
                    <th className="text-start p-3 font-medium text-muted-foreground">{t('adminOutageMonitor:events.table.durationH')}</th>
                    <th className="text-start p-3 font-medium text-muted-foreground">{t('adminOutageMonitor:events.table.source')}</th>
                    <th className="text-start p-3 font-medium text-muted-foreground">{t('adminOutageMonitor:events.table.score')}</th>
                    <th className="text-start p-3 font-medium text-muted-foreground">{t('adminOutageMonitor:events.table.statusCol')}</th>
                  </tr>
                </thead>
                <tbody>
                  {outageEvents.length === 0 ? (
                    <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">
                      <SatelliteDish className="h-10 w-10 mx-auto mb-2 opacity-30" />
                      {t('adminOutageMonitor:events.empty')}
                    </td></tr>
                  ) : (
                    outageEvents.map((e) => {
                      const tierName = getTierName(e.cloudProvider.slaTier);
                      const tierStyle = TIER_STYLES[tierName] || TIER_STYLES.Bronze;
                      return (
                        <tr key={e.id} className="border-b table-row-hover">
                          <td className="p-3">
                            <div>
                              <p className="font-medium">{e.cloudProvider.organisationName}</p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <p className="text-xs text-muted-foreground">AS{e.cloudProvider.asn}</p>
                                <Badge variant="outline" className={tierStyle.badge + ' text-[10px] px-1.5 py-0'}>
                                  {tierName}
                                </Badge>
                              </div>
                            </div>
                          </td>
                          <td className="p-3 text-muted-foreground">{formatDateTime(e.eventStart)}</td>
                          <td className="p-3 font-semibold">{safeToFixed(e.durationHours, 2)}</td>
                          <td className="p-3 text-muted-foreground">{e.datasource}</td>
                          <td className="p-3">{typeof e.score === 'number' ? e.score.toFixed(2) : '—'}</td>
                          <td className="p-3">
                            <Badge variant="outline" title={e.processed ? t('adminOutageMonitor:events.processed') : t('adminOutageMonitor:events.unprocessed')} className={e.processed ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800/30' : 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800/30'}>
                              {e.processed ? t('adminOutageMonitor:events.processed') : t('adminOutageMonitor:events.unprocessed')}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'triggers' && (
        <Card className="shadow-md animate-fade-in-up">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" /> {t('adminOutageMonitor:triggersTab.title')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">{t('adminOutageMonitor:triggersTab.title')}</caption>
                <thead>
                  <tr className="border-b bg-muted/80">
                    <th className="text-start p-3 font-medium text-muted-foreground">{t('adminOutageMonitor:triggersTab.table.provider')}</th>
                    <th className="text-start p-3 font-medium text-muted-foreground">{t('adminOutageMonitor:triggersTab.table.slaTier')}</th>
                    <th className="text-start p-3 font-medium text-muted-foreground">{t('adminOutageMonitor:triggersTab.table.mttrH')}</th>
                    <th className="text-start p-3 font-medium text-muted-foreground">{t('adminOutageMonitor:triggersTab.table.insuredHours')}</th>
                    <th className="text-start p-3 font-medium text-muted-foreground">{t('adminOutageMonitor:triggersTab.table.claimsCreated')}</th>
                    <th className="text-start p-3 font-medium text-muted-foreground">{t('adminOutageMonitor:triggersTab.table.date')}</th>
                  </tr>
                </thead>
                <tbody>
                  {triggers.length === 0 ? (
                    <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">
                      <Zap className="h-10 w-10 mx-auto mb-2 opacity-30" />
                      {t('adminOutageMonitor:triggersTab.empty')}
                    </td></tr>
                  ) : (
                    triggers.map((t_item) => {
                      const tierName = getTierName(t_item.slaTier);
                      const tierStyle = TIER_STYLES[tierName] || TIER_STYLES.Bronze;
                      return (
                        <tr key={t_item.id} className="border-b table-row-hover">
                          <td className="p-3 font-medium">{t_item.cloudProvider.organisationName}</td>
                          <td className="p-3">
                            <Badge variant="outline" className={tierStyle.badge}>
                              {tierName}
                            </Badge>
                          </td>
                          <td className="p-3 text-muted-foreground">{t_item.mttrHours}h</td>
                          <td className="p-3 font-semibold text-primary">{safeToFixed(t_item.insuredHours, 2)}h</td>
                          <td className="p-3">
                            <Badge variant="outline" title={t_item.claimCreated ? t('adminOutageMonitor:triggersTab.yes') : t('adminOutageMonitor:triggersTab.no')} className={t_item.claimCreated ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800/30' : 'bg-muted text-muted-foreground border-border'}>
                              {t_item.claimCreated ? t('adminOutageMonitor:triggersTab.yes') : t('adminOutageMonitor:triggersTab.no')}
                            </Badge>
                          </td>
                          <td className="p-3 text-muted-foreground">{formatDateTime(t_item.createdAt)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'claims' && (
        <Card className="shadow-md animate-fade-in-up">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" /> {t('adminOutageMonitor:claimsTab.title')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">{t('adminOutageMonitor:claimsTab.title')}</caption>
                <thead>
                  <tr className="border-b bg-muted/80">
                    <th className="text-start p-3 font-medium text-muted-foreground">{t('adminOutageMonitor:claimsTab.table.claim')}</th>
                    <th className="text-start p-3 font-medium text-muted-foreground">{t('adminOutageMonitor:claimsTab.table.customer')}</th>
                    <th className="text-start p-3 font-medium text-muted-foreground">{t('adminOutageMonitor:claimsTab.table.policyApp')}</th>
                    <th className="text-start p-3 font-medium text-muted-foreground">{t('adminOutageMonitor:claimsTab.table.statusCol')}</th>
                    <th className="text-start p-3 font-medium text-muted-foreground">{t('adminOutageMonitor:claimsTab.table.declaration')}</th>
                    <th className="text-start p-3 font-medium text-muted-foreground">{t('adminOutageMonitor:claimsTab.table.date')}</th>
                  </tr>
                </thead>
                <tbody>
                  {recentClaims.length === 0 ? (
                    <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">
                      <FileText className="h-10 w-10 mx-auto mb-2 opacity-30" />
                      {t('adminOutageMonitor:claimsTab.empty')}
                    </td></tr>
                  ) : (
                    recentClaims.map((c) => (
                      <tr key={c.id} className="border-b table-row-hover">
                        <td className="p-3 font-medium">{c.claimNumber}</td>
                        <td className="p-3">{c.customer.user.firstName} {c.customer.user.lastName}</td>
                        <td className="p-3 text-muted-foreground">{c.policyApplication?.applicationNumber || '—'}</td>
                        <td className="p-3">
                          <Badge variant="outline" title={c.statusName || c.statusCode} className={getStatusBadge(c.statusCode)}>{c.statusName || c.statusCode}</Badge>
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" title={c.declarationOfLossPdfUrl ? t('adminOutageMonitor:claimsTab.declarationFilled') : t('adminOutageMonitor:claimsTab.declarationMissing')} className={c.declarationOfLossPdfUrl ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800/30' : 'bg-muted text-muted-foreground border-border'}>
                            {c.declarationOfLossPdfUrl ? t('adminOutageMonitor:claimsTab.declarationFilled') : t('adminOutageMonitor:claimsTab.declarationMissing')}
                          </Badge>
                        </td>
                        <td className="p-3 text-muted-foreground">{formatDateTime(c.createdAt)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
      </div>
    </Protected>
  );
}

