'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTheme } from 'next-themes';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/lib/store';
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  Activity,
  RefreshCw,
  Calendar,
  ChevronDown,
  Wifi,
  Radio,
  Satellite,
  Monitor,
} from 'lucide-react';
import { fetchWithAuth } from '@/hooks/use-auth';

// ==================== TYPES ====================

export interface SignalProvider {
  asn: number;
  name: string;
}

interface SignalData {
  asn: number;
  providerName: string;
  datasource: string;
  from: number;
  until: number;
  step: number;
  timestamps: number[];
  values: (number | null)[];
}

interface ChartDataPoint {
  time: number;
  timeLabel: string;
  [asnKey: string]: number | string | null;
}

interface IODASignalChartProps {
  /** API endpoint: '/api/admin/signals' or '/api/customer/signals' */
  apiEndpoint: string;
  /** Additional query params (e.g. customerId for customer) */
  extraParams?: Record<string, string>;
  /** Available providers (for ASN selector in admin) */
  availableProviders?: SignalProvider[];
  /** Whether to show the admin customization controls */
  showAdminControls?: boolean;
  /** Title override */
  title?: string;
  /** Subtitle */
  subtitle?: string;
  /** Default datasource */
  defaultDatasource?: string;
  /** Auto-refresh interval in seconds (0 = disabled) */
  autoRefreshInterval?: number;
}

// ==================== CONSTANTS ====================

// DATASOURCES will be built inside the component using i18n

const DATE_PRESETS = [
  { label: '6h', hours: 6 },
  { label: '24h', hours: 24 },
  { label: '3d', hours: 72 },
  { label: '7d', hours: 168 },
  { label: '30d', hours: 720 },
];

// Distinct colors for each ASN line (Tunis Re palette extended)
const ASN_COLORS = [
  '#2E5A9D', '#E5693A', '#3C68A9', '#4A7EC4', '#F08B65',
  '#1E3A6B', '#0F3460', '#16213E', '#C44D20', '#28A745',
  '#6C757D', '#FFC107', '#17A2B8', '#DC3545', '#6F42C1',
];

// ==================== COMPONENT ====================

export default function IODASignalChart({
  apiEndpoint,
  extraParams,
  availableProviders: externalProviders,
  showAdminControls = false,
  title,
  subtitle,
  defaultDatasource = 'bgp',
  autoRefreshInterval = 0,
}: IODASignalChartProps) {
  const { resolvedTheme } = useTheme();
  const { t, i18n } = useTranslation('ioda');

  // Build datasources with i18n
  const DATASOURCES = [
    { value: 'bgp', label: t('alerts.bgpRouting'), icon: Radio, description: t('alerts.bgpDesc') },
    { value: 'ping-slash24', label: t('alerts.activeProbing'), icon: Wifi, description: t('alerts.probingDesc') },
    { value: 'ucsd-nt', label: t('alerts.ucsdTelescope'), icon: Satellite, description: t('alerts.ucsdDesc') },
    { value: 'merit-nt', label: t('alerts.meritTelescope'), icon: Satellite, description: t('alerts.meritDesc') },
    { value: 'gtr', label: t('alerts.googleTransparency'), icon: Monitor, description: t('alerts.gtrDesc') },
  ];

  const resolvedTitle = title || t('signal.defaultTitle');
  const resolvedSubtitle = subtitle || t('signal.defaultSubtitle');
  // State
  const [signals, setSignals] = useState<Record<string, SignalData>>({});
  const [providers, setProviders] = useState<SignalProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Controls
  const [datasource, setDatasource] = useState(defaultDatasource);
  const [signalType, setSignalType] = useState<'raw' | 'events'>('raw');
  const [hoursBack, setHoursBack] = useState(24);
  const [selectedAsns, setSelectedAsns] = useState<Set<number>>(new Set());
  const [showAsnDropdown, setShowAsnDropdown] = useState(false);
  const [showDatasourceDropdown, setShowDatasourceDropdown] = useState(false);

  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const authUser = useAppStore((state) => state.user);

  // ==================== DATA FETCHING ====================

  const fetchSignals = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const until = Date.now();
      const from = until - hoursBack * 3600 * 1000;

      const params = new URLSearchParams({
        from: from.toString(),
        until: until.toString(),
        datasource,
        signalType,
        maxPoints: '500',
      });

      // Add selected ASNs if admin mode
      if (showAdminControls && selectedAsns.size > 0 && selectedAsns.size < providers.length) {
        params.set('asns', Array.from(selectedAsns).join(','));
      }

      // Add extra params (e.g. customerId)
      if (extraParams) {
        Object.entries(extraParams).forEach(([k, v]) => params.set(k, v));
      }

      const res = await fetchWithAuth(`${apiEndpoint}?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch signals');
      }

      setSignals(data.signals || {});
      setProviders(data.providers || []);
      setLastRefresh(new Date());

      // Initialize selected ASNs if not set
      if (selectedAsns.size === 0 && data.providers?.length > 0) {
        setSelectedAsns(new Set(data.providers.map((p: SignalProvider) => p.asn)));
      }
    } catch (err) {
      console.error('Signal fetch error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [apiEndpoint, datasource, signalType, hoursBack, selectedAsns, extraParams, showAdminControls, externalProviders]);

  // Initial fetch
  useEffect(() => {
    fetchSignals();
  }, [fetchSignals, authUser?.id, authUser?.role]);

  // Auto-refresh
  useEffect(() => {
    if (autoRefreshInterval > 0) {
      refreshTimerRef.current = setInterval(fetchSignals, autoRefreshInterval * 1000);
    }
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [autoRefreshInterval, fetchSignals]);

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

  // ==================== CHART DATA TRANSFORMATION ====================

  const buildChartData = (): { data: ChartDataPoint[]; chartConfig: ChartConfig } => {
    // Get all unique timestamps across all signals
    const allTimestamps = new Set<number>();
    Object.values(signals).forEach((signal) => {
      signal.timestamps.forEach((t) => allTimestamps.add(t));
    });

    const sortedTimestamps = Array.from(allTimestamps).sort((a, b) => a - b);

    // Build chart config
    const chartConfig: ChartConfig = {};

    // Build chart data
    const data: ChartDataPoint[] = sortedTimestamps.map((time) => {
      const point: ChartDataPoint = {
        time,
        timeLabel: formatTime(time),
      };

      Object.values(signals).forEach((signal, index) => {
        const asnKey = `asn_${signal.asn}`;
        const color = ASN_COLORS[index % ASN_COLORS.length];

        // Build a fast lookup map from timestamp -> value for this signal
        const valueMap = new Map<number, number | null>();
        for (let i = 0; i < signal.timestamps.length; i++) {
          valueMap.set(signal.timestamps[i], signal.values[i]);
        }

        const value = valueMap.has(time) ? valueMap.get(time) ?? null : null;

        // Preserve nulls so chart gaps at boundary timestamps do not create false zero dips
        point[asnKey] = value;

        if (!chartConfig[asnKey]) {
          chartConfig[asnKey] = {
            label: signal.providerName,
            color,
          };
        }
      });

      return point;
    });

    return { data, chartConfig };
  };

  const localeForFormat = i18n.language === 'ar' ? 'ar-TN' : i18n.language === 'fr' ? 'fr-TN' : undefined;

  const formatTime = (ms: number): string => {
    const d = new Date(ms);
    if (hoursBack <= 24) {
      return d.toLocaleTimeString(localeForFormat, { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString(localeForFormat, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const formatTooltipTime = (ms: number): string => {
    return new Date(ms).toLocaleString(localeForFormat, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  const { data: chartData, chartConfig } = buildChartData();

  // Detect outage dips (where signal drops below threshold)
  const activeAlerts = Object.entries(signals).filter(([, signal]) => {
    const recentValues = signal.values.slice(-6).filter((v): v is number => v !== null);
    if (recentValues.length === 0) return false;
    const avg = recentValues.reduce((sum: number, v: number) => sum + v, 0) / recentValues.length;
    if (signalType === 'raw') {
      return avg < 0.5; // Below 50% connectivity = outage
    } else {
      return avg > 0; // Any non-zero = outage event detected
    }
  });

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

  // Filter chart data to only selected ASNs
  const filteredChartData = chartData;
  const filteredChartConfig: ChartConfig = {};
  let idx = 0;
  Object.entries(chartConfig).forEach(([key, config]) => {
    const asn = parseInt(key.replace('asn_', ''));
    if (selectedAsns.size === 0 || selectedAsns.has(asn)) {
      const { color: _existingColor, theme: _existingTheme, ...restConfig } = config;
      filteredChartConfig[key] = { ...restConfig, color: ASN_COLORS[idx % ASN_COLORS.length] };
      idx++;
    }
  });

  // ==================== RENDER ====================

  const currentDatasourceInfo = DATASOURCES.find((d) => d.value === datasource);

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
          {/* Active alerts badge */}
          {activeAlerts.length > 0 && (
            <Badge className="bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800/30 animate-pulse">
              {t('signal.activeAlert', { count: activeAlerts.length })}
            </Badge>
          )}

          {/* Last refresh */}
          {lastRefresh && (
            <span className="text-xs text-muted-foreground">
              {t('signal.updated', { time: lastRefresh.toLocaleTimeString(localeForFormat) })}
            </span>
          )}

          {/* Refresh button */}
          <Button
            variant="outline"
            size="sm"
            onClick={fetchSignals}
            disabled={loading}
            className="border-primary/30 text-primary hover:bg-primary/5"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Control Bar */}
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

        {/* Datasource Selector */}
        <div className="relative">
          <button
            onClick={() => { setShowDatasourceDropdown(!showDatasourceDropdown); setShowAsnDropdown(false); }}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium border border-border rounded-lg bg-popover hover:bg-muted/80 transition-all"
          >
            {currentDatasourceInfo?.icon && <currentDatasourceInfo.icon className="h-3.5 w-3.5 text-primary" />}
            {currentDatasourceInfo?.label || datasource}
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

        {/* Signal Type Toggle: Raw (connectivity %) vs Events (outage signals) */}
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          <Activity className="h-3.5 w-3.5 text-muted-foreground ml-1.5" />
          <button
            onClick={() => setSignalType('raw')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              signalType === 'raw'
                ? 'bg-primary text-white shadow-sm'
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            {t('signal.connectivity')}
          </button>
          <button
            onClick={() => setSignalType('events')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              signalType === 'events'
                ? 'bg-[#E5693A] text-white shadow-sm'
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            {t('signal.outageEvents')}
          </button>
        </div>

        {/* ASN Selector (Admin only) */}
        {showAdminControls && providers.length > 0 && (
          <div className="relative">
            <button
              onClick={() => { setShowAsnDropdown(!showAsnDropdown); setShowDatasourceDropdown(false); }}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium border border-border rounded-lg bg-popover hover:bg-muted/80 transition-all"
            >
              <Radio className="h-3.5 w-3.5 text-[#E5693A]" />
              {selectedAsns.size === providers.length ? t('signal.allAsns') : `${selectedAsns.size} ASNs`}
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </button>
            {showAsnDropdown && (
              <div className="absolute top-full left-0 mt-1 bg-popover border border-border rounded-lg shadow-xl z-50 min-w-[280px] max-h-[360px] overflow-y-auto py-1">
                <div className="flex items-center justify-between px-4 py-2 border-b border-border/50">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">{t('alerts.selectAsns')}</span>
                  <div className="flex gap-2">
                    <button onClick={selectAllAsns} className="text-xs text-primary hover:underline">{t('alerts.all')}</button>
                    <button onClick={selectNoneAsns} className="text-xs text-muted-foreground hover:underline">{t('alerts.none')}</button>
                  </div>
                </div>
                {providers.map((provider, index) => (
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
                        borderColor: selectedAsns.has(provider.asn) ? ASN_COLORS[index % ASN_COLORS.length] : '#d1d5db',
                        backgroundColor: selectedAsns.has(provider.asn) ? ASN_COLORS[index % ASN_COLORS.length] : 'transparent',
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
                      <p className="text-xs text-muted-foreground">AS{provider.asn}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Auto-refresh toggle */}
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          <span className="text-xs text-muted-foreground px-2">{t('signal.live')}</span>
          {[0, 30, 60, 300].map((sec) => (
            <button
              key={sec}
              onClick={() => {/* autoRefreshInterval is controlled by parent */}}
              className={`px-2 py-1 text-xs font-medium rounded-md transition-all ${
                autoRefreshInterval === sec
                  ? 'bg-[#E5693A] text-white shadow-sm'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
              title={sec === 0 ? t('signal.off') : `Every ${sec >= 60 ? `${sec / 60}min` : `${sec}s`}`}
            >
              {sec === 0 ? t('signal.off') : sec >= 60 ? `${sec / 60}m` : `${sec}s`}
            </button>
          ))}
        </div>
      </div>

      {/* Main Chart */}
      <Card className="shadow-md border-0 overflow-hidden">
        <CardContent className="p-4 md:p-6">
          {loading && Object.keys(signals).length === 0 ? (
            // Loading skeleton
            <div className="h-[400px] flex items-center justify-center">
              <div className="text-center">
                <RefreshCw className="h-10 w-10 text-primary mx-auto mb-3 animate-spin" />
                <p className="text-muted-foreground font-medium">{t('signal.fetching')}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('signal.connecting')}
                </p>
              </div>
            </div>
          ) : error ? (
            // Error state
            <div className="h-[400px] flex items-center justify-center">
              <div className="text-center">
                <div className="bg-red-100 dark:bg-red-900/30 w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Activity className="h-7 w-7 text-red-500" />
                </div>
                <p className="text-red-600 dark:text-red-400 font-medium">{t('signal.failedToLoad')}</p>
                <p className="text-muted-foreground text-sm mt-1">{error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchSignals}
                  className="mt-3 border-red-200 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
                >
                  <RefreshCw className="h-4 w-4 mr-2" /> {t('action.retry', { ns: 'common' })}
                </Button>
              </div>
            </div>
          ) : Object.keys(filteredChartConfig).length === 0 ? (
            // Empty state
            <div className="h-[400px] flex items-center justify-center">
              <div className="text-center">
                <div className="bg-green-100 dark:bg-green-900/30 w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Wifi className="h-7 w-7 text-green-600" />
                </div>
                <p className="text-muted-foreground font-medium">{t('signal.noData')}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('signal.noDataSubtitle')}
                </p>
              </div>
            </div>
          ) : (
            // Chart
            <ChartContainer config={filteredChartConfig} className="h-[400px] w-full">
              <AreaChart data={filteredChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  {Object.entries(filteredChartConfig).map(([key, config]) => (
                    <linearGradient key={key} id={`gradient-${key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={config.color as string} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={config.color as string} stopOpacity={0.02} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={resolvedTheme === 'dark' ? 'rgba(255,255,255,0.08)' : '#e5e7eb'} strokeOpacity={0.5} />
                <XAxis
                  dataKey="timeLabel"
                  tick={{ fontSize: 11, fill: resolvedTheme === 'dark' ? '#8A8A9A' : '#9ca3af' }}
                  tickLine={false}
                  axisLine={{ stroke: resolvedTheme === 'dark' ? 'rgba(255,255,255,0.08)' : '#e5e7eb' }}
                  interval="preserveStartEnd"
                  minTickGap={60}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: resolvedTheme === 'dark' ? '#8A8A9A' : '#9ca3af' }}
                  tickLine={false}
                  axisLine={false}
                  domain={signalType === 'raw' ? [0, 1] : [0, 'auto']}
                  tickFormatter={(v: number) => signalType === 'raw' ? `${(v * 100).toFixed(0)}%` : v.toFixed(2)}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      labelFormatter={(label, payload) => {
                        if (payload?.[0]?.payload?.time) {
                          return formatTooltipTime(payload[0].payload.time);
                        }
                        return label;
                      }}
                      formatter={(value, name, item, index, payload) => {
                        const config = filteredChartConfig[name];
                        const numVal = typeof value === 'number' ? value : 0;
                        const displayValue = signalType === 'raw'
                          ? `${(numVal * 100).toFixed(1)}%`
                          : numVal.toFixed(3);
                        const isLow = signalType === 'raw' && numVal < 0.5;
                        const isHigh = signalType === 'events' && numVal > 0;
                        return (
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: config?.color as string }}
                            />
                            <span className="text-muted-foreground">{config?.label || name}</span>
                            <span className={`font-mono font-medium ${isLow || isHigh ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`}>
                              {displayValue}
                            </span>
                            {isLow && (
                              <span className="text-[10px] bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-300 px-1.5 py-0.5 rounded-full">
                                {t('signal.outage')}
                              </span>
                            )}
                            {isHigh && signalType === 'events' && (
                              <span className="text-[10px] bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300 px-1.5 py-0.5 rounded-full">
                                {t('signal.detected')}
                              </span>
                            )}
                          </div>
                        );
                      }}
                    />
                  }
                />
                <ChartLegend content={<ChartLegendContent />} />

                {/* Outage threshold line at 50% (only for raw connectivity view) */}
                {signalType === 'raw' && (
                  <ReferenceLine
                    y={0.5}
                    stroke="#DC3545"
                    strokeDasharray="6 4"
                    strokeOpacity={0.5}
                    label={{
                      value: t('signal.outageThreshold'),
                      position: 'insideTopRight',
                      fill: '#DC3545',
                      fontSize: 10,
                      opacity: 0.7,
                    }}
                  />
                )}

                {/* Area for each ASN */}
                {Object.entries(filteredChartConfig).map(([key, config]) => (
                  <Area
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={config.color as string}
                    strokeWidth={2}
                    fill={`url(#gradient-${key})`}
                    dot={false}
                    activeDot={{
                      r: 4,
                      strokeWidth: 2,
                      stroke: config.color as string,
                      fill: '#fff',
                    }}
                    connectNulls
                  />
                ))}
              </AreaChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* Signal Summary Cards */}
      {Object.keys(signals).length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {Object.entries(signals).map(([, signal], index) => {
            // Skip if not selected
            if (selectedAsns.size > 0 && !selectedAsns.has(signal.asn)) return null;

            const latestValues = signal.values.slice(-6).filter((v): v is number => v !== null);
            const latestAvg = latestValues.length > 0 ? latestValues.reduce((sum: number, v: number) => sum + v, 0) / latestValues.length : 0;
            const isOutage = latestValues.length > 0 && (signalType === 'raw' ? latestAvg < 0.5 : latestAvg > 0);
            const color = ASN_COLORS[index % ASN_COLORS.length];

            return (
              <Card
                key={signal.asn}
                className={`card-hover border-l-4 ${isOutage ? 'border-l-red-500 bg-red-50/30 dark:bg-red-900/20' : 'border-l-emerald-500'}`}
                style={{ borderLeftColor: isOutage ? '#DC3545' : color }}
              >
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-semibold truncate" style={{ color }}>
                      {signal.providerName}
                    </p>
                    {isOutage && (
                      <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">AS{signal.asn}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 bg-muted-foreground/20 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${latestAvg * 100}%`,
                          backgroundColor: isOutage ? '#DC3545' : color,
                        }}
                      />
                    </div>
                    <span className={`text-xs font-mono font-bold ${isOutage ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`}>
                      {(latestAvg * 100).toFixed(0)}%
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {signal.datasource} · {signal.values.length} {t('signal.points')}
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

