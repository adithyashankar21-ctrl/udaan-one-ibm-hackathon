/**
 * What the microphone heard last. The speech recogniser gives several guesses for the same
 * speech: the best one becomes the answer, and the others are kept here so the server can pick
 * the guess that makes sense for the question. autofillApi sends them along with that same text.
 */
let last: { text: string; alternatives: string[]; confidence?: number; at: number } | null = null;

export function rememberHeard(text: string, alternatives: string[], confidence?: number) {
  last = { text: text.trim(), alternatives, confidence, at: Date.now() };
}

/** Other guesses and the confidence for `text`, if it is what the microphone heard last. */
export function heardDetails(text: string): { alternatives?: string[]; confidence?: number } {
  if (!last || last.text !== text.trim() || Date.now() - last.at > 120_000) return {};
  return { alternatives: last.alternatives.length ? last.alternatives : undefined, confidence: last.confidence };
}
