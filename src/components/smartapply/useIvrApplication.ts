import { useRef, useState } from 'react';
import { autofillApi, type HelplineView } from '../../services/autofillApi';
import { getSmartApplyStrings } from '../../data/smartApplyStrings';
import { toAsciiDigits } from '../../data/languageTools';
import { spokenIn } from '../../services/translate';
import type { LanguageCode } from '../../types';
import { VOICE_COMMANDS } from './media';

/**
 * Continue a Smart Apply application inside a helpline call: the caller says or keys in the
 * application reference (and a PIN when calling from another device), then answers the
 * remaining questions one at a time by voice or keypad. Answers are saved to the same
 * application as they are given. The helpline never reads back details already stored.
 */

type Stage = 'idle' | 'consent' | 'reference' | 'pin' | 'questions';
type Question = HelplineView['missing'][number];

interface Options {
  /** Speak to the caller (and add it to the call log). Resolves when finished. */
  say: (text: string) => Promise<void>;
  /** Show work in progress (saving an answer). */
  setBusy: (busy: boolean) => void;
  /** The call's language. English and Hindi prompts are written here; others are translated. */
  language: LanguageCode;
}

const LETTERS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGIT_WORDS: Record<string, string> = {
  zero: '0', one: '1', two: '2', to: '2', too: '2', three: '3', four: '4', for: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9',
  ek: '1', do: '2', teen: '3', char: '4', chaar: '4', paanch: '5', chhe: '6', saat: '7', aath: '8', nau: '9',
  शून्य: '0', एक: '1', दो: '2', तीन: '3', चार: '4', पांच: '5', पाँच: '5', छह: '6', सात: '7', आठ: '8', नौ: '9',
};

/** Pull an application reference (UD-ABCD-2345) out of typed or spoken text. */
export function findReference(text: string): string | null {
  const joined = toAsciiDigits(text)
    .split(/[\s,.\-–—]+/)
    .map((w) => DIGIT_WORDS[w.toLowerCase()] ?? w)
    .join('')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  // The last "UD" followed by 8 valid characters ("you D" is heard as YOUD, which also contains UD)
  let found: string | null = null;
  for (let i = joined.indexOf('UD'); i >= 0; i = joined.indexOf('UD', i + 1)) {
    const code = joined.slice(i + 2, i + 10);
    if (code.length === 8 && [...code].every((c) => LETTERS.includes(c))) found = code;
  }
  return found ? `UD-${found.slice(0, 4)}-${found.slice(4)}` : null;
}

/** True when what the caller said is about continuing an application (a reference, or "continue my form"). */
export const isApplicationRequest = (text: string) =>
  Boolean(findReference(text)) || (CONTINUE_APPLICATION.test(text) && CONTINUE_VERB.test(text));

const CONTINUE_VERB = /continue|resume|complete|finish|fill|jaari|पूरा|भर|जारी|पूर्ण|सुरू ठेव|தொடர|நிரப்ப|முடிக்க|కొనసాగించ|పూర్తి|నింప|ಮುಂದುವರಿಸ|ಪೂರ್ಣ|ಭರ್ತಿ|തുടര|പൂരിപ്പിക്ക|പൂർത്തി|চালিয়ে|পূরণ|শেষ কর|ચાલુ|ભર|પૂર્ણ|ਜਾਰੀ|ਪੂਰਾ|ਭਰ|ଜାରି|ପୂରଣ|ଶେଷ କର|جاری|مکمل|بھر/i;

/** Words that mean the caller wants to continue an application. */
export const CONTINUE_APPLICATION = /\b(application|form|reference|aavedan|avedan|my form|continue)\b|आवेदन|फ़ॉर्म|फॉर्म|अर्ज|फॉर्म|விண்ணப்ப|படிவ|దరఖాస్తు|ఫారం|ಅರ್ಜಿ|ಫಾರ್ಮ್|അപേക്ഷ|ഫോം|আবেদন|ফর্ম|અરજી|ફોર્મ|ਅਰਜ਼ੀ|ਫਾਰਮ|ଆବେଦନ|ଫର୍ମ|درخواست|فارم/i;

const PH = {
  en: {
    askRef: 'Please say or type your application reference. It starts with U D, and is shown at the top of your application in Smart Apply.',
    badRef: 'I could not catch a reference. It looks like U D, then four letters or numbers, then four more. Please say it again, or type it.',
    askPin: 'This application was started on another device. Please enter its helpline PIN on the keypad, then press hash. The PIN is set on the Download step of Smart Apply.',
    badPin: 'That reference and PIN did not match. Please try the PIN again, or press star to give a different reference.',
    found: (v: HelplineView) => `Found ${v.schemeName}, reference ${v.reference.split('').join(' ')}. It is ${v.completion} percent filled, with ${v.missing.length} ${v.missing.length === 1 ? 'question' : 'questions'} left.`,
    controls: 'Answer each question, or say skip, repeat, or stop. Numbers can be keyed in, then hash. Press hash alone to skip, star to repeat.',
    yesNo: 'Say yes or no, or press 1 for yes and 2 for no.',
    press: (opts: string[]) => opts.map((o, i) => `press ${i + 1} for ${o.replace(/\s*\(.*\)/, '')}`).join(', ') + '.',
    saved: 'Saved.',
    done: (v: HelplineView) =>
      `That is all the questions I can take by phone. The application is now ${v.completion} percent filled.${v.conflicts ? ` ${v.conflicts} details need you to choose the right value in the app.` : ''} To finish, open Smart Apply with this reference to add your documents and photo, check the details and approve. I am handing you back to the helpline agent.`,
    stopped: 'Your answers so far are saved. I am handing you back to the helpline agent.',
    error: 'Sorry, the application service did not respond. Please try again.',
    consent: (points: string[]) => `Before I take your details: ${points.join(' ')} Say I agree, or press 1, to continue. Say no, or press 2, to stop.`,
    noConsent: 'All right, nothing has been saved. I am handing you back to the helpline agent.',
    started: (name: string) => `I have started your ${name} application.`,
  },
  hi: {
    askRef: 'कृपया अपने आवेदन का रेफ़रेंस बोलिए या टाइप कीजिए। यह U D से शुरू होता है और Smart Apply में आवेदन के ऊपर लिखा होता है।',
    badRef: 'रेफ़रेंस समझ नहीं आया। यह U D, फिर चार अक्षर या अंक, फिर चार और होते हैं। कृपया दोबारा बोलिए या टाइप कीजिए।',
    askPin: 'यह आवेदन किसी दूसरे फ़ोन या कंप्यूटर पर शुरू हुआ था। कीपैड पर हेल्पलाइन PIN डालकर हैश दबाइए। PIN Smart Apply के डाउनलोड चरण में बनता है।',
    badPin: 'रेफ़रेंस और PIN मेल नहीं खाए। PIN फिर से डालिए, या दूसरा रेफ़रेंस देने के लिए स्टार दबाइए।',
    found: (v: HelplineView) => `${v.schemeName} मिल गया। ${v.completion} प्रतिशत भरा है, ${v.missing.length} सवाल बाकी हैं।`,
    controls: 'हर सवाल का जवाब दीजिए, या छोड़ो, दोबारा या रुको बोलिए। छोड़ने के लिए हैश, दोबारा सुनने के लिए स्टार दबाइए।',
    yesNo: 'हाँ या नहीं बोलिए, या हाँ के लिए 1 और नहीं के लिए 2 दबाइए।',
    press: (opts: string[]) => opts.map((o, i) => `${o.replace(/\s*\(.*\)/, '')} के लिए ${i + 1}`).join(', ') + ' दबाइए।',
    saved: 'सेव हो गया।',
    done: (v: HelplineView) =>
      `फ़ोन पर पूछे जाने वाले सारे सवाल पूरे हुए। आवेदन ${v.completion} प्रतिशत भर गया है।${v.conflicts ? ` ${v.conflicts} जानकारी ऐप में सही चुननी होगी।` : ''} पूरा करने के लिए Smart Apply में यही रेफ़रेंस खोलिए, दस्तावेज़ और फ़ोटो जोड़िए, जाँचिए और मंज़ूर कीजिए। अब आपको हेल्पलाइन एजेंट से जोड़ा जा रहा है।`,
    stopped: 'आपके अब तक के जवाब सेव हैं। अब आपको हेल्पलाइन एजेंट से जोड़ा जा रहा है।',
    error: 'माफ़ कीजिए, आवेदन सेवा से जवाब नहीं आया। कृपया फिर कोशिश कीजिए।',
    consent: (points: string[]) => `आपकी जानकारी लेने से पहले: ${points.join(' ')} जारी रखने के लिए "मैं सहमत हूँ" बोलिए, या नहीं बोलिए।`,
    noConsent: 'ठीक है, कुछ भी सेव नहीं हुआ। अब आपको हेल्पलाइन एजेंट से जोड़ा जा रहा है।',
    started: (name: string) => `आपका ${name} आवेदन शुरू हो गया है।`,
  },
};

const isYesNo = (q: Question) => q.options?.length === 2 && /^yes$/i.test(q.options[0]) && /^no$/i.test(q.options[1]);
const COMMAND = VOICE_COMMANDS;

const toDigits = (text: string) =>
  toAsciiDigits(text)
    .split(/[\s,.\-]+/)
    .map((w) => DIGIT_WORDS[w.toLowerCase()] ?? w)
    .join('')
    .replace(/\D/g, '');

export function useIvrApplication({ say: sayAsGiven, setBusy, language }: Options) {
  const hindi = language === 'hi';
  const p = hindi ? PH.hi : PH.en;
  /** Speak in the call's language (English prompts are translated for languages other than Hindi). */
  const say = async (...parts: string[]) => sayAsGiven(await spokenIn(language, ...parts));
  const [stage, setStageState] = useState<Stage>('idle');
  const stageRef = useRef<Stage>('idle');
  const reference = useRef('');
  const pin = useRef('');
  const token = useRef<string | null>(null);
  const view = useRef<HelplineView | null>(null);
  const skipped = useRef(new Set<string>());
  const pendingScheme = useRef<string | null>(null);
  /** Digits keyed in for a number answer, sent with #. */
  const keyed = useRef('');

  const setStage = (s: Stage) => {
    stageRef.current = s;
    setStageState(s);
  };

  const current = (): Question | undefined => view.current?.missing.find((q) => !skipped.current.has(q.key));

  const askCurrent = async (prefix = '') => {
    const q = current();
    if (!q) {
      const v = view.current!;
      setStage('idle');
      return say(prefix, p.done(v));
    }
    // Nothing can be uploaded on a call, so Aadhaar is asked as its last 4 digits
    const text =
      q.key === 'aadhaar'
        ? hindi ? 'अपने आधार नंबर के आख़िरी 4 अंक बोलिए या कीपैड पर डालिए।' : 'Please say or key in the last 4 digits of your Aadhaar number.'
        : (hindi && q.questionHi) || q.question || q.label;
    const hint = isYesNo(q) ? p.yesNo : q.options && q.options.length <= 6 ? p.press(q.options) : '';
    await say(prefix, text, hint);
  };

  const begin = async () => {
    skipped.current.clear();
    setStage('reference');
    await say(p.askRef);
  };

  const open = async (ref: string, withPin = '') => {
    reference.current = ref;
    setBusy(true);
    try {
      const r = await autofillApi.helpline.resume(ref, withPin);
      token.current = r.token;
      view.current = await autofillApi.helpline.draft(r.token);
      skipped.current.clear();
      setStage('questions');
      setBusy(false);
      await askCurrent(`${p.found(view.current)} ${view.current.missing.length ? p.controls : ''}`.trim());
    } catch (err: any) {
      setBusy(false);
      if (/pin_required/.test(err?.message || '')) {
        pin.current = '';
        setStage('pin');
        return say(p.askPin);
      }
      if (stageRef.current === 'pin') return say(p.badPin);
      setStage('reference');
      return say(/right form/.test(err?.message || '') ? p.badRef : err?.message || p.error);
    }
  };

  const answer = async (text: string) => {
    const q = current();
    if (!q || !token.current) return;
    setBusy(true);
    try {
      const res = await autofillApi.helpline.answer(token.current, q.key, text);
      view.current = res;
      setBusy(false);
      if (!res.ok || res.error) return askCurrent(res.error || '');
      await askCurrent(p.saved);
    } catch (err: any) {
      setBusy(false);
      await say(err?.message || p.error);
    }
  };

  /** Start a new application in the call (after consent, which is asked by voice if not given yet). */
  const startNew = async (schemeId: string) => {
    pendingScheme.current = schemeId;
    setBusy(true);
    try {
      const s = await autofillApi.session();
      setBusy(false);
      if (!s.consent) {
        setStage('consent');
        const points = getSmartApplyStrings(hindi ? 'hi' : 'en').consentPoints.map((x) => x.replace('{days}', String(s.retentionDays)));
        return say(p.consent(points));
      }
      await createAndOpen();
    } catch {
      setBusy(false);
      await say(p.error);
    }
  };

  const createAndOpen = async () => {
    const schemeId = pendingScheme.current;
    pendingScheme.current = null;
    if (!schemeId) return;
    setBusy(true);
    try {
      const r = await autofillApi.startDraft(schemeId, 'helpline');
      setBusy(false);
      await say(p.started(r.draft.scheme?.name?.split(' (')[0] || ''));
      await open(r.draft.reference);
    } catch {
      setBusy(false);
      setStage('idle');
      await say(p.error);
    }
  };

  /** Handles what the caller said or typed. Returns false when it is not for the application. */
  const handleText = async (raw: string): Promise<boolean> => {
    const text = raw.trim();
    const stg = stageRef.current;
    if (stg === 'idle') {
      const ref = findReference(text);
      if (ref) return open(ref).then(() => true);
      if (CONTINUE_APPLICATION.test(text) && CONTINUE_VERB.test(text)) return begin().then(() => true);
      return false;
    }
    if (stg === 'consent') {
      if ((VOICE_COMMANDS.agree.test(text) || VOICE_COMMANDS.yes.test(text)) && !VOICE_COMMANDS.no.test(text)) {
        setBusy(true);
        try {
          const s = await autofillApi.session();
          await autofillApi.consent(s.consentVersion);
        } finally {
          setBusy(false);
        }
        await createAndOpen();
      } else {
        pendingScheme.current = null;
        setStage('idle');
        await say(p.noConsent);
      }
      return true;
    }
    if (COMMAND.stop.test(text)) {
      setStage('idle');
      await say(p.stopped);
      return true;
    }
    if (stg === 'reference') {
      const ref = findReference(text);
      await (ref ? open(ref) : say(p.badRef));
      return true;
    }
    if (stg === 'pin') {
      const ref = findReference(text);
      const digits = toDigits(text);
      if (ref) await open(ref);
      else if (digits.length >= 4) await open(reference.current, digits.slice(0, 6));
      else await say(p.askPin);
      return true;
    }
    // questions
    const q = current();
    if (COMMAND.repeat.test(text)) await askCurrent();
    else if (COMMAND.skip.test(text) && q) {
      skipped.current.add(q.key);
      await askCurrent();
    } else await answer(text);
    return true;
  };

  /** Keypad during the application. Returns false when the key is not for the application. */
  const handleKey = (digit: string): boolean => {
    const stg = stageRef.current;
    if (stg === 'idle') return false;
    if (stg === 'consent') {
      if (digit === '1' || digit === '2') handleText(digit === '1' ? 'yes' : 'no');
      return true;
    }
    if (stg === 'pin') {
      if (digit === '#') open(reference.current, pin.current);
      else if (digit === '*') {
        setStage('reference');
        say(p.askRef);
      } else pin.current = (pin.current + digit).slice(0, 6);
      return true;
    }
    if (stg === 'questions') {
      const q = current();
      if (!q) return true;
      if (digit === '#' && keyed.current) {
        const value = keyed.current;
        keyed.current = '';
        answer(value);
      } else if (digit === '#') {
        skipped.current.add(q.key);
        askCurrent();
      } else if (digit === '*') {
        keyed.current = '';
        askCurrent();
      }
      else if (q.options && /^[1-9]$/.test(digit) && q.options[Number(digit) - 1]) answer(q.options[Number(digit) - 1]);
      else if (!q.options && /^\d$/.test(digit)) {
        // Numbers (Aadhaar digits, PIN code, mobile) can be keyed in, then # to send
        keyed.current += digit;
        return true;
      }
      return true;
    }
    if (stg === 'reference' && digit === '*') {
      setStage('idle');
      say(p.stopped);
    }
    return true;
  };

  return { stage, active: stage !== 'idle', begin, startNew, handleText, handleKey };
}
