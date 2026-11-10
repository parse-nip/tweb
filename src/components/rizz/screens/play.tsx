/*
 * Home (chess.com's dashboard: ratings, the big Play buttons, the bots, today's training, recent games), Play
 * Online (time controls) and Play Bots (pick one, see who they are, choose how picky, play).
 */

import {createMemo, createSignal, For, Show} from 'solid-js';
import {navigate, RizzRoute} from '@components/rizz/router';
import {profile, RizzTimeControl, TIME_CONTROLS} from '@components/rizz/store';
import {allBots, getBot} from '@components/rizz/world';
import {dayKey, dailyPuzzle} from '@components/rizz/engine';
import {getRizzPersona, RIZZ_DIFFICULTIES, RizzDifficulty} from '@lib/rizz/personas';
import {Avatar, Block, formatTimeControl, ListRow, Page, SettingsRow, styles, Topbar} from '@components/rizz/ui';
import GameRow from '@components/rizz/gameRow';
import LESSONS from '@components/rizz/content/lessons';
import {ChipTab, ChipTabs} from '@components/chipTabs';
import {IconTsx} from '@components/iconTsx';
import Button from '@components/buttonTsx';
import classNames from '@helpers/string/classNames';

export function HomeScreen() {
  const solvedToday = () => profile.daily.last === dayKey();
  const daily = dailyPuzzle();
  const train: {icon: Icon, color: string, title: string, sub: () => string, route: RizzRoute, badge?: () => boolean}[] = [
    {icon: 'calendar', color: 'orange', title: 'Daily Puzzle', sub: () => solvedToday() ? `Solved · ${profile.daily.streak} day streak` : `${daily.title}`, route: {name: 'daily'}, badge: () => !solvedToday()},
    {icon: 'lamp', color: 'green', title: 'Puzzles', sub: () => `Rating ${profile.ratings.puzzles}`, route: {name: 'puzzles'}},
    {icon: 'hourglass', color: 'red', title: 'Puzzle Rush', sub: () => profile.rushBest ? `Best ${profile.rushBest}` : '3 min, 3 strikes', route: {name: 'rush'}},
    {icon: 'channel', color: 'violet', title: 'Lessons', sub: () => `${profile.lessonsDone.length} of ${LESSONS.length} done`, route: {name: 'lessons'}}
  ];

  return (
    <>
      <Topbar media={<Avatar name={profile.name} color={profile.color} size={42} />} title="Home" subtitle={`${profile.visit.streak} day streak`} />
      <div class={styles.page}>
        <div class={classNames(styles.pageInner, styles.pageWide)}>
          <div class={styles.hero}>
            <div class={styles.heroTop}>
              <Avatar name={profile.name} color={profile.color} size={64} />
              <div>
                <div class={styles.heroName}>Hi, {profile.name}</div>
                <span class={styles.heroStreak}>🔥 {profile.visit.streak} day streak</span>
              </div>
            </div>
            <div class={styles.heroStats}>
              <div class={styles.heroStat}><b>{profile.ratings.blitz}</b><span>Blitz</span></div>
              <div class={styles.heroStat}><b>{profile.ratings.bullet}</b><span>Bullet</span></div>
              <div class={styles.heroStat}><b>{profile.ratings.rapid}</b><span>Rapid</span></div>
              <div class={styles.heroStat}><b>{profile.ratings.puzzles}</b><span>Puzzles</span></div>
            </div>
            <div class={styles.heroButtons}>
              <button type="button" class={styles.heroButton} onClick={() => navigate({name: 'play'})}>
                <IconTsx icon="fire" /> Play Online
              </button>
              <button type="button" class={classNames(styles.heroButton, styles.heroButtonGlass)} onClick={() => navigate({name: 'bots'})}>
                <IconTsx icon="bots" /> Play Bots
              </button>
            </div>
          </div>

          <div>
            <div class={styles.sectionTitle}>
              Bots
              <button type="button" class={styles.sectionLink} onClick={() => navigate({name: 'bots'})}>See all</button>
            </div>
            <div class={styles.tiles}>
              <For each={allBots()}>{(bot) => (
                <button type="button" class={styles.tile} onClick={() => navigate({name: 'bots', botId: bot.id})}>
                  <Show when={profile.beatenBots.includes(bot.id)}>
                    <IconTsx icon="check" class={classNames(styles.check, styles.tileBadge)} />
                  </Show>
                  <Avatar name={bot.name} color={bot.color} size={56} />
                  <span class={styles.tileTitle}>{bot.name}</span>
                  <span class={styles.tileSub}>{bot.kind || 'Your bot'}</span>
                  <span class={styles.tileRating}>{bot.rating}</span>
                </button>
              )}</For>
              <button type="button" class={classNames(styles.tile, styles.tileNew)} onClick={() => navigate({name: 'botMaker'})}>
                <span class={styles.tileNewIcon}><IconTsx icon="add" /></span>
                <span class={styles.tileTitle}>Create a bot</span>
              </button>
            </div>
          </div>

          <div>
            <div class={styles.sectionTitle}>Train</div>
            <div class={styles.tiles} style={{'grid-template-columns': 'repeat(auto-fill, minmax(14rem, 1fr))'}}>
              <For each={train}>{(item) => (
                <button type="button" class={classNames(styles.tile, styles.tileWide)} onClick={() => navigate(item.route)}>
                  <Avatar icon={item.icon} color={item.color} size={44} />
                  <span style={{'flex': '1 1 auto', 'min-width': '0'}}>
                    <span class={styles.tileTitle} style={{display: 'block'}}>{item.title}</span>
                    <span class={styles.tileSub}>{item.sub()}</span>
                  </span>
                  <Show when={item.badge?.()}><span class={styles.unreadBadge}>1</span></Show>
                </button>
              )}</For>
            </div>
          </div>

          <Show when={profile.games.length}>
            <div>
              <div class={styles.sectionTitle}>
                Recent games
                <button type="button" class={styles.sectionLink} onClick={() => navigate({name: 'archive'})}>All games</button>
              </div>
              <div class={styles.cardList}>
                <For each={profile.games.slice(0, 4)}>{(game) => <GameRow game={game} small />}</For>
              </div>
            </div>
          </Show>
        </div>
      </div>
    </>
  );
}

const CONTROL_ICONS: {[key in RizzTimeControl]: Icon} = {bullet: 'flag', blitz: 'fire', rapid: 'hourglass'};

export function PlayScreen() {
  const [control, setControl] = createSignal<RizzTimeControl>('blitz');
  return (
    <>
      <Topbar media={<Avatar icon="fire" color="blue" size={42} />} title="Play Online" subtitle="rated · players near your level" />
      <Page>
        <div class={styles.profileHeader}>
          <Avatar icon="fire" color="blue" size={100} />
          <div class={styles.profileName}>{profile.ratings[control()]}</div>
          <div class={styles.profileStatus}>your {TIME_CONTROLS[control()].label} rating</div>
        </div>
        <Block name="Time control" caption="Your clock runs while you write, and each message adds the increment. Run out and you've left them on read.">
          <For each={Object.keys(TIME_CONTROLS) as RizzTimeControl[]}>{(id) => (
            <SettingsRow
              icon={CONTROL_ICONS[id]}
              title={TIME_CONTROLS[id].label}
              subtitle={`${formatTimeControl(TIME_CONTROLS[id])} · rating ${profile.ratings[id]}`}
              right={control() === id && <IconTsx icon="check" class={styles.check} />}
              onClick={() => setControl(id)}
            />
          )}</For>
        </Block>
        <div class={styles.buttonWrap}>
          <Button primaryFilled class={styles.bigButton} onClick={() => navigate({name: 'game', timeControl: control(), key: Date.now()})}>
            Find opponent
          </Button>
        </div>
        <Block name="How a game ends">
          <SettingsRow icon="like" title="Checkmate" subtitle="They say yes — a date, their number — and you win" />
          <SettingsRow icon="smile" title="Friendzoned" subtitle="Friendship offered and accepted — a draw" />
          <SettingsRow icon="hide" title="Left on read" subtitle="Their interest runs out and they stop replying — a loss" />
        </Block>
      </Page>
    </>
  );
}

export function BotsScreen(props: {botId?: string}) {
  const bots = allBots;
  const [selected, setSelected] = createSignal(props.botId && getBot(props.botId) ? props.botId : bots()[0].id);
  const [difficulty, setDifficulty] = createSignal<RizzDifficulty>('medium');
  const bot = createMemo(() => getBot(selected()) || bots()[0]);
  const shift = () => RIZZ_DIFFICULTIES.find((item) => item.id === difficulty()).eloShift;
  const persona = () => getRizzPersona(bot().id);

  return (
    <>
      <Topbar media={<Avatar icon="bots" color="green" size={42} />} title="Play Bots" subtitle="unrated practice, with hints" />
      <Page>
        <div class={styles.profileHeader}>
          <Avatar name={bot().name} color={bot().color} size={100} />
          <div class={styles.profileName}>{bot().name} · {bot().rating + shift()}</div>
          <div class={styles.profileStatus}>{bot().kind || 'Your bot'}</div>
        </div>
        <Block>
          <div class={styles.bioText}>
            {bot().tagline}
            <Show when={persona().bio && !bot().custom}>
              <div class={styles.caption} style={{'margin-top': '.375rem'}}>{persona().bio}</div>
            </Show>
          </div>
          <div class={styles.chips}>
            <ChipTabs value={difficulty()} view="secondary" onChange={(value) => void setDifficulty(value as RizzDifficulty)}>
              <For each={RIZZ_DIFFICULTIES}>{(item) => <ChipTab value={item.id}>{item.title}</ChipTab>}</For>
            </ChipTabs>
          </div>
          <div class={styles.caption} style={{padding: '0 1rem .5rem'}}>{RIZZ_DIFFICULTIES.find((item) => item.id === difficulty()).hint}</div>
        </Block>
        <div class={styles.buttonWrap}>
          <Button primaryFilled class={styles.bigButton} onClick={() => navigate({name: 'game', botId: bot().id, difficulty: difficulty(), key: Date.now()})}>
            Play {bot().name}
          </Button>
        </div>
        <Block name="Choose a bot">
          <For each={bots()}>{(item) => (
            <ListRow
              small
              class={classNames(selected() === item.id && styles.selectedOuter)}
              media={<Avatar name={item.name} color={item.color} size={42} />}
              title={item.name}
              subtitle={item.kind ? `${item.kind} · ${item.tagline}` : item.tagline}
              meta={item.custom ? `${item.rating} · yours` : String(item.rating)}
              badge={profile.beatenBots.includes(item.id) && <IconTsx icon="check" class={styles.check} />}
              onClick={() => setSelected(item.id)}
            />
          )}</For>
          <SettingsRow icon="add" title={<span class={styles.accent}>Create a bot</span>} onClick={() => navigate({name: 'botMaker'})} />
        </Block>
      </Page>
    </>
  );
}
