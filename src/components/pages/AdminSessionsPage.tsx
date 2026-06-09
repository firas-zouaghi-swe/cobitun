'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Protected from '@/components/Protected';
import { fetchWithAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Clock4, CheckCircle2, XCircle } from 'lucide-react';
import { PageLoadingState, PageEmptyState, PageErrorState } from '@/components/shared/PageStates';
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

interface SessionInfo {
  id: number;
  userId: number;
  username?: string | null;
  email?: string | null;
  sessionId: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  lastActiveAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : '—';
}

export default function AdminSessionsPage() {
  const { t } = useTranslation(['adminCommon', 'common']);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<number | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{open: boolean; sessionId: number | null}>({open: false, sessionId: null});

  const getStatus = (session: SessionInfo) => {
    if (session.revokedAt) return { label: t('adminSessions.statusRevoked', 'Revoked'), icon: XCircle, color: 'text-rose-500' };
    if (session.expiresAt && new Date(session.expiresAt).getTime() < Date.now()) return { label: t('adminSessions.statusExpired', 'Expired'), icon: Clock4, color: 'text-amber-500' };
    return { label: t('adminSessions.statusActive', 'Active'), icon: CheckCircle2, color: 'text-emerald-500' };
  };

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchWithAuth('/api/admin/sessions', { method: 'GET' });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        setError(result.error || t('adminSessions.unableToLoad', 'Unable to load sessions'));
        return;
      }

      const data = await response.json();
      setSessions(data.sessions || []);
    } catch (err) {
      console.error('Failed to load admin sessions', err);
      setError(t('adminSessions.unableToLoad', 'Unable to load sessions'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const revokeSession = async (id: number) => {
    setConfirmDialog({open: false, sessionId: null});
    setRevokingId(id);
    try {
      const response = await fetchWithAuth(`/api/customer/sessions/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        toast.error(result.error || t('adminSessions.unableToRevoke', 'Unable to revoke session'));
        return;
      }
      toast.success(t('adminSessions.sessionRevoked', 'Session revoked'));
      loadSessions();
    } catch (error) {
      console.error('Failed to revoke session', error);
      toast.error(t('adminSessions.unableToRevoke', 'Unable to revoke session'));
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <Protected roles={['ADMIN']}>
      <div className="space-y-6 page-enter">
        <div className="animate-fade-in-down">
          <h1 className="text-2xl font-bold mb-1">{t('adminSessions.title', 'Admin Session Activity')}</h1>
          <p className="text-muted-foreground text-sm">{t('adminSessions.description', 'Review all active user sessions and revoke suspicious access.')}</p>
        </div>

        <Card className="animate-fade-in-up">
          <CardHeader>
            <CardTitle>{t('adminSessions.sessions', 'Sessions')}</CardTitle>
            <CardDescription>{t('adminSessions.sessionsDescription', 'Sessions are recorded with user, IP, browser details, and last activity.')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <PageLoadingState />
            ) : error ? (
              <PageErrorState message={error} onRetry={loadSessions} />
            ) : sessions.length === 0 ? (
              <PageEmptyState
                icon={<Clock4 className="h-8 w-8 text-muted-foreground" />}
                title={t('adminSessions.noSessions', 'No sessions were found.')}
                description={t('adminSessions.noSessionsDesc', 'There are no user sessions to display at this time.')}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-0 text-sm">
                  <caption className="sr-only">{t('adminSessions.title', 'Admin Session Activity')}</caption>
                  <thead>
                    <tr className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="p-3">{t('adminSessions.status', 'Status')}</th>
                      <th className="p-3">{t('adminSessions.user', 'User')}</th>
                      <th className="p-3">{t('adminSessions.deviceBrowser', 'Device / Browser')}</th>
                      <th className="p-3">{t('adminSessions.ipAddress', 'IP Address')}</th>
                      <th className="p-3">{t('adminSessions.created', 'Created')}</th>
                      <th className="p-3">{t('adminSessions.lastActive', 'Last active')}</th>
                      <th className="p-3">{t('adminSessions.expires', 'Expires')}</th>
                      <th className="p-3 text-right">{t('adminSessions.action', 'Action')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((session) => {
                      const status = getStatus(session);
                      const Icon = status.icon;
                      return (
                        <tr key={session.id} className="border-t border-border even:bg-muted/50">
                          <td className="p-3 align-top">
                            <div className="flex items-center gap-2">
                              <Icon className={`${status.color} h-4 w-4`} />
                              <span className="font-medium">{status.label}</span>
                            </div>
                          </td>
                          <td className="p-3 align-top">
                            <div className="font-medium">{session.username || t('adminSessions.userLabel', 'User {{userId}}', { userId: session.userId })}</div>
                            <div className="text-xs text-muted-foreground">{session.email || t('adminSessions.noEmail', 'No email')}</div>
                          </td>
                          <td className="p-3 align-top max-w-[240px]">
                            <div className="whitespace-pre-wrap break-words">{session.userAgent || t('adminSessions.unknownDevice', 'Unknown device')}</div>
                          </td>
                          <td className="p-3 align-top">{session.ipAddress || t('adminSessions.unknown', 'Unknown')}</td>
                          <td className="p-3 align-top">{formatDate(session.createdAt)}</td>
                          <td className="p-3 align-top">{formatDate(session.lastActiveAt)}</td>
                          <td className="p-3 align-top">{formatDate(session.expiresAt)}</td>
                          <td className="p-3 align-top text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={!!session.revokedAt || revokingId === session.id}
                              onClick={() => setConfirmDialog({open: true, sessionId: session.id})}
                            >
                              {revokingId === session.id ? <Loader2 className="h-4 w-4 animate-spin" /> : t('adminSessions.revoke', 'Revoke')}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog(prev => ({...prev, open}))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('adminSessions.confirmRevoke', 'Revoke Session')}</AlertDialogTitle>
            <AlertDialogDescription>{t('adminSessions.confirmRevokeDescription', 'Are you sure you want to revoke this session? The user will be immediately logged out.')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common:action.cancel', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (confirmDialog.sessionId) revokeSession(confirmDialog.sessionId);
            }}>{t('adminSessions.revoke', 'Revoke')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Protected>
  );
}

