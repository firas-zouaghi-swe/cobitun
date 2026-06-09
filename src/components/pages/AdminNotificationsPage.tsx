'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bell, Check, CheckCheck, Trash2, Search, Filter, RefreshCw, AlertCircle, FileText, DollarSign, Shield, Loader2 } from 'lucide-react';
import { PageLoadingState, PageEmptyState, PageErrorState } from '@/components/shared/PageStates';
import { fetchWithAuth } from '@/hooks/use-auth';
import Protected from '@/components/Protected';
import { Roles } from '@/hooks/use-auth';
import { toast } from 'sonner';
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

interface Notification {
  id: number;
  notificationType: string;
  title: string;
  message: string;
  isRead: number;
  createdAt: string;
  parametricPolicyId?: number;
  parametricClaimId?: number;
}

export default function AdminNotificationsPage() {
  const { t } = useTranslation(['adminCommon', 'common']);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [markingReadId, setMarkingReadId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{open: boolean; title: string; description: string; onConfirm: () => void}>({open: false, title: '', description: '', onConfirm: () => {}});
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth('/api/admin/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      } else {
        setError(t('common:errors.failedToLoad', 'Failed to load data'));
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
      setError(t('common:errors.failedToLoad', 'Failed to load data'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const markAsRead = async (id: number) => {
    setMarkingReadId(id);
    try {
      const res = await fetchWithAuth(`/api/admin/notifications/${id}/read`, { method: 'PATCH' });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, isRead: 1 } : n));
      } else {
        toast.error(t('adminNotifications.failedMarkRead', 'Failed to mark as read'));
      }
    } catch (err) {
      console.error('Failed to mark as read:', err);
      toast.error(t('common:error.networkError', 'Network error'));
    } finally {
      setMarkingReadId(null);
    }
  };

  const markAllRead = async () => {
    setMarkingAllRead(true);
    try {
      const res = await fetchWithAuth('/api/admin/notifications/mark-all-read', { method: 'PATCH' });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: 1 })));
        toast.success(t('adminNotifications.allMarkedRead', 'All notifications marked as read'));
      } else {
        toast.error(t('adminNotifications.failedMarkAllRead', 'Failed to mark all as read'));
      }
    } catch (err) {
      console.error('Failed to mark all as read:', err);
      toast.error(t('common:error.networkError', 'Network error'));
    } finally {
      setMarkingAllRead(false);
    }
  };

  const performDeleteNotification = async (id: number) => {
    setDeletingId(id);
    try {
      const res = await fetchWithAuth(`/api/admin/notifications/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
        toast.success(t('adminNotifications.deleted', 'Notification deleted'));
      } else {
        toast.error(t('adminNotifications.failedDelete', 'Failed to delete notification'));
      }
    } catch (err) {
      console.error('Failed to delete notification:', err);
      toast.error(t('common:error.networkError', 'Network error'));
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = notifications.filter((n) => {
    if (filter === 'unread' && n.isRead) return false;
    if (filter === 'read' && !n.isRead) return false;
    if (typeFilter !== 'all' && n.notificationType !== typeFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return n.title.toLowerCase().includes(s) || n.message.toLowerCase().includes(s);
    }
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'claim_update': return <DollarSign className="h-4 w-4" />;
      case 'policy_update': return <Shield className="h-4 w-4" />;
      case 'action_required': return <AlertCircle className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'claim_update': return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
      case 'policy_update': return 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20';
      case 'action_required': return 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20';
      case 'warning': return 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20';
      default: return 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20';
    }
  };

  const notificationTypes = [...new Set(notifications.map((n) => n.notificationType))];

  return (
    <Protected roles={[Roles.ADMIN, Roles.SUPER_ADMIN]}>
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('adminNotifications.title', 'Notifications')}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {unreadCount > 0 ? t('adminNotifications.unreadCount', '{{count}} unread notification', { count: unreadCount }) : t('adminNotifications.allCaughtUp', 'All caught up!')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchNotifications}>
            <RefreshCw className="h-4 w-4 me-1" /> {t('common:action.refresh', 'Refresh')}
          </Button>
          {unreadCount > 0 && (
            <Button variant="tunis" size="sm" onClick={markAllRead} disabled={markingAllRead}>
              {markingAllRead ? <Loader2 className="h-4 w-4 me-1 animate-spin" /> : <CheckCheck className="h-4 w-4 me-1" />} {t('adminNotifications.markAllRead', 'Mark All Read')}
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card className="bg-card border-border">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('adminNotifications.searchPlaceholder', 'Search notifications...')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-background text-foreground"
              />
            </div>
            <div className="flex gap-1">
              {(['all', 'unread', 'read'] as const).map((f) => (
                <Button key={f} variant={filter === f ? 'default' : 'outline'} size="sm" onClick={() => setFilter(f)}>
                  {f === 'all' ? t('adminNotifications.filterAll', 'All') : f === 'unread' ? t('adminNotifications.filterUnread', 'Unread') : t('adminNotifications.filterRead', 'Read')}
                  {f === 'unread' && unreadCount > 0 && (
                    <Badge className="ms-1.5 bg-tunis-orange text-white text-[10px] px-1.5 py-0" title={t('adminNotifications.unreadCount', '{{count}} unread', { count: unreadCount })}>{unreadCount}</Badge>
                  )}
                </Button>
              ))}
            </div>
            <Select
              value={typeFilter}
              onValueChange={(v) => setTypeFilter(v)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t('adminNotifications.allTypes', 'All Types')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('adminNotifications.allTypes', 'All Types')}</SelectItem>
                {notificationTypes.map((nt) => (
                  <SelectItem key={nt} value={nt}>{nt.replace(/_/g, ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Notifications List */}
      <ScrollArea className="h-[calc(100vh-280px)]">
        {error ? (
          <PageErrorState message={error} onRetry={() => { setError(null); fetchNotifications(); }} />
        ) : loading ? (
          <PageLoadingState />
        ) : filtered.length === 0 ? (
          <PageEmptyState
            icon={<Bell className="h-8 w-8 text-muted-foreground" />}
            title={t('adminNotifications.noNotifications', 'No notifications found')}
            description={t('adminNotifications.noNotificationsDesc', 'There are no notifications matching your current filters.')}
          />
        ) : (
          <div className="space-y-2">
            {filtered.map((notification) => (
              <Card
                key={notification.id}
                className={`bg-card border-border transition-all hover:border-muted-foreground/30 ${
                  !notification.isRead ? 'border-l-2 border-l-tunis-orange' : ''
                }`}
              >
                <CardContent className="py-3 px-4">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg border ${getTypeColor(notification.notificationType)} mt-0.5`}>
                      {getTypeIcon(notification.notificationType)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className={`text-sm font-medium ${!notification.isRead ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {notification.title}
                        </h3>
                        {!notification.isRead && (
                          <span className="h-2 w-2 rounded-full bg-tunis-orange shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notification.message}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-[11px] text-muted-foreground">
                          {new Date(notification.createdAt).toLocaleString()}
                        </span>
                        <Badge variant="outline" className="text-[10px] h-5" title={notification.notificationType.replace(/_/g, ' ')}>
                          {notification.notificationType.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {!notification.isRead && (
                        <Button variant="ghost" size="sm" onClick={() => markAsRead(notification.id)} aria-label={t('adminNotifications.markAsRead', 'Mark as read')} disabled={markingReadId === notification.id}>
                          {markingReadId === notification.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 text-muted-foreground" />}
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => setConfirmDialog({open: true, title: t('adminNotifications.confirmDeleteTitle', 'Delete Notification'), description: t('adminNotifications.confirmDelete', 'Are you sure you want to delete this notification?'), onConfirm: () => performDeleteNotification(notification.id)})} aria-label={t('common:action.delete', 'Delete')} disabled={deletingId === notification.id}>
                        {deletingId === notification.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-muted-foreground hover:text-red-500 dark:hover:text-red-400" />}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>

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

