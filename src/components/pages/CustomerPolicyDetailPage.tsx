'use client';

import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useAppStore } from '@/lib/store';
import { toast } from 'sonner';
import { formatDate, formatDateTime } from '@/lib/i18n';
import { fetchWithAuth } from '@/hooks/use-auth';
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
import {
  FileText,
  Download,
  Upload,
  PenTool,
  CreditCard,
  CheckCircle2,
  Clock,
  ArrowLeft,
  Loader2,
  Shield,
  Eye,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import { PageLoadingState } from '@/components/shared/PageStates';

const API_BASE = '/api/workflow';

// ─── Workflow Steps ──────────────────────────────────────────────

const WORKFLOW_STEPS = [
  { key: 'ProviderContractUploaded', labelKey: 'customerPolicyDetail:progress.contractUploaded', icon: Upload },
  { key: 'AdminReviewing', labelKey: 'customerPolicyDetail:progress.adminReviewing', icon: Eye },
  { key: 'PolicyContractGenerated', labelKey: 'customerPolicyDetail:progress.policyGenerated', icon: FileText },
  { key: 'AwaitingSignatureAndPayment', labelKey: 'customerPolicyDetail:progress.signAndPay', icon: PenTool },
  { key: 'ReadyForFinalApproval', labelKey: 'customerPolicyDetail:progress.finalApproval', icon: Shield },
  { key: 'UnderwritingCompleted', labelKey: 'customerPolicyDetail:progress.completed', icon: CheckCircle2 },
];

function getStepIndex(status: string): number {
  if (status === 'Rejected') return -1;
  const idx = WORKFLOW_STEPS.findIndex((s) => s.key === status);
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

// ─── Interfaces (v3: WorkflowPolicyApplication, int IDs) ──────────

interface AuditLogEntry {
  id: number;
  action: string;
  createdAt: string;
  actorId: number | null;
}

interface WorkflowPolicyApplication {
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
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  policyTasks: { id: number; actionRequired: string; statusCode: string; statusName: string; completedAt: string | null; createdAt: string }[];
  auditLogs?: AuditLogEntry[];
}

// ─── Component ───────────────────────────────────────────────────

export default function CustomerPolicyDetailPage() {
  const { user, setCurrentPage, workflowContext, setWorkflowContext } = useAppStore();
  const { t } = useTranslation(['common', 'customerPolicyDetail']);
  const policyId = workflowContext.policyId;

  const [application, setApplication] = useState<WorkflowPolicyApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingContract, setSigningContract] = useState(false);
  const [paying, setPaying] = useState(false);
  const [signedFile, setSignedFile] = useState<File | null>(null);
  const [paymentRef, setPaymentRef] = useState('');
  const signedFileRef = useRef<HTMLInputElement>(null);
  const [confirmDialog, setConfirmDialog] = useState<{open: boolean; title: string; description: string; onConfirm: () => void}>({open: false, title: '', description: '', onConfirm: () => {}});

  useEffect(() => {
    if (policyId) {
      fetchApplication();
    } else {
      setLoading(false);
    }
  }, [policyId]);

  useEffect(() => {
    if (!policyId) return;

    const persistSelection = async () => {
      try {
        await fetchWithAuth(`${API_BASE}/selection`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lastViewedWorkflowPolicyApplicationId: policyId,
            lastViewedWorkflowClaimId: null,
          }),
        });
      } catch (error) {
        console.warn('Failed to persist policy detail selection', error);
      }
    };

    void persistSelection();
  }, [policyId]);

  const fetchApplication = async () => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/policy-applications/${policyId}`);
      if (res.ok) {
        const data = await res.json();
        setApplication(data.application);
      } else {
        toast.error(t('customerPolicyDetail:notFound.title'));
      }
    } catch {
      toast.error(t('customerPolicyDetail:notFound.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  // ─── Sign Contract ────────────────────────────────────────────

  const handleSignContract = async () => {
    if (!signedFile || !application) return;

    const error = validatePdf(signedFile);
    if (error) {
      toast.error(error);
      return;
    }

    setSigningContract(true);
    try {
      const formData = new FormData();
      formData.append('action', 'sign');
      formData.append('signedContractPdf', signedFile);

      const res = await fetchWithAuth(`${API_BASE}/policy-applications/${application.id}`, {
        method: 'PATCH',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || t('customerPolicyDetail:sign.failed'));
        return;
      }

      toast.success(t('customerPolicyDetail:sign.success'));
      setApplication(data.application);
      setSignedFile(null);

      // Notify admins and other pages about the update
      try {
        window.dispatchEvent(new CustomEvent('workflowAppUpdated', { detail: { appId: data.application?.id ?? application.id } }));
      } catch (ev) {
        console.warn('Could not dispatch workflowAppUpdated', ev);
      }
    } catch {
      toast.error(t('common:error.somethingWentWrong'));
    } finally {
      setSigningContract(false);
    }
  };

  // ─── Pay Premium ──────────────────────────────────────────────

  const handlePayPremium = async () => {
    if (!paymentRef.trim() || !application) return;

    setPaying(true);
    try {
      const formData = new FormData();
      formData.append('action', 'pay');
      formData.append('premiumTransactionId', paymentRef.trim());

      // Add Idempotency-Key to prevent duplicate payments
      const extraHeaders: Record<string, string> = {};
      try {
        const idemp = (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2,10)}`;
        extraHeaders['Idempotency-Key'] = idemp;
      } catch (e) {
        // ignore
      }
      const res = await fetchWithAuth(`${API_BASE}/policy-applications/${application.id}`, {
        method: 'PATCH',
        headers: extraHeaders,
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || t('customerPolicyDetail:pay.failed'));
        return;
      }

      toast.success(t('customerPolicyDetail:pay.success'));
      setApplication(data.application);
      setPaymentRef('');

      // Notify admins and other pages about the update
      try {
        window.dispatchEvent(new CustomEvent('workflowAppUpdated', { detail: { appId: data.application?.id ?? application.id } }));
      } catch (ev) {
        console.warn('Could not dispatch workflowAppUpdated', ev);
      }
    } catch {
      toast.error(t('common:error.somethingWentWrong'));
    } finally {
      setPaying(false);
    }
  };

  // ─── Download Handler ─────────────────────────────────────────

  const handleDownload = (type: 'provider' | 'policy' | 'signed') => {
    if (!application) return;
    const params = new URLSearchParams();
    params.set('type', type);
    fetchWithAuth(`${API_BASE}/policy-applications/${application.id}/download?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error('Download failed');
        return res.blob();
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `COBITUN_${type}_${application.id}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      })
      .catch(() => {
        toast.error(t('customerPolicyDetail:documents.downloadFailed'));
      });
  };

  // ─── PDF validation ──────────────────────────────────────────

  const validatePdf = (f: File): string | null => {
    if (f.type !== 'application/pdf') return t('customerPolicyDetail:sign.pdfOnly');
    if (f.size > 10 * 1024 * 1024) return t('customerPolicyDetail:sign.maxSize');
    return null;
  };

  // ─── Render ──────────────────────────────────────────────────

  if (loading) {
    return <PageLoadingState message={t('customerPolicyDetail:loading', 'Loading policy details...')} />;
  }

  if (!application) {
    return (
      <div className="text-center py-12 page-enter">
        <AlertCircle className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
        <h3 className="text-lg font-semibold text-foreground mb-1">{t('customerPolicyDetail:notFound.title')}</h3>
        <p className="text-sm text-muted-foreground mb-4">
          {t('customerPolicyDetail:notFound.description')}
        </p>
        <Button
          variant="outline"
          onClick={() => {
            setWorkflowContext({ policyId: null, claimId: null });
            setCurrentPage('customer-workflow');
          }}
        >
          <ArrowLeft className="h-4 w-4 me-2" />
          {t('customerPolicyDetail:notFound.backToWorkflow')}
        </Button>
      </div>
    );
  }

  const currentStepIdx = getStepIndex(application.statusCode || '');
  const isRejected = (application.statusCode || '') === 'Rejected';
  const statusLabel =
    application.statusName || (application.statusCode ? application.statusCode.replace(/([A-Z])/g, ' $1').trim() : '');

  return (
    <div className="space-y-6 page-enter max-w-3xl mx-auto">
      {/* Header */}
      <div className="animate-fade-in-down">
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground mb-3 -ms-2"
          onClick={() => {
            setWorkflowContext({ policyId: null, claimId: null });
            setCurrentPage('customer-workflow');
          }}
        >
          <ArrowLeft className="h-4 w-4 me-1" />
          {t('customerPolicyDetail:notFound.backToWorkflow')}
        </Button>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('customerPolicyDetail:title')}</h1>
            <p className="text-sm text-muted-foreground mt-0.5 font-mono">
              APP-{application.id}
            </p>
          </div>
          <Badge className={`${statusBadgeStyles[application.statusCode || ''] || ''} text-sm px-3 py-1`} title={statusLabel}>
            {statusLabel}
          </Badge>
        </div>
      </div>

      {/* Progress Stepper */}
      <Card className="animate-fade-in-up stagger-1">
        <CardContent className="p-6">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            {t('customerPolicyDetail:progress.title')}
          </h3>
          <div className="relative">
            {/* Step indicators */}
            <div className="flex items-start justify-between">
              {WORKFLOW_STEPS.map((step, idx) => {
                const isCompleted = !isRejected && idx < currentStepIdx;
                const isCurrent = !isRejected && idx === currentStepIdx;
                const isPending = !isRejected && idx > currentStepIdx;

                return (
                  <div key={step.key} className="flex flex-col items-center flex-1 relative">
                    {/* Connector line */}
                    {idx > 0 && (
                      <div
                        className={`absolute top-4 -start-1/2 w-full h-0.5 ${
                          isCompleted || isCurrent
                            ? 'bg-tunis-blue'
                            : 'bg-muted-foreground/20'
                        }`}
                      />
                    )}
                    {/* Circle */}
                    <div
                      className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold mb-2 transition-all ${
                        isCompleted
                          ? 'bg-tunis-blue text-white'
                          : isCurrent
                          ? 'bg-tunis-orange text-white ring-4 ring-tunis-orange/20'
                          : isPending
                          ? 'bg-muted text-muted-foreground'
                          : ''
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : isCurrent ? (
                        <step.icon className="h-4 w-4" />
                      ) : (
                        <span>{idx + 1}</span>
                      )}
                    </div>
                    {/* Label */}
                    <span
                      className={`text-[10px] text-center leading-tight max-w-[72px] ${
                        isCompleted
                          ? 'text-tunis-blue font-medium'
                          : isCurrent
                          ? 'text-tunis-orange font-semibold'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {t(step.labelKey)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Rejected overlay */}
            {isRejected && (
              <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-500 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-700 dark:text-red-400">
                    {t('customerPolicyDetail:rejected.title')}
                  </p>
                  {application.rejectionReason && (
                    <p className="text-xs text-red-600 dark:text-red-300 mt-0.5">
                      {t('customerPolicyDetail:rejected.reason')}: {application.rejectionReason}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Application Details */}
      <Card className="animate-fade-in-up stagger-2">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('customerPolicyDetail:details.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">{t('customerPolicyDetail:details.created')}</span>
              <p className="font-medium">
                {formatDate(application.createdAt)}
              </p>
            </div>
            {application.sector && (
              <div>
                <span className="text-muted-foreground">{t('customerPolicyDetail:details.sector')}</span>
                <p className="font-medium">{application.sector}</p>
              </div>
            )}
            {application.annualTurnover != null && (
              <div>
                <span className="text-muted-foreground">{t('customerPolicyDetail:details.annualTurnover')}</span>
                <p className="font-medium">{application.annualTurnover.toLocaleString()} {t('common:unit.tnd')}</p>
              </div>
            )}
            {application.premiumAmount != null && (
              <div>
                <span className="text-muted-foreground">{t('customerPolicyDetail:details.premium')}</span>
                <p className="font-medium text-tunis-orange">
                  {application.premiumAmount.toFixed(2)} {t('common:unit.tnd')}
                </p>
              </div>
            )}
            {application.premiumPaidAt && (
              <div>
                <span className="text-muted-foreground">{t('customerPolicyDetail:details.paidOn')}</span>
                <p className="font-medium">
                  {formatDate(application.premiumPaidAt)}
                </p>
              </div>
            )}
            {application.adminFinalSignatureAt && (
              <div>
                <span className="text-muted-foreground">{t('customerPolicyDetail:details.approvedOn')}</span>
                <p className="font-medium text-green-600 dark:text-green-400">
                  {formatDate(application.adminFinalSignatureAt)}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Document Downloads */}
      <Card className="animate-fade-in-up stagger-3">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('customerPolicyDetail:documents.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {/* Provider Contract */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
              <div className="flex items-center gap-2.5">
                <FileText className="h-4 w-4 text-tunis-blue" />
                <div>
                  <p className="text-sm font-medium">{t('customerPolicyDetail:documents.providerContract')}</p>
                  <p className="text-xs text-muted-foreground">{t('customerPolicyDetail:documents.providerContractDesc')}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-tunis-blue hover:text-tunis-blue-dark"
                onClick={() => handleDownload('provider')}
                disabled={!application.providerContractPdfUrl}
                aria-label={t('customerPolicyDetail:documents.downloadProviderContract', 'Download provider contract')}
              >
                <Download className="h-4 w-4 me-1" />
                {t('customerPolicyDetail:documents.download')}
              </Button>
            </div>

            {/* Insurance Policy Contract */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
              <div className="flex items-center gap-2.5">
                <Shield className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                <div>
                  <p className="text-sm font-medium">{t('customerPolicyDetail:documents.insurancePolicyContract')}</p>
                  <p className="text-xs text-muted-foreground">{t('customerPolicyDetail:documents.insurancePolicyContractDesc')}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300"
                onClick={() => handleDownload('policy')}
                disabled={!application.insurancePolicyContractPdfUrl}
                aria-label={t('customerPolicyDetail:documents.downloadPolicyContract', 'Download insurance policy contract')}
              >
                <Download className="h-4 w-4 me-1" />
                {t('customerPolicyDetail:documents.download')}
              </Button>
            </div>

            {/* Signed Contract */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
              <div className="flex items-center gap-2.5">
                <PenTool className="h-4 w-4 text-green-600 dark:text-green-400" />
                <div>
                  <p className="text-sm font-medium">{t('customerPolicyDetail:documents.signedContract')}</p>
                  <p className="text-xs text-muted-foreground">{t('customerPolicyDetail:documents.signedContractDesc')}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300"
                onClick={() => handleDownload('signed')}
                disabled={!application.signedPolicyContractPdfUrl}
                aria-label={t('customerPolicyDetail:documents.downloadSignedContract', 'Download signed contract')}
              >
                <Download className="h-4 w-4 me-1" />
                {t('customerPolicyDetail:documents.download')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── Conditional Action: Sign Policy Contract ─── */}
      {application.statusCode === 'PolicyContractGenerated' && (
        <Card className="border-purple-200 dark:border-purple-800/30 animate-fade-in-up stagger-4">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="bg-purple-100 dark:bg-purple-900/30 p-2 rounded-lg">
                <PenTool className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <CardTitle className="text-base">{t('customerPolicyDetail:sign.title')}</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t('customerPolicyDetail:sign.description')}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              variant="outline"
              className="w-full border-purple-300 text-purple-700 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20"
              onClick={() => handleDownload('policy')}
            >
              <Download className="h-4 w-4 me-2" />
              {t('customerPolicyDetail:sign.downloadPdf')}
            </Button>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="signedContractPdf" className="text-sm font-medium">{t('customerPolicyDetail:sign.uploadLabel')}</Label>
              <div
                className="border-2 border-dashed rounded-lg p-4 text-center hover:border-purple-400/50 transition-colors cursor-pointer"
                onClick={() => signedFileRef.current?.click()}
              >
                <input
                  id="signedContractPdf"
                  ref={signedFileRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      const err = validatePdf(f);
                      if (err) {
                        toast.error(err);
                        return;
                      }
                      setSignedFile(f);
                    }
                  }}
                />
                {signedFile ? (
                  <div className="flex items-center justify-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-medium">{signedFile.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 h-auto p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSignedFile(null);
                        if (signedFileRef.current) signedFileRef.current.value = '';
                      }}
                      aria-label={t('customerPolicyDetail:actions.removeUploadedFile', 'Remove uploaded file')}
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <Upload className="h-5 w-5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {t('customerPolicyDetail:sign.uploadHint')}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <Button
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold"
              onClick={() => setConfirmDialog({
                open: true,
                title: t('customerPolicyDetail:confirmSign.title'),
                description: t('customerPolicyDetail:confirmSign.description'),
                onConfirm: () => handleSignContract()
              })}
              disabled={signingContract || !signedFile}
            >
              {signingContract ? (
                <>
                  <Loader2 className="h-4 w-4 me-2 animate-spin" />
                  {t('customerPolicyDetail:sign.uploading')}
                </>
              ) : (
                <>
                  <PenTool className="h-4 w-4 me-2" />
                  {t('customerPolicyDetail:sign.submit')}
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ─── Conditional Action: Pay Premium ─── */}
      {application.statusCode === 'AwaitingSignatureAndPayment' &&
        application.signedPolicyContractPdfUrl && (
          <Card className="border-orange-200 dark:border-orange-800/30 animate-fade-in-up stagger-4">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="bg-orange-100 dark:bg-orange-900/30 p-2 rounded-lg">
                  <CreditCard className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <CardTitle className="text-base">{t('customerPolicyDetail:pay.title')}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t('customerPolicyDetail:pay.description')}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {application.premiumAmount != null && (
                <div className="p-4 rounded-lg bg-gradient-to-r from-tunis-navy to-tunis-navy-light text-white">
                  <p className="text-sm text-white/70">{t('customerPolicyDetail:pay.premiumAmount')}</p>
                  <p className="text-3xl font-bold mt-1">
                    {application.premiumAmount.toFixed(2)}{' '}
                    <span className="text-lg text-white/70">{t('common:unit.tnd')}</span>
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="paymentRef" className="text-sm font-medium">{t('customerPolicyDetail:pay.paymentReference')}</Label>
                <p className="text-xs text-muted-foreground mb-1">
                  {t('customerPolicyDetail:pay.paymentReferenceHint')}
                </p>
                <Input
                  id="paymentRef"
                  placeholder="e.g. TXN-20240101-ABC123"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                />
              </div>

              <Button
                className="w-full font-semibold"
                variant="tunis"
                onClick={() => setConfirmDialog({
                  open: true,
                  title: t('customerPolicyDetail:confirmPay.title'),
                  description: t('customerPolicyDetail:confirmPay.description'),
                  onConfirm: () => handlePayPremium()
                })}
                disabled={paying || !paymentRef.trim()}
              >
                {paying ? (
                  <>
                    <Loader2 className="h-4 w-4 me-2 animate-spin" />
                    {t('customerPolicyDetail:pay.processing')}
                  </>
                ) : (
                  <>
                    <CreditCard className="h-4 w-4 me-2" />
                    {t('customerPolicyDetail:pay.confirm')}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

      {/* ─── Progress Timeline ─── */}
      {application.auditLogs && application.auditLogs.length > 0 && (
        <Card className="animate-fade-in-up stagger-5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('customerPolicyDetail:timeline.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-0">
              {application.auditLogs.slice(0, 10).map((log, idx) => (
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
            <AlertDialogCancel>{t('common:action.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDialog.onConfirm}>{t('common:action.confirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

