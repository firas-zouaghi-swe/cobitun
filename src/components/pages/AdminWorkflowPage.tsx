'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAppStore } from '@/lib/store';
import { fetchWithAuth, Roles } from '@/hooks/use-auth';
import Protected from '@/components/Protected';
import { toast } from 'sonner';
import { formatDate } from '@/lib/i18n';
import { formatTnd } from '@/lib/utils';
import {
  Shield,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  ClipboardList,
  Eye,
  ChevronRight,
  Loader2,
  FolderOpen,
  Inbox,
  PenTool,
} from 'lucide-react';
import { PageLoadingState, PageEmptyState, PageErrorState } from '@/components/shared/PageStates';

const API_BASE = '/api/workflow';


// ─── Status badge helpers ────────────────────────────────────────

type PolicyStatus =
  | 'ProviderContractUploaded'
  | 'AdminReviewing'
  | 'PolicyContractGenerated'
  | 'AwaitingSignatureAndPayment'
  | 'ReadyForFinalApproval'
  | 'UnderwritingCompleted'
  | 'Rejected';

type ClaimStatus = 'Open' | 'Submitted' | 'Completed';

const policyStatusConfig: Record<
  PolicyStatus,
  { labelKey: string; color: string; bgClass: string }
> = {
  ProviderContractUploaded: {
    labelKey: 'adminWorkflow:status.contractUploaded',
    color: 'text-blue-700 dark:text-blue-400',
    bgClass: 'bg-blue-100 dark:bg-blue-900/30',
  },
  AdminReviewing: {
    labelKey: 'adminWorkflow:status.adminReviewing',
    color: 'text-amber-700 dark:text-amber-400',
    bgClass: 'bg-amber-100 dark:bg-amber-900/30',
  },
  PolicyContractGenerated: {
    labelKey: 'adminWorkflow:status.policyGenerated',
    color: 'text-purple-700 dark:text-purple-400',
    bgClass: 'bg-purple-100 dark:bg-purple-900/30',
  },
  AwaitingSignatureAndPayment: {
    labelKey: 'adminWorkflow:status.awaitingSignatureAndPayment',
    color: 'text-orange-700 dark:text-orange-400',
    bgClass: 'bg-orange-100 dark:bg-orange-900/30',
  },
  ReadyForFinalApproval: {
    labelKey: 'adminWorkflow:status.readyForFinalApproval',
    color: 'text-teal-700 dark:text-teal-400',
    bgClass: 'bg-teal-100 dark:bg-teal-900/30',
  },
  UnderwritingCompleted: {
    labelKey: 'adminWorkflow:status.underwritingCompleted',
    color: 'text-green-700 dark:text-green-400',
    bgClass: 'bg-green-100 dark:bg-green-900/30',
  },
  Rejected: {
    labelKey: 'adminWorkflow:status.rejected',
    color: 'text-red-700 dark:text-red-400',
    bgClass: 'bg-red-100 dark:bg-red-900/30',
  },
};

const claimStatusConfig: Record<
  ClaimStatus,
  { labelKey: string; color: string; bgClass: string }
> = {
  Open: {
    labelKey: 'adminWorkflow:status.open',
    color: 'text-blue-700 dark:text-blue-400',
    bgClass: 'bg-blue-100 dark:bg-blue-900/30',
  },
  Submitted: {
    labelKey: 'adminWorkflow:status.submitted',
    color: 'text-amber-700 dark:text-amber-400',
    bgClass: 'bg-amber-100 dark:bg-amber-900/30',
  },
  Completed: {
    labelKey: 'adminWorkflow:status.completed',
    color: 'text-green-700 dark:text-green-400',
    bgClass: 'bg-green-100 dark:bg-green-900/30',
  },
};

function PolicyStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation('adminWorkflow');
  const config = policyStatusConfig[status as PolicyStatus];
  if (!config) return <Badge variant="secondary">{status}</Badge>;
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${config.bgClass} ${config.color}`}
    >
      {t(config.labelKey)}
    </span>
  );
}

function ClaimStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation('adminWorkflow');
  const config = claimStatusConfig[status as ClaimStatus];
  if (!config) return <Badge variant="secondary">{status}</Badge>;
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${config.bgClass} ${config.color}`}
    >
      {t(config.labelKey)}
    </span>
  );
}

// ─── Interfaces ──────────────────────────────────────────────────

interface CustomerUser {
  firstName: string;
  lastName: string;
  email: string;
}

interface Customer {
  id: number;
  user: CustomerUser;
}

interface PolicyApplication {
  id: number;
  statusCode: string;
  statusName: string;
  sector: string | null;
  annualTurnover: number | null;
  premiumAmount: number | null;
  providerContractPdfUrl: string | null;
  createdAt: string;
  customer?: Customer;
}

interface WorkflowClaim {
  id: number;
  statusCode: string;
  statusName: string;
  lossAmount: number | null;
  lossStartDate: string | null;
  lossEndDate: string | null;
  payoutTransactionId: string | null;
  payoutTriggeredAt: string | null;
  policyApplicationId: number;
  policyApplication?: { id: number; statusCode: string };
  createdAt: string;
  customer?: Customer;
}

// ─── Main Component ──────────────────────────────────────────────

export default function AdminWorkflowPage() {
  const { t } = useTranslation(['common', 'adminWorkflow']);
  const { setCurrentPage, setWorkflowContext, isAuthenticated, hydrated } = useAppStore();
  const [applications, setApplications] = useState<PolicyApplication[]>([]);
  const [claims, setClaims] = useState<WorkflowClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('policies');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const headers: Record<string, string> = {};
      const [appRes, claimRes] = await Promise.all([
        fetchWithAuth(`${API_BASE}/policy-applications`, { headers }),
        fetchWithAuth(`${API_BASE}/claims`, { headers }),
      ]);
      // Safely parse responses — avoid throwing when server returned HTML (404 page)
      if (appRes.ok && (appRes.headers.get('content-type') || '').includes('application/json')) {
        const appData = await appRes.json();
        setApplications(appData.applications || []);
      } else if (appRes.status === 404) {
        const txt = await appRes.text();
        console.warn('Policy applications endpoint returned 404. Response body:', txt.slice(0, 240));
        setError(t('adminWorkflow:toast.endpointNotFound'));
        setApplications([]);
      } else if (!appRes.ok) {
        const txt = await appRes.text();
        console.error('Policy applications API error:', appRes.status, txt);
        setError(t('adminWorkflow:toast.loadFailed'));
      } else {
        const txt = await appRes.text();
        console.error('Policy applications returned non-JSON response:', txt);
        setError(t('adminWorkflow:toast.loadFailed'));
      }

      if (claimRes.ok && (claimRes.headers.get('content-type') || '').includes('application/json')) {
        const claimData = await claimRes.json();
        setClaims(claimData.claims || []);
      } else if (claimRes.status === 404) {
        const txt = await claimRes.text();
        console.warn('Claims endpoint returned 404. Response body:', txt.slice(0, 240));
        setError(t('adminWorkflow:toast.endpointNotFound'));
        setClaims([]);
      } else if (!claimRes.ok) {
        const txt = await claimRes.text();
        console.error('Claims API error:', claimRes.status, txt);
        setError(t('adminWorkflow:toast.loadFailed'));
      } else {
        const txt = await claimRes.text();
        console.error('Claims returned non-JSON response:', txt);
        setError(t('adminWorkflow:toast.loadFailed'));
      }
    } catch (error) {
      console.error('Failed to fetch workflow data:', error);
      setError(t('adminWorkflow:toast.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!hydrated || !isAuthenticated) return;
    void fetchData();
  }, [hydrated, isAuthenticated, fetchData]);

  // Listen for external workflow updates (dispatched by other admin pages)
  useEffect(() => {
    const handler = (e: Event) => {
      try {
        const detail = (e as CustomEvent).detail as { appId?: number } | undefined;
        // If detail provided, optionally we could check appId, but full refresh is fine
        if (!hydrated || !isAuthenticated) return;
        setLoading(true);
        fetchData();
      } catch (err) {
        console.warn('workflowAppUpdated handler error', err);
      }
    };

    window.addEventListener('workflowAppUpdated', handler as EventListener);
    return () => window.removeEventListener('workflowAppUpdated', handler as EventListener);
  }, [fetchData]);

  // If the user logs in later, re-fetch workflow data automatically.
  useEffect(() => {
    const unsub = useAppStore.subscribe((state) => {
      if (state.user) {
        setLoading(true);
        fetchData();
      }
    });
    return () => unsub();
  }, [fetchData]);

  // Summary counts
  const totalApplications = applications.length;
  const pendingReview = applications.filter((a) =>
    ['ProviderContractUploaded', 'AdminReviewing'].includes(a.statusCode)
  ).length;
  const awaitingFinalSign = applications.filter((a) =>
    a.statusCode === 'ReadyForFinalApproval'
  ).length;
  const totalClaims = claims.length;
  const pendingClaims = claims.filter((c) => c.statusCode === 'Submitted').length;

  const handleReviewPolicy = (policyId: number) => {
    setWorkflowContext({ policyId, claimId: null });
    setCurrentPage('admin-policy-review');
  };

  const handleReviewClaim = (claimId: number) => {
    setWorkflowContext({ policyId: null, claimId });
    setCurrentPage('admin-claim-review');
  };

  if (loading) {
    return (
      <Protected roles={[Roles.ADMIN, Roles.SUPER_ADMIN]}>
        <PageLoadingState />
      </Protected>
    );
  }

  if (error) {
    return (
      <Protected roles={[Roles.ADMIN, Roles.SUPER_ADMIN]}>
        <PageErrorState message={error} onRetry={fetchData} />
      </Protected>
    );
  }

  return (
    <Protected roles={[Roles.ADMIN, Roles.SUPER_ADMIN]}>
      <div className="space-y-6 page-enter">
      {/* Header */}
      <div className="animate-fade-in-down">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <ClipboardList className="h-6 w-6 text-tunis-orange" />
          {t('adminWorkflow:title')}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {t('adminWorkflow:subtitle')}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 animate-fade-in-up">
        <Card className="card-hover-lift">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="bg-tunis-blue/10 p-2.5 rounded-xl">
              <Shield className="h-5 w-5 text-tunis-blue" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {totalApplications}
              </p>
              <p className="text-xs text-muted-foreground">{t('adminWorkflow:summary.totalApplications')}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-hover-lift">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="bg-amber-100 dark:bg-amber-900/20 p-2.5 rounded-xl">
              <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {pendingReview}
              </p>
              <p className="text-xs text-muted-foreground">{t('adminWorkflow:summary.pendingReview')}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-hover-lift">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="bg-teal-100 dark:bg-teal-900/20 p-2.5 rounded-xl">
              <PenTool className="h-5 w-5 text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {awaitingFinalSign}
              </p>
              <p className="text-xs text-muted-foreground">{t('adminWorkflow:summary.awaitingFinalSign')}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-hover-lift">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="bg-blue-100 dark:bg-blue-900/20 p-2.5 rounded-xl">
              <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {totalClaims}
              </p>
              <p className="text-xs text-muted-foreground">{t('adminWorkflow:summary.totalClaims')}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-hover-lift col-span-2 sm:col-span-1">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="bg-orange-100 dark:bg-orange-900/20 p-2.5 rounded-xl">
              <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {pendingClaims}
              </p>
              <p className="text-xs text-muted-foreground">{t('adminWorkflow:summary.pendingClaims')}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="animate-fade-in-up stagger-2"
      >
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="policies" className="text-sm">
            {t('adminWorkflow:tab.policyApplications')}
          </TabsTrigger>
          <TabsTrigger value="claims" className="text-sm">
            {t('adminWorkflow:tab.claims')}
          </TabsTrigger>
        </TabsList>

        {/* ─── Policy Applications Tab ─── */}
        <TabsContent value="policies" className="mt-4">
          {applications.length === 0 ? (
            <PageEmptyState
              icon={<FolderOpen className="h-8 w-8 text-muted-foreground" />}
              title={t('adminWorkflow:empty.noPoliciesTitle')}
              description={t('adminWorkflow:empty.noPoliciesSubtitle')}
            />
          ) : (
            <Card className="shadow-md">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <caption className="sr-only">{t('adminWorkflow:tab.policyApplications')}</caption>
                    <thead>
                      <tr className="border-b bg-muted/80">
                        <th className="text-start p-3 font-medium text-muted-foreground">{t('adminWorkflow:policyTable.customerName')}</th>
                        <th className="text-start p-3 font-medium text-muted-foreground">{t('adminWorkflow:policyTable.sector')}</th>
                        <th className="text-start p-3 font-medium text-muted-foreground">{t('adminWorkflow:policyTable.status')}</th>
                        <th className="text-start p-3 font-medium text-muted-foreground">{t('adminWorkflow:policyTable.createdDate')}</th>
                        <th className="text-start p-3 font-medium text-muted-foreground">{t('adminWorkflow:policyTable.actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {applications.map((app) => (
                        <tr key={app.id} className="border-b table-row-hover">
                          <td className="p-3">
                            <div>
                              <p className="font-medium text-foreground">
                                {app.customer?.user
                                  ? `${app.customer.user.firstName} ${app.customer.user.lastName}`
                                  : t('adminWorkflow:policyTable.unknownCustomer')}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {app.customer?.user?.email || ''}
                              </p>
                            </div>
                          </td>
                          <td className="p-3 text-muted-foreground">
                            {app.sector || '—'}
                          </td>
                          <td className="p-3">
                            <PolicyStatusBadge status={app.statusCode} />
                          </td>
                          <td className="p-3 text-muted-foreground text-xs">
                            {formatDate(app.createdAt)}
                          </td>
                          <td className="p-3">
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-tunis-blue/30 text-tunis-blue hover:bg-tunis-blue/5 hover:text-tunis-blue-dark dark:border-tunis-blue/30 dark:text-tunis-blue dark:hover:bg-tunis-blue/5 dark:hover:text-tunis-blue-dark"
                              onClick={() => handleReviewPolicy(app.id)}
                            >
                              <Eye className="h-4 w-4 me-1.5" />
                              {t('adminWorkflow:policyTable.review')}
                              <ChevronRight className="h-3.5 w-3.5 ms-1" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ─── Claims Tab ─── */}
        <TabsContent value="claims" className="mt-4">
          {claims.length === 0 ? (
            <PageEmptyState
              icon={<Inbox className="h-8 w-8 text-muted-foreground" />}
              title={t('adminWorkflow:empty.noClaimsTitle')}
              description={t('adminWorkflow:empty.noClaimsSubtitle')}
            />
          ) : (
            <Card className="shadow-md">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <caption className="sr-only">{t('adminWorkflow:tab.claims')}</caption>
                    <thead>
                      <tr className="border-b bg-muted/80">
                        <th className="text-start p-3 font-medium text-muted-foreground">{t('adminWorkflow:claimTable.customerName')}</th>
                        <th className="text-start p-3 font-medium text-muted-foreground">{t('adminWorkflow:claimTable.policyRef')}</th>
                        <th className="text-start p-3 font-medium text-muted-foreground">{t('adminWorkflow:claimTable.lossAmount')}</th>
                        <th className="text-start p-3 font-medium text-muted-foreground">{t('adminWorkflow:claimTable.status')}</th>
                        <th className="text-start p-3 font-medium text-muted-foreground">{t('adminWorkflow:claimTable.actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {claims.map((claim) => (
                        <tr key={claim.id} className="border-b table-row-hover">
                          <td className="p-3">
                            <div>
                              <p className="font-medium text-foreground">
                                {claim.customer?.user
                                  ? `${claim.customer.user.firstName} ${claim.customer.user.lastName}`
                                  : t('adminWorkflow:claimTable.unknownCustomer')}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {claim.customer?.user?.email || ''}
                              </p>
                            </div>
                          </td>
                          <td className="p-3">
                            <span className="font-mono text-xs text-muted-foreground">
                              APP-{claim.policyApplicationId}
                            </span>
                          </td>
                          <td className="p-3 font-semibold text-foreground">
                            {claim.lossAmount != null
                              ? `${formatTnd(claim.lossAmount)} ${t('common:unit.tnd', 'TND')}`
                              : '—'}
                          </td>
                          <td className="p-3">
                            <ClaimStatusBadge status={claim.statusCode} />
                          </td>
                          <td className="p-3">
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-tunis-blue/30 text-tunis-blue hover:bg-tunis-blue/5 hover:text-tunis-blue-dark dark:border-tunis-blue/30 dark:text-tunis-blue dark:hover:bg-tunis-blue/5 dark:hover:text-tunis-blue-dark"
                              onClick={() => handleReviewClaim(claim.id)}
                            >
                              <Eye className="h-4 w-4 me-1.5" />
                              {t('adminWorkflow:claimTable.review')}
                              <ChevronRight className="h-3.5 w-3.5 ms-1" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
      </div>
    </Protected>
  );
}

