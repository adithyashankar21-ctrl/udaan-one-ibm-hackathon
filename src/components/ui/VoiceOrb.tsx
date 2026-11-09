import React from 'react';
import { Mic, Square, Loader2, Volume2, Pause } from 'lucide-react';
import { VoiceState } from '../../hooks/useVoiceAssistant';

interface VoiceOrbProps {
  state: VoiceState;
  onClick: () => void;
  size?: 'md' | 'lg';
  label: string;
}

/** Glow colour per state: saffron while it is your turn, teal while it answers (verified/calm). */
const GLOW: Record<VoiceState, string> = {
  idle: 'bg-saffron/35',
  listening: 'bg-saffron/55',
  processing: 'bg-navy-700/30',
  speaking: 'bg-teal/45',
  paused: 'bg-navy/15',
};

const CORE: Record<VoiceState, string> = {
  idle: 'from-[#ffb366] to-saffron',
  listening: 'from-[#ffb366] to-saffron',
  processing: 'from-[#ffb366] to-saffron',
  speaking: 'from-[#7ff0df] to-teal',
  paused: 'from-slate-200 to-slate-300',
};

/**
 * The UDAAN ONE voice button: a raised, softly glowing disc. Idle breathes slowly;
 * listening pulses with expanding rings and a live waveform.
 */
export const VoiceOrb: React.FC<VoiceOrbProps> = ({ state, onClick, size = 'lg', label }) => {
  const dim = size === 'lg' ? 'h-64 w-64 sm:h-72 sm:w-72' : 'h-48 w-48';
  const active = state === 'listening' || state === 'speaking';
  const ring = state === 'speaking' ? 'border-teal/50' : 'border-saffron/60';

  return (
    <div className={`relative ${dim} flex items-center justify-center`}>
      {/* Soft glow */}
      <div className={`absolute inset-6 rounded-full ${GLOW[state]} blur-3xl transition-colors duration-300`} aria-hidden />
      {/* Expanding rings while listening / speaking */}
      {active && (
        <>
          <span className={`absolute inset-10 rounded-full border ${ring} animate-ring`} aria-hidden />
          <span className={`absolute inset-10 rounded-full border ${ring} animate-ring [animation-delay:0.8s]`} aria-hidden />
          <span className={`absolute inset-10 rounded-full border ${ring} animate-ring [animation-delay:1.6s]`} aria-hidden />
        </>
      )}
      {/* Static halo ring */}
      <span className="absolute inset-8 rounded-full border border-white/20" aria-hidden />

      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        aria-pressed={state !== 'idle'}
        className={`relative flex h-[56%] w-[56%] items-center justify-center rounded-full bg-gradient-to-b ${CORE[state]} text-navy shadow-[0_0_0_1px_rgb(255_255_255/0.35)_inset,0_-6px_12px_rgb(255_255_255/0.35)_inset,0_16px_32px_-8px_rgb(255_153_51/0.6),0_32px_56px_-16px_rgb(0_0_0/0.45)] transition-transform duration-200 ease-out hover:scale-[1.04] active:scale-95 focus-visible:outline-offset-8 ${
          state === 'listening' ? 'animate-orb-listen' : 'animate-orb-breathe'
        }`}
      >
        {state === 'processing' ? (
          <Loader2 className="h-10 w-10 animate-spin" strokeWidth={1.75} />
        ) : state === 'speaking' ? (
          <Volume2 className="h-10 w-10" strokeWidth={1.75} />
        ) : state === 'paused' ? (
          <Pause className="h-10 w-10" strokeWidth={1.75} />
        ) : state === 'listening' ? (
          <Square className="h-9 w-9 fill-navy" strokeWidth={1.75} />
        ) : (
          <Mic className="h-10 w-10" strokeWidth={1.75} />
        )}
      </button>

      {(state === 'listening' || state === 'speaking') && (
        <span className="absolute bottom-3 flex h-7 items-center gap-1 text-white/80" aria-hidden>
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className="wave-bar" style={{ animationDelay: `${i * 0.12}s` }} />
          ))}
        </span>
      )}
    </div>
  );
};
