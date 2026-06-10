'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
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
  ShieldAlert,
  CheckCircle,
  XCircle,
  FileText,
  DollarSign,
  Filter,
  Banknote,
  AlertCircle,
  Clock,
  TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '@/lib/i18n';
import Protected from '@/components/Protected';
import { fetchWithAuth, Roles } from '@/hooks/use-auth';
import { PageLoadingState, PageErrorState } from '@/components/shared/PageStates';
import { FieldError, RequiredIndicator, CharCounter } from '@/components/ui/form-warning';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// ── Types ──────────────────────────────────────────────────────────────────

interface CustomerUser {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
}

interface Customer {
  id: number;
  user: CustomerUser;
}

interface ProductCategory {
  id: number;
  code: string;
  categoryName: string;
}

interface Product {
  id: number;
  productCode: string;
  productName: string;
  category: ProductCategory;
}

interface Policy {
  id: number;
  policyLimit: number;
  deductibleSIR: number;
  premium: number;
  statusCode: string;
  statusName: string;
  product: Product;
}

interface Claim {
  id: number;
  customerId: string;
  policyId: string;
  incidentDate: string;
  reportedDate: string;
  incidentType: { typeCode: string; typeName: string } | string;
  description: string;
  estimatedLoss: number | string;
  approvedAmount: number | string | null;
  statusCode: string;
  statusName: string;
  forensicReport: string | null;
  adjusterComment: string | null;
  paidDate: string | null;
  createdAt: string;
  updatedAt: string;
  customer: Customer;
  policy: Policy;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = ['ALL', 'REPORTED', 'UNDER_INVESTIGATION', 'ADJUSTED', 'APPROVED', 'PAID', 'DENIED'] as const;

const getStatusBadge = (status: string) => {
  const map: Record<string, string> = {
    REPORTED: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800/30',
    UNDER_INVESTIGATION: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800/30',
    ADJUSTED: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800/30',
    APPROVED: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800/30',
    PAID: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800/30',
    DENIED: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800/30',
  };
  return map[status] || 'bg-muted text-foreground border-border';
};

const getStatusDot = (status: string) => {
  const map: Record<string, string> = {
    REPORTED: 'bg-blue-500',
    UNDER_INVESTIGATION: 'bg-amber-500',
    ADJUSTED: 'bg-purple-500',
    APPROVED: 'bg-green-500',
    PAID: 'bg-emerald-500',
    DENIED: 'bg-red-500',
  };
  return map[status] || 'bg-gray-500';
};

const INCIDENT_TYPE_CONFIG: Record<string, { labelKey: string; badge: string }> = {
  BI: {
    labelKey: 'adminCyberClaims:incidentType.BI',
    badge: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800/30',
  },
  DR: {
    labelKey: 'adminCyberClaims:incidentType.DR',
    badge: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800/30',
  },
  CE: {
    labelKey: 'adminCyberClaims:incidentType.CE',
    badge: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800/30',
  },
  SR: {
    labelKey: 'adminCyberClaims:incidentType.SR',
    badge: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800/30',
  },
  CM: {
    labelKey: 'adminCyberClaims:incidentType.CM',
    badge: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-300 dark:border-cyan-800/30',
  },
  PL: {
    labelKey: 'adminCyberClaims:incidentType.PL',
    badge: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800/30',
  },
  RD: {
    labelKey: 'adminCyberClaims:incidentType.RD',
    badge: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-800/30',
  },
  ML: {
    labelKey: 'adminCyberClaims:incidentType.ML',
    badge: 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-900/30 dark:text-pink-300 dark:border-pink-800/30',
  },
  SE: {
    labelKey: 'adminCyberClaims:incidentType.SE',
    badge: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800/30',
  },
  OTHER: {
    labelKey: 'adminCyberClaims:incidentType.OTHER',
    badge: 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-900/30 dark:text-gray-300 dark:border-gray-800/30',
  },
};

const getIncidentBadge = (type: string) => {
  return INCIDENT_TYPE_CONFIG[type]?.badge || INCIDENT_TYPE_CONFIG.OTHER.badge;
};

const formatTnd = (value: number | string | null | undefined, locale?: string) => {
  if (value === null || value === undefined) return '—';
  const numericValue = typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) : value;
  if (!Number.isFinite(numericValue)) return '—';
  return numericValue.toLocaleString(locale || undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const parseNumericAmount = (value: number | string | null | undefined): number => {
  if (value === null || value === undefined) return 0;
  const numericValue = typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) : value;
  return Number.isFinite(numericValue) ? numericValue : 0;
};

// ── Component ──────────────────────────────────────────────────────────────

export default function AdminCyberClaimsPage() {
  const { t, i18n } = useTranslation(['common', 'adminCommon', 'adminCyberClaims']);
  const locale = i18n.language === 'ar' ? 'ar-TN' : i18n.language === 'fr' ? 'fr-TN' : undefined;
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Detail dialog state
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [newStatus, setNewStatus] = useState<string>('');
  const [approvedAmount, setApprovedAmount] = useState<string>('');
  const [adjusterComment, setAdjusterComment] = useState<string>('');
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{open: boolean; title: string; description: string; onConfirm: () => void}>({open: false, title: '', description: '', onConfirm: () => {}});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const clearFieldError = (field: string) => {
    setFieldErrors(prev => {
      const next = {...prev};
      delete next[field];
      return next;
    });
  };

  const fetchClaims = useCallback(async () => {
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== 'ALL') {
        params.set('status', statusFilter);
      }
      params.set('page', String(page));
      params.set('limit', '10');
      const res = await fetchWithAuth(`/api/admin/cyber-claims?${params.toString()}`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.error || `Request failed with status ${res.status}`);
      }
      const data = await res.json();
      setClaims(data.claims || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      console.error('Failed to fetch cyber claims:', err);
      setError(t('errors.failedToLoad', 'Failed to load data'));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page]);

  useEffect(() => {
    fetchClaims();
  }, [fetchClaims]);

  // Summary stats
  const stats = useMemo(() => {
    const totalClaims = claims.length;
    const totalEstimatedLoss = claims.reduce((sum, c) => sum + parseNumericAmount(c.estimatedLoss), 0);
    const totalApproved = claims.reduce((sum, c) => sum + parseNumericAmount(c.approvedAmount), 0);
    const totalPaid = claims
      .filter((c) => c.statusCode === 'PAID')
      .reduce((sum, c) => sum + parseNumericAmount(c.approvedAmount), 0);
    return { totalClaims, totalEstimatedLoss, totalApproved, totalPaid };
  }, [claims]);

  const openDetail = (claim: Claim) => {
    setSelectedClaim(claim);
    setNewStatus('');
    setApprovedAmount(claim.approvedAmount?.toString() || '');
    setAdjusterComment(claim.adjusterComment || '');
    setFieldErrors({});
    setDetailOpen(true);
  };

  const handleUpdate = async (action: 'update' | 'markPaid') => {
    if (!selectedClaim) return;
    // Validate fields before submission
    const errors: Record<string, string> = {};
    if (newStatus === 'APPROVED' || newStatus === 'ADJUSTED') {
      if (!approvedAmount || Number(approvedAmount) <= 0) {
        errors.approvedAmount = t('common:validation.number.positive');
      }
    }
    if (newStatus && !adjusterComment.trim()) {
      errors.adjusterComment = t('common:validation.required');
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setActionLoading(true);

    try {
      const body: Record<string, unknown> = { claimId: selectedClaim.id };

      if (action === 'markPaid') {
        body.status = 'PAID';
      } else {
        if (newStatus) body.status = newStatus;
        if (adjusterComment.trim()) body.adjusterComment = adjusterComment.trim();
        if (approvedAmount && (newStatus === 'APPROVED' || newStatus === 'ADJUSTED')) {
          body.approvedAmount = approvedAmount;
        }
      }

      const res = await fetchWithAuth('/api/admin/cyber-claims', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(
          action === 'markPaid'
            ? t('adminCyberClaims:toast.markPaidSuccess')
            : t('adminCyberClaims:toast.updateSuccess')
        );
        setDetailOpen(false);
        fetchClaims();
      } else {
        toast.error(data.error || t('adminCyberClaims:toast.updateFailed'));
      }
    } catch {
      toast.error(t('adminCyberClaims:toast.actionFailed'));
    } finally {
      setActionLoading(false);
    }
  };

  const getAvailableTransitions = (status: string): string[] => {
    const flow: Record<string, string[]> = {
      REPORTED: ['UNDER_INVESTIGATION', 'DENIED'],
      UNDER_INVESTIGATION: ['ADJUSTED', 'DENIED'],
      ADJUSTED: ['APPROVED', 'DENIED'],
      APPROVED: ['PAID'],
      PAID: [],
      DENIED: [],
    };
    return flow[status] || [];
  };

  // ── Loading ──────────────────────────────────────────────────────────────

  if (error) {
    return (
      <Protected roles={[Roles.ADMIN, Roles.SUPER_ADMIN]}>
        <PageErrorState message={error} onRetry={fetchClaims} />
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
          <ShieldAlert className="h-6 w-6 text-primary" /> {t('adminCyberClaims:title')}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {t('adminCyberClaims:subtitle')}
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 animate-fade-in-up">
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="bg-blue-50 dark:bg-blue-900/30 rounded-xl p-2">
                <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">{t('adminCyberClaims:stats.totalClaims')}</p>
                <p className="text-xl font-bold text-foreground">{stats.totalClaims}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="bg-amber-50 dark:bg-amber-900/30 rounded-xl p-2">
                <TrendingUp className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">{t('adminCyberClaims:stats.estLoss')}</p>
                <p className="text-xl font-bold text-foreground">{formatTnd(stats.totalEstimatedLoss, locale)}</p>
                <p className="text-[10px] text-muted-foreground">{t('common:unit.tnd')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="bg-green-50 dark:bg-green-900/30 rounded-xl p-2">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">{t('adminCyberClaims:stats.approved')}</p>
                <p className="text-xl font-bold text-foreground">{formatTnd(stats.totalApproved, locale)}</p>
                <p className="text-[10px] text-muted-foreground">{t('common:unit.tnd')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-50 dark:bg-emerald-900/30 rounded-xl p-2">
                <Banknote className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">{t('adminCyberClaims:stats.paid')}</p>
                <p className="text-xl font-bold text-foreground">{formatTnd(stats.totalPaid, locale)}</p>
                <p className="text-[10px] text-muted-foreground">{t('common:unit.tnd')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter bar */}
      <div className="mb-4 flex items-center gap-3 animate-fade-in-up">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Label className="text-muted-foreground text-sm whitespace-nowrap">{t('adminCyberClaims:filter.status')}</Label>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder={t('adminCyberClaims:filter.filterByStatus')} />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s === 'ALL' ? t('adminCyberClaims:filter.allStatuses') : s.replace(/_/g, ' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">
          {t('adminCyberClaims:filter.claimCount', { count: total })}
        </span>
      </div>

      {/* Table */}
      {claims.length === 0 ? (
        <Card className="shadow-md animate-fade-in-up">
          <CardContent className="p-12 text-center">
            <div className="bg-muted w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground font-medium">{t('adminCyberClaims:empty.noClaims')}</p>
            <p className="text-muted-foreground text-sm mt-1">
              {statusFilter !== 'ALL'
                ? t('adminCyberClaims:empty.tryChangingFilter')
                : t('adminCyberClaims:empty.newClaims')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-md animate-fade-in-up">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">{t('adminCyberClaims:title')}</caption>
                <thead>
                  <tr className="border-b bg-muted/80">
                    <th className="text-start p-3 font-medium text-muted-foreground">{t('adminCyberClaims:table.claimId')}</th>
                    <th className="text-start p-3 font-medium text-muted-foreground">{t('adminCyberClaims:table.policyholder')}</th>
                    <th className="text-start p-3 font-medium text-muted-foreground">{t('adminCyberClaims:table.incidentDate')}</th>
                    <th className="text-start p-3 font-medium text-muted-foreground">{t('adminCyberClaims:table.incidentType')}</th>
                    <th className="text-start p-3 font-medium text-muted-foreground">{t('adminCyberClaims:table.estimatedLoss')}</th>
                    <th className="text-start p-3 font-medium text-muted-foreground">{t('adminCyberClaims:table.status')}</th>
                    <th className="text-start p-3 font-medium text-muted-foreground">{t('adminCyberClaims:table.approvedAmount')}</th>
                    <th className="text-start p-3 font-medium text-muted-foreground">{t('adminCyberClaims:table.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {claims.map((claim) => (
                    <tr key={claim.id} className="border-b table-row-hover">
                      <td className="p-3 font-mono text-xs text-muted-foreground">
                        {String(claim.id).slice(-8)}
                      </td>
                      <td className="p-3">
                        <div>
                          <p className="font-medium">
                            {claim.customer.user.firstName} {claim.customer.user.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                            {claim.customer.user.email}
                          </p>
                        </div>
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {formatDate(claim.incidentDate)}
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" title={typeof claim.incidentType === 'object' ? claim.incidentType.typeName : claim.incidentType} className={getIncidentBadge(typeof claim.incidentType === 'object' ? claim.incidentType.typeCode : claim.incidentType)}>
                          {typeof claim.incidentType === 'object' ? claim.incidentType.typeName : claim.incidentType}
                        </Badge>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {t(INCIDENT_TYPE_CONFIG[typeof claim.incidentType === 'object' ? claim.incidentType.typeCode : claim.incidentType]?.labelKey || 'adminCyberClaims:incidentType.OTHER')}
                        </p>
                      </td>
                      <td className="p-3 font-semibold text-foreground">
                        {formatTnd(claim.estimatedLoss, locale)} {t('common:unit.tnd')}
                      </td>
                      <td className="p-3">
                        {(() => {
                          const statusKey = typeof claim.statusCode === 'string' ? claim.statusCode : '';
                          const statusLabel = claim.statusName ?? (typeof claim.statusCode === 'string' ? claim.statusCode.replace(/_/g, ' ') : '—');
                          return (
                            <Badge variant="outline" title={statusLabel} className={getStatusBadge(statusKey)}>
                              <span className={`w-1.5 h-1.5 rounded-full ${getStatusDot(statusKey)} me-1.5`} />
                              {statusLabel}
                            </Badge>
                          );
                        })()}
                      </td>
                      <td className="p-3 font-semibold">
                        {claim.approvedAmount !== null ? (
                          <span className="text-emerald-600 dark:text-emerald-400">
                            {formatTnd(claim.approvedAmount, locale)} {t('common:unit.tnd')}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-3">
                        <Button
                          size="sm"
                          variant="outline"
                          className="hover:bg-primary/5 hover:border-primary/30 transition-all"
                          onClick={() => openDetail(claim)}
                          aria-label={"View claim " + String(claim.id).slice(-8)}
                        >
                          <FileText className="h-3.5 w-3.5 me-1" /> {t('adminCyberClaims:table.view')}
                        </Button>
                      </td>
                    </tr>
                  ))}
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

      {/* Claim Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-primary" /> {t('adminCyberClaims:dialog.title')}
            </DialogTitle>
            <DialogDescription>
              {selectedClaim && (
                <>
                  {t('adminCyberClaims:dialog.claimDescription', { id: String(selectedClaim.id).slice(-8), name: `${selectedClaim.customer.user.firstName} ${selectedClaim.customer.user.lastName}` })}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedClaim && (
            <div className="space-y-4">
              {/* Claim Info Grid */}
              <div className="grid grid-cols-2 gap-3 bg-muted rounded-xl p-3">
                {[
                  { label: t('adminCyberClaims:dialog.fields.claimId'), value: String(selectedClaim.id), mono: true },
                  { label: t('adminCyberClaims:dialog.fields.status'), value: selectedClaim.statusCode, badge: true },
                  { label: t('adminCyberClaims:dialog.fields.policyholder'), value: `${selectedClaim.customer.user.firstName} ${selectedClaim.customer.user.lastName}` },
                  { label: t('adminCyberClaims:dialog.fields.product'), value: selectedClaim.policy.product.productName },
                  { label: t('adminCyberClaims:dialog.fields.incidentDate'), value: formatDate(selectedClaim.incidentDate) },
                  { label: t('adminCyberClaims:dialog.fields.reportedDate'), value: formatDate(selectedClaim.reportedDate) },
                  { label: t('adminCyberClaims:dialog.fields.incidentType'), value: typeof selectedClaim.incidentType === 'object' ? selectedClaim.incidentType.typeCode : selectedClaim.incidentType, incidentBadge: true },
                  { label: t('adminCyberClaims:dialog.fields.policyLimit'), value: `${formatTnd(selectedClaim.policy.policyLimit, locale)} ${t('common:unit.tnd')}` },
                  { label: t('adminCyberClaims:dialog.fields.estimatedLoss'), value: `${formatTnd(selectedClaim.estimatedLoss, locale)} ${t('common:unit.tnd')}`, bold: true },
                  { label: t('adminCyberClaims:dialog.fields.deductibleSIR'), value: `${formatTnd(selectedClaim.policy.deductibleSIR, locale)} ${t('common:unit.tnd')}` },
                  { label: t('adminCyberClaims:dialog.fields.approvedAmount'), value: selectedClaim.approvedAmount !== null ? `${formatTnd(selectedClaim.approvedAmount, locale)} ${t('common:unit.tnd')}` : '—', emerald: selectedClaim.approvedAmount !== null },
                  { label: t('adminCyberClaims:dialog.fields.paidDate'), value: selectedClaim.paidDate ? formatDate(selectedClaim.paidDate) : '—' },
                ].map((field) => (
                  <div key={field.label}>
                    <Label className="text-muted-foreground text-xs uppercase tracking-wider">{field.label}</Label>
                    {field.badge ? (
                      <p className="mt-0.5">
                        {(() => {
                          const raw = field.value;
                          const statusKey = typeof raw === 'string' ? raw : '';
                          const statusLabel = typeof raw === 'string' ? raw.replace(/_/g, ' ') : String(raw);
                          return (
                            <Badge variant="outline" title={statusLabel} className={getStatusBadge(statusKey)}>
                              <span className={`w-1.5 h-1.5 rounded-full ${getStatusDot(statusKey)} me-1.5`} />
                              {statusLabel}
                            </Badge>
                          );
                        })()}
                      </p>
                    ) : field.incidentBadge ? (
                      <p className="mt-0.5">
                        <Badge variant="outline" title={field.value} className={getIncidentBadge(field.value)}>
                          {field.value}
                        </Badge>
                        <span className="text-xs text-muted-foreground ms-1.5">
                          {t(INCIDENT_TYPE_CONFIG[field.value]?.labelKey || 'adminCyberClaims:incidentType.OTHER')}
                        </span>
                      </p>
                    ) : (
                      <p
                        className={`text-sm mt-0.5 ${
                          field.mono ? 'font-mono' : ''
                        } ${
                          field.emerald ? 'font-bold text-emerald-600 dark:text-emerald-400' : ''
                        } ${
                          field.bold ? 'font-semibold' : ''
                        }`}
                      >
                        {field.value}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* Incident Description */}
              <div>
                <Label className="text-muted-foreground text-xs uppercase tracking-wider">{t('adminCyberClaims:dialog.incidentDescription')}</Label>
                <div className="mt-1 bg-card rounded-xl border border-border p-3">
                  <p className="text-sm whitespace-pre-wrap">{selectedClaim.description}</p>
                </div>
              </div>

              {/* Forensic Report */}
              {selectedClaim.forensicReport && (
                <div>
                  <Label className="text-muted-foreground text-xs uppercase tracking-wider">{t('adminCyberClaims:dialog.forensicReport')}</Label>
                  <div className="mt-1 bg-card rounded-xl border border-border p-3">
                    <p className="text-sm whitespace-pre-wrap">{selectedClaim.forensicReport}</p>
                  </div>
                </div>
              )}

              {/* Existing Adjuster Comment */}
              {selectedClaim.adjusterComment && (
                <div className="bg-muted rounded-xl p-3">
                  <Label className="text-muted-foreground text-xs uppercase tracking-wider">{t('adminCyberClaims:dialog.existingAdjusterComment')}</Label>
                  <p className="text-sm mt-1">{selectedClaim.adjusterComment}</p>
                </div>
              )}

              {/* Action Section - only for non-terminal claims */}
              {selectedClaim.statusCode !== 'PAID' && selectedClaim.statusCode !== 'DENIED' && (
                <div className="border-t pt-4 space-y-4">
                  <h4 className="text-sm font-semibold flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-primary" /> {t('adminCyberClaims:dialog.claimActions')}
                  </h4>

                  {/* Status transition */}
                  {getAvailableTransitions(selectedClaim.statusCode).length > 0 && (
                    <div>
                      <Label htmlFor="statusSelect">{t('adminCyberClaims:dialog.updateStatus')}</Label>
                      <Select value={newStatus} onValueChange={setNewStatus}>
                        <SelectTrigger id="statusSelect" className="mt-1">
                          <SelectValue placeholder={t('adminCyberClaims:dialog.selectNewStatus')} />
                        </SelectTrigger>
                        <SelectContent>
                          {getAvailableTransitions(selectedClaim.statusCode).map((s) => (
                            <SelectItem key={s} value={s}>
                              {s.replace(/_/g, ' ')}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Approved Amount - show when moving to APPROVED or ADJUSTED */}
                  {(newStatus === 'APPROVED' || newStatus === 'ADJUSTED' || selectedClaim.statusCode === 'APPROVED' || selectedClaim.statusCode === 'ADJUSTED') && (
                    <div>
                      <Label htmlFor="approvedAmount">
                        {t('adminCyberClaims:dialog.approvedAmountTnd')} {(newStatus === 'APPROVED' || newStatus === 'ADJUSTED') && <RequiredIndicator />}
                      </Label>
                      <Input
                        id="approvedAmount"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder={selectedClaim.estimatedLoss?.toString() || '0.00'}
                        value={approvedAmount}
                        onChange={(e) => { setApprovedAmount(e.target.value); clearFieldError('approvedAmount'); }}
                        onBlur={() => {
                          if ((newStatus === 'APPROVED' || newStatus === 'ADJUSTED') && (!approvedAmount || Number(approvedAmount) <= 0)) setFieldErrors(prev => ({...prev, approvedAmount: t('common:validation.number.positive') }));
                        }}
                        className="mt-1"
                        aria-invalid={!!fieldErrors.approvedAmount}
                        aria-describedby={fieldErrors.approvedAmount ? 'approvedAmount-error' : undefined}
                      />
                      <FieldError id="approvedAmount-error">{fieldErrors.approvedAmount}</FieldError>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t('adminCyberClaims:dialog.estimatedLossLabel', { amount: formatTnd(selectedClaim.estimatedLoss, locale) })}
                      </p>
                    </div>
                  )}

                  {/* Adjuster Comment */}
                  <div>
                    <Label htmlFor="adjusterComment">
                      {t('adminCyberClaims:dialog.adjusterComment')} {newStatus && <RequiredIndicator />}
                    </Label>
                    <Textarea
                      id="adjusterComment"
                      placeholder={t('adminCyberClaims:dialog.adjusterPlaceholder')}
                      value={adjusterComment}
                      onChange={(e) => { setAdjusterComment(e.target.value); clearFieldError('adjusterComment'); }}
                      onBlur={() => {
                        if (newStatus && !adjusterComment.trim()) setFieldErrors(prev => ({...prev, adjusterComment: t('common:validation.required') }));
                      }}
                      maxLength={2000}
                      className="mt-1 focus-ring"
                      aria-invalid={!!fieldErrors.adjusterComment}
                      aria-describedby={fieldErrors.adjusterComment ? 'adjusterComment-error' : undefined}
                    />
                    <div className="flex justify-between">
                      <FieldError id="adjusterComment-error">{fieldErrors.adjusterComment}</FieldError>
                      <CharCounter current={adjusterComment.length} max={2000} />
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-2">
                    {getAvailableTransitions(selectedClaim.statusCode).length > 0 && newStatus && (
                      <Button
                        size="sm"
                        className="bg-primary hover:bg-primary/90 text-primary-foreground transition-all hover:shadow-md"
                        onClick={() => {
                          const isDenied = newStatus === 'DENIED';
                          if (isDenied) {
                            setConfirmDialog({
                              open: true,
                              title: t('adminCyberClaims:dialog.confirmDenyTitle', 'Confirm Claim Denial'),
                              description: t('adminCyberClaims:dialog.confirmDeny', 'Denying this claim is irreversible. The policyholder will be notified of the denial. Are you sure you want to deny this claim?'),
                              onConfirm: () => handleUpdate('update')
                            });
                          } else {
                            handleUpdate('update');
                          }
                        }}
                        disabled={actionLoading}
                      >
                        <CheckCircle className="h-4 w-4 me-1" />
                        {t('adminCyberClaims:dialog.updateTo', { status: newStatus.replace(/_/g, ' ') })}
                      </Button>
                    )}

                    {/* Mark as Paid - only when APPROVED */}
                    {selectedClaim.statusCode === 'APPROVED' && (
                      <Button
                        size="sm"
                        className="bg-emerald-500 hover:bg-emerald-600 text-white transition-all hover:shadow-md"
                        onClick={() => setConfirmDialog({
                          open: true,
                          title: t('adminCyberClaims:dialog.confirmMarkPaidTitle', 'Confirm Mark as Paid'),
                          description: t('adminCyberClaims:dialog.confirmMarkPaid', 'Marking this claim as PAID will trigger a financial payout to the policyholder. This is an irreversible financial action. Are you sure you want to proceed?'),
                          onConfirm: () => handleUpdate('markPaid')
                        })}
                        disabled={actionLoading}
                      >
                        <Banknote className="h-4 w-4 me-1" /> {t('adminCyberClaims:dialog.markAsPaid')}
                      </Button>
                    )}

                    {/* Deny button if available */}
                    {getAvailableTransitions(selectedClaim.statusCode).includes('DENIED') && !newStatus && (
                      <Button
                        size="sm"
                        variant="destructive"
                        className="transition-all hover:shadow-md"
                        onClick={() => {
                          setNewStatus('DENIED');
                        }}
                        disabled={actionLoading}
                      >
                        <XCircle className="h-4 w-4 me-1" /> {t('adminCyberClaims:dialog.denyClaim')}
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Terminal Status Messages */}
              {selectedClaim.statusCode === 'PAID' && (
                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3">
                  <CheckCircle className="h-5 w-5" />
                  <span>{t('adminCyberClaims:dialog.claimPaid')}</span>
                  {selectedClaim.paidDate && (
                    <span className="text-muted-foreground text-sm ms-2">
                      {t('adminCyberClaims:dialog.on')} {formatDate(selectedClaim.paidDate)}
                    </span>
                  )}
                </div>
              )}

              {selectedClaim.statusCode === 'DENIED' && (
                <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400 font-medium bg-red-50 dark:bg-red-900/20 rounded-xl p-3">
                  <XCircle className="h-5 w-5" />
                  <span>{t('adminCyberClaims:dialog.claimDenied')}</span>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog for financial/legal actions */}
      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog(prev => ({...prev, open}))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDialog.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common:action.cancel', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDialog.onConfirm}>{t('common:action.confirm', 'Confirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </Protected>
  );
}

