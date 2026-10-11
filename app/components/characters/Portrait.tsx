/** A character's portrait, or their initial in a circle when there's no image. */
export function Portrait({
  name,
  url,
  companion = false,
  size = "md",
}: {
  name: string;
  url?: string;
  companion?: boolean;
  size?: "md" | "lg";
}) {
  const box = size === "lg" ? "h-20 w-20 text-3xl" : "h-14 w-14 text-xl";
  if (url) {
    return (
      <img
        src={url}
        alt=""
        className={`${box} shrink-0 rounded-full object-cover object-top ring-2 ring-line`}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={[
        box,
        "flex shrink-0 items-center justify-center rounded-full font-serif font-bold",
        companion ? "bg-good-surface text-good" : "bg-line text-ink",
      ].join(" ")}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}
