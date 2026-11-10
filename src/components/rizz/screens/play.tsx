/*
 * The empty middle column, and Play: every opponent is a bot — pick one, see who they are, choose how picky and
 * whether there is a clock, play. Every game is rated against the bot's strength at that difficulty.
 */

import {createMemo, createSignal, For, Show} from 'solid-js';
import {navigate} from '@components/rizz/router';
import {profile, RizzTimeControl, TIME_CONTROLS} from '@components/rizz/store';
import {allBots, botRating, getBot} from '@components/rizz/world';
import {getRizzPersona, RIZZ_DIFFICULTIES, RizzDifficulty} from '@lib/rizz/personas';
import {Avatar, Block, formatTimeControl, ListRow, Page, SettingsRow, styles, Topbar} from '@components/rizz/ui';
import {ChipTab, ChipTabs} from '@components/chipTabs';
import {IconTsx} from '@components/iconTsx';
import Button from '@components/buttonTsx';
import classNames from '@helpers/string/classNames';

/** Nothing open: the wallpaper and a word, as Telegram's "Select a chat to start messaging" — the sidebar is home. */
export function HomeScreen() {
  return <div class={styles.emptyPill}>Select a game to start</div>;
}

type Clock = RizzTimeControl | 'none';

export function BotsScreen(props: {botId?: string}) {
  const bots = allBots;
  const [selected, setSelected] = createSignal(props.botId && getBot(props.botId) ? props.botId : bots()[0].id);
  const [difficulty, setDifficulty] = createSignal<RizzDifficulty>('medium');
  const [clock, setClock] = createSignal<Clock>('none');
  const bot = createMemo(() => getBot(selected()) || bots()[0]);
  const persona = () => getRizzPersona(bot().id);

  const play = () => navigate({
    name: 'game',
    botId: bot().id,
    difficulty: difficulty(),
    timeControl: clock() === 'none' ? undefined : clock() as RizzTimeControl,
    key: Date.now()
  });

  return (
    <>
      <Topbar media={<Avatar icon="bots" color="green" size={42} />} title="Play" subtitle={`your rating ${profile.ratings.rizz}`} />
      <Page>
        <div class={styles.profileHeader}>
          <Avatar name={bot().name} color={bot().color} size={100} />
          <div class={styles.profileName}>{bot().name}</div>
          <div class={styles.profileStatus}>{bot().custom ? 'Your bot · practice, unrated' : `${bot().kind} · ${botRating(bot(), difficulty())}`}</div>
        </div>
        <Block>
          <div class={styles.bioText}>
            {bot().tagline}
            <Show when={persona().bio && !bot().custom}>
              <div class={styles.caption} style={{'margin-top': '.375rem'}}>{persona().bio}</div>
            </Show>
          </div>
        </Block>
        <Block name="Difficulty" caption={RIZZ_DIFFICULTIES.find((item) => item.id === difficulty()).hint}>
          <div class={styles.chips}>
            <ChipTabs value={difficulty()} view="secondary" onChange={(value) => void setDifficulty(value as RizzDifficulty)}>
              <For each={RIZZ_DIFFICULTIES}>{(item) => <ChipTab value={item.id}>{item.title} · {botRating(bot(), item.id)}</ChipTab>}</For>
            </ChipTabs>
          </div>
        </Block>
        <Block name="Clock" caption="With a clock, it runs while you write and each message adds the increment. Run out and you've left them on read.">
          <div class={styles.chips}>
            <ChipTabs value={clock()} view="secondary" onChange={(value) => void setClock(value as Clock)}>
              <ChipTab value="none">No clock</ChipTab>
              <For each={Object.keys(TIME_CONTROLS) as RizzTimeControl[]}>{(id) => (
                <ChipTab value={id}>{TIME_CONTROLS[id].label} {formatTimeControl(TIME_CONTROLS[id])}</ChipTab>
              )}</For>
            </ChipTabs>
          </div>
        </Block>
        <div class={styles.buttonWrap}>
          <Button primaryFilled class={styles.bigButton} onClick={play}>Play {bot().name}</Button>
        </div>
        <Block name="Bots">
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
