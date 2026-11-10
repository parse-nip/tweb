import {createRoot, createSignal} from 'solid-js';

/*
 * Rizz Coach settings. Kept in this browser's localStorage (the key included, which is why it is never synced or
 * logged): the build's OPENROUTER_API_KEY / VITE_OPENROUTER_API_KEY is only the default.
 */

const STORAGE_KEY = 'tweb-rizz';

// TypeSafe's Jev (https://openrouter.ai/~typesafe/jev-latest); `typesafe/jev-router` is the router listed on OpenRouter
export const DEFAULT_CLASSIFIER_MODEL = 'typesafe/jev-1.13';
export const DEFAULT_FAST_MODEL = 'google/gemini-2.5-flash-lite';
// the other person in the texting simulator: a step up from the fast model, so they have a voice of their own
export const DEFAULT_PERSONA_MODEL = 'google/gemini-2.5-flash';
// the API root: chat completions are at <root>/v1/chat/completions, Decisions (Jev) at <root>/alpha/decisions
export const DEFAULT_BASE_URL = 'https://openrouter.ai/api';

export type RizzSettings = {
  apiKey: string,
  classifierModel: string,
  fastModel: string,
  personaModel: string,
  /** a chess label on every message of the open chat */
  ratings: boolean,
  /** ghost text in the composer */
  ghost: boolean
};

function read(): Partial<RizzSettings> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch(err) {
    return {};
  }
}

const [settings, setSettingsSignal] = createRoot(() => createSignal<Partial<RizzSettings>>(read()));

const env = import.meta.env;

export function getRizzSettings(): RizzSettings {
  const stored = settings();
  return {
    apiKey: stored.apiKey || env.VITE_OPENROUTER_API_KEY || env.OPENROUTER_API_KEY || '',
    classifierModel: stored.classifierModel || env.VITE_OPENROUTER_CLASSIFIER_MODEL || DEFAULT_CLASSIFIER_MODEL,
    fastModel: stored.fastModel || env.VITE_OPENROUTER_FAST_MODEL || DEFAULT_FAST_MODEL,
    personaModel: stored.personaModel || env.VITE_OPENROUTER_PERSONA_MODEL || DEFAULT_PERSONA_MODEL,
    ratings: stored.ratings ?? false,
    ghost: stored.ghost ?? false
  };
}

/** A reactive read: use inside an effect or a component. */
export function useRizzSettings() {
  return getRizzSettings;
}

export function getRizzBaseUrl() {
  return (env.VITE_OPENROUTER_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

export function hasRizzKey() {
  // a proxy at VITE_OPENROUTER_BASE_URL adds the key itself
  return !!getRizzSettings().apiKey || !!env.VITE_OPENROUTER_BASE_URL;
}

export function setRizzSettings(patch: Partial<RizzSettings>) {
  const next = {...settings(), ...patch};
  // an empty field goes back to the build's default
  (Object.keys(next) as (keyof RizzSettings)[]).forEach((key) => {
    if(next[key] === '' || next[key] === undefined) delete next[key];
  });
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch(err) {}
  setSettingsSignal(next);
}
