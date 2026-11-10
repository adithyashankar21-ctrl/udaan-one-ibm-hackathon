import fs from 'fs';
import path from 'path';
import type { PDFDocument, PDFImage } from 'pdf-lib';

let cached: Uint8Array | null | undefined;

/** The official UDAAN ONE mark for PDF headers; null if the file is missing (the PDF still builds). */
export async function embedLogo(pdf: PDFDocument): Promise<PDFImage | null> {
  if (cached === undefined) {
    try {
      cached = fs.readFileSync(path.join(process.cwd(), 'public', 'logo-mark.png'));
    } catch {
      cached = null;
    }
  }
  if (!cached) return null;
  try {
    return await pdf.embedPng(cached);
  } catch {
    return null;
  }
}
