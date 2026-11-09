import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {parseModelJson} from '@lib/rizz/openrouter';
import {getAccuracy, getAverageElo, isRizzRating, clampElo} from '@lib/rizz/ratings';
import {getCachedVerdict, setCachedVerdicts, clearRatingCache} from '@lib/rizz/ratingCache';
import {classifyLines} from '@lib/rizz/classifier';
import {getPersonaReply, createSimulation} from '@lib/rizz/simulator';
import {getRizzSuggestion, stripDraftEcho} from '@lib/rizz/suggest';
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

  it('asks a decisions model (Jev) one question per message and reads label and strength', async() => {
    setRizzSettings({classifierModel: 'typesafe/jev-1.13'});
    const fetchMock = vi.fn(async() => ({ok: true, status: 200, json: async() => ({answers: {
      rating: {type: 'choice', choice: 'brilliant', confidence: 0.81},
      strength: {type: 'score', score: 3}
    }})}));
    vi.stubGlobal('fetch', fetchMock);

    const verdicts = await classifyLines([{mid: 1, out: false, text: 'hi'}, {mid: 2, out: true, text: 'tea this weekend?'}], [2]);
    expect(verdicts.get(2)).toMatchObject({rating: 'brilliant', elo: 2600});
    const call = fetchMock.mock.calls[0] as any;
    expect(call[0]).toBe('https://openrouter.ai/api/alpha/decisions');
    const request = JSON.parse(call[1].body);
    expect(request.model).toBe('typesafe/jev-1.13');
    expect(request.state.graded_message).toBe('tea this weekend?');
    expect(Object.keys(request.questions.rating.criteria)).toContain('checkmate');
  });

  it('joins a continuation to the draft and strips quotes', async() => {
    mockCompletion('"and you owe me tea"');
    expect(await getRizzSuggestion({lines: [], draft: 'chapter two'})).toBe(' and you owe me tea');

    mockCompletion('. Deal');
    expect(await getRizzSuggestion({lines: [], draft: 'tea this weekend'})).toBe('. Deal');

    mockCompletion('haha deal');
    expect(await getRizzSuggestion({lines: [{mid: 1, out: false, text: 'tea?'}], draft: ''})).toBe('haha deal');
  });

  it('drops the draft a model repeats at the start of a continuation', async() => {
    expect(stripDraftEcho('hey bbg', 'hey bbg wanna hear my mix?')).toBe(' wanna hear my mix?');
    expect(stripDraftEcho('tea sounds good, ', 'Tea sounds good, what kind of tea?')).toBe(' what kind of tea?');
    expect(stripDraftEcho('so about this weekend', 'about this weekend I was thinking tea')).toBe(' I was thinking tea');
    expect(stripDraftEcho('hello', 'what are you up to')).toBe('what are you up to');
    expect(stripDraftEcho('what kind of tea do you drink ', 'are you always this sarcastic? 😂 what kind of tea do you drink')).toBe('');
    expect(stripDraftEcho('tea?', 'sure, tea? my treat')).toBe(' my treat');

    mockCompletion('hey bbg wanna hear my bedroom mix?');
    expect(await getRizzSuggestion({lines: [], draft: 'hey bbg'})).toBe(' wanna hear my bedroom mix?');
    mockCompletion('hey bbg');
    expect(await getRizzSuggestion({lines: [], draft: 'hey bbg'})).toBe('');
  });

  it('never shows raw JSON as a message, even from a broken answer', async() => {
    const {parsePersonaAnswer} = await import('@lib/rizz/simulator');
    expect(parsePersonaAnswer('{"replies":["Lol, you\'re easily impressed then. What else is new?"],"interest":40..100":40}'))
    .toEqual({replies: ['Lol, you\'re easily impressed then. What else is new?'], interest: 40});
    expect(parsePersonaAnswer('{"replies":["a","b"],"interest":55}')).toEqual({replies: ['a', 'b'], interest: 55});
    expect(parsePersonaAnswer('```json\n{"replies":["x"]}\n```').replies).toEqual(['x']);
    expect(parsePersonaAnswer('{"replies":[').replies).toEqual([]);
    expect(parsePersonaAnswer('just text')).toEqual({replies: ['just text']});
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

describe('rizz Elo and checkmate', () => {
  it('moves the Elo by the label against the opponent and ends the game on a checkmate or a resign', async() => {
    const {updateElo, getExpectedScore} = await import('@lib/rizz/elo');
    const {createSimulation, applyVerdict, applyInterest, getOpponentElo} = await import('@lib/rizz/simulator');

    expect(getExpectedScore(1000, 1000)).toBeCloseTo(0.5);
    expect(updateElo(800, 1000, 'brilliant', 0).delta).toBeGreaterThan(20);
    expect(updateElo(800, 1000, 'blunder', 0).delta).toBeLessThan(-5);
    expect(updateElo(1000, 1000, 'book', 20).delta).toBe(0);
    // a beaten stronger opponent is worth more than a beaten weaker one
    expect(updateElo(800, 1500, 'great', 20).delta).toBeGreaterThan(updateElo(800, 600, 'great', 20).delta);

    const state = createSimulation('flirt', 'hard');
    expect(getOpponentElo(state)).toBe(1900);
    const good = applyVerdict(state, {rating: 'great', elo: 1800});
    expect(good.state.elo).toBeGreaterThan(state.elo);
    expect(good.state.moves).toBe(1);
    expect(good.state.ending).toBeUndefined();
    expect(applyVerdict(state, {rating: 'checkmate', elo: 2800}).state.ending).toBe('checkmate');
    expect(applyVerdict(state, {rating: 'resign', elo: 100}).state.ending).toBe('resign');
    expect(applyInterest(state, 96).ending).toBe('checkmate');
    expect(applyInterest(state, 86).ending).toBe('checkmate');
    expect(applyInterest(state, 50, 'won').ending).toBe('checkmate');
    expect(applyInterest(state, 50, 'lost').ending).toBe('left-on-read');
    expect(applyInterest(state, 0).ending).toBe('left-on-read');
    expect(applyInterest(state, 60).ending).toBeUndefined();
    expect(applyInterest(state, 60, 'continue').ending).toBeUndefined();

    const {calibrate} = await import('@lib/rizz/classifier');
    // an unsure Miss between Good and Great is not a Miss
    expect(calibrate({miss: 0.33, good: 0.32, great: 0.3}, 'miss')).not.toBe('miss');
    expect(calibrate({blunder: 0.4, mistake: 0.4, inaccuracy: 0.2}, 'blunder')).toBe('mistake');
  });
});
