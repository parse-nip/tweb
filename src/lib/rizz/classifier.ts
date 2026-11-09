import {openRouterComplete, parseModelJson} from '@lib/rizz/openrouter';
import {clampElo, isRizzRating, RIZZ_RATINGS, RizzVerdict} from '@lib/rizz/ratings';
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

export async function classifyLines(lines: RizzLine[], gradeMids: number[], signal?: AbortSignal) {
  const grade = new Set(gradeMids);
  const transcript = lines.map((line) => `[${line.mid}] ${line.out ? 'me' : 'them'}: ${line.text.replace(/\s+/g, ' ').slice(0, 600)}`).join('\n');
  const answer = await openRouterComplete({
    model: getRizzSettings().classifierModel,
    temperature: 0.2,
    maxTokens: 120 + gradeMids.length * 60,
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
