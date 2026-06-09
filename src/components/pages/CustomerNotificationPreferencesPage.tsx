'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, Settings, Save, Bell, BellOff, Mail, MailOpen, Shield, DollarSign, Megaphone } from 'lucide-react';
import { fetchWithAuth } from '@/hooks/use-auth';
import { useTranslation } from 'react-i18next';
import { PageErrorState, PageLoadingState } from '@/components/shared/PageStates';

interface Preferences {
  emailNotifications: boolean;
  inAppNotifications: boolean;
  policyUpdates: boolean;
  claimUpdates: boolean;
  paymentUpdates: boolean;
  marketingEmails: boolean;
}

export default function CustomerNotificationPreferencesPage() {
  const { t } = useTranslation('common');
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchPrefs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth('/api/customer/notification-preferences');
      if (res.ok) {
        const data = await res.json();
        setPrefs(data.preferences);
      } else {
        setError(t('errors.failedToLoad', 'Failed to load preferences'));
      }
    } catch (err) {
      console.error('Failed to fetch preferences:', err);
      setError(t('errors.failedToLoad', 'Failed to load data'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPrefs(); }, [fetchPrefs]);

  const savePrefs = async () => {
    if (!prefs) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetchWithAuth('/api/customer/notification-preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
      });
      if (res.ok) {
        const data = await res.json();
        setPrefs(data.preferences);
        setMessage({ type: 'success', text: t('preferencesSaved', 'Preferences saved') });
      } else {
        setMessage({ type: 'error', text: t('failedToSave', 'Failed to save') });
      }
    } catch {
      setMessage({ type: 'error', text: t('networkError', 'Network error') });
    } finally {
      setSaving(false);
    }
  };

  const togglePref = (key: keyof Preferences) => {
    if (!prefs) return;
    setPrefs({ ...prefs, [key]: !prefs[key] });
  };

  if (loading) {
    return <PageLoadingState message={t('loadingPreferences', 'Loading preferences...')} />;
  }

  if (error || !prefs) {
    return <PageErrorState message={error || t('errors.failedToLoad', 'Failed to load preferences')} onRetry={fetchPrefs} />;
  }

  const prefItems: { key: keyof Preferences; label: string; description: string; icon: React.ReactNode }[] = [
    { key: 'emailNotifications', label: t('emailNotifications', 'Email Notifications'), description: t('receiveNotificationsViaEmail', 'Receive notifications via email'), icon: <Mail className="h-5 w-5" /> },
    { key: 'inAppNotifications', label: t('inAppNotifications', 'In-App Notifications'), description: t('showNotificationsInApp', 'Show notifications in the app'), icon: <Bell className="h-5 w-5" /> },
    { key: 'policyUpdates', label: t('policyUpdates', 'Policy Updates'), description: t('policyUpdatesDesc', 'Notifications about policy changes, renewals, and expirations'), icon: <Shield className="h-5 w-5" /> },
    { key: 'claimUpdates', label: t('claimUpdates', 'Claim Updates'), description: t('claimUpdatesDesc', 'Notifications about claim status changes and payouts'), icon: <DollarSign className="h-5 w-5" /> },
    { key: 'paymentUpdates', label: t('paymentUpdates', 'Payment Updates'), description: t('paymentUpdatesDesc', 'Notifications about payments, refunds, and billing'), icon: <DollarSign className="h-5 w-5" /> },
    { key: 'marketingEmails', label: t('marketingOffers', 'Marketing & Offers'), description: t('marketingOffersDesc', 'Promotional emails and special offers'), icon: <Megaphone className="h-5 w-5" /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('notificationPreferences', 'Notification Preferences')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('chooseHowWhenNotified', 'Choose how and when you want to be notified')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchPrefs}>
          <RefreshCw className="h-4 w-4 me-1" /> {t('action.refresh', 'Refresh')}
        </Button>
      </div>

      {message && (
        <Card className={`border ${message.type === 'success' ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
          <CardContent className="py-3 px-4">
            <span className={message.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>{message.text}</span>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings className="h-5 w-5 text-tunis-orange" /> {t('notificationChannels', 'Notification Channels')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {prefItems.map((item) => (
            <div key={item.key} className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${prefs?.[item.key] ? 'bg-tunis-orange/10 text-tunis-orange' : 'bg-muted text-muted-foreground'}`}>
                  {item.icon}
                </div>
                <div>
                  <h3 className="text-sm font-medium text-foreground">{item.label}</h3>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </div>
              </div>
              <button
                onClick={() => togglePref(item.key)}
                role="switch"
                aria-checked={!!prefs?.[item.key]}
                aria-label={item.label}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  prefs?.[item.key] ? 'bg-tunis-orange' : 'bg-muted-foreground/30'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    prefs?.[item.key] ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={savePrefs} disabled={saving} variant="tunis">
          <Save className="h-4 w-4 me-1" /> {saving ? t('saving', 'Saving...') : t('savePreferences', 'Save Preferences')}
        </Button>
      </div>
    </div>
  );
}

