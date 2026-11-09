/*
 * The empty middle column, Play Online (time controls, as chess.com's), and the bot list with the
 * bot maker's entry.
 */

import {createSignal, For, Show} from 'solid-js';
import {navigate} from '@components/rizz/router';
import {profile, RizzTimeControl, TIME_CONTROLS} from '@components/rizz/store';
import {allBots} from '@components/rizz/world';
import {Avatar, Block, formatTimeControl, ListRow, Page, SettingsRow, styles, Topbar} from '@components/rizz/ui';
import {IconTsx} from '@components/iconTsx';
import Button from '@components/buttonTsx';

/** Nothing open: the wallpaper and a word, as Telegram's "Select a chat to start messaging". */
export function HomeScreen() {
  return <div class={styles.emptyPill}>Select an opponent to start rizzing</div>;
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
        <Block name="Time control" caption="Your clock runs while you pick a reply, and each reply adds the increment. Run out and you've left them on read.">
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
          <SettingsRow icon="like" title="It's a date" subtitle="The chat ends on a strong vibe — a win" />
          <SettingsRow icon="smile" title="Friendzoned" subtitle="A middling vibe, or friendship accepted — a draw" />
          <SettingsRow icon="hide" title="Ghosted" subtitle="The vibe drops too low and they stop replying — a loss" />
        </Block>
      </Page>
    </>
  );
}

export function BotsScreen() {
  return (
    <>
      <Topbar media={<Avatar icon="bots" color="green" size={42} />} title="Bots" subtitle="unrated practice, with hints" />
      <Page>
        <Block>
          <SettingsRow icon="add" title={<span class={styles.accent}>Create a bot</span>} onClick={() => navigate({name: 'botMaker'})} />
        </Block>
        <Block name="Opponents">
          <For each={allBots()}>{(bot) => (
            <ListRow
              small
              media={<Avatar name={bot.name} color={bot.color} size={42} />}
              title={<>{bot.title && <span class={styles.titleChip}>{bot.title}</span>}{bot.name}</>}
              subtitle={`“${bot.greeting}”`}
              meta={bot.custom ? `${bot.rating} · yours` : String(bot.rating)}
              badge={profile.beatenBots.includes(bot.id) && <IconTsx icon="check" class={styles.check} />}
              onClick={() => navigate({name: 'game', botId: bot.id, key: Date.now()})}
            />
          )}</For>
        </Block>
        <Show when={profile.beatenBots.length}>
          <div class={styles.caption} style={{'text-align': 'center'}}>Beaten {profile.beatenBots.length} of {allBots().length}</div>
        </Show>
      </Page>
    </>
  );
}
