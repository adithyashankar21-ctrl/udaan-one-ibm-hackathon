/**
 * Collects every English text the app can show — page and window text, labels, placeholders,
 * button text, messages, and the data files (schemes, documents, form questions, courses) —
 * so they can all be translated ahead of time (see scripts/warm-translations.ts).
 *
 *   npx tsx scripts/extract-ui-strings.mts > ui-strings.json
 */
import fs from 'fs';
import path from 'path';
import { parseSync } from 'rolldown/utils';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DIRS = ['src', 'server'];
// Pure word lists and hand-written translations: nothing English to show there
const SKIP_FILES = /(languageTools|voiceWords|applicationWords|languages|uiStrings|smartApplyStrings)\.ts$|\/i18n\/|\.d\.ts$/;
/** Attributes that never hold visible text. */
const CODE_ATTRS = new Set(['className', 'id', 'href', 'src', 'type', 'key', 'role', 'name', 'htmlFor', 'inputMode', 'autoComplete', 'rel', 'target', 'method', 'accept', 'capture', 'd', 'viewBox', 'fill', 'stroke', 'translate', 'dir', 'lang', 'tone', 'facing', 'mode', 'variant', 'size', 'icon', 'as', 'action', 'encType', 'pattern', 'xmlns', 'strokeWidth', 'strokeLinecap', 'strokeLinejoin', 'preserveAspectRatio']);
/** Words that only appear in CSS class lists. */
const CSS = /\b(px|py|mt|mb|ml|mr|pt|pb|gap|text|bg|rounded|flex|grid|border|w|h|min|max|items|justify|font|leading|tracking|shadow|ring|hover|focus|sm|md|lg|xl|space|overflow|absolute|relative|inset|z|opacity|transition|duration|animate)-/;

const files: string[] = [];
const walk = (dir: string) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(tsx?|mts)$/.test(e.name) && !SKIP_FILES.test(p)) files.push(p);
  }
};
DIRS.forEach((d) => walk(path.join(ROOT, d)));
files.push(path.join(ROOT, 'src/data/smartApplyStrings.ts')); // its English half

const out = new Set<string>();
const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
const english = (s: string) => /[A-Za-z]{2,}/.test(s) && !/[ऀ-෿؀-ۿ]/.test(s);
const looksLikeText = (s: string) =>
  english(s) &&
  s.length >= 2 &&
  s.length <= 1200 &&
  !CSS.test(s) &&
  !/^(https?:|mailto:|tel:|\/|\.\/|#|data:|@)/.test(s) &&
  !/^[a-z0-9_.:/-]+$/.test(s) && // identifiers, paths, keys
  !/^[A-Z0-9_]+$/.test(s) && // CONSTANTS
  !/[{}<>]|=>|\\[dws]/.test(s) && // code, templates, regex
  (/\s/.test(s) || /^[A-Z][a-z]/.test(s));

const visit = (node: any, parentAttr?: string) => {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) return node.forEach((n) => visit(n, parentAttr));
  switch (node.type) {
    case 'ImportDeclaration':
    case 'ExportAllDeclaration':
    case 'TSTypeAnnotation':
    case 'TSInterfaceDeclaration':
    case 'TSTypeAliasDeclaration':
      return;
    case 'JSXText': {
      // React joins the lines of JSX text with single spaces
      const t = clean(String(node.value).split('\n').map((l) => l.trim()).filter(Boolean).join(' '));
      if (english(t)) out.add(t);
      return;
    }
    case 'JSXAttribute': {
      const name = node.name?.name;
      if (CODE_ATTRS.has(name)) return;
      return visit(node.value, name);
    }
    case 'Literal':
      if (typeof node.value === 'string') {
        const t = clean(node.value);
        if (looksLikeText(t)) out.add(t);
      }
      return;
    case 'CallExpression': {
      // Skip regexes built from strings and console/logging calls
      const callee = node.callee;
      if (callee?.type === 'Identifier' && /^(RegExp|require)$/.test(callee.name)) return;
      if (callee?.type === 'MemberExpression' && callee.object?.name === 'console') return;
      break;
    }
  }
  for (const key of Object.keys(node)) if (key !== 'type' && key !== 'start' && key !== 'end') visit(node[key], parentAttr);
};

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  const { program, errors } = parseSync(file, src, { lang: file.endsWith('x') ? 'tsx' : 'ts' } as any);
  if (errors?.length) console.error(`skipped (parse error): ${path.relative(ROOT, file)}`);
  else visit(program);
}

process.stdout.write(JSON.stringify([...out].sort(), null, 1));
console.error(`${out.size} texts from ${files.length} files`);
