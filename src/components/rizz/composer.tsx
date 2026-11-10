/*
 * The message box: Telegram's composer, with the Rizz Coach's ghost text (`@lib/rizz/suggest`). A pause in typing,
 * or their new message in an empty box, asks the fast model how the message could go on; the answer is drawn grey
 * after the caret. Tab (or a tap on it) types it in, Escape drops it, Enter sends. One request is in flight at
 * most; every keystroke drops the one before it — as the Coach's own ghost text in a chat does.
 */

import {createEffect, createSignal, JSX, on, onCleanup, onMount, Show} from 'solid-js';
import {ButtonIconTsx} from '@components/buttonIconTsx';
import {getRizzSuggestion} from '@lib/rizz/suggest';
import type {RizzLine} from '@lib/rizz/classifier';
import classNames from '@helpers/string/classNames';
import {styles} from '@components/rizz/ui';

const IDLE_MS = 900;
const MIN_DRAFT = 3;
const MAX_LENGTH = 500;

export type ComposerHandle = {
  /** asks for a suggestion now (the Hint) */
  suggest: () => void,
  focus: () => void
};

export default function Composer(props: {
  placeholder: string,
  disabled?: boolean,
  /** the conversation the suggestion continues */
  lines: () => RizzLine[],
  ghost?: boolean,
  onSend: (text: string) => void,
  left?: JSX.Element,
  right?: JSX.Element,
  ref?: (handle: ComposerHandle) => void
}) {
  const [draft, setDraft] = createSignal('');
  const [ghost, setGhost] = createSignal('');
  const [thinking, setThinking] = createSignal(false);
  let textarea: HTMLTextAreaElement;
  let timer: number;
  let abort: AbortController;
  // an empty box is asked once per message of theirs, not again after the ghost is dismissed
  let askedForCount = -1;

  const clear = () => {
    clearTimeout(timer);
    abort?.abort();
    abort = undefined;
    setThinking(false);
    setGhost('');
  };

  const ask = async(force?: boolean) => {
    if(props.disabled || (!props.ghost && !force)) return;
    const text = draft();
    const lines = props.lines();
    if(text.trim()) {
      if(text.trim().length < MIN_DRAFT && !force) return;
    } else {
      const last = lines[lines.length - 1];
      if(!force && (!last || last.out || askedForCount === lines.length)) return;
      askedForCount = lines.length;
    }

    abort?.abort();
    const controller = abort = new AbortController();
    setThinking(true);
    try {
      const suggestion = await getRizzSuggestion({lines, draft: text, signal: controller.signal});
      // the text moved on while the model was thinking
      if(controller.signal.aborted || draft() !== text || !suggestion) return;
      setGhost(suggestion);
    } catch(err) {
      if(!controller.signal.aborted) console.warn('[rizz] suggestion failed', err);
    } finally {
      if(abort === controller) setThinking(false);
    }
  };

  const schedule = () => {
    clear();
    if(!props.ghost) return;
    timer = window.setTimeout(ask, IDLE_MS);
  };

  const resize = () => {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 160) + 'px';
  };

  const accept = () => {
    const text = ghost();
    if(!text) return;
    clear();
    setDraft((value) => (value + text).slice(0, MAX_LENGTH));
    textarea.value = draft();
    resize();
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  };

  const send = () => {
    const text = draft().trim();
    if(!text || props.disabled) return;
    clear();
    setDraft('');
    textarea.value = '';
    resize();
    props.onSend(text);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if(e.key === 'Tab' && ghost()) {
      e.preventDefault();
      accept();
    } else if(e.key === 'Escape' && ghost()) {
      e.preventDefault();
      clear();
    } else if(e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      send();
    }
  };

  // * their new message in an empty box is a reason to suggest a reply
  createEffect(on(() => [props.lines().length, props.disabled], () => {
    if(!draft().trim() && !props.disabled) schedule();
  }));

  onCleanup(clear);

  onMount(() => {
    props.ref?.({suggest: () => ask(true), focus: () => textarea.focus()});
    textarea.focus();
  });

  return (
    <div class={styles.inputBox}>
      {props.left}
      <div class={styles.composerField}>
        <div class={styles.ghostLayer} aria-hidden="true" dir="auto">
          <span class={styles.ghostDraft}>{draft()}</span>
          <span class={styles.ghostText} onClick={accept}>{ghost()}</span>
          <Show when={ghost()}>
            <span class={styles.ghostKey} onClick={accept}>Tab</span>
          </Show>
        </div>
        <textarea
          ref={textarea}
          class={styles.composerInput}
          rows={1}
          dir="auto"
          maxLength={MAX_LENGTH}
          placeholder={ghost() ? '' : thinking() && !draft() ? 'The coach is thinking…' : props.placeholder}
          aria-label="Message"
          disabled={props.disabled}
          onInput={(e) => {
            setDraft(e.currentTarget.value);
            resize();
            schedule();
          }}
          onKeyDown={onKeyDown}
        />
      </div>
      <ButtonIconTsx
        icon="send2"
        class={classNames(styles.sendButton, !draft().trim() && styles.sendIdle)}
        aria-label="Send"
        disabled={props.disabled || !draft().trim()}
        onClick={send}
      />
      {props.right}
      <span class={styles.tailShape} aria-hidden="true" />
    </div>
  );
}
