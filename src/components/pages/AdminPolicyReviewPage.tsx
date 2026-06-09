'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
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
import { useAppStore } from '@/lib/store';
import Protected from '@/components/Protected';
import { fetchWithAuth, Roles } from '@/hooks/use-auth';
import { toast } from 'sonner';
import { formatDate, formatDateTime } from '@/lib/i18n';
import { formatTnd } from '@/lib/utils';
import {
  FileText,
  Download,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Loader2,
  Shield,
  Eye,
  Upload,
  PenTool,
  CreditCard,
  Clock,
  AlertCircle,
  CheckCheck,
} from 'lucide-react';
import { PageLoadingState, PageEmptyState, PageErrorState } from '@/components/shared/PageStates';

const API_BASE = '/api/workflow';

// ─── Workflow Steps ──────────────────────────────────────────────

const WORKFLOW_STEP_KEYS = [
  'contractUploaded',
  'adminReview',
  'policyGenerated',
  'signAndPay',
  'finalApproval',
  'completed',
] as const;

const WORKFLOW_STEP_ICONS = [Upload, Eye, FileText, PenTool, Shield, CheckCircle2];

function getStepIndex(status: string): number {
  if (status === 'Rejected') return -1;
  const statusToStepKey: Record<string, string> = {
    ProviderContractUploaded: 'contractUploaded',
    AdminReviewing: 'adminReview',
    PolicyContractGenerated: 'policyGenerated',
    AwaitingSignatureAndPayment: 'signAndPay',
    ReadyForFinalApproval: 'finalApproval',
    UnderwritingCompleted: 'completed',
  };
  const key = statusToStepKey[status];
  if (!key) return 0;
  const idx = WORKFLOW_STEP_KEYS.indexOf(key as typeof WORKFLOW_STEP_KEYS[number]);
  return idx >= 0 ? idx : 0;
}

// ─── Status badge ────────────────────────────────────────────────

const statusBadgeStyles: Record<string, string> = {
  ProviderContractUploaded: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  AdminReviewing: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  PolicyContractGenerated: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  AwaitingSignatureAndPayment: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  ReadyForFinalApproval: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  UnderwritingCompleted: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  Rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

// ─── Interfaces ──────────────────────────────────────────────────

interface AuditLogEntry {
  id: number;
  action: string;
  createdAt: string;
  actorId: number | null;
  metadata?: string;
}

interface CustomerUser {
  firstName: string;
  lastName: string;
  email: string;
}

interface Customer {
  id: number;
  user: CustomerUser;
  address?: string;
}

interface PolicyApplication {
  id: number;
  statusCode: string;
  statusName: string;
  sector: string | null;
  annualTurnover: number | null;
  premiumAmount: number | null;
  providerContractPdfUrl: string | null;
  insurancePolicyContractPdfUrl: string | null;
  signedPolicyContractPdfUrl: string | null;
  premiumPaidAt: string | null;
  premiumTransactionId: string | null;
  adminFinalSignatureAt: string | null;
  adminFinalSignatureBy: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: Customer;
  auditLogs?: AuditLogEntry[];
  tasks?: { id: number; actionRequired: string; statusCode: string; completedAt: string | null; createdAt: string }[];
}

// ─── Component ───────────────────────────────────────────────────

export default function AdminPolicyReviewPage() {
  const { t } = useTranslation(['common', 'adminCommon', 'adminPolicyReview']);
  const { setCurrentPage, workflowContext, setWorkflowContext } = useAppStore();
  const policyId = workflowContext.policyId;

  const [application, setApplication] = useState<PolicyApplication | null>(null);
  const [loading, setLoading] = useState(Boolean(policyId));
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmFinalSignOpen, setConfirmFinalSignOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{open: boolean; title: string; description: string; onConfirm: () => void}>({open: false, title: '', description: '', onConfirm: () => {}});

  const fetchApplication = useCallback(async () => {
    try {
      const headers: Record<string, string> = {};
      const res = await fetchWithAuth(`${API_BASE}/policy-applications/${policyId}`, { headers });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setApplication(data.application);
      } else if (res.status === 404) {
        toast.error(t('adminPolicyReview:toast.notFound'));
      } else {
        const txt = await res.text();
        console.error('Failed to fetch application:', res.status, txt.slice(0, 240));
        toast.error(t('adminPolicyReview:toast.loadFailed'));
      }
    } catch {
      toast.error(t('adminPolicyReview:toast.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [policyId, t]);

  useEffect(() => {
    if (!policyId) return;
    void Promise.resolve().then(fetchApplication);
  }, [policyId, fetchApplication]);

  // Listen for external updates to the workflow application (e.g. approved from requests page)
  useEffect(() => {
    const handler = (e: Event) => {
      try {
        const detail = (e as CustomEvent).detail as { appId?: number } | undefined;
        if (!detail || !detail.appId) return;
        if (application && application.id === Number(detail.appId)) {
          // re-fetch the application to pick up status changes
          fetchApplication();
        }
      } catch (err) {
        // swallow
      }
    };

    window.addEventListener('workflowAppUpdated', handler as EventListener);
    return () => window.removeEventListener('workflowAppUpdated', handler as EventListener);
  }, [application, fetchApplication]);

  // ─── Review: Approve ──────────────────────────────────────────

  const handleApprove = async () => {
    if (!application) return;
    setActionLoading(true);
    try {
      const formData = new FormData();
      formData.append('action', 'review');
      formData.append('approved', 'true');

      const headers: Record<string, string> = {};
      const res = await fetchWithAuth(`${API_BASE}/policy-applications/${application.id}`, {
        method: 'PATCH',
        headers,
        body: formData,
      });
      const contentType = res.headers.get('content-type') || '';
      if (!res.ok) {
        const txt = await res.text();
        let err = t('adminPolicyReview:toast.approveFailed');
        try {
          if (contentType.includes('application/json')) {
            const json = JSON.parse(txt);
            err = json.error || err;
          } else {
            err = txt.substring(0, 240);
          }
        } catch (e) {
          // ignore parse
        }
        toast.error(err);
        return;
      }
      const data = contentType.includes('application/json') ? await res.json() : null;
      toast.success(t('adminCommon:policyReview.approved'));
      if (data?.application) setApplication(data.application as PolicyApplication);
      // Notify other pages (dashboard, lists) about update
      try {
        window.dispatchEvent(new CustomEvent('workflowAppUpdated', { detail: { appId: application.id } }));
      } catch (ev) {
        console.warn('Could not dispatch workflowAppUpdated', ev);
      }
    } catch {
      toast.error(t('common:error.somethingWentWrong'));
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Review: Reject ──────────────────────────────────────────

  const handleReject = async () => {
    if (!application || !rejectionReason.trim()) return;
    setActionLoading(true);
    try {
      const formData = new FormData();
      formData.append('action', 'review');
      formData.append('approved', 'false');
      formData.append('rejectionReason', rejectionReason.trim());

      const headers: Record<string, string> = {};
      const res = await fetchWithAuth(`${API_BASE}/policy-applications/${application.id}`, {
        method: 'PATCH',
        headers,
        body: formData,
      });
      const contentType = res.headers.get('content-type') || '';
      if (!res.ok) {
        const txt = await res.text();
        let err = t('adminPolicyReview:toast.rejectFailed');
        try {
          if (contentType.includes('application/json')) {
            const json = JSON.parse(txt);
            err = json.error || err;
          } else {
            err = txt.substring(0, 240);
          }
        } catch (e) {}
        toast.error(err);
        return;
      }
      const data = contentType.includes('application/json') ? await res.json() : null;
      toast.success(t('adminCommon:policyReview.rejected'));
      if (data?.application) setApplication(data.application as PolicyApplication);
      setRejectionReason('');
      try {
        window.dispatchEvent(new CustomEvent('workflowAppUpdated', { detail: { appId: application.id } }));
      } catch (ev) {
        console.warn('Could not dispatch workflowAppUpdated', ev);
      }
    } catch {
      toast.error(t('common:error.somethingWentWrong'));
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Final Sign ──────────────────────────────────────────────

  const handleFinalSign = async () => {
    if (!application) return;
    setActionLoading(true);
    try {
      const formData = new FormData();
      formData.append('action', 'final-sign');

      const headers: Record<string, string> = {};
      const res = await fetchWithAuth(`${API_BASE}/policy-applications/${application.id}`, {
        method: 'PATCH',
        headers,
        body: formData,
      });
      const contentType = res.headers.get('content-type') || '';
      if (!res.ok) {
        const txt = await res.text();
        let err = t('adminPolicyReview:toast.underwritingFailed');
        try {
          if (contentType.includes('application/json')) {
            const json = JSON.parse(txt);
            err = json.error || err;
          } else {
            err = txt.substring(0, 240);
          }
        } catch (e) {}
        toast.error(err);
        return;
      }
      const data = contentType.includes('application/json') ? await res.json() : null;
      toast.success(t('adminCommon:policyReview.underwritingComplete'));
      if (data?.application) setApplication(data.application as PolicyApplication);
      setConfirmFinalSignOpen(false);
      try {
        window.dispatchEvent(new CustomEvent('workflowAppUpdated', { detail: { appId: application.id } }));
      } catch (ev) {
        console.warn('Could not dispatch workflowAppUpdated', ev);
      }
    } catch {
      toast.error(t('common:error.somethingWentWrong'));
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Download Handler ─────────────────────────────────────────

  const handleDownload = (type: 'provider' | 'policy' | 'signed') => {
    if (!application) return;
    const headers: Record<string, string> = {};
    const params = new URLSearchParams();
    params.set('type', type);
    fetchWithAuth(`${API_BASE}/policy-applications/${application.id}/download?${params.toString()}`, {
      headers,
    })
      .then((res) => {
        if (!res.ok) throw new Error('Download failed');
        return res.blob();
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `COBITUN_${type}_${String(application.id).substring(0, 8)}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      })
      .catch(() => {
        toast.error(t('adminPolicyReview:toast.downloadFailed'));
      });
  };

  // ─── Render ──────────────────────────────────────────────────

  if (loading) {
    return (
      <Protected roles={[Roles.ADMIN, Roles.SUPER_ADMIN]}>
        <PageLoadingState />
      </Protected>
    );
  }

  if (!application) {
    return (
      <div className="text-center py-12 page-enter">
        <AlertCircle className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
        <h3 className="text-lg font-semibold text-foreground mb-1">{t('adminPolicyReview:notFound.title')}</h3>
        <p className="text-sm text-muted-foreground mb-4">
          {t('adminPolicyReview:notFound.description')}
        </p>
        <Button
          variant="outline"
          onClick={() => setCurrentPage('admin-workflow')}
        >
          <ArrowLeft className="h-4 w-4 me-2" />
          {t('adminPolicyReview:backToWorkflow')}
        </Button>
      </div>
    );
  }

  const currentStepIdx = getStepIndex(application.statusCode || '');
  const isRejected = (application.statusCode || '') === 'Rejected';
  const isCompleted = (application.statusCode || '') === 'UnderwritingCompleted';
  const statusLabel = application.statusName || (application.statusCode ? application.statusCode.replace(/([A-Z])/g, ' $1').trim() : '');

  // Check prerequisites for final sign
  const hasSignedContract = !!application.signedPolicyContractPdfUrl;
  const hasPayment = !!application.premiumTransactionId && !!application.premiumPaidAt;

  return (
    <Protected roles={[Roles.ADMIN, Roles.SUPER_ADMIN]}>
      <div className="space-y-6 page-enter max-w-4xl mx-auto">
      {/* Header */}
      <div className="animate-fade-in-down">
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground mb-3 -ms-2"
          onClick={() => {
            setWorkflowContext({ policyId: null, claimId: null });
            setCurrentPage('admin-workflow');
          }}
        >
          <ArrowLeft className="h-4 w-4 me-1" />
          {t('adminPolicyReview:backToWorkflow')}
        </Button>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" /> {t('adminPolicyReview:title')}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">{String(application.id).substring(0, 10).toUpperCase()}</p>
          </div>
          <Badge title={statusLabel} className={`${statusBadgeStyles[application.statusCode || ''] || ''} text-sm px-3 py-1`}>
            {statusLabel}
          </Badge>
        </div>
      </div>

      {/* Customer & Application Details */}
      <Card className="animate-fade-in-up stagger-1">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('adminPolicyReview:details.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">{t('adminPolicyReview:details.customer')}</span>
              <p className="font-medium">
                {application.customer?.user
                  ? `${application.customer.user.firstName} ${application.customer.user.lastName}`
                  : '—'}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">{t('adminPolicyReview:details.email')}</span>
              <p className="font-medium">{application.customer?.user?.email || '—'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">{t('adminPolicyReview:details.created')}</span>
              <p className="font-medium">
                {formatDate(application.createdAt)}
              </p>
            </div>
            {application.sector && (
              <div>
                <span className="text-muted-foreground">{t('adminPolicyReview:details.sector')}</span>
                <p className="font-medium">{application.sector}</p>
              </div>
            )}
            {application.annualTurnover != null && (
              <div>
                <span className="text-muted-foreground">{t('adminPolicyReview:details.annualTurnover')}</span>
                <p className="font-medium">
                  {formatTnd(application.annualTurnover)} {t('common:unit.tnd', 'TND')}
                </p>
              </div>
            )}
            {application.premiumAmount != null && (
              <div>
                <span className="text-muted-foreground">{t('adminPolicyReview:details.premium')}</span>
                <p className="font-medium text-tunis-orange">
                  {formatTnd(application.premiumAmount)} {t('common:unit.tnd', 'TND')}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Progress Stepper */}
      <Card className="animate-fade-in-up stagger-2">
        <CardContent className="p-6">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            {t('adminPolicyReview:progress.title')}
          </h3>
          <div className="relative">
            <div className="flex items-start justify-between">
              {WORKFLOW_STEP_KEYS.map((stepKey, idx) => {
                const isStepCompleted = !isRejected && idx < currentStepIdx;
                const isCurrent = !isRejected && idx === currentStepIdx;
                const isPending = !isRejected && idx > currentStepIdx;
                const StepIcon = WORKFLOW_STEP_ICONS[idx];

                return (
                  <div key={stepKey} className="flex flex-col items-center flex-1 relative">
                    {idx > 0 && (
                      <div
                        className={`absolute top-4 -start-1/2 w-full h-0.5 ${
                          isStepCompleted || isCurrent
                            ? 'bg-tunis-blue'
                            : 'bg-muted-foreground/20'
                        }`}
                      />
                    )}
                    <div
                      className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold mb-2 transition-all ${
                        isStepCompleted
                          ? 'bg-tunis-blue text-white'
                          : isCurrent
                          ? 'bg-tunis-orange text-white ring-4 ring-tunis-orange/20'
                          : isPending
                          ? 'bg-muted text-muted-foreground'
                          : ''
                      }`}
                    >
                      {isStepCompleted ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : isCurrent ? (
                        <StepIcon className="h-4 w-4" />
                      ) : (
                        <span>{idx + 1}</span>
                      )}
                    </div>
                    <span
                      className={`text-[10px] text-center leading-tight max-w-[72px] ${
                        isStepCompleted
                          ? 'text-tunis-blue font-medium'
                          : isCurrent
                          ? 'text-tunis-orange font-semibold'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {t(`adminPolicyReview:progress.steps.${stepKey}`)}
                    </span>
                  </div>
                );
              })}
            </div>

            {isRejected && (
              <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-500 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-700 dark:text-red-400">
                    {t('adminPolicyReview:rejected.title')}
                  </p>
                  {application.rejectionReason && (
                    <p className="text-xs text-red-600 dark:text-red-300 mt-0.5">
                      {t('adminPolicyReview:rejected.reason')}: {application.rejectionReason}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ─── Conditional: AdminReviewing (Approve / Reject) ─── */}
      {application.statusCode === 'AdminReviewing' && (
        <Card className="border-amber-200 dark:border-amber-800/30 animate-fade-in-up stagger-3">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="bg-amber-100 dark:bg-amber-900/30 p-2 rounded-lg">
                <Eye className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <CardTitle className="text-base">{t('adminPolicyReview:review.title')}</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t('adminPolicyReview:review.description')}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              variant="outline"
              className="w-full border-tunis-blue/30 text-tunis-blue hover:bg-tunis-blue/5"
              onClick={() => handleDownload('provider')}
              disabled={!application.providerContractPdfUrl}
            >
              <Download className="h-4 w-4 me-2" />
              {t('adminPolicyReview:review.downloadProvider')}
            </Button>

            <Separator />

            <div className="space-y-2">
              <label htmlFor="rejectionReason" className="text-sm font-medium text-foreground">
                {t('adminPolicyReview:review.rejectionReason')} <span className="text-muted-foreground">{t('adminPolicyReview:review.rejectionReasonHint')}</span>
              </label>
              <Textarea
                id="rejectionReason"
                placeholder={t('adminPolicyReview:review.rejectionPlaceholder')}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="min-h-[80px] focus-ring"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold"
                onClick={() => setConfirmDialog({
                  open: true,
                  title: t('adminPolicyReview:confirm.approveTitle', 'Confirm Policy Approval'),
                  description: t('adminPolicyReview:confirm.approveDesc', 'Approving this policy application is an irreversible business decision. The policy contract will be generated and sent to the customer for signature. This action cannot be undone.'),
                  onConfirm: () => handleApprove()
                })}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 me-2 animate-spin" />
                    {t('adminPolicyReview:review.processing')}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 me-2" />
                    {t('adminPolicyReview:review.approve')}
                  </>
                )}
              </Button>
              <Button
                variant="destructive"
                className="flex-1 font-semibold"
                onClick={() => setConfirmDialog({
                  open: true,
                  title: t('adminPolicyReview:confirm.rejectTitle', 'Confirm Policy Rejection'),
                  description: t('adminPolicyReview:confirm.rejectDesc', 'Rejecting this policy application is an irreversible decision. The customer will be notified of the rejection. This action cannot be undone.'),
                  onConfirm: () => handleReject()
                })}
                disabled={actionLoading || !rejectionReason.trim()}
              >
                {actionLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 me-2 animate-spin" />
                    {t('adminPolicyReview:review.processing')}
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 me-2" />
                    {t('adminPolicyReview:review.reject')}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Conditional: ReadyForFinalApproval ─── */}
      {application.statusCode === 'ReadyForFinalApproval' && (
        <Card className="border-teal-200 dark:border-teal-800/30 animate-fade-in-up stagger-3">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="bg-teal-100 dark:bg-teal-900/30 p-2 rounded-lg">
                <Shield className="h-5 w-5 text-teal-600 dark:text-teal-400" />
              </div>
              <div>
                <CardTitle className="text-base">{t('adminPolicyReview:finalApproval.title')}</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t('adminPolicyReview:finalApproval.description')}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Prerequisites Checklist */}
            <div className="space-y-3 p-4 rounded-lg bg-muted/50">
              <h4 className="text-sm font-semibold text-foreground">{t('adminPolicyReview:finalApproval.prerequisites')}</h4>
              <div className="flex items-center gap-3">
                {hasSignedContract ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500 shrink-0" />
                )}
                <div>
                  <p className="text-sm font-medium">{t('adminPolicyReview:finalApproval.signedContract')}</p>
                  <p className="text-xs text-muted-foreground">
                    {hasSignedContract ? t('adminPolicyReview:finalApproval.signedContractReceived') : t('adminPolicyReview:finalApproval.signedContractWaiting')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {hasPayment ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500 shrink-0" />
                )}
                <div>
                  <p className="text-sm font-medium">{t('adminPolicyReview:finalApproval.premiumPaid')}</p>
                  <p className="text-xs text-muted-foreground">
                    {hasPayment ? t('adminPolicyReview:finalApproval.premiumPaidRecorded') : t('adminPolicyReview:finalApproval.premiumPaidWaiting')}
                  </p>
                </div>
              </div>
            </div>

            {/* Payment Details */}
            {hasPayment && (
              <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/30">
                <h4 className="text-sm font-semibold text-green-700 dark:text-green-400 mb-2 flex items-center gap-2">
                  <CreditCard className="h-4 w-4" /> {t('adminPolicyReview:finalApproval.paymentDetails')}
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">{t('adminPolicyReview:finalApproval.transactionId')}</span>
                    <p className="font-medium font-mono">{application.premiumTransactionId}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t('adminPolicyReview:finalApproval.paymentDate')}</span>
                    <p className="font-medium">
                      {application.premiumPaidAt
                        ? formatDate(application.premiumPaidAt)
                        : '—'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <Button
              className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold"
              disabled={actionLoading || !hasSignedContract || !hasPayment}
              onClick={() => setConfirmFinalSignOpen(true)}
            >
              <CheckCheck className="h-4 w-4 me-2" />
              {t('adminPolicyReview:finalApproval.completeUnderwriting')}
            </Button>

            {(!hasSignedContract || !hasPayment) && (
              <p className="text-xs text-center text-amber-600 dark:text-amber-400">
                {t('adminPolicyReview:finalApproval.prerequisiteWarning')}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── Conditional: UnderwritingCompleted ─── */}
      {isCompleted && (
        <Card className="border-green-200 dark:border-green-800/30 animate-fade-in-up stagger-3">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded-xl">
                <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-green-700 dark:text-green-400">
                  {t('adminPolicyReview:completed.title')}
                </h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {t('adminPolicyReview:completed.description')}
                  {application.adminFinalSignatureAt && (
                    <> {t('adminPolicyReview:completed.completedOn')} {formatDate(application.adminFinalSignatureAt)}</>
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Conditional: Rejected ─── */}
      {isRejected && (
        <Card className="border-red-200 dark:border-red-800/30 animate-fade-in-up stagger-3">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="bg-red-100 dark:bg-red-900/30 p-3 rounded-xl">
                <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-red-700 dark:text-red-400">
                  {t('adminPolicyReview:rejected.title')}
                </h3>
                {application.rejectionReason && (
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {t('adminPolicyReview:rejected.reason')}: {application.rejectionReason}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Documents Card (always visible) */}
      <Card className="animate-fade-in-up stagger-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('adminPolicyReview:documents.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
              <div className="flex items-center gap-2.5">
                <FileText className="h-4 w-4 text-tunis-blue" />
                <div>
                  <p className="text-sm font-medium">{t('adminPolicyReview:documents.providerContract')}</p>
                  <p className="text-xs text-muted-foreground">{t('adminPolicyReview:documents.providerContractDesc')}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-tunis-blue hover:text-tunis-blue-dark"
                onClick={() => handleDownload('provider')}
                disabled={!application.providerContractPdfUrl}
              >
                <Download className="h-4 w-4 me-1" />
                {t('common:action.download')}
              </Button>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
              <div className="flex items-center gap-2.5">
                <Shield className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                <div>
                  <p className="text-sm font-medium">{t('adminPolicyReview:documents.insurancePolicy')}</p>
                  <p className="text-xs text-muted-foreground">{t('adminPolicyReview:documents.insurancePolicyDesc')}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-purple-600 dark:text-purple-400"
                onClick={() => handleDownload('policy')}
                disabled={!application.insurancePolicyContractPdfUrl}
              >
                <Download className="h-4 w-4 me-1" />
                {t('common:action.download')}
              </Button>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
              <div className="flex items-center gap-2.5">
                <PenTool className="h-4 w-4 text-green-600 dark:text-green-400" />
                <div>
                  <p className="text-sm font-medium">{t('adminPolicyReview:documents.signedContract')}</p>
                  <p className="text-xs text-muted-foreground">{t('adminPolicyReview:documents.signedContractDesc')}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-green-600 dark:text-green-400"
                onClick={() => handleDownload('signed')}
                disabled={!application.signedPolicyContractPdfUrl}
              >
                <Download className="h-4 w-4 me-1" />
                {t('common:action.download')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audit Timeline */}
      {application.auditLogs && application.auditLogs.length > 0 && (
        <Card className="animate-fade-in-up stagger-5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('adminPolicyReview:audit.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-0">
              {application.auditLogs.slice(0, 15).map((log, idx) => (
                <div key={log.id} className="flex gap-3 pb-4 last:pb-0">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-2.5 h-2.5 rounded-full mt-1.5 ${
                        idx === 0
                          ? 'bg-tunis-orange'
                          : 'bg-muted-foreground/30'
                      }`}
                    />
                    {idx < application.auditLogs!.length - 1 && (
                      <div className="w-px flex-1 bg-muted-foreground/15 mt-1" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground leading-snug">
                      {log.action}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatDateTime(log.createdAt)}
                      {log.actorId && (
                        <span className="ms-2 text-muted-foreground/60">
                          {t('adminPolicyReview:audit.by')} {String(log.actorId).substring(0, 8)}...
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confirmation Dialog */}
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

      {/* Confirm Final Sign Dialog */}
      <AlertDialog open={confirmFinalSignOpen} onOpenChange={setConfirmFinalSignOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-teal-600" />
              {t('adminPolicyReview:dialog.title')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('adminPolicyReview:dialog.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="p-3 rounded-lg bg-muted/50 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('adminPolicyReview:dialog.signedContract')}</span>
              <span className={hasSignedContract ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                {hasSignedContract ? t('adminPolicyReview:dialog.received') : t('adminPolicyReview:dialog.missing')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('adminPolicyReview:dialog.premiumPayment')}</span>
              <span className={hasPayment ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                {hasPayment ? t('adminPolicyReview:dialog.received') : t('adminPolicyReview:dialog.missing')}
              </span>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common:action.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleFinalSign}
              disabled={actionLoading || !hasSignedContract || !hasPayment}
              className="bg-teal-600 hover:bg-teal-700 text-white"
            >
              {actionLoading ? (
                <>
                  <Loader2 className="h-4 w-4 me-2 animate-spin" />
                  {t('adminPolicyReview:review.processing')}
                </>
              ) : (
                t('adminPolicyReview:dialog.confirmAndComplete')
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </Protected>
  );
}

