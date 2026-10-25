/**
 * The UDAAN ONE helpline on a real phone line (Twilio Programmable Voice).
 *
 * Twilio calls /incoming when someone rings the helpline number (or when the app asks Twilio to
 * call someone through /call-me). Every reply is TwiML: speech in the caller's language and a
 * <Gather> that listens for their words or keypad presses and posts them to /turn.
 *
 * A call goes: language menu → conversation with the same AI counsellor as the app → and, when
 * the caller wants to apply or to continue an application, the application questions one at a
 * time, saved straight into the same applications the app shows.
 */
import crypto from 'crypto';
import express, { type Request, type Response } from 'express';
import { findReference, isApplicationRequest } from '../../src/data/applicationWords';
import { FORM_SCHEMA_MAP } from '../../src/data/autofillSchema';
import { LANGUAGE_NAMES } from '../../src/data/languageTools';
import { VOICE_COMMANDS } from '../../src/data/voiceWords';
import type { LanguageCode } from '../../src/types';
import { authEnabled, bearerToken, verifyUser } from '../auth';
import type { Translate } from '../i18n/router';
import { INTERNAL_KEY } from '../internal';

const env = () => ({
  sid: process.env.TWILIO_ACCOUNT_SID || '',
  token: process.env.TWILIO_AUTH_TOKEN || '',
  number: process.env.TWILIO_PHONE_NUMBER || '',
  publicBase: (process.env.PUBLIC_BASE_URL || '').replace(/\/+$/, ''),
});

/** Keypad key for each language, as in the app's helpline menu. */
const MENU: Array<[string, LanguageCode]> = [
  ['1', 'en'], ['2', 'hi'], ['3', 'ta'], ['4', 'te'], ['5', 'kn'], ['6', 'ml'],
  ['7', 'mr'], ['8', 'bn'], ['9', 'gu'], ['0', 'pa'], ['*', 'or'], ['#', 'ur'],
];

const MENU_LINES: Record<LanguageCode, string> = {
  en: 'For English, press 1.',
  hi: 'हिन्दी के लिए 2 दबाएं।',
  ta: 'தமிழுக்கு 3 அழுத்தவும்.',
  te: 'తెలుగు కోసం 4 నొక్కండి.',
  kn: 'ಕನ್ನಡಕ್ಕಾಗಿ 5 ಒತ್ತಿರಿ.',
  ml: 'മലയാളത്തിനായി 6 അമർത്തുക.',
  mr: 'मराठीसाठी 7 दाबा.',
  bn: 'বাংলার জন্য 8 টিপুন।',
  gu: 'ગુજરાતી માટે 9 દબાવો.',
  pa: 'ਪੰਜਾਬੀ ਲਈ 0 ਦਬਾਓ।',
  or: 'ଓଡ଼ିଆ ପାଇଁ ଷ୍ଟାର ଦବାନ୍ତୁ।',
  ur: 'اردو کے لیے ہیش دبائیں۔',
};

/** Twilio's Google voices for Indian languages; Odia and Urdu are played from our own speech. */
const VOICE: Partial<Record<LanguageCode, string>> = {
  en: 'Google.en-IN-Standard-A',
  hi: 'Google.hi-IN-Standard-A',
  ta: 'Google.ta-IN-Standard-A',
  te: 'Google.te-IN-Standard-A',
  kn: 'Google.kn-IN-Standard-A',
  ml: 'Google.ml-IN-Standard-A',
  mr: 'Google.mr-IN-Standard-A',
  bn: 'Google.bn-IN-Standard-A',
  gu: 'Google.gu-IN-Standard-A',
  pa: 'Google.pa-IN-Standard-A',
};

/** Speech-recognition language for each language. */
const HEARING: Record<LanguageCode, string> = {
  en: 'en-IN', hi: 'hi-IN', ta: 'ta-IN', te: 'te-IN', kn: 'kn-IN', ml: 'ml-IN',
  mr: 'mr-IN', bn: 'bn-IN', gu: 'gu-IN', pa: 'pa-guru-IN', or: 'or-IN', ur: 'ur-IN',
};

const P = {
  welcome: 'Welcome to the UDAAN ONE helpline. Please choose your language, or say its name.',
  greeting:
    'Hello, I am your UDAAN ONE helper. Ask me about government schemes, skill training, loans or documents. To apply for something, just say what you want to apply for. To continue an application you started, say continue my application, or press 4.',
  notHeard: 'Sorry, I did not hear you. Please speak after the beep, or press a key.',
  anythingElse: 'Is there anything else I can help you with?',
  goodbye: 'Thank you for calling UDAAN ONE. Goodbye.',
  busy: 'Sorry, I could not get an answer just now. Please ask again.',
  consent: (name: string, days: number) =>
    `I can fill your ${name} application on this call. I will ask one question at a time. Your answers are kept safely with your phone number for ${days} days after your last call, and nothing is submitted anywhere without you. Press 1 or say yes to agree. Press 2 or say no to stop.`,
  noConsent: 'All right, nothing has been saved.',
  started: (name: string) => `I have started your ${name} application. You can say skip, repeat or stop at any time.`,
  askRef: 'Please say your application reference. It starts with U D, followed by eight letters and numbers.',
  badRef: 'I could not catch the reference. Please say it again slowly, for example U D, A B C D, 2 3 4 5.',
  askPin: 'Please enter the helpline PIN for this application on your keypad, then press hash.',
  badPin: 'That PIN did not match. Please try again, then press hash.',
  found: (name: string, pct: number, left: number) => `I found your ${name} application. It is ${pct} percent filled, with ${left} ${left === 1 ? 'question' : 'questions'} left.`,
  yesNo: 'Say yes or no, or press 1 for yes and 2 for no.',
  press: (opts: string[]) => `${opts.map((o, i) => `press ${i + 1} for ${o.replace(/\s*\(.*\)/, '')}`).join(', ')}.`,
  numberKeys: 'You can also type it on the keypad, then press hash.',
  saved: 'Saved.',
  done: (pct: number) => `That is all the questions I can take by phone. Your application is now ${pct} percent filled.`,
  setPin: 'To open this application in the UDAAN ONE app later, choose a 4 to 6 digit PIN. Type it on your keypad, then press hash.',
  weakPin: 'Please choose a PIN that is not all the same digit or a simple sequence like 1 2 3 4. Type it, then press hash.',
  reference: (ref: string) => `Your application reference is ${ref.replace(/-/g, ' ').split('').join(' ')}. I have also sent it to you by SMS. To finish, open Smart Apply in the UDAAN ONE app with this reference and PIN, add your documents and photo, and approve.`,
  referenceNoSms: (ref: string) => `Your application reference is ${ref.replace(/-/g, ' ').split('').join(' ')}. Please write it down. To finish, open Smart Apply in the UDAAN ONE app with this reference and PIN, add your documents and photo, and approve.`,
  continueInApp: 'To finish, open Smart Apply in the UDAAN ONE app to add your documents and photo, then approve.',
  stopped: 'Your answers so far are saved.',
};

interface Question {
  key: string;
  question?: string;
  questionHi?: string;
  label: string;
  type: string;
  options?: string[];
}

type Stage = 'menu' | 'chat' | 'consent' | 'ref' | 'pin' | 'question' | 'newPin';

interface Call {
  caller: string;
  lang: LanguageCode;
  stage: Stage;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  misses: number;
  pendingScheme?: string;
  reference?: string;
  /** Helpline token for the application being filled. */
  appToken?: string;
  startedOnCall?: boolean;
  missing: Question[];
  skipped: Set<string>;
  updated: number;
}

const calls = new Map<string, Call>();
setInterval(() => {
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  for (const [sid, c] of calls) if (c.updated < cutoff) calls.delete(sid);
}, 10 * 60 * 1000).unref();

/** Speech we produce ourselves (Odia, Urdu), fetched by Twilio through <Play>. */
const audio = new Map<string, { text: string; lang: LanguageCode; at: number }>();

const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const twiml = (inner: string) => `<?xml version="1.0" encoding="UTF-8"?><Response>${inner}</Response>`;

export function createVoiceRouter({ translate, selfBase }: { translate: Translate; selfBase: string }) {
  const router = express.Router();
  router.use(express.urlencoded({ extended: false }));

  const publicBase = (req: Request) => env().publicBase || `${req.protocol}://${req.headers.host}`;

  /** Twilio signs every webhook with the account's auth token; anything else is refused. */
  const fromTwilio = (req: Request) => {
    const { token } = env();
    if (!token) return false;
    const signature = String(req.headers['x-twilio-signature'] || '');
    const url = publicBase(req) + req.originalUrl;
    const params = req.body || {};
    const data = url + Object.keys(params).sort().map((k) => k + params[k]).join('');
    const expected = crypto.createHmac('sha1', token).update(Buffer.from(data, 'utf-8')).digest('base64');
    return signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  };

  /** Call this server's own API (body null = GET). */
  const local = async (path: string, body: unknown, headers: Record<string, string> = {}) => {
    const res = await fetch(selfBase + path, {
      method: body === null ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Udaan-Client': '1', 'X-Internal-Key': INTERNAL_KEY, ...headers },
      body: body === null ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
    return { status: res.status, data: await res.json().catch(() => ({})) };
  };

  /** Speak `parts` in the caller's language (English prompts are translated, cached). */
  const say = async (req: Request, call: Call, parts: string[]) => {
    const list = parts.filter((p) => p && p.trim());
    const english = list.filter((p) => !/[ऀ-෿؀-ۿ]/.test(p));
    const out = call.lang === 'en' ? english : await translate(call.lang, english, true);
    const byText = new Map(english.map((p, i) => [p, out[i] || p]));
    const text = list.map((p) => byText.get(p) ?? p).join(' ');
    return speak(req, text, call.lang);
  };

  const speak = (req: Request, text: string, lang: LanguageCode) => {
    const voice = VOICE[lang];
    if (voice) return `<Say voice="${voice}" language="${HEARING[lang].replace('-guru', '')}">${xml(text)}</Say>`;
    const id = crypto.randomBytes(9).toString('base64url');
    audio.set(id, { text, lang, at: Date.now() });
    return `<Play>${xml(`${publicBase(req)}/api/voice/audio/${id}`)}</Play>`;
  };

  /**
   * Listen for the caller: speech in their language, and keypad presses. Answers to form
   * questions may pause (between "my number is…" and the digits), so they get a longer silence
   * before the turn ends; `hints` are words the answer is likely to contain (the options).
   */
  const gather = (req: Request, call: Call, inner: string, opts: { digits?: number; hash?: boolean; hints?: string[]; patient?: boolean } = {}) =>
    `<Gather input="speech dtmf" language="${HEARING[call.lang]}" speechTimeout="${opts.patient ? 2 : 'auto'}" timeout="7" actionOnEmptyResult="true" method="POST" action="${xml(
      `${publicBase(req)}/api/voice/turn`
    )}"${opts.digits ? ` numDigits="${opts.digits}"` : ''}${opts.hash ? ' finishOnKey="#"' : ''}${
      opts.hints?.length ? ` hints="${xml(opts.hints.map((h) => h.replace(/\s*\(.*?\)/g, '').replace(/,/g, ' ')).join(', ').slice(0, 900))}"` : ''
    }>${inner}</Gather>`;

  const send = (res: Response, inner: string) => res.type('text/xml').send(twiml(inner));

  const menu = async (req: Request, call: Call) => {
    call.stage = 'menu';
    const lines = [speak(req, P.welcome, 'en'), ...MENU.map(([, code]) => speak(req, MENU_LINES[code], code))].join('');
    // finishOnKey off: # and * choose Urdu and Odia here
    return `<Gather input="dtmf speech" numDigits="1" finishOnKey="" language="en-IN" hints="${Object.values(LANGUAGE_NAMES).join(', ')}" timeout="6" actionOnEmptyResult="true" method="POST" action="${xml(
      `${publicBase(req)}/api/voice/turn`
    )}">${lines}</Gather>`;
  };

  /* ── Application questions ─────────────────────────────────────── */

  const current = (call: Call) => call.missing.find((q) => !call.skipped.has(q.key));
  const isYesNo = (q: Question) => q.options?.length === 2 && /^yes$/i.test(q.options[0]) && /^no$/i.test(q.options[1]);

  const askQuestion = async (req: Request, call: Call, prefix: string[] = []) => {
    const q = current(call);
    if (!q) return finishApplication(req, call, prefix);
    call.stage = 'question';
    const text = q.key === 'aadhaar' ? 'Please say or type the last 4 digits of your Aadhaar number.' : (call.lang === 'hi' && q.questionHi) || q.question || q.label;
    const hint = isYesNo(q) ? P.yesNo : q.options && q.options.length <= 6 ? P.press(q.options) : !q.options && /mobile|pincode|aadhaar|number|money|account/.test(q.type) ? P.numberKeys : '';
    const digits = q.options && q.options.length <= 9 ? 1 : undefined;
    return gather(req, call, await say(req, call, [...prefix, text, hint]), { digits, hash: !digits, hints: q.options, patient: true });
  };

  const finishApplication = async (req: Request, call: Call, prefix: string[]) => {
    const view = await local('/api/autofill/helpline/draft', null, { 'X-Helpline-Token': call.appToken! }).catch(() => null);
    const pct = view?.data?.completion ?? 0;
    if (call.startedOnCall) {
      call.stage = 'newPin';
      return gather(req, call, await say(req, call, [...prefix, P.done(pct), P.setPin]), { hash: true });
    }
    call.stage = 'chat';
    return gather(req, call, await say(req, call, [...prefix, P.done(pct), P.continueInApp, P.anythingElse]));
  };

  const answer = async (req: Request, call: Call, text: string) => {
    const q = current(call)!;
    // How sure Twilio's recogniser was (spoken answers only), so unclear speech is checked more carefully
    const confidence = req.body?.SpeechResult ? Number(req.body?.Confidence) || undefined : undefined;
    const r = await local('/api/autofill/helpline/answer', { key: q.key, text, confidence }, { 'X-Helpline-Token': call.appToken! }).catch(() => null);
    if (!r || r.status !== 200) {
      call.stage = 'chat';
      return gather(req, call, await say(req, call, [P.busy, P.anythingElse]));
    }
    if (!r.data.ok || r.data.error) return askQuestion(req, call, [r.data.error || P.notHeard]);
    call.missing = r.data.missing || [];
    return askQuestion(req, call, [P.saved]);
  };

  const openApplication = async (req: Request, call: Call, data: any, intro: string[]) => {
    call.appToken = data.token;
    call.missing = data.missing || [];
    call.skipped = new Set();
    call.reference = data.reference;
    return askQuestion(req, call, intro);
  };

  const resume = async (req: Request, call: Call, reference: string, pin = '') => {
    call.reference = reference;
    const r = await local('/api/autofill/helpline/resume', { reference, pin }).catch(() => null);
    if (r?.status === 401 && r.data.error === 'pin_required') {
      call.stage = 'pin';
      return gather(req, call, await say(req, call, [P.askPin]), { hash: true });
    }
    if (r?.status === 401) {
      call.stage = 'pin';
      return gather(req, call, await say(req, call, [P.badPin]), { hash: true });
    }
    if (!r || r.status !== 200) {
      call.stage = 'ref';
      return gather(req, call, await say(req, call, [r?.data?.error || P.badRef]));
    }
    const view = await local('/api/autofill/helpline/draft', null, { 'X-Helpline-Token': r.data.token }).catch(() => null);
    const v = view?.data || {};
    call.startedOnCall = false;
    return openApplication(req, call, { token: r.data.token, missing: v.missing, reference }, [P.found(v.schemeName || 'your', v.completion ?? 0, (v.missing || []).length)]);
  };

  /* ── Conversation ──────────────────────────────────────────────── */

  const chat = async (req: Request, call: Call, text: string) => {
    call.history.push({ role: 'user', content: text });
    const r = await local('/api/ai/chat', { messages: call.history.slice(-8), userProfile: {}, language: LANGUAGE_NAMES[call.lang], channel: 'Helpline phone call' }).catch(() => null);
    const reply = String(r?.data?.reply || '').trim();
    if (!reply) return gather(req, call, await say(req, call, [P.busy]));
    call.history.push({ role: 'assistant', content: reply });
    const schemeId = r?.data?.applyIntent?.schemeId;
    if (schemeId) {
      call.pendingScheme = schemeId;
      call.stage = 'consent';
      const name = FORM_SCHEMA_MAP[schemeId]?.formTitle.split(' — ')[0] || 'this';
      return gather(req, call, speak(req, reply, call.lang) + (await say(req, call, [P.consent(name, 7)])), { digits: 1 });
    }
    return gather(req, call, speak(req, reply, call.lang));
  };

  const sendSms = async (to: string, body: string) => {
    const { sid, token, number } = env();
    if (!sid || !token || !number || !to) return false;
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ To: to, From: number, Body: body }),
    }).catch(() => null);
    return Boolean(res?.ok);
  };

  /* ── Webhooks ──────────────────────────────────────────────────── */

  router.post('/incoming', async (req, res) => {
    if (!fromTwilio(req)) return res.status(403).send('Forbidden');
    const sid = String(req.body.CallSid || '');
    // On calls we place ("call me"), the person we called is in To
    const caller = String(req.body.Direction === 'inbound' ? req.body.From : req.body.To || req.body.From || '');
    const call: Call = { caller, lang: 'en', stage: 'menu', history: [], misses: 0, missing: [], skipped: new Set(), updated: Date.now() };
    calls.set(sid, call);
    send(res, (await menu(req, call)) + `<Redirect method="POST">${xml(`${publicBase(req)}/api/voice/turn`)}</Redirect>`);
  });

  router.post('/turn', async (req, res) => {
    if (!fromTwilio(req)) return res.status(403).send('Forbidden');
    const sid = String(req.body.CallSid || '');
    const call = calls.get(sid);
    if (!call) return send(res, `<Redirect method="POST">${xml(`${publicBase(req)}/api/voice/incoming`)}</Redirect>`);
    call.updated = Date.now();
    const digits = String(req.body.Digits || '').trim();
    const speech = String(req.body.SpeechResult || '').trim();
    const heard = speech || digits;

    try {
      // Silence: ask again, and say goodbye after three in a row
      if (!heard) {
        if (++call.misses >= 3) return send(res, (await say(req, call, [P.goodbye])) + '<Hangup/>');
        if (call.stage === 'menu') return send(res, await menu(req, call));
        if (call.stage === 'question') return send(res, await askQuestion(req, call, [P.notHeard]));
        return send(res, gather(req, call, await say(req, call, [P.notHeard])));
      }
      call.misses = 0;
      const short = speech.split(/\s+/).length <= 3;

      switch (call.stage) {
        case 'menu': {
          const byKey = MENU.find(([k]) => k === digits)?.[1];
          const byName = (Object.keys(LANGUAGE_NAMES) as LanguageCode[]).find((c) => speech.toLowerCase().includes(LANGUAGE_NAMES[c].toLowerCase()));
          call.lang = byKey || byName || 'en';
          call.stage = 'chat';
          return send(res, gather(req, call, await say(req, call, [P.greeting])));
        }

        case 'chat': {
          if (speech && short && (VOICE_COMMANDS.stop.test(speech) || /\b(bye|goodbye)\b/i.test(speech))) return send(res, (await say(req, call, [P.goodbye])) + '<Hangup/>');
          const ref = speech ? findReference(speech) : null;
          if (ref) return send(res, await resume(req, call, ref));
          if (digits === '4' || (speech && isApplicationRequest(speech))) {
            call.stage = 'ref';
            return send(res, gather(req, call, await say(req, call, [P.askRef])));
          }
          return send(res, await chat(req, call, speech || digits));
        }

        case 'consent': {
          const yes = digits === '1' || ((VOICE_COMMANDS.yes.test(speech) || VOICE_COMMANDS.agree.test(speech)) && !VOICE_COMMANDS.no.test(speech));
          if (!yes || !call.pendingScheme) {
            call.stage = 'chat';
            call.pendingScheme = undefined;
            return send(res, gather(req, call, await say(req, call, [P.noConsent, P.anythingElse])));
          }
          const r = await local('/api/autofill/phone/start', { caller: call.caller, schemeId: call.pendingScheme }).catch(() => null);
          call.pendingScheme = undefined;
          if (!r || r.status !== 200) {
            call.stage = 'chat';
            return send(res, gather(req, call, await say(req, call, [P.busy])));
          }
          call.startedOnCall = true;
          return send(res, await openApplication(req, call, r.data, [P.started(r.data.schemeName || '')]));
        }

        case 'ref': {
          const ref = findReference(speech || digits);
          if (!ref) return send(res, gather(req, call, await say(req, call, [P.badRef])));
          return send(res, await resume(req, call, ref));
        }

        case 'pin':
          return send(res, await resume(req, call, call.reference!, digits));

        case 'question': {
          const q = current(call);
          if (!q) return send(res, await finishApplication(req, call, []));
          if (speech && short && VOICE_COMMANDS.stop.test(speech)) {
            call.stage = 'chat';
            return send(res, gather(req, call, await say(req, call, [P.stopped, P.anythingElse])));
          }
          if (speech && short && VOICE_COMMANDS.repeat.test(speech)) return send(res, await askQuestion(req, call));
          if (speech && short && VOICE_COMMANDS.skip.test(speech)) {
            call.skipped.add(q.key);
            return send(res, await askQuestion(req, call));
          }
          let value = speech;
          if (!speech && digits) {
            if (isYesNo(q)) value = digits === '1' ? 'Yes' : digits === '2' ? 'No' : '';
            else if (q.options) value = q.options[Number(digits) - 1] || '';
            else value = digits;
          }
          if (!value) return send(res, await askQuestion(req, call, [P.notHeard]));
          return send(res, await answer(req, call, value));
        }

        case 'newPin': {
          const r = await local('/api/autofill/phone/pin', { pin: digits }, { 'X-Helpline-Token': call.appToken! }).catch(() => null);
          if (!r || r.status !== 200) return send(res, gather(req, call, await say(req, call, [P.weakPin]), { hash: true }));
          const ref = String(r.data.reference);
          const smsSent = await sendSms(call.caller, `UDAAN ONE: your application reference is ${ref}. Open Smart Apply in the UDAAN ONE app with this reference and the PIN you chose, to add documents and approve.`);
          call.stage = 'chat';
          call.startedOnCall = false;
          return send(res, gather(req, call, await say(req, call, [smsSent ? P.reference(ref) : P.referenceNoSms(ref), P.anythingElse])));
        }
      }
      return send(res, await menu(req, call));
    } catch (err: any) {
      console.warn('[voice] turn failed:', String(err?.message || err).slice(0, 160));
      return send(res, gather(req, call, await say(req, call, [P.busy]).catch(() => '')));
    }
  });

  /** Our own speech for languages Twilio has no voice for (played with <Play>). */
  router.get('/audio/:id', async (req, res) => {
    const item = audio.get(req.params.id);
    if (!item) return res.status(404).end();
    try {
      const r = await fetch(`${selfBase}/api/ai/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: item.text, locale: `${item.lang}-IN` }),
        signal: AbortSignal.timeout(20000),
      });
      const data: any = await r.json();
      if (!data.audioBase64) return res.status(502).end();
      res.type(data.mimeType || 'audio/mpeg').send(Buffer.from(data.audioBase64, 'base64'));
    } catch {
      res.status(502).end();
    }
  });

  /* ── From the app ──────────────────────────────────────────────── */

  router.get('/status', (_req, res) => {
    const { sid, token, number } = env();
    res.json({ enabled: Boolean(sid && token && number), number: number || null });
  });

  const callMeHits = new Map<string, number[]>();

  /** "Call me": Twilio rings the person's phone and connects them to the helpline. */
  router.post('/call-me', express.json(), async (req, res) => {
    const { sid, token, number } = env();
    if (!sid || !token || !number) return res.status(503).json({ error: 'The phone helpline is not set up yet.' });
    if (authEnabled() && !(await verifyUser(bearerToken(req.headers.authorization)))) return res.status(401).json({ error: 'Please sign in first.' });
    const digits = String(req.body?.to || '').replace(/\D/g, '');
    const to = digits.length === 10 ? `+91${digits}` : digits.length === 12 && digits.startsWith('91') ? `+${digits}` : '';
    if (!/^\+91[6-9]\d{9}$/.test(to)) return res.status(400).json({ error: 'Enter a 10-digit Indian mobile number.' });
    const key = req.ip || 'ip';
    const recent = (callMeHits.get(key) || []).filter((t) => Date.now() - t < 10 * 60 * 1000);
    if (recent.length >= 3) return res.status(429).json({ error: 'Too many calls asked for. Please wait a few minutes.' });
    callMeHits.set(key, [...recent, Date.now()]);
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ To: to, From: number, Url: `${publicBase(req)}/api/voice/incoming`, Method: 'POST' }),
    }).catch(() => null);
    const data: any = await r?.json().catch(() => ({}));
    if (!r?.ok) {
      const unverified = /unverified|not verified|trial/i.test(String(data?.message || ''));
      return res.status(400).json({ error: unverified ? 'On the Twilio trial, this number must first be verified in the Twilio console.' : data?.message || 'Could not place the call.' });
    }
    res.json({ ok: true });
  });

  return router;
}
