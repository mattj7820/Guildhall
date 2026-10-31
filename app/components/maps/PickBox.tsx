/** A tick that puts a token in the pick, as Shift-clicking it on the map does. */
export function PickBox({
  name,
  picked,
  onToggle,
}: {
  name: string;
  picked: boolean;
  onToggle: () => void;
}) {
  return (
    <input
      type="checkbox"
      aria-label={`Pick ${name}`}
      title="Pick it, as Shift-clicking it on the map does"
      checked={picked}
      onChange={onToggle}
    />
  );
}
