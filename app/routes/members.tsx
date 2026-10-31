import { useEffect, useRef, useState } from "react";
import { data, Form, useFetcher, useLoaderData } from "react-router";
import { notFound } from "~/.server/not-found";
import { dmDiscordIds } from "~/.server/auth/identify";
import { DataFileError } from "~/.server/data/json-store";
import { DICE_STYLES, diceStyle } from "~/.server/dice/catalogue";
import { usableDice } from "~/.server/dice/collections";
import { ownedView } from "~/.server/dice/view";
import { partyPlayers } from "~/.server/members/players";
import type { Player } from "~/campaign/types";
import { buttonClass, inputClass, panelClass, primaryButtonClass } from "~/components/styles";
import { accountContext, servicesContext } from "~/context";
import { EMPTY_COLLECTION } from "~/dice/collection";
import { DIE_TYPES, isDieType, RARITY_INFO, type DieType, type Rarity } from "~/dice/styles";
import type { Member } from "~/members/types";
import type { Route } from "./+types/members";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Members · Guildhall" }];
}

/** What the DM sees of someone's dice. */
interface MemberDiceSummary {
  packs: number;
  owned: { label: string; rarity: Rarity; sides: DieType; count: number }[];
}

export async function loader({ context }: Route.LoaderArgs) {
  const account = context.get(accountContext);
  if (account.kind !== "member" || !account.isDm) notFound();
  const services = context.get(servicesContext);
  const players = partyPlayers(services.vault.current);
  const page = {
    you: account.member.discordId,
    dms: [...dmDiscordIds(services)],
    players,
    styles: DICE_STYLES.map(({ id, label, rarity }) => ({ id, label, rarity })),
  };
  try {
    const members = await services.members.list();
    const collections = await services.dice.all();
    const dice: Record<string, MemberDiceSummary> = Object.fromEntries(
      members.map((member) => {
        const collection = collections.get(member.discordId) ?? EMPTY_COLLECTION;
        const owned = ownedView(usableDice(collection, member.dice?.given, false));
        return [
          member.discordId,
          {
            packs: collection.packs.length,
            owned: owned.map(({ style, sides, count }) => ({
              label: style.label,
              rarity: style.rarity,
              sides,
              count,
            })),
          },
        ];
      }),
    );
    return { ...page, members, dice };
  } catch (error) {
    if (error instanceof DataFileError) {
      return {
        ...page,
        members: [],
        dice: {} as Record<string, MemberDiceSummary>,
        error: error.message,
      };
    }
    throw error;
  }
}

/**
 * Forms post `intent` = approve | assign | remove | pack | die, with the member's `discordId`; a
 * pack also posts why (`reason`), and a die its `style` and `sides`.
 */
export async function action({ request, context }: Route.ActionArgs) {
  const account = context.get(accountContext);
  if (account.kind !== "member" || !account.isDm) notFound();
  const { members, dice, vault, live } = context.get(servicesContext);
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
    // Dice are only ever drawn for their owner, and packs wait for them: nothing live to tell.
    case "pack": {
      if (!(await members.get(discordId))) return data({ error: "They aren't a member." }, 400);
      await dice.givePack(discordId, String(form.get("reason") ?? ""));
      return { ok: true };
    }
    case "die": {
      if (!(await members.get(discordId))) return data({ error: "They aren't a member." }, 400);
      const style = diceStyle(String(form.get("style") ?? ""));
      const sides = Number(form.get("sides"));
      if (!style || !isDieType(sides)) return data({ error: "That isn't one of the dice." }, 400);
      if (!(await dice.giveDie(discordId, style.id, sides))) {
        return data({ error: "They already have as many of that die as a roll could use." }, 400);
      }
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
      {!isDm && <MemberDice member={member} />}
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

/**
 * Someone's dice: what they have, and packs (with why) or particular dice for the DM to give.
 * Each gift is saved at once; a pack waits for them to open it.
 */
function MemberDice({ member }: { member: Member }) {
  const { styles, dice } = useLoaderData<typeof loader>();
  const theirs = dice[member.discordId] ?? { packs: 0, owned: [] };
  const total = theirs.owned.reduce((sum, die) => sum + die.count, 0);
  return (
    <div
      role="group"
      aria-label={`${member.name}'s dice`}
      className="flex basis-full flex-col gap-2 border-t border-line pt-2 text-sm"
    >
      <details>
        <summary className="cursor-pointer text-xs font-medium text-muted">
          {total === 1 ? "1 die" : `${total} dice`}
          {theirs.packs > 0 &&
            `, ${theirs.packs === 1 ? "1 pack" : `${theirs.packs} packs`} unopened`}
        </summary>
        {theirs.owned.length === 0 ? (
          <p className="mt-1 text-muted">None yet.</p>
        ) : (
          <ul aria-label={`${member.name}'s dice`} className="mt-1 flex flex-wrap gap-1.5">
            {theirs.owned.map((die) => (
              <li
                key={`${die.label} d${die.sides}`}
                className="rounded-full border border-line px-2 py-0.5"
              >
                {die.label} d{die.sides}
                {die.count > 1 && ` ×${die.count}`}{" "}
                <span className="text-muted">({RARITY_INFO[die.rarity].label})</span>
              </li>
            ))}
          </ul>
        )}
      </details>
      <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
        <GiveForm member={member} intent="pack" label="Give a pack">
          <label className="flex flex-col gap-0.5 text-xs font-medium text-muted">
            Why (they'll see it)
            <input
              name="reason"
              maxLength={200}
              placeholder="For the session recap"
              className={`${inputClass} w-56`}
            />
          </label>
        </GiveForm>
        <GiveForm member={member} intent="die" label="Give this die">
          <label className="flex flex-col gap-0.5 text-xs font-medium text-muted">
            Style
            <select name="style" className={inputClass}>
              {styles.map((style) => (
                <option key={style.id} value={style.id}>
                  {style.label} ({RARITY_INFO[style.rarity].label})
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-0.5 text-xs font-medium text-muted">
            Die
            <select name="sides" defaultValue={20} className={inputClass}>
              {DIE_TYPES.map((sides) => (
                <option key={sides} value={sides}>
                  d{sides}
                </option>
              ))}
            </select>
          </label>
        </GiveForm>
      </div>
    </div>
  );
}

/** A gift to someone, cleared once it's given. */
function GiveForm({
  member,
  intent,
  label,
  children,
}: {
  member: Member;
  intent: "pack" | "die";
  label: string;
  children: React.ReactNode;
}) {
  const fetcher = useFetcher<typeof action>();
  const form = useRef<HTMLFormElement>(null);
  const given = fetcher.state === "idle" && fetcher.data && "ok" in fetcher.data;
  useEffect(() => {
    if (given && intent === "pack") form.current?.reset();
  }, [given, intent]);
  const error = fetcher.data && "error" in fetcher.data ? fetcher.data.error : undefined;
  return (
    <fetcher.Form ref={form} method="post" className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="intent" value={intent} />
      <input type="hidden" name="discordId" value={member.discordId} />
      {children}
      <button type="submit" className={buttonClass} disabled={fetcher.state !== "idle"}>
        {label}
      </button>
      {error && (
        <p role="alert" className="basis-full text-xs text-danger">
          {error}
        </p>
      )}
    </fetcher.Form>
  );
}
