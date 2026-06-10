'use client';

import { useEffect, useState } from 'react';
import { fetchWithAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/lib/store';
import {
  GitCompare, Shield, CheckCircle, XCircle, AlertTriangle, CircleDot,
  ArrowRight, Info, TrendingUp, Lightbulb, RefreshCw,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PageLoadingState, PageErrorState, PageEmptyState } from '@/components/shared/PageStates';

// ── Types ──────────────────────────────────────────────────────────────
interface CoverageScenario {
  scenario: string;
  trigger: string;
  parametricResponse: string;
  cyberResponse: string;
  gap: boolean;
  gapDescription: string;
  recommendation: string;
}

interface CoverageSummary {
  customerProfile: {
    asn: string | null;
    sector: string;
    sectorId: number | null;
    mttrTier: string;
    mttrHours: number;
    hasParametric: boolean;
    hasCyber: boolean;
  };
  coverageScore: number;
  totalScenarios: number;
  coveredScenarios: number;
  gapScenarios: number;
  parametricProduct: {
    id: number;
    productCode: string;
    productName: string;
  } | null;
  cyberProduct: {
    id: number;
    productCode: string;
    productName: string;
    coverages: { coverageCode: string; coverageName: string }[];
    exclusions: string[];
  } | null;
}

interface GapRecommendation {
  scenario: string;
  recommendation: string;
}

interface GapData {
  summary: CoverageSummary;
  scenarios: CoverageScenario[];
  recommendations: GapRecommendation[];
}

// ── Cell icon resolver ─────────────────────────────────────────────────
function resolveCellStatus(response: string, isParametric: boolean, hasProduct: boolean) {
  if (!hasProduct) return 'na';
  if (response.toLowerCase().includes('covered')) return 'covered';
  if (response.toLowerCase().includes('excluded')) return 'excluded';
  if (response.toLowerCase().includes('partially')) return 'partial';
  if (response.toLowerCase().includes('not covered') || response.toLowerCase().includes('no coverage')) return 'gap';
  return 'gap';
}

const CELL_STYLES: Record<string, { bg: string; text: string; icon: typeof CheckCircle }> = {
  covered: { bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-700 dark:text-green-300', icon: CheckCircle },
  excluded: { bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-700 dark:text-red-300', icon: XCircle },
  gap: { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-300', icon: AlertTriangle },
  partial: { bg: 'bg-yellow-50 dark:bg-yellow-900/20', text: 'text-yellow-700 dark:text-yellow-300', icon: AlertTriangle },
  na: { bg: 'bg-gray-50 dark:bg-gray-800/20', text: 'text-gray-400 dark:text-gray-500', icon: CircleDot },
};

// CELL_LABELS removed — labels are now resolved via t() inline

const CELL_COLORS: Record<string, string> = {
  covered: 'text-green-600 dark:text-green-400',
  excluded: 'text-red-600 dark:text-red-400',
  gap: 'text-amber-600 dark:text-amber-400',
  partial: 'text-amber-600 dark:text-amber-400',
  na: 'text-gray-400',
};

const SCORE_COLORS: Record<string, string> = {
  high: 'text-green-600 dark:text-green-400',
  medium: 'text-amber-600 dark:text-amber-400',
  low: 'text-red-600 dark:text-red-400',
};

export default function CoverageGapAnalyzerPage() {
  const { user, setCurrentPage, setWorkflowContext } = useAppStore();
  const { t } = useTranslation(['customerCoverageGap', 'common']);
  const [gapData, setGapData] = useState<GapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.customerId) {
      void fetchGapData();
    }
  }, [user?.customerId]);

  async function fetchGapData() {
    setError(null);
    try {
      // Determine what coverage the customer has
      let hasParametric = false;
      let hasCyber = false;
      let asn: string | null = null;
      let sector = 'Other';
      let sectorId: number | null = null;
      let mttrTier = '';

      // Check parametric policies
      try {
        const endpoint = '/api/customer/parametric-policies';
        const paramRes = await fetchWithAuth(endpoint);
        const paramData = await paramRes.json();
        const activeParam = (paramData.policies || []).filter(
          (p: { statusCode: string }) => p.statusCode === 'APPROVED'
        );
        if (activeParam.length > 0) {
          hasParametric = true;
          const first = activeParam[0];
          asn = String(first.cloudProvider?.asn || '');
          mttrTier = typeof first.cloudProvider?.slaTier === 'object'
            ? first.cloudProvider.slaTier.tierName
            : first.cloudProvider?.slaTier || '';
        }
      } catch {
        // Non-fatal: proceed without parametric data
      }

      // Check cyber policies
      try {
        const endpoint = '/api/customer/cyber/policies';
        const cyberRes = await fetchWithAuth(endpoint);
        const cyberData = await cyberRes.json();
        const activeCyber = (cyberData.policies || []).filter(
          (p: { statusCode: string }) => p.statusCode === 'ACTIVE'
        );
        if (activeCyber.length > 0) {
          hasCyber = true;
        }
      } catch {
        // Non-fatal: proceed without cyber data
      }

      // Fetch coverage gap analysis
      const params = new URLSearchParams();
      if (asn) params.set('asn', asn);
      params.set('sector', sector);
      if (sectorId) params.set('sectorId', String(sectorId));
      if (mttrTier) params.set('mttrTier', mttrTier);
      params.set('hasParametric', String(hasParametric));
      params.set('hasCyber', String(hasCyber));

      const res = await fetchWithAuth(`/api/customer/coverage-gap?${params.toString()}`);
      const data = await res.json();
      setGapData(data);
    } catch (error) {
      console.error('Failed to fetch coverage gap data:', error);
      setError(t('common:errors.failedToLoad', 'Failed to load data'));
    } finally {
      setLoading(false);
    }
  };

  if (error) {
    return <PageErrorState message={error} onRetry={fetchGapData} />;
  }

  if (loading) {
    return <PageLoadingState message={t('customerCoverageGap:loading', 'Analyzing coverage gaps…')} />;
  }

  if (!gapData) {
    return (
      <div className="max-w-4xl mx-auto page-enter">
        <Card className="shadow-md">
          <CardContent className="p-12 text-center">
            <div className="bg-muted w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <GitCompare className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground font-medium">{t('customerCoverageGap:loadError')}</p>
            <p className="text-muted-foreground text-sm mt-1">{t('customerCoverageGap:loadErrorDesc')}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4 gap-2"
              onClick={() => { setLoading(true); fetchGapData(); }}
            >
              <RefreshCw className="h-4 w-4" />
              {t('common:action.retry', 'Retry')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { summary, scenarios, recommendations } = gapData;
  const scoreLevel = summary.coverageScore >= 70 ? 'high' : summary.coverageScore >= 40 ? 'medium' : 'low';

  return (
    <div className="max-w-5xl mx-auto page-enter">
      {/* Header */}
      <div className="mb-6 animate-fade-in-down">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <GitCompare className="h-6 w-6 text-[#E5693A]" /> {t('customerCoverageGap:title')}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {t('customerCoverageGap:subtitle')}
        </p>
      </div>

      {/* Coverage Score */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 animate-fade-in-up">
        <Card className="border-none shadow-lg card-hover-lift">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{t('customerCoverageGap:score.coverageScore')}</p>
            <p className={`text-3xl font-bold ${SCORE_COLORS[scoreLevel]}`}>
              {summary.coverageScore}%
            </p>
            <div className="mt-2 w-full bg-muted rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-700 ${
                  summary.coverageScore >= 70
                    ? 'bg-green-500'
                    : summary.coverageScore >= 40
                    ? 'bg-amber-500'
                    : 'bg-red-500'
                }`}
                style={{ width: `${summary.coverageScore}%` }}
              />
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-lg card-hover-lift">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{t('customerCoverageGap:score.coveredScenarios')}</p>
            <p className="text-3xl font-bold text-green-600 dark:text-green-400">
              {summary.coveredScenarios}
            </p>
            <p className="text-xs text-muted-foreground">{t('customerCoverageGap:score.ofTotal', { total: summary.totalScenarios })}</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-lg card-hover-lift">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{t('customerCoverageGap:score.gapScenarios')}</p>
            <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">
              {summary.gapScenarios}
            </p>
            <p className="text-xs text-muted-foreground">{t('customerCoverageGap:score.requireAttention')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Coverage Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 animate-fade-in-up stagger-2">
        <Card className={`border-s-4 ${summary.customerProfile.hasParametric ? 'border-s-green-500' : 'border-s-red-500'}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">{t('customerCoverageGap:product.parametricTitle')}</p>
                  <p className="text-xs text-muted-foreground">
                    {summary.customerProfile.hasParametric ? t('customerCoverageGap:product.active') : t('customerCoverageGap:product.notPurchased')}
                  </p>
                </div>
              </div>
              <Badge
                variant="outline"
                className={
                  summary.customerProfile.hasParametric
                    ? 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800/30'
                    : 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800/30'
                }
                title={summary.customerProfile.hasParametric ? t('customerCoverageGap:product.active') : t('customerCoverageGap:product.missing')}
              >
                {summary.customerProfile.hasParametric ? t('customerCoverageGap:product.active') : t('customerCoverageGap:product.missing')}
              </Badge>
            </div>
            {summary.parametricProduct && (
              <p className="text-xs text-muted-foreground mt-2">{summary.parametricProduct.productName}</p>
            )}
            {!summary.customerProfile.hasParametric && (
              <Button
                variant="outline"
                size="sm"
                className="mt-3 text-xs"
                onClick={() => { setWorkflowContext({}); setCurrentPage('apply-parametric-policy'); }}
              >
                {t('customerCoverageGap:product.applyNow')} <ArrowRight className="h-3 w-3 ms-1" />
              </Button>
            )}
          </CardContent>
        </Card>

        <Card className={`border-s-4 ${summary.customerProfile.hasCyber ? 'border-s-green-500' : 'border-s-red-500'}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-[#E5693A]" />
                <div>
                  <p className="text-sm font-medium">{t('customerCoverageGap:product.cyberTitle')}</p>
                  <p className="text-xs text-muted-foreground">
                    {summary.customerProfile.hasCyber ? t('customerCoverageGap:product.active') : t('customerCoverageGap:product.notPurchased')}
                  </p>
                </div>
              </div>
              <Badge
                variant="outline"
                className={
                  summary.customerProfile.hasCyber
                    ? 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800/30'
                    : 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800/30'
                }
                title={summary.customerProfile.hasCyber ? t('customerCoverageGap:product.active') : t('customerCoverageGap:product.missing')}
              >
                {summary.customerProfile.hasCyber ? t('customerCoverageGap:product.active') : t('customerCoverageGap:product.missing')}
              </Badge>
            </div>
            {summary.cyberProduct && (
              <div className="mt-2 flex flex-wrap gap-1">
                {summary.cyberProduct.coverages.slice(0, 5).map((c, idx) => (
                  <Badge
                    key={`${String(c.coverageCode ?? c.coverageName ?? idx)}-${idx}`}
                    variant="outline"
                    className="text-xs font-mono bg-primary/5"
                  >
                    {c.coverageCode ?? c.coverageName}
                  </Badge>
                ))}
                {summary.cyberProduct.coverages.length > 5 && (
                  <Badge variant="outline" className="text-xs bg-muted">
                    +{summary.cyberProduct.coverages.length - 5}
                  </Badge>
                )}
              </div>
            )}
            {!summary.customerProfile.hasCyber && (
              <Button
                variant="outline"
                size="sm"
                className="mt-3 text-xs"
                onClick={() => { setWorkflowContext({}); setCurrentPage('apply-cyber-policy'); }}
              >
                {t('customerCoverageGap:product.applyNow')} <ArrowRight className="h-3 w-3 ms-1" />
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Coverage Gap Matrix */}
      <Card className="shadow-lg border-none animate-fade-in-up stagger-3">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <GitCompare className="h-5 w-5 text-primary" /> {t('customerCoverageGap:matrix.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 mb-4 text-xs">
            <span className="flex items-center gap-1"><span>✅</span> {t('customerCoverageGap:matrix.legendCovered')}</span>
            <span className="flex items-center gap-1"><span>❌</span> {t('customerCoverageGap:matrix.legendExcluded')}</span>
            <span className="flex items-center gap-1"><span>⚠️</span> {t('customerCoverageGap:matrix.legendGap')}</span>
            <span className="flex items-center gap-1"><span>⬚</span> {t('customerCoverageGap:matrix.legendNA')}</span>
          </div>

          {/* Matrix Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <caption className="sr-only">{t('customerCoverageGap:matrix.title')}</caption>
              <thead>
                <tr className="border-b border-border">
                  <th className="text-start p-3 font-medium text-muted-foreground w-1/3">{t('customerCoverageGap:matrix.scenario')}</th>
                  <th className="text-center p-3 font-medium text-muted-foreground">{t('customerCoverageGap:matrix.parametricProduct')}</th>
                  <th className="text-center p-3 font-medium text-muted-foreground">{t('customerCoverageGap:matrix.cyberIndemnity')}</th>
                  <th className="text-center p-3 font-medium text-muted-foreground">{t('customerCoverageGap:matrix.gap')}</th>
                </tr>
              </thead>
              <tbody>
                {scenarios.map((s, i) => {
                  const paramStatus = resolveCellStatus(
                    s.parametricResponse,
                    true,
                    summary.customerProfile.hasParametric
                  );
                  const cyberStatus = resolveCellStatus(
                    s.cyberResponse,
                    false,
                    summary.customerProfile.hasCyber
                  );
                  const paramStyle = CELL_STYLES[paramStatus];
                  const cyberStyle = CELL_STYLES[cyberStatus];

                  return (
                    <tr key={i} className="border-b border-border table-row-hover">
                      <td className="p-3">
                        <p className="font-medium text-sm">{s.scenario}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{s.trigger}</p>
                      </td>
                      <td className="p-3 text-center">
                        <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg ${paramStyle.bg} ${paramStyle.text}`}>
                          <span className="text-xs font-medium">
                            {paramStatus === 'na'
                              ? t('customerCoverageGap:matrix.na')
                              : paramStatus === 'covered'
                              ? t('customerCoverageGap:matrix.covered')
                              : paramStatus === 'excluded'
                              ? t('customerCoverageGap:matrix.excluded')
                              : paramStatus === 'partial'
                              ? t('customerCoverageGap:matrix.partial', 'Partial')
                              : t('customerCoverageGap:matrix.gapLabel')}
                          </span>
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg ${cyberStyle.bg} ${cyberStyle.text}`}>
                          <span className="text-xs font-medium">
                            {cyberStatus === 'na'
                              ? t('customerCoverageGap:matrix.na')
                              : cyberStatus === 'covered'
                              ? t('customerCoverageGap:matrix.covered')
                              : cyberStatus === 'excluded'
                              ? t('customerCoverageGap:matrix.excluded')
                              : cyberStatus === 'partial'
                              ? t('customerCoverageGap:matrix.partial', 'Partial')
                              : t('customerCoverageGap:matrix.gapLabel')}
                          </span>
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        {s.gap ? (
                          <Badge
                            variant="outline"
                            className="bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800/30 text-xs"
                            title={t('customerCoverageGap:matrix.gapBadge')}
                          >
                            ⚠️ {t('customerCoverageGap:matrix.gapBadge')}
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800/30 text-xs"
                            title={t('customerCoverageGap:matrix.okBadge')}
                          >
                            ✅ {t('customerCoverageGap:matrix.okBadge')}
                          </Badge>
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

      {/* Scenario Details */}
      <Card className="shadow-lg border-none mt-6 animate-fade-in-up stagger-4">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Info className="h-5 w-5 text-primary" /> {t('customerCoverageGap:details.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 max-h-96 overflow-y-auto pe-1 custom-scrollbar">
            {scenarios.map((s, i) => (
              <div
                key={i}
                className={`border rounded-xl p-4 ${
                  s.gap
                    ? 'border-amber-200 bg-amber-50/50 dark:border-amber-800/30 dark:bg-amber-900/10'
                    : 'border-border bg-muted/30'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-semibold text-sm">{s.scenario}</h4>
                  {s.gap && (
                    <Badge
                      variant="outline"
                      className="bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800/30 text-xs shrink-0 ms-2"
                      title={t('customerCoverageGap:details.gap')}
                    >
                      {t('customerCoverageGap:details.gap')}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  <span className="font-medium">{t('customerCoverageGap:details.trigger')}:</span> {s.trigger}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="bg-card p-2 rounded-lg">
                    <p className="text-muted-foreground font-medium mb-0.5">{t('customerCoverageGap:details.parametricResponse')}</p>
                    <p>{s.parametricResponse}</p>
                  </div>
                  <div className="bg-card p-2 rounded-lg">
                    <p className="text-muted-foreground font-medium mb-0.5">{t('customerCoverageGap:details.cyberResponse')}</p>
                    <p>{s.cyberResponse}</p>
                  </div>
                </div>
                {s.gap && s.gapDescription && (
                  <div className="mt-2 flex items-start gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-700 dark:text-amber-300">{s.gapDescription}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recommendations */}
      {recommendations && recommendations.length > 0 && (
        <Card className="shadow-lg border-none mt-6 animate-fade-in-up stagger-5">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-amber-500" /> {t('customerCoverageGap:recommendations.title')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recommendations.map((r, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 bg-amber-50 border border-amber-100 dark:bg-amber-900/20 dark:border-amber-800/30 p-3 rounded-xl"
                >
                  <div className="bg-amber-100 dark:bg-amber-900/30 p-1.5 rounded-lg shrink-0 mt-0.5">
                    <TrendingUp className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-300">{r.scenario}</p>
                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">{r.recommendation}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

