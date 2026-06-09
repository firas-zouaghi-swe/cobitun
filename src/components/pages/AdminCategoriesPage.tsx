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
import { Plus, Pencil, Trash2, FolderOpen, Loader2, Search, X } from 'lucide-react';
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
import { formatDate } from '@/lib/i18n';
import { useTranslation } from 'react-i18next';
import Protected from '@/components/Protected';
import { fetchWithAuth, Roles } from '@/hooks/use-auth';

interface Category {
  id: number;
  categoryName: string;
  createdAt: string;
  _count: { policies: number };
}

export default function AdminCategoriesPage() {
  const { t } = useTranslation(['adminCommon', 'common']);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editCategory, setEditCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [saving, setSaving] = useState(false);
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
    fetchCategories();
  }, [debouncedSearch]);

  const fetchCategories = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) {
        params.set('search', debouncedSearch);
      }
      const res = await fetchWithAuth(`/api/admin/categories?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load categories');
      const data = await res.json();
      setCategories(data.categories || []);
    } catch (err) {
      console.error('Failed to fetch categories:', err);
      setError(t('common:errors.failedToLoad', 'Failed to load categories. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const openCreateDialog = () => {
    setEditCategory(null);
    setCategoryName('');
    setFieldErrors({});
    setDialogOpen(true);
  };

  const openEditDialog = (category: Category) => {
    setEditCategory(category);
    setCategoryName(category.categoryName);
    setFieldErrors({});
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const errors: Record<string, string> = {};
    if (!categoryName.trim()) {
      errors.categoryName = t('common:validation.required');
    } else if (categoryName.trim().length < 2) {
      errors.categoryName = t('common:validation.minLength', { count: 2 });
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setSaving(true);
    try {
      if (editCategory) {
        const res = await fetchWithAuth('/api/admin/categories', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editCategory.id, categoryName: categoryName.trim() }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || t('adminCommon:updateFailed'));
          return;
        }
        toast.success(t('adminCommon:categories.updated'));
      } else {
        const res = await fetchWithAuth('/api/admin/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ categoryName: categoryName.trim() }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || t('adminCommon:createFailed'));
          return;
        }
        toast.success(t('adminCommon:categories.created'));
      }
      setDialogOpen(false);
      fetchCategories();
    } catch {
      toast.error(t('common:error.somethingWentWrong'));
    } finally {
      setSaving(false);
    }
  };

  const performDelete = async (id: number) => {
    try {
      const res = await fetchWithAuth(`/api/admin/categories?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || t('adminCommon:deleteFailed'));
        return;
      }
      toast.success(t('adminCommon:categories.deleted'));
      fetchCategories();
    } catch {
      toast.error(t('common:error.somethingWentWrong'));
    }
  };

  if (error) {
    return (
      <Protected roles={[Roles.ADMIN, Roles.SUPER_ADMIN]}>
        <PageErrorState message={error} onRetry={fetchCategories} />
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
        <h1 className="text-2xl font-bold">{t('adminCommon:categories.title')}</h1>
        <Button variant="tunis" onClick={openCreateDialog}>
          <Plus className="h-4 w-4 me-2" /> {t('adminCommon:categories.addCategory')}
        </Button>
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
              <caption className="sr-only">{t('adminCommon:categories.title')}</caption>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('common:label.name')}</TableHead>
                  <TableHead>{t('adminCommon:categories.policies')}</TableHead>
                  <TableHead>{t('adminCommon:categories.created')}</TableHead>
                  <TableHead className="text-end">{t('common:label.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-0 border-0">
                      <PageEmptyState
                        icon={<FolderOpen className="h-8 w-8 text-muted-foreground" />}
                        title={t('adminCommon:categories.noCategories')}
                        description={t('adminCommon:categories.noCategoriesDescription', 'Create your first category to organize policies.')}
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  categories.map((category) => (
                    <TableRow key={category.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <FolderOpen className="h-4 w-4 text-primary" />
                          {category.categoryName}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{category._count.policies}</Badge>
                      </TableCell>
                      <TableCell>{formatDate(category.createdAt)}</TableCell>
                      <TableCell className="text-end">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => openEditDialog(category)} aria-label={t('adminCommon:categories.editCategory', 'Edit category')}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => setConfirmDialog({open: true, title: t('adminCommon:categories.confirmDelete', 'Confirm Delete'), description: t('adminCommon:categories.confirmDeleteDescription', 'Are you sure you want to delete this category? This action cannot be undone.'), onConfirm: () => performDelete(category.id)})} aria-label={t('adminCommon:categories.deleteCategory', 'Delete category')}>
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
            <DialogTitle>{editCategory ? t('adminCommon:categories.editCategory') : t('adminCommon:categories.addCategory')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="categoryName">
                {t('adminCommon:categories.categoryName')} <RequiredIndicator />
              </Label>
              <Input
                id="categoryName"
                placeholder={t('adminCommon:categories.categoryNamePlaceholder')}
                value={categoryName}
                onChange={(e) => { setCategoryName(e.target.value); clearFieldError('categoryName'); }}
                onBlur={() => {
                  if (!categoryName.trim()) setFieldErrors(prev => ({...prev, categoryName: t('common:validation.required') }));
                  else if (categoryName.trim().length < 2) setFieldErrors(prev => ({...prev, categoryName: t('common:validation.minLength', { count: 2 })}));
                }}
                maxLength={255}
                aria-invalid={!!fieldErrors.categoryName}
                aria-describedby={fieldErrors.categoryName ? 'categoryName-error' : undefined}
              />
              <FieldError id="categoryName-error">{fieldErrors.categoryName}</FieldError>
            </div>
            <Button className="w-full" variant="tunis" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
              {saving ? t('adminCommon:categories.saving') : editCategory ? t('adminCommon:categories.updateCategory') : t('adminCommon:categories.createCategory')}
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

