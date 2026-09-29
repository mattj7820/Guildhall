import type { LiveStatus as Status } from "~/live/client";

const LABELS: Record<Status, string> = {
  connecting: "Connecting…",
  live: "Live",
  reconnecting: "Reconnecting…",
};

/** Whether changes arrive as they happen, or (while reconnecting) every few seconds. */
export function LiveStatus({ status }: { status: Status }) {
  return (
    <span
      role="status"
      aria-label="Live updates"
      title={
        status === "live"
          ? "Changes show as they happen"
          : "Changes show within a few seconds while reconnecting"
      }
      className="flex items-center gap-1.5 text-xs text-stone-500"
    >
      <span
        aria-hidden
        className={`size-2 rounded-full ${status === "live" ? "bg-emerald-500" : "bg-amber-500"}`}
      />
      {LABELS[status]}
    </span>
  );
}
