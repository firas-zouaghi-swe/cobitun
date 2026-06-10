/**
 * Admin Users Page Wrapper
 * Handles server-side operations and passes data to the client component
 */

'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Users, Search, Plus, MoreVertical, Eye, UserCheck, UserX, Trash2, Shield, ShieldCheck, RefreshCw, AlertCircle, X,
} from 'lucide-react';
import { fetchWithAuth, useAuth } from '@/hooks/use-auth';
import Protected from '@/components/Protected';
import { Roles, Role } from '@/lib/roles';
import { toast } from 'sonner';
import { PasswordComplexityIndicator, validatePasswordComplexity } from '@/components/ui/password-complexity';
import { RequiredIndicator, FieldError } from '@/components/ui/form-warning';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface AdminUser {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: number;
  lastLoginAt: string | null;
  createdAt: string;
  role: string;
  roleName: string;
}

interface AdminUserDetail extends AdminUser {
  updatedAt: string;
  mfaEnabled: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface ConfirmDialogState {
  open: boolean;
  type: 'activate' | 'deactivate' | 'remove' | null;
  user: AdminUser | null;
}

/* ------------------------------------------------------------------ */
/*  Helper functions                                                    */
/* ------------------------------------------------------------------ */

/**
 * Check if actor can manage target role
 * Uses client-side RBAC wrapper
 */
function canManageRole(actorRole: string, targetRole: string): boolean {
  const permissions = {
    [Roles.SUPER_ADMIN]: [Roles.SUPER_ADMIN, Roles.ADMIN, Roles.CUSTOMER],
    [Roles.ADMIN]: [Roles.CUSTOMER], // Admin can only manage customers, not other admins
    [Roles.CUSTOMER]: []
  };

  return permissions[actorRole]?.includes(targetRole as Role) || false;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

interface AdminUsersPageProps {
  initialUsers: AdminUser[];
  pagination: Pagination;
  currentUserRole: string;
}

function AdminUsersPageClient({ initialUsers, pagination, currentUserRole }: AdminUsersPageProps) {
  const { t } = useTranslation(['adminCommon', 'common']);
  const { user } = useAuth();
  
  const [users, setUsers] = useState<AdminUser[]>(initialUsers);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(pagination?.page || 1);
  const [total, setTotal] = useState(pagination?.total || 0);
  const [totalPages, setTotalPages] = useState(pagination?.totalPages || 1);
  const [limit, setLimit] = useState(pagination?.limit || 20);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState<ConfirmDialogState>({ 
    open: false, 
    type: null, 
    user: null 
  });
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUserDetail | null>(null);
  const [createForm, setCreateForm] = useState({
    username: '',
    email: '',
    firstName: '',
    lastName: '',
    password: '',
    roleCode: Roles.ADMIN as Role,
  });
  const [editForm, setEditForm] = useState({
    id: 0,
    username: '',
    email: '',
    firstName: '',
    lastName: '',
    isActive: true,
    roleCode: Roles.ADMIN as Role,
  });
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [createPasswordErrors, setCreatePasswordErrors] = useState<string[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const unauthorized = !user || (user.role !== Roles.ADMIN && user.role !== Roles.SUPER_ADMIN);
  // Use the currentUserRole prop if available, otherwise use the user role from the hook
  const effectiveUserRole = currentUserRole || user?.role;

  // Load users from API
  const loadUsers = async (searchTerm = '', pageNum = page, limitNum = limit) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: limitNum.toString(),
      });

      if (searchTerm) {
        params.append('search', searchTerm);
      }

      const response = await fetchWithAuth(`/api/admin/users?${params}`);
      if (!response.ok) throw new Error(t('adminUsers.loadError'));

      const data = await response.json();
      setUsers(data.users);
      setTotal(data.pagination.total);
      setTotalPages(data.pagination.totalPages);
      setPage(data.pagination.page);
      setLimit(data.pagination.limit);
    } catch (error) {
      console.error('Failed to load users:', error);
      toast.error(t('adminUsers.loadError'));
    } finally {
      setLoading(false);
      setSearchLoading(false);
    }
  };

  // Load users on component mount
  useEffect(() => {
    if (users.length === 0) {
      const initLoadUsers = async () => {
        await loadUsers();
      };
      void initLoadUsers();
    }
  }, [users.length]);

  if (unauthorized) {
    return <div>{t('common:unauthorized', 'Unauthorized')}</div>;
  }

  // Search users
  const handleSearch = () => {
    if (searchLoading) return;
    setSearchLoading(true);
    setPage(1); // Reset to first page when searching
    loadUsers(search, 1, limit);
  };

  // Pagination
  const goToPage = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
    loadUsers(search, newPage, limit);
  };

  // Create user
  const handleCreateUser = async () => {
    // Validate form
    const errors: Record<string, string> = {};

    if (!createForm.username) errors.username = t('adminUsers.usernameRequired');
    if (!createForm.email) errors.email = t('adminUsers.emailRequired');
    if (!createForm.firstName) errors.firstName = t('adminUsers.firstNameRequired');
    if (!createForm.lastName) errors.lastName = t('adminUsers.lastNameRequired');
    if (!createForm.password) {
      errors.password = t('adminUsers.passwordRequired');
    } else {
      const passwordValidation = validatePasswordComplexity(createForm.password);
      if (!passwordValidation.valid) {
        errors.password = passwordValidation.failedRules.join(', ') || t('adminUsers.passwordInvalid');
      }
    }

    // Check role permissions
    if (!canManageRole(currentUserRole, createForm.roleCode)) {
      errors.roleCode = t('adminUsers.cannotAssignRole', `You cannot assign ${createForm.roleCode} role`);
    }

    if (Object.keys(errors).length > 0) {
      setCreateErrors(errors);
      return;
    }

    try {
      const response = await fetchWithAuth('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });

      if (!response.ok) {
        const error = await response.json();
        if (error.errors) {
          setCreateErrors(error.errors);
          return;
        }
        throw new Error(error.message || t('adminUsers.createError'));
      }

      const newUser = await response.json();
      setUsers([newUser, ...users]);
      setTotal(total + 1);
      setShowCreateDialog(false);
      setCreateForm({
        username: '',
        email: '',
        firstName: '',
        lastName: '',
        password: '',
        roleCode: Roles.ADMIN,
      });
      setCreateErrors({});
      toast.success(t('adminUsers.userCreated'));
    } catch (error) {
      console.error('Failed to create user:', error);
      toast.error(error instanceof Error ? error.message : t('adminUsers.createError'));
    }
  };

  // Edit user
  const handleEditUser = async () => {
    // Validate form
    const errors: Record<string, string> = {};

    if (!editForm.firstName) errors.firstName = t('adminUsers.firstNameRequired');
    if (!editForm.lastName) errors.lastName = t('adminUsers.lastNameRequired');
    if (!editForm.email) errors.email = t('adminUsers.emailRequired');

    // Check role permissions
    if (!canManageRole(currentUserRole, editForm.roleCode)) {
      errors.roleCode = t('adminUsers.cannotAssignRole', `You cannot assign ${editForm.roleCode} role`);
    }

    if (Object.keys(errors).length > 0) {
      setEditErrors(errors);
      return;
    }

    try {
      const response = await fetchWithAuth(`/api/admin/users/${editForm.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });

      if (!response.ok) {
        const error = await response.json();
        if (error.errors) {
          setEditErrors(error.errors);
          return;
        }
        throw new Error(error.message || t('adminUsers.updateError'));
      }

      const updatedUser = await response.json();
      setUsers(users.map(u => u.id === updatedUser.id ? updatedUser : u));
      setShowEditDialog(false);
      setEditErrors({});
      toast.success(t('adminUsers.userUpdated'));
    } catch (error) {
      console.error('Failed to update user:', error);
      toast.error(error instanceof Error ? error.message : t('adminUsers.updateError'));
    }
  };

  // Delete user
  const handleDeleteUser = async () => {
    if (!showConfirmDialog.user) return;

    try {
      const response = await fetchWithAuth(`/api/admin/users/${showConfirmDialog.user.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(t('adminUsers.deleteError'));
      }

      setUsers(users.filter(u => u.id !== showConfirmDialog.user!.id));
      setTotal(total - 1);
      setShowConfirmDialog({ open: false, type: null, user: null });
      toast.success(t('adminUsers.userDeleted'));
    } catch (error) {
      console.error('Failed to delete user:', error);
      toast.error(error instanceof Error ? error.message : t('adminUsers.deleteError'));
    }
  };

  // Activate user
  const handleActivateUser = async () => {
    if (!showConfirmDialog.user) return;

    try {
      const response = await fetchWithAuth(`/api/admin/users/${showConfirmDialog.user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: true }),
      });

      if (!response.ok) {
        throw new Error(t('adminUsers.activateError'));
      }

      const updatedUser = await response.json();
      setUsers(users.map(u => u.id === updatedUser.id ? updatedUser : u));
      setShowConfirmDialog({ open: false, type: null, user: null });
      toast.success(t('adminUsers.userActivated'));
    } catch (error) {
      console.error('Failed to activate user:', error);
      toast.error(error instanceof Error ? error.message : t('adminUsers.activateError'));
    }
  };

  // View user details
  const handleViewUser = async (id: number) => {
    try {
      const response = await fetchWithAuth(`/api/admin/users/${id}`);
      if (!response.ok) throw new Error(t('adminUsers.loadError'));

      const data = await response.json();
      setSelectedUser(data);
      setShowViewDialog(true);
    } catch (error) {
      console.error('Failed to load user details:', error);
      toast.error(t('adminUsers.loadError'));
    }
  };

  // Reset create form
  const resetCreateForm = () => {
    setCreateForm({
      username: '',
      email: '',
      firstName: '',
      lastName: '',
      password: '',
      roleCode: Roles.ADMIN,
    });
    setCreateErrors({});
    setCreatePasswordErrors([]);
  };

  // Reset edit form
  const resetEditForm = () => {
    setEditForm({
      id: 0,
      username: '',
      email: '',
      firstName: '',
      lastName: '',
      isActive: true,
      roleCode: Roles.ADMIN,
    });
    setEditErrors({});
  };

  // Open edit dialog
  const openEditDialog = (user: AdminUser) => {
    resetEditForm();
    setEditForm({
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isActive: user.isActive === 1,
      roleCode: user.role as Role,
    });
    setShowEditDialog(true);
  };

  // Open confirm dialog
  const openConfirmDialog = (user: AdminUser, type: 'activate' | 'deactivate' | 'remove') => {
    setShowConfirmDialog({ open: true, type, user });
  };

  // Close confirm dialog
  const closeConfirmDialog = () => {
    setShowConfirmDialog({ open: false, type: null, user: null });
  };

  // Handle create password input
  const handleCreatePassword = (password: string) => {
    setCreateForm({ ...createForm, password });

    if (!password) {
      setCreatePasswordErrors([]);
      return;
    }

    const validation = validatePasswordComplexity(password);
    if (!validation.valid) {
      setCreatePasswordErrors(validation.failedRules.map(rule => t(`validation.password.${rule}`, rule)));
    } else {
      setCreatePasswordErrors([]);
    }
  };

  return (
    <Protected>
      <div className="container mx-auto p-6 space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-2xl">{t('adminUsers.title')}</CardTitle>
              <p className="text-muted-foreground">{t('adminUsers.description')}</p>
            </div>
            <Button 
              onClick={() => setShowCreateDialog(true)}
              disabled={!canManageRole(currentUserRole, Roles.CUSTOMER) && !canManageRole(currentUserRole, Roles.SUPER_ADMIN)}
            >
              <Plus className="mr-2 h-4 w-4" />
              {t('adminUsers.createUser')}
            </Button>
          </CardHeader>
          <CardContent>
            <div className="flex space-x-2 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('adminUsers.searchPlaceholder')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-8"
                />
              </div>
              <Button onClick={handleSearch} disabled={searchLoading}>
                {searchLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('adminUsers.username')}</TableHead>
                    <TableHead>{t('adminUsers.name')}</TableHead>
                    <TableHead>{t('adminUsers.email')}</TableHead>
                    <TableHead>{t('adminUsers.role')}</TableHead>
                    <TableHead>{t('adminUsers.status')}</TableHead>
                    <TableHead>{t('adminUsers.lastLogin')}</TableHead>
                    <TableHead className="w-[100px]">{t('adminUsers.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                        </TableRow>
                      ))}
                    </>
                  ) : users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center">
                        {t('adminUsers.noUsers')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.username}</TableCell>
                        <TableCell>{user.firstName} {user.lastName}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Badge variant={user.role === Roles.SUPER_ADMIN ? 'default' : 'secondary'}>
                            {user.roleName}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.isActive ? 'default' : 'secondary'}>
                            {user.isActive ? t('adminUsers.active') : t('adminUsers.inactive')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : '-'}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleViewUser(user.id)}>
                                <Eye className="mr-2 h-4 w-4" />
                                {t('adminUsers.viewDetails')}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {canManageRole(currentUserRole, user.role) && (
                                user.isActive ? (
                                  <DropdownMenuItem 
                                    onClick={() => openConfirmDialog(user, 'deactivate')}
                                    className="text-destructive"
                                  >
                                    <UserX className="mr-2 h-4 w-4" />
                                    {t('adminUsers.deactivate')}
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem 
                                    onClick={() => openConfirmDialog(user, 'activate')}
                                    className="text-green-600"
                                  >
                                    <UserCheck className="mr-2 h-4 w-4" />
                                    {t('adminUsers.activate')}
                                  </DropdownMenuItem>
                                )
                              )}
                              {canManageRole(currentUserRole, user.role) && (
                                <DropdownMenuItem 
                                  onClick={() => openEditDialog(user)}
                                  disabled={!canManageRole(currentUserRole, user.role)}
                                >
                                  <Shield className="mr-2 h-4 w-4" />
                                  {t('adminUsers.edit')}
                                </DropdownMenuItem>
                              )}
                              {canManageRole(currentUserRole, user.role) && (
                                <DropdownMenuSeparator />
                              )}
                              {canManageRole(currentUserRole, user.role) && (
                                <DropdownMenuItem 
                                  onClick={() => openConfirmDialog(user, 'remove')}
                                  className="text-destructive"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  {t('adminUsers.delete')}
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between space-x-2 py-4">
                <div className="text-sm text-muted-foreground">
                  {t('adminUsers.showingResults', { start: (page - 1) * limit + 1, end: Math.min(page * limit, total), total })}
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToPage(page - 1)}
                    disabled={page <= 1}
                  >
                    {t('common:previous')}
                  </Button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const pageNum = i + 1;
                    return (
                      <Button
                        key={pageNum}
                        variant={page === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => goToPage(pageNum)}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToPage(page + 1)}
                    disabled={page >= totalPages}
                  >
                    {t('common:next')}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create User Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="sm:max-w-[525px]">
            <DialogHeader>
              <DialogTitle>{t('adminUsers.createUser')}</DialogTitle>
              <DialogDescription>
                {t('adminUsers.createUserDescription')}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="create-username">{t('adminUsers.username')}</Label>
                  <Input
                    id="create-username"
                    value={createForm.username}
                    onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                  />
                  {createErrors.username && <FieldError id="create-username-error">{createErrors.username}</FieldError>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="create-email">{t('adminUsers.email')}</Label>
                  <Input
                    id="create-email"
                    type="email"
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  />
                  {createErrors.email && <FieldError id="create-email-error">{createErrors.email}</FieldError>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="create-firstName">{t('adminUsers.firstName')}</Label>
                  <Input
                    id="create-firstName"
                    value={createForm.firstName}
                    onChange={(e) => setCreateForm({ ...createForm, firstName: e.target.value })}
                  />
                  {createErrors.firstName && <FieldError id="create-firstName-error">{createErrors.firstName}</FieldError>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="create-lastName">{t('adminUsers.lastName')}</Label>
                  <Input
                    id="create-lastName"
                    value={createForm.lastName}
                    onChange={(e) => setCreateForm({ ...createForm, lastName: e.target.value })}
                  />
                  {createErrors.lastName && <FieldError id="create-lastName-error">{createErrors.lastName}</FieldError>}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="create-password">{t('adminUsers.password')}</Label>
                <Input
                  id="create-password"
                  type="password"
                  value={createForm.password}
                  onChange={(e) => handleCreatePassword(e.target.value)}
                />
                {createErrors.password && <FieldError id="create-password-error">{createErrors.password}</FieldError>}
                {createPasswordErrors.length > 0 && (
                  <div className="text-sm text-red-500">
                    {createPasswordErrors.join(', ')}
                  </div>
                )}
                <PasswordComplexityIndicator password={createForm.password} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="create-role">{t('adminUsers.role')}</Label>
                <Select value={createForm.roleCode} onValueChange={(val) => setCreateForm({ ...createForm, roleCode: val as Role })}>
                  <SelectTrigger id="create-role" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {/* SUPER_ADMIN can create all types of users */}
                    {canManageRole(currentUserRole, Roles.SUPER_ADMIN) && (
                      <>
                        <SelectItem value={Roles.SUPER_ADMIN}>{t('adminUsers.superAdmin')}</SelectItem>
                        <SelectItem value={Roles.ADMIN}>{t('adminUsers.admin')}</SelectItem>
                        <SelectItem value={Roles.CUSTOMER}>{t('adminUsers.customer')}</SelectItem>
                      </>
                    )}
                    {/* ADMIN can only create customers */}
                    {canManageRole(currentUserRole, Roles.CUSTOMER) && (
                      <SelectItem value={Roles.CUSTOMER}>{t('adminUsers.customer')}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {createErrors.roleCode && <FieldError id="create-role-error">{createErrors.roleCode}</FieldError>}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                {t('common:cancel')}
              </Button>
              <Button onClick={handleCreateUser}>
                {t('adminUsers.createUser')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit User Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="sm:max-w-[525px]">
            <DialogHeader>
              <DialogTitle>{t('adminUsers.editUser')}</DialogTitle>
              <DialogDescription>
                {t('adminUsers.editUserDescription')}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-username">{t('adminUsers.username')}</Label>
                  <Input
                    id="edit-username"
                    value={editForm.username}
                    disabled
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-email">{t('adminUsers.email')}</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  />
                  {editErrors.email && <FieldError id="edit-email-error">{editErrors.email}</FieldError>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-firstName">{t('adminUsers.firstName')}</Label>
                  <Input
                    id="edit-firstName"
                    value={editForm.firstName}
                    onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                  />
                  {editErrors.firstName && <FieldError id="edit-firstName-error">{editErrors.firstName}</FieldError>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-lastName">{t('adminUsers.lastName')}</Label>
                  <Input
                    id="edit-lastName"
                    value={editForm.lastName}
                    onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                  />
                  {editErrors.lastName && <FieldError id="edit-lastName-error">{editErrors.lastName}</FieldError>}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-role">{t('adminUsers.role')}</Label>
                <Select value={editForm.roleCode} onValueChange={(val) => setEditForm({ ...editForm, roleCode: val as Role })}>
                  <SelectTrigger id="edit-role" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {/* SUPER_ADMIN can assign all roles */}
                    {canManageRole(currentUserRole, Roles.SUPER_ADMIN) && (
                      <>
                        <SelectItem value={Roles.SUPER_ADMIN}>{t('adminUsers.superAdmin')}</SelectItem>
                        <SelectItem value={Roles.ADMIN}>{t('adminUsers.admin')}</SelectItem>
                        <SelectItem value={Roles.CUSTOMER}>{t('adminUsers.customer')}</SelectItem>
                      </>
                    )}
                    {/* ADMIN can only assign customer role */}
                    {canManageRole(currentUserRole, Roles.CUSTOMER) && (
                      <SelectItem value={Roles.CUSTOMER}>{t('adminUsers.customer')}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {editErrors.roleCode && <FieldError id="edit-role-error">{editErrors.roleCode}</FieldError>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-status">{t('adminUsers.status')}</Label>
                <Select value={editForm.isActive ? 'active' : 'inactive'} onValueChange={(val) => setEditForm({ ...editForm, isActive: val === 'active' })}>
                  <SelectTrigger id="edit-status" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">{t('adminUsers.active')}</SelectItem>
                    <SelectItem value="inactive">{t('adminUsers.inactive')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                {t('common:cancel')}
              </Button>
              <Button onClick={handleEditUser}>
                {t('adminUsers.saveChanges')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Confirm Dialog */}
        <AlertDialog open={showConfirmDialog.open} onOpenChange={(open) => setShowConfirmDialog({ ...showConfirmDialog, open })}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {showConfirmDialog.type === 'activate' && t('adminUsers.activateUser')}
                {showConfirmDialog.type === 'deactivate' && t('adminUsers.deactivateUser')}
                {showConfirmDialog.type === 'remove' && t('adminUsers.deleteUser')}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {showConfirmDialog.type === 'activate' && t('adminUsers.activateUserConfirm', { username: showConfirmDialog.user?.username })}
                {showConfirmDialog.type === 'deactivate' && t('adminUsers.deactivateUserConfirm', { username: showConfirmDialog.user?.username })}
                {showConfirmDialog.type === 'remove' && t('adminUsers.deleteUserConfirm', { username: showConfirmDialog.user?.username })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={closeConfirmDialog}>
                {t('common:cancel')}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={
                  showConfirmDialog.type === 'activate' ? handleActivateUser :
                  showConfirmDialog.type === 'deactivate' || showConfirmDialog.type === 'remove' ? handleDeleteUser :
                  undefined
                }
                className={
                  showConfirmDialog.type === 'activate' ? '' :
                  showConfirmDialog.type === 'deactivate' ? 'bg-yellow-500 hover:bg-yellow-600' :
                  'bg-destructive hover:bg-destructive/90'
                }
              >
                {showConfirmDialog.type === 'activate' && t('adminUsers.activate')}
                {showConfirmDialog.type === 'deactivate' && t('adminUsers.deactivate')}
                {showConfirmDialog.type === 'remove' && t('adminUsers.delete')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* View User Dialog */}
        <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
          <DialogContent className="sm:max-w-[525px]">
            <DialogHeader>
              <DialogTitle>{t('adminUsers.viewUserDetails')}</DialogTitle>
              <DialogDescription>
                {t('adminUsers.viewUserDetailsDescription')}
              </DialogDescription>
            </DialogHeader>
            {selectedUser && (
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>{t('adminUsers.username')}</Label>
                    <p>{selectedUser.username}</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t('adminUsers.email')}</Label>
                    <p>{selectedUser.email}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>{t('adminUsers.firstName')}</Label>
                    <p>{selectedUser.firstName}</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t('adminUsers.lastName')}</Label>
                    <p>{selectedUser.lastName}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>{t('adminUsers.role')}</Label>
                    <Badge variant={selectedUser.role === Roles.SUPER_ADMIN ? 'default' : 'secondary'}>
                      {selectedUser.roleName}
                    </Badge>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t('adminUsers.status')}</Label>
                    <Badge variant={selectedUser.isActive ? 'default' : 'secondary'}>
                      {selectedUser.isActive ? t('adminUsers.active') : t('adminUsers.inactive')}
                    </Badge>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>{t('adminUsers.lastLogin')}</Label>
                    <p>
                      {selectedUser.lastLoginAt ? new Date(selectedUser.lastLoginAt).toLocaleString() : '-'}
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t('adminUsers.createdAt')}</Label>
                    <p>{new Date(selectedUser.createdAt).toLocaleString()}</p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>{t('adminUsers.updatedAt')}</Label>
                  <p>{new Date(selectedUser.updatedAt).toLocaleString()}</p>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowViewDialog(false)}>
                {t('common.close')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Protected>
  );
}

export default AdminUsersPageClient;
