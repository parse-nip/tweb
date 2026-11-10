/*
 * A game: a chat with one of the Rizz Coach's personas, played by its simulator (`@lib/rizz/simulator`). The
 * player types; every message is graded by the Coach's classifier and wears its label as it lands; their hidden
 * interest is the vibe line. Checkmate (they say yes) wins, left on read loses, a resign gives up. Online games
 * are rated and on a clock; bot games are unrated, with the Coach's ghost text as the hint.
 */

import {batch, createMemo, createSignal, onCleanup, onMount, Show} from 'solid-js';
import {getScenarios, resultOfEnding, resultScore, RizzEndReason, RizzResult, updateRating} from '@components/rizz/engine';
import {
  applyInterest, applyVerdict, confirmTheirYes, createSimulationAt, generateSetting, getPersonaReply, gradeSimMessage, SIM_MAX_USER_MESSAGES, SimMessage,
  SimState, SimStatus
} from '@lib/rizz/simulator';
import {getRizzPersona, RizzDifficulty} from '@lib/rizz/personas';
import {getAccuracy, getAverageElo} from '@lib/rizz/ratings';
import {navigate, RizzRoute, setLeaveGuard} from '@components/rizz/router';
import {profile, pushRating, RizzGameRecord, RizzOpponent, RizzTimeControl, saveGame, TIME_CONTROLS} from '@components/rizz/store';
import {botRating, getBot, playerGender, quickBot} from '@components/rizz/world';
import {
  ActionPlate, Avatar, BubbleData, messageLook, createNow, formatClock, formatTime, formatTimeControl, menuItem, Messages, styles,
  Topbar, VibeLine
} from '@components/rizz/ui';
import Composer, {ComposerHandle} from '@components/rizz/composer';
import showBadgeLegend from '@components/rizz/legend';
import {describeMessage} from '@lib/rizz/stickers';
import {ButtonIconTsx} from '@components/buttonIconTsx';
import {confirmAction, showGameResult} from '@components/rizz/popups';
import {toast} from '@components/toast';
import classNames from '@helpers/string/classNames';

/** How long they "type" a reply of theirs, by its length. */
function typingDelay(text: string) {
  return Math.min(2200, 500 + text.length * 25);
}

const BOT_DIFFICULTY: RizzDifficulty = 'medium';

const LAST_SCENARIO_KEY = 'rizz-last-scenario';

/** Where you two met: one of the scenarios, not the one played last. */
function pickSetting() {
  let last: string;
  try {
    last = localStorage.getItem(LAST_SCENARIO_KEY);
  } catch(err) {}
  const pool = getScenarios().filter((scenario) => scenario.id !== last);
  const scenario = pool[Math.floor(Math.random() * pool.length)];
  try {
    localStorage.setItem(LAST_SCENARIO_KEY, scenario.id);
  } catch(err) {}
  return scenario.setting;
}

export default function GameScreen(props: {route: Extract<RizzRoute, {name: 'game'}>}) {
  // * every game is against a bot (a deleted one makes way for a quick pick), rated against its strength
  const picked = getBot(props.route.botId) ? {bot: getBot(props.route.botId), difficulty: props.route.difficulty || BOT_DIFFICULTY} : quickBot();
  const bot = picked.bot;
  const timeControl: RizzTimeControl = props.route.timeControl;
  const opponent: RizzOpponent = {
    id: bot.id,
    name: bot.name,
    rating: botRating(bot, picked.difficulty),
    color: bot.color,
    bot: true,
    custom: bot.custom,
    personaId: bot.id,
    difficulty: picked.difficulty
  };
  const control = timeControl && TIME_CONTROLS[timeControl];

  // * a written scene to fall back on; the game's own is written for it as it opens (`generateSetting`)
  const fallbackSetting = pickSetting();
  const [sceneReady, setSceneReady] = createSignal(false);
  const [sim, setSim] = createSignal<SimState>(createSimulationAt(opponent.personaId, opponent.difficulty, fallbackSetting, {
    name: opponent.name,
    spice: profile.settings.botSpice,
    gender: bot.gender,
    userGender: playerGender()
  }));
  const [typing, setTyping] = createSignal(false);
  const [waiting, setWaiting] = createSignal(false);
  const [over, setOver] = createSignal<{result: RizzResult, reason: RizzEndReason}>();
  const [clock, setClock] = createSignal(control ? control.base * 1000 : 0);
  const [turnStartedAt, setTurnStartedAt] = createSignal(Date.now());
  const [interestAfter, setInterestAfter] = createSignal<number[]>([]);
  const [times, setTimes] = createSignal<Map<number, string>>(new Map());
  const [drawOffered, setDrawOffered] = createSignal(false);
  const [record, setRecord] = createSignal<RizzGameRecord>();
  // * the chat's own last word: "left you on read", "said yes"
  const [endLine, setEndLine] = createSignal<string>();
  let composer: ComposerHandle;
  let nextId = 1;
  let alive = true;
  const aborts = new Set<AbortController>();
  onCleanup(() => {
    alive = false;
    aborts.forEach((controller) => controller.abort());
  });

  const myTurn = () => sceneReady() && !over() && !waiting() && !typing();

  const now = createNow(100);
  const remaining = createMemo(() => {
    if(!control) return 0;
    return myTurn() ? clock() - (now() - turnStartedAt()) : clock();
  });

  const updateMessage = (id: number, patch: Partial<SimMessage>) => {
    setSim((state) => ({...state, messages: state.messages.map((message) => message.id === id ? {...message, ...patch} : message)}));
  };

  const pushMessage = (message: Omit<SimMessage, 'id'>) => {
    const id = nextId++;
    setTimes((map) => new Map(map).set(id, formatTime()));
    setSim((state) => ({...state, messages: [...state.messages, {...message, id}]}));
    return id;
  };

  const finish = (result: RizzResult, reason: RizzEndReason) => {
    if(over()) return;
    setOver({result, reason});
    setTyping(false);
    setWaiting(false);
    aborts.forEach((controller) => controller.abort());

    const state = sim();
    const verdicts = state.messages.filter((message) => message.from === 'me' && message.verdict).map((message) => message.verdict);
    // * a bot of the player's own is practice: whoever writes the person can write a yes, so it moves no rating
    const rated = !bot.custom;
    const ratingBefore = rated ? profile.ratings.rizz : undefined;
    const ratingAfter = rated ? updateRating(ratingBefore, opponent.rating, resultScore(result), profile.played.rizz) : undefined;

    const game: RizzGameRecord = {
      id: `${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      date: Date.now(),
      timeControl,
      opponent,
      messages: state.messages.map(({grading, ...message}) => message),
      interest: interestAfter(),
      setting: state.setting,
      result,
      reason,
      ratingBefore,
      ratingAfter,
      accuracy: getAccuracy(verdicts),
      gameRating: getAverageElo(verdicts)
    };
    setRecord(game);
    if(rated) pushRating('rizz', ratingAfter);
    saveGame(game);

    setTimeout(() => alive && showGameResult(game, {
      onReview: () => navigate({name: 'review', gameId: game.id}),
      onRematch: rematch,
      onNew: () => navigate({name: 'bots'})
    }), 900);
  };

  const rematch = () => navigate({...props.route, key: Date.now()});

  /** Their replies, one after another, each with its typing. */
  const deliver = async(replies: string[]) => {
    for(const reply of replies) {
      // * nothing is typed into a chat that is over: the indicator never outlives the game
      if(!alive || over()) return;
      setTyping(true);
      await new Promise((resolve) => setTimeout(resolve, typingDelay(reply)));
      if(!alive || over()) {
        setTyping(false);
        return;
      }
      batch(() => {
        setTyping(false);
        pushMessage({from: 'them', text: reply});
      });
    }
  };

  /** The label on the player's message, once its fate is known: a blunder ends the game there and then. */
  const grade = async(snapshot: SimState, index: number, id: number, reaction: string | undefined, signal: AbortSignal) => {
    try {
      const verdict = await gradeSimMessage(snapshot, index, signal, reaction);
      if(!alive || !verdict) {
        updateMessage(id, {grading: false});
        return;
      }
      const {state, delta} = applyVerdict(sim(), verdict);
      setSim({...state, messages: state.messages.map((message) => message.id === id ? {...message, verdict, delta, grading: false} : message)});
      if(verdict.rating === 'blunder' && !over()) {
        setEndLine(`${opponent.name} left you on read`);
        finish('loss', 'blunder');
      }
    } catch(err) {
      if(!signal.aborted) console.warn('[rizz] grading failed', err);
      updateMessage(id, {grading: false});
    }
  };

  const send = async(text: string) => {
    if(!myTurn()) return;
    if(control) setClock((value) => value - (Date.now() - turnStartedAt()) + control.increment * 1000);
    const id = pushMessage({from: 'me', text, grading: true, verdict: undefined});
    setWaiting(true);
    const index = sim().messages.findIndex((message) => message.id === id);
    const snapshot = sim();

    const gradeAbort = new AbortController();
    const replyAbort = new AbortController();
    aborts.add(gradeAbort).add(replyAbort);

    // * their answer first, the label after it: a move is judged by how it landed, as an engine judges by the position
    let status: SimStatus;
    let reaction: string;
    try {
      const answer = await getPersonaReply(snapshot, replyAbort.signal);
      // * the persona claims a yes too readily: the classifier checks their words before it counts
      status = answer.status === 'won' && !(await confirmTheirYes(snapshot, answer.replies, replyAbort.signal).catch(() => false)) ?
        'continue' :
        answer.status;
      reaction = answer.replies.join(' ');
      if(!alive || over()) return;
      const grading = grade(snapshot, index, id, reaction, gradeAbort.signal);
      await new Promise((resolve) => setTimeout(resolve, 300));
      setWaiting(false);
      await deliver(answer.replies);
      if(!alive || over()) return;
      setSim((state) => applyInterest(state, answer.interest, status));
      setInterestAfter((list) => [...list, sim().interest]);
      await grading;
    } catch(err) {
      if(replyAbort.signal.aborted) return;
      setWaiting(false);
      toast(err instanceof Error && err.message ? err.message : 'They did not answer. Send again.');
      // * the message stays and is graded on its own; they simply have not answered it
      await grade(snapshot, index, id, undefined, gradeAbort.signal);
    }

    if(!alive || over()) return;

    // * a checkmate is theirs to give, in so many words: high interest only means they are keen (ask them out), and a
    // * date the player declared that they never said yes to is presumptuous, not a win
    if(sim().ending === 'checkmate' && status !== 'won') {
      setSim((state): SimState => ({
        ...state,
        ending: undefined,
        messages: state.messages.map((message) => message.id === id && message.verdict?.rating === 'checkmate' ?
          {...message, delta: undefined, verdict: {rating: 'mistake', elo: Math.min(message.verdict.elo, 700), reason: 'Declared a date they never agreed to'}} :
          message)
      }));
    }

    const state = sim();
    if(state.ending) {
      const {result, reason} = resultOfEnding(state.ending);
      setEndLine(state.ending === 'checkmate' ? `${opponent.name} said yes 💘` : state.ending === 'left-on-read' ? `${opponent.name} left you on read` : undefined);
      finish(result, reason);
      return;
    }

    if(state.messages.filter((message) => message.from === 'me').length >= SIM_MAX_USER_MESSAGES) {
      finish('draw', 'friendzone');
      return;
    }

    setTurnStartedAt(Date.now());
  };

  // * the flag falls: they stopped waiting
  const flagCheck = setInterval(() => {
    if(control && myTurn() && remaining() <= 0) finish('loss', 'timeout');
  }, 100);
  onCleanup(() => clearInterval(flagCheck));

  const resign = async() => {
    if(over()) return;
    const ok = await confirmAction({
      title: 'Resign?',
      description: bot.custom ? 'Resigning counts as a loss.' : 'Resigning counts as a loss and costs rating.',
      button: 'Resign',
      danger: true
    });
    if(ok && alive) finish('loss', 'resigned');
  };

  const offerDraw = () => {
    if(!myTurn() || drawOffered()) return;
    setDrawOffered(true);
    // * friendship is an easy yes for someone lukewarm, and a no for someone keen or long gone
    const interest = sim().interest;
    const accepted = interest >= 25 && interest <= 65;
    pushMessage({from: 'me', text: 'Honestly I think we\'d be great friends 🙂'});
    setWaiting(true);
    setTimeout(() => {
      if(!alive || over()) return;
      setWaiting(false);
      deliver([accepted ? 'Haha yeah, friends it is! 🤝' : 'Friends? Hm, I wasn\'t thinking friends…']).then(() => {
        if(accepted) finish('draw', 'agreed');
      });
    }, 600);
  };

  setLeaveGuard((next) => {
    if(over() || !alive || !sim().messages.length) return true;
    confirmAction({
      title: 'Leave the game?',
      description: 'Leaving now counts as resigning — a loss.',
      button: 'Leave',
      danger: true
    }).then((ok) => {
      if(!ok || !alive) return;
      finish('loss', 'resigned');
      setLeaveGuard(() => true);
      navigate(next);
    });
    return false;
  });

  onMount(async() => {
    const controller = new AbortController();
    aborts.add(controller);
    const timeout = new Promise<string>((resolve) => setTimeout(() => resolve(undefined), 4000));
    const scene = await Promise.race([
      generateSetting(getRizzPersona(opponent.personaId), {name: opponent.name, gender: bot.gender, userGender: playerGender(), signal: controller.signal}).catch((): string => undefined),
      timeout
    ]);
    if(!alive) return;
    controller.abort();
    if(scene) setSim((state) => ({...state, setting: scene}));
    setSceneReady(true);
    setTurnStartedAt(Date.now());
  });

  const items = createMemo<BubbleData[]>(() => sim().messages.map((message): BubbleData => ({
    text: message.text,
    ...messageLook(message.text),
    out: message.from === 'me',
    time: times().get(message.id),
    verdict: message.verdict || (message.grading ? 'pending' : undefined),
    delta: message.delta
  })).concat(endLine() ? [{text: endLine(), ghost: true} as BubbleData] : []));

  const lines = createMemo(() => sim().messages.map((message) => ({mid: message.id, out: message.from === 'me', text: describeMessage(message.text)})));

  const subtitle = () => {
    if(typing()) return <span class={styles.accent}>typing…</span>;
    if(over()) return 'last seen just now';
    const vibe = profile.settings.vibeBar ? ` · interest ${sim().interest}` : '';
    const clock = control ? ` · ${control.label} ${formatTimeControl(control)}` : '';
    return `${bot.custom ? 'your bot · practice, unrated' : `${bot.kind} · ${opponent.rating}`}${clock}${vibe}`;
  };

  return (
    <>
      <Topbar
        media={<Avatar name={opponent.name} color={opponent.color} size={42} />}
        title={opponent.name}
        subtitle={subtitle()}
        right={<>
          <ButtonIconTsx icon="info" aria-label="What the badges mean" title="What the badges mean" onClick={showBadgeLegend} />
          <Show when={control}>
          <div
            class={classNames(styles.clock, myTurn() && styles.running, myTurn() && remaining() < 10000 && styles.low)}
            role="timer"
            aria-label="Your clock"
          >
            {formatClock(remaining())}
          </div>
        </Show>
        </>}
        menu={[
          menuItem('lamp', 'Hint', () => composer?.suggest(), {verify: () => myTurn() && profile.settings.ghost}),
          ...(bot.custom ? [menuItem('edit', 'Edit bot', () => navigate({name: 'botMaker', botId: bot.id}))] : []),
          menuItem('smile', 'Offer friendship', offerDraw, {verify: () => myTurn() && !drawOffered() && sim().messages.length > 0}),
          menuItem('flag', 'Resign', resign, {danger: true, verify: () => !over()})
        ]}
      />
      <div class={styles.chatRow}>
      <div class={styles.chatBody}>
      <Show when={profile.settings.vibeBar}>
        <VibeLine probability={sim().interest / 100} />
      </Show>
      <Messages service={sceneReady() ? `${sim().setting}\nYou open.` : 'Setting the scene…'} items={items()} typing={typing()} />
      <div class={styles.composer}>
        <Show when={!over()} fallback={
          <ActionPlate
            label="Game Review"
            onClick={() => record() && navigate({name: 'review', gameId: record().id})}
            right={{icon: 'reload_star', label: 'Rematch', onClick: rematch}}
          />
        }>
          <Composer
            ref={(handle) => composer = handle}
            placeholder={waiting() ? `${opponent.name} is reading…` : 'Message'}
            disabled={!myTurn()}
            lines={lines}
            ghost={profile.settings.ghost}
            spice={profile.settings.ghostSpice}
            onSend={send}
            left={<Show when={profile.settings.ghost}>
              <ButtonIconTsx icon="lamp" aria-label="Hint" title="Hint" disabled={!myTurn()} onClick={() => composer?.suggest()} />
            </Show>}
          />
        </Show>
      </div>
      </div>
      </div>
    </>
  );
}
