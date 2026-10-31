import type { PartyMember } from "~/home/front-page";

/** The party's faces, names and what they are, as large portraits. */
export function PartyStrip({ party }: { party: PartyMember[] }) {
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
          <li key={member.name} className="flex w-28 flex-col items-center text-center">
            <span className="gh-party-face relative rounded-full p-1">
              <Portrait member={member} />
            </span>
            <span className="mt-2 font-display text-lg leading-tight text-title">
              {member.name}
            </span>
            {member.blurb && <span className="text-xs text-muted">{member.blurb}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}

const SIZE = 88;

function Portrait({ member }: { member: { name: string; portraitUrl?: string } }) {
  return member.portraitUrl ? (
    <img
      src={member.portraitUrl}
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
      {member.name.charAt(0).toUpperCase()}
    </span>
  );
}
