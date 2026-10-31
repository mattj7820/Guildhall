import { useState } from "react";
import { Link } from "react-router";
import { fightSummary, type FightSummary, type FrontPage as Data } from "~/home/front-page";
import type { HubLink } from "~/hub/links";
import { FIGHT_ROOM, PARTY_ROOM } from "~/live/messages";
import { useLiveMap } from "~/live/useLive";
import { mapUrl } from "~/maps/urls";
import { BannerMap } from "./BannerMap";
import { HubIcon } from "./HubIcon";
import { NextSession } from "./NextSession";
import { PartyStrip } from "./PartyStrip";

/**
 * The campaign as it stands: where the party is, a fight if one is on, the last session, and the
 * party; the modules underneath. The fight follows the live connection.
 */
export function FrontPage({
  data,
  modules,
  forDm,
}: {
  data: Data;
  modules: HubLink[];
  forDm: boolean;
}) {
  const [fight, setFight] = useState(data.fight);
  useLiveMap(FIGHT_ROOM, (message) => {
    if (message.type === "fight") setFight(fightSummary(message.fight));
  });
  const [online, setOnline] = useState(data.online);
  useLiveMap(PARTY_ROOM, (message) => {
    if (message.type === "presence") setOnline(message.online);
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
            <NextSession at={data.nextSession} forDm={forDm} latest={data.latestSession} />
          </div>
          {banner && <BannerMap banner={banner} />}
        </div>
      </section>

      <PartyStrip party={data.party} online={online} />

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
                title={link.description}
                className="gh-card flex h-full items-center gap-3 rounded-lg border border-line bg-surface px-4 py-3 shadow-sm transition hover:border-module"
              >
                <span className="gh-card-icon grid size-8 shrink-0 place-items-center text-module">
                  <HubIcon id={link.id} />
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

/** A fight is on: the round and whose turn, leading to it. */
function FightBanner({ fight }: { fight: FightSummary }) {
  return (
    <Link
      to={fight.map ? mapUrl(fight.map) : "/combat"}
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
