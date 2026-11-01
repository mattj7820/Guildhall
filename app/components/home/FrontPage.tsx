import { useState } from "react";
import { Link, useRouteLoaderData } from "react-router";
import { fightSummary, type FightSummary, type FrontPage as Data } from "~/home/front-page";
import type { HubLink } from "~/hub/links";
import { FIGHT_ROOM, PARTY_ROOM } from "~/live/messages";
import { useLiveMap } from "~/live/useLive";
import { mapUrl } from "~/maps/urls";
import { townPlaces, type PlaceId } from "~/home/town";
import type { loader as rootLoader } from "~/root";
import { NextSession } from "./NextSession";
import { BannerMap } from "./BannerMap";
import { PartyStrip } from "./PartyStrip";
import { TownMap } from "./TownMap";

/**
 * The campaign as it stands: where the party is, a fight if one is on, the last session, and the
 * party; the modules underneath. The fight follows the live connection.
 */
export function FrontPage(props: { data: Data; modules: HubLink[]; forDm: boolean }) {
  const { data } = props;
  const [fight, setFight] = useState(data.fight);
  useLiveMap(FIGHT_ROOM, (message) => {
    if (message.type === "fight") setFight(fightSummary(message.fight));
  });
  const [online, setOnline] = useState(data.online);
  useLiveMap(PARTY_ROOM, (message) => {
    if (message.type === "presence") setOnline(message.online);
  });
  const forDm = props.forDm;
  const root = useRouteLoaderData<typeof rootLoader>("root");
  const places = townPlaces(forDm ? "dm" : "player");
  const fightHref = fight?.map ? mapUrl(fight.map) : "/combat";
  const hrefs: Partial<Record<PlaceId, string>> = {
    library: "/wiki",
    tower: "/maps",
    war: fightHref,
    barracks: "/characters",
    treasury: "/settings/dice",
    steward: "/members",
    board: "#next-session",
  };
  const you = data.you ?? { name: root?.user?.name ?? "You" };
  const others = [
    ...(online.dm && !forDm ? [{ name: "DM" }] : []),
    ...data.party.filter(
      (member) => online.party.includes(member.name) && member.name !== data.you?.name,
    ),
  ];

  return (
    <main className="mx-auto max-w-[100rem] px-4 py-6 lg:px-8">
      <h1 className="sr-only">Guildhall</h1>
      <TownMap
        places={places}
        hrefs={hrefs}
        fight={fight}
        partyMap={data.banner?.name}
        packs={root?.user?.packs ?? 0}
        waiting={data.waiting}
        nextSession={data.nextSession}
        you={you}
        others={others}
        panel={(walkTo, { hot, setHot }) => (
          <aside className="grid content-start gap-4">
            <section
              aria-labelledby="front-now"
              className="gh-panel grid gap-3 rounded-xl border border-line bg-surface p-4"
            >
              <h2 id="front-now" className="font-display text-2xl text-title">
                The campaign now
              </h2>
              {fight && <FightBanner fight={fight} onClick={walkTo("war")} />}
              {data.banner && (
                <>
                  <p>
                    The party is at{" "}
                    <Link to={data.banner.url} className="font-semibold text-link hover:underline">
                      {data.banner.name}
                    </Link>
                    .
                  </p>
                  <BannerMap banner={data.banner} />
                </>
              )}
              <div id="next-session" tabIndex={-1} className="outline-none">
                <NextSession at={data.nextSession} forDm={forDm} latest={data.latestSession} />
              </div>
              <HereNow others={others} />
            </section>
            <nav
              aria-labelledby="front-ways"
              className="gh-panel rounded-xl border border-line bg-surface p-4"
            >
              <h2 id="front-ways" className="font-display text-2xl text-title">
                Where to
              </h2>
              <ul className="mt-2 divide-y divide-line">
                {places
                  .filter((place) => place.id !== "hall" && place.id !== "board")
                  .map((place) => (
                    <li key={place.id}>
                      <Link
                        to={hrefs[place.id]!}
                        onClick={walkTo(place.id)}
                        onPointerEnter={() => setHot(place.id)}
                        onPointerLeave={() => setHot(null)}
                        onFocus={() => setHot(place.id)}
                        onBlur={() => setHot(null)}
                        className={`grid grid-cols-[1fr_auto] items-baseline rounded-md px-2 py-1.5 ${hot === place.id ? "bg-accent-surface" : ""}`}
                      >
                        <span className="font-display text-lg text-title">{place.name}</span>
                        <span className="row-span-2 text-sm font-semibold text-danger">
                          {place.id === "war" && fight ? "Fight on" : ""}
                          {place.id === "treasury" && (root?.user?.packs ?? 0) > 0 && (
                            <span className="font-normal text-muted">
                              {root!.user!.packs} to open
                            </span>
                          )}
                          {place.id === "steward" && data.waiting > 0 && (
                            <span className="font-normal text-muted">{data.waiting} waiting</span>
                          )}
                        </span>
                        <span className="text-sm text-muted">{place.module}</span>
                      </Link>
                    </li>
                  ))}
              </ul>
            </nav>
          </aside>
        )}
        below={<PartyStrip party={data.party} online={online} />}
      />
    </main>
  );
}

/** Who else is here now: the DM and the PCs whose player has Guildhall open. */
function HereNow({ others }: { others: { name: string }[] }) {
  return (
    <p className="text-sm text-muted">
      {others.length === 0
        ? "Nobody else is here now."
        : `Here now with you: ${others.map((other) => other.name).join(", ")}`}
    </p>
  );
}

/** A fight is on: the round and whose turn, leading to it. */
function FightBanner({
  fight,
  onClick,
}: {
  fight: FightSummary;
  onClick: (event: React.MouseEvent) => void;
}) {
  return (
    <Link
      to={fight.map ? mapUrl(fight.map) : "/combat"}
      onClick={onClick}
      className="gh-hero-fight flex items-center gap-3 rounded-lg border border-danger bg-danger-surface px-4 py-3 text-ink"
    >
      <span aria-hidden className="relative flex size-3">
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
