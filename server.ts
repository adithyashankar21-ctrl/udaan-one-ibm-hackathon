import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import { createAutofillRouter, autofillErrorHandler } from './server/autofill/router';
import { createLearnRouter } from './server/learn/router';
import { createTranslateRouter, createTranslator } from './server/i18n/router';
import { createVoiceRouter } from './server/voice/router';
import { createLoansRouter } from './server/loans/router';
import { offlineReply, scriptLanguage, toLanguageCode } from './src/data/languageTools';
import { detectLearnIntent } from './server/learn/intent';
import { detectRoadmapIntent } from './server/learn/roadmapIntent';
import { detectApplyInConversation } from './server/autofill/schemes';
import { PAGE_LABELS, detectNavIntent, wantsSmartApplyPage } from './src/data/voiceNavigation';
import { FORM_SCHEMA_MAP } from './src/data/autofillSchema';
import { LOAN_LISTINGS } from './src/data/loanCatalog';

/** One line per loan for the assistant: what it is, how much, at what rate, for whom. */
const LOAN_FACTS = LOAN_LISTINGS.map((l) => `     • ${l.name}: ${l.amount.text}; interest ${l.rate}; ${l.collateral}${l.subsidy ? `; help: ${l.subsidy}` : ''}. Lenders: ${l.offers.map((o) => o.lender).join(', ')}.${l.statusNote ? ` NOTE: ${l.statusNote}` : ''}`).join('\n');

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse CLI arguments (--port, --host)
const args = process.argv.slice(2);
let cliPort: number | undefined;
let cliHost: string | undefined;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--port' && args[i + 1]) {
    cliPort = Number(args[i + 1]);
  }
  if (args[i] === '--host' && args[i + 1]) {
    cliHost = args[i + 1];
  }
}

const app = express();
const PORT = Number(process.env.PORT) || cliPort || 3000;
const HOST = process.env.HOST || cliHost || '0.0.0.0';
const isProduction = process.env.NODE_ENV === 'production';

app.use(express.json({ limit: '20mb' }));

// Server-side Gemini client with required User-Agent
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});


// Text models tried in order. A "busy" (503) or rate-limit error moves on to the next
// model after one short retry, so brief Gemini overloads do not reach the user.
// Gemini 2.5 models are closed to new API keys; these are available to current keys
const TEXT_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-flash-lite-latest', 'gemini-3.1-flash-lite'];

function isTransientError(err: any): boolean {
  const msg = String(err?.message || err || '');
  // Billing / key problems will not fix themselves on retry
  if (/\b(400|401|402|403)\b|credits are depleted|API key not valid|PERMISSION_DENIED/i.test(msg)) return false;
  return /\b(503|429|500)\b|UNAVAILABLE|RESOURCE_EXHAUSTED|overloaded|high demand/i.test(msg);
}

const LEARN_COURSE_NAMES: Record<string, string> = {
  python: 'Python programming',
  c: 'C programming',
  java: 'Java programming',
  web: 'web development with HTML, CSS and JavaScript',
  sql: 'databases and SQL',
  dsa: 'data structures and algorithms',
  'digital-basics': 'computer and digital basics',
  career: 'job readiness, spoken English and interviews',
};

// Models whose free-tier daily quota ran out are skipped for a while instead of retried on every request
const exhaustedUntil = new Map<string, number>();

/**
 * Gemini 2.5 models take a thinking token budget; newer models reject it and take a thinking
 * level instead. Callers keep writing budgets — this converts them for the model in use.
 */
function forModel(request: Record<string, any>, model: string): Record<string, any> {
  const thinking = request.config?.thinkingConfig;
  if (!thinking || thinking.thinkingBudget === undefined || /gemini-2\.5/.test(model)) return { ...request, model };
  const { thinkingBudget, ...rest } = thinking;
  // 'low' and 'high' are the levels every newer model accepts ('minimal' is not)
  const thinkingLevel = thinkingBudget <= 1024 ? 'low' : 'high';
  return { ...request, model, config: { ...request.config, thinkingConfig: { ...rest, thinkingLevel } } };
}

async function generateWithFallback(
  request: Record<string, any>,
  models: string[] = TEXT_MODELS,
  { retryBusy = true, timeoutMs = 25000 }: { retryBusy?: boolean; timeoutMs?: number } = {}
) {
  let lastErr: any = null;
  const usable = models.filter((m) => (exhaustedUntil.get(m) || 0) < Date.now());
  for (const model of usable.length ? usable : models) {
    for (let attempt = 0; attempt < (retryBusy ? 2 : 1); attempt++) {
      try {
        // Cap each attempt so one slow model cannot stall the conversation
        return await Promise.race([
          ai.models.generateContent(forModel(request, model) as any),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`timeout after ${timeoutMs}ms (503)`)), timeoutMs)),
        ]);
      } catch (err: any) {
        lastErr = err;
        if (/PerDay/i.test(String(err?.message || ''))) {
          exhaustedUntil.set(model, Date.now() + 60 * 60 * 1000);
          console.warn(`Model ${model}: daily quota used up — skipping it for an hour`);
          break;
        }
        console.warn(`Model ${model} attempt ${attempt + 1} failed:`, String(err?.message || '').slice(0, 140));
        if (!isTransientError(err)) {
          // Same key and billing apply to every model, so stop trying
          if (/\b(400|401|402|403)\b|credits are depleted|API key not valid/i.test(String(err?.message || ''))) throw err;
          break;
        }
        if (attempt === 0 && retryBusy) await new Promise((r) => setTimeout(r, 700));
      }
    }
  }
  throw lastErr || new Error('All Gemini models failed');
}

// Smart Apply & Autofill (document intelligence, unified profile, form filling)
app.use('/api/autofill', createAutofillRouter(generateWithFallback));
app.use('/api/learn', createLearnRouter(generateWithFallback));
app.use('/api/loans', createLoansRouter(generateWithFallback));
const translate = createTranslator(generateWithFallback);
app.use('/api/i18n', createTranslateRouter(translate));
// The helpline on a real phone line (Twilio)
app.use('/api/voice', createVoiceRouter({ translate, selfBase: `http://127.0.0.1:${PORT}` }));
app.use(autofillErrorHandler);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'UDAAN ONE Voice & Skilling Engine',
    hasApiKey: Boolean(process.env.GEMINI_API_KEY),
    timestamp: new Date().toISOString(),
  });
});

// Conversational AI voice assistant endpoint

app.post('/api/ai/chat', async (req, res) => {
  const { messages, userProfile, language = 'Hindi', channel = 'web_voice' } = req.body;

  // Shared autofill workflow: any channel that hears "I want to apply…" gets routed to Smart Apply
  const lastUserText = [...(Array.isArray(messages) ? messages : [])].reverse().find((m: any) => m?.role === 'user')?.content || '';
  const localIntent = detectApplyInConversation(Array.isArray(messages) ? messages : []);
  // The voice assistants can also take the person to a page ("open the loans page")
  const onScreenVoice = /voice/i.test(String(channel)) && !/helpline|ivr|phone|whatsapp|kiosk/i.test(String(channel));
  const heardPage = onScreenVoice ? detectNavIntent(String(lastUserText)) : null;
  // "Fill PM Vishwakarma in Smart Apply": the application is filled by voice on the Smart Apply page
  const applyOnPage = onScreenVoice && localIntent.schemeId && wantsSmartApplyPage(String(lastUserText)) ? 'smart_apply' : undefined;
  const applyIntent = localIntent.wantsToApply && (localIntent.schemeId || !heardPage) ? { schemeId: localIntent.schemeId, target: applyOnPage } : null;
  const navIntent = !applyIntent && heardPage ? { page: heardPage } : null;
  const navNote = navIntent
    ? `\n7. The app is now opening the ${PAGE_LABELS[navIntent.page]} page for the person. In one short sentence, say you are opening it and what they can do there. Do not ask anything else.`
    : '';
  const applyNote = applyIntent
    ? `\n7. The person wants to apply${applyIntent.schemeId ? ` for ${FORM_SCHEMA_MAP[applyIntent.schemeId]?.formTitle.split(' — ')[0]}` : ''}. In one short sentence, ${
        !applyIntent.schemeId
          ? localIntent.wantsLoan
            ? 'act as a loan advisor: ask ONE follow-up question at a time until you know what the loan is for (business, farming or dairy, studies, a house, a self-help group, or quick money against gold), roughly how much, whether the business is new or running, and their category (SC, ST, OBC, minority or general) — never ask for scheme names. Then name the single best-fitting loan from the loan list and say why in a few words (for example lowest cost, no collateral, made for their group), cheaper government loan schemes first. If they say their monthly income, check the EMI: it should stay under 40% of income including EMIs they already pay — say plainly whether it fits or is too heavy. Say UDAAN ONE can fill the application by voice and find the nearest bank.'
            : 'ask which scheme, loan or document they want to apply for.'
          : applyOnPage
            ? 'say Smart Apply is opening now and will fill the application with them by voice, one question at a time.'
          : /helpline|ivr|phone/i.test(String(channel))
            ? 'say you will now take their application details in this call, one question at a time.'
            : /voice|whatsapp|chat/i.test(String(channel))
              ? 'say you will fill the application with them right here in this conversation, one question at a time, and they can send photos of their documents here too.'
              : 'tell them UDAAN ONE\'s Smart Apply can fill the application from their documents and answers, and that a "Continue to Smart Apply" button is now on the screen.'
      } Do not ask the application questions yourself. Never say an application has been submitted.`
    : '';

  // Career roadmap requests ("how can I become an electrician?") get a step-by-step roadmap on screen
  const roadmap = applyIntent || navIntent ? null : detectRoadmapIntent(String(lastUserText));
  const roadmapIntent = roadmap?.wantsRoadmap ? { request: roadmap.request } : null;
  const roadmapNote = roadmapIntent
    ? `\n7. ROADMAP MODE — the person wants a career roadmap. In 2 or 3 short sentences, name the goal as you understand it and the very first practical step (for example where to train or register). ${
        /helpline|ivr|phone/i.test(String(channel)) ? 'Say you will now read out their step-by-step roadmap.' : 'Say a full step-by-step roadmap with courses, jobs and support is being prepared on the screen.'
      } Do not list every step yourself.`
    : '';

  // Learning requests ("teach me Python", "I want to learn tailoring") are taught here and handed to the Learning Hub
  const learn = applyIntent || navIntent || roadmapIntent ? null : detectLearnIntent(String(lastUserText));
  const learnIntent = learn?.wantsToLearn ? { courseId: learn.courseId, topic: learn.topic } : null;
  const teachNote = learnIntent
    ? `\n7. TEACHING MODE — the person wants to learn${learnIntent.courseId ? ` (${LEARN_COURSE_NAMES[learnIntent.courseId] || learnIntent.courseId})` : learnIntent.topic ? ` about "${learnIntent.topic}"` : ''}. Act as a patient teacher, not a scheme counsellor:
   - Teach the actual concept now: explain the core idea simply with one everyday Indian example. If they asked a specific question, answer it fully and correctly.
   - For programming, describe code in words (it is spoken aloud) — e.g. "write for, then a name, then in range of five". Never read symbols one by one.
   - If they want to learn a trade or job skill, also say what the training needs: who can join (typical education or age), roughly how long it takes, where to train (ITI, PMKVY / Skill India centre, PM Vishwakarma for traditional artisans) and the certificate they can earn. Say durations and eligibility vary by course and centre.
   - In one sentence, ${onScreenVoice ? 'say the Learning Hub is opening now with the full course' : 'say an "Open in Learning Hub" button is now on the screen'} for step-by-step lessons, practice and quizzes.${onScreenVoice ? ' End with that sentence: do not ask a question, because the app moves to the course right after you finish.' : ''}
   - In teaching mode you may use up to 6 short sentences.`
    : '';

  const systemInstruction = `You are "UDAAN ONE Mitra" (उड़ान वन मित्र), a friendly, knowledgeable AI guide that helps citizens — especially Scheduled Caste (SC) communities — understand PM-AJAY (Pradhan Mantri Anusuchit Jaati Abhyuday Yojana) and related skilling, employment and enterprise schemes. You are an assistant, not a government official, and you cannot approve, verify or submit anything.

Channel: ${channel}
Language: ${language}
Current Citizen Profile (may be incomplete):
${JSON.stringify(userProfile || {}, null, 2)}

RULES:
1. ANSWER THE ACTUAL QUESTION FIRST, specifically and simply. Never dodge with generic greetings.
2. ACCURACY — NEVER INVENT FACTS:
   - Only state scheme facts you are confident are publicly established. If you are not sure of an amount, limit, date or rule, say it depends on the scheme guidelines and tell the person where to confirm.
   - Never invent stipend amounts, toolkit values, deadlines, circular numbers, application numbers or approvals.
   - Eligibility is always a preliminary estimate; final decisions are made by the responsible department.
   - Well-established facts you may use:
     • PM-AJAY (Ministry of Social Justice & Empowerment) supports SC individuals and households through grants for income-generating assets, skill development and village infrastructure, implemented by State governments. Applications usually go through the District Social Welfare Office or the State SC Development Corporation. Official site: pmajay.dosje.gov.in. Grant limits are set in the scheme guidelines — tell people to confirm the current limit with their district office.
     • PMKVY / Skill India: free short-term NSQF-aligned training and Recognition of Prior Learning (RPL) for people with existing skills (skillindiadigital.gov.in).
     • PM-DAKSH (MoSJE): free skill training for target groups including SCs (pmdaksh.dosje.gov.in).
     • PM MUDRA Yojana: collateral-free loans — Shishu up to ₹50,000, Kishore ₹50,000 to ₹5 lakh, Tarun ₹5–10 lakh, Tarun Plus ₹10–20 lakh after repaying a Tarun loan — via banks, NBFCs and MFIs (mudra.org.in).
     • NSFDC (National Scheduled Castes Finance & Development Corporation): concessional loans for SC persons via State Channelising Agencies (nsfdc.nic.in).
     • PM Vishwakarma: for artisans in notified traditional trades — recognition, basic training with stipend, toolkit incentive and collateral-free credit at concessional interest; register through a CSC (pmvishwakarma.gov.in).
     • Stand-Up India: bank loans of ₹10 lakh to ₹1 crore for SC/ST and women entrepreneurs starting a new enterprise (the original scheme closed to new loans on 31 March 2025; a revamped version was announced in 2026 — tell people to confirm current terms at their bank).
     • Common documents: Aadhaar, caste certificate, income certificate, bank passbook, photograph.
     • LOANS — UDAAN ONE has a Loans page that compares government loan schemes, banks, NBFCs and microfinance lenders, and its Smart Apply fills the loan application and makes a PDF that names the loan and the lender. Always suggest the cheapest suitable government-backed loan before a costly private loan, never promise approval or a rate (rates are indicative, checked October 2026; the lender decides), warn against unregistered loan apps, and say total EMIs should stay well under half of monthly income. Government loan schemes never use paid agents and never ask for fees before the loan — if someone does, tell the person it is a scam and to call 1930. The Loans page also has: a loan advisor that ranks loans for the person, an affordability check, a business plan builder, a plain-language check of loan papers before signing, a fraud shield, and a nearest-bank finder with the documents to carry. Loans it knows:
${LOAN_FACTS}
     • Official documents and certificates (UDAAN ONE's Smart Apply can prepare these and tell people which proofs are accepted): PAN — instant e-PAN with Aadhaar on incometax.gov.in, or Form 49A via Protean / UTIITSL (Aadhaar alone can serve as proof of identity, address and date of birth); voter ID — Form 6 on voters.eci.gov.in, needing proof of age, proof of address and a photo (Form 8 for corrections); passport — apply on passportindia.gov.in then attend a Passport Seva Kendra with proof of present address and proof of date of birth; Aadhaar address update — myaadhaar.uidai.gov.in, other updates at an Aadhaar centre; income, caste and residence certificates — State e-District portal, a CSC or the Tahsildar office; birth certificate — local Registrar or crsorgi.gov.in; learner's driving licence — sarathi.parivahan.gov.in; e-Shram card — eshram.gov.in; UDID disability card — swavlambancard.gov.in; ration card — the State food department (links on nfsa.gov.in). Fees, timelines and accepted documents are set by the issuing authority — tell people to confirm on the official portal.
   - For local offices, name the type of office (District Social Welfare Office, State SC Development Corporation, nearest Skill India centre, CSC) rather than inventing addresses or phone numbers. The UDAAN ONE helpline is 1800-11-2529.
3. PERSONALISE: if the person shares their name, trade or district, use it and give 1–2 concrete next steps for their situation.
4. LANGUAGE: reply entirely in ${language}, in its native script, in simple everyday words — even when the question is typed in English. Only if the person clearly speaks a different language than ${language}, reply in theirs. Never mix in words or letters from another Indian language or another script (scheme names like PM Vishwakarma and acronyms like PAN may stay in English).
5. VOICE STYLE: 2 to 4 short, warm sentences. No bullet lists, no markdown, no emojis — this will be spoken aloud. End with one helpful next step (for example, offering to prepare their Kaushal Patra roadmap).
6. YOU ARE ALSO A TEACHER: UDAAN ONE has a Learning Hub with free AI lessons — Python, C, Java, web development, SQL, data structures and algorithms, computer and digital basics, and job readiness — and it can build a course on any other topic (a trade, a school subject, a language). When someone wants to learn something, teach it directly and correctly instead of only pointing to schemes.${applyNote}${navNote}${roadmapNote}${teachNote}
`;

  // Sanitize and format multi-turn contents for Gemini
  // Gemini requires the first message to be 'user' and roles to alternate strictly (user -> model -> user -> model)
  const sanitizedContents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

  const rawMessages = Array.isArray(messages) ? messages : [];
  for (const msg of rawMessages) {
    const rawRole = msg.role === 'assistant' ? 'model' : 'user';
    const text = typeof msg.content === 'string' ? msg.content.trim() : '';
    if (!text) continue;

    if (sanitizedContents.length === 0) {
      if (rawRole === 'model') {
        // If conversation begins with bot greeting, frame it as a user-accessible context turn
        sanitizedContents.push({
          role: 'user',
          parts: [{ text: `[Citizen connects. Previous counselor greeting: "${text}"]` }],
        });
        sanitizedContents.push({
          role: 'model',
          parts: [{ text }],
        });
      } else {
        sanitizedContents.push({
          role: 'user',
          parts: [{ text }],
        });
      }
    } else {
      const prev = sanitizedContents[sanitizedContents.length - 1];
      if (prev.role === rawRole) {
        // Merge consecutive messages of the same role
        prev.parts[0].text += `\n${text}`;
      } else {
        sanitizedContents.push({
          role: rawRole,
          parts: [{ text }],
        });
      }
    }
  }

  if (sanitizedContents.length === 0) {
    sanitizedContents.push({
      role: 'user',
      parts: [
        {
          text: `Hello, please greet me as the UDAAN ONE counselor in ${language} and introduce how you can help me find government training and livelihood schemes.`,
        },
      ],
    });
  }

  // Fastest model first for quick voice replies; heavier models as backups
  let lastError: any = null;
  try {
    const response = await generateWithFallback(
      // No extended reasoning: short spoken replies do not need it, and it adds seconds
      { contents: sanitizedContents, config: { systemInstruction, temperature: 0.4, thinkingConfig: { thinkingBudget: 0 } } },
      ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.8-flash'],
      { retryBusy: false, timeoutMs: 9000 }
    );
    const replyText = response.text?.trim();
    if (replyText) return res.json({ reply: replyText, applyIntent, navIntent, learnIntent, roadmapIntent });
  } catch (err: any) {
    lastError = err;
  }

  // Context-aware intelligent fallback based on user's actual question
  console.error('All Gemini chat models failed, sending offline notice:', lastError?.message);
  const lastUserMsg = rawMessages && rawMessages.length > 0 ? rawMessages[rawMessages.length - 1].content : '';
  const reply = offlineReply(language, lastUserMsg);
  res.json({ reply, fallback: true, applyIntent, navIntent, learnIntent, roadmapIntent });
});

// Comprehensive Livelihood & NSQF Gap Mapping endpoint
app.post('/api/ai/livelihood-map', async (req, res) => {
  try {
    const { profile = {}, language = 'English' } = req.body;
    // A roadmap can be asked for in the person's own words ("I want to become an electrician")
    const request = String(req.body?.request || '').slice(0, 400).trim();

    const prompt = `${
      request
        ? `A person in India asked for a career roadmap: "${request}". Build the roadmap for exactly this goal (any job, trade, profession, exam or business), using the profile below only as background. If the goal is unclear, choose the most likely meaning for someone with this profile.`
        : 'Analyze this Scheduled Caste beneficiary profile under PM-AJAY (GIA component) and provide a comprehensive, NSQF-aligned livelihood roadmap and skilling recommendations.'
    }

Beneficiary Profile:
- Name: ${profile.name || 'Beneficiary'}
- Age: ${profile.age || 'Not specified'}
- Gender: ${profile.gender || 'Not specified'}
- District & State: ${profile.district || 'Unspecified'}, ${profile.state || 'India'}
- Educational Background: ${profile.education || 'Not specified'}
- Current / Traditional Occupation: ${profile.traditionalTrade || profile.currentOccupation || 'Not specified'}
- Existing Informal Skills: ${profile.existingSkills || 'Not specified'}
- Preferred Work Nature: ${profile.workPreference || 'Not specified'}
- Mobility / Constraints: ${profile.mobilityConstraint || 'Not specified'}
- Annual Family Income: ${profile.annualFamilyIncome || 'Not specified'}

Return a structured JSON with:
1. "profileSummary": concise appraisal in ${language} of beneficiary's strengths and prior learning (RPL opportunities).
2. "nsqfCourses": array of 3 top recommended NSQF aligned courses with:
   - "jobRole": name of role (e.g. Leather Goods Assembly Operator, Solar PV Installer, Domestic Data Entry Operator, Auto Mechanic, Handloom Weaver & Designer)
   - "qpCode": the real Qualification Pack code only if you are certain of it, otherwise an empty string
   - "nsqfLevel": level 2, 3, 4, or 5
   - "sector": Sector Skill Council name
   - "durationHours": e.g. 300 hours
   - "stipendSupported": boolean — true only if the programme is publicly known to pay a stipend; otherwise false
   - "whyFit": explanation of why it fits their background and district demand
3. "skillGapAnalysis":
   - "strengthsIdentified": list of 3 skills they already have
   - "missingGaps": list of 3 gaps to bridge (e.g. digital billing, QC standards, machine safety)
4. "livelihoodPathways":
   - "wageEmployment": { "expectedSalary": a cautious typical range clearly worded as an estimate that varies by employer and location, "targetEmployers": types of local employers (not invented company names), "timeline": realistic timeline }
   - "selfEmployment": { "businessConcept": a practical micro-enterprise idea, "projectCost": a rough estimate worded as an estimate, "pmAjayGiaSubsidy": "As per PM-AJAY guidelines — confirm with the District Social Welfare Office", "bankLoanMudra": which loan schemes could cover the rest (e.g. MUDRA Shishu/Kishore, NSFDC) without promising amounts, "equipmentToolkit": equipment needed, "monthlyProfitPotential": cautious estimate worded as depending on sales and costs }
5. "localClusterLinkage": description of local district economy and why this trade has thriving local demand.
6. "audioNarrationScript": a warm 3-sentence voice summary in ${language} that can be read out to the beneficiary.
7. "goal": the career goal as a short title in ${language} (e.g. "Become a certified electrician").
8. "milestones": 4 to 6 steps in order, each { "period": when, in ${language} (e.g. "Month 1", "Months 2–4"), "title": a short step name in ${language}, "action": what exactly to do and where, in ${language} (e.g. enrol at an ITI or Skill India centre, register on the National Career Service portal, apply for a named scheme or loan) }.

IMPORTANT: Never invent facts. Do not promise approvals, grants or stipend amounts. Do not invent circular numbers or company names. Mark all money figures as estimates. Write profileSummary and audioNarrationScript entirely in ${language}.${
      request
        ? `\n\nTHE GOAL IS FIXED: "${request}". Every part of the roadmap (goal, milestones, courses, jobs, business idea) must be about this goal, even if the profile points to a different field. Never replace it with a goal that suits the profile better; use the profile only to choose the starting point (what they already have).`
        : ''
    }`;

    const response = await generateWithFallback({
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        // Structured output does not need extended reasoning; this keeps it fast
        thinkingConfig: { thinkingBudget: 0 },
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            profileSummary: { type: Type.STRING },
            nsqfCourses: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  jobRole: { type: Type.STRING },
                  qpCode: { type: Type.STRING },
                  nsqfLevel: { type: Type.STRING },
                  sector: { type: Type.STRING },
                  durationHours: { type: Type.STRING },
                  stipendSupported: { type: Type.BOOLEAN },
                  whyFit: { type: Type.STRING },
                },
                required: ['jobRole', 'qpCode', 'nsqfLevel', 'sector', 'durationHours', 'stipendSupported', 'whyFit'],
              },
            },
            skillGapAnalysis: {
              type: Type.OBJECT,
              properties: {
                strengthsIdentified: { type: Type.ARRAY, items: { type: Type.STRING } },
                missingGaps: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
              required: ['strengthsIdentified', 'missingGaps'],
            },
            livelihoodPathways: {
              type: Type.OBJECT,
              properties: {
                wageEmployment: {
                  type: Type.OBJECT,
                  properties: {
                    expectedSalary: { type: Type.STRING },
                    targetEmployers: { type: Type.ARRAY, items: { type: Type.STRING } },
                    timeline: { type: Type.STRING },
                  },
                  required: ['expectedSalary', 'targetEmployers', 'timeline'],
                },
                selfEmployment: {
                  type: Type.OBJECT,
                  properties: {
                    businessConcept: { type: Type.STRING },
                    projectCost: { type: Type.STRING },
                    pmAjayGiaSubsidy: { type: Type.STRING },
                    bankLoanMudra: { type: Type.STRING },
                    equipmentToolkit: { type: Type.STRING },
                    monthlyProfitPotential: { type: Type.STRING },
                  },
                  required: ['businessConcept', 'projectCost', 'pmAjayGiaSubsidy', 'bankLoanMudra', 'equipmentToolkit', 'monthlyProfitPotential'],
                },
              },
              required: ['wageEmployment', 'selfEmployment'],
            },
            localClusterLinkage: { type: Type.STRING },
            audioNarrationScript: { type: Type.STRING },
            goal: { type: Type.STRING },
            milestones: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: { period: { type: Type.STRING }, title: { type: Type.STRING }, action: { type: Type.STRING } },
                required: ['period', 'title', 'action'],
              },
            },
          },
          required: ['profileSummary', 'nsqfCourses', 'skillGapAnalysis', 'livelihoodPathways', 'localClusterLinkage', 'audioNarrationScript', 'goal', 'milestones'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json({ ...parsed, request: request || undefined });
  } catch (error: any) {
    console.error('Error in /api/ai/livelihood-map, returning contextual blueprint:', error?.message);
    const { profile = {} } = req.body;
    const name = profile.name || 'Beneficiary';
    const district = profile.district || 'District';
    const state = profile.state || 'State';
    const trade = profile.traditionalTrade || profile.currentOccupation || 'Craft & Technical Services';

    // High quality contextual fallback conforming to the exact schema
    const fallbackData = {
      profileSummary: `${name} has experience in ${trade} in ${district}, ${state}. Recognition of Prior Learning (RPL) may help certify existing skills, and further NSQF training can open doors to better jobs or a small business. (This is a starting roadmap; the AI service was unavailable.)`,
      nsqfCourses: [
        {
          jobRole: `Advanced training in ${trade}`,
          qpCode: '',
          nsqfLevel: 'Level 4',
          sector: 'Relevant Sector Skill Council — ask at your nearest Skill India centre',
          durationHours: '320 Hours',
          stipendSupported: false,
          whyFit: `Directly bridges traditional craftsmanship in ${district} with modern industrial equipment and digital market linkages.`,
        },
        {
          jobRole: 'Solar PV Technician & Rural Energy Entrepreneur',
          qpCode: 'SGJ/Q0101',
          nsqfLevel: 'Level 4',
          sector: 'Skill Council for Green Jobs',
          durationHours: '300 Hours',
          stipendSupported: false,
          whyFit: 'High demand under PM-KUSUM and rural electrification missions in Scheduled Caste majority habitations.',
        },
        {
          jobRole: 'Domestic Data Entry & CSC Digital Facilitator',
          qpCode: 'SSC/Q2212',
          nsqfLevel: 'Level 4',
          sector: 'IT-ITeS Sector Skill Council',
          durationHours: '400 Hours',
          stipendSupported: false,
          whyFit: 'Enables employment in local Panchayat secretariats, CSC digital centers, or rural banking correspondent points.',
        },
      ],
      skillGapAnalysis: {
        strengthsIdentified: [
          `Hands-on experience in ${trade}`,
          `Knowledge of local customers and suppliers in ${district}`,
        ],
        missingGaps: [
          'A recognised certificate for your existing skills (RPL)',
          'Simple bookkeeping and digital payments (UPI)',
          'Working with modern tools or machines in your trade',
        ],
      },
      livelihoodPathways: {
        wageEmployment: {
          expectedSalary: 'Varies by employer and location — ask the training centre placement cell',
          targetEmployers: [`Local businesses and workshops in ${district}`, 'MSME units', 'Contractors and service providers'],
          timeline: 'Usually a few months after training and certification',
        },
        selfEmployment: {
          businessConcept: `A small ${trade} service or production unit in ${district}`,
          projectCost: 'To be worked out in a simple project report',
          pmAjayGiaSubsidy: 'As per PM-AJAY guidelines — confirm with the District Social Welfare Office',
          bankLoanMudra: 'MUDRA (Shishu / Kishore) or NSFDC loan, as sanctioned by the bank',
          equipmentToolkit: 'List the tools and machines you need in the project report',
          monthlyProfitPotential: 'Depends on sales and costs',
        },
      },
      localClusterLinkage: `Check the District Opportunity Map and your District Industries Centre for current demand for ${trade} in ${district}.`,
      audioNarrationScript: `Hello ${name}. Here is a starting roadmap: build on your ${trade} skills with certified training, then look at loans and grants that may fit. Confirm every scheme detail with your district office before applying.`,
      goal: String(req.body?.request || '').slice(0, 80).trim() || `Grow in ${trade}`,
      milestones: [
        { period: 'Week 1', title: 'Get advice nearby', action: 'Visit your nearest Skill India centre, ITI or CSC and ask which certified course fits this goal.' },
        { period: 'Months 1–3', title: 'Train and get certified', action: 'Join a free NSQF course (PMKVY), or get your existing skills certified through Recognition of Prior Learning.' },
        { period: 'Month 4', title: 'Look for work', action: 'Register on the National Career Service portal (ncs.gov.in) and the placement cell of your training centre.' },
        { period: 'Month 5 onwards', title: 'Grow or start your own work', action: 'If you want your own business, prepare a simple project report and ask your bank about MUDRA or NSFDC loans.' },
      ],
      request: String(req.body?.request || '').slice(0, 400).trim() || undefined,
      fallback: true,
    };

    res.json(fallbackData);
  }
});

// Text-to-Speech endpoint using gemini-3.8-flash-tts with disk & memory cache
const ttsCacheDir = path.join(__dirname, '.tts_cache');
if (!fs.existsSync(ttsCacheDir)) {
  try {
    fs.mkdirSync(ttsCacheDir, { recursive: true });
  } catch (e) {
    // Ignore error if directory already exists
  }
}

async function fetchGoogleTTSChunk(text: string, lang: string): Promise<Buffer> {
  const url =
    'https://translate.google.com/translate_tts?ie=UTF-8&q=' +
    encodeURIComponent(text) +
    '&tl=' +
    lang +
    '&client=tw-ob';
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
  });
  if (!res.ok) throw new Error(`Google TTS failed for lang ${lang}: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function fetchGoogleTTS(text: string, lang: string = 'en'): Promise<Buffer> {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let current = '';
  for (const w of words) {
    if ((current + ' ' + w).length > 140) {
      if (current) chunks.push(current.trim());
      current = w;
    } else {
      current = current ? current + ' ' + w : w;
    }
  }
  if (current) chunks.push(current.trim());

  // Fetch all pieces at once; they are joined back in order
  const buffers = await Promise.all(chunks.map((c) => fetchGoogleTTSChunk(c, lang)));
  return Buffer.concat(buffers);
}

function detectScriptLanguage(text: string, fallback: string = 'en'): string {
  return scriptLanguage(text, toLanguageCode(fallback));
}

function cleanSpeechText(raw: string): string {
  return raw
    .replace(/[*#_~`]+/g, ' ')
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    .replace(/[•\-\+]\s+/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Intelligently extract citizen profile fields from natural voice or text input
app.post('/api/ai/extract-profile', async (req, res) => {
  try {
    const { text, currentProfile = {} } = req.body;
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.json({ profile: currentProfile });
    }

    const prompt = `You are the PM-AJAY GIA Citizen Profile Intake Engine.
Analyze the following natural language citizen statement (which can be in English, Tamil, Telugu, Hindi, Kannada, Malayalam, etc.) and extract any stated citizen profile attributes into JSON:

Citizen Statement: "${text}"
Existing Profile Context: ${JSON.stringify(currentProfile)}

Extract these fields (only include if mentioned or strongly implied, otherwise omit or return null):
- "name": full name of applicant
- "age": age as integer
- "gender": "Male" | "Female" | "Transgender"
- "district": district name in India (e.g. Madurai, Belagavi, Warangal, Palakkad, Agra, etc.)
- "state": corresponding Indian state (e.g. Tamil Nadu, Karnataka, Telangana, Kerala, Uttar Pradesh, etc.)
- "traditionalTrade": primary trade, craft or skill (e.g. Tailoring, Leather Footwear, Solar Tech, Two Wheeler Mechanic, Masonry, Food Processing, Handloom, etc.)
- "currentOccupation": current work or job title
- "existingSkills": specific informal skills mentioned (e.g. machine sewing, sole cutting, wiring, welding)
- "education": educational qualification (e.g. 5th Pass, 8th Pass, 10th Pass, 12th Pass, ITI Certified, Graduate)
- "annualFamilyIncome": certified annual family income if mentioned
- "workPreference": "Self-Employment / Micro-enterprise" or "Wage Employment" or "SHG Group Business"
- "preferredPathway": "Enterprise" (if wants subsidy/shop/business) or "Skilling" (if wants training/course/stipend) or "Employment" (if wants job/placement)
- "goal": a concise 1-sentence summary of the citizen's exact goal in their own context`;

    const response = await generateWithFallback({
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        // Structured output does not need extended reasoning; this keeps it fast
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    const cleaned: Record<string, any> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (v !== null && v !== undefined && v !== '' && v !== 'null') {
        cleaned[k] = v;
      }
    }

    res.json({ success: true, extracted: cleaned });
  } catch (err: any) {
    console.warn('Profile extraction fallback to regex:', err?.message);
    res.json({ success: false, extracted: {} });
  }
});

// Gemini TTS models in preference order; 'google' is the non-Gemini fallback voice.
// The client locks a whole reply to one engine so the voice never changes mid-reply.
const GEMINI_TTS_MODELS = ['gemini-3.8-flash-lite-tts', 'gemini-3.8-flash-tts'];
const TTS_MAX_ATTEMPTS = 3;
// After a quota/rate-limit error, skip that model for a while so consecutive replies keep one voice
const GEMINI_COOLDOWN_MS = 5 * 60 * 1000;
const ttsModelCooldownUntil: Record<string, number> = {};

const TTS_LANG_STYLES: Record<string, string> = {
  ta: 'Warm, respectful, articulate native Tamil speaking counselor with clear cadence and natural human emotion',
  hi: 'सहज, स्पष्ट, आदरणीय और स्वाभाविक हिंदी बोलने वाला सरकारी परामर्शदाता (Warm, articulate and respectful native Hindi counselor)',
  te: 'Warm, respectful, articulate native Telugu speaking counselor with natural and clear cadence',
  kn: 'Warm, respectful, articulate native Kannada speaking counselor with natural and clear cadence',
  ml: 'Warm, respectful, articulate native Malayalam speaking counselor with natural and clear cadence',
  mr: 'Warm, respectful, articulate native Marathi speaking counselor with natural and clear cadence',
  bn: 'Warm, respectful, articulate native Bengali speaking counselor with natural and clear cadence',
  gu: 'Warm, respectful, articulate native Gujarati speaking counselor with natural and clear cadence',
  pa: 'Warm, respectful, articulate native Punjabi speaking counselor with natural and clear cadence',
  or: 'Warm, respectful, articulate native Odia speaking counselor with natural and clear cadence',
  ur: 'Warm, respectful, articulate native Urdu speaking counselor with natural and clear cadence',
  en: 'Warm, articulate, clear, and reassuring Indian English counselor speaking with natural human cadence',
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isRateLimitError(err: any): boolean {
  const msg = String(err?.message || err || '');
  return msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota');
}

async function synthesizeWithGemini(model: string, text: string, voiceName: string, style: string): Promise<string> {
  const response = await ai.models.generateContent({
    model,
    contents: [{ role: 'user', parts: [{ text, speechMetadata: { style } } as any] }],
    config: {
      responseModalities: ['AUDIO'],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
    },
  });
  const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!audioData) throw new Error(`No audio returned from ${model}`);
  return audioData;
}

// Lets the client choose streamed sentence-by-sentence playback while Gemini voices are unavailable
app.get('/api/ai/tts/status', (_req, res) => {
  res.json({ geminiAvailable: GEMINI_TTS_MODELS.some((m) => Date.now() >= (ttsModelCooldownUntil[m] || 0)) });
});

app.post('/api/ai/tts', async (req, res) => {
  const { text, voiceName: reqVoice, locale, engine: lockedEngine, cacheOnly } = req.body;
  if (!text || text.trim().length === 0) {
    return res.status(400).json({ error: 'Text is required for TTS' });
  }

  const cleanedText = cleanSpeechText(text).slice(0, 2000);
  // Style follows the conversation language (not each sentence's script) so every piece sounds alike
  const lang = typeof locale === 'string' && locale.length >= 2 ? locale.slice(0, 2).toLowerCase() : detectScriptLanguage(cleanedText);
  const style = TTS_LANG_STYLES[lang] || TTS_LANG_STYLES.en;

  let voiceName = reqVoice || 'Kore';
  if (!reqVoice) {
    if (lang === 'hi' || lang === 'ml') voiceName = 'Aoede';
    else if (lang === 'te') voiceName = 'Zephyr';
  }

  const sendGoogle = async () => {
    const audioBuf = await fetchGoogleTTS(cleanedText, detectScriptLanguage(cleanedText, lang));
    return res.json({ audioBase64: audioBuf.toString('base64'), mimeType: 'audio/mpeg', engine: 'google' });
  };

  try {
    if (lockedEngine === 'google') return await sendGoogle();

    const models = lockedEngine && GEMINI_TTS_MODELS.includes(lockedEngine) ? [lockedEngine] : GEMINI_TTS_MODELS;

    // Disk cache (only genuine Gemini WAV audio for one of the allowed models)
    for (const model of models) {
      const cacheKey = crypto.createHash('md5').update(`${model}:${voiceName}:${style}:${cleanedText}`).digest('hex');
      const cacheFile = path.join(ttsCacheDir, `${cacheKey}.json`);
      if (fs.existsSync(cacheFile)) {
        try {
          const cachedData = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
          if (cachedData.audioBase64?.startsWith('UklGR')) {
            return res.json({ audioBase64: cachedData.audioBase64, mimeType: 'audio/wav', engine: model, fromCache: true });
          }
        } catch (e) {
          // Fall back to generating
        }
      }
    }

    // Caller only wanted a saved recording, and there is none
    if (cacheOnly) return res.status(204).end();

    // Unlocked requests skip models that recently hit their quota
    const usableModels = lockedEngine ? models : models.filter((m) => Date.now() >= (ttsModelCooldownUntil[m] || 0));
    if (usableModels.length > 0) {
      // A locked reply retries its own model rather than switching voices
      const attempts = lockedEngine ? TTS_MAX_ATTEMPTS : 1;
      let lastErr: any = null;
      for (const model of usableModels) {
        for (let attempt = 1; attempt <= attempts; attempt++) {
          try {
            const base64Audio = await synthesizeWithGemini(model, cleanedText, voiceName, style);
            try {
              const cacheKey = crypto.createHash('md5').update(`${model}:${voiceName}:${style}:${cleanedText}`).digest('hex');
              fs.writeFileSync(
                path.join(ttsCacheDir, `${cacheKey}.json`),
                JSON.stringify({ audioBase64: base64Audio, mimeType: 'audio/wav', text: cleanedText, voiceName, model, generatedAt: new Date().toISOString() })
              );
            } catch (e) {
              // Ignore cache write error
            }
            return res.json({ audioBase64: base64Audio, mimeType: 'audio/wav', engine: model });
          } catch (err: any) {
            lastErr = err;
            console.warn(`TTS model ${model} attempt ${attempt} failed:`, err?.message?.slice(0, 160));
            if (isRateLimitError(err)) {
              // Honour Google's retry delay (daily free-tier quotas can be many hours)
              const retrySecs = Number(String(err?.message || '').match(/retryDelay"?\s*:\s*"(\d+)s"/)?.[1] || 0);
              ttsModelCooldownUntil[model] = Date.now() + Math.max(GEMINI_COOLDOWN_MS, retrySecs * 1000);
              // A used-up quota will not recover in seconds — retrying only adds silence
              break;
            }
            if (attempt < attempts) await sleep(700 * attempt);
          }
        }
      }
      if (lockedEngine) {
        // Never swap voices mid-reply: let the client decide how to recover
        return res.status(503).json({ error: 'Locked TTS engine unavailable', engine: lockedEngine });
      }
    }

    return await sendGoogle();
  } catch (fallbackErr: any) {
    console.error('All TTS engines failed:', fallbackErr?.message);
    res.status(500).json({ error: 'TTS generation failed', details: fallbackErr?.message });
  }
});

// Audio transcribe endpoint using gemini-3.5-transcribe
app.post('/api/ai/transcribe', async (req, res) => {
  try {
    const { audioBase64, mimeType = 'audio/webm', languageHint } = req.body;
    if (!audioBase64) {
      return res.status(400).json({ error: 'Audio data required' });
    }

    const audioPart = {
      inlineData: {
        mimeType: mimeType,
        data: audioBase64,
      },
    };

    let transcript = '';
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: {
          parts: [
            audioPart,
            {
              text: `Transcribe this spoken audio accurately. If it is in an Indian language (like Hindi, Marathi, Bengali, Tamil, Telugu, Kannada, Gujarati, Punjabi, Odia), transcribe in native script and detect the language. Keep exact words spoken. ${languageHint ? 'Expected language: ' + languageHint : ''}`,
            },
          ],
        },
      });
      transcript = response.text || '';
    } catch (primaryErr: any) {
      console.warn('gemini-3.5-transcribe unavailable, trying multimodal flash fallback:', primaryErr?.message);
      try {
        const fallbackResponse = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: {
            parts: [
              audioPart,
              {
                text: `Transcribe this spoken voice message accurately. Do not add explanations or notes. Just return the verbatim transcript in the native spoken language (Tamil, Hindi, Telugu, Kannada, Malayalam, or English). ${languageHint ? 'Expected language: ' + languageHint : ''}`,
              },
            ],
          },
        });
        transcript = fallbackResponse.text || '';
      } catch (secErr: any) {
        console.warn('gemini-3.8-flash transcribe failed, trying gemini-3.5-flash-lite:', secErr?.message);
        const tertiary = await ai.models.generateContent({
          model: 'gemini-3.5-flash-lite',
          contents: {
            parts: [
              audioPart,
              {
                text: `Transcribe this audio verbatim in native Indian script. ${languageHint ? 'Language: ' + languageHint : ''}`,
              },
            ],
          },
        });
        transcript = tertiary.text || '';
      }
    }

    res.json({
      transcript: transcript.trim(),
    });
  } catch (error: any) {
    console.error('Transcribe error:', error);
    res.status(500).json({ error: 'Transcription failed', details: error?.message });
  }
});

// Vite or Static file serving
async function setupVite() {
  if (!isProduction) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }
}

setupVite().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
});
