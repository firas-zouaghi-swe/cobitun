'use client';

import { useEffect, useRef, useState } from 'react';
import { fetchWithAuth } from '@/hooks/use-auth';
import { usePlaceAutocomplete } from '@/hooks/use-place-autocomplete';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAppStore } from '@/lib/store';
import {
  Shield, ChevronRight, ChevronLeft, CheckCircle, AlertTriangle,
  FileText, Clock, Info, Lock, Eye, Calculator, Award,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { formatTnd, safeToFixed } from '@/lib/utils';
import { PageErrorState, PageLoadingState, PageEmptyState } from '@/components/shared/PageStates';
import { FieldError, RequiredIndicator } from '@/components/ui/form-warning';

// ── Types ──────────────────────────────────────────────────────────────
interface CoverageGrant {
  id: number;
  code: string;
  name: string;
  description: string;
  subLimitDefault: number | null;
  waitingPeriodHours: number;
  specialConditions: string;
  exclusions: string[];
}

interface ProductExclusion {
  id: number;
  code: string;
}

interface UnderwritingQuestion {
  id: number;
  field: string;
  question: string;
  type: string; // text, number, boolean, picklist
  options: string[];
  required: boolean;
  expectedAnswer: string | null;
  sortOrder: number;
}

interface ProductInfo {
  id: number;
  productCode: string;
  productName: string;
  productType: string | { id: number; typeCode?: string; typeName?: string };
  description: string;
  masterPolicyLimit: number | null;
  masterDeductibleSIR: number | null;
  indemnityPeriodDays: number | null;
  currency: string;
  minimumPremiumTnd: number;
  baseRatePer1000: number | null;
  coverageGrants: CoverageGrant[];
  exclusions: ProductExclusion[];
  underwritingQuestions: UnderwritingQuestion[];
}

interface ApplicationResult {
  id: number;
  riskScore: number;
  securityPosture: { postureCode: string; postureName: string } | string;
  securityPostureId: number;
  calculatedPremium: number;
  waiverFlags: string[];
  statusCode: string;
  statusName: string;
}

// ── Step definitions ───────────────────────────────────────────────────
const STEPS = [
  { id: 1, icon: FileText },
  { id: 2, icon: Shield },
  { id: 3, icon: CheckCircle },
];

// ── Posture color map ──────────────────────────────────────────────────
const POSTURE_COLORS: Record<string, { bg: string; text: string; border: string; dot: string; icon: string }> = {
  EXCELLENT: { bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-700 dark:text-green-300', border: 'border-green-200 dark:border-green-800/30', dot: 'bg-green-500', icon: 'text-green-600 dark:text-green-400' },
  GOOD: { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-800/30', dot: 'bg-blue-500', icon: 'text-blue-600 dark:text-blue-400' },
  FAIR: { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800/30', dot: 'bg-amber-500', icon: 'text-amber-600 dark:text-amber-400' },
  POOR: { bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-700 dark:text-red-300', border: 'border-red-200 dark:border-red-800/30', dot: 'bg-red-500', icon: 'text-red-600 dark:text-red-400' },
};

const POSTURE_BADGE: Record<string, string> = {
  EXCELLENT: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800/30',
  GOOD: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800/30',
  FAIR: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800/30',
  POOR: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800/30',
};

// Helper to get posture code from either object or string
function getPostureCode(securityPosture: { postureCode: string; postureName: string } | string): string {
  return typeof securityPosture === 'object' ? securityPosture.postureCode : securityPosture;
}

function getPostureName(securityPosture: { postureCode: string; postureName: string } | string): string {
  return typeof securityPosture === 'object' ? securityPosture.postureName : securityPosture;
}

function resolveProductType(pt: string | { id: number; typeCode?: string; typeName?: string }) {
  if (!pt) return '—';
  if (typeof pt === 'string') return pt;
  return pt.typeName || pt.typeCode || String(pt.id || '—');
}

// ── Component ──────────────────────────────────────────────────────────
export default function CyberApplyPage() {
  const { user } = useAppStore();
  const { t } = useTranslation(['customerCyberApply', 'common']);
  const [product, setProduct] = useState<ProductInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');

  // Underwriting answers
  const [answers, setAnswers] = useState<Record<string, string | boolean | number>>({});
  const [waiverFlags, setWaiverFlags] = useState<string[]>([]);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const locationBlurTimeoutRef = useRef<number | null>(null);
  const { suggestions: locationSuggestions, loading: locationSuggestionsLoading, error: locationSuggestionsError } = usePlaceAutocomplete(String(answers.location ?? ''));


  const clearFieldError = (field: string) => {
    if (fieldErrors[field]) {
      setFieldErrors((prev) => { const next = { ...prev }; delete next[field]; return next; });
    }
  };

  // Submission result
  const [result, setResult] = useState<ApplicationResult | null>(null);

  useEffect(() => {
    fetchProduct();
  }, []);

  const fetchProduct = async () => {
    setError(null);
    try {
      const res = await fetchWithAuth('/api/customer/cyber/products?productCode=CYBER_INDEMNITY_COMP');
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.error || `Request failed with status ${res.status}`);
      }
      const data = await res.json();
      if (data.products && data.products.length > 0) {
        setProduct(data.products[0]);
      }
    } catch (error) {
      console.error('Failed to fetch product:', error);
      setError(t('errors.failedToLoad', 'Failed to load data'));
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = (field: string, value: string | boolean | number) => {
    setAnswers((prev) => {
      const updated = { ...prev, [field]: value };

      // Check for waiver flags on boolean questions
      if (product) {
        const newWaivers: string[] = [];
        for (const q of product.underwritingQuestions) {
          if (q.type === 'boolean' && q.expectedAnswer === 'true') {
            const ans = updated[q.field];
            if (ans === false || ans === 'false') {
              newWaivers.push(q.field);
            }
          }
        }
        setWaiverFlags(newWaivers);
      }

      return updated;
    });
  };

  const canProceed = () => {
    if (!product) return false;
    switch (currentStep) {
      case 1:
        return true;
      case 2: {
        const requiredQs = product.underwritingQuestions.filter((q) => q.required);
        return requiredQs.every((q) => {
          const a = answers[q.field];
          return a !== undefined && a !== null && a !== '';
        });
      }
      case 3:
        return acceptedTerms;
      default:
        return false;
    }
  };

  const validateStep = (step: number): boolean => {
    if (!product) return false;
    const errors: Record<string, string> = {};
    if (step === 2) {
      const requiredQs = product.underwritingQuestions.filter((q) => q.required);
      for (const q of requiredQs) {
        const a = answers[q.field];
        if (a === undefined || a === null || a === '') {
          errors[`answer_${q.field}`] = t('common:validation.required');
        }
      }
    }
    if (step === 3 && !acceptedTerms) {
      errors.acceptedTerms = t('common:validation.terms.required');
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const goToStep = (step: number) => {
    if (step > currentStep) {
      // Validate current step before proceeding
      if (!validateStep(currentStep)) {
        toast.error(t('common:error.requiredFields'));
        return;
      }
    }
    setDirection(step > currentStep ? 'forward' : 'backward');
    setCurrentStep(step);
  };

  const handleSubmit = async () => {
    if (!user?.customerId || !product) {
      toast.error(t('common:error.missingInfo'));
      return;
    }
    // Validate all steps before submitting
    if (!validateStep(2) || !validateStep(3)) {
      toast.error(t('common:error.requiredFields'));
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetchWithAuth('/api/customer/cyber/apply', {
        method: 'POST',

        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: user.customerId,
          productId: product.id,
          answers,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(data.application);
        toast.success(t('customerCyberApply:toast.submitted'));
      } else {
        toast.error(data.error || t('customerCyberApply:toast.submitFailed'));
      }
    } catch {
      toast.error(t('customerCyberApply:toast.submitFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  if (error) {
    return <PageErrorState message={error} onRetry={fetchProduct} />;
  }

  if (loading) {
    return <PageLoadingState message={t('customerCyberApply:loading', 'Loading product...')} />;
  }

  if (!product) {
    return (
      <div className="max-w-4xl mx-auto page-enter">
        <PageEmptyState
          icon={<Shield className="h-8 w-8 text-muted-foreground" />}
          title={t('customerCyberApply:productUnavailable')}
          description={t('customerCyberApply:productUnavailableDesc')}
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto page-enter">
      {/* Header */}
      <div className="mb-6 animate-fade-in-down">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="h-6 w-6 text-[#E5693A]" /> {t('customerCyberApply:title')}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {t('customerCyberApply:subtitle')}
        </p>
      </div>

      {/* Step Progress */}
      <div className="mb-8 animate-fade-in-up">
        <div className="flex items-center justify-between relative">
          <div className="absolute top-5 left-0 right-0 h-0.5 bg-border z-0 rounded-full" />
          <div
            className="absolute top-5 start-0 h-0.5 bg-gradient-to-r from-[#2E5A9D] to-[#E5693A] z-0 transition-all duration-500 rounded-full"
            style={{ width: `${((currentStep - 1) / (STEPS.length - 1)) * 100}%` }}
          />
          {STEPS.map((step) => (
            <div key={step.id} className="relative z-10 flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                  currentStep > step.id
                    ? 'bg-[#E5693A] text-[#1a1a2e] shadow-lg shadow-[#E5693A]/20'
                    : currentStep === step.id
                    ? 'bg-primary text-white ring-4 ring-primary/20 shadow-lg shadow-primary/20'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {currentStep > step.id ? (
                  <CheckCircle className="h-5 w-5" />
                ) : (
                  <step.icon className="h-5 w-5" />
                )}
              </div>
              <p
                className={`text-xs mt-2 font-medium transition-colors ${
                  currentStep >= step.id ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                {t(`customerCyberApply:step${step.id}.label`)}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form Steps */}
        <div className="lg:col-span-2 space-y-6">
          {/* ──── STEP 1: Product Overview ──── */}
          {currentStep === 1 && (
            <>
              {/* Product Details Card */}
              <Card className="border-none shadow-lg card-hover-lift animate-fade-in-up">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" /> {t('customerCyberApply:step1.productTitle')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-muted rounded-xl p-3">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">{t('customerCyberApply:step1.type')}</p>
                      <p className="text-sm font-semibold">{resolveProductType(product.productType)}</p>
                    </div>
                    <div className="bg-muted rounded-xl p-3">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">{t('customerCyberApply:step1.masterLimit')}</p>
                      <p className="text-2xl font-bold text-primary">
                        {product.masterPolicyLimit ? (product.masterPolicyLimit / 1000).toFixed(0) : '—'}K
                      </p>
                      <p className="text-xs text-muted-foreground">{t('common:unit.tnd')}</p>
                    </div>
                    <div className="bg-muted rounded-xl p-3">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">{t('customerCyberApply:step1.deductible')}</p>
                      <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                        {product.masterDeductibleSIR ? (product.masterDeductibleSIR / 1000).toFixed(0) : '—'}K
                      </p>
                      <p className="text-xs text-muted-foreground">{t('common:unit.tnd')}</p>
                    </div>
                    <div className="bg-muted rounded-xl p-3">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">{t('customerCyberApply:step1.indemnityPeriod')}</p>
                      <p className="text-2xl font-bold">{product.indemnityPeriodDays || '—'}</p>
                      <p className="text-xs text-muted-foreground">{t('customerCyberApply:step1.days')}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Coverage Grants */}
              <Card className="border-none shadow-lg card-hover-lift animate-fade-in-up stagger-2">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" /> {t('customerCyberApply:step1.coverageGrants')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 max-h-96 overflow-y-auto pe-1 custom-scrollbar">
                    {product.coverageGrants.map((cg) => (
                      <div
                        key={cg.id}
                        className="border border-border rounded-xl p-3 hover:border-primary/30 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="outline" className="text-xs font-mono bg-primary/5" title={cg.code}>
                            {cg.code}
                          </Badge>
                          {cg.subLimitDefault && (
                            <span className="text-xs font-semibold text-primary">
                              {(cg.subLimitDefault / 1000).toFixed(0)}K {t('common:unit.tnd')}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-medium">{cg.name}</p>
                        {cg.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{cg.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          {cg.waitingPeriodHours > 0 && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" /> {t('customerCyberApply:step1.wait', { hours: cg.waitingPeriodHours })}
                            </span>
                          )}
                          {cg.specialConditions && (
                            <span className="flex items-center gap-1">
                              <Info className="h-3 w-3" /> {t('customerCyberApply:step1.conditionsApply')}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Exclusions */}
              <Card className="border-none shadow-lg card-hover-lift animate-fade-in-up stagger-3">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500" /> {t('customerCyberApply:step1.masterExclusions')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {product.exclusions.map((ex) => {
                      const rawCode = typeof ex === 'string' ? ex : (ex.code ?? String(ex.id ?? ''));
                      const label = rawCode ? String(rawCode).replace(/_/g, ' ') : '—';
                      const key = typeof ex === 'object' ? `ex-${ex.id}` : `ex-${label}`;
                      return (
                        <Badge
                          key={key}
                          variant="outline"
                          className="bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800/30 text-xs"
                        >
                          <AlertTriangle className="h-3 w-3 me-1" /> {label}
                        </Badge>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* ──── STEP 2: Underwriting Questions ──── */}
          {currentStep === 2 && (
            <Card className="border-none shadow-lg card-hover-lift animate-fade-in-up">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" /> {t('customerCyberApply:step2.title')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 dark:bg-blue-900/20 dark:border-blue-800/30 p-3 rounded-xl">
                  <Info className="h-4 w-4 text-blue-500 dark:text-blue-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    {t('customerCyberApply:step2.answerAccurately')}
                  </p>
                </div>

                <div className="space-y-2 relative">
                  <Label className="text-sm font-medium">{t('customerCyberApply:step2.locationLabel', 'Region / Location')}</Label>
                  <Input
                    value={(answers.location as string) || ''}
                    onChange={(e) => {
                      handleAnswer('location', e.target.value);
                      setShowLocationSuggestions(e.target.value.trim().length >= 3);
                    }}
                    onFocus={() => {
                      if (locationBlurTimeoutRef.current) {
                        window.clearTimeout(locationBlurTimeoutRef.current);
                        locationBlurTimeoutRef.current = null;
                      }
                      setShowLocationSuggestions(((answers.location as string) || '').trim().length >= 3);
                    }}
                    onBlur={() => {
                      locationBlurTimeoutRef.current = window.setTimeout(() => {
                        setShowLocationSuggestions(false);
                      }, 100);
                    }}
                    placeholder={t('customerCyberApply:step2.locationPlaceholder', 'e.g. Tunis, Tunisia or Sousse Governorate')}
                    className="focus-ring"
                    autoComplete="off"
                  />
                  <p className="text-xs text-muted-foreground">{t('customerCyberApply:step2.locationHelper', 'Select a location from the suggestions or enter your own region.')}</p>
                  {locationSuggestionsLoading && (
                    <p className="text-xs text-muted-foreground mt-1">{t('customerCyberApply:step2.loadingSuggestions', 'Loading suggestions…')}</p>
                  )}
                  {locationSuggestionsError && (
                    <p className="text-xs text-destructive mt-1">{locationSuggestionsError}</p>
                  )}
                  {locationSuggestions.length > 0 && showLocationSuggestions && (
                    <ul className="absolute z-10 w-full mt-1 overflow-hidden rounded-xl border bg-background shadow-lg">
                      {locationSuggestions.map((suggestion) => (
                        <li
                          key={suggestion.id}
                          className="cursor-pointer px-3 py-2 text-sm text-foreground hover:bg-slate-100 dark:hover:bg-slate-800"
                          onMouseDown={() => {
                            if (locationBlurTimeoutRef.current) {
                              window.clearTimeout(locationBlurTimeoutRef.current);
                              locationBlurTimeoutRef.current = null;
                            }
                            handleAnswer('location', suggestion.displayName);
                            setShowLocationSuggestions(false);
                          }}
                        >
                          {suggestion.displayName}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {product.underwritingQuestions.map((q) => (
                  <div key={q.id} className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-1">
                      {q.question}
                      {q.required && <RequiredIndicator />}
                    </Label>

                    {/* Text Input */}
                    {q.type === 'text' && (
                      <div>
                        <Input
                          value={(answers[q.field] as string) || ''}
                          onChange={(e) => { handleAnswer(q.field, e.target.value); clearFieldError(`answer_${q.field}`); }}
                          placeholder={t('customerCyberApply:step2.enterAnswer')}
                          className="focus-ring"
                          onBlur={() => {
                            if (q.required && !((answers[q.field] as string) || '').trim()) {
                              setFieldErrors((prev) => ({ ...prev, [`answer_${q.field}`]: t('common:validation.required') }));
                            }
                          }}
                          aria-invalid={!!fieldErrors[`answer_${q.field}`]}
                          aria-describedby={fieldErrors[`answer_${q.field}`] ? `answer_${q.field}-error` : undefined}
                          maxLength={255}
                        />
                        <FieldError id={`answer_${q.field}-error`}>{fieldErrors[`answer_${q.field}`]}</FieldError>
                      </div>
                    )}

                    {/* Number Input */}
                    {q.type === 'number' && (
                      <div>
                        <Input
                          type="number"
                          value={(answers[q.field] as string) || ''}
                          onChange={(e) => { handleAnswer(q.field, e.target.value); clearFieldError(`answer_${q.field}`); }}
                          placeholder={t('customerCyberApply:step2.enterNumber')}
                          className="focus-ring"
                          onBlur={() => {
                            if (q.required && !((answers[q.field] as string) || '').trim()) {
                              setFieldErrors((prev) => ({ ...prev, [`answer_${q.field}`]: t('common:validation.required') }));
                            }
                          }}
                          aria-invalid={!!fieldErrors[`answer_${q.field}`]}
                          aria-describedby={fieldErrors[`answer_${q.field}`] ? `answer_${q.field}-error` : undefined}
                        />
                        <FieldError id={`answer_${q.field}-error`}>{fieldErrors[`answer_${q.field}`]}</FieldError>
                      </div>
                    )}

                    {/* Boolean Toggle */}
                    {q.type === 'boolean' && (
                      <div>
                        <div className="flex items-center gap-3">
                          <Switch
                            checked={answers[q.field] === true || answers[q.field] === 'true'}
                            onCheckedChange={(checked) => { handleAnswer(q.field, checked); clearFieldError(`answer_${q.field}`); }}
                            aria-invalid={!!fieldErrors[`answer_${q.field}`]}
                            aria-describedby={fieldErrors[`answer_${q.field}`] ? `answer_${q.field}-error` : undefined}
                          />
                          <span className="text-sm font-medium">
                            {answers[q.field] === true || answers[q.field] === 'true' ? t('common:label.yes') : t('common:label.no')}
                          </span>
                        </div>
                        <FieldError id={`answer_${q.field}-error`}>{fieldErrors[`answer_${q.field}`]}</FieldError>
                      </div>
                    )}

                    {/* Picklist Select */}
                    {q.type === 'picklist' && (
                      <div>
                        <Select
                          value={(answers[q.field] as string) || ''}
                          onValueChange={(val) => { handleAnswer(q.field, val); clearFieldError(`answer_${q.field}`); }}
                        >
                          <SelectTrigger className="focus-ring" aria-invalid={!!fieldErrors[`answer_${q.field}`]} aria-describedby={fieldErrors[`answer_${q.field}`] ? `answer_${q.field}-error` : undefined}>
                            <SelectValue placeholder={t('customerCyberApply:step2.selectOption')} />
                          </SelectTrigger>
                          <SelectContent>
                            {q.options.map((opt) => (
                              <SelectItem key={opt} value={opt}>
                                {opt}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FieldError id={`answer_${q.field}-error`}>{fieldErrors[`answer_${q.field}`]}</FieldError>
                      </div>
                    )}

                    {/* Waiver warning for boolean questions with expectedAnswer="true" */}
                    {q.type === 'boolean' && q.expectedAnswer === 'true' && (
                      answers[q.field] === false || answers[q.field] === 'false'
                    ) && (
                      <div className="flex items-start gap-2 bg-red-50 border border-red-100 dark:bg-red-900/20 dark:border-red-800/30 p-3 rounded-xl animate-fade-in-up">
                        <AlertTriangle className="h-4 w-4 text-red-500 dark:text-red-400 mt-0.5 shrink-0" />
                        <p className="text-xs text-red-700 dark:text-red-300">
                          {t('customerCyberApply:step2.waiverWarning')}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* ──── STEP 3: Review & Risk Assessment ──── */}
          {currentStep === 3 && (
            <>
              {/* Answers Summary */}
              <Card className="border-none shadow-lg card-hover-lift animate-fade-in-up">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Eye className="h-5 w-5 text-primary" /> {t('customerCyberApply:step3.applicationSummary')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted rounded-xl p-4 space-y-3">
                    <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                      {t('customerCyberApply:step3.yourAnswers')}
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      {product.underwritingQuestions.map((q) => (
                        <div key={q.id}>
                          <p className="text-muted-foreground text-xs">{q.question}</p>
                          <p className="font-medium">
                            {answers[q.field] !== undefined && answers[q.field] !== ''
                              ? String(answers[q.field])
                              : '—'}
                          </p>
                        </div>
                      ))}
                      {answers.location && (
                        <div>
                          <p className="text-muted-foreground text-xs">{t('customerCyberApply:step2.locationLabel', 'Region / Location')}</p>
                          <p className="font-medium">{String(answers.location)}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Waiver Flags */}
                  {waiverFlags.length > 0 && (
                    <div className="mt-4 flex items-start gap-2 bg-amber-50 border border-amber-100 dark:bg-amber-900/20 dark:border-amber-800/30 p-3 rounded-xl">
                      <AlertTriangle className="h-4 w-4 text-amber-500 dark:text-amber-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">{t('customerCyberApply:step3.waiverFlags', { count: waiverFlags.length })}</p>
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                          {waiverFlags.map((f) => {
                            const q = product.underwritingQuestions.find((q) => q.field === f);
                            return q?.question || f;
                          }).join('; ')}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Terms */}
                  <div className="mt-4 flex items-start gap-2">
                    <Checkbox
                      id="cyber-terms"
                      checked={acceptedTerms}
                      onCheckedChange={(checked) => { setAcceptedTerms(checked === true); if (checked) clearFieldError('acceptedTerms'); }}
                      className="mt-0.5"
                      aria-invalid={!!fieldErrors.acceptedTerms}
                      aria-describedby={fieldErrors.acceptedTerms ? 'acceptedTerms-error' : undefined}
                    />
                    <label htmlFor="cyber-terms" className="text-xs text-muted-foreground leading-relaxed">
                      {t('customerCyberApply:step3.terms')} <RequiredIndicator />
                    </label>
                  </div>
                  <FieldError id="acceptedTerms-error">{fieldErrors.acceptedTerms}</FieldError>
                </CardContent>
              </Card>

              {/* Risk Assessment Result */}
              {result && (
                <Card className="border-none shadow-lg card-hover-lift animate-fade-in-up stagger-2">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Award className="h-5 w-5 text-primary" /> {t('customerCyberApply:step3.riskAssessmentResult')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Risk Score */}
                    <div className="bg-muted rounded-xl p-4">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">{t('customerCyberApply:step3.riskScore')}</p>
                      <p className="text-2xl font-bold">{result.riskScore}/100</p>
                    </div>

                    {/* Security Posture */}
                    <div className={`rounded-xl p-4 border ${POSTURE_COLORS[getPostureCode(result.securityPosture)]?.bg || ''} ${POSTURE_COLORS[getPostureCode(result.securityPosture)]?.border || ''}`}>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">{t('customerCyberApply:step3.securityPosture')}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`w-2.5 h-2.5 rounded-full ${POSTURE_COLORS[getPostureCode(result.securityPosture)]?.dot || 'bg-gray-500'}`} />
                        <span className={`text-2xl font-bold ${POSTURE_COLORS[getPostureCode(result.securityPosture)]?.text || ''}`}>
                          {getPostureName(result.securityPosture)}
                        </span>
                      </div>
                    </div>

                    {/* Premium Estimate */}
                    <div className="bg-primary/5 rounded-xl p-4 border border-primary/20">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">{t('customerCyberApply:step3.estimatedPremium')}</p>
                      <p className="text-2xl font-bold text-primary">
                        {formatTnd(result.calculatedPremium)} {t('common:unit.tnd')}
                      </p>
                    </div>

                    {/* Waiver Flags in Result */}
                    {result.waiverFlags && result.waiverFlags.length > 0 && (
                      <div className="bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800/30 rounded-xl p-4">
                        <p className="text-xs text-red-700 dark:text-red-300 font-semibold">{t('customerCyberApply:step3.waiverFlagsDetected')}</p>
                        <ul className="mt-2 space-y-1">
                          {result.waiverFlags.map((f) => {
                            const q = product.underwritingQuestions.find((q) => q.field === f);
                            return (
                              <li key={f} className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3 shrink-0" /> {q?.question || f}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}

                    {/* Application Status */}
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800/30" title={result.statusName || result.statusCode}>
                        <Clock className="h-3 w-3 me-1" /> {result.statusName || result.statusCode}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{t('customerCyberApply:step3.awaitingReview')}</span>
                    </div>
                  </CardContent>
                </Card>
              )}
              {result && (
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => {
                    setResult(null);
                    setAcceptedTerms(false);
                    setAnswers({});
                    setWaiverFlags([]);
                    setCurrentStep(1);
                  }}
                >
                  {t('customerCyberApply:step3.startNewApplication') || 'Start New Application'}
                </Button>
              )}
            </>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => goToStep(Math.max(1, currentStep - 1))}
              disabled={currentStep === 1}
              className="flex items-center gap-1 transition-all"
            >
              <ChevronLeft className="h-4 w-4" /> {t('common:action.previous')}
            </Button>

            {currentStep < 3 ? (
              <Button
                onClick={() => goToStep(currentStep + 1)}
                disabled={!canProceed()}
                variant="tunis"
                className="flex items-center gap-1 transition-all hover:shadow-lg hover:shadow-[#E5693A]/20"
              >
                {t('common:action.next')} <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={submitting || !!result}
                variant="tunis"
                className="font-bold flex items-center gap-1 transition-all hover:shadow-lg hover:shadow-[#E5693A]/20 hover:scale-[1.02]"
              >
                {submitting ? t('customerCyberApply:step3.submitting') : result ? t('customerCyberApply:step3.submitted') : t('customerCyberApply:step3.submitButton')}{' '}
                <CheckCircle className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Sidebar: Product Quick Facts */}
        <div className="space-y-4">
          <Card className="border-primary/30 border-2 sticky top-4 overflow-hidden animate-fade-in-right">
            <CardHeader className="bg-gradient-to-r from-[#2E5A9D] to-[#E5693A] text-white rounded-t-lg pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Lock className="h-5 w-5" /> {t('customerCyberApply:sidebar.policyQuickFacts')}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="bg-primary/5 rounded-xl p-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">{t('customerCyberApply:sidebar.masterPolicyLimit')}</p>
                <p className="text-2xl font-bold text-primary">
                  {product.masterPolicyLimit ? formatTnd(product.masterPolicyLimit) : '—'} {t('common:unit.tnd')}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">{t('customerCyberApply:sidebar.deductibleSIR')}</p>
                <p className="text-xl font-semibold">
                  {product.masterDeductibleSIR ? formatTnd(product.masterDeductibleSIR) : '—'} {t('common:unit.tnd')}
                </p>
              </div>
              <div className="border-t border-border pt-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">{t('customerCyberApply:sidebar.indemnityPeriod')}</p>
                <p className="text-xl font-semibold">
                  {product.indemnityPeriodDays || '—'} {t('customerCyberApply:sidebar.days')}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">{t('customerCyberApply:sidebar.coverageGrants')}</p>
                <p className="text-xl font-semibold">{product.coverageGrants.length}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">{t('customerCyberApply:sidebar.exclusions')}</p>
                <p className="text-xl font-semibold text-red-600 dark:text-red-400">{product.exclusions.length}</p>
              </div>
              <div className="border-t border-border pt-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">{t('customerCyberApply:sidebar.minimumPremium')}</p>
                <p className="text-lg font-semibold">
                  {formatTnd(product.minimumPremiumTnd)} {t('common:unit.tnd')}
                </p>
              </div>
              <div className="pt-3 border-t border-border">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t('customerCyberApply:sidebar.premiumNote')}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Live Waiver Counter */}
          {currentStep === 2 && waiverFlags.length > 0 && (
            <Card className="border-amber-300 dark:border-amber-800/30 border-2 animate-fade-in-up">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">{`${t('customerCyberApply:sidebar.waiverCounter')} (${waiverFlags.length})`}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('customerCyberApply:sidebar.waiverFlagsDesc')}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

