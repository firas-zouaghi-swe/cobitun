'use client';

import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useAppStore } from '@/lib/store';
import { toast } from 'sonner';
import { fetchWithAuth } from '@/hooks/use-auth';
import { formatDate } from '@/lib/i18n';
import { safeToFixed } from '@/lib/utils';
import { FieldError, RequiredIndicator, CharCounter } from '@/components/ui/form-warning';
import { PageLoadingState } from '@/components/shared/PageStates';
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
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  FileText,
  Loader2,
  PenTool,
  Plus,
  Upload,
  XCircle,
  DollarSign,
  Calendar,
} from 'lucide-react';

const API_BASE = '/api/workflow';

// ─── Interfaces (v3: int IDs, statusCode) ────────────────────────

interface WorkflowPolicyApplication {
  id: number;
  statusCode: string;
  statusName: string;
  sector: string | null;
  annualTurnover: number | null;
  createdAt: string;
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
  payoutTransactionId: string | null;
  payoutTriggeredAt: string | null;
  policyApplicationId: number;
  createdAt: string;
  claimTasks: { id: number; actionRequired: string; statusCode: string; statusName: string }[];
}

// ─── Component ───────────────────────────────────────────────────

export default function CustomerClaimPage() {
  const { user, setCurrentPage, workflowContext, setWorkflowContext } = useAppStore();
  const { t } = useTranslation(['common', 'customerClaims']);
  const selectedClaimId = workflowContext.claimId;

  const [claims, setClaims] = useState<WorkflowClaim[]>([]);
  const [completedPolicies, setCompletedPolicies] = useState<WorkflowPolicyApplication[]>([]);
  const [loading, setLoading] = useState(true);

  // New claim form
  const [showNewClaimForm, setShowNewClaimForm] = useState(false);
  const [selectedPolicyId, setSelectedPolicyId] = useState('');
  const [lossDescription, setLossDescription] = useState('');
  const [creating, setCreating] = useState(false);

  // Claim detail / fill form
  const [activeClaim, setActiveClaim] = useState<WorkflowClaim | null>(null);
  const [lossAmount, setLossAmount] = useState('');
  const [lossStartDate, setLossStartDate] = useState('');
  const [lossEndDate, setLossEndDate] = useState('');
  const [declarationPdf, setDeclarationPdf] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const declarationFileRef = useRef<HTMLInputElement>(null);
  const [confirmDialog, setConfirmDialog] = useState<{open: boolean; title: string; description: string; onConfirm: () => void}>({open: false, title: '', description: '', onConfirm: () => {}});

  const clearFieldError = (field: string) => {
    if (fieldErrors[field]) {
      setFieldErrors((prev) => { const next = { ...prev }; delete next[field]; return next; });
    }
  };

  const persistClaimSelection = async (claimId: number | null) => {
    try {
      await fetchWithAuth(`${API_BASE}/selection`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lastViewedWorkflowPolicyApplicationId: null,
          lastViewedWorkflowClaimId: claimId,
        }),
      });
    } catch (error) {
      console.warn('Failed to persist claim selection', error);
    }
  };

  const fetchData = async () => {
    try {
      const [claimRes, policyRes] = await Promise.all([
        fetchWithAuth(`${API_BASE}/claims`),
        fetchWithAuth(`${API_BASE}/policy-applications`),
      ]);
      const claimData = await claimRes.json();
      const policyData = await policyRes.json();

      const loadedClaims = claimRes.ok ? claimData.claims || [] : [];
      if (claimRes.ok) setClaims(loadedClaims);
      if (policyRes.ok) {
        setCompletedPolicies(
          (policyData.applications || []).filter(
            (a: WorkflowPolicyApplication) => a.statusCode === 'UnderwritingCompleted'
          )
        );
      }

      if (selectedClaimId) {
        const selected = loadedClaims.find((c) => c.id === selectedClaimId);
        if (selected) {
          setActiveClaim(selected);
          if (selected.statusCode === 'Open') {
            setLossAmount(selected.lossAmount?.toString() || '');
            setLossStartDate(selected.lossStartDate ? selected.lossStartDate.split('T')[0] : '');
            setLossEndDate(selected.lossEndDate ? selected.lossEndDate.split('T')[0] : '');
          }
        }
      }
    } catch {
      toast.error(t('customerClaims:error.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.customerId) return;
    void Promise.resolve().then(fetchData);
  }, [user?.customerId]);

  useEffect(() => {
    if (!selectedClaimId) return;
    void persistClaimSelection(selectedClaimId);
  }, [selectedClaimId]);

  // ─── Create new claim ──────────────────────────────────────────

  const handleCreateClaim = async () => {
    // Validate fields
    const errors: Record<string, string> = {};
    if (!selectedPolicyId) errors.selectedPolicyId = t('common:validation.select.required');
    if (!lossDescription.trim()) errors.lossDescription = t('common:validation.required');
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      toast.error(t('customerClaims:error.fillRequired'));
      return;
    }

    if (!user?.customerId) {
      toast.error(t('customerClaims:error.selectPolicy'));
      return;
    }

    setCreating(true);
    try {
      const res = await fetchWithAuth(`${API_BASE}/claims`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: user.customerId,
          policyApplicationId: Number(selectedPolicyId),
          lossDescription: lossDescription.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || t('customerClaims:error.createFailed'));
        return;
      }

      toast.success(t('customerClaims:newClaim.success'));
      setShowNewClaimForm(false);
      setSelectedPolicyId('');
      setLossDescription('');
      setFieldErrors({});
      setClaims((prev) => [data.claim, ...prev]);
      setActiveClaim(data.claim);
      void persistClaimSelection(data.claim.id);
    } catch {
      toast.error(t('common:error.somethingWentWrong'));
    } finally {
      setCreating(false);
    }
  };

  // ─── Submit claim details ──────────────────────────────────────

  const handleSubmitClaim = async () => {
    if (!activeClaim) return;
    // Validate all fields
    const errors: Record<string, string> = {};
    if (!lossAmount) errors.lossAmount = t('common:validation.required');
    else {
      const num = parseFloat(lossAmount);
      if (isNaN(num) || num <= 0) errors.lossAmount = t('common:validation.number.positive');
    }
    if (!lossStartDate) errors.lossStartDate = t('common:validation.required');
    if (!lossEndDate) errors.lossEndDate = t('common:validation.required');
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      toast.error(t('customerClaims:error.fillRequired'));
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('action', 'submit');
      formData.append('lossAmount', lossAmount);
      formData.append('lossStartDate', lossStartDate);
      formData.append('lossEndDate', lossEndDate);
      if (declarationPdf) {
        formData.append('declarationPdf', declarationPdf);
      }

      const res = await fetchWithAuth(`${API_BASE}/claims/${activeClaim.id}`, {
        method: 'PATCH',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || t('customerClaims:error.submitFailed'));
        return;
      }

      toast.success(t('customerClaims:review.success'));
      setActiveClaim(data.claim);
      setClaims((prev) => prev.map((c) => (c.id === data.claim.id ? data.claim : c)));
    } catch {
      toast.error(t('common:error.somethingWentWrong'));
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Download declaration ──────────────────────────────────────

  const handleDownloadDeclaration = (claimId: number) => {
    fetchWithAuth(`${API_BASE}/claims/${claimId}/download`)
      .then((res) => {
        if (!res.ok) throw new Error('Download failed');
        return res.blob();
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `COBITUN_declaration_de_sinistre_${claimId}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      })
      .catch(() => {
        toast.error(t('customerClaims:error.downloadFailed'));
      });
  };

  // ─── PDF validation ────────────────────────────────────────────

  const validatePdf = (f: File): string | null => {
    if (f.type !== 'application/pdf') return t('customerClaims:fillDeclaration.pdfOnly');
    if (f.size > 10 * 1024 * 1024) return t('customerClaims:fillDeclaration.maxSize');
    return null;
  };

  // ─── Status badge ──────────────────────────────────────────────

  const renderStatusBadge = (statusCode: string) => {
    const config: Record<string, { labelKey: string; cls: string }> = {
      Open: {
        labelKey: 'customerClaims:status.open',
        cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      },
      Submitted: {
        labelKey: 'customerClaims:status.submitted',
        cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      },
      Completed: {
        labelKey: 'customerClaims:status.completed',
        cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      },
    };
    const c = config[statusCode];
    if (!c) {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400">
          {statusCode}
        </span>
      );
    }
    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${c.cls}`}>
        {t(c.labelKey)}
      </span>
    );
  };

  // ─── Loading ───────────────────────────────────────────────────

  if (loading) {
    return <PageLoadingState message={t('customerClaims:loading', 'Loading claims...')} />;
  }

  // ─── Render ────────────────────────────────────────────────────

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
          {t('customerClaims:title.backToWorkflow')}
        </Button>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('customerClaims:title.value')}</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {t('customerClaims:subtitle')}
            </p>
          </div>
          {completedPolicies.length > 0 && !showNewClaimForm && !activeClaim && (
            <Button
              variant="tunis"
              onClick={() => setShowNewClaimForm(true)}
            >
              <Plus className="h-4 w-4 me-2" />
              {t('customerClaims:fileNewClaim')}
            </Button>
          )}
        </div>
      </div>

      {/* ─── New Claim Form ─── */}
      {showNewClaimForm && (
        <Card className="border-tunis-blue/30 animate-fade-in-up">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="bg-tunis-blue/10 p-2 rounded-lg">
                <AlertCircle className="h-5 w-5 text-tunis-blue" />
              </div>
              <div>
                <CardTitle className="text-base">{t('customerClaims:newClaim.title')}</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t('customerClaims:newClaim.subtitle')}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">{t('customerClaims:newClaim.selectPolicy')}<RequiredIndicator /></Label>
                <Select value={selectedPolicyId} onValueChange={(v) => { setSelectedPolicyId(v); clearFieldError('selectedPolicyId'); }}>
                  <SelectTrigger className="w-full" aria-invalid={!!fieldErrors.selectedPolicyId} aria-describedby={fieldErrors.selectedPolicyId ? 'selectedPolicyId-error' : undefined}>
                    <SelectValue placeholder={t('customerClaims:newClaim.choosePolicy')} />
                  </SelectTrigger>
                <SelectContent>
                  {completedPolicies.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      COBITUN-{p.id}
                      {p.sector ? ` — ${p.sector}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError id="selectedPolicyId-error">{fieldErrors.selectedPolicyId}</FieldError>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="lossDescription" className="text-sm font-medium">{t('customerClaims:newClaim.lossDescription')}<RequiredIndicator /></Label>
              <Textarea
                id="lossDescription"
                placeholder={t('customerClaims:newClaim.lossDescriptionPlaceholder')}
                value={lossDescription}
                onChange={(e) => { setLossDescription(e.target.value); clearFieldError('lossDescription'); }}
                onBlur={() => { if (!lossDescription.trim()) setFieldErrors((prev) => ({ ...prev, lossDescription: t('common:validation.required') })); }}
                rows={3}
                maxLength={2000}
                aria-invalid={!!fieldErrors.lossDescription}
                aria-describedby={fieldErrors.lossDescription ? 'lossDescription-error' : undefined}
              />
              <CharCounter current={lossDescription.length} max={2000} />
              <FieldError id="lossDescription-error">{fieldErrors.lossDescription}</FieldError>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="tunis"
                onClick={handleCreateClaim}
                disabled={creating || !selectedPolicyId}
              >
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 me-2 animate-spin" />
                    {t('customerClaims:newClaim.creating')}
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-4 w-4 me-2" />
                    {t('customerClaims:newClaim.create')}
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowNewClaimForm(false);
                  setSelectedPolicyId('');
                  setLossDescription('');
                }}
              >
                {t('common:action.cancel')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Active Claim Detail (Open: fill form) ─── */}
      {activeClaim && activeClaim.statusCode === 'Open' && (
        <Card className="border-blue-200 dark:border-blue-800/30 animate-fade-in-up">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg">
                  <PenTool className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <CardTitle className="text-base">{t('customerClaims:fillDeclaration.title')}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t('customerClaims:fillDeclaration.claimId', { id: activeClaim.id })}
                  </p>
                </div>
              </div>
              {renderStatusBadge(activeClaim.statusCode)}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Download blank declaration */}
            {activeClaim.declarationOfLossPdfUrl && (
              <Button
                variant="outline"
                className="w-full border-blue-300 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                onClick={() => handleDownloadDeclaration(activeClaim.id)}
              >
                <Download className="h-4 w-4 me-2" />
                {t('customerClaims:fillDeclaration.downloadPdf')}
              </Button>
            )}

            <Separator />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="lossAmount" className="text-sm font-medium flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                  {t('customerClaims:fillDeclaration.lossAmount')} * <RequiredIndicator />
                </Label>
                <Input
                  id="lossAmount"
                  type="number"
                  placeholder="e.g. 25000"
                  value={lossAmount}
                  onChange={(e) => { setLossAmount(e.target.value); clearFieldError('lossAmount'); }}
                  onBlur={() => {
                    if (!lossAmount) setFieldErrors((prev) => ({ ...prev, lossAmount: t('common:validation.required') }));
                    else {
                      const num = parseFloat(lossAmount);
                      if (isNaN(num) || num <= 0) setFieldErrors((prev) => ({ ...prev, lossAmount: t('common:validation.number.positive') }));
                    }
                  }}
                  min={0}
                  step={0.01}
                  aria-invalid={!!fieldErrors.lossAmount}
                  aria-describedby={fieldErrors.lossAmount ? 'lossAmount-error' : undefined}
                />
                <FieldError id="lossAmount-error">{fieldErrors.lossAmount}</FieldError>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lossStartDate" className="text-sm font-medium flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  {t('customerClaims:fillDeclaration.lossStartDate')} * <RequiredIndicator />
                </Label>
                <Input
                  id="lossStartDate"
                  type="date"
                  value={lossStartDate}
                  onChange={(e) => { setLossStartDate(e.target.value); clearFieldError('lossStartDate'); }}
                  onBlur={() => { if (!lossStartDate) setFieldErrors((prev) => ({ ...prev, lossStartDate: t('common:validation.required') })); }}
                  aria-invalid={!!fieldErrors.lossStartDate}
                  aria-describedby={fieldErrors.lossStartDate ? 'lossStartDate-error' : undefined}
                />
                <FieldError id="lossStartDate-error">{fieldErrors.lossStartDate}</FieldError>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lossEndDate" className="text-sm font-medium flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  {t('customerClaims:fillDeclaration.lossEndDate')} * <RequiredIndicator />
                </Label>
                <Input
                  id="lossEndDate"
                  type="date"
                  value={lossEndDate}
                  onChange={(e) => { setLossEndDate(e.target.value); clearFieldError('lossEndDate'); }}
                  onBlur={() => { if (!lossEndDate) setFieldErrors((prev) => ({ ...prev, lossEndDate: t('common:validation.required') })); }}
                  aria-invalid={!!fieldErrors.lossEndDate}
                  aria-describedby={fieldErrors.lossEndDate ? 'lossEndDate-error' : undefined}
                />
                <FieldError id="lossEndDate-error">{fieldErrors.lossEndDate}</FieldError>
              </div>
            </div>

            {/* Upload filled declaration PDF (optional) */}
            <div className="space-y-1.5">
              <Label htmlFor="declarationPdf" className="text-sm font-medium">{t('customerClaims:fillDeclaration.uploadLabel')}</Label>
              <div
                className="border-2 border-dashed rounded-lg p-4 text-center hover:border-blue-400/50 transition-colors cursor-pointer"
                onClick={() => declarationFileRef.current?.click()}
              >
                <input
                  id="declarationPdf"
                  ref={declarationFileRef}
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
                      setDeclarationPdf(f);
                    }
                  }}
                />
                {declarationPdf ? (
                  <div className="flex items-center justify-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-medium">{declarationPdf.name}</span>
                    <button
                      className="text-red-500 hover:text-red-700"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeclarationPdf(null);
                        if (declarationFileRef.current) declarationFileRef.current.value = '';
                      }}
                      aria-label={t('customerClaims:actions.removeUploadedPdf', 'Remove uploaded PDF')}
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <Upload className="h-5 w-5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {t('customerClaims:fillDeclaration.uploadHint')}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="tunis"
                onClick={() => setConfirmDialog({
                  open: true,
                  title: t('customerClaims:confirmSubmit.title'),
                  description: t('customerClaims:confirmSubmit.description'),
                  onConfirm: () => handleSubmitClaim()
                })}
                disabled={submitting || !lossAmount || !lossStartDate || !lossEndDate}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 me-2 animate-spin" />
                    {t('customerClaims:fillDeclaration.submitting')}
                  </>
                ) : (
                  <>
                    <PenTool className="h-4 w-4 me-2" />
                    {t('customerClaims:fillDeclaration.submit')}
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setActiveClaim(null);
                  setLossAmount('');
                  setLossStartDate('');
                  setLossEndDate('');
                  setDeclarationPdf(null);
                }}
              >
                {t('customerClaims:action.backToList')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Active Claim Detail (Submitted: awaiting review) ─── */}
      {activeClaim && activeClaim.statusCode === 'Submitted' && (
        <Card className="border-amber-200 dark:border-amber-800/30 animate-fade-in-up">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-amber-100 dark:bg-amber-900/30 p-2.5 rounded-xl">
                <Clock className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">{t('customerClaims:review.title')}</h3>
                <p className="text-sm text-muted-foreground">
                  {t('customerClaims:review.subtitle', { id: activeClaim.id })}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm p-4 bg-muted/50 rounded-lg">
              <div>
                <span className="text-muted-foreground">{t('customerClaims:fillDeclaration.lossAmount')}</span>
                <p className="font-medium">{safeToFixed(activeClaim.lossAmount, 2)} {t('common:unit.tnd')}</p>
              </div>
              <div>
                <span className="text-muted-foreground">{t('customerClaims:fillDeclaration.lossStartDate')}</span>
                <p className="font-medium">
                  {activeClaim.lossStartDate
                    ? formatDate(activeClaim.lossStartDate)
                    : '—'}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">{t('customerClaims:fillDeclaration.lossEndDate')}</span>
                <p className="font-medium">
                  {activeClaim.lossEndDate
                    ? formatDate(activeClaim.lossEndDate)
                    : '—'}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => setActiveClaim(null)}
            >
              {t('customerClaims:action.backToList')}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ─── Active Claim Detail (Completed: payout info) ─── */}
      {activeClaim && activeClaim.statusCode === 'Completed' && (
        <Card className="border-green-200 dark:border-green-800/30 animate-fade-in-up">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-green-100 dark:bg-green-900/30 p-2.5 rounded-xl">
                <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">{t('customerClaims:completed.title')}</h3>
                <p className="text-sm text-muted-foreground">
                  CLM-{activeClaim.id}
                </p>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-gradient-to-r from-tunis-navy to-tunis-navy-light text-white mb-4">
              <p className="text-sm text-white/70">{t('customerClaims:completed.claimedAmount', 'Claimed Amount')}</p>
              <p className="text-3xl font-bold mt-1">
                {safeToFixed(activeClaim.lossAmount, 2) ?? '0.00'}{' '}
                <span className="text-lg text-white/70">{t('common:unit.tnd')}</span>
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm p-4 bg-muted/50 rounded-lg">
              <div>
                <span className="text-muted-foreground">{t('customerClaims:completed.transactionId')}</span>
                <p className="font-medium font-mono text-sm">
                  {activeClaim.payoutTransactionId || '—'}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">{t('customerClaims:completed.payoutDate')}</span>
                <p className="font-medium">
                  {activeClaim.payoutTriggeredAt
                    ? formatDate(activeClaim.payoutTriggeredAt)
                    : '—'}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">{t('customerClaims:completed.lossPeriod')}</span>
                <p className="font-medium">
                  {activeClaim.lossStartDate && activeClaim.lossEndDate
                    ? `${formatDate(activeClaim.lossStartDate)} — ${formatDate(activeClaim.lossEndDate)}`
                    : '—'}
                </p>
              </div>
              {activeClaim.declarationOfLossPdfUrl && (
                <div className="flex items-end">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-tunis-blue"
                    onClick={() => handleDownloadDeclaration(activeClaim.id)}
                  >
                    <Download className="h-4 w-4 me-1" />
                    {t('customerClaims:completed.downloadDeclaration')}
                  </Button>
                </div>
              )}
            </div>

            <Button
              variant="outline"
              className="mt-4"
              onClick={() => setActiveClaim(null)}
            >
              {t('customerClaims:action.backToList')}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ─── Active Claim Detail (Unknown Status: fallback view) ─── */}
      {activeClaim && activeClaim.statusCode !== 'Open' && activeClaim.statusCode !== 'Submitted' && activeClaim.statusCode !== 'Completed' && (
        <Card className="border-gray-200 dark:border-gray-800/30 animate-fade-in-up">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-gray-100 dark:bg-gray-900/30 p-2.5 rounded-xl">
                <AlertCircle className="h-6 w-6 text-gray-600 dark:text-gray-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">{activeClaim.statusName || activeClaim.statusCode}</h3>
                <p className="text-sm text-muted-foreground">
                  CLM-{activeClaim.id}
                </p>
              </div>
            </div>
            {activeClaim.lossDescription && (
              <p className="text-sm text-muted-foreground mb-4">{activeClaim.lossDescription}</p>
            )}
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => setActiveClaim(null)}
            >
              {t('customerClaims:action.backToList')}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ─── Claims List ─── */}
      {!activeClaim && !showNewClaimForm && (
        <div className="space-y-3 animate-fade-in-up stagger-1">
          {claims.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center">
                <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
                <h3 className="text-lg font-semibold text-foreground mb-1">{t('customerClaims:empty.title')}</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {completedPolicies.length > 0
                    ? t('customerClaims:empty.subtitleWithPolicy')
                    : t('customerClaims:empty.subtitleNoPolicy')}
                </p>
                {completedPolicies.length > 0 && (
                  <Button
                    variant="tunis"
                    onClick={() => setShowNewClaimForm(true)}
                  >
                    <Plus className="h-4 w-4 me-2" />
                    {t('customerClaims:fileNewClaim')}
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            claims.map((claim) => (
              <Card
                key={claim.id}
                className="card-hover-lift cursor-pointer"
                onClick={() => setActiveClaim(claim)}
              >
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-sm font-mono text-muted-foreground">
                          CLM-{claim.id}
                        </span>
                        {renderStatusBadge(claim.statusCode)}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>
                          {t('customerClaims:status.created')}: {formatDate(claim.createdAt)}
                        </span>
                        {claim.lossAmount != null && (
                          <span>{t('customerClaims:status.loss')}: {safeToFixed(claim.lossAmount, 2)} {t('common:unit.tnd')}</span>
                        )}
                        {claim.lossDescription && (
                          <span className="truncate max-w-[200px]">
                            {claim.lossDescription}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant={claim.statusCode === 'Open' ? 'tunis' : 'outline'}
                      className={`shrink-0 ${
                        claim.statusCode !== 'Open'
                          ? 'border-tunis-blue/30 text-tunis-blue hover:bg-tunis-blue/5'
                          : ''
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveClaim(claim);
                        if (claim.statusCode === 'Open') {
                          setLossAmount(claim.lossAmount?.toString() || '');
                          setLossStartDate(claim.lossStartDate ? claim.lossStartDate.split('T')[0] : '');
                          setLossEndDate(claim.lossEndDate ? claim.lossEndDate.split('T')[0] : '');
                        }
                      }}
                    >
                      {claim.statusCode === 'Open' && <PenTool className="h-4 w-4 me-1.5" />}
                      {claim.statusCode === 'Submitted' && <Clock className="h-4 w-4 me-1.5" />}
                      {claim.statusCode === 'Completed' && <CheckCircle2 className="h-4 w-4 me-1.5" />}
                      {claim.statusCode === 'Open'
                        ? t('customerClaims:action.fillDeclaration')
                        : claim.statusCode === 'Submitted'
                        ? t('customerClaims:action.underReview')
                        : t('customerClaims:action.viewPayout')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
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

