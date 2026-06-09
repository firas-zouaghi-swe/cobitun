'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Protected from '@/components/Protected';
import { fetchWithAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from '@/components/ui/input-otp';
import { Loader2, Clock4, CheckCircle2, XCircle, Shield, ShieldOff, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { PageLoadingState, PageEmptyState } from '@/components/shared/PageStates';
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

export default function CustomerSessionsPage() {
  const { t } = useTranslation('common');
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<number | null>(null);

  // MFA state
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaLoading, setMfaLoading] = useState(true);
  const [mfaSetupStep, setMfaSetupStep] = useState<'idle' | 'verify' | 'disabling'>('idle');
  const [mfaOtpCode, setMfaOtpCode] = useState('');
  const [mfaOtpLoading, setMfaOtpLoading] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{open: boolean; title: string; description: string; onConfirm: () => void}>({open: false, title: '', description: '', onConfirm: () => {}});

  const getStatus = (session: SessionInfo) => {
    if (session.revokedAt) return { label: t('sessions.statusRevoked', 'Revoked'), icon: XCircle, color: 'text-rose-500' };
    if (session.expiresAt && new Date(session.expiresAt).getTime() < Date.now()) return { label: t('sessions.statusExpired', 'Expired'), icon: Clock4, color: 'text-amber-500' };
    return { label: t('sessions.statusActive', 'Active'), icon: CheckCircle2, color: 'text-emerald-500' };
  };

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchWithAuth('/api/customer/sessions', { method: 'GET' });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        toast.error(result.error || t('error.unableToLoadSessions', 'Unable to load sessions'));
        return;
      }

      const data = await response.json();
      setSessions(data.sessions || []);
    } catch (error) {
      console.error('Failed to load sessions', error);
      toast.error(t('error.unableToLoadSessions', 'Unable to load sessions'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
    loadMfaStatus();
  }, [loadSessions]);

  const loadMfaStatus = async () => {
    setMfaLoading(true);
    try {
      const res = await fetchWithAuth('/api/auth/mfa/setup', { method: 'GET' });
      if (res.ok) {
        const data = await res.json();
        setMfaEnabled(data.enabled === true);
      }
    } catch {
      // silently ignore
    } finally {
      setMfaLoading(false);
    }
  };

  const handleEnableMfa = async () => {
    setMfaOtpLoading(true);
    try {
      const res = await fetchWithAuth('/api/auth/mfa/setup', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || t('sessions.failedSendCode', 'Failed to send verification code'));
        return;
      }
      setMfaSetupStep('verify');
      toast.success(t('sessions.codeSent', 'Verification code sent to your email'));
    } catch {
      toast.error(t('sessions.failedEnable2fa', 'Failed to enable two-factor authentication'));
    } finally {
      setMfaOtpLoading(false);
    }
  };

  const handleVerifyMfaOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mfaOtpCode.length !== 6) {
      toast.error(t('sessions.enter6Digit', 'Please enter the 6-digit verification code'));
      return;
    }
    setMfaOtpLoading(true);
    try {
      const res = await fetchWithAuth('/api/auth/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: mfaOtpCode, purpose: 'setup' }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || data.message || t('sessions.invalidCode', 'Invalid verification code'));
        return;
      }
      setMfaEnabled(true);
      setMfaSetupStep('idle');
      setMfaOtpCode('');
      toast.success(t('sessions.2faEnabled', 'Two-factor authentication enabled successfully!'));
    } catch {
      toast.error(t('sessions.verificationFailed', 'Verification failed. Please try again.'));
    } finally {
      setMfaOtpLoading(false);
    }
  };

  const performDisableMfa = async () => {
    setMfaOtpLoading(true);
    try {
      const res = await fetchWithAuth('/api/auth/mfa/setup', { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || t('sessions.failedDisable2fa', 'Failed to disable two-factor authentication'));
        return;
      }
      setMfaEnabled(false);
      setMfaSetupStep('idle');
      toast.success(t('sessions.2faDisabled', 'Two-factor authentication disabled'));
    } catch {
      toast.error(t('sessions.failedDisable2fa', 'Failed to disable two-factor authentication'));
    } finally {
      setMfaOtpLoading(false);
    }
  };

  const performRevokeSession = async (id: number) => {
    setRevokingId(id);
    try {
      const response = await fetchWithAuth(`/api/customer/sessions/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        toast.error(result.error || t('sessions.unableToRevoke', 'Unable to revoke session'));
        return;
      }
      toast.success(t('sessions.sessionRevoked', 'Session revoked'));
      loadSessions();
    } catch (error) {
      console.error('Failed to revoke session', error);
      toast.error(t('sessions.unableToRevoke', 'Unable to revoke session'));
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <Protected>
      <>
      <div className="space-y-6 page-enter">
        <div className="animate-fade-in-down">
          <h1 className="text-2xl font-bold mb-1">{t('sessions.securitySettings', 'Security Settings')}</h1>
          <p className="text-muted-foreground text-sm">{t('sessions.securityDescription', 'Manage your account security, two-factor authentication, and active sessions.')}</p>
        </div>

        {/* MFA / Two-Factor Authentication Card */}
        <Card className="animate-fade-in-up">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {mfaEnabled ? <Shield className="h-5 w-5 text-emerald-500" /> : <ShieldOff className="h-5 w-5 text-amber-500" />}
              {t('sessions.twoFactorAuth', 'Two-Factor Authentication')}
            </CardTitle>
            <CardDescription>
              {t('sessions.2faDescription', "Add an extra layer of security to your account. When enabled, you'll need to enter a verification code from your email each time you sign in.")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {mfaLoading ? (
              <PageLoadingState message={t('sessions.loadingMfa', 'Loading security settings...')} />
            ) : mfaSetupStep === 'verify' ? (
              <form onSubmit={handleVerifyMfaOtp} className="space-y-4">
                <div className="flex flex-col items-center space-y-3">
                  <Mail className="h-8 w-8 text-tunis-blue" />
                  <p className="text-sm text-muted-foreground text-center">
                    {t('sessions.2faCodeSent', 'A 6-digit verification code has been sent to your email. Enter it below to confirm two-factor authentication.')}
                  </p>
                  <InputOTP maxLength={6} value={mfaOtpCode} onChange={setMfaOtpCode} disabled={mfaOtpLoading}>
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                    </InputOTPGroup>
                    <InputOTPSeparator />
                    <InputOTPGroup>
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                <div className="flex gap-3 justify-center">
                  <Button type="submit" disabled={mfaOtpCode.length !== 6 || mfaOtpLoading}>
                    {mfaOtpLoading ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : <CheckCircle2 className="h-4 w-4 me-2" />}
                    {t('sessions.verifyEnable', 'Verify & Enable')}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => { setMfaSetupStep('idle'); setMfaOtpCode(''); }} disabled={mfaOtpLoading}>
                    {t('action.cancel', 'Cancel')}
                  </Button>
                </div>
              </form>
            ) : mfaEnabled ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" /> {t('status.active', 'Enabled')}
                  </span>
                  <span className="text-sm text-muted-foreground">{t('sessions.emailOtp', 'Email OTP verification')}</span>
                </div>
                <Button variant="outline" size="sm" onClick={() => setConfirmDialog({open: true, title: t('sessions.confirmDisable2faTitle', 'Disable Two-Factor Authentication'), description: t('sessions.confirmDisable2fa', 'Are you sure you want to disable two-factor authentication? This will make your account less secure.'), onConfirm: performDisableMfa})} disabled={mfaOtpLoading}>
                  {mfaOtpLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('action.disable', 'Disable')}
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                    <XCircle className="h-3.5 w-3.5" /> {t('status.inactive', 'Disabled')}
                  </span>
                  <span className="text-sm text-muted-foreground">{t('sessions.lessSecure', 'Your account is less secure without 2FA')}</span>
                </div>
                <Button size="sm" variant="tunis" onClick={handleEnableMfa} disabled={mfaOtpLoading}>
                  {mfaOtpLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4 me-1.5" />}
                  {t('sessions.enable2fa', 'Enable 2FA')}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="animate-fade-in-up">
          <CardHeader>
            <CardTitle>{t('sessions.activeSessions', 'Active sessions')}</CardTitle>
            <CardDescription>{t('sessions.sessionsRecorded', 'Sessions are recorded with IP, browser details, and last activity.')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <PageLoadingState message={t('sessions.loadingSessions', 'Loading sessions...')} />
            ) : sessions.length === 0 ? (
              <PageEmptyState
                icon={<Clock4 className="h-8 w-8 text-muted-foreground" />}
                title={t('sessions.noActiveSessions', 'No active sessions')}
                description={t('sessions.noActiveSessionsDesc', 'No active sessions were found for your account.')}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-0 text-sm">
                  <caption className="sr-only">{t('sessions.activeSessions', 'Active sessions')}</caption>
                  <thead>
                    <tr className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="p-3">{t('label.status', 'Status')}</th>
                      <th className="p-3">{t('sessions.deviceBrowser', 'Device / Browser')}</th>
                      <th className="p-3">{t('sessions.ipAddress', 'IP Address')}</th>
                      <th className="p-3">{t('sessions.created', 'Created')}</th>
                      <th className="p-3">{t('sessions.lastActive', 'Last active')}</th>
                      <th className="p-3">{t('sessions.expires', 'Expires')}</th>
                      <th className="p-3 text-right">{t('sessions.action', 'Action')}</th>
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
                          <td className="p-3 align-top max-w-[240px]">
                            <div className="whitespace-pre-wrap break-words">{session.userAgent || t('sessions.unknownDevice', 'Unknown device')}</div>
                          </td>
                          <td className="p-3 align-top">{session.ipAddress || t('sessions.unknown', 'Unknown')}</td>
                          <td className="p-3 align-top">{formatDate(session.createdAt)}</td>
                          <td className="p-3 align-top">{formatDate(session.lastActiveAt)}</td>
                          <td className="p-3 align-top">{formatDate(session.expiresAt)}</td>
                          <td className="p-3 align-top text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={!!session.revokedAt || revokingId === session.id}
                              onClick={() => setConfirmDialog({open: true, title: t('sessions.confirmRevokeTitle', 'Revoke Session'), description: t('sessions.confirmRevoke', 'Are you sure you want to revoke this session? You will be logged out from that device.'), onConfirm: () => performRevokeSession(session.id)})}
                            >
                              {revokingId === session.id ? <Loader2 className="h-4 w-4 animate-spin" /> : t('sessions.revoke', 'Revoke')}
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
            <AlertDialogTitle>{confirmDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDialog.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('action.cancel', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDialog.onConfirm}>{t('action.confirm', 'Confirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </>
    </Protected>
  );
}

