import {openRouterComplete, openRouterDecide, parseModelJson, RizzDecisionQuestions} from '@lib/rizz/openrouter';
import {clampElo, getRizzRatingDef, isRizzRating, RIZZ_RATINGS, type RizzRating, RizzVerdict} from '@lib/rizz/ratings';
import {getRizzSettings} from '@lib/rizz/settings';

export type RizzLine = {
  mid: number,
  /** written by the user (true) or by the other person (false) */
  out: boolean,
  text: string
};

const SYSTEM_PROMPT = `You are a chess-style texting analyst, like r/TextingTheory. You grade every message of a conversation the way a chess engine grades moves, judging how well each message plays in its position: how it lands on the person who reads it, whether it moves the conversation forward, humour, warmth, confidence, timing, and whether it answers what was said before it.

Labels, best to worst:
${RIZZ_RATINGS.map((def) => `- ${def.id}: ${def.hint}`).join('\n')}

Rules:
- Grade EVERY message in "grade", for both sides: USER lines are the player's, THEM lines the other person's. Keep straight who said what — a joke or a detail belongs to whoever wrote that line.
- Be strict and calibrated, like an engine: about half of all messages are "good" or "book"; "excellent" and "great" are earned; "brilliant" is maybe one message in thirty.
- Severity, worst first: "blunder" ONLY for messages that are rude, insulting, hostile, threatening, sexual without invitation, or desperate begging — the kind that ends a chat with anyone. A misjudged plan, a misread of what they said, a wrong guess or an awkward joke is never a blunder: a small slip is "inaccuracy", a pushy, presumptuous or confusing one is "mistake", ignoring what they offered is "miss".
- Read like a socially smart person: recognise jokes, wordplay, teasing and callbacks to earlier details (a pun on what they just said, a joke that plays on their job, like needing to get hurt to see a nurse) and credit them. A playful or dark joke is not a blunder unless a reasonable person would actually be hurt or alarmed.
- When "their reaction" to a message is given, it is evidence of how the message landed: a message they warmly took up cannot be a mistake, one that clearly put them off cannot be great. But grade the message, not their temperament: someone who overthinks or is hard to get reacts nervously to good messages too, and a misunderstanding that is plainly theirs is not the user's fault.
- Asking them out, or proposing a time, when the vibe is warm is good play, not a mistake; doing it cold, or pushing past a no, is.
- Judge by what the text says in context; ignore typos unless they change the meaning. The language of the chat may not be English.
- "elo" is the estimated chess Elo of the message (100..3000): a plain "hey" is ~400-800, an average reply ~1000-1400, a sharp, witty or emotionally intelligent one 1800+, a brilliant one 2400+.
- "reason" is at most 14 words, about THIS message, naming what made it land or miss.
- "better" (for the user's messages graded below "excellent") is the message they could have sent instead, in their voice, under 20 words; omit it otherwise.
Answer with JSON only: {"grades":[{"mid":<number>,"rating":"<label>","elo":<number>,"reason":"<short>","better":"<optional>"}]}`;

/** What the grader is told besides the chat: where it happens, who the other person is, how they took the message. */
export type RizzGradeContext = {
  setting?: string,
  them?: string,
  /** their answer to the message being graded: how it landed */
  reaction?: string
};

/** Jev and the rest of TypeSafe's models decide (probabilities) instead of chatting. */
export const isDecisionsModel = (model: string) => /^~?typesafe\/jev/i.test(model);

const ELO_ANCHORS = [
  'A bare greeting or a dead-end reply, around 400 Elo',
  'An ordinary, fine reply, around 1000 Elo',
  'A sharp, warm or witty message, around 1800 Elo',
  'An exceptional message that turns the whole chat, around 2600 Elo'
];

export function calibrate(probabilities: Record<string, number> | undefined, rating: RizzRating): RizzRating {
  const inPlay = Object.entries(probabilities || {}).filter(([id, probability]) => probability >= 0.08 && isRizzRating(id));
  const total = inPlay.reduce((sum, [, probability]) => sum + probability, 0);
  if(!total) return rating;
  const expected = inPlay.reduce((sum, [id, probability]) => sum + probability * getRizzRatingDef(id).accuracy, 0) / total;
  let best = rating, distance = Infinity;
  for(const [id] of inPlay) {
    if(id === 'checkmate' || id === 'resign') continue;
    const gap = Math.abs(getRizzRatingDef(id).accuracy - expected);
    if(gap < distance) {
      distance = gap;
      best = id as RizzRating;
    }
  }

  return best;
}

async function decideLine(lines: RizzLine[], mid: number, model: string, signal?: AbortSignal): Promise<RizzVerdict | undefined> {
  const line = lines.find((other) => other.mid === mid);
  const earlier = lines.filter((other) => other.mid < mid).slice(-14);
  const questions: RizzDecisionQuestions = {
    rating: {
      type: 'choice',
      instructions: 'How well does the graded message play in its position, the way a chess engine grades a move? Judge how it lands on the person reading it, whether it moves the conversation forward, humour, warmth, confidence, timing, and whether it answers what came before. Most messages are good or book; brilliant, checkmate and blunder are rare.',
      criteria: Object.fromEntries(RIZZ_RATINGS.map((def) => [def.id, def.hint]))
    },
    strength: {
      type: 'score',
      instructions: 'How strong is the graded message, as the chess Elo of the move?',
      criteria: ELO_ANCHORS
    }
  };

  const answer = await openRouterDecide({
    model,
    signal,
    questions,
    state: {
      conversation_before: earlier.map((other) => `${other.out ? 'me' : 'them'}: ${other.text.replace(/\s+/g, ' ').slice(0, 400)}`).join('\n') || '(this is the first message)',
      graded_message_sender: line.out ? 'me' : 'them',
      graded_message: line.text.replace(/\s+/g, ' ').slice(0, 600)
    }
  });

  let rating = answer?.answers?.rating?.choice;
  if(!isRizzRating(rating)) return;
  // an unsure call is not a verdict: it moves to the label nearest the probability-weighted result of the labels in play
  const confidence = Number(answer.answers.rating.confidence);
  if(confidence < 0.5 && rating !== 'checkmate' && rating !== 'resign') rating = calibrate(answer.answers.rating.probabilities, rating);
  const score = Number(answer.answers.strength?.score);
  return {
    rating,
    // score 0..3 on the anchors above: 400..2600
    elo: clampElo(Number.isFinite(score) ? 400 + (score / 3) * 2200 : undefined),
    reason: getRizzRatingDef(rating).title + (answer.answers.rating.confidence >= 0 ? ` · ${Math.round(answer.answers.rating.confidence * 100)}% sure` : '')
  };
}

export async function classifyLines(lines: RizzLine[], gradeMids: number[], signal?: AbortSignal, context?: RizzGradeContext) {
  const model = getRizzSettings().classifierModel;
  if(isDecisionsModel(model)) {
    const verdicts = new Map<number, RizzVerdict>();
    // a few at a time: each message is its own (very cheap) question
    for(let i = 0; i < gradeMids.length; i += 4) {
      await Promise.all(gradeMids.slice(i, i + 4).map(async(mid) => {
        const verdict = await decideLine(lines, mid, model, signal).catch((err) => {
          if(signal?.aborted) throw err;
          console.warn('[rizz] decision failed', err);
        });
        if(verdict) verdicts.set(mid, verdict);
      }));
    }

    return verdicts;
  }

  return classifyLinesWithChat(lines, gradeMids, signal, context);
}

async function classifyLinesWithChat(lines: RizzLine[], gradeMids: number[], signal?: AbortSignal, context: RizzGradeContext = {}) {
  const grade = new Set(gradeMids);
  // * each side named outright: with "me" and "them" the grader lost track of who said what
  const transcript = lines.map((line) => `[${line.mid}] ${line.out ? 'USER' : 'THEM'}: ${line.text.replace(/\s+/g, ' ').slice(0, 600)}`).join('\n');
  const answer = await openRouterComplete({
    model: getRizzSettings().classifierModel,
    temperature: 0.2,
    // a reasoning model spends tokens thinking before the JSON
    maxTokens: 1500 + gradeMids.length * 80,
    json: true,
    signal,
    messages: [
      {role: 'system', content: SYSTEM_PROMPT},
      {role: 'user', content: [
        context.setting && `Where this happens, told from the USER's side ("you" there is the USER): ${context.setting}`,
        context.them && `The other person: ${context.them}`,
        `Conversation (oldest first). Grade only these message ids: ${gradeMids.join(', ')}.\n\n${transcript}`,
        context.reaction && `Their reaction to the last graded message: ${context.reaction}`
      ].filter(Boolean).join('\n\n')}
    ]
  });

  const parsed = parseModelJson<{grades?: any[]} | any[]>(answer);
  const list = Array.isArray(parsed) ? parsed : parsed?.grades;
  const verdicts = new Map<number, RizzVerdict>();
  if(!Array.isArray(list)) return verdicts;

  for(const item of list) {
    const mid = Number(item?.mid);
    const rating = String(item?.rating || '').toLowerCase();
    if(!grade.has(mid) || !isRizzRating(rating)) continue;
    verdicts.set(mid, {
      rating,
      elo: clampElo(item.elo),
      reason: typeof item.reason === 'string' ? item.reason.slice(0, 120) : undefined,
      better: typeof item.better === 'string' && item.better.trim() && !/^(null|none|n\/a)$/i.test(item.better.trim()) ? item.better.trim().slice(0, 200) : undefined
    });
  }

  return verdicts;
}
