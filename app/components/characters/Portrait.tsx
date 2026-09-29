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
        className={`${box} shrink-0 rounded-full object-cover ring-2 ring-stone-200 dark:ring-stone-700`}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={[
        box,
        "flex shrink-0 items-center justify-center rounded-full font-serif font-bold",
        companion
          ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-100"
          : "bg-stone-200 text-stone-700 dark:bg-stone-700 dark:text-stone-100",
      ].join(" ")}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}
