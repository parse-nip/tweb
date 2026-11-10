/*
 * The game's own rules, around the Rizz Coach (`@lib/rizz`): how a game ends, the Elo of rated games, and the
 * puzzles. Every message is graded by the Coach's classifier; the opponent is its simulator.
 */

import SCENARIOS from '@components/rizz/content/scenarios';
import type {RizzTurn} from '@components/rizz/content/types';
import type {SimEnding} from '@lib/rizz/simulator';
import {getRizzRatingDef, RizzVerdict} from '@lib/rizz/ratings';

export type RizzResult = 'win' | 'draw' | 'loss';
export type RizzEndReason = 'date' | 'friendzone' | 'ghosted' | 'timeout' | 'resigned' | 'agreed' | 'blunder';

/** How the simulator's ending reads as a game result. */
export function resultOfEnding(ending: SimEnding): {result: RizzResult, reason: RizzEndReason} {
  if(ending === 'checkmate') return {result: 'win', reason: 'date'};
  if(ending === 'resign') return {result: 'loss', reason: 'resigned'};
  return {result: 'loss', reason: 'ghosted'};
}

/** Elo with a provisional period: bigger steps for the first games. */
export function updateRating(rating: number, opponent: number, score: number, gamesPlayed: number) {
  const expected = 1 / (1 + Math.pow(10, (opponent - rating) / 400));
  const k = gamesPlayed < 10 ? 40 : 24;
  return Math.max(100, Math.round(rating + k * (score - expected)));
}

export function resultScore(result: RizzResult) {
  return result === 'win' ? 1 : result === 'draw' ? 0.5 : 0;
}

/** A verdict good enough to solve a puzzle: Excellent and up. */
export function isSolvingVerdict(verdict: RizzVerdict) {
  return (getRizzRatingDef(verdict.rating)?.accuracy ?? 0) >= 80;
}

export function getScenario(id: string) {
  return SCENARIOS.find((scenario) => scenario.id === id);
}

export function getScenarios() {
  return SCENARIOS;
}

/** The strongest of a turn's written replies: the puzzle's reference answer. */
export function bestOption(turn: RizzTurn) {
  return turn.options.reduce((best, option) => option.score > best.score ? option : best);
}

/*
 * Puzzles — every turn of every scenario, cut along its best line: the chat so far, and the player writes the next
 * message. The Coach grades it; the scenario's best reply is shown as one strong answer.
 */

export type RizzPuzzle = {
  id: string,
  scenarioId: string,
  turn: number,
  rating: number,
  /** The conversation before the decision: `mine` are the player's lines. */
  history: {text: string, mine: boolean}[],
  setting: string,
  title: string
};

export function puzzleId(scenarioId: string, turn: number) {
  return `${scenarioId}/${turn}`;
}

function puzzleRating(turn: RizzTurn, turnIndex: number) {
  const scores = turn.options.map((option) => option.score).sort((a, b) => b - a);
  const gap = scores[0] - scores[1];
  let rating = 500 + turnIndex * 90 + (200 - Math.min(gap, 200)) * 5;
  if(bestOption(turn).brilliant) rating += 350;
  if(turn.opening) rating += 100;
  return Math.round(rating);
}

let puzzleCache: RizzPuzzle[];
export function buildPuzzles(): RizzPuzzle[] {
  return puzzleCache ??= SCENARIOS.flatMap((scenario) => {
    const history: RizzPuzzle['history'] = [];
    if(scenario.opener) history.push({text: scenario.opener, mine: false});

    return scenario.turns.map((turn, index) => {
      if(index > 0) {
        history.push({text: bestOption(scenario.turns[index - 1]).text, mine: true});
        history.push({text: turn.them[0], mine: false});
      }

      return {
        id: puzzleId(scenario.id, index),
        scenarioId: scenario.id,
        turn: index,
        rating: puzzleRating(turn, index),
        history: history.slice(),
        setting: scenario.setting,
        title: scenario.title
      };
    });
  });
}

export function getPuzzle(id: string) {
  return buildPuzzles().find((puzzle) => puzzle.id === id);
}

export function puzzleTurn(puzzle: RizzPuzzle) {
  return getScenario(puzzle.scenarioId).turns[puzzle.turn];
}

/** The next rated puzzle: the unsolved one closest to the player's puzzle rating. */
export function pickPuzzle(rating: number, solved: Set<string>, exclude?: string) {
  const pool = buildPuzzles().filter((puzzle) => puzzle.id !== exclude);
  const unsolved = pool.filter((puzzle) => !solved.has(puzzle.id));
  const candidates = unsolved.length ? unsolved : pool;
  return candidates.reduce((best, puzzle) => Math.abs(puzzle.rating - rating) < Math.abs(best.rating - rating) ? puzzle : best);
}

/** The Puzzle Rush ladder: easy to hard, shuffled within bands so no two runs are alike. */
export function rushLadder(random: () => number = Math.random) {
  const sorted = buildPuzzles().slice().sort((a, b) => a.rating - b.rating);
  const bands: RizzPuzzle[][] = [];
  for(let i = 0; i < sorted.length; i += 6) bands.push(shuffle(sorted.slice(i, i + 6), random));
  return bands.flat();
}

export function dayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function dailyPuzzle(date = new Date()) {
  const puzzles = buildPuzzles();
  return puzzles[hashString(dayKey(date)) % puzzles.length];
}

/*
 * Randomness.
 */

export function hashString(value: string) {
  let hash = 2166136261;
  for(let i = 0; i < value.length; ++i) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** mulberry32: a small seeded generator, so leaderboards and leagues are stable between visits. */
export function seededRandom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: T[], random: () => number = Math.random) {
  const result = items.slice();
  for(let i = result.length - 1; i > 0; --i) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
