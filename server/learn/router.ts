import express from 'express';
import { Type } from '@google/genai';
import crypto from 'crypto';
import type { Generate } from '../autofill/ocr';
import { PASS_MARK, issuePass, loadPublicCertificate } from './certificates';

/**
 * Learning Hub AI tutor.
 * - /lesson explains one subtopic as a structured, beginner-friendly lesson.
 * - /doubt solves a learner's question by restating it, breaking it into smaller
 *   sub-problems, solving each, then checking the final answer before replying.
 * Code examples come back separately so the browser can run Python ones and show
 * the real output instead of trusting the model's prediction.
 */

const LESSON_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    overview: { type: Type.STRING, description: '2–3 sentences: what it is and why it matters' },
    analogy: { type: Type.STRING, description: 'One everyday real-life analogy from India' },
    sections: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          heading: { type: Type.STRING },
          body: { type: Type.STRING },
          code: { type: Type.STRING, description: 'Short runnable example, or empty' },
          expectedOutput: { type: Type.STRING, description: 'Exact output of the code, or empty' },
        },
        required: ['heading', 'body'],
      },
    },
    keyPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
    commonMistakes: { type: Type.ARRAY, items: { type: Type.STRING } },
    quiz: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING },
          options: { type: Type.ARRAY, items: { type: Type.STRING } },
          answerIndex: { type: Type.INTEGER },
          explanation: { type: Type.STRING },
        },
        required: ['question', 'options', 'answerIndex', 'explanation'],
      },
    },
    practice: { type: Type.STRING, description: 'One small practice task' },
  },
  required: ['title', 'overview', 'sections', 'keyPoints', 'quiz'],
};

const DOUBT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    understanding: { type: Type.STRING, description: 'Restate the problem in one or two simple sentences' },
    approach: { type: Type.STRING, description: 'The overall plan in one sentence' },
    steps: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: 'The smaller sub-problem' },
          explanation: { type: Type.STRING },
          code: { type: Type.STRING, description: 'Code for this step, or empty' },
        },
        required: ['title', 'explanation'],
      },
    },
    answer: { type: Type.STRING, description: 'The final, direct answer' },
    code: { type: Type.STRING, description: 'Complete final solution code, or empty' },
    expectedOutput: { type: Type.STRING, description: 'Exact output of the final code, or empty' },
    verification: { type: Type.STRING, description: 'How the answer was checked (edge cases, a dry run, a test)' },
    followUps: { type: Type.ARRAY, items: { type: Type.STRING }, description: '2–3 follow-up questions the learner might ask next' },
  },
  required: ['understanding', 'steps', 'answer', 'verification'],
};

const CURRICULUM_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: 'Clear course title' },
    description: { type: Type.STRING, description: 'One or two sentences: what the learner will be able to do' },
    level: { type: Type.STRING, enum: ['Beginner', 'Beginner → Intermediate', 'Intermediate'] },
    codeLanguage: { type: Type.STRING, enum: ['python', 'c', 'java', 'javascript', 'sql', 'html', 'none'], description: 'Programming language used in examples, or none' },
    modules: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: { title: { type: Type.STRING }, subtopics: { type: Type.ARRAY, items: { type: Type.STRING } } },
        required: ['title', 'subtopics'],
      },
    },
    requirements: {
      type: Type.OBJECT,
      properties: {
        prerequisites: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Education or skills needed before starting' },
        materials: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Tools, equipment or devices needed' },
        duration: { type: Type.STRING, description: 'Typical self-study time, e.g. "4–6 weeks at 1 hour a day"' },
        outcomes: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'What the learner can do at the end' },
        formalTraining: { type: Type.STRING, description: 'Where to get certified formal training in India (ITI trade, PMKVY / Skill India Digital Hub job role, NIELIT, PM Vishwakarma, NIOS, etc.) and who can join. Say details vary by centre. Empty if not applicable.' },
        careers: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Jobs or self-employment options this leads to' },
      },
      required: ['prerequisites', 'duration', 'outcomes'],
    },
  },
  required: ['title', 'description', 'level', 'modules', 'requirements'],
};

const EXAM_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      question: { type: Type.STRING },
      options: { type: Type.ARRAY, items: { type: Type.STRING } },
      answerIndex: { type: Type.INTEGER },
      explanation: { type: Type.STRING },
    },
    required: ['question', 'options', 'answerIndex', 'explanation'],
  },
};

const EXAM_QUESTIONS = 10;

const clip = (v: unknown, n: number) => String(v ?? '').slice(0, n);

/** Honest message for the learner: a used-up AI quota is different from a busy moment. */
const unavailable = (err: any, busy: string) =>
  /\b429\b|quota|RESOURCE_EXHAUSTED/i.test(String(err?.message || ''))
    ? 'The AI tutor has reached its usage limit for now. Please try again later — your progress is saved.'
    : busy;

function tutorRules(course: string, language: string) {
  return `You are "UDAAN ONE Guru", a patient, expert tutor for ${course}. Learners are often first-generation students from rural India.
RULES
1. Be correct above all. Think carefully. Never invent library functions, syntax or facts. If something depends on the version, say so.
2. Explain simply: short sentences, everyday Indian examples, no jargon without explaining it.
3. Write prose in ${language}. Keep code, keywords and technical terms in English. Code comments in simple English.
4. Code must be complete, runnable and short. For Python use Python 3 and only the standard library. Do not read input() — use fixed example values. Every lesson example must run on its own (define everything it uses).
5. expectedOutput must be exactly what the code prints. Leave it empty if the code prints nothing.
6. Plain text only inside fields: no markdown headings or tables. You may use \`backticks\` for inline code and **double asterisks** for emphasis. Use "\\n- " for bullet lists.`;
}

export function createLearnRouter(generate: Generate) {
  const router = express.Router();
  const hits = new Map<string, number[]>();
  const lessonCache = new Map<string, any>();

  router.use((req, res, next) => {
    const key = req.ip || 'anon';
    const now = Date.now();
    const list = (hits.get(key) || []).filter((t) => now - t < 60 * 60 * 1000);
    list.push(now);
    hits.set(key, list);
    if (list.length > 150) return res.status(429).json({ error: 'Too many questions in the last hour. Please try again a little later.' });
    next();
  });

  router.post('/lesson', async (req, res) => {
    const course = clip(req.body?.course, 80);
    const module = clip(req.body?.module, 120);
    const subtopic = clip(req.body?.subtopic, 160);
    const language = clip(req.body?.language || 'English', 30);
    if (!course || !subtopic) return res.status(400).json({ error: 'Choose a topic first.' });

    const cacheKey = [course, module, subtopic, language].join('|').toLowerCase();
    if (lessonCache.has(cacheKey)) return res.json({ lesson: lessonCache.get(cacheKey), cached: true });

    try {
      const response = await generate(
        {
          contents: `Teach the subtopic "${subtopic}" from the module "${module}" of the ${course} course.
Give 3–5 sections that build up from the basic idea to a practical use, each with a short example where it helps.
Then 3–5 key points, 2–3 common beginner mistakes, a 3-question multiple-choice quiz (4 options each, answerIndex is 0-based) and one small practice task.`,
          config: {
            systemInstruction: tutorRules(course, language),
            responseMimeType: 'application/json',
            responseSchema: LESSON_SCHEMA,
            thinkingConfig: { thinkingBudget: 512 },
          },
        },
        undefined,
        { timeoutMs: 45000 }
      );
      const lesson = JSON.parse(response.text || '{}');
      if (!lesson?.sections?.length) throw new Error('empty lesson');
      if (lessonCache.size > 300) lessonCache.delete(lessonCache.keys().next().value as string);
      lessonCache.set(cacheKey, lesson);
      res.json({ lesson });
    } catch (err: any) {
      console.warn('Lesson generation failed:', String(err?.message || '').slice(0, 140));
      res.status(503).json({ error: unavailable(err, 'The AI tutor is busy right now. Please try again in a moment.') });
    }
  });

  const curriculumCache = new Map<string, any>();

  /** Builds a complete course outline, with training requirements, for any topic a learner asks for. */
  router.post('/curriculum', async (req, res) => {
    const topic = clip(req.body?.topic, 160).trim();
    const language = clip(req.body?.language || 'English', 30);
    const context = clip(req.body?.context, 600);
    if (topic.length < 2) return res.status(400).json({ error: 'Tell Guru what you want to learn.' });

    const cacheKey = `${topic}|${language}|${context}`.toLowerCase();
    if (curriculumCache.has(cacheKey)) return res.json({ course: curriculumCache.get(cacheKey) });

    try {
      const response = await generate(
        {
          contents: `A learner in India wants to learn: "${topic}".${context ? `\nContext: ${context}` : ''}
Design a practical course from zero to job-ready basics:
- 4 to 7 modules in a sensible order, each with 3 to 6 specific subtopics (short titles a lesson can be written for).
- Cover theory, hands-on practice, safety (for trades) and how to earn from the skill.
- requirements: honest prerequisites, materials needed, realistic self-study duration, outcomes, the formal training/certification route in India, and careers.
- If the topic is unsafe, illegal or not a learnable skill, make the closest safe, legitimate course instead.
Write all text in ${language}; keep technical terms in English where they are commonly used.`,
          config: {
            systemInstruction: tutorRules(topic, language),
            responseMimeType: 'application/json',
            responseSchema: CURRICULUM_SCHEMA,
            thinkingConfig: { thinkingBudget: 512 },
          },
        },
        undefined,
        { timeoutMs: 45000 }
      );
      const course = JSON.parse(response.text || '{}');
      course.modules = (course.modules || [])
        .filter((m: any) => m?.title && Array.isArray(m.subtopics) && m.subtopics.length)
        .slice(0, 8)
        .map((m: any) => ({ title: clip(m.title, 100), subtopics: m.subtopics.slice(0, 8).map((s: any) => clip(s, 120)) }));
      if (!course.modules.length) throw new Error('empty curriculum');
      if (curriculumCache.size > 200) curriculumCache.delete(curriculumCache.keys().next().value as string);
      curriculumCache.set(cacheKey, course);
      res.json({ course });
    } catch (err: any) {
      console.warn('Curriculum generation failed:', String(err?.message || '').slice(0, 140));
      res.status(503).json({ error: unavailable(err, 'Guru could not build that course right now. Please try again in a moment.') });
    }
  });

  router.post('/doubt', async (req, res) => {
    const course = clip(req.body?.course, 80) || 'Programming';
    const subtopic = clip(req.body?.subtopic, 160);
    const question = clip(req.body?.question, 4000).trim();
    const language = clip(req.body?.language || 'English', 30);
    const history = (Array.isArray(req.body?.history) ? req.body.history : [])
      .slice(-4)
      .map((h: any) => `Learner: ${clip(h?.question, 600)}\nTutor: ${clip(h?.answer, 600)}`)
      .join('\n\n');
    if (question.length < 2) return res.status(400).json({ error: 'Type your doubt first.' });

    try {
      const response = await generate(
        {
          contents: `${history ? `Earlier in this session:\n${history}\n\n` : ''}${subtopic ? `The learner is studying "${subtopic}".\n` : ''}Learner's doubt:\n"""${question}"""

Solve it like an expert teacher:
1. understanding: restate what is being asked. If the doubt is unclear, state the most likely meaning.
2. approach: the plan in one sentence.
3. steps: break the problem into 2–6 smaller sub-problems, in order. Solve each one, with code where useful.
4. answer: the final direct answer.
5. code + expectedOutput: the complete solution when the doubt involves code.
6. verification: before replying, re-check every step, dry-run the code on the example and on at least one edge case, and fix any mistake. Briefly say what you checked.
7. followUps: 2–3 natural next questions.
If the learner's own code is included, point out the exact bug and why it happens before giving the fix.`,
          config: {
            systemInstruction: tutorRules(course, language),
            responseMimeType: 'application/json',
            responseSchema: DOUBT_SCHEMA,
            thinkingConfig: { thinkingBudget: 2048 },
          },
        },
        undefined,
        { timeoutMs: 60000 }
      );
      const solution = JSON.parse(response.text || '{}');
      if (!solution?.steps?.length && !solution?.answer) throw new Error('empty answer');
      res.json({ solution });
    } catch (err: any) {
      console.warn('Doubt solving failed:', String(err?.message || '').slice(0, 140));
      res.status(503).json({ error: unavailable(err, 'The AI tutor is busy right now. Please try again in a moment.') });
    }
  });

  /* ── Final assessment and certificates ─────────────────────────── */

  /** Answer keys stay here, so the browser never sees them. */
  const exams = new Map<string, { courseId: string; courseTitle: string; modules: string[]; duration?: string; answers: number[]; explanations: string[]; expires: number }>();

  /** A 10-question assessment across the whole course, written by the tutor. */
  router.post('/exam', async (req, res) => {
    const courseId = clip(req.body?.courseId, 120);
    const course = clip(req.body?.course, 120);
    const language = clip(req.body?.language || 'English', 30);
    const modules: Array<{ title: string; subtopics: string[] }> = (Array.isArray(req.body?.modules) ? req.body.modules : [])
      .slice(0, 20)
      .map((m: any) => ({ title: clip(m?.title, 120), subtopics: (Array.isArray(m?.subtopics) ? m.subtopics : []).slice(0, 15).map((x: any) => clip(x, 120)) }));
    if (!courseId || !course || !modules.length) return res.status(400).json({ error: 'Choose a course first.' });
    try {
      const response = await generate(
        {
          contents: `Write the final assessment for the "${course}" course: ${EXAM_QUESTIONS} multiple-choice questions that together cover these modules fairly:
${modules.map((m) => `- ${m.title}: ${m.subtopics.join('; ')}`).join('\n')}
Each question has exactly 4 options and one correct answer (answerIndex is 0-based), at the level of this course. Test understanding and practical use, not trivia or trick wording. Mix the position of the correct answer. Give a one-sentence explanation for each.`,
          config: { systemInstruction: tutorRules(course, language), responseMimeType: 'application/json', responseSchema: EXAM_SCHEMA, thinkingConfig: { thinkingBudget: 1024 } },
        },
        undefined,
        { timeoutMs: 60000 }
      );
      const items = (JSON.parse(response.text || '[]') as any[]).filter((q) => q?.question && Array.isArray(q.options) && q.options.length === 4 && q.answerIndex >= 0 && q.answerIndex < 4).slice(0, EXAM_QUESTIONS);
      if (items.length < 5) throw new Error('assessment too short');
      const examId = crypto.randomBytes(12).toString('base64url');
      exams.set(examId, {
        courseId,
        courseTitle: course,
        modules: modules.map((m) => m.title),
        duration: clip(req.body?.duration, 60) || undefined,
        answers: items.map((q) => q.answerIndex),
        explanations: items.map((q) => q.explanation || ''),
        expires: Date.now() + 2 * 60 * 60 * 1000,
      });
      if (exams.size > 500) exams.delete(exams.keys().next().value as string);
      res.json({ examId, questions: items.map((q) => ({ question: q.question, options: q.options })) });
    } catch (err: any) {
      console.warn('Assessment generation failed:', String(err?.message || '').slice(0, 140));
      res.status(503).json({ error: unavailable(err, 'Guru could not prepare the assessment right now. Please try again in a moment.') });
    }
  });

  /** Marks the answers; a pass (70% or more) comes with a one-time token for the certificate. */
  router.post('/exam/:id/grade', (req, res) => {
    const exam = exams.get(req.params.id);
    if (!exam || exam.expires < Date.now()) return res.status(404).json({ error: 'This assessment has expired. Please start it again.' });
    exams.delete(req.params.id);
    const given: unknown[] = Array.isArray(req.body?.answers) ? req.body.answers : [];
    const results = exam.answers.map((correct, i) => ({ correct, chosen: typeof given[i] === 'number' ? (given[i] as number) : -1, explanation: exam.explanations[i] }));
    const score = results.filter((r) => r.correct === r.chosen).length;
    const total = exam.answers.length;
    const passed = score / total >= PASS_MARK;
    const passToken = passed ? issuePass({ courseId: exam.courseId, courseTitle: exam.courseTitle, modules: exam.modules, duration: exam.duration, score, total }) : undefined;
    res.json({ score, total, passed, passMark: Math.ceil(total * PASS_MARK), results, passToken });
  });

  /** Public check of a certificate by its ID (shows only what is printed on it). */
  router.get('/certificate/:id', (req, res) => {
    const c = loadPublicCertificate(String(req.params.id).toUpperCase());
    if (!c) return res.status(404).json({ valid: false });
    res.json({ valid: true, certificate: c });
  });

  return router;
}
