import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, BookOpen, Check, ClipboardList, FileBadge, GraduationCap, Home, IndianRupee, Landmark, MapPin, MessageSquare, Mic, PhoneCall, Rocket, ScanLine, Search, Sparkles, Store, User, X } from 'lucide-react';
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
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focus = window.setTimeout(() => inputRef.current?.focus(), 60);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(focus);
      document.body.style.overflow = prevOverflow;
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
  const bestItem = groups.flatMap((g) => g.items).find((i) => i.id === best);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy/50 backdrop-blur-md sm:items-start sm:p-6 sm:pt-[7vh]" onMouseDown={onClose} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={MENU_WORD[language]}
        onMouseDown={(e) => e.stopPropagation()}
        className="app-menu-panel flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-[32px] border border-white/60 bg-ivory/90 shadow-lift backdrop-blur-2xl animate-fade-up sm:max-h-[86vh] sm:rounded-[32px]"
      >
        {/* AI box */}
        <div className="relative shrink-0 overflow-hidden px-5 pb-5 pt-5 sm:px-8 sm:pt-7">
          <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-violet/20 blur-3xl" aria-hidden />
          <div className="pointer-events-none absolute -left-10 -top-24 h-48 w-48 rounded-full bg-saffron/25 blur-3xl" aria-hidden />
          <div className="relative flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 font-display text-lg font-semibold text-navy">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-violet-50 text-violet-600">
                <Sparkles className="h-4 w-4" aria-hidden />
              </span>
              {MENU_WORD[language]}
            </p>
            <button onClick={onClose} className="grid h-11 w-11 place-items-center rounded-full border border-navy/10 bg-white text-navy transition-colors hover:border-navy/30" aria-label="Close">
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
          <form onSubmit={submit} className="relative mt-4 flex items-center gap-2 rounded-full border border-navy/10 bg-white p-1.5 shadow-card focus-within:border-violet focus-within:shadow-[0_0_0_4px_rgb(108_92_231/0.18)]">
            <Search className="ml-3 h-5 w-5 shrink-0 text-muted" aria-hidden />
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
              className="h-11 min-w-0 flex-1 bg-transparent text-base text-navy outline-none placeholder:text-muted"
              style={{ boxShadow: 'none', outline: 'none' }}
            />
            {canListen && (
              <button
                type="button"
                onClick={listen}
                aria-pressed={listening}
                aria-label={t.orb.listening}
                className={`grid h-11 w-11 shrink-0 place-items-center rounded-full transition-all duration-200 ${listening ? 'animate-orb-listen bg-saffron text-navy shadow-[0_0_0_6px_rgb(255_153_51/0.25)]' : 'bg-navy-50 text-navy hover:bg-ivory-200'}`}
              >
                <Mic className="h-5 w-5" aria-hidden />
              </button>
            )}
            <button type="submit" disabled={!searching} className="btn btn-accent h-11 w-11 shrink-0 p-0 disabled:opacity-40" aria-label="Go">
              <ArrowRight className="h-5 w-5" aria-hidden />
            </button>
          </form>
          {searching && (
            <p className="relative mt-3 flex items-center gap-2 text-sm text-muted" aria-live="polite">
              <Sparkles className="h-4 w-4 shrink-0 text-violet-600" aria-hidden />
              {bestItem ? (
                <span>
                  <span className="font-semibold text-navy">{bestItem.label}</span> · Enter
                </span>
              ) : (
                <span>
                  <span className="font-semibold text-navy">{t.nav.assistant}</span> · Enter
                </span>
              )}
            </p>
          )}
        </div>

        {/* Everything in the app */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 sm:px-8">
          {groups.map((g) => (
            <section key={g.title} className="mt-4 first:mt-0" aria-label={g.title}>
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">{g.title}</h2>
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {g.items.map((item) => {
                  const active = current === item.id;
                  const isMatch = matches.includes(item.id);
                  const dim = searching && matches.length > 0 && !isMatch;
                  return (
                    <li key={item.id}>
                      <button
                        onClick={() => go(item.id)}
                        aria-current={active ? 'page' : undefined}
                        className={`group flex min-h-[4.5rem] w-full items-center gap-3 rounded-2xl border p-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card ${
                          item.id === best
                            ? 'border-violet bg-white shadow-[0_0_0_3px_rgb(108_92_231/0.2)]'
                            : active
                              ? 'border-saffron/60 bg-white shadow-card'
                              : 'border-navy/[0.07] bg-white/80 hover:bg-white'
                        } ${dim ? 'opacity-40' : ''}`}
                      >
                        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${HUE[item.hue]}`}>
                          <item.icon className="h-5 w-5" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5 text-[0.95rem] font-semibold leading-snug text-navy">
                            {item.label}
                            {active && <Check className="h-4 w-4 shrink-0 text-teal-600" aria-label="Current page" />}
                          </span>
                          <span className="mt-0.5 block text-sm leading-snug text-muted">{item.desc}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}

          <button
            onClick={() => {
              onOpenProfile();
              onClose();
            }}
            className="mt-4 flex min-h-[4.5rem] w-full items-center gap-3 rounded-2xl bg-navy p-3 text-left text-white transition-transform duration-200 hover:-translate-y-0.5"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/15">
              <User className="h-5 w-5" aria-hidden />
            </span>
            <span translate={profileName ? 'no' : undefined} className="min-w-0 flex-1 truncate font-semibold">
              {profileName || t.profile}
            </span>
            <ArrowRight className="h-5 w-5 shrink-0 text-white/70" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
};
