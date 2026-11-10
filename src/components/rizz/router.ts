import {createRoot, createSignal} from 'solid-js';
import type {RizzTimeControl} from '@components/rizz/store';
import type {RizzDifficulty} from '@lib/rizz/personas';

export type RizzRoute =
  {name: 'home'} |
  {name: 'bots', botId?: string} |
  {name: 'game', botId: string, difficulty?: RizzDifficulty, timeControl?: RizzTimeControl, key: number} |
  {name: 'review', gameId: string} |
  {name: 'puzzles', puzzleId?: string} |
  {name: 'daily'} |
  {name: 'rush'} |
  {name: 'lessons'} |
  {name: 'lesson', lessonId: string} |
  {name: 'profile'} |
  {name: 'archive'} |
  {name: 'settings'} |
  {name: 'botMaker', botId?: string};

const [route, setRoute] = createRoot(() => createSignal<RizzRoute>({name: 'home'}));

export {route};

/** Leaving a game in progress asks first; the game registers that check here. */
let leaveGuard: (next: RizzRoute) => boolean;
export function setLeaveGuard(guard: (next: RizzRoute) => boolean) {
  leaveGuard = guard;
}

export function navigate(next: RizzRoute) {
  if(leaveGuard && !leaveGuard(next)) return;
  leaveGuard = undefined;
  setRoute(next);
}
