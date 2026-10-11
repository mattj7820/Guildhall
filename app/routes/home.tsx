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
      <h1 className="gh-hub-title font-display text-title text-5xl">Guildhall</h1>
      <p className="text-muted mt-2 text-lg">Everything for the next session, in one place.</p>

      <HubSection title="Campaign" links={loaderData.modules} />
    </main>
  );
}

function HubSection({ title, links }: { title: string; links: HubLink[] }) {
  const headingId = `hub-${title.toLowerCase().replace(/\W+/g, "-")}`;
  return (
    <section aria-labelledby={headingId} className="mt-10">
      <h2
        id={headingId}
        className="gh-label text-muted text-sm font-semibold tracking-wider uppercase"
      >
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
  "gh-card group grid h-full grid-cols-[auto_1fr] content-start gap-x-4 gap-y-1 rounded-lg border border-line bg-surface p-5 shadow-sm transition hover:border-module";

/** Each card takes its part of the app's colour (see `data-module` in app/app.css). */
function HubCard({ link }: { link: HubLink }) {
  return (
    <Link to={link.href} className={cardClass} data-module={link.id}>
      <span className="gh-card-icon text-module row-span-2 grid size-10 place-items-center">
        <HubIcon id={link.id} />
      </span>
      <span className="font-display text-title text-xl">{link.title}</span>
      <span className="text-muted block text-sm">{link.description}</span>
    </Link>
  );
}

const ICON_PATHS: Record<string, string> = {
  wiki: "M4 19.5V5a2 2 0 0 1 2-2h14v15H6a2 2 0 0 0-2 2 1.5 1.5 0 0 0 1.5 1.5H20",
  characters: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M4 21c0-4.2 3.6-6.5 8-6.5s8 2.3 8 6.5",
  maps: "M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20zM9 4v13.5M15 6.5V20",
  combat:
    "M4 4l10.5 10.5M20 4 9.5 14.5M4 4h3.5M4 4v3.5M20 4h-3.5M20 4v3.5M12.5 16.5l4 4M11.5 16.5l-4 4M15 13l3 3M9 13l-3 3",
  members: "M8 19.5a4 4 0 1 0 0-8 4 4 0 0 0 0 8M11 12.5 20 3.5M16 7.5l2.5 2.5M18.5 5l2 2",
};

function HubIcon({ id }: { id: string }) {
  const path = ICON_PATHS[id];
  if (!path) return null;
  return (
    <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true">
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
