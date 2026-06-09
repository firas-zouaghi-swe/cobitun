'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import Protected from '@/components/Protected';
import { fetchWithAuth, Roles } from '@/hooks/use-auth';
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
import { FileText, DollarSign, CheckCircle, XCircle, AlertTriangle, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { formatDateTime } from '@/lib/i18n';
import { PageLoadingState, PageErrorState } from '@/components/shared/PageStates';
import { FieldError, RequiredIndicator, CharCounter } from '@/components/ui/form-warning';
import { safeToFixed } from '@/lib/utils';

interface ClaimRow {
  id: number;
  claimNumber: string;
  outageDurationHours: number;
  mttrHours: number;
  insuredHours: number;
  payoutAmount: number;
  statusCode: string;
  statusName: string;
  autoApproved: boolean;
  adminOverride: boolean;
  adminComment: string | null;
  payoutCalculationJson: string | null;
  payoutDate: string | null;
  payoutReference: string | null;
  createdAt: string;
  customer: { user: { firstName: string; lastName: string } };
  policy: { cloudProvider: { organisationName: string; asn: string } };
}

export default function AdminParametricClaimsPage() {
  const { t } = useTranslation(['common', 'adminCommon', 'adminParametricClaims']);
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedClaim, setSelectedClaim] = useState<ClaimRow | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [adminComment, setAdminComment] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
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
      params.set('page', String(page));
      params.set('limit', '10');
      const res = await fetchWithAuth(`/api/admin/parametric-claims?${params.toString()}`);
      const data = await res.json();
      setClaims(data.claims || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      console.error('Failed to fetch claims:', err);
      setError(t('errors.failedToLoad', 'Failed to load data'));
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchClaims();
  }, [fetchClaims]);

  const handleAction = async (action: string) => {
    if (!selectedClaim) return;
    const errors: Record<string, string> = {};
    if (action === 'dispute' && !adminComment.trim()) {
      errors.adminComment = t('common:validation.required');
    }
    if (action === 'reject' && !adminComment.trim()) {
      errors.adminComment = t('common:validation.required');
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetchWithAuth('/api/admin/parametric-claims', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claimId: selectedClaim.id,
          action,
          adminComment: action === 'dispute' ? adminComment.trim() : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(t('adminCommon:parametricClaims.claimAction', { action }));
        setDialogOpen(false);
        setAdminComment('');
        fetchClaims();
      } else {
        toast.error(data.error || t('adminParametricClaims:toast.claimActionFailed', { action }));
      }
    } catch {
      toast.error(t('adminParametricClaims:toast.actionFailed'));
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      DETECTED: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800/30',
      VALIDATED: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-300 dark:border-cyan-800/30',
      APPROVED: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800/30',
      PAID: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800/30',
      DISPUTED: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800/30',
      REJECTED: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800/30',
    };
    return colors[status] || 'bg-muted text-foreground border-border';
  };

  const getStatusDot = (status: string) => {
    const colors: Record<string, string> = {
      DETECTED: 'bg-blue-500',
      VALIDATED: 'bg-cyan-500',
      APPROVED: 'bg-yellow-500',
      PAID: 'bg-green-500',
      DISPUTED: 'bg-red-500',
      REJECTED: 'bg-red-500',
    };
    return colors[status] || 'bg-gray-500';
  };

  const openManageDialog = (claim: ClaimRow) => {
    setSelectedClaim(claim);
    setAdminComment('');
    setFieldErrors({});
    setDialogOpen(true);
  };

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

  return (
    <Protected roles={[Roles.ADMIN, Roles.SUPER_ADMIN]}>
      <div className="page-enter">
      <div className="mb-6 animate-fade-in-down">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <DollarSign className="h-6 w-6 text-primary" /> {t('adminParametricClaims:title')}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">{t('adminParametricClaims:subtitle')}</p>
      </div>

      <Card className="shadow-md animate-fade-in-up">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">{t('adminParametricClaims:title')}</caption>
              <thead>
                <tr className="border-b bg-muted/80">
                  <th className="text-start p-3 font-medium text-muted-foreground">{t('adminParametricClaims:table.claimNumber')}</th>
                  <th className="text-start p-3 font-medium text-muted-foreground">{t('adminParametricClaims:table.customer')}</th>
                  <th className="text-start p-3 font-medium text-muted-foreground">{t('adminParametricClaims:table.provider')}</th>
                  <th className="text-start p-3 font-medium text-muted-foreground">{t('adminParametricClaims:table.insuredHours')}</th>
                  <th className="text-start p-3 font-medium text-muted-foreground">{t('adminParametricClaims:table.payoutTnd')}</th>
                  <th className="text-start p-3 font-medium text-muted-foreground">{t('adminParametricClaims:table.status')}</th>
                  <th className="text-start p-3 font-medium text-muted-foreground">{t('adminParametricClaims:table.type')}</th>
                  <th className="text-start p-3 font-medium text-muted-foreground">{t('adminParametricClaims:table.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {claims.length === 0 ? (
                  <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">
                    <FileText className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    {t('adminParametricClaims:table.noClaims')}
                  </td></tr>
                ) : (
                  claims.map((c) => (
                    <tr key={c.id} className="border-b table-row-hover">
                      <td className="p-3 font-mono text-xs text-muted-foreground">{c.claimNumber || `CLM-${String(c.id).padStart(6, '0')}`}</td>
                      <td className="p-3 font-medium">{c.customer.user.firstName} {c.customer.user.lastName}</td>
                      <td className="p-3 text-muted-foreground">{c.policy.cloudProvider.organisationName}</td>
                      <td className="p-3 font-semibold text-primary">{safeToFixed(c.insuredHours, 2)}</td>
                      <td className="p-3 font-semibold text-emerald-600 dark:text-emerald-400">{safeToFixed(c.payoutAmount, 2)}</td>
                      <td className="p-3">
                        <Badge variant="outline" title={c.statusName || c.statusCode} className={getStatusBadge(c.statusCode)}>
                          <span className={`w-1.5 h-1.5 rounded-full ${getStatusDot(c.statusCode)} me-1.5`} />
                          {c.statusName || c.statusCode}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" title={c.autoApproved ? t('adminParametricClaims:table.auto') : t('adminParametricClaims:table.manual')} className={c.autoApproved ? 'border-blue-200 text-blue-700 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800/30' : 'border-orange-200 text-orange-700 bg-orange-50 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800/30'}>
                          {c.autoApproved ? t('adminParametricClaims:table.auto') : t('adminParametricClaims:table.manual')}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <Button size="sm" variant="outline" className="hover:bg-primary/5 hover:border-primary/30 transition-all" onClick={() => openManageDialog(c)} aria-label={"Manage claim " + (c.claimNumber || 'CLM-' + String(c.id).padStart(6, '0'))}>
                          {t('adminParametricClaims:table.manage')}
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

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

      {/* Manage Claim Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" /> {t('adminParametricClaims:dialog.title')}
            </DialogTitle>
            <DialogDescription>{t('adminParametricClaims:dialog.description')}</DialogDescription>
          </DialogHeader>

          {selectedClaim && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: t('adminParametricClaims:dialog.fields.claimId'), value: selectedClaim.claimNumber || `CLM-${String(selectedClaim.id).padStart(6, '0')}`, mono: true },
                  { label: t('adminParametricClaims:dialog.fields.status'), value: selectedClaim.statusCode, badge: true },
                  { label: t('adminParametricClaims:dialog.fields.customer'), value: `${selectedClaim.customer.user.firstName} ${selectedClaim.customer.user.lastName}` },
                  { label: t('adminParametricClaims:dialog.fields.provider'), value: `${selectedClaim.policy.cloudProvider.organisationName} (ASN ${selectedClaim.policy.cloudProvider.asn})` },
                  { label: t('adminParametricClaims:dialog.fields.outageDuration'), value: `${safeToFixed(selectedClaim.outageDurationHours, 2)} ${t('adminParametricClaims:dialog.hours')}`, bold: true },
                  { label: t('adminParametricClaims:dialog.fields.mttr'), value: `${selectedClaim.mttrHours} ${t('adminParametricClaims:dialog.hours')}` },
                  { label: t('adminParametricClaims:dialog.fields.insuredHours'), value: `${safeToFixed(selectedClaim.insuredHours, 2)} ${t('adminParametricClaims:dialog.hours')}`, highlight: true },
                  { label: t('adminParametricClaims:dialog.fields.payoutAmount'), value: `${safeToFixed(selectedClaim.payoutAmount, 2)} ${t('common:unit.tnd', 'TND')}`, emerald: true },
                  { label: t('adminParametricClaims:dialog.fields.autoApproved'), value: selectedClaim.autoApproved ? t('adminParametricClaims:dialog.yes') : t('adminParametricClaims:dialog.no') },
                  { label: t('adminParametricClaims:dialog.fields.created'), value: formatDateTime(selectedClaim.createdAt) },
                ].map((field) => (
                  <div key={field.label}>
                    <Label className="text-muted-foreground text-xs uppercase tracking-wider">{field.label}</Label>
                    {field.badge ? (
                      <p className="mt-0.5"><Badge variant="outline" className={getStatusBadge(field.value)}>{field.value}</Badge></p>
                    ) : (
                      <p className={`text-sm mt-0.5 ${field.mono ? 'font-mono' : ''} ${field.highlight ? 'font-semibold text-primary' : ''} ${field.emerald ? 'font-bold text-emerald-600 dark:text-emerald-400' : ''} ${field.bold ? 'font-semibold' : ''}`}>
                        {field.value}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {selectedClaim.adminComment && (
                <div className="bg-muted rounded-xl p-3">
                  <Label className="text-muted-foreground text-xs uppercase tracking-wider">{t('adminParametricClaims:dialog.fields.adminComment')}</Label>
                  <p className="text-sm mt-1">{selectedClaim.adminComment}</p>
                </div>
              )}

              {selectedClaim.payoutCalculationJson && (
                <div className="bg-muted rounded-xl p-3">
                  <Label className="text-muted-foreground text-xs uppercase tracking-wider">{t('adminParametricClaims:dialog.fields.payoutCalculation')}</Label>
                  <pre className="text-xs mt-1 whitespace-pre-wrap overflow-auto max-h-40 bg-card rounded-lg p-2 border border-border">{
                    (() => {
                      try {
                        return JSON.stringify(JSON.parse(selectedClaim.payoutCalculationJson), null, 2);
                      } catch {
                        return selectedClaim.payoutCalculationJson;
                      }
                    })()
                  }</pre>
                </div>
              )}

              {selectedClaim.payoutDate && (
                <div className="grid grid-cols-2 gap-4 bg-green-50 dark:bg-green-900/30 rounded-xl p-3">
                  <div>
                    <Label className="text-muted-foreground text-xs uppercase tracking-wider">{t('adminParametricClaims:dialog.fields.payoutDate')}</Label>
                    <p className="text-sm mt-0.5">{formatDateTime(selectedClaim.payoutDate)}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs uppercase tracking-wider">{t('adminParametricClaims:dialog.fields.reference')}</Label>
                    <p className="text-sm mt-0.5 font-mono">{selectedClaim.payoutReference}</p>
                  </div>
                </div>
              )}

              <div>
                <Label htmlFor="adminComment">
                  {t('adminParametricClaims:dialog.adminCommentLabel')} {(selectedClaim.statusCode !== 'PAID' && selectedClaim.statusCode !== 'REJECTED') && <RequiredIndicator />}
                </Label>
                <Textarea
                  id="adminComment"
                  placeholder={t('adminParametricClaims:dialog.commentPlaceholder')}
                  value={adminComment}
                  onChange={(e) => { setAdminComment(e.target.value); clearFieldError('adminComment'); }}
                  onBlur={() => {
                    if (!adminComment.trim()) setFieldErrors(prev => ({...prev, adminComment: t('common:validation.required') }));
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

              <DialogFooter className="flex-col gap-2 sm:flex-row">
                {selectedClaim.statusCode !== 'PAID' && selectedClaim.statusCode !== 'REJECTED' && (
                  <>
                    {selectedClaim.statusCode !== 'DISPUTED' && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleAction('dispute')}
                        disabled={actionLoading || !adminComment}
                        className="transition-all"
                        aria-label={"Dispute claim " + (selectedClaim.claimNumber || 'CLM-' + String(selectedClaim.id).padStart(6, '0'))}
                      >
                        <AlertTriangle className="h-4 w-4 me-1" /> {t('adminParametricClaims:dialog.dispute')}
                      </Button>
                    )}
                    {selectedClaim.statusCode !== 'APPROVED' && (
                      <Button
                        size="sm"
                        className="bg-yellow-500 hover:bg-yellow-600 text-white transition-all"
                        onClick={() => handleAction('approve')}
                        disabled={actionLoading}
                        aria-label={"Approve claim " + (selectedClaim.claimNumber || 'CLM-' + String(selectedClaim.id).padStart(6, '0'))}
                      >
                        <CheckCircle className="h-4 w-4 me-1" /> {t('adminParametricClaims:dialog.approve')}
                      </Button>
                    )}
                    {(selectedClaim.statusCode === 'APPROVED' || selectedClaim.statusCode === 'VALIDATED') && (
                      <Button
                        size="sm"
                        className="bg-emerald-500 hover:bg-emerald-600 text-white transition-all"
                        onClick={() => handleAction('pay')}
                        disabled={actionLoading}
                        aria-label={"Pay claim " + (selectedClaim.claimNumber || 'CLM-' + String(selectedClaim.id).padStart(6, '0'))}
                      >
                        <DollarSign className="h-4 w-4 me-1" /> {t('adminParametricClaims:dialog.pay')}
                      </Button>
                    )}
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleAction('reject')}
                      disabled={actionLoading}
                      className="transition-all"
                      aria-label={"Reject claim " + (selectedClaim.claimNumber || 'CLM-' + String(selectedClaim.id).padStart(6, '0'))}
                    >
                      <XCircle className="h-4 w-4 me-1" /> {t('adminParametricClaims:dialog.reject')}
                    </Button>
                  </>
                )}
                {selectedClaim.statusCode === 'PAID' && (
                  <p className="text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
                    <CheckCircle className="h-4 w-4" /> {t('adminParametricClaims:dialog.claimPaid')}
                  </p>
                )}
                {selectedClaim.statusCode === 'REJECTED' && (
                  <p className="text-red-600 dark:text-red-400 font-medium flex items-center gap-1">
                    <XCircle className="h-4 w-4" /> {t('adminParametricClaims:dialog.claimRejected')}
                  </p>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
      </div>
    </Protected>
  );
}

