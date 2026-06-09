'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, getDirection } from '@/lib/i18n';
import { Globe, ChevronDown } from 'lucide-react';

interface LanguageSwitcherProps {
  className?: string;
}

export function LanguageSwitcher({ className }: LanguageSwitcherProps) {
  const { t, i18n } = useTranslation('common');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const currentLang = SUPPORTED_LANGUAGES[i18n.language] || SUPPORTED_LANGUAGES.en;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const changeLanguage = async (code: string) => {
    await i18n.changeLanguage(code);
    const dir = getDirection(code);
    document.documentElement.dir = dir;
    document.documentElement.lang = code;
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-white/10 transition-all border border-white/20 ${className || "text-foreground dark:text-foreground"}`}
        aria-label={t('label.changeLanguage', 'Change language')}
        aria-expanded={open}
      >
        <Globe className="h-4 w-4" />
        <span className="hidden sm:inline">{currentLang.nativeName}</span>
        <span className="sm:hidden">{currentLang.code.toUpperCase()}</span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full mt-2 end-0 w-44 rounded-xl shadow-xl border border-white/10 overflow-hidden z-50 animate-fade-in-down bg-popover backdrop-blur-xl"
        >
          {Object.values(SUPPORTED_LANGUAGES).map((lang) => (
            <button
              key={lang.code}
              onClick={() => changeLanguage(lang.code)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-all hover:bg-white/10 ${
                i18n.language === lang.code
                  ? 'bg-white/5 text-[#E5693A] font-semibold'
                  : 'text-foreground dark:text-foreground/90 text-foreground/80'
              }`}
            >
              <span className="text-base">{lang.code === 'ar' ? '🇹🇳' : lang.code === 'fr' ? '🇫🇷' : '🇬🇧'}</span>
              <div className="flex flex-col items-start">
                <span>{lang.nativeName}</span>
                <span className="text-[10px] text-white/50">{lang.name}</span>
              </div>
              {i18n.language === lang.code && (
                <span className="ms-auto w-2 h-2 bg-[#E5693A] rounded-full" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

