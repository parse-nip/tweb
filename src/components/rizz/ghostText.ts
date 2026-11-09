import type Chat from '@components/chat/chat';
import {getChatInputEditor} from '@components/chat/inputEditor/registry';
import {getChatRizzLines} from '@components/rizz/bubbleRating';
import type {Middleware} from '@helpers/middleware';
import {getRizzSuggestion} from '@lib/rizz/suggest';
import {getRizzSettings, hasRizzKey} from '@lib/rizz/settings';

/*
 * Rizz Coach's ghost text: a pause in typing (or a fresh incoming message in an empty composer) asks the fast model
 * for how the message could go on, and the answer is drawn grey after the caret. Tab types it in. One request is
 * in flight at most; every keystroke drops the one before it.
 */

const IDLE_MS = 900;
const MIN_DRAFT = 3;
const READY_CLASS = 'has-rizz-ghost';

const readDraft = (input: HTMLElement) => (input.textContent || '').replace(/[​﻿]/g, '');

export default function attachRizzGhost({input, chat, middleware}: {
  input: HTMLElement,
  chat: Chat,
  middleware: Middleware
}) {
  let timer: number;
  let abort: AbortController;
  // an empty composer is asked once per incoming message, not again after the user dismisses it
  let askedForMid = 0;

  const clear = () => {
    clearTimeout(timer);
    abort?.abort();
    abort = undefined;
    input.classList.remove(READY_CLASS);
    const editor = getChatInputEditor(input);
    if(editor?.getRizzGhost()) editor.setRizzGhost();
  };

  const isFocused = () => document.activeElement === input || input.contains(document.activeElement);

  const ask = async() => {
    if(!middleware() || !isFocused() || !getRizzSettings().ghost || !hasRizzKey()) return;
    const editor = getChatInputEditor(input);
    if(!editor || editor.isComposing) return;

    const draft = readDraft(input);
    const lines = getChatRizzLines(chat);
    const last = lines[lines.length - 1];
    if(draft.trim()) {
      if(draft.trim().length < MIN_DRAFT) return;
    } else if(!last || last.out || last.mid === askedForMid) {
      return;
    } else {
      askedForMid = last.mid;
    }

    abort?.abort();
    const controller = abort = new AbortController();
    try {
      const suggestion = await getRizzSuggestion({lines, draft, signal: controller.signal});
      // the text moved on while the model was thinking
      if(controller.signal.aborted || !middleware() || readDraft(input) !== draft || !suggestion) return;
      input.classList.add(READY_CLASS);
      editor.setRizzGhost(suggestion);
    } catch(err) {
      if(!controller.signal.aborted) console.warn('[rizz] suggestion failed', err);
    }
  };

  const schedule = () => {
    clear();
    if(!getRizzSettings().ghost) return;
    timer = window.setTimeout(ask, IDLE_MS);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    // Tab takes the ghost in (rizzGhost.ts); the class goes with it
    if(event.key === 'Tab' || event.key === 'Escape') input.classList.remove(READY_CLASS);
  };

  input.addEventListener('input', schedule);
  input.addEventListener('focus', schedule);
  input.addEventListener('blur', clear);
  input.addEventListener('keydown', onKeyDown);
  middleware.onDestroy(() => {
    clear();
    input.removeEventListener('input', schedule);
    input.removeEventListener('focus', schedule);
    input.removeEventListener('blur', clear);
    input.removeEventListener('keydown', onKeyDown);
  });

  // a message arriving while the composer waits empty and focused is a reason to suggest a reply
  const observer = new MutationObserver(() => {
    if(isFocused() && !readDraft(input).trim()) schedule();
  });
  observer.observe(chat.bubbles.chatInner, {childList: true});
  middleware.onDestroy(() => observer.disconnect());
}
