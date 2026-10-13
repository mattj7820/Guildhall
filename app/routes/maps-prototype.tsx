/**
 * PROTOTYPE (deleted once the look is chosen): the Maps page in three layouts and areas on a map
 * in five styles, with switches, in the real themes. DM only. Thumbnails here are the DM's whole
 * images shrunk by the browser; the real ones will be made on the server, fog-safe for players.
 */
import { useEffect, useState } from "react";
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

const LAYOUTS = {
  nested: "Nested boxes",
  sections: "Sections",
  explorer: "Explorer",
  tree: "Tree (even rows)",
  cards: "Card grid",
} as const;
type Layout = keyof typeof LAYOUTS;

export default function MapsPrototype({ loaderData }: Route.ComponentProps) {
  const [layout, setLayout] = useState<Layout>("nested");
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
          Prototype: try the switches, then tell me which you like. Thumbnails here are your whole
          images shrunk by the browser (slow); the real ones will be small and fog-safe.
        </p>
        <Choice label="Theme" value={theme} options={themeOptions} onChange={setTheme} />
        <Choice label="Maps page" value={layout} options={LAYOUTS} onChange={setLayout} />
        <Choice label="Areas" value={style} options={AREA_STYLES} onChange={setStyle} />
        <Choice
          label="Look as"
          value={player ? "player" : "dm"}
          options={{ dm: "DM", player: "A player (shared maps, one area style)" }}
          onChange={(value) => setPlayer(value === "player")}
        />
      </div>

      <MapsPage data={loaderData} layout={layout} player={player} />
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

/* The Maps page */

function onlyShared(nodes: Node[]): Node[] {
  // A player sees shared maps, nested as shared maps lead to each other.
  return nodes.flatMap((node) =>
    node.map.shared
      ? [{ map: node.map, children: onlyShared(node.children) }]
      : onlyShared(node.children),
  );
}

function MapsPage({ data, layout, player }: { data: Data; layout: Layout; player: boolean }) {
  const tree = player ? onlyShared(data.tree) : data.tree;
  const faces = (id: string) => data.faces[id] ?? [];
  const props = { tree, faces, player };
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
      <PartyLine data={data} />
      {layout === "nested" && <NestedLayout {...props} />}
      {layout === "sections" && <SectionsLayout {...props} />}
      {layout === "explorer" && <ExplorerLayout {...props} />}
      {layout === "tree" && <TreeLayout {...props} />}
      {layout === "cards" && <CardsLayout {...props} />}
    </section>
  );
}

interface LayoutProps {
  tree: Node[];
  faces: (id: string) => PartyFace[];
  player: boolean;
}

/** "Where the party is" on one line. */
function PartyLine({ data }: { data: Data }) {
  if (data.party.length === 0) return null;
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
      <span className={labelClass}>Where the party is</span>
      {data.party.map((member) => (
        <span key={member.name} className="flex items-center gap-1.5">
          <Face face={member} />
          <span className="font-semibold">{member.name}</span>{" "}
          {member.map ? (
            <Link to={mapUrl(member.map.id)} className="text-link hover:underline">
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

function Thumb({ map, className = "" }: { map: Listed; className?: string }) {
  return map.thumbnail ? (
    <img
      src={map.thumbnail}
      alt=""
      loading="lazy"
      className={`block bg-raised object-cover ${className}`}
    />
  ) : (
    <span className={`flex items-center justify-center bg-raised text-xs text-muted ${className}`}>
      No image
    </span>
  );
}

function EditLink({ map, player }: { map: Listed; player: boolean }) {
  if (player) return null;
  return (
    <Link
      to={mapEditUrl(map.id)}
      aria-label={`Edit ${map.name}`}
      className="rounded px-1 text-xs text-muted hover:bg-raised hover:text-ink"
    >
      Edit
    </Link>
  );
}

function countMaps(nodes: Node[]): number {
  return nodes.reduce((sum, node) => sum + 1 + countMaps(node.children), 0);
}

function insideText(node: Node) {
  const count = countMaps(node.children);
  return count === 0 ? "" : count === 1 ? "1 map inside" : `${count} maps inside`;
}

/**
 * A map as a card: the thumbnail edge to edge, faces over its corner, the name and Edit under it.
 * A map with maps inside shows a stack of sheets behind it.
 */
function Card({
  node,
  faces,
  player,
  path,
  footer,
}: {
  node: Node;
  faces: (id: string) => PartyFace[];
  player: boolean;
  path?: string;
  footer?: React.ReactNode;
}) {
  const { map } = node;
  const stacked = node.children.length > 0;
  return (
    <div className="relative">
      {stacked && (
        <>
          <span
            aria-hidden
            className="absolute inset-x-3 -top-2 h-4 rounded-t-lg border border-line bg-raised"
          />
          <span
            aria-hidden
            className="absolute inset-x-1.5 -top-1 h-4 rounded-t-lg border border-line bg-surface"
          />
        </>
      )}
      <div className="gh-card relative flex h-full flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-sm transition">
        <Link to={mapUrl(map.id)} tabIndex={-1} aria-hidden className="relative">
          <Thumb map={map} className="aspect-[3/2] w-full" />
          <span className="absolute top-2 right-2">
            <Faces faces={faces(map.id)} />
          </span>
        </Link>
        <div className="flex flex-col gap-0.5 px-3 py-2">
          {path && <span className="truncate text-xs text-muted">{path}</span>}
          <div className="flex items-baseline gap-2">
            <Link to={mapUrl(map.id)} className="mr-auto font-serif font-semibold hover:underline">
              {map.name}
            </Link>
            <EditLink map={map} player={player} />
          </div>
          {footer ?? (stacked && <span className="text-xs text-muted">{insideText(node)}</span>)}
        </div>
      </div>
    </div>
  );
}

const GRID = "grid grid-cols-[repeat(auto-fill,minmax(12rem,15rem))] gap-4";

/**
 * Nested: maps on their own as cards; a map with maps inside is a card beside the box of what's
 * inside it, boxes inside boxes, each folding away.
 */
function NestedLayout({ tree, faces, player }: LayoutProps) {
  return (
    <nav aria-label="All maps" className="flex flex-col gap-4">
      <NestedLevel nodes={tree} faces={faces} player={player} />
    </nav>
  );
}

function NestedLevel({ nodes, faces, player }: Omit<LayoutProps, "tree"> & { nodes: Node[] }) {
  const leaves = nodes.filter((node) => node.children.length === 0);
  const groups = nodes.filter((node) => node.children.length > 0);
  return (
    <>
      {groups.map((node) => (
        <NestedGroup key={node.map.id} node={node} faces={faces} player={player} />
      ))}
      {leaves.length > 0 && (
        <div className={GRID}>
          {leaves.map((node) => (
            <Card key={node.map.id} node={node} faces={faces} player={player} />
          ))}
        </div>
      )}
    </>
  );
}

function NestedGroup({ node, faces, player }: Omit<LayoutProps, "tree"> & { node: Node }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="grid items-start gap-4 md:grid-cols-[13rem_1fr]">
      <Card
        node={node}
        faces={faces}
        player={player}
        footer={
          <button
            type="button"
            aria-expanded={open}
            className="self-start text-xs text-link hover:underline"
            onClick={() => setOpen(!open)}
          >
            {open ? "▾" : "▸"} {insideText(node)}
          </button>
        }
      />
      {open && (
        <div
          aria-label={`Inside ${node.map.name}`}
          role="group"
          className="flex flex-col gap-4 rounded-lg border border-dashed border-line bg-raised/50 p-3"
        >
          <NestedLevel nodes={node.children} faces={faces} player={player} />
        </div>
      )}
    </div>
  );
}

/** Sections: a heading for each map with maps inside, naming where it is, over its maps' cards. */
function SectionsLayout({ tree, faces, player }: LayoutProps) {
  const sections: { path: Listed[]; nodes: Node[] }[] = [{ path: [], nodes: tree }];
  const walk = (nodes: Node[], path: Listed[]) => {
    for (const node of nodes) {
      if (node.children.length === 0) continue;
      sections.push({ path: [...path, node.map], nodes: node.children });
      walk(node.children, [...path, node.map]);
    }
  };
  walk(tree, []);
  return (
    <nav aria-label="All maps" className="flex flex-col gap-6">
      {sections.map(({ path, nodes }) => (
        <section
          key={path.at(-1)?.id ?? "top"}
          id={`inside-${path.at(-1)?.id ?? "top"}`}
          className="flex flex-col gap-3"
        >
          <h2 className="flex flex-wrap items-baseline gap-1.5 border-b border-line pb-1 font-serif text-lg font-semibold">
            {path.length === 0
              ? "Top level"
              : path.map((map, index) => (
                  <span key={map.id} className={index < path.length - 1 ? "text-muted" : ""}>
                    {index > 0 && <span className="mr-1.5 text-muted">›</span>}
                    {index === path.length - 1 ? `Inside ${map.name}` : map.name}
                  </span>
                ))}
          </h2>
          <div className={GRID}>
            {nodes.map((node) => (
              <Card
                key={node.map.id}
                node={node}
                faces={faces}
                player={player}
                footer={
                  node.children.length > 0 && (
                    <a
                      href={`#inside-${node.map.id}`}
                      className="text-xs text-link hover:underline"
                    >
                      ↓ {insideText(node)}
                    </a>
                  )
                }
              />
            ))}
          </div>
        </section>
      ))}
    </nav>
  );
}

/** Explorer: a slim tree to the side, and the chosen map with what's inside it. */
function ExplorerLayout({ tree, faces, player }: LayoutProps) {
  const [chosen, setChosen] = useState<Node | undefined>(tree[0]);
  return (
    <div className="grid gap-4 md:grid-cols-[16rem_1fr]">
      <nav aria-label="All maps" className={`${panelClass} p-2`}>
        <ExplorerTree nodes={tree} chosen={chosen} onChoose={setChosen} faces={faces} />
      </nav>
      {chosen && (
        <div className="flex flex-col gap-4">
          <div className="gh-panel grid overflow-hidden rounded-lg border border-line bg-surface shadow-sm md:grid-cols-[1fr_16rem]">
            <Link to={mapUrl(chosen.map.id)} tabIndex={-1} aria-hidden>
              <Thumb map={chosen.map} className="aspect-[3/2] w-full" />
            </Link>
            <div className="flex flex-col gap-2 p-4">
              <h2 className="font-serif text-2xl font-bold">{chosen.map.name}</h2>
              <Faces faces={faces(chosen.map.id)} size={28} />
              <span className="text-sm text-muted">{insideText(chosen)}</span>
              <div className="mt-auto flex gap-2">
                <Link to={mapUrl(chosen.map.id)} className={primaryButtonClass}>
                  Open map
                </Link>
                {!player && (
                  <Link to={mapEditUrl(chosen.map.id)} className={buttonClass}>
                    Edit
                  </Link>
                )}
              </div>
            </div>
          </div>
          {chosen.children.length > 0 && (
            <>
              <h3 className={labelClass}>Inside {chosen.map.name}</h3>
              <div className={GRID}>
                {chosen.children.map((node) => (
                  <Card key={node.map.id} node={node} faces={faces} player={player} />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ExplorerTree({
  nodes,
  chosen,
  onChoose,
  faces,
}: {
  nodes: Node[];
  chosen?: Node;
  onChoose: (node: Node) => void;
  faces: (id: string) => PartyFace[];
}) {
  return (
    <ul className="flex flex-col [&_ul]:ml-3 [&_ul]:border-l [&_ul]:border-line [&_ul]:pl-1">
      {nodes.map((node) => (
        <li key={node.map.id}>
          <button
            type="button"
            aria-pressed={chosen?.map.id === node.map.id}
            onClick={() => onChoose(node)}
            className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-sm hover:bg-raised aria-pressed:bg-accent aria-pressed:text-on-accent"
          >
            <Thumb map={node.map} className="aspect-[3/2] w-9 shrink-0 rounded-sm" />
            <span className="mr-auto truncate">{node.map.name}</span>
            <Faces faces={faces(node.map.id)} size={16} />
          </button>
          {node.children.length > 0 && (
            <ExplorerTree nodes={node.children} chosen={chosen} onChoose={onChoose} faces={faces} />
          )}
        </li>
      ))}
    </ul>
  );
}

/** Tree: every map the same, a row with a small thumbnail, nested with lines. */
function TreeLayout({ tree, faces, player }: LayoutProps) {
  return (
    <nav aria-label="All maps" className={`${panelClass} p-2`}>
      <TreeRows nodes={tree} faces={faces} player={player} />
    </nav>
  );
}

function TreeRows({ nodes, faces, player }: Omit<LayoutProps, "tree"> & { nodes: Node[] }) {
  return (
    <ul className="flex flex-col [&_ul]:ml-10 [&_ul]:border-l-2 [&_ul]:border-line [&_ul]:pl-2">
      {nodes.map((node) => (
        <li key={node.map.id}>
          <div className="group flex items-center gap-3 rounded-md p-1.5 hover:bg-raised">
            <Link to={mapUrl(node.map.id)} tabIndex={-1} aria-hidden className="shrink-0">
              <Thumb map={node.map} className="aspect-[3/2] w-20 rounded-md" />
            </Link>
            <div className="flex min-w-0 flex-col">
              <Link
                to={mapUrl(node.map.id)}
                className="font-serif text-lg font-semibold hover:underline"
              >
                {node.map.name}
              </Link>
              <span className="text-xs text-muted">{insideText(node)}</span>
            </div>
            <span className="ml-auto flex items-center gap-3">
              <Faces faces={faces(node.map.id)} />
              <EditLink map={node.map} player={player} />
            </span>
          </div>
          {node.children.length > 0 && (
            <TreeRows nodes={node.children} faces={faces} player={player} />
          )}
        </li>
      ))}
    </ul>
  );
}

/** Cards: every map, depth first, with where it is written above its name. */
function CardsLayout({ tree, faces, player }: LayoutProps) {
  const flat: { node: Node; path: string }[] = [];
  const walk = (nodes: Node[], path: string[]) => {
    for (const node of nodes) {
      flat.push({ node, path: path.join(" › ") });
      walk(node.children, [...path, node.map.name]);
    }
  };
  walk(tree, []);
  return (
    <nav aria-label="All maps" className={GRID}>
      {flat.map(({ node, path }) => (
        <Card key={node.map.id} node={node} faces={faces} player={player} path={path || " "} />
      ))}
    </nav>
  );
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
