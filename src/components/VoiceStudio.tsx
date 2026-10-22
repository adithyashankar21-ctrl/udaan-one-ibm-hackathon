import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Circle,
  HelpCircle,
  Mic,
  Paperclip,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Send,
  Sparkles,
  Square,
  Trash2,
  UserRound,
} from 'lucide-react';
import { BeneficiaryProfile, LanguageCode, LivelihoodAnalysis } from '../types';
import { SUPPORTED_LANGUAGES } from '../data/languages';
import { getShellStrings } from '../data/uiStrings';
import { useVoiceAssistant } from '../hooks/useVoiceAssistant';
import { aiService, lastChatMeta } from '../services/aiService';
import { SchemeResultCard, schemesMentioned } from './assistant/SchemeResultCard';
import { Dialog, Stepper } from './ui/kit';

interface VoiceStudioProps {
  currentLanguage: LanguageCode;
  onLanguageChange: (lang: LanguageCode) => void;
  userProfile: BeneficiaryProfile;
  onUpdateProfile: (profile: Partial<BeneficiaryProfile>) => void;
  onGenerateRoadmap: () => void;
  onOpenKaushalPatra: () => void;
  isGeneratingRoadmap: boolean;
  roadmap: LivelihoodAnalysis | null;
  onApply?: (schemeId: string) => void;
  onOpenSmartApply?: () => void;
}

// Every language is a one-tap chip (the row scrolls sideways on small screens)
const QUICK_LANGS: LanguageCode[] = SUPPORTED_LANGUAGES.map((l) => l.code);

const AssistantMark: React.FC<{ state: string }> = ({ state }) => (
  <span className="relative grid h-11 w-11 shrink-0 place-items-center" aria-hidden>
    <span className={`absolute inset-0 rounded-2xl bg-gradient-to-br from-saffron via-saffron/70 to-teal ${state !== 'idle' ? 'animate-pulse' : ''}`} />
    <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-navy text-[11px] font-extrabold tracking-wide text-white">AI</span>
  </span>
);

const Waveform: React.FC<{ tone: string }> = ({ tone }) => (
  <span className={`flex h-6 items-center gap-[3px] ${tone}`} aria-hidden>
    {[0, 1, 2, 3, 4, 5, 6].map((i) => (
      <span key={i} className="wave-bar" style={{ animationDelay: `${i * 0.09}s`, width: 3 }} />
    ))}
  </span>
);

export const VoiceStudio: React.FC<VoiceStudioProps> = ({
  currentLanguage,
  onLanguageChange,
  userProfile,
  onUpdateProfile,
  onGenerateRoadmap,
  onOpenKaushalPatra,
  isGeneratingRoadmap,
  roadmap,
  onApply,
  onOpenSmartApply,
}) => {
  const langConfig = SUPPORTED_LANGUAGES.find((l) => l.code === currentLanguage) || SUPPORTED_LANGUAGES[0];
  const t = getShellStrings(currentLanguage);
  const [typed, setTyped] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);
  const [failed, setFailed] = useState<number[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  // Learn profile details from what the user says (name, district, trade…)
  const learnFromUser = async (text: string) => {
    const extracted = await aiService.extractProfileFromText(text, userProfile);
    const useful = Object.fromEntries(Object.entries(extracted).filter(([, v]) => v !== '' && v !== null && v !== undefined));
    if (Object.keys(useful).length > 0) onUpdateProfile(useful);
  };

  const voice = useVoiceAssistant(langConfig, userProfile, 'AI Voice Studio', { onUserText: learnFromUser });
  const busy = voice.state === 'processing';

  // Mark replies that came from the offline fallback so they can be retried
  useEffect(() => {
    const last = voice.messages[voice.messages.length - 1];
    if (last?.role === 'assistant' && lastChatMeta.fallback && Date.now() - lastChatMeta.at < 15000) {
      setFailed((f) => (f.includes(voice.messages.length - 1) ? f : [...f, voice.messages.length - 1]));
    }
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [voice.messages.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const submitTyped = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!typed.trim() || busy) return;
    voice.ask(typed);
    setTyped('');
  };

  const mentioned = useMemo(() => voice.messages.map((m) => (m.role === 'assistant' ? schemesMentioned(m.content) : [])), [voice.messages]);
  const lastSchemes = [...mentioned].reverse().find((x) => x.length) || [];
  const lastUser = [...voice.messages].reverse().find((m) => m.role === 'user');
  const lastReply = [...voice.messages].reverse().find((m) => m.role === 'assistant');

  // Suggestions follow the conversation: starters, then scheme follow-ups, then next steps
  const suggestions = voice.messages.length === 0
    ? t.suggestions
    : lastSchemes.length
      ? [`How do I apply for ${lastSchemes[0].name.split(' (')[0]}?`, `What documents do I need for ${lastSchemes[0].name.split(' (')[0]}?`, 'Am I likely to be eligible?']
      : ['What should I do next?', 'Explain that more simply', 'Which schemes fit me?'];

  const captured = [
    { label: 'Name', value: userProfile.name },
    { label: 'District', value: userProfile.district ? `${userProfile.district}${userProfile.state ? ', ' + userProfile.state : ''}` : '' },
    { label: 'Education', value: userProfile.education },
    { label: 'Trade / skill', value: userProfile.traditionalTrade || userProfile.currentOccupation },
    { label: 'Goal', value: userProfile.goal },
  ];

  const journey = [
    { label: 'Discover', done: voice.messages.length > 0 },
    { label: 'Understand', done: mentioned.some((x) => x.length > 0) },
    { label: 'Apply', done: false },
  ];
  const journeyStep = journey.findIndex((s) => !s.done);

  const stateLabel = t.orb[voice.state];
  const micActive = voice.state === 'listening';

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      {/* ── Conversation workspace ───────────────────────── */}
      <section className="card flex min-h-[72vh] flex-col overflow-hidden p-0" aria-label="Conversation with UDAAN AI">
        {/* Identity + language */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <AssistantMark state={voice.state} />
            <div>
              <h1 className="text-lg font-extrabold text-navy">UDAAN AI</h1>
              <p className="flex items-center gap-1.5 text-xs text-muted" aria-live="polite">
                <span className={`h-1.5 w-1.5 rounded-full ${voice.state === 'idle' ? 'bg-green' : 'animate-pulse bg-teal'}`} aria-hidden />
                {voice.state === 'idle' ? `Ready · ${langConfig.nativeName}` : stateLabel}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {voice.messages.length > 0 && (
              <button onClick={() => { voice.reset(); setFailed([]); }} className="btn btn-ghost btn-sm text-muted">
                <Trash2 className="h-4 w-4" aria-hidden /> Clear
              </button>
            )}
            <button onClick={() => setHelpOpen(true)} className="btn btn-ghost btn-sm" aria-label="How to use UDAAN AI">
              <HelpCircle className="h-4 w-4" aria-hidden /> Help
            </button>
          </div>
          <div className="-mx-1 flex w-full gap-1.5 overflow-x-auto px-1 pb-0.5" role="radiogroup" aria-label="Conversation language" translate="no">
            {QUICK_LANGS.map((code) => {
              const l = SUPPORTED_LANGUAGES.find((x) => x.code === code);
              if (!l) return null;
              const active = code === currentLanguage;
              return (
                <button
                  key={code}
                  role="radio"
                  aria-checked={active}
                  onClick={() => onLanguageChange(code)}
                  className={`h-9 shrink-0 rounded-full border px-3.5 text-sm font-semibold transition ${active ? 'border-navy bg-navy text-white' : 'border-line bg-white text-navy hover:border-navy-700/40'}`}
                >
                  {l.nativeName}
                </button>
              );
            })}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto bg-ivory/60 px-4 py-6 sm:px-6" aria-live="polite">
          {voice.messages.length === 0 ? (
            <div className="mx-auto flex max-w-lg flex-col items-center py-8 text-center">
              <AssistantMark state="idle" />
              <h2 className="mt-4 text-2xl font-extrabold text-navy">{t.help.title}</h2>
              <p className="mt-2 text-sm text-muted">
                Speak or type in your language. I explain schemes, skills and next steps — and can fill application forms with you.
              </p>
              <button onClick={voice.toggleListening} className="btn btn-accent btn-lg mt-6" disabled={!voice.supported}>
                <Mic className="h-5 w-5" aria-hidden /> Tap and speak
              </button>
              {!voice.supported && <p className="mt-2 text-xs text-muted">Voice input is not supported in this browser — please type below.</p>}
            </div>
          ) : (
            <ol className="mx-auto max-w-3xl space-y-5">
              {voice.messages.map((m, i) =>
                m.role === 'user' ? (
                  <li key={i} className="flex justify-end gap-2.5">
                    <p translate="no" className="max-w-[85%] rounded-2xl rounded-br-md bg-navy px-4 py-2.5 text-sm leading-relaxed text-white">{m.content}</p>
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-saffron-50 text-saffron-600" aria-hidden>
                      <UserRound className="h-4 w-4" />
                    </span>
                  </li>
                ) : (
                  <li key={i} className="flex gap-2.5">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-navy text-[10px] font-extrabold text-white" aria-hidden>AI</span>
                    <div className="min-w-0 max-w-[92%] space-y-3">
                      <div className={`rounded-2xl rounded-tl-md border bg-white px-4 py-3 ${failed.includes(i) ? 'border-coral/40' : 'border-line'}`}>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-teal-600">{failed.includes(i) ? 'AI service unavailable' : 'AI explanation'}</p>
                        <p className="mt-1 text-sm leading-relaxed text-navy">{m.content}</p>
                        {failed.includes(i) && lastUser && (
                          <button onClick={() => voice.ask(lastUser.content)} disabled={busy} className="btn btn-outline btn-sm mt-3">
                            <RefreshCw className="h-4 w-4" aria-hidden /> Try again
                          </button>
                        )}
                      </div>
                      {mentioned[i]?.map((s) => (
                        <SchemeResultCard key={s.id} scheme={s} profile={userProfile} onApply={onApply} />
                      ))}
                    </div>
                  </li>
                )
              )}
              {busy && (
                <li className="flex gap-2.5" aria-label="UDAAN AI is thinking">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-navy text-[10px] font-extrabold text-white" aria-hidden>AI</span>
                  <div className="w-64 space-y-2 rounded-2xl border border-line bg-white p-4">
                    <span className="skeleton block h-3 w-5/6" />
                    <span className="skeleton block h-3 w-2/3" />
                  </div>
                </li>
              )}
            </ol>
          )}
          <div ref={endRef} />
        </div>

        {/* Composer */}
        <div className="border-t border-line bg-white px-4 py-4 sm:px-6">
          <div className="mx-auto max-w-3xl">
            <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-0.5">
              {suggestions.map((s) => (
                <button key={s} onClick={() => voice.ask(s)} disabled={busy} className="min-h-9 shrink-0 rounded-full border border-line bg-ivory px-3.5 text-xs font-semibold text-navy transition hover:border-teal disabled:opacity-50">
                  {s}
                </button>
              ))}
            </div>

            {/* Voice state bar */}
            {voice.state !== 'idle' && (
              <div className="mb-3 flex flex-wrap items-center gap-3 rounded-2xl bg-navy px-4 py-2.5 text-white animate-fade-up" role="status">
                {voice.state === 'listening' && <Waveform tone="text-saffron" />}
                {voice.state === 'speaking' && <Waveform tone="text-teal" />}
                <span className="min-w-0 flex-1 truncate text-sm">
                  {voice.state === 'listening' ? voice.liveTranscript || t.orb.listening : stateLabel}
                </span>
                {voice.state === 'listening' && voice.liveTranscript && (
                  <button onClick={voice.finishSpeaking} className="btn btn-success btn-sm">Done speaking</button>
                )}
                {voice.state === 'speaking' && (
                  <button onClick={voice.pause} className="btn btn-on-dark btn-sm"><Pause className="h-4 w-4" aria-hidden /> Pause</button>
                )}
                {voice.state === 'paused' && (
                  <button onClick={voice.resume} className="btn btn-on-dark btn-sm"><Play className="h-4 w-4" aria-hidden /> Resume</button>
                )}
                <button onClick={voice.stop} className="btn btn-on-dark btn-sm"><Square className="h-4 w-4" aria-hidden /> Stop</button>
              </div>
            )}
            {voice.error && <p className="mb-2 text-sm text-coral-600" role="alert">{voice.error}</p>}

            <form onSubmit={submitTyped} className="flex items-end gap-2 rounded-2xl border border-line bg-white p-2 focus-within:border-teal-600 focus-within:shadow-[0_0_0_3px_rgb(32_184_167/0.18)]">
              <button type="button" onClick={onOpenSmartApply} className="btn btn-ghost h-11 w-11 shrink-0 p-0" aria-label="Upload documents for an application" title="Upload documents (Smart Apply)">
                <Paperclip className="h-5 w-5" aria-hidden />
              </button>
              <label htmlFor="studio-ask" className="sr-only">Type your question</label>
              <textarea
                id="studio-ask"
                rows={1}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    submitTyped();
                  }
                }}
                placeholder="Ask about schemes, skills or applications…"
                className="max-h-32 min-h-11 flex-1 resize-none bg-transparent px-1 py-2.5 text-base text-navy placeholder:text-[#8a93a5] focus:outline-none"
              />
              {lastReply && voice.state === 'idle' && (
                <button type="button" onClick={voice.repeat} className="btn btn-ghost h-11 w-11 shrink-0 p-0" aria-label="Repeat the last answer aloud">
                  <RotateCcw className="h-5 w-5" aria-hidden />
                </button>
              )}
              <button
                type="button"
                onClick={voice.toggleListening}
                disabled={!voice.supported}
                aria-pressed={micActive}
                aria-label={voice.state === 'idle' ? 'Speak' : 'Stop voice'}
                className={`btn h-11 w-11 shrink-0 p-0 ${micActive ? 'bg-coral text-white' : voice.state === 'idle' ? 'btn-outline' : 'btn-primary'}`}
              >
                {voice.state === 'idle' ? <Mic className="h-5 w-5" aria-hidden /> : <Square className="h-4 w-4" aria-hidden />}
              </button>
              <button type="submit" disabled={!typed.trim() || busy} className="btn btn-accent h-11 w-11 shrink-0 p-0" aria-label="Send">
                <Send className="h-5 w-5" aria-hidden />
              </button>
            </form>
            <p className="mt-2 text-center text-[11px] text-muted">AI explanations can be wrong. Scheme facts link to official sources; eligibility always needs official confirmation.</p>
          </div>
        </div>
      </section>

      {/* ── Side rail ───────────────────────────────────── */}
      <aside className="space-y-6">
        <section className="card p-5" aria-labelledby="journey-h">
          <h2 id="journey-h" className="font-bold text-navy">Your progress</h2>
          <div className="mt-4">
            <Stepper steps={journey} current={journeyStep === -1 ? 2 : journeyStep} />
          </div>
          <button onClick={onOpenSmartApply} className="btn btn-primary mt-5 w-full">
            Start an application
          </button>
        </section>

        <section className="card p-5" aria-labelledby="cap-h">
          <h2 id="cap-h" className="font-bold text-navy">What I have understood</h2>
          <p className="mt-1 text-xs text-muted">From our conversation. Check and correct it in your profile.</p>
          <ul className="mt-4 space-y-2.5">
            {captured.map((c) => (
              <li key={c.label} className="flex items-start gap-2.5 text-sm">
                {c.value ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green" aria-hidden /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" aria-hidden />}
                <span className="w-24 shrink-0 font-semibold text-muted">{c.label}</span>
                <span className={c.value ? 'font-semibold text-navy' : 'text-slate-400'}>{c.value || 'Not yet shared'}</span>
              </li>
            ))}
          </ul>
          <button
            onClick={roadmap ? onOpenKaushalPatra : onGenerateRoadmap}
            disabled={isGeneratingRoadmap}
            className="btn btn-outline mt-5 w-full"
          >
            <Sparkles className="h-4 w-4 text-saffron-600" aria-hidden />
            {isGeneratingRoadmap ? 'Preparing your roadmap…' : roadmap ? 'Open my roadmap' : 'Create my roadmap'}
          </button>
        </section>

      </aside>

      <Dialog open={helpOpen} onClose={() => setHelpOpen(false)} title="How to use UDAAN AI">
        <ol className="space-y-3 text-sm text-navy">
          {[
            'Choose your language at the top.',
            'Tap the microphone and speak. Take your time — I wait until you stop.',
            'Listen to the answer, or read it on screen. Use Pause, Repeat or Stop at any time.',
            'When a scheme is mentioned, a card shows its official source and lets you start the application.',
            'Prefer not to speak? Type your question in the box.',
          ].map((tip, i) => (
            <li key={tip} className="flex gap-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-saffron text-xs font-bold text-navy">{i + 1}</span>
              {tip}
            </li>
          ))}
        </ol>
      </Dialog>
    </div>
  );
};
