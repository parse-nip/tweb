/*
 * The bot maker: a persona of the player's own for the Rizz Coach's simulator — name, look, strength (its Elo),
 * a personality to start from, and who they are, in the player's words. Kept with the player's progress.
 */

import {createSignal, For} from 'solid-js';
import {AVATAR_COLORS, PERSONALITIES, RizzAvatarColor, RizzBot, RizzPersonality} from '@components/rizz/content/bots';
import {navigate} from '@components/rizz/router';
import {deleteCustomBot, getBot, saveCustomBot} from '@components/rizz/world';
import {Avatar, Block, ListRow, Page, SettingsRow, styles, TextField, Topbar} from '@components/rizz/ui';
import {confirmAction} from '@components/rizz/popups';
import {IconTsx} from '@components/iconTsx';
import Button from '@components/buttonTsx';
import classNames from '@helpers/string/classNames';

const MIN_RATING = 100;
const MAX_RATING = 2800;

function ratingLabel(rating: number) {
  if(rating < 600) return 'Beginner';
  if(rating < 1100) return 'Casual';
  if(rating < 1600) return 'Club';
  if(rating < 2100) return 'Expert';
  return 'Master';
}

export default function BotMakerScreen(props: {botId?: string}) {
  const existing = props.botId ? getBot(props.botId) : undefined;
  const [name, setName] = createSignal(existing?.name ?? '');
  const [color, setColor] = createSignal<RizzAvatarColor>(existing?.color ?? 'pink');
  const [rating, setRating] = createSignal(existing?.rating ?? 1000);
  const [personality, setPersonality] = createSignal<RizzPersonality>(existing?.personality ?? 'witty');
  const [about, setAbout] = createSignal(existing?.custom ? (existing.prompt || '').replace(PERSONALITIES[existing.personality || 'witty'].prompt, '').trim() : '');

  const preview = (): RizzBot => {
    const persona = PERSONALITIES[personality()];
    const description = about().trim();
    return {
      id: existing?.id ?? `custom-${Date.now().toString(36)}`,
      name: name().trim() || 'New bot',
      rating: rating(),
      color: color(),
      tagline: description ? description.slice(0, 60) : persona.tagline,
      custom: true,
      personality: personality(),
      startInterest: persona.startInterest,
      prompt: description ? `${persona.prompt} ${description}` : persona.prompt
    };
  };

  const save = (play?: boolean) => {
    const bot = preview();
    saveCustomBot(bot);
    navigate(play ? {name: 'game', botId: bot.id, key: Date.now()} : {name: 'bots'});
  };

  const remove = async() => {
    const ok = await confirmAction({title: 'Delete bot?', description: `${existing.name} will be gone for good.`, button: 'Delete', danger: true});
    if(ok) {
      deleteCustomBot(existing.id);
      navigate({name: 'bots'});
    }
  };

  return (
    <>
      <Topbar
        media={<Avatar name={preview().name} color={color()} size={42} />}
        title={existing ? `Edit ${existing.name}` : 'New bot'}
        subtitle="bot maker"
        onBack={() => navigate({name: 'bots'})}
      />
      <Page>
        <Block caption="This is how your bot shows in the list.">
          <ListRow
            media={<Avatar name={preview().name} color={color()} />}
            title={preview().name}
            subtitle={preview().tagline}
            meta={String(rating())}
          />
        </Block>

        <Block name="Name">
          <TextField label="Bot name" value={name()} maxLength={20} onInput={setName} />
          <div class={styles.colors} role="radiogroup" aria-label="Colour">
            <For each={AVATAR_COLORS}>{(item) => (
              <button
                type="button"
                role="radio"
                aria-checked={color() === item}
                aria-label={item}
                class={classNames('avatar-gradient', styles.colorSwatch, color() === item && styles.active)}
                data-color={item}
                onClick={() => setColor(item)}
              />
            )}</For>
          </div>
        </Block>

        <Block name="Who are they?" caption="In your own words — the coach plays them like this. A job, a vibe, how they text, what wins them over.">
          <TextField label="e.g. a barista who loves terrible puns" value={about()} maxLength={300} onInput={setAbout} />
        </Block>

        <Block name="Personality">
          <For each={Object.keys(PERSONALITIES) as RizzPersonality[]}>{(id) => (
            <SettingsRow
              icon={PERSONALITIES[id].icon}
              title={PERSONALITIES[id].label}
              subtitle={PERSONALITIES[id].tagline}
              right={personality() === id && <IconTsx icon="check" class={styles.check} />}
              onClick={() => setPersonality(id)}
            />
          )}</For>
        </Block>

        <Block name={`Strength · ${rating()} · ${ratingLabel(rating())}`} caption="How picky they are. Your own bots are practice: games against them don't move your rating.">
          <div class={styles.range}>
            <input
              type="range"
              min={MIN_RATING}
              max={MAX_RATING}
              step={50}
              value={rating()}
              aria-label="Rating"
              onInput={(e) => setRating(+e.currentTarget.value)}
            />
            <div class={styles.rangeLabels}><span>{MIN_RATING}</span><span>{MAX_RATING}</span></div>
          </div>
        </Block>

        <div class={styles.buttonWrap}>
          <Button primaryFilled class={styles.bigButton} onClick={() => save(true)}>
            {existing ? 'Save and play' : 'Create and play'}
          </Button>
        </div>
        <Block>
          <SettingsRow icon="check" title={existing ? 'Save' : 'Create'} onClick={() => save()} />
          {existing && <SettingsRow icon="delete" title="Delete bot" danger onClick={remove} />}
        </Block>
      </Page>
    </>
  );
}
