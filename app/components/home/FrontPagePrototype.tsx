/**
 * PROTOTYPE (throwaway, behind ?prototype=front): the living front page, to judge its layout and
 * feel. The next session's date is kept in this browser only, for now.
 */
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { inputClass, primaryButtonClass, buttonClass } from "~/components/styles";
import { fightSummaryOf } from "~/home/fight-summary";
import type { HubLink } from "~/hub/links";
import { FIGHT_ROOM } from "~/live/messages";
import { useLiveMap } from "~/live/useLive";

type Fight = ReturnType<typeof fightSummaryOf>;

export interface FrontPageData {
  banner?: {
    name: string;
    url: string;
    thumbnail?: string;
    size: { width: number; height: number };
    faces: { name: string; portraitUrl?: string; at: [number, number] }[];
  };
  party: {
    name: string;
    kind: "pc" | "companion";
    portraitUrl?: string;
    blurb: string;
    online: boolean;
  }[];
  dmOnline: boolean;
  latestSession?: { title: string; url: string };
  fight: Fight;
}

export function FrontPagePrototype({
  data,
  forDm,
  modules,
  icon,
}: {
  data: FrontPageData;
  forDm: boolean;
  modules: HubLink[];
  icon: (id: string) => ReactNode;
}) {
  const [fight, setFight] = useState<Fight>(data.fight);
  useLiveMap(FIGHT_ROOM, (message) => {
    if (message.type === "fight") setFight(fightSummaryOf(message.fight));
  });
  const { banner } = data;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <section
        aria-label="The campaign now"
        className="gh-hero relative isolate overflow-hidden rounded-2xl border border-line bg-surface shadow-sm"
      >
        {banner?.thumbnail && (
          <img
            src={banner.thumbnail}
            alt=""
            aria-hidden
            className="absolute inset-0 -z-10 size-full scale-125 object-cover opacity-30 blur-2xl"
          />
        )}
        <div aria-hidden className="gh-hero-motion pointer-events-none absolute inset-0 -z-10" />
        <div className="grid gap-6 p-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] md:p-8">
          <div className="flex flex-col gap-5">
            <div>
              <h1 className="gh-hub-title font-display text-5xl text-title">Guildhall</h1>
              <p className="mt-2 text-lg text-muted">
                {banner ? (
                  <>
                    The party is at{" "}
                    <Link to={banner.url} className="font-semibold text-link hover:underline">
                      {banner.name}
                    </Link>
                    .
                  </>
                ) : (
                  "Everything for the next session, in one place."
                )}
              </p>
            </div>
            {fight && <FightBanner fight={fight} />}
            <NextSession forDm={forDm} latest={data.latestSession} />
          </div>
          {banner && <BannerMap banner={banner} />}
        </div>
      </section>

      <section aria-labelledby="front-party" className="mt-10">
        <h2
          id="front-party"
          className="gh-label text-sm font-semibold tracking-wider text-muted uppercase"
        >
          The party
        </h2>
        <ul className="mt-4 flex flex-wrap gap-6">
          {data.party.map((member) => (
            <li key={member.name}>
              <PartyFace member={member} />
            </li>
          ))}
          <li>
            <PartyFace member={{ name: "DM", blurb: "Dungeon Master", online: data.dmOnline }} />
          </li>
        </ul>
      </section>

      <section aria-labelledby="front-modules" className="mt-10">
        <h2
          id="front-modules"
          className="gh-label text-sm font-semibold tracking-wider text-muted uppercase"
        >
          Campaign
        </h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {modules.map((link) => (
            <li key={link.id}>
              <Link
                to={link.href}
                data-module={link.id}
                className="gh-card flex h-full items-center gap-3 rounded-lg border border-line bg-surface px-4 py-3 shadow-sm transition hover:border-module"
              >
                <span className="gh-card-icon grid size-8 shrink-0 place-items-center text-module">
                  {icon(link.id)}
                </span>
                <span className="font-display text-lg text-title">{link.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function BannerMap({ banner }: { banner: NonNullable<FrontPageData["banner"]> }) {
  const ratio = banner.size.width / banner.size.height;
  return (
    <Link
      to={banner.url}
      aria-label={`Open ${banner.name}`}
      className="gh-hero-map group relative block self-center overflow-hidden rounded-xl border-4 border-stone-50/80 bg-stone-950 shadow-2xl transition-transform hover:-translate-y-0.5"
      style={{ aspectRatio: `${ratio}` }}
    >
      {banner.thumbnail && (
        <img
          src={banner.thumbnail}
          alt=""
          className="absolute inset-0 size-full transition-transform duration-700 group-hover:scale-[1.03]"
        />
      )}
      {banner.faces.map((face) => (
        <span
          key={face.name}
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${face.at[0] * 100}%`, top: `${face.at[1] * 100}%` }}
        >
          <span className="absolute inset-0 rounded-full bg-amber-200/60 motion-safe:animate-ping" />
          <Face name={face.name} portraitUrl={face.portraitUrl} size={34} onArt />
        </span>
      ))}
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-4 pt-8 pb-3 font-display text-lg text-white">
        {banner.name}
        <span className="ml-2 text-sm text-white/70 opacity-0 transition-opacity group-hover:opacity-100">
          Open the map →
        </span>
      </span>
    </Link>
  );
}

function FightBanner({ fight }: { fight: NonNullable<Fight> }) {
  return (
    <Link
      to={fight.map ? `/maps/${fight.map}` : "/combat"}
      className="gh-hero-fight flex items-center gap-3 rounded-lg border border-danger bg-danger-surface px-4 py-3 text-ink"
    >
      <span className="relative flex size-3">
        <span className="absolute inset-0 rounded-full bg-danger motion-safe:animate-ping" />
        <span className="relative size-3 rounded-full bg-danger" />
      </span>
      <span>
        <span className="font-display text-lg font-semibold">A fight is on</span>
        <span className="block text-sm text-muted">
          Round {fight.round}
          {fight.turn && <> · {fight.turn}&rsquo;s turn</>}
        </span>
      </span>
      <span className="ml-auto text-sm font-semibold text-link">Join →</span>
    </Link>
  );
}

const NEXT_KEY = "guildhall:prototype:next-session";

function NextSession({
  forDm,
  latest,
}: {
  forDm: boolean;
  latest?: { title: string; url: string };
}) {
  // In the browser only (time zones), and only in this prototype from localStorage.
  const [next, setNext] = useState<Date | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(NEXT_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- prototype
      if (saved) setNext(new Date(saved));
    } catch {
      // No storage: no date.
    }
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  function save(value: string) {
    const date = value ? new Date(value) : null;
    setNext(date);
    setEditing(false);
    try {
      if (date) localStorage.setItem(NEXT_KEY, date.toISOString());
      else localStorage.removeItem(NEXT_KEY);
    } catch {
      // Kept for this visit only.
    }
  }

  return (
    <div className="gh-hero-session rounded-lg border border-line bg-surface/80 px-4 py-3 backdrop-blur">
      <p className="gh-label text-xs font-semibold tracking-wider text-muted uppercase">
        Next session
      </p>
      {editing ? (
        <form
          className="mt-2 flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            save(String(new FormData(event.currentTarget).get("at") ?? ""));
          }}
        >
          <input
            type="datetime-local"
            name="at"
            aria-label="Next session"
            className={inputClass}
            defaultValue={next ? toLocalInput(next) : ""}
          />
          <button className={primaryButtonClass}>Save</button>
          <button type="button" className={buttonClass} onClick={() => save("")}>
            Clear
          </button>
        </form>
      ) : next && now ? (
        <p className="mt-1">
          <span className="font-display text-2xl text-title">{when(next)}</span>
          <span className="ml-2 text-muted">{countdown(next, now)}</span>
        </p>
      ) : (
        <p className="mt-1 text-muted">{now ? "Not set yet." : " "}</p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        {latest && (
          <Link to={latest.url} className="text-link hover:underline">
            Last time: {latest.title}
          </Link>
        )}
        {forDm && !editing && (
          <button
            type="button"
            className="text-link hover:underline"
            onClick={() => setEditing(true)}
          >
            {next ? "Change the date" : "Set the date"}
          </button>
        )}
      </div>
    </div>
  );
}

function when(date: Date) {
  return date.toLocaleString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function countdown(date: Date, now: Date) {
  const minutes = Math.round((date.getTime() - now.getTime()) / 60_000);
  if (minutes < -240) return "· that was the last one";
  if (minutes <= 0) return "· on now";
  const words = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (minutes < 60) return `· ${words.format(minutes, "minute")}`;
  if (minutes < 60 * 24) return `· ${words.format(Math.round(minutes / 60), "hour")}`;
  return `· ${words.format(Math.round(minutes / 60 / 24), "day")}`;
}

function toLocalInput(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function PartyFace({
  member,
}: {
  member: { name: string; portraitUrl?: string; blurb: string; online: boolean };
}) {
  return (
    <div className="flex w-28 flex-col items-center text-center">
      <span
        className={`gh-party-face relative rounded-full p-1 ${member.online ? "gh-online" : ""}`}
        title={member.online ? "Here now" : undefined}
      >
        <Face name={member.name} portraitUrl={member.portraitUrl} size={88} />
        {member.online && (
          <span className="absolute right-1 bottom-1 size-4 rounded-full border-2 border-surface bg-good" />
        )}
      </span>
      <span className="mt-2 font-display text-lg leading-tight text-title">{member.name}</span>
      {member.blurb && <span className="text-xs text-muted">{member.blurb}</span>}
      <span className="sr-only">{member.online ? "online" : "not online"}</span>
    </div>
  );
}

function Face({
  name,
  portraitUrl,
  size,
  onArt,
}: {
  name: string;
  portraitUrl?: string;
  size: number;
  onArt?: boolean;
}) {
  const border = onArt ? "border-2 border-stone-50 shadow-lg" : "border border-line";
  return portraitUrl ? (
    <img
      src={portraitUrl}
      alt=""
      title={name}
      className={`relative rounded-full object-cover object-top ${border}`}
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      aria-hidden
      title={name}
      className={`relative flex items-center justify-center rounded-full font-display font-bold ${border} ${
        onArt ? "bg-stone-700 text-white" : "bg-raised text-title"
      }`}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
