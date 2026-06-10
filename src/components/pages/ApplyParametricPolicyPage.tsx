'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchWithAuth } from '@/hooks/use-auth';
import { usePlaceAutocomplete } from '@/hooks/use-place-autocomplete';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
  Cloud, Zap, Calculator, Shield, CheckCircle, ChevronRight,
  ChevronLeft, Info, Building, TrendingUp, AlertTriangle, Lock
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { safeToFixed, safeToLocaleString, formatTnd } from '@/lib/utils';
import { PageErrorState, PageLoadingState, PageEmptyState } from '@/components/shared/PageStates';
import { FieldError, RequiredIndicator, FormWarning } from '@/components/ui/form-warning';

// ── Types (v3 API) ──────────────────────────────────────────────────────
interface SlaTierInfo {
  tierCode: string;
  tierName: string;
  mttrHours: number;
  thresholdHours?: number;
  basePremiumFactor: number;
}

interface CloudProviderOption {
  id: number;
  asn: string;
  organisationName: string;
  slaTierId: number;
  mttrHours: number;
  riskScore: number;
  premiumFactor: number;
  isActive: number;
  slaTier: SlaTierInfo | null;
}

interface DropdownOption {
  id: number;
  code: string;
  name: string;
  riskFactor: number;
}

interface TurnoverBand {
  id: number;
  code: string;
  name: string;
  minTurnover: number;
  maxTurnover: number;
  riskFactor: number;
}

interface PricingBreakdown {
  hourlyRevenue: number;
  grossMargin: number;
  cloudDependency: number;
  sectorRiskFactor: number;
  bmRiskFactor: number;
  resilienceRiskFactor: number;
  turnoverBandRiskFactor: number;
  providerFactor: number;
  purePremium: number;
  commercialPremium: number;
  finalPremium: number;
  premiumRatePct: number;
  payoutPerHour: number;
  maxPayoutPerEvent: number;
  turnoverBand: string;
  underwritingDecision: string;
  underwritingReason: string;
  validationErrors: string[];
}

const STEPS = [
  { id: 1, icon: Cloud },
  { id: 2, icon: Building },
  { id: 3, icon: TrendingUp },
  { id: 4, icon: CheckCircle },
];

const TIER_COLORS: Record<string, string> = {
  Platinum: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800/30',
  Gold: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800/30',
  Silver: 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-800/30 dark:text-gray-300 dark:border-gray-700/30',
  Bronze: 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800/30',
};

const TIER_GRADIENTS: Record<string, string> = {
  Platinum: 'from-emerald-500 to-emerald-600',
  Gold: 'from-amber-500 to-amber-600',
  Silver: 'from-gray-400 to-gray-500',
  Bronze: 'from-orange-500 to-orange-600',
};

const UW_DECISION_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  AUTO_ACCEPT: { bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-700 dark:text-green-300', border: 'border-green-200 dark:border-green-800/30' },
  MANUAL_REVIEW: { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-800/30' },
  SURCHARGE: { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800/30' },
  DECLINE: { bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-700 dark:text-red-300', border: 'border-red-200 dark:border-red-800/30' },
};

export default function ApplyParametricPolicyPage() {
  const { user } = useAppStore();
  const { t } = useTranslation(['customerApplyParametric', 'common']);
  const [providers, setProviders] = useState<CloudProviderOption[]>([]);
  const [sectors, setSectors] = useState<DropdownOption[]>([]);
  const [businessModels, setBusinessModels] = useState<DropdownOption[]>([]);
  const [turnoverBands, setTurnoverBands] = useState<TurnoverBand[]>([]);
  const [resilienceOptions, setResilienceOptions] = useState<DropdownOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');

  // Form state
  const [cloudProviderId, setCloudProviderId] = useState('');
  const [sectorId, setSectorId] = useState('');
  const [businessModelId, setBusinessModelId] = useState('');
  const [annualTurnover, setAnnualTurnover] = useState('');
  const [grossMargin, setGrossMargin] = useState('');
  const [cloudDependency, setCloudDependency] = useState('');
  const [resilienceProfileId, setResilienceProfileId] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [regionLocation, setRegionLocation] = useState('');
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const locationBlurTimeoutRef = useRef<number | null>(null);
  const { suggestions: locationSuggestions, loading: locationSuggestionsLoading, error: locationSuggestionsError } = usePlaceAutocomplete(regionLocation);

  const validateField = (field: string, value: string, rules?: { required?: boolean; minLength?: number; maxLength?: number; pattern?: RegExp; patternMessage?: string }) => {
    const errors: Record<string, string> = { ...fieldErrors };
    if (rules?.required && !value.trim()) {
      errors[field] = t('common:validation.required');
    } else if (rules?.minLength && value.length < rules.minLength) {
      errors[field] = t('common:validation.minLength', { count: rules.minLength });
    } else if (rules?.maxLength && value.length > rules.maxLength) {
      errors[field] = t('common:validation.maxLength', { count: rules.maxLength });
    } else if (rules?.pattern && !rules.pattern.test(value)) {
      errors[field] = rules.patternMessage || t('common:validation.number.invalid');
    } else {
      delete errors[field];
    }
    setFieldErrors(errors);
    return !errors[field];
  };

  const clearFieldError = (field: string) => {
    if (fieldErrors[field]) {
      setFieldErrors((prev) => { const next = { ...prev }; delete next[field]; return next; });
    }
  };

  const validateSelectField = (field: string, value: string) => {
    if (!value) {
      setFieldErrors((prev) => ({ ...prev, [field]: t('common:validation.select.required') }));
      return false;
    }
    clearFieldError(field);
    return true;
  };

  // Computed factors
  const selectedProvider = providers.find((p) => String(p.id) === cloudProviderId);

  // Current sector, business model, resilience lookups
  const selectedSector = sectors.find((s) => String(s.id) === sectorId);
  const selectedBusinessModel = businessModels.find((m) => String(m.id) === businessModelId);
  const selectedResilience = resilienceOptions.find((r) => String(r.id) === resilienceProfileId);

  // Auto-select turnover band based on annual turnover
  const parsedTurnover = parseFloat(annualTurnover);
  const selectedTurnoverBand = !isNaN(parsedTurnover) && parsedTurnover > 0
    ? turnoverBands.find((b) => parsedTurnover >= b.minTurnover && parsedTurnover <= b.maxTurnover) ||
      (parsedTurnover > (turnoverBands[turnoverBands.length - 1]?.maxTurnover || 0)
        ? turnoverBands[turnoverBands.length - 1]
        : null)
    : null;

  // Provider factor (prefer provider-level premiumFactor from study, fall back to SLA tier base)
  const providerFactor = selectedProvider
    ? Number(selectedProvider.premiumFactor ?? selectedProvider.slaTier?.basePremiumFactor ?? 1.0)
    : 1.0;

  const previewBreakdown = useMemo<PricingBreakdown | null>(() => {
    const turnover = parseFloat(annualTurnover);
    const gm = parseFloat(grossMargin);
    const cd = parseFloat(cloudDependency);

    if (
      turnover > 0 && selectedSector && selectedBusinessModel &&
      !isNaN(gm) && gm > 0 && gm <= 1 &&
      !isNaN(cd) && cd > 0 && cd <= 1
    ) {
      const sectorRF = selectedSector.riskFactor;
      const bmRF = selectedBusinessModel.riskFactor;
      const resilienceRF = selectedResilience?.riskFactor || 1.0;
      const tbRF = selectedTurnoverBand?.riskFactor || 1.0;
      const pf = providerFactor;

      const hourlyRevenue = turnover / 8760;
      const purePremium = 1.1212 * 107.07 * hourlyRevenue * gm * cd * sectorRF * bmRF * resilienceRF * tbRF;
      const commercialPremium = purePremium * 1.32;
      const finalPremium = commercialPremium * pf;
      const premiumRatePct = turnover > 0 ? (finalPremium / turnover) * 100 : 0;
      const payoutPerHour = hourlyRevenue * gm * cd * sectorRF * bmRF * resilienceRF * tbRF;
      const maxPayoutPerEvent = payoutPerHour * 168;

      const validationErrors: string[] = [];
      if (turnover < 50000) validationErrors.push(t('customerApplyParametric:step2.validationMinTurnover'));
      if (turnover > 15000000) validationErrors.push(t('customerApplyParametric:step2.validationMaxTurnover'));

      let underwritingDecision = 'MANUAL_REVIEW';
      let underwritingReason = t('customerApplyParametric:step3.uwReason.fullAnalysis');
      if (premiumRatePct < 0.20 && validationErrors.length === 0) {
        underwritingDecision = 'AUTO_ACCEPT';
        underwritingReason = t('customerApplyParametric:step3.uwReason.autoAccept');
      } else if (premiumRatePct >= 0.45 && premiumRatePct < 0.675 && validationErrors.length === 0) {
        underwritingDecision = 'SURCHARGE';
        underwritingReason = t('customerApplyParametric:step3.uwReason.surcharge');
      } else if (premiumRatePct >= 0.675 || validationErrors.length > 0) {
        underwritingDecision = 'DECLINE';
        underwritingReason = validationErrors.length > 0 ? validationErrors[0] : t('customerApplyParametric:step3.uwReason.autoDecline');
      } else {
        underwritingReason = t('customerApplyParametric:step3.uwReason.manualReview', { rate: premiumRatePct.toFixed(4) });
      }

      return {
        hourlyRevenue: Math.round(hourlyRevenue * 10000) / 10000,
        grossMargin: gm,
        cloudDependency: cd,
        sectorRiskFactor: sectorRF,
        bmRiskFactor: bmRF,
        resilienceRiskFactor: resilienceRF,
        turnoverBandRiskFactor: tbRF,
        providerFactor: pf,
        purePremium: Math.round(purePremium * 100) / 100,
        commercialPremium: Math.round(commercialPremium * 100) / 100,
        finalPremium: Math.round(finalPremium * 100) / 100,
        premiumRatePct: Math.round(premiumRatePct * 10000) / 10000,
        payoutPerHour: Math.round(payoutPerHour * 10000) / 10000,
        maxPayoutPerEvent: Math.round(maxPayoutPerEvent * 100) / 100,
        turnoverBand: selectedTurnoverBand?.name || '',
        underwritingDecision,
        underwritingReason,
        validationErrors,
      };
    }

    return null;
  }, [annualTurnover, cloudDependency, grossMargin, providerFactor, selectedBusinessModel, selectedResilience, selectedSector, selectedTurnoverBand, t]);

  useEffect(() => {
    const loadFormData = async () => {
      try {
        const res = await fetchWithAuth('/api/customer/apply-parametric');
        const data = await res.json();
        setProviders((data.providers || []).filter((p: CloudProviderOption) => p.isActive === 1));
        setSectors(data.sectors || []);
        setBusinessModels(data.businessModels || []);
        setTurnoverBands(data.turnoverBands || []);
        setResilienceOptions(data.resilienceProfiles || []);
      } catch (error) {
        setError(t('errors.failedToLoad', 'Failed to load form data'));
      } finally {
        setLoading(false);
      }
    };

    void loadFormData();
  }, []);

  const fetchFormData = async () => {
    try {
      setLoading(true);
      const res = await fetchWithAuth('/api/customer/apply-parametric');
      const data = await res.json();
      setProviders((data.providers || []).filter((p: CloudProviderOption) => p.isActive === 1));
      setSectors(data.sectors || []);
      setBusinessModels(data.businessModels || []);
      setTurnoverBands(data.turnoverBands || []);
      setResilienceOptions(data.resilienceProfiles || []);
      setError('');
    } catch (error) {
      setError(t('errors.failedToLoad', 'Failed to load form data'));
    } finally {
      setLoading(false);
    }
  };

  const canProceed = () => {
    const parseFlexible = (raw?: string) => {
      if (raw === undefined || raw === null) return NaN;
      const cleaned = String(raw).replace(/[,\s]+/g, '').trim();
      return cleaned === '' ? NaN : Number(cleaned);
    };

    switch (currentStep) {
      case 1:
        return !!cloudProviderId;
      case 2: {
        const turnoverNum = parseFlexible(annualTurnover);
        const gmNum = parseFlexible(grossMargin);
        const cdNum = parseFlexible(cloudDependency);
        return !!sectorId && !!businessModelId && !isNaN(turnoverNum) && turnoverNum > 0
          && !isNaN(gmNum) && gmNum > 0 && gmNum <= 1
          && !isNaN(cdNum) && cdNum > 0 && cdNum <= 1;
      }
      case 3:
        return !!resilienceProfileId;
      case 4:
        return true;
      default:
        return false;
    }
  };

  const goToStep = (step: number) => {
    setDirection(step > currentStep ? 'forward' : 'backward');
    setCurrentStep(step);
  };

  const handleSubmit = async () => {
    // Validate all fields on submit
    const v1 = validateSelectField('cloudProviderId', cloudProviderId);
    const v2 = validateSelectField('sectorId', sectorId);
    const v3 = validateSelectField('businessModelId', businessModelId);
    const v4 = validateField('annualTurnover', annualTurnover, { required: true });
    const v5 = validateField('grossMargin', grossMargin, { required: true });
    const v6 = validateField('cloudDependency', cloudDependency, { required: true });
    const v7 = validateSelectField('resilienceProfileId', resilienceProfileId);
    
    if (!v1 || !v2 || !v3 || !v4 || !v5 || !v6 || !v7) {
      toast.error(t('common:error.requiredFields'));
      return;
    }
    
    if (!cloudProviderId || !sectorId || !businessModelId || !annualTurnover || !grossMargin || !cloudDependency) {
      toast.error(t('common:error.requiredFields'));
      return;
    }

    const turnover = parseFloat(annualTurnover);
    const gm = parseFloat(grossMargin);
    const cd = parseFloat(cloudDependency);

    if (isNaN(turnover) || turnover <= 0) {
      toast.error(t('customerApplyParametric:toast.invalidTurnover'));
      return;
    }
    if (isNaN(gm) || gm <= 0 || gm > 1) {
      toast.error(t('customerApplyParametric:toast.invalidGrossMargin', 'Gross margin must be between 0 and 1'));
      return;
    }
    if (isNaN(cd) || cd <= 0 || cd > 1) {
      toast.error(t('customerApplyParametric:toast.invalidCloudDependency', 'Cloud dependency must be between 0 and 1'));
      return;
    }
    if (!acceptedTerms) {
      setFieldErrors((prev) => ({ ...prev, acceptedTerms: t('common:validation.terms.required') }));
      toast.error(t('customerApplyParametric:toast.acceptTerms'));
      return;
    }

    setSubmitting(true);
    try {
      if (!user?.customerId) {
        toast.error(t('customerApplyParametric:toast.loginRequired'));
        setSubmitting(false);
        return;
      }
      const res = await fetchWithAuth('/api/customer/apply-parametric', {
        method: 'POST',

        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: user?.customerId ?? null,
          cloudProviderId: Number(cloudProviderId),
          sectorId: Number(sectorId),
          businessModelId: Number(businessModelId),
          turnoverBandId: selectedTurnoverBand?.id || null,
          resilienceProfileId: Number(resilienceProfileId) || null,
          annualTurnoverTnd: turnover,
          grossMargin: gm,
          cloudDependency: cd,
          location: regionLocation.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.policy?.statusCode === 'REJECTED') {
          toast.error(t('customerApplyParametric:toast.autoDeclined', { reason: data.breakdown?.underwritingReason || t('customerApplyParametric:toast.premiumExceedsThreshold') }));
        } else {
          toast.success(t('customerApplyParametric:toast.submitted'));
        }
        setCloudProviderId('');
        setSectorId('');
        setBusinessModelId('');
        setAnnualTurnover('');
        setGrossMargin('');
        setCloudDependency('');
        setResilienceProfileId('');
        setRegionLocation('');
        setAcceptedTerms(false);
        setCurrentStep(1);
      } else {
        toast.error(data.error || t('customerApplyParametric:toast.submitFailed'));
      }
    } catch {
      toast.error(t('customerApplyParametric:toast.submitFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  if (error) {
    return <PageErrorState message={error} onRetry={fetchFormData} />;
  }

  if (loading) {
    return <PageLoadingState message={t('customerApplyParametric:loading', 'Loading form...')} />;
  }

  const hourlyRevenue = (currentStep === 2 || currentStep === 4) && parseFloat(annualTurnover) > 0
    ? parseFloat(annualTurnover) / 8760
    : 0;

  return (
    <div className="max-w-4xl mx-auto page-enter">
      {/* Header */}
      <div className="mb-6 animate-fade-in-down">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Zap className="h-6 w-6 text-[#E5693A]" /> {t('customerApplyParametric:title')}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">{t('customerApplyParametric:subtitle')}</p>
      </div>

      {/* Step Progress Indicator */}
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
              <p className={`text-xs mt-2 font-medium transition-colors ${
                currentStep >= step.id ? 'text-primary' : 'text-muted-foreground'
              }`}>
                {t(`customerApplyParametric:step${step.id}.label`)}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Steps */}
        <div className="lg:col-span-2 space-y-6">
          {/* STEP 1: Choose Provider */}
          {currentStep === 1 && (
            <Card className="border-none shadow-lg card-hover-lift">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Cloud className="h-5 w-5 text-primary" /> {t('customerApplyParametric:step1.title')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">{t('customerApplyParametric:step1.cloudProviderLabel')}<RequiredIndicator /></Label>
                  <Select value={cloudProviderId} onValueChange={(v) => { setCloudProviderId(v); clearFieldError('cloudProviderId'); }}>
                    <SelectTrigger className="mt-1 focus-ring" aria-invalid={!!fieldErrors.cloudProviderId} aria-describedby={fieldErrors.cloudProviderId ? 'cloudProviderId-error' : undefined}>
                      <SelectValue placeholder={t('customerApplyParametric:step1.cloudProviderPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {providers.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.organisationName} (AS{p.asn}) — {p.slaTier?.tierName || t('common:status.unknown')}
                          {Number(p.premiumFactor ?? 0) > 1 ? ` · ×${safeToFixed(p.premiumFactor, 2)} ${t('customerApplyParametric:step1.risk')}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError id="cloudProviderId-error">{fieldErrors.cloudProviderId}</FieldError>
                </div>

                <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 dark:bg-blue-900/20 dark:border-blue-800/30 p-3 rounded-xl">
                  <Info className="h-4 w-4 text-blue-500 dark:text-blue-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-blue-700 dark:text-blue-300">{t('customerApplyParametric:step1.providerHint')}</p>
                </div>

                {selectedProvider && (
                  <div className="bg-gradient-to-r from-[#1a1a2e] to-[#0f3460] rounded-xl p-5 text-white animate-scale-in relative overflow-hidden">
                    <div className="absolute top-0 end-0 w-24 h-24 bg-[#E5693A]/10 rounded-full blur-2xl" />
                    <div className="flex items-center justify-between mb-3 relative z-10">
                      <h4 className="font-semibold">{selectedProvider.organisationName}</h4>
                      <Badge className={TIER_COLORS[selectedProvider.slaTier?.tierName ?? ''] || 'bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-300'} title={selectedProvider.slaTier?.tierName || t('common:status.unknown')}>
                        {selectedProvider.slaTier?.tierName || t('common:status.unknown')}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm relative z-10">
                      <div>
                        <p className="text-white/50 text-xs">{t('customerApplyParametric:step1.asn')}</p>
                        <p className="font-medium">AS{selectedProvider.asn}</p>
                      </div>
                      <div>
                        <p className="text-white/50 text-xs">{t('customerApplyParametric:step1.slaTier')}</p>
                        <p className="font-medium">{selectedProvider.slaTier?.tierName || t('common:status.unknown')}</p>
                      </div>
                      <div>
                        <p className="text-white/50 text-xs">{t('customerApplyParametric:step1.mttrThreshold')}</p>
                        <p className="font-medium">{selectedProvider.mttrHours} {t('customerApplyParametric:step1.hours')}</p>
                      </div>
                      <div>
                        <p className="text-white/50 text-xs">{t('customerApplyParametric:step1.riskScore')}</p>
                        <p className="font-medium">{safeToFixed(Number(selectedProvider.riskScore ?? 0), 1) !== '0.0' ? safeToFixed(Number(selectedProvider.riskScore ?? 0), 1) : 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-white/50 text-xs">{t('customerApplyParametric:step1.premiumFactor')}</p>
                        {(() => {
                          const displayFactor = Number(selectedProvider.premiumFactor ?? selectedProvider.slaTier?.basePremiumFactor ?? 1.0);
                          return <p className="font-medium text-[#E5693A]">×{displayFactor.toFixed(2)}</p>;
                        })()}
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-white/20 relative z-10">
                      <p className="text-xs text-white/50">{t('customerApplyParametric:step1.payoutTrigger')}</p>
                      <p className="text-sm font-medium text-[#E5693A]">
                        {t('customerApplyParametric:step1.payoutTriggerDesc', { hours: selectedProvider.mttrHours })}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* STEP 2: Business Profile */}
          {currentStep === 2 && (
            <Card className="border-none shadow-lg card-hover-lift">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building className="h-5 w-5 text-primary" /> {t('customerApplyParametric:step2.title')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label>{t('customerApplyParametric:step2.sectorLabel')}<RequiredIndicator /></Label>
                    <Select value={sectorId} onValueChange={(v) => { setSectorId(v); clearFieldError('sectorId'); }}>
                      <SelectTrigger className="mt-1 focus-ring" aria-invalid={!!fieldErrors.sectorId} aria-describedby={fieldErrors.sectorId ? 'sectorId-error' : undefined}>
                        <SelectValue placeholder={t('customerApplyParametric:step2.sectorPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {sectors.map((s) => (
                          <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldError id="sectorId-error">{fieldErrors.sectorId}</FieldError>
                  </div>
                  <div>
                    <Label>{t('customerApplyParametric:step2.businessModelLabel')}<RequiredIndicator /></Label>
                    <Select value={businessModelId} onValueChange={(v) => { setBusinessModelId(v); clearFieldError('businessModelId'); }}>
                      <SelectTrigger className="mt-1 focus-ring" aria-invalid={!!fieldErrors.businessModelId} aria-describedby={fieldErrors.businessModelId ? 'businessModelId-error' : undefined}>
                        <SelectValue placeholder={t('customerApplyParametric:step2.businessModelPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {businessModels.map((m) => (
                          <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldError id="businessModelId-error">{fieldErrors.businessModelId}</FieldError>
                  </div>
                </div>

                {selectedSector && (
                  <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 animate-fade-in-up">
                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-3">
                      {t('customerApplyParametric:step2.actuarialFactors', { sector: selectedSector.name })}
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-card rounded-lg p-3 text-center border border-border">
                        <p className="text-xs text-muted-foreground">{t('customerApplyParametric:step2.sectorRiskFactor')}</p>
                        <p className="text-xl font-bold text-primary">×{safeToFixed(selectedSector.riskFactor, 2, '—')}</p>
                        <p className="text-[10px] text-muted-foreground">{selectedSector.name}</p>
                      </div>
                      {selectedBusinessModel && (
                        <div className="bg-card rounded-lg p-3 text-center border border-border">
                          <p className="text-xs text-muted-foreground">{t('customerApplyParametric:step2.businessModelRiskFactor')}</p>
                          <p className="text-xl font-bold text-primary">×{safeToFixed(selectedBusinessModel.riskFactor, 2, '—')}</p>
                          <p className="text-[10px] text-muted-foreground">{selectedBusinessModel.name}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Gross Margin & Cloud Dependency Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="grossMargin">{t('customerApplyParametric:step2.grossMargin')}<RequiredIndicator /></Label>
                    <Input
                      id="grossMargin"
                      type="number"
                      placeholder="0.50"
                      value={grossMargin}
                      onChange={(e) => { setGrossMargin(e.target.value); clearFieldError('grossMargin'); }}
                      onBlur={() => {
                        const val = parseFloat(grossMargin);
                        if (!grossMargin.trim()) {
                          setFieldErrors((prev) => ({ ...prev, grossMargin: t('common:validation.required') }));
                        } else if (isNaN(val) || val <= 0 || val > 1) {
                          setFieldErrors((prev) => ({ ...prev, grossMargin: t('common:validation.number.min', { min: '0.01' }) + ' / ' + t('common:validation.number.max', { max: '1' }) }));
                        } else {
                          clearFieldError('grossMargin');
                        }
                      }}
                      aria-invalid={!!fieldErrors.grossMargin}
                      aria-describedby={fieldErrors.grossMargin ? 'grossMargin-error' : undefined}
                      className="mt-1 focus-ring"
                      min={0.01}
                      max={1}
                      step={0.01}
                    />
                    <p className="text-xs text-muted-foreground mt-1">{t('customerApplyParametric:step2.grossMarginDesc')}</p>
                    <FieldError id="grossMargin-error">{fieldErrors.grossMargin}</FieldError>
                  </div>
                  <div>
                    <Label htmlFor="cloudDependency">{t('customerApplyParametric:step2.cloudDependency')}<RequiredIndicator /></Label>
                    <Input
                      id="cloudDependency"
                      type="number"
                      placeholder="0.75"
                      value={cloudDependency}
                      onChange={(e) => { setCloudDependency(e.target.value); clearFieldError('cloudDependency'); }}
                      onBlur={() => {
                        const val = parseFloat(cloudDependency);
                        if (!cloudDependency.trim()) {
                          setFieldErrors((prev) => ({ ...prev, cloudDependency: t('common:validation.required') }));
                        } else if (isNaN(val) || val <= 0 || val > 1) {
                          setFieldErrors((prev) => ({ ...prev, cloudDependency: t('common:validation.number.min', { min: '0.01' }) + ' / ' + t('common:validation.number.max', { max: '1' }) }));
                        } else {
                          clearFieldError('cloudDependency');
                        }
                      }}
                      aria-invalid={!!fieldErrors.cloudDependency}
                      aria-describedby={fieldErrors.cloudDependency ? 'cloudDependency-error' : undefined}
                      className="mt-1 focus-ring"
                      min={0.01}
                      max={1}
                      step={0.01}
                    />
                    <p className="text-xs text-muted-foreground mt-1">{t('customerApplyParametric:step2.cloudDependencyDesc')}</p>
                    <FieldError id="cloudDependency-error">{fieldErrors.cloudDependency}</FieldError>
                  </div>
                </div>

                <div>
                  <Label htmlFor="turnover">{t('customerApplyParametric:step2.annualTurnoverLabel')}<RequiredIndicator /></Label>
                  <Input
                    id="turnover"
                    type="number"
                    placeholder={t('customerApplyParametric:step2.annualTurnoverPlaceholder')}
                    value={annualTurnover}
                    onChange={(e) => { setAnnualTurnover(e.target.value); clearFieldError('annualTurnover'); }}
                    onBlur={() => {
                      const val = parseFloat(annualTurnover);
                      if (!annualTurnover.trim()) {
                        setFieldErrors((prev) => ({ ...prev, annualTurnover: t('common:validation.required') }));
                      } else if (isNaN(val) || val <= 0) {
                        setFieldErrors((prev) => ({ ...prev, annualTurnover: t('common:validation.number.positive') }));
                      } else {
                        clearFieldError('annualTurnover');
                      }
                    }}
                    aria-invalid={!!fieldErrors.annualTurnover}
                    aria-describedby={fieldErrors.annualTurnover ? 'annualTurnover-error' : undefined}
                    className="mt-1 focus-ring"
                    min={50000}
                    max={15000000}
                  />
                  <p className="text-xs text-muted-foreground mt-1">{t('customerApplyParametric:step2.eligibility')}</p>
                  <FieldError id="annualTurnover-error">{fieldErrors.annualTurnover}</FieldError>
                </div>

                <div className="relative">
                  <Label htmlFor="regionLocation">{t('customerApplyParametric:step2.locationLabel', 'Region / Location')}</Label>
                  <Input
                    id="regionLocation"
                    value={regionLocation}
                    onChange={(e) => {
                      setRegionLocation(e.target.value);
                      setShowLocationSuggestions(e.target.value.trim().length >= 3);
                    }}
                    onFocus={() => {
                      if (locationBlurTimeoutRef.current) {
                        window.clearTimeout(locationBlurTimeoutRef.current);
                        locationBlurTimeoutRef.current = null;
                      }
                      setShowLocationSuggestions(regionLocation.trim().length >= 3);
                    }}
                    onBlur={() => {
                      locationBlurTimeoutRef.current = window.setTimeout(() => {
                        setShowLocationSuggestions(false);
                      }, 100);
                    }}
                    placeholder={t('customerApplyParametric:step2.locationPlaceholder', 'e.g. Sfax, Tunisia or Tunis Governorate')}
                    className="mt-1 focus-ring"
                    autoComplete="off"
                  />
                  <p className="text-xs text-muted-foreground mt-1">{t('customerApplyParametric:step2.locationHelper', 'Enter the primary location or region for your cloud deployment.')}</p>
                  {locationSuggestionsLoading && (
                    <p className="text-xs text-muted-foreground mt-1">{t('customerApplyParametric:step2.loadingSuggestions', 'Loading location suggestions…')}</p>
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
                            setRegionLocation(suggestion.displayName);
                            setShowLocationSuggestions(false);
                          }}
                        >
                          {suggestion.displayName}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Auto-detected Turnover Band */}
                {selectedTurnoverBand && (
                  <div className="bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800/30 rounded-xl p-3 flex items-center gap-3 animate-fade-in-up">
                    <div className="bg-amber-100 dark:bg-amber-900/30 p-2 rounded-lg">
                      <Building className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">{t('customerApplyParametric:step2.turnoverBandDetected')}</p>
                      <p className="font-bold text-amber-800 dark:text-amber-300">{selectedTurnoverBand.name}</p>
                      <p className="text-[10px] text-amber-600 dark:text-amber-400">
                        {t('customerApplyParametric:step2.turnoverBandFactor', { factor: selectedTurnoverBand.riskFactor.toFixed(2) })}
                      </p>
                    </div>
                  </div>
                )}

                {/* Turnover validation */}
                {annualTurnover && parseFloat(annualTurnover) > 0 && (
                  <>
                    {parseFloat(annualTurnover) < 50000 && (
                      <div className="flex items-start gap-2 bg-red-50 border border-red-100 dark:bg-red-900/20 dark:border-red-800/30 p-3 rounded-xl animate-fade-in-up">
                        <AlertTriangle className="h-4 w-4 text-red-500 dark:text-red-400 mt-0.5 shrink-0" />
                        <p className="text-xs text-red-700 dark:text-red-300">{t('customerApplyParametric:step2.turnoverBelowMin')}</p>
                      </div>
                    )}
                    {parseFloat(annualTurnover) > 15000000 && (
                      <div className="flex items-start gap-2 bg-red-50 border border-red-100 dark:bg-red-900/20 dark:border-red-800/30 p-3 rounded-xl animate-fade-in-up">
                        <AlertTriangle className="h-4 w-4 text-red-500 dark:text-red-400 mt-0.5 shrink-0" />
                        <p className="text-xs text-red-700 dark:text-red-300">{t('customerApplyParametric:step2.turnoverAboveMax')}</p>
                      </div>
                    )}
                  </>
                )}

                {/* Live hourly revenue */}
                {hourlyRevenue > 0 && (
                  <div className="bg-emerald-50 border border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800/30 rounded-xl p-3 flex items-center gap-3 animate-scale-in">
                    <div className="bg-emerald-100 dark:bg-emerald-900/30 p-2 rounded-lg">
                      <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">{t('customerApplyParametric:step2.hourlyRevenue')}</p>
                      <p className="font-bold text-emerald-800 dark:text-emerald-300">{hourlyRevenue.toFixed(2)} {t('customerApplyParametric:step2.tndPerHour')}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* STEP 3: Resilience & Provider Factor */}
          {currentStep === 3 && (
            <Card className="border-none shadow-lg card-hover-lift">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" /> {t('customerApplyParametric:step3.title')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 dark:bg-blue-900/20 dark:border-blue-800/30 p-3 rounded-xl">
                  <Info className="h-4 w-4 text-blue-500 dark:text-blue-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-blue-700 dark:text-blue-300">{t('customerApplyParametric:step3.resilienceInfo')}</p>
                </div>

                {/* Resilience Profile Selection */}
                <div>
                  <Label className="text-sm font-medium mb-3 block">{t('customerApplyParametric:step3.resilienceProfileLabel')}<RequiredIndicator /></Label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {resilienceOptions.map((profile) => {
                      const isSelected = resilienceProfileId === String(profile.id);
                      return (
                        <button
                          key={profile.id}
                          type="button"
                          onClick={() => { setResilienceProfileId(String(profile.id)); clearFieldError('resilienceProfileId'); }}
                          className={`p-4 rounded-xl border-2 text-start transition-all ${
                            isSelected
                              ? 'border-primary bg-primary/5 shadow-md shadow-primary/10'
                              : 'border-border bg-card hover:border-primary/30 hover:bg-muted/50'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <p className="font-semibold text-sm">{profile.name}</p>
                            <Badge variant="outline" className="text-xs font-mono" title={profile.name}>
                              ×{profile.riskFactor.toFixed(2)}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">{profile.code}</p>
                        </button>
                      );
                    })}
                  </div>
                  <FieldError id="resilienceProfileId-error">{fieldErrors.resilienceProfileId}</FieldError>
                </div>
                <div className="border-t border-border pt-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <Label className="text-sm font-medium">{t('customerApplyParametric:step3.providerRiskFactor')}</Label>
                      <p className="text-xs text-muted-foreground">{t('customerApplyParametric:step3.providerRiskFactorDesc')}</p>
                    </div>
                    <Badge variant="outline" className="text-xs font-mono bg-primary/5" title={t('customerApplyParametric:step3.alwaysApplied')}>
                      {t('customerApplyParametric:step3.alwaysApplied')}
                    </Badge>
                  </div>

                  {selectedProvider && (
                    <div className={`rounded-xl p-4 border animate-fade-in-up ${
                      providerFactor > 1.2
                        ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800/30'
                        : 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800/30'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{selectedProvider.organisationName}</p>
                          <p className="text-xs text-muted-foreground">{t('customerApplyParametric:step3.asnTier', { asn: selectedProvider.asn, tier: selectedProvider.slaTier?.tierName || t('common:status.unknown') })}</p>
                        </div>
                        <div className="text-end">
                          <p className="text-xs text-muted-foreground">{t('customerApplyParametric:step3.premiumFactorLabel')}</p>
                          <p className={`text-xl font-bold ${
                            providerFactor > 1.2
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-green-600 dark:text-green-400'
                          }`}>
                            ×{providerFactor.toFixed(2)}
                          </p>
                        </div>
                      </div>
                      {selectedProvider.riskScore > 0 && (
                        <p className="text-xs text-muted-foreground mt-2">
                          {t('customerApplyParametric:step3.iodaRiskScore', { score: safeToFixed(Number(selectedProvider.riskScore ?? 0), 1) })}
                        </p>
                      )}
                    </div>
                  )}

                  {!selectedProvider && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">{t('customerApplyParametric:step3.noProvider')}</p>
                  )}
                </div>

                {/* Formula Disclosure */}
                <div className="bg-muted rounded-xl p-4 text-xs font-mono space-y-2">
                  <p className="font-sans font-semibold text-sm">{t('customerApplyParametric:step3.pricingFormulaTitle')}</p>
                  <p>{t('customerApplyParametric:step3.formulaStep1')}</p>
                  <p>{t('customerApplyParametric:step3.formulaStep2')}</p>
                  <p>{t('customerApplyParametric:step3.formulaStep3')}</p>
                  <p>{t('customerApplyParametric:step3.formulaStep4')}</p>
                  <p>{t('customerApplyParametric:step3.formulaStep5')}</p>
                  <p>{t('customerApplyParametric:step3.formulaStep6')}</p>
                  <p>{t('customerApplyParametric:step3.formulaStep7')}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* STEP 4: Review & Submit */}
          {currentStep === 4 && (
            <Card className="border-none shadow-lg card-hover-lift">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-primary" /> {t('customerApplyParametric:step4.title')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Summary */}
                <div className="bg-muted rounded-xl p-4 space-y-3">
                  <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">{t('customerApplyParametric:step4.applicationSummary')}</h4>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">{t('customerApplyParametric:step4.provider')}</p>
                      <p className="font-medium">{selectedProvider?.organisationName || '—'} (AS{selectedProvider?.asn})</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t('customerApplyParametric:step4.slaTier')}</p>
                      <Badge className={TIER_COLORS[selectedProvider?.slaTier?.tierName || 'Bronze']} title={selectedProvider?.slaTier?.tierName || '—'}>
                        {selectedProvider?.slaTier?.tierName || '—'} (MTTR: {selectedProvider?.mttrHours}h)
                      </Badge>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t('customerApplyParametric:step4.sector')}</p>
                      <p className="font-medium">{selectedSector?.name || '—'} (×{safeToFixed(selectedSector?.riskFactor, 2)})</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t('customerApplyParametric:step4.businessModel')}</p>
                      <p className="font-medium">{selectedBusinessModel?.name || '—'} (×{safeToFixed(selectedBusinessModel?.riskFactor, 2)})</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t('customerApplyParametric:step4.annualTurnover')}</p>
                      <p className="font-medium">{formatTnd(parseFloat(annualTurnover) || 0)} {t('common:unit.tnd', 'TND')}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t('customerApplyParametric:step4.hourlyRevenue')}</p>
                      <p className="font-medium">{hourlyRevenue.toFixed(2)} {t('common:unit.tnd', 'TND')}/hr</p>
                    </div>
                  </div>

                  <div className="border-t border-border pt-3 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">{t('customerApplyParametric:step4.grossMargin')}</p>
                      <p className="font-medium">{((previewBreakdown?.grossMargin || 0) * 100).toFixed(0)}%</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t('customerApplyParametric:step4.cloudDependency')}</p>
                      <p className="font-medium">{((previewBreakdown?.cloudDependency || 0) * 100).toFixed(0)}%</p>
                    </div>
                  </div>

                  <div className="border-t border-border pt-3 grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">{t('customerApplyParametric:step4.resilience')}</p>
                      <p className="font-medium">{selectedResilience?.name || '—'} (×{safeToFixed(previewBreakdown?.resilienceRiskFactor, 2)})</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t('customerApplyParametric:step4.turnoverBand')}</p>
                      <p className="font-medium">{selectedTurnoverBand?.name || '—'} (×{safeToFixed(previewBreakdown?.turnoverBandRiskFactor, 2)})</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t('customerApplyParametric:step4.providerFactor')}</p>
                      <p className="font-medium">×{safeToFixed(previewBreakdown?.providerFactor, 2)}</p>
                    </div>
                  </div>
                </div>

                {/* Pricing Breakdown */}
                {previewBreakdown && (
                  <div className="bg-blue-50 border border-blue-100 dark:bg-blue-900/20 dark:border-blue-800/30 rounded-xl p-4 space-y-2 animate-fade-in-up">
                    <p className="font-semibold text-sm text-blue-800 dark:text-blue-300">{t('customerApplyParametric:step4.pricingBreakdown')}</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div><span className="text-muted-foreground">{t('customerApplyParametric:step4.purePremium')}</span> <span className="font-medium">{formatTnd(previewBreakdown.purePremium)} {t('common:unit.tnd', 'TND')}</span></div>
                      <div><span className="text-muted-foreground">{t('customerApplyParametric:step4.afterLoading')}</span> <span className="font-medium">{formatTnd(previewBreakdown.commercialPremium)} {t('common:unit.tnd', 'TND')}</span></div>
                      <div><span className="text-muted-foreground">{t('customerApplyParametric:step4.afterProviderFactor')}</span> <span className="font-bold text-primary">{formatTnd(previewBreakdown.finalPremium)} {t('common:unit.tnd', 'TND')}</span></div>
                      <div><span className="text-muted-foreground">{t('customerApplyParametric:step4.premiumRate')}</span> <span className="font-bold">{previewBreakdown.premiumRatePct.toFixed(4)}%</span></div>
                    </div>
                  </div>
                )}

                {/* Underwriting Decision Preview */}
                {previewBreakdown && (
                  <div className={`rounded-xl p-4 border ${
                    UW_DECISION_STYLES[previewBreakdown.underwritingDecision]?.bg || ''
                  } ${
                    UW_DECISION_STYLES[previewBreakdown.underwritingDecision]?.border || ''
                  } animate-fade-in-up`}>
                    <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${
                      UW_DECISION_STYLES[previewBreakdown.underwritingDecision]?.text || ''
                    }`}>
                      {t('customerApplyParametric:step4.underwritingDecision')} {previewBreakdown.underwritingDecision.replace(/_/g, ' ')}
                    </p>
                    <p className={`text-xs ${
                      UW_DECISION_STYLES[previewBreakdown.underwritingDecision]?.text || ''
                    }`}>
                      {previewBreakdown.underwritingReason}
                    </p>
                  </div>
                )}

                {/* Terms */}
                <div className="space-y-1">
                  <div className="flex items-start gap-2">
                    <Checkbox
                    id="terms"
                    checked={acceptedTerms}
                    onCheckedChange={(checked) => { setAcceptedTerms(checked === true); if (checked) clearFieldError('acceptedTerms'); }}
                    className="mt-0.5"
                    aria-invalid={!!fieldErrors.acceptedTerms}
                    aria-describedby={fieldErrors.acceptedTerms ? 'acceptedTerms-error' : undefined}
                  />
                  <label htmlFor="terms" className="text-xs text-muted-foreground leading-relaxed">
                    {t('customerApplyParametric:step4.terms')} <RequiredIndicator />
                  </label>
                </div>
                <FieldError id="acceptedTerms-error">{fieldErrors.acceptedTerms}</FieldError>
              </div>
              </CardContent>
            </Card>
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

            {currentStep < 4 ? (
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
                disabled={submitting || (previewBreakdown?.underwritingDecision === 'DECLINE')}
                variant="tunis"
                className="font-bold flex items-center gap-1 transition-all hover:shadow-lg hover:shadow-[#E5693A]/20 hover:scale-[1.02]"
              >
                {submitting ? t('customerApplyParametric:step4.submitting') : t('customerApplyParametric:step4.submitButton')} <CheckCircle className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Premium Preview Sidebar */}
        <div className="space-y-4">
          <Card className="border-primary/30 border-2 sticky top-4 overflow-hidden animate-fade-in-right">
            <CardHeader className="bg-gradient-to-r from-[#2E5A9D] to-[#E5693A] text-white rounded-t-lg pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calculator className="h-5 w-5" /> {t('customerApplyParametric:sidebar.livePremiumCalculator')}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="bg-primary/5 rounded-xl p-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">{t('customerApplyParametric:sidebar.finalPremium')}</p>
                <p className="text-2xl font-bold text-primary animate-count-up">
                  {previewBreakdown ? `${formatTnd(previewBreakdown.finalPremium)} ${t('common:unit.tnd', 'TND')}` : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">{t('customerApplyParametric:sidebar.premiumRate')}</p>
                <p className="text-xl font-semibold">
                  {previewBreakdown ? `${previewBreakdown.premiumRatePct.toFixed(4)}%` : '—'}
                  <span className="text-sm text-muted-foreground ms-1">{t('customerApplyParametric:sidebar.ofTurnover')}</span>
                </p>
              </div>
              <div className="border-t border-border pt-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">{t('customerApplyParametric:sidebar.payoutPerHour')}</p>
                <p className="text-xl font-semibold text-emerald-600 dark:text-emerald-400">
                  {previewBreakdown ? `${previewBreakdown.payoutPerHour.toFixed(4)} ${t('common:unit.tnd', 'TND')}` : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">{t('customerApplyParametric:sidebar.maxPayoutPerEvent')}</p>
                <p className="text-lg font-semibold text-amber-600 dark:text-amber-400">
                  {previewBreakdown ? `${formatTnd(previewBreakdown.maxPayoutPerEvent)} ${t('common:unit.tnd', 'TND')}` : '—'}
                  <span className="text-xs text-muted-foreground ms-1">{t('customerApplyParametric:sidebar.168hCap')}</span>
                </p>
              </div>

              {/* Underwriting indicator */}
              {previewBreakdown && (
                <div className={`rounded-xl p-3 border ${
                  UW_DECISION_STYLES[previewBreakdown.underwritingDecision]?.bg || ''
                } ${
                  UW_DECISION_STYLES[previewBreakdown.underwritingDecision]?.border || ''
                }`}>
                  <div className="flex items-center gap-2">
                    {previewBreakdown.underwritingDecision === 'AUTO_ACCEPT' && <CheckCircle className="h-4 w-4 text-green-500" />}
                    {previewBreakdown.underwritingDecision === 'MANUAL_REVIEW' && <Info className="h-4 w-4 text-blue-500" />}
                    {previewBreakdown.underwritingDecision === 'SURCHARGE' && <AlertTriangle className="h-4 w-4 text-amber-500" />}
                    {previewBreakdown.underwritingDecision === 'DECLINE' && <AlertTriangle className="h-4 w-4 text-red-500" />}
                    <span className={`text-xs font-semibold ${
                      UW_DECISION_STYLES[previewBreakdown.underwritingDecision]?.text || ''
                    }`}>
                      {previewBreakdown.underwritingDecision.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
              )}

              {selectedProvider && (
                <div className="pt-3 border-t border-border">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{t('customerApplyParametric:sidebar.provider')}</p>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${TIER_GRADIENTS[selectedProvider.slaTier?.tierName ?? ''] || 'from-gray-400 to-gray-500'}`} />
                    <p className="text-sm font-medium">{selectedProvider.organisationName}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('customerApplyParametric:sidebar.providerDetail', {
                      mttr: selectedProvider.mttrHours,
                      factor: providerFactor.toFixed(2),
                      applied: t('customerApplyParametric:sidebar.applied'),
                    })}
                  </p>
                </div>
              )}

              <div className="pt-3 border-t border-border">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t('customerApplyParametric:sidebar.actuarialNoteWithProvider', { factor: providerFactor.toFixed(2) })}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

