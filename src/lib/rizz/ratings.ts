/*
 * The chess labels of r/TextingTheory, in chess.com's colours and order. `symbol` is what the badge shows.
 */

export type RizzRating =
  'brilliant' | 'great' | 'best' | 'excellent' | 'good' | 'book' | 'forced' |
  'inaccuracy' | 'mistake' | 'miss' | 'blunder' | 'checkmate' | 'resign';

export type RizzRatingDef = {
  id: RizzRating,
  /** the text of the badge when it has no drawing */
  symbol: string,
  /** the badge's drawing instead of the text: the inside of a 24x24 svg, white on the badge's colour */
  svg?: string,
  color: string,
  title: string,
  /** what the model is told it means */
  hint: string,
  /** the accuracy this move is worth, 0..100 */
  accuracy: number
};

const STAR = '<path fill="#fff" d="M12 3.2l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17.2l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>';
const THUMB = '<path fill="#fff" d="M2.5 10.5h3.8V21H2.5zM8 21V10.6l3.6-6.9c1.4-.2 2.6 1 2.3 2.4l-.6 3.3h5.9a2 2 0 0 1 2 2.4l-1.4 7.2A2 2 0 0 1 17.8 21z"/>';
const CHECK = '<path fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" d="M5 12.8l4.6 4.6L19.2 7.4"/>';
const BOOK = '<path fill="#fff" d="M3.5 5.6C6.4 4.4 9.6 4.6 12 6.3c2.4-1.7 5.6-1.9 8.5-.7v12.9c-2.9-1.2-6.1-1-8.5.7-2.4-1.7-5.6-1.9-8.5-.7z"/><path fill="none" stroke="currentColor" stroke-width="1.6" d="M12 6.6v12.2"/>';
const CROSS = '<path fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" d="M7 7l10 10M17 7L7 17"/>';
const ARROW = '<path fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" d="M5 12h13.5M13 6l6 6-6 6"/>';
const FLAG = '<path fill="#fff" d="M5.5 3h1.8v18H5.5z"/><path fill="#fff" d="M8 4.2h11l-3.2 4.1L19 12.4H8z"/>';

/** chess.com's order and colours, plus the three labels r/TextingTheory adds: forced, checkmate and resign */
export const RIZZ_RATINGS: RizzRatingDef[] = [
  {id: 'brilliant', symbol: '!!', color: '#1baca6', title: 'Brilliant', accuracy: 100, hint: 'a rare, genuinely clever or emotionally perfect message — witty, disarming, escalates the vibe without trying too hard'},
  {id: 'great', symbol: '!', color: '#5c8bb0', title: 'Great', accuracy: 92, hint: 'a strong message that moves the conversation forward, shows personality, or turns the chat around'},
  {id: 'best', symbol: '★', svg: STAR, color: '#81b64c', title: 'Best', accuracy: 88, hint: 'the best reply available in this position'},
  {id: 'excellent', symbol: '👍', svg: THUMB, color: '#81b64c', title: 'Excellent', accuracy: 80, hint: 'a very good message, close to the best one'},
  {id: 'good', symbol: '✓', svg: CHECK, color: '#95b776', title: 'Good', accuracy: 65, hint: 'fine and natural, but nothing special'},
  {id: 'book', symbol: '📖', svg: BOOK, color: '#a88865', title: 'Book', accuracy: 60, hint: 'a standard, expected message (greetings, small talk, logistics)'},
  {id: 'forced', symbol: '→', svg: ARROW, color: '#97af8b', title: 'Forced', accuracy: 70, hint: 'the only sensible thing to say (a direct question that must be answered, a thank-you, an apology owed)'},
  {id: 'inaccuracy', symbol: '?!', color: '#f7c631', title: 'Inaccuracy', accuracy: 40, hint: 'a bit off: dry, a little needy, or a missed chance'},
  {id: 'mistake', symbol: '?', color: '#e58f2a', title: 'Mistake', accuracy: 25, hint: 'a message that hurts the vibe: awkward, boring, try-hard, or pushy'},
  {id: 'miss', symbol: '✗', svg: CROSS, color: '#ff7769', title: 'Miss', accuracy: 20, hint: 'ignored an obvious opening or question, or dodged what they were offering'},
  {id: 'blunder', symbol: '??', color: '#ca3431', title: 'Blunder', accuracy: 0, hint: 'a conversation-killer: rude, creepy, desperate, passive-aggressive or offensive'},
  {id: 'checkmate', symbol: '#', color: '#4f5b66', title: 'Checkmate', accuracy: 100, hint: 'ends the conversation in the user\'s favour: a date agreed, a number given, a perfect last word. Very rare'},
  {id: 'resign', symbol: '🏳', svg: FLAG, color: '#7d848b', title: 'Resign', accuracy: 0, hint: 'gives up: a surrender, an apology spiral, "forget it", "never mind"'}
];

const BY_ID = new Map(RIZZ_RATINGS.map((def) => [def.id, def]));

export function getRizzRatingDef(id: string): RizzRatingDef | undefined {
  return BY_ID.get(id as RizzRating);
}

export function isRizzRating(id: unknown): id is RizzRating {
  return typeof id === 'string' && BY_ID.has(id as RizzRating);
}

export type RizzVerdict = {
  rating: RizzRating,
  /** an estimated Elo of the message, 100..3000 */
  elo: number,
  /** one short sentence on why */
  reason?: string
};

export function clampElo(elo: unknown, fallback = 800) {
  const value = Math.round(Number(elo));
  return Number.isFinite(value) ? Math.min(3000, Math.max(100, value)) : fallback;
}

/** The mean accuracy of verdicts, 0..100 (chess.com's "accuracy"). */
export function getAccuracy(verdicts: RizzVerdict[]) {
  if(!verdicts.length) return 0;
  const sum = verdicts.reduce((acc, verdict) => acc + (BY_ID.get(verdict.rating)?.accuracy ?? 0), 0);
  return Math.round(sum / verdicts.length);
}

export function getAverageElo(verdicts: RizzVerdict[]) {
  if(!verdicts.length) return 0;
  return Math.round(verdicts.reduce((acc, verdict) => acc + verdict.elo, 0) / verdicts.length);
}
