/*
 * The chess labels of r/TextingTheory, in chess.com's colours and order. `symbol` is what the badge shows.
 */

export type RizzRating =
  'brilliant' | 'great' | 'best' | 'excellent' | 'good' | 'book' | 'forced' |
  'inaccuracy' | 'mistake' | 'miss' | 'blunder' | 'checkmate' | 'resign';

export type RizzRatingDef = {
  id: RizzRating,
  /** the glyph's text: the accessible fallback of the drawn badge (components/rizz/icons) */
  symbol: string,
  color: string,
  title: string,
  /** what the model is told it means */
  hint: string,
  /** the accuracy this move is worth, 0..100 */
  accuracy: number
};

/** chess.com's order and colours, plus the three labels r/TextingTheory adds: forced, checkmate and resign */
export const RIZZ_RATINGS: RizzRatingDef[] = [
  {id: 'brilliant', symbol: '!!', color: '#1baca6', title: 'Brilliant', accuracy: 100, hint: 'a rare, genuinely clever or emotionally perfect message — witty, disarming, escalates the vibe without trying too hard'},
  {id: 'great', symbol: '!', color: '#5c8bb0', title: 'Great', accuracy: 92, hint: 'a strong message that moves the conversation forward, shows personality, or turns the chat around'},
  {id: 'best', symbol: '★', color: '#81b64c', title: 'Best', accuracy: 88, hint: 'the best reply available in this position'},
  {id: 'excellent', symbol: '👍', color: '#81b64c', title: 'Excellent', accuracy: 80, hint: 'a very good message, close to the best one'},
  {id: 'good', symbol: '✓', color: '#95b776', title: 'Good', accuracy: 65, hint: 'fine and natural, but nothing special'},
  {id: 'book', symbol: '📖', color: '#a88865', title: 'Book', accuracy: 60, hint: 'a standard, expected message (greetings, small talk, logistics)'},
  {id: 'forced', symbol: '→', color: '#97af8b', title: 'Forced', accuracy: 70, hint: 'the only sensible thing to say (a direct question that must be answered, a thank-you, an apology owed)'},
  {id: 'inaccuracy', symbol: '?!', color: '#f7c631', title: 'Inaccuracy', accuracy: 40, hint: 'a bit off: dry, a little needy, or a missed chance'},
  {id: 'mistake', symbol: '?', color: '#e58f2a', title: 'Mistake', accuracy: 25, hint: 'a message that hurts the vibe: awkward, boring, try-hard, or pushy'},
  {id: 'miss', symbol: '✗', color: '#ff7769', title: 'Miss', accuracy: 20, hint: 'ignored an obvious opening or question, or dodged what they were offering'},
  {id: 'blunder', symbol: '??', color: '#ca3431', title: 'Blunder', accuracy: 0, hint: 'a conversation-killer: rude, creepy, desperate, passive-aggressive or offensive'},
  {id: 'checkmate', symbol: '#', color: '#4f5b66', title: 'Checkmate', accuracy: 100, hint: 'ends the conversation in the user\'s favour: the other person has said yes to a date, given their number, or is plainly won over. Very rare. The user announcing a date or plans the other person never agreed to is NOT checkmate — it is presumptuous'},
  {id: 'resign', symbol: '🏳', color: '#7d848b', title: 'Resign', accuracy: 0, hint: 'gives up: a surrender, an apology spiral, "forget it", "never mind"'}
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
  reason?: string,
  /** what the user could have sent instead, when it was not among the best */
  better?: string
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
