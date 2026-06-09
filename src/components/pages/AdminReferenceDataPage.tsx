'use client';

import React, { useEffect, useState } from 'react';
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
import { ChevronDown, ChevronRight, Database, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { fetchWithAuth, Roles } from '@/hooks/use-auth';
import Protected from '@/components/Protected';
import { PageErrorState, PageLoadingState, PageEmptyState } from '@/components/shared/PageStates';

interface VersionHistoryEntry {
  id: number;
  version: number;
  validFrom: string;
  validTo: string | null;
  isCurrent: number;
  riskFactor?: number | null;
  riskMultiplier?: number | null;
  basePremiumFactor?: number | null;
  mttrHours?: number | null;
  thresholdHours?: number | null;
  minTurnover?: number | null;
  maxTurnover?: number | null;
  createdBy?: number | null;
}

interface RefEntry {
  id: number;
  [key: string]: unknown;
  versionHistory?: VersionHistoryEntry[];
}

interface RefConfig {
  model: string;
  codeField: string;
  nameField: string;
  extraFields?: string[];
}

type RefType = 'sector' | 'businessModel' | 'turnoverBand' | 'resilienceProfile' | 'slaTier' | 'securityPosture';

const REF_TABS: { type: RefType }[] = [
  { type: 'sector' },
  { type: 'businessModel' },
  { type: 'turnoverBand' },
  { type: 'resilienceProfile' },
  { type: 'slaTier' },
  { type: 'securityPosture' },
];

export default function AdminReferenceDataPage() {
  const { t, i18n } = useTranslation('adminReferenceData');
  const locale = i18n.language === 'ar' ? 'ar-TN' : i18n.language === 'fr' ? 'fr-TN' : undefined;
  const [activeTab, setActiveTab] = useState<string>('sector');
  const [entries, setEntries] = useState<RefEntry[]>([]);
  const [config, setConfig] = useState<RefConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editEntry, setEditEntry] = useState<RefEntry | null>(null);
  const [expandedEntries, setExpandedEntries] = useState<Set<number>>(new Set());

  // Form state
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [riskFactor, setRiskFactor] = useState('');
  const [riskMultiplier, setRiskMultiplier] = useState('');
  const [basePremiumFactor, setBasePremiumFactor] = useState('');
  const [mttrHours, setMttrHours] = useState('');
  const [thresholdHours, setThresholdHours] = useState('');
  const [minTurnover, setMinTurnover] = useState('');
  const [maxTurnover, setMaxTurnover] = useState('');
  const [description, setDescription] = useState('');

  const fetchData = async (type: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth(`/api/admin/reference/${type}`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.error || `Request failed with status ${res.status}`);
      }
      const data = await res.json();
      setEntries(data.entries || []);
      setConfig(data.config || null);
    } catch (err) {
      console.error('Failed to fetch reference data:', err);
      setError(t('errors.failedToLoad', 'Failed to load data'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(activeTab);
  }, [activeTab]);

  const toggleEntry = (id: number) => {
    setExpandedEntries((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openEditDialog = (entry: RefEntry) => {
    setEditEntry(entry);
    const codeField = config?.codeField || '';
    const nameField = config?.nameField || '';
    setCode(String(entry[codeField] || ''));
    setName(String(entry[nameField] || ''));
    setRiskFactor(entry.riskFactor != null ? String(entry.riskFactor) : '');
    setRiskMultiplier(entry.riskMultiplier != null ? String(entry.riskMultiplier) : '');
    setBasePremiumFactor(entry.basePremiumFactor != null ? String(entry.basePremiumFactor) : '');
    setMttrHours(entry.mttrHours != null ? String(entry.mttrHours) : '');
    setThresholdHours(entry.thresholdHours != null ? String(entry.thresholdHours) : '');
    setMinTurnover(entry.minTurnover != null ? String(entry.minTurnover) : '');
    setMaxTurnover(entry.maxTurnover != null ? String(entry.maxTurnover) : '');
    setDescription(String(entry.description || ''));
    setDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditEntry(null);
    setCode('');
    setName('');
    setRiskFactor('');
    setRiskMultiplier('');
    setBasePremiumFactor('');
    setMttrHours('');
    setThresholdHours('');
    setMinTurnover('');
    setMaxTurnover('');
    setDescription('');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!code.trim() || !name.trim()) {
      toast.error(t('toast.requiredFields'));
      return;
    }
    // Validate numeric fields
    if (riskFactor && (isNaN(parseFloat(riskFactor)) || parseFloat(riskFactor) < 0)) {
      toast.error(t('validation.invalidRiskFactor', 'Risk factor must be a valid non-negative number'));
      return;
    }
    if (riskMultiplier && (isNaN(parseFloat(riskMultiplier)) || parseFloat(riskMultiplier) < 0)) {
      toast.error(t('validation.invalidRiskMultiplier', 'Risk multiplier must be a valid non-negative number'));
      return;
    }
    if (basePremiumFactor && (isNaN(parseFloat(basePremiumFactor)) || parseFloat(basePremiumFactor) < 0)) {
      toast.error(t('validation.invalidBasePremiumFactor', 'Base premium factor must be a valid non-negative number'));
      return;
    }
    if (mttrHours && (isNaN(parseFloat(mttrHours)) || parseFloat(mttrHours) < 0)) {
      toast.error(t('validation.invalidMttrHours', 'MTTR hours must be a valid non-negative number'));
      return;
    }
    if (thresholdHours && (isNaN(parseFloat(thresholdHours)) || parseFloat(thresholdHours) < 0)) {
      toast.error(t('validation.invalidThresholdHours', 'Threshold hours must be a valid non-negative number'));
      return;
    }
    if (minTurnover && (isNaN(parseFloat(minTurnover)) || parseFloat(minTurnover) < 0)) {
      toast.error(t('validation.invalidMinTurnover', 'Min turnover must be a valid non-negative number'));
      return;
    }
    if (maxTurnover && (isNaN(parseFloat(maxTurnover)) || parseFloat(maxTurnover) < 0)) {
      toast.error(t('validation.invalidMaxTurnover', 'Max turnover must be a valid non-negative number'));
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        code: code.trim(),
        name: name.trim(),
        description: description.trim() || null,
      };

      // Add type-specific fields
      if (['sector', 'businessModel', 'turnoverBand', 'resilienceProfile'].includes(activeTab)) {
        if (riskFactor) payload.riskFactor = parseFloat(riskFactor);
      }
      if (activeTab === 'securityPosture') {
        if (riskMultiplier) payload.riskMultiplier = parseFloat(riskMultiplier);
      }
      if (activeTab === 'slaTier') {
        if (basePremiumFactor) payload.basePremiumFactor = parseFloat(basePremiumFactor);
        if (mttrHours) payload.mttrHours = parseFloat(mttrHours);
        if (thresholdHours) payload.thresholdHours = parseFloat(thresholdHours);
      }
      if (activeTab === 'turnoverBand') {
        if (minTurnover) payload.minTurnover = parseFloat(minTurnover);
        if (maxTurnover) payload.maxTurnover = parseFloat(maxTurnover);
      }

      const res = await fetchWithAuth(`/api/admin/reference/${activeTab}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success(editEntry ? t('toast.versionCreated') : t('toast.entryCreated'));
        setDialogOpen(false);
        resetForm();
        fetchData(activeTab);
      } else {
        const data = await res.json();
        toast.error(data.error || t('toast.saveFailed'));
      }
    } catch {
      toast.error(t('toast.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setEditEntry(null);
    setCode('');
    setName('');
    setRiskFactor('');
    setRiskMultiplier('');
    setBasePremiumFactor('');
    setMttrHours('');
    setThresholdHours('');
    setMinTurnover('');
    setMaxTurnover('');
    setDescription('');
  };

  const renderExtraFields = (entry: RefEntry) => {
    const fields: React.JSX.Element[] = [];
    if (entry.riskFactor != null) fields.push(<span key="rf" className="text-xs text-muted-foreground">{t('params.rf')}: {Number(entry.riskFactor).toFixed(4)}</span>);
    if (entry.riskMultiplier != null) fields.push(<span key="rm" className="text-xs text-muted-foreground">{t('params.rm')}: {Number(entry.riskMultiplier).toFixed(4)}</span>);
    if (entry.basePremiumFactor != null) fields.push(<span key="bpf" className="text-xs text-muted-foreground">{t('params.bpf')}: {Number(entry.basePremiumFactor).toFixed(4)}</span>);
    if (entry.mttrHours != null) fields.push(<span key="mttr" className="text-xs text-muted-foreground">{t('params.mttr')}: {Number(entry.mttrHours)}h</span>);
    if (entry.thresholdHours != null) fields.push(<span key="th" className="text-xs text-muted-foreground">{t('params.threshold')}: {Number(entry.thresholdHours)}h</span>);
    if (entry.minTurnover != null) fields.push(<span key="min" className="text-xs text-muted-foreground">{t('params.min')}: {Number(entry.minTurnover).toLocaleString()}</span>);
    if (entry.maxTurnover != null) fields.push(<span key="max" className="text-xs text-muted-foreground">{t('params.max')}: {Number(entry.maxTurnover).toLocaleString()}</span>);
    return fields.length > 0 ? <div className="flex gap-2 flex-wrap">{fields}</div> : null;
  };

  const renderEntries = () => {
    if (entries.length === 0) {
      return (
        <PageEmptyState
          icon={<Database className="h-10 w-10 opacity-30" />}
          title={t('empty.noEntries', { type: t('typeLabels.' + activeTab) })}
        />
      );
    }

    return (
      <>
        {entries.map((entry) => (
          <Card key={entry.id} className="shadow-sm">
            <CardContent className="p-0">
              <div
                className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => toggleEntry(entry.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && toggleEntry(entry.id)}
              >
                <div className="flex items-center gap-3">
                  {expandedEntries.has(entry.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <span className="font-mono font-semibold text-foreground">{String(entry[config?.codeField || ''] || '')}</span>
                  <span className="font-medium">{String(entry[config?.nameField || ''] || '')}</span>
                  <Badge variant="outline" title={t('version.version', 'Version') + ' ' + (('version' in entry ? (entry as Record<string, unknown>).version : null) || 1)} className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/30 text-[10px]">
                    v{String(('version' in entry ? (entry as Record<string, unknown>).version : null) || 1)}
                  </Badge>
                  {renderExtraFields(entry)}
                </div>
                <Button size="sm" variant="outline" className="text-xs" onClick={(e) => { e.stopPropagation(); openEditDialog(entry); }} aria-label={"New version for " + String(entry[config?.codeField || ''] || '')}>
                  <Plus className="h-3 w-3 me-1" /> {t('version.newVersion')}
                </Button>
              </div>

              {expandedEntries.has(entry.id) && entry.versionHistory && entry.versionHistory.length > 0 && (
                <CardContent className="px-3 pb-3 pt-0">
                  <p className="text-xs font-medium text-muted-foreground mb-2">{t('version.history')}</p>
                  <table className="w-full text-xs">
                    <caption className="sr-only">{t('versionTable.caption.versionHistory', 'Version History')}</caption>
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-start p-2 font-medium text-muted-foreground">{t('versionTable.version')}</th>
                        <th className="text-start p-2 font-medium text-muted-foreground">{t('versionTable.validFrom')}</th>
                        <th className="text-start p-2 font-medium text-muted-foreground">{t('versionTable.validTo')}</th>
                        <th className="text-start p-2 font-medium text-muted-foreground">{t('versionTable.current')}</th>
                        <th className="text-start p-2 font-medium text-muted-foreground">{t('versionTable.parameters')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entry.versionHistory!.map((v) => (
                        <tr key={v.id} className="border-b">
                          <td className="p-2 font-mono">v{v.version}</td>
                          <td className="p-2 text-muted-foreground">{new Date(v.validFrom).toLocaleDateString(locale)}</td>
                          <td className="p-2 text-muted-foreground">{v.validTo ? new Date(v.validTo).toLocaleDateString(locale) : '—'}</td>
                          <td className="p-2">
                            {v.isCurrent ? (
                              <Badge variant="outline" title={t('version.current')} className="bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800/30 text-[9px] px-1.5">{t('version.current')}</Badge>
                            ) : '—'}
                          </td>
                          <td className="p-2 text-muted-foreground">
                            <div className="flex gap-2 flex-wrap">
                              {v.riskFactor != null && <span>{t('params.rf')}: {Number(v.riskFactor).toFixed(4)}</span>}
                              {v.riskMultiplier != null && <span>{t('params.rm')}: {Number(v.riskMultiplier).toFixed(4)}</span>}
                              {v.basePremiumFactor != null && <span>{t('params.bpf')}: {Number(v.basePremiumFactor).toFixed(4)}</span>}
                              {v.mttrHours != null && <span>{t('params.mttr')}: {Number(v.mttrHours)}h</span>}
                              {v.minTurnover != null && <span>{t('params.min')}: {Number(v.minTurnover).toLocaleString()}</span>}
                              {v.maxTurnover != null && <span>{t('params.max')}: {Number(v.maxTurnover).toLocaleString()}</span>}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              )}
            </CardContent>
          </Card>
        ))}
      </>
    );
  };

  const renderTypeSpecificFormFields = () => {
    if (['sector', 'businessModel', 'resilienceProfile'].includes(activeTab)) {
      return (
        <div>
          <Label htmlFor="riskFactor">{t('dialog.riskFactor')}</Label>
          <Input id="riskFactor" type="number" step="0.0001" placeholder={t('dialog.riskFactorPlaceholder')} value={riskFactor} onChange={(e) => setRiskFactor(e.target.value)} className="mt-1" />
          <p className="text-xs text-muted-foreground mt-1">{t('dialog.riskFactorHint')}</p>
        </div>
      );
    }
    if (activeTab === 'turnoverBand') {
      return (
        <div className="space-y-4">
          <div>
            <Label htmlFor="riskFactor">{t('dialog.riskFactor')}</Label>
            <Input id="riskFactor" type="number" step="0.0001" placeholder={t('dialog.riskFactorPlaceholder')} value={riskFactor} onChange={(e) => setRiskFactor(e.target.value)} className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="minTurnover">{t('dialog.minTurnover')}</Label>
              <Input id="minTurnover" type="number" step="0.01" placeholder="0" value={minTurnover} onChange={(e) => setMinTurnover(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="maxTurnover">{t('dialog.maxTurnover')}</Label>
              <Input id="maxTurnover" type="number" step="0.01" placeholder="999999" value={maxTurnover} onChange={(e) => setMaxTurnover(e.target.value)} className="mt-1" />
            </div>
          </div>
        </div>
      );
    }
    if (activeTab === 'slaTier') {
      return (
        <div className="space-y-4">
          <div>
            <Label htmlFor="basePremiumFactor">{t('dialog.basePremiumFactor')}</Label>
            <Input id="basePremiumFactor" type="number" step="0.0001" placeholder={t('dialog.basePremiumFactorPlaceholder')} value={basePremiumFactor} onChange={(e) => setBasePremiumFactor(e.target.value)} className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="mttrHours">{t('dialog.mttrHours')}</Label>
              <Input id="mttrHours" type="number" step="0.1" placeholder={t('dialog.mttrHoursPlaceholder')} value={mttrHours} onChange={(e) => setMttrHours(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="thresholdHours">{t('dialog.thresholdHours')}</Label>
              <Input id="thresholdHours" type="number" step="0.1" placeholder={t('dialog.thresholdHoursPlaceholder')} value={thresholdHours} onChange={(e) => setThresholdHours(e.target.value)} className="mt-1" />
            </div>
          </div>
        </div>
      );
    }
    if (activeTab === 'securityPosture') {
      return (
        <div>
          <Label htmlFor="riskMultiplier">{t('dialog.riskMultiplier')}</Label>
          <Input id="riskMultiplier" type="number" step="0.0001" placeholder={t('dialog.riskMultiplierPlaceholder')} value={riskMultiplier} onChange={(e) => setRiskMultiplier(e.target.value)} className="mt-1" />
          <p className="text-xs text-muted-foreground mt-1">{t('dialog.riskMultiplierHint')}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <Protected roles={[Roles.ADMIN, Roles.SUPER_ADMIN]}>
      <div className="page-enter">
      <div className="flex items-center justify-between mb-6 animate-fade-in-down">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Database className="h-6 w-6 text-primary" /> {t('title')}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{t('subtitle')}</p>
        </div>
        <Button
          onClick={openCreateDialog}
          variant="tunis"
        >
          <Plus className="h-4 w-4 me-2" /> {t('newEntry')}
        </Button>
      </div>

      {error ? (
        <PageErrorState message={error} onRetry={() => fetchData(activeTab)} />
      ) : (
      <Tabs value={activeTab} onValueChange={setActiveTab} className="animate-fade-in-up">
        <TabsList className="mb-4 flex-wrap">
          {REF_TABS.map((tab) => (
            <TabsTrigger key={tab.type} value={tab.type}>{t('tabs.' + tab.type)}</TabsTrigger>
          ))}
        </TabsList>

        {REF_TABS.map((tab) => (
          <TabsContent key={tab.type} value={tab.type}>
            <Card className="shadow-md">
              <CardContent className="p-4">
                {loading ? (
                  <PageLoadingState />
                ) : (
                  <div className="space-y-2">{renderEntries()}</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
      )}

      {/* Create / Edit Version Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              {editEntry ? t('dialog.newVersionTitle', { type: t('typeLabels.' + activeTab) }) : t('dialog.createTitle', { type: t('typeLabels.' + activeTab) })}
            </DialogTitle>
            <DialogDescription>
              {editEntry
                ? t('dialog.newVersionDescription', { code })
                : t('dialog.createDescription', { type: t('typeLabels.' + activeTab) })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="code">{t('dialog.code')}</Label>
                <Input
                  id="code"
                  placeholder={t('dialog.codePlaceholder')}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="mt-1"
                  disabled={!!editEntry}
                />
              </div>
              <div>
                <Label htmlFor="name">{t('dialog.name')}</Label>
                <Input
                  id="name"
                  placeholder={t('dialog.namePlaceholder')}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="refDescription">{t('dialog.description')}</Label>
              <Input id="refDescription" placeholder={t('dialog.descriptionPlaceholder')} value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1" />
            </div>
            {renderTypeSpecificFormFields()}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>{t('common:action.cancel')}</Button>
            <Button onClick={handleSave} disabled={saving || !code || !name} variant="tunis">
              {saving ? t('dialog.saving') : editEntry ? t('dialog.createNewVersion') : t('dialog.createEntry')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </Protected>
  );
}

