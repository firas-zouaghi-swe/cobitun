'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const STORAGE_KEY = 'cobitun_ui_settings_v1';

type Settings = {
  cardRadius: string;
  cardShadow: string;
  primaryColor: string;
};

const defaultSettings: Settings = {
  cardRadius: '12px',
  cardShadow: '0 4px 12px rgba(0,0,0,0.08)',
  primaryColor: '#1a73e8',
};

function applyToDom(s: Settings){
  document.documentElement.style.setProperty('--card-radius', s.cardRadius);
  document.documentElement.style.setProperty('--card-shadow', s.cardShadow);
  document.documentElement.style.setProperty('--primary-color', s.primaryColor);
}

export default function StyleSettings(){
  const { t } = useTranslation('common');
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>(defaultSettings);

  useEffect(()=>{
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setSettings((s)=> ({...s, ...parsed}));
        applyToDom({...defaultSettings, ...parsed});
      } else {
        applyToDom(defaultSettings);
      }
    }catch(e){ applyToDom(defaultSettings); }
  },[]);

  const save = (next: Settings)=>{
    // Sanitize CSS values to prevent injection
    const shadowPattern = /^[\d.]+px\s+[\d.]+px\s+[\d.]+px\s+rgba\([\d.,\s]+\)$/;
    const radiusPattern = /^\d+px$/;
    const colorPattern = /^#[0-9a-fA-F]{6}$/;
    const sanitized: Settings = {
      cardRadius: radiusPattern.test(next.cardRadius) ? next.cardRadius : defaultSettings.cardRadius,
      cardShadow: shadowPattern.test(next.cardShadow) ? next.cardShadow : defaultSettings.cardShadow,
      primaryColor: colorPattern.test(next.primaryColor) ? next.primaryColor : defaultSettings.primaryColor,
    };
    setSettings(sanitized);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
    applyToDom(sanitized);
  };

  const reset = ()=>{
    localStorage.removeItem(STORAGE_KEY);
    setSettings(defaultSettings);
    applyToDom(defaultSettings);
  };

  // show only when on localhost or file:// for dev safety
  if (typeof window === 'undefined') return null;
  const host = window.location.hostname;
  if (!(host === 'localhost' || host === '127.0.0.1' || host === '' )) return null;

  return (
    <div>
      <button
        onClick={()=>setOpen(o=>!o)}
        className="fixed z-50 bottom-6 right-6 bg-primary text-white p-3 rounded-full shadow-lg"
        style={{background: 'var(--primary-color, #1a73e8)'}}
        aria-label={t('nav.uiSettings', 'UI settings')}
      >
        ⚙️
      </button>
      {open ? (
        <div className="fixed z-50 bottom-20 right-6 w-80 bg-white dark:bg-gray-900 border rounded-lg p-4 shadow-xl">
          <h4 className="font-semibold mb-2">{t('nav.uiSettingsDev', 'UI Settings (dev)')}</h4>
          <div className="mb-3">
            <label className="text-xs text-muted-foreground">{t('label.cardRadius', 'Card Radius')}</label>
            <input className="w-full mt-1" value={settings.cardRadius} onChange={(e)=> setSettings(s=>({...s, cardRadius: e.target.value}))} />
          </div>
          <div className="mb-3">
            <label className="text-xs text-muted-foreground">{t('label.cardShadow', 'Card Shadow (CSS)')}</label>
            <input className="w-full mt-1" value={settings.cardShadow} onChange={(e)=> setSettings(s=>({...s, cardShadow: e.target.value}))} />
          </div>
          <div className="mb-3">
            <label className="text-xs text-muted-foreground">{t('label.primaryColor', 'Primary Color')}</label>
            <input type="color" className="w-full mt-1 h-8" value={settings.primaryColor} onChange={(e)=> setSettings(s=>({...s, primaryColor: e.target.value}))} />
          </div>
          <div className="flex gap-2">
            <button className="btn btn-primary flex-1" onClick={()=> save(settings)}>{t('action.apply')}</button>
            <button className="btn btn-outline flex-1" onClick={reset}>{t('action.reset', 'Reset')}</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

