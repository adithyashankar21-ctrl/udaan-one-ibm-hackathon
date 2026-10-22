/** Client for the Learning Hub AI tutor (`/api/learn`). */

import type { CourseRequirements, LearningCourse } from '../data/learningTracks';

export interface LessonSection {
  heading: string;
  body: string;
  code?: string;
  expectedOutput?: string;
}

export interface QuizItem {
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
}

export interface Lesson {
  title: string;
  overview: string;
  analogy?: string;
  sections: LessonSection[];
  keyPoints: string[];
  commonMistakes?: string[];
  quiz: QuizItem[];
  practice?: string;
}

export interface DoubtStep {
  title: string;
  explanation: string;
  code?: string;
}

export interface DoubtSolution {
  understanding: string;
  approach?: string;
  steps: DoubtStep[];
  answer: string;
  code?: string;
  expectedOutput?: string;
  verification: string;
  followUps?: string[];
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`/api/learn/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'The AI tutor could not answer. Please try again.');
  return data as T;
}

export const fetchLesson = (p: { course: string; module: string; subtopic: string; language: string }) =>
  post<{ lesson: Lesson }>('lesson', p).then((r) => r.lesson);

export const askDoubt = (p: {
  course: string;
  subtopic?: string;
  question: string;
  language: string;
  history?: Array<{ question: string; answer: string }>;
}) => post<{ solution: DoubtSolution }>('doubt', p).then((r) => r.solution);

/* ── custom courses: Guru builds a curriculum for any topic ─────────────── */

interface CurriculumResponse {
  title: string;
  description: string;
  level: LearningCourse['level'];
  codeLanguage?: string;
  modules: Array<{ title: string; subtopics: string[] }>;
  requirements: CourseRequirements;
}

const ACCENTS: LearningCourse['accent'][] = ['saffron', 'teal', 'green', 'coral', 'navy'];

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'course';

function glyphFor(title: string) {
  const words = title.replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/).filter(Boolean);
  const g = words.length > 1 ? words[0][0] + words[1][0] : (words[0] || 'AI').slice(0, 2);
  return g.toUpperCase();
}

export async function buildCourse(p: { topic: string; language: string; context?: string }): Promise<LearningCourse> {
  const { course: c } = await post<{ course: CurriculumResponse }>('curriculum', p);
  const id = `custom-${slug(p.topic)}`;
  const code = c.codeLanguage && c.codeLanguage !== 'none' ? (c.codeLanguage as LearningCourse['codeLanguage']) : undefined;
  return {
    id,
    title: c.title,
    short: c.title,
    description: c.description,
    level: (['Beginner', 'Beginner → Intermediate', 'Intermediate'] as const).includes(c.level as any) ? c.level : 'Beginner',
    codeLanguage: code,
    accent: ACCENTS[[...id].reduce((n, ch) => n + ch.charCodeAt(0), 0) % ACCENTS.length],
    glyph: glyphFor(c.title),
    custom: true,
    trackTitle: 'Made for you by Guru',
    requirements: c.requirements,
    modules: c.modules.map((m, i) => ({ id: `${id}-m${i + 1}`, title: m.title, subtopics: m.subtopics })),
  };
}

/* ── hand-off from any assistant channel to the Learning Hub ──────────── */

export const LEARN_INTENT_EVENT = 'udaan:learn-intent';

export interface LearningEntry {
  courseId?: string | null;
  topic?: string | null;
  /** Extra context for a custom course, e.g. a job role's requirements. */
  context?: string;
  /** Open the doubt solver with this question. */
  question?: string;
  channel?: string;
  nonce: number;
}

export function announceLearnIntent(detail: Omit<LearningEntry, 'nonce'>) {
  window.dispatchEvent(new CustomEvent<LearningEntry>(LEARN_INTENT_EVENT, { detail: { ...detail, nonce: Date.now() } }));
}

/* ── Final assessment and certificates ─────────────────────────────── */

export interface ExamQuestion {
  question: string;
  options: string[];
}

export interface ExamResult {
  score: number;
  total: number;
  passed: boolean;
  passMark: number;
  results: Array<{ correct: number; chosen: number; explanation: string }>;
  passToken?: string;
}

export interface Certificate {
  id: string;
  name: string;
  courseId: string;
  courseTitle: string;
  modules: string[];
  duration?: string;
  score: number;
  total: number;
  issuedAt: number;
}

export const startExam = (course: LearningCourse, language: string) =>
  post<{ examId: string; questions: ExamQuestion[] }>('exam', {
    courseId: course.id,
    course: course.title,
    language,
    duration: course.requirements?.duration,
    modules: course.modules.map((m) => ({ title: m.title, subtopics: m.subtopics })),
  });

export const gradeExam = (examId: string, answers: number[]) => post<ExamResult>(`exam/${encodeURIComponent(examId)}/grade`, { answers });

/** Anyone can check a certificate by its ID. */
export async function verifyCertificate(id: string): Promise<Certificate | null> {
  const res = await fetch(`/api/learn/certificate/${encodeURIComponent(id)}`);
  if (!res.ok) return null;
  return (await res.json()).certificate || null;
}
