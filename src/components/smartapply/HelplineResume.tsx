import React, { useState } from 'react';
import { Delete, KeyRound, LogOut, PhoneCall } from 'lucide-react';
import type { Language, LanguageCode } from '../../types';
import { getSmartApplyStrings } from '../../data/smartApplyStrings';
import { autofillApi, type HelplineView } from '../../services/autofillApi';
import { MissingQuestions } from './MissingQuestions';

/**
 * Continue a Smart Apply application "by phone": reference + PIN, then answer the
 * remaining questions. The helpline never shows stored personal details.
 */
export const HelplineResume: React.FC<{ language: LanguageCode; langConfig: Language }> = ({ language, langConfig }) => {
  const t = getSmartApplyStrings(language);
  const [reference, setReference] = useState('UD-');
  const [pin, setPin] = useState('');
  const [field, setField] = useState<'ref' | 'pin'>('ref');
  const [token, setToken] = useState<string | null>(null);
  const [view, setView] = useState<HelplineView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const press = (k: string) => {
    if (field === 'pin') setPin((p) => (k === 'del' ? p.slice(0, -1) : (p + k).slice(0, 6)));
    else setReference((r) => (k === 'del' ? (r.length > 3 ? r.slice(0, -1) : r) : (r + k).slice(0, 12)));
  };

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { token } = await autofillApi.helpline.resume(reference.trim(), pin);
      setToken(token);
      setView(await autofillApi.helpline.draft(token));
      setPin('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (token && view) {
    return (
      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-6" aria-labelledby="hl-h">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-teal">Helpline · Ref {view.reference}</p>
            <h2 id="hl-h" className="mt-1 text-xl font-extrabold text-white">{view.schemeName}</h2>
            <p className="mt-1 text-sm text-slate-300">
              {view.status.label} · {view.completion}% of required details filled
              {view.conflicts > 0 ? ` · ${view.conflicts} to confirm in the app` : ''}
            </p>
          </div>
          <button
            onClick={() => {
              setToken(null);
              setView(null);
            }}
            className="btn btn-on-dark btn-sm"
          >
            <LogOut className="h-4 w-4" aria-hidden /> End call
          </button>
        </div>
        <p className="mt-3 text-xs text-slate-400">For your privacy the helpline does not read out details you already gave.</p>
        <div className="mt-4">
          <MissingQuestions
            t={t}
            language={language}
            speechLocale={langConfig.speechLocale}
            questions={view.missing}
            dark
            compact
            onAnswer={async (key, text) => {
              try {
                const res = await autofillApi.helpline.answer(token, key, text);
                setView(res);
                return res.ok ? res.error || null : res.error || 'Not understood — please try again.';
              } catch (err: any) {
                return err.message;
              }
            }}
          />
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-6" aria-labelledby="hl-login-h">
      <h2 id="hl-login-h" className="flex items-center gap-2 text-lg font-extrabold text-white">
        <PhoneCall className="h-5 w-5 text-teal" aria-hidden /> Continue a Smart Apply application
      </h2>
      <p className="mt-1 text-sm text-slate-300">Enter your application reference and the PIN you set in Smart Apply.</p>
      <form onSubmit={login} className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto]">
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-slate-200">
            Reference
            <input
              value={reference}
              onFocus={() => setField('ref')}
              onChange={(e) => setReference(e.target.value.toUpperCase().slice(0, 12))}
              className="mt-1 h-12 w-full rounded-xl border border-white/15 bg-white/[0.07] px-3 font-mono text-lg tracking-wider text-white focus:border-teal focus:outline-none"
              autoComplete="off"
            />
          </label>
          <label className="block text-sm font-semibold text-slate-200">
            PIN
            <input
              value={pin}
              type="password"
              inputMode="numeric"
              onFocus={() => setField('pin')}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="mt-1 h-12 w-full rounded-xl border border-white/15 bg-white/[0.07] px-3 font-mono text-lg tracking-[0.4em] text-white focus:border-teal focus:outline-none"
              autoComplete="off"
            />
          </label>
          {error && <p className="text-sm font-semibold text-saffron" role="alert">{error}</p>}
          <button disabled={busy || reference.length < 10 || pin.length < 4} className="btn btn-accent btn-lg w-full">
            <KeyRound className="h-5 w-5" aria-hidden /> Continue
          </button>
        </div>
        {/* Phone keypad for people used to IVR menus */}
        <div className="grid w-full grid-cols-3 gap-2 sm:w-56" role="group" aria-label={`Keypad — typing into ${field === 'pin' ? 'PIN' : 'reference'}`}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '-', '0', 'del'].map((k) => (
            <button
              type="button"
              key={k}
              onClick={() => press(k)}
              aria-label={k === 'del' ? 'Delete' : k}
              className="grid h-12 place-items-center rounded-xl bg-white/[0.07] text-lg font-bold text-white hover:bg-white/15"
            >
              {k === 'del' ? <Delete className="h-5 w-5" aria-hidden /> : k}
            </button>
          ))}
        </div>
      </form>
    </section>
  );
};
