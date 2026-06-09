
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import { RefreshCw, DollarSign, Plus, CheckCircle, XCircle, Clock, ArrowDownLeft } from 'lucide-react';
import { fetchWithAuth } from '@/hooks/use-auth';
import Protected from '@/components/Protected';
import { Roles } from '@/hooks/use-auth';
import { toast } from 'sonner';
import { PageErrorState, PageLoadingState, PageEmptyState } from '@/components/shared/PageStates';
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

interface Refund {
  id: number;
  policyId: number;
  amount: number;
  status: string;
  reason: string;
  createdAt: string;
  processedAt: string | null;
}

export default function AdminRefundsPage() {
  const { t } = useTranslation(['adminCommon', 'common']);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createForm, setCreateForm] = useState({ policyId: '', amount: '', reason: 'CANCELLATION' as string, notes: '' });
  const [createError, setCreateError] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [confirmDialog, setConfirmDialog] = useState<{open: boolean; title: string; description: string; onConfirm: () => void}>({open: false, title: '', description: '', onConfirm: () => {}});

  const fetchRefunds = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
      const res = await fetchWithAuth(`/api/admin/refunds${params}`);
      if (res.ok) {
        const data = await res.json();
        setRefunds(data.refunds || []);
      } else {
        setError(t('refunds.failedLoad', 'Failed to load refunds'));
      }
    } catch (err) {
      console.error('Failed to fetch refunds:', err);
      setError(t('refunds.failedLoadData', 'Failed to load data'));
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchRefunds(); }, [fetchRefunds]);

  const handleCreate = async () => {
    setCreateError('');
    try {
      const res = await fetchWithAuth('/api/admin/refunds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          policyId: parseInt(createForm.policyId),
          amount: createForm.amount ? parseFloat(createForm.amount) : undefined,
          reason: createForm.reason,
          notes: createForm.notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowCreateDialog(false);
        setCreateForm({ policyId: '', amount: '', reason: 'CANCELLATION', notes: '' });
        fetchRefunds();
        toast.success(t('refunds.createdSuccess', 'Refund created successfully'));
      } else {
        setCreateError(data.error || t('refunds.createFailed', 'Failed to create refund'));
      }
    } catch {
      setCreateError(t('common:error.networkError', 'Network error'));
      toast.error(t('common:error.networkError', 'Network error'));
    }
  };

  const performUpdateStatus = async (refundId: number, status: 'COMPLETED' | 'FAILED') => {
    try {
      const res = await fetchWithAuth(`/api/admin/refunds?refundId=${refundId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        fetchRefunds();
        toast.success(t('refunds.markedAs', 'Refund marked as {{status}}', { status: status.toLowerCase() }));
      } else {
        toast.error(t('refunds.failedUpdateStatus', 'Failed to update refund status'));
      }
    } catch (err) {
      console.error('Failed to update refund:', err);
      toast.error(t('common:error.networkError', 'Network error'));
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING': return <Badge title={t('common:status.pending', 'Pending')} className="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20"><Clock className="h-3 w-3 me-1" /> {t('common:status.pending', 'Pending')}</Badge>;
      case 'COMPLETED': return <Badge title={t('common:status.completed', 'Completed')} className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20"><CheckCircle className="h-3 w-3 me-1" /> {t('common:status.completed', 'Completed')}</Badge>;
      case 'FAILED': return <Badge title={t('refunds.failed', 'Failed')} className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"><XCircle className="h-3 w-3 me-1" /> {t('refunds.failed', 'Failed')}</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Protected roles={[Roles.ADMIN, Roles.SUPER_ADMIN]}>
    {error ? (
      <PageErrorState message={error} onRetry={fetchRefunds} />
    ) : (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('refunds.title', 'Refunds')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('refunds.description', 'Manage policy refund transactions')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchRefunds}>
            <RefreshCw className="h-4 w-4 me-1" /> {t('common:action.refresh', 'Refresh')}
          </Button>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button size="sm" variant="tunis" className="bg-tunis-orange hover:bg-tunis-orange/90">
                <Plus className="h-4 w-4 me-1" /> {t('refunds.createRefund', 'Create Refund')}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t('refunds.createRefund', 'Create Refund')}</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4">
                {createError && <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-600 dark:text-red-400">{createError}</div>}
                <div>
                  <Label htmlFor="refundPolicyId" className="text-xs text-muted-foreground mb-1 block">{t('refunds.policyId', 'Policy ID')}</Label>
                  <Input id="refundPolicyId" type="number" value={createForm.policyId} onChange={(e) => setCreateForm({ ...createForm, policyId: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="refundAmount" className="text-xs text-muted-foreground mb-1 block">{t('refunds.amountTnd', 'Amount (TND) - leave empty for prorated')}</Label>
                  <Input id="refundAmount" type="number" value={createForm.amount} onChange={(e) => setCreateForm({ ...createForm, amount: e.target.value })} placeholder={t('refunds.autoCalculated', 'Auto-calculated if empty')} />
                </div>
                <div>
                  <Label htmlFor="refundReason" className="text-xs text-muted-foreground mb-1 block">{t('refunds.reason', 'Reason')}</Label>
                  <Select value={createForm.reason} onValueChange={(v) => setCreateForm({ ...createForm, reason: v })}>
                    <SelectTrigger id="refundReason">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CANCELLATION">{t('refunds.cancellation', 'Cancellation')}</SelectItem>
                      <SelectItem value="OVERPAYMENT">{t('refunds.overpayment', 'Overpayment')}</SelectItem>
                      <SelectItem value="ADMIN_ADJUSTMENT">{t('refunds.adminAdjustment', 'Admin Adjustment')}</SelectItem>
                      <SelectItem value="PARTIAL_CLAIM">{t('refunds.partialClaim', 'Partial Claim')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="refundNotes" className="text-xs text-muted-foreground mb-1 block">{t('refunds.notes', 'Notes')}</Label>
                  <Input id="refundNotes" value={createForm.notes} onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })} />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild><Button variant="outline">{t('common:action.cancel', 'Cancel')}</Button></DialogClose>
                <Button onClick={() => setConfirmDialog({open: true, title: t('refunds.confirmCreateTitle', 'Confirm Refund Creation'), description: t('refunds.confirmCreate', 'Creating a refund will initiate a financial transaction. This action cannot be easily reversed. Are you sure you want to proceed?'), onConfirm: handleCreate})} variant="tunis" className="bg-tunis-orange hover:bg-tunis-orange/90">{t('common:action.submit', 'Create')}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex gap-2">
            {['all', 'PENDING', 'COMPLETED', 'FAILED'].map((s) => (
              <Button key={s} variant={statusFilter === s ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter(s)}>
                {s === 'all' ? t('refunds.all', 'All') : s}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <ArrowDownLeft className="h-5 w-5 text-tunis-orange" /> {t('refunds.title', 'Refunds')} ({refunds.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <PageLoadingState />
          ) : (
            <ScrollArea className="h-[calc(100vh-380px)]">
              <div className="space-y-2">
                {refunds.map((r) => (
                  <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 border border-border">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                        <DollarSign className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">{r.amount} {t('common:unit.tnd', 'TND')}</span>
                          {getStatusBadge(r.status)}
                        </div>
                        <p className="text-xs text-muted-foreground">{t('refunds.policy', 'Policy')} #{r.policyId} · {r.reason}</p>
                        <p className="text-[11px] text-muted-foreground">{t('refunds.created', 'Created')}: {new Date(r.createdAt).toLocaleString()} {r.processedAt && `· ${t('refunds.processed', 'Processed')}: ${new Date(r.processedAt).toLocaleString()}`}</p>
                      </div>
                    </div>
                    {r.status === 'PENDING' && (
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" className="text-green-600 dark:text-green-400 border-green-500/30 hover:bg-green-500/10" onClick={() => setConfirmDialog({open: true, title: t('refunds.confirmStatusTitle', 'Confirm Status Change'), description: t('refunds.confirmStatusChange', 'Are you sure you want to mark this refund as completed?'), onConfirm: () => performUpdateStatus(r.id, 'COMPLETED')})}>
                          <CheckCircle className="h-3 w-3 me-1" /> {t('refunds.complete', 'Complete')}
                        </Button>
                        <Button size="sm" variant="outline" className="text-red-600 dark:text-red-400 border-red-500/30 hover:bg-red-500/10" onClick={() => setConfirmDialog({open: true, title: t('refunds.confirmStatusTitle', 'Confirm Status Change'), description: t('refunds.confirmStatusChange', 'Are you sure you want to mark this refund as failed?'), onConfirm: () => performUpdateStatus(r.id, 'FAILED')})}>
                          <XCircle className="h-3 w-3 me-1" /> {t('refunds.fail', 'Fail')}
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
                {refunds.length === 0 && <PageEmptyState icon={<DollarSign className="h-8 w-8 text-muted-foreground" />} title={t('refunds.noRefunds', 'No refunds found')} description={t('refunds.noRefundsDesc', 'There are no refund transactions matching the current filter.')} />}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
    )}
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
    </Protected>
  );
}

