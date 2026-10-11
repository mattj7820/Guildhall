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

/** The themes' fonts, served from Guildhall itself (the `@fontsource` packages). */
const FONTS = [
  { name: "Fondamento", theme: "Storybook" },
  { name: "Crimson Pro", theme: "Storybook" },
  { name: "Grenze Gotisch", theme: "Iron and Ember" },
  { name: "Spectral", theme: "Iron and Ember" },
  { name: "Marcellus SC", theme: "Gemlight" },
  { name: "Cormorant Garamond", theme: "Gemlight" },
  { name: "Jost", theme: "Gemlight" },
];

/** Where the item and token icons and the fonts come from, as their licences ask. */
export default function Credits() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="font-serif text-3xl font-bold">Credits</h1>
      <p className="mt-2 text-ink">
        The item and token icons are from{" "}
        <a href="https://game-icons.net" className="text-link underline">
          game-icons.net
        </a>
        , licensed under{" "}
        <a href="https://creativecommons.org/licenses/by/3.0/" className="text-link underline">
          CC BY 3.0
        </a>
        . They&rsquo;re drawn in Guildhall&rsquo;s own colours; the shapes are unchanged.
      </p>
      <section aria-labelledby="fonts" className="mt-6">
        <h2 id="fonts" className="font-serif text-xl font-bold">
          Fonts
        </h2>
        <p className="mt-2 text-ink">
          The themes&rsquo; fonts are licensed under the{" "}
          <a href="https://openfontlicense.org" className="text-link underline">
            SIL Open Font License 1.1
          </a>
          .
        </p>
        <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
          {FONTS.map((font) => (
            <li key={font.name}>
              {font.name} <span className="text-muted">({font.theme})</span>
            </li>
          ))}
        </ul>
      </section>
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
