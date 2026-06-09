
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { RefreshCw, Settings, Cloud, Save, AlertCircle } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { fetchWithAuth } from '@/hooks/use-auth';
import Protected from '@/components/Protected';
import { Roles } from '@/hooks/use-auth';
import { toast } from 'sonner';
import { PageErrorState, PageLoadingState, PageEmptyState } from '@/components/shared/PageStates';
import { FieldError, RequiredIndicator } from '@/components/ui/form-warning';

interface IODAConfig {
  checkFrequencyMinutes: number;
  outageThresholdScore: number;
  autoDraftEnabled: boolean;
  notificationEnabled: boolean;
  iodaApiEndpoint: string;
  iodaApiKey: string | null;
}

interface Provider {
  id: number;
  name: string;
  asn: string;
}

export default function AdminIODAConfigPage() {
  const { t } = useTranslation(['adminCommon', 'common']);
  const [config, setConfig] = useState<IODAConfig | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [editForm, setEditForm] = useState<Partial<IODAConfig>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const clearFieldError = (field: string) => {
    setFieldErrors(prev => {
      const next = {...prev};
      delete next[field];
      return next;
    });
  };

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth('/api/admin/ioda/config');
      if (res.ok) {
        const data = await res.json();
        setConfig(data.config);
        setEditForm(data.config);
        setProviders(data.providers || []);
      } else {
        setError(t('iodaConfig.failedLoad', 'Failed to load IODA configuration'));
      }
    } catch (err) {
      console.error('Failed to fetch IODA config:', err);
      setError(t('iodaConfig.failedLoadData', 'Failed to load data'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const saveConfig = async () => {
    const errors: Record<string, string> = {};
    if (!editForm.checkFrequencyMinutes || editForm.checkFrequencyMinutes < 1) {
      errors.checkFrequencyMinutes = t('common:validation.number.min', { min: 1 });
    }
    if (editForm.checkFrequencyMinutes && !Number.isInteger(editForm.checkFrequencyMinutes)) {
      errors.checkFrequencyMinutes = t('common:validation.number.integer');
    }
    if (editForm.outageThresholdScore !== undefined && editForm.outageThresholdScore !== null && (editForm.outageThresholdScore < 0 || editForm.outageThresholdScore > 100)) {
      errors.outageThresholdScore = t('iodaConfig.thresholdRange', 'Threshold score must be between 0 and 100');
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetchWithAuth('/api/admin/ioda/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editForm,
          iodaApiEndpoint: (editForm.iodaApiEndpoint || '').trim(),
          iodaApiKey: editForm.iodaApiKey ? editForm.iodaApiKey.trim() : null,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setConfig(data.config);
        setMessage({ type: 'success', text: t('iodaConfig.savedSuccess', 'Configuration saved successfully') });
        toast.success(t('iodaConfig.savedSuccess', 'Configuration saved successfully'));
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error || t('iodaConfig.failedSave', 'Failed to save') });
        toast.error(data.error || t('iodaConfig.failedSaveConfig', 'Failed to save configuration'));
      }
    } catch {
      setMessage({ type: 'error', text: t('common:error.networkError', 'Network error') });
      toast.error(t('common:error.networkError', 'Network error'));
    } finally {
      setSaving(false);
    }
  };

  const updateAsn = async (providerId: number, asn: string) => {
    const trimmedAsn = asn.trim();
    try {
      const res = await fetchWithAuth('/api/admin/ioda/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cloudProviderId: providerId, asn: trimmedAsn }),
      });
      if (res.ok) {
        setMessage({ type: 'success', text: t('iodaConfig.asnUpdated', 'ASN mapping updated') });
        toast.success(t('iodaConfig.asnUpdated', 'ASN mapping updated'));
        fetchConfig();
      } else {
        toast.error(t('iodaConfig.failedAsnUpdate', 'Failed to update ASN mapping'));
      }
    } catch {
      setMessage({ type: 'error', text: t('iodaConfig.failedAsn', 'Failed to update ASN') });
      toast.error(t('common:error.networkError', 'Network error'));
    }
  };

  if (error) {
    return <Protected roles={[Roles.ADMIN, Roles.SUPER_ADMIN]}><PageErrorState message={error} onRetry={fetchConfig} /></Protected>;
  }

  if (loading) {
    return <Protected roles={[Roles.ADMIN, Roles.SUPER_ADMIN]}><PageLoadingState /></Protected>;
  }

  return (
    <Protected roles={[Roles.ADMIN, Roles.SUPER_ADMIN]}>
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('iodaConfig.title', 'IODA Configuration')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('iodaConfig.description', 'Manage IODA integration settings and provider ASN mappings')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchConfig}>
          <RefreshCw className="h-4 w-4 me-1" /> {t('common:action.refresh', 'Refresh')}
        </Button>
      </div>

      {message && (
        <Card className={`border ${message.type === 'success' ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
          <CardContent className="py-3 px-4">
            <span className={message.type === 'success' ? 'text-green-400' : 'text-red-400'}>{message.text}</span>
          </CardContent>
        </Card>
      )}

      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings className="h-5 w-5 text-tunis-orange" /> {t('iodaConfig.generalSettings', 'General Settings')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="checkFrequencyMinutes" className="text-xs text-muted-foreground mb-1 block">
                {t('iodaConfig.checkFrequency', 'Check Frequency (minutes)')} <RequiredIndicator />
              </Label>
              <Input
                id="checkFrequencyMinutes"
                type="number"
                value={editForm.checkFrequencyMinutes || ''}
                onChange={(e) => { setEditForm({ ...editForm, checkFrequencyMinutes: parseInt(e.target.value) || 15 }); clearFieldError('checkFrequencyMinutes'); }}
                onBlur={() => {
                  if (!editForm.checkFrequencyMinutes || editForm.checkFrequencyMinutes < 1) setFieldErrors(prev => ({...prev, checkFrequencyMinutes: t('common:validation.number.min', { min: 1 }) }));
                  else if (!Number.isInteger(editForm.checkFrequencyMinutes)) setFieldErrors(prev => ({...prev, checkFrequencyMinutes: t('common:validation.number.integer') }));
                }}
                min={1}
                aria-invalid={!!fieldErrors.checkFrequencyMinutes}
                aria-describedby={fieldErrors.checkFrequencyMinutes ? 'checkFrequencyMinutes-error' : undefined}
              />
              <FieldError id="checkFrequencyMinutes-error">{fieldErrors.checkFrequencyMinutes}</FieldError>
            </div>
            <div>
              <Label htmlFor="outageThresholdScore" className="text-xs text-muted-foreground mb-1 block">{t('iodaConfig.outageThreshold', 'Outage Threshold Score (0-100)')}</Label>
              <Input
                id="outageThresholdScore"
                type="number"
                value={editForm.outageThresholdScore || ''}
                onChange={(e) => setEditForm({ ...editForm, outageThresholdScore: parseInt(e.target.value) || 50 })}
              />
            </div>
            <div>
              <Label htmlFor="iodaApiEndpoint" className="text-xs text-muted-foreground mb-1 block">{t('iodaConfig.iodaApiEndpoint', 'IODA API Endpoint')}</Label>
              <Input
                id="iodaApiEndpoint"
                value={editForm.iodaApiEndpoint || ''}
                onChange={(e) => setEditForm({ ...editForm, iodaApiEndpoint: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="iodaApiKey" className="text-xs text-muted-foreground mb-1 block">{t('iodaConfig.iodaApiKey', 'IODA API Key')}</Label>
              <Input
                id="iodaApiKey"
                type="password"
                value={editForm.iodaApiKey || ''}
                onChange={(e) => setEditForm({ ...editForm, iodaApiKey: e.target.value })}
                placeholder={t('iodaConfig.enterApiKey', 'Enter new API key')}
              />
            </div>
          </div>
          <div className="flex gap-6">
            <div className="flex items-center gap-2">
              <Checkbox
                id="autoDraftEnabled"
                checked={editForm.autoDraftEnabled ?? true}
                onCheckedChange={(checked) => setEditForm({ ...editForm, autoDraftEnabled: checked as boolean })}
              />
              <Label htmlFor="autoDraftEnabled" className="text-sm text-muted-foreground cursor-pointer">{t('iodaConfig.autoDraftEnabled', 'Auto-create draft claims on outage detection')}</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="notificationEnabled"
                checked={editForm.notificationEnabled ?? true}
                onCheckedChange={(checked) => setEditForm({ ...editForm, notificationEnabled: checked as boolean })}
              />
              <Label htmlFor="notificationEnabled" className="text-sm text-muted-foreground cursor-pointer">{t('iodaConfig.notificationEnabled', 'Send notifications on detection')}</Label>
            </div>
          </div>
          <Button onClick={saveConfig} disabled={saving} variant="tunis">
            <Save className="h-4 w-4 me-1" /> {saving ? t('iodaConfig.saving', 'Saving...') : t('iodaConfig.saveConfiguration', 'Save Configuration')}
          </Button>
        </CardContent>
      </Card>

      {/* Provider ASN Mappings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Cloud className="h-5 w-5 text-tunis-orange" /> {t('iodaConfig.providerAsnMappings', 'Provider ASN Mappings')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {providers.map((provider) => (
              <div key={provider.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border">
                <div className="flex-1">
                  <span className="text-sm font-medium text-foreground">{provider.name}</span>
                </div>
                <div className="w-48">
                  <Input
                    value={provider.asn || ''}
                    placeholder={t('iodaConfig.asnPlaceholder', 'e.g. AS16509')}
                    onChange={(e) => {
                      setProviders((prev) =>
                        prev.map((p) => p.id === provider.id ? { ...p, asn: e.target.value } : p)
                      );
                    }}
                    className="text-sm h-8"
                  />
                </div>
                <Button size="sm" variant="outline" onClick={() => updateAsn(provider.id, provider.asn)}>
                  <Save className="h-3 w-3 me-1" /> {t('common:action.save', 'Save')}
                </Button>
              </div>
            ))}
            {providers.length === 0 && (
              <PageEmptyState
                icon={<Cloud className="h-8 w-8 text-muted-foreground" />}
                title={t('iodaConfig.noProviders', 'No cloud providers configured')}
                description={t('iodaConfig.noProvidersDesc', 'No cloud providers have been set up for ASN mapping yet.')}
              />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
    </Protected>
  );
}

