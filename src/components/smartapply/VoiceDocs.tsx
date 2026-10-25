import React, { useEffect, useRef, useState } from 'react';
import { AudioLines } from 'lucide-react';
import { DOC_KINDS, PROFILE_FIELD_MAP, type DocKind } from '../../data/autofillSchema';
import { autofillApi, type DraftView, type SessionState, type UploadFile } from '../../services/autofillApi';
import { CameraScanner } from './CameraScanner';
import { VOICE_COMMANDS, findField, preparePassportPhoto, spokenIndex, useVoiceTurns, spokenYesNo } from './media';
import { spokenIn } from '../../services/translate';
import type { LanguageCode } from '../../types';

interface Props {
  /** Change `n` to start the voice hand-off to documents. `afterQuestions`: the spoken questions just ended. */
  start: { n: number; afterQuestions: boolean };
  speechLocale: string;
  /** Spoken language: English and Hindi phrases are written here, others are translated. */
  language: LanguageCode;
  /** Latest draft and photo state (read when each step runs). */
  getDraft: () => DraftView | null;
  hasPhoto: () => boolean;
  onSession: (s: SessionState) => void;
  refreshDraft: () => Promise<DraftView | null>;
  /** The person prefers to answer document details themselves: continue with questions. */
  onAnswerInstead: () => void;
  /** Show a step of the application (3 = review, 4 = approve and download). */
  onShowStep: (step: number) => void;
  /** Approve the current details; resolves to false if they are not ready. */
  onApprove: () => Promise<boolean>;
  onDownload: () => Promise<void>;
}

const PH = {
  en: {
    doc: (doc: string, labels: string) => `I can fill ${labels} from your ${doc}. Say scan to show it to the camera, or say answer to tell me yourself.`,
    hold: (doc: string) => `Hold your ${doc} flat inside the frame, in good light. Say capture. For the back side, say capture again. Then say done.`,
    reading: (doc: string) => `Reading your ${doc}.`,
    filled: (n: number, doc: string) => (n ? `Done. ${n} details filled from your ${doc}.` : `I could not read any details from it. You can scan it again or answer yourself.`),
    failed: 'The document could not be read.',
    photo: 'Last, your photo for the form. Say photo to open the front camera, or say skip to add it later.',
    pose: 'Look straight at the camera, in front of a plain wall. Say capture.',
    photoOk: 'Your photo is added.',
    photoBad: (why: string) => `The photo cannot be used: ${why}. Say photo to try again.`,
    proof: (label: string, example: string) => `Your application also needs ${label.toLowerCase()}, for example your ${example}. Say scan to show it to the camera, or say skip.`,
    left: (n: number, labels: string) => `${n} ${n === 1 ? 'detail is' : 'details are'} still missing: ${labels}. Say answer to give ${n === 1 ? 'it' : 'them'} now, or say stop to fill ${n === 1 ? 'it' : 'them'} on the screen later.`,
    conflict: (label: string, values: string[]) =>
      `Your documents show two different values for ${label.toLowerCase()}: ${values.map((v, i) => `${i + 1}: ${v}`).join(', ')}. Say the number of the right one, or say the correct ${label.toLowerCase()}.`,
    whichField: 'Which detail do you want to change? Say its name, for example mobile number.',
    noField: 'I could not find that detail. Please say its name as it is shown on the screen, or say stop.',
    newValue: (label: string) => `Say the new ${label.toLowerCase()}.`,
    changed: (label: string) => `${label} is changed.`,
    allDone: 'Everything is filled. Opening the review so you can check your details.',
    notHeard: 'Voice paused. Tap Fill by voice to continue.',
    conflicts: (n: number) => `${n} ${n === 1 ? 'detail has' : 'details have'} two different values from your documents. Please choose the right one on the screen, then say continue.`,
    review: (n: number, check: string[]) =>
      `All ${n} details are filled.${check.length ? ` Please check these on the screen: ${check.join(', ')}.` : ''} Say read to hear every detail, say change to correct one, say approve if they are all correct, or say stop.`,
    afterRead: 'Say approve if everything is correct, or say change to correct a detail.',
    notReady: (needs: string[]) =>
      needs.length
        ? `Before it can be approved, the application still needs: ${needs.join(', ')}. Tap Fill by voice when you have ${needs.length === 1 ? 'it' : 'them'} ready.`
        : 'The application is not ready to approve yet. Please check the screen.',
    approved: 'Approved. Say download to save your filled application as a PDF.',
    downloaded: (where: string) => `Your application is downloaded. Nothing has been submitted. Take it, with your original documents, to ${where}.`,
  },
  hi: {
    doc: (doc: string, labels: string) => `${labels} आपके ${doc} से भरा जा सकता है। कैमरे में दिखाने के लिए स्कैन बोलिए, या ख़ुद बताने के लिए जवाब बोलिए।`,
    hold: (doc: string) => `${doc} को फ़्रेम के अंदर रोशनी में रखिए और कैप्चर बोलिए। पीछे की तरफ़ के लिए फिर कैप्चर बोलिए। फिर हो गया बोलिए।`,
    reading: (doc: string) => `${doc} पढ़ा जा रहा है।`,
    filled: (n: number, doc: string) => (n ? `हो गया। ${doc} से ${n} जानकारी भरी गई।` : 'इससे कोई जानकारी नहीं पढ़ी जा सकी। फिर से स्कैन करें या ख़ुद बताइए।'),
    failed: 'दस्तावेज़ नहीं पढ़ा जा सका।',
    photo: 'आख़िर में, फ़ॉर्म के लिए आपकी फ़ोटो। सामने का कैमरा खोलने के लिए फ़ोटो बोलिए, या बाद में जोड़ने के लिए छोड़ो बोलिए।',
    pose: 'कैमरे की तरफ़ सीधे देखिए, पीछे सादी दीवार हो। कैप्चर बोलिए।',
    photoOk: 'आपकी फ़ोटो जुड़ गई।',
    photoBad: (why: string) => `यह फ़ोटो नहीं चलेगी: ${why}। दोबारा कोशिश के लिए फ़ोटो बोलिए।`,
    proof: (label: string, example: string) => `आवेदन के लिए ${label} भी चाहिए, जैसे आपका ${example}। कैमरे में दिखाने के लिए स्कैन बोलिए, या छोड़ो बोलिए।`,
    left: (n: number, labels: string) => `${n} जानकारी अभी बाकी है: ${labels}। अभी बताने के लिए जवाब बोलिए, या बाद में स्क्रीन पर भरने के लिए रुको बोलिए।`,
    conflict: (label: string, values: string[]) =>
      `${label} के दो अलग मान मिले हैं: ${values.map((v, i) => `${i + 1}: ${v}`).join(', ')}। सही वाले का नंबर बोलिए, या सही ${label} बोलिए।`,
    whichField: 'कौन-सी जानकारी बदलनी है? उसका नाम बोलिए, जैसे मोबाइल नंबर।',
    noField: 'वह जानकारी नहीं मिली। स्क्रीन पर लिखा नाम बोलिए, या रुको बोलिए।',
    newValue: (label: string) => `नया ${label} बोलिए।`,
    changed: (label: string) => `${label} बदल दिया गया।`,
    allDone: 'सब भर गया। अब जाँच के लिए रिव्यू खोला जा रहा है।',
    notHeard: 'आवाज़ रोकी गई। जारी रखने के लिए Fill by voice दबाइए।',
    conflicts: (n: number) => `${n} जानकारी के दस्तावेज़ों में दो अलग मान हैं। स्क्रीन पर सही वाला चुनिए, फिर आगे बोलिए।`,
    review: (n: number, check: string[]) =>
      `सारी ${n} जानकारी भर गई है।${check.length ? ` स्क्रीन पर इन्हें जाँच लीजिए: ${check.join(', ')}।` : ''} हर जानकारी सुनने के लिए पढ़ो बोलिए, कुछ ठीक करना हो तो बदलो बोलिए, सब सही हो तो मंज़ूर बोलिए, या रुको बोलिए।`,
    afterRead: 'सब सही हो तो मंज़ूर बोलिए, या कुछ ठीक करना हो तो बदलो बोलिए।',
    notReady: (needs: string[]) =>
      needs.length
        ? `मंज़ूरी से पहले आवेदन में अभी यह चाहिए: ${needs.join(', ')}। तैयार होने पर Fill by voice दबाइए।`
        : 'आवेदन अभी मंज़ूरी के लिए तैयार नहीं है। कृपया स्क्रीन देखिए।',
    approved: 'मंज़ूर हो गया। भरा हुआ आवेदन PDF में सेव करने के लिए डाउनलोड बोलिए।',
    downloaded: (where: string) => `आपका आवेदन डाउनलोड हो गया। अभी कहीं जमा नहीं हुआ है। इसे अपने मूल दस्तावेज़ों के साथ ${where} पर ले जाइए।`,
  },
};

const kindOf = (label: string) => (Object.keys(DOC_KINDS) as DocKind[]).find((k) => DOC_KINDS[k].label === label);
const shortName = (label: string) => label.split(/\s*[/(]/)[0].trim();

/**
 * Hands-free documents: after the spoken questions, asks for each document that would fill
 * the remaining details and opens the camera when the person says "scan"; then the photo.
 */
export const VoiceDocs: React.FC<Props> = ({ start, speechLocale, language, getDraft, hasPhoto, onSession, refreshDraft, onAnswerInstead, onShowStep, onApprove, onDownload }) => {
  const voice = useVoiceTurns(speechLocale);
  const p = language === 'hi' ? PH.hi : PH.en;
  const labelOf = (f: { label: string; labelHi?: string }) => (language === 'hi' && f.labelHi ? f.labelHi : f.label);
  const say = async (text: string) => voice.say(await spokenIn(language, text));
  const [scanner, setScanner] = useState<null | { kind?: DocKind; doc: string; photo?: boolean }>(null);
  const [status, setStatus] = useState<string | null>(null);
  const alive = useRef(true);
  const afterQuestions = useRef(false);
  /** Requirements the person said to skip in this voice session. */
  const skippedProofs = useRef(new Set<string>());
  const skippedPhoto = useRef(false);

  useEffect(() => () => {
    alive.current = false;
  }, []);

  const end = (message?: string) => {
    setStatus(null);
    if (message) say(message);
  };

  /** Ask for the next document, then the photo, then hand over to review. */
  const next = async (draft = getDraft()) => {
    if (!draft || !alive.current) return;
    // Questions the person skipped stay on screen; voice moves on to documents
    const pending = draft.missing.filter((f) => f.fillableBy?.length);

    if (pending.length) {
      const docLabel = pending[0].fillableBy![0];
      const labels = pending.filter((f) => f.fillableBy!.includes(docLabel)).map((f) => f.label.toLowerCase());
      const doc = shortName(docLabel);
      setStatus(`Asking for your ${doc}`);
      const heard = await ask(p.doc(doc, labels.slice(0, 4).join(', ')));
      if (heard === null) return;
      if (VOICE_COMMANDS.scan.test(heard) || VOICE_COMMANDS.capture.test(heard)) return setScanner({ kind: kindOf(docLabel), doc });
      if (VOICE_COMMANDS.answer.test(heard)) {
        setStatus(null);
        return onAnswerInstead();
      }
      return end(VOICE_COMMANDS.stop.test(heard) ? undefined : p.notHeard);
    }

    // Nothing to scan but questions remain (the person said "scan" mid-way): go back to them
    if (!afterQuestions.current && draft.missing.length > 0) {
      setStatus(null);
      afterQuestions.current = true;
      return onAnswerInstead();
    }

    // Required proofs still missing, even when their details are already filled
    const proof = draft.documents.find((d) => d.required && !d.have && !d.manual && d.id !== 'photo' && !skippedProofs.current.has(d.id));
    if (proof) {
      const example = shortName(proof.accepted[0] || proof.label);
      setStatus(`Asking for ${proof.label.toLowerCase()}`);
      const heard = await ask(p.proof(proof.label, example));
      if (heard === null) return;
      if (VOICE_COMMANDS.scan.test(heard) || VOICE_COMMANDS.capture.test(heard)) return setScanner({ kind: proof.kind as DocKind, doc: example });
      if (VOICE_COMMANDS.skip.test(heard)) {
        skippedProofs.current.add(proof.id);
        return next(draft);
      }
      return end(VOICE_COMMANDS.stop.test(heard) ? undefined : p.notHeard);
    }

    if (!hasPhoto() && !skippedPhoto.current) {
      setStatus('Asking for your photo');
      const heard = await ask(p.photo);
      if (heard === null) return;
      if (VOICE_COMMANDS.photo.test(heard) || VOICE_COMMANDS.scan.test(heard) || VOICE_COMMANDS.capture.test(heard)) return setScanner({ doc: 'photo', photo: true });
      if (VOICE_COMMANDS.skip.test(heard)) {
        // Carry on to the review; approval will say the photo is still needed
        skippedPhoto.current = true;
        return next(draft);
      }
      return end(VOICE_COMMANDS.stop.test(heard) ? undefined : p.notHeard);
    }

    if (draft.missing.length) {
      setStatus('Asking for the details still missing');
      const heard = await ask(p.left(draft.missing.length, draft.missing.slice(0, 3).map((f) => labelOf(f).toLowerCase()).join(', ')));
      if (heard === null) return;
      if (heard && !VOICE_COMMANDS.stop.test(heard) && (VOICE_COMMANDS.answer.test(heard) || VOICE_COMMANDS.yes.test(heard))) {
        setStatus(null);
        return onAnswerInstead();
      }
      return end(heard ? undefined : p.notHeard);
    }
    // Documents disagree: read both values and take the choice by voice
    for (const c of draft.conflicts) {
      const label = labelOf({ label: PROFILE_FIELD_MAP[c.key]?.label || c.key, labelHi: PROFILE_FIELD_MAP[c.key]?.labelHi });
      setStatus(`Choosing your ${label.toLowerCase()}`);
      const heard = await ask(p.conflict(label, c.candidates.map((x) => x.value)));
      if (heard === null) return;
      if (!heard || VOICE_COMMANDS.stop.test(heard)) return end(heard ? undefined : p.notHeard);
      const index = spokenIndex(heard, c.candidates.length);
      try {
        onSession(await autofillApi.resolveConflict(c.id, index >= 0 ? { index } : { value: heard }));
      } catch (err: any) {
        return end(err?.message || p.failed);
      }
    }
    if (draft.conflicts.length) return next((await refreshDraft()) || draft);
    await review(draft);
  };

  /** Review, approval and download — all by voice, with the details on screen. */
  const review = async (first: DraftView) => {
    let draft = first;
    onShowStep(3);
    setStatus('Reviewing your application');
    let prompt = p.review(draft.fields.filter((f) => f.value).length, draft.needsReview.map((f) => f.label.toLowerCase()));
    for (let turn = 0; turn < 4 && alive.current; turn++) {
      const heard = await ask(prompt);
      if (heard === null) return;
      if (!heard || VOICE_COMMANDS.stop.test(heard)) return end(heard ? undefined : p.notHeard);
      if (VOICE_COMMANDS.change.test(heard)) {
        const fresh = await correctByVoice();
        if (fresh === null) return;
        draft = fresh;
        prompt = p.afterRead;
        continue;
      }
      if (VOICE_COMMANDS.read.test(heard)) {
        // Labels in the chosen language; the values themselves are read as written
        const filled = draft.fields.filter((f) => f.value);
        const labels = (await spokenIn(language, filled.map((f) => f.label).join(' | '))).split(/\s*\|\s*/);
        const all = filled.map((f, i) => `${labels.length === filled.length ? labels[i] : f.label}: ${f.value}`).join('. ');
        if (!(await voice.say(all))) return;
        prompt = p.afterRead;
        continue;
      }
      if (spokenYesNo(heard) === 'yes') {
        if (!(await onApprove())) {
          const d = (await refreshDraft()) || draft;
          const needs = [...d.documents.filter((x) => x.required && !x.have && !x.manual).map((x) => x.label.toLowerCase()), ...d.missing.map((f) => labelOf(f).toLowerCase())];
          return end(p.notReady(needs));
        }
        onShowStep(4);
        const again = await ask(p.approved);
        if (again && (VOICE_COMMANDS.download.test(again) || VOICE_COMMANDS.yes.test(again))) {
          setStatus('Preparing your PDF…');
          try {
            await onDownload();
            return end(p.downloaded(draft.scheme?.submission?.where || 'the office or portal'));
          } catch (err: any) {
            return end(err?.message || p.failed);
          }
        }
        return end();
      }
      prompt = p.afterRead;
    }
    end();
  };

  /**
   * Correct one detail by voice: name it, then say the new value. Resolves to the updated
   * application, or null when voice was stopped.
   */
  const correctByVoice = async (): Promise<DraftView | null> => {
    const draft = getDraft();
    if (!draft) return null;
    const fields = draft.fields;
    // Names as the person may say them: English, Hindi, and in the chosen language
    const spokenLabels = (await spokenIn(language, fields.map((f) => f.label).join(' | '))).split(/\s*\|\s*/);
    for (let tries = 0; tries < 3 && alive.current; tries++) {
      const heard = await ask(tries ? p.noField : p.whichField);
      if (heard === null) return null;
      if (!heard || VOICE_COMMANDS.stop.test(heard)) return draft;
      const field = findField(heard, fields, spokenLabels);
      if (!field) continue;
      const label = labelOf(field);
      for (let attempt = 0; attempt < 2; attempt++) {
        const value = await ask(p.newValue(label));
        if (value === null) return null;
        if (!value || VOICE_COMMANDS.stop.test(value)) return draft;
        setStatus(`Saving your ${label.toLowerCase()}…`);
        try {
          const res = await autofillApi.editFields(draft.id, { [field.key]: value });
          onSession(res);
          const error = res.errors?.[field.key];
          if (error) {
            await say(error);
            continue;
          }
          await say(p.changed(label));
          return (await refreshDraft()) || res.draft;
        } catch (err: any) {
          await say(err?.message || p.failed);
        }
      }
      return (await refreshDraft()) || draft;
    }
    return draft;
  };

  /** Speak, then listen; asks twice. '' if nothing was heard, null if voice was stopped. */
  const ask = async (prompt: string): Promise<string | null> => {
    for (let tries = 0; tries < 2; tries++) {
      if (!(await say(prompt))) return null;
      const heard = await voice.listen(9000);
      if (heard === null) return null;
      if (heard) return heard;
    }
    return '';
  };

  useEffect(() => {
    if (!start.n) return;
    afterQuestions.current = start.afterQuestions;
    skippedProofs.current.clear();
    skippedPhoto.current = false;
    next();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start.n]);

  const onScanned = async (files: UploadFile[]) => {
    const target = scanner!;
    setScanner(null);
    try {
      if (target.photo) {
        setStatus('Checking your photo…');
        const bytes = Uint8Array.from(atob(files[0].dataBase64), (c) => c.charCodeAt(0));
        const prepared = await preparePassportPhoto(new File([bytes], 'photo.jpg', { type: 'image/jpeg' }));
        const s = await autofillApi.uploadPhoto(prepared);
        onSession(s);
        const failed = s.photo?.checks.find((c) => c.status === 'fail');
        if (failed) {
          setStatus(null);
          const heard = await ask(p.photoBad(failed.label.toLowerCase()));
          if (heard && (VOICE_COMMANDS.photo.test(heard) || VOICE_COMMANDS.capture.test(heard) || VOICE_COMMANDS.scan.test(heard))) setScanner({ doc: 'photo', photo: true });
          return;
        }
        await say(p.photoOk);
      } else {
        setStatus(`Reading your ${target.doc}…`);
        say(p.reading(target.doc));
        const res = await autofillApi.uploadDocument(files, target.kind);
        onSession(res);
        const filled = res.document.fields.filter((f) => f.merged).length;
        await say(p.filled(filled, target.doc));
      }
    } catch (err: any) {
      setStatus(null);
      await say(err?.message || p.failed);
    }
    const fresh = await refreshDraft();
    if (alive.current) next(fresh);
  };

  return (
    <>
      {(status || voice.phase !== 'idle') && !scanner && (
        <div className="card flex items-center gap-3 border-teal/30 p-3 text-sm" role="status">
          <AudioLines className={`h-5 w-5 shrink-0 text-teal-600 ${voice.phase === 'listening' ? 'animate-pulse text-coral' : ''}`} aria-hidden />
          <span className="min-w-0 flex-1 truncate font-semibold text-navy">
            {voice.interim ? `“${voice.interim}”` : voice.phase === 'listening' ? 'Listening…' : status || 'Speaking…'}
          </span>
          <button
            onClick={() => {
              voice.cancel();
              setStatus(null);
            }}
            className="btn btn-outline btn-sm"
          >
            Stop voice
          </button>
        </div>
      )}
      {scanner && (
        <CameraScanner
          facing={scanner.photo ? 'user' : 'environment'}
          maxPages={scanner.photo ? 1 : undefined}
          title={scanner.photo ? 'Your photo' : `Scan your ${scanner.doc}`}
          voicePrompt={scanner.photo ? p.pose : p.hold(scanner.doc)}
          speechLocale={speechLocale}
          language={language}
          onClose={() => {
            setScanner(null);
            setStatus(null);
          }}
          onDone={onScanned}
        />
      )}
    </>
  );
};
