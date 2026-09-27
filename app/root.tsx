import {
  isRouteErrorResponse,
  Link,
  Links,
  Meta,
  NavLink,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteLoaderData,
} from "react-router";
import { viewerFromRequest } from "~/.server/viewer";
import { ViewToggle } from "~/components/ViewToggle";
import { viewerContext } from "~/context";
import type { Route } from "./+types/root";
import "./app.css";

/** Resolves who is viewing once per request; every loader reads it from context. */
export const middleware: Route.MiddlewareFunction[] = [
  async ({ request, context }) => {
    context.set(viewerContext, await viewerFromRequest(request));
  },
];

export function loader({ context }: Route.LoaderArgs) {
  return { role: context.get(viewerContext).role };
}

export function Layout({ children }: { children: React.ReactNode }) {
  const data = useRouteLoaderData<typeof loader>("root");
  // No root data means the root itself failed (an error page): show the least, not the DM's view.
  const role = data?.role;

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="min-h-screen bg-stone-50 text-stone-900 dark:bg-stone-950 dark:text-stone-100">
        <header className="border-b border-stone-200 bg-white/80 dark:border-stone-800 dark:bg-stone-900/80">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
            <Link
              to="/"
              className="font-serif text-xl font-bold tracking-wide text-amber-800 dark:text-amber-400"
            >
              Guildhall
            </Link>
            <nav aria-label="Main" className="flex gap-4 text-sm">
              <NavLink to="/" end className={navLinkClass}>
                Hub
              </NavLink>
              <NavLink to="/wiki" className={navLinkClass}>
                Wiki
              </NavLink>
              {role === "dm" && (
                <>
                  <NavLink to="/combat" className={navLinkClass}>
                    Combat
                  </NavLink>
                  <NavLink to="/maps" className={navLinkClass}>
                    Maps
                  </NavLink>
                </>
              )}
            </nav>
            <div className="ml-auto">{role && <ViewToggle role={role} />}</div>
          </div>
          {role === "player" && (
            <p
              role="status"
              className="bg-sky-100 px-4 py-1.5 text-center text-sm text-sky-900 dark:bg-sky-950 dark:text-sky-200"
            >
              Player preview: showing only what players can see. This is not a security boundary.
            </p>
          )}
        </header>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

function navLinkClass({ isActive }: { isActive: boolean }) {
  return isActive
    ? "font-semibold text-stone-900 dark:text-stone-50"
    : "text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100";
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Something went wrong";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "Page not found" : `Error ${error.status}`;
    details =
      error.status === 404 ? "There's nothing at this address." : error.statusText || details;
  } else if (import.meta.env.DEV && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="font-serif text-3xl font-bold">{message}</h1>
      <p className="mt-2">{details}</p>
      {stack && (
        <pre className="mt-4 overflow-x-auto rounded bg-stone-200 p-4 text-xs dark:bg-stone-800">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
