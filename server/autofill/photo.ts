/**
 * Applicant photo: checks that a passport-size photo shows one person's face clearly, the way
 * offices expect (front-facing, eyes visible, plain background), before it is printed on forms.
 * The image itself is never changed here — the browser crops it to 35 × 45 mm before upload.
 */
import { Type } from '@google/genai';
import { PDFDocument } from 'pdf-lib';
import type { CheckedFile } from './ingest';
import { IngestError } from './ingest';
import type { Generate } from './ocr';
import type { ApplicantPhoto, DocCheck } from './types';

export const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
/** Below this the printed photo looks blurred (about 150 dpi at 35 mm wide). */
const MIN_WIDTH = 200;

const SCHEMA = {
  type: Type.OBJECT,
  properties: {
    peopleCount: { type: Type.INTEGER },
    faceVisible: { type: Type.BOOLEAN },
    facingCamera: { type: Type.BOOLEAN },
    eyesVisible: { type: Type.BOOLEAN },
    darkGlassesOrFaceCovered: { type: Type.BOOLEAN },
    plainBackground: { type: Type.BOOLEAN },
    blurryOrDark: { type: Type.BOOLEAN },
    faceHeightShare: { type: Type.NUMBER },
    photoOfDocumentOrScreen: { type: Type.BOOLEAN },
    realPhotograph: { type: Type.BOOLEAN },
    notes: { type: Type.STRING },
  },
  required: ['peopleCount', 'faceVisible', 'facingCamera', 'eyesVisible', 'darkGlassesOrFaceCovered', 'plainBackground', 'blurryOrDark', 'faceHeightShare', 'photoOfDocumentOrScreen', 'realPhotograph'],
};

const PROMPT = `This image is meant to be a passport-size photo of a person applying for a government document or scheme in India. Look at it and answer:
- peopleCount: how many people's faces are in the image.
- faceVisible: whether one face is fully visible (not cut off).
- facingCamera: whether the person looks straight at the camera with the head upright.
- eyesVisible: whether both eyes are open and visible.
- darkGlassesOrFaceCovered: dark/tinted glasses, a mask, or anything covering the face (a religious head covering that leaves the face visible is fine).
- plainBackground: a plain, light, single-colour background.
- blurryOrDark: the face is blurred, too dark or overexposed.
- faceHeightShare: the head (chin to top of hair) height as a share of the image height, 0-1.
- photoOfDocumentOrScreen: it is a photo of an ID card, a printed photo, or a screen rather than a photo of the person.
- realPhotograph: true only if this is a camera photograph of a real, living human. False for a drawing, sketch, painting, cartoon, anime, emoji, avatar, 3D render, AI-generated or heavily filtered face, doll, mask, statue or mannequin.
Give short notes on anything that would make an office reject it.`;

export async function checkPhoto(generate: Generate, file: CheckedFile): Promise<Omit<ApplicantPhoto, 'uploadedAt'>> {
  if (file.mime !== 'image/jpeg' && file.mime !== 'image/png') throw new IngestError('The photo must be a JPG or PNG image.');
  if (file.buffer.length > MAX_PHOTO_BYTES) throw new IngestError('The photo must be under 3 MB.');

  // Decoding it the way the PDF will proves the image is usable and gives its size
  let width = 0;
  let height = 0;
  try {
    const pdf = await PDFDocument.create();
    const img = file.mime === 'image/png' ? await pdf.embedPng(file.buffer) : await pdf.embedJpg(file.buffer);
    ({ width, height } = img);
  } catch {
    throw new IngestError('This image could not be opened. Please take the photo again.');
  }

  const checks: DocCheck[] = [];
  if (width < MIN_WIDTH) {
    checks.push({ id: 'resolution', status: 'fail', label: 'Photo is too small', detail: `It is ${width} × ${height} pixels and would print blurred. Use a photo of at least ${MIN_WIDTH} pixels across.` });
  }
  const ratio = width / height;
  if (ratio < 0.7 || ratio > 0.85) {
    checks.push({ id: 'shape', status: 'warn', label: 'Not passport-size in shape', detail: 'Passport-size photos are 35 × 45 mm (portrait). It will be fitted into that box.' });
  }

  try {
    const res = await generate(
      {
        contents: [{ role: 'user', parts: [{ inlineData: { mimeType: file.mime, data: file.buffer.toString('base64') } }, { text: PROMPT }] }],
        config: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0, thinkingConfig: { thinkingBudget: 0 } },
      },
      undefined,
      { retryBusy: true, timeoutMs: 30000 }
    );
    const r = JSON.parse(res.text || '{}');
    if (r.realPhotograph === false) {
      checks.push({ id: 'face', status: 'fail', label: 'This is not a real photograph', detail: 'It looks like a drawing, cartoon, avatar or computer-made image. Take a real camera photo of your face.' });
    } else if (r.photoOfDocumentOrScreen) {
      checks.push({ id: 'face', status: 'fail', label: 'This is a photo of a card, print or screen', detail: 'Take a fresh photo of yourself instead — offices reject copies of other photos.' });
    } else if (!r.peopleCount || !r.faceVisible) {
      checks.push({ id: 'face', status: 'fail', label: 'No clear face found', detail: 'The photo must show your whole face, from the top of the head to the chin.' });
    } else if (r.peopleCount > 1) {
      checks.push({ id: 'face', status: 'fail', label: 'More than one person in the photo', detail: 'Only the applicant should be in the photo.' });
    } else {
      checks.push({ id: 'face', status: 'pass', label: 'One face, fully visible' });
      if (!r.facingCamera) checks.push({ id: 'pose', status: 'warn', label: 'Not looking straight at the camera', detail: 'Face the camera with your head straight.' });
      if (!r.eyesVisible || r.darkGlassesOrFaceCovered) {
        checks.push({ id: 'eyes', status: 'warn', label: 'Eyes or face partly hidden', detail: 'Eyes must be open and visible — no dark glasses, mask or hair over the face.' });
      }
      const share = Number(r.faceHeightShare);
      if (share && share < 0.45) checks.push({ id: 'size', status: 'warn', label: 'Face is too small in the photo', detail: 'Move closer: the face should fill most of the photo.' });
      else if (share > 0.9) checks.push({ id: 'size', status: 'warn', label: 'Face is cut too close', detail: 'Leave a little space above the head and below the chin.' });
    }
    if (!r.plainBackground) checks.push({ id: 'background', status: 'warn', label: 'Background is not plain', detail: 'Stand in front of a plain white or light-coloured wall.' });
    if (r.blurryOrDark) checks.push({ id: 'light', status: 'warn', label: 'Blurred, too dark or too bright', detail: 'Take it again in even daylight, holding the camera steady.' });
    if (!checks.some((c) => c.status !== 'pass')) checks.push({ id: 'rules', status: 'pass', label: 'Looks right for a passport-size photo', detail: 'Plain background, face straight and clear.' });
  } catch {
    checks.push({ id: 'face', status: 'warn', label: 'Could not check the photo automatically', detail: 'Make sure it is a recent, front-facing photo on a plain light background.' });
  }

  return { mime: file.mime, dataB64: file.buffer.toString('base64'), width, height, checks };
}
