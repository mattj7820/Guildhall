// PROTOTYPE (removed before the PR): the DM's side panel in tabs (Map │ Tokens │ Fight), with
// NPC tokens from vault notes, icon markers, numbering, one-click show and hide, and moving
// between maps. The map, its party and its tokens are real; everything else is pretend, and
// nothing is saved.
import { useMemo, useState } from "react";
import { ClickCatcher } from "~/components/maps/ClickCatcher";
import { GridLayer } from "~/components/maps/GridLayer";
import { MapCanvas } from "~/components/maps/MapCanvas";
import { NotePanel } from "~/components/maps/NotePanel";
import { NotePicker } from "~/components/maps/NotePicker";
import { TokenLayer } from "~/components/maps/TokenLayer";
import {
  buttonClass,
  iconButtonClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from "~/components/styles";
import { newId } from "~/shared/ids";
import { guessTokenIcon, tokenIcon } from "~/maps/tokens/icons";
import { numberedNames } from "~/maps/tokens/naming";
import { MARKER_NAME_MAX } from "~/maps/tokens/schema";
import { TOKEN_ICONS } from "~/maps/tokens/token-icons";
import {
  MARKER_COLOURS,
  SIZE_NAMES,
  TOKEN_SIZES,
  type MarkerColour,
  type PartyPlacement,
  type TokenSize,
  type TokenView,
} from "~/maps/tokens/types";
import type { MapView, Point } from "~/maps/types";
import { normalise } from "~/maps/geometry";

interface ProtoNote {
  id: string;
  slug: string;
  title: string;
  npc: boolean;
  imageUrl?: string;
}

type Picture = "note" | "icon" | "initials";

/** A pretend NPC or marker, as the real model would store it. */
interface ProtoToken {
  id: string;
  at: Point;
  size: TokenSize;
  name: string;
  note?: string;
  picture: Picture;
  icon?: string;
  colour: MarkerColour;
  shown: boolean;
}

interface ProtoElsewhere extends ProtoToken {
  mapName: string;
}

interface Placing {
  tokens: Omit<ProtoToken, "id" | "at">[];
  /** Brought from another map. */
  from?: string;
}

type Tab = "map" | "tokens" | "fight";

const COLOUR_SWATCHES: Record<MarkerColour, string> = {
  red: "bg-red-600",
  orange: "bg-orange-500",
  yellow: "bg-yellow-400",
  green: "bg-green-600",
  teal: "bg-teal-600",
  blue: "bg-blue-600",
  purple: "bg-purple-600",
  grey: "bg-stone-500",
};

export function TokensPrototype({
  map,
  tokens: realTokens,
  party,
  notes,
  otherMaps,
}: {
  map: MapView;
  tokens: TokenView[];
  party: PartyPlacement[];
  notes: ProtoNote[];
  otherMaps: { id: string; name: string }[];
}) {
  const firstNpc = notes.find((note) => note.npc && note.imageUrl) ?? notes.find((n) => n.npc);
  const [npcs, setNpcs] = useState<ProtoToken[]>(() => [
    ...(firstNpc
      ? [
          {
            id: "demo-npc",
            at: [0.42, 0.45] as Point,
            size: 1 as TokenSize,
            name: firstNpc.title,
            note: firstNpc.id,
            picture: firstNpc.imageUrl ? ("note" as const) : ("initials" as const),
            colour: "teal" as const,
            shown: true,
          },
        ]
      : []),
    {
      id: "demo-hooded",
      at: [0.55, 0.5],
      size: 1,
      name: "Hooded figure",
      note: notes.find((note) => note.npc && note.id !== firstNpc?.id)?.id,
      picture: "icon",
      icon: "hood",
      colour: "purple",
      shown: false,
    },
    {
      id: "demo-chest",
      at: [0.6, 0.38],
      size: 1,
      name: "Chest",
      picture: "icon",
      icon: "chest",
      colour: "yellow",
      shown: false,
    },
  ]);
  const [elsewhere, setElsewhere] = useState<ProtoElsewhere[]>(() =>
    otherMaps.slice(0, 2).map((other, index) => ({
      id: `elsewhere-${index}`,
      at: [0.5, 0.5],
      size: 1,
      name: index === 0 ? "Innkeeper" : "Merchant's cart",
      picture: "icon",
      icon: index === 0 ? "tavern" : "cart",
      colour: index === 0 ? "orange" : "grey",
      shown: true,
      mapName: other.name,
    })),
  );
  const [moved, setMoved] = useState<Record<string, Point>>({});
  const [tab, setTab] = useState<Tab>("tokens");
  const [folded, setFolded] = useState(false);
  const [fighting, setFighting] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [selectedId, setSelectedId] = useState<string>();
  const [placing, setPlacing] = useState<Placing>();
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState<string>();

  const noteById = (id?: string) => notes.find((note) => note.id === id);
  const view = (token: ProtoToken): TokenView => {
    const note = noteById(token.note);
    return {
      id: token.id,
      kind: "marker",
      at: moved[token.id] ?? token.at,
      size: token.size,
      name: token.name,
      colour: token.colour,
      ...(token.picture === "note" && note?.imageUrl && { portraitUrl: note.imageUrl }),
      ...(token.picture === "icon" && token.icon && { icon: token.icon }),
      movable: true,
      ...(!token.shown && { hidden: "secret" as const }),
    };
  };
  const views = [
    ...realTokens.map((token) => ({ ...token, at: moved[token.id] ?? token.at })),
    ...npcs.map(view),
  ];
  const shownViews = presenting ? views.filter((token) => !token.hidden) : views;
  const selectedNpc = npcs.find((token) => token.id === selectedId);
  const selectedReal = realTokens.find((token) => token.id === selectedId);

  const update = (id: string, change: Partial<ProtoToken>) =>
    setNpcs((all) => all.map((token) => (token.id === id ? { ...token, ...change } : token)));
  const say = (text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(undefined), 2500);
  };

  function place(point: [number, number], scale: number) {
    if (!placing) return;
    const at = normalise(point[0], point[1], map.size);
    const step = map.grid ? map.grid.square : (15 * 4.5) / scale / map.size.width;
    const first = at[0] - step * Math.floor((placing.tokens.length - 1) / 2);
    const placed = placing.tokens.map((token, index): ProtoToken => ({
      ...token,
      id: placing.from ?? newId(),
      at: [Math.min(1, Math.max(0, first + step * index)), at[1]],
    }));
    setNpcs((all) => [...all, ...placed]);
    if (placing.from) setElsewhere((all) => all.filter((each) => each.id !== placing.from));
    if (placed.length === 1) setSelectedId(placed[0].id);
    setPlacing(undefined);
  }

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: "map", label: "Map", icon: "▦" },
    { key: "tokens", label: "Tokens", icon: "◉" },
    ...(fighting ? [{ key: "fight" as const, label: "Fight", icon: "⚔" }] : []),
  ];

  return (
    <main className="flex h-[calc(100dvh-3.5rem)] flex-col">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm dark:border-amber-800 dark:bg-amber-950/40">
        <strong>Prototype</strong>
        <span className="text-stone-600 dark:text-stone-400">
          {map.name}: party and existing tokens are real; NPCs are pretend; nothing is saved.
        </span>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={fighting}
            onChange={() => {
              setFighting(!fighting);
              setTab(fighting ? "tokens" : "fight");
            }}
          />
          Pretend fight
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={presenting} onChange={() => setPresenting(!presenting)} />
          Show what players see
        </label>
      </div>
      <div className="flex min-h-0 flex-1 flex-col bg-stone-50 md:flex-row dark:bg-stone-950">
        <div className="relative flex min-h-[50vh] min-w-0 flex-1">
          {toast && (
            <p
              role="status"
              className="absolute top-3 left-1/2 z-10 -translate-x-1/2 rounded bg-stone-900 px-3 py-1 text-sm text-white shadow"
            >
              {toast}
            </p>
          )}
          <MapCanvas name={map.name} size={map.size} imageUrl={map.image.url} className="flex-1">
            {(canvas) => (
              <>
                {map.grid && <GridLayer grid={map.grid} size={map.size} />}
                <TokenLayer
                  tokens={shownViews}
                  size={map.size}
                  canvas={canvas}
                  grid={map.grid}
                  snap={map.snapToGrid}
                  selectedId={presenting ? undefined : selectedId}
                  onSelect={(token) => {
                    setSelectedId(token.id);
                    setTab("tokens");
                    setFolded(false);
                  }}
                  mover={{
                    drag: (id, at) => setMoved((all) => ({ ...all, [id]: at })),
                    drop: (id, at) => setMoved((all) => ({ ...all, [id]: at })),
                    cancel: () => undefined,
                  }}
                />
                {placing && (
                  <ClickCatcher
                    size={map.size}
                    canvas={canvas}
                    label="Place the tokens"
                    onPoint={place}
                  />
                )}
              </>
            )}
          </MapCanvas>
        </div>

        {folded ? (
          <nav
            aria-label="Side panel"
            className="flex flex-row gap-1 border-stone-200 p-1 md:flex-col md:border-l dark:border-stone-800"
          >
            {TABS.map(({ key, label, icon }) => (
              <button
                key={key}
                type="button"
                aria-label={label}
                title={label}
                onClick={() => {
                  setTab(key);
                  setFolded(false);
                }}
                className="h-10 w-10 rounded text-lg hover:bg-stone-200 dark:hover:bg-stone-800"
              >
                {icon}
              </button>
            ))}
          </nav>
        ) : (
          <aside
            aria-label="Side panel"
            className="flex w-full flex-col border-stone-200 md:w-[26rem] md:shrink-0 md:border-l dark:border-stone-800"
          >
            <div className="flex items-center gap-1 border-b border-stone-200 px-2 pt-2 dark:border-stone-800">
              <div role="tablist" aria-label="Side panel" className="flex gap-1">
                {TABS.map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={tab === key}
                    onClick={() => setTab(key)}
                    className={`rounded-t-md px-3 py-1.5 text-sm ${
                      tab === key
                        ? "-mb-px border border-b-0 border-stone-200 bg-white font-semibold dark:border-stone-800 dark:bg-stone-900"
                        : "text-stone-500 hover:text-stone-900 dark:hover:text-stone-100"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                aria-label="Fold the panel away"
                title="Fold away"
                className={`${iconButtonClass} mb-1 ml-auto`}
                onClick={() => setFolded(true)}
              >
                ⇥
              </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
              {placing && (
                <p
                  role="status"
                  className="rounded bg-sky-50 px-2 py-1 text-sm text-sky-900 dark:bg-sky-950 dark:text-sky-100"
                >
                  Click the map to place{" "}
                  {placing.tokens.length === 1
                    ? placing.tokens[0].name
                    : `${placing.tokens[0].name} to ${placing.tokens.at(-1)?.name}`}
                  .{" "}
                  <button type="button" className="underline" onClick={() => setPlacing(undefined)}>
                    Cancel
                  </button>
                </p>
              )}
              {tab === "map" && (
                <>
                  {map.note ? (
                    <NotePanel note={map.note} />
                  ) : (
                    <p className="text-sm text-stone-500">This map has no note.</p>
                  )}
                  <p className="text-sm text-stone-500">
                    (The map&rsquo;s areas list stays here, as today.)
                  </p>
                </>
              )}
              {tab === "fight" && (
                <p className="text-sm text-stone-500">
                  The tracker goes here while the fight is open, as today. Flip to Tokens to drop in
                  an NPC mid-fight, and back.
                </p>
              )}
              {tab === "tokens" && (
                <>
                  <PartySection party={party} tokens={realTokens} mapId={map.id} say={say} />

                  <section aria-labelledby="proto-on-map" className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <h2 id="proto-on-map" className={`${labelClass} mr-auto`}>
                        On this map
                      </h2>
                      {!adding && (
                        <button
                          type="button"
                          className={buttonClass}
                          onClick={() => setAdding(true)}
                        >
                          Add
                        </button>
                      )}
                    </div>
                    {adding && (
                      <AddForm
                        notes={notes}
                        existing={npcs.map((token) => token.name)}
                        onCancel={() => setAdding(false)}
                        onPlace={(tokens) => {
                          setAdding(false);
                          setPlacing({ tokens });
                        }}
                      />
                    )}
                    {npcs.length === 0 && !adding && (
                      <p className="text-sm text-stone-500">No NPCs or markers here yet.</p>
                    )}
                    <ul aria-label="On this map" className="flex flex-col text-sm">
                      {[...npcs]
                        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
                        .map((token) => (
                          <li
                            key={token.id}
                            className={`flex items-center gap-2 rounded px-1 py-0.5 ${
                              token.id === selectedId ? "bg-sky-100 dark:bg-sky-950" : ""
                            }`}
                          >
                            <Face token={view(token)} />
                            <button
                              type="button"
                              className="mr-auto truncate text-left hover:underline"
                              onClick={() => setSelectedId(token.id)}
                            >
                              {token.name}
                              {token.note && noteById(token.note)?.title !== token.name && (
                                <span className="ml-1 text-xs text-stone-500">
                                  ({noteById(token.note)?.title})
                                </span>
                              )}
                            </button>
                            <button
                              type="button"
                              aria-label={token.shown ? `Hide ${token.name}` : `Show ${token.name}`}
                              aria-pressed={token.shown}
                              title={
                                token.shown
                                  ? "Players can see it where it's revealed. Click to hide."
                                  : "DM only. Click to show players."
                              }
                              className={`${iconButtonClass} ${token.shown ? "" : "opacity-50"}`}
                              onClick={() => update(token.id, { shown: !token.shown })}
                            >
                              {token.shown ? "👁" : "⊘"}
                            </button>
                          </li>
                        ))}
                    </ul>
                  </section>

                  {elsewhere.length > 0 && (
                    <details className="text-sm">
                      <summary className={`${labelClass} cursor-pointer`}>
                        Elsewhere ({elsewhere.length})
                      </summary>
                      <ul aria-label="Elsewhere" className="mt-1 flex flex-col gap-1">
                        {elsewhere.map((token) => (
                          <li key={token.id} className="flex items-center gap-2">
                            <Face token={view(token)} />
                            <span className="mr-auto truncate">
                              {token.name}{" "}
                              <span className="text-xs text-stone-500">on {token.mapName}</span>
                            </span>
                            <button
                              type="button"
                              className={buttonClass}
                              onClick={() => {
                                const { id, mapName: _, at: __, ...rest } = token;
                                setPlacing({ tokens: [rest], from: id });
                              }}
                            >
                              Bring here
                            </button>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}

                  {selectedNpc && (
                    <TokenSettings
                      key={selectedNpc.id}
                      token={selectedNpc}
                      note={noteById(selectedNpc.note)}
                      notes={notes}
                      otherMaps={otherMaps}
                      onChange={(change) => update(selectedNpc.id, change)}
                      onClose={() => setSelectedId(undefined)}
                      onRemove={() => {
                        setNpcs((all) => all.filter((token) => token.id !== selectedNpc.id));
                        setSelectedId(undefined);
                      }}
                      onSend={(target) => {
                        setNpcs((all) => all.filter((token) => token.id !== selectedNpc.id));
                        setElsewhere((all) => [...all, { ...selectedNpc, mapName: target.name }]);
                        setSelectedId(undefined);
                        say(`${selectedNpc.name} is now on ${target.name}, in the middle.`);
                      }}
                    />
                  )}
                  {selectedReal && (
                    <section className="rounded-md border border-stone-200 p-3 text-sm dark:border-stone-800">
                      <strong>{selectedReal.name}</strong>: the chosen token&rsquo;s settings as
                      today (size, distances, take off this map), plus Send to map.
                    </section>
                  )}
                </>
              )}
            </div>
          </aside>
        )}
      </div>
    </main>
  );
}

function PartySection({
  party,
  tokens,
  mapId,
  say,
}: {
  party: PartyPlacement[];
  tokens: TokenView[];
  mapId: string;
  say: (text: string) => void;
}) {
  return (
    <section aria-labelledby="proto-party" className="flex flex-col gap-1">
      <h2 id="proto-party" className={labelClass}>
        Party
      </h2>
      <ul aria-label="Party" className="flex flex-col gap-1 text-sm">
        {party.map((member) => {
          const here = tokens.find((token) => token.note === member.note);
          const elsewhere = !here && member.on && member.on.id !== mapId ? member.on : undefined;
          return (
            <li key={member.note} className="flex items-center gap-2">
              <Face
                token={{
                  id: member.note,
                  kind: "character",
                  at: [0, 0],
                  size: 1,
                  name: member.name,
                  movable: false,
                  ...(member.portraitUrl && { portraitUrl: member.portraitUrl }),
                }}
              />
              <span className="mr-auto">
                {member.name}{" "}
                <span className="text-xs text-stone-500">
                  {here ? "here" : elsewhere ? `on ${elsewhere.name}` : "not placed"}
                </span>
              </span>
              <button
                type="button"
                className={buttonClass}
                onClick={() => say("As today: Find, Place, Bring here, Take off this map.")}
              >
                {here ? "Find" : elsewhere ? "Bring here" : "Place"}
              </button>
            </li>
          );
        })}
      </ul>
      {party.length > 1 && (
        <button
          type="button"
          className={`${buttonClass} self-start`}
          onClick={() => say("As today: the whole party, side by side.")}
        >
          Bring everyone here
        </button>
      )}
    </section>
  );
}

/** A token's face in a list: what's drawn on the map, small. */
function Face({ token }: { token: TokenView }) {
  const icon = tokenIcon(token.icon);
  const fill = token.colour ? COLOUR_SWATCHES[token.colour] : "bg-stone-700";
  return (
    <span
      aria-hidden="true"
      className={`flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-stone-900 ${fill}`}
    >
      {token.portraitUrl ? (
        <img src={token.portraitUrl} alt="" className="h-full w-full object-cover" />
      ) : icon ? (
        <svg viewBox="0 0 512 512" className="h-5 w-5">
          <path d={icon.path} className="fill-white" />
        </svg>
      ) : (
        <span className="font-serif text-xs font-bold text-white">
          {token.name.charAt(0).toUpperCase()}
        </span>
      )}
    </span>
  );
}

interface Look {
  picture: Picture;
  icon?: string;
  colour: MarkerColour;
}

function LookFields({
  look,
  noteImage,
  onChange,
}: {
  look: Look;
  noteImage?: string;
  onChange: (look: Look) => void;
}) {
  const [picking, setPicking] = useState(false);
  const icon = tokenIcon(look.icon);
  return (
    <div className="flex flex-col gap-2">
      <fieldset className="flex flex-wrap items-center gap-3">
        <legend className={`${labelClass} mb-1`}>Picture</legend>
        <label className="flex items-center gap-1">
          <input
            type="radio"
            checked={look.picture === "note"}
            disabled={!noteImage}
            onChange={() => onChange({ ...look, picture: "note" })}
          />
          Note&rsquo;s picture
          {noteImage && (
            <img src={noteImage} alt="" className="h-6 w-6 rounded-full object-cover" />
          )}
        </label>
        <label className="flex items-center gap-1">
          <input
            type="radio"
            checked={look.picture === "icon"}
            onChange={() => {
              onChange({ ...look, picture: "icon", icon: look.icon ?? "person" });
              setPicking(true);
            }}
          />
          Icon
          {icon && (
            <button type="button" className="ml-1 underline" onClick={() => setPicking(!picking)}>
              {icon.label} ▾
            </button>
          )}
        </label>
        <label className="flex items-center gap-1">
          <input
            type="radio"
            checked={look.picture === "initials"}
            onChange={() => onChange({ ...look, picture: "initials" })}
          />
          Initials
        </label>
      </fieldset>
      {picking && look.picture === "icon" && (
        <div
          role="listbox"
          aria-label="Icons"
          className="grid max-h-40 grid-cols-8 gap-1 overflow-y-auto rounded border border-stone-200 p-1 dark:border-stone-800"
        >
          {TOKEN_ICONS.map((each) => (
            <button
              key={each.id}
              type="button"
              role="option"
              aria-selected={each.id === look.icon}
              title={each.label}
              onClick={() => {
                onChange({ ...look, picture: "icon", icon: each.id });
                setPicking(false);
              }}
              className={`flex h-8 w-8 items-center justify-center rounded ${COLOUR_SWATCHES[look.colour]} ${
                each.id === look.icon ? "ring-2 ring-sky-500" : "opacity-80 hover:opacity-100"
              }`}
            >
              <svg viewBox="0 0 512 512" className="h-5 w-5">
                <path d={each.path} className="fill-white" />
              </svg>
            </button>
          ))}
        </div>
      )}
      <fieldset className="flex flex-wrap items-center gap-1">
        <legend className={`${labelClass} mb-1`}>Colour</legend>
        {MARKER_COLOURS.map((colour) => (
          <button
            key={colour}
            type="button"
            aria-label={colour}
            aria-pressed={look.colour === colour}
            onClick={() => onChange({ ...look, colour })}
            className={`h-6 w-6 rounded-full ${COLOUR_SWATCHES[colour]} ${
              look.colour === colour ? "ring-2 ring-sky-500 ring-offset-1" : ""
            }`}
          />
        ))}
      </fieldset>
    </div>
  );
}

function AddForm({
  notes,
  existing,
  onPlace,
  onCancel,
}: {
  notes: ProtoNote[];
  existing: string[];
  onPlace: (tokens: Omit<ProtoToken, "id" | "at">[]) => void;
  onCancel: () => void;
}) {
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [count, setCount] = useState(1);
  const [shown, setShown] = useState(false);
  const [look, setLook] = useState<Look>({ picture: "initials", colour: "red" });
  const note = notes.find((each) => each.slug === slug);
  // NPC notes first in the suggestions.
  const sorted = useMemo(() => [...notes].sort((a, b) => Number(b.npc) - Number(a.npc)), [notes]);
  const names = numberedNames(name || "Marker", count, existing);

  return (
    <form
      aria-label="New token"
      className="flex flex-col gap-2 rounded-md border border-stone-200 p-3 text-sm dark:border-stone-800"
      onSubmit={(event) => {
        event.preventDefault();
        if (!name.trim()) return;
        onPlace(
          names.map((each) => ({
            name: each,
            note: note?.id,
            size: 1,
            shown,
            ...look,
          })),
        );
      }}
    >
      <NotePicker
        label="Note (optional)"
        notes={sorted}
        value={slug}
        onChange={(value) => {
          setSlug(value);
          const picked = notes.find((each) => each.slug === value);
          if (!picked) return;
          setName(picked.title);
          const guess = guessTokenIcon(picked.title);
          setLook(
            picked.imageUrl
              ? { ...look, picture: "note" }
              : guess
                ? { ...look, picture: "icon", icon: guess }
                : { ...look, picture: "initials" },
          );
        }}
      />
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
              // A marker with no note: suggest an icon from its name.
              if (note || look.picture !== "initials") return;
              const guess = guessTokenIcon(name);
              if (guess) setLook({ ...look, picture: "icon", icon: guess });
            }}
          />
        </label>
        <label className="flex w-16 flex-col gap-1">
          <span className="font-medium">How many</span>
          <input
            type="number"
            min={1}
            max={20}
            className={inputClass}
            value={count}
            onChange={(event) =>
              setCount(Math.max(1, Math.min(20, Number(event.target.value) || 1)))
            }
          />
        </label>
      </div>
      {count > 1 && name.trim() && (
        <p className="text-xs text-stone-500">
          {names[0]} to {names.at(-1)}
        </p>
      )}
      <LookFields look={look} noteImage={note?.imageUrl} onChange={setLook} />
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

function TokenSettings({
  token,
  note,
  notes,
  otherMaps,
  onChange,
  onClose,
  onRemove,
  onSend,
}: {
  token: ProtoToken;
  note?: ProtoNote;
  notes: ProtoNote[];
  otherMaps: { id: string; name: string }[];
  onChange: (change: Partial<ProtoToken>) => void;
  onClose: () => void;
  onRemove: () => void;
  onSend: (map: { id: string; name: string }) => void;
}) {
  const [name, setName] = useState(token.name);
  const [changingNote, setChangingNote] = useState(false);
  return (
    <section
      aria-label={`Token: ${token.name}`}
      className="flex flex-col gap-2 rounded-md border border-stone-200 p-3 text-sm dark:border-stone-800"
    >
      <div className="flex items-baseline gap-2">
        <h3 className="mr-auto font-serif text-lg font-bold">{token.name}</h3>
        <button type="button" onClick={onClose} className="text-stone-500 hover:underline">
          Close
        </button>
      </div>
      <label className="flex flex-col gap-1">
        <span className="font-medium">Name players see</span>
        <input
          className={inputClass}
          value={name}
          maxLength={MARKER_NAME_MAX}
          onChange={(event) => setName(event.target.value)}
          onBlur={() => name.trim() && onChange({ name: name.trim() })}
        />
      </label>
      <div className="flex items-center gap-2">
        <span className={labelClass}>Note</span>
        <span className="mr-auto truncate">
          {note ? (
            <>
              <a href={`/wiki/${note.slug}`} className="underline" target="_blank" rel="noreferrer">
                {note.title} ↗
              </a>{" "}
              <span className="text-xs text-stone-500">(only you see this)</span>
            </>
          ) : (
            <span className="text-stone-500">none</span>
          )}
        </span>
        <button
          type="button"
          className="text-stone-500 hover:underline"
          onClick={() => setChangingNote(!changingNote)}
        >
          Change
        </button>
      </div>
      {changingNote && (
        <NotePicker
          label="Linked note"
          notes={notes}
          value={note?.slug ?? ""}
          onChange={(slug) => {
            const picked = notes.find((each) => each.slug === slug);
            if (picked) {
              onChange({ note: picked.id });
              setChangingNote(false);
            }
          }}
        />
      )}
      <LookFields look={token} noteImage={note?.imageUrl} onChange={(look) => onChange(look)} />
      <label className="flex items-center gap-2">
        <span className={labelClass}>Size</span>
        <select
          className={inputClass}
          value={token.size}
          onChange={(event) => onChange({ size: Number(event.target.value) as TokenSize })}
        >
          {TOKEN_SIZES.map((size) => (
            <option key={size} value={size}>
              {SIZE_NAMES[size]} ({size} × {size} squares)
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={token.shown}
          onChange={() => onChange({ shown: !token.shown })}
        />
        Players can see it (where it&rsquo;s revealed)
      </label>
      <div className="flex flex-wrap gap-2">
        {otherMaps.length > 0 && (
          <select
            aria-label="Send to map"
            className={inputClass}
            value=""
            onChange={(event) => {
              const target = otherMaps.find((each) => each.id === event.target.value);
              if (target) onSend(target);
            }}
          >
            <option value="">Send to map…</option>
            {otherMaps.map((each) => (
              <option key={each.id} value={each.id}>
                {each.name}
              </option>
            ))}
          </select>
        )}
        <button type="button" className={buttonClass} onClick={onRemove}>
          Remove
        </button>
      </div>
    </section>
  );
}
