import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import all translation files directly for SSR compatibility
import enCommon from '../../public/locales/en/common.json';
import enHome from '../../public/locales/en/home.json';
import enAbout from '../../public/locales/en/about.json';
import enContact from '../../public/locales/en/contact.json';
import enAuth from '../../public/locales/en/auth.json';
import enCustomerDashboard from '../../public/locales/en/customerDashboard.json';
import enCustomerWorkflow from '../../public/locales/en/customerWorkflow.json';
import enCustomerPolicyDetail from '../../public/locales/en/customerPolicyDetail.json';
import enCustomerClaims from '../../public/locales/en/customerClaims.json';
import enCustomerParametric from '../../public/locales/en/customerParametric.json';
import enCustomerCyber from '../../public/locales/en/customerCyber.json';
import enCustomerCyberApply from '../../public/locales/en/customerCyberApply.json';
import enCustomerApplyParametric from '../../public/locales/en/customerApplyParametric.json';
import enCustomerCoverageGap from '../../public/locales/en/customerCoverageGap.json';
import enCustomerOutageMonitor from '../../public/locales/en/customerOutageMonitor.json';
import enAdminDashboard from '../../public/locales/en/adminDashboard.json';
import enAdminCommon from '../../public/locales/en/adminCommon.json';
import enAdminClaimReview from '../../public/locales/en/adminClaimReview.json';
import enAdminCyberApps from '../../public/locales/en/adminCyberApps.json';
import enAdminCyberClaims from '../../public/locales/en/adminCyberClaims.json';
import enAdminOutageMonitor from '../../public/locales/en/adminOutageMonitor.json';
import enAdminParametricClaims from '../../public/locales/en/adminParametricClaims.json';
import enAdminParametricPolicy from '../../public/locales/en/adminParametricPolicy.json';
import enAdminPolicyHolders from '../../public/locales/en/adminPolicyHolders.json';
import enAdminPolicyReview from '../../public/locales/en/adminPolicyReview.json';
import enAdminWorkflow from '../../public/locales/en/adminWorkflow.json';
import enCustomerApplyPolicy from '../../public/locales/en/customerApplyPolicy.json';
import enCustomerHistory from '../../public/locales/en/customerHistory.json';
import enCustomerPolicyApplication from '../../public/locales/en/customerPolicyApplication.json';
import enCustomerQuestions from '../../public/locales/en/customerQuestions.json';
import enIoda from '../../public/locales/en/ioda.json';
import enEngine from '../../public/locales/en/engine.json';
import enAdminReinsurance from '../../public/locales/en/adminReinsurance.json';
import enAdminClaimReserves from '../../public/locales/en/adminClaimReserves.json';
import enAdminEndorsements from '../../public/locales/en/adminEndorsements.json';
import enAdminRenewals from '../../public/locales/en/adminRenewals.json';
import enAdminPayoutFunctions from '../../public/locales/en/adminPayoutFunctions.json';
import enAdminReferenceData from '../../public/locales/en/adminReferenceData.json';

import frCommon from '../../public/locales/fr/common.json';
import frHome from '../../public/locales/fr/home.json';
import frAbout from '../../public/locales/fr/about.json';
import frContact from '../../public/locales/fr/contact.json';
import frAuth from '../../public/locales/fr/auth.json';
import frCustomerDashboard from '../../public/locales/fr/customerDashboard.json';
import frCustomerWorkflow from '../../public/locales/fr/customerWorkflow.json';
import frCustomerPolicyDetail from '../../public/locales/fr/customerPolicyDetail.json';
import frCustomerClaims from '../../public/locales/fr/customerClaims.json';
import frCustomerParametric from '../../public/locales/fr/customerParametric.json';
import frCustomerCyber from '../../public/locales/fr/customerCyber.json';
import frCustomerCyberApply from '../../public/locales/fr/customerCyberApply.json';
import frCustomerApplyParametric from '../../public/locales/fr/customerApplyParametric.json';
import frCustomerCoverageGap from '../../public/locales/fr/customerCoverageGap.json';
import frCustomerOutageMonitor from '../../public/locales/fr/customerOutageMonitor.json';
import frAdminDashboard from '../../public/locales/fr/adminDashboard.json';
import frAdminCommon from '../../public/locales/fr/adminCommon.json';
import frAdminClaimReview from '../../public/locales/fr/adminClaimReview.json';
import frAdminCyberApps from '../../public/locales/fr/adminCyberApps.json';
import frAdminCyberClaims from '../../public/locales/fr/adminCyberClaims.json';
import frAdminOutageMonitor from '../../public/locales/fr/adminOutageMonitor.json';
import frAdminParametricClaims from '../../public/locales/fr/adminParametricClaims.json';
import frAdminParametricPolicy from '../../public/locales/fr/adminParametricPolicy.json';
import frAdminPolicyHolders from '../../public/locales/fr/adminPolicyHolders.json';
import frAdminPolicyReview from '../../public/locales/fr/adminPolicyReview.json';
import frAdminWorkflow from '../../public/locales/fr/adminWorkflow.json';
import frCustomerApplyPolicy from '../../public/locales/fr/customerApplyPolicy.json';
import frCustomerHistory from '../../public/locales/fr/customerHistory.json';
import frCustomerPolicyApplication from '../../public/locales/fr/customerPolicyApplication.json';
import frCustomerQuestions from '../../public/locales/fr/customerQuestions.json';
import frIoda from '../../public/locales/fr/ioda.json';
import frEngine from '../../public/locales/fr/engine.json';
import frAdminReinsurance from '../../public/locales/fr/adminReinsurance.json';
import frAdminClaimReserves from '../../public/locales/fr/adminClaimReserves.json';
import frAdminEndorsements from '../../public/locales/fr/adminEndorsements.json';
import frAdminRenewals from '../../public/locales/fr/adminRenewals.json';
import frAdminPayoutFunctions from '../../public/locales/fr/adminPayoutFunctions.json';
import frAdminReferenceData from '../../public/locales/fr/adminReferenceData.json';

import arCommon from '../../public/locales/ar/common.json';
import arHome from '../../public/locales/ar/home.json';
import arAbout from '../../public/locales/ar/about.json';
import arContact from '../../public/locales/ar/contact.json';
import arAuth from '../../public/locales/ar/auth.json';
import arCustomerDashboard from '../../public/locales/ar/customerDashboard.json';
import arCustomerWorkflow from '../../public/locales/ar/customerWorkflow.json';
import arCustomerPolicyDetail from '../../public/locales/ar/customerPolicyDetail.json';
import arCustomerClaims from '../../public/locales/ar/customerClaims.json';
import arCustomerParametric from '../../public/locales/ar/customerParametric.json';
import arCustomerCyber from '../../public/locales/ar/customerCyber.json';
import arCustomerCyberApply from '../../public/locales/ar/customerCyberApply.json';
import arCustomerApplyParametric from '../../public/locales/ar/customerApplyParametric.json';
import arCustomerCoverageGap from '../../public/locales/ar/customerCoverageGap.json';
import arCustomerOutageMonitor from '../../public/locales/ar/customerOutageMonitor.json';
import arAdminDashboard from '../../public/locales/ar/adminDashboard.json';
import arAdminCommon from '../../public/locales/ar/adminCommon.json';
import arAdminClaimReview from '../../public/locales/ar/adminClaimReview.json';
import arAdminCyberApps from '../../public/locales/ar/adminCyberApps.json';
import arAdminCyberClaims from '../../public/locales/ar/adminCyberClaims.json';
import arAdminOutageMonitor from '../../public/locales/ar/adminOutageMonitor.json';
import arAdminParametricClaims from '../../public/locales/ar/adminParametricClaims.json';
import arAdminParametricPolicy from '../../public/locales/ar/adminParametricPolicy.json';
import arAdminPolicyHolders from '../../public/locales/ar/adminPolicyHolders.json';
import arAdminPolicyReview from '../../public/locales/ar/adminPolicyReview.json';
import arAdminWorkflow from '../../public/locales/ar/adminWorkflow.json';
import arCustomerApplyPolicy from '../../public/locales/ar/customerApplyPolicy.json';
import arCustomerHistory from '../../public/locales/ar/customerHistory.json';
import arCustomerPolicyApplication from '../../public/locales/ar/customerPolicyApplication.json';
import arCustomerQuestions from '../../public/locales/ar/customerQuestions.json';
import arIoda from '../../public/locales/ar/ioda.json';
import arEngine from '../../public/locales/ar/engine.json';
import arAdminReinsurance from '../../public/locales/ar/adminReinsurance.json';
import arAdminClaimReserves from '../../public/locales/ar/adminClaimReserves.json';
import arAdminEndorsements from '../../public/locales/ar/adminEndorsements.json';
import arAdminRenewals from '../../public/locales/ar/adminRenewals.json';
import arAdminPayoutFunctions from '../../public/locales/ar/adminPayoutFunctions.json';
import arAdminReferenceData from '../../public/locales/ar/adminReferenceData.json';

const resources = {
  en: {
    common: enCommon,
    home: enHome,
    about: enAbout,
    contact: enContact,
    auth: enAuth,
    customerDashboard: enCustomerDashboard,
    customerWorkflow: enCustomerWorkflow,
    customerPolicyDetail: enCustomerPolicyDetail,
    customerClaims: enCustomerClaims,
    customerParametric: enCustomerParametric,
    customerCyber: enCustomerCyber,
    customerCyberApply: enCustomerCyberApply,
    customerApplyParametric: enCustomerApplyParametric,
    customerCoverageGap: enCustomerCoverageGap,
    customerOutageMonitor: enCustomerOutageMonitor,
    adminDashboard: enAdminDashboard,
    adminCommon: enAdminCommon,
    adminClaimReview: enAdminClaimReview,
    adminCyberApps: enAdminCyberApps,
    adminCyberClaims: enAdminCyberClaims,
    adminOutageMonitor: enAdminOutageMonitor,
    adminParametricClaims: enAdminParametricClaims,
    adminParametricPolicy: enAdminParametricPolicy,
    adminPolicyHolders: enAdminPolicyHolders,
    adminPolicyReview: enAdminPolicyReview,
    adminWorkflow: enAdminWorkflow,
    customerApplyPolicy: enCustomerApplyPolicy,
    customerHistory: enCustomerHistory,
    customerPolicyApplication: enCustomerPolicyApplication,
    customerQuestions: enCustomerQuestions,
    ioda: enIoda,
    engine: enEngine,
    adminReinsurance: enAdminReinsurance,
    adminClaimReserves: enAdminClaimReserves,
    adminEndorsements: enAdminEndorsements,
    adminRenewals: enAdminRenewals,
    adminPayoutFunctions: enAdminPayoutFunctions,
    adminReferenceData: enAdminReferenceData,
  },
  fr: {
    common: frCommon,
    home: frHome,
    about: frAbout,
    contact: frContact,
    auth: frAuth,
    customerDashboard: frCustomerDashboard,
    customerWorkflow: frCustomerWorkflow,
    customerPolicyDetail: frCustomerPolicyDetail,
    customerClaims: frCustomerClaims,
    customerParametric: frCustomerParametric,
    customerCyber: frCustomerCyber,
    customerCyberApply: frCustomerCyberApply,
    customerApplyParametric: frCustomerApplyParametric,
    customerCoverageGap: frCustomerCoverageGap,
    customerOutageMonitor: frCustomerOutageMonitor,
    adminDashboard: frAdminDashboard,
    adminCommon: frAdminCommon,
    adminClaimReview: frAdminClaimReview,
    adminCyberApps: frAdminCyberApps,
    adminCyberClaims: frAdminCyberClaims,
    adminOutageMonitor: frAdminOutageMonitor,
    adminParametricClaims: frAdminParametricClaims,
    adminParametricPolicy: frAdminParametricPolicy,
    adminPolicyHolders: frAdminPolicyHolders,
    adminPolicyReview: frAdminPolicyReview,
    adminWorkflow: frAdminWorkflow,
    customerApplyPolicy: frCustomerApplyPolicy,
    customerHistory: frCustomerHistory,
    customerPolicyApplication: frCustomerPolicyApplication,
    customerQuestions: frCustomerQuestions,
    ioda: frIoda,
    engine: frEngine,
    adminReinsurance: frAdminReinsurance,
    adminClaimReserves: frAdminClaimReserves,
    adminEndorsements: frAdminEndorsements,
    adminRenewals: frAdminRenewals,
    adminPayoutFunctions: frAdminPayoutFunctions,
    adminReferenceData: frAdminReferenceData,
  },
  ar: {
    common: arCommon,
    home: arHome,
    about: arAbout,
    contact: arContact,
    auth: arAuth,
    customerDashboard: arCustomerDashboard,
    customerWorkflow: arCustomerWorkflow,
    customerPolicyDetail: arCustomerPolicyDetail,
    customerClaims: arCustomerClaims,
    customerParametric: arCustomerParametric,
    customerCyber: arCustomerCyber,
    customerCyberApply: arCustomerCyberApply,
    customerApplyParametric: arCustomerApplyParametric,
    customerCoverageGap: arCustomerCoverageGap,
    customerOutageMonitor: arCustomerOutageMonitor,
    adminDashboard: arAdminDashboard,
    adminCommon: arAdminCommon,
    adminClaimReview: arAdminClaimReview,
    adminCyberApps: arAdminCyberApps,
    adminCyberClaims: arAdminCyberClaims,
    adminOutageMonitor: arAdminOutageMonitor,
    adminParametricClaims: arAdminParametricClaims,
    adminParametricPolicy: arAdminParametricPolicy,
    adminPolicyHolders: arAdminPolicyHolders,
    adminPolicyReview: arAdminPolicyReview,
    adminWorkflow: arAdminWorkflow,
    customerApplyPolicy: arCustomerApplyPolicy,
    customerHistory: arCustomerHistory,
    customerPolicyApplication: arCustomerPolicyApplication,
    customerQuestions: arCustomerQuestions,
    ioda: arIoda,
    engine: arEngine,
    adminReinsurance: arAdminReinsurance,
    adminClaimReserves: arAdminClaimReserves,
    adminEndorsements: arAdminEndorsements,
    adminRenewals: arAdminRenewals,
    adminPayoutFunctions: arAdminPayoutFunctions,
    adminReferenceData: arAdminReferenceData,
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    supportedLngs: ['en', 'fr', 'ar'],
    ns: [
      'common', 'home', 'about', 'contact', 'auth',
      'customerDashboard', 'customerWorkflow', 'customerPolicyDetail',
      'customerClaims', 'customerParametric', 'customerCyber',
      'customerCyberApply', 'customerApplyParametric', 'customerCoverageGap',
      'customerOutageMonitor', 'adminDashboard', 'adminCommon',
      'adminClaimReview', 'adminCyberApps', 'adminCyberClaims',
      'adminOutageMonitor', 'adminParametricClaims', 'adminParametricPolicy',
      'adminPolicyHolders', 'adminPolicyReview', 'adminWorkflow',
      'customerApplyPolicy', 'customerHistory', 'customerPolicyApplication',
      'customerQuestions', 'ioda', 'engine',
      'adminReinsurance', 'adminClaimReserves', 'adminEndorsements',
      'adminRenewals', 'adminPayoutFunctions', 'adminReferenceData',
    ],
    defaultNS: 'common',
    detection: {
      order: ['localStorage', 'cookie', 'navigator'],
      lookupLocalStorage: 'cobitun_lang',
      lookupCookie: 'cobitun_lang',
      caches: ['localStorage', 'cookie'],
      cookieMinutes: 60 * 24 * 365,
    },
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
    load: 'languageOnly',
    lng: undefined,
  });

export default i18n;

// RTL language list
export const RTL_LANGUAGES = ['ar'];

export function isRTL(lng?: string): boolean {
  const language = lng || i18n.language;
  return RTL_LANGUAGES.includes(language);
}

export function getDirection(lng?: string): 'rtl' | 'ltr' {
  return isRTL(lng) ? 'rtl' : 'ltr';
}

export function formatCurrency(amount: number, lng?: string): string {
  const language = lng || i18n.language;
  const locale = language === 'ar' ? 'ar-TN' : language === 'fr' ? 'fr-TN' : 'en';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'TND',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatNumber(num: number, lng?: string, options?: Intl.NumberFormatOptions): string {
  const language = lng || i18n.language;
  const locale = language === 'ar' ? 'ar-TN' : language === 'fr' ? 'fr-TN' : 'en';
  return new Intl.NumberFormat(locale, options).format(num);
}

export function formatDate(date: string | Date, lng?: string, options?: Intl.DateTimeFormatOptions): string {
  const language = lng || i18n.language;
  const locale = language === 'ar' ? 'ar-TN' : language === 'fr' ? 'fr-TN' : 'en';
  const defaultOptions: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };
  return new Date(date).toLocaleDateString(locale, options || defaultOptions);
}

export function formatDateTime(date: string | Date, lng?: string): string {
  return formatDate(date, lng, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function formatCompactNumber(num: number, lng?: string): string {
  const language = lng || i18n.language;
  const locale = language === 'ar' ? 'ar-TN' : language === 'fr' ? 'fr-TN' : 'en';
  return new Intl.NumberFormat(locale, {
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: 1,
  }).format(num);
}

export const SUPPORTED_LANGUAGES: Record<string, { code: string; name: string; nativeName: string; dir: 'ltr' | 'rtl' }> = {
  en: { code: 'en', name: 'English', nativeName: 'English', dir: 'ltr' },
  fr: { code: 'fr', name: 'French', nativeName: 'Français', dir: 'ltr' },
  ar: { code: 'ar', name: 'Arabic', nativeName: 'العربية', dir: 'rtl' },
};

