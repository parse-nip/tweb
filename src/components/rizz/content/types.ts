/*
 * The shape of the game's content.
 *
 * A scenario is a conversation the way a chess opening is a position: fixed turns, and at each turn
 * a handful of replies ("moves") the player picks from. Every reply carries the engine's opinion of
 * it (`score`, in "vibe centipawns": +100 is roughly one good joke landing) and the coach's
 * explanation. Their next message depends on how the last reply landed (`them[mood]`), so every
 * turn's three variants lead into the same next set of replies.
 */

export type RizzMood = 0 | 1 | 2; // 0 — it landed, 1 — neutral, 2 — it flopped

export type RizzOption = {
  text: string,
  /** The engine's evaluation of the reply, before the opponent's difficulty is applied. */
  score: number,
  /** The coach's line in Game Review. */
  why: string,
  /** A risky, non-obvious reply that is also the best one — shown as Brilliant when found. */
  brilliant?: boolean,
  /** Opening theory: a well-known strong opener. Classified as Book. */
  book?: boolean
};

export type RizzTurn = {
  /** Their reply to the previous move, by how it landed. Absent on the first turn. */
  them?: [landed: string, neutral: string, flopped: string],
  /** Their message is an opening — a reply that does not take it is a Miss. */
  opening?: boolean,
  options: RizzOption[]
};

export type RizzScenario = {
  id: string,
  title: string,
  /** The service message the chat starts with: where you met. */
  setting: string,
  /** Their first message, when they open. Otherwise the player opens. */
  opener?: string,
  turns: RizzTurn[],
  endings: {win: string, draw: string, loss: string}
};
