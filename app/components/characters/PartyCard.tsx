import { Form, Link } from "react-router";
import { characterUrl } from "~/characters/urls";
import type { CharacterCard } from "~/characters/view";
import { ItemIconSvg } from "../inventory/ItemTile";
import { primaryButtonClass } from "../styles";
import { Portrait } from "./Portrait";

/**
 * One party member on the Characters page. Those who play it (and the DM) get a link to the sheet
 * and its hit points; everyone else sees who it is and what they've got equipped.
 */
export function PartyCard({ card }: { card: CharacterCard }) {
  const headingId = `card-${card.note.replace(/\W+/g, "-")}`;
  const subtitle =
    card.kind === "companion"
      ? ["Companion", card.armourClass !== undefined && `AC ${card.armourClass}`, card.speed]
      : [card.species, card.className && `${card.className} ${card.level ?? ""}`.trim()];

  return (
    <article
      aria-labelledby={headingId}
      className="flex h-full flex-col rounded-lg border border-stone-200 bg-white p-4 shadow-sm dark:border-stone-800 dark:bg-stone-900"
    >
      <div className="flex items-center gap-3">
        <Portrait name={card.name} url={card.portraitUrl} companion={card.kind === "companion"} />
        <div className="min-w-0">
          <h3 id={headingId} className="truncate font-serif text-xl font-bold">
            {card.canOpen && card.id ? (
              <Link to={characterUrl(card.id)} className="hover:underline">
                {card.name}
              </Link>
            ) : (
              card.name
            )}
          </h3>
          <p className="truncate text-sm text-stone-600 dark:text-stone-400">
            {subtitle.filter(Boolean).join(" · ") || (card.id ? "" : "No sheet yet")}
          </p>
        </div>
      </div>

      {card.hp && <HpBar hp={card.hp} />}

      {card.equipped.length > 0 && (
        <div className="mt-3">
          <h4 className="text-xs font-semibold tracking-wide text-stone-500 uppercase">Equipped</h4>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {card.equipped.map((item, index) => (
              <li
                key={index}
                title={item.name}
                className="flex items-center gap-1 rounded-full bg-amber-50 py-0.5 pr-2 pl-1 text-xs text-stone-800 ring-1 ring-amber-300 dark:bg-amber-950/40 dark:text-stone-100 dark:ring-amber-800"
              >
                <ItemIconSvg icon={item.icon} className="h-4 w-4" />
                {item.name}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-auto pt-4">
        {card.canOpen && card.id && (
          <Link to={characterUrl(card.id)} className={primaryButtonClass}>
            {card.kind === "companion" ? `Open ${card.name}` : "Open sheet"}
            <span className="sr-only"> for {card.name}</span>
          </Link>
        )}
        {card.canStart && (
          <Form method="post">
            <input type="hidden" name="note" value={card.note} />
            <button type="submit" name="intent" value="start" className={primaryButtonClass}>
              {card.kind === "companion" ? "Set up" : "Start sheet"}
              <span className="sr-only"> for {card.name}</span>
            </button>
          </Form>
        )}
      </div>
    </article>
  );
}

function HpBar({ hp }: { hp: { current: number; max: number; temp: number } }) {
  const fraction = hp.max > 0 ? Math.min(1, hp.current / hp.max) : 0;
  return (
    <div className="mt-3">
      <div className="flex justify-between text-xs text-stone-600 dark:text-stone-400">
        <span>Hit points</span>
        <span className="tabular-nums">
          {hp.current} / {hp.max}
          {hp.temp > 0 && ` (+${hp.temp} temp)`}
        </span>
      </div>
      <div
        aria-hidden="true"
        className="mt-1 h-1.5 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-800"
      >
        <div
          className={`h-full rounded-full ${fraction > 0.5 ? "bg-emerald-600" : fraction > 0.25 ? "bg-amber-500" : "bg-rose-600"}`}
          style={{ width: `${fraction * 100}%` }}
        />
      </div>
    </div>
  );
}
