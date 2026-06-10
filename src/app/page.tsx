'use client';

import { useAppStore } from '@/lib/store';
import { Roles } from '@/lib/roles';
import HomePage from '@/components/pages/HomePage';
import AdminLoginPage from '@/components/pages/AdminLoginPage';
import CustomerLoginPage from '@/components/pages/CustomerLoginPage';
import CustomerSignupPage from '@/components/pages/CustomerSignupPage';
import AdminDashboardPage from '@/components/pages/AdminDashboardPage';
import AdminCustomersPage from '@/components/pages/AdminCustomersPage';
import AdminCategoriesPage from '@/components/pages/AdminCategoriesPage';
import AdminPoliciesPage from '@/components/pages/AdminPoliciesPage';
import AdminPolicyHoldersPage from '@/components/pages/AdminPolicyHoldersPage';
import AdminQuestionsPage from '@/components/pages/AdminQuestionsPage';
import CustomerDashboardPage from '@/components/pages/CustomerDashboardPage';
import CustomerApplyPolicyPage from '@/components/pages/CustomerApplyPolicyPage';
import CustomerHistoryPage from '@/components/pages/CustomerHistoryPage';
import CustomerQuestionsPage from '@/components/pages/CustomerQuestionsPage';
import AboutPage from '@/components/pages/AboutPage';
import ContactPage from '@/components/pages/ContactPage';
// Parametric Cloud Outage Insurance Pages
import AdminOutageMonitorPage from '@/components/pages/AdminOutageMonitorPage';
import AdminParametricClaimsPage from '@/components/pages/AdminParametricClaimsPage';
import AdminCloudProvidersPage from '@/components/pages/AdminCloudProvidersPage';
import AdminParametricPolicyRequestsPage from '@/components/pages/AdminParametricPolicyRequestsPage';
import ApplyParametricPolicyPage from '@/components/pages/ApplyParametricPolicyPage';
import CustomerParametricPoliciesPage from '@/components/pages/CustomerParametricPoliciesPage';
import CustomerParametricClaimsPage from '@/components/pages/CustomerParametricClaimsPage';
import CustomerOutageMonitorPage from '@/components/pages/CustomerOutageMonitorPage';
import CustomerSessionsPage from '@/components/pages/CustomerSessionsPage';
// Cyber Indemnity Insurance Pages
import AdminCyberApplicationsPage from '@/components/pages/AdminCyberApplicationsPage';
import AdminCyberClaimsPage from '@/components/pages/AdminCyberClaimsPage';
import CyberApplyPage from '@/components/pages/CyberApplyPage';
import CustomerCyberPoliciesPage from '@/components/pages/CustomerCyberPoliciesPage';
import CustomerCyberClaimsPage from '@/components/pages/CustomerCyberClaimsPage';
import CoverageGapAnalyzerPage from '@/components/pages/CoverageGapAnalyzerPage';
// Workflow Engine Pages
import CustomerWorkflowPage from '@/components/pages/CustomerWorkflowPage';
import CustomerPolicyApplicationPage from '@/components/pages/CustomerPolicyApplicationPage';
import CustomerPolicyDetailPage from '@/components/pages/CustomerPolicyDetailPage';
import CustomerClaimPage from '@/components/pages/CustomerClaimPage';
import AdminWorkflowPage from '@/components/pages/AdminWorkflowPage';
import AdminPolicyReviewPage from '@/components/pages/AdminPolicyReviewPage';
import AdminClaimReviewPage from '@/components/pages/AdminClaimReviewPage';
// Reinsurance & Actuarial Pages
import AdminReinsurancePage from '@/components/pages/AdminReinsurancePage';
import AdminClaimReservesPage from '@/components/pages/AdminClaimReservesPage';
import AdminEndorsementsPage from '@/components/pages/AdminEndorsementsPage';
import AdminRenewalsPage from '@/components/pages/AdminRenewalsPage';
import AdminPayoutFunctionsPage from '@/components/pages/AdminPayoutFunctionsPage';
import AdminReferenceDataPage from '@/components/pages/AdminReferenceDataPage';
import AdminSessionsPage from '@/components/pages/AdminSessionsPage';
import AdminNotificationsPage from '@/components/pages/AdminNotificationsPage';
import AdminUsersPageWrapper from '@/components/pages/AdminUsersPageWrapper';
import AdminIODAConfigPage from '@/components/pages/AdminIODAConfigPage';
import AdminRefundsPage from '@/components/pages/AdminRefundsPage';
import AdminFraudDetectionPage from '@/components/pages/AdminFraudDetectionPage';
import CustomerNotificationsPage from '@/components/pages/CustomerNotificationsPage';
import CustomerDraftClaimsPage from '@/components/pages/CustomerDraftClaimsPage';
import CustomerNotificationPreferencesPage from '@/components/pages/CustomerNotificationPreferencesPage';
import AccountSettingsPage from '@/components/pages/AccountSettingsPage';
import ForgotPasswordPage from '@/components/pages/ForgotPasswordPage';
import ResetPasswordPage from '@/components/pages/ResetPasswordPage';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  LayoutDashboard,
  Users,
  FolderOpen,
  FileText,
  Shield,
  MessageSquare,
  LogOut,
  Menu,
  X,
  ChevronRight,
  HelpCircle,
  History,
  Cloud,
  SatelliteDish,
  DollarSign,
  Zap,
  GitCompare,
  AlertCircle,
  ClipboardList,
  ShieldCheck,
  Landmark,
  FileEdit,
  RefreshCw,
  FunctionSquare,
  Database,
  Settings,
  Clock,
  Bell,
  ChevronLeft,
  Home,
  BarChart3,
} from 'lucide-react';
import { ThemeToggle, ThemeToggleCompact } from '@/components/ThemeToggle';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import ErrorBoundary from '@/components/ErrorBoundary';
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

// Public pages (no sidebar)
const publicPages = ['home', 'admin-login', 'customer-login', 'customer-signup', 'about', 'contact', 'forgot-password', 'reset-password'];

// Admin sidebar menu items - function that takes translation function
const getAdminMenuItems = (t: TFunction) => [
  { id: 'admin-dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
  { id: 'admin-fraud-detection', label: t('nav.fraudDetection', 'Fraud Detection'), icon: BarChart3 },
  { id: 'account-settings', label: t('nav.accountSettings', 'Account Settings'), icon: Settings },
  { id: 'admin-sessions', label: t('nav.sessionActivity', 'Session Activity'), icon: Clock },
  { id: 'admin-customers', label: t('nav.customers'), icon: Users },
  { id: 'admin-categories', label: t('nav.categories'), icon: FolderOpen },
  { id: 'admin-policies', label: t('nav.policies'), icon: FileText },
  { id: 'admin-policy-holders', label: t('nav.policyHolders'), icon: Shield },
  { id: 'admin-questions', label: t('nav.questions'), icon: MessageSquare },
  // Parametric section separator
  { id: 'admin-outage-monitor', label: t('nav.outageMonitor'), icon: SatelliteDish },
  { id: 'admin-parametric-claims', label: t('nav.parametricClaims'), icon: DollarSign },
  { id: 'admin-cloud-providers', label: t('nav.cloudProviders'), icon: Cloud },
  { id: 'admin-parametric-policy-requests', label: t('nav.policyRequests'), icon: Zap },
  // Cyber Indemnity section
  { id: 'admin-cyber-applications', label: t('nav.cyberApplications'), icon: Shield },
  { id: 'admin-cyber-claims', label: t('nav.cyberClaims'), icon: AlertCircle },
  // Reinsurance & Actuarial section
  { id: 'admin-reinsurance', label: t('nav.reinsurance'), icon: ShieldCheck },
  { id: 'admin-claim-reserves', label: t('nav.claimReserves'), icon: Landmark },
  { id: 'admin-endorsements', label: t('nav.endorsements'), icon: FileEdit },
  { id: 'admin-renewals', label: t('nav.renewals'), icon: RefreshCw },
  { id: 'admin-payout-functions', label: t('nav.payoutFunctions'), icon: FunctionSquare },
  { id: 'admin-reference-data', label: t('nav.referenceData'), icon: Database },
  // Admin Management
  { id: 'admin-users', label: t('nav.adminUsers', 'Admin Users'), icon: Users },
  { id: 'admin-notifications', label: t('nav.notifications', 'Notifications'), icon: Bell },
  { id: 'admin-ioda-config', label: t('nav.iodaConfig', 'IODA Config'), icon: SatelliteDish },
  { id: 'admin-refunds', label: t('nav.refunds', 'Refunds'), icon: DollarSign },
  // Workflow Engine
  { id: 'admin-workflow', label: t('nav.workflow'), icon: ClipboardList },
  { id: 'admin-policy-review', label: t('nav.policyReview', 'Policy Review'), icon: FileText },
  { id: 'admin-claim-review', label: t('nav.claimReview', 'Claim Review'), icon: AlertCircle },
];

// Customer sidebar menu items - function that takes translation function
const getCustomerMenuItems = (t: TFunction) => [
  { id: 'customer-dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
  { id: 'account-settings', label: t('nav.accountSettings', 'Account Settings'), icon: Settings },
  { id: 'customer-sessions', label: t('nav.securitySettings', 'Security Settings'), icon: Shield },
  { id: 'customer-notifications', label: t('nav.notifications', 'Notifications'), icon: Bell },
  { id: 'customer-notification-preferences', label: t('nav.notifPrefs', 'Notif. Preferences'), icon: Settings },
  { id: 'customer-apply-policy', label: t('nav.applyPolicy'), icon: FileText },
  { id: 'customer-history', label: t('nav.policyHistory'), icon: History },
  { id: 'customer-questions', label: t('nav.askQuestion'), icon: HelpCircle },
  // Parametric section
  { id: 'apply-parametric-policy', label: t('nav.cloudInsurance'), icon: Cloud },
  { id: 'customer-parametric-policies', label: t('nav.myPolicies'), icon: Shield },
  { id: 'customer-parametric-claims', label: t('nav.myClaims'), icon: DollarSign },
  { id: 'customer-draft-claims', label: t('nav.draftClaims', 'Draft Claims'), icon: AlertCircle },
  { id: 'customer-outage-monitor', label: t('nav.outageMonitor'), icon: SatelliteDish },
  // Cyber Indemnity section
  { id: 'apply-cyber-policy', label: t('nav.cyberInsurance'), icon: Shield },
  { id: 'customer-cyber-policies', label: t('nav.cyberPolicies'), icon: FileText },
  { id: 'customer-cyber-claims', label: t('nav.cyberClaims'), icon: AlertCircle },
  { id: 'coverage-gap-analyzer', label: t('nav.gapAnalyzer'), icon: GitCompare },
  // Workflow Engine section
  { id: 'customer-workflow', label: t('nav.myWorkflow'), icon: ClipboardList },
];

// Section metadata for admin menu (used for breadcrumbs and section labels)
const adminSections: Record<string, { startIdx: number; labelKey: string; icon: React.ComponentType<{ className?: string }> }> = {
  cloudOutage: { startIdx: 8, labelKey: 'nav.cloudOutage', icon: Cloud },
  cyberIndemnity: { startIdx: 12, labelKey: 'nav.cyberIndemnity', icon: Shield },
  reinsurance: { startIdx: 14, labelKey: 'nav.reinsuranceActuarial', icon: ShieldCheck },
  adminMgmt: { startIdx: 20, labelKey: 'nav.adminManagement', icon: Users },
  workflow: { startIdx: 24, labelKey: 'nav.policyWorkflow', icon: ClipboardList },
};

// Section metadata for customer menu
const customerSections: Record<string, { startIdx: number; labelKey: string; icon: React.ComponentType<{ className?: string }> }> = {
  cloudOutage: { startIdx: 8, labelKey: 'nav.cloudOutage', icon: Cloud },
  cyberIndemnity: { startIdx: 13, labelKey: 'nav.cyberIndemnity', icon: Shield },
  workflow: { startIdx: 17, labelKey: 'nav.policyWorkflow', icon: ClipboardList },
};

// Helper to get the section name for a given page ID
function getPageSection(pageId: string, menuItems: { id: string }[], sections: Record<string, { startIdx: number; labelKey: string }>, t: TFunction): string | null {
  const idx = menuItems.findIndex(item => item.id === pageId);
  if (idx < 0) return null;
  // Find which section this index falls into
  const sortedSections = Object.values(sections).sort((a, b) => b.startIdx - a.startIdx);
  for (const section of sortedSections) {
    if (idx >= section.startIdx) return t(section.labelKey);
  }
  return null; // Core section (before first separator)
}

// Breadcrumb component for authenticated layouts
function PageBreadcrumb({ currentPage, menuItems, sections, goBack }: { currentPage: string; menuItems: { id: string; label: string }[]; sections: Record<string, { startIdx: number; labelKey: string }>; goBack: () => void }) {
  const { t } = useTranslation('common');
  const currentItem = menuItems.find(item => item.id === currentPage);
  const sectionName = getPageSection(currentPage, menuItems, sections, t);

  if (!currentItem) return null;

  return (
    <nav aria-label={t('nav.breadcrumb', 'Breadcrumb')} className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
      <button
        onClick={goBack}
        className="flex items-center gap-1 hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted/50"
        aria-label={t('nav.goBack', 'Go back')}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <Home className="h-3.5 w-3.5" />
      <ChevronRight className="h-3 w-3" />
      {sectionName && (
        <>
          <span className="truncate max-w-[120px]">{sectionName}</span>
          <ChevronRight className="h-3 w-3" />
        </>
      )}
      <span className="text-foreground font-medium truncate">{currentItem.label}</span>
    </nav>
  );
}

function AdminSidebar({ currentPage, setCurrentPage, onLogout }: { currentPage: string; setCurrentPage: (p: string) => void; onLogout: () => void }) {
  const [collapsed, setCollapsed] = useState(false);
  const { t } = useTranslation('common');
  const adminMenuItems = getAdminMenuItems(t);

  return (
    <div className={`${collapsed ? 'w-16' : 'w-64'} bg-gradient-to-b from-tunis-navy via-tunis-navy-light to-tunis-navy-mid text-white min-h-screen flex flex-col transition-all duration-300 shrink-0 border-e border-white/[0.06]`}>
      {/* Logo */}
      <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
        {!collapsed && (
          <div className="flex items-center gap-2.5 animate-fade-in-left">
            <div className="bg-tunis-blue/20 p-1.5 rounded-lg border border-tunis-blue/30">
              <Shield className="h-5 w-5 text-tunis-orange" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-lg leading-tight">COBITUN</span>
              <span className="text-[9px] text-tunis-orange/80 uppercase tracking-[0.2em] font-medium">{t('nav.adminPanel')}</span>
            </div>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg hover:bg-white/5 transition-all hover:text-tunis-orange"
        >
          {collapsed ? <Menu className="h-5 w-5" /> : <X className="h-5 w-5" />}
        </button>
      </div>

      {/* Menu Items */}
      <ScrollArea className="flex-1 py-4">
        <nav className="space-y-1 px-2">
          {adminMenuItems.map((item, idx) => (
            <div key={item.id}>
              {/* Section separator before parametric items */}
              {idx === 8 && !collapsed && (
                <div className="px-3 pt-4 pb-2">
                  <div className="flex items-center gap-2 mb-1">
                    <Cloud className="h-3.5 w-3.5 text-tunis-orange" />
                    <p className="text-[11px] font-semibold text-tunis-orange uppercase tracking-wider">{t('nav.cloudOutage')}</p>
                  </div>
                  <div className="h-px bg-gradient-to-e from-tunis-orange/30 to-transparent" />
                </div>
              )}
              {idx === 8 && collapsed && <div className="border-t border-white/[0.06] my-3" />}
              {idx === 12 && !collapsed && (
                <div className="px-3 pt-4 pb-2">
                  <div className="flex items-center gap-2 mb-1">
                    <Shield className="h-3.5 w-3.5 text-tunis-orange" />
                    <p className="text-[11px] font-semibold text-tunis-orange uppercase tracking-wider">{t('nav.cyberIndemnity')}</p>
                  </div>
                  <div className="h-px bg-gradient-to-e from-tunis-orange/30 to-transparent" />
                </div>
              )}
              {idx === 12 && collapsed && <div className="border-t border-white/[0.06] my-3" />}
              {idx === 14 && !collapsed && (
                <div className="px-3 pt-4 pb-2">
                  <div className="flex items-center gap-2 mb-1">
                    <ShieldCheck className="h-3.5 w-3.5 text-tunis-orange" />
                    <p className="text-[11px] font-semibold text-tunis-orange uppercase tracking-wider">{t('nav.reinsuranceActuarial')}</p>
                  </div>
                  <div className="h-px bg-gradient-to-e from-tunis-orange/30 to-transparent" />
                </div>
              )}
              {idx === 14 && collapsed && <div className="border-t border-white/[0.06] my-3" />}
              {idx === 20 && !collapsed && (
                <div className="px-3 pt-4 pb-2">
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="h-3.5 w-3.5 text-tunis-orange" />
                    <p className="text-[11px] font-semibold text-tunis-orange uppercase tracking-wider">{t('nav.adminManagement', 'Admin Management')}</p>
                  </div>
                  <div className="h-px bg-gradient-to-e from-tunis-orange/30 to-transparent" />
                </div>
              )}
              {idx === 20 && collapsed && <div className="border-t border-white/[0.06] my-3" />}
              {idx === 24 && !collapsed && (
                <div className="px-3 pt-4 pb-2">
                  <div className="flex items-center gap-2 mb-1">
                    <ClipboardList className="h-3.5 w-3.5 text-tunis-orange" />
                    <p className="text-[11px] font-semibold text-tunis-orange uppercase tracking-wider">{t('nav.policyWorkflow')}</p>
                  </div>
                  <div className="h-px bg-gradient-to-e from-tunis-orange/30 to-transparent" />
                </div>
              )}
              {idx === 24 && collapsed && <div className="border-t border-white/[0.06] my-3" />}
              <button
                onClick={() => setCurrentPage(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-start group relative ${
                  currentPage === item.id
                    ? 'bg-tunis-blue-light text-white shadow-lg shadow-tunis-blue-light/30'
                    : 'text-slate-200 hover:bg-muted hover:text-foreground'
                }`}
              >
                {currentPage === item.id && <span className="absolute start-0 top-1/2 -translate-y-1/2 w-[3px] h-3/5 bg-tunis-orange rounded-e-full" />}
                <item.icon className={`h-5 w-5 shrink-0 transition-colors ${currentPage === item.id ? 'text-white' : 'group-hover:text-tunis-blue-light'}`} />
                {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
                {!collapsed && currentPage === item.id && <ChevronRight className="h-4 w-4 ms-auto text-white/50" />}
              </button>
            </div>
          ))}
        </nav>
      </ScrollArea>

      {/* Theme + Logout */}
      <div className="p-2 border-t border-white/[0.06]">
        <ThemeToggleCompact hideLabel={collapsed} />
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition-all"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!collapsed && <span className="text-sm font-medium">{t('nav.logout')}</span>}
        </button>
      </div>
    </div>
  );
}

function CustomerSidebar({ currentPage, setCurrentPage, onLogout, userName }: { currentPage: string; setCurrentPage: (p: string) => void; onLogout: () => void; userName: string }) {
  const [collapsed, setCollapsed] = useState(false);
  const { t } = useTranslation('common');
  const customerMenuItems = getCustomerMenuItems(t);

  return (
    <div className={`${collapsed ? 'w-16' : 'w-64'} bg-gradient-to-b from-tunis-navy via-tunis-navy-light to-tunis-navy-mid text-white min-h-screen flex flex-col transition-all duration-300 shrink-0 border-e border-white/[0.06]`}>
      {/* Logo */}
      <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
        {!collapsed && (
          <div className="flex items-center gap-2.5 animate-fade-in-left">
            <div className="bg-tunis-blue-light/20 p-1.5 rounded-lg border border-tunis-blue-light/30">
              <Shield className="h-5 w-5 text-tunis-blue-light" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-lg leading-tight">COBITUN</span>
              <span className="text-[9px] text-tunis-orange/80 uppercase tracking-[0.2em] font-medium">{t('nav.customerPortal')}</span>
            </div>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg hover:bg-white/5 transition-all hover:text-tunis-blue-light"
        >
          {collapsed ? <Menu className="h-5 w-5" /> : <X className="h-5 w-5" />}
        </button>
      </div>

      {/* User Info */}
      {!collapsed && (
        <div className="px-4 py-3 border-b border-white/[0.06]">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider">{t('nav.welcome')}</p>
          <p className="font-medium text-tunis-blue-light truncate">{userName}</p>
        </div>
      )}

      {/* Menu Items */}
      <ScrollArea className="flex-1 py-4">
        <nav className="space-y-1 px-2">
          {customerMenuItems.map((item, idx) => (
            <div key={item.id}>
              {/* Section separator before parametric items */}
              {/* Section separator before Cloud Outage items */}
              {idx === 8 && !collapsed && (
                <div className="px-3 pt-4 pb-2">
                  <div className="flex items-center gap-2 mb-1">
                    <Cloud className="h-3.5 w-3.5 text-tunis-orange" />
                    <p className="text-[11px] font-semibold text-tunis-orange uppercase tracking-wider">{t('nav.cloudOutage')}</p>
                  </div>
                  <div className="h-px bg-gradient-to-e from-tunis-orange/30 to-transparent" />
                </div>
              )}
              {idx === 8 && collapsed && <div className="border-t border-white/[0.06] my-3" />}
              {/* Section separator before Cyber Indemnity items */}
              {idx === 13 && !collapsed && (
                <div className="px-3 pt-4 pb-2">
                  <div className="flex items-center gap-2 mb-1">
                    <Shield className="h-3.5 w-3.5 text-tunis-orange" />
                    <p className="text-[11px] font-semibold text-tunis-orange uppercase tracking-wider">{t('nav.cyberIndemnity')}</p>
                  </div>
                  <div className="h-px bg-gradient-to-e from-tunis-orange/30 to-transparent" />
                </div>
              )}
              {idx === 13 && collapsed && <div className="border-t border-white/[0.06] my-3" />}
              {/* Section separator before Workflow Engine items */}
              {idx === 17 && !collapsed && (
                <div className="px-3 pt-4 pb-2">
                  <div className="flex items-center gap-2 mb-1">
                    <ClipboardList className="h-3.5 w-3.5 text-tunis-orange" />
                    <p className="text-[11px] font-semibold text-tunis-orange uppercase tracking-wider">{t('nav.policyWorkflow')}</p>
                  </div>
                  <div className="h-px bg-gradient-to-e from-tunis-orange/30 to-transparent" />
                </div>
              )}
              {idx === 17 && collapsed && <div className="border-t border-white/[0.06] my-3" />}
              <button
                onClick={() => setCurrentPage(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-start group relative ${
                  currentPage === item.id
                    ? 'bg-tunis-blue-light text-white shadow-lg shadow-tunis-blue-light/30'
                    : 'text-slate-200 hover:bg-muted hover:text-foreground'
                }`}
              >
                {currentPage === item.id && <span className="absolute start-0 top-1/2 -translate-y-1/2 w-[3px] h-3/5 bg-tunis-orange rounded-e-full" />}
                <item.icon className={`h-5 w-5 shrink-0 transition-colors ${currentPage === item.id ? 'text-white' : 'group-hover:text-tunis-blue-light'}`} />
                {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
                {!collapsed && currentPage === item.id && <ChevronRight className="h-4 w-4 ms-auto text-white/50" />}
              </button>
            </div>
          ))}
        </nav>
      </ScrollArea>

      {/* Theme + Logout */}
      <div className="p-2 border-t border-white/[0.06]">
        <ThemeToggleCompact hideLabel={collapsed} />
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition-all"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!collapsed && <span className="text-sm font-medium">{t('nav.logout')}</span>}
        </button>
      </div>
    </div>
  );
}

function MobileAdminNav({ currentPage, setCurrentPage, onLogout }: { currentPage: string; setCurrentPage: (p: string) => void; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation('common');
  const adminMenuItems = getAdminMenuItems(t);

  return (
    <>
      {/* Top Bar */}
      <div className="bg-gradient-to-r from-tunis-navy to-tunis-navy-light backdrop-blur-md text-white flex items-center justify-between px-4 py-3 md:hidden border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className="bg-tunis-blue/20 p-1.5 rounded-lg border border-tunis-blue/30">
            <Shield className="h-5 w-5 text-tunis-orange" />
          </div>
          <span className="font-bold">COBITUN</span>
        </div>
        <button onClick={() => setOpen(!open)} className="p-1.5 rounded-lg hover:bg-white/5 transition-all" aria-expanded={open} aria-label={t('nav.toggleMenu', 'Toggle navigation menu')}>
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="fixed start-0 top-0 h-full w-64 bg-gradient-to-b from-tunis-navy via-tunis-navy-light to-tunis-navy-mid text-white z-50 overflow-y-auto border-e border-white/[0.06]">
            <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <div className="bg-tunis-blue/20 p-1.5 rounded-lg border border-tunis-blue/30">
                  <Shield className="h-5 w-5 text-tunis-orange" />
                </div>
                <span className="font-bold text-lg">{t('nav.adminPanel')}</span>
              </div>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-white/5 transition-all">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="space-y-1 p-2 mt-2">
              {adminMenuItems.map((item, idx) => (
                <div key={item.id}>
                  {idx === 8 && (
                    <div className="px-3 pt-3 pb-2">
                      <div className="flex items-center gap-2 mb-1">
                        <Cloud className="h-3.5 w-3.5 text-tunis-orange" />
                        <p className="text-[11px] font-semibold text-tunis-orange uppercase tracking-wider">{t('nav.cloudOutage')}</p>
                      </div>
                      <div className="h-px bg-gradient-to-e from-tunis-orange/30 to-transparent" />
                    </div>
                  )}
                  {idx === 12 && (
                    <div className="px-3 pt-3 pb-2">
                      <div className="flex items-center gap-2 mb-1">
                        <Shield className="h-3.5 w-3.5 text-tunis-orange" />
                        <p className="text-[11px] font-semibold text-tunis-orange uppercase tracking-wider">{t('nav.cyberIndemnity')}</p>
                      </div>
                      <div className="h-px bg-gradient-to-e from-tunis-orange/30 to-transparent" />
                    </div>
                  )}
                  {idx === 14 && (
                    <div className="px-3 pt-3 pb-2">
                      <div className="flex items-center gap-2 mb-1">
                        <ShieldCheck className="h-3.5 w-3.5 text-tunis-orange" />
                        <p className="text-[11px] font-semibold text-tunis-orange uppercase tracking-wider">{t('nav.reinsuranceActuarial')}</p>
                      </div>
                      <div className="h-px bg-gradient-to-e from-tunis-orange/30 to-transparent" />
                    </div>
                  )}
                  {idx === 20 && (
                    <div className="px-3 pt-3 pb-2">
                      <div className="flex items-center gap-2 mb-1">
                        <Users className="h-3.5 w-3.5 text-tunis-orange" />
                        <p className="text-[11px] font-semibold text-tunis-orange uppercase tracking-wider">{t('nav.adminManagement', 'Admin Management')}</p>
                      </div>
                      <div className="h-px bg-gradient-to-e from-tunis-orange/30 to-transparent" />
                    </div>
                  )}
                  {idx === 24 && (
                    <div className="px-3 pt-3 pb-2">
                      <div className="flex items-center gap-2 mb-1">
                        <ClipboardList className="h-3.5 w-3.5 text-tunis-orange" />
                        <p className="text-[11px] font-semibold text-tunis-orange uppercase tracking-wider">{t('nav.policyWorkflow')}</p>
                      </div>
                      <div className="h-px bg-gradient-to-e from-tunis-orange/30 to-transparent" />
                    </div>
                  )}
                  <button
                    onClick={() => { setCurrentPage(item.id); setOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-start ${
                      currentPage === item.id
                        ? 'bg-tunis-blue-light text-white shadow-lg shadow-tunis-blue-light/30'
                        : 'text-slate-200 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <item.icon className={`h-5 w-5 ${currentPage === item.id ? 'text-white' : ''}`} />
                    <span className="text-sm font-medium">{item.label}</span>
                  </button>
                </div>
              ))}
            </nav>
            <div className="p-2 border-t border-white/[0.06] mt-2">
              <ThemeToggleCompact className="text-slate-200 hover:!bg-white/5 hover:!text-white" />
              <button
                onClick={onLogout}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition-all"
              >
                <LogOut className="h-5 w-5" />
                <span className="text-sm font-medium">{t('nav.logout')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function MobileCustomerNav({ currentPage, setCurrentPage, onLogout, userName }: { currentPage: string; setCurrentPage: (p: string) => void; onLogout: () => void; userName: string }) {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation('common');
  const customerMenuItems = getCustomerMenuItems(t);

  return (
    <>
      {/* Top Bar */}
      <div className="bg-gradient-to-r from-tunis-navy to-tunis-navy-light backdrop-blur-md text-white flex items-center justify-between px-4 py-3 md:hidden border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className="bg-tunis-blue-light/20 p-1.5 rounded-lg border border-tunis-blue-light/30">
            <Shield className="h-5 w-5 text-tunis-blue-light" />
          </div>
          <span className="font-bold">COBITUN</span>
        </div>
        <button onClick={() => setOpen(!open)} className="p-1.5 rounded-lg hover:bg-white/5 transition-all" aria-expanded={open} aria-label={t('nav.toggleMenu', 'Toggle navigation menu')}>
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="fixed start-0 top-0 h-full w-64 bg-gradient-to-b from-tunis-navy via-tunis-navy-light to-tunis-navy-mid text-white z-50 overflow-y-auto border-e border-white/[0.06]">
            <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <div className="bg-tunis-blue-light/20 p-1.5 rounded-lg border border-tunis-blue-light/30">
                  <Shield className="h-5 w-5 text-tunis-blue-light" />
                </div>
                <span className="font-bold text-lg">{t('nav.customerPortal')}</span>
              </div>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-white/5 transition-all">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-4 py-3 border-b border-white/[0.06]">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">{t('nav.welcome')}</p>
              <p className="font-medium text-tunis-blue-light">{userName}</p>
            </div>
            <nav className="space-y-1 p-2 mt-2">
              {customerMenuItems.map((item, idx) => (
                <div key={item.id}>
                  {idx === 8 && (
                    <div className="px-3 pt-3 pb-2">
                      <div className="flex items-center gap-2 mb-1">
                        <Cloud className="h-3.5 w-3.5 text-tunis-orange" />
                        <p className="text-[11px] font-semibold text-tunis-orange uppercase tracking-wider">{t('nav.cloudOutage')}</p>
                      </div>
                      <div className="h-px bg-gradient-to-e from-tunis-orange/30 to-transparent" />
                    </div>
                  )}
                  {idx === 13 && (
                    <div className="px-3 pt-3 pb-2">
                      <div className="flex items-center gap-2 mb-1">
                        <Shield className="h-3.5 w-3.5 text-tunis-orange" />
                        <p className="text-[11px] font-semibold text-tunis-orange uppercase tracking-wider">{t('nav.cyberIndemnity')}</p>
                      </div>
                      <div className="h-px bg-gradient-to-e from-tunis-orange/30 to-transparent" />
                    </div>
                  )}
                  {idx === 17 && (
                    <div className="px-3 pt-3 pb-2">
                      <div className="flex items-center gap-2 mb-1">
                        <ClipboardList className="h-3.5 w-3.5 text-tunis-orange" />
                        <p className="text-[11px] font-semibold text-tunis-orange uppercase tracking-wider">{t('nav.policyWorkflow')}</p>
                      </div>
                      <div className="h-px bg-gradient-to-e from-tunis-orange/30 to-transparent" />
                    </div>
                  )}
                  <button
                    onClick={() => { setCurrentPage(item.id); setOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-start ${
                      currentPage === item.id
                        ? 'bg-tunis-blue-light text-white shadow-lg shadow-tunis-blue-light/30'
                        : 'text-slate-200 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <item.icon className={`h-5 w-5 ${currentPage === item.id ? 'text-white' : ''}`} />
                    <span className="text-sm font-medium">{item.label}</span>
                  </button>
                </div>
              ))}
            </nav>
            <div className="p-2 border-t border-white/[0.06] mt-2">
              <ThemeToggleCompact className="text-slate-200 hover:!bg-white/5 hover:!text-white" />
              <button
                onClick={onLogout}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition-all"
              >
                <LogOut className="h-5 w-5" />
                <span className="text-sm font-medium">{t('nav.logout')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function AdminLayout({ currentPage, setCurrentPage, onLogout, goBack, children }: { currentPage: string; setCurrentPage: (p: string) => void; onLogout: () => void; goBack: () => void; children: React.ReactNode }) {
  const { t } = useTranslation('common');
  const adminMenuItems = useMemo(() => getAdminMenuItems(t), [t]);
  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gradient-to-br from-background to-tunis-blue-pale/30 dark:from-background dark:to-muted">
      <div className="hidden md:block">
        <AdminSidebar currentPage={currentPage} setCurrentPage={setCurrentPage} onLogout={onLogout} />
      </div>
      <MobileAdminNav currentPage={currentPage} setCurrentPage={setCurrentPage} onLogout={onLogout} />
      <main className="flex-1 p-4 md:p-8 overflow-auto">
        {/* Header bar with breadcrumb, language, and theme */}
        <div className="flex items-center justify-between mb-2">
          <PageBreadcrumb currentPage={currentPage} menuItems={adminMenuItems} sections={adminSections} goBack={goBack} />
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}

function CustomerLayout({ currentPage, setCurrentPage, onLogout, userName, goBack, children }: { currentPage: string; setCurrentPage: (p: string) => void; onLogout: () => void; userName: string; goBack: () => void; children: React.ReactNode }) {
  const { t } = useTranslation('common');
  const customerMenuItems = useMemo(() => getCustomerMenuItems(t), [t]);
  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gradient-to-br from-background to-tunis-blue-pale/30 dark:from-background dark:to-muted">
      <div className="hidden md:block">
        <CustomerSidebar currentPage={currentPage} setCurrentPage={setCurrentPage} onLogout={onLogout} userName={userName} />
      </div>
      <MobileCustomerNav currentPage={currentPage} setCurrentPage={setCurrentPage} onLogout={onLogout} userName={userName} />
      <main className="flex-1 p-4 md:p-8 overflow-auto">
        {/* Header bar with breadcrumb, language, and theme */}
        <div className="flex items-center justify-between mb-2">
          <PageBreadcrumb currentPage={currentPage} menuItems={customerMenuItems} sections={customerSections} goBack={goBack} />
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}

function PageContent({ currentPage }: { currentPage: string }) {
  switch (currentPage) {
    case 'home':
      return <HomePage />;
    case 'admin-login':
      return <AdminLoginPage />;
    case 'customer-login':
      return <CustomerLoginPage />;
    case 'customer-signup':
      return <CustomerSignupPage />;
    case 'about':
      return <AboutPage />;
    case 'contact':
      return <ContactPage />;
    case 'forgot-password':
      return <ForgotPasswordPage />;
    case 'reset-password':
      return <ResetPasswordPage />;
    default:
      return <HomePage />;
  }
}

function AdminPageContent({ currentPage, user }: { currentPage: string; user: any }) {
  switch (currentPage) {
    case 'admin-dashboard':
      return <AdminDashboardPage />;
    case 'admin-fraud-detection':
      return <AdminFraudDetectionPage />;
    case 'account-settings':
      return <AccountSettingsPage />;
    case 'admin-customers':
      return <AdminCustomersPage />;
    case 'admin-categories':
      return <AdminCategoriesPage />;
    case 'admin-policies':
      return <AdminPoliciesPage />;
    case 'admin-policy-holders':
      return <AdminPolicyHoldersPage />;
    case 'admin-questions':
      return <AdminQuestionsPage />;
    // Parametric Cloud Outage Insurance Pages
    case 'admin-outage-monitor':
      return <AdminOutageMonitorPage />;
    case 'admin-parametric-claims':
      return <AdminParametricClaimsPage />;
    case 'admin-cloud-providers':
      return <AdminCloudProvidersPage />;
    case 'admin-parametric-policy-requests':
      return <AdminParametricPolicyRequestsPage />;
    // Cyber Indemnity Insurance Pages
    case 'admin-cyber-applications':
      return <AdminCyberApplicationsPage />;
    case 'admin-cyber-claims':
      return <AdminCyberClaimsPage />;
    // Reinsurance & Actuarial Pages
    case 'admin-reinsurance':
      return <AdminReinsurancePage />;
    case 'admin-claim-reserves':
      return <AdminClaimReservesPage />;
    case 'admin-endorsements':
      return <AdminEndorsementsPage />;
    case 'admin-renewals':
      return <AdminRenewalsPage />;
    case 'admin-payout-functions':
      return <AdminPayoutFunctionsPage />;
    case 'admin-sessions':
      return <AdminSessionsPage />;
    case 'admin-reference-data':
      return <AdminReferenceDataPage />;
    case 'admin-users':
      return <AdminUsersPageWrapper 
        initialUsers={[]} 
        pagination={{ page: 1, limit: 20, total: 0, totalPages: 1 }} 
        currentUserRole={user?.role || ''} 
      />;
    case 'admin-notifications':
      return <AdminNotificationsPage />;
    case 'admin-ioda-config':
      return <AdminIODAConfigPage />;
    case 'admin-refunds':
      return <AdminRefundsPage />;
    // Workflow Engine Pages
    case 'admin-workflow':
      return <AdminWorkflowPage />;
    case 'admin-policy-review':
      return <AdminPolicyReviewPage />;
    case 'admin-claim-review':
      return <AdminClaimReviewPage />;
    default:
      return <AdminDashboardPage />;
  }
}

function CustomerPageContent({ currentPage }: { currentPage: string }) {
  switch (currentPage) {
    case 'customer-dashboard':
      return <CustomerDashboardPage />;
    case 'account-settings':
      return <AccountSettingsPage />;
    case 'customer-apply-policy':
      return <CustomerApplyPolicyPage />;
    case 'customer-history':
      return <CustomerHistoryPage />;
    case 'customer-questions':
      return <CustomerQuestionsPage />;
    // Parametric Cloud Outage Insurance Pages
    case 'apply-parametric-policy':
      return <ApplyParametricPolicyPage />;
    case 'customer-parametric-policies':
      return <CustomerParametricPoliciesPage />;
    case 'customer-parametric-claims':
      return <CustomerParametricClaimsPage />;
    case 'customer-outage-monitor':
      return <CustomerOutageMonitorPage />;
    // Cyber Indemnity Insurance Pages
    case 'apply-cyber-policy':
      return <CyberApplyPage />;
    case 'customer-cyber-policies':
      return <CustomerCyberPoliciesPage />;
    case 'customer-cyber-claims':
      return <CustomerCyberClaimsPage />;
    case 'coverage-gap-analyzer':
      return <CoverageGapAnalyzerPage />;
    case 'customer-sessions':
      return <CustomerSessionsPage />;
    case 'customer-notifications':
      return <CustomerNotificationsPage />;
    case 'customer-notification-preferences':
      return <CustomerNotificationPreferencesPage />;
    case 'customer-draft-claims':
      return <CustomerDraftClaimsPage />;
    // Workflow Engine Pages
    case 'customer-workflow':
      return <CustomerWorkflowPage />;
    case 'customer-policy-application':
      return <CustomerPolicyApplicationPage />;
    case 'customer-policy-detail':
      return <CustomerPolicyDetailPage />;
    case 'customer-claim':
      return <CustomerClaimPage />;
    default:
      return <CustomerDashboardPage />;
  }
}

export default function COBITUNApp() {
  const { currentPage, setCurrentPage, previousPage, goBack, user, isAuthenticated, logout, hydrated } = useAppStore();
  const { t } = useTranslation('common');
  const adminPageIds = getAdminMenuItems(t).map((item) => item.id);
  const customerPageIds = getCustomerMenuItems(t).map((item) => item.id);

  const safeCurrentPage = publicPages.includes(currentPage)
    ? currentPage
    : user?.role === Roles.ADMIN || user?.role === Roles.SUPER_ADMIN
    ? adminPageIds.includes(currentPage)
      ? currentPage
      : 'admin-dashboard'
    : user?.role === Roles.CUSTOMER
    ? customerPageIds.includes(currentPage)
      ? currentPage
      : 'customer-dashboard'
    : 'home';

  const displayPage = safeCurrentPage;

  // Wait for Zustand rehydration from localStorage to prevent flash
  if (!hydrated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
          <p className="text-muted-foreground text-sm">{t('common:loading', 'Loading...')}</p>
        </div>
      </div>
    );
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      // Logout request failed, but proceed with client-side logout
    } finally {
      logout();
    }
  };

  // If authenticated, show the appropriate dashboard layout
  if (isAuthenticated && user) {
    if (user.role === Roles.ADMIN || user.role === Roles.SUPER_ADMIN) {
      return (
        <ErrorBoundary>
          <AdminLayout currentPage={displayPage} setCurrentPage={setCurrentPage} onLogout={handleLogout} goBack={goBack}>
            <AdminPageContent currentPage={displayPage} user={user} />
          </AdminLayout>
        </ErrorBoundary>
      );
    }
    if (user.role === Roles.CUSTOMER) {
      return (
        <ErrorBoundary>
          <CustomerLayout
            currentPage={displayPage}
            setCurrentPage={setCurrentPage}
            onLogout={handleLogout}
            userName={`${user.firstName} ${user.lastName}`}
            goBack={goBack}
          >
            <CustomerPageContent currentPage={displayPage} />
          </CustomerLayout>
        </ErrorBoundary>
      );
    }
  }

  // Public pages
  return (
    <ErrorBoundary>
      <PageContent currentPage={displayPage} />
    </ErrorBoundary>
  );
}

