/*
 * A game: a chat with one of the Rizz Coach's personas, played by its simulator (`@lib/rizz/simulator`). The
 * player types; every message is graded by the Coach's classifier and wears its label as it lands; their hidden
 * interest is the vibe line. Checkmate (they say yes) wins, left on read loses, a resign gives up. Online games
 * are rated and on a clock; bot games are unrated, with the Coach's ghost text as the hint.
 */

import {batch, createMemo, createSignal, onCleanup, onMount, Show} from 'solid-js';
import {resultOfEnding, resultScore, RizzEndReason, RizzResult, updateRating} from '@components/rizz/engine';
import {
  applyInterest, applyVerdict, createSimulation, getPersonaReply, gradeSimMessage, SIM_MAX_USER_MESSAGES, SimMessage, SimState
} from '@lib/rizz/simulator';
import {getRizzPersona, RizzDifficulty} from '@lib/rizz/personas';
import {getAccuracy, getAverageElo} from '@lib/rizz/ratings';
import {navigate, RizzRoute, setLeaveGuard} from '@components/rizz/router';
import {profile, pushRating, RizzGameRecord, RizzOpponent, RizzTimeControl, saveGame, TIME_CONTROLS} from '@components/rizz/store';
import {addTrophies, findOpponent, getBot, TROPHIES} from '@components/rizz/world';
import {
  ActionPlate, Avatar, BubbleData, createNow, formatClock, formatTime, formatTimeControl, menuItem, Messages, styles,
  Topbar, VibeLine
} from '@components/rizz/ui';
import Composer, {ComposerHandle} from '@components/rizz/composer';
import {ButtonIconTsx} from '@components/buttonIconTsx';
import {confirmAction, showGameResult} from '@components/rizz/popups';
import {toast} from '@components/toast';
import classNames from '@helpers/string/classNames';

/** How long they "type" a reply of theirs, by its length. */
function typingDelay(text: string) {
  return Math.min(2200, 500 + text.length * 25);
}

const BOT_DIFFICULTY: RizzDifficulty = 'medium';

export default function GameScreen(props: {route: Extract<RizzRoute, {name: 'game'}>}) {
  const bot = props.route.botId ? getBot(props.route.botId) : undefined;
  const timeControl: RizzTimeControl = bot ? undefined : props.route.timeControl || 'blitz';
  const opponent: RizzOpponent = bot ?
    {id: bot.id, name: bot.name, rating: bot.rating, color: bot.color, bot: true, personaId: bot.id, difficulty: BOT_DIFFICULTY} :
    findOpponent(timeControl);
  const persona = getRizzPersona(opponent.personaId);
  const control = timeControl && TIME_CONTROLS[timeControl];

  const [sim, setSim] = createSignal<SimState>(createSimulation(opponent.personaId, opponent.difficulty));
  const [typing, setTyping] = createSignal(false);
  const [waiting, setWaiting] = createSignal(false);
  const [over, setOver] = createSignal<{result: RizzResult, reason: RizzEndReason}>();
  const [clock, setClock] = createSignal(control ? control.base * 1000 : 0);
  const [turnStartedAt, setTurnStartedAt] = createSignal(Date.now());
  const [interestAfter, setInterestAfter] = createSignal<number[]>([]);
  const [times, setTimes] = createSignal<Map<number, string>>(new Map());
  const [drawOffered, setDrawOffered] = createSignal(false);
  const [record, setRecord] = createSignal<RizzGameRecord>();
  let composer: ComposerHandle;
  let nextId = 1;
  let alive = true;
  const aborts = new Set<AbortController>();
  onCleanup(() => {
    alive = false;
    aborts.forEach((controller) => controller.abort());
  });

  const myTurn = () => !over() && !waiting() && !typing();

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
    const rated = !!timeControl;
    const ratingBefore = rated ? profile.ratings[timeControl] : undefined;
    const ratingAfter = rated ? updateRating(ratingBefore, opponent.rating, resultScore(result), profile.played[timeControl]) : undefined;

    const game: RizzGameRecord = {
      id: `${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      date: Date.now(),
      timeControl,
      opponent,
      messages: state.messages.map(({grading, ...message}) => message),
      interest: interestAfter(),
      result,
      reason,
      ratingBefore,
      ratingAfter,
      accuracy: getAccuracy(verdicts),
      gameRating: getAverageElo(verdicts)
    };
    setRecord(game);
    if(rated) {
      pushRating(timeControl, ratingAfter);
      addTrophies(TROPHIES[result]);
    }
    saveGame(game);

    setTimeout(() => alive && showGameResult(game, {
      onReview: () => navigate({name: 'review', gameId: game.id}),
      onRematch: rematch,
      onNew: () => navigate(bot ? {name: 'bots'} : {name: 'game', timeControl, key: Date.now()})
    }), 900);
  };

  const rematch = () => navigate({...props.route, key: Date.now()});

  /** Their replies, one after another, each with its typing. */
  const deliver = async(replies: string[]) => {
    for(const reply of replies) {
      setTyping(true);
      await new Promise((resolve) => setTimeout(resolve, typingDelay(reply)));
      if(!alive || over()) return;
      batch(() => {
        setTyping(false);
        pushMessage({from: 'them', text: reply});
      });
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

    // * the label and their answer are worked out side by side: the badge spins until the classifier has spoken
    const grading = gradeSimMessage(snapshot, index, gradeAbort.signal).then((verdict) => {
      if(!alive || !verdict) {
        updateMessage(id, {grading: false});
        return;
      }
      const {state, delta} = applyVerdict(sim(), verdict);
      setSim({...state, messages: state.messages.map((message) => message.id === id ? {...message, verdict, delta, grading: false} : message)});
    }).catch((err) => {
      if(!gradeAbort.signal.aborted) console.warn('[rizz] grading failed', err);
      updateMessage(id, {grading: false});
    });

    try {
      const answer = await getPersonaReply(snapshot, replyAbort.signal);
      if(!alive || over()) return;
      await new Promise((resolve) => setTimeout(resolve, 300));
      setWaiting(false);
      await deliver(answer.replies);
      if(!alive || over()) return;
      setSim((state) => applyInterest(state, answer.interest, answer.status));
      setInterestAfter((list) => [...list, sim().interest]);
    } catch(err) {
      if(replyAbort.signal.aborted) return;
      setWaiting(false);
      toast(err instanceof Error && err.message ? err.message : 'They did not answer. Send again.');
      // the message stays; they simply have not answered it
    }

    await grading;
    if(!alive || over()) return;

    const state = sim();
    if(state.ending) {
      const {result, reason} = resultOfEnding(state.ending);
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
      description: timeControl ? 'Resigning counts as a loss and costs rating.' : 'Resigning counts as a loss.',
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

  onMount(() => setTurnStartedAt(Date.now()));

  const items = createMemo<BubbleData[]>(() => sim().messages.map((message) => ({
    text: message.text,
    out: message.from === 'me',
    time: times().get(message.id),
    verdict: message.verdict || (message.grading ? 'pending' : undefined),
    delta: message.delta
  })));

  const lines = createMemo(() => sim().messages.map((message) => ({mid: message.id, out: message.from === 'me', text: message.text})));

  const subtitle = () => {
    if(typing()) return <span class={styles.accent}>typing…</span>;
    if(over()) return 'last seen just now';
    const vibe = profile.settings.vibeBar ? ` · interest ${sim().interest}` : '';
    return bot ?
      `bot · ${opponent.rating}${vibe}` :
      `${opponent.rating} · ${control.label} ${formatTimeControl(control)}${vibe}`;
  };

  return (
    <>
      <Topbar
        media={<Avatar name={opponent.name} color={opponent.color} size={42} />}
        title={opponent.name}
        subtitle={subtitle()}
        right={<Show when={control}>
          <div
            class={classNames(styles.clock, myTurn() && styles.running, myTurn() && remaining() < 10000 && styles.low)}
            role="timer"
            aria-label="Your clock"
          >
            {formatClock(remaining())}
          </div>
        </Show>}
        menu={[
          ...(bot ? [menuItem('lamp', 'Hint', () => composer?.suggest(), {verify: myTurn})] : []),
          ...(bot?.custom ? [menuItem('edit', 'Edit bot', () => navigate({name: 'botMaker', botId: bot.id}))] : []),
          menuItem('smile', 'Offer friendship', offerDraw, {verify: () => myTurn() && !drawOffered() && sim().messages.length > 0}),
          menuItem('flag', 'Resign', resign, {danger: true, verify: () => !over()})
        ]}
      />
      <Show when={profile.settings.vibeBar}>
        <VibeLine probability={sim().interest / 100} />
      </Show>
      <Messages service={`${persona.name} · ${persona.tagline}\nYou open.`} items={items()} typing={typing()} />
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
            onSend={send}
            left={<Show when={bot}>
              <ButtonIconTsx icon="lamp" aria-label="Hint" title="Hint" disabled={!myTurn()} onClick={() => composer?.suggest()} />
            </Show>}
          />
        </Show>
      </div>
    </>
  );
}
