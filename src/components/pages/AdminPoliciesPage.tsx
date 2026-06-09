'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/i18n';
import { Plus, Pencil, Trash2, FileText, Loader2, Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Protected from '@/components/Protected';
import { Roles, fetchWithAuth } from '@/hooks/use-auth';
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
import { FieldError, RequiredIndicator } from '@/components/ui/form-warning';

interface Category {
  id: number;
  categoryName: string;
}

interface Policy {
  id: number;
  policyName: string;
  sumAssurance: number;
  premium: number;
  tenure: number;
  categoryId: number;
  category: { id: number; categoryName: string };
  _count: { records: number };
}

export default function AdminPoliciesPage() {
  const { t } = useTranslation(['adminCommon', 'common']);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editPolicy, setEditPolicy] = useState<Policy | null>(null);
  const [form, setForm] = useState({ policyName: '', categoryId: '', sumAssurance: '', premium: '', tenure: '' });
  const [saving, setSaving] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{open: boolean; title: string; description: string; onConfirm: () => void}>({open: false, title: '', description: '', onConfirm: () => {}});
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const clearFieldError = (field: string) => {
    setFieldErrors(prev => {
      const next = {...prev};
      delete next[field];
      return next;
    });
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch policies independently so one failure doesn't lose the other's data
      try {
        const policiesRes = await fetchWithAuth('/api/admin/policies', { method: 'GET' });
        if (!policiesRes.ok) {
          const errorData = await policiesRes.json().catch(() => null);
          throw new Error(errorData?.error || `Request failed with status ${policiesRes.status}`);
        }
        const policiesData = await policiesRes.json();
        setPolicies(policiesData.policies || []);
      } catch (err) {
        console.error('Failed to fetch policies:', err);
        setError(t('errors.failedToLoad', 'Failed to load data'));
      }

      try {
        const categoriesRes = await fetchWithAuth('/api/admin/categories', { method: 'GET' });
        if (!categoriesRes.ok) {
          const errorData = await categoriesRes.json().catch(() => null);
          throw new Error(errorData?.error || `Request failed with status ${categoriesRes.status}`);
        }
        const categoriesData = await categoriesRes.json();
        setCategories(categoriesData.categories || []);
      } catch (err) {
        console.error('Failed to fetch categories:', err);
        setError(t('errors.failedToLoad', 'Failed to load data'));
      }
    } finally {
      setLoading(false);
    }
  };

  const openCreateDialog = () => {
    setEditPolicy(null);
    setForm({ policyName: '', categoryId: '', sumAssurance: '', premium: '', tenure: '' });
    setFieldErrors({});
    setDialogOpen(true);
  };

  const openEditDialog = (policy: Policy) => {
    setEditPolicy(policy);
    setForm({
      policyName: policy.policyName,
      categoryId: String(policy.categoryId),
      sumAssurance: policy.sumAssurance.toString(),
      premium: policy.premium.toString(),
      tenure: policy.tenure.toString(),
    });
    setFieldErrors({});
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const errors: Record<string, string> = {};
    if (!form.policyName.trim()) errors.policyName = t('common:validation.required');
    if (!form.categoryId) errors.categoryId = t('common:validation.required');
    if (!form.sumAssurance || Number(form.sumAssurance) <= 0) errors.sumAssurance = t('common:validation.required');
    if (!form.premium || Number(form.premium) <= 0) errors.premium = t('common:validation.required');
    if (!form.tenure || Number(form.tenure) <= 0) errors.tenure = t('common:validation.required');
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setSaving(true);
    try {
      if (editPolicy) {
        const res = await fetchWithAuth('/api/admin/policies', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editPolicy.id, ...form, policyName: form.policyName.trim() }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || t('adminCommon:updateFailed'));
          return;
        }
        toast.success(t('adminCommon:policies.updated'));
      } else {
        const res = await fetchWithAuth('/api/admin/policies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, policyName: form.policyName.trim() }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || t('adminCommon:createFailed'));
          return;
        }
        toast.success(t('adminCommon:policies.created'));
      }
      setDialogOpen(false);
      fetchData();
    } catch {
      toast.error(t('common:error.somethingWentWrong'));
    } finally {
      setSaving(false);
    }
  };

  const performDelete = async (id: number) => {
    try {
      const res = await fetchWithAuth(`/api/admin/policies?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || t('adminCommon:deleteFailed'));
        return;
      }
      toast.success(t('adminCommon:policies.deleted'));
      fetchData();
    } catch {
      toast.error(t('common:error.somethingWentWrong'));
    }
  };

  if (error) {
    return (
      <Protected roles={[Roles.ADMIN, Roles.SUPER_ADMIN]}>
        <PageErrorState message={error} onRetry={fetchData} />
      </Protected>
    );
  }

  if (loading) {
    return (
      <Protected roles={[Roles.ADMIN, Roles.SUPER_ADMIN]}>
        <PageLoadingState message={t('common:loading', 'Loading...')} />
      </Protected>
    );
  }

  return (
    <Protected roles={[Roles.ADMIN, Roles.SUPER_ADMIN]}>
      <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{t('adminCommon:policies.title')}</h1>
        <Button variant="tunis" onClick={openCreateDialog}>
          <Plus className="h-4 w-4 me-2" /> {t('adminCommon:policies.addPolicy')}
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <caption className="sr-only">{t('adminCommon:policies.title')}</caption>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('adminCommon:policies.policyName')}</TableHead>
                  <TableHead>{t('common:label.category')}</TableHead>
                  <TableHead>{t('adminCommon:policies.sumAssurance')}</TableHead>
                  <TableHead>{t('common:label.premium')}</TableHead>
                  <TableHead>{t('adminCommon:policies.tenure')}</TableHead>
                  <TableHead>{t('adminCommon:policies.applications')}</TableHead>
                  <TableHead className="text-end">{t('common:label.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {policies.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-0 border-0">
                      <PageEmptyState
                        icon={<FileText className="h-8 w-8 text-muted-foreground" />}
                        title={t('adminCommon:policies.noPolicies')}
                        description={t('adminCommon:policies.noPoliciesDescription', 'Create your first policy to get started.')}
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  policies.map((policy) => (
                    <TableRow key={policy.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-primary" />
                          {policy.policyName}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {policy.category?.categoryName ?? t('adminCommon:policies.unknownCategory', 'Uncategorized')}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatCurrency(policy.sumAssurance)}</TableCell>
                      <TableCell>{formatCurrency(policy.premium)}</TableCell>
                      <TableCell>{policy.tenure} {policy.tenure > 1 ? t('common:unit.years') : t('common:unit.year')}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{policy._count.records}</Badge>
                      </TableCell>
                      <TableCell className="text-end">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => openEditDialog(policy)} aria-label={t('adminCommon:policies.editPolicy', 'Edit policy')}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => setConfirmDialog({open: true, title: t('adminCommon:policies.confirmDelete', 'Confirm Delete'), description: t('adminCommon:policies.confirmDeleteDescription', 'Are you sure you want to delete this policy? This action cannot be undone.'), onConfirm: () => performDelete(policy.id)})} aria-label={t('adminCommon:policies.deletePolicy', 'Delete policy')}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editPolicy ? t('adminCommon:policies.editPolicy') : t('adminCommon:policies.addPolicy')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="policyName">
                {t('adminCommon:policies.policyName')} <RequiredIndicator />
              </Label>
              <Input
                id="policyName"
                placeholder={t('adminCommon:policies.policyNamePlaceholder')}
                value={form.policyName}
                onChange={(e) => { setForm((p) => ({ ...p, policyName: e.target.value })); clearFieldError('policyName'); }}
                onBlur={() => { if (!form.policyName.trim()) setFieldErrors(prev => ({...prev, policyName: t('common:validation.required') })); }}
                aria-invalid={!!fieldErrors.policyName}
                aria-describedby={fieldErrors.policyName ? 'policyName-error' : undefined}
              />
              <FieldError id="policyName-error">{fieldErrors.policyName}</FieldError>
            </div>
            <div className="space-y-2">
              <Label htmlFor="categoryId">
                {t('common:label.category')} <RequiredIndicator />
              </Label>
              <Select value={form.categoryId} onValueChange={(value) => { setForm((p) => ({ ...p, categoryId: value })); clearFieldError('categoryId'); }}>
                <SelectTrigger>
                  <SelectValue placeholder={t('adminCommon:policies.selectCategory')} />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={String(cat.id)}>
                      {cat.categoryName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sumAssurance">
                  {t('adminCommon:policies.sumAssurance')} <RequiredIndicator />
                </Label>
                <Input
                  id="sumAssurance"
                  type="number"
                  min="0"
                  placeholder={t('common:label.amount')}
                  value={form.sumAssurance}
                  onChange={(e) => { setForm((p) => ({ ...p, sumAssurance: e.target.value })); clearFieldError('sumAssurance'); }}
                  aria-invalid={!!fieldErrors.sumAssurance}
                  aria-describedby={fieldErrors.sumAssurance ? 'sumAssurance-error' : undefined}
                />
                <FieldError id="sumAssurance-error">{fieldErrors.sumAssurance}</FieldError>
              </div>
              <div className="space-y-2">
                <Label htmlFor="premium">
                  {t('common:label.premium')} <RequiredIndicator />
                </Label>
                <Input
                  id="premium"
                  type="number"
                  min="0"
                  placeholder={t('common:label.amount')}
                  value={form.premium}
                  onChange={(e) => { setForm((p) => ({ ...p, premium: e.target.value })); clearFieldError('premium'); }}
                  aria-invalid={!!fieldErrors.premium}
                  aria-describedby={fieldErrors.premium ? 'premium-error' : undefined}
                />
                <FieldError id="premium-error">{fieldErrors.premium}</FieldError>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tenure">
                  {t('adminCommon:policies.tenureYrs')} <RequiredIndicator />
                </Label>
                <Input
                  id="tenure"
                  type="number"
                  min="1"
                  placeholder={t('adminCommon:policies.yearsPlaceholder')}
                  value={form.tenure}
                  onChange={(e) => { setForm((p) => ({ ...p, tenure: e.target.value })); clearFieldError('tenure'); }}
                  aria-invalid={!!fieldErrors.tenure}
                  aria-describedby={fieldErrors.tenure ? 'tenure-error' : undefined}
                />
                <FieldError id="tenure-error">{fieldErrors.tenure}</FieldError>
              </div>
            </div>
            <Button className="w-full" variant="tunis" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
              {saving ? t('adminCommon:policies.saving') : editPolicy ? t('adminCommon:policies.updatePolicy') : t('adminCommon:policies.createPolicy')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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

