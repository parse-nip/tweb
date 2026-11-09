import {describe, expect, it} from 'vitest';
import {
  bestOption, buildPuzzles, classifyMove, dailyPuzzle, estimateGameRating, getScenarios, GHOST_EVAL, newGame,
  playMove, rushLadder, summarizeGame, updateRating, winProbability, getPuzzle, isPuzzleSolved, puzzleTurn
} from '@components/rizz/engine';
import LESSONS from '@components/rizz/content/lessons';

const playBest = (scenarioId: string, difficulty: number) => {
  let state = newGame(scenarioId, difficulty);
  while(!state.over) {
    const turn = getScenarios().find((s) => s.id === scenarioId).turns[state.turn];
    state = playMove(state, turn.options.indexOf(bestOption(turn)));
  }
  return state;
};

const playWorst = (scenarioId: string) => {
  let state = newGame(scenarioId, 1);
  while(!state.over) {
    const turn = getScenarios().find((s) => s.id === scenarioId).turns[state.turn];
    const worst = turn.options.reduce((a, b) => b.score < a.score ? b : a);
    state = playMove(state, turn.options.indexOf(worst));
  }
  return state;
};

describe('rizz content', () => {
  for(const scenario of getScenarios()) {
    describe(scenario.id, () => {
      it('has a mood triple on every turn after the first, and four options everywhere', () => {
        scenario.turns.forEach((turn, index) => {
          expect(turn.options).toHaveLength(4);
          if(index) expect(turn.them).toHaveLength(3);
          else expect(turn.them).toBeUndefined();
        });
      });

      it('marks a brilliant reply only where it is the single best one', () => {
        for(const turn of scenario.turns) {
          for(const option of turn.options.filter((option) => option.brilliant)) {
            expect(bestOption(turn)).toBe(option);
            expect(turn.options.filter((other) => other.score === option.score)).toHaveLength(1);
          }
        }
      });

      it('is a date along the best line, even against the grandmistress', () => {
        expect(playBest(scenario.id, 1.75).result).toBe('win');
      });

      it('ghosts the worst line before the end', () => {
        const state = playWorst(scenario.id);
        expect(state.result).toBe('loss');
        expect(state.evaluation).toBeLessThanOrEqual(GHOST_EVAL);
        expect(state.moves.length).toBeLessThan(scenario.turns.length);
      });
    });
  }
});

describe('rizz engine', () => {
  it('classifies the best, the book and the blunder', () => {
    const turn = getScenarios()[0].turns[0];
    expect(classifyMove(turn, turn.options[2])).toBe('brilliant');
    expect(classifyMove(turn, turn.options[0])).toBe('book');
    expect(classifyMove(turn, turn.options[3])).toBe('blunder');
  });

  it('calls a non-move on an opening a miss', () => {
    const turn = getScenarios()[0].turns[2];
    expect(turn.opening).toBe(true);
    expect(classifyMove(turn, turn.options[0])).toBe('miss');
  });

  it('gives a perfect game ~100% accuracy and a high game rating', () => {
    const summary = summarizeGame(playBest('gym', 1).moves);
    expect(summary.accuracy).toBeGreaterThan(99);
    expect(estimateGameRating(summary.accuracy)).toBeGreaterThan(2600);
  });

  it('moves Elo toward the result', () => {
    expect(updateRating(1200, 1200, 1, 20)).toBe(1212);
    expect(updateRating(1200, 1200, 0, 20)).toBe(1188);
    expect(updateRating(1200, 1200, 0.5, 20)).toBe(1200);
  });

  it('is even at a level vibe', () => {
    expect(winProbability(0)).toBe(0.5);
  });
});

describe('rizz puzzles', () => {
  it('cuts one puzzle out of every turn, solvable by its best reply', () => {
    const puzzles = buildPuzzles();
    expect(puzzles).toHaveLength(getScenarios().reduce((sum, s) => sum + s.turns.length, 0));
    for(const puzzle of puzzles) {
      const turn = puzzleTurn(puzzle);
      expect(isPuzzleSolved(puzzle, turn.options.indexOf(bestOption(turn)))).toBe(true);
      expect(puzzle.history[puzzle.history.length - 1]?.mine ?? false).toBe(false);
    }
  });

  it('every lesson drill exists', () => {
    for(const lesson of LESSONS) {
      for(const id of lesson.drill) expect(getPuzzle(id), id).toBeTruthy();
    }
  });

  it('has a stable daily puzzle and a rush ladder that climbs', () => {
    const date = new Date(2026, 10, 9);
    expect(dailyPuzzle(date).id).toBe(dailyPuzzle(date).id);
    const ladder = rushLadder(() => 0.5);
    expect(ladder[0].rating).toBeLessThanOrEqual(ladder[ladder.length - 1].rating);
  });
});
