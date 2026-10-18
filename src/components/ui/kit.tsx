/**
 * UDAAN ONE component kit — small, reusable building blocks that share the design tokens
 * in index.css. Status is always shown with an icon AND a text label, never colour alone.
 */
import React, { useEffect, useId, useRef, useState } from 'react';
import { AlertTriangle, Check, CheckCircle2, CircleDashed, FileUp, Info, Loader2, X, XCircle } from 'lucide-react';

/* ── Status pill ───────────────────────────────────────────────────── */

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'accent';

const TONE: Record<Tone, string> = {
  neutral: 'bg-navy-50 text-navy-700 border-navy-50',
  info: 'bg-teal-50 text-teal-600 border-teal/25',
  success: 'bg-green-50 text-green-600 border-green/20',
  warning: 'bg-saffron-50 text-saffron-600 border-saffron/35',
  danger: 'bg-coral-50 text-coral-600 border-coral/30',
  accent: 'bg-navy text-white border-navy',
};

const TONE_ICON: Record<Tone, React.ElementType> = {
  neutral: CircleDashed,
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
  accent: Check,
};

export const StatusPill: React.FC<{ tone?: Tone; icon?: React.ElementType; children: React.ReactNode; className?: string; title?: string }> = ({
  tone = 'neutral',
  icon,
  children,
  className = '',
  title,
}) => {
  const Icon = icon || TONE_ICON[tone];
  return (
    <span title={title} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-5 ${TONE[tone]} ${className}`}>
      <Icon className="h-3 w-3 shrink-0" aria-hidden />
      {children}
    </span>
  );
};

/* ── Alert ─────────────────────────────────────────────────────────── */

export const Alert: React.FC<{ tone?: Exclude<Tone, 'accent'>; title?: string; children?: React.ReactNode; action?: React.ReactNode; className?: string }> = ({
  tone = 'info',
  title,
  children,
  action,
  className = '',
}) => {
  const Icon = TONE_ICON[tone];
  const box: Record<string, string> = {
    neutral: 'border-line bg-white',
    info: 'border-teal/25 bg-teal-50/70',
    success: 'border-green/25 bg-green-50',
    warning: 'border-saffron/40 bg-saffron-50',
    danger: 'border-coral/35 bg-coral-50',
  };
  const iconCls: Record<string, string> = { neutral: 'text-muted', info: 'text-teal-600', success: 'text-green', warning: 'text-saffron-600', danger: 'text-coral-600' };
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={`flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-start ${box[tone]} ${className}`}>
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${iconCls[tone]}`} aria-hidden />
      <div className="min-w-0 flex-1 text-sm text-navy">
        {title && <p className="font-bold">{title}</p>}
        {children && <div className={title ? 'mt-0.5 text-navy/80' : ''}>{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
};

/* ── Empty state ───────────────────────────────────────────────────── */

export const EmptyState: React.FC<{ icon: React.ElementType; title: string; body?: string; action?: React.ReactNode; compact?: boolean }> = ({ icon: Icon, title, body, action, compact }) => (
  <div className={`flex flex-col items-center rounded-2xl border border-dashed border-line bg-white/60 text-center ${compact ? 'p-6' : 'p-10'}`}>
    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-navy-50 text-navy-700">
      <Icon className="h-6 w-6" aria-hidden />
    </span>
    <p className="mt-4 font-bold text-navy">{title}</p>
    {body && <p className="mt-1 max-w-sm text-sm text-muted">{body}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);

/* ── Skeleton ──────────────────────────────────────────────────────── */

export const Skeleton: React.FC<{ className?: string }> = ({ className = 'h-4 w-full' }) => <span className={`skeleton block ${className}`} aria-hidden />;

export const SkeletonCard: React.FC<{ lines?: number }> = ({ lines = 3 }) => (
  <div className="card space-y-3 p-5" aria-busy="true" aria-label="Loading">
    <Skeleton className="h-5 w-1/2" />
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton key={i} className={`h-3.5 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`} />
    ))}
  </div>
);

export const Spinner: React.FC<{ className?: string; label?: string }> = ({ className = 'h-5 w-5', label }) => (
  <Loader2 className={`animate-spin ${className}`} aria-label={label} aria-hidden={!label} />
);

/* ── Section header ────────────────────────────────────────────────── */

export const SectionHeader: React.FC<{ eyebrow?: string; title: string; body?: string; action?: React.ReactNode; id?: string; as?: 'h1' | 'h2' }> = ({
  eyebrow,
  title,
  body,
  action,
  id,
  as = 'h2',
}) => {
  const H = as;
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <H id={id} className={`${eyebrow ? 'mt-2' : ''} font-extrabold text-navy ${as === 'h1' ? 'text-3xl sm:text-4xl' : 'text-2xl sm:text-[1.75rem]'}`}>
          {title}
        </H>
        {body && <p className="mt-2 text-base leading-relaxed text-muted">{body}</p>}
      </div>
      {action}
    </div>
  );
};

/* ── Dialog ────────────────────────────────────────────────────────── */

export const Dialog: React.FC<{ open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }> = ({ open, onClose, title, children, wide }) => {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy/55 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" onClick={onClose}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className={`card max-h-[92vh] w-full overflow-y-auto rounded-b-none p-6 animate-fade-up sm:rounded-b-[var(--radius-card)] ${wide ? 'max-w-4xl' : 'max-w-md'}`}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-xl font-extrabold text-navy">{title}</h2>
          <button onClick={onClose} className="btn btn-ghost btn-sm -mr-2 -mt-1 h-10 w-10 p-0" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
};

/* ── Stepper (application progress) ───────────────────────────────── */

export interface Step {
  label: string;
  done?: boolean;
  /** Short status shown under the label, e.g. "3 missing". */
  note?: string;
}

export const Stepper: React.FC<{ steps: Step[]; current: number; onSelect?: (i: number) => void; className?: string }> = ({ steps, current, onSelect, className = '' }) => (
  <ol className={`flex w-full items-start ${className}`} aria-label="Progress">
    {steps.map((s, i) => {
      const state = i === current ? 'current' : s.done ? 'done' : 'todo';
      const clickable = Boolean(onSelect);
      const inner = (
        <>
          <span
            className={`relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 text-sm font-bold transition-colors ${
              state === 'current' ? 'border-navy bg-navy text-white' : state === 'done' ? 'border-green bg-green text-white' : 'border-line bg-white text-muted'
            }`}
          >
            {state === 'done' ? <Check className="h-4 w-4" aria-hidden /> : i + 1}
          </span>
          <span className="mt-2 block text-center text-xs font-semibold leading-tight text-navy sm:text-sm">{s.label}</span>
          {s.note && <span className="mt-0.5 block text-center text-[11px] text-muted">{s.note}</span>}
          <span className="sr-only">{state === 'done' ? ' (done)' : state === 'current' ? ' (current step)' : ''}</span>
        </>
      );
      return (
        <li key={s.label} className="relative flex flex-1 flex-col items-center">
          {i > 0 && <span className={`absolute right-1/2 top-[18px] h-0.5 w-full ${steps[i - 1].done || i <= current ? 'bg-green/60' : 'bg-line'}`} aria-hidden />}
          {clickable ? (
            <button onClick={() => onSelect!(i)} aria-current={state === 'current' ? 'step' : undefined} className="flex min-h-11 flex-col items-center rounded-xl px-1">
              {inner}
            </button>
          ) : (
            <div aria-current={state === 'current' ? 'step' : undefined} className="flex flex-col items-center px-1">{inner}</div>
          )}
        </li>
      );
    })}
  </ol>
);

/* ── Upload zone (drag & drop + button) ───────────────────────────── */

export const UploadZone: React.FC<{
  onFiles: (files: File[]) => void;
  accept: string;
  title: string;
  hint?: string;
  children?: React.ReactNode;
  disabled?: boolean;
}> = ({ onFiles, accept, title, hint, children, disabled }) => {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (!disabled && e.dataTransfer.files.length) onFiles(Array.from(e.dataTransfer.files));
      }}
      className={`relative rounded-2xl border-2 border-dashed p-6 text-center transition-colors sm:p-8 ${
        over ? 'border-teal bg-teal-50' : 'border-[#d9dbe2] bg-white hover:border-navy-700/40'
      }`}
    >
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-navy text-white">
        <FileUp className="h-5 w-5" aria-hidden />
      </span>
      <p className="mt-3 font-bold text-navy">{title}</p>
      {hint && <p className="mx-auto mt-1 max-w-md text-sm text-muted">{hint}</p>}
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <button type="button" disabled={disabled} onClick={() => input.current?.click()} className="btn btn-primary">
          <FileUp className="h-4 w-4" aria-hidden /> Choose files
        </button>
        {children}
      </div>
      <p className="mt-3 hidden text-xs text-muted sm:block">or drag and drop files here</p>
      <input
        ref={input}
        type="file"
        multiple
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          e.target.value = '';
          if (files.length) onFiles(files);
        }}
      />
    </div>
  );
};

/* ── Progress meter (real counts only) ────────────────────────────── */

export const Meter: React.FC<{ value: number; max: number; label: string; tone?: 'green' | 'teal' | 'saffron' }> = ({ value, max, label, tone = 'green' }) => {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  const bar = { green: 'bg-green', teal: 'bg-teal', saffron: 'bg-saffron' }[tone];
  return (
    <div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-ivory-200" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} aria-label={label}>
        <div className={`h-full rounded-full ${bar} transition-[width] duration-500`} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1.5 text-xs text-muted">{label}</p>
    </div>
  );
};
