import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, AudioLines, ChevronRight, ExternalLink, FileSearch, Mic, MicOff, ScanLine, Search, ShieldCheck, Sparkles, Trash2 } from 'lucide-react';
import type { Language, LanguageCode } from '../../types';
import { getSmartApplyStrings } from '../../data/smartApplyStrings';
import { autofillApi, type DraftView, type SchemeInfo, type SessionState } from '../../services/autofillApi';
import { Alert, Dialog, EmptyState, SkeletonCard, Spinner, StatusPill, Stepper } from '../ui/kit';
import { ConflictResolver } from './ConflictResolver';
import { DocumentStep, type Preview } from './DocumentStep';
import { MissingQuestions } from './MissingQuestions';
import { OutputStep } from './OutputStep';
import { ReviewStep } from './ReviewStep';
import { VOICE_COMMANDS, useDictation, useVoiceTurns } from './media';
import { prefetchTranslations, spokenIn } from '../../services/translate';
import { VoiceDocs } from './VoiceDocs';

interface Props {
  language: LanguageCode;
  langConfig: Language;
  session: SessionState | null;
  onSession: (s: SessionState) => void;
  /** Scheme requested from another channel (voice, chat, helpline…). */
  initialSchemeId?: string | null;
  initialDraftId?: string | null;
  /** Answers already given elsewhere (the loan advisor), filled in when the draft starts. */
  initialValues?: Record<string, string>;
  entryChannel?: string;
  onEntryConsumed?: () => void;
}

/** What the voice says while choosing a form and asking consent (other languages are translated). */
const PV = {
  en: {
    which: 'Which form or scheme do you want to apply for? For example a driving licence, a PAN card, or a loan for your shop.',
    found: (name: string) => `I found ${name}. Say yes to start it, or say the name of a different form.`,
    notFound: 'I could not find a form for that. Please say it another way, for example PM Vishwakarma, Aadhaar or driving licence.',
    consent: (points: string[]) => `Before I read your documents: ${points.join(' ')} Say I agree to continue, or say no.`,
    noConsent: 'All right, nothing has been saved.',
    stopped: 'Stopped. Tap Apply by voice to start again.',
    starting: (name: string) => `Starting your application for ${name}.`,
    continuing: (name: string) => `Continuing your application for ${name}.`,
  },
  hi: {
    which: 'आप किस फ़ॉर्म या योजना के लिए आवेदन करना चाहते हैं? जैसे ड्राइविंग लाइसेंस, पैन कार्ड, या दुकान के लिए लोन।',
    found: (name: string) => `${name} मिल गया। शुरू करने के लिए हाँ बोलिए, या किसी दूसरे फ़ॉर्म का नाम बोलिए।`,
    notFound: 'इसके लिए कोई फ़ॉर्म नहीं मिला। कृपया दूसरे तरीके से बोलिए, जैसे पीएम विश्वकर्मा, आधार या ड्राइविंग लाइसेंस।',
    consent: (points: string[]) => `आपके दस्तावेज़ पढ़ने से पहले: ${points.join(' ')} जारी रखने के लिए "मैं सहमत हूँ" बोलिए, या नहीं बोलिए।`,
    noConsent: 'ठीक है, कुछ भी सेव नहीं हुआ।',
    stopped: 'रोक दिया। फिर शुरू करने के लिए Apply by voice दबाइए।',
    starting: (name: string) => `आवेदन शुरू हुआ: ${name}।`,
    continuing: (name: string) => `आपका ${name} आवेदन आगे भरते हैं।`,
  },
};

const ELIG = {
  likely: { tone: 'success' as const, label: 'May be eligible' },
  'needs-info': { tone: 'warning' as const, label: 'Need more details' },
  unlikely: { tone: 'neutral' as const, label: 'May not match' },
};

export const SmartApplyPage: React.FC<Props> = ({ language, langConfig, session, onSession, initialSchemeId, initialDraftId, initialValues, entryChannel = 'web', onEntryConsumed }) => {
  const t = getSmartApplyStrings(language);
  const pv = language === 'hi' ? PV.hi : PV.en;
  // Voice for choosing a form and giving consent; the form itself is filled by MissingQuestions and VoiceDocs
  const voice = useVoiceTurns(langConfig.speechLocale);
  const voiceMode = useRef(entryChannel === 'voice');
  const [choosingByVoice, setChoosingByVoice] = useState(false);
  const sayV = async (text: string) => voice.say(await spokenIn(language, text));
  /** Speak, then listen; asks twice. '' if nothing was heard, null if voice was stopped. */
  const askV = async (text: string): Promise<string | null> => {
    for (let tries = 0; tries < 2; tries++) {
      if (!(await sayV(text))) return null;
      const heard = await voice.listen(9000);
      if (heard === null || heard) return heard;
    }
    return '';
  };
  useEffect(() => () => voice.cancel(), []); // eslint-disable-line react-hooks/exhaustive-deps
  // Fixed voice phrases translated ahead, so the first prompts are not held up
  useEffect(() => {
    prefetchTranslations([PV.en.which, PV.en.notFound, PV.en.noConsent, PV.en.stopped, ...t.consentPoints], language);
  }, [language]); // eslint-disable-line react-hooks/exhaustive-deps
  const [schemes, setSchemes] = useState<SchemeInfo[]>([]);
  const [draft, setDraft] = useState<DraftView | null>(null);
  const [fieldsHash, setFieldsHash] = useState('');
  const [step, setStep] = useState(1);
  const [query, setQuery] = useState('');
  const [matching, setMatching] = useState(false);
  const [match, setMatch] = useState<{ scheme: SchemeInfo | null; reason: string; related: SchemeInfo[] } | null>(null);
  const [recs, setRecs] = useState<SchemeInfo[] | null>(null);
  const [consentFor, setConsentFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState<string | null>(null);
  const [previews, setPreviews] = useState<Record<string, Preview[]>>({});
  /** Answer questions a document could fill, instead of uploading it. */
  const [typeInstead, setTypeInstead] = useState(false);
  useEffect(() => setTypeInstead(false), [draft?.id]);
  // Hands-free filling: spoken questions, then documents and photo by camera
  const [questionVoice, setQuestionVoice] = useState(0);
  const [docVoice, setDocVoice] = useState({ n: 0, afterQuestions: false });
  const [voiceIntro, setVoiceIntro] = useState('');
  const startDocVoice = (afterQuestions: boolean) => setDocVoice((v) => ({ n: v.n + 1, afterQuestions }));
  const draftRef = useRef<DraftView | null>(null);
  draftRef.current = draft;
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const topRef = useRef<HTMLDivElement>(null);
  const hasConsent = Boolean(session?.consent);

  useEffect(() => {
    autofillApi.schemes().then((r) => setSchemes(r.schemes)).catch(() => setError('Could not load the list of forms. Please refresh.'));
  }, []);

  // Release local document previews when leaving the page
  useEffect(() => () => Object.values(previews).flat().forEach((p) => URL.revokeObjectURL(p.url)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const applyDraft = (d: DraftView, hash?: string) => {
    setDraft(d);
    if (hash) setFieldsHash(hash);
  };

  const refreshDraft = useCallback(async () => {
    if (!draft) return;
    const res = await autofillApi.getDraft(draft.id);
    applyDraft(res.draft, res.fieldsHash);
  }, [draft]);

  /** Coming from the voice agent: go straight on by voice — questions first, else documents. */
  const startVoiceFilling = (d: DraftView, continuing = false) => {
    voiceMode.current = true;
    const name = d.scheme?.name?.split(' (')[0] || '';
    setVoiceIntro(continuing ? pv.continuing(name) : pv.starting(name));
    if (d.missing.some((f) => !f.fillableBy?.length)) {
      setStep(2);
      setQuestionVoice((n) => n + 1);
    } else startDocVoice(false);
  };

  /** Answers handed over with the entry (from the loan advisor), saved once the draft exists. */
  const prefill = useRef<Record<string, string> | null>(null);
  const applyPrefill = async (draftId: string) => {
    const values = prefill.current;
    prefill.current = null;
    if (values && Object.keys(values).length) await autofillApi.editFields(draftId, values).catch(() => undefined);
  };

  const firstUsefulStep = (d: DraftView) => (d.documents.some((x) => x.required && !x.have && !x.manual) ? 1 : d.missing.length || d.conflicts.length ? 2 : 3);

  const start = async (schemeId: string, channel = entryChannel) => {
    if (channel === 'voice') voiceMode.current = true;
    if (!hasConsent) {
      setConsentFor(schemeId);
      return;
    }
    setStarting(schemeId);
    setError(null);
    try {
      const res = await autofillApi.startDraft(schemeId, channel);
      onSession(res);
      await applyPrefill(res.draft.id);
      const full = await autofillApi.getDraft(res.draft.id);
      applyDraft(full.draft, full.fieldsHash);
      setStep(firstUsefulStep(full.draft));
      if (channel === 'voice') startVoiceFilling(full.draft);
      topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setStarting(null);
    }
  };

  const resume = async (id: string, byVoice = false) => {
    try {
      const res = await autofillApi.getDraft(id);
      applyDraft(res.draft, res.fieldsHash);
      setStep(res.draft.generated || res.draft.approved ? 4 : firstUsefulStep(res.draft));
      if (byVoice) startVoiceFilling(res.draft, true);
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Hand-off from another channel or from My Applications
  useEffect(() => {
    if (!session) return;
    if (initialDraftId) {
      resume(initialDraftId);
      onEntryConsumed?.();
    } else if (initialSchemeId) {
      prefill.current = initialValues || null;
      start(initialSchemeId, entryChannel);
      onEntryConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.hasSession, initialSchemeId, initialDraftId]);

  const giveConsent = async () => {
    try {
      const s = await autofillApi.consent(session?.consentVersion || '');
      onSession(s);
      const pending = consentFor;
      setConsentFor(null);
      if (pending) {
        setStarting(pending);
        const channel = voiceMode.current ? 'voice' : entryChannel;
        const res = await autofillApi.startDraft(pending, channel);
        onSession(res);
        await applyPrefill(res.draft.id);
        const full = await autofillApi.getDraft(res.draft.id);
        applyDraft(full.draft, full.fieldsHash);
        setStep(firstUsefulStep(full.draft));
        if (channel === 'voice') startVoiceFilling(full.draft);
        setStarting(null);
      }
    } catch (err: any) {
      setError(err.message);
      setStarting(null);
    }
  };

  /** Consent read aloud and given by voice (for people filling the form by voice). */
  const consentByVoice = async () => {
    voiceMode.current = true;
    const points = t.consentPoints.map((x) => x.replace('{days}', String(session?.retentionDays ?? '')));
    const heard = await askV(pv.consent(points));
    if (heard === null) return;
    if ((VOICE_COMMANDS.agree.test(heard) || VOICE_COMMANDS.yes.test(heard)) && !VOICE_COMMANDS.no.test(heard)) return giveConsent();
    setConsentFor(null);
    sayV(heard ? pv.noConsent : pv.stopped);
  };

  // Started by voice and consent is still needed: ask for it by voice too
  useEffect(() => {
    if (consentFor && voiceMode.current) consentByVoice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consentFor]);

  /** Choose the form by voice: say what you want, confirm the match, and filling starts by voice. */
  const chooseByVoice = async () => {
    voice.cancel();
    voiceMode.current = true;
    setChoosingByVoice(true);
    try {
      let prompt = pv.which;
      let heard: string | null = null;
      for (let turn = 0; turn < 5; turn++) {
        if (heard === null || !heard) heard = await askV(prompt);
        if (heard === null) return;
        if (!heard || VOICE_COMMANDS.stop.test(heard)) {
          await sayV(pv.stopped);
          return;
        }
        setQuery(heard);
        const r = await autofillApi.intent(heard).catch(() => null);
        if (!r?.scheme) {
          prompt = pv.notFound;
          heard = '';
          continue;
        }
        setMatch({ scheme: r.scheme, reason: r.reason, related: r.relatedSchemes || [] });
        const reply = await askV(pv.found(r.scheme.name.split(' (')[0]));
        if (reply === null) return;
        if ((VOICE_COMMANDS.yes.test(reply) || VOICE_COMMANDS.agree.test(reply)) && !VOICE_COMMANDS.no.test(reply)) {
          setChoosingByVoice(false);
          return start(r.scheme.schemeId, 'voice');
        }
        if (!reply || VOICE_COMMANDS.stop.test(reply)) {
          await sayV(pv.stopped);
          return;
        }
        // "No" asks again; anything else is the name of another form
        prompt = pv.which;
        heard = VOICE_COMMANDS.no.test(reply) && reply.split(/\s+/).length <= 2 ? '' : reply;
      }
    } finally {
      setChoosingByVoice(false);
    }
  };

  const findForm = async (text = query) => {
    if (!text.trim()) return;
    setMatching(true);
    setMatch(null);
    try {
      const r = await autofillApi.intent(text);
      setMatch({ scheme: r.scheme, reason: r.reason, related: r.relatedSchemes || [] });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setMatching(false);
    }
  };

  const dictation = useDictation(langConfig.speechLocale, (heard) => {
    setQuery(heard);
    findForm(heard);
  });

  const deleteAll = async () => {
    await autofillApi.deleteAll();
    setDraft(null);
    setPreviews({});
    onSession(await autofillApi.session());
  };

  const answer = async (key: string, text: string, via: 'typed' | 'voice') => {
    if (!draft) return 'No application open';
    try {
      const res = await autofillApi.answer(draft.id, key, text, via === 'voice' ? 'voice' : 'chat');
      applyDraft(res.draft, res.fieldsHash);
      // The profile summary elsewhere can catch up in the background — do not hold up the next question
      autofillApi.session().then(onSession).catch(() => {});
      return res.result.ok ? res.result.error || null : res.result.error || 'I could not understand that — please try again.';
    } catch (err: any) {
      return err.message;
    }
  };

  /* ── Loading ───────────────────────────────────────────────────── */
  if (!session) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <SkeletonCard lines={4} />
        <SkeletonCard lines={4} />
      </div>
    );
  }

  const consentDialog = (
    <Dialog
      open={Boolean(consentFor)}
      onClose={() => {
        voice.cancel();
        setConsentFor(null);
      }}
      title={t.consentTitle}
    >
      <ul className="space-y-3">
        {t.consentPoints.map((p) => (
          <li key={p} className="flex gap-3 text-sm leading-relaxed text-navy">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-green" aria-hidden />
            {p.replace('{days}', String(session.retentionDays))}
          </li>
        ))}
      </ul>
      <div className="mt-6 flex flex-wrap gap-2">
        <button
          onClick={() => {
            voice.cancel();
            giveConsent();
          }}
          className="btn btn-success btn-lg"
        >
          {t.consentAgree}
        </button>
        {voice.supported && (
          <button onClick={consentByVoice} className="btn btn-outline btn-lg">
            <AudioLines className="h-5 w-5" aria-hidden /> {voice.phase === 'listening' ? t.listening : 'Answer by voice'}
          </button>
        )}
        <button
          onClick={() => {
            voice.cancel();
            setConsentFor(null);
          }}
          className="btn btn-ghost btn-lg"
        >
          {t.consentDecline}
        </button>
      </div>
    </Dialog>
  );

  /* ── Choose a scheme ───────────────────────────────────────────── */
  if (!draft) {
    const drafts = session.drafts || [];
    return (
      <div className="space-y-10" ref={topRef}>
        <section className="surface-dark rounded-[28px] px-6 py-10 sm:px-10 sm:py-12">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-teal">Smart Apply</p>
            <h1 className="mt-3 text-3xl font-extrabold leading-tight sm:text-[2.6rem]">{t.title}</h1>
            <p className="mt-3 text-base leading-relaxed text-slate-300 sm:text-lg">{t.subtitle}</p>
          </div>
          <form
            className="mt-8 flex max-w-3xl flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              findForm();
            }}
          >
            <label htmlFor="sa-ask" className="sr-only">What do you want to apply for?</label>
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden />
              <input
                id="sa-ask"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.askPlaceholder}
                className="h-14 w-full rounded-2xl border border-white/15 bg-white/[0.07] pl-12 pr-4 text-base text-white placeholder:text-slate-400 focus:border-teal focus:outline-none"
              />
            </div>
            <div className="flex gap-2">
              {dictation.supported && (
                <button
                  type="button"
                  onClick={dictation.listening ? dictation.stop : dictation.start}
                  className={`btn btn-lg h-14 w-14 p-0 ${dictation.listening ? 'bg-coral text-white' : 'btn-on-dark'}`}
                  aria-label={dictation.listening ? t.listening : t.speak}
                >
                  {dictation.listening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                </button>
              )}
              <button className="btn btn-accent btn-lg h-14 flex-1 sm:flex-none" disabled={matching || !query.trim()}>
                {matching ? <Spinner className="h-5 w-5" /> : <ScanLine className="h-5 w-5" aria-hidden />} {t.find}
              </button>
            </div>
          </form>
          {voice.supported && (
            <div className="mt-4 flex max-w-3xl flex-wrap items-center gap-3">
              <button
                onClick={() => (choosingByVoice ? (voice.cancel(), setChoosingByVoice(false)) : chooseByVoice())}
                className={`btn btn-lg h-14 ${choosingByVoice ? 'bg-coral text-white' : 'btn-success'}`}
              >
                <AudioLines className={`h-5 w-5 ${voice.phase === 'listening' ? 'animate-pulse' : ''}`} aria-hidden />
                {choosingByVoice ? 'Stop voice' : 'Apply by voice — no typing'}
              </button>
              {choosingByVoice && (
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-200" role="status">
                  {voice.interim ? `“${voice.interim}”` : voice.phase === 'listening' ? t.listening : voice.phase === 'speaking' ? 'Speaking…' : 'Looking for your form…'}
                </span>
              )}
            </div>
          )}
          <button
            onClick={async () => setRecs((await autofillApi.recommend()).recommendations)}
            className="mt-4 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-teal hover:underline"
          >
            <Sparkles className="h-4 w-4" aria-hidden /> {t.notSure}
          </button>
        </section>

        {error && <Alert tone="danger" title={error} />}

        {match && (
          <section aria-live="polite" className="animate-fade-up">
            {match.scheme ? (
              <>
                <SchemeOption t={t} s={match.scheme} reason={match.reason} highlight onStart={start} starting={starting} />
                {match.related.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-bold text-navy">You will probably also need</p>
                    <div className="mt-3 grid gap-4 md:grid-cols-2">
                      {match.related.map((r) => (
                        <SchemeOption key={r.schemeId} t={t} s={r} onStart={start} starting={starting} />
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <Alert tone="info" title="We could not match that to a form we support yet.">
                Try naming the scheme (for example "PM Vishwakarma" or "MUDRA loan"), choose one below, or tap "{t.notSure}".
              </Alert>
            )}
          </section>
        )}

        {recs && (
          <section aria-labelledby="recs-h" className="space-y-4 animate-fade-up">
            <div>
              <h2 id="recs-h" className="text-xl font-extrabold text-navy">Suggested for you</h2>
              <p className="text-sm text-muted">{t.potential}. Add more details to your profile for better suggestions.</p>
            </div>
            {recs.length === 0 ? (
              <EmptyState compact icon={Sparkles} title="No suggestions yet" body="Tell us a little about yourself in your profile or by talking to UDAAN AI." />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {recs.map((s) => (
                  <SchemeOption key={s.schemeId} t={t} s={s} onStart={start} starting={starting} />
                ))}
              </div>
            )}
          </section>
        )}

        {drafts.length > 0 && (
          <section aria-labelledby="drafts-h">
            <h2 id="drafts-h" className="text-xl font-extrabold text-navy">{t.yourDrafts}</h2>
            <ul className="mt-4 grid gap-3 md:grid-cols-2">
              {drafts.map((d) => (
                <li key={d.id} className="card flex flex-wrap items-center gap-4 p-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-navy-50 text-navy">
                    <FileSearch className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold text-navy">{d.schemeName}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                      <StatusPill tone={d.status.code === 'prepared' || d.status.code === 'approved' ? 'success' : d.status.code === 'review' ? 'info' : 'warning'}>{d.status.label}</StatusPill>
                      Updated {new Date(d.updatedAt).toLocaleDateString('en-IN')}
                    </span>
                  </span>
                  <span className="flex gap-2">
                    {voice.supported && (
                      <button onClick={() => resume(d.id, true)} className="btn btn-outline btn-sm" aria-label={`Continue ${d.schemeName} by voice`}>
                        <AudioLines className="h-4 w-4" aria-hidden /> By voice
                      </button>
                    )}
                    <button onClick={() => resume(d.id)} className="btn btn-primary btn-sm">
                      {t.resume} <ArrowRight className="h-4 w-4" aria-hidden />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="forms-h">
          <h2 id="forms-h" className="text-xl font-extrabold text-navy">{t.supported}</h2>
          <p className="mt-1 text-sm text-muted">
            Each form lists the details the official application commonly asks for, based on public requirements. You can also upload the official form to have it filled in its own layout.
          </p>
          {schemes.length === 0 && !error ? (
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <SkeletonCard key={i} lines={2} />
              ))}
            </div>
          ) : (
            ([
              ['loan', 'Loans'],
              ['document', 'Documents & certificates'],
              ['scheme', 'Government schemes'],
            ] as const).map(([kind, heading]) => (
            <div key={kind} className="mt-6">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted">{heading}</h3>
            <ul className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {schemes.filter((s) => (s.kind || 'scheme') === kind).map((s) => (
                <li key={s.schemeId}>
                  <button
                    onClick={() => start(s.schemeId)}
                    disabled={Boolean(starting)}
                    className="card group flex h-full w-full flex-col p-4 text-left transition hover:-translate-y-0.5 hover:shadow-lift disabled:opacity-60"
                  >
                    <span className="text-xs font-semibold text-muted">{s.ministry}</span>
                    <span className="mt-1 font-bold leading-snug text-navy">{s.name}</span>
                    {s.officialForm && <span className="mt-1 text-xs text-muted">Official form: {s.officialForm}</span>}
                    <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-teal-600">
                      {starting === s.schemeId ? <Spinner className="h-4 w-4" /> : null}
                      {t.start} <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            </div>
            ))
          )}
        </section>

        {consentDialog}
      </div>
    );
  }

  /* ── Workspace for one application ─────────────────────────────── */
  // Ask what no document shows first; details a pending document would fill wait for the upload
  const fromDocs = draft.missing.filter((f) => f.fillableBy?.length);
  const questions = typeInstead ? draft.missing : draft.missing.filter((f) => !f.fillableBy?.length);
  const docsNeeded = draft.documents.filter((d) => d.required && !d.have && !d.manual).length;
  const steps = [
    { label: t.steps[0], done: true },
    { label: t.steps[1], done: docsNeeded === 0, note: docsNeeded ? `${docsNeeded} needed` : 'Done' },
    { label: t.steps[2], done: draft.missing.length === 0 && draft.conflicts.length === 0, note: draft.missing.length + draft.conflicts.length ? `${draft.missing.length + draft.conflicts.length} left` : 'Done' },
    { label: t.steps[3], done: draft.approved, note: draft.needsReview.length ? `${draft.needsReview.length} to check` : undefined },
    { label: t.steps[4], done: Boolean(draft.generated) },
  ];

  return (
    <div className="space-y-6" ref={topRef}>
      <header className="space-y-5">
        <button onClick={() => setDraft(null)} className="btn btn-ghost btn-sm -ml-2">
          <ArrowLeft className="h-4 w-4" aria-hidden /> All applications
        </button>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 max-w-3xl">
            <p className="eyebrow">Smart Apply · Ref {draft.reference}</p>
            <h1 className="mt-2 text-2xl font-extrabold text-navy sm:text-3xl">{draft.scheme.formTitle}</h1>
            <p className="mt-1 text-sm text-muted">
              {t.basis}: {draft.scheme.basis}{' '}
              <a href={draft.scheme.officialUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 font-semibold text-teal-600 hover:underline">
                {draft.scheme.officialLabel} <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            {voice.supported && (
              <button onClick={() => startVoiceFilling(draft, true)} className="btn btn-success btn-sm">
                <AudioLines className="h-4 w-4" aria-hidden /> Fill by voice
              </button>
            )}
            <StatusPill tone={draft.generated || draft.approved ? 'success' : draft.readyForApproval ? 'info' : 'warning'}>{draft.status.label}</StatusPill>
            {draft.eligibility && (
              <StatusPill tone={ELIG[draft.eligibility.level].tone} title={draft.eligibility.reasons.join(' · ')}>
                {ELIG[draft.eligibility.level].label} · preliminary
              </StatusPill>
            )}
          </div>
        </div>
        <div className="card px-2 py-4 sm:px-6">
          <Stepper
            steps={steps}
            current={step}
            onSelect={(i) => {
              if (i === 0) setDraft(null);
              else setStep(i);
            }}
          />
        </div>
      </header>

      {error && <Alert tone="danger" title={error} />}

      {/* Hands-free guide: documents, photo, review, approval and download by voice */}
      <VoiceDocs
        start={docVoice}
        speechLocale={langConfig.speechLocale}
        language={language}
        getDraft={() => draftRef.current}
        hasPhoto={() => Boolean(sessionRef.current?.photo?.usable)}
        onSession={onSession}
        refreshDraft={async () => {
          if (!draftRef.current) return null;
          const res = await autofillApi.getDraft(draftRef.current.id);
          applyDraft(res.draft, res.fieldsHash);
          draftRef.current = res.draft;
          return res.draft;
        }}
        onAnswerInstead={() => {
          setStep(2);
          setTypeInstead(true);
          setQuestionVoice((n) => n + 1);
        }}
        onShowStep={setStep}
        onApprove={async () => {
          const current = await autofillApi.getDraft(draft.id);
          if (!current.draft.readyForApproval) {
            applyDraft(current.draft, current.fieldsHash);
            return false;
          }
          const res = await autofillApi.approve(draft.id, current.fieldsHash);
          applyDraft(res.draft, res.fieldsHash);
          return true;
        }}
        onDownload={async () => {
          await autofillApi.downloadPdf(draft.id, { use: draft.officialForm ? 'official' : 'draft' });
          const res = await autofillApi.getDraft(draft.id);
          applyDraft(res.draft, res.fieldsHash);
        }}
      />

      <div key={step} className="animate-fade-up">
        {step === 1 && (
          <DocumentStep
            t={t}
            draft={draft}
            documents={session.documents || []}
            photo={session.photo}
            previews={previews}
            onPreviews={(id, p) => setPreviews((all) => ({ ...all, [id]: p }))}
            onSession={onSession}
            onRefreshDraft={refreshDraft}
          />
        )}

        {step === 2 && (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <div className="space-y-6">
              <ConflictResolver t={t} conflicts={draft.conflicts} onSession={onSession} onResolved={refreshDraft} />
              {fromDocs.length > 0 && !typeInstead && (
                <section className="card border-teal/30 bg-teal-50/40 p-5 sm:p-6" aria-labelledby="fromdocs-h">
                  <h2 id="fromdocs-h" className="font-bold text-navy">These will be read from your documents</h2>
                  <p className="mt-1 text-sm text-muted">No need to type them — upload the document and they are filled in for you.</p>
                  <ul className="mt-3 space-y-1.5 text-sm">
                    {Object.entries(
                      fromDocs.reduce<Record<string, string[]>>((acc, f) => {
                        const by = f.fillableBy!.slice(0, 2).join(' or ');
                        (acc[by] ||= []).push(f.label);
                        return acc;
                      }, {})
                    ).map(([by, labels]) => (
                      <li key={by}>
                        <span className="font-semibold text-navy">{by}:</span> <span className="text-muted">{labels.join(', ')}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button onClick={() => setStep(1)} className="btn btn-primary btn-sm">Upload documents</button>
                    <button onClick={() => startDocVoice(false)} className="btn btn-accent btn-sm">
                      <AudioLines className="h-4 w-4" aria-hidden /> Scan by voice
                    </button>
                    <button onClick={() => setTypeInstead(true)} className="btn btn-ghost btn-sm">I don’t have them — let me answer</button>
                  </div>
                </section>
              )}
              {/* Kept mounted (only hidden) so a voice session can finish and hand over to documents */}
              <section className={`card p-5 sm:p-6 ${questions.length > 0 || fromDocs.length === 0 || typeInstead ? '' : 'hidden'}`} aria-labelledby="q-h">
                <h2 id="q-h" className="text-lg font-bold text-navy">{questions.length ? t.questionsTitle : t.questionsDone}</h2>
                <p className="mt-1 text-sm text-muted">Only what your documents cannot tell us — about this application and your situation. Type, tap or speak your answer.</p>
                <div className="mt-4">
                  <MissingQuestions
                    t={t}
                    language={language}
                    speechLocale={langConfig.speechLocale}
                    questions={questions}
                    onAnswer={answer}
                    voiceStart={questionVoice}
                    voiceIntro={voiceIntro}
                    onVoiceFinished={() => startDocVoice(true)}
                    onScanRequest={() => startDocVoice(false)}
                  />
                </div>
              </section>
            </div>
            <aside className="card h-fit p-5" aria-labelledby="known-h">
              <h2 id="known-h" className="font-bold text-navy">Already filled</h2>
              <ul className="mt-3 space-y-2">
                {draft.fields
                  .filter((f) => f.value && f.state !== 'conflict')
                  .slice(0, 12)
                  .map((f) => (
                    <li key={f.key} className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="text-muted">{f.label}</span>
                      <span translate="no" className="truncate text-right font-semibold text-navy">{f.value}</span>
                    </li>
                  ))}
              </ul>
              <button onClick={() => setStep(3)} className="btn btn-outline btn-sm mt-4 w-full">See all details</button>
            </aside>
          </div>
        )}

        {step === 3 && <ReviewStep t={t} language={language} draft={draft} onDraft={applyDraft} />}

        {step === 4 && <OutputStep t={t} draft={draft} fieldsHash={fieldsHash} onDraft={applyDraft} onGoTo={setStep} onDeleteAll={deleteAll} />}
      </div>

      {/* Step navigation */}
      <nav className="flex items-center justify-between gap-3 border-t border-line pt-5" aria-label="Step navigation">
        <button onClick={() => (step === 1 ? setDraft(null) : setStep(step - 1))} className="btn btn-ghost btn-lg">
          <ArrowLeft className="h-4 w-4" aria-hidden /> {t.back}
        </button>
        {step < 4 && (
          <button onClick={() => setStep(step + 1)} className="btn btn-primary btn-lg">
            {t.continue} <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
        )}
      </nav>
      {consentDialog}
    </div>
  );
};

const SchemeOption: React.FC<{
  t: ReturnType<typeof getSmartApplyStrings>;
  s: SchemeInfo;
  reason?: string;
  highlight?: boolean;
  onStart: (id: string) => void;
  starting: string | null;
}> = ({ t, s, reason, highlight, onStart, starting }) => (
  <article className={`card flex flex-col p-5 sm:p-6 ${highlight ? 'ring-2 ring-teal/40' : ''}`}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-muted">{s.ministry}</p>
        <h3 className="mt-1 text-lg font-bold leading-snug text-navy">{s.name}</h3>
        {s.officialForm && <p className="mt-1 text-xs font-semibold text-teal-600">Official form: {s.officialForm}</p>}
      </div>
      {s.eligibility && <StatusPill tone={ELIG[s.eligibility.level].tone}>{ELIG[s.eligibility.level].label}</StatusPill>}
    </div>
    <p className="mt-2 text-sm leading-relaxed text-muted">{s.summary}</p>
    {(reason || s.eligibility) && (
      <div className="mt-3 rounded-xl bg-ivory p-3 text-sm text-navy">
        <p className="text-xs font-bold uppercase tracking-wider text-muted">Why it may fit</p>
        {reason && <p className="mt-1">{reason}</p>}
        {s.eligibility && (
          <ul className="mt-1 space-y-0.5 text-xs text-navy/80">
            {s.eligibility.reasons.map((r) => (
              <li key={r}>• {r}</li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-[11px] text-muted">{t.potential}</p>
      </div>
    )}
    <p className="mt-3 text-xs text-muted">
      <span className="font-semibold text-navy">Documents:</span> {s.documents.join(', ')}
    </p>
    <div className="mt-auto flex flex-wrap items-center gap-3 pt-4">
      <button onClick={() => onStart(s.schemeId)} disabled={Boolean(starting)} className="btn btn-primary">
        {starting === s.schemeId ? <Spinner className="h-4 w-4" /> : null} {t.start} <ArrowRight className="h-4 w-4" aria-hidden />
      </button>
      <a href={s.officialUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-teal-600 hover:underline">
        {t.officialSite}: {s.officialLabel} <ExternalLink className="h-3.5 w-3.5" aria-hidden />
      </a>
    </div>
  </article>
);
