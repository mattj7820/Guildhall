/** What the player preview sees on any map page. */
export function MapsDmOnlyNotice() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-serif text-3xl font-bold">Maps</h1>
      <p className="mt-2">
        Maps are DM-only for now. A player view, showing only the maps and areas the DM has
        revealed, is planned.
      </p>
    </main>
  );
}
