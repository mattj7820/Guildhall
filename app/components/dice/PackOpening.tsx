import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { DicePack, OpenedDie } from "~/dice/collection";
import { PackSound } from "~/dice/pack-sound";
import { RARITY_INFO, type Rarity } from "~/dice/styles";
import { useStuntSettings } from "~/maps/stunt-settings";
import { DieIcon } from "./DieIcon";
import { styleLook } from "./looks";
import { useDicePreferences } from "./useDicePreferences";

export const OPEN_PACK_URL = "/settings/dice/open";

/** How long the pack glows before it opens: longer the rarer the die, for the suspense. */
const GLOW_MS: Record<Rarity, number> = {
  common: 500,
  uncommon: 700,
  rare: 1000,
  veryRare: 1300,
  legendary: 1700,
};
const SHAKE_MS = 900;
/** The die drawn on the pack itself: pale, to stand out on the theme's colour. */
const PACK_DIE = {
  look: { body: "#f8f5ee", ink: "#1c1917", metalness: 0, roughness: 1, opacity: 1 },
};
const BURST_MS = 450;

type Phase = "shaking" | "glowing" | "bursting" | "revealed";
type Outcome = { opened: OpenedDie } | { error: string };

/**
 * A pack being opened, over the page: it shakes, glows in the die's rarity, bursts, and the die
 * turns in the light. The die is drawn on the server as the pack is opened; this only shows it.
 * Any click or key skips to the die. With reduced motion, the die is simply there.
 */
export function PackOpening({ pack, onDone }: { pack: DicePack; onDone: () => void }) {
  const outcome = useOpenedPack(pack);
  // Only ever drawn in the browser, after a click.
  const [reduced] = useState(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [step, setPhase] = useState<Phase>(reduced ? "revealed" : "shaking");
  const opened = outcome && "opened" in outcome ? outcome.opened : undefined;
  // A pack that couldn't be opened goes straight to saying so.
  const phase: Phase = outcome && !opened ? "revealed" : step;
  const rarity = opened?.style.rarity;
  const sound = usePackSound();

  // Shaking until the die is known (and at least a moment), then glowing, then bursting open.
  useEffect(() => {
    if (phase === "revealed" || !opened) return;
    const next: Record<Exclude<Phase, "revealed">, [Phase, number]> = {
      shaking: ["glowing", SHAKE_MS],
      glowing: ["bursting", GLOW_MS[opened.style.rarity]],
      bursting: ["revealed", BURST_MS],
    };
    const [then, after] = next[phase];
    if (phase === "glowing") sound.current?.glow(after / 1000);
    const timer = window.setTimeout(() => setPhase(then), after);
    return () => window.clearTimeout(timer);
  }, [phase, opened, sound]);

  useEffect(() => {
    if (phase === "revealed" && rarity) sound.current?.open(rarity);
  }, [phase, rarity, sound]);

  const done = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (phase === "revealed") done.current?.focus();
  }, [phase, outcome]);

  const skip = () => {
    if (phase === "revealed") onDone();
    else if (outcome) setPhase("revealed");
  };
  const colour = rarity ? RARITY_INFO[rarity].colour : "#ffffff";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Opening a pack"
      tabIndex={-1}
      onClick={phase === "revealed" ? undefined : skip}
      onKeyDown={(event) => {
        if (event.key === "Escape") skip();
      }}
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/85 p-4 text-white backdrop-blur-sm"
      style={{ "--rarity": colour } as CSSProperties}
    >
      {phase === "revealed" ? (
        <Revealed outcome={outcome} reduced={reduced} done={done} onDone={onDone} />
      ) : (
        <div className="flex flex-col items-center gap-6">
          <div
            aria-hidden="true"
            className={`bg-accent text-on-accent flex h-64 w-44 flex-col items-center justify-center gap-3 rounded-xl border-2 border-white/40 bg-linear-to-b from-white/25 to-black/25 p-4 text-center shadow-2xl ${
              phase === "shaking" ? "pack-shake" : phase === "glowing" ? "pack-glow" : "pack-burst"
            }`}
            style={{ "--glow-for": `${rarity ? GLOW_MS[rarity] : 0}ms` } as CSSProperties}
          >
            <DieIcon sides={20} size={72} style={PACK_DIE} />
            <span className="font-display text-lg font-bold">Dice pack</span>
            {pack.reason && <span className="text-sm opacity-80">{pack.reason}</span>}
          </div>
          <button
            type="button"
            className="rounded-md px-3 py-1 text-sm text-white/80 hover:bg-white/10"
            onClick={(event) => {
              event.stopPropagation();
              skip();
            }}
          >
            Skip
          </button>
        </div>
      )}
    </div>
  );
}

function Revealed({
  outcome,
  reduced,
  done,
  onDone,
}: {
  outcome: Outcome | undefined;
  reduced: boolean;
  done: React.RefObject<HTMLButtonElement | null>;
  onDone: () => void;
}) {
  if (!outcome) {
    return (
      <p role="status" className="text-lg">
        Opening…
      </p>
    );
  }
  if ("error" in outcome) {
    return (
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <p role="alert">{outcome.error}</p>
        <button ref={done} type="button" onClick={onDone} className={doneClass}>
          Close
        </button>
      </div>
    );
  }
  const { style, sides, count, isNew, reason } = outcome.opened;
  const rarity = RARITY_INFO[style.rarity];
  const showy = style.rarity === "veryRare" || style.rarity === "legendary";
  return (
    <div className="pack-reveal relative flex max-w-sm flex-col items-center gap-2 text-center">
      {showy && <div aria-hidden="true" className="pack-rays absolute -inset-40 -z-10" />}
      <ShownDie opened={outcome.opened} reduced={reduced} />
      <p className="text-sm font-bold tracking-widest uppercase" style={{ color: rarity.colour }}>
        {rarity.label}
      </p>
      <h2 className="font-display text-3xl font-bold">
        {style.label} d{sides}
      </h2>
      <p className="text-white/80">{style.description}</p>
      <p className="font-semibold">{isNew ? "New!" : `You have ${count} now.`}</p>
      {reason && <p className="text-sm text-white/70">{reason}</p>}
      <button ref={done} type="button" onClick={onDone} className={`${doneClass} mt-3`}>
        Done
      </button>
    </div>
  );
}

const doneClass = "rounded-md bg-white px-4 py-1.5 font-semibold text-black hover:bg-white/90";

/** The die in 3D, turning, or a flat picture of it where WebGL isn't there. */
function ShownDie({ opened, reduced }: { opened: OpenedDie; reduced: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const [flat, setFlat] = useState(false);
  useEffect(() => {
    const container = box.current;
    if (!container) return;
    let stop: (() => void) | undefined;
    let cancelled = false;
    void import("~/dice/tray/showcase").then(({ showDie }) => {
      if (cancelled) return;
      const shown = showDie(container, opened.sides, styleLook(opened.style)(container), {
        reducedMotion: reduced,
      });
      stop = shown.stop;
      if (!shown.drawn) setFlat(true);
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [opened, reduced]);
  return (
    <div ref={box} aria-hidden="true" className="flex size-56 items-center justify-center">
      {flat && <DieIcon sides={opened.sides} style={opened.style} size={160} />}
    </div>
  );
}

/** Asks the server to open the pack, once (Strict Mode runs effects twice in development). */
function useOpenedPack(pack: DicePack): Outcome | undefined {
  const [outcome, setOutcome] = useState<Outcome>();
  const asked = useRef(false);
  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    fetch(OPEN_PACK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ pack: pack.id }),
    })
      .then(async (response) => {
        const body = (await response.json().catch(() => ({}))) as Partial<Outcome>;
        if (response.ok && body && "opened" in body && body.opened) {
          return setOutcome({ opened: body.opened });
        }
        const error = body && "error" in body ? body.error : undefined;
        setOutcome({ error: error ?? "That pack couldn't be opened. Try again in a moment." });
      })
      .catch(() => setOutcome({ error: "Guildhall couldn't be reached. Try again in a moment." }));
  }, [pack.id]);
  return outcome;
}

/** The pack's sounds, if their dice sounds are on and sounds aren't muted. */
function usePackSound() {
  const preferences = useDicePreferences();
  const { settings } = useStuntSettings();
  const sound = useRef<PackSound | undefined>(undefined);
  const volume = preferences.sound && settings.sound ? settings.volume : 0;
  useEffect(() => {
    if (volume <= 0) return;
    const made = new PackSound(volume);
    sound.current = made;
    return () => {
      sound.current = undefined;
      made.close();
    };
  }, [volume]);
  return sound;
}
