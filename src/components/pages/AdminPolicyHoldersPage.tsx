'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Protected from '@/components/Protected';
import { fetchWithAuth, Roles } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { formatCurrency, formatDate } from '@/lib/i18n';
import { CheckCircle, XCircle, Clock, Shield, Loader2 } from 'lucide-react';
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
import { PageLoadingState, PageErrorState, PageEmptyState } from '@/components/shared/PageStates';

interface PolicyHolder {
  id: number;
  statusCode: string;
  statusName: string;
  createdAt: string;
  customer: {
    id: number;
    mobile: string;
    address: string;
    user: { firstName: string; lastName: string; username: string; email: string | null };
  };
  policy: {
    id: number;
    policyName: string;
    sumAssurance: number;
    premium: number;
    tenure: number;
    category: { categoryName: string };
  };
}

export default function AdminPolicyHoldersPage() {
  const { t } = useTranslation(['common', 'adminCommon', 'adminPolicyHolders']);
  const [policyHolders, setPolicyHolders] = useState<PolicyHolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{open: boolean; title: string; description: string; onConfirm: () => void}>({open: false, title: '', description: '', onConfirm: () => {}});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPolicyHolders(activeTab);
  }, [activeTab]);

  const fetchPolicyHolders = async (filter: string) => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`/api/admin/policy-holders?filter=${filter}`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.error || `Request failed with status ${res.status}`);
      }
      const data = await res.json();
      setPolicyHolders(data.policyHolders || []);
    } catch (err) {
      console.error('Failed to fetch policy holders:', err);
      setError(t('errors.failedToLoad', 'Failed to load data'));
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id: number, statusCode: string) => {
    setActionLoading(id);
    try {
      const res = await fetchWithAuth('/api/admin/policy-holders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, statusCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || t('adminPolicyHolders:toast.updateFailed'));
        return;
      }
      toast.success(t('adminPolicyHolders:toast.statusSuccess', { status: statusCode.toLowerCase() }));
      fetchPolicyHolders(activeTab);
    } catch {
      toast.error(t('common:error.somethingWentWrong'));
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (statusCode: string, statusName: string) => {
    switch (statusCode) {
      case 'Approved':
        return <Badge className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/50" title={statusName || statusCode}><CheckCircle className="h-3 w-3 me-1" />{statusName || statusCode}</Badge>;
      case 'Disapproved':
        return <Badge className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/50" title={statusName || statusCode}><XCircle className="h-3 w-3 me-1" />{statusName || statusCode}</Badge>;
      default:
        return <Badge className="bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/50" title={statusName || statusCode}><Clock className="h-3 w-3 me-1" />{statusName || statusCode}</Badge>;
    }
  };

  if (error) {
    return (
      <Protected roles={[Roles.ADMIN, Roles.SUPER_ADMIN]}>
        <PageErrorState message={error} onRetry={() => fetchPolicyHolders(activeTab)} />
      </Protected>
    );
  }

  return (
    <Protected roles={[Roles.ADMIN, Roles.SUPER_ADMIN]}>
      <div>
      <h1 className="text-2xl font-bold mb-6">{t('adminPolicyHolders:title')}</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="all">{t('adminPolicyHolders:tabs.all')}</TabsTrigger>
          <TabsTrigger value="Pending">{t('adminPolicyHolders:tabs.pending')}</TabsTrigger>
          <TabsTrigger value="Approved">{t('adminPolicyHolders:tabs.approved')}</TabsTrigger>
          <TabsTrigger value="Disapproved">{t('adminPolicyHolders:tabs.disapproved')}</TabsTrigger>
        </TabsList>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <PageLoadingState message={t('common:loading', 'Loading...')} />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <caption className="sr-only">{t('adminPolicyHolders:title')}</caption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('adminPolicyHolders:table.customer')}</TableHead>
                      <TableHead>{t('adminPolicyHolders:table.policy')}</TableHead>
                      <TableHead>{t('adminPolicyHolders:table.category')}</TableHead>
                      <TableHead>{t('adminPolicyHolders:table.sumAssurance')}</TableHead>
                      <TableHead>{t('adminPolicyHolders:table.premium')}</TableHead>
                      <TableHead>{t('adminPolicyHolders:table.status')}</TableHead>
                      <TableHead>{t('adminPolicyHolders:table.applied')}</TableHead>
                      <TableHead className="text-end">{t('adminPolicyHolders:table.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {policyHolders.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="py-0 border-0">
                          <PageEmptyState
                            icon={<Shield className="h-8 w-8 text-muted-foreground" />}
                            title={t('adminPolicyHolders:empty.noPolicyHolders')}
                            description={t('adminPolicyHolders:empty.noPolicyHoldersDescription', 'No policy holders found for this filter.')}
                          />
                        </TableCell>
                      </TableRow>
                    ) : (
                      policyHolders.map((holder) => (
                        <TableRow key={holder.id}>
                              <TableCell className="font-medium">
                                {holder.customer?.user ? (
                                  <>
                                    {holder.customer.user.firstName} {holder.customer.user.lastName}
                                    <div className="text-xs text-muted-foreground">{holder.customer.mobile}</div>
                                  </>
                                ) : (
                                  <>
                                    {/* Fallback when legacy policyRecord.customerId or missing user */}
                                    {holder.customer?.id || t('adminPolicyHolders:unknownCustomer')}
                                    <div className="text-xs text-muted-foreground">{holder.customer?.mobile || ''}</div>
                                  </>
                                )}
                              </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Shield className="h-4 w-4 text-primary" />
                              {holder.policy.policyName}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {holder.policy.category?.categoryName ?? t('adminPolicyHolders:unknownCategory', 'Uncategorized')}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatCurrency(holder.policy.sumAssurance)}</TableCell>
                          <TableCell>{formatCurrency(holder.policy.premium)}</TableCell>
                          <TableCell>{getStatusBadge(holder.statusCode, holder.statusName)}</TableCell>
                          <TableCell>{formatDate(holder.createdAt)}</TableCell>
                          <TableCell className="text-end">
                            {holder.statusCode === 'Pending' && (
                              <div className="flex justify-end gap-2">
                                <Button
                                  size="sm"
                                  className="bg-green-500 hover:bg-green-600"
                                  onClick={() => setConfirmDialog({
                                    open: true,
                                    title: t('adminPolicyHolders:confirm.approveTitle', 'Confirm Approval'),
                                    description: t('adminPolicyHolders:confirm.approveDesc', 'Approving this policy holder is an irreversible decision. The policy holder will gain active coverage and benefits. This action cannot be undone.'),
                                    onConfirm: () => handleStatusChange(holder.id, 'Approved')
                                  })}
                                  disabled={actionLoading === holder.id}
                                  aria-label={"Approve " + (holder.customer?.user ? holder.customer.user.firstName + ' ' + holder.customer.user.lastName : String(holder.customer?.id))}
                                >
                                  {actionLoading === holder.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => setConfirmDialog({
                                    open: true,
                                    title: t('adminPolicyHolders:confirm.disapproveTitle', 'Confirm Disapproval'),
                                    description: t('adminPolicyHolders:confirm.disapproveDesc', 'Disapproving this policy holder is an irreversible decision. The policy holder will be denied coverage. This action cannot be undone.'),
                                    onConfirm: () => handleStatusChange(holder.id, 'Disapproved')
                                  })}
                                  disabled={actionLoading === holder.id}
                                  aria-label={"Disapprove " + (holder.customer?.user ? holder.customer.user.firstName + ' ' + holder.customer.user.lastName : String(holder.customer?.id))}
                                >
                                  {actionLoading === holder.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </Tabs>

      {/* Confirmation Dialog */}
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

