'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/lib/store';
import {
  Shield, Users, Award, Clock, Target, Heart, ArrowRight,
  Cloud, ChevronRight, Menu, X
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export default function AboutPage() {
  const { t } = useTranslation(['about', 'common']);
  const { setCurrentPage } = useAppStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const values = [
    { icon: Shield, title: t('about:values.objectiveData.title'), desc: t('about:values.objectiveData.desc') },
    { icon: Users, title: t('about:values.tunisiaFirst.title'), desc: t('about:values.tunisiaFirst.desc') },
    { icon: Award, title: t('about:values.actuarialRigor.title'), desc: t('about:values.actuarialRigor.desc') },
    { icon: Clock, title: t('about:values.speedOfPayout.title'), desc: t('about:values.speedOfPayout.desc') },
    { icon: Target, title: t('about:values.fullTransparency.title'), desc: t('about:values.fullTransparency.desc') },
    { icon: Heart, title: t('about:values.hybridControl.title'), desc: t('about:values.hybridControl.desc') },
  ];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="text-white sticky top-0 z-50 backdrop-blur-md border-b border-white/[0.06]" style={{ background: 'rgba(46, 90, 157, 0.95)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2" role="button" tabIndex={0} onClick={() => setCurrentPage('home')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCurrentPage('home'); } }}>
              <Shield className="h-8 w-8 text-tunis-orange" />
              <span className="text-xl font-bold">{t('common:brand.name')}</span>
              <Badge variant="outline" className="ms-2 text-[10px] border-tunis-orange/50 text-tunis-orange bg-tunis-orange/10" title={t('common:brand.tagline')}>{t('common:brand.tagline')}</Badge>
            </div>
            <nav className="hidden md:flex items-center gap-6">
              <button onClick={() => setCurrentPage('home')} className="hover:text-tunis-orange transition-colors font-medium text-sm relative group">
                {t('common:nav.home')}
                <span className="absolute -bottom-1 start-0 w-0 h-0.5 bg-tunis-orange transition-all group-hover:w-full" />
              </button>
              <button onClick={() => setCurrentPage('about')} className="text-tunis-orange font-medium text-sm relative group">
                {t('common:nav.about')}
                <span className="absolute -bottom-1 start-0 w-full h-0.5 bg-tunis-orange" />
              </button>
              <button onClick={() => setCurrentPage('contact')} className="hover:text-tunis-orange transition-colors font-medium text-sm relative group">
                {t('common:nav.contact')}
                <span className="absolute -bottom-1 start-0 w-0 h-0.5 bg-tunis-orange transition-all group-hover:w-full" />
              </button>
              <ThemeToggle />
              <Button variant="ghost" size="sm" className="border border-white/20 text-white hover:bg-white/10 hover:text-white transition-all" onClick={() => setCurrentPage('admin-login')}>
                {t('common:nav.adminLogin')}
              </Button>
              <Button size="sm" variant="tunis" className="text-tunis-navy font-bold" onClick={() => setCurrentPage('customer-login')}>
                {t('common:nav.customerLogin')}
              </Button>
            </nav>
            <div className="flex md:hidden items-center gap-2">
              <ThemeToggle />
              <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-1.5 rounded-lg hover:bg-white/10 transition-all" aria-expanded={mobileMenuOpen} aria-label={t('common:nav.toggleMenu', 'Toggle navigation menu')}>
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>
        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/[0.06] bg-[#2E5A9D]/98 backdrop-blur-md">
            <nav className="flex flex-col p-4 gap-3">
              <button onClick={() => { setCurrentPage('home'); setMobileMenuOpen(false); }} className="text-white hover:text-tunis-orange transition-colors font-medium text-start py-2">{t('common:nav.home')}</button>
              <button onClick={() => { setCurrentPage('about'); setMobileMenuOpen(false); }} className="text-tunis-orange font-medium text-start py-2">{t('common:nav.about')}</button>
              <button onClick={() => { setCurrentPage('contact'); setMobileMenuOpen(false); }} className="text-white hover:text-tunis-orange transition-colors font-medium text-start py-2">{t('common:nav.contact')}</button>
              <div className="flex gap-2 pt-2 border-t border-white/10">
                <Button size="sm" variant="ghost" className="border border-white/20 text-white hover:bg-white/10 flex-1" onClick={() => { setCurrentPage('admin-login'); setMobileMenuOpen(false); }}>{t('common:nav.adminLogin')}</Button>
                <Button size="sm" variant="tunis" className="text-tunis-navy font-bold flex-1" onClick={() => { setCurrentPage('customer-login'); setMobileMenuOpen(false); }}>{t('common:nav.customerLogin')}</Button>
              </div>
            </nav>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="gradient-tunis-blue text-white py-20 md:py-24 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.07]">
          <div className="absolute top-10 end-10 w-72 h-72 bg-tunis-orange rounded-full blur-3xl animate-float" />
          <div className="absolute bottom-10 start-10 w-64 h-64 bg-white rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }} />
        </div>
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />
        <div className="max-w-4xl mx-auto px-4 text-center relative z-10">
          <Cloud className="h-16 w-16 text-tunis-orange mx-auto mb-6 animate-float" />
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 text-white">
            {t('about:hero.title')} <span className="gradient-text">{t('common:brand.name')}</span>
          </h1>
          <p className="text-lg md:text-xl text-white/90 max-w-2xl mx-auto mb-8">
            {t('about:hero.description')}
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Button size="lg" variant="tunis" className="text-tunis-navy font-bold text-lg px-8 py-6 hover:scale-[1.02]" onClick={() => setCurrentPage('customer-signup')}>
              {t('common:cta.getProtected')} <ArrowRight className="ms-2 h-5 w-5" />
            </Button>
            <Button size="lg" variant="ghost" className="border border-white/20 text-white hover:bg-white/10 hover:text-white text-lg px-8 py-6 backdrop-blur-sm transition-all" onClick={() => setCurrentPage('contact')}>
              {t('common:nav.contact')}
            </Button>
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="py-16 md:py-20 bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="animate-fade-in-left">
              <h2 className="text-3xl font-bold text-foreground mb-4">{t('about:mission.title')}</h2>
              <p className="text-muted-foreground mb-4 leading-relaxed">
                {t('about:mission.description1')}
              </p>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                {t('about:mission.description2')}
              </p>
              <Button variant="tunisBlue" onClick={() => setCurrentPage('customer-signup')}>
                {t('common:cta.getStarted')} <ArrowRight className="ms-2 h-4 w-4" />
              </Button>
            </div>
            <div className="bg-tunis-blue-pale dark:bg-tunis-blue-pale/30 rounded-2xl p-8 border border-tunis-blue/10 animate-fade-in-right">
              <div className="grid grid-cols-2 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-tunis-blue">15+</div>
                  <div className="text-sm text-muted-foreground">{t('about:stats.monitoredProviders')}</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-tunis-blue">24/7</div>
                  <div className="text-sm text-muted-foreground">{t('about:stats.iodaMonitoring')}</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-tunis-orange">15m</div>
                  <div className="text-sm text-muted-foreground">{t('about:stats.payoutSpeed')}</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-tunis-orange">0</div>
                  <div className="text-sm text-muted-foreground">{t('about:stats.claimsForms')}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-16 md:py-20 bg-gradient-to-br from-muted to-tunis-blue-pale/30 dark:from-muted dark:to-muted">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 animate-fade-in-up">
            <h2 className="text-3xl font-bold text-foreground mb-4">{t('about:values.title')}</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">{t('about:values.subtitle')}</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {values.map((value, i) => (
              <Card key={i} className="border-none shadow-md card-hover-lift animate-fade-in-up">
                <CardContent className="p-6">
                  <div className="w-12 h-12 bg-tunis-blue/10 dark:bg-tunis-blue/20 rounded-xl flex items-center justify-center mb-4">
                    <value.icon className="w-6 h-6 text-tunis-blue" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2 text-foreground">{value.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{value.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="text-white py-10" style={{ background: '#1A1A2E' }}>
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Shield className="h-5 w-5 text-tunis-orange" />
            <span className="font-bold">{t('common:brand.name')}</span>
          </div>
          <p className="text-gray-400 text-sm">{t('common:brand.copyright')}</p>
        </div>
      </footer>
    </div>
  );
}

