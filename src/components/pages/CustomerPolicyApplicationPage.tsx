'use client';

import { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppStore } from '@/lib/store';
import { toast } from 'sonner';
import { fetchWithAuth } from '@/hooks/use-auth';
import {
  Upload,
  FileText,
  CheckCircle2,
  Loader2,
  ArrowLeft,
  X,
} from 'lucide-react';

const API_BASE = '/api/workflow';


interface CloudProvider {
  id: number;
  organisationName: string;
  asn: string;
  slaTier: { tierCode: string; tierName: string } | string;
}

export default function CustomerPolicyApplicationPage() {
  const { t } = useTranslation(['common', 'customerPolicyApplication']);
  const { user, setCurrentPage, setWorkflowContext } = useAppStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [file, setFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fileError, setFileError] = useState('');

  // ─── File validation ─────────────────────────────────────────

  const validateFile = (f: File): string | null => {
    if (f.type !== 'application/pdf') {
      return t('customerPolicyApplication:validation.onlyPdf');
    }
    if (f.size > 10 * 1024 * 1024) {
      return t('customerPolicyApplication:validation.maxSize');
    }
    return null;
  };

  const handleFileSelect = (f: File) => {
    const error = validateFile(f);
    if (error) {
      setFileError(error);
      setFile(null);
      return;
    }
    setFileError('');
    setFile(f);
  };

  // ─── Drag & drop ─────────────────────────────────────────────

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFileSelect(droppedFile);
  }, []);

  // ─── Submit ──────────────────────────────────────────────────

  const persistSelection = async (policyId: number | null, claimId: number | null) => {
    try {
      await fetchWithAuth(`${API_BASE}/selection`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lastViewedWorkflowPolicyApplicationId: policyId,
          lastViewedWorkflowClaimId: claimId,
        }),
      });
    } catch (err) {
      console.warn('Failed to persist workflow selection', err);
    }
  };

  const handleSubmit = async () => {
    if (!file) {
      setFileError(t('customerPolicyApplication:validation.uploadContract'));
      return;
    }
    if (!user?.customerId) {
      toast.error(t('customerPolicyApplication:validation.customerNotFound'));
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('customerId', String(user.customerId));
      formData.append('providerContractPdf', file);

      const res = await fetchWithAuth(`${API_BASE}/policy-applications`, {
        method: 'POST',
        body: formData,
      });

      const dataText = await res.text();
      let data: any;
      try {
        data = JSON.parse(dataText);
      } catch {
        data = { error: dataText };
      }

      if (!res.ok) {
        toast.error(data.error || t('customerPolicyApplication:toast.createFailed'));
        return;
      }

      // If server returned the created application, navigate to its detail and notify other pages
      const app = data?.application ?? null;
      if (app?.id) {
        await persistSelection(app.id, null);
        setWorkflowContext({ policyId: app.id, claimId: null });
        try {
          window.dispatchEvent(new CustomEvent('workflowAppUpdated', { detail: { appId: app.id } }));
        } catch (ev) {
          console.warn('Could not dispatch workflowAppUpdated', ev);
        }
        setCurrentPage('customer-policy-detail');
        toast.success(t('customerPolicyApplication:toast.createSuccess'));
        return;
      }

      toast.success(t('customerPolicyApplication:toast.createSuccess'));
      setCurrentPage('customer-workflow');
    } catch {
      toast.error(t('customerPolicyApplication:toast.somethingWentWrong'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 page-enter max-w-2xl mx-auto">
      {/* Header */}
      <div className="animate-fade-in-down">
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground mb-3 -ms-2"
          onClick={() => {
            setWorkflowContext({ policyId: null, claimId: null });
            setCurrentPage('customer-workflow');
          }}
        >
          <ArrowLeft className="h-4 w-4 me-1" />
          {t('customerPolicyApplication:backToWorkflow')}
        </Button>
          <h1 className="text-2xl font-bold text-foreground">
            {t('customerPolicyApplication:title')}
          </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {t('customerPolicyApplication:subtitle')}
        </p>
      </div>

      {/* Step 1: Upload Provider Contract */}
      <Card className="animate-fade-in-up stagger-1">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="bg-tunis-blue/10 p-2 rounded-lg">
              <Upload className="h-5 w-5 text-tunis-blue" />
            </div>
            <div>
              <CardTitle className="text-base">
                {t('customerPolicyApplication:step1.title')}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t('customerPolicyApplication:step1.requirement')}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Drag & Drop Zone */}
          <div
            className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
              isDragOver
                ? 'border-tunis-blue bg-tunis-blue/5 scale-[1.01]'
                : file
                ? 'border-green-400 dark:border-green-600 bg-green-50/50 dark:bg-green-900/10'
                : 'border-muted-foreground/25 hover:border-tunis-blue/50 hover:bg-tunis-blue-pale/30'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileSelect(f);
              }}
            />
            {file ? (
              <div className="flex flex-col items-center gap-2">
                <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded-xl">
                  <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-tunis-blue" />
                  <span className="text-sm font-medium text-foreground">
                    {file.name}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                >
                  <X className="h-3.5 w-3.5 me-1" />
                  {t('customerPolicyApplication:upload.remove')}
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="bg-muted p-3 rounded-xl">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">
                  {t('customerPolicyApplication:upload.dragDrop')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('customerPolicyApplication:upload.orBrowse')}
                </p>
              </div>
            )}
          </div>

          {fileError && (
            <p className="text-sm text-red-500 flex items-center gap-1">
              <X className="h-3.5 w-3.5" />
              {fileError}
            </p>
          )}

          {/* Submit Button */}
          <Button
            className="w-full font-semibold h-11"
            variant="tunis"
            onClick={handleSubmit}
            disabled={submitting || !file}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 me-2 animate-spin" />
                {t('customerPolicyApplication:submit.creating')}
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 me-2" />
                {t('customerPolicyApplication:submit.submitApplication')}
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

