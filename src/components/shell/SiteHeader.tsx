import React, { useEffect, useRef, useState } from 'react';
import {
  Accessibility,
  Check,
  ChevronDown,
  ClipboardList,
  Globe2,
  Home,
  IndianRupee,
  LogOut,
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
import { authEnabled, signOut } from '../../services/supabase';
import { AppMenu, rememberPage, MENU_WORD } from './AppMenu';

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

/** The official UDAAN ONE mark: a "U" whose ribbon lifts into a paper-plane arrow ("udaan" means flight). */
export const UdaanOneLogo: React.FC<{ className?: string }> = ({ className = 'w-10 h-10' }) => (
  <img src="/logo-mark.png" alt="" width={256} height={256} decoding="async" draggable={false} className={`${className} rounded-[22%] object-cover`} />
);

/** Which primary item a screen belongs to (e.g. Start a business lives under Skills & Opportunities). */
const SECTION_OF: Partial<Record<ChannelMode, ChannelMode>> = { enterprise: 'skills', learning: 'skills', documents: 'schemes' };

export const SiteHeader: React.FC<SiteHeaderProps> = ({ current, onNavigate, language, onLanguageChange, profileName, onOpenProfile }) => {
  const t = getShellStrings(language);
  const [menuOpen, setMenuOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [a11yOpen, setA11yOpen] = useState(false);

  const [textSize, setTextSize] = useState<TextSize>(() => readPref('kv-text-size', 'md') as TextSize);
  const [highContrast, setHighContrast] = useState(() => readPref('kv-contrast', 'normal') === 'high');
  const [reduceMotion, setReduceMotion] = useState(() => readPref('kv-motion', 'normal') === 'reduce');
  const [darkMode, setDarkMode] = useState(() => readPref('kv-theme', 'light') === 'dark');
  const [easyMode, setEasyMode] = useState(() => readPref('kv-easy', 'off') === 'on');

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
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light';
    writePref('kv-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);
  useEffect(() => {
    document.documentElement.dataset.easy = easyMode ? 'on' : 'off';
    writePref('kv-easy', easyMode ? 'on' : 'off');
  }, [easyMode]);
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const langRef = useDismiss(langOpen, () => setLangOpen(false));
  const a11yRef = useDismiss(a11yOpen, () => setA11yOpen(false));
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setMenuOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => rememberPage(current), [current]);
  const section = SECTION_OF[current] || current;
  const activeLang = SUPPORTED_LANGUAGES.find((l) => l.code === language) || SUPPORTED_LANGUAGES[0];

  const go = (id: ChannelMode) => {
    onNavigate(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const iconBtn = 'flex h-11 w-11 items-center justify-center rounded-full border border-navy/10 bg-white text-navy transition-colors duration-200 hover:border-navy/30';

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-navy/[0.06] glass">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-navy focus:px-3 focus:py-2 focus:text-white">
          Skip to content
        </a>

        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4">
          <button onClick={() => go('home')} className="flex min-w-0 shrink-0 items-center gap-2.5 rounded-xl text-left" aria-label="UDAAN ONE home">
            <UdaanOneLogo className="h-10 w-10 shrink-0" />
            <span className="min-w-0 leading-tight">
              <span className="block font-display text-[17px] font-semibold tracking-[-0.02em] text-navy">
                UDAAN <span className="text-saffron-600">ONE</span>
              </span>
              <span translate="no" className="easy-hide hidden truncate whitespace-nowrap text-xs font-normal text-muted sm:block">AI for Opportunity. Technology for All.</span>
            </span>
          </button>

          {/* The pop-up menu replaces the row of links: long translated names never crowd the bar */}
          <div className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            aria-haspopup="dialog"
            aria-label={MENU_WORD[language]}
            aria-expanded={menuOpen}
            aria-keyshortcuts="Control+K Meta+K"
            className="group flex h-11 items-center gap-2 rounded-full border border-navy/10 bg-white py-1 pl-1.5 pr-1.5 text-sm font-semibold text-navy shadow-card sm:pr-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-violet/40 hover:shadow-lift"
          >
            <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-violet to-[#8b7df0] text-white">
              <Sparkles className="h-4 w-4" aria-hidden />
            </span>
            <span className="hidden sm:inline">{MENU_WORD[language]}</span>
            <kbd className="hidden rounded-md bg-navy-50 px-1.5 py-0.5 font-sans text-[11px] font-semibold text-muted lg:inline">Ctrl K</kbd>
          </button>
            <AppMenu open={menuOpen} onClose={() => setMenuOpen(false)} current={current} onNavigate={onNavigate} language={language} profileName={profileName} onOpenProfile={onOpenProfile} />
          </div>

          <div className="flex items-center gap-1.5">
            <button onClick={() => go('voice_studio')} className="hidden h-11 w-11 items-center justify-center rounded-full bg-gradient-to-b from-[#ffb067] to-saffron text-navy shadow-[0_8px_18px_-8px_rgb(255_153_51/0.9)] transition-transform duration-200 hover:-translate-y-0.5 active:scale-95 sm:flex" aria-label={t.nav.assistant} title={t.nav.assistant}>
              <Mic className="h-5 w-5" aria-hidden />
            </button>

            {/* Language */}
            <div className="relative" ref={langRef}>
              <button
                onClick={() => setLangOpen((o) => !o)}
                className="flex h-11 items-center gap-1.5 rounded-full border border-navy/10 bg-white px-3 text-sm font-semibold text-navy transition-colors duration-200 hover:border-navy/30"
                aria-expanded={langOpen}
                aria-haspopup="listbox"
                aria-label={`${t.language}: ${activeLang.name}`}
              >
                <Globe2 className="h-4 w-4 text-teal-600" aria-hidden />
                <span className="hidden sm:inline" translate="no">{activeLang.nativeName}</span>
                <span className="sm:hidden">{activeLang.code.toUpperCase()}</span>
                <ChevronDown className="h-3.5 w-3.5 text-muted" aria-hidden />
              </button>
              {langOpen && (
                <ul role="listbox" aria-label={t.language} translate="no" className="card absolute right-0 mt-2 max-h-80 w-60 overflow-y-auto p-1.5 animate-fade-up">
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
                          className={`h-11 rounded-full border font-bold transition-colors ${textSize === size ? 'border-navy bg-navy text-white' : 'border-line text-navy hover:bg-ivory'}`}
                          style={{ fontSize: `${14 + i * 3}px` }}
                        >
                          A
                        </button>
                      ))}
                    </div>
                  </div>
                  {[
                    { label: 'Dark mode', value: darkMode, set: setDarkMode },
                    { label: 'Easy mode', value: easyMode, set: setEasyMode },
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

            {/* Profile */}
            <button onClick={onOpenProfile} className="hidden h-11 items-center gap-2 rounded-full bg-navy px-1.5 text-sm font-semibold text-white transition-colors hover:bg-navy-800 sm:flex 2xl:pr-3" aria-label={profileName ? `${t.profile}: ${profileName}` : t.signIn}>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/15">
                <User className="h-4 w-4" aria-hidden />
              </span>
              <span translate={profileName ? "no" : undefined} className="hidden max-w-[7rem] truncate 2xl:inline">{profileName || t.profile}</span>
            </button>

            {/* On phones, sign out is in the menu: the header has room for four buttons only */}
            {authEnabled && (
              <button onClick={signOut} className={`${iconBtn} hidden sm:flex`} aria-label="Sign out" title="Sign out">
                <LogOut className="h-5 w-5" aria-hidden />
              </button>
            )}

          </div>
        </div>

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
