import { useEffect, useState } from "react";
import { Link, useFetcher } from "react-router";
import { buttonClass, inputClass, primaryButtonClass } from "~/components/styles";
import { countdown } from "~/home/countdown";

/**
 * When the table next meets, with a countdown, and a link to last time. The date is shown once
 * the page is in the browser, in its own time zone, so the server never guesses one. The DM sets
 * it here.
 */
export function NextSession({
  at,
  forDm,
  latest,
}: {
  at?: string;
  forDm: boolean;
  latest?: { title: string; url: string };
}) {
  const fetcher = useFetcher();
  const [editing, setEditing] = useState(false);
  const now = useNow();
  // What's being saved shows at once.
  const pending = fetcher.formData?.get("at");
  const shown = typeof pending === "string" ? pending || undefined : at;
  const next = shown ? new Date(shown) : undefined;

  function save(local: string) {
    setEditing(false);
    // The browser's own time zone turns the picked time into an instant.
    void fetcher.submit({ at: local ? new Date(local).toISOString() : "" }, { method: "post" });
  }

  return (
    <div className="gh-hero-session rounded-lg border border-line bg-surface/80 px-4 py-3">
      <h2 className="gh-label text-xs font-semibold tracking-wider text-muted uppercase">
        Next session
      </h2>
      {editing ? (
        <form
          className="mt-2 flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            save(String(new FormData(event.currentTarget).get("at") ?? ""));
          }}
        >
          <input
            type="datetime-local"
            name="at"
            aria-label="Date and time"
            required
            className={inputClass}
            defaultValue={next ? toLocalInput(next) : ""}
          />
          <button className={primaryButtonClass}>Save</button>
          {next && (
            <button type="button" className={buttonClass} onClick={() => save("")}>
              Clear
            </button>
          )}
          <button type="button" className={buttonClass} onClick={() => setEditing(false)}>
            Cancel
          </button>
        </form>
      ) : !now ? (
        <p className="mt-1">&nbsp;</p>
      ) : next ? (
        <p className="mt-1">
          <time dateTime={next.toISOString()} className="font-display text-2xl text-title">
            {when(next)}
          </time>
          <span className="ml-2 text-muted">· {countdown(next, now)}</span>
        </p>
      ) : (
        <p className="mt-1 text-muted">Not set yet.</p>
      )}
      {fetcher.data?.error && <p className="mt-1 text-sm text-danger">{fetcher.data.error}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        {latest && (
          <Link to={latest.url} className="text-link hover:underline">
            Last time: {latest.title}
          </Link>
        )}
        {forDm && !editing && (
          <button
            type="button"
            className="text-link hover:underline"
            onClick={() => setEditing(true)}
          >
            {next ? "Change the date" : "Set the date"}
          </button>
        )}
      </div>
    </div>
  );
}

/** The time now, once in the browser, kept roughly current for the countdown. */
function useNow(): Date | undefined {
  const [now, setNow] = useState<Date>();
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const timer = setInterval(tick, 30_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

function when(date: Date) {
  return date.toLocaleString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** A `datetime-local` input's value: the browser's local time, to the minute. */
function toLocalInput(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
