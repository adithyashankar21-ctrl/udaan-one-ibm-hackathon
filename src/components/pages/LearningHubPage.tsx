import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  Circle,
  Code2,
  ExternalLink,
  GraduationCap,
  ListTree,
  Loader2,
  MessageCircleQuestion,
  Mic,
  MicOff,
  Trash2,
  Wand2,
  Wrench,
  Clock,
  Target,
  Briefcase,
  Award,
  Play,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import type { BeneficiaryProfile, ChannelMode, Language } from '../../types';
import { LEARNING_TRACKS, type LearningCourse, type LearningModule, subtopicCount, subtopicKey } from '../../data/learningTracks';
import { buildCourse, fetchLesson, type Lesson, type LearningEntry } from '../../services/learnApi';
import { DoubtSolver, LessonView, lessonScript } from '../learning/TutorBlocks';
import { useSpeaker } from '../learning/useSpeaker';
import { useDictation } from '../smartapply/media';
import { OpportunityTabs } from './SkillsPage';
import { Meter, Skeleton } from '../ui/kit';
import { FinalAssessment, MyCertificates } from '../learning/Certificates';
import type { Certificate } from '../../services/learnApi';
import { autofillApi } from '../../services/autofillApi';

/* ── per-viewer progress (convenience only; works without storage) ────── */

const STORE = 'udaan_learning_progress_v1';
function loadProgress(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORE) || '[]'));
  } catch {
    return new Set();
  }
}
function saveProgress(s: Set<string>) {
  try {
    localStorage.setItem(STORE, JSON.stringify([...s]));
  } catch {}
}

const CUSTOM_STORE = 'udaan_custom_courses_v1';
function loadCustom(): LearningCourse[] {
  try {
    const list = JSON.parse(localStorage.getItem(CUSTOM_STORE) || '[]');
    return Array.isArray(list) ? list.filter((c) => c?.id && Array.isArray(c.modules)) : [];
  } catch {
    return [];
  }
}
function saveCustom(list: LearningCourse[]) {
  try {
    localStorage.setItem(CUSTOM_STORE, JSON.stringify(list.slice(0, 12)));
  } catch {}
}

/** A request that reads like a specific question goes straight to the doubt solver. */
const looksLikeQuestion = (q?: string) => Boolean(q && (/\?/.test(q) || /\b(what|why|how does|how do|difference|write|error|explain|example)\b/i.test(q)) && q.length > 12);

const ACCENT: Record<LearningCourse['accent'], { bg: string; text: string; ring: string; grad: string }> = {
  saffron: { bg: 'bg-saffron-50', text: 'text-saffron-600', ring: 'ring-saffron/40', grad: 'from-saffron to-[#f7c777]' },
  teal: { bg: 'bg-teal-50', text: 'text-teal-600', ring: 'ring-teal/40', grad: 'from-teal to-[#7fe0d4]' },
  navy: { bg: 'bg-navy-50', text: 'text-navy-800', ring: 'ring-navy/30', grad: 'from-navy-800 to-[#4a6290]' },
  green: { bg: 'bg-green-50', text: 'text-green-600', ring: 'ring-green/30', grad: 'from-green to-[#5fc4a3]' },
  coral: { bg: 'bg-coral-50', text: 'text-coral-600', ring: 'ring-coral/30', grad: 'from-coral to-[#f0a09e]' },
};

const DOUBT_EXAMPLES: Record<string, string[]> = {
  python: [
    'What is the difference between a list and a tuple?',
    'Write a program to check if a number is prime',
    'Why do I get "IndentationError: expected an indented block"?',
    'Reverse a string without using slicing',
  ],
  dsa: ['Find the second largest number in a list', 'Explain binary search with an example', 'What is the time complexity of nested loops?'],
  c: ['What is a pointer, in simple words?', 'Why does scanf need & before the variable?'],
  java: ['What is the difference between JDK, JRE and JVM?', 'Explain method overloading vs overriding'],
  web: ['How does Flexbox centre an element?', 'What is the difference between let, const and var?'],
  sql: ['What is the difference between WHERE and HAVING?', 'Explain INNER JOIN with an example'],
};

/* ── animated hero ─────────────────────────────────────────────────────── */

const HERO_CODE = ['def greet(name):', '    return f"Namaste, {name}!"', '', 'print(greet("Priya"))', '# Namaste, Priya!'];

const TypingCode: React.FC = () => {
  const full = HERO_CODE.join('\n');
  const [n, setN] = useState(0);
  useEffect(() => {
    if (document.documentElement.dataset.motion === 'reduce' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setN(full.length);
      return;
    }
    const t = setInterval(() => setN((v) => (v >= full.length + 40 ? 0 : v + 1)), 55);
    return () => clearInterval(t);
  }, [full.length]);
  const shown = full.slice(0, Math.min(n, full.length));
  return (
    <pre className="font-mono text-[13px] leading-6 text-[#e6edf7]" aria-hidden>
      {shown.split('\n').map((line, i) => (
        <div key={i} className={line.startsWith('#') ? 'text-teal' : ''}>
          <span className="mr-4 inline-block w-4 select-none text-right text-white/25">{i + 1}</span>
          {line.replace(/(def|return|print)/g, '\u0000$1\u0000').split('\u0000').map((p, j) =>
            ['def', 'return', 'print'].includes(p) ? (
              <span key={j} className="text-saffron">
                {p}
              </span>
            ) : (
              <React.Fragment key={j}>{p}</React.Fragment>
            )
          )}
        </div>
      ))}
      <span className="ml-8 inline-block h-4 w-2 translate-y-0.5 animate-pulse bg-saffron" />
    </pre>
  );
};

const FLOATERS = ['{ }', '</>', 'py', '=>', '#', 'if', 'for', '[ ]', 'fn', '01'];

const Hero: React.FC<{ onStart: () => void; onAsk: () => void }> = ({ onStart, onAsk }) => (
  <section className="surface-dark relative overflow-hidden rounded-[28px] px-6 py-10 text-white sm:px-10 sm:py-14">
    {FLOATERS.map((g, i) => (
      <motion.span
        key={g + i}
        aria-hidden
        className="pointer-events-none absolute select-none font-mono text-sm font-bold text-white/10 sm:text-lg"
        style={{ left: `${(i * 37) % 95}%`, top: `${(i * 53) % 85}%` }}
        animate={{ y: [0, -18, 0], opacity: [0.35, 0.9, 0.35], rotate: [0, i % 2 ? 8 : -8, 0] }}
        transition={{ duration: 6 + (i % 4), repeat: Infinity, ease: 'easeInOut', delay: i * 0.4 }}
      >
        {g}
      </motion.span>
    ))}
    <div className="relative grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
        <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-saffron">
          <Sparkles className="h-3.5 w-3.5" aria-hidden /> Learning Hub · AI tutor
        </p>
        <h1 className="mt-4 text-3xl font-extrabold leading-tight sm:text-5xl">
          Learn the skills your{' '}
          <span className="bg-gradient-to-r from-saffron to-teal bg-clip-text text-transparent">next opportunity</span> needs.
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-white/75">
          Free lessons in programming, computer engineering and job readiness. Guru, your AI tutor, explains every subtopic simply and solves your doubts step by
          step — breaking each problem into smaller pieces and checking the answer.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }} onClick={onStart} className="btn btn-accent btn-lg">
            <Play className="h-5 w-5" aria-hidden /> Start learning Python
          </motion.button>
          <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }} onClick={onAsk} className="btn btn-lg border border-white/25 bg-white/5 text-white hover:bg-white/10">
            <MessageCircleQuestion className="h-5 w-5" aria-hidden /> Ask a doubt
          </motion.button>
        </div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, scale: 0.92, rotate: -2 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
        className="relative"
      >
        <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }} className="rounded-2xl border border-white/10 bg-navy/80 p-4 shadow-2xl backdrop-blur">
          <div className="mb-3 flex gap-1.5" aria-hidden>
            <span className="h-2.5 w-2.5 rounded-full bg-coral" />
            <span className="h-2.5 w-2.5 rounded-full bg-saffron" />
            <span className="h-2.5 w-2.5 rounded-full bg-teal" />
          </div>
          <TypingCode />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.9 }}
          className="absolute -bottom-5 -left-3 flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-sm font-semibold text-navy shadow-lift sm:-left-6"
        >
          <BrainCircuit className="h-4 w-4 text-teal-600" aria-hidden /> Step-by-step explanations
        </motion.div>
      </motion.div>
    </div>
  </section>
);

/* ── course catalogue ─────────────────────────────────────────────────── */

const ProgressRing: React.FC<{ value: number; max: number }> = ({ value, max }) => {
  const pct = max ? value / max : 0;
  const r = 16;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 40 40" className="h-11 w-11 -rotate-90" role="img" aria-label={`${value} of ${max} topics complete`}>
      <circle cx="20" cy="20" r={r} fill="none" stroke="currentColor" strokeWidth="4" className="text-line" />
      <motion.circle
        cx="20"
        cy="20"
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        className="text-green"
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: c * (1 - pct) }}
        transition={{ duration: 1, ease: 'easeOut' }}
      />
    </svg>
  );
};

const CourseCard: React.FC<{ course: LearningCourse; done: number; index: number; onOpen: () => void; onRemove?: () => void }> = ({ course, done, index, onOpen, onRemove }) => {
  const a = ACCENT[course.accent];
  const total = subtopicCount(course);
  return (
    <motion.li
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.45, delay: index * 0.07, ease: [0.22, 1, 0.36, 1] }}
      className="relative"
    >
      <motion.button
        whileHover={{ y: -6 }}
        whileTap={{ scale: 0.98 }}
        onClick={onOpen}
        className="group card flex h-full w-full flex-col p-5 text-left transition-shadow hover:shadow-lift"
      >
        <div className="flex items-start justify-between gap-3">
          <motion.span
            whileHover={{ rotate: -8, scale: 1.08 }}
            className={`grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br ${a.grad} font-mono text-lg font-extrabold text-white shadow-card`}
            aria-hidden
          >
            {course.glyph}
          </motion.span>
          {done > 0 ? <ProgressRing value={done} max={total} /> : <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${a.bg} ${a.text}`}>{course.level}</span>}
        </div>
        <h3 className="mt-4 text-lg font-bold leading-snug text-navy">{course.title}</h3>
        <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted">{course.description}</p>
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-muted">
            {course.modules.length} modules · {total} topics
          </span>
          <span className="inline-flex items-center gap-1 font-bold text-navy">
            {done > 0 ? 'Continue' : 'Start'} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
          </span>
        </div>
      </motion.button>
      {onRemove && (
        <button
          onClick={onRemove}
          aria-label={`Remove ${course.title}`}
          className="absolute bottom-4 right-28 grid h-8 w-8 place-items-center rounded-full bg-white text-muted shadow-card hover:text-coral-600"
        >
          <Trash2 className="h-4 w-4" aria-hidden />
        </button>
      )}
    </motion.li>
  );
};

/* ── course workspace ─────────────────────────────────────────────────── */

interface Selection {
  module: LearningModule;
  subtopic: string;
}

const Curriculum: React.FC<{
  course: LearningCourse;
  selected: Selection | null;
  progress: Set<string>;
  onSelect: (s: Selection) => void;
}> = ({ course, selected, progress, onSelect }) => {
  const [open, setOpen] = useState<Record<string, boolean>>(() => ({ [selected?.module.id || course.modules[0].id]: true }));
  useEffect(() => {
    if (selected) setOpen((o) => ({ ...o, [selected.module.id]: true }));
  }, [selected?.module.id]);
  return (
    <nav aria-label={`${course.title} curriculum`} className="space-y-2">
      {course.modules.map((mod, mi) => {
        const isOpen = !!open[mod.id];
        const doneHere = mod.subtopics.filter((s) => progress.has(subtopicKey(course.id, mod.id, s))).length;
        return (
          <div key={mod.id} className="overflow-hidden rounded-2xl border border-line bg-white">
            <button onClick={() => setOpen((o) => ({ ...o, [mod.id]: !isOpen }))} aria-expanded={isOpen} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-ivory">
              <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-bold ${doneHere === mod.subtopics.length ? 'bg-green text-white' : 'bg-navy-50 text-navy'}`}>
                {doneHere === mod.subtopics.length ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : mi + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-navy">{mod.title}</span>
                <span className="text-xs text-muted">
                  {doneHere}/{mod.subtopics.length} done
                </span>
              </span>
              <ChevronDown className={`h-4 w-4 shrink-0 text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden />
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.ul initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden border-t border-line">
                  {mod.subtopics.map((s) => {
                    const active = selected?.module.id === mod.id && selected.subtopic === s;
                    const done = progress.has(subtopicKey(course.id, mod.id, s));
                    return (
                      <li key={s}>
                        <button
                          onClick={() => onSelect({ module: mod, subtopic: s })}
                          aria-current={active ? 'page' : undefined}
                          className={`relative flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm transition-colors ${active ? 'bg-navy text-white' : 'text-navy/85 hover:bg-ivory'}`}
                        >
                          {active && <motion.span layoutId="topic-active" className="absolute inset-y-0 left-0 w-1 bg-saffron" />}
                          {done ? <CheckCircle2 className={`h-4 w-4 shrink-0 ${active ? 'text-teal' : 'text-green'}`} aria-label="Completed" /> : <Circle className={`h-4 w-4 shrink-0 ${active ? 'text-white/60' : 'text-line'}`} aria-hidden />}
                          <span>{s}</span>
                        </button>
                      </li>
                    );
                  })}
                </motion.ul>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </nav>
  );
};

const LessonSkeleton: React.FC<{ subtopic: string }> = ({ subtopic }) => (
  <div className="space-y-5" role="status" aria-live="polite">
    <div className="flex items-center gap-3 rounded-2xl bg-navy-50 p-4">
      <motion.span animate={{ scale: [1, 1.15, 1] }} transition={{ repeat: Infinity, duration: 1.4 }} className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-saffron to-teal text-navy">
        <BookOpen className="h-5 w-5" aria-hidden />
      </motion.span>
      <p className="text-sm font-semibold text-navy">Guru is preparing your lesson on “{subtopic}”…</p>
    </div>
    <Skeleton className="h-8 w-2/3" />
    <Skeleton className="h-4 w-full" />
    <Skeleton className="h-4 w-5/6" />
    <Skeleton className="h-36 w-full rounded-2xl" />
    <Skeleton className="h-4 w-4/5" />
    <Skeleton className="h-28 w-full rounded-2xl" />
  </div>
);

const RequirementsCard: React.FC<{ course: LearningCourse }> = ({ course }) => {
  const r = course.requirements;
  const [open, setOpen] = useState(true);
  if (!r) return null;
  const rows: Array<{ icon: React.ElementType; label: string; items: string[] }> = [
    { icon: GraduationCap, label: 'Before you start', items: r.prerequisites || [] },
    { icon: Wrench, label: 'You will need', items: r.materials || [] },
    { icon: Clock, label: 'Time needed', items: r.duration ? [r.duration] : [] },
    { icon: Target, label: 'You will be able to', items: r.outcomes || [] },
    { icon: Briefcase, label: 'Where it can lead', items: r.careers || [] },
  ].filter((row) => row.items.length);
  return (
    <section className="card overflow-hidden" aria-labelledby={`req-${course.id}`}>
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-ivory">
        <span id={`req-${course.id}`} className="flex items-center gap-2 font-bold text-navy">
          <ListTree className="h-5 w-5 text-teal-600" aria-hidden /> Training requirements & outcomes
        </span>
        <ChevronDown className={`h-4 w-4 text-muted transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="grid gap-4 border-t border-line px-5 py-4 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((row, i) => (
                <motion.div key={row.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                  <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted">
                    <row.icon className="h-3.5 w-3.5" aria-hidden /> {row.label}
                  </p>
                  <ul className="mt-1.5 space-y-1 text-sm text-navy/85">
                    {row.items.map((it) => (
                      <li key={it} className="flex gap-2">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-saffron" aria-hidden />
                        <span>{it}</span>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              ))}
            </div>
            {r.formalTraining && (
              <p className="flex gap-2 border-t border-line bg-teal-50 px-5 py-3 text-sm text-navy/85">
                <Award className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" aria-hidden />
                <span>
                  <span className="font-bold text-navy">Certified training: </span>
                  {r.formalTraining}
                </span>
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

const CourseWorkspace: React.FC<{
  course: LearningCourse;
  langConfig: Language;
  progress: Set<string>;
  onComplete: (key: string) => void;
  onBack: () => void;
  startWithDoubt: boolean;
  initialQuestion?: { text: string; nonce: number; speak?: boolean } | null;
  certificate?: Certificate | null;
  onCertificate: (c: Certificate) => void;
}> = ({ course, langConfig, progress, onComplete, onBack, startWithDoubt, initialQuestion, certificate, onCertificate }) => {
  const first = { module: course.modules[0], subtopic: course.modules[0].subtopics[0] };
  const [selected, setSelected] = useState<Selection | null>(startWithDoubt ? null : first);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'lesson' | 'doubt'>(startWithDoubt ? 'doubt' : 'lesson');
  const [prefill, setPrefill] = useState<{ text: string; nonce: number; speak?: boolean } | null>(initialQuestion || null);
  const speaker = useSpeaker(langConfig.speechLocale);
  const [showCurriculum, setShowCurriculum] = useState(false);
  const cache = useRef(new Map<string, Lesson>());
  const mainRef = useRef<HTMLDivElement>(null);
  const language = langConfig.name || 'English';

  const total = subtopicCount(course);
  const done = course.modules.reduce((n, mod) => n + mod.subtopics.filter((s) => progress.has(subtopicKey(course.id, mod.id, s))).length, 0);

  const flat = useMemo(() => course.modules.flatMap((mod) => mod.subtopics.map((s) => ({ module: mod, subtopic: s }))), [course]);
  const index = selected ? flat.findIndex((f) => f.module.id === selected.module.id && f.subtopic === selected.subtopic) : -1;
  const next = index >= 0 ? flat[index + 1] : undefined;
  const prev = index > 0 ? flat[index - 1] : undefined;

  const load = useCallback(
    async (sel: Selection) => {
      const key = `${subtopicKey(course.id, sel.module.id, sel.subtopic)}|${language}`;
      setError(null);
      if (cache.current.has(key)) {
        setLesson(cache.current.get(key)!);
        return;
      }
      setLesson(null);
      setLoading(true);
      try {
        const l = await fetchLesson({ course: course.title, module: sel.module.title, subtopic: sel.subtopic, language });
        cache.current.set(key, l);
        setLesson(l);
      } catch (e: any) {
        setError(e?.message || 'Could not load the lesson.');
      } finally {
        setLoading(false);
      }
    },
    [course, language]
  );

  useEffect(() => {
    if (selected && tab === 'lesson') load(selected);
  }, [selected, tab, load]);

  const choose = (s: Selection) => {
    speaker.stop();
    setSelected(s);
    setTab('lesson');
    setShowCurriculum(false);
    mainRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const askAbout = (q: string) => {
    setTab('doubt');
    setPrefill({ text: q, nonce: Date.now() });
  };

  const a = ACCENT[course.accent];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button onClick={onBack} className="btn btn-ghost btn-sm">
          <ArrowLeft className="h-4 w-4" aria-hidden /> All courses
        </button>
        {course.certification && (
          <a href={course.certification.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-teal-600 hover:underline">
            Get certified: {course.certification.label} <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        )}
      </div>

      <header className="card flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-6">
        <motion.span
          initial={{ rotate: -20, scale: 0.6 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 220, damping: 14 }}
          className={`grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${a.grad} font-mono text-xl font-extrabold text-white shadow-card`}
          aria-hidden
        >
          {course.glyph}
        </motion.span>
        <div className="min-w-0 flex-1">
          <p className="eyebrow">{course.trackTitle || LEARNING_TRACKS.find((t) => t.courses.includes(course))?.title} · {course.level}</p>
          <h1 className="mt-1 text-2xl font-extrabold text-navy sm:text-3xl">{course.title}</h1>
          <div className="mt-3 max-w-md">
            <Meter value={done} max={total} label={`${done} of ${total} topics complete`} tone="green" />
          </div>
        </div>
      </header>

      <FinalAssessment course={course} language={language} ready={done >= total} remaining={total - done} earned={certificate} onEarned={onCertificate} />

      <RequirementsCard course={course} />

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:self-start lg:overflow-y-auto lg:pr-1">
          <button onClick={() => setShowCurriculum((v) => !v)} aria-expanded={showCurriculum} className="btn btn-outline mb-3 w-full justify-between lg:hidden">
            <span className="inline-flex items-center gap-2">
              <ListTree className="h-4 w-4" aria-hidden /> Curriculum
            </span>
            <ChevronDown className={`h-4 w-4 transition-transform ${showCurriculum ? 'rotate-180' : ''}`} aria-hidden />
          </button>
          <div className={`${showCurriculum ? 'block' : 'hidden'} lg:block`}>
            <Curriculum course={course} selected={selected} progress={progress} onSelect={choose} />
          </div>
        </aside>

        <div ref={mainRef} className="min-w-0 scroll-mt-24">
          <div role="tablist" aria-label="Lesson or doubts" className="mb-5 inline-flex rounded-2xl border border-line bg-white p-1">
            {[
              { id: 'lesson' as const, label: 'Lesson', icon: BookOpen },
              { id: 'doubt' as const, label: 'Ask Guru a doubt', icon: MessageCircleQuestion },
            ].map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => {
                  speaker.stop();
                  setTab(t.id);
                  if (t.id === 'lesson' && !selected) setSelected(first);
                }}
                className="relative inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold"
              >
                {tab === t.id && <motion.span layoutId="learn-tab" className="absolute inset-0 rounded-xl bg-navy" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
                <span className={`relative inline-flex items-center gap-2 ${tab === t.id ? 'text-white' : 'text-muted'}`}>
                  <t.icon className="h-4 w-4" aria-hidden /> {t.label}
                </span>
              </button>
            ))}
          </div>

          <div className={tab === 'lesson' ? '' : 'hidden'}>
            {selected && (
              <p className="mb-3 text-sm font-semibold text-muted">
                {selected.module.title} <span aria-hidden>›</span> <span className="text-navy">{selected.subtopic}</span>
              </p>
            )}
            {loading && selected && <LessonSkeleton subtopic={selected.subtopic} />}
            {error && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-coral/30 bg-coral-50 p-4 text-sm text-coral-600">
                <span>{error}</span>
                <button onClick={() => selected && load(selected)} className="btn btn-outline btn-sm">
                  <RotateCcw className="h-4 w-4" aria-hidden /> Try again
                </button>
              </div>
            )}
            {lesson && !loading && selected && (
              <>
                <LessonView
                  key={selected.module.id + selected.subtopic}
                  lesson={lesson}
                  codeLanguage={course.codeLanguage}
                  onAsk={askAbout}
                  listening={speaker.speakingId === 'lesson'}
                  onListen={speaker.supported ? () => (speaker.speakingId === 'lesson' ? speaker.stop() : speaker.speak('lesson', lessonScript(lesson))) : undefined}
                  onQuizDone={(score, totalQ) => {
                    if (score === totalQ) onComplete(subtopicKey(course.id, selected.module.id, selected.subtopic));
                  }}
                />
                <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-line pt-6">
                  <button onClick={() => askAbout(`I have a doubt about "${selected.subtopic}". Can you explain it again with a different example?`)} className="btn btn-outline">
                    <MessageCircleQuestion className="h-4 w-4" aria-hidden /> Still confused? Ask Guru
                  </button>
                  {!progress.has(subtopicKey(course.id, selected.module.id, selected.subtopic)) && (
                    <button onClick={() => onComplete(subtopicKey(course.id, selected.module.id, selected.subtopic))} className="btn btn-ghost">
                      <CheckCircle2 className="h-4 w-4" aria-hidden /> Mark as done
                    </button>
                  )}
                  <div className="ml-auto flex gap-2">
                    {prev && (
                      <button onClick={() => choose(prev)} className="btn btn-ghost" aria-label={`Previous: ${prev.subtopic}`}>
                        <ArrowLeft className="h-4 w-4" aria-hidden /> Previous
                      </button>
                    )}
                    {next && (
                      <motion.button whileHover={{ x: 3 }} onClick={() => choose(next)} className="btn btn-primary" aria-label={`Next: ${next.subtopic}`}>
                        Next: {next.subtopic.length > 28 ? next.subtopic.slice(0, 26) + '…' : next.subtopic} <ArrowRight className="h-4 w-4" aria-hidden />
                      </motion.button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className={tab === 'doubt' ? '' : 'hidden'}>
            <div className="mb-4 flex items-start gap-3 rounded-2xl bg-navy-50 p-4">
              <BrainCircuit className="mt-0.5 h-5 w-5 shrink-0 text-navy-800" aria-hidden />
              <p className="text-sm text-navy-800">
                Guru restates your problem, breaks it into smaller parts, solves each one and re-checks the answer before replying.
                {course.codeLanguage === 'python' && ' Python answers can be run right here, so you can see the real output.'} AI can still make mistakes — run
                the code and test it yourself.
              </p>
            </div>
            <DoubtSolver
              course={course.title}
              subtopic={selected?.subtopic}
              codeLanguage={course.codeLanguage}
              language={language}
              speechLocale={langConfig.speechLocale}
              prefill={prefill}
              examples={DOUBT_EXAMPLES[course.id] || []}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
};

/* ── learn anything: Guru designs a course for any topic ─────────────── */

const TOPIC_IDEAS = ['Electrician basics', 'Tailoring & stitching', 'Mobile phone repair', 'Tally & GST accounting', 'Spoken Hindi to English', 'Class 10 maths', 'Beauty & wellness', 'Solar panel installation'];

const BUILD_STAGES = ['Understanding what you want to learn', 'Checking training requirements', 'Designing modules and lessons', 'Adding practice and outcomes'];

const BuildingCard: React.FC<{ topic: string }> = ({ topic }) => {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStage((s) => Math.min(s + 1, BUILD_STAGES.length - 1)), 2500);
    return () => clearInterval(t);
  }, []);
  return (
    <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="rounded-2xl border border-line bg-white p-5" role="status" aria-live="polite">
      <div className="flex items-center gap-3">
        <motion.span animate={{ rotate: [0, 15, -15, 0] }} transition={{ repeat: Infinity, duration: 1.6 }} className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-saffron to-teal text-navy">
          <Wand2 className="h-5 w-5" aria-hidden />
        </motion.span>
        <p className="font-bold text-navy">Guru is building your course on “{topic}”…</p>
      </div>
      <ol className="mt-4 grid gap-2 sm:grid-cols-2">
        {BUILD_STAGES.map((label, i) => (
          <li key={label} className={`flex items-center gap-2 text-sm ${i <= stage ? 'text-navy' : 'text-muted/60'}`}>
            {i < stage ? <CheckCircle2 className="h-4 w-4 text-green" aria-hidden /> : i === stage ? <Loader2 className="h-4 w-4 animate-spin text-saffron-600" aria-hidden /> : <Circle className="h-4 w-4 text-line" aria-hidden />}
            {label}
          </li>
        ))}
      </ol>
    </motion.div>
  );
};

const LearnAnything: React.FC<{ speechLocale: string; building: string | null; error: string | null; onBuild: (topic: string) => void }> = ({ speechLocale, building, error, onBuild }) => {
  const [topic, setTopic] = useState('');
  const dictation = useDictation(speechLocale, (t) => setTopic(t));
  return (
    <section id="learn-anything" aria-labelledby="learn-anything-h" className="scroll-mt-28 rounded-[24px] border border-line bg-gradient-to-br from-saffron-50 via-white to-teal-50 p-5 sm:p-7">
      <p className="eyebrow flex items-center gap-2">
        <Wand2 className="h-4 w-4" aria-hidden /> Learn anything
      </p>
      <h2 id="learn-anything-h" className="mt-1 text-2xl font-extrabold text-navy sm:text-3xl">
        What do you want to learn?
      </h2>
      <p className="mt-1 max-w-2xl text-muted">
        A trade, a school subject, a language or a job skill — Guru designs a full course for you, with training requirements, lessons, practice and doubt solving.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (topic.trim().length > 1) onBuild(topic.trim());
        }}
        className="mt-5 flex flex-col gap-2 sm:flex-row"
      >
        <label htmlFor="learn-topic" className="sr-only">
          Topic to learn
        </label>
        <div className="flex flex-1 items-center gap-2 rounded-2xl border border-line bg-white px-3 focus-within:border-teal focus-within:ring-4 focus-within:ring-teal/15">
          <input
            id="learn-topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. electrician basics, tailoring, Excel, Class 10 science…"
            className="h-12 min-w-0 flex-1 bg-transparent text-[15px] text-navy outline-none placeholder:text-muted/70"
          />
          {dictation.supported && (
            <button
              type="button"
              onClick={dictation.listening ? dictation.stop : dictation.start}
              aria-pressed={dictation.listening}
              aria-label={dictation.listening ? 'Stop dictation' : 'Say what you want to learn'}
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl transition ${dictation.listening ? 'animate-pulse bg-coral-50 text-coral-600' : 'text-navy hover:bg-ivory'}`}
            >
              {dictation.listening ? <MicOff className="h-4 w-4" aria-hidden /> : <Mic className="h-4 w-4" aria-hidden />}
            </button>
          )}
        </div>
        <motion.button whileTap={{ scale: 0.97 }} type="submit" disabled={!!building || topic.trim().length < 2} className="btn btn-accent btn-lg">
          {building ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Wand2 className="h-5 w-5" aria-hidden />} Build my course
        </motion.button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        {TOPIC_IDEAS.map((idea, i) => (
          <motion.button
            key={idea}
            initial={{ opacity: 0, y: 6 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.04 }}
            disabled={!!building}
            onClick={() => onBuild(idea)}
            className="rounded-full border border-line bg-white px-3 py-1.5 text-sm text-navy transition hover:-translate-y-0.5 hover:border-saffron disabled:opacity-60"
          >
            {idea}
          </motion.button>
        ))}
      </div>
      <AnimatePresence>
        {building && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-5 overflow-hidden">
            <BuildingCard topic={building} />
          </motion.div>
        )}
      </AnimatePresence>
      {error && !building && (
        <p role="alert" className="mt-4 rounded-xl border border-coral/30 bg-coral-50 px-4 py-3 text-sm text-coral-600">
          {error}
        </p>
      )}
    </section>
  );
};

/* ── suggestions from the profile ─────────────────────────────────────── */

interface Suggestion {
  /** A built-in course to open, or a topic for Guru to build a course on. */
  courseId?: string;
  topic?: string;
  title: string;
  why: string;
}

const COMPUTING = /comput|software|\bit\b|i\.t\.|engineer|b\.?tech|b\.?e\b|bca|mca|b\.?sc|diploma|polytechnic|coding|program|developer|data|student|college/i;
const SCHOOLED = /10th|12th|sslc|hsc|matric|secondary|graduat|degree|diploma|iti|b\.|m\.|engineer|bca|mca|phd/i;

/** Up to three next steps that fit what the profile says about the person. */
export function suggestionsFor(p?: BeneficiaryProfile): Suggestion[] {
  if (!p) return [];
  const education = (p.education || '').trim();
  const work = (p.traditionalTrade || p.currentOccupation || '').trim();
  const skills = (p.existingSkills || '').trim();
  if (!education && !work && !skills) return [];
  const all = `${education} ${work} ${skills}`;
  const out: Suggestion[] = [];
  if (COMPUTING.test(all)) {
    out.push({ courseId: 'python', title: 'Python programming', why: education ? `Builds on your studies (${education})` : 'Fits your interest in computers' });
    out.push({ courseId: 'web', title: 'Web development', why: 'Websites are one of the most asked-for skills in IT jobs' });
  } else if (!SCHOOLED.test(education)) {
    out.push({ courseId: 'digital-basics', title: 'Computer and digital basics', why: 'A good first step: phones, computers, UPI and online services' });
  }
  if (work && !COMPUTING.test(work)) out.push({ topic: `Growing a small ${work.toLowerCase()} business`, title: `Grow your ${work.toLowerCase()} work`, why: `Made for your work as ${work.toLowerCase()}: costs, pricing, customers and going online` });
  out.push({ courseId: 'career', title: 'Job readiness and interviews', why: 'Spoken English, a CV and interview practice for the jobs you want' });
  return out.slice(0, 3);
}

const ForYou: React.FC<{ suggestions: Suggestion[]; firstName?: string; onOpen: (s: Suggestion) => void; building: string | null }> = ({ suggestions, firstName, onOpen, building }) => {
  if (!suggestions.length) return null;
  return (
    <section aria-labelledby="for-you" className="space-y-4">
      <div>
        <p className="eyebrow flex items-center gap-2">
          <Sparkles className="h-4 w-4" aria-hidden /> From your profile
        </p>
        <h2 id="for-you" className="mt-1 text-2xl font-extrabold text-navy sm:text-3xl">
          {firstName ? `Suggested for you, ${firstName}` : 'Suggested for you'}
        </h2>
      </div>
      <ul className="grid gap-3 sm:grid-cols-3">
        {suggestions.map((s) => (
          <li key={s.courseId || s.topic}>
            <button
              onClick={() => onOpen(s)}
              disabled={Boolean(building)}
              className="flex h-full w-full flex-col items-start gap-1 rounded-2xl border border-line bg-white p-4 text-left transition hover:border-teal/50 hover:shadow-sm disabled:opacity-60"
            >
              <span className="flex items-center gap-2 font-bold text-navy">
                {s.topic ? <Wand2 className="h-4 w-4 text-saffron-600" aria-hidden /> : <BookOpen className="h-4 w-4 text-teal-600" aria-hidden />}
                {s.title}
              </span>
              <span className="text-sm leading-relaxed text-muted">{s.why}</span>
              <span className="mt-auto inline-flex items-center gap-1 pt-2 text-sm font-semibold text-teal-600">
                {building && s.topic === building ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                {s.topic ? 'Build this course' : 'Start'} <ArrowRight className="h-4 w-4" aria-hidden />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
};

/* ── page ─────────────────────────────────────────────────────────────── */

export const LearningHubPage: React.FC<{
  langConfig: Language;
  /** The person's profile: suggestions follow their education, work and skills. */
  profile?: BeneficiaryProfile;
  onNavigate?: (mode: ChannelMode) => void;
  entry?: LearningEntry | null;
  onEntryHandled?: () => void;
}> = ({ langConfig, profile, onNavigate, entry, onEntryHandled }) => {
  const [progress, setProgress] = useState<Set<string>>(loadProgress);
  const [open, setOpen] = useState<{ courseId: string; doubt: boolean; question?: { text: string; nonce: number; speak?: boolean } | null } | null>(null);
  const [custom, setCustom] = useState<LearningCourse[]>(loadCustom);
  // Certificates live with the learner's account (none until they have a profile)
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  useEffect(() => {
    autofillApi.certificates().then(setCertificates).catch(() => setCertificates([]));
  }, []);

  // Progress and built courses are kept with the account too, so they follow the learner to any
  // device. This browser keeps its copy, so the hub still works without an account.
  const account = useRef(false);
  useEffect(() => {
    autofillApi
      .learning()
      .then((saved) => {
        account.current = true;
        setProgress((local) => {
          const merged = new Set([...saved.progress, ...local]);
          saveProgress(merged);
          if (merged.size > saved.progress.length) autofillApi.saveLearning({ progress: [...merged] }).catch(() => {});
          return merged;
        });
        setCustom((local) => {
          const fromAccount = (saved.courses as LearningCourse[]).filter((c) => c?.id && Array.isArray(c.modules));
          const merged = [...local, ...fromAccount.filter((c) => !local.some((l) => l.id === c.id))].slice(0, 12);
          saveCustom(merged);
          if (local.some((l) => !fromAccount.some((c) => c.id === l.id))) autofillApi.saveLearning({ courses: merged }).catch(() => {});
          return merged;
        });
      })
      .catch(() => {});
  }, []);
  const storeCustom = (list: LearningCourse[]) => {
    saveCustom(list);
    if (account.current) autofillApi.saveLearning({ courses: list.slice(0, 12) }).catch(() => {});
  };
  const [building, setBuilding] = useState<string | null>(null);
  const [buildError, setBuildError] = useState<string | null>(null);
  const language = langConfig.name || 'English';
  const reduce = typeof document !== 'undefined' && document.documentElement.dataset.motion === 'reduce';

  const complete = useCallback((key: string) => {
    setProgress((p) => {
      if (p.has(key)) return p;
      const n = new Set(p);
      n.add(key);
      saveProgress(n);
      if (account.current) autofillApi.saveLearning({ progress: [key] }).catch(() => {});
      return n;
    });
  }, []);

  const allCourses = useMemo(() => [...custom, ...LEARNING_TRACKS.flatMap((t) => t.courses)], [custom]);
  const course = open ? allCourses.find((c) => c.id === open.courseId) : undefined;
  const doneIn = (c: LearningCourse) => c.modules.reduce((n, mod) => n + mod.subtopics.filter((s) => progress.has(subtopicKey(c.id, mod.id, s))).length, 0);

  const go = (courseId: string, doubt = false, question?: { text: string; nonce: number; speak?: boolean } | null) => {
    setOpen({ courseId, doubt, question });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const build = useCallback(
    async (topic: string, context?: string, question?: string) => {
      setBuilding(topic);
      setBuildError(null);
      setOpen(null);
      try {
        const c = await buildCourse({ topic, language, context });
        setCustom((list) => {
          const next = [c, ...list.filter((x) => x.id !== c.id)];
          storeCustom(next);
          return next;
        });
        setOpen({ courseId: c.id, doubt: looksLikeQuestion(question), question: looksLikeQuestion(question) ? { text: question!, nonce: Date.now() } : null });
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (e: any) {
        setBuildError(e?.message || 'Guru could not build that course. Please try again.');
      } finally {
        setBuilding(null);
      }
    },
    [language]
  );

  const removeCustom = (id: string) =>
    setCustom((list) => {
      const next = list.filter((c) => c.id !== id);
      storeCustom(next);
      return next;
    });

  // Hand-off from the voice assistant, chat, helpline or a Skills course card
  const handled = useRef<number | null>(null);
  useEffect(() => {
    if (!entry || handled.current === entry.nonce) return;
    handled.current = entry.nonce;
    onEntryHandled?.();
    const ask = looksLikeQuestion(entry.question);
    const spoken = entry.channel === 'voice';
    if (entry.courseId && allCourses.some((c) => c.id === entry.courseId)) {
      go(entry.courseId, ask, ask ? { text: entry.question!, nonce: entry.nonce, speak: spoken } : null);
    } else if (entry.topic) {
      build(entry.topic, entry.context, entry.question);
      setTimeout(() => document.getElementById('learn-anything')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry?.nonce]);

  return (
    <MotionConfig reducedMotion={reduce ? 'always' : 'user'}>
      <div className="space-y-10">
        <OpportunityTabs current="learning" onNavigate={onNavigate} />
        <AnimatePresence mode="wait">
          {course ? (
            <motion.div key={course.id} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.3 }}>
              <CourseWorkspace
                course={course}
                langConfig={langConfig}
                progress={progress}
                onComplete={complete}
                onBack={() => setOpen(null)}
                startWithDoubt={open!.doubt}
                initialQuestion={open!.question}
                certificate={certificates.find((c) => c.courseId === course.id)}
                onCertificate={(c) => setCertificates((list) => [c, ...list.filter((x) => x.courseId !== c.courseId)])}
              />
            </motion.div>
          ) : (
            <motion.div key="catalogue" initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }} transition={{ duration: 0.3 }} className="space-y-12">
              <Hero onStart={() => go('python')} onAsk={() => go('python', true)} />

              <motion.ul
                initial="hidden"
                whileInView="show"
                viewport={{ once: true }}
                variants={{ show: { transition: { staggerChildren: 0.1 } } }}
                className="grid gap-3 sm:grid-cols-3"
              >
                {[
                  { icon: BookOpen, title: 'Learn', body: 'Pick any subtopic — Guru explains it with simple examples and an everyday analogy.' },
                  { icon: Code2, title: 'Practise', body: 'Edit and run Python code in your browser, then test yourself with a quick quiz.' },
                  { icon: BrainCircuit, title: 'Clear doubts', body: 'Ask anything. Guru breaks your problem into small steps, solves each, and checks the answer.' },
                ].map((f) => (
                  <motion.li key={f.title} variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }} className="flex gap-3 rounded-2xl border border-line bg-white p-4">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-600">
                      <f.icon className="h-5 w-5" aria-hidden />
                    </span>
                    <div>
                      <p className="font-bold text-navy">{f.title}</p>
                      <p className="mt-0.5 text-sm leading-relaxed text-muted">{f.body}</p>
                    </div>
                  </motion.li>
                ))}
              </motion.ul>

              <ForYou
                suggestions={suggestionsFor(profile)}
                firstName={profile?.name?.trim().split(/\s+/)[0]}
                building={building}
                onOpen={(s) => (s.courseId ? go(s.courseId) : build(s.topic!, `The learner works as ${profile?.traditionalTrade || profile?.currentOccupation}.`))}
              />

              <LearnAnything speechLocale={langConfig.speechLocale} building={building} error={buildError} onBuild={(t) => build(t)} />

              {custom.length > 0 && (
                <section aria-labelledby="track-custom" className="space-y-5">
                  <div>
                    <p className="eyebrow flex items-center gap-2">
                      <Wand2 className="h-4 w-4" aria-hidden /> Made for you
                    </p>
                    <h2 id="track-custom" className="mt-1 text-2xl font-extrabold text-navy sm:text-3xl">
                      Your courses
                    </h2>
                  </div>
                  <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {custom.map((c, i) => (
                      <CourseCard key={c.id} course={c} index={i} done={doneIn(c)} onOpen={() => go(c.id)} onRemove={() => removeCustom(c.id)} />
                    ))}
                  </ul>
                </section>
              )}

              <MyCertificates certificates={certificates} />

              {LEARNING_TRACKS.map((track) => (
                <section key={track.id} aria-labelledby={`track-${track.id}`} className="space-y-5">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="eyebrow flex items-center gap-2">
                        <GraduationCap className="h-4 w-4" aria-hidden /> Track
                      </p>
                      <h2 id={`track-${track.id}`} className="mt-1 text-2xl font-extrabold text-navy sm:text-3xl">
                        {track.title}
                      </h2>
                      <p className="mt-1 text-muted">{track.tagline}</p>
                    </div>
                  </div>
                  <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {track.courses.map((c, i) => (
                      <CourseCard key={c.id} course={c} index={i} done={doneIn(c)} onOpen={() => go(c.id)} />
                    ))}
                  </ul>
                </section>
              ))}

              <p className="text-center text-xs text-muted">
                Lessons are explained by AI and can contain mistakes — run the code and check important facts. For certified courses, visit Skill India Digital Hub.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
};
