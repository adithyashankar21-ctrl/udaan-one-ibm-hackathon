import React, { useEffect, useRef, useState } from 'react';
import { AudioLines, Bot, CheckCircle2, Loader2, Mic, MicOff, Send, Square } from 'lucide-react';
import type { SmartApplyStrings } from '../../data/smartApplyStrings';
import type { LanguageCode } from '../../types';
import { VOICE_COMMANDS, useDictation, useVoiceTurns } from './media';
import { prefetchTranslations, spokenIn } from '../../services/translate';

export interface Question {
  key: string;
  label: string;
  labelHi?: string;
  question?: string;
  questionHi?: string;
  type: string;
  options?: string[];
  issues?: string[];
}

interface Props {
  t: SmartApplyStrings;
  language: LanguageCode;
  speechLocale: string;
  questions: Question[];
  /** Sends one answer; resolves to an error message, or null when it was accepted. */
  onAnswer: (key: string, text: string, via: 'typed' | 'voice') => Promise<string | null>;
  compact?: boolean;
  dark?: boolean;
  /** Hands-free mode: called when every question is answered (e.g. to move on to documents). */
  onVoiceFinished?: () => void;
  /** Hands-free mode: the person asked to show a document instead of answering. */
  onScanRequest?: () => void;
  /** Change this number to start hands-free mode from outside. */
  voiceStart?: number;
  /** Said before the first question when started from outside (e.g. the scheme name). */
  voiceIntro?: string;
}

/** Fixed phrases of the voice conversation. Questions themselves come from the form. */
const PHRASES = {
  en: {
    start: 'I will read each question. Answer when the microphone turns on. You can say skip, repeat or stop at any time.',
    ok: 'Got it.',
    again: 'Sorry, I did not catch that.',
    paused: 'Voice paused. Tap Fill by voice to continue.',
    stopped: 'Stopped.',
    allDone: 'That is all the questions.',
    yesNo: 'Say yes or no.',
    say: 'You can say',
    forExample: 'For example',
    or: 'or',
  },
  hi: {
    start: 'अब एक-एक करके सवाल पढ़े जाएँगे। माइक चालू होने पर जवाब दीजिए। कभी भी छोड़ो, दोबारा या रुको बोल सकते हैं।',
    ok: 'ठीक है।',
    again: 'माफ़ कीजिए, समझ में नहीं आया।',
    paused: 'आवाज़ रोकी गई। जारी रखने के लिए Fill by voice दबाइए।',
    stopped: 'रोक दिया।',
    allDone: 'सारे सवाल पूरे हो गए।',
    yesNo: 'हाँ या नहीं बोलिए।',
    say: 'आप बोल सकते हैं',
    forExample: 'जैसे',
    or: 'या',
  },
};

/** How to answer a question by voice, spoken after it. */
function answerHint(q: Question, p: (typeof PHRASES)['en']): string {
  const opts = q.options || [];
  if (opts.length === 2 && /^yes$/i.test(opts[0]) && /^no$/i.test(opts[1])) return p.yesNo;
  if (opts.length > 0 && opts.length <= 5) return `${p.say}: ${opts.slice(0, -1).join(', ')} ${p.or} ${opts[opts.length - 1]}.`;
  if (opts.length > 5) return `${p.forExample}: ${opts.slice(0, 3).map((o) => o.replace(/\s*\(.*\)/, '')).join(', ')}.`;
  return '';
}

interface Turn {
  role: 'bot' | 'user';
  text: string;
  error?: boolean;
}

/**
 * Asks only for what is genuinely missing, one question at a time, chat-style.
 * Works by typing, tapping an option or speaking (browser speech recognition).
 */
export const MissingQuestions: React.FC<Props> = (props) => {
  const { t, language, speechLocale, questions, onAnswer, compact, dark } = props;
  const [skipped, setSkipped] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  const pending = questions.filter((q) => !skipped.includes(q.key));
  const current: Question | undefined = pending[0] || questions[0];
  const hi = language === 'hi';

  const ask = (q: Question) => (hi && q.questionHi ? q.questionHi : q.question || q.label);
  const { onVoiceFinished, onScanRequest, voiceStart, voiceIntro } = props;
  const lastAsked = useRef<string | null>(null);
  const phrases = hi ? PHRASES.hi : PHRASES.en;
  const voice = useVoiceTurns(speechLocale);
  /** Speaks in the chosen language: English parts are translated for languages without written phrases. */
  const say = async (...parts: string[]) => voice.say(await spokenIn(language, ...parts));
  const [handsFree, setHandsFree] = useState(false);
  const handsFreeRef = useRef(false);
  const [voiceTick, setVoiceTick] = useState(0);
  const prefixRef = useRef('');
  const missesRef = useRef(0);
  const submitRef = useRef<(value: string, via: 'typed' | 'voice') => Promise<string | null>>(async () => null);

  const setHands = (on: boolean) => {
    handsFreeRef.current = on;
    setHandsFree(on);
    if (!on) voice.cancel();
  };

  useEffect(() => {
    if (voiceStart) {
      prefixRef.current = turns.length > 1 ? '' : `${voiceIntro ? `${voiceIntro} ` : ''}${phrases.start} `;
      setHands(true);
      setVoiceTick((n) => n + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceStart]);

  // One voice turn: speak the question, listen, act on the answer. Re-runs for each new question.
  useEffect(() => {
    if (!handsFree) return;
    let alive = true;
    // Skipped questions are not asked again by voice
    const current = pending[0];
    (async () => {
      const prefix = prefixRef.current;
      prefixRef.current = '';
      if (!current) {
        await say(prefix, phrases.allDone);
        if (alive && handsFreeRef.current) {
          setHands(false);
          onVoiceFinished?.();
        }
        return;
      }
      const issue = current.issues?.[0];
      if (!(await say(prefix, ask(current), issue ? `${issue}.` : '', answerHint(current, phrases))) || !alive) return;
      const heard = await voice.listen(current.options ? 7000 : 10000);
      if (heard === null || !alive || !handsFreeRef.current) return;
      if (!heard) {
        if (++missesRef.current >= 2) {
          missesRef.current = 0;
          setHands(false);
          say(phrases.paused);
          return;
        }
        prefixRef.current = `${phrases.again} `;
        return setVoiceTick((n) => n + 1);
      }
      missesRef.current = 0;
      // Commands only count as short utterances, so "next to the temple" is still an answer
      const wordCount = heard.trim().split(/\s+/).length;
      const command = wordCount <= 3;
      if (command && VOICE_COMMANDS.stop.test(heard)) {
        setHands(false);
        say(phrases.stopped);
        return;
      }
      if (command && VOICE_COMMANDS.repeat.test(heard)) return setVoiceTick((n) => n + 1);
      if (wordCount <= 2 && VOICE_COMMANDS.skip.test(heard)) {
        setSkipped((sk) => [...sk, current.key]);
        return setVoiceTick((n) => n + 1);
      }
      if (command && onScanRequest && VOICE_COMMANDS.scan.test(heard)) {
        setHands(false);
        return onScanRequest();
      }
      // Set before saving: a saved answer moves to the next question, which starts a new turn
      prefixRef.current = `${phrases.ok} `;
      const error = await submitRef.current(heard, 'voice');
      if (!alive || !handsFreeRef.current) return;
      prefixRef.current = error ? `${error}. ` : `${phrases.ok} `;
      setVoiceTick((n) => n + 1);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handsFree, pending[0]?.key, voiceTick]);

  // Translate every question and fixed phrase ahead, so spoken turns do not wait for it
  useEffect(() => {
    prefetchTranslations([...questions.flatMap((q) => [ask(q), answerHint(q, phrases)]), ...Object.values(phrases)], language);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions.map((q) => q.key).join(), language]);

  useEffect(() => {
    if (current && lastAsked.current !== current.key) {
      lastAsked.current = current.key;
      const issue = current.issues?.[0];
      setTurns((ts) => [...ts, { role: 'bot', text: issue ? `${ask(current)} (${issue})` : ask(current) }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.key]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [turns.length]);

  const submit = async (value: string, via: 'typed' | 'voice') => {
    if (!current || !value.trim() || busy) return null;
    setBusy(true);
    setTurns((ts) => [...ts, { role: 'user', text: current.key === 'aadhaar' ? value.replace(/\d(?=\d{4})/g, 'X') : value }]);
    setText('');
    const error = await onAnswer(current.key, value, via);
    if (error) setTurns((ts) => [...ts, { role: 'bot', text: error, error: true }]);
    setBusy(false);
    return error;
  };
  submitRef.current = async (value, via) => (await submit(value, via)) ?? null;

  const dictation = useDictation(speechLocale, (heard) => submit(heard, 'voice'));

  const shell = dark ? 'bg-navy-800 text-white' : 'bg-white';
  if (questions.length === 0) {
    return (
      <div className={`flex items-center gap-2 rounded-2xl p-4 text-sm font-semibold ${dark ? 'bg-emerald-900/40 text-emerald-200' : 'bg-green-50 text-green'}`}>
        <CheckCircle2 className="h-5 w-5" aria-hidden /> {t.questionsDone}
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border ${dark ? 'border-white/10' : 'border-line'} ${shell}`}>
      {voice.supported && (
        <div className={`flex flex-wrap items-center gap-3 border-b p-3 ${dark ? 'border-white/10' : 'border-line'}`}>
          {handsFree ? (
            <>
              <span className={`inline-flex items-center gap-2 text-sm font-semibold ${dark ? 'text-teal' : 'text-teal-600'}`} role="status">
                <AudioLines className={`h-5 w-5 ${voice.phase === 'listening' ? 'animate-pulse text-coral' : ''}`} aria-hidden />
                {voice.phase === 'listening' ? 'Listening…' : voice.phase === 'speaking' ? 'Speaking…' : busy ? 'Saving…' : 'Voice on'}
              </span>
              {voice.interim && <span className={`min-w-0 flex-1 truncate text-sm italic ${dark ? 'text-slate-300' : 'text-muted'}`}>“{voice.interim}”</span>}
              <button onClick={() => { setHands(false); }} className="btn btn-outline btn-sm ml-auto">
                <Square className="h-3.5 w-3.5" aria-hidden /> Stop voice
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  prefixRef.current = turns.length > 1 ? '' : `${phrases.start} `;
                  missesRef.current = 0;
                  setHands(true);
                  setVoiceTick((n) => n + 1);
                }}
                className="btn btn-accent btn-sm"
              >
                <AudioLines className="h-4 w-4" aria-hidden /> Fill by voice
              </button>
              <span className={`text-xs ${dark ? 'text-slate-400' : 'text-muted'}`}>Hands-free: each question is read out and your spoken answer is filled in.</span>
            </>
          )}
        </div>
      )}
      <div className={`${compact ? 'max-h-60' : 'max-h-96'} space-y-2 overflow-y-auto p-4`} aria-live="polite">
        {turns.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              translate={m.role === 'user' ? 'no' : undefined}
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                m.role === 'user'
                  ? 'bg-green text-white'
                  : m.error
                    ? 'bg-coral-50 text-coral-600'
                    : dark
                      ? 'bg-white/10 text-slate-100'
                      : 'bg-ivory text-navy'
              }`}
            >
              {m.role === 'bot' && <Bot className="mr-1 inline h-3.5 w-3.5 opacity-70" aria-hidden />}
              {m.text}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {current && (
        <div className={`border-t p-3 ${dark ? 'border-white/10' : 'border-line'}`}>
          <p className={`mb-2 text-xs ${dark ? 'text-slate-400' : 'text-muted'}`}>
            {hi && current.labelHi ? current.labelHi : current.label} · {pending.length} {t.questionsLeft}
          </p>
          {current.options && current.options.length <= 6 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {current.options.map((o) => (
                <button key={o} onClick={() => submit(o, 'typed')} disabled={busy} className="min-h-11 rounded-xl border border-green/40 px-3 text-sm font-semibold text-green hover:bg-green-50 disabled:opacity-50">
                  {o}
                </button>
              ))}
            </div>
          )}
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              submit(text, 'typed');
            }}
          >
            {current.options && current.options.length > 6 ? (
              <select value={text} onChange={(e) => setText(e.target.value)} aria-label={current.label} className="h-12 min-w-0 flex-1 rounded-xl border border-line bg-white px-3 text-sm text-navy">
                <option value="">—</option>
                {current.options.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            ) : (
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={t.typeAnswer}
                aria-label={ask(current)}
                inputMode={['mobile', 'pincode', 'account', 'money', 'number', 'aadhaar'].includes(current.type) ? 'numeric' : undefined}
                className="h-12 min-w-0 flex-1 rounded-xl border border-line bg-white px-3 text-sm text-navy"
              />
            )}
            {dictation.supported && (
              <button
                type="button"
                onClick={dictation.listening ? dictation.stop : dictation.start}
                aria-label={dictation.listening ? t.listening : t.speak}
                className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${dictation.listening ? 'animate-pulse bg-coral text-white' : 'bg-saffron text-navy'}`}
              >
                {dictation.listening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </button>
            )}
            <button type="submit" disabled={busy || !text.trim()} aria-label={t.send} className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-navy text-white disabled:opacity-40">
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            </button>
          </form>
          {pending.length > 1 && (
            <button onClick={() => setSkipped((s) => [...s, current.key])} className={`mt-2 text-xs font-semibold underline ${dark ? 'text-slate-400' : 'text-muted'}`}>
              {t.skip}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
