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
import { ShieldCheck, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { fetchWithAuth, Roles } from '@/hooks/use-auth';
import Protected from '@/components/Protected';
import { PageErrorState, PageLoadingState } from '@/components/shared/PageStates';

interface Treaty {
  id: number;
  treatyNumber: string;
  treatyName: string;
  reinsurerName: string;
  treatyType: string;
  cessionPct: number | null;
  status: string;
  treatyStartDate: string;
  treatyEndDate: string;
  _count?: { parametricReinsuranceCeded: number; cyberReinsuranceCeded: number };
}

interface CededEntry {
  id: number;
  treatyId: number;
  grossPremium: number;
  cededPremium: number;
  netPremium: number | null;
  grossClaimPaid: number | null;
  cededClaimPaid: number | null;
  recoveryAmount: number | null;
  parametricPolicy?: { id: number; policyNumber: string };
  cyberPolicy?: { id: number; policyNumber: string };
  treaty?: { id: number; treatyNumber: string; treatyName: string };
}

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800/30',
  PENDING: 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800/30',
  EXPIRED: 'bg-gray-50 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-800/30',
  CANCELLED: 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800/30',
};

const TREATY_TYPES = ['QUOTA_SHARE', 'SURPLUS', 'EXCESS_OF_LOSS', 'STOP_LOSS', 'FACULTATIVE'];

export default function AdminReinsurancePage() {
  const { t } = useTranslation('adminReinsurance');
  const [treaties, setTreaties] = useState<Treaty[]>([]);
  const [paramCeded, setParamCeded] = useState<CededEntry[]>([]);
  const [cyberCeded, setCyberCeded] = useState<CededEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [treatyNumber, setTreatyNumber] = useState('');
  const [treatyName, setTreatyName] = useState('');
  const [reinsurerName, setReinsurerName] = useState('');
  const [treatyType, setTreatyType] = useState('');
  const [cessionPct, setCessionPct] = useState('');
  const [treatyStartDate, setTreatyStartDate] = useState('');
  const [treatyEndDate, setTreatyEndDate] = useState('');
  const [status, setStatus] = useState('ACTIVE');

  const fetchTreaties = async () => {
    setError(null);
    try {
      const res = await fetchWithAuth('/api/admin/reinsurance/treaties');
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.error || `Request failed with status ${res.status}`);
      }
      const data = await res.json();
      setTreaties(data.treaties || []);
    } catch (err) {
      console.error('Failed to fetch treaties:', err);
      setError(t('errors.failedToLoad', 'Failed to load data'));
    }
  };

  const fetchParamCeded = async () => {
    try {
      const res = await fetchWithAuth('/api/admin/reinsurance/ceded/parametric');
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.error || `Request failed with status ${res.status}`);
      }
      const data = await res.json();
      setParamCeded(data.ceded || []);
    } catch (err) {
      console.error('Failed to fetch parametric ceded:', err);
    }
  };

  const fetchCyberCeded = async () => {
    try {
      const res = await fetchWithAuth('/api/admin/reinsurance/ceded/cyber');
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.error || `Request failed with status ${res.status}`);
      }
      const data = await res.json();
      setCyberCeded(data.ceded || []);
    } catch (err) {
      console.error('Failed to fetch cyber ceded:', err);
    }
  };

  useEffect(() => {
    Promise.all([fetchTreaties(), fetchParamCeded(), fetchCyberCeded()]).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!treatyNumber.trim() || !treatyName.trim() || !reinsurerName.trim() || !treatyType) {
      toast.error(t('toast.requiredFields'));
      return;
    }
    setSaving(true);
    try {
      const res = await fetchWithAuth('/api/admin/reinsurance/treaties', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          treatyNumber: treatyNumber.trim(),
          treatyName: treatyName.trim(),
          reinsurerName: reinsurerName.trim(),
          treatyType,
          cessionPct: cessionPct ? parseFloat(cessionPct) : null,
          treatyStartDate: treatyStartDate || null,
          treatyEndDate: treatyEndDate || null,
          status,
        }),
      });
      if (res.ok) {
        toast.success(t('toast.created'));
        setDialogOpen(false);
        resetForm();
        fetchTreaties();
      } else {
        const data = await res.json();
        toast.error(data.error || t('toast.createFailed'));
      }
    } catch {
      toast.error(t('toast.createFailed'));
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setTreatyNumber('');
    setTreatyName('');
    setReinsurerName('');
    setTreatyType('');
    setCessionPct('');
    setTreatyStartDate('');
    setTreatyEndDate('');
    setStatus('ACTIVE');
  };

  if (error) {
    return (
      <Protected roles={[Roles.ADMIN, Roles.SUPER_ADMIN]}>
        <PageErrorState message={error} onRetry={fetchTreaties} />
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
            <ShieldCheck className="h-6 w-6 text-primary" /> {t('title')}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{t('subtitle')}</p>
        </div>
        <Button
          onClick={() => { resetForm(); setDialogOpen(true); }}
          variant="tunis"
        >
          <Plus className="h-4 w-4 me-2" /> {t('createTreaty')}
        </Button>
      </div>

      <Tabs defaultValue="treaties" className="animate-fade-in-up">
        <TabsList className="mb-4">
          <TabsTrigger value="treaties">{t('tabs.treaties')}</TabsTrigger>
          <TabsTrigger value="parametric-ceded">{t('tabs.parametricCeded')}</TabsTrigger>
          <TabsTrigger value="cyber-ceded">{t('tabs.cyberCeded')}</TabsTrigger>
        </TabsList>

        <TabsContent value="treaties">
          <Card className="shadow-md">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">{t('table.caption.treaties', 'Reinsurance Treaties')}</caption>
                  <thead>
                    <tr className="border-b bg-muted/80">
                      <th className="text-start p-3 font-medium text-muted-foreground">{t('table.treatyNumber')}</th>
                      <th className="text-start p-3 font-medium text-muted-foreground">{t('table.name')}</th>
                      <th className="text-start p-3 font-medium text-muted-foreground">{t('table.reinsurer')}</th>
                      <th className="text-start p-3 font-medium text-muted-foreground">{t('table.type')}</th>
                      <th className="text-start p-3 font-medium text-muted-foreground">{t('table.cessionPct')}</th>
                      <th className="text-start p-3 font-medium text-muted-foreground">{t('table.period')}</th>
                      <th className="text-start p-3 font-medium text-muted-foreground">{t('table.status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {treaties.length === 0 ? (
                      <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">
                        <ShieldCheck className="h-10 w-10 mx-auto mb-2 opacity-30" />
                        {t('empty.noTreaties')}
                      </td></tr>
                    ) : (
                      treaties.map((tr) => (
                        <tr key={tr.id} className="border-b table-row-hover">
                          <td className="p-3 font-mono font-semibold text-foreground">{tr.treatyNumber}</td>
                          <td className="p-3 font-medium">{tr.treatyName}</td>
                          <td className="p-3">{tr.reinsurerName}</td>
                          <td className="p-3">
                            <Badge variant="outline" title={t('types.' + tr.treatyType)} className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/30 text-[10px]">
                              {t('types.' + tr.treatyType)}
                            </Badge>
                          </td>
                          <td className="p-3 text-muted-foreground">{tr.cessionPct ? `${tr.cessionPct}%` : '—'}</td>
                          <td className="p-3 text-muted-foreground text-xs">
                            {new Date(tr.treatyStartDate).toLocaleDateString()} — {new Date(tr.treatyEndDate).toLocaleDateString()}
                          </td>
                          <td className="p-3">
                            <Badge variant="outline" title={t('status.' + tr.status)} className={STATUS_STYLES[tr.status] || STATUS_STYLES.ACTIVE}>
                              <span className={`w-1.5 h-1.5 rounded-full me-1.5 ${tr.status === 'ACTIVE' ? 'bg-green-500' : tr.status === 'PENDING' ? 'bg-yellow-500' : 'bg-gray-400'}`} />
                              {t('status.' + tr.status)}
                            </Badge>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="parametric-ceded">
          <Card className="shadow-md">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">{t('table.caption.parametricCeded', 'Parametric Reinsurance Ceded')}</caption>
                  <thead>
                    <tr className="border-b bg-muted/80">
                      <th className="text-start p-3 font-medium text-muted-foreground">{t('table.treaty')}</th>
                      <th className="text-start p-3 font-medium text-muted-foreground">{t('table.policy')}</th>
                      <th className="text-start p-3 font-medium text-muted-foreground">{t('table.grossPremium')}</th>
                      <th className="text-start p-3 font-medium text-muted-foreground">{t('table.cededPremium')}</th>
                      <th className="text-start p-3 font-medium text-muted-foreground">{t('table.netPremium')}</th>
                      <th className="text-start p-3 font-medium text-muted-foreground">{t('table.grossClaim')}</th>
                      <th className="text-start p-3 font-medium text-muted-foreground">{t('table.cededClaim')}</th>
                      <th className="text-start p-3 font-medium text-muted-foreground">{t('table.recovery')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paramCeded.length === 0 ? (
                      <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">
                        <ShieldCheck className="h-10 w-10 mx-auto mb-2 opacity-30" />
                        {t('empty.noParametricCeded')}
                      </td></tr>
                    ) : (
                      paramCeded.map((c) => (
                        <tr key={c.id} className="border-b table-row-hover">
                          <td className="p-3 font-mono font-semibold text-foreground">{c.treaty?.treatyNumber || '—'}</td>
                          <td className="p-3 text-muted-foreground">{c.parametricPolicy?.policyNumber || '—'}</td>
                          <td className="p-3">{Number(c.grossPremium).toLocaleString()} {t('common:unit.tnd', 'TND')}</td>
                          <td className="p-3">{Number(c.cededPremium).toLocaleString()} {t('common:unit.tnd', 'TND')}</td>
                          <td className="p-3 text-muted-foreground">{c.netPremium !== null ? `${Number(c.netPremium).toLocaleString()} ${t('common:unit.tnd', 'TND')}` : '—'}</td>
                          <td className="p-3 text-muted-foreground">{c.grossClaimPaid !== null ? `${Number(c.grossClaimPaid).toLocaleString()} ${t('common:unit.tnd', 'TND')}` : '—'}</td>
                          <td className="p-3 text-muted-foreground">{c.cededClaimPaid !== null ? `${Number(c.cededClaimPaid).toLocaleString()} ${t('common:unit.tnd', 'TND')}` : '—'}</td>
                          <td className="p-3 text-muted-foreground">{c.recoveryAmount !== null ? `${Number(c.recoveryAmount).toLocaleString()} ${t('common:unit.tnd', 'TND')}` : '—'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cyber-ceded">
          <Card className="shadow-md">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">{t('table.caption.cyberCeded', 'Cyber Reinsurance Ceded')}</caption>
                  <thead>
                    <tr className="border-b bg-muted/80">
                      <th className="text-start p-3 font-medium text-muted-foreground">{t('table.treaty')}</th>
                      <th className="text-start p-3 font-medium text-muted-foreground">{t('table.policy')}</th>
                      <th className="text-start p-3 font-medium text-muted-foreground">{t('table.grossPremium')}</th>
                      <th className="text-start p-3 font-medium text-muted-foreground">{t('table.cededPremium')}</th>
                      <th className="text-start p-3 font-medium text-muted-foreground">{t('table.netPremium')}</th>
                      <th className="text-start p-3 font-medium text-muted-foreground">{t('table.grossClaim')}</th>
                      <th className="text-start p-3 font-medium text-muted-foreground">{t('table.cededClaim')}</th>
                      <th className="text-start p-3 font-medium text-muted-foreground">{t('table.recovery')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cyberCeded.length === 0 ? (
                      <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">
                        <ShieldCheck className="h-10 w-10 mx-auto mb-2 opacity-30" />
                        {t('empty.noCyberCeded')}
                      </td></tr>
                    ) : (
                      cyberCeded.map((c) => (
                        <tr key={c.id} className="border-b table-row-hover">
                          <td className="p-3 font-mono font-semibold text-foreground">{c.treaty?.treatyNumber || '—'}</td>
                          <td className="p-3 text-muted-foreground">{c.cyberPolicy?.policyNumber || '—'}</td>
                          <td className="p-3">{Number(c.grossPremium).toLocaleString()} {t('common:unit.tnd', 'TND')}</td>
                          <td className="p-3">{Number(c.cededPremium).toLocaleString()} {t('common:unit.tnd', 'TND')}</td>
                          <td className="p-3 text-muted-foreground">{c.netPremium !== null ? `${Number(c.netPremium).toLocaleString()} ${t('common:unit.tnd', 'TND')}` : '—'}</td>
                          <td className="p-3 text-muted-foreground">{c.grossClaimPaid !== null ? `${Number(c.grossClaimPaid).toLocaleString()} ${t('common:unit.tnd', 'TND')}` : '—'}</td>
                          <td className="p-3 text-muted-foreground">{c.cededClaimPaid !== null ? `${Number(c.cededClaimPaid).toLocaleString()} ${t('common:unit.tnd', 'TND')}` : '—'}</td>
                          <td className="p-3 text-muted-foreground">{c.recoveryAmount !== null ? `${Number(c.recoveryAmount).toLocaleString()} ${t('common:unit.tnd', 'TND')}` : '—'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Treaty Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              {t('dialog.createTitle')}
            </DialogTitle>
            <DialogDescription>
              {t('dialog.createDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="treatyNumber">{t('dialog.treatyNumber')}</Label>
                <Input id="treatyNumber" placeholder={t('dialog.treatyNumberPlaceholder')} value={treatyNumber} onChange={(e) => setTreatyNumber(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="treatyName">{t('dialog.treatyName')}</Label>
                <Input id="treatyName" placeholder={t('dialog.treatyNamePlaceholder')} value={treatyName} onChange={(e) => setTreatyName(e.target.value)} className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="reinsurerName">{t('dialog.reinsurerName')}</Label>
                <Input id="reinsurerName" placeholder={t('dialog.reinsurerNamePlaceholder')} value={reinsurerName} onChange={(e) => setReinsurerName(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="treatyType">{t('dialog.treatyType')}</Label>
                <Select value={treatyType} onValueChange={setTreatyType}>
                  <SelectTrigger id="treatyType" className="mt-1">
                    <SelectValue placeholder={t('dialog.selectType')} />
                  </SelectTrigger>
                  <SelectContent>
                    {TREATY_TYPES.map((tt) => (
                      <SelectItem key={tt} value={tt}>{t('types.' + tt)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="cessionPct">{t('dialog.cessionPct')}</Label>
                <Input id="cessionPct" type="number" step="0.01" placeholder={t('dialog.cessionPctPlaceholder')} value={cessionPct} onChange={(e) => setCessionPct(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="startDate">{t('dialog.startDate')}</Label>
                <Input id="startDate" type="date" value={treatyStartDate} onChange={(e) => setTreatyStartDate(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="endDate">{t('dialog.endDate')}</Label>
                <Input id="endDate" type="date" value={treatyEndDate} onChange={(e) => setTreatyEndDate(e.target.value)} className="mt-1" />
              </div>
            </div>
            <div>
              <Label htmlFor="status">{t('dialog.status')}</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="status" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">{t('status.ACTIVE')}</SelectItem>
                  <SelectItem value="PENDING">{t('status.PENDING')}</SelectItem>
                  <SelectItem value="EXPIRED">{t('status.EXPIRED')}</SelectItem>
                  <SelectItem value="CANCELLED">{t('status.CANCELLED')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>{t('common:action.cancel')}</Button>
            <Button onClick={handleSave} disabled={saving} variant="tunis">
              {saving ? t('dialog.creating') : t('createTreaty')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </Protected>
  );
}

