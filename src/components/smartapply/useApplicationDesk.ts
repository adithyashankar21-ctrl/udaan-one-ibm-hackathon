import { useRef, useState } from 'react';
import { DOC_KINDS, PROFILE_FIELD_MAP, type DocKind } from '../../data/autofillSchema';
import { getSmartApplyStrings } from '../../data/smartApplyStrings';
import { autofillApi, type DraftView, type SessionState, type UploadFile } from '../../services/autofillApi';
import { spokenIn } from '../../services/translate';
import type { LanguageCode } from '../../types';
import { VOICE_COMMANDS, findField, prepareFile, preparePassportPhoto, spokenIndex } from './media';
import { CONTINUE_APPLICATION } from './useIvrApplication';

/**
 * Fills a whole application inside a conversation — the voice assistant or the WhatsApp bot —
 * one turn at a time: consent, questions, documents and the photo (sent as pictures or scanned),
 * values that disagree, a read-back with corrections, approval and the PDF. Everything the
 * desk says goes through `say` in the conversation's language; what the person says or types
 * goes to `handleText`, and pictures or files to `handleFiles`.
 */

export type DeskStage = 'idle' | 'consent' | 'question' | 'document' | 'photo' | 'conflict' | 'review' | 'field' | 'value' | 'download';

/** What the conversation should offer on screen: a way to send a document or the photo. */
export type DeskWants = { kind: 'document'; doc: string; docKind?: DocKind } | { kind: 'photo' } | null;

interface Options {
  language: LanguageCode;
  /** Show, and on voice channels speak, a message from the desk. Resolves when done. */
  say: (text: string) => Promise<void>;
  setBusy?: (busy: boolean) => void;
  onSession?: (s: SessionState) => void;
  /** Where the application started, recorded on the draft. */
  channel: 'voice' | 'chat';
  /** Voice channels: open the camera when the person says "scan" or "photo". */
  onScanRequest?: (wants: Exclude<DeskWants, null>) => void;
}

const P = {
  consent: (points: string[]) => `Before I take your details: ${points.join(' ')} Say I agree to continue, or say no.`,
  noConsent: 'All right, nothing has been saved.',
  started: (name: string) => `I have started your ${name} application. I will ask one thing at a time. You can say skip, repeat or stop at any time.`,
  resumed: (name: string, n: number) => `Continuing your ${name} application. It is ${n} percent filled.`,
  yesNo: 'Say yes or no.',
  options: (opts: string[]) => `You can say: ${opts.slice(0, 5).map((o) => o.replace(/\s*\(.*\)/, '')).join(', ')}.`,
  saved: 'Saved.',
  doc: (doc: string, labels: string, voice: boolean) =>
    `I can fill ${labels} from your ${doc}. ${voice ? 'Say scan to show it to the camera, or send a picture of it.' : 'Send a photo or PDF of it with the attach button.'} Or say answer to tell me yourself.`,
  proof: (label: string, example: string, voice: boolean) =>
    `Your application also needs ${label.toLowerCase()}, for example your ${example}. ${voice ? 'Say scan to show it to the camera, or send a picture of it.' : 'Send a photo or PDF of it with the attach button.'} Or say skip to add it later.`,
  reading: (doc: string) => `Reading your ${doc}…`,
  filled: (n: number, doc: string) => (n ? `Done. ${n} details filled from your ${doc}.` : `I could not read any details from your ${doc}. Please send a clearer picture, or say answer.`),
  photo: (voice: boolean) =>
    `Last, your passport-size photo for the form. ${voice ? 'Say photo to open the front camera, or send a picture.' : 'Send a clear photo of your face against a plain wall with the attach button.'} Or say skip to add it later.`,
  photoOk: 'Your photo is added.',
  photoBad: (why: string) => `This photo cannot be used: ${why}. Please send another one, or say skip.`,
  conflict: (label: string, values: string[]) =>
    `Your documents show two different values for ${label.toLowerCase()}: ${values.map((v, i) => `${i + 1}: ${v}`).join(', ')}. Say the number of the right one, or say the correct ${label.toLowerCase()}.`,
  review: (n: number, check: string[]) =>
    `All ${n} details are filled.${check.length ? ` Please check these carefully: ${check.join(', ')}.` : ''} Say read to hear every detail, say change to correct one, or say approve if they are all correct.`,
  afterRead: 'Say approve if everything is correct, or say change to correct a detail.',
  whichField: 'Which detail do you want to change? Say its name, for example mobile number.',
  noField: 'I could not find that detail. Please say its name again, or say stop.',
  newValue: (label: string) => `Say the new ${label.toLowerCase()}.`,
  changed: (label: string) => `${label} is changed.`,
  notReady: (needs: string[]) => `Before it can be approved, the application still needs: ${needs.join(', ')}.`,
  approved: 'Approved. Say download to get your filled application as a PDF.',
  downloaded: (where: string) => `Your application PDF is downloaded. Nothing has been submitted. Take it with your original documents to ${where}.`,
  paused: 'Your application is saved. Say continue my application whenever you are ready.',
  error: 'Sorry, the application service did not respond. Please try again.',
  notUnderstood: 'Sorry, I did not understand. ',
};

const isYesNo = (o?: string[]) => o?.length === 2 && /^yes$/i.test(o[0]) && /^no$/i.test(o[1]);
const shortName = (label: string) => label.split(/\s*[/(]/)[0].trim();
const kindOf = (label: string) => (Object.keys(DOC_KINDS) as DocKind[]).find((k) => DOC_KINDS[k].label === label);

export function useApplicationDesk({ language, say: show, setBusy, onSession, channel, onScanRequest }: Options) {
  const [stage, setStageState] = useState<DeskStage>('idle');
  const [wants, setWants] = useState<DeskWants>(null);
  const [draft, setDraft] = useState<DraftView | null>(null);
  const stageRef = useRef<DeskStage>('idle');
  const draftRef = useRef<DraftView | null>(null);
  const lastDraftId = useRef<string | null>(null);
  const pendingScheme = useRef<string | null>(null);
  const skipped = useRef(new Set<string>());
  /** Fields the person chose to say rather than show a document for. */
  const sayInstead = useRef(new Set<string>());
  const skippedProofs = useRef(new Set<string>());
  const skippedPhoto = useRef(false);
  const current = useRef<{ key?: string; label?: string; conflictId?: string; candidates?: number; docKind?: DocKind; doc?: string; prompt?: string }>({});
  const voice = channel === 'voice';

  const setStage = (s: DeskStage) => {
    stageRef.current = s;
    setStageState(s);
    if (s !== 'document' && s !== 'photo') setWants(null);
  };
  const say = async (...parts: string[]) => show(await spokenIn(language, ...parts));
  const busy = (b: boolean) => setBusy?.(b);
  const labelOf = (f: { label: string; labelHi?: string }) => (language === 'hi' && f.labelHi ? f.labelHi : f.label);
  const keep = (d: DraftView) => {
    draftRef.current = d;
    lastDraftId.current = d.id;
    setDraft(d);
    return d;
  };
  const refresh = async () => keep((await autofillApi.getDraft(draftRef.current!.id)).draft);

  /** Decide and say the next step. `prefix` is said first (for example "Saved."). */
  const next = async (prefix = '') => {
    let d: DraftView;
    try {
      d = await refresh();
    } catch {
      setStage('idle');
      return say(P.error);
    }

    const conflict = d.conflicts[0];
    if (conflict) {
      const label = labelOf({ label: PROFILE_FIELD_MAP[conflict.key]?.label || conflict.key, labelHi: PROFILE_FIELD_MAP[conflict.key]?.labelHi });
      current.current = { conflictId: conflict.id, candidates: conflict.candidates.length, prompt: P.conflict(label, conflict.candidates.map((c) => c.value)) };
      setStage('conflict');
      return say(prefix, current.current.prompt!);
    }

    // Questions only the person can answer, then those they chose to say instead of a document
    const q = d.missing.find((f) => !skipped.current.has(f.key) && (!f.fillableBy?.length || sayInstead.current.has(f.key)));
    if (q) {
      const text = q.key === 'aadhaar' ? 'Please say the last 4 digits of your Aadhaar number.' : (language === 'hi' && (q as any).questionHi) || (q as any).question || q.label;
      const hint = isYesNo(q.options) ? P.yesNo : q.options?.length ? P.options(q.options) : '';
      current.current = { key: q.key, label: q.label, prompt: [text, hint].filter(Boolean).join(' ') };
      setStage('question');
      return say(prefix, text, hint);
    }

    // A document would fill what is left
    const fromDoc = d.missing.filter((f) => f.fillableBy?.length && !skipped.current.has(f.key) && !sayInstead.current.has(f.key));
    if (fromDoc.length) {
      const docLabel = fromDoc[0].fillableBy![0];
      const doc = shortName(docLabel);
      const labels = fromDoc.filter((f) => f.fillableBy!.includes(docLabel)).map((f) => labelOf(f).toLowerCase());
      current.current = { docKind: kindOf(docLabel), doc, prompt: P.doc(doc, labels.slice(0, 4).join(', '), voice) };
      setStage('document');
      setWants({ kind: 'document', doc, docKind: kindOf(docLabel) });
      return say(prefix, current.current.prompt!);
    }

    const proof = d.documents.find((x) => x.required && !x.have && !x.manual && x.id !== 'photo' && !skippedProofs.current.has(x.id));
    if (proof) {
      const example = shortName(proof.accepted[0] || proof.label);
      current.current = { key: proof.id, docKind: proof.kind as DocKind, doc: example, prompt: P.proof(labelOf(proof), example, voice) };
      setStage('document');
      setWants({ kind: 'document', doc: example, docKind: proof.kind as DocKind });
      return say(prefix, current.current.prompt!);
    }

    const photoNeeded = d.documents.some((x) => x.id === 'photo' && !x.have);
    if (photoNeeded && !skippedPhoto.current) {
      current.current = { prompt: P.photo(voice) };
      setStage('photo');
      setWants({ kind: 'photo' });
      return say(prefix, current.current.prompt!);
    }

    if (d.missing.length) {
      // Only skipped questions are left: offer them once more
      skipped.current.clear();
      sayInstead.current = new Set(d.missing.map((f) => f.key));
      return next(prefix);
    }

    const filled = d.fields.filter((f) => f.value).length;
    current.current = { prompt: P.review(filled, d.needsReview.map((f) => labelOf(f).toLowerCase())) };
    setStage('review');
    return say(prefix, current.current.prompt!);
  };

  const open = async (d: DraftView, intro: string) => {
    keep(d);
    skipped.current.clear();
    sayInstead.current.clear();
    skippedProofs.current.clear();
    skippedPhoto.current = false;
    await next(intro);
  };

  const create = async (schemeId: string) => {
    busy(true);
    try {
      const res = await autofillApi.startDraft(schemeId, channel);
      onSession?.(res);
      busy(false);
      await open(res.draft, P.started(res.draft.scheme?.name?.split(' (')[0] || ''));
    } catch {
      busy(false);
      setStage('idle');
      await say(P.error);
    }
  };

  /** Start a new application in the conversation (consent is asked first if needed). */
  const startNew = async (schemeId: string) => {
    busy(true);
    try {
      const s = await autofillApi.session();
      busy(false);
      if (!s.consent) {
        pendingScheme.current = schemeId;
        setStage('consent');
        const points = getSmartApplyStrings('en').consentPoints.map((x) => x.replace('{days}', String(s.retentionDays)));
        return say(P.consent(points));
      }
      await create(schemeId);
    } catch {
      busy(false);
      await say(P.error);
    }
  };

  /** Continue a saved application in the conversation. */
  const resume = async (draftId: string) => {
    busy(true);
    try {
      const d = (await autofillApi.getDraft(draftId)).draft;
      busy(false);
      await open(d, P.resumed(d.scheme?.name?.split(' (')[0] || '', d.completion));
    } catch {
      busy(false);
      await say(P.error);
    }
  };

  const pause = async () => {
    setStage('idle');
    await say(P.paused);
  };

  const download = async () => {
    const d = draftRef.current!;
    busy(true);
    try {
      await autofillApi.downloadPdf(d.id, { use: d.officialForm ? 'official' : 'draft' });
      busy(false);
      setStage('idle');
      await refresh().catch(() => d);
      await say(P.downloaded(d.scheme?.submission?.where || 'the office or portal'));
    } catch (err: any) {
      busy(false);
      await say(err?.message || P.error);
    }
  };

  /** What the person said or typed. Returns false when it is not for the application desk. */
  const handleText = async (raw: string): Promise<boolean> => {
    const text = raw.trim();
    const stg = stageRef.current;
    const short = text.split(/\s+/).length <= 3;

    if (stg === 'idle') {
      // "Continue my application" picks up the last one
      if (lastDraftId.current && CONTINUE_APPLICATION.test(text) && /continue|resume|finish|complete|जारी|पूरा/i.test(text)) {
        await resume(lastDraftId.current);
        return true;
      }
      return false;
    }

    if (stg === 'consent') {
      if ((VOICE_COMMANDS.agree.test(text) || VOICE_COMMANDS.yes.test(text)) && !VOICE_COMMANDS.no.test(text)) {
        busy(true);
        try {
          const s = await autofillApi.session();
          onSession?.(await autofillApi.consent(s.consentVersion));
        } finally {
          busy(false);
        }
        const id = pendingScheme.current;
        pendingScheme.current = null;
        if (id) await create(id);
      } else {
        pendingScheme.current = null;
        setStage('idle');
        await say(P.noConsent);
      }
      return true;
    }

    if (short && VOICE_COMMANDS.stop.test(text)) {
      await pause();
      return true;
    }
    if (short && VOICE_COMMANDS.repeat.test(text)) {
      await say(current.current.prompt || '');
      return true;
    }

    switch (stg) {
      case 'question': {
        const key = current.current.key!;
        if (short && VOICE_COMMANDS.skip.test(text)) {
          skipped.current.add(key);
          await next();
          return true;
        }
        busy(true);
        try {
          const res = await autofillApi.answer(draftRef.current!.id, key, text, channel === 'voice' ? 'voice' : 'chat');
          keep(res.draft);
          busy(false);
          if (!res.result.ok || res.result.error) await say(res.result.error || P.notUnderstood, current.current.prompt || '');
          else await next(P.saved);
        } catch (err: any) {
          busy(false);
          await say(err?.message || P.error);
        }
        return true;
      }
      case 'document': {
        if (VOICE_COMMANDS.answer.test(text)) {
          // Say these details instead of showing the document
          for (const f of draftRef.current!.missing) if (f.fillableBy?.some((l) => shortName(l) === current.current.doc)) sayInstead.current.add(f.key);
          await next();
        } else if (VOICE_COMMANDS.skip.test(text) || VOICE_COMMANDS.no.test(text)) {
          if (current.current.key) skippedProofs.current.add(current.current.key);
          else for (const f of draftRef.current!.missing) if (f.fillableBy?.some((l) => shortName(l) === current.current.doc)) sayInstead.current.add(f.key);
          await next();
        } else if (onScanRequest && (VOICE_COMMANDS.scan.test(text) || VOICE_COMMANDS.capture.test(text))) {
          onScanRequest({ kind: 'document', doc: current.current.doc!, docKind: current.current.docKind });
        } else await say(P.notUnderstood, current.current.prompt || '');
        return true;
      }
      case 'photo': {
        if (VOICE_COMMANDS.skip.test(text) || VOICE_COMMANDS.no.test(text)) {
          skippedPhoto.current = true;
          await next();
        } else if (onScanRequest && (VOICE_COMMANDS.photo.test(text) || VOICE_COMMANDS.scan.test(text) || VOICE_COMMANDS.capture.test(text))) {
          onScanRequest({ kind: 'photo' });
        } else await say(P.notUnderstood, current.current.prompt || '');
        return true;
      }
      case 'conflict': {
        const index = spokenIndex(text, current.current.candidates || 2);
        busy(true);
        try {
          onSession?.(await autofillApi.resolveConflict(current.current.conflictId!, index >= 0 ? { index } : { value: text }));
          busy(false);
          await next(P.saved);
        } catch (err: any) {
          busy(false);
          await say(err?.message || P.error);
        }
        return true;
      }
      case 'review': {
        const d = draftRef.current!;
        if (VOICE_COMMANDS.change.test(text)) {
          current.current = { prompt: P.whichField };
          setStage('field');
          await say(P.whichField);
        } else if (VOICE_COMMANDS.read.test(text)) {
          const filled = d.fields.filter((f) => f.value);
          const labels = (await spokenIn(language, filled.map((f) => f.label).join(' | '))).split(/\s*\|\s*/);
          await show(filled.map((f, i) => `${labels.length === filled.length ? labels[i] : f.label}: ${f.value}`).join('. ') + '.');
          current.current = { prompt: P.afterRead };
          await say(P.afterRead);
        } else if ((VOICE_COMMANDS.approve.test(text) || VOICE_COMMANDS.yes.test(text)) && !VOICE_COMMANDS.no.test(text)) {
          busy(true);
          try {
            const latest = await autofillApi.getDraft(d.id);
            keep(latest.draft);
            if (!latest.draft.readyForApproval) {
              busy(false);
              const needs = [
                ...latest.draft.documents.filter((x) => x.required && !x.have && !x.manual).map((x) => labelOf(x).toLowerCase()),
                ...latest.draft.missing.map((f) => labelOf(f).toLowerCase()),
              ];
              // Offer the missing pieces again
              skippedProofs.current.clear();
              skippedPhoto.current = false;
              skipped.current.clear();
              await say(P.notReady(needs));
              await next();
              return true;
            }
            const res = await autofillApi.approve(d.id, latest.fieldsHash);
            keep(res.draft);
            busy(false);
            current.current = { prompt: P.approved };
            setStage('download');
            await say(P.approved);
          } catch (err: any) {
            busy(false);
            await say(err?.message || P.error);
          }
        } else await say(P.notUnderstood, current.current.prompt || '');
        return true;
      }
      case 'field': {
        const d = draftRef.current!;
        const labels = (await spokenIn(language, d.fields.map((f) => f.label).join(' | '))).split(/\s*\|\s*/);
        const field = findField(text, d.fields, labels);
        if (!field) {
          await say(P.noField);
          return true;
        }
        current.current = { key: field.key, label: labelOf(field), prompt: P.newValue(labelOf(field)) };
        setStage('value');
        await say(P.newValue(labelOf(field)));
        return true;
      }
      case 'value': {
        const { key, label } = current.current;
        busy(true);
        try {
          const res = await autofillApi.editFields(draftRef.current!.id, { [key!]: text });
          onSession?.(res);
          keep(res.draft);
          busy(false);
          const error = res.errors?.[key!];
          if (error) await say(error, current.current.prompt || '');
          else await next(P.changed(label || ''));
        } catch (err: any) {
          busy(false);
          await say(err?.message || P.error);
        }
        return true;
      }
      case 'download': {
        if (VOICE_COMMANDS.download.test(text) || VOICE_COMMANDS.yes.test(text)) await download();
        else await pause();
        return true;
      }
    }
    return false;
  };

  /** Pictures or files sent in the conversation (or captured by the camera). */
  const handleFiles = async (input: Array<File | UploadFile>): Promise<boolean> => {
    const stg = stageRef.current;
    if (stg !== 'document' && stg !== 'photo') return false;
    busy(true);
    try {
      if (stg === 'photo') {
        const first = input[0];
        const file = first instanceof File ? await preparePassportPhoto(first) : first;
        const s = await autofillApi.uploadPhoto(file);
        onSession?.(s);
        busy(false);
        const failed = s.photo?.checks.find((c) => c.status === 'fail');
        if (failed) await say(P.photoBad(failed.label.toLowerCase()));
        else await next(P.photoOk);
        return true;
      }
      const doc = current.current.doc || 'document';
      await say(P.reading(doc));
      const files = await Promise.all(input.map((f) => (f instanceof File ? prepareFile(f) : Promise.resolve(f))));
      const res = await autofillApi.uploadDocument(files, current.current.docKind);
      onSession?.(res);
      busy(false);
      const filled = res.document.fields.filter((f) => f.merged).length;
      await next(P.filled(filled, doc));
    } catch (err: any) {
      busy(false);
      await say(err?.message || P.error);
    }
    return true;
  };

  return { stage, active: stage !== 'idle', wants, draft, startNew, resume, handleText, handleFiles, pause };
}
