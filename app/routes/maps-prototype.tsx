/**
 * PROTOTYPE (deleted once the look is chosen): the Maps page in three layouts and areas on a map
 * in five styles, with switches, in the real themes. DM only. Thumbnails here are the DM's whole
 * images shrunk by the browser; the real ones will be made on the server, fog-safe for players.
 */
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { loadMapView, mapSource } from "~/.server/maps/load";
import { loadMapTokens, whereabouts } from "~/.server/maps/tokens";
import { requireDm } from "~/.server/not-found";
import { MapCanvas } from "~/components/maps/MapCanvas";
import {
  AREA_STYLES,
  PrototypeArea,
  type AreaStyle,
} from "~/components/maps/prototype/PrototypeAreas";
import { buttonClass, labelClass, panelClass, primaryButtonClass } from "~/components/styles";
import { servicesContext, viewerContext } from "~/context";
import { labelPoint } from "~/maps/geometry";
import { ancestors, mapTree, type MapTreeNode } from "~/maps/tree";
import type { PartyFace } from "~/maps/tokens/types";
import type { AreaView } from "~/maps/types";
import { mapEditUrl, mapImageUrl, mapUrl } from "~/maps/urls";
import { THEME_INFO, THEMES, type Theme } from "~/theme/themes";
import type { Route } from "./+types/maps-prototype";

export function meta() {
  return [{ title: "Maps prototype · Guildhall" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const viewer = context.get(viewerContext);
  requireDm(viewer);
  const services = context.get(servicesContext);
  const all = await services.maps.list();
  const party = await whereabouts(services, viewer);
  const list = await Promise.all(
    all.map(async (map) => {
      const source = await mapSource(services, map);
      return {
        id: map.id,
        name: map.name,
        shared: map.visibility === "players",
        areas: map.areas.map(({ id, name, map: child }) => ({ id, name, map: child })),
        size: { width: map.image.width, height: map.image.height },
        // Where each map inside this one is, as fractions of the image: its area's label point.
        pins: map.areas.flatMap((area) =>
          area.map
            ? [{ map: area.map, at: labelPoint(area.outline, { width: 1, height: 1 }) }]
            : [],
        ),
        thumbnail: source ? mapImageUrl(map.id, source.version) : undefined,
      };
    }),
  );
  // Who's on each map or anywhere inside it.
  const faces: Record<string, PartyFace[]> = {};
  for (const member of party) {
    if (!member.map) continue;
    const face = { name: member.name, portraitUrl: member.portraitUrl };
    for (const on of [member.map.id, ...ancestors(member.map.id, list).map((each) => each.id)]) {
      (faces[on] ??= []).push(face);
    }
  }

  const wanted = new URL(request.url).searchParams.get("map");
  const chosen =
    all.find((map) => map.id === wanted) ??
    [...all].sort((a, b) => b.areas.length - a.areas.length)[0];
  const view = chosen && (await loadMapView(services, chosen, all, viewer));
  const inside = chosen ? (await loadMapTokens(services, chosen, viewer)).inside : [];
  return { tree: mapTree(list), party, faces, view, inside };
}

type Data = Route.ComponentProps["loaderData"];
type Listed = Data["tree"][number]["map"];
type Node = MapTreeNode<Listed>;

export default function MapsPrototype({ loaderData }: Route.ComponentProps) {
  const [style, setStyle] = useState<AreaStyle>("pins");
  const [player, setPlayer] = useState(false);
  const [theme, setTheme] = useState<Theme | "">("");

  useEffect(() => {
    if (theme) document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6">
      <div className={`${panelClass} flex flex-col gap-2`}>
        <p className="text-sm text-muted">
          Prototype: the Maps page as a list with a preview, and areas on a map. Thumbnails here are
          your whole images shrunk by the browser (slow); the real ones will be small and fog-safe.
        </p>
        <Choice label="Theme" value={theme} options={themeOptions} onChange={setTheme} />
        <Choice label="Areas" value={style} options={AREA_STYLES} onChange={setStyle} />
        <Choice
          label="Look as"
          value={player ? "player" : "dm"}
          options={{ dm: "DM", player: "A player (shared maps, one area style)" }}
          onChange={(value) => setPlayer(value === "player")}
        />
      </div>

      <MapsPage data={loaderData} player={player} />
      {loaderData.view && (
        <AreasOnAMap data={loaderData} view={loaderData.view} style={style} player={player} />
      )}
    </main>
  );
}

const themeOptions = {
  "": "My own",
  ...Object.fromEntries(THEMES.map((theme) => [theme, THEME_INFO[theme].label])),
} as Record<Theme | "", string>;

function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Record<T, string>;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="flex flex-wrap items-center gap-2">
      <legend className={`${labelClass} float-left mr-2 w-24`}>{label}</legend>
      {(Object.keys(options) as T[]).map((key) => (
        <button
          key={key}
          type="button"
          aria-pressed={value === key}
          className={value === key ? primaryButtonClass : buttonClass}
          onClick={() => onChange(key)}
        >
          {options[key]}
        </button>
      ))}
    </fieldset>
  );
}

/* The Maps page: every map's name in a nested list, and a preview with pins for what's inside */

function onlyShared(nodes: Node[]): Node[] {
  // A player sees shared maps, nested as shared maps lead to each other.
  return nodes.flatMap((node) =>
    node.map.shared
      ? [{ map: node.map, children: onlyShared(node.children) }]
      : onlyShared(node.children),
  );
}

interface Entry {
  node: Node;
  /** Its ancestors, outermost first. */
  path: Listed[];
}

function entriesOf(tree: Node[]): Map<string, Entry> {
  const entries = new Map<string, Entry>();
  const walk = (nodes: Node[], path: Listed[]) => {
    for (const node of nodes) {
      entries.set(node.map.id, { node, path });
      walk(node.children, [...path, node.map]);
    }
  };
  walk(tree, []);
  return entries;
}

function MapsPage({ data, player }: { data: Data; player: boolean }) {
  const tree = player ? onlyShared(data.tree) : data.tree;
  const entries = entriesOf(tree);
  const partyMap = data.party.find((member) => member.map && entries.has(member.map.id))?.map?.id;
  const [previewId, setPreviewId] = useState(partyMap ?? tree[0]?.map.id);
  const shown = (previewId && entries.get(previewId)) || entries.values().next().value;
  const faces = (id: string) => data.faces[id] ?? [];
  // Touch has no hover: the first tap on a name previews it, the second opens it.
  const pointer = useRef("mouse");
  const list = { previewId, onPreview: setPreviewId, pointer, faces, player };

  return (
    <section aria-label="Maps page" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto font-serif text-3xl font-bold">Maps</h1>
        {!player && (
          <button type="button" className={primaryButtonClass}>
            New map
          </button>
        )}
      </div>
      <PartyLine data={data} onPreview={setPreviewId} />
      {shown ? (
        <div className="grid items-start gap-4 md:grid-cols-[minmax(14rem,20rem)_minmax(0,1fr)]">
          <nav aria-label="All maps" className={`${panelClass} p-2`}>
            <MapList nodes={tree} {...list} />
          </nav>
          <Preview
            entry={shown}
            entries={entries}
            faces={faces}
            player={player}
            onPreview={setPreviewId}
          />
        </div>
      ) : (
        <p className={panelClass}>No maps yet.</p>
      )}
    </section>
  );
}

/** "Where the party is" on one line; a name previews their map. */
function PartyLine({ data, onPreview }: { data: Data; onPreview: (id: string) => void }) {
  if (data.party.length === 0) return null;
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
      <span className={labelClass}>Where the party is</span>
      {data.party.map((member) => (
        <span key={member.name} className="flex items-center gap-1.5">
          <Face face={member} />
          <span className="font-semibold">{member.name}</span>{" "}
          {member.map ? (
            <Link
              to={mapUrl(member.map.id)}
              className="text-link hover:underline"
              onPointerEnter={() => onPreview(member.map!.id)}
              onFocus={() => onPreview(member.map!.id)}
            >
              {member.map.name}
            </Link>
          ) : (
            <span className="text-muted">not on a map yet</span>
          )}
        </span>
      ))}
    </p>
  );
}

interface ListProps {
  previewId?: string;
  onPreview: (id: string) => void;
  pointer: { current: string };
  faces: (id: string) => PartyFace[];
  player: boolean;
}

function MapList({ nodes, ...props }: ListProps & { nodes: Node[] }) {
  const { previewId, onPreview, pointer, faces, player } = props;
  return (
    <ul className="flex flex-col [&_ul]:ml-3 [&_ul]:border-l [&_ul]:border-line [&_ul]:pl-1.5">
      {nodes.map(({ map, children }) => {
        const previewed = map.id === previewId;
        return (
          <li key={map.id}>
            <div
              className={`group flex items-center gap-2 rounded-md px-2 py-1 ${
                previewed ? "bg-raised" : "hover:bg-raised"
              }`}
            >
              <Link
                to={mapUrl(map.id)}
                className={`mr-auto truncate ${previewed ? "font-semibold text-title" : ""}`}
                onPointerEnter={() => onPreview(map.id)}
                onFocus={() => onPreview(map.id)}
                onPointerDown={(event) => (pointer.current = event.pointerType)}
                onClick={(event) => {
                  if (pointer.current !== "touch" || previewed) return;
                  event.preventDefault();
                  onPreview(map.id);
                }}
              >
                {map.name}
              </Link>
              <Faces faces={faces(map.id)} size={18} />
              {!player && (
                <Link
                  to={mapEditUrl(map.id)}
                  aria-label={`Edit ${map.name}`}
                  className="rounded px-1 text-xs text-muted opacity-0 group-hover:opacity-100 hover:text-ink focus:opacity-100"
                >
                  Edit
                </Link>
              )}
            </div>
            {children.length > 0 && <MapList nodes={children} {...props} />}
          </li>
        );
      })}
    </ul>
  );
}

/** The map pointed at, with a pin for each map inside it, and where it is in its parent. */
function Preview({
  entry,
  entries,
  faces,
  player,
  onPreview,
}: {
  entry: Entry;
  entries: Map<string, Entry>;
  faces: (id: string) => PartyFace[];
  player: boolean;
  onPreview: (id: string) => void;
}) {
  const { node, path } = entry;
  const { map } = node;
  const parent = path.at(-1);
  const pins = map.pins.flatMap((pin) => {
    const child = entries.get(pin.map);
    return child ? [{ ...pin, name: child.node.map.name }] : [];
  });
  return (
    <section
      aria-label={`Preview of ${map.name}`}
      className="gh-panel flex flex-col gap-3 rounded-lg border border-line bg-surface p-3 shadow-sm md:sticky md:top-4"
    >
      <p className="flex flex-wrap items-center gap-1 text-sm text-muted">
        {path.length === 0
          ? "Top level"
          : path.map((each, index) => (
              <span key={each.id}>
                {index > 0 && "› "}
                <button
                  type="button"
                  className="text-link hover:underline"
                  onClick={() => onPreview(each.id)}
                >
                  {each.name}
                </button>
              </span>
            ))}
      </p>
      <Picture map={map} maxHeight="60vh">
        {pins.map((pin) => (
          <Pin
            key={pin.map}
            at={pin.at}
            name={pin.name}
            faces={faces(pin.map)}
            onClick={() => onPreview(pin.map)}
          />
        ))}
      </Picture>
      <div className="flex flex-wrap items-start gap-4">
        <div className="mr-auto flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-serif text-2xl font-bold text-title">{map.name}</h2>
            <Faces faces={faces(map.id)} size={24} />
          </div>
          <span className="text-sm text-muted">
            {insideText(node) || "No maps inside yet"}
            {pins.length > 0 && " · pick a pin to look inside"}
          </span>
          <div className="mt-1 flex gap-2">
            <Link to={mapUrl(map.id)} className={primaryButtonClass}>
              Open map
            </Link>
            {!player && (
              <Link to={mapEditUrl(map.id)} className={buttonClass}>
                Edit
              </Link>
            )}
          </div>
        </div>
        {parent && <Locator parent={parent} childId={map.id} onPreview={onPreview} />}
      </div>
    </section>
  );
}

/** A small copy of the parent map, ringed where this map is on it. */
function Locator({
  parent,
  childId,
  onPreview,
}: {
  parent: Listed;
  childId: string;
  onPreview: (id: string) => void;
}) {
  const at = parent.pins.find((pin) => pin.map === childId)?.at;
  return (
    <button
      type="button"
      onClick={() => onPreview(parent.id)}
      className="flex w-44 flex-col gap-1 text-left text-xs text-muted hover:text-ink"
      aria-label={`In ${parent.name}: preview it`}
    >
      <span>In {parent.name}</span>
      <Picture map={parent} maxHeight="8rem">
        {at && (
          <span
            aria-hidden
            className="absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#f6efdc] shadow-[0_0_0_2px_#1c1917]"
            style={{ left: `${at[0] * 100}%`, top: `${at[1] * 100}%` }}
          />
        )}
      </Picture>
    </button>
  );
}

/** A map's whole image at its own shape, fitting the width and a height limit. */
function Picture({
  map,
  maxHeight,
  children,
}: {
  map: Listed;
  maxHeight: string;
  children?: React.ReactNode;
}) {
  const ratio = map.size.width / map.size.height;
  return (
    <div
      className="relative mx-auto overflow-hidden rounded-md bg-raised"
      style={{ aspectRatio: `${ratio}`, width: `min(100%, calc(${maxHeight} * ${ratio}))` }}
    >
      {map.thumbnail ? (
        <img src={map.thumbnail} alt="" className="absolute inset-0 size-full object-cover" />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center text-sm text-muted">
          Image not found
        </span>
      )}
      {children}
    </div>
  );
}

/** A map inside this one: the same pin as an area on a map, or the party's faces if they're in it. */
function Pin({
  at,
  name,
  faces,
  onClick,
}: {
  at: [number, number];
  name: string;
  faces: PartyFace[];
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={`${name}: look inside`}
      onClick={onClick}
      className="group absolute -translate-x-1/2 -translate-y-1/2 p-1.5 outline-none"
      style={{ left: `${at[0] * 100}%`, top: `${at[1] * 100}%` }}
    >
      {faces.length > 0 ? (
        <Faces faces={faces} size={22} />
      ) : (
        <span className="block size-3 rotate-45 border-[1.5px] border-[#1c1917] bg-[#f6efdc] transition-transform group-hover:scale-125 group-focus-visible:scale-125" />
      )}
      <span className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 rounded bg-[#f6efdc] px-1.5 py-0.5 text-xs font-semibold whitespace-nowrap text-[#1c1917] opacity-0 shadow group-hover:opacity-100 group-focus-visible:opacity-100">
        {name}
      </span>
    </button>
  );
}

function Face({ face, size = 24 }: { face: PartyFace; size?: number }) {
  return face.portraitUrl ? (
    <img
      src={face.portraitUrl}
      alt={face.name}
      title={face.name}
      width={size}
      height={size}
      className="rounded-full border border-line object-cover object-top"
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      title={face.name}
      className="flex items-center justify-center rounded-full border border-line bg-raised text-xs font-bold text-ink"
      style={{ width: size, height: size }}
    >
      {face.name.slice(0, 1)}
    </span>
  );
}

function Faces({ faces, size = 22 }: { faces: PartyFace[]; size?: number }) {
  if (faces.length === 0) return null;
  return (
    <span className="flex -space-x-1.5" aria-label={`Here: ${faces.map((f) => f.name).join(", ")}`}>
      {faces.map((face) => (
        <Face key={face.name} face={face} size={size} />
      ))}
    </span>
  );
}

function countMaps(nodes: Node[]): number {
  return nodes.reduce((sum, node) => sum + 1 + countMaps(node.children), 0);
}

function insideText(node: Node) {
  const count = countMaps(node.children);
  return count === 0 ? "" : count === 1 ? "1 map inside" : `${count} maps inside`;
}

/* Areas on a map */

function AreasOnAMap({
  data,
  view,
  style,
  player,
}: {
  data: Data;
  view: NonNullable<Data["view"]>;
  style: AreaStyle;
  player: boolean;
}) {
  const [showAll, setShowAll] = useState(false);
  const [highlight, setHighlight] = useState<string>();
  const [previewed, setPreviewed] = useState<string>();
  const [selected, setSelected] = useState<AreaView>();
  const areas = player ? view.areas.filter((area) => !area.secret) : view.areas;
  const faces = (id: string) => data.inside.find((badge) => badge.area === id)?.members ?? [];

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea, select")) return;
      if (event.key.toLowerCase() === "p" && !event.ctrlKey && !event.metaKey) {
        setShowAll((on) => !on);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <section aria-label="Areas on a map" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="mr-auto font-serif text-2xl font-bold">{view.name}</h2>
        <span className="text-sm text-muted">
          Other map: add <code>?map=&lt;id&gt;</code>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={showAll}
          className={showAll ? primaryButtonClass : buttonClass}
          onClick={() => setShowAll(!showAll)}
        >
          Places (P)
        </button>
      </div>
      <div className="flex h-[70vh] gap-0 overflow-hidden rounded-lg border border-line">
        <MapCanvas
          name={view.name}
          size={view.size}
          imageUrl={view.image.url}
          className="flex-1"
          onCanvasClick={() => setPreviewed(undefined)}
        >
          {(canvas) => (
            <g aria-label="Map areas" role="group">
              {areas.map((area) => (
                <PrototypeArea
                  key={area.id}
                  area={area}
                  size={view.size}
                  scale={canvas.scale}
                  style={style}
                  lit={showAll || highlight === area.id}
                  plain={player}
                  faces={faces(area.id)}
                  previewed={previewed === area.id}
                  onPreview={(chosen) => setPreviewed(chosen.id)}
                  onSelect={setSelected}
                />
              ))}
            </g>
          )}
        </MapCanvas>
        <aside className="flex w-64 flex-col gap-2 overflow-y-auto border-l border-line bg-surface p-3">
          <h3 className={labelClass}>Areas</h3>
          <ul className="flex flex-col text-sm">
            {[...areas]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((area) => (
                <li
                  key={area.id}
                  onMouseEnter={() => setHighlight(area.id)}
                  onMouseLeave={() => setHighlight(undefined)}
                  onFocus={() => setHighlight(area.id)}
                  onBlur={() => setHighlight(undefined)}
                >
                  {area.map ? (
                    <Link
                      to={mapUrl(area.map.id)}
                      className="block rounded px-1 py-0.5 hover:bg-raised"
                    >
                      ▸ {area.name}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setSelected(area)}
                      className="block w-full rounded px-1 py-0.5 text-left text-muted hover:bg-raised"
                    >
                      {player ? "▸" : "◌"} {area.name}
                      {!player && <span className="text-xs"> (not mapped yet)</span>}
                    </button>
                  )}
                </li>
              ))}
          </ul>
          {selected && (
            <p className="rounded-md bg-raised p-2 text-sm">
              Selected: <strong>{selected.name}</strong> (the side panel would open here)
            </p>
          )}
        </aside>
      </div>
    </section>
  );
}
