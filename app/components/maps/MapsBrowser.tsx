import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { buttonClass, labelClass, panelClass, primaryButtonClass } from "~/components/styles";
import type { MapTreeNode } from "~/maps/tree";
import type { PartyFace, Whereabouts } from "~/maps/tokens/types";
import type { ListedMap, MapId, Point } from "~/maps/types";
import { mapEditUrl, mapUrl } from "~/maps/urls";

type Node = MapTreeNode<ListedMap>;

/** Long enough that moving the mouse down the list doesn't flick through every map on the way. */
const HOVER_DELAY = 120;
/** Side by side, as on a tablet or bigger: below this the preview sits under the list. */
const SIDE_BY_SIDE = "(min-width: 48rem)";

/**
 * The Maps page's maps: every name in a nested list, and a preview of the one pointed at, with a
 * pin for each map inside it. The preview opens on the party's map.
 */
export function MapsBrowser({
  tree,
  party,
  faces,
  forDm,
}: {
  tree: Node[];
  party: Whereabouts[];
  faces: Record<MapId, PartyFace[]>;
  forDm: boolean;
}) {
  const entries = entriesOf(tree);
  const partyMap = party.find((member) => member.map && entries.has(member.map.id))?.map?.id;
  const preview = usePreview(partyMap ?? tree[0]?.map.id);
  const shown = (preview.id && entries.get(preview.id)) || entries.values().next().value!;
  const facesOf = (id: MapId) => faces[id] ?? [];
  usePreload(shown);

  return (
    <div className="flex flex-col gap-4">
      <PartyLine party={party} forDm={forDm} preview={preview} />
      <div className="grid items-start gap-4 md:grid-cols-[minmax(14rem,20rem)_minmax(0,1fr)]">
        <nav aria-label="All maps" className={`${panelClass} p-2`}>
          <MapList
            nodes={tree}
            shownId={shown.node.map.id}
            preview={preview}
            faces={facesOf}
            forDm={forDm}
          />
        </nav>
        <Preview entry={shown} entries={entries} faces={facesOf} forDm={forDm} preview={preview} />
      </div>
    </div>
  );
}

interface Entry {
  node: Node;
  /** Its ancestors, outermost first. */
  path: ListedMap[];
}

function entriesOf(tree: Node[]): Map<MapId, Entry> {
  const entries = new Map<MapId, Entry>();
  const walk = (nodes: Node[], path: ListedMap[]) => {
    for (const node of nodes) {
      entries.set(node.map.id, { node, path });
      walk(node.children, [...path, node.map]);
    }
  };
  walk(tree, []);
  return entries;
}

type PreviewControl = ReturnType<typeof usePreview>;

/** Which map is previewed: at once on focus or a click, after a moment when pointed at. */
function usePreview(initial: MapId | undefined) {
  const [id, setId] = useState(initial);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return {
    id,
    now(next: MapId) {
      clearTimeout(timer.current);
      setId(next);
    },
    soon(next: MapId) {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setId(next), HOVER_DELAY);
    },
    cancel() {
      clearTimeout(timer.current);
    },
  };
}

/**
 * Fetches the thumbnails of the maps next to the one previewed (its parent and the maps inside),
 * where the pointer is likely to go next, so they show at once.
 */
function usePreload({ node, path }: Entry) {
  const near = [path.at(-1), ...node.children.map((child) => child.map)];
  const urls = near.flatMap((map) => map?.thumbnail ?? []).join(" ");
  useEffect(() => {
    for (const url of urls.split(" ").filter(Boolean)) new Image().src = url;
  }, [urls]);
}

/** How the last press on a link began, and whether its map was previewed then (before focus). */
let press = { touch: false, previewed: false };

/**
 * Props for a link that previews its map: pointing at it, focusing it, or on touch (which has no
 * pointing) a first tap, when the preview is beside the list; the next tap opens it.
 */
function previewing(id: MapId, previewed: boolean, preview: PreviewControl) {
  return {
    onPointerEnter: (event: React.PointerEvent) => {
      if (event.pointerType !== "touch") preview.soon(id);
    },
    onPointerLeave: () => preview.cancel(),
    onPointerDown: (event: React.PointerEvent) => {
      press = { touch: event.pointerType === "touch", previewed };
    },
    onFocus: () => preview.now(id),
    onClick: (event: React.MouseEvent) => {
      if (!press.touch || press.previewed || !window.matchMedia(SIDE_BY_SIDE).matches) return;
      event.preventDefault();
      preview.now(id);
    },
  };
}

/** Where the party is (for a player, where they are) on one line; a map's name previews it. */
function PartyLine({
  party,
  forDm,
  preview,
}: {
  party: Whereabouts[];
  forDm: boolean;
  preview: PreviewControl;
}) {
  if (party.length === 0) return null;
  const heading = forDm ? "Where the party is" : "Where you are";
  return (
    <section aria-label={heading} className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
      <h2 className={labelClass}>{heading}</h2>
      {party.map((member) => (
        <span key={member.name} className="flex items-center gap-1.5">
          <Face face={member} size={22} />
          <span>
            <span className="font-semibold">{member.name}</span>{" "}
            {member.map ? (
              <>
                is on{" "}
                <Link
                  to={mapUrl(member.map.id)}
                  className="text-link hover:underline"
                  {...previewing(member.map.id, preview.id === member.map.id, preview)}
                >
                  {member.map.name}
                </Link>
              </>
            ) : (
              <span className="text-muted">isn't on a map yet</span>
            )}
          </span>
        </span>
      ))}
    </section>
  );
}

function MapList({
  nodes,
  shownId,
  preview,
  faces,
  forDm,
}: {
  nodes: Node[];
  shownId: MapId;
  preview: PreviewControl;
  faces: (id: MapId) => PartyFace[];
  forDm: boolean;
}) {
  return (
    <ul className="flex flex-col [&_ul]:ml-3 [&_ul]:border-l [&_ul]:border-line [&_ul]:pl-1.5">
      {nodes.map(({ map, children }) => {
        const previewed = map.id === shownId;
        return (
          <li key={map.id}>
            <div
              className={`group flex items-center gap-2 rounded-md px-2 py-1 ${
                previewed ? "bg-raised" : "hover:bg-raised"
              }`}
            >
              <Link
                to={mapUrl(map.id)}
                aria-current={previewed ? "true" : undefined}
                className={`mr-auto truncate ${previewed ? "font-semibold text-title" : ""}`}
                {...previewing(map.id, previewed, preview)}
              >
                {map.name}
              </Link>
              {map.imageMissing && (
                <span className="text-xs font-semibold text-danger">Image not found</span>
              )}
              <Faces faces={faces(map.id)} size={18} />
              {forDm && (
                <Link
                  to={mapEditUrl(map.id)}
                  aria-label={`Edit ${map.name}`}
                  className="rounded px-1 text-xs text-muted group-hover:opacity-100 hover:text-ink focus:opacity-100 md:opacity-0"
                >
                  Edit
                </Link>
              )}
            </div>
            {children.length > 0 && (
              <MapList
                nodes={children}
                shownId={shownId}
                preview={preview}
                faces={faces}
                forDm={forDm}
              />
            )}
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
  forDm,
  preview,
}: {
  entry: Entry;
  entries: Map<MapId, Entry>;
  faces: (id: MapId) => PartyFace[];
  forDm: boolean;
  preview: PreviewControl;
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
      aria-label={`Preview: ${map.name}`}
      className={`${panelClass} flex flex-col gap-3 p-3 md:sticky md:top-4`}
    >
      <nav
        aria-label="Where it is"
        className="flex flex-wrap items-center gap-1 text-sm text-muted"
      >
        {path.length === 0
          ? "Top level"
          : path.map((each) => (
              <span key={each.id}>
                <button
                  type="button"
                  className="text-link hover:underline"
                  onClick={() => preview.now(each.id)}
                >
                  {each.name}
                </button>{" "}
                ›
              </span>
            ))}
      </nav>
      <Picture
        map={map}
        forDm={forDm}
        frame="[--frame:min(45vh,26rem)] md:[--frame:min(60vh,34rem)]"
      >
        {pins.map((pin) => (
          <Pin
            key={pin.map}
            at={pin.at}
            name={pin.name}
            faces={faces(pin.map)}
            onClick={() => preview.now(pin.map)}
          />
        ))}
      </Picture>
      <div className="flex flex-wrap items-start gap-4">
        <div className="mr-auto flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-serif text-2xl font-bold text-title">{map.name}</h2>
            <Faces faces={faces(map.id)} size={24} />
          </div>
          <p className="text-sm text-muted">
            {insideText(node)}
            {pins.length > 0 && " · pick a pin to look inside"}
            {forDm && (map.shared ? " · Shared with players" : " · Not shared")}
          </p>
          <div className="mt-1 flex gap-2">
            <Link to={mapUrl(map.id)} className={primaryButtonClass}>
              Open map
            </Link>
            {forDm && (
              <Link to={mapEditUrl(map.id)} className={buttonClass}>
                Edit
              </Link>
            )}
          </div>
        </div>
        {parent && <Locator parent={parent} child={map} forDm={forDm} preview={preview} />}
      </div>
    </section>
  );
}

/** A small copy of the parent map, ringed where this map is on it. */
function Locator({
  parent,
  child,
  forDm,
  preview,
}: {
  parent: ListedMap;
  child: ListedMap;
  forDm: boolean;
  preview: PreviewControl;
}) {
  const at = parent.pins.find((pin) => pin.map === child.id)?.at;
  return (
    <button
      type="button"
      onClick={() => preview.now(parent.id)}
      className="flex w-44 flex-col gap-1 text-left text-xs text-muted hover:text-ink"
      aria-label={`In ${parent.name}: preview it`}
    >
      <span aria-hidden>In {parent.name}</span>
      <Picture map={parent} forDm={forDm} frame="[--frame:7rem]">
        {at && (
          <span
            aria-hidden
            className="absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-stone-50 ring-2 ring-stone-900"
            style={position(at)}
          />
        )}
      </Picture>
    </button>
  );
}

/**
 * A map's thumbnail in a frame of fixed height (`frame` sets `--frame`), at the map's own shape
 * within it, so moving from map to map doesn't move the page. Each map fades in.
 */
function Picture({
  map,
  forDm,
  frame,
  children,
}: {
  map: ListedMap;
  forDm: boolean;
  frame: string;
  children?: ReactNode;
}) {
  const ratio = map.size.width / map.size.height;
  return (
    <div className={`${frame} flex h-(--frame) w-full items-center justify-center`}>
      <div
        key={map.id}
        className={`relative overflow-hidden rounded-md motion-safe:animate-[preview-in_150ms_ease-out] ${
          // What players haven't explored is dark, as on the map itself.
          map.thumbnail ? "bg-stone-950" : "bg-raised"
        }`}
        style={{ aspectRatio: `${ratio}`, width: `min(100%, calc(var(--frame) * ${ratio}))` }}
      >
        {map.thumbnail ? (
          <img src={map.thumbnail} alt="" className="absolute inset-0 size-full" />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center p-2 text-center text-sm text-muted">
            {map.imageMissing ? "Image not found" : forDm ? "No picture yet" : "Not explored yet"}
          </span>
        )}
        {children}
      </div>
    </div>
  );
}

/** A map inside this one: a small diamond, or the party's faces if they're in it. */
function Pin({
  at,
  name,
  faces,
  onClick,
}: {
  at: Point;
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
      style={position(at)}
    >
      {faces.length > 0 ? (
        <Faces faces={faces} size={22} onArt />
      ) : (
        <span className="block size-3 rotate-45 border-[1.5px] border-stone-900 bg-stone-50 shadow transition-transform group-hover:scale-125 group-focus-visible:scale-125 group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-white" />
      )}
      <span className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 rounded bg-stone-50 px-1.5 py-0.5 text-xs font-semibold whitespace-nowrap text-stone-900 opacity-0 shadow group-hover:opacity-100 group-focus-visible:opacity-100">
        {name}
      </span>
    </button>
  );
}

const position = ([x, y]: Point) => ({ left: `${x * 100}%`, top: `${y * 100}%` });

/** A party member's face: over map art it keeps the same colours in every theme. */
function Face({ face, size, onArt }: { face: PartyFace; size: number; onArt?: boolean }) {
  const border = onArt ? "border-stone-50" : "border-line";
  return face.portraitUrl ? (
    <img
      src={face.portraitUrl}
      alt=""
      title={face.name}
      className={`rounded-full border object-cover object-top ${border}`}
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      aria-hidden
      title={face.name}
      className={`flex items-center justify-center rounded-full border text-xs font-bold ${border} ${
        onArt ? "bg-stone-700 text-white" : "bg-raised text-ink"
      }`}
      style={{ width: size, height: size }}
    >
      {face.name.charAt(0).toUpperCase()}
    </span>
  );
}

function Faces({ faces, size, onArt }: { faces: PartyFace[]; size: number; onArt?: boolean }) {
  if (faces.length === 0) return null;
  return (
    <span
      role="img"
      aria-label={`Here: ${faces.map((face) => face.name).join(", ")}`}
      className="flex shrink-0 -space-x-1.5"
    >
      {faces.map((face) => (
        <Face key={face.name} face={face} size={size} onArt={onArt} />
      ))}
    </span>
  );
}

function countMaps(nodes: Node[]): number {
  return nodes.reduce((sum, node) => sum + 1 + countMaps(node.children), 0);
}

function insideText(node: Node) {
  const count = countMaps(node.children);
  return count === 0 ? "No maps inside" : count === 1 ? "1 map inside" : `${count} maps inside`;
}
