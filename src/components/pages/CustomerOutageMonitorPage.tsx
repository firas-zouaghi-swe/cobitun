'use client';

import { useEffect, useState } from 'react';
import { fetchWithAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/lib/store';
import { SatelliteDish, AlertTriangle, CheckCircle, Radio, Activity, Shield, Table2 } from 'lucide-react';
import { PageLoadingState, PageErrorState, PageEmptyState } from '@/components/shared/PageStates';
import IODASignalChart from '@/components/IODASignalChart';
import IODAAlertsTable from '@/components/IODAAlertsTable';
import { formatDateTime } from '@/lib/i18n';
import { safeToFixed } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface OutageRow {
  id: number;
  eventStart: string;
  eventEnd: string;
  durationHours: number;
  datasource: string;
  score: number | null;
  processed: boolean;
  cloudProvider: {
    organisationName: string;
    asn: string;
    slaTier: { tierCode: string; tierName: string } | string;
    mttrHours: number;
  };
}

const TIER_GRADIENTS: Record<string, string> = {
  Platinum: 'from-emerald-500 to-emerald-600',
  Gold: 'from-amber-500 to-amber-600',
  Silver: 'from-gray-400 to-gray-500',
  Bronze: 'from-orange-500 to-orange-600',
};

// Helper to extract tier name from either object or string
function getTierName(slaTier: { tierCode: string; tierName: string } | string): string {
  return typeof slaTier === 'object' ? slaTier.tierName : slaTier;
}

export default function CustomerOutageMonitorPage() {
  const { user, setCurrentPage, setWorkflowContext } = useAppStore();
  const { t } = useTranslation(['customerOutageMonitor', 'common']);
  const [outages, setOutages] = useState<OutageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'signals' | 'alerts' | 'outages'>('signals');

  useEffect(() => {
    if (user?.id) fetchOutages();
  }, [user?.id]);

  const fetchOutages = async () => {
    setLoading(true);
    setError(null);
    try {
      const endpoint = '/api/customer/outage-monitor';
      const res = await fetchWithAuth(endpoint);
      if (!res.ok) throw new Error('Failed to load outage data');
      const data = await res.json();
      setOutages(data.outages || []);
    } catch (err) {
      console.error('Failed to fetch outages:', err);
      setError(t('common:errors.failedToLoad', 'Failed to load outage data. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const isOverMTTR = (outage: OutageRow) => {
    return outage.durationHours > outage.cloudProvider.mttrHours;
  };

  if (loading) {
    return <PageLoadingState message={t('customerOutageMonitor:loading', 'Loading outage data…')} />;
  }

  if (error) {
    return <PageErrorState message={error} onRetry={fetchOutages} />;
  }

  return (
    <div className="page-enter space-y-6">
      <div className="animate-fade-in-down">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <SatelliteDish className="h-6 w-6 text-primary" /> {t('customerOutageMonitor:title')}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">{t('customerOutageMonitor:subtitle')}</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="card-hover-lift stat-card-shimmer animate-fade-in-up stagger-1">
          <CardContent className="p-0">
            <div className="bg-gradient-to-br from-[#2E5A9D] to-[#4A7EC4] p-4 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium opacity-90">{t('customerOutageMonitor:signals.activeOutages')}</p>
                  <p className="text-3xl font-bold mt-1">{outages.filter((o) => !o.processed).length}</p>
                </div>
                <div className="bg-white/20 p-2.5 rounded-xl">
                  <AlertTriangle className="h-6 w-6" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover-lift stat-card-shimmer animate-fade-in-up stagger-2">
          <CardContent className="p-0">
            <div className="bg-gradient-to-br from-amber-500 to-amber-600 p-4 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium opacity-90">{t('customerOutageMonitor:signals.overMTTR')}</p>
                  <p className="text-3xl font-bold mt-1">{outages.filter(isOverMTTR).length}</p>
                </div>
                <div className="bg-white/20 p-2.5 rounded-xl">
                  <Shield className="h-6 w-6" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover-lift stat-card-shimmer animate-fade-in-up stagger-3">
          <CardContent className="p-0">
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-4 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium opacity-90">{t('customerOutageMonitor:signals.providersMonitored')}</p>
                  <p className="text-3xl font-bold mt-1">{new Set(outages.map((o) => o.cloudProvider.asn)).size || '—'}</p>
                </div>
                <div className="bg-white/20 p-2.5 rounded-xl">
                  <SatelliteDish className="h-6 w-6" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 bg-muted rounded-xl p-1 overflow-x-auto" role="tablist" aria-label={t('nav.outageMonitorTabs', 'Outage monitor tabs')}>
        <button
          onClick={() => setActiveTab('signals')}
          role="tab"
          id="tab-signals"
          aria-selected={activeTab === 'signals'}
          aria-controls="tabpanel-signals"
          tabIndex={activeTab === 'signals' ? 0 : -1}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
              e.preventDefault();
              const tabs = ['signals', 'alerts', 'outages'];
              const idx = tabs.indexOf(activeTab);
              const next = e.key === 'ArrowRight' ? tabs[(idx + 1) % tabs.length] : tabs[(idx - 1 + tabs.length) % tabs.length];
              setActiveTab(next as 'signals' | 'alerts' | 'outages');
              document.getElementById('tab-' + next)?.focus();
            }
          }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
            activeTab === 'signals'
              ? 'bg-background text-primary shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
          }`}
        >
          <Radio className="h-4 w-4" /> {t('customerOutageMonitor:tab.liveSignals')}
        </button>
        <button
          onClick={() => setActiveTab('alerts')}
          role="tab"
          id="tab-alerts"
          aria-selected={activeTab === 'alerts'}
          aria-controls="tabpanel-alerts"
          tabIndex={activeTab === 'alerts' ? 0 : -1}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
              e.preventDefault();
              const tabs = ['signals', 'alerts', 'outages'];
              const idx = tabs.indexOf(activeTab);
              const next = e.key === 'ArrowRight' ? tabs[(idx + 1) % tabs.length] : tabs[(idx - 1 + tabs.length) % tabs.length];
              setActiveTab(next as 'signals' | 'alerts' | 'outages');
              document.getElementById('tab-' + next)?.focus();
            }
          }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
            activeTab === 'alerts'
              ? 'bg-background text-primary shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
          }`}
        >
          <Table2 className="h-4 w-4" /> {t('customerOutageMonitor:tab.alertsTable')}
          <Badge className="bg-primary/10 text-primary text-[10px] px-1.5 py-0" title={t('customerOutageMonitor:tab.live')}>{t('customerOutageMonitor:tab.live')}</Badge>
        </button>
        <button
          onClick={() => setActiveTab('outages')}
          role="tab"
          id="tab-outages"
          aria-selected={activeTab === 'outages'}
          aria-controls="tabpanel-outages"
          tabIndex={activeTab === 'outages' ? 0 : -1}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
              e.preventDefault();
              const tabs = ['signals', 'alerts', 'outages'];
              const idx = tabs.indexOf(activeTab);
              const next = e.key === 'ArrowRight' ? tabs[(idx + 1) % tabs.length] : tabs[(idx - 1 + tabs.length) % tabs.length];
              setActiveTab(next as 'signals' | 'alerts' | 'outages');
              document.getElementById('tab-' + next)?.focus();
            }
          }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
            activeTab === 'outages'
              ? 'bg-background text-primary shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
          }`}
        >
          <Activity className="h-4 w-4" /> {t('customerOutageMonitor:tab.outageHistory')}
          {outages.filter((o) => !o.processed).length > 0 && (
            <Badge className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-[10px] px-1.5 py-0" title={t('customerOutageMonitor:tab.outageCount', { count: outages.filter((o) => !o.processed).length })}>
              {outages.filter((o) => !o.processed).length}
            </Badge>
          )}
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'signals' && (
        <div role="tabpanel" aria-labelledby="tab-signals" id="tabpanel-signals" className="animate-fade-in-up">
          <IODASignalChart
            apiEndpoint="/api/customer/signals"
            extraParams={user?.customerId ? { customerId: String(user.customerId) } : undefined}
            showAdminControls={false}
            title={t('customerOutageMonitor:signals.chartTitle')}
            subtitle={t('customerOutageMonitor:signals.chartSubtitle')}
            defaultDatasource="bgp"
            autoRefreshInterval={60}
          />
        </div>
      )}

      {activeTab === 'alerts' && (
        <div role="tabpanel" aria-labelledby="tab-alerts" id="tabpanel-alerts" className="animate-fade-in-up">
          <IODAAlertsTable
            apiEndpoint="/api/customer/ioda-alerts"
            extraParams={user?.customerId ? { customerId: String(user.customerId) } : undefined}
            showAdminControls={false}
            title={t('customerOutageMonitor:alerts.tableTitle')}
            subtitle={t('customerOutageMonitor:alerts.tableSubtitle')}
            showMttrColumn={true}
          />
        </div>
      )}

      {activeTab === 'outages' && (
        <div role="tabpanel" aria-labelledby="tab-outages" id="tabpanel-outages" className="animate-fade-in-up">
          {outages.length === 0 ? (
            <Card className="shadow-md">
              <CardContent className="p-12 text-center">
                <div className="bg-green-100 dark:bg-green-900/30 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
                <p className="text-muted-foreground font-medium">{t('customerOutageMonitor:outages.noOutages')}</p>
                <p className="text-muted-foreground text-sm mt-1">{t('customerOutageMonitor:outages.noOutagesDesc')}</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" /> {t('customerOutageMonitor:outages.recentOutages')}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <caption className="sr-only">{t('customerOutageMonitor:outages.recentOutages')}</caption>
                    <thead>
                      <tr className="border-b bg-muted/80">
                        <th className="text-start p-3 font-medium text-muted-foreground">{t('customerOutageMonitor:outages.provider')}</th>
                        <th className="text-start p-3 font-medium text-muted-foreground">{t('customerOutageMonitor:outages.start')}</th>
                        <th className="text-start p-3 font-medium text-muted-foreground">{t('customerOutageMonitor:outages.end')}</th>
                        <th className="text-start p-3 font-medium text-muted-foreground">{t('customerOutageMonitor:outages.duration')}</th>
                        <th className="text-start p-3 font-medium text-muted-foreground">{t('customerOutageMonitor:outages.severity')}</th>
                        <th className="text-start p-3 font-medium text-muted-foreground">{t('customerOutageMonitor:outages.status')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {outages.map((o) => {
                        const overMttr = isOverMTTR(o);
                        const tierName = getTierName(o.cloudProvider.slaTier);
                        return (
                          <tr key={o.id} className={`border-b ${overMttr ? 'bg-red-50/50 dark:bg-red-900/20 hover:bg-red-100/50 dark:hover:bg-red-900/30' : 'table-row-hover'}`}>
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <div className={`bg-gradient-to-br ${TIER_GRADIENTS[tierName] || 'from-gray-400 to-gray-500'} w-2 h-8 rounded-full shrink-0`} />
                                <div>
                                  <p className="font-medium">{o.cloudProvider.organisationName}</p>
                                  <p className="text-xs text-muted-foreground">{t('customerOutageMonitor:outages.asnMttr', { asn: o.cloudProvider.asn, mttr: o.cloudProvider.mttrHours })}</p>
                                </div>
                              </div>
                            </td>
                            <td className="p-3 text-muted-foreground">{formatDateTime(o.eventStart)}</td>
                            <td className="p-3 text-muted-foreground">{formatDateTime(o.eventEnd)}</td>
                            <td className="p-3">
                              <span className={`font-semibold ${overMttr ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`}>
                                {safeToFixed(o.durationHours, 2)}h
                              </span>
                              {overMttr && (
                                <Badge variant="outline" className="ms-2 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800/30 text-xs" title={t('customerOutageMonitor:outages.overMTTR', 'Exceeds MTTR')}>
                                  <AlertTriangle className="h-3 w-3 me-1" /> &gt; MTTR
                                </Badge>
                              )}
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <div className={`h-2.5 w-2.5 rounded-full ${o.score && o.score > 50 ? 'bg-red-500' : o.score && o.score > 20 ? 'bg-yellow-500' : 'bg-green-500'}`} />
                                <span className="text-muted-foreground">{safeToFixed(o.score, 1)}</span>
                              </div>
                            </td>
                            <td className="p-3">
                              <Badge variant="outline" className={o.processed ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800/30' : 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800/30'} title={o.processed ? t('customerOutageMonitor:outages.processed') : t('customerOutageMonitor:outages.pending')}>
                                {o.processed ? t('customerOutageMonitor:outages.processed') : t('customerOutageMonitor:outages.pending')}
                              </Badge>
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
      )}
    </div>
  );
}

