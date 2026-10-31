// PROTOTYPE (throwaway): fights started from tokens on the map, behind `?prototype=tokens`.
// Statblock links live in this tab's sessionStorage; nothing new is stored on the server.
import { useEffect, useId, useMemo, useState } from "react";
import { tagOf } from "~/combat/find-creatures";
import type { CombatCatalogue, CreatureOption } from "~/combat/types";
import { buttonClass, inputClass, primaryButtonClass } from "~/components/styles";
import { toPixels } from "~/maps/geometry";
import type { TokenId, TokenView } from "~/maps/tokens/types";
import type { MapId, Size } from "~/maps/types";
import type { CanvasTools } from "./MapCanvas";

/** One token picked for the fight, with the statblock it joins with (markers only). */
export interface FightPick {
  token: TokenView;
  creature?: CreatureOption;
}

/** Screen pixels a press may wander and still be a click. */
const CLICK_SLOP = 4;

const label = (creature: CreatureOption) =>
  `${creature.name} (${tagOf(creature)}${creature.challenge ? `, CR ${creature.challenge}` : ""})`;

export function useFightTokensPrototype({
  on,
  mapId,
  tokens,
  catalogue,
  fightRunning,
  onStart,
}: {
  on: boolean;
  mapId: MapId;
  tokens: readonly TokenView[];
  catalogue: CombatCatalogue;
  fightRunning: boolean;
  onStart: (picks: FightPick[]) => void;
}) {
  const storageKey = `proto-statblocks:${mapId}`;
  const [links, setLinks] = useState<Record<TokenId, string>>({});
  useEffect(() => {
    try {
      // Read after hydrating, so the server's render matches. (Prototype only.)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLinks(JSON.parse(sessionStorage.getItem(storageKey) ?? "{}"));
    } catch {
      // Prototype: nothing kept is fine.
    }
  }, [storageKey]);
  const creatures = useMemo(
    () => new Map(catalogue.creatures.map((creature) => [creature.key, creature])),
    [catalogue.creatures],
  );
  function link(id: TokenId, key: string | undefined) {
    setLinks((current) => {
      const next = { ...current };
      if (key) next[id] = key;
      else delete next[id];
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // As above.
      }
      return next;
    });
  }
  const creatureOf = (id: TokenId) => (links[id] ? creatures.get(links[id]) : undefined);

  const [picked, setPicked] = useState<TokenId[]>([]);
  // Only tokens still here, and not already in the fight.
  const pickable = (token: TokenView) => token.kind === "marker" || token.kind === "character";
  const picks: FightPick[] = tokens
    .filter((token) => picked.includes(token.id) && pickable(token))
    .map((token) => ({ token, creature: creatureOf(token.id) }));

  function toggle(token: TokenView) {
    if (!pickable(token)) return;
    setPicked((current) =>
      current.includes(token.id) ? current.filter((id) => id !== token.id) : [...current, token.id],
    );
  }

  // Shift held: a drag on the map draws a box that picks what's inside.
  const [shift, setShift] = useState(false);
  useEffect(() => {
    if (!on) return;
    const down = (event: KeyboardEvent) => event.key === "Shift" && setShift(true);
    const up = (event: KeyboardEvent) => event.key === "Shift" && setShift(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", () => setShift(false));
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [on]);
  const [box, setBox] = useState<{
    from: [number, number];
    to: [number, number];
    /** Where the press was on screen, to tell a click from a drag. */
    client: [number, number];
  }>();

  function boxLayer(size: Size, canvas: CanvasTools) {
    if (!on || (!shift && !box)) return null;
    const rect = box && {
      x: Math.min(box.from[0], box.to[0]),
      y: Math.min(box.from[1], box.to[1]),
      width: Math.abs(box.to[0] - box.from[0]),
      height: Math.abs(box.to[1] - box.from[1]),
    };
    return (
      <>
        <rect
          {...size}
          fill="transparent"
          className="cursor-crosshair"
          aria-label="Drag to pick tokens"
          onPointerDown={(event) => {
            event.stopPropagation();
            const point = canvas.clientToImage(event.clientX, event.clientY);
            if (!point) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            setBox({ from: point, to: point, client: [event.clientX, event.clientY] });
          }}
          onPointerMove={(event) => {
            if (!box) return;
            const point = canvas.clientToImage(event.clientX, event.clientY);
            if (point) setBox({ ...box, to: point });
          }}
          onPointerUp={(event) => {
            const moved = box
              ? Math.hypot(event.clientX - box.client[0], event.clientY - box.client[1])
              : 0;
            if (box && moved < CLICK_SLOP) {
              // A shift-click: toggles the token under the pointer (this layer covers them).
              const under = document
                .elementsFromPoint(event.clientX, event.clientY)
                .find((element) => element.closest("[data-token-id]"))
                ?.closest("[data-token-id]")
                ?.getAttribute("data-token-id");
              const token = tokens.find((each) => each.id === under);
              if (token) toggle(token);
            } else if (rect) {
              const inside = tokens.filter((token) => {
                if (!pickable(token)) return false;
                const [x, y] = toPixels(token.at, size);
                return (
                  x >= rect.x &&
                  x <= rect.x + rect.width &&
                  y >= rect.y &&
                  y <= rect.y + rect.height
                );
              });
              setPicked((current) => [
                ...current,
                ...inside.map((token) => token.id).filter((id) => !current.includes(id)),
              ]);
            }
            setBox(undefined);
          }}
        />
        {rect && (
          <rect
            {...rect}
            fill="rgba(56, 189, 248, 0.12)"
            stroke="rgb(56, 189, 248)"
            strokeWidth={1.5 / canvas.scale}
            strokeDasharray={`${6 / canvas.scale} ${4 / canvas.scale}`}
            pointerEvents="none"
          />
        )}
      </>
    );
  }

  const monsters = picks.filter((pick) => pick.creature);
  const party = picks.filter((pick) => pick.token.kind === "character");
  const skipped = picks.filter((pick) => pick.token.kind === "marker" && !pick.creature);
  const bar = on && picks.length > 0 && (
    <div
      role="region"
      aria-label="Picked for the fight"
      className="absolute bottom-3 left-1/2 z-20 flex max-w-[90%] -translate-x-1/2 flex-col gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm shadow-lg"
    >
      <ul className="flex flex-wrap gap-1">
        {picks.map(({ token, creature }) => (
          <li
            key={token.id}
            className={`rounded px-1.5 py-0.5 ${
              token.kind === "marker" && !creature
                ? "bg-warn-surface text-warn"
                : "bg-raised text-ink"
            }`}
            title={creature ? label(creature) : undefined}
          >
            {token.kind === "character" ? "🛡 " : creature ? "⚔ " : ""}
            {token.name}
            {token.visibility === "dm" && creature && (
              <span className="ml-1 text-xs text-muted">hidden</span>
            )}
          </li>
        ))}
      </ul>
      {skipped.length > 0 && (
        <p className="text-xs text-warn">
          {skipped.map((pick) => pick.token.name).join(", ")}: no statblock, so{" "}
          {skipped.length > 1 ? "they stay" : "it stays"} a marker.
        </p>
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={primaryButtonClass}
          disabled={monsters.length + party.length === 0}
          onClick={() => {
            onStart(picks);
            setPicked([]);
          }}
        >
          {fightRunning
            ? `Add ${monsters.length + party.length} to the fight`
            : `Start a fight with ${monsters.length + party.length}`}
        </button>
        <button type="button" className={buttonClass} onClick={() => setPicked([])}>
          Clear
        </button>
        <span className="text-xs text-muted">Shift-click or shift-drag to pick more</span>
      </div>
    </div>
  );

  return {
    on,
    picked,
    toggle,
    clear: () => setPicked([]),
    boxLayer,
    bar,
    creatureOf,
    link,
    creatures: catalogue.creatures,
  };
}

export type FightTokensPrototype = ReturnType<typeof useFightTokensPrototype>;

/** A monster's statblock for a token: type to find it among the vault's and the SRD's. */
export function MonsterField({
  creatures,
  value,
  onChange,
  label: fieldLabel = "Monster (optional)",
}: {
  creatures: CreatureOption[];
  value?: CreatureOption;
  onChange: (creature: CreatureOption | undefined) => void;
  label?: string;
}) {
  const id = useId();
  const [text, setText] = useState(value ? label(value) : "");
  const byLabel = useMemo(
    () => new Map(creatures.map((creature) => [label(creature), creature])),
    [creatures],
  );
  return (
    <label className="flex flex-col gap-1">
      <span className="font-medium">{fieldLabel}</span>
      <input
        className={inputClass}
        list={id}
        value={text}
        placeholder="Goblin, Bandit Captain…"
        onChange={(event) => {
          setText(event.target.value);
          const creature = byLabel.get(event.target.value);
          if (creature || !event.target.value) onChange(creature);
        }}
      />
      <datalist id={id}>
        {[...byLabel.keys()].map((each) => (
          <option key={each} value={each} />
        ))}
      </datalist>
    </label>
  );
}
