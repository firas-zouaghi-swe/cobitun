'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { fetchWithAuth } from '@/hooks/use-auth';
import { PageErrorState } from '@/components/shared/PageStates';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/lib/store';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useTranslation } from 'react-i18next';
import { formatDate } from '@/lib/i18n';
import {
  Shield, Cloud, Zap, SatelliteDish, CheckCircle, XCircle,
  ArrowRight, Phone, FileCheck, AlertTriangle, Calculator, Eye,
  Server, Lock, ChevronRight, ChevronLeft, Activity, Globe, X, Play,
  Pause, Wifi, Radio, ChevronDown, Mail, MapPin
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

/* =================================================================
   TYPES
   ================================================================= */

interface ProviderFromDB {
  id: string;
  asn: number;
  organisationName: string;
  iodaName: string;
  ipCount: number;
  slaTier: string;
  mttrHours: number;
  ancsCertified: boolean;
  governmental: boolean;
  isActive: boolean;
  _count?: { outageEvents: number; policies: number };
}

interface OutageEventPreview {
  id: string;
  eventStart: string;
  durationHours: number;
  datasource: string;
  score: number | null;
  cloudProvider: { organisationName: string; asn: number; slaTier: string };
}

interface StaticProvider {
  name: string;
  asn: number;
  ipCount: number;
  tags: string[];
  logo: string;
}

/* =================================================================
   STATIC DATA (no translation needed)
   ================================================================= */

const TIER_CONFIG: Record<string, {
  color: string; borderColor: string; badgeColor: string; uptime: string; mttr: string;
}> = {
  Platinum: {
    color: 'from-emerald-600 to-emerald-800',
    borderColor: 'border-emerald-500',
    badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
    uptime: '99.995%',
    mttr: '4h',
  },
  Gold: {
    color: 'from-amber-500 to-amber-700',
    borderColor: 'border-amber-500',
    badgeColor: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    uptime: '99.9%',
    mttr: '8h',
  },
  Silver: {
    color: 'from-gray-400 to-gray-600',
    borderColor: 'border-gray-400',
    badgeColor: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
    uptime: '99.5%',
    mttr: '12h',
  },
  Bronze: {
    color: 'from-orange-700 to-orange-900',
    borderColor: 'border-orange-600',
    badgeColor: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    uptime: '99.0%',
    mttr: '16h',
  },
};

const staticProviders: StaticProvider[] = [
  { name: "DATAXION", asn: 49584, ipCount: 16384, tags: ["ANCS"], logo: "/logos/dataxion.png" },
  { name: "Tunisia BackBone AS", asn: 2609, ipCount: 2990336, tags: ["Gov"], logo: "/logos/tunisia_backbone.png" },
  { name: "Orange Tunisie", asn: 37492, ipCount: 1943296, tags: [], logo: "/logos/orange_tunisie.png" },
  { name: "OOREDOO TUNISIE SA", asn: 37693, ipCount: 2454528, tags: ["ANCS"], logo: "/logos/ooredoo.png" },
  { name: "Tunisie Telecom", asn: 327934, ipCount: 1447936, tags: ["ANCS", "Gov"], logo: "/logos/tunisie_telecom.png" },
  { name: "EO Data Center", asn: 37504, ipCount: 82432, tags: [], logo: "/logos/eo_datacenter.png" },
  { name: "3S INF (Globalnet)", asn: 37671, ipCount: 247552, tags: [], logo: "/logos/3s_globalnet.png" },
  { name: "Centre de Calcul El Khawarizmi", asn: 37717, ipCount: 71936, tags: [], logo: "/logos/cck.png" },
  { name: "ATI - Agence Tunisienne Internet", asn: 31245, ipCount: 22016, tags: ["Gov"], logo: "/logos/ati.png" },
  { name: "ATLAX", asn: 37703, ipCount: 65792, tags: [], logo: "/logos/atlax.png" },
  { name: "Reseaux Formation et Conseils", asn: 328394, ipCount: 1024, tags: ["ANCS"], logo: "/logos/rfc.png" },
  { name: "STE NEXT STEP IT", asn: 328414, ipCount: 16384, tags: ["ANCS"], logo: "/logos/nextstep.png" },
  { name: "OXAHOST", asn: 328853, ipCount: 3584, tags: [], logo: "/logos/oxahost.png" },
  { name: "STE INTERNET SMART SOLUTIONS", asn: 328880, ipCount: 54016, tags: [], logo: "/logos/internet_smart_solutions.png" },
  { name: "Focus Technology Solutions", asn: 329186, ipCount: 256, tags: ["ANCS"], logo: "/logos/focus_technology.png" },
];

/* =================================================================
   HELPER: Provider initials for fallback
   ================================================================= */
function getInitials(name: string): string {
  return name
    .split(/[\s\-()]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();
}

/* =================================================================
   ANIMATION VARIANTS
   ================================================================= */
const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.6 },
  }),
};

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.5 } },
};

/* =================================================================
   MAIN COMPONENT
   ================================================================= */

export default function HomePage() {
  const { setCurrentPage } = useAppStore();
  const { t } = useTranslation(['common', 'home']);

  /* ── Scroll state for header ── */
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  /* ── Data fetching state ── */
  const [providers, setProviders] = useState<(ProviderFromDB | StaticProvider)[]>([]);
  const [recentOutages, setRecentOutages] = useState<OutageEventPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalOutages, setTotalOutages] = useState(0);
  const [totalPayouts, setTotalPayouts] = useState<number>(0);
  const normalizedTotalPayouts = Number(totalPayouts) || 0;

  /* ── Slider state ── */
  const [activeSlide, setActiveSlide] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [touchStartX, setTouchStartX] = useState(0);
  const [touchEndX, setTouchEndX] = useState(0);
  const autoPlayRef = useRef<NodeJS.Timeout | null>(null);
  const sliderContainerRef = useRef<HTMLDivElement>(null);

  /* ── Video modal state ── */
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  /* ── Image error fallback tracking ── */
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});

  /* ── Newsletter state ── */
  const [newsletterEmail, setNewsletterEmail] = useState('');

  /* ── Translated data arrays (depend on t()) ── */
  const automationSteps = [
    { step: 1, label: t('home:automation.step1Label'), desc: t('home:automation.step1Desc'), icon: SatelliteDish },
    { step: 2, label: t('home:automation.step2Label'), desc: t('home:automation.step2Desc'), icon: Server },
    { step: 3, label: t('home:automation.step3Label'), desc: t('home:automation.step3Desc'), icon: Activity },
    { step: 4, label: t('home:automation.step4Label'), desc: t('home:automation.step4Desc'), icon: CheckCircle },
    { step: 5, label: t('home:automation.step5Label'), desc: t('home:automation.step5Desc'), icon: Zap },
    { step: 6, label: t('home:automation.step6Label'), desc: t('home:automation.step6Desc'), icon: FileCheck },
    { step: 7, label: t('home:automation.step7Label'), desc: t('home:automation.step7Desc'), icon: Lock },
  ];

  const comparisonRows = [
    { feature: t('home:compare.row1Feature'), traditional: t('home:compare.row1Traditional'), parametric: t('home:compare.row1Parametric') },
    { feature: t('home:compare.row2Feature'), traditional: t('home:compare.row2Traditional'), parametric: t('home:compare.row2Parametric') },
    { feature: t('home:compare.row3Feature'), traditional: t('home:compare.row3Traditional'), parametric: t('home:compare.row3Parametric') },
    { feature: t('home:compare.row4Feature'), traditional: t('home:compare.row4Traditional'), parametric: t('home:compare.row4Parametric') },
    { feature: t('home:compare.row5Feature'), traditional: t('home:compare.row5Traditional'), parametric: t('home:compare.row5Parametric') },
    { feature: t('home:compare.row6Feature'), traditional: t('home:compare.row6Traditional'), parametric: t('home:compare.row6Parametric') },
    { feature: t('home:compare.row7Feature'), traditional: t('home:compare.row7Traditional'), parametric: t('home:compare.row7Parametric') },
    { feature: t('home:compare.row8Feature'), traditional: t('home:compare.row8Traditional'), parametric: t('home:compare.row8Parametric') },
    { feature: t('home:compare.row9Feature'), traditional: t('home:compare.row9Traditional'), parametric: t('home:compare.row9Parametric') },
  ];

  /* ── Data fetching ── */
  useEffect(() => {
    fetchRealData();
  }, []);

  const fetchRealData = async () => {
    setError(null);
    try {
      // Use public FAQ endpoint for provider data to avoid admin auth requirement
      // Admin endpoints require authentication; fall back to static data for unauthenticated visitors
      const provRes = await fetchWithAuth('/api/admin/cloud-providers');
      if (provRes.ok) {
        const provData = await provRes.json();
        setProviders(provData.providers || []);
      } else {
        // Unauthenticated user — use static provider data
        setProviders(staticProviders || []);
      }

      const monRes = await fetchWithAuth('/api/admin/outage-monitor');
      if (monRes.ok) {
        const monData = await monRes.json();
        setRecentOutages(monData.outageEvents?.slice(0, 5) || []);
        setTotalOutages(monData.stats?.unprocessedOutages || 0);
        setTotalPayouts(Number(monData.stats?.totalPayouts) || 0);
      }
      // If outage monitor fails (unauthenticated), leave default empty state
    } catch (err) {
      console.error('Failed to fetch homepage data:', err);
      // Use static provider data as fallback
      setProviders(staticProviders || []);
    } finally {
      setLoading(false);
    }
  };



  /* ── Slider navigation ── */
  const goToSlide = useCallback((index: number) => {
    setActiveSlide(index);
  }, []);

  const nextSlide = useCallback(() => {
    setActiveSlide(prev => (prev + 1) % staticProviders.length);
  }, []);

  const prevSlide = useCallback(() => {
    setActiveSlide(prev => (prev - 1 + staticProviders.length) % staticProviders.length);
  }, []);

  /* ── Auto-play logic ── */
  useEffect(() => {
    if (isAutoPlaying) {
      autoPlayRef.current = setInterval(nextSlide, 5000);
    }
    return () => {
      if (autoPlayRef.current) clearInterval(autoPlayRef.current);
    };
  }, [isAutoPlaying, nextSlide]);

  /* ── Touch/swipe handlers ── */
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
    setTouchEndX(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEndX(e.touches[0].clientX);
  };

  const handleTouchEnd = () => {
    const diff = touchStartX - touchEndX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) nextSlide();
      else prevSlide();
    }
  };

  /* ── Video modal: ESC key + focus trap ── */
  const videoModalRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!videoModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeVideoModal();
      // Basic focus trap: keep focus within the modal
      if (e.key === 'Tab' && videoModalRef.current) {
        const focusable = videoModalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"]), video'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    // Focus the close button when modal opens
    setTimeout(() => {
      const closeBtn = videoModalRef.current?.querySelector<HTMLElement>('button[aria-label]');
      closeBtn?.focus();
    }, 100);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [videoModalOpen]);

  const openVideoModal = () => setVideoModalOpen(true);

  const closeVideoModal = () => {
    setVideoModalOpen(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  /* ── Image error handler ── */
  const handleImgError = (providerName: string) => {
    setImgErrors(prev => ({ ...prev, [providerName]: true }));
  };

  /* ── Format IP count ── */
  const formatIpCount = (count: number) => {
    if (count >= 1_000_000) return (count / 1_000_000).toFixed(1) + 'M';
    if (count >= 1_000) return (count / 1_000).toFixed(0) + 'K';
    return count.toString();
  };

  /* ── Total IPs monitored ── */
  const totalIps = staticProviders.reduce((sum, p) => sum + p.ipCount, 0);

  /* ================================================================
     RENDER
     ================================================================ */
  return (
    <div className="min-h-screen bg-background">

      {/* Error banner for data fetch failures */}
      {error && !loading && (
        <div className="fixed top-16 inset-x-0 z-40 flex justify-center pointer-events-none">
          <div className="pointer-events-auto mt-2">
            <PageErrorState message={error} onRetry={fetchRealData} />
          </div>
        </div>
      )}

      {/* ==================== HEADER — Glassmorphism Nav ==================== */}
      <header
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${
          scrolled
            ? 'bg-[#0A1628]/80 backdrop-blur-xl border-b border-white/[0.06] shadow-lg shadow-black/10'
            : 'bg-transparent border-b border-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <Shield className="h-8 w-8 text-[#00D4FF]" style={{ filter: 'drop-shadow(0 0 8px rgba(0, 212, 255, 0.4))' }} />
              </div>
              <span className="text-xl font-bold text-white tracking-tight">{t('common:brand.name')}</span>
              <Badge variant="outline" className="ms-1 text-[9px] border-[#00D4FF]/30 text-[#00D4FF] bg-[#00D4FF]/10 font-semibold" title={t('common:brand.badge')}>{t('common:brand.badge')}</Badge>
            </div>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-1">
              {[
                { label: t('common:nav.howItWorks'), target: 'how-it-works' },
                { label: t('common:nav.providers'), target: 'providers' },
                { label: t('common:nav.compare'), target: 'compare' },
              ].map((item) => (
                <button
                  key={item.target}
                  onClick={() => document.getElementById(item.target)?.scrollIntoView({ behavior: 'smooth' })}
                  className="relative px-4 py-2 text-sm font-medium text-white/70 hover:text-white transition-colors group"
                >
                  {item.label}
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-[2px] bg-gradient-to-r from-[#00D4FF] to-[#E5693A] transition-all duration-300 group-hover:w-3/4 rounded-full" />
                </button>
              ))}

              <div className="w-px h-5 bg-white/10 mx-2" />

              <LanguageSwitcher className="text-white" />
              <ThemeToggle />

              <Button variant="ghost" size="sm" className="border border-white/15 text-white/80 hover:bg-white/5 hover:text-white transition-all ms-2" onClick={() => setCurrentPage('admin-login')}>
                {t('common:nav.admin')}
              </Button>
              <Button size="sm" className="bg-gradient-to-r from-[#E5693A] to-[#E5693A]/80 text-white font-bold hover:from-[#E5693A]/90 hover:to-[#E5693A]/70 shadow-lg shadow-[#E5693A]/20 transition-all" onClick={() => setCurrentPage('customer-login')}>
                {t('common:nav.customerLogin')}
              </Button>
            </nav>

            {/* Mobile Nav */}
            <div className="flex md:hidden items-center gap-1.5">
              <LanguageSwitcher className="text-white" />
              <ThemeToggle />
              <Button size="sm" variant="ghost" className="border border-white/15 text-white/80 hover:bg-white/5" onClick={() => setCurrentPage('admin-login')}>{t('common:nav.admin')}</Button>
              <Button size="sm" className="bg-gradient-to-r from-[#E5693A] to-[#E5693A]/80 text-white font-bold" onClick={() => setCurrentPage('customer-login')}>{t('common:nav.login')}</Button>
            </div>
          </div>
        </div>
      </header>

      {/* ==================== HERO — Full-Screen Quantum Shield ==================== */}
      <section className="relative min-h-screen flex flex-col justify-center overflow-hidden" style={{ background: 'linear-gradient(135deg, #0A1628 0%, #0F2847 40%, #0A1628 100%)' }}>

        {/* Video Background */}
        <div className="absolute inset-0 z-0">
          <video
            autoPlay
            muted
            loop
            playsInline
            className="w-full h-full object-cover opacity-20"
            aria-hidden="true"
          >
            <source src="/videos/hero.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-b from-[#0A1628]/60 via-[#0A1628]/40 to-[#0A1628]" />
        </div>

        {/* Dot Grid Overlay */}
        <div className="absolute inset-0 z-[1] opacity-[0.04] animate-dot-grid" style={{
          backgroundImage: 'radial-gradient(circle, #00D4FF 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }} />

        {/* Mesh Gradient Background Blobs */}
        <div className="absolute inset-0 z-[1] pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full opacity-[0.07]" style={{ background: 'radial-gradient(circle, #00D4FF, transparent 70%)' }} />
          <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] rounded-full opacity-[0.05]" style={{ background: 'radial-gradient(circle, #E5693A, transparent 70%)' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full opacity-[0.03]" style={{ background: 'radial-gradient(circle, #4A7EC4, transparent 70%)' }} />
        </div>

        {/* Main Content */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16 flex-1 flex items-center">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center w-full">

            {/* Left: Headline + CTA */}
            <div>
              {/* Live monitoring badge */}
              <motion.div
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                custom={0}
                className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-[#00D4FF]/10 border border-[#00D4FF]/20 mb-8"
              >
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
                </span>
                <span className="text-xs font-semibold text-[#00D4FF] uppercase tracking-wider">{t('home:hero.liveMonitoring')}</span>
              </motion.div>

              <motion.h1
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                custom={1}
                className="text-4xl sm:text-5xl lg:text-[68px] font-bold leading-[1.05] mb-6"
              >
                <span className="text-white">{t('home:hero.title1')}</span>{' '}
                <span className="bg-gradient-to-r from-white via-[#00D4FF] to-[#00D4FF]/70 bg-clip-text text-transparent">{t('home:hero.title2')}</span>
              </motion.h1>

              <motion.p
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                custom={2}
                className="text-lg md:text-xl text-white/60 mb-10 max-w-xl leading-relaxed"
              >
                {t('home:hero.subtitle')}
              </motion.p>

              <motion.div
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                custom={3}
                className="flex flex-wrap gap-4 mb-12"
              >
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-[#E5693A] to-[#E5693A]/80 text-white font-bold text-lg px-8 py-6 hover:from-[#E5693A]/90 hover:to-[#E5693A]/70 shadow-xl shadow-[#E5693A]/25 transition-all hover:shadow-[#E5693A]/40 hover:scale-[1.02] animate-glow-pulse-soft"
                  onClick={() => setCurrentPage('customer-signup')}
                >
                  {t('common:action.getProtected')} <ArrowRight className="ms-2 h-5 w-5 rtl-flip" />
                </Button>
                <Button
                  size="lg"
                  variant="ghost"
                  className="border border-white/15 text-white/80 hover:bg-white/5 hover:text-white text-lg px-8 py-6 backdrop-blur-sm transition-all group"
                  onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
                >
                  {t('home:hero.seeHowItWorks')}
                  <ChevronDown className="ms-2 h-4 w-4 transition-transform group-hover:translate-y-0.5" />
                </Button>
              </motion.div>
            </div>

            {/* Right: Floating Live Monitoring Dashboard Mockup */}
            <div className="hidden lg:block">
            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              custom={3}
            >
              <div className="relative animate-float-slow">
                {/* Main dashboard card */}
                <div className="rounded-2xl border border-white/10 bg-[#0F1B2E]/80 backdrop-blur-xl p-4 shadow-2xl shadow-black/40">
                  {/* Dashboard header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-[#00D4FF]" />
                      <span className="text-sm font-semibold text-white/90">{t('home:hero.monitorTitle')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-[#00D4FF]/60">{t('home:hero.live')}</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    </div>
                  </div>

                  {/* Summary bar */}
                  <div className="grid grid-cols-3 gap-1.5 mb-2">
                    <div className="rounded-lg bg-[#00D4FF]/[0.07] border border-[#00D4FF]/10 px-2.5 py-1.5 text-center">
                      <div className="text-sm font-bold text-[#00D4FF]">{staticProviders.length}</div>
                      <div className="text-[9px] text-white/40">{t('home:hero.providers')}</div>
                    </div>
                    <div className="rounded-lg bg-emerald-500/[0.07] border border-emerald-500/10 px-2.5 py-1.5 text-center">
                      <div className="text-sm font-bold text-emerald-400">{formatIpCount(totalIps)}</div>
                      <div className="text-[9px] text-white/40">{t('home:hero.totalIps')}</div>
                    </div>
                    <div className="rounded-lg bg-[#E5693A]/[0.07] border border-[#E5693A]/10 px-2.5 py-1.5 text-center">
                      <div className="text-sm font-bold text-[#E5693A]">{staticProviders.filter(p => p.tags.includes('ANCS')).length}</div>
                      <div className="text-[9px] text-white/40">{t('home:hero.ancsCert')}</div>
                    </div>
                  </div>

                  {/* Provider status rows — show first 10 providers, compact layout */}
                  <div className="space-y-px">
                    {staticProviders.slice(0, 10).map((p, idx) => (
                      <div key={p.asn} className="flex items-center justify-between bg-white/[0.03] rounded px-2 py-[3px] hover:bg-white/[0.06] transition-colors">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="w-1 h-1 rounded-full shrink-0 bg-emerald-400" />
                          <span className="text-[10px] text-white/70 font-medium truncate max-w-[145px]">{p.name}</span>
                          {p.tags.length > 0 && (
                            <div className="flex gap-0.5 shrink-0">
                              {p.tags.includes('Gov') && (
                                <span className="text-[6px] font-bold px-1 rounded bg-emerald-500/20 text-emerald-300/70 leading-relaxed">{t('home:providers.govBadge', 'Gov.')}</span>
                              )}
                              {p.tags.includes('ANCS') && (
                                <span className="text-[6px] font-bold px-1 rounded bg-[#00D4FF]/20 text-[#00D4FF]/70 leading-relaxed">{t('home:providers.ancsBadge', 'ANCS')}</span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[8px] font-mono text-white/25">{formatIpCount(p.ipCount)}</span>
                          <span className="text-[9px] font-mono text-[#00D4FF]/50">AS{p.asn}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Footer with remaining count + all online status */}
                  <div className="mt-1 pt-1 border-t border-white/[0.06] flex items-center justify-between">
                    <span className="text-[9px] text-white/30">+{staticProviders.length - 10} {t('home:hero.moreProviders', 'more')}</span>
                    <span className="text-[9px] font-semibold text-emerald-400 flex items-center gap-1">
                      <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                      {t('home:hero.allOnline', 'All Online')}
                    </span>
                  </div>
                </div>

                {/* Floating accent cards */}
                <div className="absolute -top-4 -end-4 px-3 py-2 rounded-lg bg-[#00D4FF]/10 border border-[#00D4FF]/20 backdrop-blur-sm">
                  <span className="text-xs font-bold text-[#00D4FF]">{loading ? '—' : providers.length} {t('home:stat.monitoredProviders')}</span>
                </div>
                <div className="absolute -bottom-3 -start-3 px-3 py-2 rounded-lg bg-[#E5693A]/10 border border-[#E5693A]/20 backdrop-blur-sm">
                  <span className="text-xs font-bold text-[#E5693A]">0 {t('home:stat.claimsForms')}</span>
                </div>
              </div>
            </motion.div>
            </div>
          </div>
        </div>

        {/* Bottom Stats Bar */}
        <div className="relative z-10 border-t border-white/[0.06] bg-[#0A1628]/50 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
            <div className="flex flex-wrap justify-center gap-4 md:gap-8">
              {[
                { value: loading ? '—' : String(providers.length), label: t('home:stat.monitoredProviders'), color: '#00D4FF' },
                { value: String(totalOutages), label: t('home:stat.activeOutages'), color: '#E5693A' },
                { value: normalizedTotalPayouts > 0 ? normalizedTotalPayouts.toFixed(0) + ' TND' : '0', label: t('home:stat.totalPayouts'), color: '#00D4FF' },
                { value: '0', label: t('home:stat.claimsForms'), color: '#22C55E' },
              ].map((stat, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-2.5 rounded-full bg-white/[0.04] border border-white/[0.06] hover:border-white/[0.12] transition-all group">
                  <div className="text-2xl md:text-3xl font-bold tabular-nums" style={{ color: stat.color }}>
                    {stat.value}
                  </div>
                  <div className="text-xs text-white/50 font-medium whitespace-nowrap">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1 animate-fade-in-up" style={{ animationDelay: '1.5s' }}>
          <span className="text-[10px] text-white/30 uppercase tracking-widest">{t('home:hero.scroll')}</span>
          <ChevronDown className="h-4 w-4 text-white/30 animate-bounce" />
        </div>
      </section>

      {/* ==================== WHY COBITUN — Problem Section ==================== */}
      <section className="relative py-20 md:py-28 overflow-hidden" style={{ background: 'linear-gradient(180deg, #0A1628 0%, #0F1729 100%)' }}>
        {/* Mesh gradient background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 end-0 w-[500px] h-[500px] rounded-full opacity-[0.04]" style={{ background: 'radial-gradient(circle, #E5693A, transparent 70%)' }} />
          <div className="absolute bottom-0 start-0 w-[400px] h-[400px] rounded-full opacity-[0.04]" style={{ background: 'radial-gradient(circle, #00D4FF, transparent 70%)' }} />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          {/* Section Header */}
          <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }} custom={0} className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">{t('home:problem.title')}</h2>
            <p className="text-white/50 max-w-2xl mx-auto">{t('home:problem.cloudDependencyDesc')}</p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: XCircle, title: t('home:problem.cloudDependencyTitle'), desc: t('home:problem.cloudDependencyDesc'), gradient: 'from-red-500/20 to-red-600/5', iconColor: 'text-red-400', borderGlow: 'rgba(239, 68, 68, 0.3)' },
              { icon: AlertTriangle, title: t('home:problem.paperworkTitle'), desc: t('home:problem.paperworkDesc'), gradient: 'from-amber-500/20 to-amber-600/5', iconColor: 'text-amber-400', borderGlow: 'rgba(245, 158, 11, 0.3)' },
              { icon: CheckCircle, title: t('home:problem.solutionTitle'), desc: t('home:problem.solutionDesc'), gradient: 'from-emerald-500/20 to-emerald-600/5', iconColor: 'text-emerald-400', borderGlow: 'rgba(16, 185, 129, 0.3)' },
              { icon: SatelliteDish, title: t('home:ioda.title'), desc: t('home:ioda.description'), gradient: 'from-[#00D4FF]/20 to-[#00D4FF]/5', iconColor: 'text-[#00D4FF]', borderGlow: 'rgba(0, 212, 255, 0.3)' },
            ].map((card, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-50px' }}
                custom={i + 1}
                className="group"
              >
                <div className="rounded-xl p-5 h-full min-h-[220px] bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12] transition-all duration-300 backdrop-blur-sm hover:bg-white/[0.05] flex flex-col">
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${card.gradient} flex items-center justify-center shrink-0 transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg mb-3`} style={{ boxShadow: `0 0 20px ${card.borderGlow}` }}>
                    <card.icon className={`h-5 w-5 ${card.iconColor}`} />
                  </div>
                  <h5 className={`font-semibold ${card.iconColor} mb-2 min-h-[24px]`}>{card.title}</h5>
                  <p className="text-white/50 text-sm leading-relaxed flex-1">{card.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== HOW IT WORKS — Timeline Pipeline ==================== */}
      <section id="how-it-works" className="relative py-20 md:py-28 bg-card overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section Header */}
          <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }} custom={0} className="text-center mb-16">
            <Badge className="bg-[#00D4FF]/10 text-[#00D4FF] border-[#00D4FF]/20 mb-4" title={t('home:howItWorks.stepLabel', { n: '→' })}>{t('home:howItWorks.stepLabel', { n: '→' })}</Badge>
            <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-4">{t('home:howItWorks.title')}</h2>
            <p className="text-foreground/50 max-w-2xl mx-auto">{t('home:howItWorks.subtitle')}</p>
          </motion.div>

          {/* Step Cards - Horizontal Timeline */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
            {[
              { step: 1, icon: Cloud, title: t('home:howItWorks.step1Title'), desc: t('home:howItWorks.step1Desc', { count: loading ? '—' : providers.length }) },
              { step: 2, icon: Calculator, title: t('home:howItWorks.step2Title'), desc: t('home:howItWorks.step2Desc') },
              { step: 3, icon: SatelliteDish, title: t('home:howItWorks.step3Title'), desc: t('home:howItWorks.step3Desc') },
              { step: 4, icon: Zap, title: t('home:howItWorks.step4Title'), desc: t('home:howItWorks.step4Desc') },
            ].map((s, i) => (
              <motion.div
                key={s.step}
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-50px' }}
                custom={i + 1}
                className="relative"
              >
                <Card className="h-full min-h-[280px] hover:shadow-xl transition-all duration-300 hover:-translate-y-2 border-none shadow-lg text-center card-hover group overflow-hidden flex flex-col">
                  {/* Top gradient line */}
                  <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-[#00D4FF] to-[#E5693A] opacity-0 group-hover:opacity-100 transition-opacity" />
                  <CardContent className="p-6 flex flex-col h-full">
                    <div className="w-14 h-14 bg-gradient-to-br from-[#0A1628] to-[#0F2847] rounded-2xl flex items-center justify-center mx-auto mb-4 text-white shadow-lg shadow-[#0A1628]/20 transition-transform hover:scale-110 relative">
                      <s.icon className="h-7 w-7 text-[#00D4FF]" />
                      <div className="absolute -top-1 -end-1 w-5 h-5 bg-[#E5693A] rounded-full flex items-center justify-center text-[10px] font-bold text-white">{s.step}</div>
                    </div>
                    <div className="text-xs font-bold text-[#E5693A] uppercase tracking-wider mb-2">{t('home:howItWorks.stepLabel', { n: s.step })}</div>
                    <h3 className="font-semibold text-lg mb-2 min-h-[28px]">{s.title}</h3>
                    <p className="text-foreground/60 text-sm leading-relaxed flex-1">{s.desc}</p>
                  </CardContent>
                </Card>

                {/* Connecting line (desktop only) */}
                {i < 3 && (
                  <div className="hidden lg:block absolute top-1/2 -end-3 w-6">
                    <div className="w-full h-[2px] bg-gradient-to-r from-[#00D4FF]/30 to-[#E5693A]/30" />
                    <ChevronRight className="absolute -end-1 top-1/2 -translate-y-1/2 h-3 w-3 text-[#E5693A]/40 rtl-flip" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>

          {/* Automation Pipeline */}
          <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={0}>
            <div className="rounded-2xl p-6 md:p-8 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #0A1628, #0F2847, #0A1628)' }}>
              {/* Animated border */}
              <div className="absolute inset-0 rounded-2xl p-[1px]" style={{
                background: 'linear-gradient(135deg, #00D4FF, #E5693A, #00D4FF)',
                backgroundSize: '200% 200%',
                animation: 'gradient-shift 4s ease infinite',
                WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                WebkitMaskComposite: 'xor',
                maskComposite: 'exclude',
              }} />

              <h3 className="text-xl font-bold text-center mb-8 text-white relative z-10">{t('home:automation.title')}</h3>

              {/* Timeline with connecting dots */}
              <div className="relative z-10">
                {/* Horizontal connecting line (desktop) */}
                <div className="hidden md:block absolute top-5 left-8 right-8 h-[2px] bg-gradient-to-r from-[#00D4FF]/20 via-[#E5693A]/30 to-[#00D4FF]/20" />

                <div className="flex flex-wrap md:flex-nowrap items-start justify-center gap-4 md:gap-0">
                  {automationSteps.map((step, idx) => (
                    <div key={step.step} className="flex items-center">
                      <div className="flex flex-col items-center text-center w-24 md:w-28 group relative">
                        {/* Timeline dot */}
                        <div className="w-10 h-10 bg-[#0A1628] border-2 border-[#00D4FF]/30 text-[#00D4FF] rounded-full flex items-center justify-center mb-2 text-sm font-bold transition-all group-hover:border-[#E5693A] group-hover:text-[#E5693A] group-hover:shadow-lg group-hover:shadow-[#E5693A]/20 group-hover:scale-110 relative z-10">
                          {step.step}
                        </div>
                        <step.icon className="h-4 w-4 text-[#00D4FF]/60 mb-1 transition-colors group-hover:text-[#E5693A]" />
                        <p className="text-xs font-semibold text-white/80">{step.label}</p>
                        <p className="text-[10px] text-white/40 hidden md:block">{step.desc}</p>
                      </div>
                      {idx < automationSteps.length - 1 && (
                        <ChevronRight className="h-4 w-4 text-[#00D4FF]/20 hidden md:block mx-1 shrink-0 rtl-flip" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ==================== PROVIDERS — Enhanced 3D Carousel ==================== */}
      <section id="providers" className="relative py-20 md:py-28 overflow-hidden" style={{ background: 'linear-gradient(180deg, #0F1729 0%, #0A1628 100%)' }}>

        {/* Network Map Background Effect */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <svg className="absolute inset-0 w-full h-full opacity-[0.03]" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="network-grid" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
                <circle cx="30" cy="30" r="1" fill="#00D4FF" />
                <line x1="30" y1="30" x2="60" y2="30" stroke="#00D4FF" strokeWidth="0.3" />
                <line x1="30" y1="30" x2="30" y2="60" stroke="#00D4FF" strokeWidth="0.3" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#network-grid)" />
          </svg>
          <div className="absolute top-1/4 end-0 w-[600px] h-[600px] rounded-full opacity-[0.04]" style={{ background: 'radial-gradient(circle, #00D4FF, transparent 70%)' }} />
          <div className="absolute bottom-1/4 start-0 w-[500px] h-[500px] rounded-full opacity-[0.03]" style={{ background: 'radial-gradient(circle, #E5693A, transparent 70%)' }} />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          {/* Section Header */}
          <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }} custom={0} className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#00D4FF]/10 border border-[#00D4FF]/20 mb-4">
              <Radio className="h-3.5 w-3.5 text-[#00D4FF]" />
              <span className="text-xs font-semibold uppercase tracking-wider text-[#00D4FF]">{t('home:providers.liveMonitoring')}</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">{t('home:providers.sectionTitle')}</h2>
            <p className="text-white/50 max-w-2xl mx-auto">{t('home:providers.sectionSubtitle')}</p>

            {/* Total IPs Counter */}
            <div className="mt-6 inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-white/[0.04] border border-white/[0.06]">
              <Globe className="h-4 w-4 text-[#00D4FF]" />
              <span className="text-sm text-white/50">{t('home:providers.sectionSubtitle').split(' ').slice(0, 2).join(' ')}:</span>
              <span className="text-lg font-bold text-[#00D4FF]">{formatIpCount(totalIps)}</span>
              <span className="text-sm text-white/50">{t('common:ips', 'IPs')}</span>
            </div>
          </motion.div>

          {/* Slider Container */}
          <div
            ref={sliderContainerRef}
            className="relative animate-fade-in-up stagger-2"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {/* Main slider viewport */}
            <div className="relative rounded-3xl overflow-hidden" style={{ minHeight: '320px' }}>
              {/* Slider dark background */}
              <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #0f1729 0%, #16213e 50%, #1a1a2e 100%)' }} />
              <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 30% 20%, rgba(0,212,255,0.04), transparent 60%), radial-gradient(ellipse at 70% 80%, rgba(229,105,58,0.03), transparent 60%)' }} />

              {/* Slider content */}
              <div className="relative z-10 flex items-center justify-center px-4 py-8 md:py-12" style={{ minHeight: '320px' }}>
                {staticProviders.map((provider, index) => {
                  let position = index - activeSlide;
                  if (position > staticProviders.length / 2) position -= staticProviders.length;
                  if (position < -staticProviders.length / 2) position += staticProviders.length;

                  const isNear = Math.abs(position) <= 2;
                  if (!isNear) return null;

                  const isCenter = position === 0;
                  const isSide = Math.abs(position) === 1;

                  const translateX = position * 280;
                  const scale = isCenter ? 1 : isSide ? 0.82 : 0.68;
                  const opacity = isCenter ? 1 : isSide ? 0.5 : 0.2;
                  const zIndex = isCenter ? 30 : isSide ? 20 : 10;
                  const rotateY = position * -5;

                  return (
                    <div
                      key={provider.asn}
                      className="absolute transition-all duration-500 ease-out"
                      style={{
                        transform: `translateX(${translateX}px) scale(${scale}) perspective(1200px) rotateY(${rotateY}deg)`,
                        opacity,
                        zIndex,
                        width: '340px',
                        maxWidth: '85vw',
                      }}
                    >
                      <div
                        className={`rounded-2xl overflow-hidden transition-all duration-500 relative ${
                          isCenter ? 'slider-card-shadow animate-glow-pulse-soft' : 'shadow-lg'
                        }`}
                        style={{
                          background: isCenter
                            ? 'linear-gradient(145deg, rgba(22,33,62,0.95), rgba(26,26,46,0.98))'
                            : 'linear-gradient(145deg, rgba(22,33,62,0.7), rgba(26,26,46,0.75))',
                        }}
                      >
                        {/* Active card animated gradient border */}
                        {isCenter && (
                          <div className="absolute inset-0 rounded-2xl p-[1.5px] animate-gradient-shift" style={{
                            background: 'linear-gradient(135deg, #00D4FF, #E5693A, #00D4FF)',
                            backgroundSize: '200% 200%',
                            WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                            WebkitMaskComposite: 'xor',
                            maskComposite: 'exclude',
                          }} />
                        )}

                        <div className="relative z-10 p-6 md:p-7">
                          {/* Provider Logo + Name */}
                          <div className="flex items-center gap-4 mb-5">
                            <div className={`w-14 h-14 rounded-xl overflow-hidden flex items-center justify-center shrink-0 transition-all duration-300 ${
                              isCenter ? 'bg-white/10 shadow-md' : 'bg-white/5'
                            }`}>
                              {!imgErrors[provider.name] ? (
                                <img
                                  src={provider.logo}
                                  alt={`${provider.name} logo`}
                                  className="w-full h-full object-contain p-1.5"
                                  onError={() => handleImgError(provider.name)}
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center rounded-xl" style={{ background: 'linear-gradient(135deg, #00D4FF/10, #0F2847)' }}>
                                  <span className="text-sm font-bold text-[#00D4FF]">{getInitials(provider.name)}</span>
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <h4 className={`font-bold leading-tight truncate transition-all duration-300 ${
                                isCenter ? 'text-[20px] text-white' : 'text-[16px] text-white/60'
                              }`}>
                                {provider.name}
                              </h4>
                              <p className={`font-mono transition-all duration-300 ${
                                isCenter ? 'text-sm text-[#00D4FF] font-semibold' : 'text-xs text-white/30'
                              }`}>
                                AS{provider.asn}
                              </p>
                            </div>
                          </div>

                          {/* IP Count */}
                          <div className={`flex items-center gap-2 mb-4 transition-all duration-300 ${
                            isCenter ? 'text-white/70' : 'text-white/30'
                          }`}>
                            <Globe className={`h-4 w-4 ${isCenter ? 'text-[#00D4FF]' : ''}`} />
                            <span className={`text-sm ${isCenter ? 'font-medium' : 'text-xs'}`}>{formatIpCount(provider.ipCount)} IPs</span>
                          </div>

                          {/* Tags */}
                          {provider.tags.length > 0 && (
                            <div className="flex gap-2 flex-wrap mb-4">
                              {provider.tags.includes('Gov') && (
                                <span className={`text-[11px] font-semibold px-3 py-1 rounded-full transition-all duration-300 ${
                                  isCenter ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-500/10 text-emerald-400/50'
                                }`}>
                                  {t('home:providers.tagGovernment')}
                                </span>
                              )}
                              {provider.tags.includes('ANCS') && (
                                <span className={`text-[11px] font-semibold px-3 py-1 rounded-full transition-all duration-300 ${
                                  isCenter ? 'bg-[#00D4FF]/20 text-[#00D4FF]' : 'bg-[#00D4FF]/10 text-[#00D4FF]/50'
                                }`}>
                                  {t('home:providers.tagAncsCertified')}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Active card: Live monitoring indicator */}
                          {isCenter && (
                            <div className="flex items-center gap-2 pt-3 border-t border-white/10">
                              <Wifi className="h-4 w-4 text-emerald-400" />
                              <span className="text-xs font-semibold text-emerald-400">{t('home:providers.monitoredViaIoda')}</span>
                              <span className="ms-auto w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Navigation Arrows */}
            <button
              onClick={() => { prevSlide(); setIsAutoPlaying(false); }}
              className="absolute start-2 md:start-4 top-1/2 -translate-y-1/2 z-40 w-11 h-11 md:w-12 md:h-12 rounded-full flex items-center justify-center text-white transition-all duration-300 hover:scale-110 group"
              style={{
                background: 'linear-gradient(135deg, rgba(0,212,255,0.15), rgba(10,22,40,0.9))',
                border: '1px solid rgba(0,212,255,0.2)',
                boxShadow: '0 4px 15px rgba(0,212,255,0.15)',
              }}
              aria-label={t('home:providers.previousProvider')}
            >
              <ChevronLeft className="h-5 w-5 transition-transform group-hover:-translate-x-0.5 rtl-flip" />
            </button>
            <button
              onClick={() => { nextSlide(); setIsAutoPlaying(false); }}
              className="absolute end-2 md:end-4 top-1/2 -translate-y-1/2 z-40 w-11 h-11 md:w-12 md:h-12 rounded-full flex items-center justify-center text-white transition-all duration-300 hover:scale-110 group"
              style={{
                background: 'linear-gradient(135deg, rgba(0,212,255,0.15), rgba(10,22,40,0.9))',
                border: '1px solid rgba(0,212,255,0.2)',
                boxShadow: '0 4px 15px rgba(0,212,255,0.15)',
              }}
              aria-label={t('home:providers.nextProvider')}
            >
              <ChevronRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5 rtl-flip" />
            </button>
          </div>

          {/* Bottom Controls: Dots + Auto-play + Counter */}
          <div className="flex items-center justify-center gap-4 mt-6 animate-fade-in-up stagger-3">
            <button
              onClick={() => setIsAutoPlaying(!isAutoPlaying)}
              className="w-8 h-8 rounded-full flex items-center justify-center bg-white/[0.05] hover:bg-[#00D4FF]/10 transition-all group border border-white/[0.06]"
              aria-label={isAutoPlaying ? t('home:providers.pauseAutoplay') : t('home:providers.resumeAutoplay')}
            >
              {isAutoPlaying ? (
                <Pause className="h-3.5 w-3.5 text-[#00D4FF] group-hover:text-[#E5693A] transition-colors" />
              ) : (
                <Play className="h-3.5 w-3.5 text-[#00D4FF] group-hover:text-[#E5693A] transition-colors" />
              )}
            </button>

            <div className="flex items-center gap-1.5">
              {staticProviders.map((_, index) => (
                <button
                  key={index}
                  onClick={() => { goToSlide(index); setIsAutoPlaying(false); }}
                  className={`transition-all duration-300 rounded-full ${
                    index === activeSlide
                      ? 'w-7 h-2.5 bg-gradient-to-r from-[#00D4FF] to-[#E5693A]'
                      : 'w-2.5 h-2.5 bg-white/20 hover:bg-[#00D4FF]/40'
                  }`}
                  aria-label={t('home:providers.goToProvider', { number: index + 1 })}
                />
              ))}
            </div>

            <div className="text-xs font-mono text-white/40 ms-2">
              <span className="text-[#00D4FF] font-bold">{String(activeSlide + 1).padStart(2, '0')}</span>
              <span className="mx-0.5">/</span>
              <span>{String(staticProviders.length).padStart(2, '0')}</span>
            </div>
          </div>

          {/* Auto-play progress bar */}
          {isAutoPlaying && (
            <div className="max-w-xs mx-auto mt-3 h-0.5 bg-white/[0.06] rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#00D4FF] to-[#E5693A] rounded-full animate-slider-progress" />
            </div>
          )}
        </div>
      </section>

      {/* ==================== HYBRID CONTROL ==================== */}
      <section className="py-20 md:py-28 bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }} custom={0} className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-4">{t('home:control.title')}</h2>
            <p className="text-foreground/50 max-w-2xl mx-auto">{t('home:control.subtitle')}</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Zap,
                gradient: 'from-[#E5693A] to-[#00D4FF]',
                title: t('home:control.layer1Title'),
                desc: t('home:control.layer1Desc'),
                badge: t('home:control.layer1Badge'),
                badgeClass: 'bg-[#00D4FF]/10 text-[#00D4FF] border-[#00D4FF]/20',
              },
              {
                icon: Eye,
                gradient: 'from-amber-500 to-amber-600',
                title: t('home:control.layer2Title'),
                desc: t('home:control.layer2Desc'),
                badge: t('home:control.layer2Badge'),
                badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
              },
              {
                icon: Lock,
                gradient: 'from-[#0A1628] to-[#0F2847]',
                title: t('home:control.layer3Title'),
                desc: t('home:control.layer3Desc'),
                badge: t('home:control.layer3Badge'),
                badgeClass: 'bg-white/10 text-white/80 border-white/10',
              },
            ].map((layer, i) => (
              <motion.div
                key={layer.title}
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-50px' }}
                custom={i + 1}
              >
                <Card className="h-full min-h-[260px] shadow-lg border-none text-center card-hover group overflow-hidden relative flex flex-col">
                  <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-foreground/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <CardContent className="p-6 flex flex-col h-full">
                    <div className={`w-16 h-16 bg-gradient-to-br ${layer.gradient} rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg transition-transform hover:scale-110`}>
                      <layer.icon className="h-8 w-8 text-white" />
                    </div>
                    <h3 className="text-xl font-bold mb-2 min-h-[28px]">{layer.title}</h3>
                    <p className="text-foreground/60 text-sm mb-4 leading-relaxed flex-1">{layer.desc}</p>
                    <Badge className={layer.badgeClass} title={layer.badge}>{layer.badge}</Badge>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== COMPARISON — Side-by-Side Cards ==================== */}
      <section id="compare" className="relative py-20 md:py-28 overflow-hidden" style={{ background: 'linear-gradient(180deg, #0A1628 0%, #0F1729 100%)' }}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-[0.03]" style={{ background: 'radial-gradient(circle, #00D4FF, transparent 70%)' }} />
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }} custom={0} className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">{t('home:compareSection.title')}</h2>
            <p className="text-white/50">{t('home:compareSection.subtitle')}</p>
          </motion.div>

          {/* Side-by-side comparison cards */}
          <div className="grid md:grid-cols-2 gap-6 md:gap-8">
            {/* Traditional Insurance — Muted */}
            <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={1}>
              <div className="rounded-2xl p-6 bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm h-full min-h-[480px]">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg bg-white/[0.05] flex items-center justify-center">
                    <XCircle className="h-5 w-5 text-white/30" />
                  </div>
                  <h3 className="text-lg font-bold text-white/50">{t('home:compareSection.traditionalHeader')}</h3>
                </div>
                <div className="space-y-3">
                  {comparisonRows.map((row, i) => (
                    <div key={i} className="flex items-start gap-3 py-2.5 border-b border-white/[0.04] last:border-0">
                      <XCircle className="h-4 w-4 text-red-400/50 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-white/30 mb-0.5">{row.feature}</p>
                        <p className="text-sm text-white/40">{row.traditional}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Parametric Insurance — Vibrant */}
            <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={2} className="relative">
              {/* Animated gradient border */}
              <div className="absolute -inset-[1px] rounded-2xl animate-gradient-shift" style={{
                background: 'linear-gradient(135deg, #00D4FF, #E5693A, #00D4FF)',
                backgroundSize: '200% 200%',
              }} />
              <div className="relative rounded-2xl p-6 h-full min-h-[480px]" style={{ background: 'linear-gradient(145deg, #0F1B2E, #0A1628)' }}>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg bg-[#00D4FF]/10 border border-[#00D4FF]/20 flex items-center justify-center">
                    <CheckCircle className="h-5 w-5 text-[#00D4FF]" />
                  </div>
                  <h3 className="text-lg font-bold text-[#00D4FF]">{t('home:compareSection.parametricHeader')}</h3>
                  <Badge className="bg-[#00D4FF]/10 text-[#00D4FF] border-[#00D4FF]/20 text-[10px] ms-auto" title="COBITUN">COBITUN</Badge>
                </div>
                <div className="space-y-3">
                  {comparisonRows.map((row, i) => (
                    <div key={i} className="flex items-start gap-3 py-2.5 border-b border-white/[0.06] last:border-0">
                      <CheckCircle className="h-4 w-4 text-[#00D4FF] mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-white/50 mb-0.5">{row.feature}</p>
                        <p className="text-sm text-[#00D4FF]/80 font-medium">{row.parametric}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ==================== VIDEO SECTION — Cinematic ==================== */}
      <section className="py-20 md:py-28 bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }} custom={0}>
            <div className="rounded-2xl overflow-hidden relative group cursor-pointer" onClick={openVideoModal}
              style={{ background: 'linear-gradient(135deg, #0A1628 0%, #0F2847 50%, #0A1628 100%)' }}
            >
              {/* Video thumbnail with overlay */}
              <div className="grid md:grid-cols-5 gap-0 min-h-[280px]">
                {/* Left: Info */}
                <div className="md:col-span-3 p-8 md:p-12 flex flex-col justify-center relative z-10">
                  <Badge className="bg-[#00D4FF]/10 text-[#00D4FF] border-[#00D4FF]/20 w-fit mb-4" title={t('home:video.liveDemo')}>{t('home:video.liveDemo')}</Badge>
                  <h3 className="text-2xl md:text-3xl font-bold text-white mb-4">{t('home:video.title')}</h3>
                  <p className="text-white/50 text-sm md:text-base leading-relaxed max-w-md">{t('home:video.subtitle')}</p>
                </div>

                {/* Right: Play Button */}
                <div className="md:col-span-2 flex items-center justify-center p-8 relative">
                  {/* Pulsing rings */}
                  <div className="absolute w-32 h-32 rounded-full border border-[#00D4FF]/10 animate-pulse-ring" />
                  <div className="absolute w-40 h-40 rounded-full border border-[#00D4FF]/[0.06]" style={{ animation: 'pulse-ring 3s ease-out infinite', animationDelay: '0.5s' }} />

                  {/* Play button */}
                  <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-[#E5693A] to-[#E5693A]/70 flex items-center justify-center shadow-xl shadow-[#E5693A]/30 group-hover:shadow-[#E5693A]/50 transition-all group-hover:scale-110">
                    <Play className="h-8 w-8 text-white ms-1" />
                  </div>
                </div>
              </div>

              {/* Shimmer overlay */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-0 animate-shimmer-slide opacity-[0.03]" style={{ background: 'linear-gradient(90deg, transparent, white, transparent)' }} />
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ==================== CTA SECTION ==================== */}
      <section className="relative py-24 md:py-32 overflow-hidden" style={{ background: 'linear-gradient(135deg, #0A1628 0%, #0F2847 40%, #0A1628 100%)' }}>

        {/* Mesh gradient background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-10 end-10 w-96 h-96 rounded-full opacity-[0.06] blur-3xl animate-float-slow" style={{ background: '#E5693A' }} />
          <div className="absolute bottom-10 start-10 w-80 h-80 rounded-full opacity-[0.04] blur-3xl animate-float-slow" style={{ background: '#00D4FF', animationDelay: '2s' }} />
        </div>

        {/* Geometric shapes */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/4 left-[10%] w-20 h-20 border border-[#00D4FF]/10 rotate-45" />
          <div className="absolute bottom-1/4 right-[15%] w-16 h-16 border border-[#E5693A]/10 rotate-12" />
          <div className="absolute top-1/3 right-[25%] w-2 h-2 bg-[#00D4FF]/20 rounded-full" />
          <div className="absolute bottom-1/3 left-[20%] w-3 h-3 bg-[#E5693A]/20 rounded-full" />
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={0}>
            <Shield className="h-16 w-16 text-[#00D4FF] mx-auto mb-6 animate-float-slow" style={{ filter: 'drop-shadow(0 0 20px rgba(0, 212, 255, 0.3))' }} />
          </motion.div>

          <motion.h2 variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={1} className="text-3xl md:text-5xl lg:text-6xl font-bold mb-6">
            <span className="text-white">{t('home:cta.title1')}</span>
            <br />
            <span className="bg-gradient-to-r from-[#00D4FF] via-white to-[#E5693A] bg-clip-text text-transparent">{t('home:cta.title2')}</span>
          </motion.h2>

          <motion.p variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={2} className="text-white/50 text-lg mb-10 max-w-xl mx-auto">
            {t('home:cta.subtitle')}
          </motion.p>

          <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={3} className="flex flex-wrap gap-4 justify-center">
            <Button
              size="lg"
              className="bg-gradient-to-r from-[#E5693A] to-[#E5693A]/80 text-white font-bold text-lg px-8 py-6 hover:from-[#E5693A]/90 hover:to-[#E5693A]/70 shadow-xl shadow-[#E5693A]/25 transition-all hover:shadow-[#E5693A]/40 hover:scale-[1.02]"
              onClick={() => setCurrentPage('customer-signup')}
            >
              {t('home:cta.apply')} <ArrowRight className="ms-2 h-5 w-5 rtl-flip" />
            </Button>
            <Button
              size="lg"
              variant="ghost"
              className="border border-white/15 text-white/80 hover:bg-white/5 hover:text-white text-lg px-8 py-6 backdrop-blur-sm transition-all"
              onClick={() => setCurrentPage('contact')}
            >
              <Phone className="me-2 h-5 w-5" /> {t('home:cta.talkToAgent')}
            </Button>
          </motion.div>
        </div>
      </section>

      {/* ==================== FOOTER — Enhanced ==================== */}
      <footer className="relative text-white" style={{ background: '#060D1A' }}>
        {/* Gradient divider */}
        <div className="h-[2px] bg-gradient-to-r from-transparent via-[#00D4FF]/30 to-transparent" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid md:grid-cols-4 gap-10">
            {/* Brand column */}
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <Shield className="h-6 w-6 text-[#00D4FF]" style={{ filter: 'drop-shadow(0 0 6px rgba(0, 212, 255, 0.3))' }} />
                <span className="text-lg font-bold">{t('common:brand.name')}</span>
              </div>
              <p className="text-white/40 text-sm leading-relaxed mb-4">{t('home:footer.platformDesc')}</p>

              {/* Newsletter */}
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder={t('common:placeholder.email')}
                  aria-label={t('home:newsletter.ariaLabel', 'Email newsletter')}
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white/70 placeholder:text-white/25 focus:outline-none focus:border-[#00D4FF]/30"
                />
                <Button size="sm" className="bg-[#00D4FF]/10 text-[#00D4FF] border border-[#00D4FF]/20 hover:bg-[#00D4FF]/20 shrink-0" onClick={() => {
                  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                  if (!newsletterEmail.trim()) {
                    toast.error(t('common:validation.required', 'Please enter your email address'));
                  } else if (emailRegex.test(newsletterEmail)) {
                    toast.info(t('common:toast.newsletterComingSoon', 'Newsletter feature coming soon! Thank you for your interest.'));
                    setNewsletterEmail('');
                  } else {
                    toast.error(t('common:toast.newsletterInvalidEmail') || 'Please enter a valid email address');
                  }
                }}>
                  <Mail className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="font-semibold mb-4 text-white/80 text-sm uppercase tracking-wider">{t('common:footer.quickLinks')}</h4>
              <div className="flex flex-col gap-2.5">
                {[
                  { label: t('common:nav.home'), page: 'home' },
                  { label: t('common:nav.about'), page: 'about' },
                  { label: t('common:nav.contact'), page: 'contact' },
                ].map((link) => (
                  <button key={link.page} onClick={() => setCurrentPage(link.page)} className="text-white/40 hover:text-[#00D4FF] text-sm text-start transition-colors">
                    {link.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Powered By */}
            <div>
              <h4 className="font-semibold mb-4 text-white/80 text-sm uppercase tracking-wider">{t('common:footer.poweredByTitle')}</h4>
              <div className="flex flex-col gap-2">
                <p className="text-white/40 text-sm">{t('common:footer.ioda')}</p>
                <p className="text-white/40 text-sm">{t('common:footer.caida')}</p>
                <p className="text-white/40 text-sm">{t('common:footer.ancs')}</p>
              </div>
            </div>

            {/* Contact */}
            <div>
              <h4 className="font-semibold mb-4 text-white/80 text-sm uppercase tracking-wider">{t('common:footer.contactTitle')}</h4>
              <div className="flex flex-col gap-2.5">
                <p className="text-white/40 text-sm flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-[#00D4FF]/40" />{t('common:footer.email')}</p>
                <p className="text-white/40 text-sm flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-[#00D4FF]/40" />{t('common:footer.phone')}</p>
                <p className="text-white/40 text-sm flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-[#00D4FF]/40" />{t('common:footer.address')}</p>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="border-t border-white/[0.04] mt-10 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-white/25 text-xs">{t('common:footer.copyright')}</p>
            <p className="text-white/25 text-xs">{t('common:footer.poweredBy')}</p>
          </div>
        </div>
      </footer>

      {/* ==================== VIDEO LIGHTBOX MODAL ==================== */}
      {videoModalOpen && (
        <motion.div
          variants={fadeIn}
          initial="hidden"
          animate="visible"
          ref={videoModalRef}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          onClick={closeVideoModal}
          role="dialog"
          aria-modal="true"
          aria-label={t('home:video.title', 'Video player')}
          style={{
            background: 'rgba(0, 0, 0, 0.9)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, ease: [0.25, 0.4, 0.25, 1] }}
            className="relative w-full max-w-4xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={closeVideoModal}
              className="absolute -top-12 end-0 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all z-10 border border-white/[0.06]"
              aria-label={t('home:video.close')}
            >
              <X className="h-5 w-5" />
            </button>

            {/* 16:9 video player */}
            <div className="relative w-full rounded-xl overflow-hidden shadow-2xl border border-white/[0.06]" style={{ paddingTop: '56.25%' }}>
              <video
                ref={videoRef}
                className="absolute inset-0 w-full h-full object-contain bg-black"
                autoPlay
                muted
                controls
                playsInline
              >
                <source src="/videos/hero.mp4" type="video/mp4" />
                {t('home:video.unsupported')}
              </video>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}

