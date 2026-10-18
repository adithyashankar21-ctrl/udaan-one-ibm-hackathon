import React, { useEffect, useRef, useState } from 'react';
import {
  Accessibility,
  Check,
  ChevronDown,
  ClipboardList,
  FileText,
  Globe2,
  Home,
  LayoutGrid,
  Compass,
  MapPin,
  Menu,
  MessageSquare,
  Mic,
  PhoneCall,
  ScanLine,
  Sparkles,
  Store,
  User,
  X,
} from 'lucide-react';
import { ChannelMode, LanguageCode } from '../../types';
import { SUPPORTED_LANGUAGES } from '../../data/languages';
import { getShellStrings } from '../../data/uiStrings';

interface SiteHeaderProps {
  current: ChannelMode;
  onNavigate: (mode: ChannelMode) => void;
  language: LanguageCode;
  onLanguageChange: (lang: LanguageCode) => void;
  profileName: string;
  onOpenProfile: () => void;
}

type TextSize = 'md' | 'lg' | 'xl';

// Persisted per-viewer display preferences (storage may be unavailable)
function readPref(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}
function writePref(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

/** Close a popover when clicking outside it or pressing Escape. */
function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);
  return ref;
}

/** Brand mark: two rising chevrons — "udaan" (flight) — on midnight navy. */
export const UdaanOneLogo: React.FC<{ className?: string }> = ({ className = 'w-10 h-10' }) => (
  <svg viewBox="0 0 40 40" className={className} aria-hidden>
    <defs>
      <linearGradient id="udaan-bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#172844" />
        <stop offset="1" stopColor="#101A2C" />
      </linearGradient>
    </defs>
    <rect width="40" height="40" rx="11" fill="url(#udaan-bg)" />
    <path d="M10.5 24.5 20 13.5l9.5 11" fill="none" stroke="#F4A340" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M15 29.5 20 23.8l5 5.7" fill="none" stroke="#20B8A7" strokeWidth="3.1" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Which primary item a screen belongs to (e.g. Start a business lives under Skills & Opportunities). */
const SECTION_OF: Partial<Record<ChannelMode, ChannelMode>> = { enterprise: 'skills', learning: 'skills', documents: 'schemes' };

export const SiteHeader: React.FC<SiteHeaderProps> = ({ current, onNavigate, language, onLanguageChange, profileName, onOpenProfile }) => {
  const t = getShellStrings(language);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [a11yOpen, setA11yOpen] = useState(false);
  const [modesOpen, setModesOpen] = useState(false);

  const [textSize, setTextSize] = useState<TextSize>(() => readPref('kv-text-size', 'md') as TextSize);
  const [highContrast, setHighContrast] = useState(() => readPref('kv-contrast', 'normal') === 'high');
  const [reduceMotion, setReduceMotion] = useState(() => readPref('kv-motion', 'normal') === 'reduce');

  useEffect(() => {
    document.documentElement.dataset.textSize = textSize;
    writePref('kv-text-size', textSize);
  }, [textSize]);
  useEffect(() => {
    document.documentElement.dataset.contrast = highContrast ? 'high' : 'normal';
    writePref('kv-contrast', highContrast ? 'high' : 'normal');
  }, [highContrast]);
  useEffect(() => {
    document.documentElement.dataset.motion = reduceMotion ? 'reduce' : 'normal';
    writePref('kv-motion', reduceMotion ? 'reduce' : 'normal');
  }, [reduceMotion]);
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const langRef = useDismiss(langOpen, () => setLangOpen(false));
  const a11yRef = useDismiss(a11yOpen, () => setA11yOpen(false));
  const modesRef = useDismiss(modesOpen, () => setModesOpen(false));

  const section = SECTION_OF[current] || current;
  const primary: Array<{ id: ChannelMode; label: string; icon: React.ElementType }> = [
    { id: 'schemes', label: t.nav.schemes, icon: Compass },
    { id: 'skills', label: t.nav.skills, icon: Sparkles },
    { id: 'smart_apply', label: t.nav.apply, icon: ScanLine },
    { id: 'applications', label: t.nav.applications, icon: ClipboardList },
  ];

  const modes: Array<{ id: ChannelMode; label: string; desc: string; icon: React.ElementType }> = [
    { id: 'voice_studio', label: 'AI Voice Studio', desc: 'Full voice conversation', icon: Mic },
    { id: 'unified_journey', label: 'KaushalFill', desc: 'Guided profile & roadmap journey', icon: FileText },
    { id: 'ivr', label: 'IVR Helpline', desc: 'Phone-style voice menu', icon: PhoneCall },
    { id: 'whatsapp', label: 'WhatsApp Assistant', desc: 'Chat-style guidance', icon: MessageSquare },
    { id: 'kiosk', label: 'Kiosk Mode', desc: 'Large, simple public screen', icon: Store },
    { id: 'district_map', label: 'District Opportunity Map', desc: 'Training & opportunities by district', icon: MapPin },
  ];

  const activeLang = SUPPORTED_LANGUAGES.find((l) => l.code === language) || SUPPORTED_LANGUAGES[0];
  const modeActive = modes.some((m) => m.id === current && m.id !== 'voice_studio');

  const go = (id: ChannelMode) => {
    onNavigate(id);
    setMobileOpen(false);
    setModesOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navBtn = (active: boolean) =>
    `relative inline-flex h-10 items-center whitespace-nowrap rounded-xl px-2.5 text-sm font-semibold transition-colors xl:px-3 ${
      active ? 'text-navy after:absolute after:inset-x-3 after:-bottom-[13px] after:h-[2px] after:rounded-full after:bg-saffron' : 'text-muted hover:text-navy hover:bg-ivory-200/70'
    }`;

  const iconBtn = 'flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-white text-navy transition-colors hover:border-navy-700/40';

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line/80 bg-ivory/85 backdrop-blur-md supports-[backdrop-filter]:bg-ivory/75">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-navy focus:px-3 focus:py-2 focus:text-white">
          Skip to content
        </a>

        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4">
          <button onClick={() => go('home')} className="flex min-w-0 shrink-0 items-center gap-2.5 rounded-xl text-left" aria-label="UDAAN ONE home">
            <UdaanOneLogo className="h-10 w-10 shrink-0" />
            <span className="min-w-0 leading-tight">
              <span className="block text-[17px] font-extrabold tracking-[-0.01em] text-navy">
                UDAAN <span className="text-teal-600">ONE</span>
              </span>
              <span className="block truncate whitespace-nowrap text-[11px] font-medium text-muted">AI for Opportunity. Technology for All.</span>
            </span>
          </button>

          {/* Desktop navigation */}
          <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Primary">
            {primary.map((item) => (
              <button key={item.id} onClick={() => go(item.id)} className={navBtn(section === item.id)} aria-current={section === item.id ? 'page' : undefined}>
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-1.5">
            <button onClick={() => go('voice_studio')} className={`btn btn-sm hidden xl:inline-flex ${current === 'voice_studio' ? 'btn-primary' : 'btn-accent'}`}>
              <Mic className="h-4 w-4" aria-hidden /> {t.nav.assistant}
            </button>

            {/* Language */}
            <div className="relative" ref={langRef}>
              <button
                onClick={() => setLangOpen((o) => !o)}
                className="flex h-10 items-center gap-1.5 rounded-xl border border-line bg-white px-2.5 text-sm font-semibold text-navy transition-colors hover:border-navy-700/40"
                aria-expanded={langOpen}
                aria-haspopup="listbox"
                aria-label={`${t.language}: ${activeLang.name}`}
              >
                <Globe2 className="h-4 w-4 text-teal-600" aria-hidden />
                <span className="hidden sm:inline">{activeLang.nativeName}</span>
                <span className="sm:hidden">{activeLang.code.toUpperCase()}</span>
                <ChevronDown className="h-3.5 w-3.5 text-muted" aria-hidden />
              </button>
              {langOpen && (
                <ul role="listbox" aria-label={t.language} className="card absolute right-0 mt-2 max-h-80 w-60 overflow-y-auto p-1.5 animate-fade-up">
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <li key={lang.code}>
                      <button
                        role="option"
                        aria-selected={lang.code === language}
                        onClick={() => {
                          onLanguageChange(lang.code);
                          setLangOpen(false);
                        }}
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-colors ${
                          lang.code === language ? 'bg-teal-50 font-semibold text-navy' : 'text-navy hover:bg-ivory'
                        }`}
                      >
                        <span>
                          {lang.nativeName} <span className="text-xs text-muted">· {lang.name}</span>
                        </span>
                        {lang.code === language && <Check className="h-4 w-4 text-teal-600" aria-hidden />}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Accessibility */}
            <div className="relative" ref={a11yRef}>
              <button onClick={() => setA11yOpen((o) => !o)} className={iconBtn} aria-expanded={a11yOpen} aria-label={t.accessibility}>
                <Accessibility className="h-5 w-5" aria-hidden />
              </button>
              {a11yOpen && (
                <div className="card absolute right-0 mt-2 w-72 space-y-4 p-4 animate-fade-up" role="dialog" aria-label={t.accessibility}>
                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Text size</p>
                    <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Text size">
                      {(['md', 'lg', 'xl'] as TextSize[]).map((size, i) => (
                        <button
                          key={size}
                          role="radio"
                          aria-checked={textSize === size}
                          onClick={() => setTextSize(size)}
                          className={`h-10 rounded-xl border font-bold transition-colors ${textSize === size ? 'border-navy bg-navy text-white' : 'border-line text-navy hover:bg-ivory'}`}
                          style={{ fontSize: `${14 + i * 3}px` }}
                        >
                          A
                        </button>
                      ))}
                    </div>
                  </div>
                  {[
                    { label: 'High contrast', value: highContrast, set: setHighContrast },
                    { label: 'Reduce motion', value: reduceMotion, set: setReduceMotion },
                  ].map((opt) => (
                    <div key={opt.label} className="flex items-center justify-between gap-3 text-sm font-semibold text-navy">
                      <span id={`a11y-${opt.label}`}>{opt.label}</span>
                      <button
                        role="switch"
                        aria-checked={opt.value}
                        aria-labelledby={`a11y-${opt.label}`}
                        onClick={() => opt.set(!opt.value)}
                        className={`relative h-6 w-11 rounded-full transition-colors ${opt.value ? 'bg-green' : 'bg-slate-300'}`}
                      >
                        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${opt.value ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Access modes */}
            <div className="relative hidden lg:block" ref={modesRef}>
              <button
                onClick={() => setModesOpen((o) => !o)}
                className={`${iconBtn} ${modeActive ? 'border-saffron bg-saffron-50' : ''}`}
                aria-expanded={modesOpen}
                aria-haspopup="menu"
                aria-label={t.nav.more}
                title={t.nav.more}
              >
                <LayoutGrid className="h-5 w-5" aria-hidden />
              </button>
              {modesOpen && (
                <div role="menu" aria-label={t.nav.more} className="card absolute right-0 mt-2 w-80 p-2 animate-fade-up">
                  <p className="px-2.5 pb-1 pt-1.5 text-xs font-bold uppercase tracking-wider text-muted">{t.nav.more}</p>
                  {modes.map((m) => (
                    <button
                      key={m.id}
                      role="menuitem"
                      onClick={() => go(m.id)}
                      className={`flex w-full items-start gap-3 rounded-xl p-2.5 text-left transition-colors ${current === m.id ? 'bg-saffron-50' : 'hover:bg-ivory'}`}
                    >
                      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-navy-50 text-navy">
                        <m.icon className="h-4 w-4" aria-hidden />
                      </span>
                      <span>
                        <span className="block text-sm font-semibold text-navy">{m.label}</span>
                        <span className="block text-xs text-muted">{m.desc}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Profile */}
            <button onClick={onOpenProfile} className="hidden h-10 items-center gap-2 rounded-xl bg-navy px-1.5 text-sm font-semibold text-white transition-colors hover:bg-navy-800 sm:flex 2xl:pr-3" aria-label={profileName ? `${t.profile}: ${profileName}` : t.signIn}>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/15">
                <User className="h-4 w-4" aria-hidden />
              </span>
              <span className="hidden max-w-[7rem] truncate 2xl:inline">{profileName || t.profile}</span>
            </button>

            <button onClick={() => setMobileOpen((o) => !o)} className={`${iconBtn} lg:hidden`} aria-expanded={mobileOpen} aria-label="Menu">
              {mobileOpen ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
            </button>
          </div>
        </div>

        {/* Mobile menu sheet */}
        {mobileOpen && (
          <nav className="max-h-[calc(100vh-4rem)] overflow-y-auto border-t border-line bg-ivory px-4 pb-6 pt-3 animate-fade-up lg:hidden" aria-label="Mobile">
            <button onClick={() => go('voice_studio')} className="btn btn-accent btn-lg w-full">
              <Mic className="h-5 w-5" aria-hidden /> {t.nav.assistant}
            </button>
            <div className="mt-3 grid gap-1">
              {[{ id: 'home' as ChannelMode, label: t.nav.home, icon: Home }, ...primary].map((item) => (
                <button
                  key={item.id}
                  onClick={() => go(item.id)}
                  aria-current={section === item.id ? 'page' : undefined}
                  className={`flex min-h-12 items-center gap-3 rounded-xl px-3 text-left text-base font-semibold ${section === item.id ? 'bg-white text-navy shadow-card' : 'text-navy hover:bg-white'}`}
                >
                  <item.icon className="h-5 w-5 text-teal-600" aria-hidden /> {item.label}
                </button>
              ))}
            </div>
            <p className="px-3 pb-2 pt-5 text-xs font-bold uppercase tracking-wider text-muted">{t.nav.more}</p>
            <div className="grid grid-cols-2 gap-2">
              {modes.map((m) => (
                <button
                  key={m.id}
                  onClick={() => go(m.id)}
                  className={`flex min-h-12 items-center gap-2 rounded-xl border p-3 text-left text-sm font-semibold ${current === m.id ? 'border-saffron bg-saffron-50 text-navy' : 'border-line bg-white text-navy'}`}
                >
                  <m.icon className="h-4 w-4 shrink-0 text-saffron-600" aria-hidden />
                  {m.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                onOpenProfile();
                setMobileOpen(false);
              }}
              className="btn btn-primary btn-lg mt-4 w-full"
            >
              <User className="h-4 w-4" aria-hidden />
              {profileName || t.profile}
            </button>
          </nav>
        )}
      </header>

      {/* Mobile bottom navigation: the five most-used destinations, icon + label */}
      <nav aria-label="Quick navigation" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {[
            { id: 'home' as ChannelMode, label: t.nav.home, icon: Home },
            { id: 'schemes' as ChannelMode, label: t.nav.schemes, icon: Compass },
            { id: 'voice_studio' as ChannelMode, label: 'UDAAN AI', icon: Mic },
            { id: 'smart_apply' as ChannelMode, label: t.nav.apply, icon: ScanLine },
            { id: 'applications' as ChannelMode, label: t.nav.applications, icon: ClipboardList },
          ].map((item) => {
            const active = section === item.id;
            const ai = item.id === 'voice_studio';
            return (
              <li key={item.id}>
                <button onClick={() => go(item.id)} aria-current={active ? 'page' : undefined} className="flex h-16 w-full flex-col items-center justify-center gap-1 px-1">
                  <span className={`grid place-items-center rounded-xl transition-colors ${ai ? 'h-9 w-9 bg-navy text-saffron' : active ? 'h-8 w-12 bg-teal-50 text-teal-600' : 'h-8 w-12 text-muted'}`}>
                    <item.icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span className={`max-w-full truncate text-[10.5px] font-semibold leading-none ${active ? 'text-navy' : 'text-muted'}`}>{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
};
