'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { fetchWithAuth, Roles } from '@/hooks/use-auth';
import Protected from '@/components/Protected';
import { toast } from 'sonner';
import { formatDate, formatDateTime } from '@/lib/i18n';
import { formatTnd } from '@/lib/utils';
import {
  FileText,
  Download,
  CheckCircle2,
  ArrowLeft,
  Loader2,
  AlertCircle,
  Clock,
  DollarSign,
  ClipboardCheck,
  CircleDot,
  Send,
  Banknote,
} from 'lucide-react';
import { PageLoadingState, PageEmptyState, PageErrorState } from '@/components/shared/PageStates';

const API_BASE = '/api/workflow';


// ─── Claim Workflow Steps ────────────────────────────────────────

const CLAIM_STEP_KEYS = ['open', 'submitted', 'completed'] as const;
const CLAIM_STEP_ICONS = [CircleDot, Send, CheckCircle2];

function getClaimStepIndex(status: string): number {
  const statusMap: Record<string, string> = { Open: 'open', Submitted: 'submitted', Completed: 'completed' };
  const key = statusMap[status];
  if (!key) return 0;
  const idx = CLAIM_STEP_KEYS.indexOf(key as typeof CLAIM_STEP_KEYS[number]);
  return idx >= 0 ? idx : 0;
}

// ─── Status badge ────────────────────────────────────────────────

const claimStatusBadgeStyles: Record<string, string> = {
  Open: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  Submitted: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  Completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
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
}

interface PolicyApplicationRef {
  id: number;
  statusCode: string;
}

interface WorkflowClaim {
  id: number;
  statusCode: string;
  statusName: string;
  lossDescription: string | null;
  lossAmount: number | null;
  lossStartDate: string | null;
  lossEndDate: string | null;
  declarationOfLossPdfUrl: string | null;
  payoutTriggeredAt: string | null;
  payoutTransactionId: string | null;
  policyApplicationId: number;
  policyApplication?: PolicyApplicationRef;
  createdAt: string;
  updatedAt: string;
  customer?: Customer;
  auditLogs?: AuditLogEntry[];
  tasks?: { id: number; actionRequired: string; statusCode: string; completedAt: string | null; createdAt: string }[];
}

// ─── Component ───────────────────────────────────────────────────

export default function AdminClaimReviewPage() {
  const { t } = useTranslation(['common', 'adminCommon', 'adminClaimReview']);
  const { setCurrentPage, workflowContext, setWorkflowContext } = useAppStore();
  const claimId = workflowContext.claimId;

  const [claim, setClaim] = useState<WorkflowClaim | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmCompleteOpen, setConfirmCompleteOpen] = useState(false);

  useEffect(() => {
    if (claimId) {
      fetchClaim();
    } else {
      setLoading(false);
    }
  }, [claimId]);

  const fetchClaim = async () => {
    try {
      const headers: Record<string, string> = {};
      const res = await fetchWithAuth(`${API_BASE}/claims/${claimId}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setClaim(data.claim ?? null);
      } else {
        toast.error(t('adminClaimReview:toast.notFound'));
      }
    } catch {
      toast.error(t('adminClaimReview:toast.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  // ─── Complete Claim & Trigger Payout ───────────────────────────

  const handleCompleteClaim = async () => {
    if (!claim) return;
    setActionLoading(true);
    try {
      const formData = new FormData();
      formData.append('action', 'complete');

      const headers: Record<string, string> = {};
      const res = await fetchWithAuth(`${API_BASE}/claims/${claim.id}`, {
        method: 'PATCH',
        headers,
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || t('adminClaimReview:toast.completeFailed'));
        return;
      }

      toast.success(t('adminCommon:claimReview.completed'));
      setClaim(data.claim ?? null);
      setConfirmCompleteOpen(false);
    } catch {
      toast.error(t('common:error.somethingWentWrong'));
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Download Declaration of Loss PDF ──────────────────────────

  const handleDownloadDeclaration = () => {
    if (!claim) return;
    const headers: Record<string, string> = {};
    fetchWithAuth(`${API_BASE}/claims/${claim.id}/download`, { headers })
      .then((res) => {
        if (!res.ok) throw new Error('Download failed');
        return res.blob();
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `COBITUN_declaration_de_sinistre_${String(claim.id).substring(0, 8)}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      })
      .catch(() => {
        toast.error(t('adminClaimReview:toast.downloadFailed'));
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

  if (!claim) {
    return (
      <div className="text-center py-12 page-enter">
        <AlertCircle className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
        <h3 className="text-lg font-semibold text-foreground mb-1">{t('adminClaimReview:notFound.title')}</h3>
        <p className="text-sm text-muted-foreground mb-4">
          {t('adminClaimReview:notFound.description')}
        </p>
        <Button
          variant="outline"
          onClick={() => setCurrentPage('admin-workflow')}
        >
          <ArrowLeft className="h-4 w-4 me-2" />
          {t('adminClaimReview:backToWorkflow')}
        </Button>
      </div>
    );
  }

  const currentStepIdx = getClaimStepIndex(claim.statusCode);

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
          {t('adminClaimReview:backToWorkflow')}
        </Button>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('adminClaimReview:title')}</h1>
            <p className="text-sm text-muted-foreground mt-0.5 font-mono">
              CLM-{String(claim.id).substring(0, 8).toUpperCase()}
            </p>
          </div>
          <Badge title={claim.statusName || claim.statusCode} className={`${claimStatusBadgeStyles[claim.statusCode] || ''} text-sm px-3 py-1`}>
            {claim.statusName || claim.statusCode}
          </Badge>
        </div>
      </div>

      {/* Claim Details */}
      <Card className="animate-fade-in-up stagger-1">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('adminClaimReview:details.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">{t('adminClaimReview:details.customer')}</span>
              <p className="font-medium">
                {claim.customer?.user
                  ? `${claim.customer.user.firstName} ${claim.customer.user.lastName}`
                  : '—'}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">{t('adminClaimReview:details.email')}</span>
              <p className="font-medium">{claim.customer?.user?.email || '—'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">{t('adminClaimReview:details.policyReference')}</span>
              <p className="font-medium font-mono">
                {String(claim.policyApplicationId).substring(0, 10).toUpperCase()}
              </p>
            </div>
            {claim.lossAmount != null && (
              <div>
                <span className="text-muted-foreground">{t('adminClaimReview:details.lossAmount')}</span>
                <p className="font-medium text-tunis-orange">
                  {formatTnd(claim.lossAmount)} {t('common:unit.tnd', 'TND')}
                </p>
              </div>
            )}
            {claim.lossStartDate && (
              <div>
                <span className="text-muted-foreground">{t('adminClaimReview:details.lossStartDate')}</span>
                <p className="font-medium">
                  {formatDate(claim.lossStartDate)}
                </p>
              </div>
            )}
            {claim.lossEndDate && (
              <div>
                <span className="text-muted-foreground">{t('adminClaimReview:details.lossEndDate')}</span>
                <p className="font-medium">
                  {formatDate(claim.lossEndDate)}
                </p>
              </div>
            )}
            <div>
              <span className="text-muted-foreground">{t('adminClaimReview:details.created')}</span>
              <p className="font-medium">
                {formatDate(claim.createdAt)}
              </p>
            </div>
            {claim.lossDescription && (
              <div className="col-span-2 sm:col-span-3">
                <span className="text-muted-foreground">{t('adminClaimReview:details.description')}</span>
                <p className="font-medium mt-0.5">{claim.lossDescription}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 3-Step Progress Indicator */}
      <Card className="animate-fade-in-up stagger-2">
        <CardContent className="p-6">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            {t('adminClaimReview:progress.title')}
          </h3>
          <div className="relative">
            <div className="flex items-start justify-between">
              {CLAIM_STEP_KEYS.map((stepKey, idx) => {
                const isStepCompleted = idx < currentStepIdx;
                const isCurrent = idx === currentStepIdx;
                const isPending = idx > currentStepIdx;
                const StepIcon = CLAIM_STEP_ICONS[idx];

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
                      {t(`adminClaimReview:progress.steps.${stepKey}`)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── Conditional: Open ─── */}
      {claim.statusCode === 'Open' && (
        <Card className="border-blue-200 dark:border-blue-800/30 animate-fade-in-up stagger-3">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-xl">
                <Clock className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-blue-700 dark:text-blue-400">
                  {t('adminClaimReview:openStatus.title')}
                </h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {t('adminClaimReview:openStatus.description')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Conditional: Submitted ─── */}
      {claim.statusCode === 'Submitted' && (
        <Card className="border-amber-200 dark:border-amber-800/30 animate-fade-in-up stagger-3">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="bg-amber-100 dark:bg-amber-900/30 p-2 rounded-lg">
                <ClipboardCheck className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <CardTitle className="text-base">{t('adminClaimReview:submittedStatus.title')}</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t('adminClaimReview:submittedStatus.description')}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Download Declaration */}
            <Button
              variant="outline"
              className="w-full border-tunis-blue/30 text-tunis-blue hover:bg-tunis-blue/5"
              onClick={handleDownloadDeclaration}
              disabled={!claim.declarationOfLossPdfUrl}
            >
              <Download className="h-4 w-4 me-2" />
              {t('adminClaimReview:submittedStatus.downloadDeclaration')}
            </Button>

            {/* Loss Details */}
            <div className="p-4 rounded-lg bg-muted/50 space-y-3">
              <h4 className="text-sm font-semibold text-foreground">{t('adminClaimReview:submittedStatus.lossDetails')}</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">{t('adminClaimReview:details.lossAmount')}</span>
                  <p className="font-semibold text-tunis-orange">
                    {claim.lossAmount != null
                      ? `${formatTnd(claim.lossAmount)} ${t('common:unit.tnd', 'TND')}`
                      : '—'}
                  </p>
                </div>
                {claim.lossStartDate && (
                  <div>
                    <span className="text-muted-foreground">{t('adminClaimReview:submittedStatus.startDate')}</span>
                    <p className="font-medium">{formatDate(claim.lossStartDate)}</p>
                  </div>
                )}
                {claim.lossEndDate && (
                  <div>
                    <span className="text-muted-foreground">{t('adminClaimReview:submittedStatus.endDate')}</span>
                    <p className="font-medium">{formatDate(claim.lossEndDate)}</p>
                  </div>
                )}
              </div>
              {claim.lossDescription && (
                <div className="pt-2 border-t border-border">
                  <span className="text-muted-foreground text-xs">{t('adminClaimReview:details.description')}</span>
                  <p className="text-sm mt-0.5">{claim.lossDescription}</p>
                </div>
              )}
            </div>

            <Button
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold"
              onClick={() => setConfirmCompleteOpen(true)}
              disabled={actionLoading}
            >
              <Banknote className="h-4 w-4 me-2" />
              {t('adminClaimReview:submittedStatus.markCompleted')}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ─── Conditional: Completed ─── */}
      {claim.statusCode === 'Completed' && (
        <Card className="border-green-200 dark:border-green-800/30 animate-fade-in-up stagger-3">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <CardTitle className="text-base">{t('adminClaimReview:completedStatus.title')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/30">
              <h4 className="text-sm font-semibold text-green-700 dark:text-green-400 mb-2 flex items-center gap-2">
                <DollarSign className="h-4 w-4" /> {t('adminClaimReview:completedStatus.payoutDetails')}
              </h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">{t('adminClaimReview:completedStatus.transactionId')}</span>
                  <p className="font-medium font-mono">{claim.payoutTransactionId || '—'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('adminClaimReview:completedStatus.payoutDate')}</span>
                  <p className="font-medium">
                    {claim.payoutTriggeredAt
                      ? formatDate(claim.payoutTriggeredAt)
                      : '—'}
                  </p>
                </div>
                {claim.lossAmount != null && (
                  <div>
                    <span className="text-muted-foreground">{t('adminClaimReview:completedStatus.payoutAmount')}</span>
                    <p className="font-semibold text-green-700 dark:text-green-400">
                      {formatTnd(claim.lossAmount)} {t('common:unit.tnd', 'TND')}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Download Declaration */}
            {claim.declarationOfLossPdfUrl && (
              <Button
                variant="outline"
                className="w-full border-green-300 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20"
                onClick={handleDownloadDeclaration}
              >
                <Download className="h-4 w-4 me-2" />
                {t('adminClaimReview:completedStatus.downloadDeclaration')}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Audit Timeline */}
      {claim.auditLogs && claim.auditLogs.length > 0 && (
        <Card className="animate-fade-in-up stagger-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('adminClaimReview:audit.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-0">
              {claim.auditLogs.slice(0, 15).map((log, idx) => (
                <div key={log.id} className="flex gap-3 pb-4 last:pb-0">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-2.5 h-2.5 rounded-full mt-1.5 ${
                        idx === 0
                          ? 'bg-tunis-orange'
                          : 'bg-muted-foreground/30'
                      }`}
                    />
                    {idx < claim.auditLogs!.length - 1 && (
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
                          {t('adminClaimReview:audit.by')} {String(log.actorId).substring(0, 8)}...
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

      {/* Confirm Complete Claim Dialog */}
      <AlertDialog open={confirmCompleteOpen} onOpenChange={setConfirmCompleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5 text-emerald-500" />
              {t('adminClaimReview:dialog.title')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('adminClaimReview:dialog.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="p-3 rounded-lg bg-muted/50 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('adminClaimReview:dialog.claimId')}</span>
              <span className="font-mono font-medium">CLM-{String(claim.id).substring(0, 8).toUpperCase()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('adminClaimReview:dialog.lossAmount')}</span>
              <span className="font-semibold text-tunis-orange">
                {claim.lossAmount != null
                  ? `${formatTnd(claim.lossAmount)} ${t('common:unit.tnd', 'TND')}`
                  : '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('adminClaimReview:dialog.customer')}</span>
              <span className="font-medium">
                {claim.customer?.user
                  ? `${claim.customer.user.firstName} ${claim.customer.user.lastName}`
                  : '—'}
              </span>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common:action.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCompleteClaim}
              disabled={actionLoading}
              className="bg-emerald-500 hover:bg-emerald-600 text-white"
            >
              {actionLoading ? (
                <>
                  <Loader2 className="h-4 w-4 me-2 animate-spin" />
                  {t('adminPolicyReview:review.processing')}
                </>
              ) : (
                t('adminClaimReview:dialog.confirmAndTrigger')
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </Protected>
  );
}

