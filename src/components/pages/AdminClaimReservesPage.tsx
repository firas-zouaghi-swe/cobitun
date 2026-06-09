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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Landmark, Plus, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { fetchWithAuth, Roles } from '@/hooks/use-auth';
import Protected from '@/components/Protected';
import { PageErrorState, PageLoadingState, PageEmptyState } from '@/components/shared/PageStates';

interface ReserveEntry {
  id: number;
  reserveType: string;
  reserveAmount: number;
  previousAmount: number | null;
  adjustmentAmount: number | null;
  adjustmentReason: string;
  actuarialMethod: string | null;
  confidenceLevel: number | null;
  createdAt: string;
}

interface ClaimWithReserves {
  id: number;
  claimNumber: string;
  claimAmount: number;
  status: string;
  reserves: ReserveEntry[];
  policy?: { policyNumber: string };
}

const RESERVE_TYPES = ['CASE', 'IBNR', 'INCURRED', 'PAID', 'RECOVERED'];
const ACTUARIAL_METHODS = ['CHAIN_LADDER', 'BORNHUETTER_FERGUSON', 'CAPE_COD', 'MACK', 'BF_MODIFIED'];

const RESERVE_TYPE_STYLES: Record<string, string> = {
  CASE: 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/30',
  IBNR: 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/30',
  INCURRED: 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/30',
  PAID: 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800/30',
  RECOVERED: 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800/30',
};

export default function AdminClaimReservesPage() {
  const { t } = useTranslation('adminClaimReserves');
  const [paramClaims, setParamClaims] = useState<ClaimWithReserves[]>([]);
  const [cyberClaims, setCyberClaims] = useState<ClaimWithReserves[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedClaims, setExpandedClaims] = useState<Set<number>>(new Set());
  const [currentClaimId, setCurrentClaimId] = useState<number | null>(null);
  const [currentClaimType, setCurrentClaimType] = useState<'parametric' | 'cyber'>('parametric');

  // Form state
  const [reserveType, setReserveType] = useState('');
  const [reserveAmount, setReserveAmount] = useState('');
  const [actuarialMethod, setActuarialMethod] = useState('');
  const [confidenceLevel, setConfidenceLevel] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');

  const fetchParamClaims = async () => {
    setError(null);
    try {
      const res = await fetchWithAuth('/api/admin/parametric-claims');
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.error || `Request failed with status ${res.status}`);
      }
      const data = await res.json();
      setParamClaims(data.claims || []);
    } catch (err) {
      console.error('Failed to fetch parametric claims:', err);
      setError(t('errors.failedToLoad', 'Failed to load data'));
    }
  };

  const fetchCyberClaims = async () => {
    try {
      const res = await fetchWithAuth('/api/admin/cyber-claims');
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.error || `Request failed with status ${res.status}`);
      }
      const data = await res.json();
      setCyberClaims(data.claims || []);
    } catch (err) {
      console.error('Failed to fetch cyber claims:', err);
      setError(t('errors.failedToLoad', 'Failed to load data'));
    }
  };

  useEffect(() => {
    Promise.all([fetchParamClaims(), fetchCyberClaims()]).finally(() => setLoading(false));
  }, []);

  const toggleClaim = (id: number) => {
    setExpandedClaims((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openReserveDialog = (claimId: number, claimType: 'parametric' | 'cyber') => {
    setCurrentClaimId(claimId);
    setCurrentClaimType(claimType);
    setReserveType('');
    setReserveAmount('');
    setActuarialMethod('');
    setConfidenceLevel('');
    setAdjustmentReason('');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!reserveType || !reserveAmount) {
      toast.error(t('toast.requiredFields'));
      return;
    }
    if (!currentClaimId) return;

    setSaving(true);
    try {
      const endpoint = currentClaimType === 'parametric'
        ? `/api/admin/parametric-claims/${currentClaimId}/reserves`
        : `/api/admin/cyber-claims/${currentClaimId}/reserves`;

      const res = await fetchWithAuth(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reserveType,
          reserveAmount: parseFloat(reserveAmount),
          actuarialMethod: actuarialMethod || null,
          confidenceLevel: confidenceLevel ? parseFloat(confidenceLevel) : null,
          adjustmentReason: adjustmentReason.trim() || t('dialog.defaultReason'),
        }),
      });

      if (res.ok) {
        toast.success(t('toast.added'));
        setDialogOpen(false);
        if (currentClaimType === 'parametric') fetchParamClaims();
        else fetchCyberClaims();
      } else {
        const data = await res.json();
        toast.error(data.error || t('toast.addFailed'));
      }
    } catch {
      toast.error(t('toast.addFailed'));
    } finally {
      setSaving(false);
    }
  };

  const renderClaimsTable = (claims: ClaimWithReserves[], claimType: 'parametric' | 'cyber') => (
    <div className="space-y-2">
      {claims.length === 0 ? (
        <PageEmptyState
          icon={<Landmark className="h-10 w-10 opacity-30" />}
          title={t('empty.noClaims')}
        />
      ) : (
        claims.map((claim) => (
          <Card key={claim.id} className="shadow-sm">
            <div
              className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => toggleClaim(claim.id)}
            >
              <div className="flex items-center gap-3">
                {expandedClaims.has(claim.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <span className="font-mono font-semibold text-foreground">{claim.claimNumber}</span>
                <Badge variant="outline" title={claim.status} className="bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800/30 text-[10px]">
                  {claim.status}
                </Badge>
                <span className="text-muted-foreground text-sm">{Number(claim.claimAmount).toLocaleString()} {t('common:unit.tnd', 'TND')}</span>
              </div>
              <Button size="sm" variant="outline" className="text-xs" onClick={(e) => { e.stopPropagation(); openReserveDialog(claim.id, claimType); }} aria-label={"Add reserve for claim " + claim.claimNumber}>
                <Plus className="h-3 w-3 me-1" /> {t('addReserve')}
              </Button>
            </div>
            {expandedClaims.has(claim.id) && (
              <CardContent className="px-3 pb-3 pt-0">
                {claim.reserves && claim.reserves.length > 0 ? (
                  <table className="w-full text-xs">
                    <caption className="sr-only">{t('table.caption.reserves', 'Claim Reserves')}</caption>
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-start p-2 font-medium text-muted-foreground">{t('table.type')}</th>
                        <th className="text-start p-2 font-medium text-muted-foreground">{t('table.amount')}</th>
                        <th className="text-start p-2 font-medium text-muted-foreground">{t('table.previous')}</th>
                        <th className="text-start p-2 font-medium text-muted-foreground">{t('table.adjustment')}</th>
                        <th className="text-start p-2 font-medium text-muted-foreground">{t('table.method')}</th>
                        <th className="text-start p-2 font-medium text-muted-foreground">{t('table.confidence')}</th>
                        <th className="text-start p-2 font-medium text-muted-foreground">{t('table.reason')}</th>
                        <th className="text-start p-2 font-medium text-muted-foreground">{t('table.date')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {claim.reserves.map((r) => (
                        <tr key={r.id} className="border-b">
                          <td className="p-2">
                            <Badge variant="outline" title={t('reserveTypes.' + r.reserveType)} className={RESERVE_TYPE_STYLES[r.reserveType] || ''} style={{ fontSize: '10px' }}>
                              {t('reserveTypes.' + r.reserveType)}
                            </Badge>
                          </td>
                          <td className="p-2 font-medium">{Number(r.reserveAmount).toLocaleString()}</td>
                          <td className="p-2 text-muted-foreground">{r.previousAmount ? Number(r.previousAmount).toLocaleString() : '—'}</td>
                          <td className="p-2">
                            {r.adjustmentAmount !== null ? (
                              <span className={Number(r.adjustmentAmount) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                                {Number(r.adjustmentAmount) >= 0 ? '+' : ''}{Number(r.adjustmentAmount).toLocaleString()}
                              </span>
                            ) : '—'}
                          </td>
                          <td className="p-2 text-muted-foreground">{r.actuarialMethod ? t('actuarialMethods.' + r.actuarialMethod) : '—'}</td>
                          <td className="p-2 text-muted-foreground">{r.confidenceLevel ? `${Number(r.confidenceLevel) * 100}%` : '—'}</td>
                          <td className="p-2 text-muted-foreground max-w-32 truncate">{r.adjustmentReason}</td>
                          <td className="p-2 text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-muted-foreground text-xs py-4 text-center">{t('empty.noReserves')}</p>
                )}
              </CardContent>
            )}
          </Card>
        ))
      )}
    </div>
  );

  if (error) {
    return (
      <Protected roles={[Roles.ADMIN, Roles.SUPER_ADMIN]}>
        <PageErrorState message={error} onRetry={() => { fetchParamClaims(); fetchCyberClaims(); }} />
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
            <Landmark className="h-6 w-6 text-primary" /> {t('title')}
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
          <Card className="shadow-md">
            <CardContent className="p-4">
              {renderClaimsTable(paramClaims, 'parametric')}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cyber">
          <Card className="shadow-md">
            <CardContent className="p-4">
              {renderClaimsTable(cyberClaims, 'cyber')}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Reserve Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Landmark className="h-5 w-5 text-primary" />
              {t('dialog.addTitle')}
            </DialogTitle>
            <DialogDescription>
              {t('dialog.addDescription', { claimType: currentClaimType, claimId: currentClaimId })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="reserveType">{t('dialog.reserveType')}</Label>
                <Select value={reserveType} onValueChange={setReserveType}>
                  <SelectTrigger id="reserveType" className="mt-1">
                    <SelectValue placeholder={t('dialog.selectType')} />
                  </SelectTrigger>
                  <SelectContent>
                    {RESERVE_TYPES.map((rt) => (
                      <SelectItem key={rt} value={rt}>{t('reserveTypes.' + rt)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="reserveAmount">{t('dialog.reserveAmount')}</Label>
                <Input id="reserveAmount" type="number" step="0.01" placeholder="0.00" value={reserveAmount} onChange={(e) => setReserveAmount(e.target.value)} className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="actuarialMethod">{t('dialog.actuarialMethod')}</Label>
                <Select value={actuarialMethod} onValueChange={setActuarialMethod}>
                  <SelectTrigger id="actuarialMethod" className="mt-1">
                    <SelectValue placeholder={t('dialog.selectMethod')} />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTUARIAL_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>{t('actuarialMethods.' + m)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="confidenceLevel">{t('dialog.confidenceLevel')}</Label>
                <Input id="confidenceLevel" type="number" step="0.01" min="0" max="1" placeholder={t('dialog.confidenceLevelPlaceholder')} value={confidenceLevel} onChange={(e) => setConfidenceLevel(e.target.value)} className="mt-1" />
              </div>
            </div>
            <div>
              <Label htmlFor="adjustmentReason">{t('dialog.adjustmentReason')}</Label>
              <Input id="adjustmentReason" placeholder={t('dialog.adjustmentReasonPlaceholder')} value={adjustmentReason} onChange={(e) => setAdjustmentReason(e.target.value)} className="mt-1" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('common:action.cancel')}</Button>
            <Button onClick={handleSave} disabled={saving || !reserveType || !reserveAmount} variant="tunis">
              {saving ? t('dialog.saving') : t('addReserve')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </Protected>
  );
}

