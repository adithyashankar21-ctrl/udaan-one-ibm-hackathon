/**
 * Document ingestion: checks uploaded files by their actual bytes (not the declared type),
 * enforces size limits and keeps files in memory only.
 */

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_FILES_PER_DOCUMENT = 10;

export interface IncomingFile {
  name?: string;
  mimeType?: string;
  dataBase64?: string;
}

export interface CheckedFile {
  name: string;
  mime: string;
  buffer: Buffer;
}

function sniff(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  const brand = buf.subarray(4, 12).toString('latin1');
  if (/^ftyp(heic|heix|hevc|mif1|msf1)/.test(brand)) return 'image/heic';
  return null;
}

const safeName = (name = 'document') =>
  name.replace(/^.*[\\/]/, '').replace(/[^\w.\- ]+/g, '_').slice(0, 80) || 'document';

export class IngestError extends Error {}

export function checkFiles(files: unknown): CheckedFile[] {
  if (!Array.isArray(files) || files.length === 0) throw new IngestError('No file received.');
  if (files.length > MAX_FILES_PER_DOCUMENT) throw new IngestError(`Please send at most ${MAX_FILES_PER_DOCUMENT} pages at a time.`);
  return files.map((f: IncomingFile) => {
    if (!f || typeof f.dataBase64 !== 'string') throw new IngestError('A file was empty.');
    const buffer = Buffer.from(f.dataBase64, 'base64');
    if (buffer.length === 0) throw new IngestError('A file was empty.');
    if (buffer.length > MAX_FILE_BYTES) throw new IngestError('Each file must be under 10 MB.');
    const mime = sniff(buffer);
    if (!mime) throw new IngestError('Only PDF, JPG, PNG, WEBP or HEIC files can be read.');
    return { name: safeName(f.name), mime, buffer };
  });
}

/**
 * PDFs the document reader cannot open: password-protected ones (e-Aadhaar downloads and
 * many bank statements are locked) and damaged or empty files. Caught here so the person
 * hears what is wrong instead of a generic failure.
 */
export async function checkPdfs(files: CheckedFile[]): Promise<void> {
  const { PDFDocument } = await import('pdf-lib');
  for (const f of files) {
    if (f.mime !== 'application/pdf') continue;
    const raw = f.buffer.toString('latin1');
    // The encryption dictionary is always stored unencrypted in the trailer / xref stream
    if (/\/Encrypt\s*(<<|\d+\s+\d+\s+R)/.test(raw)) {
      throw new IngestError(
        `${f.name} is password-protected, so it cannot be read. e-Aadhaar PDFs are locked — open it, then upload a screenshot or scan it with the camera.`
      );
    }
    let pages = 0;
    try {
      pages = (await PDFDocument.load(f.buffer, { updateMetadata: false, ignoreEncryption: true })).getPageCount();
    } catch {
      pages = -1;
    }
    if (pages < 0 || !raw.slice(-2048).includes('%%EOF')) {
      throw new IngestError(`${f.name} could not be opened — the PDF looks damaged or incomplete. Try downloading it again, or upload a photo of the document.`);
    }
    if (pages === 0) throw new IngestError(`${f.name} has no pages. Please upload the full document.`);
  }
}
