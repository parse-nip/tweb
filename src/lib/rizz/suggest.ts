import type {RizzLine} from '@lib/rizz/classifier';
import {openRouterComplete} from '@lib/rizz/openrouter';
import {getRizzSettings} from '@lib/rizz/settings';

const SYSTEM = `You ghostwrite text messages for the user ("me") in a chat with another person ("them"). You write ONLY the text of the message, nothing else: no quotes, no labels, no explanation, no emoji unless the chat already uses them.
Style: sound like the user, not like a poet or a pickup-line book. Short (under 20 words), natural, confident, warm, with a little personality or humour. Answer what they actually said, then move the conversation forward. Never be needy, creepy or try-hard. Write in the language of the conversation.`;

export type RizzSuggestionArgs = {
  lines: RizzLine[],
  /** what the user has typed; empty to get a whole reply */
  draft: string,
  signal?: AbortSignal
};

/**
 * Ghost text for the composer: how the draft goes on (a continuation that is appended to it), or, for an empty
 * draft, a whole reply. Returned as it is to be inserted: with the space that joins it to the draft where needed.
 */
export async function getRizzSuggestion({lines, draft, signal}: RizzSuggestionArgs) {
  const history = lines.slice(-14).map((line) => `${line.out ? 'me' : 'them'}: ${line.text.replace(/\s+/g, ' ').slice(0, 400)}`).join('\n');
  const task = draft.trim() ?
    `The user has started typing: "${draft}"\nWrite ONLY the words that continue it, to be appended right after the typed text (so do not repeat what is typed). Finish the thought in a way that lands well.` :
    'Write the best next message from the user.';

  const text = (await openRouterComplete({
    model: getRizzSettings().fastModel,
    temperature: 0.8,
    maxTokens: 80,
    signal,
    messages: [
      {role: 'system', content: SYSTEM},
      {role: 'user', content: `Conversation (oldest first):\n${history || '(empty)'}\n\n${task}`}
    ]
  })).trim().replace(/^["“'`]+|["”'`]+$/g, '').replace(/\n+/g, ' ');

  if(!text) return '';
  // join it to the draft: a space unless the draft already ends in one or the continuation starts with punctuation
  const needsSpace = !!draft && !/\s$/.test(draft) && !/^[\s.,!?;:)\]]/.test(text);
  return (needsSpace ? ' ' : '') + text;
}
