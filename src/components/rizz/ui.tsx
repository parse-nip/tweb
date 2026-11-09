/*
 * The game's shared pieces, made of Telegram's: a peer avatar, a chat-list row, a message bubble
 * with its tail, the topbar, the composer with the bot keyboard, a control plate, a pinned bar.
 */

import {createEffect, createSignal, For, JSX, on, onCleanup, Show} from 'solid-js';
import classNames from '@helpers/string/classNames';
import Row from '@components/rowTsx';
import Section from '@components/section';
import {IconTsx} from '@components/iconTsx';
import {ButtonIconTsx} from '@components/buttonIconTsx';
import {ButtonMenuToggleTsx} from '@components/buttonMenuToggleTsx';
import type {ButtonMenuItemOptionsVerifiable} from '@components/buttonMenu';
import ChatInputPlate, {CHAT_INPUT_PLATE_SINGLE_CLASS} from '@components/chat/controlPlate';
import InputField from '@components/inputField';
import ripple from '@components/ripple';
import {bestOption, CLASSIFICATIONS, RizzClassification} from '@components/rizz/engine';
import type {RizzTurn} from '@components/rizz/content/types';
import {navigate} from '@components/rizz/router';
import styles from '@components/rizz/rizz.module.scss';

export {styles};

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
}

/** A peer avatar without a peer: Telegram's gradient circle, with initials or a white icon. */
export function Avatar(props: {name?: string, icon?: Icon, color: string, size?: number, class?: string}) {
  return (
    <div
      class={classNames('avatar', 'avatar-like', 'avatar-gradient', styles.avatar, props.class)}
      data-color={props.color}
      style={{'--size': `${props.size ?? 54}px`}}
      aria-hidden="true"
    >
      <Show when={props.icon} fallback={initials(props.name || '')}>
        <IconTsx icon={props.icon} class={styles.avatarIcon} />
      </Show>
    </div>
  );
}

/** A dialog of the chat list: Telegram's 54px row, title with its time, subtitle with its badge. */
export function ListRow(props: {
  title: JSX.Element,
  subtitle?: JSX.Element,
  meta?: JSX.Element,
  badge?: JSX.Element,
  pinned?: boolean,
  media: JSX.Element,
  active?: boolean,
  small?: boolean,
  class?: string,
  onClick?: () => void
}) {
  return (
    <Row
      clickable={props.onClick}
      noWrap
      class={classNames(
        'chatlist-chat',
        props.small ? 'chatlist-chat-abitbigger' : 'chatlist-chat-bigger row-big',
        props.active && styles.rowActive,
        props.class
      )}
    >
      <Row.Media size={props.small ? 'abitbigger' : 'bigger'}>{props.media}</Row.Media>
      <Row.Title titleRight={props.meta !== undefined && props.meta !== false && <span class={styles.rowMeta}>{props.meta}</span>}>
        <span class="user-title">{props.title}</span>
      </Row.Title>
      <Show when={props.subtitle}>
        <Row.Subtitle subtitleRight={props.badge || (props.pinned && <IconTsx icon="chatspinned" class={styles.pinIcon} />)}>
          {props.subtitle}
        </Row.Subtitle>
      </Show>
    </Row>
  );
}

/** A settings row: a coloured square icon, a title, an optional value under it or at the end. */
export function SettingsRow(props: {
  icon?: Icon,
  title: JSX.Element,
  subtitle?: JSX.Element,
  right?: JSX.Element,
  danger?: boolean,
  onClick?: () => void
}) {
  return (
    <Row clickable={props.onClick} color={props.danger ? 'danger' : undefined}>
      <Show when={props.icon}><Row.Icon icon={props.icon} /></Show>
      <Row.Title titleRight={props.right}>{props.title}</Row.Title>
      <Show when={props.subtitle}><Row.Subtitle>{props.subtitle}</Row.Subtitle></Show>
    </Row>
  );
}

/** Telegram's section on the sidebar grey, named with plain text. */
export function Block(props: {name?: string, caption?: JSX.Element, children: JSX.Element}) {
  return (
    <Section name={props.name ? <span>{props.name}</span> : undefined} caption={props.caption ? <span>{props.caption}</span> : undefined}>
      {props.children}
    </Section>
  );
}

export function Page(props: {children: JSX.Element}) {
  return (
    <div class={styles.page}>
      <div class={styles.pageInner}>{props.children}</div>
    </div>
  );
}

export function Topbar(props: {
  media?: JSX.Element,
  title: JSX.Element,
  subtitle?: JSX.Element,
  right?: JSX.Element,
  menu?: ButtonMenuItemOptionsVerifiable[],
  onBack?: () => void
}) {
  return (
    <div class={styles.topbar}>
      <ButtonIconTsx
        icon="back"
        class={styles.backButton}
        aria-label="Back"
        onClick={() => props.onBack ? props.onBack() : navigate({name: 'home'})}
      />
      {props.media}
      <div class={styles.topbarInfo}>
        <div class={styles.topbarTitle}>{props.title}</div>
        <Show when={props.subtitle}>
          <div class={styles.topbarSubtitle}>{props.subtitle}</div>
        </Show>
      </div>
      {props.right}
      <Show when={props.menu?.length} keyed>
        <ButtonMenuToggleTsx icon="more" direction="bottom-left" buttons={props.menu} />
      </Show>
    </div>
  );
}

/** Menu items with plain text. */
export function menuItem(icon: Icon, text: string, onClick: () => void, options: {danger?: boolean, verify?: () => boolean} = {}): ButtonMenuItemOptionsVerifiable {
  return {icon, regularText: text, onClick, danger: options.danger, verify: options.verify};
}

/** A coach's line under the topbar, as a pinned message stands there. */
export function PinnedBar(props: {title: JSX.Element, children: JSX.Element, muted?: JSX.Element}) {
  return (
    <div class={styles.pinned} aria-live="polite">
      <div class={styles.pinnedLine} />
      <div class={styles.pinnedBody}>
        <div class={styles.pinnedTitle}>{props.title}</div>
        <div class={styles.pinnedText}>{props.children}</div>
        <Show when={props.muted}><div class={classNames(styles.pinnedText, styles.pinnedMuted)}>{props.muted}</div></Show>
      </div>
    </div>
  );
}

/** The vibe — chess.com's evaluation bar — as a thin line under the topbar. */
export function VibeLine(props: {probability: number}) {
  return (
    <div class={styles.vibe} role="meter" aria-label="Vibe" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(props.probability * 100)}>
      <div class={styles.vibeFill} style={{width: `${Math.round(props.probability * 100)}%`}} />
    </div>
  );
}

export function formatTime(date = new Date()) {
  return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function ClassDot(props: {classification: RizzClassification, class?: string}) {
  const info = () => CLASSIFICATIONS[props.classification];
  return (
    <span
      class={classNames(styles.classDot, props.class)}
      style={{'background-color': info().color}}
      title={info().label}
      aria-label={info().label}
      role="img"
    >
      {info().symbol}
    </span>
  );
}

export type BubbleData = {
  text: string,
  out?: boolean,
  time?: string,
  classification?: RizzClassification,
  /** A line the chat says, not a person: "Seen", a result. */
  ghost?: boolean
};

/** A message bubble the way Telegram draws one, its tail cut to the shape `_chatBubble.scss` cuts its own to. */
export function Bubble(props: BubbleData & {
  tail?: boolean,
  selected?: boolean,
  onClick?: () => void,
  animate?: boolean
}) {
  return (
    <div
      class={classNames(
        styles.bubble,
        props.out && styles.out,
        props.tail && !props.ghost && styles.tail,
        props.selected && styles.selected,
        props.onClick && styles.selectable,
        props.ghost && styles.ghost,
        props.animate && styles.bubbleIn
      )}
      onClick={props.onClick}
      dir="auto"
    >
      <Show when={props.classification}>
        <ClassDot classification={props.classification} class={styles.classBadge} />
      </Show>
      {props.text}
      <Show when={props.time && !props.ghost}>
        <span class={styles.time}>
          {props.time}
          <Show when={props.out}>
            <IconTsx icon="checks" />
          </Show>
        </span>
      </Show>
      <Show when={props.tail && !props.ghost}>
        <span class={styles.tailShape} aria-hidden="true" />
      </Show>
    </div>
  );
}

export function TypingBubble() {
  return (
    <div class={classNames(styles.bubble, styles.tail, styles.typingBubble)} aria-label="typing">
      <span /><span /><span />
      <span class={styles.tailShape} aria-hidden="true" />
    </div>
  );
}

/** The bubbles of a conversation, grouped by side the way Telegram groups them (tail on the last). */
export function Messages(props: {
  service?: JSX.Element,
  items: BubbleData[],
  typing?: boolean,
  selectedIndex?: number,
  onSelect?: (index: number) => void,
  ref?: (el: HTMLDivElement) => void,
  /** A card above the conversation, as a bot's "what can this bot do" stands there. */
  intro?: JSX.Element,
  /** Keep the newest message in sight; a review scrolls to its selection instead. */
  stickToEnd?: boolean
}) {
  // * a conversation reads from its end: the newest message, and their typing, stay in sight
  let scrollEl: HTMLDivElement;
  createEffect(on(() => [props.items.length, props.typing], (_, previous) => {
    if(props.stickToEnd === false) return;
    requestAnimationFrame(() => scrollEl?.scrollTo({top: scrollEl.scrollHeight, behavior: previous ? 'smooth' : 'instant'}));
  }));

  return (
    <div class={styles.scroll} ref={(el) => {
      scrollEl = el;
      props.ref?.(el);
    }}>
      <div class={styles.messages}>
        <Show when={props.intro}>
          <div class={styles.introCard}>{props.intro}</div>
        </Show>
        <Show when={props.service}>
          <div class={styles.service} dir="auto">{props.service}</div>
        </Show>
        <For each={props.items}>{(item, index) => {
          // * the tail goes on the last bubble of a run from one side; typing continues their run
          const tail = () => {
            const next = props.items[index() + 1];
            if(next) return !!next.out !== !!item.out || !!next.ghost;
            return !!item.out || !props.typing;
          };
          return (
            <Bubble
              {...item}
              tail={tail()}
              selected={props.selectedIndex === index()}
              onClick={props.onSelect && item.out ? () => props.onSelect(index()) : undefined}
              animate
            />
          );
        }}</For>
        <Show when={props.typing}>
          <TypingBubble />
        </Show>
      </div>
    </div>
  );
}

/** Telegram's message box: what would be typed is chosen from the bot keyboard under it. */
export function InputBox(props: {left?: JSX.Element, children: JSX.Element, right?: JSX.Element}) {
  return (
    <div class={styles.inputBox}>
      {props.left}
      <div class={styles.inputPlaceholder}>{props.children}</div>
      {props.right}
      <span class={styles.tailShape} aria-hidden="true" />
    </div>
  );
}

type PlateSide = {icon: Icon, label: string, onClick: () => void};

/** One action in the composer's place — Telegram's START / JOIN / UNBLOCK plate. */
export function ActionPlate(props: {label: string, onClick: () => void, left?: PlateSide, right?: PlateSide}) {
  const side = (button: PlateSide) => button && (
    <ButtonIconTsx icon={button.icon} aria-label={button.label} title={button.label} onClick={button.onClick} />
  );
  const center = (
    <button
      type="button"
      class="btn-primary btn-transparent text-bold chat-input-control-button chat-input-plate-button"
      ref={(el) => ripple(el)}
      onClick={() => props.onClick()}
    >
      {props.label}
    </button>
  ) as HTMLElement;

  return (
    <div class={styles.inputBox}>
      {ChatInputPlate({
        class: !props.left && !props.right ? CHAT_INPUT_PLATE_SINGLE_CLASS : undefined,
        left: side(props.left),
        center,
        right: side(props.right)
      })}
      <span class={styles.tailShape} aria-hidden="true" />
    </div>
  );
}

/** The bot keyboard the moves are picked from (`.reply-keyboard`); 1–4 on the keyboard pick too. */
export function ReplyKeyboard(props: {
  options: {text: string, index: number}[],
  onPick: (index: number) => void,
  disabled?: boolean,
  hint?: number
}) {
  const onKeyDown = (e: KeyboardEvent) => {
    if(props.disabled || e.ctrlKey || e.metaKey || e.altKey) return;
    const target = e.target as HTMLElement;
    if(target?.closest?.('input, textarea, [contenteditable="true"]')) return;
    const n = Number(e.key);
    if(n >= 1 && n <= props.options.length) {
      e.preventDefault();
      props.onPick(props.options[n - 1].index);
    }
  };
  document.addEventListener('keydown', onKeyDown);
  onCleanup(() => document.removeEventListener('keydown', onKeyDown));

  return (
    <div class="reply-keyboard is-shown active" role="group" aria-label="Your replies">
      <div class="reply-markup">
        <For each={props.options}>{(option) => (
          <div class="reply-markup-row">
            <button
              type="button"
              class="reply-markup-button rp"
              ref={(el) => ripple(el)}
              disabled={props.disabled}
              style={props.hint === option.index ? {'box-shadow': 'inset 0 0 0 2px #fff'} : undefined}
              onClick={() => props.onPick(option.index)}
              dir="auto"
            >
              <span class="reply-markup-button-text" dir="auto">{option.text}</span>
            </button>
          </div>
        )}</For>
      </div>
    </div>
  );
}

/** A text field of Telegram's, labelled with plain text. */
export function TextField(props: {label: string, value: string, maxLength?: number, onInput: (value: string) => void}) {
  const field = new InputField({label: 'Message', maxLength: props.maxLength, plainText: true});
  field.label?.replaceChildren(props.label);
  field.value = props.value;
  field.input.addEventListener('input', () => props.onInput(field.value));
  return <div class={styles.fieldWrap}>{field.container}</div>;
}

/** A time control as chess.com writes one: base and increment. */
export function formatTimeControl(control: {base: number, increment: number}) {
  return `${formatClock(control.base * 1000)} + ${control.increment}s`;
}

export function formatClock(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  if(ms < 10000 && ms > 0) return `0:${(ms / 1000).toFixed(1).padStart(4, '0')}`;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function signed(value: number) {
  return (value > 0 ? '+' : value < 0 ? '−' : '±') + Math.abs(value);
}

/** Whether a pick was the best reply, and which reply was. */
export function answerVerdict(turn: RizzTurn, picked: number) {
  const best = bestOption(turn);
  return {right: turn.options[picked] === best, best};
}

/** A sparkline of evaluations or ratings. */
export function Graph(props: {values: number[], center?: number, highlight?: number, onPick?: (index: number) => void}) {
  const width = 300;
  const height = 80;
  const bounds = () => {
    const values = props.values;
    let min = Math.min(...values), max = Math.max(...values);
    if(props.center !== undefined) {
      const extent = Math.max(Math.abs(max - props.center), Math.abs(min - props.center), 1);
      min = props.center - extent;
      max = props.center + extent;
    }
    return {min, span: max - min || 1};
  };
  const y = (value: number) => height - (value - bounds().min) / bounds().span * (height - 8) - 4;
  const points = () => props.values.length < 2 ? [] : props.values.map((value, index) => [index / (props.values.length - 1) * width, y(value)]);
  const path = () => points().map(([px, py], index) => `${index ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`).join(' ');

  return (
    <svg class={styles.graph} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label="Graph">
      <Show when={props.center !== undefined}>
        <line x1="0" x2={width} y1={y(props.center)} y2={y(props.center)} stroke="var(--border-color)" stroke-dasharray="4 4" />
      </Show>
      <path d={path()} fill="none" stroke="var(--primary-color)" stroke-width="2.5" vector-effect="non-scaling-stroke" stroke-linejoin="round" />
      <For each={points()}>{([px, py], index) => (
        <circle
          cx={px}
          cy={py}
          r={props.highlight === index() ? 5 : 3}
          fill={props.highlight === index() ? 'var(--primary-color)' : 'var(--surface-color)'}
          stroke="var(--primary-color)"
          stroke-width="2"
          vector-effect="non-scaling-stroke"
          style={{cursor: props.onPick ? 'pointer' : undefined}}
          onClick={() => props.onPick?.(index())}
        />
      )}</For>
    </svg>
  );
}

/** A ticking "now", for clocks. */
export function createNow(interval = 100) {
  const [now, setNow] = createSignal(Date.now());
  const id = setInterval(() => setNow(Date.now()), interval);
  onCleanup(() => clearInterval(id));
  return now;
}
