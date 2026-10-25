/**
 * Career roadmaps: asked for from anywhere (typed, spoken, chat, WhatsApp, helpline) and kept
 * for the person. They are saved with the account when there is one (autofillApi.roadmaps) and
 * in this browser as well, so the latest roadmap is still there after a reload.
 */
import type { SavedRoadmap } from '../types';

/** Any channel that hears "make me a career roadmap…" hands the request to the app. */
export const ROADMAP_INTENT_EVENT = 'udaan:roadmap-intent';

export interface RoadmapRequest {
  /** What the person asked for, in their words; empty to make one from the profile alone. */
  request?: string;
  channel?: string;
}

export function announceRoadmapIntent(detail: RoadmapRequest) {
  window.dispatchEvent(new CustomEvent<RoadmapRequest>(ROADMAP_INTENT_EVENT, { detail }));
}

const STORE = 'udaan_roadmaps_v1';

export function loadLocalRoadmaps(): SavedRoadmap[] {
  try {
    const list = JSON.parse(localStorage.getItem(STORE) || '[]');
    return Array.isArray(list) ? list.filter((r) => r?.id && r?.roadmap?.profileSummary) : [];
  } catch {
    return [];
  }
}

export function saveLocalRoadmaps(list: SavedRoadmap[]) {
  try {
    localStorage.setItem(STORE, JSON.stringify(list.slice(0, 10)));
  } catch {}
}

/** Newest first, one entry per id. */
export const mergeRoadmaps = (...lists: SavedRoadmap[][]) => {
  const seen = new Map<string, SavedRoadmap>();
  for (const r of lists.flat()) if (!seen.has(r.id)) seen.set(r.id, r);
  return [...seen.values()].sort((a, b) => b.createdAt - a.createdAt).slice(0, 10);
};

/** Ready-made requests to tap. */
export const ROADMAP_IDEAS = [
  'How can I become a certified electrician?',
  'I want to start a tailoring business',
  'What should I do after 12th?',
  'I want a job in a hospital',
  'How do I become a software developer?',
  'I want to drive for a living',
];
