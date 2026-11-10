/*
 * Home (chess.com's dashboard: ratings, the big Play buttons, the bots, today's training, recent games), Play
 * Online (time controls) and Play Bots (pick one, see who they are, choose how picky, play).
 */

import {createMemo, createSignal, For, Show} from 'solid-js';
import {navigate} from '@components/rizz/router';
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
  return (
    <>
      <Topbar media={<Avatar name={profile.name} color={profile.color} size={42} />} title="Home" subtitle={`${profile.visit.streak} day streak`} />
      <Page>
        <div class={styles.hello}>
          <Avatar name={profile.name} color={profile.color} size={64} />
          <div>
            <div class={styles.helloName}>Hi, {profile.name}</div>
            <div class={styles.caption}>Blitz {profile.ratings.blitz} · Bullet {profile.ratings.bullet} · Rapid {profile.ratings.rapid} · Puzzles {profile.ratings.puzzles}</div>
          </div>
        </div>
        <div class={styles.buttonRow}>
          <Button primaryFilled class={styles.bigButton} onClick={() => navigate({name: 'play'})}>Play Online</Button>
          <Button primaryFilled class={styles.bigButton} onClick={() => navigate({name: 'bots'})}>Play Bots</Button>
        </div>
        <Block name="Bots">
          <div class={styles.botStrip}>
            <For each={allBots()}>{(bot) => (
              <button type="button" class={styles.botChip} onClick={() => navigate({name: 'bots', botId: bot.id})}>
                <Avatar name={bot.name} color={bot.color} size={54} />
                <span class={styles.botChipName}>{bot.name}</span>
                <span class={styles.botChipRating}>{bot.rating}</span>
              </button>
            )}</For>
          </div>
        </Block>
        <Block name="Train">
          <SettingsRow
            icon="calendar"
            title="Daily Puzzle"
            subtitle={solvedToday() ? `Solved · ${profile.daily.streak} day streak` : `${daily.title} · rated ${daily.rating}`}
            right={!solvedToday() && <span class={styles.unreadBadge}>1</span>}
            onClick={() => navigate({name: 'daily'})}
          />
          <SettingsRow icon="lamp" title="Puzzles" subtitle={`Rating ${profile.ratings.puzzles}`} onClick={() => navigate({name: 'puzzles'})} />
          <SettingsRow icon="hourglass" title="Puzzle Rush" subtitle={profile.rushBest ? `Best ${profile.rushBest}` : '3 minutes, 3 strikes'} onClick={() => navigate({name: 'rush'})} />
          <SettingsRow icon="channel" title="Lessons" subtitle={`${profile.lessonsDone.length} of ${LESSONS.length} done`} onClick={() => navigate({name: 'lessons'})} />
        </Block>
        <Show when={profile.games.length}>
          <Block name="Recent games">
            <For each={profile.games.slice(0, 3)}>{(game) => <GameRow game={game} small />}</For>
            <SettingsRow icon="archive" title="All games" onClick={() => navigate({name: 'archive'})} />
          </Block>
        </Show>
      </Page>
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
