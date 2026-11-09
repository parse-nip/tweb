import {openRouterComplete, openRouterDecide, parseModelJson, RizzDecisionQuestions} from '@lib/rizz/openrouter';
import {clampElo, getRizzRatingDef, isRizzRating, RIZZ_RATINGS, RizzVerdict} from '@lib/rizz/ratings';
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
- Grade EVERY message in "grade", for both sides ("me" is the user, "them" the other person).
- Be honest and calibrated: most messages are "good" or "book". "brilliant" and "blunder" are rare. Do not inflate.
- Judge by what the text says in context; ignore typos unless they change the meaning. The language of the chat may not be English.
- "elo" is the estimated chess Elo of the message (100..3000): a plain "hey" is ~400-800, an average reply ~1000-1400, a sharp, witty or emotionally intelligent one 1800+, a brilliant one 2400+.
- "reason" is at most 12 words and names the label's cause.
Answer with JSON only: {"grades":[{"mid":<number>,"rating":"<label>","elo":<number>,"reason":"<short>"}]}`;

/** Jev and the rest of TypeSafe's models decide (probabilities) instead of chatting. */
export const isDecisionsModel = (model: string) => /^~?typesafe\/jev/i.test(model);

const ELO_ANCHORS = [
  'A bare greeting or a dead-end reply, around 400 Elo',
  'An ordinary, fine reply, around 1000 Elo',
  'A sharp, warm or witty message, around 1800 Elo',
  'An exceptional message that turns the whole chat, around 2600 Elo'
];

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

  const rating = answer?.answers?.rating?.choice;
  if(!isRizzRating(rating)) return;
  const score = Number(answer.answers.strength?.score);
  return {
    rating,
    // score 0..3 on the anchors above: 400..2600
    elo: clampElo(Number.isFinite(score) ? 400 + (score / 3) * 2200 : undefined),
    reason: getRizzRatingDef(rating).title + (answer.answers.rating.confidence >= 0 ? ` · ${Math.round(answer.answers.rating.confidence * 100)}% sure` : '')
  };
}

export async function classifyLines(lines: RizzLine[], gradeMids: number[], signal?: AbortSignal) {
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

  return classifyLinesWithChat(lines, gradeMids, signal);
}

async function classifyLinesWithChat(lines: RizzLine[], gradeMids: number[], signal?: AbortSignal) {
  const grade = new Set(gradeMids);
  const transcript = lines.map((line) => `[${line.mid}] ${line.out ? 'me' : 'them'}: ${line.text.replace(/\s+/g, ' ').slice(0, 600)}`).join('\n');
  const answer = await openRouterComplete({
    model: getRizzSettings().classifierModel,
    temperature: 0.2,
    // a reasoning model spends tokens thinking before the JSON
    maxTokens: 1500 + gradeMids.length * 80,
    json: true,
    signal,
    messages: [
      {role: 'system', content: SYSTEM_PROMPT},
      {role: 'user', content: `Conversation (oldest first). Grade only these message ids: ${gradeMids.join(', ')}.\n\n${transcript}`}
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
      reason: typeof item.reason === 'string' ? item.reason.slice(0, 120) : undefined
    });
  }

  return verdicts;
}
