import React, { useEffect, useRef, useState } from 'react';
import { Bot, CheckCircle2, Loader2, Mic, MicOff, Send } from 'lucide-react';
import type { SmartApplyStrings } from '../../data/smartApplyStrings';
import type { LanguageCode } from '../../types';
import { useDictation } from './media';

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
export const MissingQuestions: React.FC<Props> = ({ t, language, speechLocale, questions, onAnswer, compact, dark }) => {
  const [skipped, setSkipped] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  const pending = questions.filter((q) => !skipped.includes(q.key));
  const current = pending[0] || questions[0];
  const hi = language === 'hi';

  const ask = (q: Question) => (hi && q.questionHi ? q.questionHi : q.question || q.label);
  const lastAsked = useRef<string | null>(null);

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
    if (!current || !value.trim() || busy) return;
    setBusy(true);
    setTurns((ts) => [...ts, { role: 'user', text: current.key === 'aadhaar' ? value.replace(/\d(?=\d{4})/g, 'X') : value }]);
    setText('');
    const error = await onAnswer(current.key, value, via);
    if (error) setTurns((ts) => [...ts, { role: 'bot', text: error, error: true }]);
    setBusy(false);
  };

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
      <div className={`${compact ? 'max-h-60' : 'max-h-96'} space-y-2 overflow-y-auto p-4`} aria-live="polite">
        {turns.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
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
