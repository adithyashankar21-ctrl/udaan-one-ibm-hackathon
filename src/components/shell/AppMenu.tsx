import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen, Check, ClipboardList, FileBadge, GraduationCap, Home, IndianRupee, Landmark, MapPin, MessageSquare, Mic, PhoneCall, Rocket, ScanLine, Sparkles, Store, User } from 'lucide-react';
import type { ChannelMode, LanguageCode } from '../../types';
import { SUPPORTED_LANGUAGES } from '../../data/languages';
import { getShellStrings } from '../../data/uiStrings';
import { matchPages } from '../../data/voiceNavigation';

/** The word "Menu" and the AI box's prompt, in each supported language (the rest is translated by AutoTranslate). */
export const MENU_WORD: Record<LanguageCode, string> = {
  en: 'Menu', hi: 'मेनू', ta: 'மெனு', te: 'మెనూ', kn: 'ಮೆನು', ml: 'മെനു', mr: 'मेनू', bn: 'মেনু', gu: 'મેનુ', pa: 'ਮੀਨੂ', or: 'ମେନୁ', ur: 'مینو',
};
const ASK_PLACEHOLDER: Record<LanguageCode, string> = {
  en: 'Say or type what you need',
  hi: 'बोलकर या लिखकर बताइए क्या चाहिए',
  ta: 'உங்களுக்கு என்ன வேண்டும் என்று சொல்லுங்கள் அல்லது எழுதுங்கள்',
  te: 'మీకు ఏమి కావాలో చెప్పండి లేదా టైప్ చేయండి',
  kn: 'ನಿಮಗೆ ಏನು ಬೇಕು ಎಂದು ಹೇಳಿ ಅಥವಾ ಟೈಪ್ ಮಾಡಿ',
  ml: 'നിങ്ങൾക്ക് എന്താണ് വേണ്ടതെന്ന് പറയൂ അല്ലെങ്കിൽ ടൈപ്പ് ചെയ്യൂ',
  mr: 'काय हवे ते बोला किंवा लिहा',
  bn: 'কী চান বলুন বা লিখুন',
  gu: 'શું જોઈએ છે તે બોલો કે લખો',
  pa: 'ਦੱਸੋ ਜਾਂ ਲਿਖੋ ਤੁਹਾਨੂੰ ਕੀ ਚਾਹੀਦਾ ਹੈ',
  or: 'ଆପଣଙ୍କୁ କଣ ଦରକାର କୁହନ୍ତୁ ବା ଲେଖନ୍ତୁ',
  ur: 'بتائیں یا لکھیں آپ کو کیا چاہیے',
};

type Hue = 'saffron' | 'teal' | 'violet' | 'gold' | 'navy';
const HUE: Record<Hue, string> = {
  saffron: 'bg-saffron-50 text-saffron-600',
  teal: 'bg-teal-50 text-teal-600',
  violet: 'bg-violet-50 text-violet-600',
  gold: 'bg-gold-50 text-gold-600',
  navy: 'bg-navy-50 text-navy',
};

interface Item {
  id: ChannelMode;
  label: string;
  desc: string;
  icon: React.ElementType;
  hue: Hue;
}

interface AppMenuProps {
  open: boolean;
  onClose: () => void;
  current: ChannelMode;
  onNavigate: (mode: ChannelMode) => void;
  language: LanguageCode;
  profileName: string;
  onOpenProfile: () => void;
}

/**
 * The pop-up menu: every part of the app in one frosted sheet, with an AI box that takes what someone says or
 * types (in any supported language) and lights up the page that fits. Cards wrap their text, so long
 * translated names never break the layout the way a row of top-bar links does.
 */
export const AppMenu: React.FC<AppMenuProps> = ({ open, onClose, current, onNavigate, language, profileName, onOpenProfile }) => {
  const t = getShellStrings(language);
  const inputRef = useRef<HTMLInputElement>(null);
  const recRef = useRef<any>(null);
  const [query, setQuery] = useState('');
  const [listening, setListening] = useState(false);
  const locale = (SUPPORTED_LANGUAGES.find((l) => l.code === language) || SUPPORTED_LANGUAGES[0]).speechLocale;
  const canListen = typeof window !== 'undefined' && Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  const groups: Array<{ title: string; items: Item[] }> = useMemo(
    () => [
      {
        title: 'Explore',
        items: [
          { id: 'home', label: t.nav.home, desc: 'Your dashboard', icon: Home, hue: 'navy' },
          { id: 'schemes', label: t.nav.schemes, desc: 'Government schemes that fit you', icon: Landmark, hue: 'saffron' },
          { id: 'loans', label: t.nav.loans, desc: 'Compare government and bank loans', icon: IndianRupee, hue: 'teal' },
          { id: 'skills', label: t.nav.skills, desc: 'Training, jobs and career roadmaps', icon: GraduationCap, hue: 'violet' },
          { id: 'enterprise', label: t.nav.enterprise, desc: 'Loans, grants and a plan for your trade', icon: Rocket, hue: 'teal' },
          { id: 'learning', label: 'Learning Hub', desc: 'Lessons with Guru, your AI tutor', icon: BookOpen, hue: 'violet' },
          { id: 'documents', label: 'Documents & certificates', desc: 'The right form and proofs', icon: FileBadge, hue: 'gold' },
        ],
      },
      {
        title: 'Apply',
        items: [
          { id: 'smart_apply', label: t.nav.apply, desc: 'Forms filled from your documents', icon: ScanLine, hue: 'saffron' },
          { id: 'applications', label: t.nav.applications, desc: 'Drafts and saved applications', icon: ClipboardList, hue: 'navy' },
        ],
      },
      {
        title: t.nav.more,
        items: [
          { id: 'voice_studio', label: t.nav.assistant, desc: 'A full voice conversation', icon: Mic, hue: 'saffron' },
          { id: 'ivr', label: 'Phone helpline', desc: 'Phone-style voice menu', icon: PhoneCall, hue: 'navy' },
          { id: 'whatsapp', label: 'WhatsApp assistant', desc: 'Chat-style guidance', icon: MessageSquare, hue: 'navy' },
          { id: 'kiosk', label: 'Kiosk mode', desc: 'Large, simple public screen', icon: Store, hue: 'navy' },
          { id: 'district_map', label: 'District map', desc: 'Training and opportunities near you', icon: MapPin, hue: 'navy' },
        ],
      },
    ],
    [t],
  );

  const matches = useMemo(() => matchPages(query), [query]);
  const best = matches[0];

  useEffect(() => {
    if (!open) return;
    setQuery('');
    const focus = window.setTimeout(() => inputRef.current?.focus(), 60);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(focus);
      document.removeEventListener('keydown', onKey);
      try {
        recRef.current?.stop();
      } catch {}
      setListening(false);
    };
  }, [open, onClose]);

  if (!open) return null;

  const go = (id: ChannelMode) => {
    onNavigate(id);
    onClose();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    go(best || 'voice_studio');
  };

  const listen = () => {
    if (listening) {
      try {
        recRef.current?.stop();
      } catch {}
      return;
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = locale;
    rec.interimResults = true;
    rec.onresult = (ev: any) => setQuery(Array.from(ev.results as ArrayLike<any>).map((r) => r[0].transcript).join(' '));
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    try {
      rec.start();
    } catch {
      setListening(false);
    }
  };

  const searching = query.trim().length > 0;
  let row = 0;

  return (
    <>
      {/* Click-away layer: a faint dim, no heavy overlay */}
      {createPortal(<div className="fixed inset-0 z-30 bg-navy/20 backdrop-blur-[2px]" onMouseDown={onClose} aria-hidden />, document.body)}

      {/* The popover drops from the Menu button */}
      <div
        role="dialog"
        aria-label={MENU_WORD[language]}
        className="app-menu-panel absolute left-0 top-full z-50 mt-3 flex max-h-[calc(100vh-6.5rem)] w-[21rem] max-sm:max-h-[calc(100vh-10.5rem)] max-sm:fixed max-sm:inset-x-3 max-sm:top-[4.25rem] max-sm:mt-0 max-sm:w-auto origin-top-left flex-col overflow-hidden rounded-[28px] border border-white/70 bg-ivory/[0.97] p-2 shadow-lift backdrop-blur-2xl animate-fade-up"
      >
        {/* AI box */}
        <form onSubmit={submit} className="relative flex shrink-0 items-center gap-1.5 rounded-full border border-navy/10 bg-white p-1 shadow-card focus-within:border-violet focus-within:shadow-[0_0_0_4px_rgb(108_92_231/0.18)]">
          <span className="ml-2 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet to-[#8b7df0] text-white">
            <Sparkles className="h-4 w-4" aria-hidden />
          </span>
          <label htmlFor="app-menu-ask" className="sr-only">
            {ASK_PLACEHOLDER[language]}
          </label>
          <input
            id="app-menu-ask"
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={ASK_PLACEHOLDER[language]}
            autoComplete="off"
            className="h-10 min-w-0 flex-1 bg-transparent text-[0.95rem] text-navy outline-none placeholder:text-muted"
            style={{ boxShadow: 'none', outline: 'none' }}
          />
          {canListen && (
            <button
              type="button"
              onClick={listen}
              aria-pressed={listening}
              aria-label={t.orb.listening}
              className={`grid h-11 w-11 shrink-0 place-items-center rounded-full transition-all duration-200 ${listening ? 'animate-orb-listen bg-saffron text-navy shadow-[0_0_0_5px_rgb(255_153_51/0.25)]' : 'text-navy hover:bg-navy-50'}`}
            >
              <Mic className="h-5 w-5" aria-hidden />
            </button>
          )}
        </form>

        {/* Options: one simple list, grouped by thin labels */}
        <div className="mt-1 min-h-0 flex-1 overflow-y-auto overscroll-contain px-0.5 pb-1">
          {groups.map((g) => (
            <div key={g.title} role="group" aria-label={g.title}>
              <p className="px-3 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wider text-muted">{g.title}</p>
              {g.items.map((item) => {
                const active = current === item.id;
                const isBest = item.id === best;
                const dim = searching && matches.length > 0 && !matches.includes(item.id);
                const delay = row++ * 18;
                return (
                  <button
                    key={item.id}
                    onClick={() => go(item.id)}
                    aria-current={active ? 'page' : undefined}
                    style={{ animationDelay: `${delay}ms` }}
                    className={`app-menu-row group flex min-h-11 w-full items-center gap-3 rounded-2xl px-2 py-1.5 text-left transition-colors duration-150 animate-fade-up ${isBest ? 'bg-violet-50 ring-1 ring-violet/40' : active ? 'bg-white shadow-card' : 'hover:bg-white/80'} ${dim ? 'opacity-35' : ''}`}
                  >
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${HUE[item.hue]}`}>
                      <item.icon className="h-[18px] w-[18px]" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1 text-[0.95rem] font-semibold leading-snug text-navy">{item.label}</span>
                    {isBest ? (
                      <kbd className="rounded-md bg-white px-1.5 py-0.5 font-sans text-[11px] font-semibold text-violet-600">Enter</kbd>
                    ) : (
                      active && <Check className="h-4 w-4 shrink-0 text-teal-600" aria-label="Current page" />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
          {searching && !best && (
            <button onClick={() => go('voice_studio')} className="mt-2 flex min-h-11 w-full items-center gap-2 rounded-2xl bg-violet-50 px-3 text-left text-sm font-semibold text-violet-600 ring-1 ring-violet/30">
              <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
              {t.nav.assistant}
              <kbd className="ml-auto rounded-md bg-white px-1.5 py-0.5 font-sans text-[11px]">Enter</kbd>
            </button>
          )}
        </div>

        <button
          onClick={() => {
            onOpenProfile();
            onClose();
          }}
          className="mt-1 flex min-h-11 shrink-0 items-center gap-3 rounded-2xl bg-navy px-2 py-1.5 text-left text-white transition-opacity hover:opacity-90"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/15">
            <User className="h-[18px] w-[18px]" aria-hidden />
          </span>
          <span translate={profileName ? 'no' : undefined} className="min-w-0 flex-1 truncate text-[0.95rem] font-semibold">
            {profileName || t.profile}
          </span>
        </button>
      </div>
    </>
  );
};
