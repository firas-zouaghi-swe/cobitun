'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { FileEdit, Info, Mail, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { fetchWithAuth, Roles } from '@/hooks/use-auth';
import Protected from '@/components/Protected';
import { PageErrorState, PageLoadingState } from '@/components/shared/PageStates';
import { FieldError, RequiredIndicator, CharCounter } from '@/components/ui/form-warning';

interface Endorsement {
  id: number;
  endorsementNumber: string;
  endorsementType: string;
  changeDescription: string;
  premiumAdjustment: number;
  effectiveDate: string;
  status: string;
  parametricPolicy?: { id: number; policyNumber: string };
  cyberPolicy?: { id: number; policyNumber: string };
  createdAt: string;
}

const ENDORSEMENT_TYPES = ['COVERAGE_CHANGE', 'PREMIUM_ADJUSTMENT', 'POLICYHOLDER_CHANGE', 'ENDORSEMENT_ADD', 'ENDORSEMENT_REMOVE', 'REINSTATEMENT', 'CANCELLATION'];

function isValidJson(str: string): boolean {
  try { JSON.parse(str); return true; } catch { return false; }
}

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800/30',
  APPROVED: 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800/30',
  REJECTED: 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800/30',
  PROCESSED: 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/30',
};

export default function AdminEndorsementsPage() {
  const { t, i18n } = useTranslation('adminEndorsements');
  const locale = i18n.language === 'ar' ? 'ar-TN' : i18n.language === 'fr' ? 'fr-TN' : undefined;
  const [endorsements, setEndorsements] = useState<Endorsement[]>([]);
  const [cyberEndorsements, setCyberEndorsements] = useState<Endorsement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const clearFieldError = (field: string) => {
    setFieldErrors(prev => {
      const next = {...prev};
      delete next[field];
      return next;
    });
  };

  // Form state
  const [parametricPolicyId, setParametricPolicyId] = useState('');
  const [endorsementNumber, setEndorsementNumber] = useState('');
  const [endorsementType, setEndorsementType] = useState('');
  const [changeDescription, setChangeDescription] = useState('');
  const [premiumAdjustment, setPremiumAdjustment] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [previousValuesJson, setPreviousValuesJson] = useState('');
  const [newValuesJson, setNewValuesJson] = useState('');

  const fetchEndorsements = async () => {
    setError(null);
    try {
      const res = await fetchWithAuth('/api/admin/endorsements/parametric');
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.error || `Request failed with status ${res.status}`);
      }
      const data = await res.json();
      setEndorsements(data.endorsements || []);
    } catch (err) {
      console.error('Failed to fetch endorsements:', err);
      setError(t('errors.failedToLoad', 'Failed to load data'));
    }
  };

  const fetchCyberEndorsements = async () => {
    try {
      const res = await fetchWithAuth('/api/admin/endorsements/cyber');
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.error || `Request failed with status ${res.status}`);
      }
      const data = await res.json();
      setCyberEndorsements(data.endorsements || []);
    } catch (err) {
      console.error('Failed to fetch cyber endorsements:', err);
    }
  };

  useEffect(() => {
    Promise.all([fetchEndorsements(), fetchCyberEndorsements()]).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    const errors: Record<string, string> = {};
    if (!parametricPolicyId.trim()) errors.parametricPolicyId = t('common:validation.required');
    if (!endorsementNumber.trim()) errors.endorsementNumber = t('common:validation.required');
    if (!endorsementType) errors.endorsementType = t('common:validation.select.required');
    if (!changeDescription.trim()) errors.changeDescription = t('common:validation.required');
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    // Validate JSON fields
    if (previousValuesJson && !isValidJson(previousValuesJson)) {
      toast.error(t('validation.invalidJson', 'Invalid JSON format for previous values'));
      return;
    }
    if (newValuesJson && !isValidJson(newValuesJson)) {
      toast.error(t('validation.invalidJsonNew', 'Invalid JSON format for new values'));
      return;
    }
    setSaving(true);
    try {
      const res = await fetchWithAuth('/api/admin/endorsements/parametric', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          parametricPolicyId: parseInt(parametricPolicyId),
          endorsementNumber: endorsementNumber.trim(),
          endorsementType,
          changeDescription: changeDescription.trim(),
          premiumAdjustment: premiumAdjustment ? parseFloat(premiumAdjustment) : 0,
          effectiveDate,
          previousValuesJson: previousValuesJson || '{}',
          newValuesJson: newValuesJson || '{}',
        }),
      });
      if (res.ok) {
        toast.success(t('toast.created'));
        setDialogOpen(false);
        resetForm();
        fetchEndorsements();
      } else {
        const data = await res.json();
        toast.error(data.error || t('toast.createFailed'));
      }
    } catch {
      toast.error(t('toast.createFailed'));
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setParametricPolicyId('');
    setEndorsementNumber('');
    setEndorsementType('');
    setChangeDescription('');
    setPremiumAdjustment('');
    setEffectiveDate('');
    setPreviousValuesJson('');
    setNewValuesJson('');
    setFieldErrors({});
  };

  if (error) {
    return (
      <Protected roles={[Roles.ADMIN, Roles.SUPER_ADMIN]}>
        <PageErrorState message={error} onRetry={fetchEndorsements} />
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
  const renderEndorsementTable = (items: Endorsement[], type: 'parametric' | 'cyber') => (
    <Card className="shadow-md">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">{t('table.caption.endorsements', 'Endorsements')}</caption>
            <thead>
              <tr className="border-b bg-muted/80">
                <th className="text-start p-3 font-medium text-muted-foreground">{t('table.endorsementNumber')}</th>
                <th className="text-start p-3 font-medium text-muted-foreground">{t('table.policy')}</th>
                <th className="text-start p-3 font-medium text-muted-foreground">{t('table.type')}</th>
                <th className="text-start p-3 font-medium text-muted-foreground">{t('table.description')}</th>
                <th className="text-start p-3 font-medium text-muted-foreground">{t('table.premiumAdj')}</th>
                <th className="text-start p-3 font-medium text-muted-foreground">{t('table.effectiveDate')}</th>
                <th className="text-start p-3 font-medium text-muted-foreground">{t('table.status')}</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">
                  <FileEdit className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  {t('empty.noEndorsements', { type })}
                </td></tr>
              ) : (
                items.map((e) => (
                  <tr key={e.id} className="border-b table-row-hover">
                    <td className="p-3 font-mono font-semibold text-foreground">{e.endorsementNumber}</td>
                    <td className="p-3 text-muted-foreground">{e.parametricPolicy?.policyNumber || e.cyberPolicy?.policyNumber || '—'}</td>
                    <td className="p-3">
                      <Badge variant="outline" title={t('types.' + e.endorsementType)} className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/30 text-[10px]">
                        {t('types.' + e.endorsementType)}
                      </Badge>
                    </td>
                    <td className="p-3 text-muted-foreground max-w-48 truncate">{e.changeDescription}</td>
                    <td className="p-3">
                      <span className={Number(e.premiumAdjustment) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                        {Number(e.premiumAdjustment) >= 0 ? '+' : ''}{Number(e.premiumAdjustment).toLocaleString()} {t('common:unit.tnd', 'TND')}
                      </span>
                    </td>
                    <td className="p-3 text-muted-foreground">{new Date(e.effectiveDate).toLocaleDateString(locale)}</td>
                    <td className="p-3">
                      <Badge variant="outline" title={t('status.' + e.status)} className={STATUS_STYLES[e.status] || STATUS_STYLES.PENDING}>
                        <span className={`w-1.5 h-1.5 rounded-full me-1.5 ${e.status === 'APPROVED' ? 'bg-green-500' : e.status === 'PENDING' ? 'bg-yellow-500' : e.status === 'REJECTED' ? 'bg-red-500' : 'bg-blue-500'}`} />
                        {t('status.' + e.status)}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <Protected roles={[Roles.ADMIN, Roles.SUPER_ADMIN]}>
      <div className="page-enter">
      <div className="flex items-center justify-between mb-6 animate-fade-in-down">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileEdit className="h-6 w-6 text-primary" /> {t('title')}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{t('subtitle')}</p>
        </div>
        <Button
          onClick={() => { resetForm(); setDialogOpen(true); }}
          variant="tunis"
        >
          <Plus className="h-4 w-4 me-2" /> {t('createEndorsement')}
        </Button>
      </div>

      <Tabs defaultValue="parametric" className="animate-fade-in-up">
        <TabsList className="mb-4">
          <TabsTrigger value="parametric">{t('tabs.parametric')}</TabsTrigger>
          <TabsTrigger value="cyber">{t('tabs.cyber')}</TabsTrigger>
        </TabsList>

        <TabsContent value="parametric">
          {renderEndorsementTable(endorsements, 'parametric')}
        </TabsContent>

        <TabsContent value="cyber">
          {cyberEndorsements.length === 0 && (
            <Card className="border-blue-200 dark:border-blue-800/30 bg-blue-50/50 dark:bg-blue-900/10 mb-4">
              <CardContent className="p-6 flex flex-col items-center text-center gap-3">
                <div className="bg-blue-100 dark:bg-blue-900/30 w-12 h-12 rounded-xl flex items-center justify-center">
                  <Info className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="font-medium text-foreground">{t('cyber.comingSoonTitle')}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t('cyber.comingSoonDescription')}
                  </p>
                </div>
                <Button variant="outline" size="sm" className="gap-2" onClick={() => { toast.info(t('adminCommon:contactSupport.comingSoon', 'Contact support feature coming soon')); }}>
                  <Mail className="h-4 w-4" /> {t('cyber.contactSupport')}
                </Button>
              </CardContent>
            </Card>
          )}
          {renderEndorsementTable(cyberEndorsements, 'cyber')}
        </TabsContent>
      </Tabs>

      {/* Create Endorsement Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileEdit className="h-5 w-5 text-primary" />
              {t('dialog.createTitle')}
            </DialogTitle>
            <DialogDescription>
              {t('dialog.createDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="policyId">
                  {t('dialog.policyId')} <RequiredIndicator />
                </Label>
                <Input id="policyId" type="number" placeholder={t('dialog.policyIdPlaceholder')} value={parametricPolicyId} onChange={(e) => { setParametricPolicyId(e.target.value); clearFieldError('parametricPolicyId'); }} onBlur={() => { if (!parametricPolicyId.trim()) setFieldErrors(prev => ({...prev, parametricPolicyId: t('common:validation.required') })); }} className="mt-1" aria-invalid={!!fieldErrors.parametricPolicyId} aria-describedby={fieldErrors.parametricPolicyId ? 'parametricPolicyId-error' : undefined} />
                <FieldError id="parametricPolicyId-error">{fieldErrors.parametricPolicyId}</FieldError>
              </div>
              <div>
                <Label htmlFor="endorsementNumber">
                  {t('dialog.endorsementNumber')} <RequiredIndicator />
                </Label>
                <Input id="endorsementNumber" placeholder={t('dialog.endorsementNumberPlaceholder')} value={endorsementNumber} onChange={(e) => { setEndorsementNumber(e.target.value); clearFieldError('endorsementNumber'); }} onBlur={() => { if (!endorsementNumber.trim()) setFieldErrors(prev => ({...prev, endorsementNumber: t('common:validation.required') })); }} maxLength={255} className="mt-1" aria-invalid={!!fieldErrors.endorsementNumber} aria-describedby={fieldErrors.endorsementNumber ? 'endorsementNumber-error' : undefined} />
                <FieldError id="endorsementNumber-error">{fieldErrors.endorsementNumber}</FieldError>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="endorsementType">
                  {t('dialog.type')} <RequiredIndicator />
                </Label>
                <Select value={endorsementType} onValueChange={(v) => { setEndorsementType(v); clearFieldError('endorsementType'); }}>
                  <SelectTrigger id="endorsementType" className="mt-1" aria-invalid={!!fieldErrors.endorsementType} aria-describedby={fieldErrors.endorsementType ? 'endorsementType-error' : undefined}>
                    <SelectValue placeholder={t('dialog.selectType')} />
                  </SelectTrigger>
                  <SelectContent>
                    {ENDORSEMENT_TYPES.map((et) => (
                      <SelectItem key={et} value={et}>{t('types.' + et)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError id="endorsementType-error">{fieldErrors.endorsementType}</FieldError>
              </div>
              <div>
                <Label htmlFor="premiumAdjustment">{t('dialog.premiumAdjustment')}</Label>
                <Input id="premiumAdjustment" type="number" step="0.01" placeholder="0.00" value={premiumAdjustment} onChange={(e) => setPremiumAdjustment(e.target.value)} className="mt-1" />
              </div>
            </div>
            <div>
              <Label htmlFor="effectiveDate">{t('dialog.effectiveDate')}</Label>
              <Input id="effectiveDate" type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="changeDescription">
                {t('dialog.changeDescription')} <RequiredIndicator />
              </Label>
              <Input id="changeDescription" placeholder={t('dialog.changeDescriptionPlaceholder')} value={changeDescription} onChange={(e) => { setChangeDescription(e.target.value); clearFieldError('changeDescription'); }} onBlur={() => { if (!changeDescription.trim()) setFieldErrors(prev => ({...prev, changeDescription: t('common:validation.required') })); }} maxLength={2000} className="mt-1" aria-invalid={!!fieldErrors.changeDescription} aria-describedby={fieldErrors.changeDescription ? 'changeDescription-error' : undefined} />
              <FieldError id="changeDescription-error">{fieldErrors.changeDescription}</FieldError>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="previousValues">{t('dialog.previousValues')}</Label>
                <Input id="previousValues" placeholder={t('dialog.jsonPlaceholder')} value={previousValuesJson} onChange={(e) => setPreviousValuesJson(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="newValues">{t('dialog.newValues')}</Label>
                <Input id="newValues" placeholder={t('dialog.jsonPlaceholder')} value={newValuesJson} onChange={(e) => setNewValuesJson(e.target.value)} className="mt-1" />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>{t('common:action.cancel')}</Button>
            <Button onClick={handleSave} disabled={saving || !parametricPolicyId || !endorsementNumber || !endorsementType || !changeDescription || !effectiveDate} variant="tunis">
              {saving ? t('dialog.creating') : t('createEndorsement')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </Protected>
  );
}

