/*
 * Rizzmate — the game this fork became, booted by `src/index.ts` instead of the messenger.
 *
 * The shell: Telegram's left column as the game's menu — what to do, in a few sections (Play, Train, Compete), then
 * your games as the chats they are — under a burger and a search (which finds the bots too), the pencil for a new
 * game; the open screen in the middle column over the chat wallpaper.
 */

import {createMemo, createSignal, For, JSX, Match, Show, Switch} from 'solid-js';
import classNames from '@helpers/string/classNames';
import {ButtonMenuToggleTsx} from '@components/buttonMenuToggleTsx';
import InputSearch from '@components/inputSearch';
import LESSONS from '@components/rizz/content/lessons';
import {dayKey} from '@components/rizz/engine';
import {navigate, route, RizzRoute} from '@components/rizz/router';
import {profile, touchVisit} from '@components/rizz/store';
import {allBots, DIVISIONS, leagueTable, settleLeague, syncCustomPersonas} from '@components/rizz/world';
import {Avatar, ListRow, menuItem, styles} from '@components/rizz/ui';
import GameRow from '@components/rizz/gameRow';
import {setSandboxTheme} from '@components/popupSandbox/environment';
import {appSettings} from '@stores/appSettings';
import GameScreen from '@components/rizz/screens/game';
import ReviewScreen from '@components/rizz/screens/review';
import {DailyScreen, PuzzlesScreen, RushScreen} from '@components/rizz/screens/puzzles';
import {LessonScreen, LessonsScreen} from '@components/rizz/screens/learn';
import {LeaderboardScreen, LeaguesScreen} from '@components/rizz/screens/social';
import {ArchiveScreen, ProfileScreen, SettingsScreen} from '@components/rizz/screens/profile';
import {BotsScreen, HomeScreen, PlayScreen} from '@components/rizz/screens/play';
import BotMakerScreen from '@components/rizz/screens/botMaker';

type Entry = {
  key: string,
  route: RizzRoute,
  /** what the search matches */
  text: string,
  media: JSX.Element,
  title: JSX.Element,
  subtitle: JSX.Element,
  meta?: JSX.Element,
  badge?: JSX.Element,
  pinned?: boolean
};

type Section = {label: string, entries: Entry[]};

function isActive(entry: Entry) {
  const current = route();
  if(current.name === 'game' && entry.route.name === 'game') return current.botId === entry.route.botId;
  if(current.name === entry.route.name) return true;
  if(entry.route.name === 'play' && current.name === 'game' && !current.botId) return true;
  if(entry.route.name === 'bots' && ((current.name === 'game' && current.botId) || current.name === 'botMaker')) return true;
  if(entry.route.name === 'lessons' && current.name === 'lesson') return true;
  return false;
}

function isNight() {
  return appSettings.theme === 'night' ||
    (appSettings.theme === 'system' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches);
}

export default function RizzApp() {
  const [query, setQuery] = createSignal('');

  // * a visit counts for the streak; a new week settles last week's league
  touchVisit();
  settleLeague();
  // * the player's own bots are personas the simulator can play
  syncCustomPersonas();

  const search = new InputSearch({placeholder: 'Search', onChange: (value) => setQuery(value.trim().toLowerCase())});

  const sections = createMemo<Section[]>(() => {
    const dailyDone = profile.daily.last === dayKey();
    const division = DIVISIONS[profile.league.division];
    const leagueRank = leagueTable().findIndex((entry) => entry.me) + 1;
    const bots = allBots();

    return [{
      label: 'Play',
      entries: [{
        key: 'play',
        route: {name: 'play'},
        text: 'play online rated bullet blitz rapid',
        media: <Avatar icon="fire" color="blue" />,
        title: 'Play Online',
        subtitle: `Rated · Blitz ${profile.ratings.blitz}`
      }, {
        key: 'bots',
        route: {name: 'bots'},
        text: 'play bots ' + bots.map((bot) => bot.name.toLowerCase()).join(' '),
        media: <Avatar icon="bots" color="green" />,
        title: 'Play Bots',
        subtitle: `${bots.length} bots · ${profile.beatenBots.length} beaten`
      }]
    }, {
      label: 'Train',
      entries: [{
        key: 'daily',
        route: {name: 'daily'},
        text: 'daily puzzle',
        media: <Avatar icon="calendar" color="orange" />,
        title: 'Daily Puzzle',
        subtitle: dailyDone ? `Solved · ${profile.daily.streak} day streak` : 'Today\'s puzzle is waiting',
        badge: !dailyDone && <span class={styles.unreadBadge}>1</span>
      }, {
        key: 'puzzles',
        route: {name: 'puzzles'},
        text: 'puzzles',
        media: <Avatar icon="lamp" color="green" />,
        title: 'Puzzles',
        subtitle: `Write the best next message · ${profile.puzzlesSolved.length} solved`,
        meta: String(profile.ratings.puzzles)
      }, {
        key: 'rush',
        route: {name: 'rush'},
        text: 'puzzle rush',
        media: <Avatar icon="hourglass" color="red" />,
        title: 'Puzzle Rush',
        subtitle: profile.rushBest ? `Best ${profile.rushBest}` : '3 minutes, 3 strikes'
      }, {
        key: 'lessons',
        route: {name: 'lessons'},
        text: 'lessons coach rizzo learn',
        media: <Avatar icon="channel" color="violet" />,
        title: 'Lessons',
        subtitle: `Coach Rizzo · ${profile.lessonsDone.length} of ${LESSONS.length} done`
      }]
    }, {
      label: 'Compete',
      entries: [{
        key: 'leagues',
        route: {name: 'leagues'},
        text: 'leagues trophies ' + division.name.toLowerCase(),
        media: <Avatar icon="crown" color="stars" />,
        title: `${division.name} League`,
        subtitle: `#${leagueRank} this week · ${profile.league.trophies} trophies`
      }, {
        key: 'leaderboard',
        route: {name: 'leaderboard'},
        text: 'leaderboard top',
        media: <Avatar icon="poll" color="cyan" />,
        title: 'Leaderboard',
        subtitle: 'The world\'s best rizzers'
      }]
    }];
  });

  // * searching finds the bots by name too, as chats to open
  const searchResults = createMemo(() => {
    const q = query();
    if(!q) return;
    const entries = sections().flatMap((section) => section.entries).filter((entry) => entry.text.includes(q));
    const bots = allBots().filter((bot) => `${bot.name} ${bot.kind || ''}`.toLowerCase().includes(q));
    const games = profile.games.filter((game) => game.opponent.name.toLowerCase().includes(q));
    return {entries, bots, games};
  });

  const open = (entry: Entry) => navigate(entry.route);
  const activeGameId = () => {
    const current = route();
    return current.name === 'review' ? current.gameId : undefined;
  };

  const renderEntry = (entry: Entry) => (
    <ListRow
      media={entry.media}
      title={entry.title}
      subtitle={entry.subtitle}
      meta={entry.meta}
      badge={entry.badge}
      pinned={entry.pinned}
      active={isActive(entry)}
      onClick={() => open(entry)}
    />
  );

  return (
    <div class={classNames(styles.app, route().name === 'home' && styles.isHomeRoute)}>
      <nav class={styles.left} aria-label="Menu">
        <div class={styles.header}>
          <ButtonMenuToggleTsx
            icon="menu"
            direction="bottom-right"
            buttons={[
              menuItem('message', 'Home', () => navigate({name: 'home'})),
              menuItem('user', 'My Profile', () => navigate({name: 'profile'})),
              menuItem('bots', 'Create a bot', () => navigate({name: 'botMaker'})),
              menuItem('archive', 'Game Archive', () => navigate({name: 'archive'})),
              menuItem('settings', 'Settings', () => navigate({name: 'settings'})),
              menuItem('darkmode', 'Night Mode', () => setSandboxTheme(isNight() ? 'day' : 'night'))
            ]}
          />
          {search.container}
        </div>
        <div class={styles.list}>
          <Show when={searchResults()} fallback={<>
            <For each={sections()}>{(section) => <>
              <div class={styles.listLabel}>{section.label}</div>
              <For each={section.entries}>{renderEntry}</For>
            </>}</For>
            <Show when={profile.games.length}>
              <div class={styles.listLabel}>Recent games</div>
              <For each={profile.games.slice(0, 20)}>{(game) => <GameRow game={game} active={activeGameId() === game.id} />}</For>
            </Show>
          </>}>
            {(results) => <>
              <For each={results().entries}>{renderEntry}</For>
              <Show when={results().bots.length}>
                <div class={styles.listLabel}>Bots</div>
                <For each={results().bots}>{(bot) => (
                  <ListRow
                    media={<Avatar name={bot.name} color={bot.color} />}
                    title={bot.name}
                    subtitle={bot.kind ? `${bot.kind} · ${bot.tagline}` : bot.tagline}
                    meta={String(bot.rating)}
                    onClick={() => navigate({name: 'bots', botId: bot.id})}
                  />
                )}</For>
              </Show>
              <Show when={results().games.length}>
                <div class={styles.listLabel}>Games</div>
                <For each={results().games}>{(game) => <GameRow game={game} />}</For>
              </Show>
            </>}
          </Show>
        </div>
        <ButtonMenuToggleTsx
          class={styles.fab}
          icon="newchat_filled"
          direction="top-left"
          buttons={[
            menuItem('fire', 'Quick game · Blitz', () => navigate({name: 'game', timeControl: 'blitz', key: Date.now()})),
            menuItem('bots', 'Play a bot', () => navigate({name: 'bots'})),
            menuItem('add', 'Create a bot', () => navigate({name: 'botMaker'}))
          ]}
        />
      </nav>
      <main class={styles.center}>
        <Switch>
          <Match when={route().name === 'home'}><HomeScreen /></Match>
          <Match when={route().name === 'play'}><PlayScreen /></Match>
          <Match when={route().name === 'bots' && route() as Extract<RizzRoute, {name: 'bots'}>} keyed>
            {(current) => <BotsScreen botId={current.botId} />}
          </Match>
          <Match when={route().name === 'botMaker' && route() as Extract<RizzRoute, {name: 'botMaker'}>} keyed>
            {(current) => <BotMakerScreen botId={current.botId} />}
          </Match>
          <Match when={route().name === 'game' && route() as Extract<RizzRoute, {name: 'game'}>} keyed>
            {(current) => <GameScreen route={current} />}
          </Match>
          <Match when={route().name === 'review' && route() as Extract<RizzRoute, {name: 'review'}>} keyed>
            {(current) => <ReviewScreen gameId={current.gameId} />}
          </Match>
          <Match when={route().name === 'puzzles'}><PuzzlesScreen /></Match>
          <Match when={route().name === 'daily'}><DailyScreen /></Match>
          <Match when={route().name === 'rush'}><RushScreen /></Match>
          <Match when={route().name === 'lessons'}><LessonsScreen /></Match>
          <Match when={route().name === 'lesson' && route() as Extract<RizzRoute, {name: 'lesson'}>} keyed>
            {(current) => <LessonScreen lessonId={current.lessonId} />}
          </Match>
          <Match when={route().name === 'leaderboard'}><LeaderboardScreen /></Match>
          <Match when={route().name === 'leagues'}><LeaguesScreen /></Match>
          <Match when={route().name === 'profile'}><ProfileScreen /></Match>
          <Match when={route().name === 'archive'}><ArchiveScreen /></Match>
          <Match when={route().name === 'settings'}><SettingsScreen /></Match>
        </Switch>
      </main>
    </div>
  );
}
