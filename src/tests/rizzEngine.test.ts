import {describe, expect, it} from 'vitest';
import {
  bestOption, buildPuzzles, dailyPuzzle, getPuzzle, getScenarios, isSolvingVerdict, puzzleTurn, resultOfEnding, rushLadder,
  updateRating
} from '@components/rizz/engine';
import LESSONS from '@components/rizz/content/lessons';
import {buildBots} from '@components/rizz/content/bots';
import {RIZZ_PERSONAS} from '@lib/rizz/personas';

describe('rizz content', () => {
  for(const scenario of getScenarios()) {
    it(`${scenario.id}: four replies on every turn, a mood triple after the first`, () => {
      scenario.turns.forEach((turn, index) => {
        expect(turn.options).toHaveLength(4);
        if(index) expect(turn.them).toHaveLength(3);
        else expect(turn.them).toBeUndefined();
      });
    });
  }

  it('plays every Rizz Coach persona as a bot, weakest first', () => {
    const bots = buildBots();
    expect(bots.map((bot) => bot.id).sort()).toEqual(RIZZ_PERSONAS.map((persona) => persona.id).sort());
    expect(bots.map((bot) => bot.rating)).toEqual([...bots.map((bot) => bot.rating)].sort((a, b) => a - b));
  });

  it('matches the player with the opposite sex', () => {
    expect(buildBots('woman').every((bot) => bot.gender === 'woman')).toBe(true);
    expect(buildBots('man').map((bot) => bot.name)).toContain('Milo');
    expect(new Set(buildBots().map((bot) => bot.gender)).size).toBe(2);
  });
});

describe('rizz game rules', () => {
  it('reads the simulator\'s endings as results', () => {
    expect(resultOfEnding('checkmate')).toEqual({result: 'win', reason: 'date'});
    expect(resultOfEnding('left-on-read')).toEqual({result: 'loss', reason: 'ghosted'});
    expect(resultOfEnding('resign')).toEqual({result: 'loss', reason: 'resigned'});
  });

  it('moves Elo toward the result', () => {
    expect(updateRating(1200, 1200, 1, 20)).toBe(1212);
    expect(updateRating(1200, 1200, 0, 20)).toBe(1188);
    expect(updateRating(1200, 1200, 0.5, 20)).toBe(1200);
  });

  it('solves a puzzle with Excellent and up', () => {
    expect(isSolvingVerdict({rating: 'excellent', elo: 1500})).toBe(true);
    expect(isSolvingVerdict({rating: 'checkmate', elo: 2500})).toBe(true);
    expect(isSolvingVerdict({rating: 'good', elo: 1100})).toBe(false);
  });
});

describe('rizz puzzles', () => {
  it('cuts one puzzle out of every turn, ending on their message', () => {
    const puzzles = buildPuzzles();
    expect(puzzles).toHaveLength(getScenarios().reduce((sum, s) => sum + s.turns.length, 0));
    for(const puzzle of puzzles) {
      expect(bestOption(puzzleTurn(puzzle)).text).toBeTruthy();
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
