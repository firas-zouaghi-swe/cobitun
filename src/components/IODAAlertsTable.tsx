'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Activity,
  RefreshCw,
  Calendar,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Radio,
  Wifi,
  Satellite,
  Monitor,
  Search,
  Filter,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowUpDown,
  Zap,
} from 'lucide-react';
import { fetchWithAuth } from '@/hooks/use-auth';

// ==================== TYPES ====================

interface AlertProvider {
  asn: number;
  name: string;
  slaTier?: string;
  mttrHours?: number;
}

interface AlertRow {
  asn: number;
  providerName: string;
  slaTier?: string;
  mttrHours?: number;
  startTs: number;
  endTs: number;
  durationSeconds: number;
  durationHours: number;
  datasource: string;
  score: number;
  method: string;
  status: number;
  entityName: string;
  overlapsWindow?: boolean;
  exceedsMttr?: boolean;
}

interface PaginationInfo {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

interface IODAAlertsTableProps {
  /** API endpoint: '/api/admin/ioda-alerts' or '/api/customer/ioda-alerts' */
  apiEndpoint: string;
  /** Additional query params (e.g. customerId for customer) */
  extraParams?: Record<string, string>;
  /** Whether to show the admin customization controls */
  showAdminControls?: boolean;
  /** Title override */
  title?: string;
  /** Subtitle */
  subtitle?: string;
  /** Show MTTR column (for customer view) */
  showMttrColumn?: boolean;
}

// ==================== CONSTANTS ====================

// DATASOURCES will be built inside the component using i18n

const DATE_PRESETS = [
  { label: '6h', hours: 6 },
  { label: '24h', hours: 24 },
  { label: '3d', hours: 72 },
  { label: '7d', hours: 168 },
  { label: '14d', hours: 336 },
  { label: '30d', hours: 720 },
];

const PAGE_SIZES = [25, 50, 100, 200];

const TIER_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  Platinum: { bg: 'bg-purple-50 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-200 dark:border-purple-800/30' },
  Gold: { bg: 'bg-yellow-50 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-300', border: 'border-yellow-200 dark:border-yellow-800/30' },
  Silver: { bg: 'bg-muted', text: 'text-foreground', border: 'border-border' },
  Bronze: { bg: 'bg-amber-50 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800/30' },
};

// Severity level colors
function getSeverityStyle(score: number, t: (key: string) => string) {
  if (score >= 0.75) return { bg: 'bg-red-50 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300', dot: 'bg-red-500', label: t('ioda:alerts.critical') };
  if (score >= 0.5) return { bg: 'bg-orange-50 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300', dot: 'bg-orange-500', label: t('ioda:alerts.high') };
  if (score >= 0.25) return { bg: 'bg-yellow-50 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-300', dot: 'bg-yellow-500', label: t('ioda:alerts.medium') };
  return { bg: 'bg-blue-50 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', dot: 'bg-blue-500', label: t('ioda:alerts.low') };
}

function getDatasourceStyle(ds: string) {
  const styles: Record<string, { bg: string; text: string; border: string; label: string }> = {
    'bgp': { bg: 'bg-blue-50 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-800/30', label: 'BGP' },
    'ping-slash24': { bg: 'bg-green-50 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300', border: 'border-green-200 dark:border-green-800/30', label: 'Ping /24' },
    'ucsd-nt': { bg: 'bg-purple-50 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-200 dark:border-purple-800/30', label: 'UCSD-NT' },
    'merit-nt': { bg: 'bg-indigo-50 dark:bg-indigo-900/30', text: 'text-indigo-700 dark:text-indigo-300', border: 'border-indigo-200 dark:border-indigo-800/30', label: 'Merit-NT' },
    'gtr': { bg: 'bg-cyan-50 dark:bg-cyan-900/30', text: 'text-cyan-700 dark:text-cyan-300', border: 'border-cyan-200 dark:border-cyan-800/30', label: 'GTR' },
  };
  return styles[ds] || { bg: 'bg-muted', text: 'text-foreground', border: 'border-border', label: ds };
} // Technical labels kept as-is (industry standard abbreviations)

// ==================== COMPONENT ====================

export default function IODAAlertsTable({
  apiEndpoint,
  extraParams,
  showAdminControls = false,
  title,
  subtitle,
  showMttrColumn = false,
}: IODAAlertsTableProps) {
  const { t, i18n } = useTranslation('ioda');

  // Build datasources with i18n
  const DATASOURCES = [
    { value: '', label: t('alerts.allSources'), icon: Activity, description: t('alerts.allSourcesDesc') },
    { value: 'bgp', label: t('alerts.bgpRouting'), icon: Radio, description: t('alerts.bgpDesc') },
    { value: 'ping-slash24', label: t('alerts.activeProbing'), icon: Wifi, description: t('alerts.probingDesc') },
    { value: 'ucsd-nt', label: t('alerts.ucsdTelescope'), icon: Satellite, description: t('alerts.ucsdDesc') },
    { value: 'merit-nt', label: t('alerts.meritTelescope'), icon: Satellite, description: t('alerts.meritDesc') },
    { value: 'gtr', label: t('alerts.googleTransparency'), icon: Monitor, description: t('alerts.gtrDesc') },
  ];

  const resolvedTitle = title || t('alerts.defaultTitle');
  const resolvedSubtitle = subtitle || t('alerts.defaultSubtitle');

  // Data state
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [providers, setProviders] = useState<AlertProvider[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({ page: 1, pageSize: 50, totalItems: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Filter state
  const [alertType, setAlertType] = useState<'events' | 'alerts'>('events');
  const [hoursBack, setHoursBack] = useState(168); // 7 days default
  const [datasource, setDatasource] = useState('');
  const [selectedAsns, setSelectedAsns] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('start');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // UI state
  const [showAsnDropdown, setShowAsnDropdown] = useState(false);
  const [showDatasourceDropdown, setShowDatasourceDropdown] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ==================== DATA FETCHING ====================

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const until = Date.now();
      const from = until - hoursBack * 3600 * 1000;

      const params = new URLSearchParams({
        from: from.toString(),
        until: until.toString(),
        alertType,
        page: page.toString(),
        pageSize: pageSize.toString(),
        sortBy,
        sortOrder,
      });

      if (datasource) {
        params.set('datasource', datasource);
      }

      // Add selected ASNs if admin mode and specific ones are chosen
      if (showAdminControls && selectedAsns.size > 0 && selectedAsns.size < providers.length) {
        params.set('asns', Array.from(selectedAsns).join(','));
      }

      // Add search
      if (searchQuery.trim()) {
        params.set('search', searchQuery.trim());
      }

      // Add extra params
      if (extraParams) {
        Object.entries(extraParams).forEach(([k, v]) => params.set(k, v));
      }

      const res = await fetchWithAuth(`${apiEndpoint}?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch alerts');
      }

      setAlerts(data.alerts || []);
      setProviders(data.providers || []);
      setPagination(data.pagination || { page, pageSize, totalItems: 0, totalPages: 0 });
      setLastRefresh(new Date());

      // Initialize selected ASNs if not set (admin mode)
      if (showAdminControls && selectedAsns.size === 0 && data.providers?.length > 0) {
        setSelectedAsns(new Set(data.providers.map((p: AlertProvider) => p.asn)));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [apiEndpoint, alertType, hoursBack, datasource, selectedAsns, searchQuery, sortBy, sortOrder, page, pageSize, extraParams, showAdminControls, providers.length]);

  // Fetch on mount and when filters change
  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  // Reset to page 1 when filters change (not page itself)
  useEffect(() => {
    if (page !== 1) setPage(1);
  }, [alertType, hoursBack, datasource, selectedAsns, searchQuery, sortBy, sortOrder]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowAsnDropdown(false);
        setShowDatasourceDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ==================== ASN TOGGLE ====================

  const toggleAsn = (asn: number) => {
    setSelectedAsns((prev) => {
      const next = new Set(prev);
      if (next.has(asn)) {
        next.delete(asn);
      } else {
        next.add(asn);
      }
      return next;
    });
  };

  const selectAllAsns = () => {
    setSelectedAsns(new Set(providers.map((p) => p.asn)));
  };

  const selectNoneAsns = () => {
    setSelectedAsns(new Set());
  };

  // ==================== SORT ====================

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortBy !== column) return <ArrowUpDown className="h-3 w-3 ml-1 text-muted-foreground/50" />;
    return sortOrder === 'asc'
      ? <ChevronUp className="h-3 w-3 ml-1 text-primary" />
      : <ChevronDown className="h-3 w-3 ml-1 text-primary" />;
  };

  // ==================== SUMMARY STATS ====================

  const criticalCount = alerts.filter((a) => a.score >= 0.75).length;
  const highCount = alerts.filter((a) => a.score >= 0.5 && a.score < 0.75).length;
  const activeCount = alerts.filter((a) => a.status !== 0).length;
  const exceedsMttrCount = alerts.filter((a) => a.exceedsMttr).length;

  // ==================== RENDER ====================

  return (
    <div className="space-y-4">
      {/* Header + Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            {resolvedTitle}
          </h3>
          <p className="text-muted-foreground text-sm mt-0.5">{resolvedSubtitle}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Last refresh */}
          {lastRefresh && (
            <span className="text-xs text-muted-foreground">
              {t('signal.updated', { time: lastRefresh.toLocaleTimeString(i18n.language === 'ar' ? 'ar-TN' : i18n.language === 'fr' ? 'fr-TN' : undefined) })}
            </span>
          )}

          {/* Refresh button */}
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAlerts}
            disabled={loading}
            className="border-primary/30 text-primary hover:bg-primary/5"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Summary Badges */}
      {alerts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800/30">
            <AlertTriangle className="h-3 w-3 mr-1" /> {criticalCount} {t('alerts.critical')}
          </Badge>
          <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800/30">
            {highCount} {t('alerts.high')}
          </Badge>
          {activeCount > 0 && (
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800/30 animate-pulse">
              <Zap className="h-3 w-3 mr-1" /> {activeCount} {t('alerts.active')}
            </Badge>
          )}
          {showMttrColumn && exceedsMttrCount > 0 && (
            <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800/30">
              <Clock className="h-3 w-3 mr-1" /> {exceedsMttrCount} {t('alerts.overMTTR')}
            </Badge>
          )}
          <Badge variant="outline" className="bg-muted text-muted-foreground border-border">
            {pagination.totalItems} {t('alerts.totalAlerts')}
          </Badge>
        </div>
      )}

      {/* Control Bar */}
      <Card className="shadow-sm border-border">
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-3" ref={dropdownRef}>
            {/* Date Range Presets */}
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
              <Calendar className="h-4 w-4 text-muted-foreground ml-2" />
              {DATE_PRESETS.map((preset) => (
                <button
                  key={preset.hours}
                  onClick={() => setHoursBack(preset.hours)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                    hoursBack === preset.hours
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Alert Type Toggle */}
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
              <Activity className="h-3.5 w-3.5 text-muted-foreground ml-1.5" />
              <button
                onClick={() => setAlertType('events')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  alertType === 'events'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                {t('alerts.events')}
              </button>
              <button
                onClick={() => setAlertType('alerts')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  alertType === 'alerts'
                    ? 'bg-[#E5693A] text-white shadow-sm'
                    : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                {t('alerts.rawAlerts')}
              </button>
            </div>

            {/* Datasource Selector */}
            <div className="relative">
              <button
                onClick={() => { setShowDatasourceDropdown(!showDatasourceDropdown); setShowAsnDropdown(false); }}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium border border-border rounded-lg bg-popover hover:bg-muted/80 transition-all"
              >
                {datasource ? (
                  <>
                    {(() => { const ds = DATASOURCES.find(d => d.value === datasource); return ds?.icon && <ds.icon className="h-3.5 w-3.5 text-primary" />; })()}
                    {DATASOURCES.find(d => d.value === datasource)?.label || datasource}
                  </>
                ) : (
                  <>
                    <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                    {t('alerts.allSources')}
                  </>
                )}
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              </button>
              {showDatasourceDropdown && (
                <div className="absolute top-full left-0 mt-1 bg-popover border border-border rounded-lg shadow-xl z-50 min-w-[240px] py-1">
                  {DATASOURCES.map((ds) => (
                    <button
                      key={ds.value}
                      onClick={() => { setDatasource(ds.value); setShowDatasourceDropdown(false); }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/80 transition-all ${
                        datasource === ds.value ? 'bg-primary/5 text-primary' : 'text-foreground'
                      }`}
                    >
                      <ds.icon className="h-4 w-4 shrink-0" />
                      <div>
                        <p className="text-sm font-medium">{ds.label}</p>
                        <p className="text-xs text-muted-foreground">{ds.description}</p>
                      </div>
                      {datasource === ds.value && (
                        <div className="ml-auto w-2 h-2 bg-primary rounded-full" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ASN Selector (Admin only) */}
            {showAdminControls && providers.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => { setShowAsnDropdown(!showAsnDropdown); setShowDatasourceDropdown(false); }}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium border border-border rounded-lg bg-popover hover:bg-muted/80 transition-all"
                >
                  <Radio className="h-3.5 w-3.5 text-[#E5693A]" />
                  {selectedAsns.size === 0 ? 'No ASNs' : selectedAsns.size === providers.length ? 'All ASNs' : `${selectedAsns.size} ASNs`}
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </button>
                {showAsnDropdown && (
                  <div className="absolute top-full left-0 mt-1 bg-popover border border-border rounded-lg shadow-xl z-50 min-w-[300px] max-h-[400px] overflow-y-auto py-1">
                    <div className="flex items-center justify-between px-4 py-2 border-b border-border/50">
                      <span className="text-xs font-semibold text-muted-foreground uppercase">{t('alerts.selectAsns')}</span>
                      <div className="flex gap-2">
                        <button onClick={selectAllAsns} className="text-xs text-primary hover:underline">{t('alerts.all')}</button>
                        <button onClick={selectNoneAsns} className="text-xs text-muted-foreground hover:underline">{t('alerts.none')}</button>
                      </div>
                    </div>
                    {providers.map((provider) => (
                      <button
                        key={provider.asn}
                        onClick={() => toggleAsn(provider.asn)}
                        className={`w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-muted/80 transition-all ${
                          selectedAsns.has(provider.asn) ? 'bg-muted' : ''
                        }`}
                      >
                        <div
                          className="w-3 h-3 rounded-full shrink-0 border-2 flex items-center justify-center"
                          style={{
                            borderColor: selectedAsns.has(provider.asn) ? 'var(--primary)' : '#d1d5db',
                            backgroundColor: selectedAsns.has(provider.asn) ? 'var(--primary)' : 'transparent',
                          }}
                        >
                          {selectedAsns.has(provider.asn) && (
                            <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 12 12">
                              <path d="M10 3L4.5 8.5 2 6" stroke="currentColor" strokeWidth="2" fill="none" />
                            </svg>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{provider.name}</p>
                          <p className="text-xs text-muted-foreground">AS{provider.asn}{provider.slaTier ? ` · ${provider.slaTier}` : ''}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Search (Admin only) */}
            {showAdminControls && (
              <div className="relative">
                <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  placeholder={t('alerts.searchProvider')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-8 text-xs w-40 border-border focus:border-primary focus:ring-primary/20"
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Alerts Table */}
      <Card className="shadow-md border-0 overflow-hidden">
        <CardHeader className="pb-3 bg-gradient-to-r from-muted to-background border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              {alertType === 'events' ? t('alerts.correlatedEvents') : t('alerts.rawDetectionAlerts')}
            </CardTitle>
            <div className="flex items-center gap-2">
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                className="text-xs border border-border rounded-lg px-2 py-1.5 bg-popover focus:border-primary focus:ring-primary/20"
              >
                {PAGE_SIZES.map((s) => (
                  <option key={s} value={s}>{t('alerts.perPage', { size: s })}</option>
                ))}
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading && alerts.length === 0 ? (
            // Loading skeleton
            <div className="h-[300px] flex items-center justify-center">
              <div className="text-center">
                <RefreshCw className="h-10 w-10 text-primary mx-auto mb-3 animate-spin" />
                <p className="text-muted-foreground font-medium">{t('alerts.fetching')}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('alerts.querying', { type: alertType === 'events' ? t('alerts.correlatedEvents') : t('alerts.rawAlerts') })}
                </p>
              </div>
            </div>
          ) : error ? (
            // Error state
            <div className="h-[300px] flex items-center justify-center">
              <div className="text-center">
                <div className="bg-red-100 dark:bg-red-900/30 w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <AlertTriangle className="h-7 w-7 text-red-500" />
                </div>
                <p className="text-red-600 dark:text-red-400 font-medium">{t('alerts.failedToLoad')}</p>
                <p className="text-muted-foreground text-sm mt-1">{error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchAlerts}
                  className="mt-3 border-red-200 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
                >
                  <RefreshCw className="h-4 w-4 mr-2" /> {t('action.retry', { ns: 'common' })}
                </Button>
              </div>
            </div>
          ) : alerts.length === 0 ? (
            // Empty state
            <div className="h-[300px] flex items-center justify-center">
              <div className="text-center">
                <div className="bg-green-100 dark:bg-green-900/30 w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="h-7 w-7 text-green-600" />
                </div>
                <p className="text-muted-foreground font-medium">{t('alerts.noAlerts')}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('alerts.noAlertsSubtitle', { type: alertType })}
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/80">
                      <th
                        className="text-left p-3 font-medium text-muted-foreground cursor-pointer hover:text-primary transition-colors select-none"
                        onClick={() => handleSort('provider')}
                      >
                        <span className="flex items-center">{t('alerts.tableProvider')} <SortIcon column="provider" /></span>
                      </th>
                      <th
                        className="text-left p-3 font-medium text-muted-foreground cursor-pointer hover:text-primary transition-colors select-none"
                        onClick={() => handleSort('start')}
                      >
                        <span className="flex items-center">{t('alerts.tableStart')} <SortIcon column="start" /></span>
                      </th>
                      <th
                        className="text-left p-3 font-medium text-muted-foreground cursor-pointer hover:text-primary transition-colors select-none"
                        onClick={() => handleSort('duration')}
                      >
                        <span className="flex items-center">{t('alerts.tableDuration')} <SortIcon column="duration" /></span>
                      </th>
                      <th
                        className="text-left p-3 font-medium text-muted-foreground cursor-pointer hover:text-primary transition-colors select-none"
                        onClick={() => handleSort('score')}
                      >
                        <span className="flex items-center">{t('alerts.tableSeverity')} <SortIcon column="score" /></span>
                      </th>
                      <th className="text-left p-3 font-medium text-muted-foreground">{t('alerts.tableSource')}</th>
                      {showMttrColumn && (
                        <th className="text-left p-3 font-medium text-muted-foreground">MTTR</th>
                      )}
                      <th className="text-left p-3 font-medium text-muted-foreground">{t('alerts.tableStatus')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alerts.map((alert, idx) => {
                      const severity = getSeverityStyle(alert.score, t);
                      const dsStyle = getDatasourceStyle(alert.datasource);
                      const tierStyle = alert.slaTier ? TIER_STYLES[alert.slaTier] : null;

                      return (
                        <tr
                          key={`${alert.asn}-${alert.startTs}-${idx}`}
                          className={`border-b transition-colors ${
                            alert.exceedsMttr
                              ? 'bg-red-50/40 hover:bg-red-100/50'
                              : alert.score >= 0.75
                              ? 'bg-red-50/20 hover:bg-red-50/40'
                              : 'hover:bg-muted/80'
                          }`}
                        >
                          {/* Provider */}
                          <td className="p-3">
                            <div className="flex items-center gap-2.5">
                              {tierStyle && (
                                <div className={`w-1.5 h-8 rounded-full shrink-0 ${
                                  alert.slaTier === 'Platinum' ? 'bg-purple-500' :
                                  alert.slaTier === 'Gold' ? 'bg-yellow-500' :
                                  alert.slaTier === 'Silver' ? 'bg-muted-foreground' :
                                  'bg-amber-500'
                                }`} />
                              )}
                              <div>
                                <p className="font-medium text-foreground">{alert.providerName}</p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-xs text-muted-foreground">AS{alert.asn}</span>
                                  {tierStyle && (
                                    <Badge variant="outline" className={`${tierStyle.bg} ${tierStyle.text} ${tierStyle.border} text-[10px] px-1.5 py-0 h-4`}>
                                      {alert.slaTier}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Start Time */}
                          <td className="p-3">
                            <div className="flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <div>
                                <p className="text-foreground">{new Date(alert.startTs).toLocaleDateString(i18n.language === 'ar' ? 'ar-TN' : i18n.language === 'fr' ? 'fr-TN' : undefined, { month: 'short', day: 'numeric' })}</p>
                                <p className="text-xs text-muted-foreground">{new Date(alert.startTs).toLocaleTimeString(i18n.language === 'ar' ? 'ar-TN' : i18n.language === 'fr' ? 'fr-TN' : undefined, { hour: '2-digit', minute: '2-digit' })}</p>
                              </div>
                            </div>
                          </td>

                          {/* Duration */}
                          <td className="p-3">
                            <span className={`font-semibold ${
                              alert.exceedsMttr ? 'text-red-600 dark:text-red-400' :
                              alert.durationHours >= 8 ? 'text-orange-600 dark:text-orange-400' :
                              alert.durationHours >= 2 ? 'text-yellow-600 dark:text-yellow-400' :
                              'text-foreground'
                            }`}>
                              {alert.durationHours < 1
                                ? `${(alert.durationHours * 60).toFixed(0)}min`
                                : alert.durationHours < 24
                                ? `${alert.durationHours.toFixed(1)}h`
                                : `${(alert.durationHours / 24).toFixed(1)}d`
                              }
                            </span>
                            {alert.exceedsMttr && (
                              <Badge variant="outline" className="ml-1.5 bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800/30 text-[10px] px-1.5 py-0 h-4">
                                &gt;MTTR
                              </Badge>
                            )}
                          </td>

                          {/* Severity */}
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <div className={`h-2.5 w-2.5 rounded-full ${severity.dot} ${alert.score >= 0.75 ? 'animate-pulse' : ''}`} />
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className={`text-xs font-medium ${severity.text}`}>{severity.label}</span>
                                  <span className="text-xs text-muted-foreground">{alert.score.toFixed(2)}</span>
                                </div>
                                <div className="mt-0.5 bg-muted-foreground/20 rounded-full h-1.5 w-24 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${severity.dot}`}
                                    style={{ width: `${alert.score * 100}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Datasource */}
                          <td className="p-3">
                            <Badge variant="outline" className={`${dsStyle.bg} ${dsStyle.text} ${dsStyle.border} text-xs`}>
                              {dsStyle.label}
                            </Badge>
                          </td>

                          {/* MTTR column (customer only) */}
                          {showMttrColumn && (
                            <td className="p-3">
                              <div className="flex items-center gap-1.5">
                                <span className={`text-sm ${alert.exceedsMttr ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-muted-foreground'}`}>
                                  {alert.mttrHours}h
                                </span>
                                {alert.exceedsMttr ? (
                                  <XCircle className="h-4 w-4 text-red-500" />
                                ) : (
                                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                                )}
                              </div>
                            </td>
                          )}

                          {/* Status */}
                          <td className="p-3">
                            <Badge
                              variant="outline"
                              className={
                                alert.status === 0
                                  ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800/30'
                                  : alert.status === 1
                                  ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800/30'
                                  : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800/30'
                              }
                            >
                              {alert.status === 0 ? (
                                <><CheckCircle2 className="h-3 w-3 mr-1" /> {t('alerts.resolved')}</>
                              ) : alert.status === 1 ? (
                                <><AlertTriangle className="h-3 w-3 mr-1" /> {t('alerts.ongoing')}</>
                              ) : (
                                <><XCircle className="h-3 w-3 mr-1" /> {t('alerts.unknown')}</>
                              )}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/50">
                <div className="text-xs text-muted-foreground">
                  {t('alerts.showing', { from: (page - 1) * pageSize + 1, to: Math.min(page * pageSize, pagination.totalItems), total: pagination.totalItems })}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage(1)}
                    className="h-8 w-8 p-0 border-border"
                  >
                    <ChevronLeft className="h-3 w-3" />
                    <ChevronLeft className="h-3 w-3 -ml-2" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                    className="h-8 w-8 p-0 border-border"
                  >
                    <ChevronLeft className="h-3 w-3" />
                  </Button>

                  {/* Page numbers */}
                  {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (pagination.totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (page <= 3) {
                      pageNum = i + 1;
                    } else if (page >= pagination.totalPages - 2) {
                      pageNum = pagination.totalPages - 4 + i;
                    } else {
                      pageNum = page - 2 + i;
                    }
                    return (
                      <Button
                        key={pageNum}
                        variant={pageNum === page ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setPage(pageNum)}
                        className={`h-8 w-8 p-0 ${
                          pageNum === page
                            ? 'bg-primary hover:bg-primary/90'
                            : 'border-border hover:border-primary/30'
                        }`}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}

                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= pagination.totalPages}
                    onClick={() => setPage(page + 1)}
                    className="h-8 w-8 p-0 border-border"
                  >
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= pagination.totalPages}
                    onClick={() => setPage(pagination.totalPages)}
                    className="h-8 w-8 p-0 border-border"
                  >
                    <ChevronRight className="h-3 w-3" />
                    <ChevronRight className="h-3 w-3 -ml-2" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

