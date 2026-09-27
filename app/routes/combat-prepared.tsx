import { useState } from "react";
import { data, Form, Link, redirect } from "react-router";
import { DataFileError } from "~/.server/data/json-store";
import { summarise } from "~/combat/prepared";
import { encounterSchema } from "~/combat/schema";
import { CombatNav, DmOnlyNotice } from "~/components/combat/CombatNav";
import { buttonClass, panelClass, primaryButtonClass } from "~/components/styles";
import { servicesContext, viewerContext } from "~/context";
import type { Route } from "./+types/combat-prepared";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Prepared encounters · Guildhall" }];
}

export async function loader({ context }: Route.LoaderArgs) {
  if (context.get(viewerContext).role !== "dm") return { dmOnly: true as const };
  try {
    const encounters = await context.get(servicesContext).preparedEncounters.list();
    return {
      dmOnly: false as const,
      encounters: encounters.map(({ encounter, ...prepared }) => ({
        ...prepared,
        summary: summarise(encounter),
      })),
    };
  } catch (error) {
    if (error instanceof DataFileError) return { dmOnly: false as const, error: error.message };
    throw error;
  }
}

/**
 * Forms post `intent` = create | duplicate | delete. The tracker's "Save as prepared" posts JSON
 * `{ intent: "create", name, encounter }` and gets the new encounter back instead of a redirect.
 */
export async function action({ request, context }: Route.ActionArgs) {
  if (context.get(viewerContext).role !== "dm") throw data("Not found", { status: 404 });
  const prepared = context.get(servicesContext).preparedEncounters;

  if (request.headers.get("Content-Type")?.includes("application/json")) {
    const body = (await request.json()) as { name?: unknown; encounter?: unknown };
    const encounter = encounterSchema.safeParse(body.encounter);
    if (!encounter.success || typeof body.name !== "string") {
      return data({ error: "That encounter couldn't be saved." }, { status: 400 });
    }
    const created = await prepared.create({ name: body.name, encounter: encounter.data });
    return { created: { id: created.id, name: created.name } };
  }

  const form = await request.formData();
  const id = String(form.get("id") ?? "");
  switch (form.get("intent")) {
    case "create":
      return redirect(`/combat/prepared/${(await prepared.create()).id}`);
    case "duplicate":
      await prepared.duplicate(id);
      return { ok: true };
    case "delete":
      await prepared.delete(id);
      return { ok: true };
    default:
      throw data("Unknown action", { status: 400 });
  }
}

export default function PreparedList({ loaderData }: Route.ComponentProps) {
  if (loaderData.dmOnly) return <DmOnlyNotice />;

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <CombatNav />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="mr-auto font-serif text-3xl font-bold">Prepared encounters</h1>
        <NewEncounterButton />
      </div>

      {"error" in loaderData ? (
        <p role="alert" className="rounded-md bg-rose-100 px-3 py-2 text-sm text-rose-900">
          {loaderData.error}
        </p>
      ) : loaderData.encounters.length === 0 ? (
        <div className={`${panelClass} text-center`}>
          <p className="font-semibold">Nothing prepared yet.</p>
          <p className="mt-1 text-sm text-stone-500">
            Set up the fights that might happen before a session: add the monsters now, and at the
            table just pick who's playing and type their initiative.
          </p>
        </div>
      ) : (
        <ul aria-label="Prepared encounters" className="flex flex-col gap-3">
          {loaderData.encounters.map((prepared) => (
            <PreparedCard key={prepared.id} prepared={prepared} />
          ))}
        </ul>
      )}
    </main>
  );
}

function NewEncounterButton() {
  return (
    <Form method="post">
      <button type="submit" name="intent" value="create" className={primaryButtonClass}>
        New encounter
      </button>
    </Form>
  );
}

type Card = Extract<
  Route.ComponentProps["loaderData"],
  { encounters: unknown }
>["encounters"][number];

function PreparedCard({ prepared }: { prepared: Card }) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const { monsters, companions } = prepared.summary;

  return (
    <li aria-label={prepared.name} className={`${panelClass} flex flex-col gap-2`}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="mr-auto font-serif text-xl font-bold">
          <Link to={`/combat/prepared/${prepared.id}`} className="hover:underline">
            {prepared.name}
          </Link>
        </h2>
        <p className="text-xs text-stone-500">
          Edited <Day iso={prepared.updatedAt} /> ·{" "}
          {prepared.lastRunAt ? (
            <>
              Last run <Day iso={prepared.lastRunAt} />
            </>
          ) : (
            "Never run"
          )}
        </p>
      </div>
      <p className="text-sm">
        {monsters || <span className="text-stone-500">No monsters yet</span>}
        {companions && <span className="text-stone-500"> · {companions}</span>}
      </p>
      {prepared.notes && (
        <p className="line-clamp-2 text-sm whitespace-pre-line text-stone-600 dark:text-stone-400">
          {prepared.notes}
        </p>
      )}
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <Link
          to={`/combat?start=${encodeURIComponent(prepared.id)}`}
          className={primaryButtonClass}
          aria-label={`Start ${prepared.name}`}
        >
          Start
        </Link>
        <Link
          to={`/combat/prepared/${prepared.id}`}
          className={buttonClass}
          aria-label={`Edit ${prepared.name}`}
        >
          Edit
        </Link>
        <Form method="post">
          <input type="hidden" name="id" value={prepared.id} />
          <button
            type="submit"
            name="intent"
            value="duplicate"
            className={buttonClass}
            aria-label={`Duplicate ${prepared.name}`}
          >
            Duplicate
          </button>
        </Form>
        {confirmingDelete ? (
          <Form method="post" className="flex items-center gap-2">
            <input type="hidden" name="id" value={prepared.id} />
            <span className="text-sm font-medium">Delete for good?</span>
            <button
              type="submit"
              name="intent"
              value="delete"
              className="rounded-md bg-rose-700 px-2.5 py-1 text-sm font-semibold text-white hover:bg-rose-800"
            >
              Delete {prepared.name}
            </button>
            <button
              type="button"
              className={buttonClass}
              onClick={() => setConfirmingDelete(false)}
            >
              Keep it
            </button>
          </Form>
        ) : (
          <button
            type="button"
            className={buttonClass}
            aria-label={`Delete ${prepared.name}…`}
            onClick={() => setConfirmingDelete(true)}
          >
            Delete…
          </button>
        )}
      </div>
    </li>
  );
}

const dayFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

/** "26 Sep". Server and browser may sit in different time zones, so hydration may differ. */
function Day({ iso }: { iso: string }) {
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {dayFormat.format(new Date(iso))}
    </time>
  );
}
