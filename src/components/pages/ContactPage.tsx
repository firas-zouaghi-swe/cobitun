'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/lib/store';

import { toast } from 'sonner';
import {
  Shield, Mail, Phone, MapPin, Send, Loader2,
  Headphones, Cloud, Menu, X
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { FieldError, RequiredIndicator, CharCounter } from '@/components/ui/form-warning';

export default function ContactPage() {
  const { t } = useTranslation(['contact', 'common']);
  const { setCurrentPage } = useAppStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const clearFieldError = (field: string) => {
    if (fieldErrors[field]) {
      setFieldErrors((prev) => { const next = { ...prev }; delete next[field]; return next; });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Build errors object
    const errors: Record<string, string> = {};
    if (!form.name.trim()) errors.name = t('common:validation.required');
    if (!form.email.trim()) errors.email = t('common:validation.required');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = t('common:validation.email.invalid');
    if (!form.message.trim()) errors.message = t('common:validation.required');

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      toast.error(t('common:errors.fillAllFields'));
      // Focus first error field
      const firstErrorField = document.getElementById(Object.keys(errors)[0]);
      firstErrorField?.focus();
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          message: form.message.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || t('contact:toast.sendFailed'));
        return;
      }
      toast.success(t('contact:toast.messageSent'));
      setForm({ name: '', email: '', message: '' });
      setFieldErrors({});
    } catch {
      toast.error(t('common:errors.somethingWrong'));
    } finally {
      setLoading(false);
    }
  };

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
              <button onClick={() => setCurrentPage('about')} className="hover:text-tunis-orange transition-colors font-medium text-sm relative group">
                {t('common:nav.about')}
                <span className="absolute -bottom-1 start-0 w-0 h-0.5 bg-tunis-orange transition-all group-hover:w-full" />
              </button>
              <button onClick={() => setCurrentPage('contact')} className="text-tunis-orange font-medium text-sm relative group">
                {t('common:nav.contact')}
                <span className="absolute -bottom-1 start-0 w-full h-0.5 bg-tunis-orange" />
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
              <button onClick={() => { setCurrentPage('about'); setMobileMenuOpen(false); }} className="text-white hover:text-tunis-orange transition-colors font-medium text-start py-2">{t('common:nav.about')}</button>
              <button onClick={() => { setCurrentPage('contact'); setMobileMenuOpen(false); }} className="text-tunis-orange font-medium text-start py-2">{t('common:nav.contact')}</button>
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
          <Mail className="h-16 w-16 text-tunis-orange mx-auto mb-6 animate-float" />
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 text-white">
            {t('contact:hero.title')} <span className="gradient-text">{t('contact:hero.titleHighlight')}</span>
          </h1>
          <p className="text-lg md:text-xl text-white/90 max-w-2xl mx-auto">
            {t('contact:hero.description')}
          </p>
        </div>
      </section>

      {/* Contact Form & Info */}
      <section className="py-16 md:py-20 bg-gradient-to-br from-card to-tunis-blue-pale/20 dark:from-card dark:to-muted">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12">
            {/* Form */}
            <Card className="shadow-lg border-tunis-blue/10 dark:border-tunis-blue/20 animate-fade-in-left">
              <CardContent className="p-6">
                <h2 className="text-2xl font-bold mb-6 text-foreground">{t('contact:form.title')}</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">{t('contact:form.nameLabel')}<RequiredIndicator /></Label>
                    <Input
                      id="name"
                      placeholder={t('contact:form.namePlaceholder')}
                      value={form.name}
                      onChange={(e) => { setForm((p) => ({ ...p, name: e.target.value })); clearFieldError('name'); }}
                      onBlur={() => { if (!form.name.trim()) setFieldErrors((prev) => ({ ...prev, name: t('common:validation.required') })); }}
                      aria-invalid={!!fieldErrors.name}
                      aria-describedby={fieldErrors.name ? 'name-error' : undefined}
                      className="focus-visible:ring-tunis-blue/30"
                    />
                    <FieldError id="name-error">{fieldErrors.name}</FieldError>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">{t('contact:form.emailLabel')}<RequiredIndicator /></Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder={t('contact:form.emailPlaceholder')}
                      value={form.email}
                      onChange={(e) => { setForm((p) => ({ ...p, email: e.target.value })); clearFieldError('email'); }}
                      onBlur={() => {
                        if (!form.email.trim()) setFieldErrors((prev) => ({ ...prev, email: t('common:validation.required') }));
                        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) setFieldErrors((prev) => ({ ...prev, email: t('common:validation.email.invalid') }));
                      }}
                      aria-invalid={!!fieldErrors.email}
                      aria-describedby={fieldErrors.email ? 'email-error' : undefined}
                      className="focus-visible:ring-tunis-blue/30"
                    />
                    <FieldError id="email-error">{fieldErrors.email}</FieldError>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="message">{t('contact:form.messageLabel')}<RequiredIndicator /></Label>
                    <Textarea
                      id="message"
                      placeholder={t('contact:form.messagePlaceholder')}
                      rows={5}
                      maxLength={2000}
                      value={form.message}
                      onChange={(e) => { setForm((p) => ({ ...p, message: e.target.value })); clearFieldError('message'); }}
                      onBlur={() => { if (!form.message.trim()) setFieldErrors((prev) => ({ ...prev, message: t('common:validation.required') })); }}
                      aria-invalid={!!fieldErrors.message}
                      aria-describedby={fieldErrors.message ? 'message-error' : undefined}
                      className="focus-visible:ring-tunis-blue/30"
                    />
                    <CharCounter current={form.message.length} max={2000} />
                    <FieldError id="message-error">{fieldErrors.message}</FieldError>
                  </div>
                  <Button type="submit" variant="tunisBlue" className="w-full" disabled={loading}>
                    {loading ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Send className="me-2 h-4 w-4" />}
                    {loading ? t('contact:form.sending') : t('contact:form.send')}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Contact Info */}
            <div className="space-y-6 animate-fade-in-right">
              <h2 className="text-2xl font-bold mb-6 text-foreground">{t('contact:info.title')}</h2>
              <Card className="shadow-md border-s-4 border-s-tunis-blue card-hover-lift">
                <CardContent className="p-6 flex items-start gap-4">
                  <div className="w-12 h-12 bg-tunis-blue/10 dark:bg-tunis-blue/20 rounded-xl flex items-center justify-center shrink-0">
                    <Mail className="w-6 h-6 text-tunis-blue" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg text-foreground">{t('contact:info.email')}</h3>
                    <p className="text-muted-foreground">{t('contact:info.emailValue', 'info@cyber-dbi.net')}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-md border-s-4 border-s-tunis-orange card-hover-lift">
                <CardContent className="p-6 flex items-start gap-4">
                  <div className="w-12 h-12 bg-tunis-orange/10 dark:bg-tunis-orange/20 rounded-xl flex items-center justify-center shrink-0">
                    <Phone className="w-6 h-6 text-tunis-orange" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg text-foreground">{t('contact:info.phone')}</h3>
                    <p className="text-muted-foreground">{t('contact:info.phone1', '+216 22 274 079')}</p>
                    <p className="text-muted-foreground">{t('contact:info.phone2', '+216 56 145 277')}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-md border-s-4 border-s-tunis-navy card-hover-lift">
                <CardContent className="p-6 flex items-start gap-4">
                  <div className="w-12 h-12 bg-tunis-navy/10 dark:bg-tunis-navy/20 rounded-xl flex items-center justify-center shrink-0">
                    <MapPin className="w-6 h-6 text-tunis-navy" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg text-foreground">{t('contact:info.address')}</h3>
                    <p className="text-muted-foreground">{t('contact:info.addressLine1', 'Rue 7145, El Manar II')}</p>
                    <p className="text-muted-foreground">{t('contact:info.addressLine2', 'Prox. Polyclinique El Manar & Colisée Soula')}</p>
                    <p className="text-muted-foreground">{t('contact:info.addressLine3', '2092 Tunis, Tunisia')}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-md border-s-4 border-s-tunis-orange card-hover-lift">
                <CardContent className="p-6 flex items-start gap-4">
                  <div className="w-12 h-12 bg-tunis-orange/10 dark:bg-tunis-orange/20 rounded-xl flex items-center justify-center shrink-0">
                    <Headphones className="w-6 h-6 text-tunis-orange" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg text-foreground">{t('contact:info.technicalSupport')}</h3>
                    <p className="text-muted-foreground font-medium">{t('contact:info.supportName', 'Firas Zouaghi')}</p>
                    <p className="text-muted-foreground">{t('contact:info.softwareEngineer')}</p>
                    <p className="text-muted-foreground">{t('contact:info.website', 'cyber-dbi.net')}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
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

