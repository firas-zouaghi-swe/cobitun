'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { FunctionSquare, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { fetchWithAuth, Roles } from '@/hooks/use-auth';
import Protected from '@/components/Protected';
import { PageErrorState, PageLoadingState } from '@/components/shared/PageStates';

interface PayoutConfig {
  id: number;
  configName: string;
  configCode: string;
  functionType: string;
  description: string | null;
  linearMultiplier: number | null;
  stepConfigJson: string | null;
  hybridBaseRate: number | null;
  hybridStepConfigJson: string | null;
  exponentialBase: number | null;
  exponentialExponent: number | null;
  isActive: number;
  createdAt: string;
}

const FUNCTION_TYPES = ['LINEAR', 'STEP', 'HYBRID', 'EXPONENTIAL'];

function isValidJson(str: string): boolean {
  try { JSON.parse(str); return true; } catch { return false; }
}

const TYPE_STYLES: Record<string, string> = {
  LINEAR: 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/30',
  STEP: 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/30',
  HYBRID: 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/30',
  EXPONENTIAL: 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800/30',
};

export default function AdminPayoutFunctionsPage() {
  const { t } = useTranslation('adminPayoutFunctions');
  const [configs, setConfigs] = useState<PayoutConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [configName, setConfigName] = useState('');
  const [configCode, setConfigCode] = useState('');
  const [functionType, setFunctionType] = useState('');
  const [description, setDescription] = useState('');
  // Linear
  const [linearMultiplier, setLinearMultiplier] = useState('');
  // Step
  const [stepConfigJson, setStepConfigJson] = useState('');
  // Hybrid
  const [hybridBaseRate, setHybridBaseRate] = useState('');
  const [hybridStepConfigJson, setHybridStepConfigJson] = useState('');
  // Exponential
  const [exponentialBase, setExponentialBase] = useState('');
  const [exponentialExponent, setExponentialExponent] = useState('');

  const fetchConfigs = async () => {
    setError(null);
    try {
      const res = await fetchWithAuth('/api/admin/payout-functions');
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.error || `Request failed with status ${res.status}`);
      }
      const data = await res.json();
      setConfigs(data.configs || []);
    } catch (err) {
      console.error('Failed to fetch payout configs:', err);
      setError(t('errors.failedToLoad', 'Failed to load data'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  const handleSave = async () => {
    if (!configName.trim() || !configCode.trim() || !functionType) {
      toast.error(t('toast.requiredFields'));
      return;
    }
    // Validate JSON fields
    if (functionType === 'STEP' && stepConfigJson && !isValidJson(stepConfigJson)) {
      toast.error(t('validation.invalidStepConfigJson', 'Invalid JSON format for step configuration'));
      return;
    }
    if (functionType === 'HYBRID' && hybridStepConfigJson && !isValidJson(hybridStepConfigJson)) {
      toast.error(t('validation.invalidHybridStepConfigJson', 'Invalid JSON format for hybrid step configuration'));
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        configName: configName.trim(),
        configCode: configCode.trim(),
        functionType,
        description: description.trim() || null,
      };

      // Only include fields relevant to the selected function type
      if (functionType === 'LINEAR') {
        payload.linearMultiplier = linearMultiplier ? parseFloat(linearMultiplier) : null;
      } else if (functionType === 'STEP') {
        payload.stepConfigJson = stepConfigJson || null;
      } else if (functionType === 'HYBRID') {
        payload.hybridBaseRate = hybridBaseRate ? parseFloat(hybridBaseRate) : null;
        payload.hybridStepConfigJson = hybridStepConfigJson || null;
      } else if (functionType === 'EXPONENTIAL') {
        payload.exponentialBase = exponentialBase ? parseFloat(exponentialBase) : null;
        payload.exponentialExponent = exponentialExponent ? parseFloat(exponentialExponent) : null;
      }

      const res = await fetchWithAuth('/api/admin/payout-functions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success(t('toast.created'));
        setDialogOpen(false);
        resetForm();
        fetchConfigs();
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
    setConfigName('');
    setConfigCode('');
    setFunctionType('');
    setDescription('');
    setLinearMultiplier('');
    setStepConfigJson('');
    setHybridBaseRate('');
    setHybridStepConfigJson('');
    setExponentialBase('');
    setExponentialExponent('');
  };

  if (error) {
    return (
      <Protected roles={[Roles.ADMIN, Roles.SUPER_ADMIN]}>
        <PageErrorState message={error} onRetry={fetchConfigs} />
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
      <div className="flex items-center justify-between mb-6 animate-fade-in-down">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FunctionSquare className="h-6 w-6 text-primary" /> {t('title')}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{t('subtitle')}</p>
        </div>
        <Button
          onClick={() => { resetForm(); setDialogOpen(true); }}
          variant="tunis"
        >
          <Plus className="h-4 w-4 me-2" /> {t('createConfig')}
        </Button>
      </div>

      <Card className="shadow-md animate-fade-in-up">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">{t('table.caption.payoutFunctions', 'Payout Functions')}</caption>
              <thead>
                <tr className="border-b bg-muted/80">
                  <th className="text-start p-3 font-medium text-muted-foreground">{t('table.name')}</th>
                  <th className="text-start p-3 font-medium text-muted-foreground">{t('table.code')}</th>
                  <th className="text-start p-3 font-medium text-muted-foreground">{t('table.type')}</th>
                  <th className="text-start p-3 font-medium text-muted-foreground">{t('table.description')}</th>
                  <th className="text-start p-3 font-medium text-muted-foreground">{t('table.parameters')}</th>
                  <th className="text-start p-3 font-medium text-muted-foreground">{t('table.status')}</th>
                </tr>
              </thead>
              <tbody>
                {configs.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">
                    <FunctionSquare className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    {t('empty.noConfigs')}
                  </td></tr>
                ) : (
                  configs.map((c) => (
                    <tr key={c.id} className="border-b table-row-hover">
                      <td className="p-3 font-medium">{c.configName}</td>
                      <td className="p-3 font-mono text-muted-foreground">{c.configCode}</td>
                      <td className="p-3">
                        <Badge variant="outline" title={t('types.' + c.functionType)} className={TYPE_STYLES[c.functionType] || ''}>
                          {t('types.' + c.functionType)}
                        </Badge>
                      </td>
                      <td className="p-3 text-muted-foreground max-w-48 truncate">{c.description || '—'}</td>
                      <td className="p-3">
                        <div className="text-xs space-y-0.5">
                          {c.functionType === 'LINEAR' && c.linearMultiplier && (
                            <span className="text-muted-foreground">{t('params.multiplier')}: {Number(c.linearMultiplier)}</span>
                          )}
                          {c.functionType === 'STEP' && c.stepConfigJson && (
                            <span className="text-muted-foreground">{t('params.steps')}</span>
                          )}
                          {c.functionType === 'HYBRID' && (
                            <>
                              {c.hybridBaseRate && <span className="text-muted-foreground block">{t('params.baseRate')}: {Number(c.hybridBaseRate)}</span>}
                              {c.hybridStepConfigJson && <span className="text-muted-foreground block">{t('params.steps')}</span>}
                            </>
                          )}
                          {c.functionType === 'EXPONENTIAL' && (
                            <>
                              {c.exponentialBase && <span className="text-muted-foreground block">{t('params.base')}: {Number(c.exponentialBase)}</span>}
                              {c.exponentialExponent && <span className="text-muted-foreground block">{t('params.exponent')}: {Number(c.exponentialExponent)}</span>}
                            </>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" title={c.isActive ? t('status.active') : t('status.inactive')} className={c.isActive ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800/30' : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800/30'}>
                          <span className={`w-1.5 h-1.5 rounded-full ${c.isActive ? 'bg-green-500' : 'bg-red-500'} me-1.5`} />
                          {c.isActive ? t('status.active') : t('status.inactive')}
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

      {/* Create Config Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FunctionSquare className="h-5 w-5 text-primary" />
              {t('dialog.createTitle')}
            </DialogTitle>
            <DialogDescription>
              {t('dialog.createDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="configName">{t('dialog.configName')}</Label>
                <Input id="configName" placeholder={t('dialog.configNamePlaceholder')} value={configName} onChange={(e) => setConfigName(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="configCode">{t('dialog.configCode')}</Label>
                <Input id="configCode" placeholder={t('dialog.configCodePlaceholder')} value={configCode} onChange={(e) => setConfigCode(e.target.value)} className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="functionType">{t('dialog.functionType')}</Label>
                <Select value={functionType} onValueChange={setFunctionType}>
                  <SelectTrigger id="functionType" className="mt-1">
                    <SelectValue placeholder={t('dialog.selectType')} />
                  </SelectTrigger>
                  <SelectContent>
                    {FUNCTION_TYPES.map((ft) => (
                      <SelectItem key={ft} value={ft}>{t('types.' + ft)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="description">{t('dialog.description')}</Label>
                <Input id="description" placeholder={t('dialog.descriptionPlaceholder')} value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1" />
              </div>
            </div>

            {/* Dynamic fields based on function type */}
            {functionType === 'LINEAR' && (
              <div>
                <Label htmlFor="linearMultiplier">{t('dialog.linearMultiplier')}</Label>
                <Input id="linearMultiplier" type="number" step="0.01" placeholder={t('dialog.linearMultiplierPlaceholder')} value={linearMultiplier} onChange={(e) => setLinearMultiplier(e.target.value)} className="mt-1" />
                <p className="text-xs text-muted-foreground mt-1">{t('dialog.linearMultiplierHint')}</p>
              </div>
            )}

            {functionType === 'STEP' && (
              <div>
                <Label htmlFor="stepConfigJson">{t('dialog.stepConfigJson')}</Label>
                <Input id="stepConfigJson" placeholder={t('dialog.stepConfigJsonPlaceholder')} value={stepConfigJson} onChange={(e) => setStepConfigJson(e.target.value)} className="mt-1" />
                <p className="text-xs text-muted-foreground mt-1">{t('dialog.stepConfigJsonHint')}</p>
              </div>
            )}

            {functionType === 'HYBRID' && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="hybridBaseRate">{t('dialog.hybridBaseRate')}</Label>
                  <Input id="hybridBaseRate" type="number" step="0.01" placeholder={t('dialog.hybridBaseRatePlaceholder')} value={hybridBaseRate} onChange={(e) => setHybridBaseRate(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="hybridStepConfigJson">{t('dialog.hybridStepConfigJson')}</Label>
                  <Input id="hybridStepConfigJson" placeholder={t('dialog.hybridStepConfigJsonPlaceholder')} value={hybridStepConfigJson} onChange={(e) => setHybridStepConfigJson(e.target.value)} className="mt-1" />
                  <p className="text-xs text-muted-foreground mt-1">{t('dialog.hybridStepConfigJsonHint')}</p>
                </div>
              </div>
            )}

            {functionType === 'EXPONENTIAL' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="exponentialBase">{t('dialog.exponentialBase')}</Label>
                  <Input id="exponentialBase" type="number" step="0.01" placeholder={t('dialog.exponentialBasePlaceholder')} value={exponentialBase} onChange={(e) => setExponentialBase(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="exponentialExponent">{t('dialog.exponentialExponent')}</Label>
                  <Input id="exponentialExponent" type="number" step="0.01" placeholder={t('dialog.exponentialExponentPlaceholder')} value={exponentialExponent} onChange={(e) => setExponentialExponent(e.target.value)} className="mt-1" />
                  <p className="text-xs text-muted-foreground mt-1">{t('dialog.exponentialHint')}</p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>{t('common:action.cancel')}</Button>
            <Button onClick={handleSave} disabled={saving || !configName || !configCode || !functionType} variant="tunis">
              {saving ? t('dialog.creating') : t('createConfig')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </Protected>
  );
}

