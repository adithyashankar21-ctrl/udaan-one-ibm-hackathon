/**
 * Prints one document (a roadmap, a certificate) on its own, as a clean A4 PDF: the element is
 * copied into a hidden page of its own with the app's styles and an A4 page set-up, and only that
 * page is printed. Nothing else on screen can end up in the PDF, and the PDF is named after `title`.
 */

export interface PrintOptions {
  /** Shown in the print window and used as the PDF file name. */
  title: string;
  orientation?: 'portrait' | 'landscape';
  /** Page margin in millimetres. */
  marginMm?: number;
  /** Extra CSS for this document. */
  css?: string;
}

/** Pixels per millimetre at the 96 dpi browsers lay pages out at. */
const PX_PER_MM = 96 / 25.4;

export function documentHtml(content: string, styles: string, opts: PrintOptions) {
  const margin = opts.marginMm ?? 12;
  const landscape = opts.orientation === 'landscape';
  const width = (landscape ? 297 : 210) - margin * 2;
  const lang = (typeof document !== 'undefined' && document.documentElement.lang) || 'en';
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>${opts.title.replace(/</g, '&lt;')}</title>${styles}<style>
@page { size: A4 ${landscape ? 'landscape' : 'portrait'}; margin: ${margin}mm; }
html, body { margin: 0; padding: 0; background: #fff; }
body { width: ${width}mm; }
* { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.print\\:hidden { display: none !important; }
${opts.css || ''}
</style></head><body>${content}</body></html>`;
}

/** The app's stylesheets (Tailwind and fonts), so the copy looks exactly like the original. */
const appStyles = () =>
  [...document.querySelectorAll<HTMLElement>('link[rel="stylesheet"], style')]
    .map((n) => n.outerHTML)
    .join('');

export async function printElement(el: HTMLElement, opts: PrintOptions): Promise<void> {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.tabIndex = -1;
  // Laid out at A4 width off screen (a zero-size frame would squeeze the page)
  const landscape = opts.orientation === 'landscape';
  frame.style.cssText = `position:fixed;left:-10000px;top:0;width:${Math.round((landscape ? 297 : 210) * PX_PER_MM)}px;height:${Math.round((landscape ? 210 : 297) * PX_PER_MM)}px;border:0;`;
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  doc.open();
  doc.write(documentHtml(el.outerHTML, appStyles(), opts));
  doc.close();

  // Wait for styles, fonts and images before printing
  await new Promise<void>((resolve) => {
    if (doc.readyState === 'complete') resolve();
    else frame.addEventListener('load', () => resolve(), { once: true });
    setTimeout(resolve, 2500);
  });
  await Promise.race([doc.fonts?.ready, new Promise((r) => setTimeout(r, 2500))]);
  await Promise.all([...doc.images].map((img) => (img.complete ? null : new Promise((r) => ((img.onload = r), (img.onerror = r))))));

  // Chrome names the PDF after the page title
  const before = document.title;
  document.title = opts.title;
  const done = () => {
    document.title = before;
    frame.remove();
  };
  frame.contentWindow!.addEventListener('afterprint', () => setTimeout(done, 100), { once: true });
  setTimeout(done, 60_000);
  frame.contentWindow!.focus();
  frame.contentWindow!.print();
}

/** A file-name-friendly title: "UDAAN ONE roadmap – Become a certified electrician". */
export const pdfTitle = (...parts: Array<string | undefined>) =>
  parts
    .filter(Boolean)
    .join(' – ')
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
