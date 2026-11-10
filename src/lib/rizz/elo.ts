import {getRizzRatingDef, type RizzRating} from '@lib/rizz/ratings';

/*
 * The player's rating, kept the way chess keeps it: every message is a game against the other person, the label is
 * the result (a Brilliant is a win, a Blunder a loss), and the Elo moves by how surprising the result was.
 */

export const PLAYER_START_ELO = 800;

/** The chance of a good result against an opponent of `opponent`. */
export function getExpectedScore(elo: number, opponent: number) {
  return 1 / (1 + 10 ** ((opponent - elo) / 400));
}

/** What a label is worth as a result, 0..1. */
export function getMoveScore(rating: RizzRating) {
  return (getRizzRatingDef(rating)?.accuracy ?? 0) / 100;
}

/** The new Elo after a message labelled `rating`: a bigger K while the rating is still settling. */
export function updateElo(elo: number, opponent: number, rating: RizzRating, moves: number) {
  const k = moves < 10 ? 48 : 32;
  // a "Book" or "Good" message is par: the scale is bent so that an average label against an equal opponent is a draw
  const score = Math.min(1, Math.max(0, (getMoveScore(rating) - 0.6) / 0.4 * 0.5 + 0.5));
  const delta = Math.round(k * (score - getExpectedScore(elo, opponent)));
  return {elo: Math.max(100, elo + delta), delta};
}
