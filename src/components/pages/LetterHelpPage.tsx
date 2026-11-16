import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Camera, CalendarClock, CheckCircle2, Download, FileSearch, ListChecks, Lock, MailOpen, Mic, MicOff, PenLine, RotateCcw, Square, Volume2, Wrench } from 'lucide-react';
import type { BeneficiaryProfile, Language } from '../../types';
import type { UploadFile } from '../../services/autofillApi';
import { helpApi, type DraftLetter, type LetterKind, type LetterReading } from '../../services/helpApi';
import { CameraScanner } from '../smartapply/CameraScanner';
import { prepareFile, useDictation } from '../smartapply/media';
import { useSpeaker } from '../learning/useSpeaker';
import { Alert, Spinner, StatusPill, UploadZone, type Tone } from '../ui/kit';

interface Props {
  profile: BeneficiaryProfile;
  langConfig: Language;
}

const KIND: Record<LetterKind, { label: string; tone: Tone }> = {
  rejection: { label: 'Rejected or on hold', tone: 'danger' },
  approval: { label: 'Good news', tone: 'success' },
  payment_due: { label: 'Payment asked', tone: 'warning' },
  documents_needed: { label: 'Documents needed', tone: 'warning' },
  visit_or_hearing: { label: 'You must go / appear', tone: 'warning' },
  legal_notice: { label: 'Legal notice', tone: 'danger' },
  information: { label: 'Information', tone: 'info' },
  possible_scam: { label: 'Possible scam', tone: 'danger' },
  other: { label: 'Letter', tone: 'neutral' },
};
const URGENCY: Record<LetterReading['urgency'], { label: string; tone: Tone }> = {
  high: { label: 'Act soon', tone: 'danger' },
  medium: { label: 'Needs action', tone: 'warning' },
  low: { label: 'No rush', tone: 'success' },
};
const REPLY_LABEL = { appeal: 'Write an appeal for me', grievance: 'Write a complaint letter for me', reply: 'Write my reply for me', none: '' } as const;

/** "2026-11-30" → "30 Nov 2026" plus how many days are left; anything else is shown as written. */
function dueText(date: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || '');
  if (!m) return { text: date, days: null as number | null };
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((d.getTime() - today.getTime()) / 864e5);
  return { text: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }), days };
}

const MicButton: React.FC<{ dictation: ReturnType<typeof useDictation>; label: string }> = ({ dictation, label }) =>
  dictation.supported ? (
    <button type="button" onClick={dictation.listening ? dictation.stop : dictation.start} className={`btn h-11 w-11 shrink-0 p-0 ${dictation.listening ? 'btn-accent' : 'btn-outline'}`} aria-label={label} aria-pressed={dictation.listening}>
      {dictation.listening ? <MicOff className="h-4 w-4" aria-hidden /> : <Mic className="h-4 w-4" aria-hidden />}
    </button>
  ) : null;

/* ── The reply / appeal writer ───────────────────────────────────── */
const ReplyWriter: React.FC<{ reading: LetterReading; profile: BeneficiaryProfile; langConfig: Language; speaker: ReturnType<typeof useSpeaker> }> = ({ reading, profile, langConfig, speaker }) => {
  const address = [profile.residentialAddress, profile.district, profile.state, profile.pincode].filter(Boolean).join(', ');
  const [name, setName] = useState(profile.name || reading.official.addressedTo || '');
  const [where, setWhere] = useState(address);
  const [phone, setPhone] = useState(profile.phoneNumber || '');
  const [explanation, setExplanation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [letter, setLetter] = useState<DraftLetter | null>(null);
  const dictation = useDictation(langConfig.speechLocale, (heard) => setExplanation((t) => (t ? `${t} ${heard}` : heard)));

  const draft = async () => {
    setBusy(true);
    setError(null);
    try {
      const l = await helpApi.draftReply({ official: reading.official, replyKind: reading.replyKind, explanation, applicant: { name, address: where, phone } }, langConfig.name);
      setLetter(l);
      if (speaker.supported && l.explain.length) speaker.speak('reply', l.explain.join(' '));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const download = async () => {
    if (!letter) return;
    try {
      const blob = await helpApi.letterPdf(letter);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `UDAAN-ONE-${letter.replyKind}-letter.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <section className="card space-y-4 p-4 sm:p-6" aria-labelledby="reply-h">
      <div>
        <h2 id="reply-h" className="flex items-center gap-2 text-lg font-bold text-navy">
          <PenLine className="h-5 w-5 text-gold-600" aria-hidden /> {REPLY_LABEL[reading.replyKind]}
        </h2>
        <p className="mt-1 text-sm text-muted">Tell us in your own words what is wrong in the letter, or what has changed — speak or type in any language. We write a formal letter in English, the way offices expect it, ready to print and sign.</p>
      </div>
      <div className="flex gap-2">
        <label htmlFor="reply-why" className="sr-only">What is wrong, in your words</label>
        <textarea
          id="reply-why"
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          rows={3}
          placeholder="e.g. My name is spelt differently in Aadhaar and the bank. I have corrected it in the bank now."
          className="field min-h-24 flex-1 py-3"
        />
        <MicButton dictation={dictation} label="Say what is wrong" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-sm font-semibold text-navy">
          Your name
          <input value={name} onChange={(e) => setName(e.target.value)} className="field mt-1" autoComplete="name" translate="no" />
        </label>
        <label className="block text-sm font-semibold text-navy sm:col-span-2">
          Your address
          <input value={where} onChange={(e) => setWhere(e.target.value)} className="field mt-1" autoComplete="street-address" translate="no" />
        </label>
        <label className="block text-sm font-semibold text-navy">
          Phone
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="field mt-1" inputMode="tel" autoComplete="tel" translate="no" />
        </label>
      </div>
      <button onClick={draft} disabled={busy} className="btn btn-accent h-11">
        {busy ? <Spinner className="h-4 w-4" /> : <PenLine className="h-4 w-4" aria-hidden />} {letter ? 'Write it again' : 'Write the letter'}
      </button>
      {error && <Alert tone="danger" title={error} />}

      {letter && (
        <div className="space-y-4 animate-fade-up">
          <div className="rounded-2xl bg-ivory p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-bold text-navy">What this letter says</p>
              {speaker.supported && (
                <button onClick={() => (speaker.speakingId === 'reply' ? speaker.stop() : speaker.speak('reply', letter.explain.join(' ')))} className="btn btn-outline btn-sm">
                  {speaker.speakingId === 'reply' ? <Square className="h-3.5 w-3.5" aria-hidden /> : <Volume2 className="h-3.5 w-3.5" aria-hidden />} {speaker.speakingId === 'reply' ? 'Stop' : 'Listen'}
                </button>
              )}
            </div>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-navy" translate="no">
              {letter.explain.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
          {!!letter.toFill?.length && (
            <Alert tone="warning" title="Fill these blanks by hand before signing">
              <span translate="no">{letter.toFill.join(' · ')}</span>
            </Alert>
          )}
          <article className="rounded-2xl border border-line bg-white p-5 font-serif text-[15px] leading-relaxed text-navy shadow-sm sm:p-8" translate="no" aria-label="Letter preview">
            <p>To,</p>
            {letter.to.map((l) => (
              <p key={l}>{l}</p>
            ))}
            <p className="mt-4 font-bold">Subject: {letter.subject}</p>
            {letter.reference && <p className="font-bold">Reference: {letter.reference}</p>}
            <p className="mt-4">{letter.salutation}</p>
            {letter.body.map((p) => (
              <p key={p} className="mt-3">
                {p}
              </p>
            ))}
            <p className="mt-4">{letter.closing}</p>
            <p className="mt-8 font-bold">{letter.applicant.name || '[Your full name]'}</p>
            {!!letter.enclosures?.length && (
              <div className="mt-5">
                <p className="font-bold">Enclosures:</p>
                <ol className="list-decimal pl-6">
                  {letter.enclosures.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ol>
              </div>
            )}
          </article>
          <button onClick={download} className="btn btn-primary h-11">
            <Download className="h-4 w-4" aria-hidden /> Download the letter (PDF)
          </button>
        </div>
      )}
    </section>
  );
};

/* ── Read my letter ──────────────────────────────────────────────── */
export const ReadMyLetter: React.FC<Props> = ({ profile, langConfig }) => {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [names, setNames] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState<LetterReading | null>(null);
  const speaker = useSpeaker(langConfig.speechLocale);
  const resultRef = useRef<HTMLDivElement>(null);

  // A new language means the explanation must be read again in it
  useEffect(() => {
    speaker.stop();
    setReading(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [langConfig.code]);

  const addFiles = async (picked: File[]) => {
    setError(null);
    try {
      const prepared = await Promise.all(picked.slice(0, 8).map(prepareFile));
      setFiles((f) => [...f, ...prepared].slice(0, 8));
      setNames((n) => [...n, ...picked.map((p) => p.name)].slice(0, 8));
      setReading(null);
    } catch (e: any) {
      setError(e.message);
    }
  };
  const clear = () => {
    speaker.stop();
    setFiles([]);
    setNames([]);
    setText('');
    setReading(null);
    setError(null);
  };
  const read = async () => {
    setBusy(true);
    setError(null);
    setReading(null);
    speaker.stop();
    try {
      const r = await helpApi.readLetter({ text, files }, langConfig.name);
      setReading(r);
      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      // Reading aloud is the point for someone who cannot read the letter
      if (speaker.supported && r.readAloud) speaker.speak('letter', r.readAloud);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const nextDeadline = useMemo(() => {
    const dated = (reading?.deadlines || []).map((d) => ({ ...d, due: dueText(d.date) }));
    return dated.filter((d) => d.due.days !== null && d.due.days >= 0).sort((a, b) => (a.due.days! - b.due.days!))[0];
  }, [reading]);

  const canRead = files.length > 0 || text.trim().length > 20;

  return (
    <div className="space-y-6">
      <div className="card space-y-4 p-4 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <button onClick={() => setScanning(true)} className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gold/50 bg-gold-50 p-4 text-center transition hover:border-gold">
            <Camera className="h-8 w-8 text-gold-600" aria-hidden />
            <span className="text-base font-bold text-navy">Scan the letter with the camera</span>
            <span className="text-sm text-muted">One picture for each page</span>
          </button>
          <UploadZone onFiles={addFiles} accept="application/pdf,image/*" title="Or upload a photo or PDF" hint="Letters, notices, SMS screenshots" />
        </div>
        {names.length > 0 && (
          <p className="flex flex-wrap items-center gap-2 text-sm text-navy">
            <CheckCircle2 className="h-4 w-4 text-teal-600" aria-hidden />
            <span translate="no">{names.join(', ')}</span>
          </p>
        )}
        <label htmlFor="letter-text" className="sr-only">Or paste the text of the letter or message</label>
        <textarea id="letter-text" value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="Or paste the text of the letter or SMS here" className="field min-h-20 py-3" />
        <div className="flex flex-wrap gap-2">
          <button onClick={read} disabled={busy || !canRead} className="btn btn-accent h-12 px-6 text-base">
            {busy ? <Spinner className="h-4 w-4" /> : <FileSearch className="h-5 w-5" aria-hidden />} Read and explain it
          </button>
          {(files.length > 0 || text || reading) && (
            <button onClick={clear} className="btn btn-outline h-12">
              <RotateCcw className="h-4 w-4" aria-hidden /> New letter
            </button>
          )}
        </div>
        {busy && <p className="text-sm text-muted">Reading the letter… this takes about 10–20 seconds.</p>}
        {error && <Alert tone="danger" title={error} />}
        <p className="flex items-center gap-2 text-xs text-muted">
          <Lock className="h-3.5 w-3.5" aria-hidden /> Your letter is read and then forgotten — nothing is saved.
        </p>
      </div>

      {reading && (
        <div ref={resultRef} className="scroll-mt-24 space-y-4 animate-fade-up">
          {!reading.readable ? (
            <Alert tone="warning" title="We could not read this clearly">
              <span translate="no">{reading.title}</span> Try again with a brighter, straight photo of the whole page.
            </Alert>
          ) : (
            <>
              <section className="card p-4 sm:p-6" aria-labelledby="letter-title">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill tone={KIND[reading.kind].tone}>{KIND[reading.kind].label}</StatusPill>
                  <StatusPill tone={URGENCY[reading.urgency].tone}>{URGENCY[reading.urgency].label}</StatusPill>
                </div>
                <h2 id="letter-title" className="mt-3 text-2xl font-bold leading-snug text-navy" translate="no">
                  {reading.title}
                </h2>
                {reading.from && (
                  <p className="mt-1 text-sm text-muted">
                    From: <span translate="no">{reading.from}</span>
                  </p>
                )}
                {speaker.supported && (
                  <button onClick={() => (speaker.speakingId === 'letter' ? speaker.stop() : speaker.speak('letter', reading.readAloud))} className="btn btn-primary mt-4 h-12 px-5">
                    {speaker.speakingId === 'letter' ? <Square className="h-4 w-4" aria-hidden /> : <Volume2 className="h-5 w-5" aria-hidden />} {speaker.speakingId === 'letter' ? 'Stop reading' : 'Read it to me'}
                  </button>
                )}
                {nextDeadline && (
                  <div className={`mt-4 flex items-start gap-3 rounded-2xl p-4 ${nextDeadline.due.days! <= 15 ? 'bg-coral-50' : 'bg-saffron-50'}`}>
                    <CalendarClock className={`mt-0.5 h-6 w-6 shrink-0 ${nextDeadline.due.days! <= 15 ? 'text-coral-600' : 'text-saffron-600'}`} aria-hidden />
                    <div>
                      <p className="text-lg font-bold text-navy">
                        {nextDeadline.due.days === 0 ? 'Due today' : `${nextDeadline.due.days} day${nextDeadline.due.days === 1 ? '' : 's'} left`} · {nextDeadline.due.text}
                      </p>
                      <p className="text-sm text-navy" translate="no">
                        {nextDeadline.what}
                      </p>
                    </div>
                  </div>
                )}
              </section>

              {!!reading.warnings?.length && (
                <Alert tone="danger" title="Be careful">
                  <ul className="mt-1 list-disc space-y-0.5 pl-5" translate="no">
                    {reading.warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </Alert>
              )}

              <div className="grid gap-4 lg:grid-cols-2">
                <section className="card p-4 sm:p-6" aria-labelledby="says-h">
                  <h3 id="says-h" className="flex items-center gap-2 text-base font-bold text-navy">
                    <MailOpen className="h-5 w-5 text-gold-600" aria-hidden /> What the letter says
                  </h3>
                  <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-navy" translate="no">
                    {reading.summary.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                  {(reading.deadlines?.length || 0) > 0 && (
                    <ul className="mt-4 space-y-2">
                      {reading.deadlines!.map((d) => {
                        const due = dueText(d.date);
                        return (
                          <li key={d.what + d.date} className="flex gap-3 rounded-xl bg-ivory p-3 text-sm">
                            <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-saffron-600" aria-hidden />
                            <span>
                              <span className="font-bold text-navy">
                                {due.text}
                                {due.days !== null && due.days < 0 ? ' (date has passed)' : ''}
                              </span>{' '}
                              <span className="text-navy" translate="no">
                                — {d.what}
                              </span>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>

                <section className="card p-4 sm:p-6" aria-labelledby="do-h">
                  <h3 id="do-h" className="flex items-center gap-2 text-base font-bold text-navy">
                    <ListChecks className="h-5 w-5 text-teal-600" aria-hidden /> What to do now
                  </h3>
                  <ol className="mt-3 space-y-2" translate="no">
                    {reading.actions.map((a, i) => (
                      <li key={a} className="flex gap-3 text-sm leading-relaxed text-navy">
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-navy text-xs font-bold text-white">{i + 1}</span>
                        <span>{a}</span>
                      </li>
                    ))}
                  </ol>
                </section>
              </div>

              {(reading.reasons?.length || 0) > 0 && (
                <section className="card p-4 sm:p-6" aria-labelledby="why-h">
                  <h3 id="why-h" className="flex items-center gap-2 text-base font-bold text-navy">
                    <Wrench className="h-5 w-5 text-coral-600" aria-hidden /> Why, and how to fix it
                  </h3>
                  <ul className="mt-3 space-y-2" translate="no">
                    {reading.reasons!.map((r) => (
                      <li key={r.reason} className="rounded-xl border border-line p-3">
                        <p className="flex gap-2 text-sm font-bold text-navy">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-coral-600" aria-hidden /> {r.reason}
                        </p>
                        <p className="mt-1 flex gap-2 pl-6 text-sm text-navy">
                          <span aria-hidden>→</span> {r.fix}
                        </p>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {reading.canReply && reading.replyKind !== 'none' && <ReplyWriter key={reading.title} reading={reading} profile={profile} langConfig={langConfig} speaker={speaker} />}

              <p className="text-xs text-muted">This explanation is made by AI from your letter. For anything about money, a deadline or the law, confirm with the office that sent it.</p>
            </>
          )}
        </div>
      )}

      {scanning && (
        <CameraScanner
          title="Scan the letter"
          language={langConfig.code}
          onClose={() => setScanning(false)}
          onDone={(scanned) => {
            setScanning(false);
            setFiles((f) => [...f, ...scanned].slice(0, 8));
            setNames((n) => [...n, ...scanned.map((_, i) => `Page ${n.length + i + 1}`)].slice(0, 8));
            setReading(null);
          }}
        />
      )}
    </div>
  );
};

export const LetterHelpPage: React.FC<Props> = ({ profile, langConfig }) => (
  <div className="space-y-8">
    <header className="max-w-3xl">
      <p className="eyebrow">Letter help</p>
      <h1 className="mt-2 text-3xl font-extrabold text-navy sm:text-4xl">Got a letter you can't read? We'll read it to you</h1>
      <p className="mt-3 text-base leading-relaxed text-muted">
        Scan any letter from a government office, bank or school. We explain it in your language, read it aloud, tell you what to do and by when — and if your application was rejected, we write the appeal for you.
      </p>
    </header>
    <ReadMyLetter profile={profile} langConfig={langConfig} />
  </div>
);
