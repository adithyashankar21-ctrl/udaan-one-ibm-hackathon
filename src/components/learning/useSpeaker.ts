import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Reads lessons and answers aloud with the browser's built-in speech engine.
 * It needs no network or API quota, so a learner can listen to as many lessons as they like.
 * Text is spoken sentence by sentence (long single utterances get cut off in Chrome).
 */

function pickVoice(locale: string) {
  const voices = window.speechSynthesis.getVoices();
  const lang = locale.toLowerCase();
  const base = lang.split('-')[0];
  return (
    voices.find((v) => v.lang.toLowerCase() === lang) ||
    voices.find((v) => v.lang.toLowerCase().startsWith(base + '-')) ||
    (base === 'en' ? voices.find((v) => v.lang.toLowerCase().startsWith('en')) : undefined) ||
    null
  );
}

/** Turns lesson text into something pleasant to hear: no symbols, no code. */
export function speakable(text: string) {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/[*#_~>|]/g, ' ')
    .replace(/^\s*[-•]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function chunks(text: string) {
  const parts = text.match(/[^.!?।]+[.!?।]+|[^.!?।]+$/g) || [text];
  const out: string[] = [];
  for (const p of parts) {
    const t = p.trim();
    if (!t) continue;
    if (out.length && out[out.length - 1].length + t.length < 180) out[out.length - 1] += ' ' + t;
    else out.push(t);
  }
  return out;
}

export function useSpeaker(locale: string) {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const run = useRef(0);

  const stop = useCallback(() => {
    run.current++;
    if (supported) window.speechSynthesis.cancel();
    setSpeakingId(null);
  }, [supported]);

  const speak = useCallback(
    (id: string, text: string) => {
      if (!supported) return;
      window.speechSynthesis.cancel();
      const myRun = ++run.current;
      const voice = pickVoice(locale);
      const queue = chunks(speakable(text));
      setSpeakingId(id);
      const next = (i: number) => {
        if (run.current !== myRun) return;
        if (i >= queue.length) return setSpeakingId(null);
        const u = new SpeechSynthesisUtterance(queue[i]);
        u.lang = voice?.lang || locale;
        if (voice) u.voice = voice;
        u.rate = 0.95;
        u.onend = () => next(i + 1);
        u.onerror = () => run.current === myRun && setSpeakingId(null);
        window.speechSynthesis.speak(u);
      };
      next(0);
    },
    [locale, supported]
  );

  useEffect(() => () => stop(), [stop]);
  return { supported, speakingId, speak, stop };
}
