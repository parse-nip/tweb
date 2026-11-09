/*
 * Stockfizz — the game's engine. Pure functions only: no DOM, no storage, so it is unit-tested
 * (`src/tests/rizzEngine.test.ts`) and shared by games, reviews, puzzles and the rush.
 *
 * Chess.com's ideas, mapped onto a conversation:
 *  - evaluation: "vibe" in centipawns, the sum of the replies' scores scaled by the opponent's
 *    difficulty; the vibe bar is its win probability;
 *  - move classification (Brilliant … Blunder) from the points a reply lost against the best one;
 *  - accuracy from the win probability each reply gave away (chess.com's CAPS2-style curve);
 *  - Elo ratings for games and puzzles, a "game rating" estimated from accuracy.
 */

import SCENARIOS from '@components/rizz/content/scenarios';
import type {RizzMood, RizzOption, RizzScenario, RizzTurn} from '@components/rizz/content/types';

export type RizzResult = 'win' | 'draw' | 'loss';
export type RizzEndReason = 'date' | 'friendzone' | 'ghosted' | 'timeout' | 'resigned' | 'agreed';

export type RizzClassification =
  'brilliant' | 'great' | 'best' | 'excellent' | 'good' | 'book' |
  'inaccuracy' | 'mistake' | 'miss' | 'blunder';

export const CLASSIFICATIONS: {
  [key in RizzClassification]: {label: string, symbol: string, color: string}
} = {
  brilliant: {label: 'Brilliant', symbol: '!!', color: '#1baca6'},
  great: {label: 'Great', symbol: '!', color: '#5c8bb0'},
  best: {label: 'Best', symbol: '★', color: '#81b64c'},
  excellent: {label: 'Excellent', symbol: '👍', color: '#81b64c'},
  good: {label: 'Good', symbol: '✓', color: '#95b776'},
  book: {label: 'Book', symbol: '📖', color: '#a88865'},
  inaccuracy: {label: 'Inaccuracy', symbol: '?!', color: '#f7c631'},
  mistake: {label: 'Mistake', symbol: '?', color: '#ffa459'},
  miss: {label: 'Miss', symbol: '✕', color: '#ff7769'},
  blunder: {label: 'Blunder', symbol: '??', color: '#fa412d'}
};

export const CLASSIFICATION_ORDER = Object.keys(CLASSIFICATIONS) as RizzClassification[];

/** Vibe below this after any reply and they stop answering. */
export const GHOST_EVAL = -600;

/** A reply that keeps the game alive but does nothing: what a "Miss" may score at most. */
const MISS_MAX_SCORE = 30;

export function getScenario(id: string) {
  return SCENARIOS.find((scenario) => scenario.id === id);
}

export function getScenarios() {
  return SCENARIOS;
}

/**
 * The opponent's difficulty applied to a raw score: harder opponents are less impressed by a good
 * reply and more put off by a bad one.
 */
export function adjustScore(score: number, difficulty: number) {
  return Math.round(score >= 0 ? score * Math.pow(1 / difficulty, 0.6) : score * difficulty);
}

/** How a reply landed — picks which of their three answers comes next. */
export function moodFor(delta: number): RizzMood {
  if(delta >= 60) return 0;
  if(delta >= -60) return 1;
  return 2;
}

/** Win probability in [0, 1] for an evaluation, as the vibe bar shows it. */
export function winProbability(evaluation: number) {
  return 1 / (1 + Math.exp(-evaluation / 250));
}

/** The vibe a game must end on to be a date. Harder opponents need a better game. */
export function winThreshold(difficulty: number) {
  return Math.round(250 * difficulty);
}

export function resultFor(evaluation: number, difficulty: number): RizzResult {
  if(evaluation >= winThreshold(difficulty)) return 'win';
  if(evaluation <= -150) return 'loss';
  return 'draw';
}

export function bestOption(turn: RizzTurn) {
  return turn.options.reduce((best, option) => option.score > best.score ? option : best);
}

export function classifyMove(turn: RizzTurn, chosen: RizzOption): RizzClassification {
  const best = bestOption(turn);
  const loss = best.score - chosen.score;

  if(chosen.brilliant && loss === 0) return 'brilliant';
  if(chosen.book) return 'book';
  if(loss === 0) {
    const second = Math.max(...turn.options.filter((option) => option !== chosen).map((option) => option.score));
    // the only good reply in the position
    return chosen.score - second >= 80 ? 'great' : 'best';
  }

  if(loss > 350) return 'blunder';
  if(turn.opening && chosen.score <= MISS_MAX_SCORE) return 'miss';
  if(loss <= 40) return 'excellent';
  if(loss <= 100) return 'good';
  if(loss <= 200) return 'inaccuracy';
  return 'mistake';
}

/**
 * A reply's accuracy, 0…100, from the win probability it gave away against the best reply (in
 * percentage points) — the shape chess.com's accuracy uses.
 */
export function moveAccuracy(evalBefore: number, chosenDelta: number, bestDelta: number) {
  const lost = Math.max(0, winProbability(evalBefore + bestDelta) - winProbability(evalBefore + chosenDelta)) * 100;
  const accuracy = 103.1668 * Math.exp(-0.04354 * lost) - 3.1669;
  return Math.max(0, Math.min(100, accuracy));
}

/** "Game Rating" in the review: the rating a player of this accuracy would have. */
export function estimateGameRating(accuracy: number) {
  return Math.round(Math.max(100, Math.min(3000, 400 + (accuracy - 40) * 45)));
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

export function difficultyForRating(rating: number) {
  return Math.max(0.5, Math.min(1.9, 0.45 + rating / 1300));
}

/*
 * Games.
 */

export type RizzMoveRecord = {
  turn: number,
  /** Index into the turn's options. */
  option: number,
  /** Their message before this reply ('' on the opener). */
  them: string,
  delta: number,
  bestDelta: number,
  evalBefore: number,
  evalAfter: number,
  classification: RizzClassification,
  accuracy: number,
  spentMs: number
};

export type RizzGameState = {
  scenarioId: string,
  difficulty: number,
  evaluation: number,
  turn: number,
  /** Their message the current turn answers. */
  them: string,
  moves: RizzMoveRecord[],
  over: boolean,
  result?: RizzResult,
  reason?: RizzEndReason
};

export function newGame(scenarioId: string, difficulty: number): RizzGameState {
  const scenario = getScenario(scenarioId);
  return {
    scenarioId,
    difficulty,
    evaluation: 0,
    turn: 0,
    them: scenario.opener || '',
    moves: [],
    over: false
  };
}

/** Plays a reply and returns the next state, with their answer in `them` (or the game over). */
export function playMove(state: RizzGameState, optionIndex: number, spentMs = 0): RizzGameState {
  const scenario = getScenario(state.scenarioId);
  const turn = scenario.turns[state.turn];
  const chosen = turn.options[optionIndex];
  const delta = adjustScore(chosen.score, state.difficulty);
  const bestDelta = adjustScore(bestOption(turn).score, state.difficulty);
  const evalAfter = state.evaluation + delta;

  const move: RizzMoveRecord = {
    turn: state.turn,
    option: optionIndex,
    them: state.them,
    delta,
    bestDelta,
    evalBefore: state.evaluation,
    evalAfter,
    classification: classifyMove(turn, chosen),
    accuracy: moveAccuracy(state.evaluation, delta, bestDelta),
    spentMs
  };

  const next: RizzGameState = {
    ...state,
    evaluation: evalAfter,
    turn: state.turn + 1,
    moves: [...state.moves, move]
  };

  if(evalAfter <= GHOST_EVAL) {
    return endGame(next, 'loss', 'ghosted');
  }

  const nextTurn = scenario.turns[next.turn];
  if(!nextTurn) {
    const result = resultFor(evalAfter, state.difficulty);
    return endGame(next, result, result === 'win' ? 'date' : result === 'draw' ? 'friendzone' : 'ghosted');
  }

  next.them = nextTurn.them[moodFor(delta)];
  return next;
}

export function endGame(state: RizzGameState, result: RizzResult, reason: RizzEndReason): RizzGameState {
  return {...state, over: true, result, reason};
}

/** Their last word, when the game ends on the board rather than on the clock or a resignation. */
export function endingMessage(state: Pick<RizzGameState, 'scenarioId' | 'result' | 'reason'>) {
  if(state.reason === 'timeout' || state.reason === 'resigned' || state.reason === 'agreed') return;
  const scenario = getScenario(state.scenarioId);
  return scenario.endings[state.result];
}

/** Draw offer ("let's be friends"): accepted when the game is level. */
export function acceptsDraw(state: RizzGameState) {
  return Math.abs(state.evaluation) <= 150 || state.evaluation < -150;
}

export type RizzGameSummary = {
  accuracy: number,
  gameRating: number,
  counts: {[key in RizzClassification]: number}
};

export function summarizeGame(moves: RizzMoveRecord[]): RizzGameSummary {
  const counts = Object.fromEntries(CLASSIFICATION_ORDER.map((key) => [key, 0])) as RizzGameSummary['counts'];
  moves.forEach((move) => counts[move.classification]++);
  const accuracy = moves.length ? moves.reduce((sum, move) => sum + move.accuracy, 0) / moves.length : 0;
  return {
    accuracy: Math.round(accuracy * 10) / 10,
    gameRating: estimateGameRating(accuracy),
    counts
  };
}

/*
 * Puzzles — every turn of every scenario, played along the best line.
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

function puzzleRating(scenario: RizzScenario, turnIndex: number) {
  const turn = scenario.turns[turnIndex];
  const scores = turn.options.map((option) => option.score).sort((a, b) => b - a);
  const gap = scores[0] - scores[1];
  const best = bestOption(turn);
  let rating = 500 + turnIndex * 90 + (200 - Math.min(gap, 200)) * 5;
  if(best.brilliant) rating += 350;
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
        rating: puzzleRating(scenario, index),
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

export function isPuzzleSolved(puzzle: RizzPuzzle, optionIndex: number) {
  const turn = puzzleTurn(puzzle);
  return turn.options[optionIndex] === bestOption(turn);
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

/** The order a turn's options are shown in during one game — stable for that game and turn. */
export function optionOrder(turn: RizzTurn, seed: number) {
  return shuffle(turn.options.map((_, index) => index), seededRandom(seed));
}
