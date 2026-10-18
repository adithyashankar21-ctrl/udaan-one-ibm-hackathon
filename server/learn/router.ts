import express from 'express';
import { Type } from '@google/genai';
import type { Generate } from '../autofill/ocr';

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

const clip = (v: unknown, n: number) => String(v ?? '').slice(0, n);

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
      res.status(503).json({ error: 'The AI tutor is busy right now. Please try again in a moment.' });
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
      res.status(503).json({ error: 'The AI tutor is busy right now. Please try again in a moment.' });
    }
  });

  return router;
}
