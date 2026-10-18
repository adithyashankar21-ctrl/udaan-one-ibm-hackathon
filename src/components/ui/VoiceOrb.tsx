import React from 'react';
import { Mic, Square, Loader2, Volume2, Pause } from 'lucide-react';
import { VoiceState } from '../../hooks/useVoiceAssistant';

interface VoiceOrbProps {
  state: VoiceState;
  onClick: () => void;
  size?: 'md' | 'lg';
  label: string;
}

const STATE_GLOW: Record<VoiceState, string> = {
  idle: 'from-saffron/70 via-ivory to-teal/60',
  listening: 'from-saffron via-saffron/60 to-teal/70',
  processing: 'from-navy-700 via-saffron/50 to-teal/60',
  speaking: 'from-teal via-teal/60 to-saffron/70',
  paused: 'from-slate-300 via-ivory to-slate-300',
};

/** The UDAAN ONE voice orb: a layered, softly lit sphere that reflects the assistant's state. */
export const VoiceOrb: React.FC<VoiceOrbProps> = ({ state, onClick, size = 'lg', label }) => {
  const dim = size === 'lg' ? 'w-56 h-56 sm:w-64 sm:h-64' : 'w-36 h-36';
  const active = state === 'listening' || state === 'speaking';

  return (
    <div className={`relative ${dim} flex items-center justify-center`}>
      {/* Ambient halo */}
      <div className={`absolute inset-0 rounded-full bg-gradient-to-br ${STATE_GLOW[state]} blur-2xl opacity-60`} aria-hidden />
      {/* Expanding rings while listening / speaking */}
      {active && (
        <>
          <span className="absolute inset-4 rounded-full border-2 border-saffron/50 animate-ring" aria-hidden />
          <span className="absolute inset-4 rounded-full border-2 border-teal/40 animate-ring [animation-delay:1.2s]" aria-hidden />
        </>
      )}

      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        aria-pressed={state !== 'idle'}
        className={`relative w-[78%] h-[78%] rounded-full overflow-hidden shadow-lift ring-1 ring-white/60 transition-transform duration-300 hover:scale-[1.02] focus-visible:outline-offset-4 ${
          state === 'listening' ? 'animate-orb-listen' : 'animate-orb-breathe'
        }`}
      >
        {/* Layered sphere */}
        <span className={`absolute inset-0 bg-gradient-to-br ${STATE_GLOW[state]}`} aria-hidden />
        <span className="absolute -top-1/4 -left-1/4 w-3/4 h-3/4 rounded-full bg-white/70 blur-2xl" aria-hidden />
        <span className="absolute -bottom-1/4 -right-1/4 w-3/4 h-3/4 rounded-full bg-teal/35 blur-2xl" aria-hidden />
        <span className="absolute inset-0 rounded-full ring-8 ring-inset ring-white/25" aria-hidden />

        <span className="relative flex h-full w-full flex-col items-center justify-center gap-2 text-navy">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/85 shadow-card backdrop-blur-sm">
            {state === 'processing' ? (
              <Loader2 className="h-7 w-7 animate-spin text-navy" />
            ) : state === 'speaking' ? (
              <Volume2 className="h-7 w-7 text-teal-600" />
            ) : state === 'paused' ? (
              <Pause className="h-7 w-7 text-navy" />
            ) : state === 'listening' ? (
              <Square className="h-6 w-6 fill-saffron text-saffron" />
            ) : (
              <Mic className="h-7 w-7 text-navy" />
            )}
          </span>
          {(state === 'listening' || state === 'speaking') && (
            <span className={`flex h-7 items-center gap-1 ${state === 'listening' ? 'text-saffron-600' : 'text-teal-600'}`} aria-hidden>
              {[0, 1, 2, 3, 4].map((i) => (
                <span key={i} className="wave-bar" style={{ animationDelay: `${i * 0.12}s` }} />
              ))}
            </span>
          )}
        </span>
      </button>
    </div>
  );
};
