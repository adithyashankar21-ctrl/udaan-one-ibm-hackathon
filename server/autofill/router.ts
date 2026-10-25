/**
 * Smart Apply & Autofill API (/api/autofill/*).
 *
 * Security model
 *  - Session: random 256-bit token in an HttpOnly, SameSite=Strict cookie scoped to /api.
 *  - Every state-changing request must carry the X-Udaan-Client header (blocks cross-site
 *    form posts; no CORS is enabled, so other origins cannot add it).
 *  - Nothing personal is stored until the person gives consent; documents are processed
 *    in memory and discarded; Aadhaar is kept as the last 4 digits only. The applicant's
 *    photo is the one image kept (encrypted in the session) so it can be printed on forms.
 *  - The helpline can resume a draft only with its reference + PIN, gets a short-lived
 *    token for that one draft, and never sees field values.
 *  - Errors are logged without request bodies or document contents.
 */
import crypto from 'crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import { FORM_SCHEMA_MAP, PROFILE_FIELD_MAP, type DocKind, type FormFieldSpec, type ProfileKey } from '../../src/data/autofillSchema';
import { IngestError, checkFiles, checkPdfs } from './ingest';
import { checkDocument, isUsable } from './checks';
import { buildDraftView, fieldsHash } from './mapping';
import { extractDocument, type Generate } from './ocr';
import { understandAnswer } from './understand';
import { analyseOfficialForm, fillOfficialForm, generateDraftPdf } from './pdf';
import { checkPhoto } from './photo';
import { SOURCE_LABELS, forgetDocument, mergeCandidate, resolveConflict } from './profile';
import { detectIntent, listSchemes, recommend, schemeInfo } from './schemes';
import { authEnabled, bearerToken, verifyUser } from '../auth';
import { INTERNAL_KEY } from '../internal';
import { newCertificateId, savePublicCertificate, takePass, type Certificate } from '../learn/certificates';
import {
  RETENTION_DAYS,
  deleteSession,
  loadUserSession,
  removeUserSession,
  saveUserSession,
  hashPin,
  hashToken,
  loadSession,
  lookupReference,
  newReference,
  newSession,
  removeReference,
  saveReference,
  saveSession,
  sweepExpired,
  verifyPin,
} from './store';
import type { Candidate, DocumentRecord, Draft, FieldRecord, SessionData, SourceKind } from './types';
import { hasNonLatin, isValidAadhaar, normalise, scrubAadhaar } from './validate';

export const CONSENT_VERSION = '2026-10-17';
const COOKIE = 'udaan_sid';
const MAX_AGE_S = RETENTION_DAYS * 24 * 60 * 60;

/* ── helpers ──────────────────────────────────────────────────────────── */

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

/** Make the rest of this request use `token` as its session (or no session). */
function useSessionToken(req: Request, token: string | null) {
  const others = (req.headers.cookie || '')
    .split(';')
    .map((p) => p.trim())
    .filter((p) => p && !p.startsWith(`${COOKIE}=`));
  if (token) others.push(`${COOKIE}=${encodeURIComponent(token)}`);
  req.headers.cookie = others.join('; ');
}

/** Routes that hold no personal details, open without signing in. The phone helpline uses its reference and PIN. */
const PUBLIC_ROUTE = /^\/(schemes|intent)$|^\/helpline\/|^\/phone\//;

function setCookie(req: Request, res: Response, token: string, maxAge = MAX_AGE_S) {
  const secure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.setHeader(
    'Set-Cookie',
    `${COOKIE}=${encodeURIComponent(token)}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? '; Secure' : ''}`
  );
}

function logError(route: string, err: any) {
  const msg = scrubAadhaar(String(err?.message || err || 'unknown')).slice(0, 160);
  console.warn(`[autofill] ${route} failed: ${msg}`);
}

const channelSource = (channel?: string): SourceKind =>
  channel === 'voice' ? 'voice' : channel === 'chat' ? 'chat' : channel === 'helpline' ? 'helpline' : channel === 'typed' ? 'typed' : 'answer';

/** Rate limiter: at most `limit` hits per key per window. */
function limiter(limit: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return (key: string) => {
    const now = Date.now();
    const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
    list.push(now);
    hits.set(key, list);
    return list.length <= limit;
  };
}

/**
 * One read-modify-write at a time per session. Sessions are files that each request loads and
 * saves whole, so two overlapping requests (an answer and a background refresh) would
 * otherwise lose one of the updates.
 */
const locks = new Map<string, Promise<unknown>>();
function serial<T>(key: string, fn: () => Promise<T> | T): Promise<T> {
  const run = (locks.get(key) || Promise.resolve()).then(fn, fn);
  const tail = run.catch(() => {});
  locks.set(key, tail);
  tail.then(() => locks.get(key) === tail && locks.delete(key));
  return run;
}

interface Ctx {
  session: SessionData | null;
  token: string | null;
}

function ctx(req: Request): Ctx {
  const token = readCookie(req, COOKIE);
  return { token, session: token ? loadSession(hashToken(token)) : null };
}

function profileView(session: SessionData) {
  return {
    fields: Object.fromEntries(
      Object.entries(session.profile.fields).map(([k, f]) => [
        k,
        { value: f!.value, source: f!.source, sourceLabel: f!.sourceLabel, status: f!.status, confidence: f!.confidence, corroboratedBy: f!.corroboratedBy || [], checksumOk: f!.checksumOk },
      ])
    ),
    conflicts: session.profile.conflicts,
  };
}

/** A document with its automatic checks, computed fresh so expiry and cross-checks stay current. */
function documentView(session: SessionData, d: DocumentRecord) {
  const checks = checkDocument(d, session.profile);
  return { ...d, checks, usable: isUsable(checks) };
}

function draftSummary(session: SessionData, d: Draft) {
  const v = buildDraftView(session, d);
  const required = v.documents.filter((x) => x.required && !x.manual);
  return {
    id: d.id,
    schemeId: d.schemeId,
    schemeName: v.scheme?.name || d.schemeId,
    status: v.status,
    completion: v.completion,
    missingCount: v.missing.length,
    conflictCount: v.conflicts.length,
    reviewCount: v.needsReview.length,
    docsRequired: required.length,
    docsHave: required.filter((x) => x.have).length,
    missingDocs: required.filter((x) => !x.have).map((x) => x.label),
    reference: d.reference,
    updatedAt: d.updatedAt,
  };
}

function sessionPayload(session: SessionData | null) {
  if (!session) return { hasSession: false, consent: null, consentVersion: CONSENT_VERSION, retentionDays: RETENTION_DAYS };
  return {
    hasSession: true,
    consent: session.consent || null,
    consentVersion: CONSENT_VERSION,
    retentionDays: RETENTION_DAYS,
    profile: profileView(session),
    documents: session.documents.map((d) => documentView(session, d)),
    photo: session.photo
      ? { checks: session.photo.checks, usable: isUsable(session.photo.checks), width: session.photo.width, height: session.photo.height, uploadedAt: session.photo.uploadedAt }
      : null,
    drafts: session.drafts.map((d) => draftSummary(session, d)),
  };
}

/** Longest wait for Gemini to understand a spoken answer before falling back to the quick rules. */
const ANSWER_AI_MS = 7000;

/** Other recognitions of the same speech sent by the browser (or none). */
const alternativesOf = (v: unknown): string[] => (Array.isArray(v) ? v.filter((a): a is string => typeof a === 'string').map((a) => a.slice(0, 500)).slice(0, 5) : []);
const confidenceOf = (v: unknown) => (typeof v === 'number' && v > 0 && v <= 1 ? v : undefined);

/**
 * Understand and store one answer for a draft field. Spoken and chatted answers are understood
 * (the value is taken out of what was said); `status: 'confirmed'` means it was typed straight
 * into the form field, so it is only checked.
 */
async function storeAnswer(
  generate: Generate,
  session: SessionData,
  draft: Draft,
  spec: FormFieldSpec,
  text: string,
  source: SourceKind,
  status: FieldRecord['status'],
  heard: { alternatives?: string[]; confidence?: number } = {}
): Promise<{ ok: boolean; value?: string; error?: string; confirm?: boolean }> {
  const n = await understandAnswer(
    generate,
    { label: spec.label, type: spec.type, options: spec.options, question: (spec as any).question, help: (spec as any).help },
    { text, ...heard },
    { exact: status === 'confirmed', timeoutMs: ANSWER_AI_MS }
  ).catch((err) => {
    logError('understand-answer', err);
    return normalise(spec.type, text, spec.options);
  });
  if (!n.ok || !n.value) return { ok: false, error: n.error || 'Could not understand that answer' };
  const confirm = 'confirm' in n ? Boolean((n as any).confirm) : undefined;

  const sourceLabel = SOURCE_LABELS[source] || 'Your answer';
  if (spec.profileKey) {
    const cand: Candidate = { value: n.value, source, sourceLabel, status, checksumOk: n.checksumOk };
    const r = mergeCandidate(session.profile, spec.profileKey, cand);
    if (r.conflict) return { ok: true, value: n.value, error: 'This differs from what we already have — please choose the right value.' };
  } else {
    draft.answers[spec.key] = { value: n.value, source, sourceLabel, status, updatedAt: Date.now() };
  }
  return { ok: true, value: n.value, confirm };
}

/* ── router ───────────────────────────────────────────────────────────── */

export function createAutofillRouter(generate: Generate) {
  const router = express.Router();
  const docLimit = limiter(30, 60 * 60 * 1000);
  const aiLimit = limiter(120, 60 * 60 * 1000);
  const pinIpLimit = limiter(20, 60 * 60 * 1000);
  const pinFailures = new Map<string, { count: number; until: number }>();
  const helplineTokens = new Map<string, { sessionHash: string; draftId: string; expires: number }>();

  sweepExpired();
  setInterval(sweepExpired, 60 * 60 * 1000).unref();

  router.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'GET' && req.headers['x-udaan-client'] !== '1') {
      return res.status(403).json({ error: 'Missing client header' });
    }
    next();
  });

  // With sign-in switched on, every account has its own session, whatever browser it is used from
  router.use(async (req, res, next) => {
    if (!authEnabled() || PUBLIC_ROUTE.test(req.path)) return next();
    const user = await verifyUser(bearerToken(req.headers.authorization));
    if (!user) return res.status(401).json({ error: 'login_required' });
    (req as any).userId = user.id;
    let token = loadUserSession(user.id);
    if (!token || !loadSession(hashToken(token))) {
      token = null;
      // First sign-in: what was filled in this browser before signing in becomes the account's,
      // unless it already belongs to another account (a shared phone or kiosk)
      const cookieToken = readCookie(req, COOKIE);
      const browserSession = cookieToken ? loadSession(hashToken(cookieToken)) : null;
      if (browserSession && !browserSession.userId) {
        browserSession.userId = user.id;
        saveSession(browserSession);
        saveUserSession(user.id, cookieToken!);
        token = cookieToken;
      }
    }
    useSessionToken(req, token);
    next();
  });

  /**
   * Runs a handler with the caller's session, holding the session lock throughout. Slow
   * handlers (document reading) pass `locked: false` and save through `update` instead, so
   * answers are not held up while a document is being read.
   */
  const withSession =
    (handler: (req: Request, res: Response, session: SessionData) => any, locked = true) =>
    async (req: Request, res: Response) => {
      const token = readCookie(req, COOKIE);
      if (!token) return res.status(401).json({ error: 'consent_required' });
      const run = async () => {
        const session = loadSession(hashToken(token));
        if (!session || !session.consent) return res.status(401).json({ error: 'consent_required' });
        try {
          await handler(req, res, session);
        } catch (err) {
          logError(req.path, err);
          if (!res.headersSent) res.status(500).json({ error: 'Something went wrong. Please try again.' });
        }
      };
      return locked ? serial(hashToken(token), run) : run();
    };

  /** Apply a change to the latest saved copy of a session, under its lock, and save it. */
  const update = <T>(session: SessionData, change: (fresh: SessionData) => T): Promise<T> =>
    serial(session.hash, () => {
      const fresh = loadSession(session.hash) || session;
      const out = change(fresh);
      saveSession(fresh);
      return out;
    });

  const findDraft = (session: SessionData, id: string) => session.drafts.find((d) => d.id === id);

  /* Session & consent */

  router.get('/session', async (req, res) => {
    const token = readCookie(req, COOKIE);
    if (!token) return res.json(sessionPayload(null));
    await serial(hashToken(token), () => {
      const session = loadSession(hashToken(token));
      // Keep the session alive, but do not rewrite the file on every refresh
      if (session && Date.now() - session.lastSeen > 60_000) saveSession(session);
      res.json(sessionPayload(session));
    });
  });

  router.post('/consent', (req, res) => {
    if (req.body?.granted !== true || req.body?.version !== CONSENT_VERSION) return res.status(400).json({ error: 'Consent not given' });
    let { session, token } = ctx(req);
    if (!session) {
      const created = newSession();
      session = created.data;
      token = created.token;
    }
    session.consent = { version: CONSENT_VERSION, at: Date.now() };
    const userId = (req as any).userId as string | undefined;
    if (userId) {
      session.userId = userId;
      saveUserSession(userId, token!);
    }
    saveSession(session);
    setCookie(req, res, token!);
    res.json(sessionPayload(session));
  });

  router.delete('/session', (req, res) => {
    const { session } = ctx(req);
    if (session) deleteSession(session);
    if ((req as any).userId) removeUserSession((req as any).userId);
    setCookie(req, res, '', 0);
    res.json({ deleted: true });
  });

  /* Schemes (no personal data) */

  router.get('/schemes', (_req, res) => res.json({ schemes: listSchemes() }));

  router.post('/intent', async (req, res) => {
    if (!aiLimit(req.ip || 'ip')) return res.status(429).json({ error: 'Too many requests' });
    const text = String(req.body?.text || '').slice(0, 1000);
    const language = String(req.body?.language || 'English').replace(/[^A-Za-z ()-]/g, '').slice(0, 40) || 'English';
    const intent = await detectIntent(generate, text, language);
    res.json({ ...intent, scheme: intent.schemeId ? schemeInfo(intent.schemeId) : null, relatedSchemes: (intent.related as string[]).map((id: string) => schemeInfo(id)).filter(Boolean) });
  });

  router.get('/recommend', (req, res) => {
    const { session } = ctx(req);
    const profile = session?.consent ? session.profile : { fields: {}, conflicts: [] };
    res.json({ recommendations: recommend(profile), note: 'Preliminary estimate from your profile — not an official eligibility decision.' });
  });

  /* Profile */

  router.post(
    '/profile',
    withSession(async (req, res, session) => {
      const updates = req.body?.updates || {};
      const source = channelSource(req.body?.source);
      const status: FieldRecord['status'] = req.body?.confirm ? 'confirmed' : 'self_declared';
      const errors: Record<string, string> = {};
      // Spoken or chatted profile answers are understood like form answers; typed ones are only checked
      const spoken = source === 'voice' || source === 'chat' || source === 'helpline';
      for (const [key, raw] of Object.entries(updates)) {
        const def = PROFILE_FIELD_MAP[key as ProfileKey];
        if (!def || typeof raw !== 'string' || !raw.trim()) continue;
        const n = spoken
          ? await understandAnswer(generate, def, { text: raw.slice(0, 500), alternatives: alternativesOf(req.body?.alternatives?.[key]), confidence: confidenceOf(req.body?.confidence?.[key]) }, { timeoutMs: ANSWER_AI_MS })
          : normalise(def.type, raw, def.options);
        if (!n.ok || !n.value) {
          errors[key] = n.error || 'Invalid value';
          continue;
        }
        mergeCandidate(session.profile, def.key, { value: n.value, source, sourceLabel: SOURCE_LABELS[source], status, checksumOk: n.checksumOk });
      }
      saveSession(session);
      res.json({ ...sessionPayload(session), errors });
    })
  );

  router.post(
    '/profile/resolve',
    withSession((req, res, session) => {
      const ok = resolveConflict(session.profile, String(req.body?.conflictId || ''), { index: req.body?.index, value: req.body?.value });
      if (!ok) return res.status(400).json({ error: 'Could not resolve that' });
      saveSession(session);
      res.json(sessionPayload(session));
    })
  );

  /* Documents */

  router.post(
    '/documents',
    withSession(async (req, res, session) => {
      if (!docLimit(session.hash)) return res.status(429).json({ error: 'Too many uploads in the last hour. Please wait a little.' });
      let files;
      try {
        files = checkFiles(req.body?.files);
        await checkPdfs(files);
      } catch (err) {
        if (err instanceof IngestError) return res.status(400).json({ error: err.message });
        throw err;
      }
      const hint = req.body?.hint as DocKind | undefined;
      let extracted;
      try {
        extracted = await extractDocument(generate, files, hint);
      } catch (err) {
        logError('documents/extract', err);
        // Gemini rejects files it cannot open with a 400; only quota / outage errors mean "busy"
        if (/INVALID_ARGUMENT|"code":\s*400/.test(String((err as any)?.message || err))) {
          return res.status(400).json({ error: 'This file could not be opened by the document reader. Please upload a photo or screenshot of the document instead.' });
        }
        return res.status(502).json({ error: 'The document reader is busy or unavailable right now. Please try again in a minute, or type the details instead.' });
      } finally {
        // Drop the original bytes as soon as extraction is done
        for (const f of files) f.buffer.fill(0);
      }
      const doc = { ...extracted, id: crypto.randomBytes(8).toString('hex'), uploadedAt: Date.now() };
      await update(session, (fresh) => {
        // Someone else's document (e.g. a parent's passport) or one that failed a check must not
        // overwrite the applicant's details; the person can still choose to use its values.
        const before = checkDocument(doc, fresh.profile);
        const holdBack = before.find((c) => (c.id === 'holder' && c.status !== 'pass') || (c.status === 'fail' && (c.id === 'number' || c.id === 'readable')));
        for (const f of doc.fields) {
          if (!f.value || !f.legible || f.confidence < 0.6) continue;
          if (holdBack) {
            f.note = f.note || (holdBack.id === 'holder' ? 'Not added to your application: this document has a different name.' : `Not added to your application: ${holdBack.label.toLowerCase()}.`);
            continue;
          }
          const r = mergeCandidate(fresh.profile, f.key, {
            value: f.value,
            source: 'document',
            sourceLabel: doc.label,
            status: 'extracted',
            docId: doc.id,
            confidence: f.confidence,
            checksumOk: f.checksumOk,
          });
          f.merged = r.changed;
        }
        fresh.documents.push(doc);
        res.json({ document: documentView(fresh, doc), ...sessionPayload(fresh) });
      });
    }, false)
  );

  /* Applicant photo — one per session, printed on every application */

  router.post(
    '/photo',
    withSession(async (req, res, session) => {
      if (!docLimit(session.hash)) return res.status(429).json({ error: 'Too many uploads in the last hour. Please wait a little.' });
      let photo;
      try {
        const [file] = checkFiles(req.body?.files);
        photo = await checkPhoto(generate, file);
      } catch (err) {
        if (err instanceof IngestError) return res.status(400).json({ error: err.message });
        throw err;
      }
      await update(session, (fresh) => {
        fresh.photo = { ...photo, uploadedAt: Date.now() };
        res.json(sessionPayload(fresh));
      });
    }, false)
  );

  router.get(
    '/photo',
    withSession((_req, res, session) => {
      if (!session.photo) return res.status(404).json({ error: 'No photo' });
      res.setHeader('Content-Type', session.photo.mime);
      res.send(Buffer.from(session.photo.dataB64, 'base64'));
    })
  );

  router.delete(
    '/photo',
    withSession((_req, res, session) => {
      session.photo = undefined;
      saveSession(session);
      res.json(sessionPayload(session));
    })
  );

  router.post(
    '/documents/:id/confirm',
    withSession((req, res, session) => {
      const doc = session.documents.find((d) => d.id === req.params.id);
      if (!doc) return res.status(404).json({ error: 'Document not found' });
      const values: Record<string, string> = req.body?.values || {};
      const errors: Record<string, string> = {};
      for (const [key, raw] of Object.entries(values)) {
        const def = PROFILE_FIELD_MAP[key as ProfileKey];
        if (!def || typeof raw !== 'string' || !raw.trim()) continue;
        const n = normalise(def.type, raw, def.options);
        if (!n.ok || !n.value) {
          errors[key] = n.error || 'Invalid value';
          continue;
        }
        const field = doc.fields.find((f) => f.key === key);
        mergeCandidate(session.profile, def.key, {
          value: n.value,
          source: 'document',
          sourceLabel: `${doc.label} (you checked)`,
          status: 'confirmed',
          docId: doc.id,
          checksumOk: n.checksumOk ?? field?.checksumOk,
        });
        if (field) {
          field.value = n.value;
          field.merged = true;
          field.legible = true;
        }
      }
      saveSession(session);
      res.json({ ...sessionPayload(session), errors });
    })
  );

  router.delete(
    '/documents/:id',
    withSession((req, res, session) => {
      session.documents = session.documents.filter((d) => d.id !== req.params.id);
      forgetDocument(session.profile, req.params.id);
      saveSession(session);
      res.json(sessionPayload(session));
    })
  );

  /* Drafts */

  router.post(
    '/drafts',
    withSession((req, res, session) => {
      const schemeId = String(req.body?.schemeId || '');
      if (!FORM_SCHEMA_MAP[schemeId]) return res.status(400).json({ error: 'Unsupported scheme' });
      const channel = String(req.body?.channel || 'web').slice(0, 20);
      let draft = session.drafts.find((d) => d.schemeId === schemeId && !d.generated);
      if (!draft) {
        draft = { id: crypto.randomBytes(8).toString('hex'), reference: newReference(), schemeId, createdAt: Date.now(), updatedAt: Date.now(), channels: [], answers: {} };
        session.drafts.push(draft);
      }
      draft.channels.push({ channel, at: Date.now() });
      draft.channels = draft.channels.slice(-20);
      saveSession(session);
      res.json({ draft: buildDraftView(session, draft), ...sessionPayload(session) });
    })
  );

  router.get(
    '/drafts/:id',
    withSession((req, res, session) => {
      const draft = findDraft(session, req.params.id);
      if (!draft) return res.status(404).json({ error: 'Draft not found' });
      res.json({ draft: buildDraftView(session, draft), fieldsHash: fieldsHash(buildDraftView(session, draft).fields) });
    })
  );

  router.delete(
    '/drafts/:id',
    withSession((req, res, session) => {
      const draft = findDraft(session, req.params.id);
      if (draft) removeReference(draft.reference);
      session.drafts = session.drafts.filter((d) => d.id !== req.params.id);
      saveSession(session);
      res.json(sessionPayload(session));
    })
  );

  router.post(
    '/drafts/:id/answer',
    withSession(async (req, res, session) => {
      const draft = findDraft(session, req.params.id);
      if (!draft) return res.status(404).json({ error: 'Draft not found' });
      const spec = FORM_SCHEMA_MAP[draft.schemeId].fields.find((f) => f.key === req.body?.key);
      if (!spec) return res.status(400).json({ error: 'Unknown field' });
      const result = await storeAnswer(generate, session, draft, spec, String(req.body?.text || '').slice(0, 500), channelSource(req.body?.channel), 'self_declared', {
        alternatives: alternativesOf(req.body?.alternatives),
        confidence: confidenceOf(req.body?.confidence),
      });
      draft.updatedAt = Date.now();
      saveSession(session);
      const view = buildDraftView(session, draft);
      res.json({ result, draft: view, fieldsHash: fieldsHash(view.fields) });
    })
  );

  router.post(
    '/drafts/:id/fields',
    withSession(async (req, res, session) => {
      const draft = findDraft(session, req.params.id);
      if (!draft) return res.status(404).json({ error: 'Draft not found' });
      const specs = FORM_SCHEMA_MAP[draft.schemeId].fields;
      const errors: Record<string, string> = {};
      for (const [key, raw] of Object.entries(req.body?.values || {})) {
        const spec = specs.find((f) => f.key === key);
        if (!spec || typeof raw !== 'string') continue;
        if (!raw.trim()) {
          if (spec.profileKey) delete session.profile.fields[spec.profileKey];
          else delete draft.answers[key];
          continue;
        }
        const r = await storeAnswer(generate, session, draft, spec, raw, 'typed', 'confirmed');
        if (!r.ok) errors[key] = r.error || 'Invalid value';
      }
      draft.updatedAt = Date.now();
      saveSession(session);
      const view = buildDraftView(session, draft);
      res.json({ errors, draft: view, fieldsHash: fieldsHash(view.fields), ...sessionPayload(session) });
    })
  );

  router.post(
    '/drafts/:id/approve',
    withSession((req, res, session) => {
      const draft = findDraft(session, req.params.id);
      if (!draft) return res.status(404).json({ error: 'Draft not found' });
      const view = buildDraftView(session, draft);
      if (!view.readyForApproval) return res.status(400).json({ error: 'Some required details are missing or need a decision first.' });
      const hash = fieldsHash(view.fields);
      if (req.body?.fieldsHash !== hash) return res.status(409).json({ error: 'The details changed since you reviewed them. Please review again.' });
      draft.approval = { at: Date.now(), fieldsHash: hash };
      draft.updatedAt = Date.now();
      saveSession(session);
      res.json({ draft: buildDraftView(session, draft), fieldsHash: hash });
    })
  );

  router.post(
    '/drafts/:id/official-form',
    withSession(async (req, res, session) => {
      const draft = findDraft(session, req.params.id);
      if (!draft) return res.status(404).json({ error: 'Draft not found' });
      if (!docLimit(session.hash)) return res.status(429).json({ error: 'Too many uploads in the last hour.' });
      let files;
      try {
        files = checkFiles(req.body?.files);
      } catch (err) {
        if (err instanceof IngestError) return res.status(400).json({ error: err.message });
        throw err;
      }
      const file = files[0];
      if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.mime)) return res.status(400).json({ error: 'Upload the official form as a PDF, JPG or PNG.' });
      const view = buildDraftView(session, draft);
      try {
        const analysed = await analyseOfficialForm(generate, file.buffer, file.mime, view.fields);
        await update(session, (fresh) => {
          const d = findDraft(fresh, draft.id);
          if (!d) return res.status(404).json({ error: 'Draft not found' });
          d.officialForm = { name: file.name, mime: file.mime, bytesB64: file.buffer.toString('base64'), uploadedAt: Date.now(), ...analysed };
          d.generated = undefined;
          d.updatedAt = Date.now();
          res.json({ draft: buildDraftView(fresh, d) });
        });
      } catch (err) {
        logError('official-form', err);
        if (!res.headersSent) res.status(502).json({ error: 'Could not read the layout of that form. You can still download the structured draft.' });
      }
    }, false)
  );

  router.delete(
    '/drafts/:id/official-form',
    withSession((req, res, session) => {
      const draft = findDraft(session, req.params.id);
      if (!draft) return res.status(404).json({ error: 'Draft not found' });
      draft.officialForm = undefined;
      saveSession(session);
      res.json({ draft: buildDraftView(session, draft) });
    })
  );

  router.post(
    '/drafts/:id/pdf',
    withSession(async (req, res, session) => {
      const draft = findDraft(session, req.params.id);
      if (!draft) return res.status(404).json({ error: 'Draft not found' });
      const view = buildDraftView(session, draft);
      if (!view.approved) return res.status(403).json({ error: 'Please review and approve the application first.' });

      // Full Aadhaar is accepted only for this one PDF, never stored or logged.
      let aadhaarFull: string | undefined;
      const rawAadhaar = String(req.body?.aadhaarFull || '').replace(/\D/g, '');
      if (rawAadhaar) {
        const stored = session.profile.fields.aadhaar?.value.replace(/\D/g, '').slice(-4);
        if (!isValidAadhaar(rawAadhaar)) return res.status(400).json({ error: 'That Aadhaar number is not valid. Please check it.' });
        if (stored && stored !== rawAadhaar.slice(-4)) return res.status(400).json({ error: 'That Aadhaar number does not match the one on your application.' });
        aadhaarFull = rawAadhaar;
      }

      const useOfficial = req.body?.use === 'official' && draft.officialForm;
      const photo = session.photo && isUsable(session.photo.checks) ? session.photo : undefined;
      const bytes = useOfficial
        ? await fillOfficialForm(draft.officialForm!, view, aadhaarFull, photo)
        : await generateDraftPdf(view, { aadhaarFull, approvedAt: draft.approval?.at, photo });
      aadhaarFull = undefined;

      draft.generated = { at: Date.now(), kind: useOfficial ? (draft.officialForm!.kind === 'acroform' ? 'official_acroform' : 'official_overlay') : 'draft_pdf' };
      saveSession(session);
      const name = `UDAAN_ONE_${draft.schemeId}_${draft.reference}${useOfficial ? '_official_form' : '_draft'}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
      res.send(Buffer.from(bytes));
    })
  );

  router.post(
    '/drafts/:id/pin',
    withSession((req, res, session) => {
      const draft = findDraft(session, req.params.id);
      if (!draft) return res.status(404).json({ error: 'Draft not found' });
      const pin = String(req.body?.pin || '');
      if (!/^\d{4,6}$/.test(pin) || /^(\d)\1+$/.test(pin) || '0123456789'.includes(pin)) {
        return res.status(400).json({ error: 'Choose a 4 to 6 digit PIN that is not all the same digit or a simple sequence.' });
      }
      draft.pinHash = hashPin(pin);
      saveReference(draft.reference, session.hash, draft.id);
      saveSession(session);
      res.json({ reference: draft.reference, hasPin: true });
    })
  );

  /* Helpline: resume with reference + PIN, scoped to one draft, no field values exposed */

  router.post('/helpline/resume', (req, res) => {
    const reference = String(req.body?.reference || '').trim().toUpperCase();
    const pin = String(req.body?.pin || '');
    if (!pinIpLimit(req.ip || 'ip')) return res.status(429).json({ error: 'Too many attempts. Please try again later.' });
    if (!/^UD-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/.test(reference)) return res.status(400).json({ error: 'That reference is not in the right form. It looks like UD-ABCD-2345.' });
    const fail = pinFailures.get(reference);
    if (fail && fail.until > Date.now()) return res.status(429).json({ error: 'Too many wrong PINs for this reference. Try again in 15 minutes.' });

    // On the device that owns the application, the session cookie already proves who it is
    const mine = ctx(req).session;
    const ownDraft = mine?.consent ? mine.drafts.find((d) => d.reference === reference) : undefined;
    const ref = ownDraft ? { sessionHash: mine!.hash, draftId: ownDraft.id } : lookupReference(reference);
    const session = ownDraft ? mine : ref ? loadSession(ref.sessionHash) : null;
    const draft = session?.drafts.find((d) => d.id === ref!.draftId);
    const ownDevice = Boolean(ownDraft);
    if (!draft || (!ownDevice && (!draft.pinHash || !verifyPin(pin, draft.pinHash)))) {
      // Asking without a PIN reveals nothing (same answer whether the reference exists), so it is not counted
      if (pin) {
        const f = pinFailures.get(reference) || { count: 0, until: 0 };
        f.count += 1;
        if (f.count >= 5) {
          f.until = Date.now() + 15 * 60 * 1000;
          f.count = 0;
        }
        pinFailures.set(reference, f);
      }
      return res.status(401).json({ error: pin ? 'Reference or PIN not recognised.' : 'pin_required' });
    }
    pinFailures.delete(reference);
    const token = crypto.randomBytes(24).toString('base64url');
    helplineTokens.set(token, { sessionHash: ref!.sessionHash, draftId: draft.id, expires: Date.now() + 30 * 60 * 1000 });
    draft.channels.push({ channel: 'helpline', at: Date.now() });
    saveSession(session!);
    res.json({ token });
  });

  const helplineCtx = (req: Request) => {
    const token = String(req.headers['x-helpline-token'] || '');
    const t = helplineTokens.get(token);
    if (!t || t.expires < Date.now()) return null;
    const session = loadSession(t.sessionHash);
    const draft = session?.drafts.find((d) => d.id === t.draftId);
    return session && draft ? { session, draft } : null;
  };

  const helplineView = (session: SessionData, draft: Draft) => {
    const v = buildDraftView(session, draft);
    return {
      reference: draft.reference,
      schemeName: v.scheme?.name,
      status: v.status,
      completion: v.completion,
      conflicts: v.conflicts.length,
      missing: v.missing.map((f) => ({ key: f.key, label: f.label, labelHi: f.labelHi, question: f.question, questionHi: f.questionHi, type: f.type, options: f.options })),
      nextSteps: v.nextSteps,
    };
  };

  router.get('/helpline/draft', (req, res) => {
    const c = helplineCtx(req);
    if (!c) return res.status(401).json({ error: 'Helpline session expired. Please enter your reference and PIN again.' });
    res.json(helplineView(c.session, c.draft));
  });

  router.post('/helpline/answer', async (req, res) => {
    const t = helplineTokens.get(String(req.headers['x-helpline-token'] || ''));
    if (!t) return res.status(401).json({ error: 'Helpline session expired.' });
    return serial(t.sessionHash, () => helplineAnswer(req, res));
  });

  /* Learning Hub certificates, kept with the learner's account */

  router.get(
    '/certificates',
    withSession((_req, res, session) => {
      res.json({ certificates: session.certificates || [] });
    })
  );

  router.post(
    '/certificates',
    withSession((req, res, session) => {
      const name = session.profile.fields.fullName?.value?.trim();
      if (!name) return res.status(400).json({ error: 'Add your full name to your profile first — it is printed on the certificate.' });
      const pass = takePass(String(req.body?.passToken || ''));
      if (!pass) return res.status(400).json({ error: 'Please pass the final assessment again to get the certificate.' });
      const existing = (session.certificates || []).find((c) => c.courseId === pass.courseId);
      // A better score replaces the earlier certificate for the same course
      if (existing && existing.score / existing.total >= pass.score / pass.total) return res.json({ certificate: existing });
      const cert: Certificate = {
        id: existing?.id || newCertificateId(),
        name,
        courseId: pass.courseId,
        courseTitle: pass.courseTitle,
        modules: pass.modules,
        duration: pass.duration,
        score: pass.score,
        total: pass.total,
        issuedAt: Date.now(),
      };
      session.certificates = [cert, ...(session.certificates || []).filter((c) => c.courseId !== cert.courseId)];
      saveSession(session);
      savePublicCertificate(cert);
      res.json({ certificate: cert });
    })
  );

  /*
   * Real phone calls (the Twilio helpline, server/voice): a caller's details are kept by their
   * phone number, after they agree by voice. Only this server can call these routes.
   */
  const internalOnly = (req: Request, res: Response) => {
    if (req.headers['x-internal-key'] !== INTERNAL_KEY) {
      res.status(403).json({ error: 'Forbidden' });
      return false;
    }
    return true;
  };

  router.post('/phone/start', (req, res) => {
    if (!internalOnly(req, res)) return;
    const caller = String(req.body?.caller || '').replace(/[^\d+]/g, '');
    const schemeId = String(req.body?.schemeId || '');
    if (!caller || !FORM_SCHEMA_MAP[schemeId]) return res.status(400).json({ error: 'Caller and scheme are needed' });
    const account = `phone:${caller}`;
    let token = loadUserSession(account);
    let session = token ? loadSession(hashToken(token)) : null;
    if (!session) {
      const created = newSession();
      session = created.data;
      token = created.token;
      saveUserSession(account, token);
    }
    session.consent = { version: CONSENT_VERSION, at: Date.now() };
    let draft = session.drafts.find((d) => d.schemeId === schemeId && !d.generated);
    if (!draft) {
      draft = { id: crypto.randomBytes(8).toString('hex'), reference: newReference(), schemeId, createdAt: Date.now(), updatedAt: Date.now(), channels: [], answers: {} };
      session.drafts.push(draft);
    }
    draft.channels.push({ channel: 'helpline', at: Date.now() });
    if (!session.profile.fields.mobile && /^\+91[6-9]\d{9}$/.test(caller)) {
      mergeCandidate(session.profile, 'mobile', { value: caller.slice(3), source: 'helpline', sourceLabel: SOURCE_LABELS.helpline, status: 'self_declared' });
    }
    saveSession(session);
    const helpline = crypto.randomBytes(24).toString('base64url');
    helplineTokens.set(helpline, { sessionHash: session.hash, draftId: draft.id, expires: Date.now() + 30 * 60 * 1000 });
    res.json({ token: helpline, ...helplineView(session, draft) });
  });

  /** Set the PIN for an application started on the phone, so it can be opened in the app later. */
  router.post('/phone/pin', (req, res) => {
    if (!internalOnly(req, res)) return;
    const c = helplineCtx(req);
    if (!c) return res.status(401).json({ error: 'Helpline session expired.' });
    const pin = String(req.body?.pin || '');
    if (!/^\d{4,6}$/.test(pin) || /^(\d)\1+$/.test(pin) || '0123456789'.includes(pin)) return res.status(400).json({ error: 'weak_pin' });
    c.draft.pinHash = hashPin(pin);
    saveReference(c.draft.reference, c.session.hash, c.draft.id);
    saveSession(c.session);
    res.json({ reference: c.draft.reference });
  });

  const helplineAnswer = async (req: Request, res: Response) => {
    const c = helplineCtx(req);
    if (!c) return res.status(401).json({ error: 'Helpline session expired.' });
    const spec = FORM_SCHEMA_MAP[c.draft.schemeId].fields.find((f) => f.key === req.body?.key);
    if (!spec) return res.status(400).json({ error: 'Unknown field' });
    try {
      const result = await storeAnswer(generate, c.session, c.draft, spec, String(req.body?.text || '').slice(0, 500), 'helpline', 'self_declared', {
        alternatives: alternativesOf(req.body?.alternatives),
        confidence: confidenceOf(req.body?.confidence),
      });
      c.draft.updatedAt = Date.now();
      saveSession(c.session);
      // Echo back only whether it was understood, not the stored value
      res.json({ ok: result.ok, error: result.error, ...helplineView(c.session, c.draft) });
    } catch (err) {
      logError('helpline/answer', err);
      res.status(500).json({ error: 'Something went wrong.' });
    }
  };

  return router;
}

/** JSON error for oversized uploads (registered after the routes). */
export function autofillErrorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  if (err?.type === 'entity.too.large' && req.path.startsWith('/api/autofill')) {
    return res.status(413).json({ error: 'That upload is too large. Send fewer pages at once, or smaller photos.' });
  }
  next(err);
}
