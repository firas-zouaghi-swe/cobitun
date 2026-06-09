'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Cloud, Plus, Shield, Search as SearchIcon, CheckCircle, XCircle, RefreshCw, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import Protected from '@/components/Protected';
import { fetchWithAuth, Roles } from '@/hooks/use-auth';
import { PageLoadingState, PageErrorState } from '@/components/shared/PageStates';
import { FieldError, RequiredIndicator } from '@/components/ui/form-warning';
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

interface ProviderRow {
  id: number;
  asn: string;
  organisationName: string;
  iodaName: string;
  ipCount: number;
  slaTier: { tierCode: string; tierName: string } | string;
  slaTierId: number;
  mttrHours: number;
  ancsCertified: boolean;
  governmental: boolean;
  isActive: boolean;
  _count?: { outageEvents: number; policies: number };
}

const TIER_STYLES: Record<string, { badge: string; dot: string }> = {
  Platinum: { badge: 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/30', dot: 'bg-purple-500 dark:bg-purple-400' },
  Gold: { badge: 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800/30', dot: 'bg-yellow-500 dark:bg-yellow-400' },
  Silver: { badge: 'bg-gray-50 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-800/30', dot: 'bg-gray-400 dark:bg-gray-500' },
  Bronze: { badge: 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/30', dot: 'bg-amber-500 dark:bg-amber-400' },
};

function formatLocaleNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = typeof value === 'string' ? Number(value) : value;
  return typeof numeric === 'number' && !Number.isNaN(numeric) ? numeric.toLocaleString() : null;
}

export default function AdminCloudProvidersPage() {
  const { t } = useTranslation(['adminCommon', 'common']);
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{open: boolean; title: string; description: string; onConfirm: () => void}>({open: false, title: '', description: '', onConfirm: () => {}});
  const [verifyResult, setVerifyResult] = useState<{ found: boolean; name?: string } | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [slaTiers, setSlaTiers] = useState<{ id: number; tierCode: string; tierName: string }[]>([]);

  const clearFieldError = (field: string) => {
    setFieldErrors(prev => {
      const next = {...prev};
      delete next[field];
      return next;
    });
  };

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(value);
    }, 300);
  };

  // Form state
  const [asn, setAsn] = useState('');
  const [name, setName] = useState('');
  const [iodaName, setIodaName] = useState('');
  const [slaTierId, setSlaTierId] = useState('');
  const [ancsCertified, setAncsCertified] = useState(false);
  const [governmental, setGovernmental] = useState(false);

  const fetchProviders = useCallback(async () => {
    setError(null);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) {
        params.set('search', debouncedSearch);
      }
      const res = await fetchWithAuth(`/api/admin/cloud-providers?${params.toString()}`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.error || `Request failed with status ${res.status}`);
      }
      const data = await res.json();
      setProviders(data.providers || []);
    } catch (err) {
      console.error('Failed to fetch providers:', err);
      setError(t('errors.failedToLoad', 'Failed to load data'));
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch]);

  // Fetch SLA tiers for dynamic dropdown
  const fetchSlaTiers = useCallback(async () => {
    try {
      const res = await fetchWithAuth('/api/admin/reference/slaTier');
      if (res.ok) {
        const data = await res.json();
        setSlaTiers(data.entries || []);
      }
    } catch {
      // SLA tiers fetch failed; fall back to hardcoded defaults
      console.warn('Failed to fetch SLA tiers, using defaults');
    }
  }, []);

  useEffect(() => {
    fetchProviders();
    fetchSlaTiers();
  }, [fetchProviders, fetchSlaTiers]);

  const handleVerifyAsn = async () => {
    if (!asn) {
      toast.error(t('adminCommon:cloudProviders.enterAsn'));
      return;
    }
    setVerifying(true);
    setVerifyResult(null);
    try {
      const res = await fetchWithAuth(`/api/admin/verify-asn?asn=${asn}`);
      const data = await res.json();
      setVerifyResult(data);
      if (data.found) {
        toast.success(t('adminCommon:cloudProviders.asnFound', { asn, name: data.name }));
      } else {
        toast.warning(t('adminCommon:cloudProviders.asnNotFound', { asn }));
      }
    } catch {
      toast.error(t('adminCommon:cloudProviders.verifyFailed'));
    } finally {
      setVerifying(false);
    }
  };

  const handleSave = async () => {
    const errors: Record<string, string> = {};
    if (!asn.trim()) {
      errors.asn = t('common:validation.required');
    } else {
      const asnNum = Number(asn);
      if (isNaN(asnNum) || asnNum <= 0 || !Number.isInteger(asnNum)) {
        errors.asn = t('common:validation.number.positive');
      }
    }
    if (!name.trim()) {
      errors.name = t('common:validation.required');
    }
    if (!slaTierId) {
      errors.slaTierId = t('common:validation.select.required');
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setSaving(true);
    try {
      if (editMode && editId) {
        // Update existing provider
        const res = await fetchWithAuth('/api/admin/cloud-providers', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editId,
            organisationName: name.trim(),
            slaTierId: Number(slaTierId),
            ancsCertified,
            governmental,
            iodaName: iodaName.trim(),
          }),
        });
        if (res.ok) {
          toast.success(t('adminCommon:cloudProviders.updated'));
        } else {
          const data = await res.json();
          toast.error(data.error || t('adminCommon:updateFailed'));
        }
      } else {
        // Create new provider
        const res = await fetchWithAuth('/api/admin/cloud-providers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            asn: asn.trim(),
            organisationName: name.trim(),
            slaTierId: Number(slaTierId),
            ancsCertified,
            governmental,
            iodaName: iodaName.trim(),
          }),
        });
        if (res.ok) {
          toast.success(t('adminCommon:cloudProviders.added'));
        } else {
          const data = await res.json();
          toast.error(data.error || t('adminCommon:createFailed'));
        }
      }
      setDialogOpen(false);
      resetForm();
      fetchProviders();
    } catch {
      toast.error(t('adminCommon:actionFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (provider: ProviderRow) => {
    setEditMode(true);
    setEditId(provider.id);
    setAsn(provider.asn);
    setName(provider.organisationName);
    setIodaName(provider.iodaName || '');
    setSlaTierId(String(provider.slaTierId || ''));
    setAncsCertified(provider.ancsCertified);
    setGovernmental(provider.governmental);
    setVerifyResult(null);
    setDialogOpen(true);
  };

  const performDelete = async (provider: ProviderRow) => {
    setDeletingId(provider.id);
    try {
      const res = await fetchWithAuth(`/api/admin/cloud-providers?id=${provider.id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success(t('adminCommon:cloudProviders.deleted'));
        fetchProviders();
      } else {
        const data = await res.json();
        toast.error(data.error || t('adminCommon:deleteFailed'));
      }
    } catch {
      toast.error(t('adminCommon:deleteFailed'));
    } finally {
      setDeletingId(null);
    }
  };

  const toggleActive = async (provider: ProviderRow) => {
    try {
      const res = await fetchWithAuth('/api/admin/cloud-providers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: provider.id, isActive: !provider.isActive }),
      });
      if (res.ok) {
        toast.success(t('adminCommon:cloudProviders.activated', { status: provider.isActive ? t('adminCommon:cloudProviders.deactivated') : t('adminCommon:cloudProviders.activatedLabel') }));
        fetchProviders();
      } else {
        toast.error(t('adminCommon:updateFailed'));
      }
    } catch {
      toast.error(t('adminCommon:updateFailed'));
    }
  };

  const resetForm = () => {
    setEditMode(false);
    setEditId(null);
    setAsn('');
    setName('');
    setIodaName('');
    setSlaTierId('');
    setAncsCertified(false);
    setGovernmental(false);
    setVerifyResult(null);
    setFieldErrors({});
  };

  const openAddDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  if (error) {
    return (
      <Protected roles={[Roles.ADMIN, Roles.SUPER_ADMIN]}>
        <PageErrorState message={error} onRetry={fetchProviders} />
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
            <Cloud className="h-6 w-6 text-primary" /> {t('adminCommon:cloudProviders.title')}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{t('adminCommon:cloudProviders.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={openAddDialog}
            variant="tunis"
          >
            <Plus className="h-4 w-4 me-2" /> {t('adminCommon:cloudProviders.addProvider')}
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <SearchIcon className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="ps-9"
            placeholder={t('common:placeholder.search')}
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>
        {searchTerm && (
          <Button variant="ghost" size="sm" onClick={() => { setSearchTerm(''); setDebouncedSearch(''); }}>
            <X className="h-4 w-4 me-1" /> {t('common:action.clear')}
          </Button>
        )}
      </div>

      <Card className="shadow-md animate-fade-in-up">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">{t('adminCommon:cloudProviders.title')}</caption>
              <thead>
                <tr className="border-b bg-muted/80">
                  <th className="text-start p-3 font-medium text-muted-foreground">{t('adminCommon:cloudProviders.asn')}</th>
                  <th className="text-start p-3 font-medium text-muted-foreground">{t('adminCommon:cloudProviders.organisation')}</th>
                  <th className="text-start p-3 font-medium text-muted-foreground">{t('adminCommon:cloudProviders.iodaName')}</th>
                  <th className="text-start p-3 font-medium text-muted-foreground">{t('adminCommon:cloudProviders.ipCount')}</th>
                  <th className="text-start p-3 font-medium text-muted-foreground">{t('adminCommon:cloudProviders.slaTier')}</th>
                  <th className="text-start p-3 font-medium text-muted-foreground">{t('adminCommon:cloudProviders.mttr')}</th>
                  <th className="text-start p-3 font-medium text-muted-foreground">{t('adminCommon:cloudProviders.flags')}</th>
                  <th className="text-start p-3 font-medium text-muted-foreground">{t('adminCommon:cloudProviders.outages')}</th>
                  <th className="text-start p-3 font-medium text-muted-foreground">{t('adminCommon:cloudProviders.policies')}</th>
                  <th className="text-start p-3 font-medium text-muted-foreground">{t('common:label.status')}</th>
                  <th className="text-start p-3 font-medium text-muted-foreground">{t('common:label.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {providers.length === 0 ? (
                  <tr><td colSpan={11} className="p-8 text-center text-muted-foreground">
                    <Cloud className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    {t('adminCommon:cloudProviders.noProviders')}
                  </td></tr>
                ) : (
                  providers.map((p) => {
                    const tierName = typeof p.slaTier === 'object' ? p.slaTier.tierName : p.slaTier;
                    const tierStyle = TIER_STYLES[tierName] || TIER_STYLES.Bronze;
                    return (
                      <tr key={p.id} className="border-b table-row-hover">
                        <td className="p-3 font-mono font-semibold text-foreground">AS{p.asn}</td>
                        <td className="p-3 font-medium">{p.organisationName}</td>
                        <td className="p-3 text-muted-foreground text-xs font-mono">{p.iodaName || '—'}</td>
                        <td className="p-3 text-muted-foreground">{formatLocaleNumber(p.ipCount) ?? '—'}</td>
                        <td className="p-3">
                          <Badge variant="outline" title={typeof p.slaTier === 'object' ? p.slaTier.tierName : p.slaTier} className={tierStyle.badge}>
                            <span className={`w-1.5 h-1.5 rounded-full ${tierStyle.dot} me-1.5`} />
                            <Shield className="h-3 w-3 me-1" /> {typeof p.slaTier === 'object' ? p.slaTier.tierName : p.slaTier}
                          </Badge>
                        </td>
                        <td className="p-3 text-muted-foreground">{p.mttrHours}h</td>
                        <td className="p-3">
                          <div className="flex gap-1">
                            {p.ancsCertified && (
                              <Badge variant="outline" title={t('adminCommon:cloudProviders.ancsCertified', 'ANCS Certified')} className="bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800/30 text-[10px] px-1.5">ANCS</Badge>
                            )}
                            {p.governmental && (
                              <Badge variant="outline" title={t('adminCommon:cloudProviders.governmental')} className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/30 text-[10px] px-1.5">Gov</Badge>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-muted-foreground">{p._count?.outageEvents || 0}</td>
                        <td className="p-3 text-muted-foreground">{p._count?.policies || 0}</td>
                        <td className="p-3">
                          <Badge variant="outline" title={p.isActive ? t('common:status.active') : t('common:status.inactive')} className={p.isActive ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800/30' : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800/30'}>
                            <span className={`w-1.5 h-1.5 rounded-full ${p.isActive ? 'bg-green-500' : 'bg-red-500'} me-1.5`} />
                            {p.isActive ? t('common:status.active') : t('common:status.inactive')}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" className="text-xs" onClick={() => handleEdit(p)} aria-label={"Edit " + p.organisationName}>{t('common:action.edit')}</Button>
                            <Button
                              size="sm"
                              variant={p.isActive ? 'destructive' : 'default'}
                              className={`text-xs ${!p.isActive ? 'bg-primary hover:bg-primary/90' : ''}`}
                              onClick={() => setConfirmDialog({open: true, title: t('adminCommon:cloudProviders.confirmToggleTitle', 'Confirm Status Change'), description: t('adminCommon:cloudProviders.confirmToggle', 'Are you sure you want to {{action}} {{name}} (AS{{asn}})? This may affect existing policies and claims.', { action: p.isActive ? t('adminCommon:cloudProviders.deactivate') : t('adminCommon:cloudProviders.activate'), name: p.organisationName, asn: p.asn }), onConfirm: () => toggleActive(p)})}
                              aria-label={(p.isActive ? 'Deactivate ' : 'Activate ') + p.organisationName}
                            >
                              {p.isActive ? t('adminCommon:cloudProviders.off') : t('adminCommon:cloudProviders.on')}
                            </Button>
                            <Button size="sm" variant="ghost" className="text-xs text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30" onClick={() => setConfirmDialog({open: true, title: t('adminCommon:cloudProviders.confirmDeleteTitle', 'Confirm Delete'), description: t('adminCommon:cloudProviders.confirmDelete', 'Are you sure you want to delete {{name}} (AS{{asn}})? This action cannot be undone.', { name: p.organisationName, asn: p.asn }), onConfirm: () => performDelete(p)})} disabled={deletingId === p.id} aria-label={"Delete " + p.organisationName}>
                              {deletingId === p.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : t('adminCommon:cloudProviders.del')}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Provider Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Cloud className="h-5 w-5 text-primary" />
              {editMode ? t('adminCommon:cloudProviders.editProvider') : t('adminCommon:cloudProviders.addProvider')}
            </DialogTitle>
            <DialogDescription>
              {editMode ? t('adminCommon:cloudProviders.editProviderDesc') : t('adminCommon:cloudProviders.addProviderDesc')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="asn">
                {t('adminCommon:cloudProviders.asnLabel')} <RequiredIndicator />
              </Label>
              <div className="flex gap-2 mt-1">
                <Input
                  id="asn"
                  type="number"
                  placeholder={t('adminCommon:cloudProviders.asnPlaceholder')}
                  value={asn}
                  onChange={(e) => { setAsn(e.target.value); setVerifyResult(null); clearFieldError('asn'); }}
                  onBlur={() => {
                    if (!asn.trim()) setFieldErrors(prev => ({...prev, asn: t('common:validation.required') }));
                    else {
                      const asnNum = Number(asn);
                      if (isNaN(asnNum) || asnNum <= 0 || !Number.isInteger(asnNum)) setFieldErrors(prev => ({...prev, asn: t('common:validation.number.positive') }));
                    }
                  }}
                  disabled={editMode}
                  className="focus-ring"
                  aria-invalid={!!fieldErrors.asn}
                  aria-describedby={fieldErrors.asn ? 'asn-error' : undefined}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleVerifyAsn}
                  disabled={verifying || !asn || editMode}
                  className="shrink-0 transition-all"
                >
                  {verifying ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  {t('adminCommon:cloudProviders.verify')}
                </Button>
              </div>
              <FieldError id="asn-error">{fieldErrors.asn}</FieldError>
              {verifyResult && (
                <div className={`mt-2 p-2 rounded-lg text-xs ${verifyResult.found ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800/30' : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/30'}`}>
                  {verifyResult.found ? (
                    <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3" /> {t('adminCommon:cloudProviders.foundInIoda', { name: verifyResult.name })}</span>
                  ) : (
                    <span className="flex items-center gap-1"><XCircle className="h-3 w-3" /> {t('adminCommon:cloudProviders.asnNotFoundInIoda')}</span>
                  )}
                </div>
              )}
            </div>
            <div>
              <Label htmlFor="name">
                {t('adminCommon:cloudProviders.orgNameLabel')} <RequiredIndicator />
              </Label>
              <Input
                id="name"
                placeholder={t('adminCommon:cloudProviders.orgNamePlaceholder')}
                value={name}
                onChange={(e) => { setName(e.target.value); clearFieldError('name'); }}
                onBlur={() => {
                  if (!name.trim()) setFieldErrors(prev => ({...prev, name: t('common:validation.required') }));
                }}
                maxLength={255}
                className="mt-1 focus-ring"
                aria-invalid={!!fieldErrors.name}
                aria-describedby={fieldErrors.name ? 'name-error' : undefined}
              />
              <FieldError id="name-error">{fieldErrors.name}</FieldError>
            </div>
            <div>
              <Label htmlFor="iodaName">{t('adminCommon:cloudProviders.iodaNameLabel')}</Label>
              <Input
                id="iodaName"
                placeholder={t('adminCommon:cloudProviders.iodaNamePlaceholder')}
                value={iodaName}
                onChange={(e) => setIodaName(e.target.value)}
                className="mt-1 focus-ring"
              />
            </div>
            <div>
              <Label htmlFor="slaTier">
                {t('adminCommon:cloudProviders.slaTierLabel')} <RequiredIndicator />
              </Label>
              <Select value={slaTierId} onValueChange={(v) => { setSlaTierId(v); clearFieldError('slaTierId'); }}>
                <SelectTrigger id="slaTier" className="mt-1 focus-ring" aria-invalid={!!fieldErrors.slaTierId} aria-describedby={fieldErrors.slaTierId ? 'slaTierId-error' : undefined}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {slaTiers.length > 0 ? (
                    slaTiers.map((tier) => (
                      <SelectItem key={tier.id} value={String(tier.id)}>{tier.tierName}</SelectItem>
                    ))
                  ) : (
                    <>
                      {/* TODO: These hardcoded tier IDs should be replaced once SLA tiers are fetched dynamically */}
                      <SelectItem value="1">{t('common:tier.platinum')}</SelectItem>
                      <SelectItem value="2">{t('common:tier.gold')}</SelectItem>
                      <SelectItem value="3">{t('common:tier.silver')}</SelectItem>
                      <SelectItem value="4">{t('common:tier.bronze')}</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
              <FieldError id="slaTierId-error">{fieldErrors.slaTierId}</FieldError>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="ancs"
                  checked={ancsCertified}
                  onCheckedChange={(checked) => setAncsCertified(checked as boolean)}
                />
                <Label htmlFor="ancs" className="text-sm">{t('adminCommon:cloudProviders.ancsCertified')}</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="gov"
                  checked={governmental}
                  onCheckedChange={(checked) => setGovernmental(checked as boolean)}
                />
                <Label htmlFor="gov" className="text-sm">{t('adminCommon:cloudProviders.governmental')}</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }} className="transition-all">{t('common:action.cancel')}</Button>
            <Button onClick={handleSave} disabled={saving} variant="tunis">
              {saving ? t('adminCommon:cloudProviders.saving') : editMode ? t('adminCommon:cloudProviders.saveChanges') : t('adminCommon:cloudProviders.addProvider')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

