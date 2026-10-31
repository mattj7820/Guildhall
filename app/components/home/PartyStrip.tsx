import type { PartyMember } from "~/home/front-page";
import type { Presence } from "~/live/messages";

/**
 * The party's faces, names and what they are, as large portraits, and the DM: whoever has
 * Guildhall open now glows.
 */
export function PartyStrip({ party, online }: { party: PartyMember[]; online: Presence }) {
  return (
    <section aria-labelledby="front-party" className="mt-10">
      <h2
        id="front-party"
        className="gh-label text-sm font-semibold tracking-wider text-muted uppercase"
      >
        The party
      </h2>
      <ul className="mt-4 flex flex-wrap gap-6">
        {party.map((member) => (
          <Member
            key={member.name}
            name={member.name}
            portraitUrl={member.portraitUrl}
            blurb={member.blurb}
            here={online.party.includes(member.name)}
          />
        ))}
        <Member name="DM" blurb="Dungeon Master" here={online.dm} />
      </ul>
    </section>
  );
}

const SIZE = 88;

function Member({
  name,
  portraitUrl,
  blurb,
  here,
}: {
  name: string;
  portraitUrl?: string;
  blurb: string;
  here: boolean;
}) {
  return (
    <li
      aria-label={here ? `${name}, here now` : name}
      className="flex w-28 flex-col items-center text-center"
    >
      <span
        className={`gh-party-face relative rounded-full p-1 ${here ? "gh-online" : ""}`}
        title={here ? "Here now" : undefined}
      >
        {portraitUrl ? (
          <img
            src={portraitUrl}
            alt=""
            className="rounded-full border border-line object-cover object-top"
            style={{ width: SIZE, height: SIZE }}
          />
        ) : (
          <span
            aria-hidden
            className="flex items-center justify-center rounded-full border border-line bg-raised font-display font-bold text-title"
            style={{ width: SIZE, height: SIZE, fontSize: SIZE * 0.4 }}
          >
            {name.charAt(0).toUpperCase()}
          </span>
        )}
        {here && (
          <span
            aria-hidden
            className="absolute right-1 bottom-1 size-4 rounded-full border-2 border-surface bg-good"
          />
        )}
      </span>
      <span className="mt-2 font-display text-lg leading-tight text-title">{name}</span>
      {blurb && <span className="text-xs text-muted">{blurb}</span>}
    </li>
  );
}
