import React, { useEffect, useState } from 'react';
import { KeyRound, Mail, Mic, MicOff, Smartphone } from 'lucide-react';
import { SUPPORTED_LANGUAGES } from '../data/languages';
import { spokenDigits } from '../data/languageTools';
import { authEnabled, supabase, type Session } from '../services/supabase';
import type { LanguageCode } from '../types';
import { AutoTranslate } from './AutoTranslate';
import { useDictation } from './smartapply/media';
import { Spinner } from './ui/kit';

/**
 * Sign-in before the app (when Supabase is set up): a one-time code sent to the person's mobile
 * or email, typed or spoken. Without Supabase settings the app opens straight away, as before.
 */

const LANG_KEY = 'udaan.lang';

/** The language chosen last time (on this device). */
export function savedLanguage(): LanguageCode {
  try {
    const code = localStorage.getItem(LANG_KEY) as LanguageCode | null;
    if (code && SUPPORTED_LANGUAGES.some((l) => l.code === code)) return code;
  } catch {}
  return 'en';
}

export function saveLanguage(code: LanguageCode) {
  try {
    localStorage.setItem(LANG_KEY, code);
  } catch {}
}

/** "ramesh at gmail dot com" → "ramesh@gmail.com" */
const spokenEmail = (heard: string) =>
  heard
    .toLowerCase()
    .replace(/\s+(at the rate|at)\s+/g, '@')
    .replace(/\s+(dot)\s+/g, '.')
    .replace(/\s+/g, '');

export const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null | undefined>(authEnabled ? undefined : null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (!authEnabled || session) return <>{children}</>;
  if (session === undefined) {
    return (
      <div className="grid min-h-screen place-items-center bg-ivory">
        <Spinner className="h-8 w-8" label="Loading" />
      </div>
    );
  }
  return <SignIn />;
};

const SignIn: React.FC = () => {
  const [language, setLanguage] = useState<LanguageCode>(savedLanguage);
  const langConfig = SUPPORTED_LANGUAGES.find((l) => l.code === language) || SUPPORTED_LANGUAGES[0];
  const [method, setMethod] = useState<'email' | 'phone'>('email');
  const [contact, setContact] = useState('');
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waitUntil, setWaitUntil] = useState(0);
  const [, tick] = useState(0);
  const [listeningFor, setListeningFor] = useState<'contact' | 'code' | null>(null);

  const dictation = useDictation(langConfig.speechLocale, (heard) => {
    if (listeningFor === 'code') setCode((spokenDigits(heard) ?? heard.replace(/\D/g, '')).slice(0, 10));
    else if (method === 'phone') setContact((spokenDigits(heard) ?? heard.replace(/\D/g, '')).slice(-10));
    else setContact(spokenEmail(heard));
    setListeningFor(null);
  });

  useEffect(() => {
    if (waitUntil <= Date.now()) return;
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [waitUntil]);

  const chooseLanguage = (code: LanguageCode) => {
    setLanguage(code);
    saveLanguage(code);
  };

  const target = () => (method === 'phone' ? `+91${contact.replace(/\D/g, '').slice(-10)}` : contact.trim().toLowerCase());
  const contactValid = method === 'phone' ? /^[6-9]\d{9}$/.test(contact.replace(/\D/g, '').slice(-10)) : /^\S+@\S+\.\S+$/.test(contact.trim());

  const sendCode = async () => {
    if (!supabase || !contactValid) return setError(method === 'phone' ? 'Enter a 10-digit mobile number starting with 6, 7, 8 or 9.' : 'Enter a valid email address.');
    setBusy(true);
    setError(null);
    const to = target();
    const { error: err } = method === 'phone' ? await supabase.auth.signInWithOtp({ phone: to }) : await supabase.auth.signInWithOtp({ email: to, options: { shouldCreateUser: true } });
    setBusy(false);
    if (err) {
      setError(
        /provider|sms|twilio|phone.*(disabled|not enabled)/i.test(err.message)
          ? 'Sign-in by mobile is not set up yet. Please use your email for now.'
          : /rate|seconds|too many/i.test(err.message)
            ? 'Too many codes asked for. Please wait a minute and try again.'
            : /fetch|network/i.test(err.message)
              ? 'Could not reach the sign-in service. Please check your internet connection and try again.'
              : err.message
      );
      return;
    }
    setSentTo(to);
    setCode('');
    setWaitUntil(Date.now() + 60_000);
  };

  const verify = async () => {
    if (!supabase || !sentTo) return;
    const token = code.replace(/\D/g, '');
    if (token.length < 6) return setError('Enter the code from the message.');
    setBusy(true);
    setError(null);
    const { error: err } = method === 'phone' ? await supabase.auth.verifyOtp({ phone: sentTo, token, type: 'sms' }) : await supabase.auth.verifyOtp({ email: sentTo, token, type: 'email' });
    setBusy(false);
    // On success the gate opens by itself (onAuthStateChange)
    if (err) setError(/expired|invalid/i.test(err.message) ? 'That code is wrong or has expired. Check it, or ask for a new code.' : err.message);
  };

  const mic = (field: 'contact' | 'code', name: string) =>
    dictation.supported && (
      <button
        type="button"
        onClick={() => {
          if (dictation.listening) {
            dictation.stop();
            setListeningFor(null);
          } else {
            setListeningFor(field);
            dictation.start();
          }
        }}
        className={`btn h-14 w-14 shrink-0 p-0 ${dictation.listening && listeningFor === field ? 'bg-coral text-white' : 'btn-outline'}`}
        aria-label={dictation.listening && listeningFor === field ? 'Stop listening' : `Say your ${name}`}
      >
        {dictation.listening && listeningFor === field ? <MicOff className="h-5 w-5" aria-hidden /> : <Mic className="h-5 w-5" aria-hidden />}
      </button>
    );

  const wait = Math.max(0, Math.ceil((waitUntil - Date.now()) / 1000));

  return (
    <div className="min-h-screen bg-ivory px-4 py-8 sm:py-14">
      <AutoTranslate language={language} />
      <div className="mx-auto w-full max-w-md">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-navy text-lg font-extrabold text-white" aria-hidden>
            U1
          </span>
          <div>
            <p className="text-xl font-extrabold text-navy">UDAAN ONE</p>
            <p className="text-xs text-muted">AI for Opportunity. Technology for All.</p>
          </div>
        </div>

        <div className="card mt-6 p-5 sm:p-7">
          <h1 className="text-2xl font-extrabold text-navy">Sign in</h1>
          <p className="mt-1 text-sm text-muted">We send a one-time code. No password to remember.</p>

          <div className="mt-5 flex flex-wrap gap-1.5" translate="no">
            {SUPPORTED_LANGUAGES.map((l) => (
              <button
                key={l.code}
                onClick={() => chooseLanguage(l.code)}
                aria-pressed={l.code === language}
                className={`min-h-9 rounded-full border px-3 text-xs font-semibold transition ${l.code === language ? 'border-navy bg-navy text-white' : 'border-line bg-white text-navy hover:border-teal'}`}
              >
                {l.nativeName}
              </button>
            ))}
          </div>

          {!sentTo ? (
            <>
              <div className="mt-5 grid grid-cols-2 gap-2" role="tablist">
                {(['email', 'phone'] as const).map((m) => (
                  <button
                    key={m}
                    role="tab"
                    aria-selected={method === m}
                    onClick={() => {
                      setMethod(m);
                      setContact('');
                      setError(null);
                    }}
                    className={`btn btn-lg ${method === m ? 'btn-primary' : 'btn-outline'}`}
                  >
                    {m === 'email' ? <Mail className="h-5 w-5" aria-hidden /> : <Smartphone className="h-5 w-5" aria-hidden />}
                    {m === 'email' ? 'Email' : 'Mobile'}
                  </button>
                ))}
              </div>
              <label htmlFor="auth-contact" className="mt-5 block text-sm font-semibold text-navy">
                {method === 'email' ? 'Your email address' : 'Your mobile number'}
              </label>
              <div className="mt-1 flex gap-2">
                {method === 'phone' && <span className="grid h-14 place-items-center rounded-xl border border-line bg-white px-3 font-semibold text-navy">+91</span>}
                <input
                  id="auth-contact"
                  translate="no"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendCode()}
                  type={method === 'email' ? 'email' : 'tel'}
                  inputMode={method === 'email' ? 'email' : 'numeric'}
                  autoComplete={method === 'email' ? 'email' : 'tel-national'}
                  placeholder={method === 'email' ? 'name@example.com' : '98765 43210'}
                  className="h-14 w-full min-w-0 rounded-xl border border-line bg-white px-4 text-lg text-navy focus:border-teal-600 focus:outline-none"
                />
                {mic('contact', method === 'email' ? 'email' : 'mobile number')}
              </div>
              <button onClick={sendCode} disabled={busy} className="btn btn-accent btn-lg mt-5 w-full">
                {busy ? <Spinner className="h-5 w-5" /> : <KeyRound className="h-5 w-5" aria-hidden />} Send code
              </button>
            </>
          ) : (
            <>
              <p className="mt-5 text-sm text-navy">
                We sent a code to <strong translate="no">{sentTo}</strong>.{' '}
                <button
                  onClick={() => {
                    setSentTo(null);
                    setError(null);
                  }}
                  className="font-semibold text-teal-600 hover:underline"
                >
                  Change
                </button>
              </p>
              <label htmlFor="auth-code" className="mt-4 block text-sm font-semibold text-navy">
                Code
              </label>
              <div className="mt-1 flex gap-2">
                <input
                  id="auth-code"
                  translate="no"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  onKeyDown={(e) => e.key === 'Enter' && verify()}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  className="h-14 w-full min-w-0 rounded-xl border border-line bg-white px-4 text-center text-2xl font-bold tracking-[0.3em] text-navy focus:border-teal-600 focus:outline-none"
                />
                {mic('code', 'code')}
              </div>
              <button onClick={verify} disabled={busy} className="btn btn-success btn-lg mt-5 w-full">
                {busy ? <Spinner className="h-5 w-5" /> : null} Sign in
              </button>
              <button onClick={sendCode} disabled={busy || wait > 0} className="btn btn-ghost btn-sm mt-2 w-full">
                {wait > 0 ? `Send a new code in ${wait}s` : 'Send a new code'}
              </button>
            </>
          )}

          {error && (
            <p role="alert" className="mt-4 rounded-xl bg-coral-50 p-3 text-sm text-coral-600">
              {error}
            </p>
          )}
        </div>
        <p className="mt-4 text-center text-xs text-muted">Your profile and applications are kept with your account, so you can continue on any phone or computer.</p>
      </div>
    </div>
  );
};
