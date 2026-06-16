'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ShieldCheck,
  ShieldAlert,
  CheckCircle,
  XCircle,
  FileText,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Filter,
  Eye,
  DollarSign,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '@/lib/i18n';
import Protected from '@/components/Protected';
import { fetchWithAuth, Roles } from '@/hooks/use-auth';
import { PageLoadingState, PageErrorState } from '@/components/shared/PageStates';
import { FieldError, RequiredIndicator, CharCounter } from '@/components/ui/form-warning';

// ── Types ──────────────────────────────────────────────────────────────────

interface CustomerUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface Customer {
  id: string;
  user: CustomerUser;
}

interface CoverageGrant {
  id: string;
  code: string;
  name: string;
  description: string;
  subLimitDefault: number | null;
  waitingPeriodHours: number;
  specialConditions: string;
  exclusions: string[];
}

interface ProductExclusion {
  id: string;
  code: string;
}

interface Category {
  id: string;
  code: string;
  categoryName: string;
}

interface Product {
  id: string;
  productCode: string;
  productName: string;
  productType: string;
  description: string;
  masterPolicyLimit: number | null;
  currency: string;
  masterDeductibleSIR: number | null;
  indemnityPeriodDays: number | null;
  minimumPremiumTnd: number;
  baseRatePer1000: number | null;
  category: Category;
  coverageGrants: CoverageGrant[];
  exclusions: ProductExclusion[];
}

interface Application {
  id: string;
  customerId: string;
  productId: string;
  answers: Record<string, string | boolean | number>;
  riskScore: number;
  securityPosture: { postureCode: string; postureName: string } | string;
  calculatedPremium: number | null;
  waiverFlags: string[];
  statusCode: string;
  statusName: string;
  adminComment: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  customer: Customer;
  product: Product;
  policy: unknown | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = ['ALL', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'] as const;

const getStatusBadge = (status: string) => {
  const map: Record<string, string> = {
    DRAFT: 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-900/30 dark:text-gray-300 dark:border-gray-800/30',
    SUBMITTED: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800/30',
    UNDER_REVIEW: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800/30',
    APPROVED: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800/30',
    REJECTED: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800/30',
  };
  return map[status] || 'bg-muted text-foreground border-border';
};

const getStatusDot = (status: string) => {
  const map: Record<string, string> = {
    DRAFT: 'bg-gray-500',
    SUBMITTED: 'bg-blue-500',
    UNDER_REVIEW: 'bg-amber-500',
    APPROVED: 'bg-green-500',
    REJECTED: 'bg-red-500',
  };
  return map[status] || 'bg-gray-500';
};

const getSecurityPostureBadge = (posture: { postureCode: string; postureName: string } | string) => {
  const code = typeof posture === 'object' ? posture.postureCode : posture;
  const map: Record<string, string> = {
    EXCELLENT: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800/30',
    GOOD: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800/30',
    FAIR: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800/30',
    POOR: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800/30',
    UNKNOWN: 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-900/30 dark:text-gray-300 dark:border-gray-800/30',
  };
  return map[code] || 'bg-muted text-foreground border-border';
};

const getRiskBarColor = (score: number) => {
  if (score >= 80) return 'bg-green-500';
  if (score >= 60) return 'bg-blue-500';
  if (score >= 40) return 'bg-amber-500';
  return 'bg-red-500';
};

const getRiskTextColor = (score: number) => {
  if (score >= 80) return 'text-green-600 dark:text-green-400';
  if (score >= 60) return 'text-blue-600 dark:text-blue-400';
  if (score >= 40) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
};

const formatTnd = (value: number | null | undefined, locale?: string) => {
  if (value === null || value === undefined) return '—';
  return value.toLocaleString(locale || undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// ── Component ──────────────────────────────────────────────────────────────

export default function AdminCyberApplicationsPage() {
  const { t, i18n } = useTranslation(['common', 'adminCommon', 'adminCyberApps']);
  const locale = i18n.language === 'ar' ? 'ar-TN' : i18n.language === 'fr' ? 'fr-TN' : undefined;
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<'approve' | 'reject' | null>(null);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [adminComment, setAdminComment] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const clearFieldError = (field: string) => {
    setFieldErrors(prev => {
      const next = {...prev};
      delete next[field];
      return next;
    });
  };

  const fetchApplications = useCallback(async () => {
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== 'ALL') {
        params.set('status', statusFilter);
      }
      params.set('page', String(page));
      params.set('limit', '10');
      const res = await fetchWithAuth(`/api/admin/cyber-applications?${params.toString()}`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.error || `Request failed with status ${res.status}`);
      }
      const data = await res.json();
      setApplications(data.applications || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      console.error('Failed to fetch cyber applications:', err);
      setError(t('errors.failedToLoad', 'Failed to load data'));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  const openActionDialog = (app: Application, type: 'approve' | 'reject') => {
    setSelectedApp(app);
    setDialogType(type);
    setAdminComment('');
    setFieldErrors({});
    setDialogOpen(true);
  };

  const handleAction = async () => {
    if (!selectedApp || !dialogType) return;
    const errors: Record<string, string> = {};
    if (dialogType === 'reject' && !adminComment.trim()) {
      errors.adminComment = t('common:validation.required');
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetchWithAuth(`/api/admin/cyber-applications/${selectedApp.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: dialogType === 'approve' ? 'APPROVED' : 'REJECTED',
          adminComment: adminComment || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        const action = dialogType === 'approve' ? 'approved' : 'rejected';
        toast.success(t('adminCommon:cyberApps.approveReject', { action }));
        setDialogOpen(false);
        setExpandedId(null);
        fetchApplications();
      } else {
        toast.error(data.error || t('adminCyberApps:toast.failedToAction', { action: dialogType }));
      }
    } catch {
      toast.error(t('adminCommon:actionFailed'));
    } finally {
      setActionLoading(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  // ── Loading ──────────────────────────────────────────────────────────────

  if (error) {
    return (
      <Protected roles={[Roles.ADMIN, Roles.SUPER_ADMIN]}>
        <PageErrorState message={error} onRetry={fetchApplications} />
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

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <Protected roles={[Roles.ADMIN, Roles.SUPER_ADMIN]}>
      <div className="page-enter">
      {/* Header */}
      <div className="mb-6 animate-fade-in-down">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" /> {t('adminCyberApps:title')}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {t('adminCyberApps:subtitle')}
        </p>
      </div>

      {/* Filter bar */}
      <div className="mb-4 flex items-center gap-3 animate-fade-in-up">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Label className="text-muted-foreground text-sm whitespace-nowrap">{t('adminCyberApps:filter.status')}</Label>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t('adminCyberApps:filter.filterByStatus')} />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s === 'ALL' ? t('adminCyberApps:filter.allStatuses') : s.replace('_', ' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">
          {t('adminCyberApps:filter.applicationCount', { count: total })}
        </span>
      </div>

      {/* Table */}
      {applications.length === 0 ? (
        <Card className="shadow-md animate-fade-in-up">
          <CardContent className="p-12 text-center">
            <div className="bg-muted w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground font-medium">{t('adminCyberApps:empty.noApplications')}</p>
            <p className="text-muted-foreground text-sm mt-1">
              {statusFilter !== 'ALL'
                ? t('adminCyberApps:empty.tryChangingFilter')
                : t('adminCyberApps:empty.newApplications')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-md animate-fade-in-up">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">{t('adminCyberApps:title')}</caption>
                <thead>
                  <tr className="border-b bg-muted/80">
                    <th className="text-start p-3 font-medium text-muted-foreground w-8" />
                    <th className="text-start p-3 font-medium text-muted-foreground">{t('adminCyberApps:table.applicant')}</th>
                    <th className="text-start p-3 font-medium text-muted-foreground">{t('adminCyberApps:table.companySector')}</th>
                    <th className="text-start p-3 font-medium text-muted-foreground">{t('adminCyberApps:table.revenue')}</th>
                    <th className="text-start p-3 font-medium text-muted-foreground">{t('adminCyberApps:table.riskScore')}</th>
                    <th className="text-start p-3 font-medium text-muted-foreground">{t('adminCyberApps:table.securityPosture')}</th>
                    <th className="text-start p-3 font-medium text-muted-foreground">{t('adminCyberApps:table.premium')}</th>
                    <th className="text-start p-3 font-medium text-muted-foreground">{t('adminCyberApps:table.status')}</th>
                    <th className="text-start p-3 font-medium text-muted-foreground">{t('adminCyberApps:table.submitted')}</th>
                  </tr>
                </thead>
                <tbody>
                  {applications.map((app) => {
                    const isExpanded = expandedId === app.id;
                    const answers = app.answers || {};
                    const companyName = (answers.companyName as string) || '—';
                    const sector = (answers.sector as string) || app.product.category?.categoryName || '—';
                    const annualRevenue = answers.annualRevenue as number | undefined;

                    return (
                      <tr key={app.id} className="border-b">
                        {/* Expand toggle row */}
                        <td colSpan={9} className="p-0">
                          <div>
                            {/* Main row */}
                            <div
                              className="flex items-center cursor-pointer table-row-hover"
                              onClick={() => toggleExpand(app.id)}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpand(app.id); } }}
                              aria-expanded={isExpanded}
                              aria-label={"Expand application from " + app.customer.user.firstName + " " + app.customer.user.lastName}
                            >
                              <div className="p-3 w-8 flex-shrink-0">
                                {isExpanded ? (
                                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                )}
                              </div>
                              <div className="p-3 flex-1 min-w-0">
                                <p className="font-medium truncate">
                                  {app.customer.user.firstName} {app.customer.user.lastName}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">{app.customer.user.email}</p>
                              </div>
                              <div className="p-3 flex-1 min-w-0">
                                <p className="truncate">{companyName}</p>
                                <Badge variant="outline" title={sector} className="bg-muted text-muted-foreground border-border text-[10px] mt-0.5">
                                  {sector}
                                </Badge>
                              </div>
                              <div className="p-3 flex-shrink-0 text-muted-foreground">
                                {annualRevenue ? <>{formatTnd(annualRevenue, locale)} {t('common:unit.tnd', 'TND')}</> : '—'}
                              </div>
                              <div className="p-3 flex-shrink-0 w-32">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${getRiskBarColor(app.riskScore)} transition-all`}
                                      style={{ width: `${Math.max(app.riskScore, 2)}%` }}
                                    />
                                  </div>
                                  <span className={`text-xs font-semibold ${getRiskTextColor(app.riskScore)} w-8 text-end`}>
                                    {app.riskScore}
                                  </span>
                                </div>
                              </div>
                              <div className="p-3 flex-shrink-0">
                                <Badge variant="outline" title={typeof app.securityPosture === 'object' ? app.securityPosture.postureName : app.securityPosture} className={getSecurityPostureBadge(app.securityPosture)}>
                                  {typeof app.securityPosture === 'object' ? app.securityPosture.postureName : app.securityPosture}
                                </Badge>
                              </div>
                              <div className="p-3 flex-shrink-0 font-semibold text-primary">
                                {formatTnd(app.calculatedPremium, locale)} {t('common:unit.tnd', 'TND')}
                              </div>
                              <div className="p-3 flex-shrink-0">
                                {(() => {
                                  const statusLabel = app.statusName ?? (typeof app.statusCode === 'string' ? app.statusCode.replace('_', ' ') : '—');
                                  return (
                                    <Badge variant="outline" title={statusLabel} className={getStatusBadge(app.statusCode)}>
                                      <span className={`w-1.5 h-1.5 rounded-full ${getStatusDot(app.statusCode)} me-1.5`} />
                                      {statusLabel}
                                    </Badge>
                                  );
                                })()}
                              </div>
                              <div className="p-3 flex-shrink-0 text-xs text-muted-foreground">
                                {formatDate(app.createdAt)}
                              </div>
                            </div>

                            {/* Expanded details */}
                            {isExpanded && (
                              <div className="px-4 pb-4 pt-2 bg-muted/30 border-t">
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                  {/* Left column: Underwriting answers & waiver flags */}
                                  <div className="space-y-4">
                                    {/* Underwriting Q&A */}
                                    <div>
                                      <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                                        <Eye className="h-4 w-4 text-primary" /> {t('adminCyberApps:expanded.underwritingAnswers')}
                                      </h4>
                                      <div className="bg-card rounded-xl border border-border p-3 max-h-64 overflow-y-auto space-y-2">
                                        {Object.entries(answers).length === 0 ? (
                                          <p className="text-muted-foreground text-xs">{t('adminCyberApps:expanded.noAnswers')}</p>
                                        ) : (
                                          Object.entries(answers).map(([field, value]) => (
                                            <div key={field} className="flex justify-between gap-4 text-sm">
                                              <span className="text-muted-foreground capitalize">
                                                {field.replace(/([A-Z])/g, ' $1').trim()}
                                              </span>
                                              <span className="font-medium text-foreground text-end">
                                                {typeof value === 'boolean' ? (value ? t('common:action.yes', 'Yes') : t('common:action.no', 'No')) : String(value)}
                                              </span>
                                            </div>
                                          ))
                                        )}
                                      </div>
                                    </div>

                                    {/* Waiver Flags */}
                                    {app.waiverFlags && app.waiverFlags.length > 0 && (
                                      <div>
                                        <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                                          <AlertTriangle className="h-4 w-4 text-amber-500" /> {t('adminCyberApps:expanded.waiverFlags')}
                                        </h4>
                                        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 rounded-xl p-3">
                                          <div className="flex flex-wrap gap-2">
                                            {app.waiverFlags.map((flag) => (
                                              <Badge
                                                key={flag}
                                                variant="outline"
                                                className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800/30 text-xs"
                                              >
                                                <AlertTriangle className="h-3 w-3 me-1" />
                                                {flag.replace(/([A-Z])/g, ' $1').trim()}
                                              </Badge>
                                            ))}
                                          </div>
                                          <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                                            {t('adminCyberApps:expanded.waiverDescription')}
                                          </p>
                                        </div>
                                      </div>
                                    )}

                                    {/* Admin Comment */}
                                    {app.adminComment && (
                                      <div>
                                        <h4 className="text-sm font-semibold mb-2">{t('adminCyberApps:expanded.adminComment')}</h4>
                                        <div className="bg-muted rounded-xl p-3">
                                          <p className="text-sm">{app.adminComment}</p>
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  {/* Right column: Coverage grants & Premium breakdown */}
                                  <div className="space-y-4">
                                    {/* Coverage Grants */}
                                    <div>
                                      <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                                        <ShieldCheck className="h-4 w-4 text-primary" /> {t('adminCyberApps:expanded.coverageGrants')}
                                      </h4>
                                      <div className="bg-card rounded-xl border border-border p-3 max-h-64 overflow-y-auto space-y-2">
                                        {app.product.coverageGrants.length === 0 ? (
                                          <p className="text-muted-foreground text-xs">{t('adminCyberApps:expanded.noCoverageGrants')}</p>
                                        ) : (
                                          app.product.coverageGrants.map((cg) => (
                                            <div
                                              key={cg.id}
                                              className="flex items-start justify-between gap-2 p-2 rounded-lg bg-muted/50"
                                            >
                                              <div className="min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                  <Badge
                                                    variant="outline"
                                                    className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800/30 text-[10px] px-1.5 py-0"
                                                  >
                                                    {cg.code}
                                                  </Badge>
                                                  <span className="text-sm font-medium truncate">{cg.name}</span>
                                                </div>
                                                {cg.description && (
                                                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                                    {cg.description}
                                                  </p>
                                                )}
                                              </div>
                                              {cg.subLimitDefault !== null && (
                                                <span className="text-xs font-semibold text-primary whitespace-nowrap">
                                                  {formatTnd(cg.subLimitDefault, locale)} {t('common:unit.tnd', 'TND')}
                                                </span>
                                              )}
                                            </div>
                                          ))
                                        )}
                                      </div>
                                    </div>

                                    {/* Premium Breakdown */}
                                    <div>
                                      <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                                        <DollarSign className="h-4 w-4 text-primary" /> {t('adminCyberApps:expanded.premiumBreakdown')}
                                      </h4>
                                      <div className="bg-card rounded-xl border border-border p-3 space-y-2">
                                        <div className="flex justify-between text-sm">
                                          <span className="text-muted-foreground">{t('adminCyberApps:expanded.product')}</span>
                                          <span className="font-medium">{app.product.productName}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                          <span className="text-muted-foreground">{t('adminCyberApps:expanded.policyLimit')}</span>
                                          <span className="font-medium">{formatTnd(app.product.masterPolicyLimit, locale)} {t('common:unit.tnd', 'TND')}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                          <span className="text-muted-foreground">{t('adminCyberApps:expanded.deductibleSIR')}</span>
                                          <span className="font-medium">{formatTnd(app.product.masterDeductibleSIR, locale)} {t('common:unit.tnd', 'TND')}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                          <span className="text-muted-foreground">{t('adminCyberApps:expanded.indemnityPeriod')}</span>
                                          <span className="font-medium">{app.product.indemnityPeriodDays || '—'} {t('adminCyberApps:expanded.days')}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                          <span className="text-muted-foreground">{t('adminCyberApps:expanded.baseRatePer1000')}</span>
                                          <span className="font-medium">{app.product.baseRatePer1000 ?? '—'}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                          <span className="text-muted-foreground">{t('adminCyberApps:expanded.minimumPremium')}</span>
                                          <span className="font-medium">{formatTnd(app.product.minimumPremiumTnd, locale)} {t('common:unit.tnd', 'TND')}</span>
                                        </div>
                                        <div className="border-t pt-2 mt-2 flex justify-between text-sm">
                                          <span className="font-semibold">{t('adminCyberApps:expanded.calculatedPremium')}</span>
                                          <span className="font-bold text-primary text-base">
                                            {formatTnd(app.calculatedPremium, locale)} {t('common:unit.tnd', 'TND')}
                                          </span>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Exclusions */}
                                    {app.product.exclusions && app.product.exclusions.length > 0 && (
                                      <div>
                                        <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                                          <ShieldAlert className="h-4 w-4 text-red-500" /> {t('adminCyberApps:expanded.exclusions')}
                                        </h4>
                                        <div className="flex flex-wrap gap-2">
                                          {app.product.exclusions.map((exc) => (
                                            <Badge
                                              key={exc.id}
                                              variant="outline"
                                              className="bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800/30 text-xs"
                                            >
                                              {exc.code ? exc.code.replace(/_/g, ' ') : exc.id}
                                            </Badge>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {/* Action Buttons */}
                                    {(app.statusCode === 'SUBMITTED' || app.statusCode === 'UNDER_REVIEW') && (
                                      <div className="flex gap-2 pt-2">
                                        <Button
                                          size="sm"
                                          className="bg-emerald-500 hover:bg-emerald-600 text-white transition-all hover:shadow-md"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            openActionDialog(app, 'approve');
                                          }}
                                        >
                                          <CheckCircle className="h-4 w-4 me-1" /> {t('common:action.approve')}
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="destructive"
                                          className="transition-all hover:shadow-md"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            openActionDialog(app, 'reject');
                                          }}
                                        >
                                          <XCircle className="h-4 w-4 me-1" /> {t('common:action.reject')}
                                        </Button>
                                      </div>
                                    )}

                                    {app.statusCode === 'APPROVED' && (
                                      <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400 text-sm font-medium pt-2">
                                        <CheckCircle className="h-4 w-4" /> {t('adminCyberApps:expanded.applicationApproved')}
                                        {app.reviewedAt && (
                                          <span className="text-muted-foreground text-xs ms-2">
                                            {t('adminCyberApps:expanded.on')} {formatDate(app.reviewedAt)}
                                          </span>
                                        )}
                                      </div>
                                    )}

                                    {app.statusCode === 'REJECTED' && (
                                      <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400 text-sm font-medium pt-2">
                                        <XCircle className="h-4 w-4" /> {t('adminCyberApps:expanded.applicationRejected')}
                                        {app.reviewedAt && (
                                          <span className="text-muted-foreground text-xs ms-2">
                                            {t('adminCyberApps:expanded.on')} {formatDate(app.reviewedAt)}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t mt-4">
          <div className="text-sm text-muted-foreground">
            {t('common:pagination.showing', {
              from: (page - 1) * 10 + 1,
              to: Math.min(page * 10, total),
              total
            })}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              {t('common:pagination.previous')}
            </Button>
            <span className="text-sm">
              {t('common:pagination.page', { current: page, total: totalPages })}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              {t('common:pagination.next')}
            </Button>
          </div>
        </div>
      )}

      {/* Action Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {dialogType === 'approve' ? (
                <><CheckCircle className="h-5 w-5 text-emerald-500" /> {t('adminCyberApps:dialog.approveTitle')}</>
              ) : (
                <><XCircle className="h-5 w-5 text-red-500" /> {t('adminCyberApps:dialog.rejectTitle')}</>
              )}
            </DialogTitle>
            <DialogDescription>
              {selectedApp && (
                <>
                  {t('adminCyberApps:dialog.applicationFrom', { name: `${selectedApp.customer.user.firstName} ${selectedApp.customer.user.lastName}`, product: selectedApp.product.productName })}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedApp && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm bg-muted rounded-xl p-3">
                <div>
                  <p className="text-muted-foreground text-xs">{t('adminCyberApps:dialog.riskScore')}</p>
                  <p className={`font-semibold ${getRiskTextColor(selectedApp.riskScore)}`}>
                    {selectedApp.riskScore}/100
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">{t('adminCyberApps:dialog.securityPosture')}</p>
                  <Badge variant="outline" title={typeof selectedApp.securityPosture === 'object' ? selectedApp.securityPosture.postureName : selectedApp.securityPosture} className={getSecurityPostureBadge(selectedApp.securityPosture)}>
                    {typeof selectedApp.securityPosture === 'object' ? selectedApp.securityPosture.postureName : selectedApp.securityPosture}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">{t('adminCyberApps:dialog.premium')}</p>
                  <p className="font-semibold text-primary">{formatTnd(selectedApp.calculatedPremium, locale)} {t('common:unit.tnd', 'TND')}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">{t('adminCyberApps:dialog.waiverFlags')}</p>
                  <p className="font-medium">{selectedApp.waiverFlags?.length || 0}</p>
                </div>
              </div>

              <div>
                <Label htmlFor="adminComment">
                  {t('adminCyberApps:dialog.adminComment')} {dialogType === 'reject' && <RequiredIndicator />}
                </Label>
                <Textarea
                  id="adminComment"
                  placeholder={
                    dialogType === 'reject'
                      ? t('adminCyberApps:dialog.rejectPlaceholder')
                      : t('adminCyberApps:dialog.optionalPlaceholder')
                  }
                  value={adminComment}
                  onChange={(e) => { setAdminComment(e.target.value); clearFieldError('adminComment'); }}
                  onBlur={() => {
                    if (dialogType === 'reject' && !adminComment.trim()) setFieldErrors(prev => ({...prev, adminComment: t('common:validation.required') }));
                  }}
                  maxLength={2000}
                  className="mt-1 focus-ring"
                  aria-invalid={!!fieldErrors.adminComment}
                  aria-describedby={fieldErrors.adminComment ? 'adminComment-error' : undefined}
                />
                <div className="flex justify-between">
                  <FieldError id="adminComment-error">{fieldErrors.adminComment}</FieldError>
                  <CharCounter current={adminComment.length} max={2000} />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="transition-all">
              {t('adminCyberApps:dialog.cancel')}
            </Button>
            <Button
              onClick={handleAction}
              disabled={actionLoading || (dialogType === 'reject' && !adminComment.trim())}
              className={`${
                dialogType === 'approve'
                  ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                  : 'bg-red-500 hover:bg-red-600 text-white'
              } transition-all hover:shadow-md`}
            >
              {actionLoading
                ? t('adminCyberApps:dialog.processing')
                : dialogType === 'approve'
                ? t('adminCyberApps:dialog.confirmApproval')
                : t('adminCyberApps:dialog.confirmRejection')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </Protected>
  );
}

