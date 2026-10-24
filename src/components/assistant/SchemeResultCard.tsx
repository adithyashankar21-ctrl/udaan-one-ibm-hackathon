import React, { useState } from 'react';
import { BookOpenCheck, ChevronDown, ExternalLink, FileText, ScanLine, ShieldQuestion } from 'lucide-react';
import type { BeneficiaryProfile } from '../../types';
import { type CatalogScheme, SCHEME_CATALOG, estimateEligibility } from '../../data/schemeCatalog';
import { FORM_SCHEMA_MAP } from '../../data/autofillSchema';
import { DOCUMENT_SERVICES } from '../../data/documentServices';
import { LOAN_PRODUCTS } from '../../data/loanCatalog';
import { StatusPill } from '../ui/kit';

/** Distinctive names used to spot a scheme mentioned in an AI reply. */
const SCHEME_NAMES: Record<string, RegExp> = {
  'pm-ajay': /PM[-\s]?AJAY|Abhyuday/i,
  'pm-daksh': /PM[-\s]?DAKSH|दक्ष/i,
  pmkvy: /PMKVY|Kaushal Vikas Yojana|कौशल विकास योजना/i,
  'pm-vishwakarma': /Vishwakarma|विश्वकर्मा|விஸ்வகர்மா|విశ్వకర్మ|ವಿಶ್ವಕರ್ಮ|വിശ്വകർമ/i,
  mudra: /MUDRA|मुद्रा|முத்ரா|ముద్ర|ಮುದ್ರಾ|മുദ്ര/i,
  nsfdc: /NSFDC|Scheduled Castes Finance/i,
  'stand-up-india': /Stand[-\s]?Up India|स्टैंड[-\s]?अप/i,
  'post-matric-sc': /Post[-\s]?Matric/i,
  ncs: /National Career Service|\bNCS\b/i,
  // Official documents & certificates
  'doc-pan': /\bPAN\b|Form 49A|e-PAN|पैन कार्ड/,
  'doc-voter': /voter ID|voter card|\bEPIC\b|Form 6\b|मतदाता पहचान|वोटर आईडी/i,
  'doc-passport': /passport(?![- ]size)|पासपोर्ट/i,
  'doc-aadhaar-update': /Aadhaar (address )?update|update (your )?Aadhaar|myAadhaar|आधार अपडेट/i,
  'doc-income': /income certificate|आय प्रमाण/i,
  'doc-caste': /caste certificate|community certificate|जाति प्रमाण/i,
  'doc-domicile': /domicile|residence certificate|निवास प्रमाण/i,
  'doc-birth': /birth certificate|जन्म प्रमाण/i,
  'doc-learner-dl': /driving licen[cs]e|learner.?s licen[cs]e|Sarathi|ड्राइविंग लाइसेंस/i,
  'doc-eshram': /e-?Shram/i,
  'doc-udid': /\bUDID\b|disability certificate|Swavlamban/i,
  'doc-ration': /ration card|राशन कार्ड/i,
  // Loans
  'loan-pmegp': /PMEGP|Employment Generation Programme/i,
  'loan-svanidhi': /SVANidhi|स्वनिधि/i,
  'loan-kcc': /Kisan Credit Card|\bKCC\b|किसान क्रेडिट/i,
  'loan-vidyalaxmi': /Vidya ?la(x|ksh)mi|विद्या ?लक्ष्मी/i,
  'loan-pmay-home': /PMAY|Awas Yojana|आवास योजना/i,
  'loan-cgtmse': /CGTMSE/i,
  'loan-shg': /self[- ]help group|\bSHG\b|NRLM|स्वयं सहायता/i,
  'loan-nbcfdc': /NBCFDC/i,
  'loan-nskfdc': /NSKFDC/i,
  'loan-nmdfc': /NMDFC/i,
  'loan-ahidf': /AHIDF/i,
  'loan-gold': /gold loan|गोल्ड लोन|सोने पर लोन/i,
  'loan-microfinance': /micro ?finance|माइक्रोफाइनेंस/i,
};

export function schemesMentioned(text: string): CatalogScheme[] {
  return [...SCHEME_CATALOG, ...DOCUMENT_SERVICES, ...LOAN_PRODUCTS].filter((s) => SCHEME_NAMES[s.id]?.test(text)).slice(0, 3);
}

const ELIG = {
  likely: { tone: 'success' as const, label: 'May be eligible' },
  'needs-info': { tone: 'warning' as const, label: 'Need more details' },
  unlikely: { tone: 'neutral' as const, label: 'May not match' },
};

/**
 * Structured scheme result. Facts come from the curated scheme catalog (with its official
 * source); the eligibility line is a preliminary estimate that needs official confirmation.
 */
export const SchemeResultCard: React.FC<{ scheme: CatalogScheme; profile: BeneficiaryProfile; onApply?: (id: string) => void }> = ({ scheme, profile, onApply }) => {
  const [open, setOpen] = useState(false);
  const est = estimateEligibility(scheme, profile);
  const canApply = Boolean(onApply && FORM_SCHEMA_MAP[scheme.id]);
  const isDocument = (scheme as any).kind === 'document';
  const officialForm: string | undefined = (scheme as any).officialForm;
  return (
    <article className="rounded-2xl border border-line bg-white p-4 shadow-card animate-fade-up">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <StatusPill tone="info" icon={BookOpenCheck}>{isDocument ? 'Official document service' : (scheme as any).kind === 'loan' ? 'Loan facts' : 'Scheme facts'} · official source linked</StatusPill>
          <h4 className="mt-2 font-bold leading-snug text-navy">{scheme.name}</h4>
          <p className="text-xs text-muted">{scheme.ministry}</p>
          {officialForm && <p className="mt-0.5 text-xs font-semibold text-teal-600">Official form: {officialForm}</p>}
        </div>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-navy/85">{scheme.summary}</p>

      <div className="mt-3 rounded-xl bg-ivory p-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">Why it may be relevant</p>
          <StatusPill tone={ELIG[est.level].tone} icon={ShieldQuestion}>
            {ELIG[est.level].label} · needs official confirmation
          </StatusPill>
        </div>
        <ul className="mt-1.5 space-y-0.5 text-xs text-navy/80">
          {est.reasons.map((r) => (
            <li key={r}>• {r}</li>
          ))}
        </ul>
      </div>

      {open && (
        <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2 animate-fade-up">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted">Who can apply</p>
            <p className="mt-1 text-navy">{scheme.eligibilitySummary}</p>
            <p className="mt-3 text-xs font-bold uppercase tracking-wider text-muted">Support</p>
            <ul className="mt-1 space-y-0.5 text-navy">
              {scheme.keySupport.map((k) => (
                <li key={k}>• {k}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted">Documents usually needed</p>
            <ul className="mt-1 space-y-1">
              {scheme.documents.map((d) => (
                <li key={d} className="flex items-center gap-1.5 text-navy">
                  <FileText className="h-3.5 w-3.5 text-saffron-600" aria-hidden /> {d}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {canApply && (
          <button onClick={() => onApply!(scheme.id)} className="btn btn-accent btn-sm">
            <ScanLine className="h-4 w-4" aria-hidden /> {isDocument ? 'Prepare application' : 'Start application'}
          </button>
        )}
        <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="btn btn-ghost btn-sm">
          {open ? 'Less' : 'Eligibility & documents'} <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
        </button>
        <a href={scheme.officialUrl} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-teal-600 hover:underline">
          Source: {scheme.officialLabel} <ExternalLink className="h-3 w-3" aria-hidden />
        </a>
      </div>
    </article>
  );
};
