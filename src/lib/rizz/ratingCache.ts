import type {RizzVerdict} from '@lib/rizz/ratings';
import {isRizzRating} from '@lib/rizz/ratings';

/*
 * Verdicts are kept per chat in localStorage, so reopening a chat costs no request. An edited message
 * (another text) is graded again; the entry remembers a hash of the text it was given for.
 */

const PREFIX = 'tweb-rizz-ratings:';
const MAX_PER_CHAT = 400;

type Entry = [rating: string, elo: number, textHash: number, reason?: string];
type ChatEntries = {[mid: number]: Entry};

const memory = new Map<string, ChatEntries>();

export function hashText(text: string) {
  let hash = 0;
  for(let i = 0; i < text.length; ++i) hash = (hash * 31 + text.charCodeAt(i)) | 0;
  return hash;
}

function load(key: string): ChatEntries {
  let entries = memory.get(key);
  if(entries) return entries;
  try {
    entries = JSON.parse(localStorage.getItem(PREFIX + key)) || {};
  } catch(err) {
    entries = {};
  }

  memory.set(key, entries);
  return entries;
}

export function getCachedVerdict(key: string, mid: number, text: string): RizzVerdict | undefined {
  const entry = load(key)[mid];
  if(!entry || entry[2] !== hashText(text) || !isRizzRating(entry[0])) return;
  return {rating: entry[0], elo: entry[1], reason: entry[3]};
}

export function setCachedVerdicts(key: string, verdicts: Map<number, {verdict: RizzVerdict, text: string}>) {
  const entries = load(key);
  verdicts.forEach(({verdict, text}, mid) => {
    entries[mid] = [verdict.rating, verdict.elo, hashText(text), verdict.reason];
  });

  const mids = Object.keys(entries).map(Number);
  if(mids.length > MAX_PER_CHAT) {
    mids.sort((a, b) => a - b).slice(0, mids.length - MAX_PER_CHAT).forEach((mid) => delete entries[mid]);
  }

  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(entries));
  } catch(err) {}
}

export function clearRatingCache() {
  memory.clear();
  try {
    Object.keys(localStorage).filter((key) => key.startsWith(PREFIX)).forEach((key) => localStorage.removeItem(key));
  } catch(err) {}
}
