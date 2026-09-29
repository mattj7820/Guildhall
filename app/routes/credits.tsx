import { ITEM_ICONS } from "~/characters/item-icons";
import { ItemIconSvg } from "~/components/inventory/ItemTile";
import type { Route } from "./+types/credits";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Credits · Guildhall" }];
}

const byAuthor = [...new Set(ITEM_ICONS.map((icon) => icon.author))]
  .sort((a, b) => a.localeCompare(b))
  .map((author) => ({ author, icons: ITEM_ICONS.filter((icon) => icon.author === author) }));

/** Where the item icons come from, as their licence asks. */
export default function Credits() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="font-serif text-3xl font-bold">Credits</h1>
      <p className="mt-2 text-stone-700 dark:text-stone-300">
        The item icons are from{" "}
        <a href="https://game-icons.net" className="text-amber-800 underline dark:text-amber-400">
          game-icons.net
        </a>
        , licensed under{" "}
        <a
          href="https://creativecommons.org/licenses/by/3.0/"
          className="text-amber-800 underline dark:text-amber-400"
        >
          CC BY 3.0
        </a>
        . They&rsquo;re drawn in Guildhall&rsquo;s own colours; the shapes are unchanged.
      </p>
      {byAuthor.map(({ author, icons }) => (
        <section key={author} aria-labelledby={`by-${author}`} className="mt-6">
          <h2 id={`by-${author}`} className="font-serif text-xl font-bold">
            By {author}
          </h2>
          <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {icons.map((icon) => (
              <li key={icon.id} className="flex items-center gap-2 text-sm">
                <ItemIconSvg icon={{ builtin: icon.id }} className="h-6 w-6 shrink-0" />
                {icon.label}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
