import { useEffect, useRef, useState, type ReactNode } from "react";
import type { LoggedRoll, RollLog } from "~/dice/roll-log";
import { throwsAny } from "~/dice/tray/thrown";
import type { RollLogControls } from "~/dice/useRollLog";
import { useStuntSettings } from "~/maps/stunt-settings";
import { useDicePreferences } from "./useDicePreferences";

/** If the dice never land (a hidden tab draws nothing), the result shows anyway after this. */
const LONGEST_THROW_MS = 6000;

/**
 * 3D dice for a roller: each roll's dice are thrown across `tray`, and the roll is held back from
 * everything shown (the dice box, the sheet's latest roll) until they land. The result is already
 * rolled; the dice only show it. With the dice turned off, or for dice only shown as text (d100),
 * rolls show at once as before.
 */
export function useDiceTray(
  rolls: RollLogControls,
  { fixed = false }: { fixed?: boolean } = {},
): { rolls: RollLogControls; tray: ReactNode } {
  const { log } = rolls;
  const latest = log.rolls[0];
  const preferences = useDicePreferences();
  const { settings: sound } = useStuntSettings();
  const [shownUpTo, setShownUpTo] = useState(latest?.id ?? 0);
  const throwing =
    preferences.enabled && !!latest && latest.id > shownUpTo && throwsAny(diceOf(latest));
  // Rolls that aren't thrown show at once.
  if (latest && latest.id > shownUpTo && !throwing) setShownUpTo(latest.id);
  // What was shown before the throw, for what the throw changes at once (Critical, after a 20).
  const [before, setBefore] = useState<RollLog>(log);
  if (!throwing && before !== log) setBefore(log);

  const tray = useRef<HTMLDivElement>(null);
  // Heard only with their dice sounds on and sounds not muted in the map's Effects menu.
  const volume = preferences.sound && sound.sound ? sound.volume : 0;
  const settings = useRef({ preferences, volume });
  useEffect(() => {
    settings.current = { preferences, volume };
  });
  // The roll on the table: it stays there after landing, until the next throw or the page goes.
  const [thrown, setThrown] = useState<LoggedRoll>();
  if (throwing && thrown !== latest) setThrown(latest);
  useEffect(() => {
    const container = tray.current;
    if (!thrown || !container) return;
    const land = () => setShownUpTo((upTo) => Math.max(upTo, thrown.id));
    const fallback = window.setTimeout(land, LONGEST_THROW_MS);
    let stop: (() => void) | undefined;
    let cancelled = false;
    void import("~/dice/tray/scene").then(({ throwDice }) => {
      if (cancelled) return;
      const { preferences, volume } = settings.current;
      stop = throwDice(container, diceOf(thrown), {
        seed: throwSeed(thrown),
        look: preferences.look(container),
        voice: preferences.voice,
        volume,
        reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
        onLanded: () => {
          window.clearTimeout(fallback);
          land();
        },
      });
    });
    return () => {
      cancelled = true;
      window.clearTimeout(fallback);
      stop?.();
    };
  }, [thrown]);

  return {
    rolls: throwing
      ? {
          ...rolls,
          rolling: true,
          log: {
            ...log,
            critical: before.critical,
            rolls: log.rolls.filter((roll) => roll.id <= shownUpTo),
          },
        }
      : rolls,
    tray: (
      <div
        ref={tray}
        aria-hidden="true"
        className={`pointer-events-none inset-0 ${fixed ? "fixed z-20" : "absolute z-[5]"}`}
      />
    ),
  };
}

function diceOf(roll: LoggedRoll) {
  return roll.result.terms.flatMap((term) => term.rolls);
}

/** Different for each throw, so the same result doesn't tumble the same way twice. */
function throwSeed(roll: LoggedRoll): number {
  return (Date.now() ^ (roll.id * 2654435761) ^ (roll.result.total * 40503)) >>> 0;
}
