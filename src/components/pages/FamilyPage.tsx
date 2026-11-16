import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, HeartHandshake, Home, Mic, MicOff, Plus, ScanLine, Sparkles, Square, Trash2, Users, Volume2 } from 'lucide-react';
import type { BeneficiaryProfile, ChannelMode, Language } from '../../types';
import { autofillApi } from '../../services/autofillApi';
import { familyApi } from '../../services/helpApi';
import { spokenIn } from '../../services/translate';
import {
  RELATIONS,
  WORK_LABEL,
  cleanHousehold,
  familySummary,
  newMemberId,
  relationLabel,
  type FamilyMatch,
  type Household,
  type Member,
  type Work,
} from '../../data/familySchemes';
import { useDictation } from '../smartapply/media';
import { useSpeaker } from '../learning/useSpeaker';
import { Alert, Spinner, StatusPill } from '../ui/kit';
import { ExploreTabs } from './DocumentsPage';

interface Props {
  profile: BeneficiaryProfile;
  langConfig: Language;
  onApply: (id: string, byVoice?: boolean) => void;
  onNavigate: (m: ChannelMode) => void;
}

const LOCAL_KEY = 'udaan.household.v1';
const readLocal = (): Household | null => {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? cleanHousehold(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
};
const writeLocal = (h: Household) => {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(h));
  } catch {}
};

/** The person themselves, from their profile. */
function selfFromProfile(p: BeneficiaryProfile): Member {
  const age = Number(p.age);
  const occ = `${p.currentOccupation || ''} ${p.traditionalTrade || ''}`.toLowerCase();
  const work: Work | undefined = /farm|kisan|agri|dairy|fish/.test(occ)
    ? 'farmer'
    : p.traditionalTrade && !/none|no$/i.test(p.traditionalTrade)
      ? 'artisan'
      : /labou?r|daily|wage|construction|vendor|domestic|driver/.test(occ)
        ? 'unorganised'
        : /unemploy|looking|seeking/.test(occ)
          ? 'seeking'
          : undefined;
  return {
    id: 'self',
    relation: 'self',
    name: p.name || undefined,
    age: Number.isFinite(age) && age > 0 ? age : undefined,
    gender: p.gender === 'Female' || p.gender === 'Male' ? p.gender : undefined,
    work,
    disability: p.disabilityStatus && p.disabilityStatus !== 'None' ? true : undefined,
  };
}

function householdFromProfile(p: BeneficiaryProfile): Household {
  const cat = (p.socialCategory || '').toUpperCase();
  const income = Number(String((p as any).annualFamilyIncome || '').replace(/[^\d.]/g, ''));
  return {
    members: [selfFromProfile(p)],
    category: /\bSC\b|SCHEDULED CASTE/.test(cat) ? 'SC' : /\bST\b|SCHEDULED TRIBE/.test(cat) ? 'ST' : /OBC/.test(cat) ? 'OBC' : /EWS/.test(cat) ? 'EWS' : /GEN/.test(cat) ? 'General' : undefined,
    annualIncome: income > 0 ? income : undefined,
  };
}

/** Yes / No / Not sure, for household facts that may be unknown. */
const TriState: React.FC<{ label: string; value?: boolean; onChange: (v: boolean | undefined) => void }> = ({ label, value, onChange }) => (
  <fieldset className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line px-3 py-2">
    <legend className="sr-only">{label}</legend>
    <span className="text-sm font-semibold text-navy" aria-hidden>
      {label}
    </span>
    <span className="inline-flex rounded-lg bg-ivory p-0.5">
      {([
        [true, 'Yes'],
        [false, 'No'],
        [undefined, 'Not sure'],
      ] as Array<[boolean | undefined, string]>).map(([v, t]) => (
        <button
          key={t}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={`min-h-11 rounded-md px-3 text-xs font-semibold transition ${value === v ? 'bg-navy text-white' : 'text-muted hover:text-navy'}`}
        >
          {t}
        </button>
      ))}
    </span>
  </fieldset>
);

const Toggle: React.FC<{ on?: boolean; label: string; onChange: (v: boolean) => void }> = ({ on, label, onChange }) => (
  <button type="button" aria-pressed={!!on} onClick={() => onChange(!on)} className={`min-h-11 rounded-full border px-3 text-xs font-semibold transition ${on ? 'border-navy bg-navy text-white' : 'border-line bg-white text-navy hover:border-navy-700/40'}`}>
    {label}
  </button>
);

const MemberEditor: React.FC<{ m: Member; onChange: (m: Member) => void; onRemove?: () => void }> = ({ m, onChange, onRemove }) => {
  const set = (patch: Partial<Member>) => onChange({ ...m, ...patch });
  const female = m.gender === 'Female' || (!m.gender && ['mother', 'daughter', 'grandmother', 'sister'].includes(m.relation)) || (m.relation === 'spouse' && m.gender !== 'Male');
  return (
    <li className="rounded-2xl border border-line bg-white p-3 sm:p-4">
      <div className="grid gap-2 sm:grid-cols-[1.1fr_1.2fr_0.6fr_0.9fr]">
        <label className="text-xs font-semibold text-muted">
          Who
          <select value={m.relation} onChange={(e) => set({ relation: e.target.value as Member['relation'] })} className="field mt-1" disabled={m.relation === 'self'}>
            {RELATIONS.filter((r) => r.id !== 'self' || m.relation === 'self').map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-muted">
          Name (optional)
          <input value={m.name || ''} onChange={(e) => set({ name: e.target.value || undefined })} className="field mt-1" translate="no" />
        </label>
        <label className="text-xs font-semibold text-muted">
          Age
          <input value={m.age ?? ''} onChange={(e) => set({ age: e.target.value === '' ? undefined : Math.max(0, Math.min(120, Number(e.target.value.replace(/\D/g, '')))) })} inputMode="numeric" className="field mt-1" />
        </label>
        <label className="text-xs font-semibold text-muted">
          Gender
          <select value={m.gender || ''} onChange={(e) => set({ gender: (e.target.value || undefined) as Member['gender'] })} className="field mt-1">
            <option value="">—</option>
            <option value="Female">Female</option>
            <option value="Male">Male</option>
            <option value="Other">Other</option>
          </select>
        </label>
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <label className="text-xs font-semibold text-muted">
          Work
          <select value={m.work || ''} onChange={(e) => set({ work: (e.target.value || undefined) as Work })} className="field mt-1">
            <option value="">—</option>
            {(Object.keys(WORK_LABEL) as Work[]).map((w) => (
              <option key={w} value={w}>
                {WORK_LABEL[w]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-muted">
          Studies
          <select value={m.study || ''} onChange={(e) => set({ study: (e.target.value || undefined) as Member['study'] })} className="field mt-1">
            <option value="">—</option>
            <option value="none">Not studying</option>
            <option value="school">In school</option>
            <option value="college">College / ITI</option>
          </select>
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {female && <Toggle on={m.pregnant} label="Pregnant" onChange={(v) => set({ pregnant: v || undefined })} />}
        {female && <Toggle on={m.widow} label="Widow" onChange={(v) => set({ widow: v || undefined })} />}
        <Toggle on={m.disability} label="Has a disability" onChange={(v) => set({ disability: v || undefined })} />
        {onRemove && (
          <button type="button" onClick={onRemove} className="btn btn-danger btn-sm ml-auto min-h-11">
            <Trash2 className="h-3.5 w-3.5" aria-hidden /> Remove
          </button>
        )}
      </div>
    </li>
  );
};

const MatchList: React.FC<{ matches: FamilyMatch[]; onApply: (id: string) => void }> = ({ matches, onApply }) => (
  <ul className="space-y-2">
    {matches.map(({ scheme, fit, why }) => (
      <li key={scheme.id} className="rounded-xl border border-line p-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="text-sm font-bold text-navy">{scheme.name}</p>
          <StatusPill tone={fit === 'likely' ? 'success' : 'warning'}>{fit === 'likely' ? 'Likely fits' : 'Worth checking'}</StatusPill>
        </div>
        <p className="mt-1 text-sm text-navy">{scheme.benefit}</p>
        <p className="mt-1 text-xs text-muted">{why}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {scheme.applyId && (
            <button onClick={() => onApply(scheme.applyId!)} className="btn btn-accent btn-sm min-h-11">
              <ScanLine className="h-3.5 w-3.5" aria-hidden /> Apply with Smart Apply
            </button>
          )}
          <a href={scheme.url} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm min-h-11">
            {scheme.label} <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        </div>
      </li>
    ))}
  </ul>
);

export const FamilyPage: React.FC<Props> = ({ profile, langConfig, onApply, onNavigate }) => {
  const [household, setHousehold] = useState<Household>(() => readLocal() || householdFromProfile(profile));
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [heard, setHeard] = useState(false);
  const loaded = useRef(false);
  const speaker = useSpeaker(langConfig.speechLocale);
  const resultsRef = useRef<HTMLElement>(null);

  // The household kept with the account wins over this browser's copy
  useEffect(() => {
    autofillApi
      .household()
      .then((h) => h && h.members.length && setHousehold(cleanHousehold(h)))
      .catch(() => {})
      .finally(() => (loaded.current = true));
  }, []);
  // Save (debounced) to the account and this browser
  useEffect(() => {
    writeLocal(household);
    if (!loaded.current) return;
    const t = setTimeout(() => autofillApi.saveHousehold(household).catch(() => {}), 800);
    return () => clearTimeout(t);
  }, [household]);

  const summary = useMemo(() => familySummary(household), [household]);
  const setMember = (id: string, m: Member) => setHousehold((h) => ({ ...h, members: h.members.map((x) => (x.id === id ? m : x)) }));
  const addMember = () => setHousehold((h) => ({ ...h, members: [...h.members, { id: newMemberId(), relation: 'other' }] }));
  const removeMember = (id: string) => setHousehold((h) => ({ ...h, members: h.members.filter((x) => x.id !== id) }));
  const setFact = <K extends keyof Household>(k: K, v: Household[K]) => setHousehold((h) => ({ ...h, [k]: v }));

  const understand = async (said: string) => {
    if (!said.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const got = await familyApi.understand(said);
      setHousehold((h) => {
        // Keep what is already known about "me"; add everyone else that was heard
        const mine = h.members.find((m) => m.relation === 'self');
        const heardSelf = got.members.find((m) => m.relation === 'self');
        const self = mine ? { ...mine, ...Object.fromEntries(Object.entries(heardSelf || {}).filter(([k, v]) => v !== undefined && k !== 'id')), id: mine.id } : heardSelf;
        const others = got.members.filter((m) => m.relation !== 'self');
        const facts = Object.fromEntries(Object.entries(got).filter(([k, v]) => k !== 'members' && v !== undefined));
        return { ...h, ...facts, members: [...(self ? [self as Member] : []), ...others] };
      });
      setHeard(true);
      requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const dictation = useDictation(langConfig.speechLocale, (said) => {
    setText((t) => (t ? `${t} ${said}` : said));
    understand(text ? `${text} ${said}` : said);
  });

  const listen = async () => {
    if (speaker.speakingId === 'family') return speaker.stop();
    const parts = [
      `We found ${summary.total} benefits your family may get.`,
      ...summary.people
        .filter((p) => p.matches.length)
        .map((p) => `For ${p.member.relation === 'self' ? 'you' : `your ${relationLabel(p.member.relation).toLowerCase()}`}: ${p.matches.map((x) => x.scheme.name).join(', ')}.`),
      summary.household.length ? `For the whole family: ${summary.household.map((x) => x.scheme.name).join(', ')}.` : '',
      'Please confirm each one on the official website or at the office.',
    ];
    speaker.speak('family', await spokenIn(langConfig.code, ...parts));
  };

  const nameOf = (m: Member) => (m.relation === 'self' ? 'You' : relationLabel(m.relation));

  return (
    <div className="space-y-8">
      <ExploreTabs current="schemes" onNavigate={onNavigate} />
      <header className="max-w-3xl">
        <p className="eyebrow">Family benefits</p>
        <h1 className="mt-2 text-3xl font-extrabold text-navy sm:text-4xl">One family. Every benefit, for every person.</h1>
        <p className="mt-3 text-base leading-relaxed text-muted">
          Tell us who lives with you — by voice or by typing. We check pensions, maternity support, scholarships, health cover, housing and more for each person, and show what to apply for first.
        </p>
      </header>

      <section className="card space-y-3 p-4 sm:p-6" aria-labelledby="fam-say">
        <h2 id="fam-say" className="flex items-center gap-2 text-lg font-bold text-navy">
          <Users className="h-5 w-5 text-saffron-600" aria-hidden /> Tell us about your family
        </h2>
        <div className="flex gap-2">
          <label htmlFor="fam-text" className="sr-only">Describe your family</label>
          <textarea
            id="fam-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="e.g. I am 34 and do daily wage work. My wife is pregnant. My mother is 66 and a widow. My daughter is 7, my son is in class 11. We live in a village, have a yellow ration card and cook on a chulha."
            className="field min-h-24 flex-1 py-3"
          />
          {dictation.supported && (
            <button type="button" onClick={dictation.listening ? dictation.stop : dictation.start} className={`btn h-11 w-11 shrink-0 p-0 ${dictation.listening ? 'btn-accent' : 'btn-outline'}`} aria-label="Say it" aria-pressed={dictation.listening}>
              {dictation.listening ? <MicOff className="h-4 w-4" aria-hidden /> : <Mic className="h-4 w-4" aria-hidden />}
            </button>
          )}
        </div>
        <button onClick={() => understand(text)} disabled={busy || text.trim().split(/\s+/).length < 3} className="btn btn-accent h-11">
          {busy ? <Spinner className="h-4 w-4" /> : <Sparkles className="h-4 w-4" aria-hidden />} Find benefits for my family
        </button>
        {heard && !busy && <p className="text-sm text-teal-600">Added what we heard below — check each person and correct anything.</p>}
        {error && <Alert tone="danger" title={error} />}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.05fr_1fr]">
        <section className="space-y-4" aria-labelledby="fam-people">
          <div className="flex items-center justify-between gap-2">
            <h2 id="fam-people" className="text-lg font-bold text-navy">
              Your family ({household.members.length})
            </h2>
            <button onClick={addMember} className="btn btn-outline btn-sm min-h-11">
              <Plus className="h-4 w-4" aria-hidden /> Add a person
            </button>
          </div>
          <ul className="space-y-3">
            {household.members.map((m) => (
              <MemberEditor key={m.id} m={m} onChange={(next) => setMember(m.id, next)} onRemove={m.relation === 'self' ? undefined : () => removeMember(m.id)} />
            ))}
          </ul>
          <div className="card space-y-2 p-4">
            <h3 className="flex items-center gap-2 text-base font-bold text-navy">
              <Home className="h-4 w-4 text-saffron-600" aria-hidden /> About your home
            </h3>
            <div className="grid gap-2 sm:grid-cols-3">
              <label className="text-xs font-semibold text-muted">
                Where you live
                <select value={household.area || ''} onChange={(e) => setFact('area', (e.target.value || undefined) as Household['area'])} className="field mt-1">
                  <option value="">—</option>
                  <option value="rural">Village</option>
                  <option value="urban">Town / city</option>
                </select>
              </label>
              <label className="text-xs font-semibold text-muted">
                Category
                <select value={household.category || ''} onChange={(e) => setFact('category', (e.target.value || undefined) as Household['category'])} className="field mt-1">
                  <option value="">—</option>
                  {['SC', 'ST', 'OBC', 'General', 'EWS'].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-semibold text-muted">
                Family income a year (₹)
                <input
                  value={household.annualIncome ?? ''}
                  onChange={(e) => setFact('annualIncome', e.target.value.replace(/\D/g, '') ? Number(e.target.value.replace(/\D/g, '')) : undefined)}
                  inputMode="numeric"
                  className="field mt-1"
                  translate="no"
                />
              </label>
            </div>
            <TriState label="BPL / Antyodaya / priority ration card" value={household.bpl} onChange={(v) => setFact('bpl', v)} />
            <TriState label="Live in a pucca house" value={household.pucca} onChange={(v) => setFact('pucca', v)} />
            <TriState label="Have an LPG gas connection" value={household.hasLpg} onChange={(v) => setFact('hasLpg', v)} />
            <TriState label="Family owns farmland" value={household.ownsFarmland} onChange={(v) => setFact('ownsFarmland', v)} />
          </div>
        </section>

        <section ref={resultsRef} className="scroll-mt-24 space-y-4" aria-labelledby="fam-results">
          <div className="surface-dark rounded-3xl p-5 sm:p-6">
            <p className="text-sm font-semibold text-slate-300">Benefits your family may get</p>
            <p id="fam-results" className="mt-1 text-4xl font-extrabold text-white">
              {summary.total} <span className="text-lg font-semibold text-slate-300">for {household.members.length} {household.members.length === 1 ? 'person' : 'people'}</span>
            </p>
            <p className="mt-1 text-sm text-slate-300">{summary.likely} likely fit · the rest are worth checking</p>
            {speaker.supported && summary.total > 0 && (
              <button onClick={listen} className="btn btn-on-dark mt-4 h-11">
                {speaker.speakingId === 'family' ? <Square className="h-4 w-4" aria-hidden /> : <Volume2 className="h-4 w-4" aria-hidden />} {speaker.speakingId === 'family' ? 'Stop' : 'Read it to me'}
              </button>
            )}
          </div>

          {summary.people.map(({ member, matches }) => (
            <article key={member.id} className="card p-4 sm:p-5">
              <h3 className="flex flex-wrap items-baseline gap-x-2 text-base font-bold text-navy">
                {nameOf(member)}
                {member.name && member.relation !== 'self' && (
                  <span className="font-semibold text-muted" translate="no">
                    {member.name}
                  </span>
                )}
                {member.age !== undefined && <span className="text-sm font-semibold text-muted">· {member.age} yrs</span>}
              </h3>
              {matches.length ? (
                <div className="mt-3">
                  <MatchList matches={matches} onApply={(id) => onApply(id)} />
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted">{member.age === undefined ? 'Add the age to check benefits for this person.' : 'Nothing specific found yet — add work, studies or other details.'}</p>
              )}
            </article>
          ))}

          {summary.household.length > 0 && (
            <article className="card p-4 sm:p-5">
              <h3 className="flex items-center gap-2 text-base font-bold text-navy">
                <HeartHandshake className="h-5 w-5 text-saffron-600" aria-hidden /> For the whole family
              </h3>
              <div className="mt-3">
                <MatchList matches={summary.household} onApply={(id) => onApply(id)} />
              </div>
            </article>
          )}
          <p className="text-xs text-muted">A preliminary check from simple rules — not an official decision. Amounts and rules change and States add their own; confirm each one on the official website or at the office.</p>
        </section>
      </div>
    </div>
  );
};
