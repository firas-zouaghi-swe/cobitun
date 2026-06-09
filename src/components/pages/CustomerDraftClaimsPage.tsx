
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RefreshCw, CheckCircle, XCircle, AlertTriangle, Clock, Cloud, FileText } from 'lucide-react';
import { fetchWithAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { PageErrorState, PageEmptyState, PageLoadingState } from '@/components/shared/PageStates';
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

interface DraftClaim {
  id: number;
  claimNumber: string;
  status: string;
  providerName: string;
  outageStartTime: string;
  outageEndTime: string | null;
  description: string;
  exposureScore: number | null;
  isIodaDetected: number;
  createdAt: string;
  parametricPolicyId: number;
}

export default function CustomerDraftClaimsPage() {
  const { t } = useTranslation('common');
  const [draftClaims, setDraftClaims] = useState<DraftClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{open: boolean; title: string; description: string; onConfirm: () => void}>({open: false, title: '', description: '', onConfirm: () => {}});

  const fetchDraftClaims = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth('/api/customer/claims?status=DRAFT');
      if (res.ok) {
        const data = await res.json();
        setDraftClaims(data.claims || []);
      } else {
        setError(t('errors.failedToLoad', 'Failed to load draft claims. Please try again.'));
      }
    } catch (err) {
      console.error('Failed to fetch draft claims:', err);
      setError(t('errors.failedToLoad', 'Failed to load draft claims. Please try again.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDraftClaims(); }, [fetchDraftClaims]);

  const confirmDraft = async (claimId: number) => {
    setActionLoading(claimId);
    try {
      const res = await fetchWithAuth(`/api/customer/claims/${claimId}/confirm-draft`, {
        method: 'POST',
      });
      if (res.ok) {
        setDraftClaims((prev) => prev.filter((c) => c.id !== claimId));
        toast.success(t('draftClaimConfirmedAndFiled', 'Draft claim confirmed and filed'));
      } else {
        const data = await res.json();
        toast.error(data.error || t('failedToConfirmClaim', 'Failed to confirm claim'));
      }
    } catch (err) {
      toast.error(t('networkError', 'Network error'));
    } finally {
      setActionLoading(null);
    }
  };

  const performDismissDraft = async (claimId: number) => {
    setActionLoading(claimId);
    try {
      const res = await fetchWithAuth(`/api/customer/claims/${claimId}/confirm-draft`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setDraftClaims((prev) => prev.filter((c) => c.id !== claimId));
        toast.success(t('draftClaimDismissed', 'Draft claim dismissed'));
      } else {
        toast.error(t('failedToDismissDraftClaim', 'Failed to dismiss draft claim'));
      }
    } catch (err) {
      toast.error(t('networkError', 'Network error'));
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('draftClaims', 'Draft Claims')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('iodaDetectedOutagesRequiringConfirmation', 'IODA-detected outages requiring your confirmation')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchDraftClaims} aria-label={t('refresh', 'Refresh')}>
          <RefreshCw className="h-4 w-4 me-1" /> {t('refresh', 'Refresh')}
        </Button>
      </div>

      {draftClaims.length > 0 && (
        <Card className="bg-yellow-500/5 border-yellow-500/20">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-400" />
              <span className="text-sm text-yellow-700 dark:text-yellow-200">
                {t('youHaveDraftClaimsRequiringAction', 'You have {{count}} draft claim(s) requiring action.', { count: draftClaims.length })}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <ScrollArea className="h-[calc(100vh-240px)]">
        {error ? (
          <PageErrorState message={error} onRetry={fetchDraftClaims} />
        ) : loading ? (
          <PageLoadingState message={t('loadingDraftClaims', 'Loading draft claims...')} />
        ) : draftClaims.length === 0 ? (
          <PageEmptyState
            icon={<FileText className="h-8 w-8 text-muted-foreground" />}
            title={t('noDraftClaims', 'No draft claims')}
            description={t('iodaOutagesWillAppearHere', 'IODA-detected outages will appear here for your confirmation')}
          />
        ) : (
          <div className="space-y-4">
            {draftClaims.map((claim) => (
              <Card key={claim.id} className="border-l-2 border-l-yellow-500">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Cloud className="h-5 w-5 text-yellow-400" />
                      {claim.providerName} {t('outage', 'Outage')}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-yellow-500/10 text-yellow-400 border-yellow-500/20" title={t('draft', 'DRAFT')}>
                        <Clock className="h-3 w-3 me-1" /> {t('draft', 'DRAFT')}
                      </Badge>
                      {claim.isIodaDetected && (
                        <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-[10px]" title={t('iodaDetected', 'IODA Detected')}>{t('iodaDetected', 'IODA Detected')}</Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">{claim.description}</p>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-muted-foreground">{t('claimNumber', 'Claim #:')}</span>
                        <span className="text-foreground ms-1">{claim.claimNumber}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">{t('provider', 'Provider:')}</span>
                        <span className="text-foreground ms-1">{claim.providerName}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">{t('outageStart', 'Outage Start:')}</span>
                        <span className="text-foreground ms-1">{new Date(claim.outageStartTime).toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">{t('outageEnd', 'Outage End:')}</span>
                        <span className="text-foreground ms-1">{claim.outageEndTime ? new Date(claim.outageEndTime).toLocaleString() : t('ongoing', 'Ongoing')}</span>
                      </div>
                      {claim.exposureScore !== null && (
                        <div>
                          <span className="text-muted-foreground">{t('exposureScore', 'Exposure Score:')}</span>
                          <span className="text-foreground ms-1">{claim.exposureScore}/100</span>
                        </div>
                      )}
                      <div>
                        <span className="text-muted-foreground">{t('detected', 'Detected:')}</span>
                        <span className="text-foreground ms-1">{new Date(claim.createdAt).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        variant="tunis"
                        onClick={() => setConfirmDialog({open: true, title: t('confirmFileClaimTitle', 'Confirm & File Claim'), description: t('confirmFileClaim', 'By filing this claim, you are making a legally binding declaration that the reported outage occurred as detected. Filing a fraudulent claim may result in policy cancellation and legal action. Are you sure you want to proceed?'), onConfirm: () => confirmDraft(claim.id)})}
                        disabled={actionLoading === claim.id}
                      >
                        <CheckCircle className="h-4 w-4 me-1" />
                        {actionLoading === claim.id ? t('confirming', 'Confirming...') : t('confirmAndFileClaim', 'Confirm & File Claim')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-400 border-red-500/30 hover:bg-red-500/10"
                        onClick={() => setConfirmDialog({open: true, title: t('confirmDismissDraftClaimTitle', 'Dismiss Draft Claim'), description: t('confirmDismissDraftClaim', 'Are you sure you want to dismiss this draft claim?'), onConfirm: () => performDismissDraft(claim.id)})}
                        disabled={actionLoading === claim.id}
                      >
                        <XCircle className="h-4 w-4 me-1" /> {t('dismiss', 'Dismiss')}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>

      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog(prev => ({...prev, open}))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDialog.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDialog.onConfirm}>{t('confirm', 'Confirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

