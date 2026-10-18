import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  BrainCircuit,
  Check,
  CheckCircle2,
  Copy,
  Lightbulb,
  ListChecks,
  Loader2,
  Mic,
  MicOff,
  Play,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  Square,
  Target,
  TriangleAlert,
  Volume2,
  XCircle,
} from 'lucide-react';
import { pythonWarm, runPython, type RunResult } from '../../services/pythonRunner';
import { askDoubt, type DoubtSolution, type Lesson, type QuizItem } from '../../services/learnApi';
import { useDictation } from '../smartapply/media';
import { useSpeaker } from './useSpeaker';

/* ── rich text: paragraphs, "- " bullets, `code` and **bold** ───────────── */

function inline(text: string, keyBase: string) {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2)
      return (
        <code key={keyBase + i} className="rounded-md bg-navy-50 px-1.5 py-0.5 font-mono text-[0.85em] text-navy-800">
          {part.slice(1, -1)}
        </code>
      );
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4)
      return (
        <strong key={keyBase + i} className="font-bold text-navy">
          {part.slice(2, -2)}
        </strong>
      );
    return <React.Fragment key={keyBase + i}>{part}</React.Fragment>;
  });
}

export const RichText: React.FC<{ text?: string; className?: string }> = ({ text = '', className = '' }) => {
  const blocks: Array<{ type: 'p' | 'ul'; lines: string[] }> = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const bullet = /^[-•*]\s+/.test(line);
    const content = line.replace(/^[-•*]\s+/, '');
    const last = blocks[blocks.length - 1];
    if (bullet) last?.type === 'ul' ? last.lines.push(content) : blocks.push({ type: 'ul', lines: [content] });
    else blocks.push({ type: 'p', lines: [content] });
  }
  return (
    <div className={`space-y-2 leading-relaxed ${className}`}>
      {blocks.map((b, i) =>
        b.type === 'ul' ? (
          <ul key={i} className="space-y-1">
            {b.lines.map((l, j) => (
              <li key={j} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-saffron" aria-hidden />
                <span>{inline(l, `${i}-${j}-`)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p key={i}>{inline(b.lines[0], `${i}-`)}</p>
        )
      )}
    </div>
  );
};

/* ── listen (read aloud) ───────────────────────────────────────────────── */

export const ListenButton: React.FC<{ active: boolean; onToggle: () => void; dark?: boolean }> = ({ active, onToggle, dark }) => (
  <button
    type="button"
    onClick={onToggle}
    aria-pressed={active}
    className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-bold transition ${
      dark
        ? active
          ? 'border-saffron bg-saffron text-navy'
          : 'border-white/25 text-white hover:bg-white/10'
        : active
          ? 'border-teal-600 bg-teal-600 text-white'
          : 'border-line bg-white text-navy hover:border-teal hover:text-teal-600'
    }`}
  >
    {active ? (
      <>
        <span className="flex h-3 items-end gap-0.5" aria-hidden>
          {[0, 1, 2].map((i) => (
            <motion.span key={i} className="w-0.5 rounded bg-current" animate={{ height: ['30%', '100%', '30%'] }} transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15 }} />
          ))}
        </span>
        Stop <Square className="h-3 w-3" aria-hidden />
      </>
    ) : (
      <>
        <Volume2 className="h-4 w-4" aria-hidden /> Listen
      </>
    )}
  </button>
);

export function lessonScript(l: Lesson) {
  return [
    l.title + '.',
    l.overview,
    l.analogy ? `Think of it like this. ${l.analogy}` : '',
    ...l.sections.map((s, i) => `Part ${i + 1}. ${s.heading}. ${s.body}${s.code?.trim() ? ' The example is shown on your screen — try running it.' : ''}`),
    l.keyPoints.length ? `Key points. ${l.keyPoints.join('. ')}.` : '',
    l.commonMistakes?.length ? `Common mistakes to avoid. ${l.commonMistakes.join('. ')}.` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

export function solutionScript(s: DoubtSolution) {
  return [
    s.understanding,
    s.approach ? `Here is the plan. ${s.approach}` : '',
    ...s.steps.map((st, i) => `Step ${i + 1}. ${st.title}. ${st.explanation}`),
    `So, the answer. ${s.answer}`,
    s.code?.trim() ? 'The full code is on your screen.' : '',
  ]
    .filter(Boolean)
    .join(' ');
}

/* ── code block with copy + run (Python runs for real in the browser) ───── */

const norm = (s: string) => s.replace(/\r/g, '').split('\n').map((l) => l.trimEnd()).join('\n').trim();

export const CodeBlock: React.FC<{ code: string; language?: string; expectedOutput?: string; editable?: boolean; runnable?: boolean }> = ({
  code,
  language,
  expectedOutput,
  editable = true,
  runnable: allowRun = true,
}) => {
  const [source, setSource] = useState(code);
  const [copied, setCopied] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const runnable = allowRun && language === 'python';
  useEffect(() => {
    setSource(code);
    setResult(null);
  }, [code]);

  const run = async () => {
    setRunning(true);
    setResult(null);
    setResult(await runPython(source));
    setRunning(false);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(source);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const matches = result?.ok && expectedOutput ? norm(result.output) === norm(expectedOutput) : null;
  const lines = source.split('\n').length;

  return (
    <div className="overflow-hidden rounded-2xl border border-navy-800 bg-navy shadow-lift">
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="flex gap-1.5" aria-hidden>
            <span className="h-2.5 w-2.5 rounded-full bg-coral" />
            <span className="h-2.5 w-2.5 rounded-full bg-saffron" />
            <span className="h-2.5 w-2.5 rounded-full bg-teal" />
          </span>
          <span className="ml-2 font-mono text-xs uppercase tracking-wider text-white/50">{language || 'code'}</span>
        </div>
        <div className="flex items-center gap-1">
          {runnable && source !== code && (
            <button onClick={() => setSource(code)} className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-white/70 hover:bg-white/10 hover:text-white">
              <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Reset
            </button>
          )}
          <button onClick={copy} className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-white/70 hover:bg-white/10 hover:text-white">
            {copied ? <Check className="h-3.5 w-3.5 text-teal" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />} {copied ? 'Copied' : 'Copy'}
          </button>
          {runnable && (
            <button
              onClick={run}
              disabled={running}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-teal px-3 text-xs font-bold text-navy transition hover:bg-[#3fd0bf] disabled:opacity-70"
            >
              {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Play className="h-3.5 w-3.5" aria-hidden />}
              {running ? (pythonWarm() ? 'Running…' : 'Loading Python…') : 'Run code'}
            </button>
          )}
        </div>
      </div>
      {runnable && editable ? (
        <textarea
          value={source}
          onChange={(e) => setSource(e.target.value)}
          spellCheck={false}
          aria-label="Code editor — you can change the code and run it"
          rows={Math.min(Math.max(lines, 3), 22)}
          className="block w-full resize-y bg-transparent px-4 py-3 font-mono text-[13px] leading-6 text-[#e6edf7] outline-none"
          onKeyDown={(e) => {
            if (e.key === 'Tab') {
              e.preventDefault();
              const t = e.currentTarget;
              const s = t.selectionStart;
              setSource(source.slice(0, s) + '    ' + source.slice(t.selectionEnd));
              requestAnimationFrame(() => (t.selectionStart = t.selectionEnd = s + 4));
            }
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) run();
          }}
        />
      ) : (
        <pre className="overflow-x-auto px-4 py-3 font-mono text-[13px] leading-6 text-[#e6edf7]">
          <code>{source}</code>
        </pre>
      )}
      <AnimatePresence initial={false}>
        {(result || (!runnable && expectedOutput)) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-white/10 bg-black/25"
          >
            <div className="px-4 py-3">
              <p className="mb-1 font-mono text-[11px] font-bold uppercase tracking-wider text-white/45">{result ? 'Output' : 'Expected output'}</p>
              {result ? (
                <>
                  {result.output && <pre className="whitespace-pre-wrap font-mono text-[13px] leading-6 text-[#bdf5ec]">{result.output}</pre>}
                  {result.error && <pre className="whitespace-pre-wrap font-mono text-[13px] leading-6 text-[#ffb4b2]">{result.error}</pre>}
                  {!result.output && !result.error && <p className="font-mono text-[13px] text-white/50">(no output)</p>}
                  {matches !== null && (
                    <p className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${matches ? 'bg-teal/15 text-teal' : 'bg-saffron/15 text-saffron'}`}>
                      {matches ? <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> : <TriangleAlert className="h-3.5 w-3.5" aria-hidden />}
                      {matches ? 'Verified: the real output matches the explanation' : 'The real output differs from the explanation — trust the output above'}
                    </p>
                  )}
                </>
              ) : (
                <pre className="whitespace-pre-wrap font-mono text-[13px] leading-6 text-white/75">{expectedOutput}</pre>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ── quiz ─────────────────────────────────────────────────────────────── */

export const Quiz: React.FC<{ items: QuizItem[]; onComplete?: (score: number) => void }> = ({ items, onComplete }) => {
  const [picked, setPicked] = useState<Record<number, number>>({});
  const answered = Object.keys(picked).length;
  const score = items.filter((q, i) => picked[i] === q.answerIndex).length;
  const reported = useRef(false);
  useEffect(() => {
    if (answered === items.length && items.length && !reported.current) {
      reported.current = true;
      onComplete?.(score);
    }
  }, [answered, items.length, score, onComplete]);

  return (
    <div className="space-y-4">
      {items.map((q, qi) => {
        const chosen = picked[qi];
        const done = chosen !== undefined;
        return (
          <motion.div key={qi} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: qi * 0.06 }} className="rounded-2xl border border-line bg-white p-4">
            <p className="font-semibold text-navy">
              <span className="mr-2 text-saffron-600">Q{qi + 1}.</span>
              {inline(q.question, `q${qi}`)}
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {q.options.map((opt, oi) => {
                const correct = oi === q.answerIndex;
                const state = !done ? 'idle' : correct ? 'correct' : oi === chosen ? 'wrong' : 'dim';
                return (
                  <motion.button
                    key={oi}
                    whileTap={!done ? { scale: 0.97 } : undefined}
                    animate={state === 'wrong' ? { x: [0, -6, 6, -4, 4, 0] } : state === 'correct' ? { scale: [1, 1.03, 1] } : {}}
                    transition={{ duration: 0.4 }}
                    disabled={done}
                    onClick={() => setPicked((p) => ({ ...p, [qi]: oi }))}
                    className={`flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
                      state === 'correct'
                        ? 'border-green bg-green-50 font-semibold text-green-600'
                        : state === 'wrong'
                          ? 'border-coral bg-coral-50 text-coral-600'
                          : state === 'dim'
                            ? 'border-line text-muted'
                            : 'border-line hover:border-navy/40 hover:bg-ivory'
                    }`}
                  >
                    {state === 'correct' ? <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden /> : state === 'wrong' ? <XCircle className="h-4 w-4 shrink-0" aria-hidden /> : <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-line text-[11px] font-bold text-muted">{String.fromCharCode(65 + oi)}</span>}
                    <span>{inline(opt, `o${qi}${oi}`)}</span>
                  </motion.button>
                );
              })}
            </div>
            <AnimatePresence>
              {done && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="overflow-hidden">
                  <p className="mt-3 rounded-xl bg-ivory p-3 text-sm text-navy/85">
                    <span className="font-bold">{chosen === q.answerIndex ? 'Correct! ' : 'Not quite. '}</span>
                    {inline(q.explanation, `e${qi}`)}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
      {answered === items.length && items.length > 0 && (
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-3 rounded-2xl bg-navy p-4 text-white">
          <Sparkles className="h-6 w-6 text-saffron" aria-hidden />
          <p className="font-semibold">
            You scored {score} of {items.length}. {score === items.length ? 'Excellent — this topic is marked complete.' : 'Review the explanations, then try the practice task.'}
          </p>
        </motion.div>
      )}
    </div>
  );
};

/* ── lesson ───────────────────────────────────────────────────────────── */

const reveal = { hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const } } };

export const LessonView: React.FC<{
  lesson: Lesson;
  codeLanguage?: string;
  onAsk: (q: string) => void;
  onQuizDone: (score: number, total: number) => void;
  listening?: boolean;
  onListen?: () => void;
}> = ({ lesson, codeLanguage, onAsk, onQuizDone, listening = false, onListen }) => (
  <motion.article initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.09 } } }} className="space-y-6">
    <motion.div variants={reveal}>
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-2xl font-extrabold text-navy sm:text-3xl">{lesson.title}</h2>
        {onListen && <ListenButton active={listening} onToggle={onListen} />}
      </div>
      <RichText text={lesson.overview} className="mt-3 text-base text-navy/85" />
    </motion.div>

    {lesson.analogy && (
      <motion.div variants={reveal} className="flex gap-3 rounded-2xl border border-saffron/40 bg-saffron-50 p-4">
        <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-saffron-600" aria-hidden />
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-saffron-600">Think of it like this</p>
          <RichText text={lesson.analogy} className="mt-1 text-sm text-navy/85" />
        </div>
      </motion.div>
    )}

    {lesson.sections.map((s, i) => (
      <motion.section key={i} variants={reveal} className="space-y-3">
        <h3 className="flex items-center gap-3 text-lg font-bold text-navy">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-navy text-sm font-bold text-white">{i + 1}</span>
          {s.heading}
        </h3>
        <RichText text={s.body} className="text-[15px] text-navy/85" />
        {s.code?.trim() && <CodeBlock code={s.code.trim()} language={codeLanguage} expectedOutput={s.expectedOutput?.trim() || undefined} />}
      </motion.section>
    ))}

    <motion.div variants={reveal} className="grid gap-4 md:grid-cols-2">
      <div className="rounded-2xl border border-line bg-white p-4">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-600">
          <ListChecks className="h-4 w-4" aria-hidden /> Key points
        </p>
        <ul className="mt-2 space-y-1.5 text-sm text-navy/85">
          {lesson.keyPoints.map((k, i) => (
            <li key={i} className="flex gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green" aria-hidden /> <span>{inline(k, `k${i}`)}</span>
            </li>
          ))}
        </ul>
      </div>
      {!!lesson.commonMistakes?.length && (
        <div className="rounded-2xl border border-line bg-white p-4">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-coral-600">
            <TriangleAlert className="h-4 w-4" aria-hidden /> Common mistakes
          </p>
          <ul className="mt-2 space-y-1.5 text-sm text-navy/85">
            {lesson.commonMistakes.map((k, i) => (
              <li key={i} className="flex gap-2">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-coral" aria-hidden /> <span>{inline(k, `c${i}`)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </motion.div>

    {!!lesson.quiz?.length && (
      <motion.section variants={reveal}>
        <h3 className="mb-3 flex items-center gap-2 text-lg font-bold text-navy">
          <Target className="h-5 w-5 text-saffron-600" aria-hidden /> Quick check
        </h3>
        <Quiz items={lesson.quiz} onComplete={(score) => onQuizDone(score, lesson.quiz.length)} />
      </motion.section>
    )}

    {lesson.practice && (
      <motion.div variants={reveal} className="rounded-2xl bg-teal-50 p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-teal-600">Practice task</p>
        <RichText text={lesson.practice} className="mt-1 text-sm text-navy/85" />
        <button onClick={() => onAsk(`Help me solve this practice task step by step: ${lesson.practice}`)} className="btn btn-teal btn-sm mt-3">
          <BrainCircuit className="h-4 w-4" aria-hidden /> Ask Guru to walk me through it
        </button>
      </motion.div>
    )}
  </motion.article>
);

/* ── doubt solver ─────────────────────────────────────────────────────── */

const THINKING = ['Understanding your question', 'Breaking it into smaller problems', 'Solving each part', 'Checking the answer'];

const ThinkingCard: React.FC = () => {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStage((s) => Math.min(s + 1, THINKING.length - 1)), 2200);
    return () => clearInterval(t);
  }, []);
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-line bg-white p-5" role="status" aria-live="polite">
      <div className="flex items-center gap-3">
        <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 3, ease: 'linear' }} className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-saffron to-teal text-navy">
          <BrainCircuit className="h-5 w-5" aria-hidden />
        </motion.span>
        <p className="font-bold text-navy">Guru is thinking…</p>
      </div>
      <ol className="mt-4 space-y-2">
        {THINKING.map((label, i) => (
          <li key={label} className={`flex items-center gap-2 text-sm transition-colors ${i <= stage ? 'text-navy' : 'text-muted/60'}`}>
            {i < stage ? <CheckCircle2 className="h-4 w-4 text-green" aria-hidden /> : i === stage ? <Loader2 className="h-4 w-4 animate-spin text-saffron-600" aria-hidden /> : <span className="h-4 w-4 rounded-full border border-line" aria-hidden />}
            {label}
          </li>
        ))}
      </ol>
    </motion.div>
  );
};

const SolutionView: React.FC<{ solution: DoubtSolution; codeLanguage?: string; onFollowUp: (q: string) => void; listening?: boolean; onListen?: () => void }> = ({
  solution,
  codeLanguage,
  onFollowUp,
  listening = false,
  onListen,
}) => (
  <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.12 } } }} className="space-y-4">
    <motion.div variants={reveal} className="rounded-2xl border border-line bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wider text-muted">What you're asking</p>
        {onListen && <ListenButton active={listening} onToggle={onListen} />}
      </div>
      <RichText text={solution.understanding} className="mt-1 text-navy" />
      {solution.approach && (
        <p className="mt-3 rounded-xl bg-navy-50 px-3 py-2 text-sm text-navy-800">
          <span className="font-bold">Plan: </span>
          {inline(solution.approach, 'ap')}
        </p>
      )}
    </motion.div>

    <ol className="relative space-y-4 pl-10 before:absolute before:left-[15px] before:top-2 before:h-[calc(100%-1rem)] before:w-0.5 before:bg-gradient-to-b before:from-saffron before:to-teal">
      {solution.steps.map((s, i) => (
        <motion.li key={i} variants={reveal} className="relative">
          <span className="absolute -left-10 top-0 grid h-8 w-8 place-items-center rounded-full bg-navy text-sm font-bold text-white ring-4 ring-ivory">{i + 1}</span>
          <div className="rounded-2xl border border-line bg-white p-4">
            <p className="font-bold text-navy">{inline(s.title, `st${i}`)}</p>
            <RichText text={s.explanation} className="mt-1 text-sm text-navy/85" />
            {s.code?.trim() && (
              <div className="mt-3">
                <CodeBlock code={s.code.trim()} language={codeLanguage} runnable={false} />
              </div>
            )}
          </div>
        </motion.li>
      ))}
    </ol>

    <motion.div variants={reveal} className="rounded-2xl bg-gradient-to-br from-navy to-navy-800 p-5 text-white shadow-lift">
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-saffron">
        <Sparkles className="h-4 w-4" aria-hidden /> Answer
      </p>
      <RichText text={solution.answer} className="mt-2 text-white/95 [&_code]:bg-white/10 [&_code]:text-[#ffd59a] [&_strong]:text-white" />
    </motion.div>

    {solution.code?.trim() && (
      <motion.div variants={reveal}>
        <CodeBlock code={solution.code.trim()} language={codeLanguage} expectedOutput={solution.expectedOutput?.trim() || undefined} />
      </motion.div>
    )}

    <motion.div variants={reveal} className="flex gap-3 rounded-2xl border border-green/30 bg-green-50 p-4">
      <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-green" aria-hidden />
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-green-600">How Guru checked this</p>
        <RichText text={solution.verification} className="mt-1 text-sm text-navy/85" />
        {codeLanguage === 'python' && solution.code?.trim() && <p className="mt-1 text-xs text-muted">Press “Run code” to confirm the output for yourself.</p>}
      </div>
    </motion.div>

    {!!solution.followUps?.length && (
      <motion.div variants={reveal} className="flex flex-wrap gap-2">
        {solution.followUps.map((f) => (
          <button key={f} onClick={() => onFollowUp(f)} className="rounded-full border border-line bg-white px-3 py-1.5 text-left text-sm text-navy transition hover:-translate-y-0.5 hover:border-teal hover:text-teal-600">
            {f}
          </button>
        ))}
      </motion.div>
    )}
  </motion.div>
);

export interface DoubtEntry {
  id: number;
  question: string;
  solution?: DoubtSolution;
  error?: string;
}

export const DoubtSolver: React.FC<{
  course: string;
  subtopic?: string;
  codeLanguage?: string;
  language: string;
  speechLocale: string;
  prefill?: { text: string; nonce: number; speak?: boolean } | null;
  examples?: string[];
}> = ({ course, subtopic, codeLanguage, language, speechLocale, prefill, examples = [] }) => {
  const [text, setText] = useState('');
  const [entries, setEntries] = useState<DoubtEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const viaVoice = useRef(false);
  const dictation = useDictation(speechLocale, (t) => {
    viaVoice.current = true;
    setText((prev) => (prev ? `${prev} ${t}` : t));
  });
  const speaker = useSpeaker(speechLocale);

  const ask = async (question: string, spoken = viaVoice.current) => {
    viaVoice.current = false;
    const q = question.trim();
    if (!q || busy) return;
    const id = Date.now();
    setEntries((list) => [{ id, question: q }, ...list]);
    setText('');
    setBusy(true);
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    try {
      const history = entries
        .filter((e) => e.solution)
        .slice(0, 3)
        .map((e) => ({ question: e.question, answer: e.solution!.answer }));
      const solution = await askDoubt({ course, subtopic, question: q, language, history });
      setEntries((list) => list.map((e) => (e.id === id ? { ...e, solution } : e)));
      // Asked by voice → answer by voice too
      if (spoken && speaker.supported) speaker.speak(String(id), solutionScript(solution));
    } catch (err: any) {
      setEntries((list) => list.map((e) => (e.id === id ? { ...e, error: err?.message || 'Something went wrong.' } : e)));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (prefill?.text) ask(prefill.text, Boolean(prefill.speak));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill?.nonce]);

  return (
    <div ref={topRef} className="scroll-mt-28 space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(text);
        }}
        className="rounded-2xl border border-line bg-white p-3 shadow-card focus-within:border-teal focus-within:ring-4 focus-within:ring-teal/15"
      >
        <label htmlFor="doubt-input" className="sr-only">
          Your doubt
        </label>
        <textarea
          id="doubt-input"
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              ask(text);
            }
          }}
          rows={3}
          placeholder={subtopic ? `Ask anything about “${subtopic}” — or paste your code and error…` : 'Ask any doubt, describe a problem, or paste your code and error…'}
          className="block w-full resize-y bg-transparent px-2 py-1 text-[15px] text-navy outline-none placeholder:text-muted/70"
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="hidden text-xs text-muted sm:block">Enter to send · Shift+Enter for a new line</p>
          <div className="ml-auto flex items-center gap-2">
            {dictation.supported && (
              <button
                type="button"
                onClick={dictation.listening ? dictation.stop : dictation.start}
                aria-pressed={dictation.listening}
                aria-label={dictation.listening ? 'Stop dictation' : 'Speak your doubt'}
                className={`grid h-10 w-10 place-items-center rounded-xl border transition ${dictation.listening ? 'animate-pulse border-coral bg-coral-50 text-coral-600' : 'border-line text-navy hover:bg-ivory'}`}
              >
                {dictation.listening ? <MicOff className="h-4 w-4" aria-hidden /> : <Mic className="h-4 w-4" aria-hidden />}
              </button>
            )}
            <button type="submit" disabled={busy || !text.trim()} className="btn btn-accent btn-sm h-10">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />} Ask Guru
            </button>
          </div>
        </div>
      </form>

      {!entries.length && examples.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {examples.map((ex, i) => (
            <motion.button
              key={ex}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.07 }}
              onClick={() => ask(ex, false)}
              className="rounded-full border border-dashed border-navy/25 bg-white px-3 py-1.5 text-left text-sm text-navy/80 transition hover:-translate-y-0.5 hover:border-saffron hover:text-navy"
            >
              {ex}
            </motion.button>
          ))}
        </div>
      )}

      <AnimatePresence initial={false}>
        {entries.map((e) => (
          <motion.div key={e.id} layout initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3 border-t border-line pt-4 first:border-t-0 first:pt-0">
            <div className="flex justify-end">
              <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-navy px-4 py-2.5 text-sm text-white">{e.question}</p>
            </div>
            {e.solution ? (
              <SolutionView
                solution={e.solution}
                codeLanguage={codeLanguage}
                onFollowUp={(q) => ask(q, false)}
                listening={speaker.speakingId === String(e.id)}
                onListen={speaker.supported ? () => (speaker.speakingId === String(e.id) ? speaker.stop() : speaker.speak(String(e.id), solutionScript(e.solution!))) : undefined}
              />
            ) : e.error ? (
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-coral/30 bg-coral-50 p-4 text-sm text-coral-600">
                <span>{e.error}</span>
                <button
                  onClick={() => {
                    setEntries((list) => list.filter((x) => x.id !== e.id));
                    ask(e.question, false);
                  }}
                  className="btn btn-outline btn-sm"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden /> Retry
                </button>
              </div>
            ) : (
              <ThinkingCard />
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
