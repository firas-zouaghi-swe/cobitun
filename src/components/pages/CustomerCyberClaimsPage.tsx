'use client';

import { useEffect, useState } from 'react';
import { fetchWithAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { formatDate } from '@/lib/i18n';
import {
  AlertCircle, FileText, Plus, Calendar, Tag, DollarSign, ClipboardList, Loader2,
} from 'lucide-react';
import { PageLoadingState, PageErrorState, PageEmptyState } from '@/components/shared/PageStates';
import { toast } from 'sonner';
import { formatTnd } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { FieldError, RequiredIndicator, CharCounter } from '@/components/ui/form-warning';

// ── Types ──────────────────────────────────────────────────────────────
interface CyberClaim {
  id: number;
  incidentDate: string;
  incidentType: { typeCode: string; typeName: string } | string;
  description: string;
  estimatedLoss: number;
  approvedAmount: number | null;
  statusCode: string;
  statusName: string;
  reportedDate: string;
  policy: {
    id: number;
    product: {
      productName: string;
    };
  };
}

interface CyberPolicyOption {
  id: number;
  policyLimit: number;
  product: { productName: string };
  statusCode: string;
}

// ── Incident Types ─────────────────────────────────────────────────────
const INCIDENT_TYPES = [
  { value: 'BI' },
  { value: 'DR' },
  { value: 'CE' },
  { value: 'SR' },
  { value: 'CM' },
  { value: 'PL' },
  { value: 'RD' },
  { value: 'ML' },
  { value: 'SE' },
];

// ── Status Styles ──────────────────────────────────────────────────────
const STATUS_STYLES: Record<string, string> = {
  REPORTED: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800/30',
  UNDER_INVESTIGATION: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800/30',
  ADJUSTED: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800/30',
  APPROVED: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800/30',
  PAID: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800/30',
  DENIED: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800/30',
};

const STATUS_DOTS: Record<string, string> = {
  REPORTED: 'bg-yellow-500',
  UNDER_INVESTIGATION: 'bg-blue-500',
  ADJUSTED: 'bg-purple-500',
  APPROVED: 'bg-green-500',
  PAID: 'bg-emerald-500',
  DENIED: 'bg-red-500',
};

export default function CustomerCyberClaimsPage() {
  const { user, setCurrentPage, setWorkflowContext } = useAppStore();
  const { t } = useTranslation(['customerCyber', 'common']);
  const [claims, setClaims] = useState<CyberClaim[]>([]);
  const [policies, setPolicies] = useState<CyberPolicyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{open: boolean; action: string; data?: any}>({open: false, action: ''});

  // Form state
  const [formPolicyId, setFormPolicyId] = useState('');
  const [formIncidentDate, setFormIncidentDate] = useState('');
  const [formIncidentType, setFormIncidentType] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formEstimatedLoss, setFormEstimatedLoss] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const validateField = (field: string, value: string, rules?: { required?: boolean; minLength?: number; pattern?: RegExp; patternMessage?: string }) => {
    const errors: Record<string, string> = { ...fieldErrors };
    if (rules?.required && !value.trim()) {
      errors[field] = t('common:validation.required');
    } else if (rules?.minLength && value.length < rules.minLength) {
      errors[field] = t('common:validation.minLength', { count: rules.minLength });
    } else if (rules?.pattern && !rules.pattern.test(value)) {
      errors[field] = rules.patternMessage || t('common:validation.number.invalid');
    } else {
      delete errors[field];
    }
    setFieldErrors(errors);
    return !errors[field];
  };

  const clearFieldError = (field: string) => {
    if (fieldErrors[field]) {
      setFieldErrors((prev) => { const next = { ...prev }; delete next[field]; return next; });
    }
  };

  useEffect(() => {
    if (user?.id) {
      void fetchClaims();
      void fetchPolicies();
    }
  }, [user?.id]);

  async function fetchClaims() {
    setLoading(true);
    setError(null);
    try {
      const endpoint = '/api/customer/cyber/claims';
      const res = await fetchWithAuth(endpoint);
      if (!res.ok) throw new Error('Failed to load cyber claims');
      const data = await res.json();
      setClaims(data.claims || []);
    } catch (err) {
      console.error('Failed to fetch cyber claims:', err);
      setError(t('common:errors.failedToLoad', 'Failed to load cyber claims. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  async function fetchPolicies() {
    try {
      const endpoint = '/api/customer/cyber/policies';
      const res = await fetchWithAuth(endpoint);
      if (!res.ok) throw new Error('Failed to load policies');
      const data = await res.json();
      const activePolicies = (data.policies || []).filter(
        (p: CyberPolicyOption) => p.statusCode === 'ACTIVE'
      );
      setPolicies(activePolicies);
    } catch (err) {
      console.error('Failed to fetch policies:', err);
    }
  };

  const handleFileClaim = () => {
    // Validate all fields
    const v1 = !formPolicyId ? (setFieldErrors((prev) => ({ ...prev, formPolicyId: t('common:validation.select.required') })), false) : (clearFieldError('formPolicyId'), true);
    const v2 = validateField('formIncidentDate', formIncidentDate, { required: true });
    const v3 = !formIncidentType ? (setFieldErrors((prev) => ({ ...prev, formIncidentType: t('common:validation.select.required') })), false) : (clearFieldError('formIncidentType'), true);
    const v4 = validateField('formDescription', formDescription, { required: true, minLength: 10 });
    const v5 = validateField('formEstimatedLoss', formEstimatedLoss, { required: true });

    if (!v1 || !v2 || !v3 || !v4 || !v5) {
      toast.error(t('common:error.requiredFields'));
      return;
    }

    const loss = parseFloat(formEstimatedLoss);
    if (isNaN(loss) || loss <= 0) {
      setFieldErrors((prev) => ({ ...prev, formEstimatedLoss: t('common:validation.number.positive') }));
      toast.error(t('customerCyber:claims.toast.invalidLoss', 'Estimated loss must be a positive number'));
      return;
    }

    setConfirmDialog({open: true, action: 'fileClaim'});
  };

  const performFileClaim = async () => {
    setSubmitting(true);
    try {
      const res = await fetchWithAuth('/api/customer/cyber/claims', {
        method: 'POST',

        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: user?.customerId,
          policyId: formPolicyId,
          incidentDate: formIncidentDate,
          incidentType: formIncidentType,
          description: formDescription.trim(),
          estimatedLoss: parseFloat(formEstimatedLoss),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(t('customerCyber:claims.toast.filed'));
        setDialogOpen(false);
        resetForm();
        fetchClaims();
      } else {
        toast.error(data.error || t('customerCyber:claims.toast.fileFailed'));
      }
    } catch {
      toast.error(t('customerCyber:claims.toast.fileFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormPolicyId('');
    setFormIncidentDate('');
    setFormIncidentType('');
    setFormDescription('');
    setFormEstimatedLoss('');
  };

  if (loading) {
    return <PageLoadingState message={t('customerCyber:claims.loading', 'Loading cyber claims…')} />;
  }

  if (error) {
    return <PageErrorState message={error} onRetry={fetchClaims} />;
  }

  return (
    <div className="page-enter">
      <div className="mb-6 flex items-center justify-between animate-fade-in-down">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <AlertCircle className="h-6 w-6 text-[#E5693A]" /> {t('customerCyber:claims.title')}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{t('customerCyber:claims.subtitle')}</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              variant="tunis"
              className="font-bold flex items-center gap-1 transition-all hover:shadow-lg hover:shadow-[#E5693A]/20"
              disabled={policies.length === 0}
            >
              <Plus className="h-4 w-4" /> {t('customerCyber:claims.fileNewClaim')}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-[#E5693A]" /> {t('customerCyber:claims.fileClaimTitle')}
              </DialogTitle>
              <DialogDescription>
                {t('customerCyber:claims.fileClaimDescription', { defaultValue: 'Fill in the details below to submit a new cyber insurance claim.' })}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mt-2">
              {/* Policy Select */}
              <div>
                <Label className="text-sm font-medium">{t('customerCyber:claims.policy')} <RequiredIndicator /></Label>
                <Select value={formPolicyId} onValueChange={(v) => { setFormPolicyId(v); clearFieldError('formPolicyId'); }}>
                  <SelectTrigger className="mt-1 focus-ring" aria-invalid={!!fieldErrors.formPolicyId} aria-describedby={fieldErrors.formPolicyId ? 'formPolicyId-error' : undefined}>
                    <SelectValue placeholder={t('customerCyber:claims.selectPolicy')} />
                  </SelectTrigger>
                  <SelectContent>
                    {policies.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.product.productName} — {formatTnd(p.policyLimit)} {t('common:unit.tnd', 'TND')} {t('customerCyber:claims.limit')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError id="formPolicyId-error">{fieldErrors.formPolicyId}</FieldError>
              </div>

              {/* Incident Date */}
              <div>
                <Label htmlFor="incidentDate" className="text-sm font-medium flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" /> {t('customerCyber:claims.incidentDate')} <RequiredIndicator />
                </Label>
                <Input
                  id="incidentDate"
                  type="date"
                  value={formIncidentDate}
                  onChange={(e) => { setFormIncidentDate(e.target.value); clearFieldError('formIncidentDate'); }}
                  onBlur={() => validateField('formIncidentDate', formIncidentDate, { required: true })}
                  max={new Date().toISOString().split('T')[0]}
                  className="mt-1 focus-ring"
                  aria-invalid={!!fieldErrors.formIncidentDate}
                  aria-describedby={fieldErrors.formIncidentDate ? 'formIncidentDate-error' : undefined}
                />
                <FieldError id="formIncidentDate-error">{fieldErrors.formIncidentDate}</FieldError>
              </div>

              {/* Incident Type */}
              <div>
                <Label className="text-sm font-medium flex items-center gap-1">
                  <Tag className="h-3.5 w-3.5" /> {t('customerCyber:claims.incidentType')} <RequiredIndicator />
                </Label>
                <Select value={formIncidentType} onValueChange={(v) => { setFormIncidentType(v); clearFieldError('formIncidentType'); }}>
                  <SelectTrigger className="mt-1 focus-ring" aria-invalid={!!fieldErrors.formIncidentType} aria-describedby={fieldErrors.formIncidentType ? 'formIncidentType-error' : undefined}>
                    <SelectValue placeholder={t('customerCyber:claims.selectIncidentType')} />
                  </SelectTrigger>
                  <SelectContent>
                    {INCIDENT_TYPES.map((it) => (
                      <SelectItem key={it.value} value={it.value}>
                        {t(`customerCyber:incidentTypes.${it.value}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError id="formIncidentType-error">{fieldErrors.formIncidentType}</FieldError>
              </div>

              {/* Description */}
              <div>
                <Label htmlFor="description" className="text-sm font-medium flex items-center gap-1">
                  <ClipboardList className="h-3.5 w-3.5" /> {t('customerCyber:claims.description')} <RequiredIndicator />
                </Label>
                <Textarea
                  id="description"
                  value={formDescription}
                  onChange={(e) => { setFormDescription(e.target.value); clearFieldError('formDescription'); }}
                  onBlur={() => validateField('formDescription', formDescription, { required: true, minLength: 10 })}
                  placeholder={t('customerCyber:claims.describeIncident')}
                  className="mt-1 focus-ring"
                  maxLength={2000}
                  rows={3}
                  aria-invalid={!!fieldErrors.formDescription}
                  aria-describedby={fieldErrors.formDescription ? 'formDescription-error' : undefined}
                />
                <CharCounter current={formDescription.length} max={2000} />
                <FieldError id="formDescription-error">{fieldErrors.formDescription}</FieldError>
              </div>

              {/* Estimated Loss */}
              <div>
                <Label htmlFor="estimatedLoss" className="text-sm font-medium flex items-center gap-1">
                  <DollarSign className="h-3.5 w-3.5" /> {t('customerCyber:claims.estimatedLoss')} <RequiredIndicator />
                </Label>
                <Input
                  id="estimatedLoss"
                  type="number"
                  value={formEstimatedLoss}
                  onChange={(e) => { setFormEstimatedLoss(e.target.value); clearFieldError('formEstimatedLoss'); }}
                  onBlur={() => validateField('formEstimatedLoss', formEstimatedLoss, { required: true })}
                  placeholder={t('customerCyber:claims.estimatedLossPlaceholder')}
                  className="mt-1 focus-ring"
                  aria-invalid={!!fieldErrors.formEstimatedLoss}
                  aria-describedby={fieldErrors.formEstimatedLoss ? 'formEstimatedLoss-error' : undefined}
                />
                <FieldError id="formEstimatedLoss-error">{fieldErrors.formEstimatedLoss}</FieldError>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  {t('common:action.cancel')}
                </Button>
                <Button
                  onClick={handleFileClaim}
                  disabled={submitting}
                  variant="tunis"
                  className="font-bold"
                >
                  {submitting ? <><Loader2 className="me-2 h-4 w-4 animate-spin" />{t('customerCyber:claims.filing')}</> : t('customerCyber:claims.fileClaim')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {policies.length === 0 && (
        <div className="mb-4 flex items-start gap-2 bg-amber-50 border border-amber-100 dark:bg-amber-900/20 dark:border-amber-800/30 p-3 rounded-xl animate-fade-in-up">
          <AlertCircle className="h-4 w-4 text-amber-500 dark:text-amber-400 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-300">
            {t('customerCyber:claims.noActivePolicy')}
          </p>
        </div>
      )}

      {claims.length === 0 ? (
        <Card className="shadow-md animate-fade-in-up">
          <CardContent className="p-12 text-center">
            <div className="bg-muted w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground font-medium">{t('customerCyber:claims.noClaims')}</p>
            <p className="text-muted-foreground text-sm mt-1">{t('customerCyber:claims.noClaimsDesc')}</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-md animate-fade-in-up">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">{t('customerCyber:claims.title')}</caption>
                <thead>
                  <tr className="border-b bg-muted/80">
                    <th className="text-start p-3 font-medium text-muted-foreground">{t('customerCyber:claims.incidentDate')}</th>
                    <th className="text-start p-3 font-medium text-muted-foreground">{t('customerCyber:claims.type')}</th>
                    <th className="text-start p-3 font-medium text-muted-foreground">{t('customerCyber:claims.description')}</th>
                    <th className="text-end p-3 font-medium text-muted-foreground">{t('customerCyber:claims.estLoss')}</th>
                    <th className="text-start p-3 font-medium text-muted-foreground">{t('customerCyber:claims.status')}</th>
                    <th className="text-end p-3 font-medium text-muted-foreground">{t('customerCyber:claims.approved')}</th>
                  </tr>
                </thead>
                <tbody>
                  {claims.map((c) => {
                    const statusStyle = STATUS_STYLES[c.statusCode] || STATUS_STYLES.REPORTED;
                    const statusDot = STATUS_DOTS[c.statusCode] || 'bg-yellow-500';
                    return (
                      <tr key={c.id} className="border-b table-row-hover">
                        <td className="p-3 text-muted-foreground">
                          {formatDate(c.incidentDate)}
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className="text-xs font-mono bg-primary/5" title={typeof c.incidentType === 'object' ? c.incidentType.typeName : c.incidentType}>
                            {typeof c.incidentType === 'object' ? c.incidentType.typeName : c.incidentType}
                          </Badge>
                        </td>
                        <td className="p-3 max-w-xs">
                          <p className="truncate">{c.description}</p>
                        </td>
                        <td className="p-3 text-end font-semibold">
                          {formatTnd(c.estimatedLoss)} {t('common:unit.tnd', 'TND')}
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className={statusStyle} title={c.statusName || c.statusCode.replace(/_/g, ' ')}>
                            <span className={`w-1.5 h-1.5 rounded-full ${statusDot} me-1.5`} />
                            {c.statusName || c.statusCode.replace(/_/g, ' ')}
                          </Badge>
                        </td>
                        <td className="p-3 text-end font-semibold text-emerald-600 dark:text-emerald-400">
                          {c.approvedAmount !== null
                            ? `${formatTnd(c.approvedAmount)} ${t('common:unit.tnd', 'TND')}`
                            : '—'}
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

      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => !open && setConfirmDialog({open: false, action: ''})}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('customerCyber:claims.confirmTitle', 'Confirm Claim Filing')}</AlertDialogTitle>
            <AlertDialogDescription>{t('customerCyber:claims.confirmDescription', 'By filing this cyber insurance claim, you are making a legally binding declaration. Filing a fraudulent claim may result in policy cancellation and legal consequences. Are you sure you want to proceed?')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common:action.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={performFileClaim}>{t('common:action.confirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

