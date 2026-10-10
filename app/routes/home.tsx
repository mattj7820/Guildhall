import { Link } from "react-router";
import { viewerContext } from "~/context";
import { hubLinks, type HubLink } from "~/hub/links";
import type { Route } from "./+types/home";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Guildhall" },
    { name: "description", content: "A campaign hub for the table." },
  ];
}

export function loader({ context }: Route.LoaderArgs) {
  return { modules: hubLinks(context.get(viewerContext).role) };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="font-serif text-4xl font-bold">Guildhall</h1>
      <p className="mt-2 text-stone-600 dark:text-stone-400">
        Everything for the next session, in one place.
      </p>

      <HubSection title="Campaign" links={loaderData.modules} />
    </main>
  );
}

function HubSection({ title, links }: { title: string; links: HubLink[] }) {
  const headingId = `hub-${title.toLowerCase().replace(/\W+/g, "-")}`;
  return (
    <section aria-labelledby={headingId} className="mt-10">
      <h2 id={headingId} className="text-sm font-semibold tracking-wider text-stone-500 uppercase">
        {title}
      </h2>
      <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {links.map((link) => (
          <li key={link.id}>
            <HubCard link={link} />
          </li>
        ))}
      </ul>
    </section>
  );
}

const cardClass =
  "block h-full rounded-lg border border-stone-200 bg-white p-5 shadow-sm transition hover:border-amber-600 hover:shadow dark:border-stone-800 dark:bg-stone-900";

function HubCard({ link }: { link: HubLink }) {
  return (
    <Link to={link.href} className={cardClass}>
      <span className="text-lg font-semibold">{link.title}</span>
      <span className="mt-1 block text-sm text-stone-600 dark:text-stone-400">
        {link.description}
      </span>
    </Link>
  );
}
