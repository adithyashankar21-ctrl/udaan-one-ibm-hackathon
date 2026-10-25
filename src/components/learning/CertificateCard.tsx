import React from 'react';
import type { Certificate } from '../../services/learnApi';
import { pdfTitle, printElement } from '../../services/printDocument';

/** The UDAAN ONE certificate of completion itself, and how it prints (one A4 landscape page). */

export const formatDate = (t: number) => new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
export const verifyLink = (id: string) => `${window.location.origin}/?verify=${id}`;

/* ── The certificate ───────────────────────────────────────────────── */

/** A small L-shaped ornament for each corner of the frame. */
const Corner: React.FC<{ at: string }> = ({ at }) => <span aria-hidden className={`pointer-events-none absolute h-7 w-7 border-saffron ${at}`} />;

export const CertificateCard: React.FC<{ cert: Certificate; officialRoute?: { label: string; url: string } }> = ({ cert, officialRoute }) => (
  <article className="print-certificate relative mx-auto w-full max-w-3xl overflow-hidden rounded-[22px] border-[6px] border-double border-saffron/70 bg-[#fffdf7] p-6 text-center text-navy shadow-card sm:p-10" aria-label="Certificate">
    <div className="pointer-events-none absolute inset-3 rounded-[14px] border border-saffron/30" aria-hidden />
    <Corner at="left-5 top-5 border-l-2 border-t-2 rounded-tl-lg" />
    <Corner at="right-5 top-5 border-r-2 border-t-2 rounded-tr-lg" />
    <Corner at="bottom-5 left-5 border-b-2 border-l-2 rounded-bl-lg" />
    <Corner at="bottom-5 right-5 border-b-2 border-r-2 rounded-br-lg" />
    <div className="relative">
      <div className="flex items-center justify-center gap-3">
        <span className="cert-logo grid h-12 w-12 place-items-center rounded-2xl bg-navy text-lg font-extrabold text-white" aria-hidden>
          U1
        </span>
        <div className="text-left">
          <p className="cert-brand text-lg font-extrabold tracking-wide">UDAAN ONE</p>
          <p className="text-[11px] text-muted">Learning Hub</p>
        </div>
      </div>
      <p className="cert-title mt-6 font-serif text-2xl font-bold tracking-wide text-saffron-600 sm:text-3xl">Certificate of Completion</p>
      <div className="mx-auto mt-2 h-px w-24 bg-saffron/60" aria-hidden />
      <p className="cert-small mt-5 text-sm text-muted">This is to certify that</p>
      <p translate="no" className="cert-name mt-2 font-serif text-3xl font-bold sm:text-4xl">
        {cert.name}
      </p>
      <p className="cert-body mx-auto mt-4 max-w-xl text-sm leading-relaxed sm:text-base">
        has successfully completed the course <strong>{cert.courseTitle}</strong> on the UDAAN ONE Learning Hub, covering {cert.modules.length} modules, and passed the final assessment with a score of{' '}
        <strong>
          {cert.score} / {cert.total}
        </strong>
        .
      </p>
      {cert.modules.length > 0 && <p className="cert-small mx-auto mt-3 max-w-xl text-xs leading-relaxed text-muted">{cert.modules.join(' · ')}</p>}

      <div className="mt-8 grid grid-cols-3 items-end gap-4 text-sm">
        <div>
          <p className="cert-meta font-semibold">{formatDate(cert.issuedAt)}</p>
          <div className="mx-auto mt-1 h-px w-36 bg-navy/30" aria-hidden />
          <p className="mt-1 text-[11px] uppercase tracking-wider text-muted">Date of issue</p>
        </div>
        <div className="flex justify-center" aria-hidden>
          <span className="cert-seal grid h-20 w-20 place-items-center rounded-full border-[3px] border-double border-saffron bg-saffron-50 text-center leading-tight text-saffron-600">
            <span>
              <span className="block text-[18px] font-extrabold">U1</span>
              <span className="block text-[8px] font-bold uppercase tracking-wider">Verified</span>
            </span>
          </span>
        </div>
        <div>
          <p className="cert-meta font-semibold">UDAAN ONE Learning Hub</p>
          <div className="mx-auto mt-1 h-px w-36 bg-navy/30" aria-hidden />
          <p className="mt-1 text-[11px] uppercase tracking-wider text-muted">Issued digitally</p>
        </div>
      </div>

      <p translate="no" className="cert-small mt-6 text-xs text-muted">
        Certificate ID <span className="font-mono font-semibold tracking-wider text-navy">{cert.id}</span>
        <span className="mx-2">·</span>
        Check it at <span className="whitespace-nowrap font-mono font-semibold text-navy">{verifyLink(cert.id).replace(/^https?:\/\//, '')}</span>
      </p>
      <p className="mx-auto mt-3 max-w-xl text-[10.5px] leading-relaxed text-muted">
        A UDAAN ONE learning certificate for completing this course and its assessment. It is not an NSQF, Sector Skill Council or government certification.
        {officialRoute && ` For the official certification: ${officialRoute.label}.`}
      </p>
    </div>
  </article>
);

/** The certificate filling one A4 landscape page (the frame sits 10 mm in from the paper's edge). */
export const CERTIFICATE_PRINT_CSS = `
html, body { height: 190mm; overflow: hidden; }
body { display: flex; align-items: stretch; justify-content: center; }
.print-certificate { max-width: none !important; width: 100%; height: 190mm; box-sizing: border-box; margin: 0 !important; display: flex; align-items: center; justify-content: center; box-shadow: none !important; padding: 12mm 26mm !important; }
.print-certificate > .relative { width: 100%; }
.print-certificate .cert-logo { width: 58px; height: 58px; font-size: 22px; }
.print-certificate .cert-brand { font-size: 22px; }
.print-certificate .cert-title { font-size: 34px; margin-top: 18px; }
.print-certificate .cert-name { font-size: 50px; margin-top: 10px; }
.print-certificate .cert-body { font-size: 17px; max-width: 165mm; }
.print-certificate .cert-small { font-size: 13px; }
.print-certificate .cert-meta { font-size: 15px; }
.print-certificate .cert-seal { width: 92px; height: 92px; }
`;

/** Prints just this certificate, on one A4 landscape page. */
export const printCertificate = (el: HTMLElement | null, cert: Certificate) => {
  if (el) printElement(el, { title: pdfTitle('UDAAN ONE certificate', cert.courseTitle, cert.id), orientation: 'landscape', marginMm: 10, css: CERTIFICATE_PRINT_CSS });
};

