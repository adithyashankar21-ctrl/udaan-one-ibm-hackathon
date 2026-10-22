import React, { useEffect, useState } from 'react';
import { Award, CheckCircle2, Printer, RotateCcw, ShieldCheck, X, XCircle } from 'lucide-react';
import type { LearningCourse } from '../../data/learningTracks';
import { autofillApi } from '../../services/autofillApi';
import { gradeExam, startExam, verifyCertificate, type Certificate, type ExamQuestion, type ExamResult } from '../../services/learnApi';
import { Spinner } from '../ui/kit';

/**
 * UDAAN ONE certificates of completion: the final assessment that earns one, the certificate
 * itself (printable, or saved as PDF from the print window), the learner's list, and the public
 * check by certificate ID.
 */

const formatDate = (t: number) => new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
export const verifyLink = (id: string) => `${window.location.origin}/?verify=${id}`;

/* ── The certificate ───────────────────────────────────────────────── */

export const CertificateCard: React.FC<{ cert: Certificate; officialRoute?: { label: string; url: string } }> = ({ cert, officialRoute }) => (
  <article className="print-certificate relative mx-auto w-full max-w-3xl overflow-hidden rounded-[22px] border-[6px] border-double border-saffron/70 bg-[#fffdf7] p-6 text-center text-navy shadow-card sm:p-10" aria-label="Certificate">
    <div className="pointer-events-none absolute inset-3 rounded-[14px] border border-saffron/30" aria-hidden />
    <div className="relative">
      <div className="flex items-center justify-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-navy text-lg font-extrabold text-white" aria-hidden>
          U1
        </span>
        <div className="text-left">
          <p className="text-lg font-extrabold tracking-wide">UDAAN ONE</p>
          <p className="text-[11px] text-muted">Learning Hub</p>
        </div>
      </div>
      <p className="mt-6 text-xs font-bold uppercase tracking-[0.3em] text-saffron-600">Certificate of Completion</p>
      <p className="mt-5 text-sm text-muted">This is to certify that</p>
      <p translate="no" className="mt-2 font-serif text-3xl font-bold sm:text-4xl">
        {cert.name}
      </p>
      <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed sm:text-base">
        has successfully completed the course <strong>{cert.courseTitle}</strong> on the UDAAN ONE Learning Hub, covering {cert.modules.length} modules, and passed the final assessment with a score of{' '}
        <strong>
          {cert.score} / {cert.total}
        </strong>
        .
      </p>
      {cert.modules.length > 0 && <p className="mx-auto mt-3 max-w-xl text-xs leading-relaxed text-muted">{cert.modules.join(' · ')}</p>}
      <div className="mt-8 grid gap-4 text-sm sm:grid-cols-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted">Date</p>
          <p className="font-semibold">{formatDate(cert.issuedAt)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-muted">Certificate ID</p>
          <p translate="no" className="font-mono font-semibold tracking-wider">
            {cert.id}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-muted">Check it at</p>
          <p translate="no" className="break-all font-mono text-xs font-semibold">
            {verifyLink(cert.id).replace(/^https?:\/\//, '')}
          </p>
        </div>
      </div>
      <p className="mx-auto mt-8 max-w-xl text-[11px] leading-relaxed text-muted">
        A UDAAN ONE learning certificate for completing this course and its assessment. It is not an NSQF, Sector Skill Council or government certification.
        {officialRoute && ` For the official certification: ${officialRoute.label}.`}
      </p>
    </div>
  </article>
);

export const CertificateDialog: React.FC<{ cert: Certificate; officialRoute?: { label: string; url: string }; onClose: () => void }> = ({ cert, officialRoute, onClose }) => (
  <div className="fixed inset-0 z-[70] overflow-y-auto bg-navy/70 p-4 backdrop-blur-sm print:bg-white print:p-0" role="dialog" aria-modal="true" aria-label="Your certificate">
    <div className="mx-auto my-6 max-w-3xl print:m-0">
      <div className="mb-3 flex flex-wrap justify-end gap-2 print:hidden">
        <button onClick={() => window.print()} className="btn btn-success">
          <Printer className="h-4 w-4" aria-hidden /> Print or save as PDF
        </button>
        <button onClick={onClose} className="btn btn-on-dark" aria-label="Close">
          <X className="h-4 w-4" aria-hidden /> Close
        </button>
      </div>
      <CertificateCard cert={cert} officialRoute={officialRoute} />
    </div>
  </div>
);

/* ── The final assessment ──────────────────────────────────────────── */

export const FinalAssessment: React.FC<{ course: LearningCourse; language: string; ready: boolean; remaining: number; earned?: Certificate | null; onEarned: (c: Certificate) => void }> = ({
  course,
  language,
  ready,
  remaining,
  earned,
  onEarned,
}) => {
  const [exam, setExam] = useState<{ examId: string; questions: ExamQuestion[] } | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<ExamResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCert, setShowCert] = useState<Certificate | null>(null);

  const begin = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const e = await startExam(course, language);
      setExam(e);
      setAnswers(e.questions.map(() => -1));
    } catch (err: any) {
      setError(err?.message || 'Could not start the assessment.');
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!exam) return;
    setBusy(true);
    setError(null);
    try {
      const r = await gradeExam(exam.examId, answers);
      setResult(r);
      if (r.passed && r.passToken) {
        const cert = await autofillApi.issueCertificate(r.passToken);
        onEarned(cert);
        setShowCert(cert);
      }
    } catch (err: any) {
      setError(err?.message || 'Could not mark the assessment.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card border-saffron/40 p-5 sm:p-6" aria-labelledby="final-h">
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-saffron-50 text-saffron-600">
          <Award className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="final-h" className="text-lg font-extrabold text-navy">
            UDAAN ONE certificate
          </h2>
          <p className="text-sm text-muted">
            {earned
              ? `Earned with ${earned.score} / ${earned.total}. You can take the assessment again to improve your score.`
              : ready
                ? 'You have finished every topic. Pass the final assessment (70% or more) to get your certificate.'
                : `Finish the ${remaining} remaining ${remaining === 1 ? 'topic' : 'topics'}, then pass the final assessment to get your certificate.`}
          </p>
        </div>
        {earned && (
          <button onClick={() => setShowCert(earned)} className="btn btn-success btn-sm">
            <Award className="h-4 w-4" aria-hidden /> View certificate
          </button>
        )}
        {ready && !exam && (
          <button onClick={begin} disabled={busy} className="btn btn-accent btn-sm">
            {busy ? <Spinner className="h-4 w-4" /> : null} {earned ? 'Take it again' : 'Start final assessment'}
          </button>
        )}
      </div>

      {exam && !result && (
        <ol className="mt-5 space-y-5">
          {exam.questions.map((q, i) => (
            <li key={i}>
              <p className="font-semibold text-navy">
                {i + 1}. {q.question}
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {q.options.map((o, j) => (
                  <label key={j} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm ${answers[i] === j ? 'border-teal bg-teal-50' : 'border-line bg-white hover:border-teal/50'}`}>
                    <input type="radio" name={`q${i}`} checked={answers[i] === j} onChange={() => setAnswers((a) => a.map((x, k) => (k === i ? j : x)))} className="accent-teal" />
                    {o}
                  </label>
                ))}
              </div>
            </li>
          ))}
          <li className="list-none">
            <button onClick={submit} disabled={busy || answers.some((a) => a < 0)} className="btn btn-primary btn-lg w-full">
              {busy ? <Spinner className="h-5 w-5" /> : null} Submit answers
            </button>
            {answers.some((a) => a < 0) && <p className="mt-2 text-center text-xs text-muted">Answer every question to submit.</p>}
          </li>
        </ol>
      )}

      {exam && result && (
        <div className="mt-5">
          <p className={`rounded-2xl p-4 text-base font-bold ${result.passed ? 'bg-green-50 text-green' : 'bg-coral-50 text-coral-600'}`} role="status">
            {result.passed ? `Passed — ${result.score} / ${result.total}. Your certificate is ready.` : `${result.score} / ${result.total}. You need ${result.passMark} to pass. Review the lessons and try again.`}
          </p>
          <ol className="mt-4 space-y-3">
            {exam.questions.map((q, i) => {
              const r = result.results[i];
              const right = r?.chosen === r?.correct;
              return (
                <li key={i} className="flex gap-2 text-sm">
                  {right ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green" aria-label="Correct" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-coral-600" aria-label="Wrong" />}
                  <span>
                    <span className="font-semibold text-navy">{q.question}</span>
                    {!right && r && <span className="block text-muted">Answer: {q.options[r.correct]}</span>}
                    {r?.explanation && <span className="block text-muted">{r.explanation}</span>}
                  </span>
                </li>
              );
            })}
          </ol>
          <button
            onClick={() => {
              setExam(null);
              setResult(null);
            }}
            className="btn btn-outline mt-4"
          >
            <RotateCcw className="h-4 w-4" aria-hidden /> {result.passed ? 'Done' : 'Try again later'}
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-coral-50 p-3 text-sm text-coral-600">
          {error}
        </p>
      )}
      {showCert && <CertificateDialog cert={showCert} officialRoute={course.certification} onClose={() => setShowCert(null)} />}
    </section>
  );
};

/* ── The learner's certificates ────────────────────────────────────── */

export const MyCertificates: React.FC<{ certificates: Certificate[] }> = ({ certificates }) => {
  const [open, setOpen] = useState<Certificate | null>(null);
  if (!certificates.length) return null;
  return (
    <section aria-labelledby="mycert-h" className="space-y-4">
      <h2 id="mycert-h" className="flex items-center gap-2 text-xl font-extrabold text-navy">
        <Award className="h-5 w-5 text-saffron-600" aria-hidden /> My certificates
      </h2>
      <ul className="grid gap-3 md:grid-cols-2">
        {certificates.map((c) => (
          <li key={c.id} className="card flex items-center gap-4 p-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-saffron-50 text-saffron-600">
              <Award className="h-5 w-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-bold text-navy">{c.courseTitle}</span>
              <span className="text-xs text-muted">
                {formatDate(c.issuedAt)} · {c.score}/{c.total} · <span translate="no">{c.id}</span>
              </span>
            </span>
            <button onClick={() => setOpen(c)} className="btn btn-outline btn-sm">
              View
            </button>
          </li>
        ))}
      </ul>
      {open && <CertificateDialog cert={open} onClose={() => setOpen(null)} />}
    </section>
  );
};

/* ── Public check by certificate ID (no sign-in) ───────────────────── */

export const VerifyCertificate: React.FC<{ id: string }> = ({ id }) => {
  const [state, setState] = useState<{ loading: boolean; cert: Certificate | null }>({ loading: true, cert: null });
  useEffect(() => {
    verifyCertificate(id).then((cert) => setState({ loading: false, cert }));
  }, [id]);
  return (
    <div className="min-h-screen bg-ivory px-4 py-10">
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="flex items-center gap-3">
          <ShieldCheck className={`h-7 w-7 ${state.cert ? 'text-green' : 'text-muted'}`} aria-hidden />
          <h1 className="text-2xl font-extrabold text-navy">Certificate check</h1>
        </div>
        {state.loading ? (
          <Spinner className="h-6 w-6" label="Checking" />
        ) : state.cert ? (
          <>
            <p className="rounded-2xl bg-green-50 p-4 font-semibold text-green" role="status">
              This is a genuine UDAAN ONE certificate.
            </p>
            <CertificateCard cert={state.cert} />
          </>
        ) : (
          <p className="rounded-2xl bg-coral-50 p-4 font-semibold text-coral-600" role="status">
            No UDAAN ONE certificate has the ID <span translate="no">{id}</span>. Check the ID and try again.
          </p>
        )}
        <a href="/" className="btn btn-outline">
          Go to UDAAN ONE
        </a>
      </div>
    </div>
  );
};
