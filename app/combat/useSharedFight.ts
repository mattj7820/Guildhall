import { useCallback, useEffect, useRef, useState } from "react";
import { useLiveMap } from "~/live/useLive";
import { FIGHT_ROOM } from "~/live/messages";
import type { MapId } from "~/maps/types";
import { createEncounter } from "./encounter";
import type { DmFightView, FightView } from "./fight";
import { FightSaver, type DmFight, type SaveStatus, type SendSave } from "./fight-saver";
import type { Encounter } from "./types";
import { useEncounter } from "./useEncounter";

/** Where the fight is saved, as JSON. */
export const FIGHT_URL = "/combat/fight";

const sendSave: SendSave = async (body) => {
  const response = await fetch(FIGHT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  const answer = (await response.json().catch(() => ({}))) as { fight?: FightView | null };
  const fight = answer.fight;
  return {
    status: response.status,
    fight: fight === null ? null : fight?.forDm ? fight : undefined,
  };
};

/**
 * The DM's tracker over the fight the table is in: changes are made at once in the tracker (with
 * undo, as before) and saved to the server, which shows everyone; the server's newer fight (a
 * player ending their turn, another tab) is taken up as it's pushed.
 */
export function useSharedFight(fight: (DmFight & Partial<DmFightView>) | null, map?: MapId) {
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [hp, setHp] = useState(fight?.hp ?? {});
  const [freeMovement, setFreeMovement] = useState(!!fight?.freeMovement);
  const adopt = useRef<(encounter: Encounter) => void>(() => {});
  const [saver] = useState(
    () =>
      new FightSaver(
        fight?.revision ?? 0,
        sendSave,
        (newer) => adopt.current(newer?.encounter ?? createEncounter()),
        setStatus,
        map,
      ),
  );
  const save = useCallback(
    (encounter: Encounter) => {
      saver.save(encounter);
      return true;
    },
    [saver],
  );
  const [initial] = useState(() => fight?.encounter ?? createEncounter());
  const tracker = useEncounter(initial, save);
  const { replace } = tracker;

  useEffect(() => {
    adopt.current = (encounter) => replace(encounter, false);
  }, [replace]);
  useEffect(() => () => saver.stop(), [saver]);

  useLiveMap(FIGHT_ROOM, (message) => {
    if (message.type !== "fight") return;
    const pushed = message.fight;
    if (pushed && !pushed.forDm) return;
    // Sheets and settings change whatever the tracker is doing.
    setHp(pushed?.hp ?? {});
    setFreeMovement(!!pushed?.freeMovement);
    if (saver.pushed(pushed)) adopt.current(pushed?.encounter ?? createEncounter());
  });

  /** Lets players move whenever they like, or only on their turn. */
  const changeFreeMovement = async (on: boolean) => {
    setFreeMovement(on);
    const response = await fetch(FIGHT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ intent: "setFreeMovement", on }),
    }).catch(() => undefined);
    if (!response?.ok) setFreeMovement(!on);
  };

  return { tracker, status, hp, freeMovement, changeFreeMovement };
}
