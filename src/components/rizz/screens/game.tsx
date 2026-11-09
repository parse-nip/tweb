/*
 * A game: a conversation against a bot (unrated, untimed, with a hint) or an online opponent
 * (rated, on a clock). Their messages arrive with Telegram's "typing…"; the player's moves are the
 * bot keyboard under the message box, the game's actions the topbar's menu.
 */

import {batch, createMemo, createSignal, onCleanup, onMount, Show} from 'solid-js';
import {
  acceptsDraw, bestOption, difficultyForRating, endGame, endingMessage, getScenario, getScenarios, newGame, optionOrder,
  playMove, resultScore, RizzGameState, summarizeGame, updateRating, winProbability
} from '@components/rizz/engine';
import {PERSONALITIES} from '@components/rizz/content/bots';
import {navigate, RizzRoute, setLeaveGuard} from '@components/rizz/router';
import {profile, pushRating, RizzGameRecord, RizzOpponent, RizzTimeControl, saveGame, TIME_CONTROLS} from '@components/rizz/store';
import {addTrophies, findOpponent, getBot, TROPHIES} from '@components/rizz/world';
import {
  ActionPlate, Avatar, BubbleData, createNow, formatClock, formatTime, formatTimeControl, InputBox, menuItem, Messages,
  ReplyKeyboard, styles, Topbar, VibeLine
} from '@components/rizz/ui';
import {ButtonIconTsx} from '@components/buttonIconTsx';
import {confirmAction, showGameResult} from '@components/rizz/popups';
import {toast} from '@components/toast';
import classNames from '@helpers/string/classNames';

const LAST_SCENARIO_KEY = 'rizz-last-scenario';

function pickScenario(fixed?: string) {
  if(fixed && getScenario(fixed)) return getScenario(fixed);
  let last: string;
  try {
    last = localStorage.getItem(LAST_SCENARIO_KEY);
  } catch(err) {}
  const pool = getScenarios().filter((scenario) => scenario.id !== last);
  const scenario = pool[Math.floor(Math.random() * pool.length)];
  try {
    localStorage.setItem(LAST_SCENARIO_KEY, scenario.id);
  } catch(err) {}
  return scenario;
}

/** How long they "type", by the length of what they say. */
function typingDelay(text: string) {
  return Math.min(2400, 700 + text.length * 18 + Math.random() * 400);
}

export default function GameScreen(props: {route: Extract<RizzRoute, {name: 'game'}>}) {
  const bot = props.route.botId ? getBot(props.route.botId) : undefined;
  const timeControl: RizzTimeControl = bot ? undefined : props.route.timeControl || 'blitz';
  const opponent: RizzOpponent = bot ?
    {id: bot.id, name: bot.name, rating: bot.rating, color: bot.color, title: bot.title, bot: true} :
    findOpponent(timeControl);
  const difficulty = bot ?
    bot.difficulty * (bot.personality ? PERSONALITIES[bot.personality].factor : 1) :
    difficultyForRating(opponent.rating);
  const scenario = pickScenario(bot?.scenarioId);
  const seed = Math.floor(Math.random() * 1e9);
  const control = timeControl && TIME_CONTROLS[timeControl];

  const [state, setState] = createSignal<RizzGameState>(newGame(scenario.id, difficulty));
  const [items, setItems] = createSignal<BubbleData[]>([]);
  const [typing, setTyping] = createSignal(false);
  const [myTurn, setMyTurn] = createSignal(false);
  const [hint, setHint] = createSignal<number>();
  const [clock, setClock] = createSignal(control ? control.base * 1000 : 0);
  const [turnStartedAt, setTurnStartedAt] = createSignal(0);
  const [drawOffered, setDrawOffered] = createSignal(false);
  const [keyboardShown, setKeyboardShown] = createSignal(true);
  const [record, setRecord] = createSignal<RizzGameRecord>();
  const timers = new Set<number>();
  let alive = true;

  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timers.delete(id);
      if(alive) fn();
    }, ms);
    timers.add(id);
  };

  onCleanup(() => {
    alive = false;
    timers.forEach((id) => clearTimeout(id));
  });

  const push = (item: BubbleData) => {
    setItems((list) => [...list, {...item, time: formatTime()}]);
  };

  const now = createNow(100);
  const remaining = createMemo(() => {
    if(!control) return 0;
    return myTurn() ? clock() - (now() - turnStartedAt()) : clock();
  });

  const startTurn = () => batch(() => {
    setMyTurn(true);
    setTurnStartedAt(Date.now());
  });

  const theyType = (text: string, then: () => void) => {
    setTyping(true);
    later(() => {
      batch(() => {
        setTyping(false);
        push({text});
      });
      then();
    }, typingDelay(text));
  };

  const rematch = () => navigate({...props.route, key: Date.now()});

  const finish = (final: RizzGameState) => {
    // * whatever was on its way (their reply to a reply, a draw answer) never comes: the game is over
    timers.forEach((id) => clearTimeout(id));
    timers.clear();
    setTyping(false);
    setState(final);
    setMyTurn(false);
    const summary = summarizeGame(final.moves);
    const rated = !!timeControl;
    const ratingBefore = rated ? profile.ratings[timeControl] : undefined;
    const ratingAfter = rated ?
      updateRating(ratingBefore, opponent.rating, resultScore(final.result), profile.played[timeControl]) :
      undefined;

    const game: RizzGameRecord = {
      id: `${Date.now()}-${seed}`,
      date: Date.now(),
      timeControl,
      opponent,
      scenarioId: scenario.id,
      difficulty,
      seed,
      moves: final.moves,
      result: final.result,
      reason: final.reason,
      ratingBefore,
      ratingAfter,
      accuracy: summary.accuracy,
      gameRating: summary.gameRating
    };
    setRecord(game);

    if(rated) {
      pushRating(timeControl, ratingAfter);
      addTrophies(TROPHIES[final.result]);
    }
    saveGame(game);

    const reveal = () => showGameResult(game, {
      onReview: () => navigate({name: 'review', gameId: game.id}),
      onRematch: rematch,
      onNew: () => navigate(bot ? {name: 'bots'} : {name: 'game', timeControl, key: Date.now()})
    });

    const last = endingMessage(final);
    if(final.reason === 'ghosted' && final.turn < scenario.turns.length) {
      // * they stop answering mid-game: no typing, a line from the chat itself
      push({text: `${opponent.name} left you on read`, ghost: true});
      later(reveal, 900);
    } else if(last) {
      theyType(last, () => later(reveal, 700));
    } else {
      const line = final.reason === 'timeout' ? 'Time is up — you left them on read' :
        final.reason === 'agreed' ? 'You agreed to be friends' :
        'You unmatched';
      push({text: line, ghost: true});
      later(reveal, 400);
    }
  };

  const pick = (optionIndex: number) => {
    const current = state();
    if(!myTurn() || current.over) return;
    const spent = Date.now() - turnStartedAt();
    const turn = scenario.turns[current.turn];
    batch(() => {
      setMyTurn(false);
      setHint(undefined);
      if(control) setClock((value) => value - spent + control.increment * 1000);
      push({text: turn.options[optionIndex].text, out: true});
    });

    const next = playMove(current, optionIndex, spent);
    if(next.over) {
      later(() => finish(next), 500);
      return;
    }

    setState(next);
    later(() => theyType(next.them, startTurn), 400 + Math.random() * 500);
  };

  // * the flag falls: they stopped waiting
  const flagCheck = setInterval(() => {
    if(control && myTurn() && remaining() <= 0 && !state().over) {
      finish(endGame(state(), 'loss', 'timeout'));
    }
  }, 100);
  onCleanup(() => clearInterval(flagCheck));

  const resign = async() => {
    if(state().over) return;
    const ok = await confirmAction({
      title: 'Unmatch?',
      description: timeControl ? 'Resigning counts as a loss and costs rating.' : 'Resigning counts as a loss.',
      button: 'Unmatch',
      danger: true
    });
    if(ok && !state().over && alive) finish(endGame(state(), 'loss', 'resigned'));
  };

  const offerDraw = () => {
    if(state().over || !myTurn() || drawOffered()) return;
    setDrawOffered(true);
    const accepted = acceptsDraw(state());
    if(control) setClock(remaining());
    setMyTurn(false);
    push({text: 'Honestly I think we\'d be great friends 🙂', out: true});
    later(() => theyType(accepted ? 'Haha yeah, friends it is! 🤝' : 'Friends? Hm, I wasn\'t thinking friends…', () => {
      if(accepted) finish(endGame(state(), 'draw', 'agreed'));
      else startTurn();
    }), 500);
  };

  const useHint = () => {
    if(!bot || !myTurn() || hint() !== undefined) return;
    const turn = scenario.turns[state().turn];
    setHint(turn.options.indexOf(bestOption(turn)));
    setKeyboardShown(true);
    toast('The engine\'s pick is outlined');
  };

  setLeaveGuard((next) => {
    if(state().over || !alive) return true;
    confirmAction({
      title: 'Leave the game?',
      description: 'Leaving now counts as unmatching — a loss.',
      button: 'Leave',
      danger: true
    }).then((ok) => {
      if(!ok || !alive) return;
      if(!state().over) finish(endGame(state(), 'loss', 'resigned'));
      setLeaveGuard(() => true);
      navigate(next);
    });
    return false;
  });

  onMount(() => {
    later(() => {
      if(scenario.opener) theyType(scenario.opener, startTurn);
      else startTurn();
    }, 600);
  });

  const options = createMemo(() => {
    const current = state();
    if(current.over) return [];
    const turn = scenario.turns[current.turn];
    return optionOrder(turn, seed + current.turn).map((index) => ({text: turn.options[index].text, index}));
  });

  const probability = () => winProbability(state().evaluation);

  const subtitle = () => {
    if(typing()) return <span class={styles.accent}>typing…</span>;
    if(state().over) return 'last seen just now';
    const vibe = profile.settings.vibeBar ? ` · vibe ${Math.round(probability() * 100)}%` : '';
    return bot ?
      `bot · ${opponent.rating}${vibe}` :
      `${opponent.rating} · ${control.label} ${formatTimeControl(control)}${vibe}`;
  };

  const status = () => {
    if(typing()) return `${opponent.name} is typing…`;
    if(!myTurn()) return 'Waiting…';
    return keyboardShown() ? 'Choose your reply' : 'Your move';
  };

  return (
    <>
      <Topbar
        media={<Avatar name={opponent.name} color={opponent.color} size={42} />}
        title={<>{opponent.title && <span class={styles.titleChip}>{opponent.title}</span>}{opponent.name}</>}
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
          ...(bot ? [menuItem('lamp', 'Hint', useHint, {verify: () => myTurn() && hint() === undefined})] : []),
          ...(bot?.custom ? [menuItem('edit', 'Edit bot', () => navigate({name: 'botMaker', botId: bot.id}))] : []),
          menuItem('smile', 'Offer friendship', offerDraw, {verify: () => myTurn() && !drawOffered()}),
          menuItem('flag', 'Unmatch', resign, {danger: true, verify: () => !state().over})
        ]}
      />
      <Show when={profile.settings.vibeBar}>
        <VibeLine probability={probability()} />
      </Show>
      <Messages service={scenario.setting} items={items()} typing={typing()} />
      <div class={styles.composer}>
        <Show when={!state().over} fallback={
          <ActionPlate
            label="Game Review"
            onClick={() => record() && navigate({name: 'review', gameId: record().id})}
            right={{icon: 'reload_star', label: 'Rematch', onClick: rematch}}
          />
        }>
          <InputBox
            left={<Show when={bot}>
              <ButtonIconTsx icon="lamp" aria-label="Hint" title="Hint" disabled={!myTurn() || hint() !== undefined} onClick={useHint} />
            </Show>}
            right={<ButtonIconTsx
              icon={keyboardShown() ? 'down' : 'keyboard'}
              aria-label={keyboardShown() ? 'Hide replies' : 'Show replies'}
              onClick={() => setKeyboardShown((value) => !value)}
            />}
          >
            {status()}
          </InputBox>
          <Show when={keyboardShown()}>
            <ReplyKeyboard options={options()} onPick={pick} disabled={!myTurn()} hint={hint()} />
          </Show>
        </Show>
      </div>
    </>
  );
}
