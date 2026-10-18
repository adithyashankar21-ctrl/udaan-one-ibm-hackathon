import React, { useState } from 'react';
import { GitCompare } from 'lucide-react';
import { PROFILE_FIELD_MAP } from '../../data/autofillSchema';
import type { SmartApplyStrings } from '../../data/smartApplyStrings';
import { autofillApi, type Conflict, type SessionState } from '../../services/autofillApi';

interface Props {
  t: SmartApplyStrings;
  conflicts: Conflict[];
  onSession: (s: SessionState) => void;
  onResolved: () => void;
}

/** Asks the person to choose when documents and answers disagree — never guesses. */
export const ConflictResolver: React.FC<Props> = ({ t, conflicts, onSession, onResolved }) => {
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  if (conflicts.length === 0) return null;

  const resolve = async (c: Conflict, choice: { index?: number; value?: string }) => {
    setError(null);
    try {
      onSession(await autofillApi.resolveConflict(c.id, choice));
      onResolved();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <section className="card border-coral/30 p-5 sm:p-6" aria-labelledby="conflicts-h">
      <h2 id="conflicts-h" className="flex items-center gap-2 text-lg font-bold text-navy">
        <GitCompare className="h-5 w-5 text-coral-600" aria-hidden /> {t.conflictsTitle}
      </h2>
      <p className="mt-1 text-sm text-muted">{t.conflictsHint}</p>
      {error && <p role="alert" className="mt-2 text-sm text-coral-600">{error}</p>}
      <ul className="mt-4 space-y-4">
        {conflicts.map((c) => (
          <li key={c.id} className="rounded-2xl border border-line p-4">
            <p className="font-semibold text-navy">{PROFILE_FIELD_MAP[c.key]?.label || c.key}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {c.candidates.map((cand, i) => (
                <button
                  key={i}
                  onClick={() => resolve(c, { index: i })}
                  className="rounded-xl border border-line bg-white p-3 text-left hover:border-green hover:bg-green-50"
                >
                  <span className="block text-base font-bold text-navy">{cand.value}</span>
                  <span className="mt-1 block text-xs text-muted">
                    {cand.sourceLabel}
                    {cand.confidence !== undefined ? ` · ${Math.round(cand.confidence * 100)}%` : ''}
                  </span>
                  <span className="mt-2 inline-block text-xs font-bold text-green">{t.useThis} →</span>
                </button>
              ))}
            </div>
            {c.key !== 'aadhaar' && (
              <form
                className="mt-3 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (custom[c.id]?.trim()) resolve(c, { value: custom[c.id] });
                }}
              >
                <input
                  value={custom[c.id] || ''}
                  onChange={(e) => setCustom((x) => ({ ...x, [c.id]: e.target.value }))}
                  placeholder={t.orType}
                  aria-label={`${t.orType}: ${PROFILE_FIELD_MAP[c.key]?.label}`}
                  className="field flex-1"
                />
                <button className="btn btn-primary">{t.save}</button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
};
