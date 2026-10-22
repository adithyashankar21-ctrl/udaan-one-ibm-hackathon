import { useEffect } from 'react';
import type { LanguageCode } from '../types';
import { loadDictionary, needsTranslation, peekTranslation, translateTexts } from '../services/translate';

/**
 * Shows the whole interface in the chosen language. Pages are written in English; this
 * translates the English text on screen (and placeholders, tooltips and labels) as it
 * appears, and puts the English back when English is chosen again. Text already in an
 * Indian script, code, and anything inside translate="no" is left alone.
 */

const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'] as const;
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE', 'TEXTAREA', 'KBD', 'SAMP']);
const SKIP_SELECTOR = '[translate="no"], .notranslate, [contenteditable="true"], .cm-editor';

interface TextRecord {
  source: string;
  shown: string;
}

const texts = new Map<Text, TextRecord>();
const attrs = new Map<Element, Partial<Record<(typeof ATTRS)[number], TextRecord>>>();

const skipped = (el: Element | null) => !el || SKIP_TAGS.has(el.tagName) || Boolean(el.closest(SKIP_SELECTOR));

/** "  Save details " → ["  ", "Save details", " "] so spacing around the words is kept. */
const split = (s: string) => {
  const m = s.match(/^(\s*)([\s\S]*?)(\s*)$/)!;
  return [m[1], m[2], m[3]] as const;
};

function restoreAll() {
  texts.forEach((rec, node) => {
    if (node.isConnected && node.nodeValue === rec.shown) node.nodeValue = rec.source;
  });
  texts.clear();
  attrs.forEach((recs, el) => {
    for (const a of ATTRS) {
      const rec = recs[a];
      if (rec && el.getAttribute(a) === rec.shown) el.setAttribute(a, rec.source);
    }
  });
  attrs.clear();
}

export function AutoTranslate({ language }: { language: LanguageCode }) {
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ur' ? 'rtl' : 'ltr';
    if (language === 'en') {
      restoreAll();
      return;
    }
    restoreAll();
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const scan = () => {
      timer = null;
      if (!alive) return;
      const wanted = new Set<string>();
      const pendingText: Array<[Text, string]> = [];
      const pendingAttr: Array<[Element, (typeof ATTRS)[number], string]> = [];

      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
        const value = n.nodeValue || '';
        const rec = texts.get(n);
        if (rec && value === rec.shown) continue;
        // New text, or React replaced our translation with (new) English
        const core = split(value)[1];
        if (!core || !needsTranslation(core) || skipped(n.parentElement)) continue;
        const known = peekTranslation(core, language);
        if (known !== undefined) {
          const [lead, , trail] = split(value);
          const shown = lead + known + trail;
          texts.set(n, { source: value, shown });
          n.nodeValue = shown;
        } else {
          wanted.add(core);
          pendingText.push([n, value]);
        }
      }

      document.body.querySelectorAll('[placeholder], [title], [aria-label], [alt]').forEach((el) => {
        if (skipped(el) && !el.matches('input, textarea')) return;
        if (el.closest(SKIP_SELECTOR)) return;
        for (const a of ATTRS) {
          const value = el.getAttribute(a);
          if (!value) continue;
          const rec = attrs.get(el)?.[a];
          if (rec && value === rec.shown) continue;
          if (!needsTranslation(value)) continue;
          const known = peekTranslation(value, language);
          if (known !== undefined) {
            attrs.set(el, { ...attrs.get(el), [a]: { source: value, shown: known } });
            el.setAttribute(a, known);
          } else {
            wanted.add(value);
            pendingAttr.push([el, a, value]);
          }
        }
      });

      // Forget nodes that left the page
      texts.forEach((_, node) => {
        if (!node.isConnected) texts.delete(node);
      });
      attrs.forEach((_, el) => {
        if (!el.isConnected) attrs.delete(el);
      });

      if (!wanted.size) return;
      const list = [...wanted];
      translateTexts(list, language).then((out) => {
        if (!alive) return;
        const got = new Map(list.map((t, i) => [t, out[i]]));
        observer.disconnect();
        for (const [node, value] of pendingText) {
          // Only if the text has not changed while the translation was on its way
          if (!node.isConnected || node.nodeValue !== value) continue;
          const [lead, core, trail] = split(value);
          const t = got.get(core);
          if (!t || t === core) continue;
          const shown = lead + t + trail;
          texts.set(node, { source: value, shown });
          node.nodeValue = shown;
        }
        for (const [el, a, value] of pendingAttr) {
          if (!el.isConnected || el.getAttribute(a) !== value) continue;
          const t = got.get(value);
          if (!t || t === value) continue;
          attrs.set(el, { ...attrs.get(el), [a]: { source: value, shown: t } });
          el.setAttribute(a, t);
        }
        observe();
      });
    };

    const schedule = () => {
      if (!timer) timer = setTimeout(scan, 60);
    };
    const observer = new MutationObserver(schedule);
    const observe = () =>
      observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: [...ATTRS] });

    // The whole language's saved translations first, so the page appears already translated
    const englishTitle = document.title;
    loadDictionary(language).finally(() => {
      if (!alive) return;
      observe();
      scan();
      translateTexts([englishTitle], language).then(([t]) => {
        if (alive) document.title = t;
      });
    });
    return () => {
      document.title = englishTitle;
      alive = false;
      if (timer) clearTimeout(timer);
      observer.disconnect();
    };
  }, [language]);

  return null;
}
