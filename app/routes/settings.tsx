import { data, Form, Link } from "react-router";
import { z } from "zod";
import { DataFileError } from "~/.server/data/json-store";
import { usableDice } from "~/.server/dice/collections";
import { notFound } from "~/.server/not-found";
import { DieIcon } from "~/components/dice/DieIcon";
import { accountContext, servicesContext } from "~/context";
import { EMPTY_COLLECTION } from "~/dice/collection";
import { THEME_INFO, THEMES, type Theme } from "~/theme/themes";
import { WIKI_LOOK_INFO, WIKI_LOOKS, type WikiLook } from "~/wiki/looks";
import type { Route } from "./+types/settings";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Settings · Guildhall" }];
}

/** Each person's own settings: their theme, how they read the wiki, and their dice. */
export async function loader({ context }: Route.LoaderArgs) {
  const account = context.get(accountContext);
  if (account.kind !== "member") notFound();
  const { dice } = account.member;
  let collection = EMPTY_COLLECTION;
  try {
    collection = await context.get(servicesContext).dice.get(account.member.discordId);
  } catch (error) {
    if (!(error instanceof DataFileError)) throw error;
  }
  const owned = usableDice(collection, dice?.given, account.isDm);
  return {
    theme: account.member.theme,
    wikiLook: account.member.wikiLook ?? "pages",
    dice: {
      on: !dice?.off,
      sound: !dice?.quiet,
      found: owned.reduce((sum, die) => sum + die.count, 0),
      packs: account.isDm ? 0 : collection.packs.length,
    },
  };
}

const settingsSchema = z.union([
  z.object({ theme: z.enum(THEMES) }),
  z.object({ wikiLook: z.enum(WIKI_LOOKS) }),
  z.object({ dice: z.enum(["on", "off"]) }),
  z.object({ diceSound: z.enum(["on", "off"]) }),
]);

export async function action({ request, context }: Route.ActionArgs) {
  const account = context.get(accountContext);
  if (account.kind !== "member") notFound();
  const parsed = settingsSchema.safeParse(Object.fromEntries(await request.formData()));
  if (!parsed.success) return data({ error: "That isn't one of the choices." }, 400);
  const { members } = context.get(servicesContext);
  const { discordId } = account.member;
  if ("theme" in parsed.data) await members.setTheme(discordId, parsed.data.theme);
  else if ("wikiLook" in parsed.data) await members.setWikiLook(discordId, parsed.data.wikiLook);
  else if ("dice" in parsed.data) await members.setDiceOn(discordId, parsed.data.dice === "on");
  else await members.setDiceSound(discordId, parsed.data.diceSound === "on");
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
      <WikiSettings current={loaderData.wikiLook} />
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

/** How the wiki is laid out for them: each look is its own button, saved when picked. */
function WikiSettings({ current }: { current: WikiLook }) {
  return (
    <section aria-labelledby="wiki-heading" className="flex flex-col gap-3">
      <div>
        <h2 id="wiki-heading" className="font-display text-title text-2xl">
          Wiki
        </h2>
        <p className="text-muted mt-1">
          How the wiki looks for you. The notes are the same either way.
        </p>
      </div>
      <Form method="post" className="grid gap-4 sm:grid-cols-3">
        {WIKI_LOOKS.map((look) => {
          const chosen = look === current;
          return (
            <button
              key={look}
              type="submit"
              name="wikiLook"
              value={look}
              aria-pressed={chosen}
              className={`gh-card bg-surface hover:border-accent flex flex-col gap-2 rounded-lg border p-4 text-left ${
                chosen ? "border-accent ring-accent ring-2" : "border-line"
              }`}
            >
              <span className="text-title text-lg font-semibold">{WIKI_LOOK_INFO[look].label}</span>
              <span className="text-muted text-sm">{WIKI_LOOK_INFO[look].description}</span>
              <span className="text-link text-sm font-semibold">
                {chosen ? "Your wiki" : "Use this"}
              </span>
            </button>
          );
        })}
      </Form>
    </section>
  );
}

/** Whether rolls are thrown as 3D dice across the screen, and the way to their collection. */
function DiceSettings({
  on,
  sound,
  found,
  packs,
}: {
  on: boolean;
  sound: boolean;
  found: number;
  packs: number;
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
      <Form method="post" className="flex flex-wrap gap-x-4 gap-y-1">
        <SettingSwitch name="dice" on={on} label="Roll with 3D dice" />
        <SettingSwitch name="diceSound" on={sound} label="Dice sounds" />
      </Form>
      <Link
        to="/settings/dice"
        className="gh-card bg-surface border-line hover:border-accent flex items-center gap-3 self-start rounded-lg border p-3"
      >
        <DieIcon sides={20} />
        <span className="flex flex-col">
          <span className="text-title font-semibold">Your dice</span>
          <span className="text-muted text-sm">
            {found === 0 ? "None found yet" : found === 1 ? "1 die found" : `${found} dice found`}
            {packs > 0 && `, ${packs === 1 ? "1 pack" : `${packs} packs`} to open`}
          </span>
        </span>
      </Link>
    </section>
  );
}

/** A setting switched on or off, saved at once: it posts `name` = "on" or "off". */
function SettingSwitch({ name, on, label }: { name: string; on: boolean; label: string }) {
  return (
    <button
      type="submit"
      name={name}
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
      {label}
    </button>
  );
}
