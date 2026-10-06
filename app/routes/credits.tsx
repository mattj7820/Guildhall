import { ITEM_ICONS } from "~/characters/item-icons";
import { TOKEN_ICONS } from "~/maps/tokens/token-icons";
import type { Route } from "./+types/credits";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Credits · Guildhall" }];
}

/** Every icon once: the bag and tokens share a few. */
const ICONS = [...ITEM_ICONS, ...TOKEN_ICONS].filter(
  (icon, index, all) => all.findIndex((other) => other.source === icon.source) === index,
);

const byAuthor = [...new Set(ICONS.map((icon) => icon.author))]
  .sort((a, b) => a.localeCompare(b))
  .map((author) => ({ author, icons: ICONS.filter((icon) => icon.author === author) }));

/** Where the item and token icons come from, as their licence asks. */
export default function Credits() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="font-serif text-3xl font-bold">Credits</h1>
      <p className="mt-2 text-stone-700 dark:text-stone-300">
        The item and token icons are from{" "}
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
              <li key={icon.source} className="flex items-center gap-2 text-sm">
                <svg
                  viewBox="0 0 512 512"
                  aria-hidden="true"
                  focusable="false"
                  className="h-6 w-6 shrink-0"
                >
                  <path fill="currentColor" d={icon.path} />
                </svg>
                {icon.label}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
