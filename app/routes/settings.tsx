import { data, Form } from "react-router";
import { z } from "zod";
import { notFound } from "~/.server/not-found";
import { accountContext, servicesContext } from "~/context";
import { THEME_INFO, THEMES, type Theme } from "~/theme/themes";
import type { Route } from "./+types/settings";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Settings · Guildhall" }];
}

/** Each person's own settings: for now, their theme. */
export function loader({ context }: Route.LoaderArgs) {
  const account = context.get(accountContext);
  if (account.kind !== "member") notFound();
  return { theme: account.member.theme };
}

const settingsSchema = z.object({ theme: z.enum(THEMES) });

export async function action({ request, context }: Route.ActionArgs) {
  const account = context.get(accountContext);
  if (account.kind !== "member") notFound();
  const parsed = settingsSchema.safeParse(Object.fromEntries(await request.formData()));
  if (!parsed.success) return data({ error: "That isn't one of the themes." }, 400);
  await context.get(servicesContext).members.setTheme(account.member.discordId, parsed.data.theme);
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
