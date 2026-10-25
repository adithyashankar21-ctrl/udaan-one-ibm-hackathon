import React from 'react';
import { ArrowLeft, Check, MapPin, MessageSquare, Mic, PhoneCall, Store } from 'lucide-react';
import type { ChannelMode } from '../../types';

type AccessMode = 'kiosk' | 'whatsapp' | 'ivr' | 'district_map';

const MODES: Record<AccessMode, { title: string; tagline: string; icon: React.ElementType; points: string[]; badge: string }> = {
  kiosk: {
    title: 'Kiosk mode',
    tagline: 'Large, simple screens for shared devices at a CSC, panchayat office or training centre.',
    icon: Store,
    badge: 'For shared public devices',
    points: ['Tap big buttons or speak', 'Answers read out loud', 'Nothing stays on the device'],
  },
  whatsapp: {
    title: 'WhatsApp assistant',
    tagline: 'Ask by voice note or text in a familiar chat — schemes, training, loans and applications.',
    icon: MessageSquare,
    badge: 'Demo of the chat channel',
    points: ['Send a voice note or type', 'Photos of documents fill forms', 'Replies in your language'],
  },
  ivr: {
    title: 'Phone helpline',
    tagline: 'A phone-style voice menu for people without a smartphone — press keys or just speak.',
    icon: PhoneCall,
    badge: 'Works on any phone',
    points: ['Choose a language by key', 'Speak your question', 'Fill an application on the call'],
  },
  district_map: {
    title: 'District opportunity map',
    tagline: 'Traditional crafts, growing trades and nearby training for each district.',
    icon: MapPin,
    badge: 'Livelihoods by district',
    points: ['Search any district', 'See local crafts and demand', 'Get a roadmap for your district'],
  },
};

const SWITCH: Array<{ id: ChannelMode; label: string; icon: React.ElementType }> = [
  { id: 'voice_studio', label: 'Talk to UDAAN AI', icon: Mic },
  { id: 'ivr', label: 'Phone helpline', icon: PhoneCall },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
  { id: 'kiosk', label: 'Kiosk', icon: Store },
  { id: 'district_map', label: 'District map', icon: MapPin },
];

export const isAccessMode = (m: ChannelMode): m is AccessMode => m in MODES;

/** The frame of an access mode: a header that explains it, a switcher, and the mode itself on the light design. */
export const ModeShell: React.FC<{ mode: AccessMode; onNavigate: (m: ChannelMode) => void; children: React.ReactNode; after?: React.ReactNode }> = ({ mode, onNavigate, children, after }) => {
  const m = MODES[mode];
  return (
    <div className="space-y-6">
      <header className="mode-hero p-5 sm:p-8">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-teal/10 blur-2xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-saffron/15 blur-2xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-navy text-white shadow-card">
              <m.icon className="h-7 w-7" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="eyebrow">Ways to use UDAAN ONE · {m.badge}</p>
              <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">{m.title}</h1>
              <p className="mt-2 max-w-2xl text-base leading-relaxed text-muted">{m.tagline}</p>
            </div>
          </div>
          <button onClick={() => onNavigate('home')} className="btn btn-outline shrink-0">
            <ArrowLeft className="h-4 w-4" aria-hidden /> Back to home
          </button>
        </div>
        <ul className="relative mt-5 flex flex-wrap gap-2">
          {m.points.map((p) => (
            <li key={p} className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 text-sm font-medium text-navy ring-1 ring-line">
              <Check className="h-4 w-4 text-teal-600" aria-hidden /> {p}
            </li>
          ))}
        </ul>
      </header>

      <nav aria-label="Other ways to use UDAAN ONE" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {SWITCH.map((s) => (
          <button
            key={s.id}
            onClick={() => onNavigate(s.id)}
            aria-current={s.id === mode ? 'page' : undefined}
            className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition ${
              s.id === mode ? 'border-navy bg-navy text-white' : 'border-line bg-white text-navy hover:border-navy/40'
            }`}
          >
            <s.icon className="h-4 w-4" aria-hidden /> {s.label}
          </button>
        ))}
      </nav>

      <div className="mode-light space-y-6">
        {children}
        {after}
      </div>
    </div>
  );
};
