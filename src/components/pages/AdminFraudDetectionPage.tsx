'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import {
  AlertCircle,
  BarChart3,
  CheckCircle,
  Clock,
  Filter,
  Search,
  Shield,
  Trash2,
  Users,
  XCircle,
  Eye,
  Ban,
  Check,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import Protected from '@/components/Protected';
import { fetchWithAuth, Roles } from '@/hooks/use-auth';
import { useTranslation } from 'react-i18next';
import { PageLoadingState, PageErrorState } from '@/components/shared/PageStates';
import { toast } from 'sonner';

interface FraudDetectionResponse {
  users: Array<{
    id: number;
    username: string;
    email: string;
    firstName: string;
    lastName: string;
    companyName?: string;
    fraudScore: number;
    ruleScore: number;
    llmScore: number;
    verdict: 'LEGITIMATE' | 'REVIEW' | 'FAKE';
    riskFlags: string[];
    llmReasoning: string;
    scannedAt: string | null;
    adminAction?: string;
    adminRecommendation: string;
    createdAt: string;
  }>;
  pagination: { page: number; limit: number; total: number; totalPages: number };
  stats: {
    totalChecked: number;
    fakeDetected: number;
    needsReview: number;
    avgRiskScore: number;
    suspiciousIps: number;
  };
}

interface FraudUser {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  companyName?: string;
  fraudScore: number;
  ruleScore: number;
  llmScore: number;
  verdict: 'LEGITIMATE' | 'REVIEW' | 'FAKE';
  riskFlags: string[];
  llmReasoning: string;
  scannedAt: string | null;
  adminAction?: string;
  adminRecommendation: string;
  createdAt: string;
}

export default function AdminFraudDetectionPage() {
  const { setCurrentPage } = useAppStore();
  const { t } = useTranslation('adminFraud');
  const [data, setData] = useState<FraudDetectionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<FraudUser | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'fake' | 'review' | 'legitimate'>('all');
  const [currentPage, setCurrentPageNum] = useState(1);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isActionDialogOpen, setIsActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<'DELETE' | 'LOCK' | 'WHITELIST' | 'CONFIRM_FAKE' | 'CONFIRM_LEGIT'>('DELETE');
  const [actionReason, setActionReason] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
      });

      if (filter !== 'all') {
        params.append('filter', filter);
      }

      if (searchTerm) {
        params.append('search', searchTerm);
      }

      const res = await fetchWithAuth(`/api/admin/fraud-detection?${params}`);
      if (!res.ok) throw new Error('Failed to load fraud detection data');
      const result = await res.json();
      setData(result);
    } catch (err) {
      console.error('Failed to fetch fraud detection data:', err);
      setError(t('errors.failedToLoad', 'Failed to load fraud detection data. Please try again.'));
    } finally {
      setLoading(false);
    }
  }, [currentPage, filter, searchTerm, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
  }, []);

  const handleScanAll = async () => {
    setIsScanning(true);
    try {
      const res = await fetchWithAuth('/api/admin/fraud-detection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'scan-all' }),
      });

      if (!res.ok) throw new Error('Scan failed');

      const result = await res.json();
      toast.success(t('adminFraud:scan.success', 'Scan completed successfully'));

      // Refresh data
      setCurrentPageNum(1);
      fetchData();
    } catch (err) {
      console.error('Scan failed:', err);
      toast.error(t('adminFraud:scan.error', 'Failed to scan users. Please try again.'));
    } finally {
      setIsScanning(false);
    }
  };

  const handleScanUser = async (userId: number) => {
    setIsScanning(true);
    try {
      const res = await fetchWithAuth('/api/admin/fraud-detection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'scan-user', userId }),
      });

      if (!res.ok) throw new Error('User scan failed');

      toast.success(t('adminFraud:scan.userSuccess', 'User scanned successfully'));

      // Refresh data
      fetchData();
    } catch (err) {
      console.error('User scan failed:', err);
      toast.error(t('adminFraud:scan.userError', 'Failed to scan user. Please try again.'));
    } finally {
      setIsScanning(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser || !deleteReason.trim()) return;

    setIsDeleting(true);
    try {
      const res = await fetchWithAuth('/api/admin/fraud-detection/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUser.id,
          action: 'DELETE',
          reason: deleteReason,
        }),
      });

      if (!res.ok) throw new Error('Delete failed');

      toast.success(t('adminFraud:delete.success', 'User account deleted successfully'));
      setIsDeleteDialogOpen(false);
      setDeleteReason('');
      fetchData();
    } catch (err) {
      console.error('Delete failed:', err);
      toast.error(t('adminFraud:delete.error', 'Failed to delete user. Please try again.'));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUserAction = async () => {
    if (!selectedUser || !actionReason.trim()) return;

    try {
      const res = await fetchWithAuth('/api/admin/fraud-detection/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUser.id,
          action: actionType,
          reason: actionReason,
        }),
      });

      if (!res.ok) throw new Error('Action failed');

      const actionNames = {
        DELETE: t('adminFraud:actions.delete', 'Delete'),
        LOCK: t('adminFraud:actions.lock', 'Lock'),
        WHITELIST: t('adminFraud:actions.whitelist', 'Whitelist'),
        CONFIRM_FAKE: t('adminFraud:actions.confirmFake', 'Confirm Fake'),
        CONFIRM_LEGIT: t('adminFraud:actions.confirmLegit', 'Confirm Legitimate'),
      };

      toast.success(t('adminFraud:action.success', 'Action {{action}} completed successfully', { action: actionNames[actionType] }));
      setIsActionDialogOpen(false);
      setActionReason('');
      fetchData();
    } catch (err) {
      console.error('Action failed:', err);
      toast.error(t('adminFraud:action.error', 'Failed to perform action. Please try again.'));
    }
  };

  const getScoreColor = (score: number) => {
    if (score < 30) return 'text-green-500';
    if (score < 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getScoreBgColor = (score: number) => {
    if (score < 30) return 'bg-green-500';
    if (score < 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getVerdictColor = (verdict: string) => {
    switch (verdict) {
      case 'LEGITIMATE': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'REVIEW': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'FAKE': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
    }
  };

  const getRecommendation = (score: number) => {
    if (score >= 80) return t('adminFraud:recommendations.strongDelete', 'STRONG DELETE — Highly suspicious, immediate deletion recommended');
    if (score >= 60) return t('adminFraud:recommendations.delete', 'DELETE — High confidence fake, consider deletion');
    if (score >= 45) return t('adminFraud:recommendations.review', 'REVIEW — Suspicious, manual verification needed');
    if (score >= 30) return t('adminFraud:recommendations.monitor', 'MONITOR — Some risk, monitor activity');
    return t('adminFraud:recommendations.legitimate', 'LEGITIMATE — No action needed');
  };

  const formatFlags = (flags: string[]) => {
    return flags.map(flag => flag.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()));
  };

  if (loading && !data) {
    return (
      <Protected roles={[Roles.ADMIN, Roles.SUPER_ADMIN]}>
        <PageLoadingState message={t('adminFraud:loading', 'Loading fraud detection dashboard...')} />
      </Protected>
    );
  }

  if (error) {
    return (
      <Protected roles={[Roles.ADMIN, Roles.SUPER_ADMIN]}>
        <PageErrorState message={error} onRetry={() => fetchData()} />
      </Protected>
    );
  }

  return (
    <Protected roles={[Roles.ADMIN, Roles.SUPER_ADMIN]}>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-tunis-navy dark:text-white">{t('adminFraud:title', 'AI Fake Account Detection')}</h1>
          <Button onClick={handleScanAll} disabled={isScanning}>
            {isScanning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('adminFraud:scanning', 'Scanning...')}
              </>
            ) : (
              <>
                <BarChart3 className="mr-2 h-4 w-4" />
                {t('adminFraud:scanAll', 'Scan All Users')}
              </>
            )}
          </Button>
        </div>

        {/* Stats Cards */}
        {data && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('adminFraud:stats.totalChecked', 'Total Checked')}</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.stats.totalChecked}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('adminFraud:stats.fakeDetected', 'Fake Detected')}</CardTitle>
                <XCircle className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-500">{data.stats.fakeDetected}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('adminFraud:stats.needsReview', 'Needs Review')}</CardTitle>
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-500">{data.stats.needsReview}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('adminFraud:stats.avgRiskScore', 'Avg Risk Score')}</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.stats.avgRiskScore.toFixed(1)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('adminFraud:stats.suspiciousIps', 'Suspicious IPs')}</CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.stats.suspiciousIps}</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Search and Filter */}
        <Card className="border border-border/50 shadow-sm mb-6">
          <CardHeader className="pb-4 border-b border-border/50">
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              {t('adminFraud:search.title', 'Search & Filter')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4 mt-2">
              <div className="relative flex-1 group">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors duration-200" />
                <Input
                  placeholder={t('adminFraud:search.placeholder', 'Search by username, email, or company...')}
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPageNum(1);
                  }}
                  className="pl-8 h-9 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant={filter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setFilter('all');
                    setCurrentPageNum(1);
                  }}
                  className="h-8"
                >
                  {t('adminFraud:filters.all', 'All')}
                </Button>
                <Button
                  variant={filter === 'fake' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setFilter('fake');
                    setCurrentPageNum(1);
                  }}
                  className="h-8"
                >
                  {t('adminFraud:filters.fake', 'Fake')}
                </Button>
                <Button
                  variant={filter === 'review' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setFilter('review');
                    setCurrentPageNum(1);
                  }}
                  className="h-8"
                >
                  {t('adminFraud:filters.review', 'Review')}
                </Button>
                <Button
                  variant={filter === 'legitimate' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setFilter('legitimate');
                    setCurrentPageNum(1);
                  }}
                  className="h-8"
                >
                  {t('adminFraud:filters.legitimate', 'Legitimate')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Results Table */}
        {data && (
          <Card className="border border-border/50 shadow-sm">
            <CardHeader className="pb-4 border-b border-border/50">
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                {t('adminFraud:results.title', 'Flagged Accounts')}
              </CardTitle>
              <div className="text-sm text-muted-foreground">
                {t('adminFraud:results.showing', 'Showing {{start}}-{{end}} of {{total}} results', {
                  start: (currentPage - 1) * data.pagination.limit + 1,
                  end: Math.min(currentPage * data.pagination.limit, data.pagination.total),
                  total: data.pagination.total
                })}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto rounded-lg border border-border/50 bg-card/50 shadow-sm">
                <ScrollArea className="h-[600px] w-full">
                  <Table className="w-auto table-fixed">
                    <colgroup>
                      <col style={{ width: '240px' }} />
                      <col style={{ width: '100px' }} />
                      <col style={{ width: '100px' }} />
                      <col style={{ width: '180px' }} />
                      <col style={{ width: '260px' }} />
                      <col style={{ width: '120px' }} />
                      <col style={{ width: '120px' }} />
                    </colgroup>
                  <TableHeader>
                    <TableRow className="bg-muted/60 hover:bg-muted/70 transition-colors duration-150 ease-in-out border-b border-border/50">
                      <TableHead className="text-center">{t('adminFraud:table.user', 'User')}</TableHead>
                      <TableHead className="text-center">{t('adminFraud:table.score', 'Score')}</TableHead>
                      <TableHead className="text-center">{t('adminFraud:table.verdict', 'Verdict')}</TableHead>
                      <TableHead className="text-center">{t('adminFraud:table.flags', 'Risk Flags')}</TableHead>
                      <TableHead className="text-center">{t('adminFraud:table.recommendation', 'Recommendation')}</TableHead>
                      <TableHead className="text-center">{t('adminFraud:table.scanned', 'Scanned')}</TableHead>
                      <TableHead className="text-center">{t('adminFraud:table.actions', 'Actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.users.map((user) => (
                      <TableRow key={user.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors duration-150 ease-in-out">
                        <TableCell className="text-center">
                          <div className="space-y-1 text-left">
                            <div className="font-medium break-words">{user.username}</div>
                            <div className="text-sm text-muted-foreground break-words">{user.email}</div>
                            {user.companyName && (
                              <div className="text-sm text-muted-foreground break-words">{user.companyName}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <div className="relative h-5 w-5 rounded-full flex items-center justify-center bg-white/80 backdrop-blur-sm border border-border shadow-sm">
                              <span className={`text-xs font-bold ${getScoreColor(user.fraudScore)}`}>{user.fraudScore}</span>
                            </div>
                            <Progress value={user.fraudScore} className="w-12 h-2" />
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={`text-xs ${getVerdictColor(user.verdict)}`}>
                            {user.verdict === 'FAKE'
                              ? t('adminFraud:details.verdictFakeShort', 'Fake')
                              : user.verdict === 'REVIEW'
                              ? t('adminFraud:details.verdictReviewShort', 'Review')
                              : t('adminFraud:details.verdictLegitShort', 'Legit')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center whitespace-normal">
                          <div className="flex flex-wrap justify-center gap-1">
                            {user.riskFlags.length > 0 ? (
                              <>
                                {user.riskFlags.slice(0, 2).map((flag, idx) => (
                                  <Badge key={idx} variant="outline" className="text-xs">
                                    {formatFlags([flag])[0]}
                                  </Badge>
                                ))}
                                {user.riskFlags.length > 2 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{user.riskFlags.length - 2}
                                  </Badge>
                                )}
                              </>
                            ) : (
                              <span className="text-xs text-muted-foreground">{t('adminFraud:details.none', 'None')}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center whitespace-normal px-3">
                          <div className="text-xs">{getRecommendation(user.fraudScore)}</div>
                        </TableCell>
                        <TableCell className="text-center">
                          {user.scannedAt ? (
                            <div className="text-xs">
                              {new Date(user.scannedAt).toLocaleDateString()}
                            </div>
                          ) : (
                            <div className="text-xs text-muted-foreground">{t('adminFraud:details.notScanned', 'Not scanned')}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex gap-1 justify-center">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 hover:bg-primary/10"
                              onClick={() => {
                                setSelectedUser(user);
                                setIsActionDialogOpen(true);
                              }}
                              title={t('action.viewDetails', 'View Details')}
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 hover:bg-primary/10"
                              onClick={() => handleScanUser(user.id)}
                              disabled={isScanning}
                              title={t('adminFraud:action.rescan', 'Rescan')}
                            >
                              <BarChart3 className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 hover:bg-destructive/10"
                              onClick={() => {
                                setSelectedUser(user);
                                setIsDeleteDialogOpen(true);
                              }}
                              title={t('action.delete')}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  </Table>
                  </ScrollArea>
              </div>

              {/* Pagination */}
              {data.pagination.totalPages > 1 && (
                <div className="flex justify-between items-center mt-4">
                  <div className="text-sm text-muted-foreground">
                    {t('adminFraud:pagination.page', 'Page {{page}} of {{totalPages}}', {
                      page: data.pagination.page,
                      totalPages: data.pagination.totalPages
                    })}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPageNum(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      {t('adminFraud:pagination.prev', 'Previous')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPageNum(p => Math.min(data.pagination.totalPages, p + 1))}
                      disabled={currentPage === data.pagination.totalPages}
                    >
                      {t('adminFraud:pagination.next', 'Next')}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* User Details Dialog */}
        <Dialog open={isActionDialogOpen} onOpenChange={setIsActionDialogOpen}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t('adminFraud:details.title', 'User Details & Risk Analysis')}</DialogTitle>
              <DialogDescription>
                {selectedUser && `${selectedUser.username} (${selectedUser.email})`}
              </DialogDescription>
            </DialogHeader>

            {selectedUser && (
              <div className="space-y-8 p-2">
                {/* User Information */}
                <div className="bg-muted/30 p-4 rounded-lg border border-border">
                  <h3 className="text-lg font-semibold mb-3">{t('adminFraud:details.userInfo', 'User Information')}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground">{t('adminFraud:details.username', 'Username')}</div>
                      <div className="font-medium">{selectedUser.username}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">{t('adminFraud:details.email', 'Email')}</div>
                      <div className="font-medium">{selectedUser.email}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">{t('adminFraud:details.name', 'Name')}</div>
                      <div className="font-medium">{selectedUser.firstName} {selectedUser.lastName}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">{t('adminFraud:details.company', 'Company')}</div>
                      <div className="font-medium">{selectedUser.companyName || t('adminFraud:details.noCompany', 'No company')}</div>
                    </div>
                  </div>
                </div>
                {/* Verdict Status */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">{t('adminFraud:details.verdict', 'Verdict Status')}</h3>
                  <div className="bg-muted/30 p-4 rounded-lg border border-border">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm text-muted-foreground">{t('adminFraud:details.verdictLabel', 'Current Verdict')}</div>
                        <div className={`font-bold ${selectedUser.verdict === 'FAKE' ? 'text-red-500' : selectedUser.verdict === 'REVIEW' ? 'text-yellow-500' : 'text-green-500'}`}>
                          {selectedUser.verdict === 'FAKE' ? t('adminFraud:details.verdictFake', 'Fake Account') : 
                           selectedUser.verdict === 'REVIEW' ? t('adminFraud:details.verdictReview', 'Needs Review') : 
                           t('adminFraud:details.verdictLegitimate', 'Legitimate Account')}
                        </div>
                      </div>
                      <div className="overflow-x-auto rounded-lg border border-border/50 bg-card/50 shadow-sm">
                      <div className="text-sm text-muted-foreground">{t('adminFraud:details.lastScan', 'Last Scanned')}</div>
                        <div className="font-medium">
                          {selectedUser.scannedAt ? new Date(selectedUser.scannedAt).toLocaleString() : t('adminFraud:details.notScanned', 'Not scanned yet')}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Score Breakdown */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">{t('adminFraud:details.scores', 'Score Breakdown')}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-muted/30 p-4 rounded-lg border border-border">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium">{t('adminFraud:details.ruleScore', 'Rule Score')}</span>
                        <span className="text-sm font-bold">{selectedUser.ruleScore}</span>
                      </div>
                      <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-500 rounded-full transition-all duration-500" 
                          style={{ width: `${selectedUser.ruleScore}%` }}
                        ></div>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">{t('adminFraud:details.ruleBasedDetection', 'Rule-based detection')}</div>
                    </div>
                    <div className="bg-muted/30 p-4 rounded-lg border border-border">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium">{t('adminFraud:details.llmScore', 'AI Score')}</span>
                        <span className="text-sm font-bold">{selectedUser.llmScore}</span>
                      </div>
                      <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-purple-500 rounded-full transition-all duration-500" 
                          style={{ width: `${selectedUser.llmScore}%` }}
                        ></div>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">{t('adminFraud:details.aiAnalysis', 'AI/ML analysis')}</div>
                    </div>
                    <div className="bg-muted/30 p-4 rounded-lg border border-border">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium">{t('adminFraud:details.finalScore', 'Final Score')}</span>
                        <span className="text-sm font-bold">{selectedUser.fraudScore}</span>
                      </div>
                      <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${selectedUser.fraudScore >= 70 ? 'bg-red-500' : selectedUser.fraudScore >= 40 ? 'bg-yellow-500' : 'bg-green-500'}`} 
                          style={{ width: `${selectedUser.fraudScore}%` }}
                        ></div>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">{t('adminFraud:details.overallRiskLevel', 'Overall risk level')}</div>
                    </div>
                  </div>
                </div>

                {/* Risk Flags */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">{t('adminFraud:details.riskFlags', 'Risk Flags')}</h3>
                  <div className="flex flex-wrap gap-2 p-3 bg-muted/30 rounded-lg border border-border">
                    {selectedUser.riskFlags.length > 0 ? (
                      selectedUser.riskFlags.map((flag, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {formatFlags([flag])[0]}
                        </Badge>
                      ))
                    ) : (
                      <p className="text-muted-foreground text-sm">{t('adminFraud:details.noRiskFlags', 'No risk flags detected')}</p>
                    )}
                  </div>
                </div>

                {/* History */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">{t('adminFraud:details.history', 'Account History')}</h3>
                  <div className="bg-muted/30 p-4 rounded-lg border border-border">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-muted-foreground">{t('adminFraud:details.accountCreated', 'Account Created')}</div>
                        <div className="font-medium">{new Date(selectedUser.createdAt).toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">{t('adminFraud:details.lastLogin', 'Last Login')}</div>
                        <div className="font-medium">
                          {t('adminFraud:details.noLogin', 'No login recorded')}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* AI Reasoning */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">{t('adminFraud:details.reasoning', 'AI Reasoning')}</h3>
                  <div className="bg-muted/50 p-4 rounded-lg text-sm max-h-60 overflow-y-auto border border-border">
                    <div className="whitespace-pre-wrap">{selectedUser.llmReasoning || t('adminFraud:details.noReasoning', 'No AI reasoning available for this scan.')}</div>
                  </div>
                </div>

                {/* Actions */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">{t('adminFraud:details.actions', 'Actions')}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setActionType('CONFIRM_FAKE');
                        setActionReason('');
                        toast.info(t('adminFraud:actions.confirmFakeInfo', 'Mark this account as confirmed fake'));
                      }}
                      className="flex flex-col items-center justify-center h-24 p-2"
                    >
                      <XCircle className="h-6 w-6 mb-1 text-red-500" />
                      <span className="text-sm">{t('adminFraud:actions.confirmFake', 'Confirm Fake')}</span>
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setActionType('CONFIRM_LEGIT');
                        setActionReason('');
                        toast.info(t('adminFraud:actions.confirmLegitInfo', 'Mark this account as confirmed legitimate'));
                      }}
                      className="flex flex-col items-center justify-center h-24 p-2"
                    >
                      <CheckCircle className="h-6 w-6 mb-1 text-green-500" />
                      <span className="text-sm">{t('adminFraud:actions.confirmLegit', 'Confirm Legit')}</span>
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setActionType('LOCK');
                        setActionReason('');
                        toast.info(t('adminFraud:actions.lockInfo', 'Lock this account'));
                      }}
                      className="flex flex-col items-center justify-center h-24 p-2"
                    >
                      <Ban className="h-6 w-6 mb-1 text-yellow-500" />
                      <span className="text-sm">{t('adminFraud:actions.lock', 'Lock')}</span>
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setActionType('WHITELIST');
                        setActionReason('');
                        toast.info(t('adminFraud:actions.whitelistInfo', 'Add to whitelist'));
                      }}
                      className="flex flex-col items-center justify-center h-24 p-2"
                    >
                      <Check className="h-6 w-6 mb-1 text-blue-500" />
                      <span className="text-sm">{t('adminFraud:actions.whitelist', 'Whitelist')}</span>
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setActionType('DELETE');
                        setActionReason('');
                        toast.info(t('adminFraud:actions.deleteInfo', 'Delete this account'));
                      }}
                      className="flex flex-col items-center justify-center h-24 p-2"
                    >
                      <Trash2 className="h-6 w-6 mb-1 text-red-500" />
                      <span className="text-sm">{t('adminFraud:actions.delete', 'Delete')}</span>
                    </Button>
                  </div>
                </div>

                {/* Action Form */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">{t('adminFraud:details.actionForm', 'Take Action')}</h3>
                  <div className="space-y-6 bg-muted/30 p-4 rounded-lg border border-border">
                    <div>
                      <label className="text-sm font-medium mb-2 block">{t('adminFraud:details.actionType', 'Action Type')}</label>
                      <div className="mt-1">
                        <select
                          value={actionType}
                          onChange={(e) => setActionType(e.target.value as any)}
                          className="w-full p-3 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          <option value="DELETE">{t('adminFraud:actions.delete', 'Delete Account')}</option>
                          <option value="LOCK">{t('adminFraud:actions.lock', 'Lock Account')}</option>
                          <option value="WHITELIST">{t('adminFraud:actions.whitelist', 'Whitelist Account')}</option>
                          <option value="CONFIRM_FAKE">{t('adminFraud:actions.confirmFake', 'Confirm Fake')}</option>
                          <option value="CONFIRM_LEGIT">{t('adminFraud:actions.confirmLegit', 'Confirm Legitimate')}</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">{t('adminFraud:details.reason', 'Reason')}</label>
                      <textarea
                        value={actionReason}
                        onChange={(e) => setActionReason(e.target.value)}
                        placeholder={t('adminFraud:details.reasonPlaceholder', 'Enter reason for this action...')}
                        className="w-full p-3 border rounded-md mt-1 bg-background focus:outline-none focus:ring-2 focus:ring-primary min-h-[100px]"
                        rows={3}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {t('adminFraud:details.reasonHelp', 'Please provide a detailed reason for taking this action. This will be recorded in the audit log.')}
                      </p>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setIsActionDialogOpen(false)}>
                        {t('adminFraud:details.cancel', 'Cancel')}
                      </Button>
                      <Button onClick={handleUserAction} disabled={!actionReason.trim()}>
                        {t('adminFraud:details.confirm', 'Confirm Action')}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsActionDialogOpen(false)}>
                {t('adminFraud:details.close', 'Close')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('adminFraud:delete.title', 'Delete User Account')}</DialogTitle>
              <DialogDescription>
                {selectedUser && t('adminFraud:delete.description', 'Are you sure you want to delete the account for {{username}}? This action cannot be undone.', { username: selectedUser.username })}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">{t('adminFraud:delete.reason', 'Reason for deletion (minimum 10 characters)')}</label>
                <textarea
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder={t('adminFraud:delete.reasonPlaceholder', 'Enter reason for deleting this account...')}
                  className="w-full p-2 border rounded-md mt-1"
                  rows={3}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {t('adminFraud:delete.warning', 'This action is irreversible and will permanently delete the user account and all associated data.')}
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                  {t('adminFraud:delete.cancel', 'Cancel')}
                </Button>
                <Button onClick={handleDeleteUser} disabled={!deleteReason.trim() || isDeleting}>
                  {isDeleting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('adminFraud:deleting', 'Deleting...')}
                    </>
                  ) : (
                    <>
                      <Trash2 className="mr-2 h-4 w-4" />
                      {t('adminFraud:delete.confirm', 'Delete Account')}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Protected>
  );
}
