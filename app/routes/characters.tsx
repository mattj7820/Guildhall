import { useState } from "react";
import { data, Form, redirect } from "react-router";
import { controllersFor } from "~/.server/characters/controllers";
import { partyCards } from "~/.server/characters/load";
import { DataFileError } from "~/.server/data/json-store";
import { notFound, requireDm } from "~/.server/not-found";
import { DM_VIEWER } from "~/campaign/types";
import { canEdit } from "~/characters/permissions";
import { characterUrl } from "~/characters/urls";
import type { OrphanCard } from "~/characters/view";
import { PartyCard } from "~/components/characters/PartyCard";
import { buttonClass, inputClass, panelClass } from "~/components/styles";
import { servicesContext, viewerContext } from "~/context";
import type { Route } from "./+types/characters";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Characters · Guildhall" }];
}

export async function loader({ context }: Route.LoaderArgs) {
  const viewer = context.get(viewerContext);
  const { characters, vault } = context.get(servicesContext);
  const current = vault.current;
  try {
    const party = partyCards(current, await characters.list(), viewer);
    return {
      ...party,
      // Where a lost sheet can go: PC and companion notes without one.
      relinkTargets:
        party.orphans.length > 0
          ? party.cards
              .filter((card) => card.canStart)
              .map(({ note, name, kind }) => ({ note, name, kind }))
          : [],
    };
  } catch (error) {
    if (error instanceof DataFileError) {
      return { cards: [], orphans: [], relinkTargets: [], error: error.message };
    }
    throw error;
  }
}

/**
 * Forms post `intent`:
 * - `start`, with the `note`: a new sheet for a PC or companion the viewer plays (or any, for the
 *   DM). Starting one that exists already, perhaps from another tab, just opens it.
 * - `relink` (DM), with a lost sheet's `id` and a `note` to point it at.
 * - `delete` (DM), with a lost sheet's `id`.
 */
export async function action({ request, context }: Route.ActionArgs) {
  const viewer = context.get(viewerContext);
  const { characters, vault } = context.get(servicesContext);
  const form = await request.formData();
  const noteId = String(form.get("note") ?? "");
  const note = noteId ? vault.current.noteById(noteId, DM_VIEWER) : undefined;
  const kind = note?.type === "pc" ? "pc" : note?.type === "companion" ? "companion" : undefined;

  switch (form.get("intent")) {
    case "start": {
      if (!note || !kind || !canEdit(viewer, controllersFor(kind, note))) {
        notFound();
      }
      const existing = await characters.forNote(note.id);
      if (existing) return redirect(characterUrl(existing.id));
      const statblock = vault.current
        .statblocks(DM_VIEWER)
        .find((entry) => entry.note.id === note.id)?.statblock;
      const created = await characters.create(
        kind === "pc"
          ? { kind, note: note.id }
          : { kind, note: note.id, maxHp: statblock?.numbers.hitPoints ?? 0 },
      );
      if ("problem" in created) {
        const again = await characters.forNote(note.id);
        return again ? redirect(characterUrl(again.id)) : data({ error: created.problem }, 409);
      }
      return redirect(characterUrl(created.character.id));
    }
    case "relink": {
      requireDm(viewer);
      if (!note || !kind) return data({ error: "Choose a PC or companion note." }, 400);
      const result = await characters.relink(String(form.get("id") ?? ""), note.id);
      if (!result) notFound();
      if ("problem" in result) return data({ error: result.problem }, 409);
      return { ok: true };
    }
    case "delete": {
      requireDm(viewer);
      await characters.delete(String(form.get("id") ?? ""));
      return { ok: true };
    }
    default:
      throw data("Unknown action", { status: 400 });
  }
}

export default function Characters({ loaderData, actionData }: Route.ComponentProps) {
  const { cards, orphans, relinkTargets } = loaderData;
  const pcs = cards.filter((card) => card.kind === "pc");
  const companions = cards.filter((card) => card.kind === "companion");
  const problem =
    ("error" in loaderData && loaderData.error) ||
    (actionData && "error" in actionData && actionData.error);

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="font-serif text-3xl font-bold">Characters</h1>
      {problem && (
        <p role="alert" className="mt-3 text-danger">
          {problem}
        </p>
      )}

      <section aria-labelledby="party-heading" className="mt-6">
        <h2
          id="party-heading"
          className="text-sm font-semibold tracking-wider text-muted uppercase"
        >
          The party
        </h2>
        {pcs.length === 0 ? (
          <p className="mt-3 text-muted">
            No player characters yet. A note with <code>type: pc</code> and a <code>player</code>{" "}
            becomes one.
          </p>
        ) : (
          <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pcs.map((card) => (
              <li key={card.note}>
                <PartyCard card={card} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {companions.length > 0 && (
        <section aria-labelledby="companions-heading" className="mt-8">
          <h2
            id="companions-heading"
            className="text-sm font-semibold tracking-wider text-muted uppercase"
          >
            Companions
          </h2>
          <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {companions.map((card) => (
              <li key={card.note}>
                <PartyCard card={card} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {orphans.length > 0 && (
        <section aria-labelledby="lost-heading" className={`${panelClass} mt-8`}>
          <h2 id="lost-heading" className="font-serif text-xl font-bold">
            Sheets whose note has gone
          </h2>
          <p className="mt-1 text-sm text-muted">
            Only you can see these. Their note was moved or renamed without an <code>id</code>, or
            deleted. Link each to its note again, and add an <code>id</code> to the note so it
            doesn&rsquo;t happen again.
          </p>
          <ul className="mt-3 space-y-2">
            {orphans.map((orphan) => (
              <OrphanRow key={orphan.id} orphan={orphan} targets={relinkTargets} />
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

function OrphanRow({
  orphan,
  targets,
}: {
  orphan: OrphanCard;
  targets: { note: string; name: string }[];
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  return (
    <li className="flex flex-wrap items-center gap-2">
      <span className="font-semibold">{orphan.name}</span>
      <span className="text-sm text-muted">was {orphan.note}</span>
      <Form method="post" className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="id" value={orphan.id} />
        <select name="note" aria-label={`Note for ${orphan.name}`} className={inputClass}>
          {targets.map((target) => (
            <option key={target.note} value={target.note}>
              {target.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          name="intent"
          value="relink"
          className={buttonClass}
          disabled={targets.length === 0}
        >
          Link
        </button>
        {confirmingDelete ? (
          <>
            <button
              type="submit"
              name="intent"
              value="delete"
              className={`${buttonClass} text-danger`}
            >
              Delete {orphan.name} and their bag
            </button>
            <button
              type="button"
              className={buttonClass}
              onClick={() => setConfirmingDelete(false)}
            >
              Keep
            </button>
          </>
        ) : (
          <button type="button" className={buttonClass} onClick={() => setConfirmingDelete(true)}>
            Delete…
          </button>
        )}
      </Form>
    </li>
  );
}
