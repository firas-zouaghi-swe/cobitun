'use client';

import { useEffect, useState } from 'react';
import { fetchWithAuth } from '@/hooks/use-auth';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useAppStore } from '@/lib/store';
import { formatCurrency } from '@/lib/i18n';
import { PageLoadingState, PageErrorState, PageEmptyState } from '@/components/shared/PageStates';
import { FieldError, RequiredIndicator } from '@/components/ui/form-warning';
import { Shield, Loader2, Banknote, Calendar } from 'lucide-react';
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

interface Policy {
  id: number;
  policyName: string;
  sumAssurance: number;
  premium: number;
  tenure: number;
  category?: { id: number; categoryName: string } | null;
}

interface Category {
  id: number;
  categoryName: string;
}

export default function CustomerApplyPolicyPage() {
  const { t } = useTranslation(['common', 'customerApplyPolicy']);
  const { user } = useAppStore();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [applyingId, setApplyingId] = useState<number | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [confirmDialog, setConfirmDialog] = useState<{open: boolean; title: string; description: string; onConfirm: () => void}>({open: false, title: '', description: '', onConfirm: () => {}});

  const clearFieldError = (field: string) => {
    if (fieldErrors[field]) {
      setFieldErrors((prev) => { const next = { ...prev }; delete next[field]; return next; });
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setError(null);
    try {
      const res = await fetchWithAuth('/api/customer/apply-policy');
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.error || `Request failed with status ${res.status}`);
      }
      const data = await res.json();
      setPolicies(data.policies || []);
      setCategories(data.categories || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      setError(t('errors.failedToLoad', 'Failed to load data'));
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async (policyId: number) => {
    setFieldErrors({});
    if (!user?.customerId) {
      setFieldErrors({ auth: t('common:error.authRequired') });
      toast.error(t('common:error.authRequired'));
      return;
    }
    setApplyingId(policyId);
    try {
      const res = await fetchWithAuth('/api/customer/apply-policy', {
        method: 'POST',

        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: user.customerId, policyId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || t('customerApplyPolicy:toast.applicationFailed'));
        return;
      }
      toast.success(t('customerApplyPolicy:toast.submitSuccess'));
    } catch {
      toast.error(t('customerApplyPolicy:toast.somethingWentWrong'));
    } finally {
      setApplyingId(null);
    }
  };

  const filteredPolicies = selectedCategory === 'all'
    ? policies
    : policies.filter((p) => p.category?.id === Number(selectedCategory));

  const displayPolicyName = (name: string) => {
    if (!name) return name;
    const normalized = name.trim().toLowerCase();
    if (normalized === 'parametric cloud outage') {
      return 'Traditional Cyber Indemnity Cover';
    }
    return name;
  };

  if (error) {
    return <PageErrorState message={error} onRetry={fetchData} />;
  }

  if (loading) {
    return <PageLoadingState message={t('customerApplyPolicy:loading', 'Loading policies…')} />;
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
        <h1 className="text-2xl font-bold">{t('customerApplyPolicy:title')}</h1>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger id="category-filter" className="w-48">
            <SelectValue placeholder={t('customerApplyPolicy:filterByCategory')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('customerApplyPolicy:allCategories')}</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={String(cat.id)}>
                {cat.categoryName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {fieldErrors.auth && (
        <div className="mb-4">
          <FieldError id="auth-error">{fieldErrors.auth}</FieldError>
        </div>
      )}

      {filteredPolicies.length === 0 ? (
        <PageEmptyState
          icon={<Shield className="h-8 w-8 text-muted-foreground" />}
          title={t('customerApplyPolicy:empty.noPolicies')}
          description={t('customerApplyPolicy:empty.noPoliciesDesc', 'No policies are currently available for application.')}
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPolicies.map((policy) => (
            <Card key={policy.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{displayPolicyName(policy.policyName)}</CardTitle>
                  <Badge
                    variant="secondary"
                    title={policy.category?.categoryName ?? t('customerApplyPolicy:card.unknownCategory', 'Uncategorized')}
                  >
                    {policy.category?.categoryName ?? t('customerApplyPolicy:card.unknownCategory', 'Uncategorized')}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Banknote className="h-4 w-4 text-primary" />
                  <span className="text-muted-foreground">{t('customerApplyPolicy:card.sumAssurance')}</span>
                  <span className="font-semibold">{formatCurrency(policy.sumAssurance)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Banknote className="h-4 w-4 text-primary" />
                  <span className="text-muted-foreground">{t('customerApplyPolicy:card.premium')}</span>
                  <span className="font-semibold">{formatCurrency(policy.premium)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-emerald-500" />
                  <span className="text-muted-foreground">{t('customerApplyPolicy:card.tenure')}</span>
                  <span className="font-semibold">{policy.tenure} {policy.tenure > 1 ? t('common:unit.years') : t('common:unit.year')}</span>
                </div>
                <Button
                  variant="tunis"
                  className="w-full mt-2"
                  onClick={() => setConfirmDialog({
                    open: true,
                    title: t('customerApplyPolicy:confirm.title'),
                    description: t('customerApplyPolicy:confirm.description'),
                    onConfirm: () => handleApply(policy.id)
                  })}
                  disabled={applyingId === policy.id}
                    aria-label={"Apply for " + displayPolicyName(policy.policyName)}
                >
                  {applyingId === policy.id ? (
                    <Loader2 className="me-2 h-4 w-4 animate-spin" />
                  ) : null}
                  {applyingId === policy.id ? t('customerApplyPolicy:card.applying') : t('customerApplyPolicy:card.applyNow')}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog(prev => ({...prev, open}))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDialog.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common:action.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDialog.onConfirm}>{t('common:action.confirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

