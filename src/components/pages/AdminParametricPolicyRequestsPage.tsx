'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { CheckCircle, XCircle, FileText, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '@/lib/i18n';
import { useAppStore } from '@/lib/store';
import { fetchWithAuth, Roles } from '@/hooks/use-auth';
import Protected from '@/components/Protected';
import { PageLoadingState, PageErrorState } from '@/components/shared/PageStates';

interface PolicyRow {
  id: number;
  policyNumber: string;
  sector?: { sectorCode?: string; sectorName?: string } | null;
  sectorName?: string;
  businessModel?: { modelCode?: string; modelName?: string } | null;
  businessModelName?: string;
  resilienceProfile?: { profileCode?: string; profileName?: string } | null;
  resilienceProfileName?: string;
  annualTurnoverTnd: number | string;
  hourlyRevenue: number | string | null;
  grossMargin: number | string;
  cloudDependency: number | string;
  criticality: number | string;
  resilienceFactor: number | string;
  bmFactor: number | string;
  providerFactor: number | string;
  payoutPerHour: number | string | null;
  purePremium: number | string | null;
  commercialPremium: number | string | null;
  finalPremium: number | string | null;
  premiumRatePct: number | string | null;
  underwritingDecision: string | null;
  maxPayoutPerEventHours: number | string;
  adminComment: string | null;
  createdAt: string;
  statusCode: string;
  status?: { statusName?: string } | null;
  customer: { user: { firstName: string; lastName: string } };
  cloudProvider: { organisationName: string; asn: string; slaTier: { tierCode: string; tierName: string } | string };
}

const TIER_STYLES: Record<string, { badge: string; dot: string }> = {
  Platinum: { badge: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800/30', dot: 'bg-purple-500' },
  Gold: { badge: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800/30', dot: 'bg-yellow-500' },
  Silver: { badge: 'bg-muted text-muted-foreground border-border', dot: 'bg-gray-400' },
  Bronze: { badge: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800/30', dot: 'bg-amber-500' },
};

function formatNumericValue(value: number | string | null | undefined, digits = 2) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numeric = typeof value === 'string' ? Number(value) : value;
  return typeof numeric === 'number' && !Number.isNaN(numeric)
    ? numeric.toFixed(digits)
    : null;
}

function formatLocaleNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numeric = typeof value === 'string' ? Number(value) : value;
  return typeof numeric === 'number' && !Number.isNaN(numeric)
    ? numeric.toLocaleString()
    : null;
}

function resolveText(value: unknown, fallback = '—'): string {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return String(
      obj.profileName ?? obj.name ?? obj.sectorName ?? obj.modelName ?? obj.modelCode ?? obj.code ?? obj.profileCode ?? fallback
    );
  }

  return fallback;
}

export default function AdminParametricPolicyRequestsPage() {
  const { t } = useTranslation(['common', 'adminCommon', 'adminParametricPolicy']);
  const [policies, setPolicies] = useState<PolicyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPolicy, setSelectedPolicy] = useState<PolicyRow | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [comment, setComment] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const { user } = useAppStore();

  const fetchPolicies = async () => {
    setError(null);
    try {
      const res = await fetchWithAuth('/api/admin/parametric-policy-requests');
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.error || `Request failed with status ${res.status}`);
      }
      const data = await res.json();
      setPolicies(data.policies || []);
    } catch (err) {
      console.error('Failed to fetch policy requests:', err);
      setError(t('errors.failedToLoad', 'Failed to load data'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolicies();
  }, []);

  const openActionDialog = (policy: PolicyRow, type: 'approve' | 'reject') => {
    setSelectedPolicy(policy);
    setActionType(type);
    setComment('');
    setDialogOpen(true);
  };

  const handleAction = async () => {
    if (!selectedPolicy || !actionType) return;
    setActionLoading(true);
    try {
      if (!user || user.role !== Roles.ADMIN) {
        toast.error(t('errors.adminRequired', 'Admin access required'));
        setActionLoading(false);
        return;
      }

      const res = await fetchWithAuth('/api/admin/parametric-policy-requests', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          policyId: selectedPolicy.id,
          action: actionType,
          adminComment: comment.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(actionType === 'approve' ? t('adminCommon:parametricPolicy.approved') : t('adminCommon:parametricPolicy.rejected'));
        setDialogOpen(false);
        fetchPolicies();
        // If API returned a linked workflow application id, force-refresh the global workflow context
        if (data?.workflowUpdate?.found && data?.workflowUpdate?.appId) {
          try {
            const appId = Number(data.workflowUpdate.appId);
            // Clear then re-set to ensure any open review page re-fetches the application
            useAppStore.getState().setWorkflowContext({ policyId: null });
            setTimeout(() => {
              useAppStore.getState().setWorkflowContext({ policyId: appId });
              // Also dispatch a DOM event so pages that don't rely on store changes can react
              try {
                window.dispatchEvent(new CustomEvent('workflowAppUpdated', { detail: { appId } }));
              } catch (evErr) {
                console.warn('Could not dispatch workflowAppUpdated event', evErr);
              }
            }, 50);
          } catch (e) {
            console.warn('Failed to set workflow context after approval', e);
          }
        }
      } else {
        toast.error(data.error || t('adminCommon:actionFailed'));
      }
    } catch {
      toast.error(t('adminParametricPolicy:toast.actionFailed'));
    } finally {
      setActionLoading(false);
    }
  };

  if (error) {
    return (
      <Protected roles={[Roles.ADMIN, Roles.SUPER_ADMIN]}>
        <PageErrorState message={error} onRetry={fetchPolicies} />
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
      <div className="mb-6 animate-fade-in-down">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Clock className="h-6 w-6 text-amber-500" /> {t('adminParametricPolicy:title')}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">{t('adminParametricPolicy:subtitle')}</p>
      </div>

      {policies.length === 0 ? (
        <Card className="shadow-md animate-fade-in-up">
          <CardContent className="p-12 text-center">
            <div className="bg-muted w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground font-medium">{t('adminParametricPolicy:empty.noPending')}</p>
            <p className="text-muted-foreground text-sm mt-1">{t('adminParametricPolicy:empty.newApplications')}</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-md animate-fade-in-up">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">{t('adminParametricPolicy:title')}</caption>
                <thead>
                  <tr className="border-b bg-muted/80">
                    <th className="text-start p-3 font-medium text-muted-foreground">{t('adminParametricPolicy:table.policyNumber')}</th>
                    <th className="text-start p-3 font-medium text-muted-foreground">{t('adminParametricPolicy:table.customer')}</th>
                    <th className="text-start p-3 font-medium text-muted-foreground">{t('adminParametricPolicy:table.provider')}</th>
                    <th className="text-start p-3 font-medium text-muted-foreground">{t('adminParametricPolicy:table.sector')}</th>
                    <th className="text-start p-3 font-medium text-muted-foreground">{t('adminParametricPolicy:table.status')}</th>
                    <th className="text-start p-3 font-medium text-muted-foreground">{t('adminParametricPolicy:table.turnoverTnd')}</th>
                    <th className="text-start p-3 font-medium text-muted-foreground">{t('adminParametricPolicy:table.finalPremium')}</th>
                    <th className="text-start p-3 font-medium text-muted-foreground">{t('adminParametricPolicy:table.rate')}</th>
                    <th className="text-start p-3 font-medium text-muted-foreground">{t('adminParametricPolicy:table.uwDecision')}</th>
                    <th className="text-start p-3 font-medium text-muted-foreground">{t('adminParametricPolicy:table.applied')}</th>
                    <th className="text-start p-3 font-medium text-muted-foreground">{t('adminParametricPolicy:table.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {policies.map((p) => {
                    const tierStyle = TIER_STYLES[typeof p.cloudProvider.slaTier === 'object' ? p.cloudProvider.slaTier.tierName : p.cloudProvider.slaTier] || TIER_STYLES.Bronze;
                    return (
                      <tr key={p.id} className="border-b table-row-hover">
                        <td className="p-3 font-mono text-xs text-muted-foreground">{p.policyNumber || `POL-${String(p.id).padStart(6, '0')}`}</td>
                        <td className="p-3 font-medium">{p.customer.user.firstName} {p.customer.user.lastName}</td>
                        <td className="p-3">
                          <div>
                            <p className="font-medium">{p.cloudProvider.organisationName}</p>
                            <div className="flex items-center gap-1 mt-0.5">
                              <Badge variant="outline" className={tierStyle.badge + ' text-[10px] px-1.5 py-0'}>
                                <span className={`w-1 h-1 rounded-full ${tierStyle.dot} me-1`} />
                                AS{p.cloudProvider.asn} · {typeof p.cloudProvider.slaTier === 'object' ? p.cloudProvider.slaTier.tierName : p.cloudProvider.slaTier}
                              </Badge>
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" title={p.sector?.sectorName ?? p.sectorName ?? '—'} className="bg-muted text-muted-foreground border-border">{p.sector?.sectorName ?? p.sectorName ?? '—'}</Badge>
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" title={p.status?.statusName ?? p.statusCode ?? '—'} className="text-[10px] bg-muted text-muted-foreground border-border">{p.status?.statusName ?? p.statusCode ?? '—'}</Badge>
                        </td>
                        <td className="p-3 text-muted-foreground">{formatLocaleNumber(p.annualTurnoverTnd) ?? '—'}</td>
                        <td className="p-3 font-semibold text-primary">{formatNumericValue(p.finalPremium, 2) ?? formatNumericValue(p.commercialPremium, 2) ?? '—'} {t('common:unit.tnd', 'TND')}</td>
                        <td className="p-3 text-muted-foreground">{formatNumericValue(p.premiumRatePct, 4) ?? '—'}%</td>
                        <td className="p-3">
                          {p.underwritingDecision ? (
                            <Badge variant="outline" title={p.underwritingDecision.replace(/_/g, ' ')} className={`text-[10px] ${
                              p.underwritingDecision === 'AUTO_ACCEPT' ? 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800/30' :
                              p.underwritingDecision === 'MANUAL_REVIEW' ? 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800/30' :
                              p.underwritingDecision === 'SURCHARGE' ? 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800/30' :
                              'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800/30'
                            }`}>
                              {p.underwritingDecision.replace(/_/g, ' ')}
                            </Badge>
                          ) : '—'}
                        </td>
                        <td className="p-3 text-xs text-muted-foreground">{formatDate(p.createdAt)}</td>
                        <td className="p-3">
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="bg-emerald-500 hover:bg-emerald-600 text-white transition-all hover:shadow-md"
                              onClick={() => openActionDialog(p, 'approve')}
                            >
                              <CheckCircle className="h-3.5 w-3.5 me-1" /> {t('common:action.approve')}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="transition-all hover:shadow-md"
                              onClick={() => openActionDialog(p, 'reject')}
                            >
                              <XCircle className="h-3.5 w-3.5 me-1" /> {t('common:action.reject')}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {actionType === 'approve' ? (
                <><CheckCircle className="h-5 w-5 text-emerald-500" /> {t('adminParametricPolicy:dialog.approveTitle')}</>
              ) : (
                <><XCircle className="h-5 w-5 text-red-500" /> {t('adminParametricPolicy:dialog.rejectTitle')}</>
              )}
            </DialogTitle>
            <DialogDescription>
              {selectedPolicy && (
                <>{t('adminParametricPolicy:dialog.policyFor', { name: `${selectedPolicy.customer.user.firstName} ${selectedPolicy.customer.user.lastName}`, provider: selectedPolicy.cloudProvider.organisationName })}</>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedPolicy && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm bg-muted rounded-xl p-3">
                {[
                  { label: t('adminParametricPolicy:dialog.fields.sector'), value: resolveText(selectedPolicy.sector ?? selectedPolicy.sectorName, '—') },
                  { label: t('adminParametricPolicy:dialog.fields.businessModel'), value: `${resolveText(selectedPolicy.businessModel ?? selectedPolicy.businessModelName, '—')} (×${formatNumericValue(selectedPolicy.bmFactor, 2) ?? '—'})` },
                  { label: t('adminParametricPolicy:dialog.fields.resilienceProfile'), value: `${resolveText(selectedPolicy.resilienceProfile ?? selectedPolicy.resilienceProfileName, 'Medium')} (×${formatNumericValue(selectedPolicy.resilienceFactor, 4) ?? '—'})` },
                  { label: t('adminParametricPolicy:dialog.fields.annualTurnover'), value: `${formatNumericValue(selectedPolicy.annualTurnoverTnd, 0) ?? '—'} ${t('common:unit.tnd', 'TND')}` },
                  { label: t('adminParametricPolicy:dialog.fields.hourlyRevenue'), value: `${formatNumericValue(selectedPolicy.hourlyRevenue, 2) ?? '—'} ${t('common:unit.tnd', 'TND')}/h` },
                  { label: t('adminParametricPolicy:dialog.fields.purePremium'), value: `${formatNumericValue(selectedPolicy.purePremium, 2) ?? '—'} ${t('common:unit.tnd', 'TND')}` },
                  { label: t('adminParametricPolicy:dialog.fields.commercialPremium'), value: `${formatNumericValue(selectedPolicy.commercialPremium, 2) ?? '—'} ${t('common:unit.tnd', 'TND')}` },
                  { label: t('adminParametricPolicy:dialog.fields.finalPremium'), value: `${formatNumericValue(selectedPolicy.finalPremium, 2) ?? formatNumericValue(selectedPolicy.commercialPremium, 2) ?? '—'} ${t('common:unit.tnd', 'TND')}`, highlight: true },
                  { label: t('adminParametricPolicy:dialog.fields.payoutPerHour'), value: `${formatNumericValue(selectedPolicy.payoutPerHour, 4) ?? '—'} ${t('common:unit.tnd', 'TND')}` },
                  { label: t('adminParametricPolicy:dialog.fields.rate'), value: `${formatNumericValue(selectedPolicy.premiumRatePct, 4) ?? '—'}%` },
                  { label: t('adminParametricPolicy:dialog.fields.providerFactor'), value: `×${formatNumericValue(selectedPolicy.providerFactor, 2) ?? '1.00'}` },
                  { label: t('adminParametricPolicy:dialog.fields.uwDecision'), value: resolveText(selectedPolicy.underwritingDecision?.replace(/_/g, ' '), '—') },
                ].map((field) => (
                  <div key={field.label}>
                    <p className="text-muted-foreground text-xs">{field.label}</p>
                    <p className={`font-medium ${field.highlight ? 'text-primary font-semibold' : ''}`}>{field.value}</p>
                  </div>
                ))}
              </div>

              <div>
                <Label htmlFor="comment">{t('adminParametricPolicy:dialog.adminComment')}</Label>
                <Textarea
                  id="comment"
                  placeholder={actionType === 'reject' ? t('adminParametricPolicy:dialog.rejectPlaceholder') : t('adminParametricPolicy:dialog.optionalPlaceholder')}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="mt-1 focus-ring"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="transition-all">{t('adminParametricPolicy:dialog.cancel')}</Button>
            <Button
              onClick={handleAction}
              disabled={actionLoading}
              className={`${actionType === 'approve' ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'bg-red-500 hover:bg-red-600 text-white'} transition-all hover:shadow-md`}
            >
              {actionLoading ? t('adminParametricPolicy:dialog.processing') : actionType === 'approve' ? t('adminParametricPolicy:dialog.confirmApproval') : t('adminParametricPolicy:dialog.confirmRejection')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </Protected>
  );
}

