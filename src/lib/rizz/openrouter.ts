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

// cheap chat models to fall back to (the Worker's allow list in deploy/cloudflare/worker.js has the same ones)
const FALLBACK_MODELS = ['google/gemini-2.5-flash', 'openai/gpt-4.1-nano'];

async function post(path: string, payload: unknown, signal?: AbortSignal) {
  const {apiKey} = getRizzSettings();
  const headers: Record<string, string> = {'Content-Type': 'application/json'};
  if(apiKey) headers.Authorization = `Bearer ${apiKey}`;
  // attribution OpenRouter shows in its dashboard
  headers['X-Title'] = 'tweb Rizz Coach';

  // a rate limit, an upstream hiccup or a dropped connection is worth a second and a third try: a chat that
  // goes quiet for one of them looks broken
  const RETRY_DELAYS = [700, 1800];
  for(let attempt = 0; ; ++attempt) {
    try {
      const response = await fetch(getRizzBaseUrl() + path, {method: 'POST', headers, signal, body: JSON.stringify(payload)});
      const body = await response.json().catch((): any => undefined);
      if(response.ok) return body;

      const error = new RizzApiError(body?.error?.message || `OpenRouter answered ${response.status}`, response.status);
      if(response.status !== 429 && response.status < 500) throw error;
      if(attempt >= RETRY_DELAYS.length) throw error;
    } catch(err) {
      if(signal?.aborted || err instanceof RizzApiError && err.status < 500 && err.status !== 429) throw err;
      if(attempt >= RETRY_DELAYS.length) throw err;
    }

    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS[attempt]));
  }
}

export type RizzDecisionQuestions = Record<string, {type: 'choice' | 'noul' | 'score', instructions: string, criteria: Record<string, string> | string[]}>;

/** A Decisions model (Jev): typed questions about `state`, answered with probabilities instead of text. */
export function openRouterDecide(options: {model: string, state: unknown, questions: RizzDecisionQuestions, signal?: AbortSignal}) {
  return post('/alpha/decisions', {model: options.model, state: options.state, questions: options.questions}, options.signal);
}

/** OpenRouter's chat completions (OpenAI-compatible): the text of the first choice. */
export async function openRouterComplete(options: RizzCompletionOptions): Promise<string> {
  const body = await post('/v1/chat/completions', {
    model: options.model,
    // when the model is rate limited or down OpenRouter goes on to the next
    models: [options.model, ...FALLBACK_MODELS.filter((model) => model !== options.model)].slice(0, 3),
    messages: options.messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 400,
    ...(options.json ? {response_format: {type: 'json_object'}} : {})
  }, options.signal);

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
