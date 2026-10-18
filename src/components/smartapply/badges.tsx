import React from 'react';
import { AlertTriangle, CheckCircle2, CircleDashed, FileSearch, GitCompare, PencilLine, UserRound, XCircle } from 'lucide-react';
import type { SmartApplyStrings } from '../../data/smartApplyStrings';
import type { FieldView } from '../../services/autofillApi';
import { StatusPill, type Tone } from '../ui/kit';

export const confidenceLevel = (c?: number) => (c === undefined ? null : c >= 0.85 ? 'high' : c >= 0.6 ? 'med' : 'low');

export const ConfidenceBadge: React.FC<{ value?: number; t: SmartApplyStrings }> = ({ value, t }) => {
  const level = confidenceLevel(value);
  if (!level) return null;
  const pct = Math.round((value || 0) * 100);
  const meta = {
    high: { tone: 'success' as Tone, label: t.confidenceHigh },
    med: { tone: 'warning' as Tone, label: t.confidenceMed },
    low: { tone: 'danger' as Tone, label: t.confidenceLow },
  }[level];
  return (
    <StatusPill tone={meta.tone} title={`Reading confidence ${pct}%`}>
      {meta.label} · {pct}%
    </StatusPill>
  );
};

/**
 * One badge per field describing where the value stands. Each state has its own icon and
 * words, so meaning never depends on colour alone.
 */
export function fieldState(f: Pick<FieldView, 'state' | 'status' | 'source' | 'confidence'>): { tone: Tone; icon: React.ElementType; label: string } {
  if (f.state === 'conflict') return { tone: 'danger', icon: GitCompare, label: 'Conflict — choose one' };
  if (f.state === 'invalid') return { tone: 'danger', icon: XCircle, label: 'Check the format' };
  if (f.state === 'missing') return { tone: 'neutral', icon: CircleDashed, label: 'Missing' };
  if (f.status === 'confirmed') {
    return f.source === 'document'
      ? { tone: 'success', icon: CheckCircle2, label: 'Confirmed by you' }
      : { tone: 'success', icon: PencilLine, label: 'Corrected by you' };
  }
  if (f.status === 'extracted') {
    return f.state === 'review'
      ? { tone: 'warning', icon: AlertTriangle, label: 'From document · please check' }
      : { tone: 'info', icon: FileSearch, label: 'From document · not verified' };
  }
  if (f.state === 'review') return { tone: 'warning', icon: AlertTriangle, label: 'Please check' };
  return { tone: 'neutral', icon: UserRound, label: 'You told us' };
}

export const FieldStateBadge: React.FC<{ field: FieldView }> = ({ field }) => {
  const s = fieldState(field);
  return (
    <StatusPill tone={s.tone} icon={s.icon}>
      {s.label}
    </StatusPill>
  );
};

export const SourceNote: React.FC<{ field: Pick<FieldView, 'sourceLabel' | 'corroboratedBy' | 'confidence' | 'status'>; t: SmartApplyStrings }> = ({ field, t }) => {
  if (!field.sourceLabel) return null;
  return (
    <span className="text-[11px] text-muted">
      {field.sourceLabel}
      {field.status === 'extracted' && field.confidence !== undefined ? ` · ${Math.round(field.confidence * 100)}% sure` : ''}
      {field.corroboratedBy && field.corroboratedBy.length > 0 ? ` · ${t.corroborated}: ${field.corroboratedBy.join(', ')}` : ''}
    </span>
  );
};

/** Border colour by state, used alongside (never instead of) the badge. */
export const STATE_RING: Record<FieldView['state'], string> = {
  filled: 'border-line',
  review: 'border-saffron/60',
  missing: 'border-dashed border-[#cfd3dc]',
  conflict: 'border-coral/50',
  invalid: 'border-coral/50',
};

export const LEGEND: Array<{ tone: Tone; icon: React.ElementType; label: string }> = [
  { tone: 'success', icon: CheckCircle2, label: 'Confirmed by you' },
  { tone: 'success', icon: PencilLine, label: 'Corrected by you' },
  { tone: 'info', icon: FileSearch, label: 'From document · not verified' },
  { tone: 'neutral', icon: UserRound, label: 'You told us' },
  { tone: 'warning', icon: AlertTriangle, label: 'Please check' },
  { tone: 'neutral', icon: CircleDashed, label: 'Missing' },
  { tone: 'danger', icon: GitCompare, label: 'Conflict' },
];
