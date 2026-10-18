import React, { useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Compass,
  FileBadge,
  FileSearch,
  GraduationCap,
  Landmark,
  Lock,
  MapPin,
  MessageSquare,
  Pause,
  PhoneCall,
  Play,
  RotateCcw,
  ScanLine,
  Send,
  ShieldCheck,
  Square,
  Store,
  Rocket,
  BookOpen,
} from 'lucide-react';
import { BeneficiaryProfile, ChannelMode, Language, LanguageCode } from '../../types';
import { getShellStrings } from '../../data/uiStrings';
import { useVoiceAssistant } from '../../hooks/useVoiceAssistant';
import type { DraftSummary } from '../../services/autofillApi';
import { VoiceOrb } from '../ui/VoiceOrb';
import { StatusPill } from '../ui/kit';

interface HomePageProps {
  language: LanguageCode;
  langConfig: Language;
  profile: BeneficiaryProfile;
  onNavigate: (mode: ChannelMode) => void;
  onOpenProfile: () => void;
  drafts: DraftSummary[];
  onOpenDraft: (id: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ language, langConfig, profile, onNavigate, onOpenProfile, drafts, onOpenDraft }) => {
  const t = getShellStrings(language);
  const voice = useVoiceAssistant(langConfig, profile, 'UDAAN ONE Home Voice');
  const [typed, setTyped] = useState('');
  const orbRef = useRef<HTMLDivElement>(null);

  const lastReply = [...voice.messages].reverse().find((m) => m.role === 'assistant');
  const busy = voice.state === 'processing';
  const latestDraft = [...drafts].sort((a, b) => b.updatedAt - a.updatedAt)[0];

  const submitTyped = (e: React.FormEvent) => {
    e.preventDefault();
    if (!typed.trim() || busy) return;
    voice.ask(typed);
    setTyped('');
  };

  const capabilities = [
    { icon: Compass, title: t.hero.capabilities[0], body: 'Schemes, training and work that may fit you' },
    { icon: BadgeCheck, title: t.hero.capabilities[1], body: 'Eligibility explained in plain words' },
    { icon: ScanLine, title: t.hero.capabilities[2], body: 'Forms filled from your documents' },
  ];

  const helpTiles: Array<{ id: ChannelMode; icon: React.ElementType; title: string; body: string; onClick?: () => void }> = [
    { id: 'schemes', icon: Landmark, title: t.help.scheme, body: 'Search in your own words, with official sources.' },
    { id: 'documents', icon: FileBadge, title: t.help.document, body: 'PAN, voter ID, passport, certificates — the right form and proofs.' },
    { id: 'enterprise', icon: Rocket, title: t.help.business, body: 'Loans, grants and a plan for your trade.' },
    { id: 'skills', icon: GraduationCap, title: t.help.jobs, body: 'Certified courses and job pathways.' },
    { id: 'learning', icon: BookOpen, title: 'Learn a skill with AI', body: 'Python, computers, trades — lessons and doubt solving.' },
    {
      id: 'schemes',
      icon: BadgeCheck,
      title: t.help.eligibility,
      body: 'Add a few details for a preliminary estimate.',
      onClick: () => {
        onNavigate('schemes');
        onOpenProfile();
      },
    },
  ];

  const accessModes = [
    { id: 'ivr' as ChannelMode, icon: PhoneCall, title: 'Phone helpline', body: 'Call-style menu, no smartphone needed' },
    { id: 'whatsapp' as ChannelMode, icon: MessageSquare, title: 'WhatsApp', body: 'Ask by voice note or text' },
    { id: 'kiosk' as ChannelMode, icon: Store, title: 'Kiosk', body: 'Large buttons for shared devices' },
    { id: 'district_map' as ChannelMode, icon: MapPin, title: 'District map', body: 'Opportunities near you' },
  ];

  return (
    <div className="space-y-16 pb-4 sm:space-y-20">
      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="surface-dark rounded-[28px]" aria-labelledby="hero-h">
        <div className="grid gap-10 px-6 py-10 sm:px-10 sm:py-14 lg:grid-cols-[1.15fr_1fr] lg:gap-14 lg:px-14 lg:py-16">
          <div className="flex flex-col justify-center animate-fade-up">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/12 bg-white/[0.06] px-3 py-1 text-xs font-semibold text-slate-200">
              <span className="h-1.5 w-1.5 rounded-full bg-teal" aria-hidden />
              {t.hero.eyebrow}
            </span>
            <h1 id="hero-h" className="mt-6 text-[2.6rem] font-extrabold leading-[1.04] tracking-[-0.03em] sm:text-6xl lg:text-[4.1rem]">
              {t.hero.title}
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">{t.hero.subtitle}</p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button onClick={() => onNavigate('schemes')} className="btn btn-accent btn-lg h-14 px-6 text-base">
                {t.hero.exploreCta} <ArrowRight className="h-5 w-5" aria-hidden />
              </button>
              <button
                onClick={() => {
                  orbRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  onNavigate('voice_studio');
                }}
                className="btn btn-on-dark btn-lg h-14 px-6 text-base"
              >
                <span className="relative flex h-2.5 w-2.5" aria-hidden>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal opacity-60" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-teal" />
                </span>
                {t.hero.speakCta}
              </button>
            </div>

            <ol className="mt-10 grid gap-4 border-t border-white/10 pt-6 sm:grid-cols-3">
              {capabilities.map((c, i) => (
                <li key={c.title} className="flex gap-3 sm:block">
                  <span className="flex items-center gap-2 text-sm font-bold text-white">
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-white/[0.08] text-teal">
                      <c.icon className="h-4 w-4" aria-hidden />
                    </span>
                    <span>
                      <span className="mr-1 font-mono text-xs text-slate-400">0{i + 1}</span>
                      {c.title}
                    </span>
                  </span>
                  <span className="text-sm text-slate-400 sm:mt-1.5 sm:block">{c.body}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Live assistant preview — fully working voice + text */}
          <div ref={orbRef} className="relative flex flex-col rounded-3xl border border-white/10 bg-white/[0.035] p-5 sm:p-7" aria-label="Talk to UDAAN AI">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="flex items-center gap-2 font-semibold text-slate-200">
                <span className="grid h-6 w-6 place-items-center rounded-md bg-gradient-to-br from-saffron to-teal text-[10px] font-extrabold text-navy" aria-hidden>
                  AI
                </span>
                UDAAN AI · {langConfig.nativeName}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold ${voice.state === 'idle' ? 'bg-white/10 text-slate-300' : 'bg-teal/20 text-teal'}`}
                aria-live="polite"
              >
                <span className={`h-1.5 w-1.5 rounded-full ${voice.state === 'idle' ? 'bg-slate-400' : 'animate-pulse bg-teal'}`} aria-hidden />
                {t.orb[voice.state]}
              </span>
            </div>

            <div className="my-5 flex justify-center">
              <VoiceOrb state={voice.state} onClick={voice.toggleListening} label={voice.state === 'idle' ? t.orb.idle : 'Stop'} size="md" />
            </div>

            <div className="flex min-h-11 flex-wrap items-center justify-center gap-2">
              {voice.state === 'listening' && voice.liveTranscript && (
                <button onClick={voice.finishSpeaking} className="btn btn-success btn-sm">Done speaking</button>
              )}
              {voice.state === 'speaking' && (
                <button onClick={voice.pause} className="btn btn-on-dark btn-sm"><Pause className="h-4 w-4" aria-hidden /> Pause</button>
              )}
              {voice.state === 'paused' && (
                <button onClick={voice.resume} className="btn btn-on-dark btn-sm"><Play className="h-4 w-4" aria-hidden /> Resume</button>
              )}
              {lastReply && (voice.state === 'idle' || voice.state === 'paused') && (
                <button onClick={voice.repeat} className="btn btn-on-dark btn-sm"><RotateCcw className="h-4 w-4" aria-hidden /> Repeat</button>
              )}
              {voice.state !== 'idle' && (
                <button onClick={voice.stop} className="btn btn-on-dark btn-sm"><Square className="h-4 w-4" aria-hidden /> Stop</button>
              )}
              {voice.state === 'idle' && !lastReply && <p className="text-center text-sm text-slate-400">Tap the orb and speak, or type below.</p>}
            </div>

            {voice.state === 'listening' && voice.liveTranscript && (
              <p className="mt-3 rounded-2xl bg-white/[0.06] px-4 py-3 text-sm italic text-slate-200">“{voice.liveTranscript}”</p>
            )}
            {lastReply && (
              <div className="mt-3 rounded-2xl bg-white/[0.06] p-4 animate-fade-up" aria-live="polite">
                <p className="text-[11px] font-bold uppercase tracking-wider text-teal">AI explanation</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-100">{lastReply.content}</p>
              </div>
            )}
            {voice.error && <p className="mt-3 text-center text-sm text-saffron" role="alert">{voice.error}</p>}

            <div className="mt-4 flex flex-wrap gap-2">
              {t.suggestions.slice(0, 3).map((s) => (
                <button
                  key={s}
                  onClick={() => voice.ask(s)}
                  disabled={busy}
                  className="min-h-9 rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-teal/60 hover:text-white disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>

            <form onSubmit={submitTyped} className="mt-4 flex items-center gap-2">
              <label htmlFor="home-ask" className="sr-only">Type your question</label>
              <input
                id="home-ask"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder="Or type your question…"
                className="h-12 min-w-0 flex-1 rounded-xl border border-white/12 bg-white/[0.06] px-4 text-sm text-white placeholder:text-slate-400 focus:border-teal focus:outline-none"
              />
              <button type="submit" disabled={!typed.trim() || busy} className="btn btn-accent h-12 w-12 p-0" aria-label="Send">
                <Send className="h-5 w-5" aria-hidden />
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* ── Continue where you left off ─────────────────── */}
      {latestDraft && (
        <section aria-labelledby="continue-h" className="-mt-8 sm:-mt-10">
          <div className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-teal-50 text-teal-600">
              <FileSearch className="h-6 w-6" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">Continue where you left off</p>
              <h2 id="continue-h" className="mt-0.5 truncate text-lg font-bold text-navy">{latestDraft.schemeName}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                <StatusPill tone={latestDraft.status.code === 'collecting' ? 'warning' : 'success'}>{latestDraft.status.label}</StatusPill>
                <span>
                  {latestDraft.docsHave}/{latestDraft.docsRequired} documents · {latestDraft.missingCount} details missing
                </span>
              </div>
            </div>
            <button onClick={() => onOpenDraft(latestDraft.id)} className="btn btn-primary btn-lg">
              Continue <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </section>
      )}

      {/* ── What would you like help with today? ─────────── */}
      <section aria-labelledby="help-h">
        <h2 id="help-h" className="max-w-2xl text-3xl font-extrabold text-navy sm:text-4xl">{t.help.title}</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-6 lg:grid-rows-2">
          {/* Signature tile: Smart Apply */}
          <button
            onClick={() => onNavigate('smart_apply')}
            className="surface-dark group flex min-h-[18rem] flex-col justify-between rounded-[var(--radius-card)] p-6 text-left transition hover:shadow-lift md:col-span-2 lg:col-span-3 lg:row-span-2 lg:p-8"
          >
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-teal/15 px-3 py-1 text-xs font-bold text-teal">
                <ScanLine className="h-3.5 w-3.5" aria-hidden /> Smart Apply & Autofill
              </span>
              <span className="mt-5 block text-2xl font-extrabold leading-tight sm:text-3xl">{t.help.apply}</span>
              <span className="mt-3 block max-w-md text-sm leading-relaxed text-slate-300">
                Upload or scan your documents once. We read the details, fill the form, ask only what is missing — and you check everything before downloading.
              </span>
            </div>
            {/* Document-reading motif: a page with lines being read */}
            <div className="mt-8 flex items-end justify-between gap-6">
              <div className="relative h-28 w-24 shrink-0 overflow-hidden rounded-xl border border-white/15 bg-white/[0.06] p-3" aria-hidden>
                {[70, 90, 55, 80, 40].map((w, i) => (
                  <span key={i} className="mb-2 block h-1.5 rounded-full bg-white/25" style={{ width: `${w}%` }} />
                ))}
                <span className="absolute inset-x-0 top-0 h-1/2 animate-scan bg-gradient-to-b from-transparent via-teal/35 to-transparent" />
              </div>
              <span className="btn btn-accent btn-lg">
                Start now <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </span>
            </div>
          </button>

          {helpTiles.map((tile, i) => (
            <button
              key={tile.title}
              onClick={tile.onClick || (() => onNavigate(tile.id))}
              className={`card group flex min-h-[8.5rem] flex-col p-5 text-left transition hover:-translate-y-0.5 hover:shadow-lift animate-fade-up lg:col-span-1`}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <span className="flex w-full items-start justify-between">
                <span className={`grid h-11 w-11 place-items-center rounded-xl ${i % 2 === 0 ? 'bg-saffron-50 text-saffron-600' : 'bg-teal-50 text-teal-600'}`}>
                  <tile.icon className="h-5 w-5" aria-hidden />
                </span>
                <ArrowUpRight className="h-5 w-5 text-muted transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-navy" aria-hidden />
              </span>
              <span className="mt-4 font-bold text-navy">{tile.title}</span>
              <span className="mt-1 text-sm text-muted">{tile.body}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ── Trust commitments (true of the product, not marketing claims) ── */}
      <section aria-labelledby="trust-h" className="grid gap-10 lg:grid-cols-[1fr_2fr]">
        <div>
          <p className="eyebrow">Built on trust</p>
          <h2 id="trust-h" className="mt-3 text-3xl font-extrabold text-navy">Help you can rely on</h2>
          <p className="mt-3 text-muted">Clear about what is known, what is AI-explained and what still needs official confirmation.</p>
        </div>
        <ol className="grid gap-px overflow-hidden rounded-[var(--radius-card)] border border-line bg-line sm:grid-cols-3">
          {[
            { icon: Landmark, title: 'Official sources first', body: 'Every scheme links to its official portal. Eligibility is always shown as a preliminary estimate.' },
            { icon: Lock, title: 'Your documents stay yours', body: 'Originals are discarded after reading, Aadhaar is masked, details are encrypted — delete them any time.' },
            { icon: ShieldCheck, title: 'Nothing submitted without you', body: 'You review and approve every form. UDAAN ONE never claims an application is submitted or approved.' },
          ].map((c, i) => (
            <li key={c.title} className="bg-white p-6">
              <span className="font-mono text-xs text-muted">0{i + 1}</span>
              <c.icon className="mt-4 h-6 w-6 text-teal-600" aria-hidden />
              <p className="mt-3 font-bold text-navy">{c.title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{c.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ── Access for everyone ─────────────────────────── */}
      <section aria-labelledby="access-heading">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Reach without barriers</p>
            <h2 id="access-heading" className="mt-3 text-3xl font-extrabold text-navy">Use UDAAN ONE your way</h2>
          </div>
          <button onClick={() => onNavigate('voice_studio')} className="btn btn-primary">
            {t.nav.assistant} <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {accessModes.map((m) => (
            <button key={m.id} onClick={() => onNavigate(m.id)} className="card flex items-center gap-4 p-4 text-left transition hover:shadow-lift">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-navy-50 text-navy">
                <m.icon className="h-5 w-5" aria-hidden />
              </span>
              <span>
                <span className="block font-bold text-navy">{m.title}</span>
                <span className="block text-sm text-muted">{m.body}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      <p className="mx-auto max-w-3xl text-center text-xs leading-relaxed text-muted">
        UDAAN ONE gives guidance and preliminary eligibility estimates only. Final eligibility, benefits and approvals are decided by the
        responsible government department. Always confirm details on the official portal linked with each scheme.
      </p>
    </div>
  );
};
