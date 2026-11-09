import type {Message} from '@layer';
import type Chat from '@components/chat/chat';
import {toast} from '@components/toast';
import classNames from '@helpers/string/classNames';
import type {Middleware} from '@helpers/middleware';
import type {RizzLine} from '@lib/rizz/classifier';
import {getKnownVerdict, requestVerdict, subscribeToVerdict} from '@lib/rizz/ratingService';
import {getRizzRatingDef, RizzVerdict} from '@lib/rizz/ratings';
import {getRizzSettings, hasRizzKey} from '@lib/rizz/settings';
import styles from '@components/rizz/ratingBadge.module.scss';

/*
 * The chess label on a bubble (see src/lib/rizz). Bubbles call `attachRizzRating` once they are built;
 * switching the labels on or off in the Rizz Coach calls `refreshRizzBadges` for the bubbles already there.
 */

const WINDOW = 60;
const refreshers = new Set<() => void>();

export function refreshRizzBadges() {
  refreshers.forEach((refresh) => refresh());
}

export function getChatRizzLines(chat: Chat): RizzLine[] {
  const lines: RizzLine[] = [];
  chat.bubbles.chatInner.querySelectorAll<HTMLElement>('.bubble[data-mid]').forEach((bubble) => {
    const message = chat.getMessage(+bubble.dataset.mid) as Message.message;
    if(message?._ !== 'message' || !message.message?.trim() || message.pFlags.is_outgoing) return;
    lines.push({mid: message.mid, out: chat.isOurMessage(message), text: message.message});
  });

  return lines.sort((a, b) => a.mid - b.mid).slice(-WINDOW);
}

function describe(verdict: RizzVerdict) {
  const def = getRizzRatingDef(verdict.rating);
  return `${def.title} · ~${verdict.elo} Elo` + (verdict.reason ? ` — ${verdict.reason}` : '');
}

export function attachRizzRating({chat, bubble, bubbleContainer, message, our, middleware}: {
  chat: Chat,
  bubble: HTMLElement,
  bubbleContainer: HTMLElement,
  message: Message.message | Message.messageService,
  our: boolean,
  middleware: Middleware
}) {
  if(message._ !== 'message' || !message.message?.trim() || message.pFlags.is_outgoing) return;
  // a conversation to grade: a person's chat or a group, never a broadcast channel
  if(message.pFlags.post || chat.peerId === undefined) return;

  const line: RizzLine = {mid: message.mid, out: our, text: message.message};
  const key = String(chat.peerId);
  let badge: HTMLElement;
  let verdict: RizzVerdict;

  const remove = () => {
    badge?.remove();
    badge = undefined;
  };

  const render = (state: 'pending' | 'done' | 'failed') => {
    if(!getRizzSettings().ratings || state === 'failed' || (state === 'done' && !verdict)) return remove();
    if(!badge) {
      badge = document.createElement('div');
      badge.setAttribute('role', 'img');
      badge.addEventListener('click', (event) => {
        if(!verdict) return;
        event.stopPropagation();
        toast(describe(verdict), undefined, 4000);
      });
      bubbleContainer.append(badge);
    }

    badge.className = classNames(styles.badge, our ? styles.isOut : styles.isIn, state === 'pending' && styles.isPending);
    if(state === 'pending' || !verdict) {
      badge.replaceChildren();
      const spinner = document.createElement('div');
      spinner.className = styles.pending;
      badge.append(spinner);
      badge.removeAttribute('title');
      badge.setAttribute('aria-label', 'Rating…');
      return;
    }

    const def = getRizzRatingDef(verdict.rating);
    badge.style.setProperty('--rizz-color', def.color);
    badge.textContent = def.symbol;
    badge.title = describe(verdict);
    badge.setAttribute('aria-label', describe(verdict));
  };

  const unsubscribe = subscribeToVerdict(key, message.mid, (newVerdict, state) => {
    verdict = newVerdict ?? verdict;
    render(state);
  });

  const refresh = () => {
    if(!getRizzSettings().ratings || !hasRizzKey()) return remove();
    verdict = getKnownVerdict(key, line);
    if(verdict) render('done');
    else {
      // the bubble is not in the chat yet when it asks: its own line goes into the window
      requestVerdict(key, line, () => {
        const lines = getChatRizzLines(chat).filter((other) => other.mid !== line.mid);
        return [...lines, line].sort((a, b) => a.mid - b.mid);
      });
    }
  };

  refreshers.add(refresh);
  middleware.onClean(() => {
    refreshers.delete(refresh);
    unsubscribe();
  });

  refresh();
}
