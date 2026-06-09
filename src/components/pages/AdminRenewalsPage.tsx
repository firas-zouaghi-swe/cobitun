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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { RefreshCw, CheckCircle, XCircle, Info, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { fetchWithAuth, Roles } from '@/hooks/use-auth';
import Protected from '@/components/Protected';
import { PageErrorState, PageLoadingState } from '@/components/shared/PageStates';
import { FieldError, RequiredIndicator, CharCounter } from '@/components/ui/form-warning';

interface Renewal {
  id: number;
  renewalNumber: string;
  parentPolicyId: number;
  renewalTermMonths: number;
  previousPremium: number;
  newPremium: number | null;
  premiumAdjustmentReason: string | null;
  claimsCountPeriod: number;
  claimsAmountPeriod: number;
  status: string;
  quotedAt: string | null;
  acceptedAt: string | null;
  declinedAt: string | null;
  declinedReason: string | null;
  createdAt: string;
  parentPolicy?: { id: number; policyNumber: string };
}

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800/30',
  ACCEPTED: 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800/30',
  DECLINED: 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800/30',
};

export default function AdminRenewalsPage() {
  const { t } = useTranslation('adminRenewals');
  const [paramRenewals, setParamRenewals] = useState<Renewal[]>([]);
  const [cyberRenewals, setCyberRenewals] = useState<Renewal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [declineDialogOpen, setDeclineDialogOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [declineRenewalId, setDeclineRenewalId] = useState<number | null>(null);
  const [declineRenewalType, setDeclineRenewalType] = useState<'parametric' | 'cyber'>('parametric');
  const [processing, setProcessing] = useState(false);
  const [actionRenewalId, setActionRenewalId] = useState<number | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{open: boolean; title: string; description: string; onConfirm: () => void}>({open: false, title: '', description: '', onConfirm: () => {}});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const clearFieldError = (field: string) => {
    setFieldErrors(prev => {
      const next = {...prev};
      delete next[field];
      return next;
    });
  };

  const fetchRenewals = async () => {
    setError(null);
    try {
      const res = await fetchWithAuth('/api/admin/renewals/parametric');
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.error || `Request failed with status ${res.status}`);
      }
      const data = await res.json();
      setParamRenewals(data.renewals || []);
    } catch (err) {
      console.error('Failed to fetch renewals:', err);
      setError(t('errors.failedToLoad', 'Failed to load data'));
    }
  };

  const fetchCyberRenewals = async () => {
    try {
      const res = await fetchWithAuth('/api/admin/renewals/cyber');
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.error || `Request failed with status ${res.status}`);
      }
      const data = await res.json();
      setCyberRenewals(data.renewals || []);
    } catch (err) {
      console.error('Failed to fetch cyber renewals:', err);
    }
  };

  useEffect(() => {
    Promise.all([fetchRenewals(), fetchCyberRenewals()]).finally(() => setLoading(false));
  }, []);

  const handleAccept = async (id: number, type: 'parametric' | 'cyber' = 'parametric') => {
    setProcessing(true);
    setActionRenewalId(id);
    try {
      const endpoint = type === 'cyber' ? '/api/admin/renewals/cyber' : '/api/admin/renewals/parametric';
      const res = await fetchWithAuth(endpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id, status: 'ACCEPTED' }),
      });
      if (res.ok) {
        toast.success(t('toast.accepted'));
        fetchRenewals();
        fetchCyberRenewals();
      } else {
        const data = await res.json();
        toast.error(data.error || t('toast.acceptFailed'));
      }
    } catch {
      toast.error(t('toast.acceptFailed'));
    } finally {
      setProcessing(false);
      setActionRenewalId(null);
    }
  };

  const openDeclineDialog = (id: number, type: 'parametric' | 'cyber') => {
    setDeclineRenewalId(id);
    setDeclineRenewalType(type);
    setDeclineReason('');
    setFieldErrors({});
    setDeclineDialogOpen(true);
  };

  const handleDecline = async () => {
    if (!declineReason.trim()) {
      setFieldErrors({ declineReason: t('common:validation.required') });
      return;
    }
    if (!declineRenewalId) return;
    setProcessing(true);
    setActionRenewalId(declineRenewalId);
    try {
      const endpoint = declineRenewalType === 'cyber' ? '/api/admin/renewals/cyber' : '/api/admin/renewals/parametric';
      const res = await fetchWithAuth(endpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: declineRenewalId, status: 'DECLINED', declinedReason: declineReason.trim() }),
      });
      if (res.ok) {
        toast.success(t('toast.declined'));
        setDeclineDialogOpen(false);
        fetchRenewals();
        fetchCyberRenewals();
      } else {
        const data = await res.json();
        toast.error(data.error || t('toast.declineFailed'));
      }
    } catch {
      toast.error(t('toast.declineFailed'));
    } finally {
      setProcessing(false);
      setActionRenewalId(null);
    }
  };

  const renderRenewalsTable = (renewals: Renewal[], type: 'parametric' | 'cyber') => (
    <Card className="shadow-md">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">{t('table.caption.renewals', 'Renewals')}</caption>
            <thead>
              <tr className="border-b bg-muted/80">
                <th className="text-start p-3 font-medium text-muted-foreground">{t('table.renewalNumber')}</th>
                <th className="text-start p-3 font-medium text-muted-foreground">{t('table.policy')}</th>
                <th className="text-start p-3 font-medium text-muted-foreground">{t('table.termMonths')}</th>
                <th className="text-start p-3 font-medium text-muted-foreground">{t('table.previousPremium')}</th>
                <th className="text-start p-3 font-medium text-muted-foreground">{t('table.newPremium')}</th>
                <th className="text-start p-3 font-medium text-muted-foreground">{t('table.claimsInPeriod')}</th>
                <th className="text-start p-3 font-medium text-muted-foreground">{t('table.status')}</th>
                <th className="text-start p-3 font-medium text-muted-foreground">{t('table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {renewals.length === 0 ? (
                <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">
                  <RefreshCw className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  {t('empty.noRenewals', { type })}
                </td></tr>
              ) : (
                renewals.map((r) => (
                  <tr key={r.id} className="border-b table-row-hover">
                    <td className="p-3 font-mono font-semibold text-foreground">{r.renewalNumber}</td>
                    <td className="p-3 text-muted-foreground">{r.parentPolicy?.policyNumber || '—'}</td>
                    <td className="p-3 text-muted-foreground">{r.renewalTermMonths}</td>
                    <td className="p-3">{Number(r.previousPremium).toLocaleString()} {t('common:unit.tnd', 'TND')}</td>
                    <td className="p-3 font-medium">
                      {r.newPremium !== null ? (
                        <span className={Number(r.newPremium) > Number(r.previousPremium) ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}>
                          {Number(r.newPremium).toLocaleString()} {t('common:unit.tnd', 'TND')}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="p-3 text-muted-foreground">{r.claimsCountPeriod} ({Number(r.claimsAmountPeriod).toLocaleString()} {t('common:unit.tnd', 'TND')})</td>
                    <td className="p-3">
                      <Badge variant="outline" title={t('status.' + r.status)} className={STATUS_STYLES[r.status] || STATUS_STYLES.PENDING}>
                        <span className={`w-1.5 h-1.5 rounded-full me-1.5 ${r.status === 'ACCEPTED' ? 'bg-green-500' : r.status === 'DECLINED' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                        {t('status.' + r.status)}
                      </Badge>
                    </td>
                    <td className="p-3">
                      {r.status === 'PENDING' ? (
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            className="text-xs bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => setConfirmDialog({open: true, title: t('dialog.confirmAcceptTitle', 'Confirm Renewal Acceptance'), description: t('dialog.confirmAccept', 'Accepting this renewal commits the policyholder to the new premium amount. This is a financial commitment. Are you sure you want to accept?'), onConfirm: () => handleAccept(r.id, type)})}
                            disabled={processing && actionRenewalId === r.id}
                            aria-label={"Accept renewal " + r.renewalNumber}
                          >
                            <CheckCircle className="h-3 w-3 me-1" /> {processing && actionRenewalId === r.id ? t('action.processing', 'Processing...') : t('action.accept')}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="text-xs"
                            onClick={() => openDeclineDialog(r.id, type)}
                            disabled={processing && actionRenewalId === r.id}
                            aria-label={"Decline renewal " + r.renewalNumber}
                          >
                            <XCircle className="h-3 w-3 me-1" /> {t('action.decline')}
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {r.acceptedAt ? `${t('action.accepted')} ${new Date(r.acceptedAt).toLocaleDateString()}` : ''}
                          {r.declinedAt ? `${t('action.declined')} ${new Date(r.declinedAt).toLocaleDateString()}` : ''}
                        </span>
                      )}
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

  if (error) {
    return (
      <Protected roles={[Roles.ADMIN, Roles.SUPER_ADMIN]}>
        <PageErrorState message={error} onRetry={fetchRenewals} />
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
            <RefreshCw className="h-6 w-6 text-primary" /> {t('title')}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{t('subtitle')}</p>
        </div>
      </div>

      <Tabs defaultValue="parametric" className="animate-fade-in-up">
        <TabsList className="mb-4">
          <TabsTrigger value="parametric">{t('tabs.parametric')}</TabsTrigger>
          <TabsTrigger value="cyber">{t('tabs.cyber')}</TabsTrigger>
        </TabsList>

        <TabsContent value="parametric">
          {renderRenewalsTable(paramRenewals, 'parametric')}
        </TabsContent>

        <TabsContent value="cyber">
          {cyberRenewals.length === 0 && (
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
          {renderRenewalsTable(cyberRenewals, 'cyber')}
        </TabsContent>
      </Tabs>

      {/* Decline Dialog */}
      <Dialog open={declineDialogOpen} onOpenChange={setDeclineDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              {t('dialog.declineTitle')}
            </DialogTitle>
            <DialogDescription>
              {t('dialog.declineDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="declineReason">
                {t('dialog.declineReason')} <RequiredIndicator />
              </Label>
              <Input
                id="declineReason"
                placeholder={t('dialog.declineReasonPlaceholder')}
                value={declineReason}
                onChange={(e) => { setDeclineReason(e.target.value); clearFieldError('declineReason'); }}
                onBlur={() => {
                  if (!declineReason.trim()) setFieldErrors(prev => ({...prev, declineReason: t('common:validation.required') }));
                }}
                maxLength={2000}
                className="mt-1"
                aria-invalid={!!fieldErrors.declineReason}
                aria-describedby={fieldErrors.declineReason ? 'declineReason-error' : undefined}
              />
              <FieldError id="declineReason-error">{fieldErrors.declineReason}</FieldError>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeclineDialogOpen(false)}>{t('common:action.cancel')}</Button>
            <Button variant="destructive" onClick={handleDecline} disabled={processing || !declineReason.trim()}>
              {processing ? t('dialog.processing') : t('dialog.declineRenewal')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Accept Confirmation Dialog */}
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

