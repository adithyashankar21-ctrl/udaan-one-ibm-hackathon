/** Client for the Learning Hub AI tutor (`/api/learn`). */

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
