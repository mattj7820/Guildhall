import { useState, type ReactNode } from "react";
import { buttonClass, inputClass, labelClass } from "~/components/styles";
import type { TokenAction } from "~/maps/tokens/actions";
import { MARKER_NAME_MAX } from "~/maps/tokens/schema";
import {
  SIZE_NAMES,
  TOKEN_SIZES,
  type TokenSize,
  type TokenTools,
  type TokenView,
} from "~/maps/tokens/types";
import { noteUrl } from "~/wiki/urls";
import { NotePicker } from "./NotePicker";
import { TokenLook } from "./TokenLook";

/**
 * The chosen token, to change, send to another map, set aside or remove. An NPC or marker's
 * name, note, look and whether players see it are changed as they're picked; a party member or
 * monster has only its size and where it is.
 */
export function TokenSettings({
  token,
  tools,
  onClose,
  send,
  children,
}: {
  token: TokenView;
  tools: TokenTools;
  onClose: () => void;
  send: (actions: TokenAction[]) => void;
  /** More about it, such as how far the others are. */
  children?: ReactNode;
}) {
  const marker = token.kind === "marker";
  return (
    <section
      aria-label={`Token: ${token.name}`}
      className="flex flex-col gap-2 rounded-md border border-line p-3 text-sm"
    >
      <div className="flex items-baseline gap-2">
        <h3 className="mr-auto font-serif text-lg font-bold">{token.name}</h3>
        <button type="button" onClick={onClose} className="text-muted hover:underline">
          Close
        </button>
      </div>
      {token.hidden === "fog" && (
        <p className="text-muted">
          Under the fog:{" "}
          {marker ? "players can't see it." : "only the players who move it can see it."}
        </p>
      )}
      {marker && <MarkerFields token={token} tools={tools} send={send} />}
      <label className="flex items-center gap-2">
        <span className={labelClass}>Size</span>
        <select
          className={inputClass}
          value={token.size}
          onChange={(event) =>
            send([{ type: "setSize", id: token.id, size: Number(event.target.value) as TokenSize }])
          }
        >
          {TOKEN_SIZES.map((size) => (
            <option key={size} value={size}>
              {SIZE_NAMES[size]} ({size} × {size} squares)
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-wrap gap-2">
        {token.kind !== "combatant" && tools.otherMaps.length > 0 && (
          <select
            aria-label="Send to map"
            className={inputClass}
            value=""
            onChange={(event) => {
              const map = event.target.value;
              if (!map) return;
              // To the middle of the other map, to be moved there.
              send([{ type: "move", id: token.id, to: [0.5, 0.5], map }]);
              onClose();
            }}
          >
            <option value="">Send to map…</option>
            {tools.otherMaps.map((each) => (
              <option key={each.id} value={each.id}>
                {each.name}
              </option>
            ))}
          </select>
        )}
        {marker && (
          <button
            type="button"
            className={buttonClass}
            title="Off the map, but kept in the Tokens tab to place again"
            onClick={() => {
              send([{ type: "setAside", id: token.id }]);
              onClose();
            }}
          >
            Set aside
          </button>
        )}
        <button
          type="button"
          className={buttonClass}
          onClick={() => {
            send([{ type: "remove", id: token.id }]);
            onClose();
          }}
        >
          {marker ? "Remove" : "Take off this map"}
        </button>
      </div>
      {children}
    </section>
  );
}

/** An NPC or marker's own settings, each sent as it's changed. */
function MarkerFields({
  token,
  tools,
  send,
}: {
  token: TokenView;
  tools: TokenTools;
  send: (actions: TokenAction[]) => void;
}) {
  const [name, setName] = useState(token.name);
  const [changingNote, setChangingNote] = useState(false);
  const settings = token.marker ?? {};
  const note = tools.notes.find((each) => each.id === settings.note);
  const edit = (change: Omit<Extract<TokenAction, { type: "editMarker" }>, "type" | "id">) =>
    send([{ type: "editMarker", id: token.id, ...change }]);
  const saveName = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== token.name) edit({ name: trimmed });
  };

  return (
    <>
      <label className="flex flex-col gap-1">
        <span className="font-medium">Name players see</span>
        <input
          className={inputClass}
          value={name}
          maxLength={MARKER_NAME_MAX}
          onChange={(event) => setName(event.target.value)}
          onBlur={saveName}
          onKeyDown={(event) => {
            if (event.key === "Enter") saveName();
          }}
        />
      </label>
      <div className="flex items-center gap-2">
        <span className={labelClass}>Note</span>
        <span className="mr-auto truncate">
          {note ? (
            <a href={noteUrl(note.slug)} target="_blank" rel="noreferrer" className="underline">
              {note.title} ↗
            </a>
          ) : settings.note ? (
            <span className="text-danger">no longer in the vault</span>
          ) : (
            <span className="text-muted">none</span>
          )}
        </span>
        <button
          type="button"
          className="text-muted hover:underline"
          aria-expanded={changingNote}
          onClick={() => setChangingNote(!changingNote)}
        >
          {settings.note ? "Change" : "Link a note"}
        </button>
        {settings.note && (
          <button
            type="button"
            className="text-muted hover:underline"
            onClick={() =>
              edit({ note: null, ...(settings.picture === "note" && { picture: null }) })
            }
          >
            Unlink
          </button>
        )}
      </div>
      {changingNote && (
        <NotePicker
          label="Linked note (only you see it)"
          notes={tools.notes}
          value={note?.slug ?? ""}
          onChange={(slug) => {
            const picked = tools.notes.find((each) => each.slug === slug);
            if (!picked) return;
            edit({ note: picked.id });
            setChangingNote(false);
          }}
        />
      )}
      <TokenLook
        look={{ picture: settings.picture, icon: settings.icon, colour: token.colour ?? "red" }}
        noteImage={note?.imageUrl}
        onChange={(look) =>
          edit({
            colour: look.colour,
            picture: look.picture ?? null,
            ...(look.icon && { icon: look.icon }),
          })
        }
      />
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={token.visibility === "players"}
          onChange={(event) => edit({ visibility: event.target.checked ? "players" : "dm" })}
        />
        Players can see it (where it&rsquo;s revealed)
      </label>
    </>
  );
}
