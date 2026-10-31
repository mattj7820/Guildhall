/** Each module's icon, drawn in its colour. */
const ICON_PATHS: Record<string, string> = {
  wiki: "M4 19.5V5a2 2 0 0 1 2-2h14v15H6a2 2 0 0 0-2 2 1.5 1.5 0 0 0 1.5 1.5H20",
  characters: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M4 21c0-4.2 3.6-6.5 8-6.5s8 2.3 8 6.5",
  maps: "M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20zM9 4v13.5M15 6.5V20",
  combat:
    "M4 4l10.5 10.5M20 4 9.5 14.5M4 4h3.5M4 4v3.5M20 4h-3.5M20 4v3.5M12.5 16.5l4 4M11.5 16.5l-4 4M15 13l3 3M9 13l-3 3",
  members: "M8 19.5a4 4 0 1 0 0-8 4 4 0 0 0 0 8M11 12.5 20 3.5M16 7.5l2.5 2.5M18.5 5l2 2",
};

export function HubIcon({ id }: { id: string }) {
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
