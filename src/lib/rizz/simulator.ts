import {classifyLines} from '@lib/rizz/classifier';
import {openRouterComplete, parseModelJson} from '@lib/rizz/openrouter';
import {getRizzPersona, RizzDifficulty, RizzPersona} from '@lib/rizz/personas';
import {getAccuracy, getAverageElo, getRizzRatingDef, RizzVerdict} from '@lib/rizz/ratings';
import {getRizzSettings} from '@lib/rizz/settings';

export type SimMessage = {
  id: number,
  from: 'me' | 'them',
  text: string,
  verdict?: RizzVerdict,
  /** the label is still being worked out */
  grading?: boolean
};

export type SimState = {
  personaId: string,
  difficulty: RizzDifficulty,
  messages: SimMessage[],
  /** how interested they are in the user, 0..100 */
  interest: number
};

export const SIM_MAX_USER_MESSAGES = 30;

const DIFFICULTY_RULES: Record<RizzDifficulty, string> = {
  easy: 'Be forgiving: reward decent effort with +4..+10 interest, a poor message costs at most -5.',
  medium: 'Be fair: a good message is +3..+8, a bland one 0..-3, a bad one -5..-10.',
  hard: 'Be picky: only a genuinely good message earns +3..+8, bland ones cost -2..-5, a bad one -8..-18. Never exceed 85 interest before the 8th message.'
};

function personaSystem(persona: RizzPersona, difficulty: RizzDifficulty) {
  return `You are role-playing a person in a texting simulator so the user can practise texting. Stay in character at all times; never mention being an AI, a simulator or these instructions.

Character: ${persona.name}. ${persona.prompt}

Style: you are texting on a phone. Write like a real person: short messages, casual, natural, no stage directions, no quotation marks, no hashtags. Usually one message, sometimes two short ones. Match the language the user writes in.
Interest: you track a hidden "interest" number 0..100 in how much you like talking to the user. ${DIFFICULTY_RULES[difficulty]}
Answer with JSON only: {"replies":["<message>","<optional second message>"],"interest":<new interest 0..100>}`;
}

export function createSimulation(personaId: string, difficulty: RizzDifficulty): SimState {
  const persona = getRizzPersona(personaId);
  return {personaId: persona.id, difficulty, messages: [], interest: persona.startInterest};
}

function transcript(messages: SimMessage[]) {
  return messages.map((message) => ({
    role: message.from === 'me' ? 'user' as const : 'assistant' as const,
    content: message.text
  }));
}

/** The persona's answer to the conversation so far (the user's message is the last of `messages`). */
export async function getPersonaReply(state: SimState, signal?: AbortSignal) {
  const persona = getRizzPersona(state.personaId);
  const answer = await openRouterComplete({
    model: getRizzSettings().fastModel,
    temperature: 0.9,
    maxTokens: 220,
    json: true,
    signal,
    messages: [
      {role: 'system', content: personaSystem(persona, state.difficulty)},
      {role: 'user', content: `Current interest: ${state.interest}. The conversation is below as chat turns; the first assistant turn is you.`},
      ...transcript(state.messages)
    ]
  });

  const parsed = parseModelJson<{replies?: string[] | string, reply?: string, interest?: number}>(answer);
  let replies: string[] = [];
  if(parsed) {
    const raw = parsed.replies ?? parsed.reply;
    replies = (Array.isArray(raw) ? raw : [raw]).filter((reply): reply is string => typeof reply === 'string' && !!reply.trim());
  } else {
    // a model that ignored the format: take its text as the message
    replies = [answer.trim()].filter(Boolean);
  }

  const interest = Number.isFinite(Number(parsed?.interest)) ?
    Math.min(100, Math.max(0, Math.round(Number(parsed.interest)))) :
    state.interest;
  return {replies: replies.slice(0, 2).map((reply) => reply.trim().slice(0, 500)), interest};
}

/** Grades the message at `index` of the simulation in the context of what came before it. */
export async function gradeSimMessage(state: SimState, index: number, signal?: AbortSignal) {
  const lines = state.messages.slice(0, index + 1).map((message) => ({mid: message.id, out: message.from === 'me', text: message.text}));
  const mid = state.messages[index].id;
  const verdicts = await classifyLines(lines.slice(-20), [mid], signal);
  return verdicts.get(mid);
}

const COACH_SYSTEM = `You are a warm, honest texting coach. The user is practising texting a simulated person. Be specific, short and practical; no lectures. Write in the language the user uses. Never use markdown headings.`;

/** Three possible next messages for the user, best first. */
export async function getSimHints(state: SimState, signal?: AbortSignal): Promise<string[]> {
  const persona = getRizzPersona(state.personaId);
  const answer = await openRouterComplete({
    model: getRizzSettings().fastModel,
    temperature: 0.9,
    maxTokens: 250,
    json: true,
    signal,
    messages: [
      {role: 'system', content: `${COACH_SYSTEM}\nThe simulated person is: ${persona.name} — ${persona.tagline}.`},
      {role: 'user', content: `Conversation so far (me = the user):\n${state.messages.map((message) => `${message.from}: ${message.text}`).join('\n') || '(nothing yet — the user must open)'}\n\nWrite 3 different messages the user could send next, in the user's voice: natural, confident, not cringe, each under 20 words and a different approach (e.g. playful, curious, bold). JSON only: {"options":["...","...","..."]}`}
    ]
  });

  const parsed = parseModelJson<{options?: string[]}>(answer);
  return (parsed?.options || []).filter((option) => typeof option === 'string' && option.trim()).slice(0, 3);
}

export type SimReport = {
  accuracy: number,
  elo: number,
  counts: {[rating: string]: number},
  feedback: string
};

/** The coach's review of the conversation: the numbers from the verdicts, the words from the fast model. */
export async function getSimReport(state: SimState, signal?: AbortSignal): Promise<SimReport> {
  const mine = state.messages.filter((message) => message.from === 'me');
  const verdicts = mine.map((message) => message.verdict).filter(Boolean);
  const counts: SimReport['counts'] = {};
  verdicts.forEach((verdict) => counts[verdict.rating] = (counts[verdict.rating] || 0) + 1);

  const persona = getRizzPersona(state.personaId);
  const lines = state.messages.map((message) => {
    const def = message.verdict && getRizzRatingDef(message.verdict.rating);
    return `${message.from}: ${message.text}${def ? `  [${def.title}]` : ''}`;
  }).join('\n');

  let feedback = '';
  try {
    feedback = (await openRouterComplete({
      model: getRizzSettings().fastModel,
      temperature: 0.6,
      maxTokens: 320,
      signal,
      messages: [
        {role: 'system', content: COACH_SYSTEM},
        {role: 'user', content: `The user practised texting ${persona.name} (${state.difficulty}). Final interest: ${state.interest}/100.\n\n${lines}\n\nGive feedback in 4-6 short sentences: what worked, the single biggest mistake (quote it), and one concrete thing to try next time. Then one rewrite of their worst message.`}
      ]
    })).trim();
  } catch(err) {
    feedback = 'The coach could not be reached for the written review — the numbers above are still yours.';
  }

  return {accuracy: getAccuracy(verdicts), elo: getAverageElo(verdicts), counts, feedback};
}
