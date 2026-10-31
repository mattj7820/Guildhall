import { useState } from "react";
import { data, Form } from "react-router";
import { notFound } from "~/.server/not-found";
import { dmDiscordIds } from "~/.server/auth/identify";
import { DataFileError } from "~/.server/data/json-store";
import { partyPlayers } from "~/.server/members/players";
import type { Player } from "~/campaign/types";
import { buttonClass, inputClass, panelClass, primaryButtonClass } from "~/components/styles";
import { accountContext, servicesContext } from "~/context";
import { DICE_SET_INFO, DICE_SETS, isDiceSet } from "~/dice/sets";
import type { Member } from "~/members/types";
import type { Route } from "./+types/members";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Members · Guildhall" }];
}

export async function loader({ context }: Route.LoaderArgs) {
  const account = context.get(accountContext);
  if (account.kind !== "member" || !account.isDm) notFound();
  const services = context.get(servicesContext);
  const players = partyPlayers(services.vault.current);
  const page = { you: account.member.discordId, dms: [...dmDiscordIds(services)], players };
  try {
    return { ...page, members: await services.members.list() };
  } catch (error) {
    if (error instanceof DataFileError) return { ...page, members: [], error: error.message };
    throw error;
  }
}

/**
 * Forms post `intent` = approve | assign | remove | dice, with the member's `discordId`; dice also
 * posts the `diceSet` and whether to `give` it ("yes") or take it back.
 */
export async function action({ request, context }: Route.ActionArgs) {
  const account = context.get(accountContext);
  if (account.kind !== "member" || !account.isDm) notFound();
  const { members, vault, live } = context.get(servicesContext);
  const form = await request.formData();
  const discordId = String(form.get("discordId") ?? "");
  const playerId = String(form.get("playerId") ?? "") || undefined;
  const known = partyPlayers(vault.current);
  if (playerId && !known.some((player) => player.id === playerId)) {
    return data({ error: "That player isn't in the PC notes." }, 400);
  }

  switch (form.get("intent")) {
    case "approve":
      await members.approve(discordId, playerId);
      break;
    case "assign":
      await members.assignPlayer(discordId, playerId);
      break;
    case "dice": {
      const set = form.get("diceSet");
      if (!isDiceSet(set)) return data({ error: "That isn't one of the dice sets." }, 400);
      await members.giveDiceSet(discordId, set, form.get("give") === "yes");
      // Dice are only ever drawn for their owner: nothing live to tell anyone.
      return { ok: true };
    }
    case "remove":
      if (discordId === account.member.discordId) {
        return data({ error: "You can't remove yourself." }, 400);
      }
      await members.remove(discordId);
      break;
    default:
      throw data("Unknown action", { status: 400 });
  }
  // Their open connections were let in as they were; they sign in again, or are refused.
  await live.memberChanged(discordId);
  return { ok: true };
}

export default function Members({ loaderData, actionData }: Route.ComponentProps) {
  const waiting = loaderData.members.filter((member) => member.status === "pending");
  const approved = loaderData.members.filter((member) => member.status === "approved");

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6">
      <div>
        <h1 className="font-serif text-3xl font-bold">Members</h1>
        <p className="mt-1 text-sm text-muted">
          Anyone can sign in with Discord, but only people you let in can see the campaign. Pick
          which player each person is, to link them to their characters' notes.
        </p>
      </div>
      {"error" in loaderData && loaderData.error && (
        <p role="alert" className="rounded-md bg-danger-surface px-3 py-2 text-sm text-danger">
          {loaderData.error}
        </p>
      )}
      {actionData && "error" in actionData && (
        <p role="alert" className="text-sm text-danger">
          {actionData.error}
        </p>
      )}

      <section aria-labelledby="waiting-heading" className="flex flex-col gap-3">
        <h2 id="waiting-heading" className="font-serif text-xl font-bold">
          Waiting to be let in ({waiting.length})
        </h2>
        {waiting.length === 0 ? (
          <p className="text-sm text-muted">No one is waiting.</p>
        ) : (
          <ul aria-label="Waiting" className="flex flex-col gap-2">
            {waiting.map((member) => (
              <WaitingRow key={member.discordId} member={member} players={loaderData.players} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="members-heading" className="flex flex-col gap-3">
        <h2 id="members-heading" className="font-serif text-xl font-bold">
          Members ({approved.length})
        </h2>
        <ul aria-label="Members" className="flex flex-col gap-2">
          {approved.map((member) => (
            <MemberRow
              key={member.discordId}
              member={member}
              players={loaderData.players}
              isYou={member.discordId === loaderData.you}
              isDm={loaderData.dms.includes(member.discordId)}
            />
          ))}
        </ul>
      </section>
    </main>
  );
}

function Who({ member }: { member: Member }) {
  return (
    <div className="mr-auto">
      <p className="font-semibold">{member.name}</p>
      <p className="text-xs text-muted">@{member.username}</p>
    </div>
  );
}

function PlayerSelect({
  member,
  players,
  label,
}: {
  member: Member;
  players: Player[];
  label: string;
}) {
  const unknown = member.playerId && !players.some((player) => player.id === member.playerId);
  return (
    <label className="flex flex-col text-xs font-medium">
      {label}
      <select name="playerId" defaultValue={member.playerId ?? ""} className={inputClass}>
        <option value="">No character yet</option>
        {players.map((player) => (
          <option key={player.id} value={player.id}>
            {player.name}
          </option>
        ))}
        {unknown && (
          <option value={member.playerId}>{member.playerId} (no longer in the PC notes)</option>
        )}
      </select>
    </label>
  );
}

function WaitingRow({ member, players }: { member: Member; players: Player[] }) {
  return (
    <li aria-label={member.name} className={`${panelClass} flex flex-wrap items-end gap-3`}>
      <Who member={member} />
      <Form method="post" className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="discordId" value={member.discordId} />
        <PlayerSelect member={member} players={players} label={`${member.name} plays`} />
        <button type="submit" name="intent" value="approve" className={primaryButtonClass}>
          Let in
        </button>
        <button type="submit" name="intent" value="remove" className={buttonClass}>
          Dismiss
        </button>
      </Form>
    </li>
  );
}

function MemberRow({
  member,
  players,
  isYou,
  isDm,
}: {
  member: Member;
  players: Player[];
  isYou: boolean;
  /** Named in DM_DISCORD_IDS: always let in, with no character to play. */
  isDm: boolean;
}) {
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const unknown = member.playerId && !players.some((player) => player.id === member.playerId);
  return (
    <li aria-label={member.name} className={`${panelClass} flex flex-wrap items-end gap-3`}>
      <Who member={member} />
      {unknown && !isDm && (
        <p className="basis-full text-xs text-danger">
          Their player (“{member.playerId}”) isn't named in any PC note any more.
        </p>
      )}
      {isDm ? (
        <span className="rounded-full bg-accent-surface px-2 py-0.5 text-xs font-semibold text-title">
          DM
        </span>
      ) : (
        <Form method="post" className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="discordId" value={member.discordId} />
          <PlayerSelect member={member} players={players} label={`${member.name} plays`} />
          <button type="submit" name="intent" value="assign" className={buttonClass}>
            Save
          </button>
        </Form>
      )}
      {!isDm && <DiceSets member={member} />}
      {isYou ? (
        <span className="text-xs text-muted">That's you</span>
      ) : confirmingRemove ? (
        <Form method="post" className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="discordId" value={member.discordId} />
          <span className="text-sm">Sign them out and remove them?</span>
          <button
            type="submit"
            name="intent"
            value="remove"
            className="rounded-md bg-danger px-2.5 py-1 text-sm font-semibold text-on-danger hover:opacity-90"
          >
            Remove {member.name}
          </button>
          <button type="button" className={buttonClass} onClick={() => setConfirmingRemove(false)}>
            Keep
          </button>
        </Form>
      ) : (
        <button type="button" className={buttonClass} onClick={() => setConfirmingRemove(true)}>
          Remove…
        </button>
      )}
    </li>
  );
}

/** The dice sets the DM has given someone: each a switch, saved at once. */
function DiceSets({ member }: { member: Member }) {
  const given = member.dice?.given ?? [];
  return (
    <div
      role="group"
      aria-label={`${member.name}'s dice sets`}
      className="flex basis-full flex-wrap items-center gap-2 text-sm"
    >
      <span className="text-xs font-medium text-muted">Dice sets</span>
      {DICE_SETS.map((set) => {
        const has = given.includes(set);
        return (
          <Form key={set} method="post">
            <input type="hidden" name="intent" value="dice" />
            <input type="hidden" name="discordId" value={member.discordId} />
            <input type="hidden" name="diceSet" value={set} />
            <input type="hidden" name="give" value={has ? "no" : "yes"} />
            <button
              type="submit"
              aria-pressed={has}
              className={`rounded-full border px-2.5 py-0.5 ${
                has
                  ? "border-accent bg-accent-surface font-semibold text-title"
                  : "border-line text-muted"
              }`}
            >
              {DICE_SET_INFO[set].label}
            </button>
          </Form>
        );
      })}
    </div>
  );
}
