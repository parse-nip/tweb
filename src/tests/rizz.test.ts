import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {parseModelJson} from '@lib/rizz/openrouter';
import {getAccuracy, getAverageElo, isRizzRating, clampElo} from '@lib/rizz/ratings';
import {getCachedVerdict, setCachedVerdicts, clearRatingCache} from '@lib/rizz/ratingCache';
import {classifyLines} from '@lib/rizz/classifier';
import {getPersonaReply, createSimulation} from '@lib/rizz/simulator';
import {getRizzSuggestion} from '@lib/rizz/suggest';
import {setRizzSettings} from '@lib/rizz/settings';

function mockCompletion(content: string) {
  const fetchMock = vi.fn(async() => ({ok: true, status: 200, json: async() => ({choices: [{message: {content}}]})}));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('rizz coach', () => {
  beforeEach(() => {
    localStorage.clear();
    setRizzSettings({apiKey: 'sk-test', classifierModel: 'classifier/model', fastModel: 'fast/model'});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearRatingCache();
  });

  it('reads JSON out of a fenced or chatty answer', () => {
    expect(parseModelJson('```json\n{"a":1}\n```')).toEqual({a: 1});
    expect(parseModelJson('Sure! {"a":[1,2]} hope it helps')).toEqual({a: [1, 2]});
    expect(parseModelJson('no json here')).toBeUndefined();
    expect(parseModelJson('{broken')).toBeUndefined();
  });

  it('scores accuracy and Elo and clamps strange values', () => {
    expect(getAccuracy([])).toBe(0);
    expect(getAccuracy([{rating: 'brilliant', elo: 2000}, {rating: 'blunder', elo: 200}])).toBe(50);
    expect(getAverageElo([{rating: 'good', elo: 1000}, {rating: 'good', elo: 1200}])).toBe(1100);
    expect(clampElo(99999)).toBe(3000);
    expect(clampElo('abc')).toBe(800);
    expect(isRizzRating('blunder')).toBe(true);
    expect(isRizzRating('fantastic')).toBe(false);
  });

  it('keeps verdicts per chat and drops one when the text was edited', () => {
    setCachedVerdicts('1', new Map([[5, {verdict: {rating: 'great', elo: 1800, reason: 'witty'}, text: 'hello there'}]]));
    expect(getCachedVerdict('1', 5, 'hello there')).toEqual({rating: 'great', elo: 1800, reason: 'witty'});
    expect(getCachedVerdict('1', 5, 'hello there!')).toBeUndefined();
    expect(getCachedVerdict('2', 5, 'hello there')).toBeUndefined();
  });

  it('grades only the asked messages, with the classifier model, and ignores unknown labels', async() => {
    const fetchMock = mockCompletion(JSON.stringify({grades: [
      {mid: 2, rating: 'Brilliant', elo: 2500, reason: 'witty'},
      {mid: 3, rating: 'legendary', elo: 1000},
      {mid: 1, rating: 'good', elo: 1000}
    ]}));

    const verdicts = await classifyLines([
      {mid: 1, out: false, text: 'hi'},
      {mid: 2, out: true, text: 'you gave me mystery-novel energy'},
      {mid: 3, out: false, text: 'ok'}
    ], [2, 3]);

    expect([...verdicts.keys()]).toEqual([2]);
    expect(verdicts.get(2)).toMatchObject({rating: 'brilliant', elo: 2500});
    const request = JSON.parse((fetchMock.mock.calls[0] as any)[1].body);
    expect(request.model).toBe('classifier/model');
    expect((fetchMock.mock.calls[0] as any)[1].headers.Authorization).toBe('Bearer sk-test');
  });

  it('joins a continuation to the draft and strips quotes', async() => {
    mockCompletion('"and you owe me tea"');
    expect(await getRizzSuggestion({lines: [], draft: 'chapter two'})).toBe(' and you owe me tea');

    mockCompletion('. Deal');
    expect(await getRizzSuggestion({lines: [], draft: 'tea this weekend'})).toBe('. Deal');

    mockCompletion('haha deal');
    expect(await getRizzSuggestion({lines: [{mid: 1, out: false, text: 'tea?'}], draft: ''})).toBe('haha deal');
  });

  it('takes the persona\'s replies and clamps its interest, and survives a model that ignores JSON', async() => {
    const state = createSimulation('sarcastic', 'hard');
    state.messages.push({id: 1, from: 'me', text: 'hey'});

    mockCompletion('{"replies":["oh wow","a greeting"," "],"interest":140}');
    expect(await getPersonaReply(state)).toEqual({replies: ['oh wow', 'a greeting'], interest: 100});

    mockCompletion('just plain text');
    expect(await getPersonaReply(state)).toEqual({replies: ['just plain text'], interest: state.interest});
  });
});
