import {classifyLines, RizzLine} from '@lib/rizz/classifier';
import {getCachedVerdict, setCachedVerdicts} from '@lib/rizz/ratingCache';
import type {RizzVerdict} from '@lib/rizz/ratings';
import {getRizzSettings, hasRizzKey} from '@lib/rizz/settings';

/*
 * One request grades every unrated message of a chat's window, so each message is graded in the context it
 * sits in and a screenful of bubbles costs one call, not twenty. Bubbles ask (`request`), the answer is pushed
 * to whoever `subscribe`d for that message.
 */

const DEBOUNCE_MS = 900;
const MAX_TARGETS = 24;

type Listener = (verdict: RizzVerdict | undefined, state: 'pending' | 'done' | 'failed') => void;

type ChatQueue = {
  key: string,
  getLines: () => RizzLine[],
  wanted: Set<number>,
  timer?: number,
  running?: boolean,
  failedAt?: number
};

const queues = new Map<string, ChatQueue>();
const listeners = new Map<string, Set<Listener>>();
// a failed request is not repeated for every bubble: wait a while before the next one
const FAILURE_COOLDOWN_MS = 30_000;

const listenerKey = (key: string, mid: number) => key + '_' + mid;

export function subscribeToVerdict(key: string, mid: number, listener: Listener) {
  const id = listenerKey(key, mid);
  let set = listeners.get(id);
  if(!set) listeners.set(id, set = new Set());
  set.add(listener);
  return () => {
    set.delete(listener);
    if(!set.size) listeners.delete(id);
  };
}

function notify(key: string, mid: number, verdict: RizzVerdict | undefined, state: Parameters<Listener>[1]) {
  listeners.get(listenerKey(key, mid))?.forEach((listener) => listener(verdict, state));
}

export function getKnownVerdict(key: string, line: RizzLine) {
  return getCachedVerdict(key, line.mid, line.text);
}

/** Asks for a verdict of `line`; `getLines` returns the chat's current window, oldest first. */
export function requestVerdict(key: string, line: RizzLine, getLines: () => RizzLine[]) {
  const cached = getCachedVerdict(key, line.mid, line.text);
  if(cached) {
    notify(key, line.mid, cached, 'done');
    return;
  }

  if(!getRizzSettings().ratings || !hasRizzKey()) return;

  let queue = queues.get(key);
  if(!queue) queues.set(key, queue = {key, getLines, wanted: new Set()});
  queue.getLines = getLines;
  queue.wanted.add(line.mid);
  notify(key, line.mid, undefined, 'pending');
  schedule(queue);
}

function schedule(queue: ChatQueue) {
  if(queue.timer || queue.running) return;
  const wait = Math.max(DEBOUNCE_MS, queue.failedAt ? FAILURE_COOLDOWN_MS - (Date.now() - queue.failedAt) : 0);
  queue.timer = window.setTimeout(() => {
    queue.timer = undefined;
    void run(queue);
  }, wait);
}

async function run(queue: ChatQueue) {
  const lines = queue.getLines().filter((line) => line.text.trim());
  const byMid = new Map(lines.map((line) => [line.mid, line]));
  const targets = [...queue.wanted]
  .filter((mid) => byMid.has(mid) && !getCachedVerdict(queue.key, mid, byMid.get(mid).text))
  .sort((a, b) => b - a) // the newest first: what is in sight
  .slice(0, MAX_TARGETS);

  if(!targets.length || !getRizzSettings().ratings) {
    queue.wanted.clear();
    return;
  }

  targets.forEach((mid) => queue.wanted.delete(mid));
  queue.running = true;
  try {
    // the window: everything up to the newest target, a few messages before the oldest one for context
    const oldest = Math.min(...targets);
    const newest = Math.max(...targets);
    const start = Math.max(0, lines.findIndex((line) => line.mid >= oldest) - 6);
    const window = lines.filter((line, index) => index >= start && line.mid <= newest);

    const verdicts = await classifyLines(window, targets);
    const saved = new Map<number, {verdict: RizzVerdict, text: string}>();
    targets.forEach((mid) => {
      const verdict = verdicts.get(mid);
      if(verdict) saved.set(mid, {verdict, text: byMid.get(mid).text});
      notify(queue.key, mid, verdict, verdict ? 'done' : 'failed');
    });

    if(saved.size) setCachedVerdicts(queue.key, saved);
    queue.failedAt = undefined;
  } catch(err) {
    console.warn('[rizz] grading failed', err);
    queue.failedAt = Date.now();
    targets.forEach((mid) => notify(queue.key, mid, undefined, 'failed'));
  } finally {
    queue.running = false;
    if(queue.wanted.size) schedule(queue);
  }
}

/** Settings switched off: forget what waits. */
export function cancelQueuedVerdicts() {
  queues.forEach((queue) => {
    clearTimeout(queue.timer);
    queue.timer = undefined;
    queue.wanted.clear();
  });
}
