import { data, Form } from "react-router";
import { z } from "zod";
import { notFound } from "~/.server/not-found";
import { accountContext, servicesContext } from "~/context";
import { chosenSet, DICE_SET_INFO, DICE_SETS, setsFor, type DiceSetId } from "~/dice/sets";
import { THEME_INFO, THEMES, type Theme } from "~/theme/themes";
import type { Route } from "./+types/settings";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Settings · Guildhall" }];
}

/** Each person's own settings: their theme and their dice. */
export function loader({ context }: Route.LoaderArgs) {
  const account = context.get(accountContext);
  if (account.kind !== "member") notFound();
  const { dice } = account.member;
  return {
    theme: account.member.theme,
    dice: {
      on: !dice?.off,
      sets: setsFor(dice, account.isDm),
      chosen: chosenSet(dice, account.isDm),
    },
  };
}

const settingsSchema = z.union([
  z.object({ theme: z.enum(THEMES) }),
  z.object({ dice: z.enum(["on", "off"]) }),
  z.object({ diceSet: z.enum([...DICE_SETS, "theme"]) }),
]);

export async function action({ request, context }: Route.ActionArgs) {
  const account = context.get(accountContext);
  if (account.kind !== "member") notFound();
  const parsed = settingsSchema.safeParse(Object.fromEntries(await request.formData()));
  if (!parsed.success) return data({ error: "That isn't one of the choices." }, 400);
  const { members } = context.get(servicesContext);
  const { discordId } = account.member;
  if ("theme" in parsed.data) await members.setTheme(discordId, parsed.data.theme);
  else if ("dice" in parsed.data) await members.setDiceOn(discordId, parsed.data.dice === "on");
  else {
    const set = parsed.data.diceSet === "theme" ? undefined : parsed.data.diceSet;
    if (set && !setsFor(account.member.dice, account.isDm).includes(set)) {
      return data({ error: "That set hasn't been given to you." }, 400);
    }
    await members.chooseDiceSet(discordId, set);
  }
  return { ok: true };
}

export default function Settings({ loaderData, actionData }: Route.ComponentProps) {
  const current = loaderData.theme;
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8">
      <h1 className="font-display text-title text-4xl">Settings</h1>
      <section aria-labelledby="theme-heading" className="flex flex-col gap-3">
        <div>
          <h2 id="theme-heading" className="font-display text-title text-2xl">
            Theme
          </h2>
          <p className="text-muted mt-1">
            {current
              ? "How Guildhall looks for you, on every device you sign in on."
              : "You haven't picked one, so Guildhall follows your device: Storybook when it's in light mode, Iron and Ember when it's dark."}
          </p>
        </div>
        {actionData && "error" in actionData && (
          <p role="alert" className="bg-danger-surface text-danger rounded-md px-3 py-2 text-sm">
            {actionData.error}
          </p>
        )}
        <Form method="post" className="grid gap-4 sm:grid-cols-3">
          {THEMES.map((theme) => (
            <ThemeChoice key={theme} theme={theme} chosen={theme === current} />
          ))}
        </Form>
      </section>
      <DiceSettings {...loaderData.dice} />
    </main>
  );
}

/** Each theme is its own button: picking one saves it, and the page reloads in it. */
function ThemeChoice({ theme, chosen }: { theme: Theme; chosen: boolean }) {
  const info = THEME_INFO[theme];
  return (
    <button
      type="submit"
      name="theme"
      value={theme}
      aria-pressed={chosen}
      className={`gh-card bg-surface hover:border-accent flex flex-col gap-2 rounded-lg border p-4 text-left ${
        chosen ? "border-accent ring-accent ring-2" : "border-line"
      }`}
    >
      <span className="flex gap-1" aria-hidden="true">
        {info.swatches.map((colour) => (
          <span
            key={colour}
            className="size-6 rounded border border-black/20"
            style={{ background: colour }}
          />
        ))}
      </span>
      <span className="text-title text-lg font-semibold">{info.label}</span>
      <span className="text-muted text-sm">{info.description}</span>
      <span className="text-link text-sm font-semibold">{chosen ? "Your theme" : "Use this"}</span>
    </button>
  );
}

/** Whether rolls are thrown as 3D dice across the screen, or shown only as text. */
function DiceSettings({
  on,
  sets,
  chosen,
}: {
  on: boolean;
  sets: DiceSetId[];
  chosen: DiceSetId | undefined;
}) {
  return (
    <section aria-labelledby="dice-heading" className="flex flex-col gap-3">
      <div>
        <h2 id="dice-heading" className="font-display text-title text-2xl">
          Dice
        </h2>
        <p className="text-muted mt-1">
          Your rolls in Guildhall are thrown as dice across your screen, and the result shows when
          they land. Only you see them. With your device set to reduce motion, they land at once.
        </p>
      </div>
      <Form method="post">
        <button
          type="submit"
          name="dice"
          value={on ? "off" : "on"}
          role="switch"
          aria-checked={on}
          className="hover:bg-raised flex items-center gap-2 rounded-md px-1.5 py-1 font-medium"
        >
          <span
            aria-hidden="true"
            className={`relative inline-block h-5 w-9 rounded-full transition-colors ${on ? "bg-accent" : "bg-line-strong"}`}
          >
            <span
              className={`bg-surface absolute top-0.5 left-0 h-4 w-4 rounded-full shadow transition-transform ${on ? "translate-x-4" : "translate-x-0.5"}`}
            />
          </span>
          Roll with 3D dice
        </button>
      </Form>
      {sets.length > 0 && (
        <Form method="post" aria-label="Your dice" className="grid gap-3 sm:grid-cols-3">
          <DiceSetChoice chosen={!chosen} />
          {sets.map((set) => (
            <DiceSetChoice key={set} set={set} chosen={set === chosen} />
          ))}
        </Form>
      )}
    </section>
  );
}

/** A dice set to roll with (the theme's dice without one): picking it saves it. */
function DiceSetChoice({ set, chosen }: { set?: DiceSetId; chosen: boolean }) {
  const info = set && DICE_SET_INFO[set];
  return (
    <button
      type="submit"
      name="diceSet"
      value={set ?? "theme"}
      aria-pressed={chosen}
      className={`gh-card bg-surface hover:border-accent flex items-center gap-3 rounded-lg border p-3 text-left ${
        chosen ? "border-accent ring-accent ring-2" : "border-line"
      }`}
    >
      <DieFace
        body={info ? info.look.body : "var(--color-accent)"}
        ink={info ? info.look.ink : "var(--color-on-accent)"}
        seeThrough={!!info && info.look.opacity < 1}
      />
      <span className="flex flex-col">
        <span className="text-title font-semibold">
          {info ? info.label : <>The theme&rsquo;s dice</>}
        </span>
        <span className="text-muted text-sm">
          {info ? info.description : <>In your theme&rsquo;s colours.</>}
        </span>
      </span>
    </button>
  );
}

/** A die's face in a set's colours, as a sample. */
function DieFace({ body, ink, seeThrough }: { body: string; ink: string; seeThrough: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="font-display flex size-10 shrink-0 items-center justify-center rounded-md border border-black/20 text-lg font-bold"
      style={{ background: body, color: ink, opacity: seeThrough ? 0.75 : 1 }}
    >
      20
    </span>
  );
}
