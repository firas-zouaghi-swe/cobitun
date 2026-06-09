'use client';

import { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Pencil, Trash2, Users, Loader2, Building2, Search, X } from 'lucide-react';
import { PageLoadingState, PageErrorState, PageEmptyState } from '@/components/shared/PageStates';
import { FieldError, RequiredIndicator } from '@/components/ui/form-warning';
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
import { useTranslation } from 'react-i18next';
import Protected from '@/components/Protected';
import { fetchWithAuth, Roles } from '@/hooks/use-auth';

interface Customer {
  id: number;
  userId: string;
  companyName: string;
  registrationNumber: string;
  taxId: string;
  mobile: string;
  address: string;
  createdAt: string;
  user: {
    id: number;
    username: string;
    firstName: string;
    lastName: string;
    email: string | null;
    role: string;
  };
}

export default function AdminCustomersPage() {
  const { t } = useTranslation(['adminCommon', 'common']);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    mobile: '',
    address: '',
    email: '',
    companyName: '',
    registrationNumber: '',
    taxId: '',
  });
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{open: boolean; title: string; description: string; onConfirm: () => void}>({open: false, title: '', description: '', onConfirm: () => {}});
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const clearFieldError = (field: string) => {
    setFieldErrors(prev => {
      const next = {...prev};
      delete next[field];
      return next;
    });
  };

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(value);
    }, 300);
  };

  useEffect(() => {
    fetchCustomers();
  }, [debouncedSearch]);

  const fetchCustomers = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) {
        params.set('search', debouncedSearch);
      }
      const res = await fetchWithAuth(`/api/admin/customers?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load customers');
      const data = await res.json();
      setCustomers(data.customers || []);
    } catch (err) {
      console.error('Failed to fetch customers:', err);
      setError(t('common:errors.failedToLoad', 'Failed to load customers. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (customer: Customer) => {
    setEditCustomer(customer);
    setEditForm({
      firstName: customer.user.firstName,
      lastName: customer.user.lastName,
      mobile: customer.mobile,
      address: customer.address,
      email: customer.user.email || '',
      companyName: customer.companyName || '',
      registrationNumber: customer.registrationNumber || '',
      taxId: customer.taxId || '',
    });
    setFieldErrors({});
    setDialogOpen(true);
  };

  const handleUpdate = async () => {
    if (!editCustomer) return;
    const errors: Record<string, string> = {};
    if (!editForm.firstName.trim()) errors.firstName = t('common:validation.required');
    if (!editForm.lastName.trim()) errors.lastName = t('common:validation.required');
    if (editForm.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editForm.email)) errors.email = t('common:validation.email.invalid');
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setSaving(true);
    try {
      const res = await fetchWithAuth('/api/admin/customers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editCustomer.id, ...editForm, firstName: editForm.firstName.trim(), lastName: editForm.lastName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || t('adminCommon:updateFailed'));
        return;
      }
      toast.success(t('adminCommon:customers.updated'));
      setDialogOpen(false);
      fetchCustomers();
    } catch {
      toast.error(t('common:error.somethingWentWrong'));
    } finally {
      setSaving(false);
    }
  };

  const performDelete = async (id: number) => {
    try {
      const res = await fetchWithAuth(`/api/admin/customers?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || t('adminCommon:deleteFailed'));
        return;
      }
      toast.success(t('adminCommon:customers.deleted'));
      fetchCustomers();
    } catch {
      toast.error(t('common:error.somethingWentWrong'));
    }
  };

  if (error) {
    return (
      <Protected roles={[Roles.ADMIN, Roles.SUPER_ADMIN]}>
        <PageErrorState message={error} onRetry={fetchCustomers} />
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
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold">{t('adminCommon:customers.title')}</h1>
        <Badge variant="outline" className="text-sm">
          <Users className="h-4 w-4 me-1" /> {customers.length} {t('common:label.total').toLowerCase()}
        </Badge>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="ps-9"
            placeholder={t('common:placeholder.search')}
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>
        {searchTerm && (
          <Button variant="ghost" size="sm" onClick={() => { setSearchTerm(''); setDebouncedSearch(''); }}>
            <X className="h-4 w-4 me-1" /> {t('common:action.clear')}
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <caption className="sr-only">{t('adminCommon:customers.title')}</caption>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('common:label.name')}</TableHead>
                  <TableHead>{t('adminCommon:customers.companyName')}</TableHead>
                  <TableHead>{t('common:label.email')}</TableHead>
                  <TableHead>{t('adminCommon:customers.registrationNumber')}</TableHead>
                  <TableHead>{t('common:label.mobile')}</TableHead>
                  <TableHead className="text-end">{t('common:label.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-0 border-0">
                      <PageEmptyState
                        icon={<Users className="h-8 w-8 text-muted-foreground" />}
                        title={t('adminCommon:customers.noCustomers')}
                        description={t('adminCommon:customers.noCustomersDescription', 'No customers found. Adjust your search or add a new customer.')}
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  customers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell className="font-medium">
                        {customer.user.firstName} {customer.user.lastName}
                      </TableCell>
                      <TableCell>
                        {customer.companyName ? (
                          <div className="flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 text-primary" />
                            <span>{customer.companyName}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>{customer.user.email || '-'}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {customer.registrationNumber || '—'}
                      </TableCell>
                      <TableCell>{customer.mobile}</TableCell>
                      <TableCell className="text-end">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleEdit(customer)} aria-label={t('adminCommon:customers.editCustomer', 'Edit customer')}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => setConfirmDialog({open: true, title: t('adminCommon:customers.confirmDelete', 'Confirm Delete'), description: t('adminCommon:customers.confirmDeleteDescription', 'Are you sure you want to delete this customer? This action cannot be undone.'), onConfirm: () => performDelete(customer.id)})} aria-label={t('adminCommon:customers.deleteCustomer', 'Delete customer')}>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('adminCommon:customers.editCustomer')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">
                  {t('common:label.firstName')} <RequiredIndicator />
                </Label>
                <Input id="firstName" value={editForm.firstName} onChange={(e) => { setEditForm((p) => ({ ...p, firstName: e.target.value })); clearFieldError('firstName'); }} onBlur={() => { if (!editForm.firstName.trim()) setFieldErrors(prev => ({...prev, firstName: t('common:validation.required') })); }} maxLength={255} aria-invalid={!!fieldErrors.firstName} aria-describedby={fieldErrors.firstName ? 'firstName-error' : undefined} />
                <FieldError id="firstName-error">{fieldErrors.firstName}</FieldError>
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">
                  {t('common:label.lastName')} <RequiredIndicator />
                </Label>
                <Input id="lastName" value={editForm.lastName} onChange={(e) => { setEditForm((p) => ({ ...p, lastName: e.target.value })); clearFieldError('lastName'); }} onBlur={() => { if (!editForm.lastName.trim()) setFieldErrors(prev => ({...prev, lastName: t('common:validation.required') })); }} maxLength={255} aria-invalid={!!fieldErrors.lastName} aria-describedby={fieldErrors.lastName ? 'lastName-error' : undefined} />
                <FieldError id="lastName-error">{fieldErrors.lastName}</FieldError>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyName">{t('adminCommon:customers.companyName')}</Label>
              <Input id="companyName" value={editForm.companyName} onChange={(e) => setEditForm((p) => ({ ...p, companyName: e.target.value }))} placeholder={t('adminCommon:customers.companyNamePlaceholder')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="registrationNumber">{t('adminCommon:customers.registrationNumber')}</Label>
                <Input id="registrationNumber" value={editForm.registrationNumber} onChange={(e) => setEditForm((p) => ({ ...p, registrationNumber: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="taxId">{t('adminCommon:customers.taxId')}</Label>
                <Input id="taxId" value={editForm.taxId} onChange={(e) => setEditForm((p) => ({ ...p, taxId: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t('common:label.email')}</Label>
              <Input id="email" value={editForm.email} onChange={(e) => { setEditForm((p) => ({ ...p, email: e.target.value })); clearFieldError('email'); }} onBlur={() => { if (editForm.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editForm.email)) setFieldErrors(prev => ({...prev, email: t('common:validation.email.invalid') })); }} maxLength={255} aria-invalid={!!fieldErrors.email} aria-describedby={fieldErrors.email ? 'email-error' : undefined} />
              <FieldError id="email-error">{fieldErrors.email}</FieldError>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mobile">{t('common:label.mobile')}</Label>
              <Input id="mobile" value={editForm.mobile} onChange={(e) => setEditForm((p) => ({ ...p, mobile: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">{t('common:label.address')}</Label>
              <Input id="address" value={editForm.address} onChange={(e) => setEditForm((p) => ({ ...p, address: e.target.value }))} />
            </div>
            <Button className="w-full" variant="tunis" onClick={handleUpdate} disabled={saving}>
              {saving ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
              {saving ? t('adminCommon:customers.saving') : t('adminCommon:customers.saveChanges')}
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

