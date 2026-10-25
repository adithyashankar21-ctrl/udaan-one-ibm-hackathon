import React, { useEffect, useRef, useState } from 'react';
import { AudioLines, CheckCircle2, ChevronDown, Mic, MicOff, ShieldCheck, UserRound } from 'lucide-react';
import { PROFILE_FIELD_MAP, type ProfileKey } from '../data/autofillSchema';
import { SUPPORTED_LANGUAGES } from '../data/languages';
import { getSmartApplyStrings } from '../data/smartApplyStrings';
import { autofillApi, type SessionState } from '../services/autofillApi';
import { spokenIn } from '../services/translate';
import type { LanguageCode } from '../types';
import { VOICE_COMMANDS, useDictation, useVoiceTurns, spokenYesNo } from './smartapply/media';
import { Spinner } from './ui/kit';

/**
 * First-visit profile window: the person chooses a language, agrees to how their details are
 * kept, and fills their profile — by typing or by voice. The core details are required; the
 * rest can be added now or later. Every application then starts from this profile.
 */

/** Needed before entering the app. */
export const CORE_FIELDS: ProfileKey[] = ['fullName', 'mobile', 'dateOfBirth', 'gender', 'district', 'state'];

/** Asked next, all optional, grouped the way forms ask for them. */
const MORE_SECTIONS: Array<{ title: string; keys: ProfileKey[] }> = [
  { title: 'Family and address', keys: ['fatherSpouseName', 'motherName', 'maritalStatus', 'addressLine', 'pincode', 'email'] },
  { title: 'Identity', keys: ['aadhaar', 'panNumber', 'voterIdNumber', 'rationCardNumber'] },
  { title: 'Background', keys: ['socialCategory', 'annualFamilyIncome', 'familySize', 'education', 'occupation', 'existingSkills', 'disability'] },
  { title: 'Bank account (for scheme payments)', keys: ['bankAccountNumber', 'bankIfsc', 'bankName'] },
];

/** True when the core details are already in the profile. */
export const profileComplete = (s: SessionState | null) => Boolean(s?.consent && CORE_FIELDS.every((k) => s.profile?.fields[k]?.value));

interface Props {
  language: LanguageCode;
  onLanguageChange: (code: LanguageCode) => void;
  session: SessionState;
  onSession: (s: SessionState) => void;
  onDone: () => void;
}

const PV = {
  start: 'I will ask each detail. Answer when the microphone turns on. You can say skip or stop at any time.',
  again: 'Sorry, I did not catch that.',
  done: 'Thank you. Please check the details on the screen and press continue.',
  consent: (points: string[]) => `Before we save your profile: ${points.join(' ')} Say I agree to continue, or say no.`,
};

export const ProfileSetup: React.FC<Props> = ({ language, onLanguageChange, session, onSession, onDone }) => {
  const t = getSmartApplyStrings(language);
  const langConfig = SUPPORTED_LANGUAGES.find((l) => l.code === language) || SUPPORTED_LANGUAGES[0];
  const [step, setStep] = useState<0 | 1 | 2>(session.consent ? 1 : 0);
  const [values, setValues] = useState<Partial<Record<ProfileKey, string>>>(() =>
    Object.fromEntries(Object.entries(session.profile?.fields || {}).map(([k, f]) => [k, (f as any)?.value || '']))
  );
  /** Values as last saved, so only changes are sent (stored Aadhaar comes back masked). */
  const saved = useRef<Partial<Record<ProfileKey, string>>>({ ...values });
  const [errors, setErrors] = useState<Partial<Record<ProfileKey, string>>>({});
  const [saving, setSaving] = useState(false);
  const [openSection, setOpenSection] = useState(0);
  const [voiceOn, setVoiceOn] = useState(false);
  const [asking, setAsking] = useState<ProfileKey | null>(null);
  const voice = useVoiceTurns(langConfig.speechLocale);
  const run = useRef(0);
  const dictateFor = useRef<ProfileKey | null>(null);
  const dictation = useDictation(langConfig.speechLocale, (heard) => {
    const key = dictateFor.current;
    if (key) setValues((v) => ({ ...v, [key]: heard }));
  });

  const label = (k: ProfileKey) => (language === 'hi' ? PROFILE_FIELD_MAP[k].labelHi : PROFILE_FIELD_MAP[k].label);
  const question = (k: ProfileKey) => {
    const f = PROFILE_FIELD_MAP[k];
    if (k === 'aadhaar') return 'Please say the last 4 digits of your Aadhaar number, or say skip.';
    return (language === 'hi' && f.questionHi) || f.question;
  };
  const say = async (text: string) => voice.say(await spokenIn(language, text));

  useEffect(() => () => voice.cancel(), []); // eslint-disable-line react-hooks/exhaustive-deps

  /** Save some fields; resolves to the errors (empty when all were accepted). */
  const save = async (keys: ProfileKey[], source: 'typed' | 'voice', from = values) => {
    const updates = Object.fromEntries(keys.filter((k) => from[k]?.trim() && from[k] !== saved.current[k]).map((k) => [k, from[k]!.trim()]));
    if (!Object.keys(updates).length) return {};
    const res = await autofillApi.updateProfile(updates, source, true);
    onSession(res);
    const errs = res.errors as Partial<Record<ProfileKey, string>>;
    setErrors((e) => {
      const nextErrs = { ...e };
      for (const k of Object.keys(updates) as ProfileKey[]) {
        if (errs[k]) nextErrs[k] = errs[k];
        else delete nextErrs[k];
      }
      return nextErrs;
    });
    // Show values as the server normalised them (dates, numbers, options)
    setValues((v) => {
      const out = { ...v };
      for (const k of Object.keys(updates) as ProfileKey[]) {
        if (!errs[k] && res.profile?.fields[k]?.value) {
          out[k] = res.profile.fields[k]!.value;
          saved.current[k] = out[k];
        }
      }
      return out;
    });
    return errs;
  };

  const agree = async () => {
    setSaving(true);
    try {
      onSession(await autofillApi.consent(session.consentVersion));
      setStep(1);
    } finally {
      setSaving(false);
    }
  };

  const consentByVoice = async () => {
    const mine = ++run.current;
    const points = t.consentPoints.map((p) => p.replace('{days}', String(session.retentionDays)));
    for (let tries = 0; tries < 2 && run.current === mine; tries++) {
      if (!(await say(PV.consent(points)))) return;
      const heard = await voice.listen(9000);
      if (heard === null) return;
      if (!heard) continue;
      if (spokenYesNo(heard) === 'yes') return agree();
      return;
    }
  };

  /** Hands-free: ask every empty (or rejected) field of this step aloud and save each answer. */
  const fillByVoice = async (keys: ProfileKey[]) => {
    const mine = ++run.current;
    setVoiceOn(true);
    let current = { ...values };
    let first = true;
    try {
      for (const k of keys) {
        if (current[k]?.trim() && !errors[k]) continue;
        let prefix = first ? PV.start : '';
        first = false;
        for (let tries = 0; tries < 3 && run.current === mine; tries++) {
          setAsking(k);
          const opts = PROFILE_FIELD_MAP[k].options;
          const hint = opts?.length ? `You can say: ${opts.join(', ')}.` : '';
          if (!(await voice.say(await spokenIn(language, prefix, question(k), hint)))) return;
          prefix = '';
          const heard = await voice.listen(10000);
          if (heard === null || run.current !== mine) return;
          if (!heard) {
            prefix = PV.again;
            continue;
          }
          const words = heard.trim().split(/\s+/).length;
          if (words <= 3 && VOICE_COMMANDS.stop.test(heard)) return;
          if (words <= 2 && VOICE_COMMANDS.skip.test(heard)) break;
          current = { ...current, [k]: heard };
          setValues((v) => ({ ...v, [k]: heard }));
          const errs = await save([k], 'voice', current);
          if (!errs[k]) break;
          prefix = `${errs[k]}.`;
        }
      }
      if (run.current === mine) await say(PV.done);
    } finally {
      if (run.current === mine) {
        setVoiceOn(false);
        setAsking(null);
      }
    }
  };

  const stopVoice = () => {
    run.current++;
    voice.cancel();
    setVoiceOn(false);
    setAsking(null);
  };

  const continueCore = async () => {
    stopVoice();
    setSaving(true);
    try {
      const errs = await save(CORE_FIELDS, 'typed');
      const missing = CORE_FIELDS.filter((k) => !values[k]?.trim());
      if (missing.length) setErrors((e) => ({ ...e, ...Object.fromEntries(missing.map((k) => [k, 'Required'])) }));
      if (!missing.length && !Object.keys(errs).some((k) => CORE_FIELDS.includes(k as ProfileKey))) setStep(2);
    } finally {
      setSaving(false);
    }
  };

  const finish = async () => {
    stopVoice();
    setSaving(true);
    try {
      const errs = await save(MORE_SECTIONS.flatMap((s) => s.keys), 'typed');
      if (!Object.keys(errs).length) onDone();
    } finally {
      setSaving(false);
    }
  };

  const field = (k: ProfileKey) => {
    const f = PROFILE_FIELD_MAP[k];
    const required = CORE_FIELDS.includes(k);
    const id = `ps-${k}`;
    const listening = dictation.listening && dictateFor.current === k;
    return (
      <div key={k} className={`rounded-xl p-2 transition ${asking === k ? 'bg-teal-50 ring-2 ring-teal' : ''}`}>
        <label htmlFor={id} className="text-sm font-semibold text-navy">
          {label(k)} {required ? <span className="text-coral-600">*</span> : <span className="text-xs font-normal text-muted">(optional)</span>}
        </label>
        <div className="mt-1 flex gap-2">
          {f.options ? (
            <select
              id={id}
              value={values[k] || ''}
              onChange={(e) => setValues((v) => ({ ...v, [k]: e.target.value }))}
              className="h-12 w-full rounded-xl border border-line bg-white px-3 text-base text-navy focus:border-teal-600 focus:outline-none"
            >
              <option value="">Choose…</option>
              {f.options.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          ) : (
            <input
              id={id}
              translate="no"
              value={values[k] || ''}
              onChange={(e) => setValues((v) => ({ ...v, [k]: e.target.value }))}
              inputMode={['mobile', 'pincode', 'number', 'money', 'account', 'aadhaar'].includes(f.type) ? 'numeric' : undefined}
              placeholder={f.type === 'date' ? 'DD/MM/YYYY' : k === 'aadhaar' ? 'Last 4 digits' : ''}
              className="h-12 w-full rounded-xl border border-line bg-white px-3 text-base text-navy focus:border-teal-600 focus:outline-none"
            />
          )}
          {dictation.supported && (
            <button
              type="button"
              onClick={() => {
                if (listening) return dictation.stop();
                dictateFor.current = k;
                dictation.start();
              }}
              className={`btn h-12 w-12 shrink-0 p-0 ${listening ? 'bg-coral text-white' : 'btn-outline'}`}
              aria-label={listening ? `Stop listening for ${f.label}` : `Say your ${f.label}`}
            >
              {listening ? <MicOff className="h-5 w-5" aria-hidden /> : <Mic className="h-5 w-5" aria-hidden />}
            </button>
          )}
        </div>
        {errors[k] && (
          <p role="alert" className="mt-1 text-sm text-coral-600">
            {errors[k]}
          </p>
        )}
      </div>
    );
  };

  const voiceBar = (keys: ProfileKey[]) =>
    voice.supported && (
      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-navy px-4 py-3 text-white">
        {voiceOn ? (
          <>
            <AudioLines className={`h-5 w-5 ${voice.phase === 'listening' ? 'animate-pulse text-saffron' : 'text-teal'}`} aria-hidden />
            <span className="min-w-0 flex-1 truncate text-sm" role="status">
              {voice.interim ? `“${voice.interim}”` : voice.phase === 'listening' ? t.listening : asking ? label(asking) : '…'}
            </span>
            <button onClick={stopVoice} className="btn btn-on-dark btn-sm">
              Stop voice
            </button>
          </>
        ) : (
          <>
            <span className="min-w-0 flex-1 text-sm">Prefer to speak? I will ask each detail and fill it in for you.</span>
            <button onClick={() => fillByVoice(keys)} className="btn btn-success btn-sm">
              <AudioLines className="h-4 w-4" aria-hidden /> Fill by voice
            </button>
          </>
        )}
      </div>
    );

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-navy/70 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="ps-title">
      <div className="mx-auto my-6 w-[calc(100%-2rem)] max-w-2xl rounded-[28px] bg-ivory p-5 shadow-2xl sm:my-12 sm:p-8">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-navy text-white">
            <UserRound className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-teal-600">UDAAN ONE · Step {step + 1} of 3</p>
            <h1 id="ps-title" className="text-xl font-extrabold text-navy sm:text-2xl">
              {step === 0 ? 'Welcome — let’s set up your profile' : step === 1 ? 'Your basic details' : 'More details (optional)'}
            </h1>
          </div>
        </div>

        {step === 0 && (
          <div className="mt-6 space-y-6">
            <div>
              <p className="text-sm font-semibold text-navy">Choose your language</p>
              <div className="mt-2 flex flex-wrap gap-2" translate="no">
                {SUPPORTED_LANGUAGES.map((l) => (
                  <button
                    key={l.code}
                    onClick={() => onLanguageChange(l.code)}
                    aria-pressed={l.code === language}
                    className={`min-h-11 rounded-full border px-4 text-sm font-semibold transition ${l.code === language ? 'border-navy bg-navy text-white' : 'border-line bg-white text-navy hover:border-teal'}`}
                  >
                    {l.nativeName}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm text-muted">Your profile fills every form for you, so you only give your details once. {t.consentTitle}:</p>
              <ul className="mt-3 space-y-2.5">
                {t.consentPoints.map((p) => (
                  <li key={p} className="flex gap-3 text-sm leading-relaxed text-navy">
                    <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-green" aria-hidden />
                    {p.replace('{days}', String(session.retentionDays))}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={agree} disabled={saving} className="btn btn-success btn-lg">
                {saving ? <Spinner className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" aria-hidden />} {t.consentAgree}
              </button>
              {voice.supported && (
                <button onClick={consentByVoice} className="btn btn-outline btn-lg">
                  <AudioLines className="h-5 w-5" aria-hidden /> {voice.phase === 'listening' ? t.listening : 'Answer by voice'}
                </button>
              )}
            </div>
            <p className="text-xs text-muted">Your profile cannot be saved without this agreement.</p>
          </div>
        )}

        {step === 1 && (
          <div className="mt-5">
            <p className="text-sm text-muted">These are needed on every application. Type them, tap the mic next to a box, or let me ask you by voice.</p>
            {voiceBar(CORE_FIELDS)}
            <div className="mt-4 grid gap-2 sm:grid-cols-2">{CORE_FIELDS.map(field)}</div>
            <button onClick={continueCore} disabled={saving} className="btn btn-primary btn-lg mt-6 w-full">
              {saving ? <Spinner className="h-5 w-5" /> : null} {t.continue}
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="mt-5">
            <p className="text-sm text-muted">Forms often ask for these. Add what you can now — you can also add them later, or they are read from your documents.</p>
            {voiceBar(MORE_SECTIONS.flatMap((s) => s.keys))}
            <div className="mt-4 space-y-3">
              {MORE_SECTIONS.map((s, i) => (
                <section key={s.title} className="card overflow-hidden p-0">
                  <button
                    onClick={() => setOpenSection(openSection === i ? -1 : i)}
                    aria-expanded={openSection === i}
                    className="flex w-full items-center justify-between px-4 py-3 text-left font-bold text-navy"
                  >
                    {s.title}
                    <span className="flex items-center gap-2 text-xs font-semibold text-muted">
                      {s.keys.filter((k) => values[k]?.trim()).length}/{s.keys.length}
                      <ChevronDown className={`h-4 w-4 transition-transform ${openSection === i ? 'rotate-180' : ''}`} aria-hidden />
                    </span>
                  </button>
                  {(openSection === i || s.keys.some((k) => asking === k || errors[k])) && <div className="grid gap-2 border-t border-line p-3 sm:grid-cols-2">{s.keys.map(field)}</div>}
                </section>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <button onClick={() => setStep(1)} className="btn btn-ghost btn-lg">
                {t.back}
              </button>
              <button onClick={finish} disabled={saving} className="btn btn-primary btn-lg flex-1">
                {saving ? <Spinner className="h-5 w-5" /> : null} Save and enter UDAAN ONE
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
