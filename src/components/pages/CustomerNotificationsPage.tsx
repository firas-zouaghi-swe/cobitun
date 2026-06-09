'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bell, Check, CheckCheck, Trash2, Search, RefreshCw, AlertCircle, FileText, DollarSign, Shield } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { fetchWithAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import { PageErrorState, PageEmptyState, PageLoadingState } from '@/components/shared/PageStates';
import { formatDateTime } from '@/lib/i18n';
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
  isRead: boolean;
  createdAt: string;
  parametricPolicyId?: number;
  parametricClaimId?: number;
}

export default function CustomerNotificationsPage() {
  const { t } = useTranslation('common');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [confirmDialog, setConfirmDialog] = useState<{open: boolean; title: string; description: string; onConfirm: () => void}>({open: false, title: '', description: '', onConfirm: () => {}});

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth('/api/customer/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
      setError(t('errors.failedToLoad', 'Failed to load data'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const markAsRead = async (id: number) => {
    try {
      const res = await fetchWithAuth(`/api/customer/notifications/${id}`, { method: 'PATCH' });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
      } else {
        toast.error(t('notifications.failedMarkRead', 'Failed to mark as read'));
      }
    } catch (err) {
      console.error('Failed to mark as read:', err);
      toast.error(t('error.networkError', 'Network error'));
    }
  };

  const markAllRead = async () => {
    try {
      const res = await fetchWithAuth('/api/customer/notifications/mark-all-read', { method: 'PATCH' });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        toast.success(t('notifications.allMarkedRead', 'All notifications marked as read'));
      } else {
        toast.error(t('notifications.failedMarkAllRead', 'Failed to mark all as read'));
      }
    } catch (err) {
      console.error('Failed to mark all as read:', err);
      toast.error(t('error.networkError', 'Network error'));
    }
  };

  const performDeleteNotification = async (id: number) => {
    try {
      const res = await fetchWithAuth(`/api/customer/notifications/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
        toast.success(t('notifications.deleted', 'Notification deleted'));
      } else {
        toast.error(t('notifications.failedDelete', 'Failed to delete notification'));
      }
    } catch (err) {
      console.error('Failed to delete notification:', err);
      toast.error(t('error.networkError', 'Network error'));
    }
  };

  const filtered = notifications.filter((n) => {
    if (filter === 'unread' && n.isRead) return false;
    if (filter === 'read' && !n.isRead) return false;
    if (search.trim()) {
      const s = search.trim().toLowerCase();
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
      case 'payment_update': return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20';
      default: return 'bg-gray-500/10 text-gray-600 dark:text-gray-300 border-gray-500/20';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('notifications.title', 'Notifications')}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {unreadCount > 0 ? t('notifications.unreadCount', '{{count}} unread', { count: unreadCount }) : t('notifications.allCaughtUp', 'All caught up!')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchNotifications}>
            <RefreshCw className="h-4 w-4 me-1" /> {t('action.refresh', 'Refresh')}
          </Button>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllRead}>
              <CheckCheck className="h-4 w-4 me-1" /> {t('notifications.markAllRead', 'Mark All Read')}
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="notification-search" placeholder={t('notifications.searchPlaceholder', 'Search notifications...')} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
              <Label htmlFor="notification-search" className="sr-only">{t('notifications.searchPlaceholder', 'Search notifications...')}</Label>
            </div>
            <div className="flex gap-1">
              {(['all', 'unread', 'read'] as const).map((f) => {
                const filterLabels: Record<string, string> = {
                  all: t('filter.all', 'All'),
                  unread: t('filter.unread', 'Unread'),
                  read: t('filter.read', 'Read'),
                };
                return (
                  <Button key={f} variant={filter === f ? 'default' : 'outline'} size="sm" onClick={() => setFilter(f)} aria-pressed={filter === f}>
                    {filterLabels[f] || f}
                    {f === 'unread' && unreadCount > 0 && (
                      <Badge className="ms-1.5 bg-tunis-orange text-white text-[10px] px-1.5 py-0" title={t('notifications.unreadCount', '{{count}} unread', { count: unreadCount })}>{unreadCount}</Badge>
                    )}
                  </Button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <ScrollArea className="h-[calc(100vh-280px)]">
        {error ? (
          <PageErrorState message={error} onRetry={fetchNotifications} />
        ) : loading ? (
          <PageLoadingState message={t('notifications.loading', 'Loading notifications...')} />
        ) : filtered.length === 0 ? (
          <PageEmptyState
            icon={<Bell className="h-8 w-8 text-muted-foreground" />}
            title={t('notifications.noNotifications', 'No notifications')}
            description={t('notifications.noNotificationsDesc', 'You\'re all caught up! Check back later for new notifications.')}
          />
        ) : (
          <div className="space-y-2">
            {filtered.map((n) => (
              <Card key={n.id} className={`transition-all ${!n.isRead ? 'border-l-2 border-l-tunis-orange' : ''}`}>
                <CardContent className="py-3 px-4">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg border ${getTypeColor(n.notificationType)} mt-0.5`}>
                      {getTypeIcon(n.notificationType)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className={`text-sm font-medium ${!n.isRead ? 'text-foreground' : 'text-muted-foreground'}`}>{n.title}</h3>
                        {!n.isRead && <span className="h-2 w-2 rounded-full bg-tunis-orange shrink-0" />}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-[11px] text-muted-foreground">{formatDateTime(new Date(n.createdAt))}</span>
                        <Badge variant="outline" className="text-[10px] h-5" title={n.notificationType.replace(/_/g, ' ')}>{n.notificationType.replace(/_/g, ' ')}</Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {!n.isRead && (
                        <Button variant="ghost" size="sm" onClick={() => markAsRead(n.id)} aria-label={t('notifications.markAsRead', 'Mark as read')}><Check className="h-4 w-4 text-muted-foreground" /></Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => setConfirmDialog({open: true, title: t('notifications.confirmDeleteTitle', 'Delete Notification'), description: t('notifications.confirmDelete', 'Are you sure you want to delete this notification?'), onConfirm: () => performDeleteNotification(n.id)})} aria-label={t('notifications.delete', 'Delete notification')}><Trash2 className="h-4 w-4 text-muted-foreground hover:text-red-500 dark:hover:text-red-400" /></Button>
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
            <AlertDialogCancel>{t('action.cancel', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDialog.onConfirm}>{t('action.confirm', 'Confirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

