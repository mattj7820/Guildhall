import { Link } from "react-router";
import type { BoardPage } from "~/board/types";
import { NextSession } from "~/components/home/NextSession";

/** The notice board: when the table next meets, and the session notes the viewer may read. */
export function NoticeBoard({ board, forDm }: { board: BoardPage; forDm: boolean }) {
  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="font-display text-3xl text-title">Notice board</h1>
      <div className="mt-4 grid gap-4">
        <NextSession at={board.nextSession} forDm={forDm} />
        <section
          aria-labelledby="board-sessions"
          className="gh-panel rounded-xl border border-line bg-surface p-4"
        >
          <h2 id="board-sessions" className="font-display text-2xl text-title">
            Sessions
          </h2>
          {board.sessions.length ? (
            <ul className="mt-2 divide-y divide-line">
              {board.sessions.map((session) => (
                <li key={session.url}>
                  <Link to={session.url} className="block px-2 py-1.5 text-link hover:underline">
                    {session.title}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-muted">No session notes yet.</p>
          )}
        </section>
      </div>
    </main>
  );
}
