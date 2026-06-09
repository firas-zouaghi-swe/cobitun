'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAppStore } from '@/lib/store';
import { fetchWithAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import { PageErrorState, PageLoadingState, PageEmptyState } from '@/components/shared/PageStates';
import { formatDate } from '@/lib/i18n';
import { safeToFixed } from '@/lib/utils';
import {
  FileText,
  Shield,
  Plus,
  AlertCircle,
  CheckCircle2,
  Clock,
  Upload,
  PenTool,
  CreditCard,
  Eye,
  ChevronRight,
  Loader2,
  FolderOpen,
} from 'lucide-react';

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
    labelKey: 'customerWorkflow:status.contractUploaded',
    color: 'text-blue-700 dark:text-blue-400',
    bgClass: 'bg-blue-100 dark:bg-blue-900/30',
  },
  AdminReviewing: {
    labelKey: 'customerWorkflow:status.adminReviewing',
    color: 'text-amber-700 dark:text-amber-400',
    bgClass: 'bg-amber-100 dark:bg-amber-900/30',
  },
  PolicyContractGenerated: {
    labelKey: 'customerWorkflow:status.policyGenerated',
    color: 'text-purple-700 dark:text-purple-400',
    bgClass: 'bg-purple-100 dark:bg-purple-900/30',
  },
  AwaitingSignatureAndPayment: {
    labelKey: 'customerWorkflow:status.awaitingSignatureAndPayment',
    color: 'text-orange-700 dark:text-orange-400',
    bgClass: 'bg-orange-100 dark:bg-orange-900/30',
  },
  ReadyForFinalApproval: {
    labelKey: 'customerWorkflow:status.readyForFinalApproval',
    color: 'text-teal-700 dark:text-teal-400',
    bgClass: 'bg-teal-100 dark:bg-teal-900/30',
  },
  UnderwritingCompleted: {
    labelKey: 'customerWorkflow:status.underwritingCompleted',
    color: 'text-green-700 dark:text-green-400',
    bgClass: 'bg-green-100 dark:bg-green-900/30',
  },
  Rejected: {
    labelKey: 'customerWorkflow:status.rejected',
    color: 'text-red-700 dark:text-red-400',
    bgClass: 'bg-red-100 dark:bg-red-900/30',
  },
};

const claimStatusConfig: Record<
  ClaimStatus,
  { labelKey: string; color: string; bgClass: string }
> = {
  Open: {
    labelKey: 'customerWorkflow:status.open',
    color: 'text-blue-700 dark:text-blue-400',
    bgClass: 'bg-blue-100 dark:bg-blue-900/30',
  },
  Submitted: {
    labelKey: 'customerWorkflow:status.submitted',
    color: 'text-amber-700 dark:text-amber-400',
    bgClass: 'bg-amber-100 dark:bg-amber-900/30',
  },
  Completed: {
    labelKey: 'customerWorkflow:status.completed',
    color: 'text-green-700 dark:text-green-400',
    bgClass: 'bg-green-100 dark:bg-green-900/30',
  },
};

function PolicyStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation('customerWorkflow');
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
  const { t } = useTranslation('customerWorkflow');
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

// ─── Interfaces (v3: WorkflowPolicyApplication, int IDs) ──────────

interface WorkflowPolicyApplication {
  id: number;
  statusCode: string;
  statusName: string;
  sector: string | null;
  annualTurnover: number | null;
  providerContractPdfUrl: string | null;
  insurancePolicyContractPdfUrl: string | null;
  signedPolicyContractPdfUrl: string | null;
  premiumAmount: number | null;
  createdAt: string;
  policyTasks: WorkflowPolicyTask[];
}

interface WorkflowClaim {
  id: number;
  statusCode: string;
  statusName: string;
  lossDescription: string | null;
  lossAmount: number | null;
  lossStartDate: string | null;
  lossEndDate: string | null;
  payoutTransactionId: string | null;
  payoutTriggeredAt: string | null;
  policyApplicationId: number;
  createdAt: string;
  claimTasks: WorkflowClaimTask[];
}

interface WorkflowPolicyTask {
  id: number;
  actionRequired: string;
  actor: string;
  statusCode: string;
  statusName: string;
}

interface WorkflowClaimTask {
  id: number;
  actionRequired: string;
  actor: string;
  statusCode: string;
  statusName: string;
}

// Unified task type for display
interface UnifiedTask {
  id: number;
  actionRequired: string;
  actor: string;
  statusCode: string;
  statusName: string;
}

// ─── Action button logic ─────────────────────────────────────────

function getPolicyAction(
  policy: WorkflowPolicyApplication
): { labelKey: string; icon: React.ElementType; page: string } | null {
  switch (policy.statusCode) {
    case 'ProviderContractUploaded':
      return {
        labelKey: 'customerWorkflow:action.awaitingReview',
        icon: Clock,
        page: 'customer-policy-detail',
      };
    case 'AdminReviewing':
      return {
        labelKey: 'customerWorkflow:action.inReview',
        icon: Clock,
        page: 'customer-policy-detail',
      };
    case 'PolicyContractGenerated':
      return {
        labelKey: 'customerWorkflow:action.signContract',
        icon: PenTool,
        page: 'customer-policy-detail',
      };
    case 'AwaitingSignatureAndPayment':
      return {
        labelKey: 'customerWorkflow:action.payPremium',
        icon: CreditCard,
        page: 'customer-policy-detail',
      };
    case 'ReadyForFinalApproval':
      return {
        labelKey: 'customerWorkflow:action.awaitingApproval',
        icon: Clock,
        page: 'customer-policy-detail',
      };
    case 'UnderwritingCompleted':
      return {
        labelKey: 'customerWorkflow:action.viewPolicy',
        icon: CheckCircle2,
        page: 'customer-policy-detail',
      };
    case 'Rejected':
      return {
        labelKey: 'customerWorkflow:action.viewDetails',
        icon: AlertCircle,
        page: 'customer-policy-detail',
      };
    default:
      return null;
  }
}

function getClaimAction(
  claim: WorkflowClaim
): { labelKey: string; icon: React.ElementType; page: string } | null {
  switch (claim.statusCode) {
    case 'Open':
      return {
        labelKey: 'customerWorkflow:action.fillDeclaration',
        icon: PenTool,
        page: 'customer-claim',
      };
    case 'Submitted':
      return {
        labelKey: 'customerWorkflow:action.underReview',
        icon: Clock,
        page: 'customer-claim',
      };
    case 'Completed':
      return {
        labelKey: 'customerWorkflow:action.viewPayout',
        icon: CheckCircle2,
        page: 'customer-claim',
      };
    default:
      return null;
  }
}

// ─── Main Component ──────────────────────────────────────────────

export default function CustomerWorkflowPage() {
  const { user, setCurrentPage, setWorkflowContext } = useAppStore();
  const { t } = useTranslation(['common', 'customerWorkflow']);
  const [applications, setApplications] = useState<WorkflowPolicyApplication[]>([]);
  const [claims, setClaims] = useState<WorkflowClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('policies');

  useEffect(() => {
    fetchData();
  }, [user?.id]);

  // Listen for workflow updates from other pages (e.g., customer submitted, admin approved)
  useEffect(() => {
    const handler = (e: Event) => {
      try {
        const detail = (e as CustomEvent).detail as { appId?: number } | undefined;
        // If no detail, just refresh list
        fetchData();
      } catch (err) {
        console.warn('workflowAppUpdated handler error', err);
      }
    };
    window.addEventListener('workflowAppUpdated', handler as EventListener);
    return () => window.removeEventListener('workflowAppUpdated', handler as EventListener);
  }, []);

  const fetchData = async () => {
    setError(null);
    try {
      const [appRes, claimRes] = await Promise.all([
        fetchWithAuth(`${API_BASE}/policy-applications`),
        fetchWithAuth(`${API_BASE}/claims`),
      ]);
      const appData = await appRes.json();
      const claimData = await claimRes.json();
      if (appRes.ok) setApplications(appData.applications || []);
      if (claimRes.ok) setClaims(claimData.claims || []);
    } catch (error) {
      console.error('Failed to fetch workflow data:', error);
      setError(t('errors.failedToLoad', 'Failed to load data'));
    } finally {
      setLoading(false);
    }
  };

  const hasCompletedPolicies = applications.some(
    (a) => a.statusCode === 'UnderwritingCompleted'
  );

  const pendingPolicyCount = applications.filter((a) =>
    [
      'AdminReviewing',
      'PolicyContractGenerated',
      'AwaitingSignatureAndPayment',
      'ReadyForFinalApproval',
    ].includes(a.statusCode)
  ).length;

  const openClaimCount = claims.filter((c) => c.statusCode === 'Open').length;

  const handleNavigateToPolicyDetail = (policyId: number) => {
    setWorkflowContext({ policyId, claimId: null });
    setCurrentPage('customer-policy-detail');
  };

  const handleNavigateToClaim = (claimId?: number) => {
    setWorkflowContext({ policyId: null, claimId: claimId || null });
    setCurrentPage('customer-claim');
  };

  if (error) {
    return <PageErrorState message={error} onRetry={fetchData} />;
  }

  if (loading) {
    return <PageLoadingState message={t('customerWorkflow:loading', 'Loading workflow...')} />;
  }

  return (
    <div className="space-y-6 page-enter">
      {/* Header */}
      <div className="animate-fade-in-down">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {t('customerWorkflow:title')}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {t('customerWorkflow:subtitle')}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="tunis"
              onClick={() => setCurrentPage('customer-policy-application')}
            >
              <Plus className="h-4 w-4 me-2" />
              {t('customerWorkflow:applyNewPolicy')}
            </Button>
            {hasCompletedPolicies && (
              <Button
                variant="outline"
                className="border-tunis-blue text-tunis-blue hover:bg-tunis-blue/5"
                onClick={() => handleNavigateToClaim()}
              >
                <AlertCircle className="h-4 w-4 me-2" />
                {t('customerWorkflow:fileClaim')}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 animate-fade-in-up">
        <Card className="card-hover-lift">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="bg-tunis-blue/10 p-2.5 rounded-xl">
              <Shield className="h-5 w-5 text-tunis-blue" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {applications.length}
              </p>
              <p className="text-xs text-muted-foreground">{t('customerWorkflow:stats.totalPolicies')}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-hover-lift">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="bg-orange-100 dark:bg-orange-900/20 p-2.5 rounded-xl">
              <Clock className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {pendingPolicyCount}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('customerWorkflow:stats.actionRequired')}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-hover-lift">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="bg-green-100 dark:bg-green-900/20 p-2.5 rounded-xl">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {
                  applications.filter(
                    (a) => a.statusCode === 'UnderwritingCompleted'
                  ).length
                }
              </p>
              <p className="text-xs text-muted-foreground">
                {t('customerWorkflow:stats.completed')}
              </p>
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
                {openClaimCount}
              </p>
              <p className="text-xs text-muted-foreground">{t('customerWorkflow:stats.openClaims')}</p>
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
            {t('customerWorkflow:tab.policyApplications')}
          </TabsTrigger>
          <TabsTrigger value="claims" className="text-sm">
            {t('customerWorkflow:tab.claims')}
          </TabsTrigger>
        </TabsList>

        {/* ─── Policy Applications Tab ─── */}
        <TabsContent value="policies" className="mt-4">
          {applications.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center">
                <FolderOpen className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
                <h3 className="text-lg font-semibold text-foreground mb-1">
                  {t('customerWorkflow:empty.noPolicyTitle')}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {t('customerWorkflow:empty.noPolicySubtitle')}
                </p>
                <Button
                  variant="tunis"
                  onClick={() =>
                    setCurrentPage('customer-policy-application')
                  }
                >
                  <Plus className="h-4 w-4 me-2" />
                  {t('customerWorkflow:applyNewPolicy')}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <ScrollArea className="max-h-[600px]">
              <div className="space-y-3">
                {applications.map((app) => {
                  const action = getPolicyAction(app);
                  return (
                    <Card
                      key={app.id}
                      className="card-hover-lift cursor-pointer"
                      onClick={() => handleNavigateToPolicyDetail(app.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-sm font-mono text-muted-foreground">
                                APP-{app.id}
                              </span>
                              <PolicyStatusBadge status={app.statusCode} />
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span>
                                {t('customerWorkflow:status.created')}:{' '}
                                {formatDate(app.createdAt)}
                              </span>
                              {app.sector && (
                                <span>{t('customerWorkflow:status.sector')}: {app.sector}</span>
                              )}
                              {app.premiumAmount != null && (
                                <span>
                                  {t('customerWorkflow:status.premium')}: {Number(app.premiumAmount).toFixed(2)} {t('common:unit.tnd', 'TND')}
                                </span>
                              )}
                            </div>
                          </div>
                          {action && (
                            <Button
                              size="sm"
                              variant={
                                [
                                  'PolicyContractGenerated',
                                  'AwaitingSignatureAndPayment',
                                ].includes(app.statusCode)
                                  ? 'tunis'
                                  : 'outline'
                              }
                              className={`shrink-0 ${
                                ![
                                  'PolicyContractGenerated',
                                  'AwaitingSignatureAndPayment',
                                ].includes(app.statusCode)
                                  ? 'border-tunis-blue/30 text-tunis-blue hover:bg-tunis-blue/5'
                                  : ''
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleNavigateToPolicyDetail(app.id);
                              }}
                            >
                              <action.icon className="h-4 w-4 me-1.5" />
                              {t(action.labelKey)}
                              <ChevronRight className="h-3.5 w-3.5 ms-1" />
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        {/* ─── Claims Tab ─── */}
        <TabsContent value="claims" className="mt-4">
          {claims.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center">
                <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
                <h3 className="text-lg font-semibold text-foreground mb-1">
                  {t('customerWorkflow:empty.noClaimTitle')}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {hasCompletedPolicies
                    ? t('customerWorkflow:empty.noClaimSubtitleWithPolicy')
                    : t('customerWorkflow:empty.noClaimSubtitleNoPolicy')}
                </p>
                {hasCompletedPolicies && (
                  <Button
                    variant="outline"
                    className="border-tunis-blue text-tunis-blue hover:bg-tunis-blue/5"
                    onClick={() => handleNavigateToClaim()}
                  >
                    <AlertCircle className="h-4 w-4 me-2" />
                    {t('customerWorkflow:fileClaim')}
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <ScrollArea className="max-h-[600px]">
              <div className="space-y-3">
                {claims.map((claim) => {
                  const action = getClaimAction(claim);
                  return (
                    <Card
                      key={claim.id}
                      className="card-hover-lift cursor-pointer"
                      onClick={() => handleNavigateToClaim(claim.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-sm font-mono text-muted-foreground">
                                CLM-{claim.id}
                              </span>
                              <ClaimStatusBadge status={claim.statusCode} />
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span>
                                {t('customerWorkflow:status.created')}:{' '}
                                {formatDate(claim.createdAt)}
                              </span>
                              {claim.lossAmount != null && (
                                <span>
                                  {t('customerWorkflow:status.loss')}: {safeToFixed(claim.lossAmount, 2)} {t('common:unit.tnd', 'TND')}
                                </span>
                              )}
                              {claim.lossDescription && (
                                <span className="truncate max-w-[200px]">
                                  {claim.lossDescription}
                                </span>
                              )}
                            </div>
                          </div>
                          {action && (
                            <Button
                              size="sm"
                              variant={
                                claim.statusCode === 'Open'
                                  ? 'tunis'
                                  : 'outline'
                              }
                              className={`shrink-0 ${
                                claim.statusCode !== 'Open'
                                  ? 'border-tunis-blue/30 text-tunis-blue hover:bg-tunis-blue/5'
                                  : ''
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleNavigateToClaim(claim.id);
                              }}
                            >
                              <action.icon className="h-4 w-4 me-1.5" />
                              {t(action.labelKey)}
                              <ChevronRight className="h-3.5 w-3.5 ms-1" />
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

