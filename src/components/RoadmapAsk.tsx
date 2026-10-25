import React, { useState } from 'react';
import { Loader2, Map as MapIcon, Mic, MicOff, Send, UserRound } from 'lucide-react';
import { useDictation } from './smartapply/media';
import { ROADMAP_IDEAS } from '../services/roadmaps';

/**
 * Ask for a career roadmap in your own words — typed, spoken or tapped. `onAsk('')` makes one
 * from the profile alone.
 */
export const RoadmapAsk: React.FC<{
  speechLocale: string;
  busy?: boolean;
  onAsk: (request: string) => void;
  /** Smaller, for use inside the roadmap itself. */
  compact?: boolean;
}> = ({ speechLocale, busy, onAsk, compact }) => {
  const [text, setText] = useState('');
  const dictation = useDictation(speechLocale, (heard) => {
    setText(heard);
    onAsk(heard);
  });
  const submit = (value = text) => {
    if (busy) return;
    onAsk(value.trim());
  };

  return (
    <div className={compact ? 'space-y-3' : 'card space-y-4 p-5 sm:p-6'}>
      {!compact && (
        <div className="flex items-start gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-saffron to-teal text-navy">
            <MapIcon className="h-6 w-6" aria-hidden />
          </span>
          <div>
            <p className="eyebrow">Career roadmap</p>
            <h2 className="mt-1 text-xl font-extrabold text-navy sm:text-2xl">Where do you want to get to?</h2>
            <p className="mt-1 text-sm text-muted">Say or type any goal — a job, a trade, a business or what to do after school. You get a step-by-step plan with courses, jobs and support.</p>
          </div>
        </div>
      )}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) submit();
        }}
      >
        <label htmlFor={compact ? 'roadmap-ask-compact' : 'roadmap-ask'} className="sr-only">
          Your career goal
        </label>
        <input
          id={compact ? 'roadmap-ask-compact' : 'roadmap-ask'}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. I want to become a nurse"
          className="field h-12 min-w-0 flex-1"
          disabled={busy}
        />
        {dictation.supported && (
          <button
            type="button"
            onClick={dictation.listening ? dictation.stop : dictation.start}
            disabled={busy}
            className={`btn h-12 w-12 shrink-0 p-0 ${dictation.listening ? 'bg-coral text-white' : 'btn-primary'}`}
            aria-label={dictation.listening ? 'Stop listening' : 'Say your goal'}
          >
            {dictation.listening ? <MicOff className="h-5 w-5" aria-hidden /> : <Mic className="h-5 w-5" aria-hidden />}
          </button>
        )}
        <button type="submit" disabled={busy || !text.trim()} className="btn btn-accent h-12 shrink-0 px-4" aria-label="Make my roadmap">
          {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Send className="h-5 w-5" aria-hidden />}
          <span className="hidden sm:inline">{busy ? 'Making…' : 'Make roadmap'}</span>
        </button>
      </form>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Ideas">
        {ROADMAP_IDEAS.slice(0, compact ? 3 : 6).map((idea) => (
          <button
            key={idea}
            onClick={() => {
              setText(idea);
              submit(idea);
            }}
            disabled={busy}
            className="rounded-full border border-line bg-white px-3 py-1.5 text-sm text-navy transition hover:border-teal/50 disabled:opacity-50"
          >
            {idea}
          </button>
        ))}
        <button onClick={() => submit('')} disabled={busy} className="inline-flex items-center gap-1 rounded-full border border-teal/40 bg-teal-50 px-3 py-1.5 text-sm font-semibold text-teal-600 disabled:opacity-50">
          <UserRound className="h-3.5 w-3.5" aria-hidden /> From my profile
        </button>
      </div>
    </div>
  );
};
