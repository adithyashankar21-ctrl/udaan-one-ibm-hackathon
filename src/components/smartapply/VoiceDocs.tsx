import React, { useEffect, useRef, useState } from 'react';
import { AudioLines } from 'lucide-react';
import { DOC_KINDS, type DocKind } from '../../data/autofillSchema';
import { autofillApi, type DraftView, type SessionState, type UploadFile } from '../../services/autofillApi';
import { CameraScanner } from './CameraScanner';
import { VOICE_COMMANDS, preparePassportPhoto, useVoiceTurns } from './media';

interface Props {
  /** Change `n` to start the voice hand-off to documents. `afterQuestions`: the spoken questions just ended. */
  start: { n: number; afterQuestions: boolean };
  speechLocale: string;
  hindi: boolean;
  /** Latest draft and photo state (read when each step runs). */
  getDraft: () => DraftView | null;
  hasPhoto: () => boolean;
  onSession: (s: SessionState) => void;
  refreshDraft: () => Promise<DraftView | null>;
  /** The person prefers to answer document details themselves: continue with questions. */
  onAnswerInstead: () => void;
  onAllDone: () => void;
}

const PH = {
  en: {
    doc: (doc: string, labels: string) => `I can fill ${labels} from your ${doc}. Say scan to show it to the camera, or say answer to tell me yourself.`,
    hold: (doc: string) => `Hold your ${doc} flat inside the frame, in good light. Say capture. For the back side, say capture again. Then say done.`,
    reading: (doc: string) => `Reading your ${doc}.`,
    filled: (n: number, doc: string) => (n ? `Done. ${n} details filled from your ${doc}.` : `I could not read any details from it. You can scan it again or answer yourself.`),
    failed: 'The document could not be read.',
    photo: 'Last, your photo for the form. Say photo to open the front camera, or say stop.',
    pose: 'Look straight at the camera, in front of a plain wall. Say capture.',
    photoOk: 'Your photo is added.',
    photoBad: (why: string) => `The photo cannot be used: ${why}. Say photo to try again.`,
    proof: (label: string, example: string) => `Your application also needs ${label.toLowerCase()}, for example your ${example}. Say scan to show it to the camera, or say skip.`,
    left: (n: number, labels: string) => `${n} ${n === 1 ? 'detail is' : 'details are'} still missing: ${labels}. You can answer on the screen.`,
    allDone: 'Everything is filled. Opening the review so you can check your details.',
    notHeard: 'Voice paused. Tap Fill by voice to continue.',
  },
  hi: {
    doc: (doc: string, labels: string) => `${labels} आपके ${doc} से भरा जा सकता है। कैमरे में दिखाने के लिए स्कैन बोलिए, या ख़ुद बताने के लिए जवाब बोलिए।`,
    hold: (doc: string) => `${doc} को फ़्रेम के अंदर रोशनी में रखिए और कैप्चर बोलिए। पीछे की तरफ़ के लिए फिर कैप्चर बोलिए। फिर हो गया बोलिए।`,
    reading: (doc: string) => `${doc} पढ़ा जा रहा है।`,
    filled: (n: number, doc: string) => (n ? `हो गया। ${doc} से ${n} जानकारी भरी गई।` : 'इससे कोई जानकारी नहीं पढ़ी जा सकी। फिर से स्कैन करें या ख़ुद बताइए।'),
    failed: 'दस्तावेज़ नहीं पढ़ा जा सका।',
    photo: 'आख़िर में, फ़ॉर्म के लिए आपकी फ़ोटो। सामने का कैमरा खोलने के लिए फ़ोटो बोलिए।',
    pose: 'कैमरे की तरफ़ सीधे देखिए, पीछे सादी दीवार हो। कैप्चर बोलिए।',
    photoOk: 'आपकी फ़ोटो जुड़ गई।',
    photoBad: (why: string) => `यह फ़ोटो नहीं चलेगी: ${why}। दोबारा कोशिश के लिए फ़ोटो बोलिए।`,
    proof: (label: string, example: string) => `आवेदन के लिए ${label} भी चाहिए, जैसे आपका ${example}। कैमरे में दिखाने के लिए स्कैन बोलिए, या छोड़ो बोलिए।`,
    left: (n: number, labels: string) => `${n} जानकारी अभी बाकी है: ${labels}। आप स्क्रीन पर जवाब दे सकते हैं।`,
    allDone: 'सब भर गया। अब जाँच के लिए रिव्यू खोला जा रहा है।',
    notHeard: 'आवाज़ रोकी गई। जारी रखने के लिए Fill by voice दबाइए।',
  },
};

const kindOf = (label: string) => (Object.keys(DOC_KINDS) as DocKind[]).find((k) => DOC_KINDS[k].label === label);
const shortName = (label: string) => label.split(/\s*[/(]/)[0].trim();

/**
 * Hands-free documents: after the spoken questions, asks for each document that would fill
 * the remaining details and opens the camera when the person says "scan"; then the photo.
 */
export const VoiceDocs: React.FC<Props> = ({ start, speechLocale, hindi, getDraft, hasPhoto, onSession, refreshDraft, onAnswerInstead, onAllDone }) => {
  const voice = useVoiceTurns(speechLocale);
  const p = hindi ? PH.hi : PH.en;
  const [scanner, setScanner] = useState<null | { kind?: DocKind; doc: string; photo?: boolean }>(null);
  const [status, setStatus] = useState<string | null>(null);
  const alive = useRef(true);
  const afterQuestions = useRef(false);
  /** Requirements the person said to skip in this voice session. */
  const skippedProofs = useRef(new Set<string>());

  useEffect(() => () => {
    alive.current = false;
  }, []);

  const end = (message?: string) => {
    setStatus(null);
    if (message) voice.say(message);
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
      if (/answer|jawab|जवाब|bata|बता|myself|khud|ख़ुद|खुद/i.test(heard)) {
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

    if (!hasPhoto()) {
      setStatus('Asking for your photo');
      const heard = await ask(p.photo);
      if (heard === null) return;
      if (/photo|foto|फ़ोटो|फोटो|camera|कैमरा|capture|scan/i.test(heard)) return setScanner({ doc: 'photo', photo: true });
      return end(VOICE_COMMANDS.stop.test(heard) ? undefined : p.notHeard);
    }

    if (draft.missing.length) {
      return end(p.left(draft.missing.length, draft.missing.slice(0, 3).map((f) => f.label.toLowerCase()).join(', ')));
    }
    end();
    await voice.say(p.allDone);
    if (alive.current) onAllDone();
  };

  /** Speak, then listen; asks twice. '' if nothing was heard, null if voice was stopped. */
  const ask = async (prompt: string): Promise<string | null> => {
    for (let tries = 0; tries < 2; tries++) {
      if (!(await voice.say(prompt))) return null;
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
          if (heard && /photo|foto|फ़ोटो|फोटो|camera|capture/i.test(heard)) setScanner({ doc: 'photo', photo: true });
          return;
        }
        await voice.say(p.photoOk);
      } else {
        setStatus(`Reading your ${target.doc}…`);
        voice.say(p.reading(target.doc));
        const res = await autofillApi.uploadDocument(files, target.kind);
        onSession(res);
        const filled = res.document.fields.filter((f) => f.merged).length;
        await voice.say(p.filled(filled, target.doc));
      }
    } catch (err: any) {
      setStatus(null);
      await voice.say(err?.message || p.failed);
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
