import { useId, useMemo, useState } from "react";
import { creatureLines } from "~/combat/find-creatures";
import type { CreatureOption } from "~/combat/types";
import { inputClass } from "~/components/styles";

/**
 * A monster's statblock for a token, typed to find it among the vault's and the SRD's (the
 * browser's own suggestions, from every statblock's line). Clearing it takes the statblock away.
 */
export function MonsterField({
  label,
  creatures,
  value,
  onChange,
}: {
  label: string;
  creatures: CreatureOption[];
  value?: CreatureOption;
  onChange: (creature: CreatureOption | undefined) => void;
}) {
  const id = useId();
  const lines = useMemo(() => creatureLines(creatures), [creatures]);
  const lineOf = (creature: CreatureOption | undefined) =>
    creature ? ([...lines].find(([, each]) => each.key === creature.key)?.[0] ?? "") : "";
  const [text, setText] = useState(() => lineOf(value));
  const unmatched = text.trim() !== "" && !lines.has(text);

  return (
    <label className="flex flex-col gap-1">
      <span className="font-medium">{label}</span>
      <input
        className={inputClass}
        list={`${id}-monsters`}
        value={text}
        placeholder="Goblin, Bandit Captain…"
        aria-describedby={unmatched ? `${id}-hint` : undefined}
        onChange={(event) => {
          const typed = event.target.value;
          setText(typed);
          if (!typed.trim()) onChange(undefined);
          const creature = lines.get(typed);
          if (creature) onChange(creature);
        }}
      />
      {unmatched && (
        <span id={`${id}-hint`} className="text-xs text-muted">
          Pick one from the list
        </span>
      )}
      <datalist id={`${id}-monsters`}>
        {[...lines.keys()].map((line) => (
          <option key={line} value={line} />
        ))}
      </datalist>
    </label>
  );
}
