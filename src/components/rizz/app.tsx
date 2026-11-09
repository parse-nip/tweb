/*
 * Rizzmate — the game this fork became, booted by `src/index.ts` instead of the messenger.
 *
 * The shell: Telegram's left column as the game's menu — modes and opponents as chats under a
 * burger and a search, folders as sections, the pencil for something new — and the open screen in
 * the middle column over the chat wallpaper.
 */

import {createMemo, createSignal, For, JSX, Match, Show, Switch} from 'solid-js';
import classNames from '@helpers/string/classNames';
import {ButtonMenuToggleTsx} from '@components/buttonMenuToggleTsx';
import InputSearch from '@components/inputSearch';
import {IconTsx} from '@components/iconTsx';
import LESSONS from '@components/rizz/content/lessons';
import {dayKey} from '@components/rizz/engine';
import {navigate, route, RizzRoute} from '@components/rizz/router';
import {profile, touchVisit} from '@components/rizz/store';
import {allBots, DIVISIONS, leagueTable, settleLeague} from '@components/rizz/world';
import {Avatar, ListRow, menuItem, styles} from '@components/rizz/ui';
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

type Folder = 'all' | 'play' | 'train' | 'social';

const FOLDERS: {id: Folder, label: string}[] = [
  {id: 'all', label: 'All'},
  {id: 'play', label: 'Play'},
  {id: 'train', label: 'Train'},
  {id: 'social', label: 'Social'}
];

type Entry = {
  key: string,
  folder: Exclude<Folder, 'all'>,
  route: RizzRoute,
  /** What the search matches. */
  text: string,
  media: JSX.Element,
  title: JSX.Element,
  subtitle: JSX.Element,
  meta?: JSX.Element,
  badge?: JSX.Element,
  pinned?: boolean
};

function isActive(entry: Entry) {
  const current = route();
  if(current.name === 'game' && entry.route.name === 'game') return current.botId === entry.route.botId;
  if(current.name === entry.route.name) return true;
  if(entry.route.name === 'play' && current.name === 'game' && !current.botId) return true;
  if(entry.route.name === 'lessons' && current.name === 'lesson') return true;
  if(entry.route.name === 'archive' && current.name === 'review') return true;
  return false;
}

function isNight() {
  return appSettings.theme === 'night' ||
    (appSettings.theme === 'system' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches);
}

export default function RizzApp() {
  const [folder, setFolder] = createSignal<Folder>('all');
  const [query, setQuery] = createSignal('');

  // * a visit counts for the streak; a new week settles last week's league
  touchVisit();
  settleLeague();

  const search = new InputSearch({placeholder: 'Search', onChange: (value) => setQuery(value.trim().toLowerCase())});

  const entries = createMemo<Entry[]>(() => {
    const dailyDone = profile.daily.last === dayKey();
    const lastGame = profile.games[0];
    const division = DIVISIONS[profile.league.division];
    const leagueRank = leagueTable().findIndex((entry) => entry.me) + 1;

    const list: Entry[] = [{
      key: 'play',
      folder: 'play',
      pinned: true,
      route: {name: 'play'},
      text: 'play online rated bullet blitz rapid',
      media: <Avatar icon="fire" color="blue" />,
      title: 'Play Online',
      subtitle: `Blitz ${profile.ratings.blitz} · Bullet ${profile.ratings.bullet} · Rapid ${profile.ratings.rapid}`
    }, {
      key: 'daily',
      folder: 'train',
      pinned: dailyDone,
      route: {name: 'daily'},
      text: 'daily puzzle',
      media: <Avatar icon="calendar" color="orange" />,
      title: 'Daily Puzzle',
      subtitle: dailyDone ? `Solved · ${profile.daily.streak} day streak` : 'Today\'s puzzle is waiting',
      badge: !dailyDone && <span class={styles.unreadBadge}>1</span>
    }, {
      key: 'puzzles',
      folder: 'train',
      route: {name: 'puzzles'},
      text: 'puzzles',
      media: <Avatar icon="lamp" color="green" />,
      title: 'Puzzles',
      subtitle: `Find the best reply · ${profile.puzzlesSolved.length} solved`,
      meta: String(profile.ratings.puzzles)
    }, {
      key: 'rush',
      folder: 'train',
      route: {name: 'rush'},
      text: 'puzzle rush',
      media: <Avatar icon="hourglass" color="red" />,
      title: 'Puzzle Rush',
      subtitle: '3 minutes, 3 strikes',
      meta: profile.rushBest ? `best ${profile.rushBest}` : undefined
    }, {
      key: 'lessons',
      folder: 'train',
      route: {name: 'lessons'},
      text: 'lessons coach rizzo learn',
      media: <Avatar icon="channel" color="violet" />,
      title: 'Coach Rizzo',
      subtitle: `Lessons · ${profile.lessonsDone.length} of ${LESSONS.length} done`
    }];

    for(const bot of allBots()) {
      list.push({
        key: 'bot-' + bot.id,
        folder: 'play',
        route: {name: 'game', botId: bot.id, key: 0},
        text: 'bot ' + bot.name.toLowerCase(),
        media: <Avatar name={bot.name} color={bot.color} />,
        title: <>{bot.title && <span class={styles.titleChip}>{bot.title}</span>}{bot.name}</>,
        subtitle: bot.greeting,
        meta: String(bot.rating),
        badge: profile.beatenBots.includes(bot.id) && <IconTsx icon="check" class={styles.pinIcon} />
      });
    }

    list.push({
      key: 'leagues',
      folder: 'social',
      route: {name: 'leagues'},
      text: 'leagues trophies ' + division.name.toLowerCase(),
      media: <Avatar icon="crown" color="stars" />,
      title: `${division.name} League`,
      subtitle: `#${leagueRank} this week · ${profile.league.trophies} trophies`
    }, {
      key: 'leaderboard',
      folder: 'social',
      route: {name: 'leaderboard'},
      text: 'leaderboard top',
      media: <Avatar icon="poll" color="cyan" />,
      title: 'Leaderboard',
      subtitle: 'The world\'s best rizzers'
    }, {
      key: 'archive',
      folder: 'social',
      route: {name: 'archive'},
      text: 'game archive history review',
      media: <Avatar icon="archive" color="archive" />,
      title: 'Game Archive',
      subtitle: lastGame ?
        `${lastGame.opponent.name}: ${lastGame.result === 'win' ? 'a date' : lastGame.result === 'draw' ? 'friendzoned' : 'ghosted'} · ${lastGame.accuracy.toFixed(0)}%` :
        'Your games and their reviews',
      meta: profile.games.length ? String(profile.games.length) : undefined
    });

    return list;
  });

  const visible = () => {
    const q = query();
    if(q) return entries().filter((entry) => entry.text.includes(q));
    return folder() === 'all' ? entries() : entries().filter((entry) => entry.folder === folder());
  };

  const open = (entry: Entry) => navigate(entry.route.name === 'game' ? {...entry.route, key: Date.now()} : entry.route);

  return (
    <div class={classNames(styles.app, route().name === 'home' && styles.isHomeRoute)}>
      <nav class={styles.left} aria-label="Menu">
        <div class={styles.header}>
          <ButtonMenuToggleTsx
            icon="menu"
            direction="bottom-right"
            buttons={[
              menuItem('user', 'My Profile', () => navigate({name: 'profile'})),
              menuItem('bots', 'Create a bot', () => navigate({name: 'botMaker'})),
              menuItem('archive', 'Game Archive', () => navigate({name: 'archive'})),
              menuItem('settings', 'Settings', () => navigate({name: 'settings'})),
              menuItem('darkmode', 'Night Mode', () => setSandboxTheme(isNight() ? 'day' : 'night'))
            ]}
          />
          {search.container}
        </div>
        <Show when={!query()}>
          <div class={styles.folders} role="tablist">
            <For each={FOLDERS}>{(item) => (
              <button
                type="button"
                role="tab"
                aria-selected={folder() === item.id}
                class={classNames(styles.folder, folder() === item.id && styles.active)}
                onClick={() => setFolder(item.id)}
              >
                {item.label}
              </button>
            )}</For>
          </div>
        </Show>
        <div class={styles.list}>
          <For each={visible()}>{(entry) => (
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
          )}</For>
        </div>
        <ButtonMenuToggleTsx
          class={styles.fab}
          icon="newchat_filled"
          direction="top-left"
          buttons={[
            menuItem('fire', 'Quick game', () => navigate({name: 'game', timeControl: 'blitz', key: Date.now()})),
            menuItem('bots', 'Play a bot', () => navigate({name: 'bots'})),
            menuItem('add', 'Create a bot', () => navigate({name: 'botMaker'}))
          ]}
        />
      </nav>
      <main class={styles.center}>
        <Switch>
          <Match when={route().name === 'home'}><HomeScreen /></Match>
          <Match when={route().name === 'play'}><PlayScreen /></Match>
          <Match when={route().name === 'bots'}><BotsScreen /></Match>
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
