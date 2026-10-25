import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Lock, X } from 'lucide-react';
import { BeneficiaryProfile } from '../types';
import { DISTRICT_CLUSTERS } from '../data/districts';

interface ProfileFormProps {
  isOpen: boolean;
  onClose: () => void;
  profile: BeneficiaryProfile;
  onSaveProfile: (profile: BeneficiaryProfile) => void;
}

type Errors = Partial<Record<keyof BeneficiaryProfile, string>>;

const EDUCATION = [
  ['Non-Formal', 'No formal schooling / primary'],
  ['5th Pass', '5th pass'],
  ['8th Pass', '8th pass'],
  ['10th Pass', '10th pass'],
  ['12th Pass', '12th pass'],
  ['ITI Certified', 'ITI certified'],
  ['Graduate', 'Graduate'],
];

const CATEGORIES = ['Scheduled Caste (SC)', 'Scheduled Tribe (ST)', 'Other Backward Class (OBC)', 'General', 'Prefer not to say'];

function validate(p: BeneficiaryProfile): Errors {
  const e: Errors = {};
  if (!p.name.trim()) e.name = 'Please enter your name';
  const age = Number(p.age);
  if (p.age !== '' && (!Number.isFinite(age) || age < 14 || age > 100)) e.age = 'Enter an age between 14 and 100';
  if (p.phoneNumber && !/^[6-9]\d{9}$/.test(p.phoneNumber.replace(/\D/g, ''))) e.phoneNumber = 'Enter a 10-digit mobile number';
  // Only the last 4 digits are kept, so a saved Aadhaar comes back as "XXXX XXXX 1234": that, the last 4 digits, or all 12 are fine
  const aadhaar = (p.aadhaarNumber || '').replace(/\s/g, '');
  if (aadhaar && !/^(\d{12}|\d{4}|X{8}\d{4})$/i.test(aadhaar)) e.aadhaarNumber = 'Aadhaar has 12 digits (or give the last 4)';
  if (p.pincode && !/^\d{6}$/.test(p.pincode)) e.pincode = 'PIN code has 6 digits';
  if (p.bankIfscCode && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(p.bankIfscCode.toUpperCase())) e.bankIfscCode = 'IFSC looks like SBIN0001234';
  return e;
}

const inputCls = (err?: string) =>
  `h-12 w-full rounded-xl border bg-white px-4 text-base text-navy placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-saffron/40 ${
    err ? 'border-red-400' : 'border-line focus:border-saffron'
  }`;

const Field: React.FC<{ id: string; label: string; hint?: string; error?: string; children: React.ReactNode; className?: string }> = ({ id, label, hint, error, children, className }) => (
  <div className={className}>
    <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-navy">
      {label}
    </label>
    {children}
    {error ? (
      <p id={`${id}-err`} className="mt-1 text-xs font-semibold text-red-600" role="alert">{error}</p>
    ) : hint ? (
      <p className="mt-1 text-xs text-muted">{hint}</p>
    ) : null}
  </div>
);

const GENDERS: string[] = ['Female', 'Male', 'Transgender', 'Prefer not to say'];

export const ProfileForm: React.FC<ProfileFormProps> = ({ isOpen, onClose, profile, onSaveProfile }) => {
  const [form, setForm] = useState<BeneficiaryProfile>(profile);
  const [errors, setErrors] = useState<Errors>({});
  const [showMore, setShowMore] = useState(false);
  const firstRef = useRef<HTMLInputElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Load the latest profile each time the dialog opens (voice may have filled fields)
  useEffect(() => {
    if (!isOpen) return;
    setForm(profile);
    setErrors({});
    setTimeout(() => firstRef.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCloseRef.current();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const set = <K extends keyof BeneficiaryProfile>(key: K, value: BeneficiaryProfile[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate(form);
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      if (Object.keys(errs).some((k) => !['name', 'age'].includes(k))) setShowMore(true);
      // Show the person what stopped the save: the first field with a problem
      const first = Object.keys(errs)[0];
      setTimeout(() => {
        const el = document.querySelector<HTMLElement>(`[aria-describedby*="${first}"], #pf-${first === 'aadhaarNumber' ? 'aadhaar' : first}`);
        el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        el?.focus();
      }, 50);
      return;
    }
    onSaveProfile({
      ...form,
      name: form.name.trim(),
      age: form.age === '' ? '' : Number(form.age),
      bankIfscCode: form.bankIfscCode?.toUpperCase(),
    });
    onClose();
  };

  const districtValue = form.district ? `${form.district}|${form.state}` : '';
  const aria = (k: keyof BeneficiaryProfile) => (errors[k] ? { 'aria-invalid': true, 'aria-describedby': `pf-${String(k)}-err` } : {});

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-navy/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="pf-title" onClick={onClose}>
      <div className="flex min-h-full items-start justify-center p-3 sm:items-center sm:p-6">
        <form onSubmit={submit} noValidate onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl overflow-hidden rounded-[24px] bg-ivory shadow-lift animate-fade-up">
          <header className="flex items-start justify-between gap-4 border-b border-line bg-white px-6 py-5">
            <div>
              <h2 id="pf-title" className="text-xl font-extrabold text-navy">Your profile</h2>
              <p className="mt-0.5 text-sm text-muted">Used to suggest schemes and fill application drafts. You can change it any time.</p>
            </div>
            <button type="button" onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl hover:bg-ivory" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          </header>

          <div className="max-h-[70vh] space-y-6 overflow-y-auto px-6 py-6">
            <fieldset className="grid gap-4 sm:grid-cols-2">
              <legend className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">About you</legend>
              <Field id="pf-name" label="Full name *" error={errors.name} className="sm:col-span-2">
                <input ref={firstRef} id="pf-name" value={form.name} onChange={(e) => set('name', e.target.value)} className={inputCls(errors.name)} autoComplete="name" {...aria('name')} />
              </Field>
              <Field id="pf-age" label="Age" error={errors.age}>
                <input id="pf-age" inputMode="numeric" value={form.age} onChange={(e) => set('age', e.target.value.replace(/\D/g, '').slice(0, 3))} className={inputCls(errors.age)} {...aria('age')} />
              </Field>
              <Field id="pf-gender" label="Gender">
                <select id="pf-gender" value={GENDERS.includes(form.gender) ? form.gender : ''} onChange={(e) => set('gender', e.target.value as BeneficiaryProfile['gender'])} className={inputCls()}>
                  {/* A saved value that is none of these shows as not chosen, never as the first option */}
                  {!GENDERS.includes(form.gender) && <option value="">Choose…</option>}
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                  <option value="Transgender">Transgender</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
              </Field>
              <Field id="pf-district" label="District">
                <select
                  id="pf-district"
                  value={districtValue}
                  onChange={(e) => {
                    const [district, state] = e.target.value.split('|');
                    setForm((f) => ({ ...f, district: district || '', state: state || '' }));
                  }}
                  className={inputCls()}
                >
                  <option value="">Select your district</option>
                  {form.district && !DISTRICT_CLUSTERS.some((d) => d.district === form.district) && <option value={districtValue}>{form.district}, {form.state}</option>}
                  {DISTRICT_CLUSTERS.map((d) => (
                    <option key={`${d.district}-${d.state}`} value={`${d.district}|${d.state}`}>
                      {d.district}, {d.state}
                    </option>
                  ))}
                </select>
              </Field>
              <Field id="pf-edu" label="Education">
                <select id="pf-edu" value={form.education} onChange={(e) => set('education', e.target.value)} className={inputCls()}>
                  <option value="">Select</option>
                  {EDUCATION.map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </Field>
            </fieldset>

            <fieldset className="grid gap-4 sm:grid-cols-2">
              <legend className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">Work & goals</legend>
              <Field id="pf-trade" label="Trade or current work" hint="e.g. tailoring, leather work, electrician">
                <input id="pf-trade" value={form.traditionalTrade || form.currentOccupation} onChange={(e) => setForm((f) => ({ ...f, traditionalTrade: e.target.value, currentOccupation: e.target.value }))} className={inputCls()} />
              </Field>
              <Field id="pf-pref" label="What are you looking for?">
                <select id="pf-pref" value={form.workPreference} onChange={(e) => set('workPreference', e.target.value as BeneficiaryProfile['workPreference'])} className={inputCls()}>
                  <option value="Any">Not sure yet</option>
                  <option value="Self-Employment / Micro-enterprise">Start my own business</option>
                  <option value="Wage Employment">A job</option>
                  <option value="SHG Group Business">Group business (SHG)</option>
                </select>
              </Field>
              <Field id="pf-skills" label="Skills you already have" className="sm:col-span-2">
                <input id="pf-skills" value={form.existingSkills} onChange={(e) => set('existingSkills', e.target.value)} className={inputCls()} />
              </Field>
              <Field id="pf-goal" label="Your goal, in your words" className="sm:col-span-2">
                <textarea id="pf-goal" rows={2} value={form.goal || ''} onChange={(e) => set('goal', e.target.value)} className={`${inputCls()} h-auto py-3`} />
              </Field>
            </fieldset>

            <fieldset className="grid gap-4 sm:grid-cols-2">
              <legend className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">For eligibility checks</legend>
              <Field id="pf-cat" label="Social category">
                <select id="pf-cat" value={form.socialCategory || ''} onChange={(e) => set('socialCategory', e.target.value)} className={inputCls()}>
                  <option value="">Select</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field id="pf-income" label="Annual family income (₹)" hint="Approximate is fine, e.g. 1,20,000">
                <input id="pf-income" inputMode="numeric" value={form.annualFamilyIncome || ''} onChange={(e) => set('annualFamilyIncome', e.target.value)} className={inputCls()} />
              </Field>
            </fieldset>

            <div className="rounded-2xl border border-line bg-white">
              <button type="button" onClick={() => setShowMore((s) => !s)} aria-expanded={showMore} className="flex w-full items-center justify-between px-5 py-4 text-left font-semibold text-navy">
                Application details (optional)
                <ChevronDown className={`h-5 w-5 transition-transform ${showMore ? 'rotate-180' : ''}`} />
              </button>
              {showMore && (
                <div className="grid gap-4 border-t border-line px-5 py-5 sm:grid-cols-2">
                  <Field id="pf-phone" label="Mobile number" error={errors.phoneNumber}>
                    <input id="pf-phone" inputMode="tel" value={form.phoneNumber || ''} onChange={(e) => set('phoneNumber', e.target.value)} className={inputCls(errors.phoneNumber)} autoComplete="tel" {...aria('phoneNumber')} />
                  </Field>
                  <Field id="pf-parent" label="Father / spouse name">
                    <input id="pf-parent" value={form.fatherSpouseName || ''} onChange={(e) => set('fatherSpouseName', e.target.value)} className={inputCls()} />
                  </Field>
                  <Field id="pf-aadhaar" label="Aadhaar number" error={errors.aadhaarNumber} hint="Only used to fill your draft on this device">
                    <input id="pf-aadhaar" inputMode="numeric" value={form.aadhaarNumber || ''} onChange={(e) => set('aadhaarNumber', e.target.value.replace(/[^\dXx ]/g, '').slice(0, 14))} className={inputCls(errors.aadhaarNumber)} autoComplete="off" {...aria('aadhaarNumber')} />
                  </Field>
                  <Field id="pf-pin" label="PIN code" error={errors.pincode}>
                    <input id="pf-pin" inputMode="numeric" value={form.pincode || ''} onChange={(e) => set('pincode', e.target.value.replace(/\D/g, '').slice(0, 6))} className={inputCls(errors.pincode)} autoComplete="postal-code" {...aria('pincode')} />
                  </Field>
                  <Field id="pf-addr" label="Address" className="sm:col-span-2">
                    <input id="pf-addr" value={form.residentialAddress || ''} onChange={(e) => set('residentialAddress', e.target.value)} className={inputCls()} autoComplete="street-address" />
                  </Field>
                  <Field id="pf-bank" label="Bank name">
                    <input id="pf-bank" value={form.bankName || ''} onChange={(e) => set('bankName', e.target.value)} className={inputCls()} />
                  </Field>
                  <Field id="pf-ifsc" label="IFSC code" error={errors.bankIfscCode}>
                    <input id="pf-ifsc" value={form.bankIfscCode || ''} onChange={(e) => set('bankIfscCode', e.target.value.toUpperCase())} className={inputCls(errors.bankIfscCode)} {...aria('bankIfscCode')} />
                  </Field>
                  <Field id="pf-acc" label="Account number" className="sm:col-span-2">
                    <input id="pf-acc" inputMode="numeric" value={form.bankAccountNumber || ''} onChange={(e) => set('bankAccountNumber', e.target.value.replace(/\D/g, ''))} className={inputCls()} autoComplete="off" />
                  </Field>
                </div>
              )}
            </div>

            <p className="flex items-start gap-2 text-xs text-muted">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Your details are kept in this browser session and shared with the UDAAN ONE AI service only to answer your questions. Nothing is submitted to any government system on your behalf.
            </p>
          </div>

          <footer className="flex flex-col-reverse gap-2 border-t border-line bg-white px-6 py-4 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className="h-12 rounded-xl border border-line px-5 font-semibold text-navy hover:bg-ivory">Cancel</button>
            <button type="submit" className="h-12 rounded-xl bg-navy px-6 font-bold text-white hover:bg-navy-800">Save profile</button>
          </footer>
        </form>
      </div>
    </div>
  );
};
