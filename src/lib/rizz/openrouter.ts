import {getRizzBaseUrl, getRizzSettings} from '@lib/rizz/settings';

export type RizzChatMessage = {role: 'system' | 'user' | 'assistant', content: string};

export type RizzCompletionOptions = {
  model: string,
  messages: RizzChatMessage[],
  temperature?: number,
  maxTokens?: number,
  /** asks for a JSON object back (`response_format`) */
  json?: boolean,
  signal?: AbortSignal
};

export class RizzApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = 'RizzApiError';
  }
}

/** OpenRouter's chat completions (OpenAI-compatible): the text of the first choice. */
export async function openRouterComplete(options: RizzCompletionOptions): Promise<string> {
  const {apiKey} = getRizzSettings();
  const headers: Record<string, string> = {'Content-Type': 'application/json'};
  if(apiKey) headers.Authorization = `Bearer ${apiKey}`;
  // optional attribution headers OpenRouter shows in its dashboard
  headers['X-Title'] = 'tweb Rizz Coach';

  const response = await fetch(getRizzBaseUrl() + '/chat/completions', {
    method: 'POST',
    headers,
    signal: options.signal,
    body: JSON.stringify({
      model: options.model,
      messages: options.messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 400,
      ...(options.json ? {response_format: {type: 'json_object'}} : {})
    })
  });

  const body = await response.json().catch((): any => undefined);
  if(!response.ok) {
    throw new RizzApiError(body?.error?.message || `OpenRouter answered ${response.status}`, response.status);
  }

  const content = body?.choices?.[0]?.message?.content;
  if(typeof content !== 'string') throw new RizzApiError('OpenRouter returned no text');
  return content;
}

/** The first JSON value in a model's answer, with or without a code fence around it. */
export function parseModelJson<T = any>(text: string): T | undefined {
  const cleaned = text.replace(/```(?:json)?/gi, '').trim();
  const start = cleaned.search(/[{[]/);
  if(start === -1) return;
  const open = cleaned[start];
  const end = cleaned.lastIndexOf(open === '{' ? '}' : ']');
  if(end <= start) return;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch(err) {}
}
