/**
 * Admin Users Page
 * Simplified version for use in the main app
 */

'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users } from 'lucide-react';
import { Roles } from '@/lib/roles';
import { useAuth } from '@/hooks/use-auth';
import Protected from '@/components/Protected';

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

export default function AdminUsersPage() {
  const { t } = useTranslation(['adminCommon', 'common']);
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);

  return (
    <Protected>
      <div className="container mx-auto p-6 space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-2xl">{t('adminUsers.title')}</CardTitle>
              <p className="text-muted-foreground">{t('adminUsers.description')}</p>
            </div>
            <Button disabled={!user || (user.role !== Roles.ADMIN && user.role !== Roles.SUPER_ADMIN)}>
              <Users className="mr-2 h-4 w-4" />
              {t('adminUsers.createUser')}
            </Button>
          </CardHeader>
          <CardContent>
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center">
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
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </Protected>
  );
}
