import { useState } from "react";
import { buttonClass, inputClass, primaryButtonClass } from "~/components/styles";
import { guessTokenIcon } from "~/maps/tokens/icons";
import { numberedNames } from "~/maps/tokens/naming";
import { MARKER_NAME_MAX } from "~/maps/tokens/schema";
import type { NoteChoice } from "~/maps/tokens/types";
import { NotePicker } from "./NotePicker";
import type { MarkerDraft } from "./PlacingHint";
import { TokenLook, type Look } from "./TokenLook";
import type { CreatureOption } from "~/combat/types";
import { MonsterField } from "./FightTokensPrototype";

/** The most tokens added at once. */
const COUNT_MAX = 20;

/**
 * Adding NPCs or markers, quickly mid-session: a note (its picture, if it has one, else an icon
 * guessed from its name), a name, how many (numbered, carrying on from those already here), the
 * look, and whether players see them. New tokens are DM-only unless shown.
 */
export function AddTokenForm({
  notes,
  existing,
  monsters,
  onPlace,
  onCancel,
}: {
  notes: NoteChoice[];
  /** The names already on this map, to carry on numbering. */
  existing: string[];
  /** PROTOTYPE: monsters to give the tokens a statblock from. */
  monsters?: CreatureOption[];
  onPlace: (markers: MarkerDraft[], creature?: CreatureOption) => void;
  onCancel: () => void;
}) {
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [count, setCount] = useState(1);
  const [shown, setShown] = useState(false);
  const [look, setLook] = useState<Look>({ colour: "red" });
  const [creature, setCreature] = useState<CreatureOption>();
  const note = notes.find((each) => each.slug === slug);
  const names = numberedNames(name || "Token", count, existing);

  /** Suggests a look from a note or a name, unless the DM has chosen one. */
  function suggest(title: string, imageUrl?: string) {
    if (imageUrl) return setLook({ ...look, picture: "note" });
    const icon = guessTokenIcon(title);
    setLook(icon ? { ...look, picture: "icon", icon } : { ...look, picture: undefined });
  }

  return (
    <form
      aria-label="New token"
      className="flex flex-col gap-2 rounded-md border border-line p-3 text-sm"
      onSubmit={(event) => {
        event.preventDefault();
        if (!name.trim()) return;
        onPlace(
          names.map((each) => ({
            name: each,
            colour: look.colour,
            visibility: shown ? "players" : "dm",
            ...(note && { note: note.id }),
            ...(look.picture && { picture: look.picture }),
            ...(look.icon && { icon: look.icon }),
          })),
          creature,
        );
      }}
    >
      <NotePicker
        label="Note (optional)"
        notes={notes}
        value={slug}
        onChange={(value) => {
          setSlug(value);
          const picked = notes.find((each) => each.slug === value);
          if (!picked) return;
          setName(picked.title);
          suggest(picked.title, picked.imageUrl);
        }}
      />
      {monsters && (
        <MonsterField
          creatures={monsters}
          value={creature}
          onChange={(picked) => {
            setCreature(picked);
            if (!picked) return;
            if (!name.trim()) setName(picked.name);
            if (!note) suggest(picked.name);
          }}
        />
      )}
      <div className="flex gap-2">
        <label className="flex flex-1 flex-col gap-1">
          <span className="font-medium">Name</span>
          <input
            className={inputClass}
            value={name}
            maxLength={MARKER_NAME_MAX}
            required
            onChange={(event) => setName(event.target.value)}
            onBlur={() => {
              // No note and no look chosen yet: guess an icon from the name.
              if (!note && !look.picture) suggest(name);
            }}
          />
        </label>
        <label className="flex w-20 flex-col gap-1">
          <span className="font-medium">How many</span>
          <input
            type="number"
            min={1}
            max={COUNT_MAX}
            className={inputClass}
            value={count}
            onChange={(event) =>
              setCount(
                Math.max(1, Math.min(COUNT_MAX, Math.floor(Number(event.target.value)) || 1)),
              )
            }
          />
        </label>
      </div>
      {count > 1 && name.trim() && (
        <p className="text-xs text-muted">
          {names[0]} to {names.at(-1)}
        </p>
      )}
      <TokenLook look={look} noteImage={note?.imageUrl} onChange={setLook} />
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={shown} onChange={() => setShown(!shown)} />
        Players can see {count > 1 ? "them" : "it"} (where it&rsquo;s revealed)
      </label>
      <div className="flex gap-2">
        <button type="submit" className={primaryButtonClass}>
          Place on the map
        </button>
        <button type="button" className={buttonClass} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
