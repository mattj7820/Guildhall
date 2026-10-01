import { Link, NavLink } from "react-router";

/** Switches between the live fight and the encounters prepared for later. */
export function CombatNav() {
  const tab = ({ isActive }: { isActive: boolean }) =>
    `rounded-t-md border-b-2 px-3 py-1.5 text-sm font-semibold ${
      isActive
        ? "border-amber-700 text-stone-900 dark:border-amber-500 dark:text-stone-50"
        : "border-transparent text-stone-500 hover:text-stone-900 dark:hover:text-stone-100"
    }`;
  return (
    <nav
      aria-label="Combat"
      className="mb-4 flex gap-2 border-b border-stone-200 dark:border-stone-800"
    >
      <NavLink to="/combat" end className={tab}>
        Live fight
      </NavLink>
      <NavLink to="/combat/prepared" className={tab}>
        Prepared encounters
      </NavLink>
    </nav>
  );
}

/** What players see on the DM's combat pages: prepared encounters. */
export function DmOnlyNotice() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-serif text-3xl font-bold">Prepared encounters</h1>
      <p className="mt-2">
        Prepared encounters are the DM's. The fight you're in is on{" "}
        <Link to="/combat" className="text-amber-800 underline dark:text-amber-400">
          Combat
        </Link>
        .
      </p>
    </main>
  );
}
